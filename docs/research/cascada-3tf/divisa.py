"""
Experimento 5 (2026-11-19): escuchar a la divisa, no al par. Reglas fijadas ANTES de ver resultados.

Pregunta del trader: la alerta v3 llega antes de tiempo, el precio sigue estirándose y la operación pasa mucho
tiempo en holgura. ¿Saber qué divisa causa el estirón y esperar a que esa divisa se agote acorta la holgura?

Datos: 1m de EUR/USD, EUR/GBP y GBP/USD de 2026, alineados por minuto. DEV ene-jul, VAL ago-nov.

Índices de divisa (log): EUR = (ln EURUSD + ln EURGBP)/2, GBP = (ln GBPUSD - ln EURGBP)/2,
USD = (-ln EURUSD - ln GBPUSD)/2.

Alerta: la misma de triangulo.py (disparador B de la v3: 3 ATR5 de estirón en la última hora, 4 pips hasta la
EMA 100 de 5m, abanico, cruce de la EMA 100 de 1m). s=+1 es venta (precio estirado arriba).

Divisa culpable: para el par B/Q, aporte de B = s*(idxB - EMA100 de 5m de idxB) y aporte de Q = -s*(idxQ - EMA100
de 5m de idxQ), con velas de 5m cerradas. La culpable es la de mayor aporte.

Variantes (la salida es siempre el contrato X4, calculado en el minuto de entrada: stop en el extremo de las
3 h previas ± 0,5 pips, objetivo al 50 % de la distancia a la EMA 100 de 5m o al tocarla, 175 min):
  V0  entra en la alerta (lo de hoy).
  V1  espera a que la culpable se agote: entra en el primer minuto j en [i, i+60] en que la serie de la culpable,
      con signo de "sigue empujando", cierra bajo su EMA 20 de 1m. Si no pasa en 60 min, no opera.
  V1f igual que V1 pero, si no pasa en 60 min, entra a los 60.
  R   control: los mismos disparos que V1, con retrasos al azar sacados de los retrasos de V1 y la misma tasa de
      "no opera" al azar. 200 repeticiones.
  V2  entrada en tres partes: 1/3 en la alerta, 1/3 si el precio va 0,5 ATR5 en contra, 1/3 si va 1 ATR5 en
      contra; un solo stop y objetivo para todo el paquete (los de la alerta). Resultado ponderado por tamaño.
  D   V0 separado por hora de la alerta: apertura de Londres (07:00-08:59 UTC), datos de NY (13:00-14:29 UTC),
      resto. Solo descriptivo.

Holgura: minutos desde la entrada hasta que la operación gana al menos el spread (0,8 pips) en algún momento.
Si nunca lo logra, cuenta toda su duración y se marca "nunca en verde".

Criterio (V1): pasa si en DEV y en VAL, con al menos 60 operaciones en cada periodo,
  1) la holgura mediana baja al menos un 30 % frente a V0,
  2) el neto por operación no es peor que el de V0,
  3) la holgura mediana queda por debajo del percentil 2,5 del control R.
Si falla cualquiera, se descarta.
"""
import sys
import numpy as np
import pandas as pd

PIP = 1e-4
SPREAD = 0.8
SPLIT = pd.Timestamp('2026-08-01', tz='UTC')
PAIRS = {'EUR/USD': ('EUR', 'USD'), 'EUR/GBP': ('EUR', 'GBP'), 'GBP/USD': ('GBP', 'USD')}
rng = np.random.default_rng(7)


def ema(x, n=100):
    return pd.Series(x).ewm(span=n, adjust=False).mean().to_numpy()


def atr(h, l, c, n=14):
    pc = np.roll(c, 1); pc[0] = c[0]
    tr = np.maximum(h - l, np.maximum(np.abs(h - pc), np.abs(l - pc)))
    return pd.Series(tr).ewm(alpha=1 / n, adjust=False).mean().to_numpy()


def load(path):
    df = pd.read_csv(path, parse_dates=['datetime'])
    df['t'] = df['datetime'].dt.tz_localize('UTC')
    return df.set_index('t')[['high', 'low', 'close']]


def tf_series(t, x, minutes, h=None, l=None):
    b = t.floor(f'{minutes}min')
    s = pd.DataFrame({'c': x, 'b': b})
    if h is not None:
        s['h'], s['l'] = h, l
        g = s.groupby('b').agg(h=('h', 'max'), l=('l', 'min'), c=('c', 'last'))
        g['atr'] = atr(g['h'].to_numpy(), g['l'].to_numpy(), g['c'].to_numpy())
    else:
        g = s.groupby('b').agg(c=('c', 'last'))
    g['ema'] = ema(g['c'].to_numpy())
    m = g.shift(1).reindex(b)
    return m['ema'].to_numpy(), (m['atr'].to_numpy() if h is not None else None)


raw = {'EUR/USD': load(sys.argv[1]), 'EUR/GBP': load(sys.argv[2]), 'GBP/USD': load(sys.argv[3])}
idx = raw['EUR/USD'].index.intersection(raw['EUR/GBP'].index).intersection(raw['GBP/USD'].index)
ny = idx.tz_convert('America/New_York')
closed = ((ny.dayofweek == 4) & (ny.hour >= 17)) | (ny.dayofweek == 5) | ((ny.dayofweek == 6) & (ny.hour < 17))
idx = idx[~closed]
T = idx
data = {k: v.loc[idx] for k, v in raw.items()}

L = {k: np.log(v['close'].to_numpy(float)) for k, v in data.items()}
CUR = {
    'EUR': (L['EUR/USD'] + L['EUR/GBP']) / 2,
    'GBP': (L['GBP/USD'] - L['EUR/GBP']) / 2,
    'USD': (-L['EUR/USD'] - L['GBP/USD']) / 2,
}
CUR_E5 = {k: tf_series(T, v, 5)[0] for k, v in CUR.items()}
CUR_E20 = {k: ema(v, 20) for k, v in CUR.items()}


def engine(df):
    c, h, l = (df[k].to_numpy(float) for k in ('close', 'high', 'low'))
    e1 = ema(c)
    e5, a5 = tf_series(T, c, 5, h, l)
    e15, _ = tf_series(T, c, 15, h, l)
    return c, h, l, e1, e5, e15, a5


def alerts(pair):
    c, h, l, e1, e5, e15, a5 = E[pair]
    u = (c - e5) / a5
    roll = {s: pd.Series(s * u).rolling(60, min_periods=1).max().to_numpy() for s in (1, -1)}
    out = []
    for i in range(4500, len(c) - 240):
        for s in (1, -1):
            if not (s * (c[i] - e1[i]) < 0 and s * (c[i - 1] - e1[i - 1]) > 0):
                continue
            if not (s * (e1[i] - e5[i]) > 0 and s * (e5[i] - e15[i]) > 0):
                continue
            if roll[s][i] < 3 or s * (c[i] - e5[i]) / PIP < 4 or s * (c[i] - e15[i]) <= 0:
                continue
            out.append((i, s))
            break
    return out


def run(pair, j, s, stop=None, target_pips=None):
    c, h, l, e1, e5, e15, a5 = E[pair]
    n = len(c)
    if stop is None:
        a = max(0, j - 180)
        stop = h[a:j + 1].max() + 0.5 * PIP if s > 0 else l[a:j + 1].min() - 0.5 * PIP
    d0 = s * (c[j] - e5[j]) if target_pips is None else target_pips
    end = min(n - 1, j + 175)
    mae, green_at, out = 0.0, None, None
    for k in range(j + 1, end + 1):
        mae = max(mae, (h[k] - c[j]) if s > 0 else (c[j] - l[k]))
        if (s > 0 and h[k] >= stop) or (s < 0 and l[k] <= stop):
            out = (s * (c[j] - stop), k); break
        best = (c[j] - l[k]) if s > 0 else (h[k] - c[j])
        if green_at is None and best >= SPREAD * PIP:
            green_at = k
        if (s > 0 and l[k] <= e5[k]) or (s < 0 and h[k] >= e5[k]):
            out = (s * (c[j] - e5[k]), k); break
        if best >= 0.5 * d0:
            out = (0.5 * d0, k); break
    if out is None:
        out = (s * (c[j] - c[end]), end)
    mins = out[1] - j
    slack = (green_at - j) if green_at is not None else mins
    return dict(pips=out[0] / PIP, mins=mins, mae=mae / PIP, slack=slack, never=green_at is None, exit=out[1])


def wait_for_driver(pair, i, s):
    base, quote = PAIRS[pair]
    cb = s * (CUR[base][i] - CUR_E5[base][i])
    cq = -s * (CUR[quote][i] - CUR_E5[quote][i])
    driver, sign = (base, s) if cb >= cq else (quote, -s)
    push = sign * CUR[driver]
    push_e = sign * CUR_E20[driver]
    for j in range(i, i + 61):
        if push[j] < push_e[j]:
            return driver, j - i
    return driver, None


def summarize(rows):
    d = pd.DataFrame(rows)
    return d


def line(d, lab):
    if len(d) == 0:
        print(f'  {lab:<26} n=   0'); return
    net = d.pips - SPREAD
    se = net.std(ddof=1) / np.sqrt(len(d)) if len(d) > 1 else float('nan')
    print(f'  {lab:<26} n={len(d):4d} neto={net.mean():+5.2f}±{1.96*se:4.2f} holgura med={d.slack.median():5.1f} '
          f'p75={d.slack.quantile(.75):5.1f} nunca={d.never.mean()*100:4.1f}% MAE med={d.mae.median():4.1f} '
          f'p90={d.mae.quantile(.9):5.1f}')


E = {k: engine(v) for k, v in data.items()}
res = {v: [] for v in ('V0', 'V1', 'V1f', 'V2')}
events = []
for pair in PAIRS:
    busy = -1
    c, h, l, e1, e5, e15, a5 = E[pair]
    for i, s in alerts(pair):
        if i <= busy:
            continue
        t = T[i]
        r0 = run(pair, i, s)
        res['V0'].append(dict(pair=pair, t=t, hour=t.hour + t.minute / 60, **r0))
        driver, delay = wait_for_driver(pair, i, s)
        events.append((pair, i, s, delay))
        if delay is not None:
            r1 = run(pair, i + delay, s)
            res['V1'].append(dict(pair=pair, t=t, delay=delay, driver=driver, **r1))
            res['V1f'].append(dict(pair=pair, t=t, delay=delay, driver=driver, **r1))
        else:
            r1 = run(pair, i + 60, s)
            res['V1f'].append(dict(pair=pair, t=t, delay=60, driver=driver, **r1))
        a = max(0, i - 180)
        stop = h[a:i + 1].max() + 0.5 * PIP if s > 0 else l[a:i + 1].min() - 0.5 * PIP
        d0 = s * (c[i] - e5[i])
        parts = [i]
        for k_atr in (0.5, 1.0):
            lvl = c[i] + s * k_atr * a5[i]
            hit = None
            for k in range(i + 1, min(len(c) - 1, i + 175)):
                if (s > 0 and h[k] >= stop) or (s < 0 and l[k] <= stop):
                    break
                if (s > 0 and h[k] >= lvl) or (s < 0 and l[k] <= lvl):
                    hit = k; break
            if hit is not None:
                parts.append(hit)
        sub = [run(pair, j, s, stop=stop, target_pips=d0 + 2 * s * (c[j] - c[i])) for j in parts]
        w = 1 / 3
        res['V2'].append(dict(pair=pair, t=t, pips=sum(x['pips'] for x in sub) * w,
                              mins=max(x['exit'] for x in sub) - i, mae=sum(x['mae'] for x in sub) * w,
                              slack=r0['slack'], never=r0['never'], parts=len(parts)))
        busy = max(r0['exit'], i + 60)

D = {k: pd.DataFrame(v) for k, v in res.items()}
for k, d in D.items():
    d['per'] = np.where(d.t < SPLIT, 'DEV', 'VAL')

print('Resultados por variante y periodo (pips; holgura en minutos)')
for k in ('V0', 'V1', 'V1f', 'V2'):
    for per in ('DEV', 'VAL'):
        line(D[k][D[k].per == per], f'{k} {per}')

v1 = D['V1']
skip_rate = 1 - len(v1) / len(events)
delays = v1.delay.to_numpy()
print(f'\nV1: {len(events)} alertas, no opera en {skip_rate*100:.1f} %, retraso mediano {np.median(delays):.0f} min '
      f'(p75 {np.percentile(delays, 75):.0f}); entra sin esperar en {(delays == 0).mean()*100:.1f} %')
print('Culpable:', v1.driver.value_counts().to_dict())

print('\nControl R (200 repeticiones, retraso al azar con la misma distribución y tasa de no operar)')
ctrl = {'DEV': [], 'VAL': []}
ctrl_net = {'DEV': [], 'VAL': []}
for _ in range(200):
    rows = []
    for pair, i, s, _d in events:
        if rng.random() < skip_rate:
            continue
        dly = int(rng.choice(delays))
        r = run(pair, i + dly, s)
        rows.append(dict(t=T[i], **r))
    d = pd.DataFrame(rows)
    for per, sel in (('DEV', d.t < SPLIT), ('VAL', d.t >= SPLIT)):
        ctrl[per].append(d[sel].slack.median())
        ctrl_net[per].append((d[sel].pips - SPREAD).mean())
for per in ('DEV', 'VAL'):
    a, b = np.percentile(ctrl[per], [2.5, 97.5])
    na, nb = np.percentile(ctrl_net[per], [2.5, 97.5])
    print(f'  {per}: holgura mediana {np.mean(ctrl[per]):.1f} [{a:.1f}, {b:.1f}]  neto {np.mean(ctrl_net[per]):+.2f} [{na:+.2f}, {nb:+.2f}]')

print('\nCriterio V1')
ok_all = True
for per in ('DEV', 'VAL'):
    d0, d1 = D['V0'][D['V0'].per == per], v1[v1.per == per]
    h0, h1 = d0.slack.median(), d1.slack.median()
    c1 = h1 <= 0.7 * h0
    c2 = (d1.pips - SPREAD).mean() >= (d0.pips - SPREAD).mean()
    c3 = h1 < np.percentile(ctrl[per], 2.5)
    c4 = len(d1) >= 60
    ok_all &= c1 and c2 and c3 and c4
    print(f'  {per}: holgura {h0:.1f} -> {h1:.1f} (-30 %: {c1}) · neto no peor: {c2} · mejor que el azar: {c3} · n>=60: {c4}')
print('  PASA' if ok_all else '  NO PASA')

print('\nD: V0 por hora de la alerta (UTC)')
d0 = D['V0']
grp = np.where((d0.hour >= 7) & (d0.hour < 9), 'apertura Londres',
               np.where((d0.hour >= 13) & (d0.hour < 14.5), 'datos NY', 'resto'))
for g in ('apertura Londres', 'datos NY', 'resto'):
    for per in ('DEV', 'VAL'):
        line(d0[(grp == g) & (d0.per == per)], f'{g} {per}')

print('\nPor par (V0 frente a V1, todo el año)')
for pair in PAIRS:
    line(D['V0'][D['V0'].pair == pair], f'V0 {pair}')
    line(v1[v1.pair == pair], f'V1 {pair}')

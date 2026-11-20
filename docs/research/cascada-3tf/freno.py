"""
Experimento 7 (2026-11-19): el freno de 1 ATR. Reglas fijadas ANTES de ver los datos de 2025.

Origen: en el experimento 6 (datos de 2026) el control "salir si la operación va 1 ATR de 5m en contra" bajó la
peor operación del contrato vivo de −113 a −15 pips con un neto parecido. Como se eligió después de ver esos
datos, se prueba aquí con un año que ningún experimento ha usado: 2025 (1m de Twelve Data, EUR/USD, EUR/GBP y
GBP/USD). La regla es idéntica a la del control del experimento 6; no se ajusta nada.

Alertas: las de la v3 (mismo disparador que triangulo.py y persecucion.py). La siguiente alerta de un par solo
cuenta después de la salida del contrato vivo, igual para las dos variantes.
Spread por par: EUR/USD 0,8; GBP/USD 1,3; EUR/GBP 1,2 pips.

  BASE   contrato vivo, sin stop: objetivo al 50 % de la distancia a la EMA 100 de 5m, o tocar esa EMA, o 175 min.
  FRENO  lo mismo, y además sale al cierre del minuto en que, desde la primera vela de 5m cerrada después de la
         entrada, el precio va al menos 1 ATR de 5m en contra de la entrada.

Cola = media del peor 10 % de los resultados netos (pips). Periodos: H1 (ene-jun 2025) y H2 (jul-dic 2025).
Criterio: el freno pasa si
  1) la cola mejora al menos un 30 % frente a BASE en H1 y en H2,
  2) en el año completo, el neto medio no es peor que el de BASE,
  3) en cada mitad, el neto medio no es peor que el de BASE en más de 0,2 pips.
Se informa además, sin criterio: USD por operación con el tamaño en vivo (20 USD / max(stop de referencia, 3 pips)),
peor operación en USD, porcentaje de operaciones ganadoras y "salidas lamentadas": operaciones que el freno cerró
y que sin freno habrían terminado ganando.
"""
import sys
import numpy as np
import pandas as pd

PIP = 1e-4
SPREADS = {'EUR/USD': 0.8, 'EUR/GBP': 1.2, 'GBP/USD': 1.3}
FILES = {'EUR/USD': sys.argv[1], 'EUR/GBP': sys.argv[2], 'GBP/USD': sys.argv[3]}
MID = pd.Timestamp(sys.argv[4], tz='UTC') if len(sys.argv) > 4 else pd.Timestamp('2025-07-01', tz='UTC')


def ema(x, n=100):
    return pd.Series(x).ewm(span=n, adjust=False).mean().to_numpy()


def atr(h, l, c, n=14):
    pc = np.roll(c, 1); pc[0] = c[0]
    tr = np.maximum(h - l, np.maximum(np.abs(h - pc), np.abs(l - pc)))
    return pd.Series(tr).ewm(alpha=1 / n, adjust=False).mean().to_numpy()


def load(path):
    df = pd.read_csv(path, parse_dates=['datetime'])
    df['t'] = df['datetime'].dt.tz_localize('UTC')
    ny = df['t'].dt.tz_convert('America/New_York')
    dow, hr = ny.dt.dayofweek, ny.dt.hour
    closed = ((dow == 4) & (hr >= 17)) | (dow == 5) | ((dow == 6) & (hr < 17))
    return df[~closed].reset_index(drop=True)


def frames(df):
    b = df['t'].dt.floor('5min')
    g = df.groupby(b).agg(h=('high', 'max'), l=('low', 'min'), c=('close', 'last'))
    g['ema'] = ema(g['c'].to_numpy())
    g['atr'] = atr(g['h'].to_numpy(), g['l'].to_numpy(), g['c'].to_numpy())
    m5 = g.shift(1).reindex(b.to_numpy())
    b15 = df['t'].dt.floor('15min')
    g15 = df.groupby(b15).agg(c=('close', 'last'))
    g15['ema'] = ema(g15['c'].to_numpy())
    e15 = g15.shift(1).reindex(b15.to_numpy())['ema'].to_numpy()
    return m5['ema'].to_numpy(), m5['atr'].to_numpy(), e15, b.to_numpy()


def alerts(c, e1, e5, e15, a5):
    u = (c - e5) / a5
    roll = {s: pd.Series(s * u).rolling(60, min_periods=1).max().to_numpy() for s in (1, -1)}
    for i in range(4500, len(c) - 240):
        for s in (1, -1):
            if not (s * (c[i] - e1[i]) < 0 and s * (c[i - 1] - e1[i - 1]) > 0):
                continue
            if not (s * (e1[i] - e5[i]) > 0 and s * (e5[i] - e15[i]) > 0):
                continue
            if roll[s][i] < 3 or s * (c[i] - e5[i]) / PIP < 4 or s * (c[i] - e15[i]) <= 0:
                continue
            yield i, s
            break


def simulate(c, h, l, e5, a5, bucket, i, s, brake):
    n = len(c)
    d0 = s * (c[i] - e5[i])
    end = min(n - 1, i + 175)
    armed = False
    for k in range(i + 1, end + 1):
        if (s > 0 and l[k] <= e5[k]) or (s < 0 and h[k] >= e5[k]):
            return s * (c[i] - e5[k]) / PIP, k, False
        best = (c[i] - l[k]) if s > 0 else (h[k] - c[i])
        if best >= 0.5 * d0:
            return 0.5 * d0 / PIP, k, False
        if bucket[k] != bucket[i]:
            armed = True
        if brake and armed and s * (c[k] - c[i]) >= a5[k]:
            return s * (c[i] - c[k]) / PIP, k, True
    return s * (c[i] - c[end]) / PIP, end, False


def tail(x):
    x = np.sort(np.asarray(x))
    m = max(1, int(round(len(x) * 0.1)))
    return x[:m].mean()


rows = []
for pair, path in FILES.items():
    df = load(path)
    c, h, l = (df[k].to_numpy(float) for k in ('close', 'high', 'low'))
    e1 = ema(c)
    e5, a5, e15, bucket = frames(df)
    busy = -1
    for i, s in alerts(c, e1, e5, e15, a5):
        if i <= busy:
            continue
        base, kb, _ = simulate(c, h, l, e5, a5, bucket, i, s, False)
        brk, _, braked = simulate(c, h, l, e5, a5, bucket, i, s, True)
        busy = kb
        a = max(0, i - 180)
        stop = h[a:i + 1].max() + 0.5 * PIP if s > 0 else l[a:i + 1].min() - 0.5 * PIP
        stop_pips = max(abs(stop - c[i]) / PIP, 3.0)
        sp = SPREADS[pair]
        rows.append(dict(pair=pair, t=df['t'].iloc[i], base=base - sp, freno=brk - sp, braked=braked,
                         regret=braked and base - sp > 0, usd_unit=20 / stop_pips))

d = pd.DataFrame(rows)
d['per'] = np.where(d.t < MID, 'H1', 'H2')
d['base_usd'] = d.base * d.usd_unit
d['freno_usd'] = d.freno * d.usd_unit
print(f'Alertas: {len(d)} (H1 {int((d.per == "H1").sum())}, H2 {int((d.per == "H2").sum())}), '
      f'de {d.t.min():%Y-%m-%d} a {d.t.max():%Y-%m-%d}')


def line(x, lab):
    for col in ('base', 'freno'):
        v = x[col].to_numpy()
        se = v.std(ddof=1) / np.sqrt(len(v))
        u = x[f'{col}_usd'].to_numpy()
        print(f'  {lab:<6} {col:<5} n={len(v):4d} neto {v.mean():+5.2f}±{1.96*se:4.2f} cola {tail(v):+6.1f} '
              f'peor {v.min():+6.1f} gana {(v > 0).mean()*100:4.1f} % · USD/op {u.mean():+5.2f} peor USD {u.min():+7.1f}')


for per in ('H1', 'H2'):
    line(d[d.per == per], per)
line(d, 'año')
for pair in FILES:
    line(d[d.pair == pair], pair[:7])

fr = d[d.braked]
print(f'\nEl freno actuó en {len(fr)} de {len(d)} ({len(fr)/len(d)*100:.1f} %); '
      f'salidas lamentadas (sin freno habrían ganado): {int(fr.regret.sum())} ({fr.regret.mean()*100:.1f} % de las frenadas)')

print('\nCriterio')
ok = True
for per in ('H1', 'H2'):
    x = d[d.per == per]
    c1 = tail(x.freno) >= 0.7 * tail(x.base)
    c3 = x.freno.mean() >= x.base.mean() - 0.2
    ok &= c1 and c3
    print(f'  {per}: cola {tail(x.base):+.1f} -> {tail(x.freno):+.1f} (mejora 30 %: {c1}) · '
          f'neto {x.base.mean():+.2f} -> {x.freno.mean():+.2f} (no peor en más de 0,2: {c3})')
c2 = d.freno.mean() >= d.base.mean()
ok &= c2
print(f'  año: neto {d.base.mean():+.2f} -> {d.freno.mean():+.2f} (no peor: {c2})')
print('  PASA' if ok else '  NO PASA')

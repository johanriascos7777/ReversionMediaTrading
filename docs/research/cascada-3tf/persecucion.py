"""
Experimento 6 (2026-11-19): «Persecución», la EMA que persigue al precio. Reglas fijadas ANTES de ver resultados.

Idea: la EMA 100 de 5m se acerca al precio k = 2/101 de la brecha por vela. El precio se aleja a su propia
velocidad U (pendiente de regresión de las últimas 12 velas cerradas de 5m, con signo "alejándose de la EMA").
  G   = brecha con signo (positiva = estirado), en pips, de la última vela cerrada de 5m
  CRECE si U > k·G (el precio huye más rápido de lo que la EMA lo persigue); si no, CIERRA
  Geq = U / k   (brecha de equilibrio si la velocidad se mantiene)
  X   = max(0, Geq − G)   ("puede estirarse X pips más")

Datos: 1m de EUR/USD, EUR/GBP y GBP/USD de 2026, cada par por separado. DEV ene-jul, VAL ago-nov.
Alertas: las de la v3 (mismo disparador que triangulo.py). El conjunto de alertas es el mismo para todas las
variantes (la siguiente alerta de un par solo cuenta después de la salida del contrato vivo).
Spread por par: EUR/USD 0,8; GBP/USD 1,3; EUR/GBP 1,2 pips.

Contratos:
  VIVO   sin stop: objetivo al 50 % de la distancia a la EMA 100 de 5m, o tocar esa EMA, o 175 min.
  STOP   lo mismo con el stop en el extremo de las 3 h previas ± 0,5 pips (comprobado primero).

Experimento A (salida). Variantes sobre cada contrato:
  BASE   el contrato tal cual.
  PERS   además, sale al cierre del minuto en que, desde la primera vela de 5m cerrada después de la entrada,
         el estado es CRECE y X ≥ 1 ATR de 5m.
  CTRL   control simple: sale al cierre del minuto en que, con la misma cadencia (desde la primera vela de 5m
         cerrada tras la entrada), el precio va al menos 1 ATR de 5m en contra de la entrada.
  Cola = media del peor 10 % de los resultados netos (pips).
  Criterio principal (contrato VIVO): PERS pasa si en DEV y en VAL
    1) la cola mejora al menos un 30 % frente a BASE,
    2) el neto medio no es peor que el de BASE,
    3) el neto medio no es peor que el de CTRL.
  El contrato STOP se informa sin criterio.

Experimento B (predicción del estirón). En la alerta: X/ATR5. Realizado: lo máximo que el precio se alejó de la
entrada (MAE) en los 175 min siguientes, sin stop, dividido por ATR5. Rivales: G/ATR5 (la elasticidad) y U/ATR5
(la pendiente sola). Criterio: pasa si en DEV y en VAL la correlación de Spearman de X/ATR con MAE/ATR es ≥ 0,15
y supera a las dos rivales en al menos 0,05.
"""
import sys
import numpy as np
import pandas as pd

PIP = 1e-4
SPREADS = {'EUR/USD': 0.8, 'EUR/GBP': 1.2, 'GBP/USD': 1.3}
SPLIT = pd.Timestamp('2026-08-01', tz='UTC')
K = 2 / 101
FILES = {'EUR/USD': sys.argv[1], 'EUR/GBP': sys.argv[2], 'GBP/USD': sys.argv[3]}


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


def rolling_slope(y, n=12):
    t = pd.Series(np.arange(len(y), dtype=float))
    ys = pd.Series(y)
    sy = ys.rolling(n).sum()
    st = t.rolling(n).sum()
    sty = (t * ys).rolling(n).sum()
    stt = (t * t).rolling(n).sum()
    return ((n * sty - st * sy) / (n * stt - st * st)).to_numpy()


def frames(df):
    b = df['t'].dt.floor('5min')
    g = df.groupby(b).agg(h=('high', 'max'), l=('low', 'min'), c=('close', 'last'))
    g['ema'] = ema(g['c'].to_numpy())
    g['atr'] = atr(g['h'].to_numpy(), g['l'].to_numpy(), g['c'].to_numpy())
    g['gap'] = g['c'] - g['ema']
    g['slope'] = rolling_slope(g['c'].to_numpy())
    m5 = g.shift(1).reindex(b.to_numpy())
    b15 = df['t'].dt.floor('15min')
    g15 = df.groupby(b15).agg(c=('close', 'last'))
    g15['ema'] = ema(g15['c'].to_numpy())
    e15 = g15.shift(1).reindex(b15.to_numpy())['ema'].to_numpy()
    return (m5['ema'].to_numpy(), m5['atr'].to_numpy(), m5['gap'].to_numpy(), m5['slope'].to_numpy(), e15,
            b.to_numpy())


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


def simulate(P, i, s, use_stop, mode):
    c, h, l, e5, a5, gap5, slope5, bucket = P
    n = len(c)
    a = max(0, i - 180)
    stop = h[a:i + 1].max() + 0.5 * PIP if s > 0 else l[a:i + 1].min() - 0.5 * PIP
    d0 = s * (c[i] - e5[i])
    end = min(n - 1, i + 175)
    mae, out = 0.0, None
    armed = False
    for k in range(i + 1, end + 1):
        mae = max(mae, (h[k] - c[i]) if s > 0 else (c[i] - l[k]))
        if use_stop and ((s > 0 and h[k] >= stop) or (s < 0 and l[k] <= stop)):
            out = (s * (c[i] - stop), k); break
        if (s > 0 and l[k] <= e5[k]) or (s < 0 and h[k] >= e5[k]):
            out = (s * (c[i] - e5[k]), k); break
        best = (c[i] - l[k]) if s > 0 else (h[k] - c[i])
        if best >= 0.5 * d0:
            out = (0.5 * d0, k); break
        if bucket[k] != bucket[i]:
            armed = True
        if armed and mode == 'PERS':
            G = s * gap5[k]; U = s * slope5[k]
            if U > K * G and (U / K - G) >= a5[k]:
                out = (s * (c[i] - c[k]), k); break
        if armed and mode == 'CTRL':
            if s * (c[k] - c[i]) >= a5[k]:
                out = (s * (c[i] - c[k]), k); break
    if out is None:
        out = (s * (c[i] - c[end]), end)
    return out[0] / PIP, out[1], mae / PIP


def tail(x):
    x = np.sort(x)
    m = max(1, int(round(len(x) * 0.1)))
    return x[:m].mean()


rows = []
for pair, path in FILES.items():
    df = load(path)
    c, h, l = (df[k].to_numpy(float) for k in ('close', 'high', 'low'))
    e1 = ema(c)
    e5, a5, gap5, slope5, e15, bucket = frames(df)
    P = (c, h, l, e5, a5, gap5, slope5, bucket)
    busy = -1
    for i, s in alerts(c, e1, e5, e15, a5):
        if i <= busy:
            continue
        rec = dict(pair=pair, t=df['t'].iloc[i], spread=SPREADS[pair])
        for contract, use_stop in (('VIVO', False), ('STOP', True)):
            for mode in ('BASE', 'PERS', 'CTRL'):
                pips, k, mae = simulate(P, i, s, use_stop, mode)
                rec[f'{contract}_{mode}'] = pips - SPREADS[pair]
                if contract == 'VIVO' and mode == 'BASE':
                    busy = k
                    end = min(len(c) - 1, i + 175)
                    seg_h, seg_l = h[i + 1:end + 1], l[i + 1:end + 1]
                    rec['mae175'] = ((seg_h.max() - c[i]) if s > 0 else (c[i] - seg_l.min())) / PIP
        G = s * gap5[i] / PIP; U = s * slope5[i] / PIP; A = a5[i] / PIP
        rec['X_atr'] = max(0.0, U / K - G) / A
        rec['G_atr'] = G / A
        rec['U_atr'] = U / A
        rec['mae_atr'] = rec['mae175'] / A
        rec['crece'] = U > K * G
        rows.append(rec)

d = pd.DataFrame(rows)
d['per'] = np.where(d.t < SPLIT, 'DEV', 'VAL')
print(f'Alertas: {len(d)} (DEV {int((d.per == "DEV").sum())}, VAL {int((d.per == "VAL").sum())}); '
      f'en la alerta el estado era CRECE en {d.crece.mean()*100:.1f} %')

print('\nExperimento A: salida (pips netos por operación)')
for contract in ('VIVO', 'STOP'):
    for per in ('DEV', 'VAL'):
        x = d[d.per == per]
        parts = []
        for mode in ('BASE', 'PERS', 'CTRL'):
            v = x[f'{contract}_{mode}'].to_numpy()
            se = v.std(ddof=1) / np.sqrt(len(v))
            parts.append(f'{mode} neto {v.mean():+5.2f}±{1.96*se:4.2f} cola {tail(v):+6.1f} peor {v.min():+6.1f}')
        print(f'  {contract} {per}: ' + ' | '.join(parts))

print('\nCriterio A (contrato VIVO)')
ok_a = True
for per in ('DEV', 'VAL'):
    x = d[d.per == per]
    b, p, ct = x.VIVO_BASE.to_numpy(), x.VIVO_PERS.to_numpy(), x.VIVO_CTRL.to_numpy()
    c1 = tail(p) >= 0.7 * tail(b)
    c2 = p.mean() >= b.mean()
    c3 = p.mean() >= ct.mean()
    ok_a &= c1 and c2 and c3
    print(f'  {per}: cola {tail(b):+.1f} -> {tail(p):+.1f} (mejora 30 %: {c1}) · neto no peor que BASE: {c2} · '
          f'no peor que CTRL: {c3}')
print('  PASA' if ok_a else '  NO PASA')

print('\nExperimento B: ¿predice cuánto más se estira? (Spearman con MAE/ATR en 175 min)')
ok_b = True
for per in ('DEV', 'VAL'):
    x = d[d.per == per]
    r = {k: x[k].rank().corr(x.mae_atr.rank()) for k in ('X_atr', 'G_atr', 'U_atr')}
    c1 = r['X_atr'] >= 0.15
    c2 = r['X_atr'] >= r['G_atr'] + 0.05 and r['X_atr'] >= r['U_atr'] + 0.05
    ok_b &= c1 and c2
    print(f'  {per}: X {r["X_atr"]:+.3f} · elasticidad {r["G_atr"]:+.3f} · pendiente {r["U_atr"]:+.3f} '
          f'(>=0,15: {c1}; supera a las dos: {c2})')
    q = pd.qcut(x.X_atr.rank(method='first'), 3, labels=['bajo', 'medio', 'alto'])
    for lab in ('bajo', 'medio', 'alto'):
        y = x[q == lab]
        print(f'      X {lab:<5} n={len(y):4d} MAE/ATR mediana {y.mae_atr.median():.2f} p90 {y.mae_atr.quantile(.9):.2f} '
              f'neto VIVO {y.VIVO_BASE.mean():+.2f}')
print('  PASA' if ok_b else '  NO PASA')

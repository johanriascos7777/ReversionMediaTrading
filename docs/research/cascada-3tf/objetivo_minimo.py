"""
Experimento 4 (2026-11-13), reglas fijadas ANTES de correrlo.

Contexto: desde el 12-nov la v3 opera sin stop en el broker y sin salida por stop; el objetivo lo cobra el TP
del broker y el sistema solo cierra al tocar la EMA 100 de 5m o a los 175 min. El tamaño sigue saliendo de
20 USD / distancia al stop de referencia (mínimo 3 pips). En vivo, de madrugada y por la tarde, salieron
objetivos de ~2 pips con tamaños de 35.000-40.000 unidades.

Pregunta: ¿saltarse las alertas con objetivo pequeño, o calcular el tamaño con un stop mínimo mayor,
mejora el resultado en dólares?

Contratos simulados con el mismo disparador B de la v3:
  C-stop: el de la investigación (X4, con salida por stop).
  C-vivo: el que corre hoy (sin stop; objetivo, EMA 100 de 5m o 175 min).
Costos: spread por par (EUR/USD 0,8; GBP/USD 1,3; EUR/GBP 1,2 pips) y, como sensibilidad, 1 pip más de
deslizamiento en la entrada (en vivo se vieron diferencias de 1,6 a 3 pips entre Twelve Data y Capital.com).
Dólares por operación = pips netos x 20 / max(stop de referencia, piso de tamaño).

Variantes:
  objetivo mínimo X en {0, 3, 4, 5, 6} pips (se salta la alerta si el objetivo es menor);
  piso de tamaño P en {3, 10} pips (3 = lo de hoy).

Criterio: con C-vivo, una variante pasa si mejora los USD por operación en >= 1 USD frente a la de hoy
(X=0, P=3) en DEV y en VAL, con los tres pares juntos y en los dos escenarios de costo, y además su peor
operación no es peor. Se elige la que pase con menos alertas descartadas. Si ninguna pasa, no se cambia.
"""
import sys
import numpy as np
import pandas as pd

PIP = 1e-4
RISK = 20.0
FILES = {'EUR/USD': sys.argv[1], 'EUR/GBP': sys.argv[2], 'GBP/USD': sys.argv[3]}
SPREAD = {'EUR/USD': 0.8, 'EUR/GBP': 1.2, 'GBP/USD': 1.3}
SPLIT = pd.Timestamp('2026-08-01', tz='UTC')


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


def tf(df, minutes):
    b = df['t'].dt.floor(f'{minutes}min')
    g = df.groupby(b).agg(h=('high', 'max'), l=('low', 'min'), c=('close', 'last'))
    g['ema'] = ema(g['c'].to_numpy())
    g['atr'] = atr(g['h'].to_numpy(), g['l'].to_numpy(), g['c'].to_numpy())
    m = g[['ema', 'atr']].shift(1).reindex(b.to_numpy())
    return m['ema'].to_numpy(), m['atr'].to_numpy()


def simulate(df, use_stop):
    c, h, l = (df[k].to_numpy(float) for k in ('close', 'high', 'low'))
    e1 = ema(c)
    e5, a5 = tf(df, 5)
    e15, _ = tf(df, 15)
    u = (c - e5) / a5
    n = len(c)
    roll = {s: pd.Series(s * u).rolling(60, min_periods=1).max().to_numpy() for s in (1, -1)}
    rows, busy = [], -1
    for i in range(4500, n - 1):
        if i <= busy:
            continue
        for s in (1, -1):
            if not (s * (c[i] - e1[i]) < 0 and s * (c[i - 1] - e1[i - 1]) > 0):
                continue
            if not (s * (e1[i] - e5[i]) > 0 and s * (e5[i] - e15[i]) > 0):
                continue
            if roll[s][i] < 3 or s * (c[i] - e5[i]) / PIP < 4 or s * (c[i] - e15[i]) <= 0:
                continue
            a = max(0, i - 180)
            stop = h[a:i + 1].max() + 0.5 * PIP if s > 0 else l[a:i + 1].min() - 0.5 * PIP
            d0 = s * (c[i] - e5[i])
            target = c[i] - s * 0.5 * d0
            mae, out = 0.0, None
            end = min(n - 1, i + 175)
            for j in range(i + 1, end + 1):
                mae = max(mae, (h[j] - c[i]) if s > 0 else (c[i] - l[j]))
                if use_stop and ((s > 0 and h[j] >= stop) or (s < 0 and l[j] <= stop)):
                    out = (stop, j); break
                if (s > 0 and l[j] <= e5[j]) or (s < 0 and h[j] >= e5[j]):
                    out = (e5[j], j); break
                if (s > 0 and l[j] <= target) or (s < 0 and h[j] >= target):
                    out = (target, j); break
            if out is None:
                out = (c[end], end)
            busy = out[1]
            rows.append(dict(
                t=df['t'].iloc[i], s=s, entry=c[i], exit=out[0], target=target,
                stop_pips=s * (stop - c[i]) / PIP, target_pips=0.5 * d0 / PIP, mae=mae / PIP,
                hit_target=out[0] == target,
            ))
            break
    return pd.DataFrame(rows)


def dollars(tr, pair, slip, floor):
    s = tr.s.to_numpy()
    entry = tr.entry.to_numpy() - s * slip * PIP
    pips = s * (entry - tr.exit.to_numpy()) / PIP
    pips = np.where(tr.hit_target.to_numpy(), s * (entry - tr.target.to_numpy()) / PIP, pips)
    net = pips - SPREAD[pair]
    usd = net * RISK / np.maximum(tr.stop_pips.to_numpy(), floor)
    return net, usd


def report(sets, label):
    print(f'\n{label}')
    print(f"  {'variante':<18} {'per':<4} {'n':>5} {'gana':>6} {'pips/op':>8} {'USD/op':>7} {'USD total':>10} {'peor USD':>9} {'USD p1':>7}")
    base = {}
    for (x, floor) in [(0, 3), (3, 3), (4, 3), (5, 3), (6, 3), (0, 10), (4, 10)]:
        for per in ('DEV', 'VAL'):
            nets, usds = [], []
            for pair, tr in sets.items():
                sel = (tr.t < SPLIT) if per == 'DEV' else (tr.t >= SPLIT)
                sel &= tr.target_pips >= x
                net, usd = dollars(tr[sel], pair, SLIP, floor)
                nets.append(net); usds.append(usd)
            net, usd = np.concatenate(nets), np.concatenate(usds)
            key = (x, floor)
            if key == (0, 3):
                base[per] = (usd.mean(), usd.min())
            d = usd.mean() - base[per][0]
            print(f"  X={x} piso={floor:<3}       {per:<4} {len(usd):5d} {np.mean(net > 0) * 100:5.1f}% {net.mean():+8.2f} {usd.mean():+7.2f} {usd.sum():+10.0f} {usd.min():+9.1f} {np.percentile(usd, 1):+7.1f}"
                  + ('' if key == (0, 3) else f'  (USD/op {d:+.2f} vs hoy)'))


data = {k: load(v) for k, v in FILES.items()}
for use_stop, name in ((False, 'C-vivo (sin stop, TP, EMA 5m, 175 min)'), (True, 'C-stop (X4 de la investigación)')):
    sets = {k: simulate(df, use_stop) for k, df in data.items()}
    for SLIP in (0.0, 1.0):
        report(sets, f'{name} · deslizamiento {SLIP:.0f} pip')
    if not use_stop:
        allp = pd.concat(sets.values())
        print('\n  Objetivo en pips (C-vivo, 3 pares): p10/p25/p50 =',
              ' / '.join(f'{allp.target_pips.quantile(q):.1f}' for q in (.1, .25, .5)),
              f'· MAE p99 {allp.mae.quantile(.99):.1f} · máx {allp.mae.max():.1f}')

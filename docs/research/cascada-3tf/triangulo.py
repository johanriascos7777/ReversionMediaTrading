"""
Experimento 3 (2026-11-12), reglas fijadas ANTES de ver los datos de EUR/GBP y GBP/USD.

Parte A. ¿El contrato X4 de la v3 (riesgo.py) se comporta igual en EUR/GBP y GBP/USD?
  Mismo disparador B (3 ATR5, 4 pips, cruce de la EMA 100 de 1m) y misma salida X4. Se informa por par
  y por periodo (DEV ene-jul, VAL ago-nov). No hay criterio de aprobación: es una comprobación de que la
  v3 no es peor en los pares nuevos (se avisaría si el neto es < -1,5 pips por operación en los dos periodos).

Parte B. Triángulo. Para cada operación X4 de un par, se mira en el mismo minuto el estirón
  u = (cierre - EMA100 de 5m) / ATR14 de 5m de los otros dos pares, convertido a la moneda que comparten.
  Ejemplo EUR/USD: si EUR/USD está estirado arriba, el euro subió o el dólar bajó.
    - "Movimiento del dólar": GBP/USD estirado en el mismo sentido (u_GBPUSD con el mismo signo y |u| >= 1,5).
    - "Movimiento del euro": EUR/GBP estirado en el mismo sentido (u_EURGBP con el mismo signo y |u| >= 1,5).
  Grupos: solo-dolar, solo-euro, ambos, ninguno. Equivalente para los otros pares.
  Hipótesis: el estirón de una sola moneda en un par (ninguno o solo el otro lado) revierte mejor que el
  movimiento compartido por los tres pares (un flujo macro de una moneda).
  Criterio: un grupo pasa si su neto supera al resto del mismo par en >= 0,5 pips por operación en DEV y en
  VAL, con al menos 60 operaciones en cada periodo. Si no, se descarta el filtro.
"""
import sys
import numpy as np
import pandas as pd

PIP = 1e-4
SPREAD = 0.8
FILES = {'EUR/USD': sys.argv[1], 'EUR/GBP': sys.argv[2], 'GBP/USD': sys.argv[3]}
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


def engine(df):
    c, h, l = (df[k].to_numpy(float) for k in ('close', 'high', 'low'))
    e1 = ema(c)
    e5, a5 = tf(df, 5)
    e15, _ = tf(df, 15)
    u = (c - e5) / a5
    return c, h, l, e1, e5, e15, a5, u


def trades(df):
    c, h, l, e1, e5, e15, a5, u = engine(df)
    n = len(c)
    rows, busy = [], -1
    roll = {s: pd.Series(s * u).rolling(60, min_periods=1).max().to_numpy() for s in (1, -1)}
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
            mae, out = 0.0, None
            end = min(n - 1, i + 175)
            for j in range(i + 1, end + 1):
                mae = max(mae, (h[j] - c[i]) if s > 0 else (c[i] - l[j]))
                if (s > 0 and h[j] >= stop) or (s < 0 and l[j] <= stop):
                    out = (s * (c[i] - stop), j); break
                if (s > 0 and l[j] <= e5[j]) or (s < 0 and h[j] >= e5[j]):
                    out = (s * (c[i] - e5[j]), j); break
                best = (c[i] - l[j]) if s > 0 else (h[j] - c[i])
                if best >= 0.5 * d0:
                    out = (0.5 * d0, j); break
            if out is None:
                out = (s * (c[i] - c[end]), end)
            busy = out[1]
            rows.append(dict(t=df['t'].iloc[i], s=s, pips=out[0] / PIP, mins=out[1] - i, mae=mae / PIP))
            break
    return pd.DataFrame(rows)


def line(d, lab):
    if len(d) == 0:
        print(f'  {lab:<34} n=   0'); return
    net = d.pips - SPREAD
    se = net.std(ddof=1) / np.sqrt(len(d)) if len(d) > 1 else float('nan')
    print(f'  {lab:<34} n={len(d):4d} neto={net.mean():+5.2f}±{1.96*se:4.2f} gana={(d.pips>0).mean()*100:5.1f}% '
          f'MAE p90={d.mae.quantile(.9):5.1f} peor={d.pips.min():+6.1f} min p90={d.mins.quantile(.9):4.0f}')


data = {k: load(v) for k, v in FILES.items()}
ustate = {}
for k, df in data.items():
    *_, u = engine(df)
    ustate[k] = pd.Series(u, index=df['t'])

print('Parte A: contrato v3 (X4) por par')
res = {}
for k, df in data.items():
    tr = trades(df)
    res[k] = tr
    line(tr[tr.t < SPLIT], f'{k} DEV')
    line(tr[tr.t >= SPLIT], f'{k} VAL')

# Signo con el que cada par mide la moneda compartida: (otro par, signo que significa "misma moneda empuja igual")
LINKS = {
    'EUR/USD': {'dolar': ('GBP/USD', +1), 'euro': ('EUR/GBP', +1)},
    'EUR/GBP': {'euro': ('EUR/USD', +1), 'libra': ('GBP/USD', -1)},
    'GBP/USD': {'dolar': ('EUR/USD', +1), 'libra': ('EUR/GBP', -1)},
}
print('\nParte B: triángulo (grupo frente al resto del mismo par)')
for k, tr in res.items():
    if len(tr) == 0:
        continue
    flags = {}
    for name, (other, sign) in LINKS[k].items():
        u = ustate[other].reindex(tr.t, method='ffill').to_numpy()
        flags[name] = (np.sign(u) * sign == tr.s.to_numpy()) & (np.abs(u) >= 1.5)
    a, b = list(flags)
    group = np.where(flags[a] & flags[b], 'ambos', np.where(flags[a], f'solo-{a}', np.where(flags[b], f'solo-{b}', 'ninguno')))
    tr = tr.assign(g=group)
    print(f' {k}')
    for g in sorted(set(group)):
        for lab, sel in (('DEV', tr.t < SPLIT), ('VAL', tr.t >= SPLIT)):
            gi, rest = tr[sel & (tr.g == g)], tr[sel & (tr.g != g)]
            if len(gi) and len(rest):
                diff = gi.pips.mean() - rest.pips.mean()
                line(gi, f'{g:<12} {lab} (vs resto {diff:+.2f})')

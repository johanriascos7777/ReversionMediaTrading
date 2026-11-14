"""
Estudio "cascada": estirón en 1m/5m/15m y vuelta cruzando las EMA 100.

Definiciones fijadas ANTES de mirar resultados (2026-11-12):
- Datos: EUR/USD 1m (precio medio Twelve Data), sin FX cerrado (vie 17:00 -> dom 17:00 NY).
- EMA100 y ATR14 en 1m; EMA100 y ATR14 de 5m y 15m con velas CERRADAS (valor conocido en vivo).
- s=+1 estirón arriba (VENTA), s=-1 estirón abajo (COMPRA).
- Abanico: precio, EMA1, EMA5, EMA15 ordenados (para s=+1: EMA1 > EMA5 > EMA15).
- Disparador B (dominó 1): la vela de 1m cierra al otro lado de la EMA100 de 1m (la anterior cerró del lado
  del estirón), el cierre sigue más allá de EMA5 y EMA15, hay abanico, el estirón previo fue grande
  (máx de s*(close-EMA5)/ATR5 en los últimos 60 min >= A) y queda espacio hasta la EMA5 (>= ROOM pips).
- Disparador A (vela de giro): vela de 1m con cuerpo contra el estirón >= K*ATR1, abre más allá de la EMA1,
  mismo contexto (abanico, estirón >= A, espacio).
- Stop: extremo de los últimos 180 min + 0,5 pips. Si stop y objetivo caen en la misma vela, gana el stop.
- Salidas: X5 = límite en la EMA100 de 5m (nivel de la última vela cerrada, se actualiza cada 5 min);
  X15 = límite en la EMA100 de 15m. Tope de tiempo: 24 h de mercado, sale al cierre.
- Una operación a la vez.
- Control: entradas al azar con la misma dirección, misma distancia a la EMA5 (+-10 %), mismo lado de la
  EMA15 y el mismo stop en pips, sin exigir el disparador.
- Costo: 0,8 pips por operación. DEV = ene-jul 2026, VAL = ago -> 9 nov 2026.
"""
import sys
import numpy as np
import pandas as pd

PIP = 1e-4
SPREAD = 0.8
SRC = sys.argv[1]
rng = np.random.default_rng(7)


def ema(x, n):
    return pd.Series(x).ewm(span=n, adjust=False).mean().to_numpy()


def atr(h, l, c, n=14):
    pc = np.roll(c, 1)
    pc[0] = c[0]
    tr = np.maximum(h - l, np.maximum(np.abs(h - pc), np.abs(l - pc)))
    return pd.Series(tr).ewm(alpha=1 / n, adjust=False).mean().to_numpy()


def load():
    df = pd.read_csv(SRC, parse_dates=['datetime'])
    df['t'] = df['datetime'].dt.tz_localize('UTC')
    ny = df['t'].dt.tz_convert('America/New_York')
    dow, hr = ny.dt.dayofweek, ny.dt.hour
    closed = ((dow == 4) & (hr >= 17)) | (dow == 5) | ((dow == 6) & (hr < 17))
    df = df[~closed].reset_index(drop=True)
    return df


def tf(df, minutes):
    b = df['t'].dt.floor(f'{minutes}min')
    g = df.groupby(b).agg(o=('open', 'first'), h=('high', 'max'), l=('low', 'min'), c=('close', 'last'))
    g['ema'] = ema(g['c'].to_numpy(), 100)
    g['atr'] = atr(g['h'].to_numpy(), g['l'].to_numpy(), g['c'].to_numpy())
    prev = g[['ema', 'atr']].shift(1)
    m = prev.reindex(b.to_numpy())
    return m['ema'].to_numpy(), m['atr'].to_numpy()


df = load()
t = df['datetime'].to_numpy()
o, h, l, c = (df[k].to_numpy(float) for k in ('open', 'high', 'low', 'close'))
n = len(c)
e1 = ema(c, 100)
a1 = atr(h, l, c)
e5, a5 = tf(df, 5)
e15, a15 = tf(df, 15)
warm = 100 * 15 * 3
split = np.searchsorted(t, np.datetime64('2026-08-01T00:00:00'))
print(f'barras 1m: {n}  ({df["t"].iloc[0]} -> {df["t"].iloc[-1]})  DEV<{split}  VAL>={split}')


def roll_max(x, w):
    return pd.Series(x).rolling(w, min_periods=1).max().to_numpy()


def context(s, A, room):
    x5 = s * (c - e5) / PIP
    x15 = s * (c - e15) / PIP
    fan = (s * (e1 - e5) > 0) & (s * (e5 - e15) > 0)
    st = roll_max(s * (c - e5) / a5, 60) >= A
    return fan & st & (x5 >= room) & (x15 > 0), x5


def trig_B(s, A, room):
    ok, _ = context(s, A, room)
    x1 = s * (c - e1)
    cross = np.zeros(n, bool)
    cross[1:] = (x1[1:] < 0) & (x1[:-1] > 0)
    return cross & ok


def trig_A(s, A, room, K):
    ok, _ = context(s, A, room)
    body = s * (o - c)
    return ok & (body >= K * np.roll(a1, 1)) & (s * (o - e1) > 0)


def simulate(i, s, stop, target, max_bars=1440):
    """target: 'e5' | 'e15'. Devuelve (pips brutos, motivo, barras, mae)."""
    entry = c[i]
    lvl = e5 if target == 'e5' else e15
    mae = 0.0
    end = min(n - 1, i + max_bars)
    for j in range(i + 1, end + 1):
        hi, lo = h[j], l[j]
        adverse = (hi - entry) if s > 0 else (entry - lo)
        if adverse > mae:
            mae = adverse
        if (s > 0 and hi >= stop) or (s < 0 and lo <= stop):
            return s * (entry - stop) / PIP, 'stop', j - i, mae / PIP
        tg = lvl[j]
        if (s > 0 and lo <= tg) or (s < 0 and hi >= tg):
            fill = min(tg, o[j]) if s > 0 else max(tg, o[j])
            if s * (entry - fill) < 0:
                fill = tg
            return s * (entry - fill) / PIP, 'tp', j - i, mae / PIP
    return s * (entry - c[end]) / PIP, 'tiempo', end - i, mae / PIP


def stop_level(i, s, look=180):
    a = max(0, i - look)
    return (h[a:i + 1].max() + 0.5 * PIP) if s > 0 else (l[a:i + 1].min() - 0.5 * PIP)


def run(trig_by_s, target, lo_i, hi_i):
    rows = []
    idx = sorted([(i, s) for s, tr in trig_by_s.items() for i in np.flatnonzero(tr) if lo_i <= i < hi_i and i > warm])
    busy_until = -1
    for i, s in idx:
        if i <= busy_until:
            continue
        stop = stop_level(i, s)
        D = s * (stop - c[i]) / PIP
        pips, why, bars, mae = simulate(i, s, stop, target)
        busy_until = i + bars
        rows.append(dict(i=i, t=t[i], s=s, x5=s * (c[i] - e5[i]) / PIP, x15=s * (c[i] - e15[i]) / PIP,
                         D=D, pips=pips, why=why, bars=bars, mae=mae))
    return pd.DataFrame(rows)


def control(ev, target, lo_i, hi_i, k=5):
    out = []
    for s in (1, -1):
        x5 = s * (c - e5) / PIP
        x15 = s * (c - e15) / PIP
        base = np.arange(n)
        pool_ok = (base > warm) & (base >= lo_i) & (base < hi_i - 1) & (x15 > 0)
        for _, r in ev[ev.s == s].iterrows():
            cand = np.flatnonzero(pool_ok & (x5 >= r.x5 * 0.9) & (x5 <= r.x5 * 1.1))
            if len(cand) == 0:
                continue
            for j in rng.choice(cand, size=min(k, len(cand)), replace=False):
                stop = c[j] + s * r.D * PIP
                pips, why, bars, mae = simulate(j, s, stop, target)
                out.append(dict(pips=pips, why=why, bars=bars, mae=mae))
    return pd.DataFrame(out)


def summ(d, label):
    if len(d) == 0:
        print(f'  {label:<34} sin operaciones')
        return
    net = d.pips - SPREAD
    w = (d.why == 'tp').mean() * 100
    st = (d.why == 'stop').mean() * 100
    se = net.std(ddof=1) / np.sqrt(len(d)) if len(d) > 1 else float('nan')
    print(f'  {label:<34} n={len(d):4d}  tp={w:5.1f}%  stop={st:5.1f}%  bruto={d.pips.mean():+6.2f}  '
          f'neto={net.mean():+6.2f} ±{1.96 * se:4.2f}  total={net.sum():+8.1f}  '
          f'med_bars={d.bars.median():5.0f}  mae_med={d.mae.median():5.1f}  peor={d.pips.min():+6.1f}')


def block(name, trig_by_s, target):
    for lab, a, b in (('DEV', 0, split), ('VAL', split, n)):
        ev = run(trig_by_s, target, a, b)
        summ(ev, f'{lab} {name} -> {target}')
        if len(ev):
            summ(control(ev, target, a, b), f'{lab}   control por distancia')


if __name__ == '__main__':
    for A in (2.0, 3.0, 4.0):
        for room in (4.0, 8.0):
            print(f'\n=== estirón >= {A} ATR5, espacio >= {room} pips ===')
            B = {s: trig_B(s, A, room) for s in (1, -1)}
            block('B cruce EMA1m', B, 'e5')
            block('B cruce EMA1m', B, 'e15')
            for K in (3.0,):
                Atr = {s: trig_A(s, A, room, K) for s in (1, -1)}
                block(f'A vela giro {K}xATR1', Atr, 'e5')

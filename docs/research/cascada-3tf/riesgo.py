"""
Experimento 2 (2026-11-12): el objetivo ya no es acertar el giro sino acortar la holgura.

Reglas fijadas ANTES de mirar resultados:
- Disparador: el mismo B de cascada.py (estirón >= 3 ATR5, espacio >= 4 pips, cruce de la EMA 100 de 1m).
- Salidas comparadas sobre los mismos disparadores (una operación a la vez por variante):
  X0  sin stop, objetivo EMA 100 de 5m, tope 24 h (lo que hace el trader: aguantar).
  X1  stop en el extremo de 3 h + 0,5 pips, objetivo EMA 100 de 5m, tope 24 h.
  X2  X1 + salida por tiempo a los 175 min (vida media de la EMA 100 de 5m).
  X3  X1 + salida por tiempo a los 60 min.
  X4  X1 + "objetivo vivo": sale cuando la ganancia abierta >= 50 % de la distancia inicial a la EMA 5m
      o al tocarla, lo que llegue primero; tope 175 min.
- Filtro de noticia (proxy sin calendario), pre-registrado como "saltar":
  N1  en los 120 min previos hubo una vela de 1m con rango >= 5 x ATR14 de 1m (choque).
  N2  en los 180 min previos hubo una vela de 1m con rango >= 3 x ATR14 de 1m en 08:30, 10:00 o 14:00
      hora de Nueva York (+-2 min): dato publicado.
- Métricas de riesgo: MAE p50/p90/p99 y máximo, minutos en el mercado p50/p90, % de operaciones > 4 h,
  y neto por operación tras 0,8 pips. Una variante "gana" si baja el p90 de MAE y el p90 de minutos a la
  mitad o menos frente a X0 sin empeorar el neto en más de 0,3 pips, en DEV y en VAL.
"""
import sys
import numpy as np
import pandas as pd
import cascada as k
from cascada import c, h, l, o, n, t, e5, a1, PIP, SPREAD, trig_B, stop_level

B = {s: trig_B(s, 3.0, 4.0) for s in (1, -1)}
ny = pd.to_datetime(t).tz_localize('UTC').tz_convert('America/New_York')
mins = (ny.hour * 60 + ny.minute).to_numpy()
rng1 = (h - l)
atr_prev = np.r_[a1[0], a1[:-1]]
shock = rng1 >= 5 * atr_prev
release = (rng1 >= 3 * atr_prev) & np.isin(mins, [m + d for m in (510, 600, 840) for d in (-2, -1, 0, 1, 2)])
shock_120 = pd.Series(shock).rolling(120, min_periods=1).max().to_numpy().astype(bool)
release_180 = pd.Series(release).rolling(180, min_periods=1).max().to_numpy().astype(bool)


def sim(i, s, mode):
    entry = c[i]
    stop = stop_level(i, s) if mode != 'X0' else None
    tmax = {'X0': 1440, 'X1': 1440, 'X2': 175, 'X3': 60, 'X4': 175}[mode]
    d0 = s * (entry - e5[i])
    mae = 0.0
    end = min(n - 1, i + tmax)
    for j in range(i + 1, end + 1):
        adv = (h[j] - entry) if s > 0 else (entry - l[j])
        mae = max(mae, adv)
        if stop is not None and ((s > 0 and h[j] >= stop) or (s < 0 and l[j] <= stop)):
            return s * (entry - stop) / PIP, j - i, mae / PIP
        tg = e5[j]
        if (s > 0 and l[j] <= tg) or (s < 0 and h[j] >= tg):
            return max(s * (entry - tg), 0) / PIP if s * (entry - tg) > 0 else s * (entry - tg) / PIP, j - i, mae / PIP
        if mode == 'X4':
            best = (entry - l[j]) if s > 0 else (h[j] - entry)
            if best >= 0.5 * d0:
                return 0.5 * d0 / PIP, j - i, mae / PIP
    return s * (entry - c[end]) / PIP, end - i, mae / PIP


def run(mode, filt, lo, hi):
    idx = sorted([(i, s) for s, tr in B.items() for i in np.flatnonzero(tr) if lo <= i < hi and i > k.warm])
    rows, busy = [], -1
    for i, s in idx:
        if i <= busy:
            continue
        if filt == 'N1' and shock_120[i]:
            continue
        if filt == 'N2' and release_180[i]:
            continue
        p, bars, mae = sim(i, s, mode)
        busy = i + bars
        rows.append((p, bars, mae))
    return pd.DataFrame(rows, columns=['pips', 'bars', 'mae'])


def line(d, lab):
    net = d.pips - SPREAD
    se = net.std(ddof=1) / np.sqrt(len(d))
    print(f'  {lab:<16} n={len(d):4d} neto={net.mean():+5.2f}±{1.96*se:4.2f} gana={(d.pips>0).mean()*100:5.1f}%  '
          f'MAE p50={d.mae.median():5.1f} p90={d.mae.quantile(.9):5.1f} p99={d.mae.quantile(.99):6.1f} max={d.mae.max():6.1f}  '
          f'min p50={d.bars.median():4.0f} p90={d.bars.quantile(.9):5.0f}  >4h={(d.bars>240).mean()*100:4.1f}%  peor={d.pips.min():+6.1f}')


for filt in ('-', 'N1', 'N2'):
    print(f'\n=== filtro {filt} ===')
    for lab, lo, hi in (('DEV', 0, k.split), ('VAL', k.split, n)):
        for mode in ('X0', 'X1', 'X2', 'X3', 'X4'):
            line(run(mode, filt, lo, hi), f'{lab} {mode}')

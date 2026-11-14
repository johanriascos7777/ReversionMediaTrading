import sys, numpy as np, pandas as pd
import cascada as k
from cascada import *

A, ROOM = 3.0, 4.0
B = {s: trig_B(s, A, ROOM) for s in (1, -1)}

def nostop(i, s, lvl, max_bars):
    entry = c[i]; mae = 0.0
    end = min(n - 1, i + max_bars)
    for j in range(i + 1, end + 1):
        adv = (h[j] - entry) if s > 0 else (entry - l[j])
        mae = max(mae, adv)
        if (s > 0 and l[j] <= lvl[j]) or (s < 0 and h[j] >= lvl[j]):
            return True, j - i, mae / PIP, s * (entry - lvl[j]) / PIP
    return False, end - i, mae / PIP, s * (entry - c[end]) / PIP

def table_nostop(name, idx):
    for tgt, lvl in (('EMA5', e5), ('EMA15', e15)):
        r = pd.DataFrame([nostop(i, s, lvl, 1440) for i, s in idx], columns=['hit', 'bars', 'mae', 'pips'])
        h4 = ((r.hit) & (r.bars <= 240)).mean() * 100
        print(f'  {name:<28} -> {tgt:<5} n={len(r):4d} toca24h={r.hit.mean()*100:5.1f}% toca4h={h4:5.1f}%  '
              f'MAE med={r.mae.median():5.1f} p90={r.mae.quantile(.9):5.1f} max={r.mae.max():5.1f}  '
              f'min_med={r.bars[r.hit].median():4.0f}  pips_med={r.pips[r.hit].median():+5.1f}  neto_medio={r.pips.mean()-SPREAD:+5.2f}')

def dedupe(tr_by_s, gap=60):
    idx = sorted([(i, s) for s, tr in tr_by_s.items() for i in np.flatnonzero(tr) if i > k.warm])
    out, last = [], {1: -10**9, -1: -10**9}
    for i, s in idx:
        if i - last[s] >= gap: out.append((i, s))
        last[s] = i
    return out

print('--- Sin stop (comparable con alert_log de v1: MAE 8,7 / p90 16,1 / máx 29,3; toca EMA5 en 4 h 62 %) ---')
table_nostop('B cruce EMA1m', dedupe(B))
C = {}
for s in (1, -1):
    ok, x5 = context(s, A, ROOM)
    x1 = s * (c - e1)
    first = ok & (x1 > 0) & (s * (c - e5) / a5 >= A)
    C[s] = first
table_nostop('C entrada en el estirón', dedupe(C, gap=180))

print('\n--- B con stop en el extremo, objetivo EMA5 y EMA15: cortes (todo el periodo; DEV|VAL) ---')
ev5 = run(B, 'e5', 0, n); ev15 = run(B, 'e15', 0, n)
for ev, nm in ((ev5, 'EMA5'), (ev15, 'EMA15')):
    ev['val'] = ev.i >= k.split
    ev['hour'] = pd.to_datetime(ev.t).dt.hour
    ev['ses'] = pd.cut(ev.hour, [-1, 6, 11, 16, 21, 24], labels=['Asia 00-06', 'Londres 07-11', 'NY 12-16', 'Tarde 17-21', 'Asia 22-23'])
    ev['body'] = [abs(c[i] - o[i]) / a1[i - 1] for i in ev.i]
    ev['Dq'] = pd.qcut(ev.D, 3, labels=['stop corto', 'stop medio', 'stop largo'])
    ev['bq'] = pd.qcut(ev.body, 3, labels=['vela chica', 'vela media', 'vela grande'])
    ev['rr'] = ev.x5 / ev.D if nm == 'EMA5' else ev.x15 / ev.D
    ev['rq'] = pd.qcut(ev.rr, 3, labels=['RR bajo', 'RR medio', 'RR alto'])
    print(f'\nObjetivo {nm}: n={len(ev)}  tp={(ev.why=="tp").mean()*100:.1f}%  neto={ev.pips.mean()-SPREAD:+.2f}  D med={ev.D.median():.1f}  x med={(ev.x5 if nm=="EMA5" else ev.x15).median():.1f}')
    for col in ('ses', 'Dq', 'bq', 'rq', 's'):
        for key, g in ev.groupby(col, observed=True):
            d, v = g[~g.val], g[g.val]
            f = lambda q: f'n={len(q):3d} tp={(q.why=="tp").mean()*100:5.1f}% neto={q.pips.mean()-SPREAD:+5.2f}' if len(q) else 'n=  0'
            print(f'   {str(key):<14} DEV {f(d)} | VAL {f(v)}')

print('\n--- Cadena de dominós (B, stop en el extremo) ---')
m = ev15.copy()
reach5 = []
for _, r in m.iterrows():
    i, s = int(r.i), int(r.s)
    hit = False
    for j in range(i + 1, i + int(r.bars) + 1):
        if (s > 0 and l[j] <= e5[j]) or (s < 0 and h[j] >= e5[j]): hit = True; break
    reach5.append(hit)
m['r5'] = reach5
print(f'  P(toca EMA5 antes de nuevo extremo) = {m.r5.mean()*100:.1f}%   P(toca EMA15 | tocó EMA5) = {(m.why[m.r5]=="tp").mean()*100:.1f}%   P(toca EMA15) = {(m.why=="tp").mean()*100:.1f}%')
days = (pd.to_datetime(t[-1]) - pd.to_datetime(t[k.warm])).days * 5 / 7
print(f'  Frecuencia: {len(dedupe(B))} disparos B en ~{days:.0f} días hábiles = {len(dedupe(B))/days:.1f} por día; cascada completa hasta EMA15: {(m.why=="tp").sum()} ({(m.why=="tp").sum()/days:.1f} por día)')

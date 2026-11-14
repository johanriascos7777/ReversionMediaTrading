import sys, numpy as np, pandas as pd
import cascada as k
from cascada import *
B = {s: trig_B(s, 3.0, 4.0) for s in (1, -1)}
cs = pd.Series(c)
def er(w):
    net = (cs - cs.shift(w)).abs(); path = cs.diff().abs().rolling(w).sum()
    return (net / path).to_numpy()
er240, er720 = er(240), er(720)
e15s = pd.Series(e15)
slope = ((e15s - e15s.shift(240)) / pd.Series(a15)).to_numpy()
side15 = np.sign(c - e15)
chg = np.r_[0, np.cumsum(side15[1:] != side15[:-1])]
for tgt in ('e5', 'e15'):
    ev = run(B, tgt, 0, n)
    ev['val'] = ev.i >= k.split
    ev['er240'] = er240[ev.i]; ev['er720'] = er720[ev.i]
    ev['slope'] = ev.s * slope[ev.i]
    ev['epi'] = chg[ev.i]
    ev['intento'] = ev.groupby('epi').cumcount() + 1
    ev['int'] = ev.intento.clip(upper=3).map({1: 'intento 1', 2: 'intento 2', 3: 'intento 3+'})
    ev['erq'] = pd.qcut(ev.er240, 3, labels=['ER4h bajo (lateral)', 'ER4h medio', 'ER4h alto (tendencia)'])
    ev['er12'] = pd.qcut(ev.er720, 3, labels=['ER12h bajo', 'ER12h medio', 'ER12h alto'])
    ev['slq'] = pd.qcut(ev.slope, 3, labels=['EMA15 poco inclinada', 'EMA15 media', 'EMA15 muy inclinada'])
    print(f'\nObjetivo {tgt}')
    for col in ('erq', 'er12', 'slq', 'int'):
        for key, g in ev.groupby(col, observed=True):
            d, v = g[~g.val], g[g.val]
            f = lambda q: f'n={len(q):3d} tp={(q.why=="tp").mean()*100:5.1f}% neto={q.pips.mean()-SPREAD:+5.2f}' if len(q) else 'n=  0'
            print(f'   {str(key):<22} DEV {f(d)} | VAL {f(v)}')

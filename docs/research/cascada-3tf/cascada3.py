import sys, numpy as np, pandas as pd
import cascada as k
from cascada import *
B = {s: trig_B(s, 3.0, 4.0) for s in (1, -1)}
ev = run(B, 'e15', 0, n)
ev['cot'] = pd.to_datetime(ev.t) - pd.Timedelta(hours=5)
ev['precio'] = [c[i] for i in ev.i]
ev['ema1'] = [e1[i] for i in ev.i]; ev['ema5'] = [e5[i] for i in ev.i]; ev['ema15'] = [e15[i] for i in ev.i]
pd.set_option('display.width', 250)
for a, b in (('2026-10-16 10:00', '2026-10-16 14:00'), ('2026-10-19 00:00', '2026-10-19 12:00'), ('2026-11-06 00:00', '2026-11-09 19:00')):
    q = ev[(ev.cot >= a) & (ev.cot <= b)]
    print(q[['cot', 's', 'precio', 'ema1', 'ema5', 'ema15', 'x5', 'x15', 'D', 'pips', 'why', 'bars', 'mae']].round(5).to_string(index=False))
    print()

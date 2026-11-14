"""Exporta las velas filtradas y las operaciones X4 de riesgo.py para comparar con el motor TypeScript."""
import sys
import numpy as np
import pandas as pd
import cascada as k
import riesgo as r

out = sys.argv[2]
pd.DataFrame({'t': pd.to_datetime(k.t).strftime('%Y-%m-%dT%H:%M:%SZ'), 'o': k.o, 'h': k.h, 'l': k.l, 'c': k.c}) \
    .to_csv(f'{out}/bars.csv', index=False, header=False)
rows, busy = [], -1
idx = sorted([(i, s) for s, tr in r.B.items() for i in np.flatnonzero(tr) if i > k.warm])
for i, s in idx:
    if i <= busy:
        continue
    p, bars, mae = r.sim(i, s, 'X4')
    busy = i + bars
    rows.append((pd.Timestamp(k.t[i]).strftime('%Y-%m-%dT%H:%M:%SZ'), s, k.c[i], r.stop_level(i, s), round(p, 2), bars))
pd.DataFrame(rows, columns=['t', 's', 'entry', 'stop', 'pips', 'bars']).to_csv(f'{out}/x4.csv', index=False)
print(len(rows), 'operaciones')

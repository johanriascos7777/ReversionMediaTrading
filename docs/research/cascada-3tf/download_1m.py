"""Descarga velas de 1m de Twelve Data por ventanas de 3 días. La llave se lee del .env por su sufijo y nunca se imprime."""
import csv, json, re, sys, time, urllib.parse, urllib.request
from datetime import datetime, timedelta

env, suffix, symbol, out = sys.argv[1:5]
key = next(k.strip().strip('"\'') for line in open(env)
           for m in [re.match(r'\s*TWELVE_DATA_API_KEY\s*=\s*(.*)', line)] if m
           for k in m.group(1).split(',') if k.strip().endswith(suffix))
start, end = datetime(2026, 1, 1), datetime(2026, 11, 12)
rows = {}
d = start
while d < end:
    e = min(d + timedelta(days=3), end)
    q = urllib.parse.urlencode({'symbol': symbol, 'interval': '1min', 'start_date': d.strftime('%Y-%m-%d %H:%M:%S'),
                                'end_date': (e - timedelta(seconds=1)).strftime('%Y-%m-%d %H:%M:%S'),
                                'timezone': 'UTC', 'outputsize': 5000, 'order': 'ASC', 'apikey': key})
    for attempt in range(3):
        try:
            body = json.load(urllib.request.urlopen('https://api.twelvedata.com/time_series?' + q, timeout=30))
            break
        except Exception as ex:
            body = {'status': 'error', 'message': str(ex)}
            time.sleep(15)
    if body.get('status') == 'ok':
        for v in body['values']:
            rows[v['datetime']] = (v['open'], v['high'], v['low'], v['close'])
        print(d.date(), len(body['values']), flush=True)
    else:
        msg = str(body.get('message', ''))
        print(d.date(), 'sin datos:', msg[:120].replace(key, '***'), flush=True)
        if 'credits' in msg.lower() and 'day' in msg.lower():
            break
        if 'minute' in msg.lower():
            time.sleep(60)
            continue
    d = e
    time.sleep(9)
with open(out, 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['datetime', 'open', 'high', 'low', 'close'])
    for t in sorted(rows):
        w.writerow([t, *rows[t]])
print('filas', len(rows), out)

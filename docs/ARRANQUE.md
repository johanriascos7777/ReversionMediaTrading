# Arranque para la prueba en demo

El mercado abre el domingo a las 16:00 (Colombia). Con `IGNORE_SCHEDULE=true` el motor despierta solo a esa hora y duerme del viernes 16:00 al domingo 16:00.

## 1. Respaldo de la base (una vez, antes del primer arranque)

Al arrancar, el backend crea la tabla nueva `alert_log`. No borra ni cambia las tablas existentes, pero conviene tener copia:

```bash
cd /Volumes/KINGSTON/7777/gitHub/ReversionMediaTrading/NestServer
mkdir -p ~/ReversionMediaTrading-db-backups
( set -a; . ./.env; set +a; mysqldump -h "${DB_HOST:-127.0.0.1}" -P "${DB_PORT:-3306}" -u "$DB_USER" -p --single-transaction "$DB_NAME" ) | gzip > ~/ReversionMediaTrading-db-backups/$(date +%Y%m%d-%H%M).sql.gz
```

Pide la contraseña de MySQL.

## 2. Arrancar

```bash
# Terminal 1 — backend (puerto 8083; fable5 sigue en el 8082)
cd /Volumes/KINGSTON/7777/gitHub/ReversionMediaTrading/NestServer && npm run start:dev

# Terminal 2 — frontend
cd /Volumes/KINGSTON/7777/gitHub/ReversionMediaTrading/Client && npm run dev
```

## 3. Qué revisar en los primeros minutos

En el log del backend:

- `API Keys: 2 llaves cargadas en el pool` y `Symbols : EUR/USD, EUR/GBP`.
- `[MikroORM] Schema sincronizado correctamente` (crea `alert_log`).
- EUR/USD: `Suscripción WebSocket ACEPTADA`. Si en cambio sale `FALLBACK ACTIVADO` para los dos pares, los dos van por REST y el sondeo pasa solo a cada 120 s para no agotar las llaves.
- EUR/GBP: `FALLBACK ACTIVADO` y `Velas de 1 minuto por REST cada 60 s`.
- `[Zona] [EUR/USD] 5000 velas de 5m · umbral … · N episodios` y lo mismo para EUR/GBP. Si dice "respaldo: historial corto", la zona usa solo 1000 velas (menos episodios).

En el navegador (`http://localhost:5173`):

- La sección de llaves muestra las 2 llaves y sus consultas.
- Cada par muestra su estado, el gatillo de la v1 y la distancia a la zona de la v2.
- La tabla "Alertas y marcador" se llena sola con cada alerta y su resultado.

Por consola:

```bash
curl -s http://localhost:8083/alerts/summary
curl -s "http://localhost:8083/alerts?limit=20"
```

## 4. Las alertas en Telegram

- `🚨 v1 · Giro — PAR`: la alerta de siempre (antes "Tipo C"). Trae escudo, semáforo, EMA 100 objetivo y si está dentro de la zona de la v2.
- `🧪 v2 · Zona de agotamiento (experimental) — PAR`: el precio llegó a donde terminó el 75 % de los estirones pasados. Trae los niveles p50/p75/p90, cuánto más se estiraron los que siguieron y cuántos episodios hay detrás.

Los botones "Registrar Trade" y "Descartar" funcionan igual que antes y llevan al diario de la Torre de Control.

## 5. Créditos

Con 2 llaves hay 1.600 créditos al día. EUR/GBP por REST gasta unos 1.440 en un día completo de mercado; cada arranque gasta unos 12 más (historial). Si esas mismas llaves están también en el pool de fable5, se comparten y no alcanzan.

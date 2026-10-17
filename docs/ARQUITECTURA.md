# Mapa del sistema (2026-10-17)

Lectura corta para personas y modelos. Si algo aquí contradice al código, manda el código. `AGENTS.md` está desactualizado (habla de `/experimental` y `full-revertion`, que ya no existen).

## Qué hace

Sigue EUR/USD y EUR/GBP en velas de 5 y 15 minutos, mide qué tan lejos está el precio de su EMA 100 (en ATR) y manda **dos alertas** por Telegram:

| Alerta | Cuándo sale | Dónde nace |
|---|---|---|
| **v1 · Giro** | M5 y M15 sobreextendidos, Win Rate interno ≥ 65 % y el detector de pico confirma que la elasticidad empezó a ceder dentro de la vela de 5m. Es la antigua "Tipo C experimental"; el mensaje trae el escudo y el semáforo (antes eran alertas aparte). | `MarketService.processTick` → `checkAlertV1` |
| **v2 · Zona de agotamiento** (experimental) | El precio cruza el percentil 75 de los picos de los estirones pasados del par (con M15 del mismo lado de su EMA). Una vez por estirón. | `MarketService.checkAlertV2`, cálculo en `alerts/zoneEngine.ts` |

Cada alerta crea un `pending_signal` (botones "Registrar Trade" / "Descartar" del diario) y una fila en `alert_log` con su resultado.

## Por dónde entra un precio

1. `market/twelveDataClient.ts`: WebSocket de Twelve Data. Si el plan rechaza el par (EUR/GBP en el plan gratuito), pide **velas de 1 minuto por REST** y las pasa al motor como 4 ticks (apertura, extremos, cierre). El intervalo se ajusta a las llaves y pares por REST (60 s con 2 llaves y 1 par).
2. `market/market.service.ts`:
   - Pool de llaves (`TWELVE_DATA_API_KEY`, separadas por coma) y horario operativo. Con el forex cerrado (viernes 17:00 → domingo 17:00 de Nueva York) el motor duerme aunque `IGNORE_SCHEDULE=true`.
   - Historial al arrancar: 1000 velas de 5m y 15m (en UTC, sin la vela que aún no cierra) y 5000 velas de 5m para la zona de la v2.
   - `processTick`: arma velas (`candleBuilder.ts`), calcula elasticidad y percentil (`marketEngine.ts`), backtest interno (`backtestEngine.ts`, `compareSignal.ts`, `fuseMarketState.ts`), detector de pico, escudo y emite el snapshot por WebSocket al frontend.
3. Servicios que escuchan el snapshot: `structure/` (S/R, RSI, sándwich de EMAs) y `consolidation/` (escudo de consolidación). Ya no mandan Telegram.

## Dónde se guarda

| Tabla | Qué | Quién escribe |
|---|---|---|
| `trade` | Diario del trader (Torre de Control) | Telegram "Registrar Trade" y el frontend. **No se toca.** |
| `pending_signal` | Cada alerta enviada, con TP/SL sugeridos | `alerts/alerts.service.ts` |
| `alert_log` | Cada alerta con su versión, valores al disparar y resultado: MAE, MFE, si tocó la EMA 100 y en cuántos minutos | `alerts/alerts.service.ts` (se actualiza al cierre de cada vela de 5m; tras un reinicio se recalcula con el historial) |
| `historical_candle` | Caché de velas del escudo de consolidación (fechas guardadas con desfase de 5 h, ver pendientes) | `historical/` |

API nueva: `GET /alerts?limit=100` y `GET /alerts/summary` (marcador por versión).

## Frontend (`Client/`)

Tres pantallas: **`/` Señales** (pares, semáforo, tarjeta de elasticidad, zona v2, uso de llaves de Twelve Data y tabla de alertas con marcador), **`/tower-control`** (diario) y **`/holgura-calculator`**. El frontend no calcula indicadores.

## Pruebas

```bash
cd NestServer
npm test                                   # motor de la zona, seguimiento de resultados, velas REST
npm run replay -- /tmp/r.json 2026-10-05T11:00:00Z 2026-10-17T00:00:00Z --check
```

`npm run replay` corre el motor real sobre velas de 1 minuto grabadas (`test/replay/fixtures/`, EUR/USD y EUR/GBP del 2026-09-21 al 2026-10-17) sin red, sin base de datos y sin Telegram. Con `--check` falla si la v1 deja de salir en los mismos 8 instantes que la "Tipo C experimental" del código original (`test/replay/golden/v1-expected.json`). Es la red de seguridad para cualquier refactor.

## Tableros

Jira personal, proyecto **ELAS**: tablero "ELAS board" (plan de trabajo) y tablero "Ideas y experimentos" (todo lo probado y lo nuevo, con resultados).

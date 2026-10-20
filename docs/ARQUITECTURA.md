# Mapa del sistema (2026-10-17)

Lectura corta para personas y modelos. Si algo aquí contradice al código, manda el código. `AGENTS.md` está desactualizado (habla de `/experimental` y `full-revertion`, que ya no existen).

## Qué hace

Sigue EUR/USD y EUR/GBP en velas de 5 y 15 minutos, mide qué tan lejos está el precio de su EMA 100 (en ATR) y manda **dos alertas** por Telegram:

| Alerta | Cuándo sale | Dónde nace |
|---|---|---|
| **v1 · Giro** | M5 y M15 sobreextendidos, Win Rate interno ≥ 65 % y el detector de pico confirma que la elasticidad empezó a ceder dentro de la vela de 5m. Es la antigua "Tipo C experimental"; el mensaje trae el escudo y el semáforo (antes eran alertas aparte). | `MarketService.processTick` → `checkAlertV1` |
| **v2 · Zona de agotamiento** (experimental) | El precio cruza el percentil 75 de los picos de los estirones pasados del par (con M15 del mismo lado de su EMA). Una vez por estirón. | `MarketService.checkAlertV2`, cálculo en `alerts/zoneEngine.ts` |

Cada alerta crea un `pending_signal` (botones "Registrar Trade" / "Descartar" del diario) y una fila en `alert_log` con su resultado.

Si el par tiene una operación abierta en `execution_position`, la alerta se guarda igual (`alert_log`, con `features.telegramSuppressedBy`) pero no se manda a Telegram. El marcador v1/v2 no cambia.

## Ejecución en un broker (`execution/`)

Módulo aislado para abrir y cerrar operaciones. El broker es una pieza intercambiable (`BrokerAdapter` en `execution/broker.types.ts`):

| Adaptador | Qué hace | Se activa con |
|---|---|---|
| `capital` (`execution/capital/capital.adapter.ts`) | API REST de Capital.com: sesión, `POST /positions`, confirmación en `/confirms`, `DELETE /positions/{dealId}` | `CAPITAL_IDENTIFIER`, `CAPITAL_API_KEY`, `CAPITAL_API_PASSWORD`; `CAPITAL_ENV=demo` (real exige además `CAPITAL_ALLOW_LIVE=true`); `CAPITAL_EPIC_MAP` opcional (`XAU/USD=GOLD,...`) |
| `manual` | No llama a nadie: solo bloquea el par (operación hecha fuera del bot) | siempre |

Para otro broker (por ejemplo OANDA) se agrega un adaptador y se registra en `buildAdapters` de `execution/execution.service.ts`; nada más cambia.

- Una operación abierta por par. Los pares salen de `TWELVE_DATA_SYMBOL`. Tamaño por defecto `EXECUTION_DEFAULT_SIZE` (1000 unidades) y máximo `EXECUTION_MAX_SIZE` (10000).
- Desde Telegram: botón "🤖 Entrar en …" en cada alerta (`exec:<pending_signal>`), abre con el SL sugerido por la alerta y sin TP: el cierre es manual.
- Desde el frontend: sección "Operaciones abiertas" de `/`.
- **Entrada automática** (interruptor del panel, `POST /execution/auto`): cada alerta que sale abre la operación en el broker por defecto con el SL de la alerta. El mensaje de Telegram llega con la línea "🤖🔒 Abierta automáticamente…" y sin el botón "Entrar". Si falla, llega con el motivo y el botón. El estado se guarda en `NestServer/execution_settings.json` (sobrevive a reinicios; arranca con `EXECUTION_AUTO=true` si el archivo no existe). En cuenta real solo se puede activar con `EXECUTION_AUTO_LIVE=true`.
- El cierre es manual (interruptor del panel). Si el broker ya la había cerrado (SL), se marca `ya-cerrada-en-broker`.
- **Seguimiento rojo/verde** (`execution/tracking/`): cada 3 s (`EXECUTION_TRACK_MS`) lee del broker las posiciones abiertas (`GET /api/v1/positions` en Capital.com) y guarda por operación las fases en rojo (holgura) y en verde, con hora de inicio y fin, duración, P&L al empezar, último y extremo. Lo hace con dos cuentas: el `upl` real de Capital.com (su spread) y la misma operación con 1 pip de spread total (`upl + ((spread de entrada + spread actual)/2 − 1 pip) × tamaño`, pasado a USD con la tasa del broker). Verde es P&L > 0; cero cuenta como rojo. Una posición vieja empieza a medirse cuando el seguimiento la ve (`tracking_since`). Si el broker deja de tenerla 3 lecturas seguidas (SL), se marca `broker_gone_at` y se deja de seguir. El panel muestra la fase actual en las columnas "P&L Capital.com" y "P&L 1 pip", y el botón "fases" la lista completa (`GET /execution/positions/:id/phases`).
- API: `GET /execution/config`, `GET /execution/positions?status=open`, `POST /execution/positions`, `POST /execution/positions/:id/close`. Sin autenticación: el backend no debe quedar expuesto fuera de la red local.

## Por dónde entra un precio

1. `market/twelveDataClient.ts`: WebSocket de Twelve Data. Si el plan rechaza el par (EUR/GBP en el plan gratuito), pide **velas de 1 minuto por REST** y las pasa al motor como 4 ticks (apertura, extremos, cierre). El intervalo se ajusta a las llaves y pares por REST (60 s con 2 llaves y 1 par).
2. `market/market.service.ts`:
   - Horario operativo. Con el forex cerrado (viernes 17:00 → domingo 17:00 de Nueva York) el motor duerme aunque `IGNORE_SCHEDULE=true`.
   - Pool de llaves (`TWELVE_DATA_API_KEY`, separadas por coma) en `market/apiKeyPool.ts`: una llave por par, rotación, enfriamiento de 65 s, llaves agotadas del día (`exhausted_keys.json`) y el estado que muestra la sección de llaves.
   - Historial al arrancar: 1000 velas de 5m y 15m (en UTC, sin la vela que aún no cierra) y 5000 velas de 5m para la zona de la v2.
   - `processTick`: arma velas (`candleBuilder.ts`), calcula elasticidad y percentil (`marketEngine.ts`), backtest interno (`backtestEngine.ts`, `compareSignal.ts`, `fuseMarketState.ts`), detector de pico, escudo y emite el snapshot por WebSocket al frontend.
3. Servicios que escuchan el snapshot: `structure/` (S/R, RSI, sándwich de EMAs) y `consolidation/` (escudo de consolidación). Ya no mandan Telegram.

## Dónde se guarda

| Tabla | Qué | Quién escribe |
|---|---|---|
| `trade` | Diario del trader (Torre de Control) | Telegram "Registrar Trade" y el frontend. **No se toca.** |
| `pending_signal` | Cada alerta enviada, con TP/SL sugeridos | `alerts/alerts.service.ts` |
| `alert_log` | Cada alerta con su versión, valores al disparar y resultado: MAE, MFE, si tocó la EMA 100 y en cuántos minutos | `alerts/alerts.service.ts` (se actualiza al cierre de cada vela de 5m; tras un reinicio se recalcula con el historial) |
| `execution_position` | Cada operación abierta desde el panel o desde Telegram: broker, par, dirección, tamaño, `dealId`, precio de entrada y de cierre, SL/TP, estado (`open`, `closed`, `failed`) y la alerta que la originó | `execution/execution.service.ts` (la tabla se crea sola al arrancar) |
| `execution_pnl_phase` | Fases rojo/verde de cada operación, por modelo (`capital`, `pip1`): inicio, fin, duración, P&L inicial, último y extremo, segundos sin lecturas | `execution/tracking/` |
| `execution_pnl_sample` | Una lectura por minuto de cada operación abierta: bid, offer, `upl` y P&L de los dos modelos | `execution/tracking/` |
| `historical_candle` | Caché de velas del escudo de consolidación (fechas guardadas con desfase de 5 h, ver pendientes) | `historical/` |

API nueva: `GET /alerts?limit=100` y `GET /alerts/summary` (marcador por versión).

## Frontend (`Client/`)

Tres pantallas: **`/` Señales** (pares, semáforo, tarjeta de elasticidad, zona v2, uso de llaves de Twelve Data y tabla de alertas con marcador), **`/tower-control`** (diario) y **`/holgura-calculator`**. El frontend no calcula indicadores.

## Pruebas

```bash
cd NestServer
npm test                                   # motor de la zona, seguimiento de resultados, velas REST, pool de llaves, ejecución
npm run replay -- /tmp/r.json 2026-10-05T11:00:00Z 2026-10-17T00:00:00Z --check
npm run replay -- /tmp/r.json 2026-10-05T11:00:00Z 2026-10-17T00:00:00Z --check --24h   # como en vivo (IGNORE_SCHEDULE=true)
```

`npm run replay` corre el motor real sobre velas de 1 minuto grabadas (`test/replay/fixtures/`, EUR/USD y EUR/GBP del 2026-09-21 al 2026-10-17) sin red, sin base de datos y sin Telegram. Con `--check` falla si la v1 deja de salir en los mismos 8 instantes que la "Tipo C experimental" del código original (`test/replay/golden/v1-expected.json`). Con `--24h` corre como en vivo, sin el horario COT, y compara con las 16 alertas de `v1-expected-24h.json` (sacadas del código actual, no del original). Es la red de seguridad para cualquier refactor.

## Tableros

Jira personal, proyecto **ELAS**: tablero "ELAS board" (plan de trabajo) y tablero "Ideas y experimentos" (todo lo probado y lo nuevo, con resultados).

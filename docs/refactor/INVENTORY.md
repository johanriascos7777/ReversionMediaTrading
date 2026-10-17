# Inventario de ReversionMediaTrading

82 archivos de código, 16238 líneas.

## Tamaño por carpeta

| Carpeta | Archivos | Líneas |
|---|---|---|
| Client/src/components | 15 | 5051 |
| NestServer/src/market | 13 | 2705 |
| NestServer/src/consolidation | 7 | 1621 |
| NestServer/src/trade | 9 | 1574 |
| Client/src/pages | 2 | 1264 |
| NestServer/src/alerts | 8 | 1088 |
| Client/src/hooks | 4 | 989 |
| NestServer/src/structure | 4 | 549 |
| NestServer/src/historical | 4 | 502 |
| Client/src/(raíz) | 3 | 435 |
| NestServer/src/screenshots | 4 | 226 |
| NestServer/src/(raíz) | 3 | 117 |
| NestServer/src/scripts | 3 | 64 |
| Client/src/engine | 1 | 23 |
| Client/src/types | 1 | 20 |
| Client/src/config | 1 | 10 |

## Los 15 archivos más grandes

-  1441  NestServer/src/market/market.service.ts
-   951  Client/src/pages/HolguraCalculator.tsx
-   814  Client/src/components/tower/AnalyticsPanel.tsx
-   724  NestServer/src/trade/trade.service.ts
-   722  Client/src/components/tower/EditTradeModal.tsx
-   633  Client/src/components/tower/TradeModal.tsx
-   575  NestServer/src/consolidation/consolidation.service.ts
-   495  Client/src/components/ApiKeysStatus.tsx
-   461  NestServer/src/alerts/alerts.service.ts
-   457  Client/src/hooks/useTrades.ts
-   429  Client/src/components/tower/TradeTable.tsx
-   412  Client/src/components/tower/FomowatchPanel.tsx
-   411  NestServer/src/historical/historical-data.service.ts
-   407  NestServer/src/structure/structureEngine.ts
-   348  Client/src/hooks/useMarketData.ts

## Archivos que nadie importa (candidatos a código muerto; revisar uno por uno)

Pueden ser puntos de entrada legítimos: scripts, entidades cargadas por patrón, módulos registrados por nombre.

-    74  NestServer/src/alerts/outcomeTracker.spec.ts
-    66  NestServer/src/alerts/zoneEngine.spec.ts
-    64  NestServer/src/market/twelveDataClient.spec.ts
-    58  Client/src/components/01-atoms/Pairs/Pairs.stories.tsx
-    33  NestServer/src/scripts/create-schema.ts
-    30  NestServer/src/scripts/fix-db.ts
-    23  Client/src/engine/multiTimeframeResolver.ts
-    20  Client/src/types/market.ts
-    10  Client/src/config/env.ts
-     1  NestServer/src/scripts/query-trade.ts

## Páginas del frontend (rutas)

- `/` → App  (Client/src/AppRouter.tsx)
- `/tower-control` → TowerControl  (Client/src/AppRouter.tsx)
- `/holgura-calculator` → HolguraCalculator  (Client/src/AppRouter.tsx)

## Entradas del backend

- NestServer/src/alerts/alerts.controller.ts: GET /alerts; GET /alerts/summary
- NestServer/src/consolidation/consolidation.controller.ts: GET /consolidation/analysis/:symbol; GET /consolidation/analysis; GET /consolidation/backtest/:symbol; GET /consolidation/backtest; POST /consolidation/backtest/:symbol/run; POST /consolidation/download/:symbol; GET /consolidation/backtest/:symbol/events
- NestServer/src/market/market.controller.ts: GET /history; GET /health; POST /notify
- NestServer/src/market/market.gateway.ts: pasarela websocket
- NestServer/src/screenshots/screenshots.controller.ts: POST /trade/:id/screenshots; DELETE /trade/:id/screenshots
- NestServer/src/trade/trade.controller.ts: POST /trade; PATCH /trade/:id/close; PATCH /trade/:id; GET /trade; GET /trade/fomowatch; GET /trade/analytics; DELETE /trade/:id

## Canales por donde sale una alerta

- Telegram: Client/src/components/tower/FomowatchPanel.tsx, NestServer/src/alerts/alerts.service.ts, NestServer/src/market/market.controller.ts, NestServer/src/market/market.service.ts, NestServer/src/trade/telegram-bot.service.ts, NestServer/src/trade/trade.module.ts
- Sonido: ninguno
- Notificación del navegador: ninguno

## Variantes y experimentos (por nombre de archivo)

- ninguno

## Variables de entorno usadas (solo nombres)

- AWS_ACCESS_KEY_ID (NestServer)
- AWS_REGION (NestServer)
- AWS_S3_BUCKET (NestServer)
- AWS_SECRET_ACCESS_KEY (NestServer)
- DB_HOST (NestServer)
- DB_NAME (NestServer)
- DB_PASS (NestServer)
- DB_PORT (NestServer)
- DB_USER (NestServer)
- IGNORE_SCHEDULE (NestServer)
- NODE_ENV (NestServer)
- PORT (NestServer)
- TELEGRAM_BOT_TOKEN (NestServer)
- TELEGRAM_CHAT_ID (NestServer)
- TWELVE_DATA_API_KEY (NestServer)
- TWELVE_DATA_SYMBOL (NestServer)
- VITE_API_URL_LOCAL (Client)
- VITE_API_URL_PROD (Client)
- VITE_ENV (Client)
- VITE_WS_URL_LOCAL (Client)
- VITE_WS_URL_PROD (Client)

## Otros

- Tests automáticos: 3
- Marcas TODO, FIXME o HACK: 1
- Imports relativos que no pude resolver: 3 (en 3 archivos)

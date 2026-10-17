# Decisiones

## Del trader

| Fecha | Decisión |
|---|---|
| 2026-10-13 | Quitar `/full-revertion`: "no ha sido nada precisa". |
| 2026-10-13 | En `/` quedarse con la lista de pares, el semáforo y la tarjeta de elasticidad. |
| 2026-10-17 | Reactivar el refactor de este repo. Manejar una o dos alertas. Menos indicadores en el frontend. |
| 2026-10-17 | No tocar la tabla del diario de trading ni la sección de uso de llaves de Twelve Data. |
| 2026-10-17 | Usar solo dos llaves de Twelve Data (cuenta tor7dev y una segunda cuenta) y dos pares: EUR/USD y otro. |
| 2026-10-17 | Documentar en Jira lo probado y lo nuevo, y tener un tablero con el plan antes de ejecutar. |
| 2026-10-17 | Probar desde el lunes 2026-10-19 en cuenta demo con las alertas, "hasta nuevo aviso". |

## Tomadas por Claude el 2026-10-17 (revisables por el trader)

| Decisión | Motivo |
|---|---|
| La v1 es la antigua "Tipo C experimental", con el escudo y el semáforo dentro del mismo mensaje. | Es la que el trader considera más precisa. En la grabación, Peatón y Tipo C · Shield ✓ salían en el mismo instante: un evento, tres mensajes. |
| La v2 es la "Zona de agotamiento" (ELAS-20), marcada como experimental. | Idea nueva: compara el estirón con dónde terminaron los estirones pasados, no con todas las velas. Regla fijada antes de probarla. |
| Segundo par: EUR/GBP. | Las alertas de ejemplo que el trader considera precisas son de EUR/GBP y es un cruce que suele volver a la media. |
| Backend en el puerto 8083. | El backend de fable5 corre como servicio en el 8082. |
| El par que va por REST pide velas de 1 minuto (cada 60 s o más según llaves) en vez del precio cada 10 s. | Cada 10 s gastaba 8.640 créditos al día; con 2 llaves hay 1.600. |
| El motor duerme con el forex cerrado aunque `IGNORE_SCHEDULE=true`. | Twelve Data entrega velas de fin de semana; gastan créditos y meten ruido en la EMA. |
| Historial pedido en UTC y la vela que aún no cierra se continúa en vez de inyectarse como cerrada. | Se leía como hora local (desfase de 5 h) y la vela en formación quedaba duplicada. |
| El SL sugerido nunca queda del lado equivocado del precio. | En la grabación salió una VENTA con el SL por debajo de la entrada. |
| Se quitaron: alertas Tipo A, Tipo C normal, Peatón y variantes Shield, avisos SUPER del analizador de consolidación, `POST /notify`, el módulo full-revertion, el motor normal duplicado y cinco páginas del frontend. | De 361 mensajes en dos semanas de grabación a 8 (v1) + 28 (v2). El texto de las páginas quitadas está en `docs/reglas-del-trader/`. |

## Resultados en la grabación (2026-10-05 → 2026-10-16, EUR/USD y EUR/GBP)

MAE = pips en contra después de la alerta hasta tocar la EMA 100 (historial largo) o 24 h. Es una comprobación de funcionamiento, no una validación: son pocas alertas y una sola grabación.

| | Alertas | MAE mediana | MAE p90 | MAE máx | Toca EMA en 4 h |
|---|---|---|---|---|---|
| v1 · Giro | 8 | 7,6 | 17,6 | 24,7 | 38 % |
| v2 · Zona | 28 | 7,0 | 38,1 | 75,4 | 57 % |
| (antes) Tipo C normal | 38 | 3,6 | 6,4 | 41,1 | 74 % |

La EMA 100 del motor de la v1 (150 velas) se separó hasta 17,9 pips de la EMA 100 con historial largo (mediana 1,3).

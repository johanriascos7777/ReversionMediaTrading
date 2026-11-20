# Observaciones del trader operando

Una fila por alerta que el trader mire. Hora en Colombia (UTC-5). Veredicto: sirvió, llegó pronto (siguió estirando), llegó tarde, falsa, no la tomé.

| Fecha | Hora | Par | Versión | Dirección | Veredicto | Qué vio en el gráfico | Demo / real |
|---|---|---|---|---|---|---|---|
| 2026-10-19 | 11:18 | EUR/USD | v1 (alert_log 1) | BUY a 1,12079 | pendiente | Caída de 1,1222 a 1,1203 y rebote. Abrió compra en demo a 1,12082, TP 1,12127 (cerca de la EMA 100 de 1 min). La alerta traía el escudo en rojo (sándwich de EMAs) y la zona v2 sin alcanzar: 2,7 ATR de la EMA 100 de 5m contra 6,5 ATR del q75. Llegó 2 min después del reinicio de las 11:17. | demo |
| 2026-10-19 | 11:24 | EUR/USD | v1 (alert_log 2) | BUY a 1,12084 | — | Repetición de la misma compra 5 min después (caso de ELAS-76). No abrió otra operación. | demo |

## Patrones que propone el trader

| Fecha | Patrón | Evidencia | Dónde se sigue |
|---|---|---|---|
| 2026-10-19 | Abanico: el estirón termina y el precio vuelve a la EMA 100 cuando 1m y 5m están estirados a la vez y las EMAs 9, 50 y 100 están muy separadas. | Capturas EUR/USD 16, 18 y 19 de octubre (`~/Desktop/emas/rmt-captura-41` a `45`), elegidas después de ver el resultado. | ELAS-77 (idea I-29); misma hipótesis en fable5 RMT-62. |

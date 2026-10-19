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
| 2026-10-19 | Pasar de 2 a 5 llaves de Twelve Data (ninguna compartida con fable5 ni con el bot de django-trading) y agregar un tercer par. Deja la elección del par a Claude. |

## Tomadas por Claude el 2026-10-17 (revisables por el trader)

| Decisión | Motivo |
|---|---|
| La v1 es la antigua "Tipo C experimental", con el escudo y el semáforo dentro del mismo mensaje. | Es la que el trader considera más precisa. En la grabación, Peatón y Tipo C · Shield ✓ salían en el mismo instante: un evento, tres mensajes. |
| La v2 es la "Zona de agotamiento" (ELAS-20), marcada como experimental. | Idea nueva: compara el estirón con dónde terminaron los estirones pasados, no con todas las velas. Regla fijada antes de probarla. |
| Segundo par: EUR/GBP. | Las alertas de ejemplo que el trader considera precisas son de EUR/GBP y es un cruce que suele volver a la media. |
| Tercer par (2026-10-19): GBP/USD, no USD/JPY. | Completa el triángulo con EUR/USD y EUR/GBP: deja ver si un estirón de EUR/GBP es del euro o de la libra, y graba desde ya los datos para medir esa idea después. Con 5 llaves cabe un solo par REST más (unos 1.050 créditos de margen). USD/JPY queda para cuando haya 2 llaves libres más. |
| Backend en el puerto 8083. | El backend de fable5 corre como servicio en el 8082. |
| El par que va por REST pide velas de 1 minuto (cada 60 s o más según llaves) en vez del precio cada 10 s. | Cada 10 s gastaba 8.640 créditos al día; con 2 llaves hay 1.600. |
| El motor duerme con el forex cerrado aunque `IGNORE_SCHEDULE=true`. | Twelve Data entrega velas de fin de semana; gastan créditos y meten ruido en la EMA. |
| Historial pedido en UTC y la vela que aún no cierra se continúa en vez de inyectarse como cerrada. | Se leía como hora local (desfase de 5 h) y la vela en formación quedaba duplicada. |
| El SL sugerido nunca queda del lado equivocado del precio. | En la grabación salió una VENTA con el SL por debajo de la entrada. |
| Se quitaron: alertas Tipo A, Tipo C normal, Peatón y variantes Shield, avisos SUPER del analizador de consolidación, `POST /notify`, el módulo full-revertion, el motor normal duplicado y cinco páginas del frontend. | De 361 mensajes en dos semanas de grabación a 8 (v1) + 28 (v2). El texto de las páginas quitadas está en `docs/reglas-del-trader/`. |

## Resultados en la grabación (2026-10-05 → 2026-10-16, EUR/USD y EUR/GBP)

MAE = pips en contra después de la alerta hasta tocar la EMA 100 (historial largo) o 24 h. Es una comprobación de funcionamiento, no una validación: son pocas alertas y una sola grabación.

En vivo el `.env` tiene `IGNORE_SCHEDULE=true`: el motor corre las 24 h de lunes a viernes. Los números que valen para la prueba en demo son los de "24 h". Los de "horario" usan el horario COT del código (sin madrugadas ni viernes por la tarde) y sirven para comparar con el código original.

| | Alertas | MAE mediana | MAE p90 | MAE máx | Toca EMA en 4 h |
|---|---|---|---|---|---|
| v1 · Giro (24 h, como en vivo) | 16 | 8,7 | 16,1 | 29,3 | 62 % |
| v2 · Zona (24 h, como en vivo) | 32 | 5,2 | 36,0 | 77,6 | 59 % |
| v1 · Giro (horario) | 8 | 7,6 | 17,6 | 24,7 | 38 % |
| v2 · Zona (horario) | 28 | 7,0 | 38,1 | 75,4 | 57 % |
| (antes) Tipo C normal (horario) | 38 | 3,6 | 6,4 | 41,1 | 74 % |

Con 24 h las alertas v1 no son las 8 de antes más otras 8: solo una coincide, porque procesar también las madrugadas cambia el estado del motor. El viernes 16 la v1 avisó 7 veces la misma compra de EUR/GBP entre las 07:19 y las 09:09 (COT): la primera tuvo 16,9 pips en contra y las últimas entre 8 y 10.

La EMA 100 del motor de la v1 (150 velas) se separó hasta 17,9 pips de la EMA 100 con historial largo (mediana 1,3).

## ELAS-67 y ELAS-68 medidas en la grabación (2026-10-17)

Twelve Data entrega sábados y domingos completos: el 24 % de las barras grabadas. Son cotizaciones sintéticas con velas de 1 minuto pequeñas (0,5 pips contra 1,2 en día hábil) que igual recorren mucho (el sábado 10 de octubre, 62 pips en EUR/USD y 50 en EUR/GBP). Entran en el historial que se carga al arrancar.

| Variante | v1 horario | v1 24 h | v2 24 h |
|---|---|---|---|
| Actual | 8 | 16 | 32 |
| ELAS-68 (vela duplicada al cierre) | 8, las mismas | 16, las mismas | 32 |
| ELAS-67 (sin barras de fin de semana en el historial) | 8: una sale 14 min antes, con 36 pips en contra en vez de 24,7 | 20: una cambia de hora y salen 4 más, todas compras de EUR/GBP la noche del 6 al 7 de octubre, con 25–29 pips en contra | 28 |

Ninguna de las dos se aplica antes de la prueba: ELAS-68 no cambia nada en esta grabación y ELAS-67 la empeora en el único arranque grabado.

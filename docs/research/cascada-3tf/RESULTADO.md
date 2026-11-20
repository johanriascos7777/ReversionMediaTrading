# Cascada en 3 temporalidades: ¿el giro que cruza la EMA 100 de 1m predice que cruzará las de 5m y 15m?

Medido el 2026-11-12. Resultado: **no pasa**. El patrón se repite unas 4 veces al día, pero operarlo rinde lo mismo que entrar al azar a la misma distancia de la EMA 100.

## Qué pidió el trader

Capturas de EUR/USD del 10-nov a las 04:00 (COT): el precio sube estirado sobre la EMA 100 en 1m, 5m y 15m, gira con una vela grande y cruza las tres EMAs una tras otra. Quiere una alerta que avise ese giro, para comprar o vender.

## Cómo se midió

Reglas fijadas antes de mirar resultados (cabecera de `cascada.py`).

- **Datos:** EUR/USD en velas de 1 minuto, del 2026-01-01 al 2026-11-09 (445.606 velas; 320.323 sin el forex cerrado). Archivo de `django-trading/data/raw/EURUSD_1min_20260101_20261110.csv`, solo lectura. No se gastaron créditos.
- **Indicadores:** EMA 100 y ATR 14 en 1m; EMA 100 y ATR 14 de 5m y 15m con velas cerradas.
- **Contexto:** precio y EMAs en abanico (para una venta: EMA 1m > EMA 5m > EMA 15m), estirón previo de al menos 3 ATR de 5m en la última hora y al menos 4 pips de espacio hasta la EMA 100 de 5m.
- **Disparador B:** la vela de 1m cierra al otro lado de la EMA 100 de 1m.
- **Disparador A:** vela de 1m con cuerpo contra el estirón de al menos 3 ATR de 1m.
- **Stop:** el extremo de las últimas 3 horas más 0,5 pips. Si el stop y el objetivo caen en la misma vela, cuenta el stop.
- **Objetivos:** la EMA 100 de 5m, o la de 15m. Tope de 24 h.
- **Control:** entradas al azar con la misma dirección, la misma distancia a la EMA 100 de 5m (±10 %) y el mismo stop en pips.
- **Costo:** 0,8 pips por operación.
- **Periodos:** DEV de enero a julio, VAL de agosto al 9 de noviembre.

## Resultados

Disparador B con stop en el extremo:

| Objetivo | Periodo | Operaciones | Llega al objetivo | Neto por operación | Control al azar (neto) |
|---|---|---|---|---|---|
| EMA 100 de 5m | DEV | 603 | 59,4 % | −0,14 ± 0,78 | −0,29 ± 0,34 |
| EMA 100 de 5m | VAL | 258 | 55,4 % | −0,88 ± 1,06 | −0,64 ± 0,45 |
| EMA 100 de 15m | DEV | 505 | 40,4 % | −0,43 ± 1,25 | −0,44 ± 0,51 |
| EMA 100 de 15m | VAL | 228 | 41,2 % | −0,32 ± 1,58 | −0,33 ± 0,67 |

- **Frecuencia:** 847 disparos en unos 219 días hábiles, 3,9 por día. La cascada completa hasta la EMA 100 de 15m sale 1,4 veces por día.
- **Cadena:** después del cruce de la EMA 100 de 1m, el precio toca la de 5m antes de marcar un extremo nuevo el 57,4 % de las veces. Si tocó la de 5m, llega a la de 15m el 70,8 %. De punta a punta: 40,7 %.
- **Distancias:** el stop queda a 8,4 pips (mediana) y la EMA 100 de 5m a 8,5 pips.
- **Disparador A (vela grande):** DEV 119 operaciones, +0,46 ± 2,01; VAL 13 operaciones, −1,32 ± 6,67. Muy pocas en VAL para decir algo.

Sin stop (para comparar con la v1, cuyo `alert_log` daba MAE mediana 8,7 pips):

| Entrada | Operaciones | Toca EMA 5m en 4 h | En contra: mediana | p90 | máximo | Pips al tocar (mediana) |
|---|---|---|---|---|---|---|
| B, tras cruzar la EMA 100 de 1m | 847 | 66,8 % | 6,0 | 34,5 | 147,9 | +4,0 |
| En el estirón, sin esperar el cruce | 428 | 61,7 % | 7,2 | 40,4 | 177,6 | +3,9 |

Esperar el cruce baja el recorrido en contra de 7,2 a 6,0 pips de mediana. No quita los casos grandes.

## Filtros probados sobre B (ninguno se sostiene en DEV y VAL a la vez)

Sesión (Asia, Londres, Nueva York, tarde), tamaño del stop, tamaño de la vela de cruce, relación objetivo/stop, dirección, estirón mínimo de 2, 3 y 4 ATR, espacio de 4 y 8 pips, mercado lateral o en tendencia (4 h y 12 h), inclinación de la EMA 100 de 15m y número de intento dentro del mismo estirón.

El mercado lateral sube el porcentaje de aciertos (67 % contra 53 % en DEV) pero no el neto: se gana más veces y menos pips.

## Ejemplos

- **19-oct 03:36, compra a 1,12092** (el ejemplo del abanico de ELAS-77): el detector lo marca; tocó la EMA 100 de 15m con +13,4 pips y 3,3 pips en contra.
- **9-nov, el día anterior al ejemplo del 10-nov:** cuatro ventas seguidas con el mismo patrón terminaron en stop (05:58, 06:24, 09:31 y 12:52: −5,3, −7,3, −8,5 y −6,3 pips) y una quinta, a las 16:27, salió por tiempo con −2,5 pips. El giro del 10-nov a las 04:00 llegó después de esos cinco fallos. El archivo termina el 9-nov, así que ese giro no está en los datos.

## Lectura

- El patrón existe y es frecuente. Lo que no hay es información en el disparador: cuando la vela de 1m cruza su EMA 100, lo que sigue es 57 contra 43, y el pago compensa las probabilidades.
- Coincide con lo medido antes en `AlgoritmoTradingPython` con 6 años de datos (E-002, E-004, E-006): la vuelta a la EMA 100 se explica por la distancia y no deja ventaja tras el spread.
- Alcance: un par (EUR/USD), un proveedor (precio medio de Twelve Data), 10 meses, reglas mecánicas. No mide lo que el trader agrega al mirar el gráfico.

## Cómo repetirlo

```bash
cd docs/research/cascada-3tf
python3 cascada.py  ~/Johan/GitHub/django-trading/data/raw/EURUSD_1min_20260101_20261110.csv   # tabla principal y control
python3 cascada2.py <mismo archivo>   # sin stop, cortes y cadena
python3 cascada3.py <mismo archivo>   # ejemplos por fecha
python3 cascada4.py <mismo archivo>   # tendencia e intento
```

## Experimento 2 (mismo día): acortar la holgura en vez de acertar el giro

Script `riesgo.py`; reglas y criterio fijados en su cabecera antes de correrlo. Mismos disparadores B y las mismas operaciones, con salidas distintas:

| Salida | Periodo | Operaciones | Neto/op | Gana | En contra p90 | p99 | Peor | Minutos p90 | Más de 4 h |
|---|---|---|---|---|---|---|---|---|---|
| X0 aguantar sin stop hasta la EMA 5m | DEV | 367 | −0,87 | 73,8 % | 35,0 | 116,9 | −117,1 | 527 | 28,3 % |
| X4 objetivo vivo | DEV | 773 | −0,42 | 66,1 % | 12,0 | 21,3 | −25,4 | 157 | 0 % |
| X0 aguantar sin stop hasta la EMA 5m | VAL | 149 | −1,11 | 75,8 % | 34,6 | 74,2 | −77,4 | 511 | 28,9 % |
| X4 objetivo vivo | VAL | 341 | −0,55 | 64,8 % | 12,1 | 22,4 | −30,1 | 158 | 0 % |

X4 = stop en el extremo de 3 h; sale al ganar el 50 % de la distancia inicial a la EMA 100 de 5m o al tocarla; tope de 175 min (vida media de esa EMA). Pasa el criterio pre-registrado en DEV y VAL: recorrido en contra p90 ÷3, p99 ÷3 a ÷5, tiempo p90 ÷3,3, ninguna operación de más de 4 h, y el neto no empeora (mejora unos 0,5 pips). Sigue siendo negativo tras 0,8 pips de spread: reduce el riesgo, no crea ventaja.

Las variantes X1 (stop sin tiempo), X2 (175 min) y X3 (60 min) quedan entre las dos. El filtro de noticias por proxy (N1 vela de choque, N2 vela grande a las 08:30, 10:00 o 14:00 de Nueva York) no mejora de forma estable: descartado.

## Experimento 3 (mismo día): la v3 en EUR/GBP y GBP/USD, y el triángulo

Script `triangulo.py`; reglas fijadas en su cabecera antes de ver los datos. Datos nuevos: 1m de 2026 de EUR/GBP y GBP/USD (Twelve Data, unas 448.000 velas por par, en `research-data/`, fuera de git).

**Parte A: el contrato de la v3 en cada par** (neto por operación tras 0,8 pips)

| Par | DEV | VAL | Gana | En contra p90 | Peor |
|---|---|---|---|---|---|
| EUR/USD | −0,42 (773) | −0,55 (341) | 65–66 % | 12 | −30 |
| EUR/GBP | −0,57 (321) | −0,47 (131) | 63–67 % | 7,5 | −23 |
| GBP/USD | −0,61 (912) | −0,21 (409) | 66–70 % | 11–15 | −46 |

Los tres pares se comportan igual: ninguno pasa el umbral de aviso (−1,5). GBP/USD tiene la peor operación más grande (−46 pips) porque se mueve más.

**Parte B: triángulo.** Ningún grupo pasa el criterio (+0,5 pips frente al resto en DEV y VAL con 60 operaciones o más en cada uno). La hipótesis va al revés de lo esperado: en EUR/USD el estirón "solo del euro" fue el peor grupo (−0,46 y −2,75 frente al resto). El grupo "los tres pares estirados" salió mejor en todos los pares, pero con 3 a 41 operaciones por periodo: es una idea nueva que solo se puede probar con datos posteriores al 2026-11-12, nunca con estos.

Veredicto: filtro del triángulo descartado; la v3 sigue igual en los tres pares.

## Experimento 4 (2026-11-13): objetivo mínimo y piso de tamaño

Script `objetivo_minimo.py`; reglas y criterio fijados en su cabecera antes de correrlo. Tres pares juntos, spread por par (EUR/USD 0,8; GBP/USD 1,3; EUR/GBP 1,2) y, como sensibilidad, 1 pip de deslizamiento en contra. Dólares por operación = pips netos × 20 / max(stop de referencia, piso).

Contrato vivo desde el 12-nov (sin stop; sale por TP, EMA 100 de 5m o 175 min), sin deslizamiento:

| Variante | Periodo | Operaciones | Gana | USD/op | Peor USD | USD p1 |
|---|---|---|---|---|---|---|
| Hoy (sin mínimo, piso 3 pips) | DEV | 1627 | 72,7 % | −2,36 | −214,6 | −95,9 |
| Hoy | VAL | 714 | 74,1 % | −2,81 | −177,3 | −108,8 |
| Objetivo ≥ 4 pips | DEV / VAL | 818 / 288 | 68,7 / 66,3 % | −1,55 / −4,15 | −198,6 / −177,3 | |
| Piso de tamaño 10 pips | DEV / VAL | 1627 / 714 | 72,7 / 74,1 % | −1,96 / −1,69 | −165,7 / −150,8 | −80,5 / −67,4 |

Con 1 pip de deslizamiento, todo empeora unos 2,5 USD por operación (hoy: −4,79 / −5,49).

Mismo cálculo con el contrato de la investigación (con stop): −2,06 / −2,30 USD por operación, peor operación −28.

**Veredicto:** ninguna variante pasa el criterio (+1 USD por operación en DEV y VAL y en los dos escenarios de costo). El objetivo mínimo mejora un periodo y empeora el otro, así que no se activa. El piso de 10 pips es lo más estable (+0,4 a +2,0 USD por operación) y baja el peor caso de −215 a −166, pero en DEV sin deslizamiento no llega a +1.

**Lo más importante que deja:** sin stop, la v3 gana más veces (73 % contra 65 %), pero la peor operación pasa de −28 a −215 USD (MAE p99 53 pips, máximo 118), y en dólares por operación queda igual o un poco peor que con stop. En ninguna variante el resultado esperado es positivo tras los costos.

## Experimento 5 (2026-11-19): escuchar a la divisa, no al par

Script `divisa.py`; reglas y criterio fijados en su cabecera antes de correrlo. Tres pares alineados por minuto (2.485 alertas v3 en el año), índices de fuerza de EUR, GBP y USD, contrato X4 con stop, spread 0,8 pips. Holgura = minutos desde la entrada hasta ganar al menos el spread.

| Variante | Periodo | Operaciones | Neto | Holgura mediana | p75 | Nunca en verde | MAE p90 |
|---|---|---|---|---|---|---|---|
| V0 (hoy) | DEV | 1761 | −0,39 | 3 | 13 | 10,3 % | 12,7 |
| V0 (hoy) | VAL | 724 | −0,50 | 3 | 11 | 12,4 % | 10,7 |
| V1 (espera a que la divisa culpable se agote) | DEV | 1759 | −0,39 | 3 | 12 | 10,1 % | 12,8 |
| V1 | VAL | 724 | −0,50 | 3 | 11 | 12,3 % | 10,7 |
| V2 (entrada en tres partes) | DEV | 1761 | −0,80 | — | — | — | 10,6 |
| V2 | VAL | 724 | −0,42 | — | — | — | 9,0 |

**Veredicto: no pasa.** V1 casi no cambió nada: en el 89,5 % de las alertas la divisa culpable ya se había dado vuelta cuando sale la alerta (retraso mediano 0 min). Es decir, cuando el precio sigue estirándose después de la alerta, no es el empuje de antes que no se había agotado, sino un empuje nuevo, y el índice de la divisa no lo anticipa. V2 mejora un periodo y empeora el otro. El horario (apertura de Londres, datos de NY) tampoco da un resultado estable entre DEV y VAL.

**Lo que sí deja:** la holgura histórica de la v3 es corta en la mayoría de los casos (mediana 3 min, p75 11–13 min) y entre el 10 y el 12 % de las operaciones nunca llegan a verde, igual que en vivo (27 de 31). EUR/GBP tiene la holgura más larga (mediana 7, p75 19). La culpable más frecuente fue el dólar (63 %).

## Experimento 6 (2026-11-19): «Persecución», la EMA que persigue al precio

Script `persecucion.py`; reglas y criterio fijados en su cabecera antes de correrlo. La EMA 100 de 5m se acerca al precio 2/101 de la brecha por vela; si la velocidad del precio (pendiente de 12 velas de 5m) es mayor, la brecha CRECE y tiende a una brecha de equilibrio = velocidad × 50,5 velas. 2.334 alertas v3 en los tres pares, spread por par.

**A. Como salida** (sale si pasa a CRECE con ≥ 1 ATR de 5m de estirón posible). Contrato vivo, sin stop, pips netos por operación; cola = media del peor 10 %:

| Periodo | Hoy | Persecución | Control: salir si va 1 ATR de 5m en contra |
|---|---|---|---|
| DEV | −1,11 · cola −28,4 · peor −113,5 | −1,07 · cola −14,5 · peor −33,7 | −0,79 · cola −8,4 · peor −14,9 |
| VAL | −0,88 · cola −23,4 · peor −75,4 | −0,96 · cola −10,3 · peor −21,5 | −1,03 · cola −7,5 · peor −14,9 |

No pasa: corta la cola a la mitad, pero el control simple la corta más con un neto parecido, así que la física no aporta nada sobre un stop de 1 ATR.

**B. Como predicción del estirón** (Spearman de X/ATR con lo que se estiró en 175 min): DEV +0,04, VAL +0,12; la pendiente sola da +0,02 y +0,13. No pasa: no predice cuánto más se estira.

**Lo que deja (observación, no criterio):** en el contrato vivo sin stop, cualquier salida que corte cuando la operación va claramente en contra reduce la peor operación de −113 a unos −15 pips sin empeorar el neto de forma clara. Coincide con el experimento 4. Probarlo como regla exige un criterio propio y datos nuevos (por ejemplo en sombra, en vivo), no estos, que ya se miraron.

## Experimento 7 (2026-11-19): el freno de 1 ATR, probado con 2025

Script `freno.py`; reglas y criterio fijados en su cabecera antes de descargar y ver 2025. Regla idéntica al control del experimento 6: con el contrato vivo (sin stop), salir al cierre del minuto en que, desde la primera vela de 5m cerrada tras la entrada, el precio va al menos 1 ATR de 5m en contra. Datos nuevos: 1m de 2025 de EUR/USD, EUR/GBP y GBP/USD (`download_1m.py` con fechas y rotación de llaves; unas 490 consultas repartidas en las 13 llaves). Los datos de EUR/USD traían velas erróneas (1,10000 y 1,00000 exactos en febrero y marzo); se quitaron 69 velas a más de 30 pips de la mediana de sus vecinas y se informan los dos resultados.

Con los datos limpios (3.114 alertas):

| Periodo | Sin freno | Con freno |
|---|---|---|
| Ene–jun | neto −1,11 · gana 75,8 % · USD/op −1,90 · peor −209,7 USD | neto −1,19 · gana 51,0 % · USD/op −2,05 · peor −64,8 USD |
| Jul–dic | neto −1,00 · gana 72,1 % · USD/op −2,21 · peor −161,7 USD | neto −1,26 · gana 45,9 % · USD/op −2,92 · peor −32,7 USD |
| Año | neto −1,06 · USD/op −2,05 · peor −160,5 pips | neto −1,22 · USD/op −2,47 · peor −36,3 pips |

**Veredicto: no pasa** (con datos limpios y sin limpiar). Corta la peor operación de −210 a −65 USD, pero el neto empeora en el segundo semestre y en el año: la mitad de las operaciones frenadas (793 de 1.598) habrían terminado ganando sin el freno. Es un seguro con costo (unos 0,4 USD por operación), no una mejora del resultado. En EUR/GBP el freno es claramente peor (−1,36 → −3,81 USD/op).

**Lo que deja:** sin freno, una operación de 2025 llegó a −160 pips, cerca del margen de liquidación de unos 150 pips con x100 que preocupa al trader. Y en 2025, igual que en 2026, la v3 con este contrato pierde unos 2 USD por operación después del spread, con freno o sin él.

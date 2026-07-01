---
name: elasticity-trigger-tuning
description: Usar cuando se trabaje en los disparadores de giro (trigger) del motor de elasticidad — ajustar umbrales, reducir señales prematuras/falsas, comparar las 3 versiones del disparador, o modificar el Semáforo Peatonal (WALK/STOP).
---

# Disparadores de giro (Triggers) — Elasticity Engine

## Las 3 versiones existentes

### 1. Disparador Normal (Tradicional)
Compara velas cerradas de M5: si la elasticidad de la última vela cerrada bajó respecto a la anterior (ej. 2.6 → 2.4), confirma el giro. Confiable pero lento — espera el cierre de vela.

### 2. Disparador Experimental (Detector de Pico en Vivo)
Guarda el pico máximo de elasticidad en memoria mientras el precio se mueve tick a tick. Dispara apenas el precio retrocede ≥0.1 de elasticidad desde ese pico, sin esperar cierre de vela. Alimenta el Semáforo Peatonal (WALK). **Es el más propenso a señales prematuras** — ver optimización abajo.

### 3. Disparador Full Reversion
El más conservador: exige M5 y M15 en GREEN simultáneamente + pendiente de EMA favorable antes de entrar en "pre-alerta", y luego espera la caída de elasticidad para confirmar.

## Por qué el Detector de Pico dispara antes de tiempo
El umbral de retroceso (0.1) es fijo, pero el ruido tick-a-tick de la elasticidad no es constante — varía con la volatilidad intrabar. En momentos ruidosos, un retroceso de 0.1 puede ocurrir solo por jitter de precio, sin reversión real; el precio sigue estirándose después. Eso genera falsos "giros".

## Estrategias de optimización (orden de impacto esperado)

1. **Umbral adaptativo en vez de fijo.** Calcular el retroceso mínimo como función de la volatilidad reciente de la elasticidad, no un 0.1 constante para cualquier régimen de mercado:
   ```
   umbral_retroceso = max(0.08, k * stddev(elasticidad, ultimos_N_ticks))
   ```
   `k` y `N` se calibran con backtest (ver punto 6).

2. **Filtro de persistencia antes de "armar" el detector.** No registrar un pico como válido hasta que la elasticidad se haya mantenido por encima del umbral GREEN durante un mínimo de ticks consecutivos (ej. 10–15). Evita que un solo tick outlier dispare todo el mecanismo.

3. **Confirmación por pendiente, no solo por distancia.** En vez de medir únicamente "¿retrocedió 0.1 desde el pico?", medir la velocidad de caída (derivada) en una ventana corta de ticks. Una reversión real suele mostrar caída sostenida/acelerada; un fakeout da un solo dip aislado.

4. **Estado de dos fases: WALK-provisional vs WALK-confirmado.** El detector de pico sigue marcando WALK-provisional para mantener velocidad, pero solo pasa a WALK-confirmado tras 2–3 ticks consecutivos sosteniendo el retroceso. Si el precio vuelve a superar el pico anterior, emitir un evento explícito de invalidación ("un-WALK") en vez de dejarlo ambiguo en el frontend.

5. **Cooldown / re-arm.** Tras un giro fallido (el precio volvió a estirarse más allá del pico anterior), no permitir que el detector dispare de nuevo hasta que se registre un nuevo pico que supere al anterior por un margen mínimo. Evita el "flicker" en mercados choppy.

6. **Usar el propio backtest continuo para calibrar el umbral.** El proyecto ya simula continuamente qué hubiera pasado con cada señal pasada — usar exactamente ese motor para correr el mismo backtest variando `k`, `N` y el umbral base (0.05 / 0.1 / 0.15 / 0.2) en `/experimental`, y comparar el Win Rate resultante. Es la forma de elegir valores con datos, no por intuición.

7. **Gatear el detector de pico con la condición de Full Reversion.** Combinar la velocidad del disparador #2 con la selectividad del #3: solo permitir que el Detector de Pico dispare si M15 ya está en GREEN y la pendiente de EMA es favorable (la condición de "pre-alerta" de Full Reversion). Reduce falsos positivos sin perder toda la velocidad.

## Al modificar este código
- Cualquier cambio de umbral o lógica de disparo se prueba primero en `/experimental` contra el backtest continuo antes de tocar producción.
- Documentar el valor de umbral elegido y el resultado del backtest (Win Rate antes/después) en el commit o PR.
- No tocar el Disparador Normal (#1) ni Full Reversion (#3) al ajustar el Peak Detector — son intencionalmente independientes para poder comparar resultados entre sí.

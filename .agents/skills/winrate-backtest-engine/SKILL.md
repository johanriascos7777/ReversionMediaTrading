---
name: winrate-backtest-engine
description: Usar al trabajar en el motor de backtesting dinámico / cálculo de Win Rate — simulación continua de wins/losses, diferencias entre el cálculo de producción (SMA, mezclado) y experimental (EMA real, segmentado por dirección).
---

# Motor de Backtest Continuo y Win Rate

## Cómo funciona
El backend mantiene en memoria el historial reciente de velas y simula continuamente: "si hubiera operado cada vez que el semáforo se puso Verde, ¿hubiera ganado o perdido?"
- Si el precio estaba sobre la EMA cuando el semáforo dio Verde, se simula una VENTA (y viceversa para sobre-vendido).
- Si el precio toca la EMA dentro de las siguientes X velas → WIN.
- Si no la toca y sigue de largo → LOSS.
- Win Rate = wins / (wins + losses) sobre el historial reciente.

## Producción vs Experimental
- **Producción**: usa SMA (media simple) y mezcla compras y ventas en un solo Win Rate general.
- **Experimental**: usa EMA real (pondera más los precios recientes) y **segmenta** el historial — si la señal actual es de COMPRA, el Win Rate se calcula solo sobre señales históricas de COMPRA, ignorando las de venta. Esto elimina ruido estadístico y da una ventaja estadística más honesta para el instante actual.

## Filtro de bloqueo
Si la elasticidad está en GREEN pero el Win Rate del patrón segmentado cae por debajo de ~65%, el semáforo peatonal pasa a STOP y bloquea la alerta, aunque el estiramiento sea extremo.

## Al modificar este motor
- Cualquier cambio al cálculo de Win Rate (ventana de X velas, umbral de 65%, tipo de media) se valida primero en `/experimental` comparando el Win Rate resultante contra un período histórico conocido antes de promoverlo a producción.
- No mezclar la lógica segmentada (experimental) con la mezclada (producción) — son intencionalmente paralelas para poder hacer QA sin romper el dashboard en vivo.
- Si se agrega un nuevo tipo de señal (ej. una variante de disparador), decidir explícitamente si entra al Win Rate general, al segmentado, o a ambos — no asumir.
- Este motor es el filtro natural para validar cualquier cambio que se haga en `elasticity-trigger-tuning` (ver ese skill): cualquier ajuste de umbral de disparador debe medirse en términos de su impacto en el Win Rate aquí calculado.

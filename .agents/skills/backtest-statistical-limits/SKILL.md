---
name: backtest-statistical-limits
description: Usar cuando se analice o modifique la lógica de backtesting, la comparación contextual de señales, o el filtro de Win Rate. Documenta las limitaciones estadísticas conocidas del motor de backtest actual — profundidad de datos, sesgo de similitud, y la paradoja de extremos.
---

# Limitaciones Estadísticas del Motor de Backtest

## Contexto
Este skill documenta los límites estructurales del backtest actual que cualquier agente debe conocer antes de ajustar umbrales, ampliar ventanas, o interpretar Win Rates.

## Limitación 1: Profundidad Efectiva de Datos

El backend mantiene `HISTORY_OUTPUT = 500` velas M5. Pero:

| Consumo | Velas perdidas | Velas reales |
|---|---|---|
| Calentamiento EMA100 | −100 | 400 |
| Cold start percentil (200 ventana) | −50 a −100 | 300-350 |
| Horizonte de reversión (maxBarsToRevert=20) | −20 | **280-330** |

Señales GREEN esperadas en ese rango: **15-40 eventos.**
En el motor experimental segmentado (solo BUY o solo SELL): **7-20 eventos por dirección.**

**Consecuencia:** el Win Rate reportado tiene un margen de error de ±10-15%. Un Win Rate de 65% podría ser realmente 50-80%.

## Limitación 2: La Paradoja de Extremos en `compareSignalWithHistoryExp`

El filtro de similitud `Math.abs(e.elasticity - current.elasticity) < 0.1` no escala bien con elasticidades extremas.

### Ejemplo:
- Elasticidad actual: 5.08 (extremo raro, ~0.4% del tiempo en M5)
- Eventos en backtest con elasticidad 4.98-5.18: **probablemente 0**
- Resultado: `similarSignals = 0` → `fusedState = 'YELLOW'` → semáforo peatonal = STOP

**La paradoja:** cuanto más extrema la señal (mayor probabilidad real de reversión), MENOS probable que el sistema la confirme (sin datos históricos que la respalden).

### Posibles soluciones futuras (no implementadas):
1. **Banda de similitud proporcional:** `±(0.1 + 0.05 × elasticity)` en vez de `±0.1` fijo
2. **Fallback monotónico:** si `similarSignals = 0` Y `elasticity > 3.0`, asumir Win Rate baseline (históricamente los extremos >3.0 revierten ~70-80% del tiempo)
3. **Más historial:** subir `HISTORY_OUTPUT` a 2000 (problema: TwelveData API rate limits)
4. **Persistencia en disco:** guardar `events[]` entre reinicios para acumular más muestra

## Limitación 3: Definición de "Win" vs Realidad de Trading

| Motor | Condición de Win | Problema |
|---|---|---|
| Main/Experimental | precio **toca** EMA (high/low) | Puede tocar por 1 pip y rebotar — no era operable |
| Full Reversion | precio **cierra** al otro lado de EMA | Más conservador pero más real |

### `maxBarsToRevert = 20` es corto para extremos

- 20 velas M5 = 1 hora 40 minutos
- Extremos de elasticidad >3.0 (como 5.08) típicamente tardan 30-60 velas en revertir
- Esos eventos se marcan como LOSS (exitIndex = -1) aunque eventualmente reviertan
- Esto **deprime artificialmente** el Win Rate para señales extremas

## Qué verificar antes de cambiar estos valores

1. **Subir HISTORY_OUTPUT:** verificar que la API de TwelveData soporte 2000 velas en un solo request, y que el tiempo de inicialización del backend no aumente prohibitivamente
2. **Ampliar banda de similitud:** medir cuántas señales similares arroja con la nueva banda vs la vieja, para no inflar el Win Rate con señales no realmente comparables
3. **Subir maxBarsToRevert:** medir el impacto en falsos positivos — un Win "toca EMA en 50 velas" podría ser un trade que tardó horas y tuvo drawdown significativo
4. **Cualquier cambio se valida en `/experimental` primero** — nunca en producción directamente

## Archivos clave
- `NestServer/src/market/backtestEngine.ts` — Backtest producción (SMA, mixto)
- `NestServer/src/market/backtestEngineExp.ts` — Backtest experimental (EMA real, segmentado)
- `NestServer/src/market/compareSignal.ts` — Filtro de similitud producción
- `NestServer/src/market/compareSignalExp.ts` — Filtro de similitud experimental (el del ±0.1)
- `NestServer/src/market/fuseMarketState.ts` — Fusión de señal real + backtest
- `NestServer/src/full-revertion/fullRevertionEngine.ts` — Backtest FR (cierre completo, slope filter)

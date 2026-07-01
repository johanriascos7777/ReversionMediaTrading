---
name: trader-journal
description: Usar cuando se trabaje en lógica de señales, timing de entrada, mejoras al disparador, o cualquier propuesta de nueva feature. Contiene el setup visual real del trader, las lecciones documentadas de operaciones reales, y la filosofía de la estrategia. El agente debe usar este contexto como punto de partida para proponer mejoras, no como una jaula.
---

# Trader Journal — Contexto Operacional Real

> Este skill existe para que el agente entienda CÓMO piensa el trader que usa este sistema, no para limitar sus propuestas. Todo lo aquí documentado es evidencia del pasado — el agente debe usarla para aprender y proponer algo mejor, no para replicarla ciegamente.

---

## Setup Visual del Trader (Indicadores en Pantalla)

El trader opera con las siguientes capas visuales además del motor de elasticidad:

| Indicador | Color | Función en la decisión |
|---|---|---|
| MA 100 | 🔹 Azul | Tendencia estructural / Soporte mayor. El precio necesita respetar esta MA para considerar reversión válida |
| MA 50 | ❄️ Azul celeste | Filtro de momentum medio. Da pistas de aceleración o freno del movimiento |
| Stochastic (13,3,3) | Panel inferior | Confirmación de sobrecompra/sobreventa en temporalidades bajas (1m, 5m) |
| CCI (14) | Panel inferior | Oscilador de ciclos — confirma si el precio está en zona extrema |
| Bandas de precio (amarillo/rojo) | Líneas horizontales | Soportes y resistencias detectados visualmente por el trader |

**Importante para el agente:** El motor de elasticidad (EMA100, ATR14) corre en el backend. Lo que el trader ve visualmente son estas MAs encima del broker (IQ Option). Son complementarias, no idénticas. El agente puede proponer formas de integrar señales del MA50 o del Stochastic en el Structure Engine si ve valor matemático — no están en el motor actualmente.

---

## Reglas del Frontend: Checklist y Casos de Uso

Antes de proponer cualquier lógica, el agente DEBE conocer las reglas de negocio y patrones visuales que el trader ya documentó en el frontend interactivo de la aplicación. Estos son los filtros definitivos de la estrategia:

- **Casos de Uso (`Client/src/pages/UseCasesPage.tsx`)**: Contiene la definición de escenarios donde el trader opera ("Alineación Fractal Perfecta", "Divergencia de Momentum") y escenarios que el trader evita ("Cruce de Pendiente / Golden Cross", "Sándwich de EMAs / Compresión", "Trampa de Expansión Inicial").
- **Checklist de Validación Estratégica (`Client/src/components/ChecklistAccordion.tsx`)**: Contiene las 3 reglas de oro para validar un giro:
  1. Validar Pullbacks (Soportes y Resistencias).
  2. Momento de Entrada (Evitar Zona Tardía: la entrada debe ser ANTES de que el precio vuelva a tocar la EMA 50, en su máximo estiramiento).
  3. Revalidar Soportes y Resistencias en Temporalidad Macro (M15 / H1).

Cualquier indicador o mejora que el agente proponga en el backend debe intentar matematizar o respaldar estas reglas visuales.

---

## Lecciones de Operaciones Reales

> **Nota:** Las imágenes de las operaciones históricas están organizadas por carpetas en `assets/` (ej. `op1/`, `op2/`, `op3/`, `op-ganada-ejemplo/`, `op-otra-mala-entrada/`). El trader ha documentado múltiples temporalidades y notas por cada operación.
> Al analizar problemas del disparador, el agente debe explorar el contenido de esas carpetas para entender el contexto visual multitemporal (M1, M5, M15) que el trader experimentó en ese momento.

### El Patrón de Error Recurrente (La Trampa del Disparador)
Al analizar el historial de pérdidas (como se ve en los ejemplos de las carpetas de operaciones fallidas en USD/JPY y USD/CHF), hay un patrón humano que el algoritmo actual está replicando:

**Entrar antes de la confirmación.**

1. **La perspectiva humana:** Entrar porque "parecía una señal alcista" sin esperar a que la vela cerrara, o entrar en un "doble techo" antes de que se formara el segundo pico y fuera rechazado.
2. **La perspectiva algorítmica:** El disparador *Experimental (Detector de Pico)* salta con un retroceso de elasticidad de apenas 0.1 tick-a-tick, ignorando si el precio real está respetando la estructura o si es solo ruido intrabar.

## La Lección Central (La Más Importante)

**Estas dos pérdidas y el bug del Disparador Experimental describen exactamente el mismo error: entrar antes de la confirmación.**

- El trader humano lo experimentó: entró antes de que la vela alcista cerrara, antes de que el doble techo se validara.
- El algoritmo lo reproduce: el Detector de Pico en Vivo dispara con un retroceso de 0.1 de elasticidad, que puede ser solo ruido tick-a-tick, sin esperar ninguna confirmación adicional.

**Esto es un hilo directo entre la psicología operacional del trader y el comportamiento del código.** Cualquier mejora al disparador que exija una forma de confirmación antes de activarse es consistente con la manera en que el trader ya aprendió (a veces a costa de pérdidas) a operar.

---

## Qué Puede Proponer el Agente Libremente

Este journal no es un límite — es evidencia. El agente puede y debe:

- Proponer detectar patrones como **doble techo / doble piso** en el precio y agregarlos como factor al Structure Engine.
- Evaluar si el **Stochastic (13,3,3) o el CCI (14)** aportan señal estadística real al Win Rate cuando se les agrega como filtro adicional.
- Sugerir formas de que el sistema reconozca **confluencia entre la MA50 visible del broker y la EMA100 del motor** — o explicar por qué no tiene sentido hacerlo.
- Proponer ablaciones del sistema: "¿qué pasa con el Win Rate si desactivamos el disparador Experimental completamente y solo usamos Normal + Full Reversion?"
- Diseñar nuevos tipos de validación de entrada que no existan todavía.

**Lo único que no puede hacer sin validación:** promover cambios a producción (`/`) sin correr el backtest en `/experimental` primero. El riesgo de capital real lo hace innegociable.

---

## Cómo Agregar Nuevas Notas

Cuando el trader documente una nueva operación (ganada o perdida), agregar:
1. La imagen en `assets/op-<resultado>-<par>-<fecha>.png`
2. Una entrada aquí siguiendo el mismo formato: contexto, nota del trader, qué pasó, lección.

Las pérdidas son igual de valiosas (o más) que las ganancias para calibrar el sistema.

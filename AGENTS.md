# AGENTS.md — Elasticity Dashboard (Market Streaming Engine)

> Este archivo da contexto persistente a cualquier agente de IA que trabaje en este repo (Antigravity, Cursor, Claude Code...). Se carga siempre, así que se mantiene conciso. Para detalle profundo de un subsistema, ver los Skills en `.agents/skills/`.

## Qué es este proyecto
Motor de streaming de mercado para forex que implementa una estrategia de **reversión a la media** basada en una métrica propia llamada **Elasticidad**: `|Precio − EMA100| / ATR14`. No es un bot que opera solo: es un sistema de observabilidad que calcula señales y las expone en tiempo real a un dashboard ("semáforo").

## Arquitectura de alto nivel
- **NestServer/** (NestJS, backend): el cerebro matemático. Abre **una única** conexión WebSocket a TwelveData, reconstruye velas M5/M15, calcula EMA/ATR/Elasticidad/Win Rate, y reemite el snapshot ya procesado a todos los clientes vía su propio servidor WS (patrón fan-out).
- **Client/** (React + Vite, frontend): interfaz pasiva. No calcula nada, solo pinta el estado recibido del backend (semáforos, paneles).
- **Regla de oro**: todo el cálculo pesado vive en el backend. El frontend nunca reimplementa lógica de indicadores — si falta un dato en el snapshot, se agrega en el backend.

## Las dos rutas de motor (clave para no romper nada)
| | Producción (`/`) | Experimental (`/experimental`) |
|---|---|---|
| Media usada en backtest | SMA | EMA real |
| Win Rate | Mezclado (compras + ventas) | Segmentado por dirección de la señal actual |
| Disparador de giro | Reactivo en vivo | Espera cierre de vela para confirmar |
| Uso | Dashboard en vivo | QA / pruebas de mejoras |

Corren en paralelo, aislados a propósito. **No mezclar lógica entre ambos sin que se pida explícitamente** — el sentido de `/experimental` es poder romper cosas sin tocar el dashboard en producción.

## Setup visual del trader (broker IQ Option)
El trader opera con estas capas visuales adicionales al sistema. El agente puede proponer integrarlas al motor si identifica valor estadístico:
- 🔹 **MA 100 (azul):** tendencia estructural / soporte mayor
- ❄️ **MA 50 (azul celeste):** filtro de momentum medio
- Stochastic (13,3,3) y CCI (14) como osciladores de confirmación en temporalidades bajas
- Para el contexto operacional completo, lecciones de operaciones reales y filosofía de estrategia: ver skill `trader-journal`.

## Filosofía del agente en este proyecto
Este es un sistema vivo que el trader está construyendo a partir de su experiencia real. Los skills documentan lo que SE SABE hasta ahora, no lo que el agente DEBE hacer. **El agente tiene libertad total para proponer mejoras, nuevos enfoques, ablaciones, o ideas que el trader no haya considerado.** La única restricción es validación: ningún cambio a lógica de indicadores va a producción sin correr el backtest en `/experimental` primero.

## Conceptos que cualquier agente debe conocer antes de tocar código
- **Elasticidad**: qué tan lejos está el precio de su EMA100, normalizado por ATR14. Percentil ≥80 = GREEN (extremo), ≥60 = YELLOW, resto = RED.
- **Confirmación multi-temporal**: GREEN FINAL requiere M5 *y* M15 en sobreextensión simultánea.
- **3 disparadores de giro** (ver skill `elasticity-trigger-tuning`): Normal (vela cerrada), Experimental/Peak Detector (vivo, alimenta el Semáforo Peatonal WALK), Full Reversion (el más conservador: exige slope EMA + confluencia M5/M15).
- **Win Rate dinámico** (ver skill `winrate-backtest-engine`): el backend simula continuamente "qué hubiera pasado" cada vez que el semáforo se puso Verde, y bloquea la alerta (STOP) si el Win Rate del patrón cae bajo ~65%.
- **Structure Engine** (ver skill `structure-confluence-scoring`): suma S/R, divergencias de RSI(14) y pendiente de EMA200 para clasificar la señal en FUERTE/MODERADA/DÉBIL.

## Convenciones para agentes que editan este repo
- TypeScript estricto en ambos proyectos.
- Cualquier cambio a fórmulas o umbrales de indicadores se prueba primero en `/experimental`, nunca directo en producción.
- No introducir polling REST a TwelveData — la arquitectura depende de la conexión WS única; respetar el patrón fan-out.
- No hardcodear claves de API; usar variables de entorno fuera de git.
- Antes de tocar el motor de backtest o los disparadores, leer el Skill correspondiente.

## Estructura de carpetas real
```
NestServer/
  src/
    market/               # Lógica principal del motor, velas, indicadores
    trade/                # Backtests, Win Rate, simulación
    structure/            # S/R, RSI, slope (Structure Engine)
    full-revertion/       # Disparadores / lógicas específicas
    full-revertion-reforced/ # Variantes de disparadores
    scripts/              # Utilidades, inicialización
Client/
  src/
    components/         # Componentes visuales (Semáforos, Paneles)
    pages/              # Rutas principales (/, /experimental)
    hooks/              # Consumo de WebSockets
    engine/             # Gestión de estado frontend
    logic/              # Lógica auxiliar frontend
    backtest/           # Visualización de datos de backtest
```

# 📡 Market Streaming Engine

# tip

El Disparador por Agotamiento: Esperar a que la resortera empiece a ceder 🪃
En lugar de abrir una operación en el instante exacto en que el semáforo se pone en GREEN (lo cual es como intentar atrapar un cuchillo cayendo), implementa la regla del Giro de Elasticidad:

Espera a que el semáforo se ponga en GREEN (fase de alerta).
No entres todavía. Observa el valor de la elasticidad de las velas que van cerrando.
Si en la Vela A la elasticidad es 2.3 y en la Vela B sigue subiendo a 2.6, la resortera sigue estirándose.
Entra al mercado únicamente cuando una vela cierre con una elasticidad MENOR a la de la vela anterior (por ejemplo, que baje de 2.6 a 2.4).
Esto confirma que el impulso se ha agotado y que la resortera ya ha empezado a contraerse.

---

Backend matemático en tiempo real con WebSocket

---

## 🧠 Concepto Clave

- Mercado = streaming
- Streaming = WebSocket
- WebSocket = 1 conexión viva

El mercado financiero no es un request puntual, es un **flujo continuo de datos**.  
Por eso usamos WebSocket: una conexión persistente que transmite ticks en tiempo real, en lugar de miles de requests REST.

---

## 🔴 Antes: Modelo REST

Arquitectura tradicional:

Frontend ──► API REST ──► Proveedor de datos

Problemas:

- ❌ Miles de requests por minuto
- ❌ Latencia acumulada
- ❌ Cada cliente recalculaba indicadores
- ❌ Alto consumo de CPU
- ❌ Inconsistencias entre usuarios
- ❌ No escalable

Cada usuario hacía sus propios cálculos de EMA, ATR, etc.

---

## 🟢 Ahora: Modelo Streaming

Arquitectura optimizada:

TwelveData WebSocket
│
▼
Backend Engine (Node.js)
├─ CandleBuilder M5
├─ CandleBuilder M15
├─ MarketEngine (EMA + ATR + Elasticidad)
▼
WebSocket propio del servidor
│
▼
Todos los clientes

### 🔥 Cambio clave

El cálculo ocurre **una sola vez en el backend**.  
Los clientes solo reciben el resultado ya procesado.

---

## 📦 Componentes del Backend

### 1️⃣ TwelveDataClient

Conecta vía WebSocket a Twelve Data:

- ✅ 1 conexión viva
- ✅ Streaming tick a tick
- ✅ Reconexión automática
- ✅ Emite eventos `tick`

Responsabilidad: recibir precio en tiempo real.

---

### 2️⃣ CandleBuilder

Convierte ticks en velas M5 y M15.

- Recibe: `tick(price, timestamp)`
- Construye velas con: `open, high, low, close, closed`
- Emite evento `candle:closed` al cerrar vela
- Mantiene máximo 150 velas en memoria (control de RAM)

---

### 3️⃣ MarketEngine

Motor matemático central.

Calcula:

- EMA100
- ATR14
- Elasticidad
- Percentil dinámico
- Estado (GREEN / YELLOW / RED)

#### 📐 Elasticidad

elasticity = |price - EMA100| / ATR

Mide cuántos ATR está el precio lejos de la media.

#### 📊 Percentile Engine

Ventana deslizante de 200 valores.  
Determina qué tan extremo es el movimiento actual respecto al pasado reciente.

#### 🎯 State Resolver

- GREEN → movimiento fuerte y válido
- YELLOW → movimiento medio
- RED → sin ventaja estadística

#### 🧩 Multi-Timeframe Resolver

Combina M5 + M15:

- GREEN + GREEN = GREEN
- GREEN + YELLOW = YELLOW
- Else = RED

---

## 🚀 Flujo Completo en Tiempo Real

1. Twelve Data envía tick
2. `TwelveDataClient` emite tick
3. `CandleBuilder` actualiza vela
4. `MarketEngine` calcula snapshot
5. Backend emite por su WebSocket:

```json
{
  "type": "snapshot",
  "m5": {...},
  "m15": {...},
  "finalState": "GREEN"
}

Todos los clientes reciben exactamente el mismo resultado.


## 🧠 Arquitectura Orientada a Eventos vs REST

### REST
- Modelo basado en **consultas puntuales**
- Cada request abre y cierra conexión
- Escenario típico: *“Dame el precio actual”*
- Ineficiente para datos que cambian cada segundo

### Orientada a Eventos
- Modelo basado en **suscripción**
- Una conexión persistente recibe un flujo continuo de eventos
- Escenario típico: *“Suscríbeme al precio de EUR/USD”*
- Escalable y eficiente: un solo cálculo en backend, broadcast a todos los clientes

**En resumen:**
REST = pedir datos
Eventos = recibir datos automáticamente cuando ocurren

---

## 🔌 Por qué WebSocket = 1 conexión viva
- HTTP: abrir → request → respuesta → cerrar
- WebSocket: abrir → mantener conexión → recibir flujo continuo

### Ventajas
- 🔥 Cero overhead por request
- ⚡ Latencia mínima
- 📡 Streaming real
- 💰 Más barato en infraestructura
- 📈 Escalable

---

## 🛡 Robustez
- Reconexión automática WebSocket
- Buffer limitado de velas
- Protección contra ATR = 0
- Validación mínima de datos
- Snapshot solo si hay suficientes velas

---

## 🎯 Resultado Final
Sistema profesional de streaming financiero:
- Tiempo real real
- Arquitectura limpia
- Escalable
- Determinístico
- Matemáticamente centralizado

---

## 🧩 En una frase
Este backend transforma **ticks crudos** en **inteligencia de mercado estructurada** y la distribuye en tiempo real a todos los clientes con **una sola conexión viva**.


---

## 🛠 Arquitectura del Sistema

Encapsulamiento: Todo el sistema depende de TwelveDataClient.ts.
Facilidad de Cambio: Para cambiar de fuente de datos, solo necesitamos crear un nuevo "Provider" que emita eventos del tipo tick y el resto del sistema (MarketEngine, CandleBuilder) seguirá funcionando igual.



# Entendiendo mi SISTEMA

Aquí te explico qué es, cómo funciona técnicamente y, lo más importante, **por qué te beneficia**.

### 🔍 ¿Qué es técnicamente la "Elasticidad"?
En tu código (`Server/src/marketEngine.ts`), la elasticidad no es un número al azar. Se calcula con esta fórmula:
**`Elasticidad = |Precio - EMA100| / ATR14`**

*   **EMA100**: Es el precio promedio o "punto de equilibrio".
*   **ATR14**: Es la volatilidad normal del mercado (cuánto suele moverse el precio).
*   **Resultado**: Te dice cuántas "unidades de volatilidad" se ha estirado el precio respecto a su promedio.

---

### 💡 ¿En qué te beneficia esta sección? (Mira la imagen)

Esta sección de **"Detalle Visual"** es el "cerebro" que justifica las decisiones del semáforo. Sus beneficios principales son:

#### 1. Responde al "¿Por qué?" (Transparencia)
El semáforo puede decir "NO OPERAR" (ROJO), pero sin esta sección no sabrías por qué.
*   **En tu imagen 1**: El M5 está en un nivel **Extremo (3.97)**, pero el M15 está **Bajo (0.79)**.
*   **El beneficio**: Evita que operes solo porque ves un movimiento fuerte en 5 minutos, cuando en 15 minutos el precio aún no se ha "estirado" lo suficiente para garantizar una reversión probable. **Te salva de falsos positivos.**

#### 2. Normalización del Mercado
Como divides la distancia por el **ATR**, el número es "puro". No importa si el EUR/USD se mueve 10 pips o 100 pips; un valor de **> 2.0** siempre significará que el precio está "anormalmente lejos" de su promedio. Esto te da una regla objetiva que funciona en cualquier condición de mercado.

#### 3. Confirmación Multi-Temporalidad (M5 + M15)
Tu sistema es inteligente porque no solo mira el corto plazo.
*   **M5 (Señal)**: Detecta la oportunidad inmediata.
*   **M15 (Filtro)**: Confirma que la tendencia mayor también esté estirada.
*   **El beneficio**: Actúa como un **doble check automático**. Si ambas barras no están en zonas altas (como se ve en tus capturas donde M15 está en rojo/bajo), el sistema te frena, protegiendo tu capital.

#### 4. Heurística Visual (Zonas de Color)
La leyenda de "Equilibrio, Bajo, Moderado, Alto, Extremo" traduce datos matemáticos complejos a un lenguaje que un trader puede entender en menos de un segundo.
*   **Verde (Extremo)**: El elástico está a punto de romperse o volver con fuerza.
*   **Rojo (Equilibrio)**: El precio está cómodo donde está, no hay fuerza de reversión.

### Resumen para ti
Esta sección te beneficia porque **elimina la subjetividad**. Ya no "crees" que el precio subió mucho; ahora **sabes** que el precio está a 3.97 unidades de volatilidad de su promedio y que, estadísticamente, tiene que regresar. Es la herramienta que convierte el trading de "sentimiento" en trading de **probabilidad estadística**.
```

# Entendido mas

Edited README.md
Edited README.md
Edited README.md
Edited README.md

¡Claro! Esta es la clave de por qué tu sistema es tan potente. Para entender por qué **`> 2.0`** significa "anormalmente lejos", olvida por un momento los dólares o pips y piensa en **"unidades de movimiento normal"**.

### 1. El ATR es tu "Regla de Medir"

Imagina que estás midiendo a dos personas. Si dices "mide 10", no sabes si es mucho o poco. ¿10 centímetros? ¿10 metros?
El **ATR (Average True Range)** es la medida de cuánto se mueve el mercado _normalmente_ en las últimas 14 velas. Es decir:

- **1 ATR** = Lo que el precio se mueve "normalmente".

### 2. ¿Qué significa el número 2.0?

Cuando el cálculo de elasticidad te da **2.0**, significa que la distancia entre el precio actual y su promedio (EMA100) es **exactamente el doble** de lo que el precio suele moverse.

- **Si el valor es 1.0**: El precio se ha alejado de su promedio una distancia "normal". No hay nada especial, el mercado está tranquilo.
- **Si el valor es 2.0**: El precio se ha alejado **2 veces** su movimiento normal. Es como estirar una liga (banda elástica) al doble de su tamaño natural. Está bajo mucha tensión.
- **Si el valor es 3.0 (como en tu imagen de 3.97)**: ¡El precio se ha alejado casi **4 veces** lo normal! Estadísticamente, es muy difícil que el precio se mantenga ahí; la "fuerza de gravedad" lo va a jalar de vuelta a su promedio.

### 3. ¿Por qué es una "Regla Objetiva"?

Aquí está la magia. Imagina estos dos escenarios:

- **Escenario A (Mercado lento):** El ATR es de solo **5 pips**. Si el precio se aleja **10 pips**, la elasticidad es **2.0** (10 / 5).
- **Escenario B (Mercado volátil):** El ATR es de **50 pips**. Si el precio se aleja **10 pips**, la elasticidad es solo **0.2** (10 / 50).

**El beneficio para ti:**
En el Escenario A, esos 10 pips son un movimiento **extremo** y deberías operar. En el Escenario B, esos mismos 10 pips son **insignificantes** y no deberías hacer nada.

Al usar el ratio de **> 2.0**, tu sistema detecta automáticamente cuándo el movimiento es **anormal para ese momento específico**, sin que tú tengas que ajustar nada manualmente. Por eso decimos que es una regla objetiva: **mide el exceso de confianza del mercado.**

---

## ⚙️ Configuración de Sensibilidad (Percentiles)

Si en el futuro deseas ajustar qué tan "exigente" es el semáforo para ponerse en **VERDE**, debes modificar los valores de **Percentil** en dos lugares para que el sistema esté sincronizado:

### 1. En el Backend (Servidor)

Este es el que manda para las notificaciones y el semáforo de tiempo real.

- **Archivo:** `Server/src/marketEngine.ts`
- **Línea ~21:**
  ```typescript
  let config = {
    percentileGreen: 80, // <-- Cambia a 75 para más señales, o 80 para más precisión
    percentileYellow: 60, // <-- Cambia a 55 si bajas el verde, o 60 si lo subes
    // ...
  };
  ```

### 2. En el Frontend (Dashboard)

Este es el que manda para el Backtest y la "Señal Confirmada".

- **Archivo:** `Client/src/engine/stateEngine.ts`
- **Línea ~12:**

  ```typescript
  // Zona óptima (Verde)
  if (percentile >= 80 && ... ) // <-- Pon el mismo número que en el backend

  // Zona media (Amarillo)
  if (percentile >= 60)         // <-- Pon el mismo número que en el backend
  ```

### 💡 Guía Rápida de Valores

| Valor       | Tipo de Trading | Resultado                                                       |
| :---------- | :-------------- | :-------------------------------------------------------------- |
| **80 / 60** | **Conservador** | Pocas señales, pero de muy alta probabilidad (puntos extremos). |
| **75 / 55** | **Moderado**    | Más señales, entradas un poco más tempranas.                    |

> [!IMPORTANT]
> **Regla de Oro:** Siempre mantén el mismo número en el Backend y en el Frontend. Si no están igual, el Dashboard podría decirte que una señal es válida pero el servidor no te enviará la alerta (o viceversa).

---

## 🔄 Flujo de Ejecución y Alertas Autónomas 24/7 (Fase 2)

Con la migración de toda la lógica matemática al servidor NestJS en la **Fase 2**, los cálculos de backtesting, la comparación de señales y la fusión de estados ocurren en el backend de forma centralizada.

El flujo de procesamiento opera de la siguiente manera:

```
                  ┌───────────────────────┐
                  │ Twelve Data (WS Tick) │
                  └───────────┬───────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │  Calcula Todo el      │
                  │  Backtest/Fusión      │
                  └───────────┬───────────┘
                              │
             ┌────────────────┴────────────────┐
             ▼                                 ▼
┌───────────────────────────┐     ┌───────────────────────────┐
│     ¿Cambio a VERDE?      │     │  Transmite estado vía     │
│   (Sí + 5m cooldown)      │     │  WebSocket a los clientes │
└────────────┬──────────────┘     └────────────┬──────────────┘
             │                                 │
             ▼                                 ▼
┌───────────────────────────┐     ┌───────────────────────────┐
│ Envía alerta directamente │     │ Tu Frontend se entera y   │
│ a la API de Telegram      │     │ actualiza el Semáforo     │
│ (fetch desde Node.js)     │     │ (si está abierto)         │
└───────────────────────────┘     └───────────────────────────┘
```

Esta arquitectura robusta garantiza que el monitoreo sea ininterrumpido (24/7) y libre de dependencias del navegador web (client-side). El frontend es ahora puramente una interfaz de visualización limpia.

---

## 🚀 Escalabilidad Futura: ¿Cómo agregar Criptomonedas en NestJS?

NestJS está diseñado bajo una **arquitectura modular (`@Module`)** que funciona de manera muy similar al concepto de **"Apps" independientes en Django** (como `python manage.py startapp`). 

Si en el futuro deseas implementar este mismo sistema de elasticidad y backtesting para Criptomonedas (como `BTC/USD` o `ETH/USD`), puedes hacerlo de forma 100% independiente y en paralelo, sin alterar ni poner en riesgo la lógica actual de Forex (`EUR/USD`):

### 1. El equivalente a las "Apps" de Django
Para iniciar un nuevo módulo de cripto, solo debes ejecutar en la CLI de NestJS:
```bash
nest generate module crypto
nest generate service crypto
nest generate controller crypto
```
Esto creará una nueva carpeta independiente `src/crypto/` en tu backend con su propio controlador y servicio.

### 2. Aislamiento y Paralelismo Total
* **Rutas Aisladas:** Tu controlador de criptomonedas responderá a rutas HTTP dedicadas como `/crypto/history` o `/crypto/health`, sin interferir con las rutas `/history` de Forex.
* **Múltiples Conexiones WebSocket:** El servicio de cripto (`CryptoService`) levantará su propia conexión WebSocket con Twelve Data apuntando a `BTC/USD` u otras criptos. Ambas conexiones WebSocket (Forex y Cripto) funcionarán de forma simultánea.
* **Tokens y Configuración Propia:** Puedes definir variables separadas en tu entorno (ej. `TELEGRAM_CHAT_ID_CRYPTO` o `TWELVE_DATA_API_KEY_CRYPTO`) para que las alertas de cripto se envíen a canales de Telegram totalmente diferentes y usen límites independientes de consumo.
* **Seguridad en Caliente:** Si cometes un error de código al modificar el módulo de criptomonedas, el módulo de Forex seguirá operando sin caídas en producción.

### 3. Reutilización de Código Inteligente (DRY)
No tendrás que copiar ni volver a programar la matemática de la elasticidad, el cálculo de ATR, el backtesting o el sistema de fusión. Como son funciones puras escritas en TypeScript, puedes exportarlas e importarlas en ambos módulos:
* `marketEngine.ts` y `backtestEngine.ts` se convierten en librerías compartidas.
* Ambos módulos se benefician de la misma fiabilidad matemática optimizada.

---

## 📊 Límites Oficiales de la Cuenta Free (Basic Plan) de Twelve Data

Tras revisar minuciosamente la documentación y especificaciones del plan gratuito de Twelve Data, estos son los límites y cómo los gestiona tu sistema actual:

| Característica | Límite del Plan Free | Cómo lo maneja tu aplicación |
| :--- | :--- | :--- |
| **Suscripción WebSocket** | Hasta 8 símbolos simultáneos (dentro de 1 sola conexión) | Enviamos todos los símbolos del `.env` agrupados en una sola suscripción WebSocket por conexión única, por lo que puedes recibir datos de varios pares a la vez sin problemas. |
| **Tasa REST API (Historial)** | 8 peticiones por minuto | Al arrancar, el backend pide el historial M5 y M15 de cada par para "precalentar" las bandas de elasticidad y el backtest. Para evitar que bloqueen tu API Key, el código del backend introduce una pausa automática de 2 segundos entre cada petición histórica. |
| **Límite Diario REST** | 800 peticiones al día | Como el precalentamiento solo se hace una vez al iniciar el servidor (2 llamadas REST por par) y luego todo corre por WebSocket, el consumo diario es extremadamente bajo. |

> [!NOTE]
> **Nota de rendimiento y estabilidad:** Si configuras hasta 4 símbolos simultáneos (8 llamadas REST en total), la pausa inteligente de 2 segundos garantiza que la inicialización demore unos 16 segundos, pero nunca superará el límite de tasa de 8 req/min de tu cuenta Free.


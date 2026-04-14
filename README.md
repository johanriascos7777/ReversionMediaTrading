# 📡 Market Streaming Engine
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
- GREEN  → movimiento fuerte y válido  
- YELLOW → movimiento medio  
- RED    → sin ventaja estadística  

#### 🧩 Multi-Timeframe Resolver
Combina M5 + M15:
- GREEN + GREEN  = GREEN  
- GREEN + YELLOW = YELLOW  
- Else           = RED  

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


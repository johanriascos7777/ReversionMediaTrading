---
name: frontend-state-management
description: Estándares y arquitectura para el manejo de estado global en el Frontend usando Redux Toolkit, RTK Query y Redux Persist.
---

# Frontend State Management (Redux Architecture)

Este proyecto utilizará **Redux Toolkit (RTK)** como la columna vertebral para el manejo del estado global en el cliente, **RTK Query** para el manejo de peticiones asíncronas/caché (si se requieren endpoints REST adicionales al flujo principal), y **Redux Persist** para la persistencia del estado en el almacenamiento local.

## Reglas de Arquitectura

### 1. Qué va en Redux y Qué NO
- **NO VA EN REDUX (Alta Frecuencia):** La data del mercado en tiempo real (velas tick-a-tick, elasticidad, métricas que cambian cada milisegundo) que llega por WebSocket. Meter esto en Redux destruiría el performance de la aplicación de React. Esa data se maneja con hooks de React/Refs o en el `engine/` local.
- **SÍ VA EN REDUX (Baja Frecuencia / Global):** Preferencias del usuario, configuraciones del dashboard (ej. qué paneles están abiertos, qué temporalidad está seleccionada por defecto), opciones de visualización, filtros, y estado de la sesión.

### 2. Estructura Sugerida
Cuando se implemente la arquitectura, la estructura debe seguir el estándar de RTK por "features":
```
Client/
  src/
    store/
      store.ts          # Configuración principal + Persistor
      api/              # Endpoints de RTK Query (si hay REST)
      slices/
        uiSlice.ts      # Estado visual (theme, paneles)
        configSlice.ts  # Preferencias de trading/dashboard
```

### 3. Redux Persist
- Se debe usar `whitelist` para definir exactamente qué reducers se guardan en `localStorage`. 
- **Nunca persistir** errores temporales o el estado de carga (loaders). Solo datos de valor duradero.

### 4. RTK Query
- Aunque el proyecto es `WebSocket-first` (patrón fan-out desde NestJS), si en el futuro se necesita hacer fetch de historial estático o reportes de backtest pesado mediante HTTP REST, RTK Query es la herramienta oficial para declararlo, manejar el caché, re-intentos y el estado de carga (`isLoading`, `isError`).

## Al trabajar en esta arquitectura
- No uses `useState` combinado con `localStorage` manual para guardar preferencias; usa el store global persistido.
- Recuerda que RTK ya incluye `Immer` internamente, por lo que puedes "mutar" el `state` de forma directa dentro de los reducers.

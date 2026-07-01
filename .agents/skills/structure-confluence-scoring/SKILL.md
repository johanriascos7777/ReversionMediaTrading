---
name: structure-confluence-scoring
description: Usar al trabajar en el Structure Engine — soportes/resistencias, divergencias de RSI, pendiente de EMA200, y el sistema de puntos que clasifica una señal en FUERTE/MODERADA/DÉBIL.
---

# Structure Engine — Confluencias

## Factores evaluados
- **Soportes/Resistencias (S/R)**: detectados históricamente sobre el histórico de velas.
- **RSI(14) y divergencias**: una divergencia bajista (precio sube, RSI baja) suma fuerza a una señal de reversión a la baja; el equivalente alcista aplica para reversiones al alza.
- **Pendiente de EMA200**: da la dirección de la tendencia de fondo. Una señal de reversión en contra de la tendencia de largo plazo generalmente pesa menos que una a favor.

## Sistema de puntos
Cada factor de confluencia suma puntos a la señal de elasticidad base. El total clasifica la señal en:
- **FUERTE**: alta confluencia (elasticidad extrema + S/R + divergencia + slope a favor).
- **MODERADA**: confluencia parcial.
- **DÉBIL**: solo elasticidad extrema, sin soporte de los demás factores.

## Al modificar este motor
- Si se agrega un nuevo factor de confluencia, definir explícitamente su peso relativo frente a los existentes (S/R, RSI, slope) antes de sumarlo al score — no usar pesos arbitrarios sin backtestear el impacto en el Win Rate (ver skill `winrate-backtest-engine`).
- Los factores del Structure Engine son complementarios al Win Rate dinámico, no sustitutos: incluso una señal FUERTE puede ser bloqueada por el filtro de Win Rate si el patrón reciente no respeta la reversión.

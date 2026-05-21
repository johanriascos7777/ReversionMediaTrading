/**
 * backtestEngine.ts
 *
 * Motor de backtesting histórico. Analiza velas pasadas para:
 *   1. Detectar cuándo el sistema habría generado una señal GREEN
 *   2. Medir si el precio revirtió a la EMA dentro del límite de velas
 *   3. Guardar estado y elasticidad de cada evento → necesario para
 *      compareSignalWithHistory (comparación contextual)
 *
 * Cada BacktestEvent guarda:
 *   - entryIndex  → índice de la vela donde se detectó la señal
 *   - exitIndex   → índice donde revirtió (-1 si no revirtió)
 *   - barsToRevert → cuántas velas tardó en revertir
 *   - state       → GREEN/YELLOW/RED en ese momento (siempre GREEN aquí)
 *   - elasticity  → valor exacto de elasticidad en ese momento
 *                   ↑ este campo es el que permite la comparación contextual
 */

import type {
  Candle,
  BacktestConfig,
  BacktestEvent,
  BacktestResult,
} from './types'

import { calculateElasticity } from '@/engine/elasticityEngine'
import { resolveElasticityState } from '@/engine/stateEngine'
import { createPercentileEngine } from '@/engine/percentileEngine'

export function runBacktest(
  candles: Candle[],
  config: BacktestConfig
): BacktestResult {
  const percentileEngine = createPercentileEngine(200)

  const events: BacktestEvent[] = []

  for (let i = config.emaPeriod; i < candles.length; i++) {
    const candle = candles[i]

    // 1️⃣ EMA simple sobre las últimas `emaPeriod` velas
    //    Para backtest es suficiente — no necesitamos EMA exponencial exacta
    const slice = candles.slice(i - config.emaPeriod, i)
    const ema   = slice.reduce((sum, c) => sum + c.close, 0) / config.emaPeriod

    // 2️⃣ ATR14 rolling — idéntico al cálculo del servidor
    //    Usa 14 velas anteriores con true range (High-Low + gaps)
    //    FIX Bug#2: antes usaba |high-low| de 1 vela → elasticidades 3-5x mayores
    const atrStart = Math.max(1, i - 13)
    let atrSum = 0, atrCount = 0
    for (let k = atrStart; k <= i; k++) {
      const prev = candles[k - 1].close
      const tr   = Math.max(
        candles[k].high - candles[k].low,
        Math.abs(candles[k].high - prev),
        Math.abs(candles[k].low  - prev)
      )
      atrSum += tr; atrCount++
    }
    const atr = atrCount > 0 ? atrSum / atrCount : 0.0001

    // 3️⃣ Elasticidad = distancia a EMA normalizada por ATR
    const elasticity = calculateElasticity({
      price:  candle.close,
      ema100: ema,
      atr,
    })

    // 4️⃣ Percentil dentro de la ventana de 200 velas
    const percentile = percentileEngine.push(elasticity)

    // 5️⃣ Estado semáforo en este punto histórico
    const state = resolveElasticityState(elasticity, percentile)

    // Solo registramos eventos cuando habría habido señal GREEN
    if (state !== 'GREEN') continue

    // 6️⃣ Buscar reversión en las siguientes `maxBarsToRevert` velas
    //    Reversión = precio toca la EMA desde el lado contrario
    let reverted = false

    for (
      let j = 1;
      j <= config.maxBarsToRevert && i + j < candles.length;
      j++
    ) {
      const future = candles[i + j]

      const revertedDown = candle.close > ema && future.low  <= ema
      const revertedUp   = candle.close < ema && future.high >= ema

      if (revertedDown || revertedUp) {
        events.push({
          entryIndex:   i,
          exitIndex:    i + j,
          barsToRevert: j,
          state,        // ← siempre GREEN (solo entramos si state === 'GREEN')
          elasticity,   // ← valor exacto para compareSignalWithHistory
        })
        reverted = true
        break
      }
    }

    // Si no revirtió dentro del límite → loss (exitIndex = -1)
    if (!reverted) {
      events.push({
        entryIndex:   i,
        exitIndex:    -1,
        barsToRevert: config.maxBarsToRevert,
        state,
        elasticity,
      })
    }
  }

  // 📊 Métricas finales
  const wins         = events.filter(e => e.exitIndex !== -1)
  const totalSignals = events.length

  return {
    totalSignals,
    wins:    wins.length,
    winRate:
      totalSignals === 0
        ? 0
        : Math.round((wins.length / totalSignals) * 100),
    avgBarsToRevert:
      wins.length === 0
        ? 0
        : Math.round(
            wins.reduce((s, e) => s + e.barsToRevert, 0) / wins.length
          ),
    events,  // ← necesario para compareSignalWithHistory
  }
}
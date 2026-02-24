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

    // 1️⃣ EMA simple (para backtest basta)
    const slice = candles.slice(i - config.emaPeriod, i)
    const ema =
      slice.reduce((sum, c) => sum + c.close, 0) / config.emaPeriod

    // 2️⃣ Elasticidad
    const atr = Math.abs(candle.high - candle.low) || 0.0001
    const elasticity = calculateElasticity({
      price: candle.close,
      ema100: ema,
      atr,
    })

    // 3️⃣ Percentil
    const percentile = percentileEngine.push(elasticity)

    // 4️⃣ Estado semáforo
    const state = resolveElasticityState(elasticity, percentile)

    if (state !== 'GREEN') continue

    // 5️⃣ Buscar reversión
    let reverted = false

    for (
      let j = 1;
      j <= config.maxBarsToRevert && i + j < candles.length;
      j++
    ) {
      const future = candles[i + j]

      if (
        (candle.close > ema && future.low <= ema) ||
        (candle.close < ema && future.high >= ema)
      ) {
        events.push({
          entryIndex: i,
          exitIndex: i + j,
          barsToRevert: j,
        })
        reverted = true
        break
      }
    }

    if (!reverted) {
      events.push({
        entryIndex: i,
        exitIndex: -1,
        barsToRevert: config.maxBarsToRevert,
      })
    }
  }

  // 📊 Métricas
  const wins = events.filter(e => e.exitIndex !== -1)
  const totalSignals = events.length

  return {
    totalSignals,
    wins: wins.length,
    winRate:
      totalSignals === 0 ? 0 : Math.round((wins.length / totalSignals) * 100),
    avgBarsToRevert:
      wins.length === 0
        ? 0
        : Math.round(
            wins.reduce((s, e) => s + e.barsToRevert, 0) / wins.length
          ),
  }
}

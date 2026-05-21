/**
 * marketEngine.ts
 *
 * Motor matemático del backend.
 * Dado un array de velas, calcula EMA100, ATR14, elasticidad y estado.
 *
 * Idéntico en lógica al frontend pero en Node.js puro (sin React).
 * Al estar en el backend, los cálculos corren una sola vez
 * y el resultado se envía a todos los clientes conectados.
 */

import type { Candle, MarketState, MarketSnapshot, Timeframe } from './types'

// ─── configuración (debe coincidir con el frontend) ───────────────────────────

const EMA_PERIOD = 100
const ATR_PERIOD = 14

// Umbrales del stateEngine — se actualizan con calibración
let config = {
  percentileGreen:  80,
  percentileYellow: 60,
  elasticityMin:    1.0,
  elasticityMax:    10.0,  // era 5.5 — sin base estadística, bloqueaba señales extremas válidas
}

export function updateEngineConfig(c: Partial<typeof config>): void {
  config = { ...config, ...c }
}

// ─── EMA ─────────────────────────────────────────────────────────────────────

function calculateEMA(closes: number[], period: number): number {
  if (closes.length === 0) return 0
  if (closes.length < period) return closes[closes.length - 1]

  const alpha = 2 / (period + 1)
  let ema = closes.slice(0, period).reduce((s, v) => s + v, 0) / period

  for (let i = period; i < closes.length; i++) {
    ema = alpha * closes[i] + (1 - alpha) * ema
  }

  return ema
}

// ─── ATR ─────────────────────────────────────────────────────────────────────

function calculateATR(candles: Candle[], period: number): number {
  if (candles.length < 2) return 0.0006

  const trues: number[] = []
  for (let i = 1; i < candles.length; i++) {
    const { high, low } = candles[i]
    const prev = candles[i - 1].close
    trues.push(Math.max(high - low, Math.abs(high - prev), Math.abs(low - prev)))
  }

  const slice = trues.slice(-period)
  return slice.reduce((s, v) => s + v, 0) / slice.length
}

// ─── Percentile engine (ventana deslizante) ───────────────────────────────────

class PercentileEngine {
  private window: number[] = []
  private maxSize: number

  constructor(maxSize = 200) {
    this.maxSize = maxSize
  }

  // 1. Agrega al historial duro (solo usado cuando cierra la vela)
  push(value: number): void {
    this.window.push(value)
    if (this.window.length > this.maxSize) this.window.shift()
  }

  // 2. Consulta en memoria sin alterar el historial (para ticks en tiempo real)
  rank(value: number): number {
    if (this.window.length === 0) return 50 // Seguro por defecto
    const sorted = [...this.window].sort((a, b) => a - b)
    const rank   = sorted.filter(v => v <= value).length
    return (rank / this.window.length) * 100
  }
}

const percentileM5Map  = new Map<string, PercentileEngine>()
const percentileM15Map = new Map<string, PercentileEngine>()

function getPercentileEngine(symbol: string, timeframe: Timeframe): PercentileEngine {
  const map = timeframe === 'M5' ? percentileM5Map : percentileM15Map
  let engine = map.get(symbol)
  if (!engine) {
    engine = new PercentileEngine(200)
    map.set(symbol, engine)
  }
  return engine;
}

// ─── State resolution ─────────────────────────────────────────────────────────

function resolveState(elasticity: number, percentile: number): MarketState {
  if (
    percentile  >= config.percentileGreen &&
    elasticity  >= config.elasticityMin   &&
    elasticity  <= config.elasticityMax
  ) return 'GREEN'

  if (percentile >= config.percentileYellow) return 'YELLOW'

  return 'RED'
}

// ─── Snapshot calculator ──────────────────────────────────────────────────────

/**
 * Extrae la misma lógica matemática exacta para usarla tanto
 * en las velas cerradas como en los snapshots en tiempo real.
 */
export function calculateElasticityForCandles(candles: Candle[], price: number): number | null {
  if (candles.length < EMA_PERIOD + 2) return null

  const closes  = candles.map(c => c.close)
  const ema100  = calculateEMA(closes, EMA_PERIOD)
  const atr     = calculateATR(candles, ATR_PERIOD)

  if (atr === 0) return null

  return Math.abs(price - ema100) / atr
}

/**
 * Alimentador exclusivo para el historial del percentil (se llama on candle:closed)
 */
export function pushPercentileHistory(symbol: string, timeframe: Timeframe, elasticity: number): void {
  const percentileEngine = getPercentileEngine(symbol, timeframe)
  percentileEngine.push(elasticity)
}

/**
 * Dado el array de velas de un timeframe, calcula el snapshot completo.
 * price = precio del último tick (puede ser intracandle)
 */
export function calculateSnapshot(
  symbol:    string,
  candles:   Candle[],
  price:     number,
  timeframe: Timeframe,
  timestamp: number
): MarketSnapshot | null {
  const elasticity = calculateElasticityForCandles(candles, price)
  if (elasticity === null) return null

  // Re-calculamos params necesarios para el payload final
  const closes  = candles.map(c => c.close)
  const ema100  = calculateEMA(closes, EMA_PERIOD)
  const atr     = calculateATR(candles, ATR_PERIOD)

  const percentileEngine = getPercentileEngine(symbol, timeframe)
  const percentile       = percentileEngine.rank(elasticity) // Solo lectura, no mutación!

  const state = resolveState(elasticity, percentile)

  return {
    timeframe,
    price,
    ema100,
    atr,
    elasticity,
    percentile,
    state,
    timestamp,
  }
}

// ─── Multi-timeframe resolver ─────────────────────────────────────────────────

export function resolveMultiTF(
  m5:  MarketSnapshot,
  m15: MarketSnapshot
): MarketState {
  if (m5.state === 'GREEN'  && m15.state === 'GREEN')  return 'GREEN'
  if (m5.state === 'GREEN'  && m15.state === 'YELLOW') return 'YELLOW'
  return 'RED'
}
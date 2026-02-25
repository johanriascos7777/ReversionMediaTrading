/**
 * candleBuilder.ts
 *
 * Construye velas M5/M15 desde ticks en tiempo real.
 * También acepta velas históricas para pre-calentar el engine.
 */

import type { Candle, Timeframe } from './types'
import { EventEmitter } from 'events'

const TIMEFRAME_MS: Record<Timeframe, number> = {
  M5:  5  * 60 * 1000,
  M15: 15 * 60 * 1000,
}

const MAX_CANDLES = 150

export class CandleBuilder extends EventEmitter {
  private timeframe: Timeframe
  private periodMs:  number
  private current:   Candle | null = null
  private closed:    Candle[] = []

  constructor(timeframe: Timeframe) {
    super()
    this.timeframe = timeframe
    this.periodMs  = TIMEFRAME_MS[timeframe]
  }

  /**
   * Inyecta una vela histórica cerrada directamente al historial.
   * Usado para pre-calentar el engine sin esperar ticks reales.
   */
  injectHistoricalCandle(candle: Candle): void {
    this.closed.push({ ...candle, closed: true })
    if (this.closed.length > MAX_CANDLES) {
      this.closed.shift()
    }
  }

  /**
   * Procesa un tick en tiempo real.
   * Emite 'candle:closed' cuando cierra una vela.
   */
  tick(price: number, timestamp: number): void {
    const periodId = Math.floor(timestamp / this.periodMs)

    if (this.current === null) {
      this.current = this.openCandle(price, periodId)
      this.emit('candle:update', this.current)
      return
    }

    const currentPeriodId = Math.floor(this.current.time / this.periodMs)

    if (periodId !== currentPeriodId) {
      // Cerrar vela actual
      const closedCandle: Candle = { ...this.current, closed: true }
      this.closed.push(closedCandle)
      if (this.closed.length > MAX_CANDLES) this.closed.shift()

      console.log(
        `[CandleBuilder ${this.timeframe}] Vela cerrada:`,
        `O:${closedCandle.open.toFixed(5)}`,
        `H:${closedCandle.high.toFixed(5)}`,
        `L:${closedCandle.low.toFixed(5)}`,
        `C:${closedCandle.close.toFixed(5)}`
      )

      this.emit('candle:closed', closedCandle, this.closed)

      // Abrir nueva vela
      this.current = this.openCandle(price, periodId)
    } else {
      this.current.high  = Math.max(this.current.high, price)
      this.current.low   = Math.min(this.current.low,  price)
      this.current.close = price
    }

    this.emit('candle:update', this.current)
  }

  private openCandle(price: number, periodId: number): Candle {
    return {
      time:   periodId * this.periodMs,
      open:   price,
      high:   price,
      low:    price,
      close:  price,
      closed: false,
    }
  }

  getCandles(): Candle[] {
    if (this.current) return [...this.closed, this.current]
    return [...this.closed]
  }

  getClosedCandles(): Candle[] {
    return [...this.closed]
  }

  getCurrentCandle(): Candle | null {
    return this.current
  }

  getTimeframe(): Timeframe {
    return this.timeframe
  }
}
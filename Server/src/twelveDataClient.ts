/**
 * twelveDataClient.ts
 *
 * Cliente WebSocket hacia Twelve Data.
 * Recibe precio tick a tick y notifica al servidor.
 *
 * Manejo de reconexión automática:
 *   Si la conexión se cae (internet, reinicio de Twelve Data),
 *   reintenta cada 5 segundos hasta reconectar.
 *   Esto garantiza que el backend nunca quede sin datos silenciosamente.
 */

import WebSocket from 'ws'
import type { TwelveTickMessage } from './types'
import { EventEmitter } from 'events'

const RECONNECT_DELAY_MS = 5_000

export class TwelveDataClient extends EventEmitter {
  private apiKey:  string
  private symbol:  string
  private ws:      WebSocket | null = null
  private stopped: boolean = false

  constructor(apiKey: string, symbol: string) {
    super()
    this.apiKey = apiKey
    this.symbol = symbol
  }

  connect(): void {
    this.stopped = false
    this._connect()
  }

  disconnect(): void {
    this.stopped = true
    this.ws?.close()
  }

  private _connect(): void {
    const url = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${this.apiKey}`

    console.log('[TwelveData] Conectando WebSocket...')
    this.emit('status', 'connecting', 'Conectando con Twelve Data...')

    this.ws = new WebSocket(url)

    this.ws.on('open', () => {
      console.log('[TwelveData] Conectado ✓')
      this.emit('status', 'connected', 'WebSocket conectado')

      // Suscribirse al símbolo
      this.ws!.send(JSON.stringify({
        action: 'subscribe',
        params: { symbols: this.symbol },
      }))
    })

    this.ws.on('message', (raw: Buffer) => {
      let msg: TwelveTickMessage

      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }

      // Solo procesar mensajes de precio
      if (msg.event !== 'price' || !msg.price) return

      this.emit('tick', msg.price, Date.now())
    })

    this.ws.on('error', (err) => {
      console.error('[TwelveData] Error:', err.message)
      this.emit('status', 'disconnected', `Error: ${err.message}`)
    })

    this.ws.on('close', () => {
      console.log('[TwelveData] Conexión cerrada')
      this.emit('status', 'disconnected', 'Conexión cerrada')

      if (!this.stopped) {
        console.log(`[TwelveData] Reconectando en ${RECONNECT_DELAY_MS / 1000}s...`)
        setTimeout(() => this._connect(), RECONNECT_DELAY_MS)
      }
    })
  }
}
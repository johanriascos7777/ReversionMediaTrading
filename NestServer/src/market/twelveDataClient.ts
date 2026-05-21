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
import https from 'https'

const RECONNECT_DELAY_MS = 5_000

export class TwelveDataClient extends EventEmitter {
  private apiKey: string
  private symbol: string
  private ws: WebSocket | null = null
  private stopped: boolean = false
  private pollInterval: NodeJS.Timeout | null = null

  constructor(apiKey: string, symbol: string | string[]) {
    super()
    this.apiKey = apiKey
    this.symbol = Array.isArray(symbol) ? symbol.join(',') : symbol
  }

  connect(): void {
    this.stopped = false
    this.stopRestPoller()
    this._connect()
  }

  disconnect(): void {
    this.stopped = true
    this.stopRestPoller()
    this.ws?.close()
  }

  private startRestPoller(): void {
    if (this.pollInterval) return
    console.log(`[TwelveData] [${this.symbol}] Activando REST Poller híbrido (intervalo: 10s) por restricción de WebSocket gratis`)

    const poll = () => {
      if (this.stopped) return

      const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(this.symbol)}&apikey=${this.apiKey}`

      https.get(url, (res) => {
        let raw = ''
        res.on('data', (chunk) => {
          raw += chunk.toString()
        })
        res.on('end', () => {
          try {
            const data = JSON.parse(raw)
            if (data.price) {
              const price = parseFloat(data.price)
              if (!isNaN(price)) {
                // Emitir tick como si viniera del websocket
                this.emit('tick', this.symbol, price, Date.now())
              }
            } else {
              console.error(`[TwelveData] [${this.symbol}] Error de REST Poller (Respuesta):`, raw)
            }
          } catch (e: any) {
            console.error(`[TwelveData] [${this.symbol}] Error parseando JSON en REST Poller:`, e.message)
          }
        })
      }).on('error', (err) => {
        console.error(`[TwelveData] [${this.symbol}] Error de red en REST Poller:`, err.message)
      })
    }

    // Ejecutar de inmediato y luego a intervalos de 10s
    poll()
    this.pollInterval = setInterval(poll, 10_000)
  }

  private stopRestPoller(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
      console.log(`[TwelveData] [${this.symbol}] REST Poller detenido`)
    }
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
      let msg: any

      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }

      if (msg.event === 'subscribe-status') {
        console.log(`[TwelveData] [${this.symbol}] Subscription Status:`, JSON.stringify(msg))
        if (msg.status === 'error') {
          // Activar REST Poller si falla la suscripción
          this.startRestPoller()
        } else if (msg.status === 'ok') {
          this.stopRestPoller()
        }
        return
      }

      if (msg.event === 'heartbeat') {
        // Silencioso o log opcional
        return
      }

      if (msg.status === 'error' || msg.event === 'error') {
        console.error(`[TwelveData] [${this.symbol}] WebSocket Error Response:`, JSON.stringify(msg))
        this.emit('status', 'disconnected', msg.message || 'Error en WebSocket')
        return
      }

      if (msg.event !== 'price') {
        console.log(`[TwelveData] [${this.symbol}] Mensaje no controlado:`, JSON.stringify(msg))
        return
      }

      // Validar que el mensaje tenga data y su timestamp oficial
      if (!msg.price || !msg.timestamp || !msg.symbol) {
        this.emit('dropped_tick', 'missing_data')
        return
      }

      this.emit('tick', msg.symbol, msg.price, msg.timestamp * 1000)
    })

    this.ws.on('error', (err: Error) => {
      console.error(`[TwelveData] [${this.symbol}] Error:`, err.message)
      this.emit('status', 'disconnected', `Error: ${err.message}`)
    })

    this.ws.on('close', (code: number, reason: Buffer) => {
      const reasonStr = reason ? reason.toString() : 'sin razón'
      console.log(`[TwelveData] [${this.symbol}] Conexión cerrada. Código: ${code} · Razón: ${reasonStr}`)
      this.emit('status', 'disconnected', `Conexión cerrada (${code})`)

      if (!this.stopped) {
        console.log(`[TwelveData] [${this.symbol}] Reconectando en ${RECONNECT_DELAY_MS / 1000}s...`)
        setTimeout(() => this._connect(), RECONNECT_DELAY_MS)
      }
    })
  }
}
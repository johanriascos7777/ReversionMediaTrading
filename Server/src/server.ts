/**
 * server.ts — Backend completo del Elasticity System
 *
 * Expone dos interfaces:
 *
 *   WebSocket ws://localhost:8080
 *     → snapshots en tiempo real al frontend
 *
 *   HTTP GET http://localhost:8080/history?timeframe=5min
 *     → devuelve las velas históricas al frontend (para backtest)
 *     → 0 créditos: el backend ya las tiene en memoria
 *
 * Al arrancar:
 *   1. Pide historial M5 + M15 a Twelve Data REST (1 vez al día)
 *   2. Pre-calienta CandleBuilders → EMA y percentiles listos
 *   3. Conecta WebSocket de Twelve Data → ticks en tiempo real
 * 
 * VIGILAR  A  const twelveClient = new TwelveDataClient(API_KEY, SYMBOL)
 * twelveClient.connect() para que:
 * -No se duplique
 * -No se reconecte mal
 *-No cree múltiples instancias
 */

import http from 'http'
import WebSocket, { WebSocketServer } from 'ws'
import https from 'https'
import { TwelveDataClient } from './twelveDataClient'
import { CandleBuilder } from './candleBuilder'
import { calculateSnapshot, resolveMultiTF } from './marketEngine'
import type { BackendMessage, Candle, MarketSnapshot } from './types'

// ─── ⚙️ CONFIGURACIÓN ────────────────────────────────────────────────────────

const API_KEY        = 'b584cd192ee6441a86f06373b685283b'
const SYMBOL         = 'EUR/USD'
const PORT           = 8080
const HISTORY_OUTPUT = 500

// ─────────────────────────────────────────────────────────────────────────────

const builderM5  = new CandleBuilder('M5')
const builderM15 = new CandleBuilder('M15')

let lastSnapshotM5:  MarketSnapshot | null = null
let lastSnapshotM15: MarketSnapshot | null = null

// Guardamos el historial en memoria para servirlo al frontend
let historicalM5:  Candle[] = []
let historicalM15: Candle[] = []

// ─── HTTP server (historial + CORS) ──────────────────────────────────────────

const httpServer = http.createServer((req, res) => {
  // CORS — permite que el frontend en localhost:5173 acceda
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  res.setHeader('Content-Type', 'application/json')

  if (req.url?.startsWith('/history')) {
    const url        = new URL(req.url, `http://localhost:${PORT}`)
    const timeframe  = url.searchParams.get('timeframe') ?? '5min'
    const candles    = timeframe === '15min' ? historicalM15 : historicalM5

    res.writeHead(200)
    res.end(JSON.stringify(candles))
    return
  }

  // Health check
  if (req.url === '/health') {
    res.writeHead(200)
    res.end(JSON.stringify({ status: 'ok', candlesM5: historicalM5.length, candlesM15: historicalM15.length }))
    return
  }

  res.writeHead(404)
  res.end(JSON.stringify({ error: 'Not found' }))
})

// ─── WebSocket server sobre el mismo puerto HTTP ──────────────────────────────

const wss = new WebSocketServer({ server: httpServer })

function broadcast(msg: BackendMessage): void {
  const data = JSON.stringify(msg)
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data)
    }
  })
}

wss.on('connection', (ws) => {
  console.log('[Server] Frontend conectado')

  if (lastSnapshotM5 && lastSnapshotM15) {
    const finalState = resolveMultiTF(lastSnapshotM5, lastSnapshotM15)
    ws.send(JSON.stringify({
      type: 'snapshot',
      m5:   lastSnapshotM5,
      m15:  lastSnapshotM15,
      finalState,
    } satisfies BackendMessage))
  }

  ws.on('close', () => console.log('[Server] Frontend desconectado'))
})

// ─── Fetch historial via REST ─────────────────────────────────────────────────

type TwelveCandle = {
  datetime: string
  open:     string
  high:     string
  low:      string
  close:    string
}

function fetchHistoricalCandles(
  interval: '5min' | '15min',
  outputSize: number
): Promise<Candle[]> {
  return new Promise((resolve) => {
    const path =
      `/time_series?symbol=${encodeURIComponent(SYMBOL)}` +
      `&interval=${interval}&outputsize=${outputSize}&apikey=${API_KEY}`

    const req = https.request({ hostname: 'api.twelvedata.com', path, method: 'GET' }, (res) => {
      let raw = ''
      res.on('data', (chunk: Buffer) => { raw += chunk.toString() })
      res.on('end', () => {
        try {
          const data = JSON.parse(raw)
          if (data.status !== 'ok' || !data.values) {
            // Error formal de la API (ej: límite de uso excedido)
            console.error(`[History] Error ${interval} de TwelveData:`, data.message || data)
            resolve([])
            return
          }
          const candles: Candle[] = [...(data.values as TwelveCandle[])].reverse().map((c) => ({
            time:   new Date(c.datetime).getTime(),
            open:   parseFloat(c.open),
            high:   parseFloat(c.high),
            low:    parseFloat(c.low),
            close:  parseFloat(c.close),
            closed: true,
          }))
          resolve(candles)
        } catch (e) {
          // Error oculto (ej: respuesta HTML de Cloudflare en vez de JSON)
          console.error(`[History] Error parseando JSON en ${interval}:`, e)
          console.error(`[History] Respuesta cruda:`, raw.substring(0, 300))
          resolve([])
        }
      })
    })
    
    req.on('error', (err) => {
      // Error de red a nivel de Node.js
      console.error(`[History] Error de red en request:`, err.message)
      resolve([])
    })
    
    req.end() // <-- Faltaba cerrar la petición aquí
  })
}

function warmUpBuilder(builder: CandleBuilder, candles: Candle[]): void {
  candles.forEach((c) => builder.injectHistoricalCandle(c))
  console.log(`[WarmUp] ${builder.getTimeframe()} precalentado con ${candles.length} velas`)
}

// ─── Procesamiento de ticks ───────────────────────────────────────────────────

function processTick(price: number, timestamp: number): void {
  builderM5.tick(price, timestamp)
  builderM15.tick(price, timestamp)

  const snapshotM5  = calculateSnapshot(builderM5.getCandles(),  price, 'M5',  timestamp)
  const snapshotM15 = calculateSnapshot(builderM15.getCandles(), price, 'M15', timestamp)

  if (!snapshotM5 || !snapshotM15) return

  lastSnapshotM5  = snapshotM5
  lastSnapshotM15 = snapshotM15

  const finalState = resolveMultiTF(snapshotM5, snapshotM15)
  broadcast({ type: 'snapshot', m5: snapshotM5, m15: snapshotM15, finalState })

  if (Math.random() < 0.05) {
    console.log(
      `[Engine] ${new Date(timestamp).toLocaleTimeString()}`,
      `· ${price.toFixed(5)}`,
      `· M5: ${snapshotM5.elasticity.toFixed(3)} ${snapshotM5.state}`,
      `· M15: ${snapshotM15.elasticity.toFixed(3)} ${snapshotM15.state}`,
      `· ${finalState}`
    )
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔════════════════════════════════════╗')
  console.log('║   Elasticity System — Backend      ║')
  console.log('║   EUR/USD  ·  M5 + M15             ║')
  console.log(`║   Puerto: ${PORT}                      ║`)
  console.log('╚════════════════════════════════════╝')

  // 1. Cargar historial para pre-calentar
  console.log('[Server] Cargando historial M5 (500 velas)...')
  historicalM5 = await fetchHistoricalCandles('5min', HISTORY_OUTPUT)

  await new Promise((r) => setTimeout(r, 2000))   // pausa entre llamadas REST

  console.log('[Server] Cargando historial M15 (500 velas)...')
  historicalM15 = await fetchHistoricalCandles('15min', HISTORY_OUTPUT)

  if (historicalM5.length  > 0) warmUpBuilder(builderM5,  historicalM5)
  if (historicalM15.length > 0) warmUpBuilder(builderM15, historicalM15)

  // Calcular snapshot inicial con último precio del historial
  if (historicalM5.length > 0 && historicalM15.length > 0) {
    const lastPrice = historicalM5[historicalM5.length - 1].close
    const ts        = historicalM5[historicalM5.length - 1].time
    const snap5     = calculateSnapshot(builderM5.getCandles(),  lastPrice, 'M5',  ts)
    const snap15    = calculateSnapshot(builderM15.getCandles(), lastPrice, 'M15', ts)

    if (snap5 && snap15) {
      lastSnapshotM5  = snap5
      lastSnapshotM15 = snap15
      console.log(
        '[Server] Snapshot inicial:',
        `M5: ${snap5.elasticity.toFixed(3)} ${snap5.state}`,
        `· M15: ${snap15.elasticity.toFixed(3)} ${snap15.state}`
      )
    }
  }

  // 2. Arrancar HTTP + WebSocket server
  httpServer.listen(PORT, () => {
    console.log(`[Server] HTTP  → http://localhost:${PORT}/history`)
    console.log(`[Server] WS    → ws://localhost:${PORT}`)
  })

  // 3. Conectar Twelve Data WebSocket
  const twelveClient = new TwelveDataClient(API_KEY, SYMBOL)

  twelveClient.on('tick', processTick)
  twelveClient.on('status', (status: string, message: string) => {
    broadcast({ type: 'status', status: status as 'connecting' | 'connected' | 'disconnected', message })
  })

  twelveClient.connect()

  builderM5.on('candle:closed',  () => console.log(`[Server] Vela M5  cerrada — ${builderM5.getClosedCandles().length} velas`))
  builderM15.on('candle:closed', () => console.log(`[Server] Vela M15 cerrada — ${builderM15.getClosedCandles().length} velas`))
}

main().catch(console.error)
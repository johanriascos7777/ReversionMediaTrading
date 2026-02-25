/**
 * useMarketData.ts
 *
 * Conecta al backend local via WebSocket.
 * El backend hace todo el trabajo pesado — este hook
 * solo recibe el snapshot ya calculado y actualiza el estado.
 *
 * Antes:  Frontend → Twelve Data REST (consume créditos)
 * Ahora:  Frontend → Backend local → Twelve Data WebSocket (0 créditos)
 *
 * Reconexión automática: si el backend se reinicia,
 * el frontend reconecta solo después de 3 segundos.
 */

import { useEffect, useRef, useState } from 'react'
import type { MarketSnapshot } from '@/types/market'

// ─── ⚙️ CONFIGURACIÓN ────────────────────────────────────────────────────────

const BACKEND_WS_URL  = 'ws://localhost:8080'
const RECONNECT_MS    = 3_000

// ─────────────────────────────────────────────────────────────────────────────

export type FinalMarketView = {
  m5:         MarketSnapshot
  m15:        MarketSnapshot
  finalState: 'GREEN' | 'YELLOW' | 'RED'
}

type BackendMessage =
  | { type: 'snapshot'; m5: MarketSnapshot; m15: MarketSnapshot; finalState: 'GREEN' | 'YELLOW' | 'RED' }
  | { type: 'status';   status: string; message: string }
  | { type: 'error';    message: string }

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export function useMarketData(): {
  data:   FinalMarketView | null
  status: ConnectionStatus
} {
  const [data,   setData]   = useState<FinalMarketView | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const wsRef               = useRef<WebSocket | null>(null)
  const stoppedRef          = useRef(false)

  useEffect(() => {
    stoppedRef.current = false

    function connect() {
      if (stoppedRef.current) return

      console.log('[useMarketData] Conectando al backend...')
      setStatus('connecting')

      const ws = new WebSocket(BACKEND_WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[useMarketData] Backend conectado ✓')
        setStatus('connected')
      }

      ws.onmessage = (event: MessageEvent) => {
        let msg: BackendMessage
        try {
          msg = JSON.parse(event.data as string)
        } catch {
          return
        }

        if (msg.type === 'snapshot') {
          setData({
            m5:         msg.m5,
            m15:        msg.m15,
            finalState: msg.finalState,
          })
        }

        if (msg.type === 'status') {
          console.log(`[useMarketData] Backend status: ${msg.message}`)
          if (msg.status === 'disconnected') setStatus('disconnected')
          if (msg.status === 'connected')    setStatus('connected')
        }
      }

      ws.onerror = () => {
        console.error('[useMarketData] Error de conexión con backend')
        setStatus('disconnected')
      }

      ws.onclose = () => {
        console.log('[useMarketData] Backend desconectado — reintentando...')
        setStatus('disconnected')
        if (!stoppedRef.current) {
          setTimeout(connect, RECONNECT_MS)
        }
      }
    }

    connect()

    return () => {
      stoppedRef.current = true
      wsRef.current?.close()
    }
  }, [])

  return { data, status }
}
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
import { WS_URL } from '@/config/env'

// ─── ⚙️ CONFIGURACIÓN ────────────────────────────────────────────────────────

const BACKEND_WS_URL  = WS_URL
const RECONNECT_MS    = 3_000

// ─────────────────────────────────────────────────────────────────────────────

export type FinalMarketView = {
  symbol:           string
  m5:               MarketSnapshot
  m15:              MarketSnapshot
  finalState:       'GREEN' | 'YELLOW' | 'RED'
  fusedState:       'GREEN' | 'YELLOW' | 'RED'
  triggerState?:    'reposo' | 'estirando' | 'giro'
  lastClosedElasticityM5?: number | null
  prevClosedElasticityM5?: number | null
  fusedExplanation: string
  fusedComparison:  any
  backtest:         any
  experimental?: {
    m5:               MarketSnapshot & { direction: 'BUY' | 'SELL' }
    m15:              MarketSnapshot & { direction: 'BUY' | 'SELL' }
    finalState:       'GREEN' | 'YELLOW' | 'RED'
    fusedState:       'GREEN' | 'YELLOW' | 'RED'
    triggerState:     'reposo' | 'estirando' | 'giro'
    pedestrianLight:  'STOP' | 'WALK'
    fusedExplanation: string
    fusedComparison:  any
    backtest:         any
  }
}

export type MultiSymbolMarketData = {
  [symbol: string]: FinalMarketView
}

export type ApiKeyAssignment = {
  symbol: string
  activeKeyMasked: string
  status: 'active' | 'shared' | 'exhausted'
  requestsCount: number
  minutelyRate: number
  minutelyMax: number
}

export type PoolKeyDetails = {
  index: number
  keyMasked: string
  status: 'active' | 'shared' | 'rate-limit' | 'daily-limit'
  requestsCount: number
  minutelyRate: number
  minutelyMax: number
  cooldownRemaining: number
  assignedSymbol: string | null
}

export type ApiKeysPoolStatus = {
  totalKeys: number
  exhaustedKeysCount: number
  allExhausted: boolean
  assignments: ApiKeyAssignment[]
  poolDetails?: PoolKeyDetails[]
  exhaustedKeys?: {
    keyMasked: string
    cooldownRemaining: number
  }[]
}

type BackendMessage =
  | {
      type:             'snapshot'
      symbol:           string
      m5:               MarketSnapshot
      m15:              MarketSnapshot
      finalState:       'GREEN' | 'YELLOW' | 'RED'
      fusedState:       'GREEN' | 'YELLOW' | 'RED'
      triggerState?:    'reposo' | 'estirando' | 'giro'
      lastClosedElasticityM5?: number | null
      prevClosedElasticityM5?: number | null
      fusedExplanation: string
      fusedComparison:  any
      backtest:         any
      experimental?: {
        m5:               MarketSnapshot & { direction: 'BUY' | 'SELL' }
        m15:              MarketSnapshot & { direction: 'BUY' | 'SELL' }
        finalState:       'GREEN' | 'YELLOW' | 'RED'
        fusedState:       'GREEN' | 'YELLOW' | 'RED'
        triggerState:     'reposo' | 'estirando' | 'giro'
        pedestrianLight:  'STOP' | 'WALK'
        fusedExplanation: string
        fusedComparison:  any
        backtest:         any
      }
    }
  | { type: 'status';    status: string; message: string }
  | { type: 'error';     message: string }
  | { type: 'ws-fallback'; symbol: string; reason: string }
  | {
      type: 'keys-status';
      totalKeys: number;
      exhaustedKeysCount: number;
      allExhausted: boolean;
      assignments: ApiKeyAssignment[];
      exhaustedKeys?: {
        keyMasked: string;
        cooldownRemaining: number;
      }[];
      poolDetails?: PoolKeyDetails[];
    }
  | {
      type: 'keys-exhausted-alert';
      symbol: string;
      message: string;
    }

/**
 * Registro de símbolos que fallaron el WS y usan REST Poller.
 * { [symbol]: reason }
 */
export type WsFallbackMap = { [symbol: string]: string }

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export function useMarketData(): {
  data:        MultiSymbolMarketData | null
  status:      ConnectionStatus
  wsFallbacks: WsFallbackMap
  keysStatus:  ApiKeysPoolStatus | null
  exhaustAlert: string | null
} {
  const [data,        setData]        = useState<MultiSymbolMarketData | null>(null)
  const [status,      setStatus]      = useState<ConnectionStatus>('connecting')
  const [wsFallbacks, setWsFallbacks] = useState<WsFallbackMap>({})
  const [keysStatus,  setKeysStatus]  = useState<ApiKeysPoolStatus | null>(null)
  const [exhaustAlert, setExhaustAlert] = useState<string | null>(null)
  const wsRef                         = useRef<WebSocket | null>(null)
  const stoppedRef                    = useRef(false)

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
          console.log(`[DEBUG] Snapshot recibido → ${msg.symbol} | M5: ${msg.m5?.state} | M15: ${msg.m15?.state} | Fused: ${msg.fusedState} | Trigger: ${msg.triggerState}`)
          setData(prev => ({
            ...prev,
            [msg.symbol]: {
              symbol:           msg.symbol,
              m5:               msg.m5,
              m15:              msg.m15,
              finalState:       msg.finalState,
              fusedState:       msg.fusedState,
              triggerState:     msg.triggerState,
              lastClosedElasticityM5: msg.lastClosedElasticityM5,
              prevClosedElasticityM5: msg.prevClosedElasticityM5,
              fusedExplanation: msg.fusedExplanation,
              fusedComparison:  msg.fusedComparison,
              backtest:         msg.backtest,
              experimental:     msg.experimental,
            }
          }))
        }

        if (msg.type === 'status') {
          console.log(`[useMarketData] Backend status: ${msg.message}`)
          if (msg.status === 'disconnected') setStatus('disconnected')
          if (msg.status === 'connected')    setStatus('connected')
        }

        if (msg.type === 'ws-fallback') {
          console.warn(`[useMarketData] ⚡ WS Fallback activado para ${msg.symbol}: ${msg.reason}`)
          setWsFallbacks(prev => ({ ...prev, [msg.symbol]: msg.reason }))
        }

        if (msg.type === 'keys-status') {
          setKeysStatus({
            totalKeys: msg.totalKeys,
            exhaustedKeysCount: msg.exhaustedKeysCount,
            allExhausted: msg.allExhausted,
            assignments: msg.assignments,
            exhaustedKeys: msg.exhaustedKeys,
            poolDetails: msg.poolDetails
          })
          if (!msg.allExhausted) {
            setExhaustAlert(null)
          }
        }

        if (msg.type === 'keys-exhausted-alert') {
          setExhaustAlert(msg.message)
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

  return { data, status, wsFallbacks, keysStatus, exhaustAlert }
}
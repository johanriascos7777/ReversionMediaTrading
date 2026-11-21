/**
 * TowerControl.tsx
 *
 * Torre de Control: historial de operaciones registradas.
 */

import { useTrades } from '../hooks/useTrades'
import type { CloseTradePayload, Trade } from '../hooks/useTrades'
import { TradeTable } from '../components/tower/TradeTable'

export function TowerControl() {
  const { trades, loading, closeTrade, updateTrade, deleteTrade } = useTrades()

  const handleCloseTrade  = async (id: number, payload: CloseTradePayload) => { await closeTrade(id, payload) }
  const handleUpdateTrade = async (id: number, payload: Partial<Trade>) => { await updateTrade(id, payload) }
  const handleDeleteTrade = async (id: number) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar esta operación del registro? Esta acción no se puede deshacer.')) {
      await deleteTrade(id)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 20% 0%, rgba(124,58,237,0.08) 0%, transparent 60%), #07070f',
      padding: '32px 24px',
      maxWidth: '100%',
      margin: '0 auto',
      fontFamily: '"Inter", system-ui, sans-serif',
    }}>
      <h1 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
        🗼 Torre de Control
      </h1>

      {loading && (
        <div style={{ textAlign: 'center', color: '#6b7280', padding: 40 }}>Cargando operaciones...</div>
      )}

      {!loading && (
        <TradeTable trades={trades} onClose={handleCloseTrade} onUpdate={handleUpdateTrade} onDelete={handleDeleteTrade} />
      )}
    </div>
  )
}

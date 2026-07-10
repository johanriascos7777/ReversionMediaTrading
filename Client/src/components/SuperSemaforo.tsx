/**
 * SuperSemaforo.tsx
 *
 * El centro neurálgico visual del motor experimental.
 * Reemplaza a `LaunchCockpit`, `SemaforoPeatonal`, `StructureCockpit` y `ConsolidationPanel`.
 * Muestra el estado del Gatillo por Agotamiento, la confluencia de la estructura,
 * y los escudos de bloqueo (Pullbacks y Compresión) en una interfaz consolidada.
 */

import type { FinalMarketView } from '../hooks/useMarketData'
import type { StructureData } from '../hooks/useStructureData'
import type { MultiSymbolConsolidation } from '../hooks/useMarketData'

type SuperSemaforoProps = {
  marketView: FinalMarketView | null
  structureData: StructureData[string] | null
  shieldData: MultiSymbolConsolidation[string] | null
}

export function SuperSemaforo({ marketView, structureData, shieldData }: SuperSemaforoProps) {
  // 1. Extraer datos del mercado
  const m5 = marketView?.m5
  const pedestrianLight = marketView?.pedestrianLight ?? 'STOP'
  const triggerState = marketView?.triggerState ?? 'reposo'
  const decaimiento = (marketView?.prevClosedElasticityM5 ?? 0) - (marketView?.lastClosedElasticityM5 ?? 0)
  
  // 2. Extraer datos del Structure Engine (M5)
  const structM5 = structureData?.m5
  const isCompression = structM5?.isCompressionSandwich ?? false
  const doublePattern = structM5?.doublePattern ?? 'none'
  const structureState = structM5?.structureState ?? 'WEAK'
  
  // 3. Extraer datos del Pullback Shield
  const isOpposedM5 = shieldData?.m5.detected && shieldData?.m5.alignment === 'opposed'
  const isOpposedM15 = shieldData?.m15.detected && shieldData?.m15.alignment === 'opposed'
  const isSuperStop = shieldData?.superSignal.type === 'SUPER_STOP'
  const isShieldBlocked = isOpposedM5 || isOpposedM15 || isSuperStop
  
  // Lógicas de visualización principal
  const isWalk = pedestrianLight === 'WALK'
  const isEstirando = triggerState === 'estirando'
  const direction = m5 && m5.price > m5.ema100 ? 'SELL' : 'BUY'
  
  // Determinar color principal
  let mainColor = '#374151' // Gris reposo
  let mainBg = 'rgba(255,255,255,0.02)'
  let shadow = 'none'
  let statusText = 'SISTEMA EN REPOSO'
  
  if (isWalk) {
    mainColor = '#10b981' // Verde fuerte
    mainBg = 'rgba(16,185,129,0.1)'
    shadow = '0 0 20px rgba(16,185,129,0.3)'
    statusText = `GATILLO CONFIRMADO: OPERAR ${direction}`
  } else if (isShieldBlocked || isCompression) {
    mainColor = '#ef4444' // Rojo
    mainBg = 'rgba(239,68,68,0.1)'
    shadow = '0 0 20px rgba(239,68,68,0.3)'
    statusText = 'BLOQUEADO POR ESCUDO O COMPRESIÓN'
  } else if (isEstirando) {
    mainColor = '#f59e0b' // Amarillo / Naranja
    mainBg = 'rgba(245,158,11,0.1)'
    shadow = '0 0 20px rgba(245,158,11,0.3)'
    statusText = 'TENSANDO: ESPERANDO GIRO'
  }

  return (
    <div style={{
      padding: '24px', borderRadius: 20,
      background: 'rgba(13,13,20,0.6)', border: `1px solid ${mainColor}40`,
      boxShadow: `inset 0 1px 1px rgba(255,255,255,0.02), ${shadow}`,
      fontFamily: '"Inter", system-ui, sans-serif',
      backdropFilter: 'blur(12px)',
      transition: 'all 0.4s ease-out',
      marginBottom: 24
    }}>
      {/* CABECERA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🚦</span> SÚPER SEMÁFORO
        </h2>
        <div style={{
          padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800,
          background: mainBg, color: mainColor, border: `1px solid ${mainColor}50`,
          textTransform: 'uppercase', letterSpacing: '0.5px'
        }}>
          {statusText}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
        
        {/* LUZ CENTRAL Y GATILLO */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '24px', background: 'rgba(0,0,0,0.2)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)'
        }}>
          {/* Círculo Principal */}
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: mainColor,
            boxShadow: `0 0 30px ${mainColor}, inset 0 0 10px rgba(255,255,255,0.5)`,
            animation: isEstirando ? 'pulse 2s infinite' : 'none',
            transition: 'all 0.5s ease',
            marginBottom: 20
          }} />
          
          {/* Tension de Gatillo */}
          <div style={{ width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Tensión M5 (Agotamiento)</div>
            <div style={{
              height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.05)', overflow: 'hidden', position: 'relative'
            }}>
              <div style={{
                height: '100%', width: m5 ? `${Math.min(100, (m5.elasticity / 3.5) * 100)}%` : '0%',
                background: mainColor, transition: 'all 0.4s ease'
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginTop: 6, fontFamily: 'monospace' }}>
              <span>Val: {m5?.elasticity.toFixed(2) ?? '—'}</span>
              {isWalk && <span style={{ color: '#10b981', fontWeight: 800 }}>GIRO -{decaimiento.toFixed(2)}</span>}
            </div>
          </div>
        </div>

        {/* PANELES DE ESTADO (ESCUDOS Y CONFLUENCIA) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Escudos de Bloqueo */}
          <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px' }}>
              🛡️ Escudos Activos
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ShieldItem active={isCompression} label="Filtro Sándwich (EMA50-100)" activeColor="#ef4444" inactiveColor="#10b981" activeText="COMPRESIÓN DETECTADA" />
              <ShieldItem active={isShieldBlocked && !isCompression} label="Pullback Shield" activeColor="#ef4444" inactiveColor="#10b981" activeText="TENDENCIA OPUESTA" />
            </div>
          </div>

          {/* Confluencia de Estructura */}
          <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px' }}>
              🏛️ Motor de Estructura (M5)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Fuerza de Confluencia:</span>
                <span style={{ color: structureState === 'STRONG' ? '#10b981' : structureState === 'MODERATE' ? '#eab308' : '#9ca3af', fontWeight: 800 }}>{structureState}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Doble Techo/Piso:</span>
                <span style={{ color: doublePattern !== 'none' ? '#3b82f6' : '#6b7280', fontWeight: 700 }}>
                  {doublePattern === 'double_top' ? 'DOBLE TECHO' : doublePattern === 'double_bottom' ? 'DOBLE PISO' : 'NO DETECTADO'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, fontStyle: 'italic', lineHeight: 1.4 }}>
                {structM5?.explanation ?? 'Esperando datos de estructura...'}
              </div>
            </div>
          </div>

        </div>
      </div>
      
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; box-shadow: 0 0 40px #f59e0b; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function ShieldItem({ active, label, activeColor, inactiveColor, activeText }: { active: boolean, label: string, activeColor: string, inactiveColor: string, activeText: string }) {
  const color = active ? activeColor : inactiveColor
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#d1d5db' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
        {label}
      </div>
      <div style={{ fontSize: 10, fontWeight: 800, color, padding: '2px 6px', background: `${color}20`, borderRadius: 4 }}>
        {active ? activeText : 'DESPEJADO'}
      </div>
    </div>
  )
}

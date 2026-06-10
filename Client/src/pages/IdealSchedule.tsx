import { useState, useEffect } from 'react'

interface SessionDetail {
  id: string
  name: string
  hours: string
  probability: number
  bestStrategy: 'Semáforo Viejo' | 'Full Reversion' | 'Ambos Fusión' | 'Prohibido Operar'
  bestStrategyDesc: string
  recommendedPairs: string[]
  description: string
  complementarity: string
  rules: string[]
  icon: string
  color: string
  glowColor: string
}

export function IdealSchedule() {
  const [selectedSessionId, setSelectedSessionId] = useState('golden')
  const [currentTime, setCurrentTime] = useState(new Date())

  // Actualizar la hora cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Hora de Colombia (COT)
  const getCOTTime = () => {
    try {
      const bogotaStr = new Date().toLocaleString("en-US", { timeZone: "America/Bogota" })
      return new Date(bogotaStr)
    } catch (e) {
      const utc = new Date().getTime() + (new Date().getTimezoneOffset() * 60000)
      return new Date(utc + (3600000 * -5))
    }
  }

  const cot = getCOTTime()
  const currentHour = cot.getHours()
  const currentMinute = cot.getMinutes()
  const day = cot.getDay()
  const isWeekday = day >= 1 && day <= 5
  const isSunday = day === 0

  // Definir las sesiones del mercado basadas en la estrategia
  const sessions: SessionDetail[] = [
    {
      id: 'golden',
      name: 'Solapamiento de Oro (Londres/NY)',
      hours: '7:00 AM – 11:00 AM COT',
      probability: 95,
      bestStrategy: 'Full Reversion',
      bestStrategyDesc: 'El motor Full Reversion brilla en este horario. Al cruzar las dos sesiones de mayor volumen, el precio respeta las confluencias estructurales y el filtro de pendiente de la EMA100 te protege de rompimientos directos.',
      recommendedPairs: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD'],
      description: 'El pico del volumen mundial. Los spreads están en mínimos históricos del broker y el mercado presenta tendencias limpias y rápidas. Las reversiones ocurren con precisión matemática al retorno de la media.',
      complementarity: 'Mientras el Semáforo Viejo puede entrar prematuramente si el volumen acelera, Full Reversion espera el "Giro de Vela M5" y filtra pendientes inclinadas (STEEP), actuando como el escudo perfecto en este horario de alta velocidad.',
      rules: [
        'Confirmar divergencia de RSI de fuerza >= 3',
        'Verificar que el soporte o resistencia más cercano esté a menos de 0.5 ATR',
        'Asegurarse de que el estado de pendiente sea FLAT o GENTLE'
      ],
      icon: '👑',
      color: '#fbbf24',
      glowColor: 'rgba(251, 191, 36, 0.4)'
    },
    {
      id: 'asia',
      name: 'Sesión Asiática (Lateral & Rangos)',
      hours: '7:00 PM – 2:00 AM COT',
      probability: 90,
      bestStrategy: 'Semáforo Viejo',
      bestStrategyDesc: 'Es el territorio rey del Semáforo Viejo. Al ser una sesión de bajo momentum tendencial, el precio tiende a oscilar de forma predecible en canales de consolidación lateral, lo que permite al indicador antiguo exprimir múltiples rebotes.',
      recommendedPairs: ['USD/JPY', 'AUD/USD', 'NZD/USD', 'AUD/JPY'],
      description: 'Sesión caracterizada por movimientos pausados. El precio raramente forma tendencias verticales y suele respetar los extremos de desviación típicos del Semáforo, convirtiendo el mercado en una máquina de reversiones laterales.',
      complementarity: 'Full Reversion puede tardar en disparar señales debido a sus exigentes confluencias de giro y soporte. En cambio, el Semáforo Viejo actúa rápido en los extremos del rango, resultando sumamente rentable en la quietud asiática.',
      rules: [
        'Operar principalmente pares con JPY, AUD y NZD',
        'Validar soporte y resistencia del rango lateral',
        'Evitar operar pares con EUR o GBP ya que quedan congelados sin volumen'
      ],
      icon: '🏮',
      color: '#38bdf8',
      glowColor: 'rgba(56, 189, 248, 0.4)'
    },
    {
      id: 'london',
      name: 'Apertura Europea / Londres',
      hours: '2:00 AM – 7:00 AM COT',
      probability: 85,
      bestStrategy: 'Ambos Fusión',
      bestStrategyDesc: 'La inyección de capital europeo crea movimientos rápidos. Usar ambos indicadores coordinados te da lo mejor de dos mundos: entradas de rango rápidas del Semáforo y protección contra tendencias de Full Reversion.',
      recommendedPairs: ['EUR/USD', 'GBP/USD', 'EUR/GBP', 'GBP/JPY'],
      description: 'El mercado de divisas despierta con fuerza. Los spreads colapsan a mínimos, pero los primeros 15-30 minutos pueden presentar latigazos bruscos para barrer stops.',
      complementarity: 'El Semáforo Viejo detecta la desviación inicial de la apertura de Londres. Si el impulso continúa y amenaza con ser una tendencia real, Full Reversion lo califica como STEEP bloqueando las entradas, protegiendo tus ganancias previas.',
      rules: [
        'Esperar de 15 a 20 minutos después de la apertura (2:00 AM) para evitar barridos de spread',
        'Buscar alineación M5 + M15 antes de entrar',
        'Monitorear noticias de la Libra (GBP) y el Euro (EUR) al inicio de la sesión'
      ],
      icon: '☀️',
      color: '#10b981',
      glowColor: 'rgba(16, 185, 129, 0.4)'
    },
    {
      id: 'ny_afternoon',
      name: 'Tarde Americana (Distribución)',
      hours: '11:00 AM – 4:00 PM COT',
      probability: 70,
      bestStrategy: 'Ambos Fusión',
      bestStrategyDesc: 'El volumen decrece progresivamente. Es ideal buscar entradas con confirmaciones mutuas (cuando tanto el Semáforo Viejo como Full Reversion detectan el agotamiento en conjunto).',
      recommendedPairs: ['EUR/USD', 'USD/CAD', 'USD/JPY'],
      description: 'Londres cierra a las 11:00 AM COT y Nueva York queda sola. El mercado reduce su velocidad y suele realizar movimientos lentos o consolidaciones secundarias.',
      complementarity: 'Al haber menos volumen, el precio puede tardar en volver a la EMA100. Full Reversion calcula el Take Profit dinámico para asegurar salidas rápidas, mientras el Semáforo Viejo ayuda a refinar el punto exacto de giro.',
      rules: [
        'Reducir el lotaje un 25% debido al menor volumen de la tarde',
        'Tener paciencia con el tiempo de retorno a la media (puede tardar más de 30 bar)',
        'Evitar operar después de las 3:30 PM COT'
      ],
      icon: '🦅',
      color: '#a78bfa',
      glowColor: 'rgba(167, 139, 250, 0.4)'
    },
    {
      id: 'rollover',
      name: 'Rollover Diario & Sunday Open',
      hours: '4:45 PM – 6:15 PM COT / Domingos 4-7 PM',
      probability: 0,
      bestStrategy: 'Prohibido Operar',
      bestStrategyDesc: 'Riesgo extremo e inoperable. Ningún análisis matemático ni indicador es válido cuando los spreads de los brokers se abren artificialmente a causa del cierre diario interbancario.',
      recommendedPairs: ['Ninguno - Mantenerse Fuera'],
      description: 'El fin del día de Forex (5 PM COT) drena toda la liquidez global. Los bancos liquidan órdenes y los spreads escalan exponencialmente. Los domingos por la tarde el mercado abre con Gaps erráticos.',
      complementarity: 'Tanto el Semáforo Viejo como Full Reversion pueden detectar desviaciones gigantescas y lanzar alertas en verde. ¡Son trampas del spread! El precio en el broker parece estirado pero es solo el costo del spread ampliado.',
      rules: [
        'Cerrar cualquier operación abierta antes de las 4:30 PM COT',
        'Desactivar alertas de Telegram o ignorarlas de 4:45 PM a 6:15 PM COT',
        'No operar los domingos por la tarde hasta que abra Tokio (7:00 PM COT)'
      ],
      icon: '🛑',
      color: '#f43f5e',
      glowColor: 'rgba(244, 63, 94, 0.4)'
    }
  ]

  // Detectar la sesión actual en vivo
  const getLiveSessionId = () => {
    const isWk = day >= 1 && day <= 5
    const isSun = day === 0
    const minutes = currentHour * 60 + currentMinute

    if (isWk && (minutes >= 1005 && minutes <= 1095)) return 'rollover' // Rollover
    if (isSun && (currentHour >= 16 && currentHour < 19)) return 'rollover' // Sunday Open
    if (isWk && (currentHour >= 7 && currentHour < 11)) return 'golden'
    if (isWk && (currentHour >= 2 && currentHour < 16)) {
      if (currentHour >= 11) return 'ny_afternoon'
      return 'london'
    }
    if (isWk && (currentHour >= 19 || currentHour < 2)) return 'asia'
    return 'asia' // Fallback a asia / fin de semana
  }

  const liveSessionId = getLiveSessionId()
  const liveSession = sessions.find(s => s.id === liveSessionId) || sessions[0]

  const activeSession = sessions.find(s => s.id === selectedSessionId) || sessions[0]

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(251,191,36,0.04) 0%, transparent 60%), #07070f',
      padding: '40px 24px',
      color: '#fff',
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    }}>
      {/* Animaciones CSS personalizadas */}
      <style>{`
        @keyframes border-glow {
          0% { box-shadow: 0 0 10px rgba(251, 191, 36, 0.1); }
          50% { box-shadow: 0 0 25px rgba(251, 191, 36, 0.35); }
          100% { box-shadow: 0 0 10px rgba(251, 191, 36, 0.1); }
        }
        .glow-button {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .glow-button:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.15) !important;
        }
        .session-tab {
          transition: all 0.2s ease;
        }
        .gauge-pulse {
          animation: border-glow 2s infinite alternate;
        }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* ── HEADER ────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 32 }}>🎯</span>
            <div>
              <h1 style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 900,
                letterSpacing: '-0.5px',
                background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                CENTRO DE PLANIFICACIÓN: HORARIO IDEAL
              </h1>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#9ca3af' }}>
                Combina dinámicamente tu estrategia rentable del Semáforo Viejo y la precisión del motor Full Reversion.
              </p>
            </div>
          </div>
        </div>

        {/* ── ALERTA EN VIVO DE ESTRATEGIA ACTUAL ───────────────────────────── */}
        <div className="gauge-pulse" style={{
          background: 'linear-gradient(135deg, rgba(15,15,25,0.85) 0%, rgba(5,5,10,0.98) 100%)',
          border: `1px solid ${liveSession.color}44`,
          borderRadius: 20,
          padding: '24px 32px',
          marginBottom: 36,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
          boxShadow: `0 0 20px ${liveSession.glowColor}22`
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{
                fontSize: 10,
                fontWeight: 800,
                background: `${liveSession.color}22`,
                color: liveSession.color,
                padding: '2px 8px',
                borderRadius: 12,
                border: `1px solid ${liveSession.color}44`,
                textTransform: 'uppercase'
              }}>
                SESIÓN ACTUAL EN COLOMBIA
              </span>
              <span style={{ color: '#4b5563', fontSize: 12 }}>•</span>
              <span style={{ color: '#9ca3af', fontSize: 12, fontFamily: 'monospace' }}>
                {cot.toLocaleTimeString("es-CO", { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })} COT
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#fff' }}>
              {liveSession.icon} {liveSession.name}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#d1d5db' }}>
              Recomendación en vivo: <strong style={{ color: liveSession.color }}>{liveSession.bestStrategy}</strong> — {liveSession.recommendedPairs.join(', ')}
            </p>
          </div>

          <button 
            onClick={() => setSelectedSessionId(liveSession.id)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${liveSession.color}66`,
              color: '#fff',
              borderRadius: 12,
              padding: '12px 20px',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: `0 0 15px ${liveSession.glowColor}11`,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${liveSession.color}22`
              e.currentTarget.style.transform = 'scale(1.03)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            Ver Análisis de Sesión Actual 🔍
          </button>
        </div>

        {/* ── CUERPO PRINCIPAL: SELECCIÓN DE SESIÓN Y VISTA DETALLADA ───────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 32, alignItems: 'start' }}>

          {/* COLUMNA IZQUIERDA: SELECTOR DE SESIONES */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#9ca3af', margin: '0 0 4px 4px', fontWeight: 800 }}>
              Selecciona una Franja Horaria
            </h3>

            {sessions.map((session) => {
              const isSelected = session.id === selectedSessionId
              const isLive = session.id === liveSessionId
              return (
                <div
                  key={session.id}
                  onClick={() => setSelectedSessionId(session.id)}
                  className="session-tab"
                  style={{
                    background: isSelected 
                      ? `linear-gradient(135deg, rgba(15,15,30,0.9) 0%, rgba(10,10,20,0.95) 100%)` 
                      : 'rgba(15,15,25,0.4)',
                    border: isSelected 
                      ? `1px solid ${session.color}` 
                      : '1px solid rgba(255,255,255,0.04)',
                    borderRadius: 16,
                    padding: '18px 20px',
                    cursor: 'pointer',
                    position: 'relative',
                    boxShadow: isSelected ? `0 8px 25px ${session.glowColor}15` : 'none',
                    transform: isSelected ? 'translateX(4px)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
                      e.currentTarget.style.background = 'rgba(15,15,25,0.6)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'
                      e.currentTarget.style.background = 'rgba(15,15,25,0.4)'
                    }
                  }}
                >
                  {isLive && (
                    <span style={{
                      position: 'absolute',
                      top: 12, right: 12,
                      fontSize: 8,
                      fontWeight: 900,
                      background: '#10b981',
                      color: '#fff',
                      padding: '2px 6px',
                      borderRadius: 6,
                      animation: 'pulse-glow 1s infinite alternate'
                    }}>
                      EN VIVO
                    </span>
                  )}
                  
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <span style={{ fontSize: 24 }}>{session.icon}</span>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: isSelected ? '#fff' : '#d1d5db' }}>
                        {session.name}
                      </h4>
                      <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#9ca3af', fontFamily: 'monospace' }}>
                        {session.hours}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* COLUMNA DERECHA: DASHBOARD DE ANALISIS DE LA SESIÓN SELECCIONADA */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(10,10,20,0.8) 0%, rgba(5,5,10,0.98) 100%)',
            border: `1px solid ${activeSession.color}33`,
            borderRadius: 24,
            padding: '36px',
            boxShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 30px ${activeSession.glowColor}08`,
            backdropFilter: 'blur(16px)',
            position: 'relative'
          }}>
            
            {/* Cabecera del Panel Detalle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 26 }}>{activeSession.icon}</span>
                  <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#fff' }}>
                    {activeSession.name}
                  </h3>
                </div>
                <span style={{ fontSize: 13, color: '#9ca3af', fontFamily: 'monospace', fontWeight: 600 }}>
                  ⏰ Ventana horaria: {activeSession.hours}
                </span>
              </div>

              {/* GAUGE DE PROBABILIDAD DE EXITO */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(255,255,255,0.02)', padding: '10px 18px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.04)' }}>
                {/* SVG Radial Gauge */}
                <div style={{ position: 'relative', width: 44, height: 44 }}>
                  <svg width="44" height="44" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="rgba(255,255,255,0.05)"
                      strokeWidth="3.5"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke={activeSession.color}
                      strokeWidth="3.5"
                      strokeDasharray={`${activeSession.probability}, 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    fontSize: 10, fontWeight: 900, fontFamily: 'monospace', color: '#fff'
                  }}>
                    {activeSession.probability}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Efectividad
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: activeSession.color }}>
                    {activeSession.probability >= 85 ? '💎 Premium' : activeSession.probability >= 70 ? '🟢 Altamente Confiable' : '🛑 Alto Riesgo'}
                  </div>
                </div>
              </div>
            </div>

            {/* Fila: Descripción General */}
            <p style={{ margin: '0 0 28px', fontSize: 13.5, color: '#d1d5db', lineHeight: 1.6 }}>
              {activeSession.description}
            </p>

            {/* SECCIÓN ESTRATEGIA RECOMENDADA */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.01) 0%, rgba(255,255,255,0.03) 100%)',
              border: `1px solid ${activeSession.color}33`,
              borderRadius: 18,
              padding: '24px',
              marginBottom: 28,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 950,
                  background: activeSession.color,
                  color: '#000',
                  padding: '3px 10px',
                  borderRadius: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Indicador Recomendado: {activeSession.bestStrategy}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#e5e7eb', lineHeight: 1.6 }}>
                {activeSession.bestStrategyDesc}
              </p>
            </div>

            {/* FILA DE DETALLES: COMPLEMENTARIEDAD Y PARES */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24, marginBottom: 28 }}>
              
              {/* Bloque: Cómo se complementan */}
              <div style={{
                background: 'rgba(5,5,10,0.4)',
                border: '1px solid rgba(255,255,255,0.03)',
                borderRadius: 16,
                padding: '20px',
              }}>
                <h4 style={{ margin: '0 0 8px', fontSize: 12, color: '#9ca3af', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  🤝 Cómo se complementan
                </h4>
                <p style={{ margin: 0, fontSize: 12, color: '#d1d5db', lineHeight: 1.6 }}>
                  {activeSession.complementarity}
                </p>
              </div>

              {/* Bloque: Pares Óptimos */}
              <div style={{
                background: 'rgba(5,5,10,0.4)',
                border: '1px solid rgba(255,255,255,0.03)',
                borderRadius: 16,
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <h4 style={{ margin: '0 0 10px', fontSize: 12, color: '#9ca3af', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                    💱 Pares Óptimos
                  </h4>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {activeSession.recommendedPairs.map((pair) => (
                      <span key={pair} style={{
                        fontSize: 11,
                        fontWeight: 700,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#fff',
                        padding: '4px 10px',
                        borderRadius: 8,
                        fontFamily: 'monospace'
                      }}>
                        {pair}
                      </span>
                    ))}
                  </div>
                </div>
                
                {activeSession.probability > 0 && (
                  <p style={{ margin: '12px 0 0', fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>
                    * Evita pares sin volumen del mercado local en curso.
                  </p>
                )}
              </div>

            </div>

            {/* SECCIÓN REGLAS TÁCTICAS */}
            <div>
              <h4 style={{ margin: '0 0 12px', fontSize: 12, color: '#9ca3af', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                📋 Lista de Verificación Táctica (Checklist)
              </h4>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, color: '#d1d5db', lineHeight: 1.7 }}>
                {activeSession.rules.map((rule, idx) => (
                  <li key={idx} style={{ marginBottom: 6 }}>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>

          </div>

        </div>

        {/* ── NOTA DE RENTABILIDAD DEL TRADER ──────────────────────────────── */}
        <div className="premium-card" style={{
          background: 'linear-gradient(135deg, rgba(251,191,36,0.03) 0%, rgba(15,15,25,0.7) 100%)',
          border: '1px solid rgba(251,191,36,0.12)',
          borderRadius: 20,
          padding: '28px 32px',
          marginTop: 36,
          display: 'flex',
          gap: 20,
          alignItems: 'center'
        }}>
          <span style={{ fontSize: 32 }}>💰</span>
          <div>
            <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800, color: '#fff' }}>
              La clave de la Rentabilidad Consistente
            </h4>
            <p style={{ margin: 0, fontSize: 13, color: '#9ca3af', lineHeight: 1.6 }}>
              Tu **Semáforo Viejo** ha demostrado ser altamente rentable gracias a su reactividad inmediata en rangos estables. El propósito del nuevo módulo **Full Reversion** no es reemplazarlo, sino servir de filtro inteligente para las ventanas del día de alta velocidad (como Londres y NY). Alternar las estrategias y saber qué indicador lidera según el reloj de sesiones maximizará tu rendimiento y resguardará tu capital frente a rachas de tendencia.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}

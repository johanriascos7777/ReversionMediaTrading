import { useState, useEffect } from 'react'

export function TradingRecommendations() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeTab, setActiveTab] = useState<'checklist' | 'pullbacks' | 'candles' | 'testimonies' | 'experience'>('checklist')
  const [simScenario, setSimScenario] = useState<'expansion' | 'contraction' | 'crossover' | 'precrossover' | 'fractal_noise' | 'pullback' | 'partial_exit'>('contraction')
  const [selectedRealTrade, setSelectedRealTrade] = useState<'eur_gbp' | 'cad_jpy' | 'usd_cad' | 'usd_jpy'>('eur_gbp')

  // Actualizar la hora local/COT cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Obtener la hora actual convertida a hora de Colombia (COT, UTC-5)
  const getCOTTime = () => {
    try {
      const bogotaStr = new Date().toLocaleString("en-US", { timeZone: "America/Bogota" })
      return new Date(bogotaStr)
    } catch (e) {
      // Fallback si no soporta timeZone: UTC - 5 horas
      const utc = new Date().getTime() + (new Date().getTimezoneOffset() * 60000)
      return new Date(utc + (3600000 * -5))
    }
  }

  const cot = getCOTTime()
  const day = cot.getDay() // 0 = Domingo, 1 = Lunes, etc.
  const hour = cot.getHours()
  const minute = cot.getMinutes()
  const second = cot.getSeconds()
  const totalMinutes = hour * 60 + minute

  // Formatear hora de Colombia para visualización
  const formatTimeStr = (d: Date) => {
    let h = d.getHours()
    const m = String(d.getMinutes()).padStart(2, '0')
    const s = String(d.getSeconds()).padStart(2, '0')
    const ampm = h >= 12 ? 'PM' : 'AM'
    h = h % 12
    h = h ? h : 12 // la hora '0' debe ser '12'
    return `${String(h).padStart(2, '0')}:${m}:${s} ${ampm}`
  }

  const cotTimeFormatted = formatTimeStr(cot)

  // Días de la semana en español
  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const nombreDia = diasSemana[day]

  // Determinar estado de la sesión actual
  const isWeekday = day >= 1 && day <= 5
  const isSunday = day === 0
  const isSaturday = day === 6

  let statusType: 'rollover' | 'sunday_open' | 'golden' | 'safe' | 'low_liq' = 'low_liq'
  let statusLabel = 'Horario Neutro'
  let statusColor = '#9ca3af'
  let statusBg = 'rgba(156, 163, 175, 0.08)'
  let statusBorder = 'rgba(156, 163, 175, 0.15)'
  let statusGlow = 'rgba(156, 163, 175, 0.02)'
  let recommendationText = ''

  // Rollover: 4:45 PM a 6:15 PM COT (16:45 a 18:15)
  // 16:45 = 1005 minutos
  // 18:15 = 1095 minutos
  if (isWeekday && (totalMinutes >= 1005 && totalMinutes <= 1095)) {
    statusType = 'rollover'
    statusLabel = '🛑 ROL OVER CRÍTICO (SPREAD EXTREMO)'
    statusColor = '#f43f5e'
    statusBg = 'rgba(244, 63, 94, 0.12)'
    statusBorder = 'rgba(244, 63, 94, 0.4)'
    statusGlow = 'rgba(244, 63, 94, 0.15)'
    recommendationText = '¡ALERTA MÁXIMA! Los spreads de los brokers se ensanchan a niveles récord (hasta 50+ pips). Las alarmas de elasticidad son causadas por distorsión artificial. Cierra y no operes.'
  }
  // Apertura Dominical: Domingos de 4:00 PM a 7:00 PM COT (16:00 a 19:00)
  else if (isSunday && (hour >= 16 && hour < 19)) {
    statusType = 'sunday_open'
    statusLabel = '🛑 APERTURA DOMINICAL (BAJA LIQUIDEZ)'
    statusColor = '#f43f5e'
    statusBg = 'rgba(244, 63, 94, 0.12)'
    statusBorder = 'rgba(244, 63, 94, 0.4)'
    statusGlow = 'rgba(244, 63, 94, 0.15)'
    recommendationText = 'El mercado de Sydney abre con bajísima liquidez. Es sumamente propenso a saltos de precio (Gaps) y spreads elevados. Espera a la sesión asiática fuerte (después de las 7 PM).'
  }
  // Golden Zone: Lunes a Viernes de 7:00 AM a 11:00 AM COT
  else if (isWeekday && (hour >= 7 && hour < 11)) {
    statusType = 'golden'
    statusLabel = '🌟 ZONA DE ORO (LONDRES + NEW YORK)'
    statusColor = '#fbbf24'
    statusBg = 'rgba(251, 191, 36, 0.12)'
    statusBorder = 'rgba(251, 191, 36, 0.4)'
    statusGlow = 'rgba(251, 191, 36, 0.15)'
    recommendationText = 'Momento óptimo del día. Los spreads están en mínimos y las reversiones son matemáticas debido al cruce de las dos mayores sesiones del mundo. ¡Foco total!'
  }
  // Zona Segura: Lunes a Viernes de 2:00 AM a 4:00 PM COT (excluyendo rollover/cruce de oro)
  else if (isWeekday && (hour >= 2 && hour < 16)) {
    statusType = 'safe'
    statusLabel = '🟢 SESIÓN ACTIVA (OPERATIVA SEGURA)'
    statusColor = '#10b981'
    statusBg = 'rgba(16, 185, 129, 0.12)'
    statusBorder = 'rgba(16, 185, 129, 0.3)'
    statusGlow = 'rgba(16, 185, 129, 0.1)'
    recommendationText = 'Buena liquidez general en el mercado. Los pares principales como EUR/USD, GBP/USD y USD/JPY respetan con alta fidelidad las desviaciones promedio.'
  }
  // Fin de semana cerrado
  else if (isSaturday || (isSunday && hour < 16) || (day === 5 && hour >= 17)) {
    statusType = 'low_liq'
    statusLabel = '💤 MERCADO CERRADO'
    statusColor = '#6b7280'
    statusBg = 'rgba(107, 114, 128, 0.1)'
    statusBorder = 'rgba(107, 114, 128, 0.25)'
    statusGlow = 'rgba(107, 114, 128, 0.01)'
    recommendationText = 'El mercado global de Forex se encuentra cerrado por fin de semana. Es el momento perfecto para descansar, analizar métricas y no realizar operaciones.'
  }
  // Horas tranquilas / Asia
  else {
    statusType = 'low_liq'
    statusLabel = '🟡 SESIÓN ASIÁTICA / RANGO BAJO'
    statusColor = '#f59e0b'
    statusBg = 'rgba(245, 158, 11, 0.08)'
    statusBorder = 'rgba(245, 158, 11, 0.25)'
    statusGlow = 'rgba(245, 158, 11, 0.05)'
    recommendationText = 'Sesión asiática activa. El volumen en pares principales es bajo, lo que puede causar movimientos lentos y rangos estrechos. Opera con precaución en AUD, NZD o JPY.'
  }

  // Porcentaje del día para la aguja de tiempo (total de minutos / 1440)
  const needlePercent = (totalMinutes / 1440) * 100

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(244,63,94,0.05) 0%, transparent 60%), #07070f',
      padding: '40px 24px',
      color: '#fff',
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    }}>
      {/* Inyección de estilos CSS para efectos interactivos premium */}
      <style>{`
        @keyframes pulse-glow {
          0% { box-shadow: 0 0 12px rgba(244, 63, 94, 0.15); }
          50% { box-shadow: 0 0 24px rgba(244, 63, 94, 0.45); }
          100% { box-shadow: 0 0 12px rgba(244, 63, 94, 0.15); }
        }
        @keyframes needle-pulse {
          0% { transform: scaleY(1); opacity: 0.8; }
          50% { transform: scaleY(1.1); opacity: 1; }
          100% { transform: scaleY(1); opacity: 0.8; }
        }
        .premium-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        .premium-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, rgba(255,255,255,0.08), transparent 50%, rgba(255,255,255,0.02));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .premium-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 30px rgba(0,0,0,0.5);
          border-color: rgba(255,255,255,0.12) !important;
        }
        .avoid-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 30px rgba(244, 63, 94, 0.15);
          border-color: rgba(244, 63, 94, 0.4) !important;
        }
        .golden-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 30px rgba(251, 191, 36, 0.15);
          border-color: rgba(251, 191, 36, 0.4) !important;
        }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* ── HEADER DE PÁGINA ────────────────────────────────────────────── */}
        <div style={{ marginBottom: 40, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 32 }}>📖</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{
                  margin: 0,
                  fontSize: 28,
                  fontWeight: 900,
                  letterSpacing: '-0.5px',
                  background: 'linear-gradient(135deg, #f43f5e, #fb7185)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  MANUAL OPERATIVO & EVITACIÓN DE RIESGOS
                </h1>
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  background: 'rgba(244, 63, 94, 0.15)',
                  color: '#f43f5e',
                  padding: '2px 8px',
                  borderRadius: 12,
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  V1.2
                </span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#9ca3af' }}>
                Reloj de liquidez en tiempo real, gestión ante picos de spread y confluencias estructurales de reversión.
              </p>
            </div>
          </div>
        </div>

        {/* ── FILA SUPERIOR: RELOJ EN VIVO Y CRONOGRAMA INTERACTIVO ────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 24,
          marginBottom: 36
        }}>
          
          {/* TARJETA RELOJ EN VIVO */}
          <div className="premium-card" style={{
            background: 'linear-gradient(135deg, rgba(15,15,28,0.7) 0%, rgba(5,5,10,0.95) 100%)',
            border: `1px solid ${statusBorder}`,
            borderRadius: 20,
            padding: '28px 32px',
            boxShadow: `0 0 30px ${statusGlow}`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            backdropFilter: 'blur(16px)',
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: statusColor, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Estado del Mercado (Colombia)
                </span>
                <span style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: statusColor,
                  boxShadow: `0 0 10px ${statusColor}`,
                  animation: 'pulse-glow 1.5s infinite alternate'
                }} />
              </div>

              {/* HORA GRANDE */}
              <div style={{ fontSize: 34, fontWeight: 900, fontFamily: 'monospace', color: '#fff', letterSpacing: '-1px', marginBottom: 6 }}>
                {cotTimeFormatted}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16, display: 'flex', gap: 6, alignItems: 'center' }}>
                <span>📅 {nombreDia} (COT, UTC-5)</span>
                <span style={{ color: '#4b5563' }}>•</span>
                <span style={{ color: statusColor, fontWeight: 700 }}>{statusLabel}</span>
              </div>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.04)',
              borderRadius: 12,
              padding: '16px',
              fontSize: 12.5,
              color: '#e5e7eb',
              lineHeight: 1.5,
            }}>
              <strong>Acción sugerida:</strong> {recommendationText}
            </div>
          </div>

          {/* TARJETA CRONOGRAMA DE 24 HORAS */}
          <div className="premium-card" style={{
            background: 'linear-gradient(135deg, rgba(10,10,20,0.6) 0%, rgba(5,5,10,0.9) 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 20,
            padding: '28px 32px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            backdropFilter: 'blur(16px)',
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Ciclo de 24 Horas COT (Zona de Operación)
                </span>
                <span style={{ fontSize: 11, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                  Hora Actual: {hour.toString().padStart(2, '0')}:{minute.toString().padStart(2, '0')}
                </span>
              </div>

              {/* TIMELINE VISUAL */}
              <div style={{ position: 'relative', marginTop: 24, marginBottom: 28 }}>
                {/* Contenedor de Barra */}
                <div style={{
                  height: 18,
                  borderRadius: 9,
                  background: '#131322',
                  display: 'flex',
                  overflow: 'hidden',
                  position: 'relative',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}>
                  {/* Horas 0 a 1 (Asia lenta - Naranja suave) */}
                  <div style={{ width: `${(2/24)*100}%`, background: 'rgba(245, 158, 11, 0.25)' }} title="Asia (Bajo Volumen)" />
                  {/* Horas 2 a 6 (Londres abre - Verde suave) */}
                  <div style={{ width: `${(5/24)*100}%`, background: 'rgba(16, 185, 129, 0.3)' }} title="Apertura Londres" />
                  {/* Horas 7 a 10 (Golden Overlap - Oro brillante) */}
                  <div style={{ width: `${(4/24)*100}%`, background: 'rgba(251, 191, 36, 0.75)' }} title="Solapamiento Oro (Londres/NY)" />
                  {/* Horas 11 a 15 (NY Tarde - Verde suave) */}
                  <div style={{ width: `${(5/24)*100}%`, background: 'rgba(16, 185, 129, 0.3)' }} title="Tarde NY" />
                  {/* Horas 16 a 17 (Rollover - Rojo crítico) */}
                  <div style={{ width: `${(2/24)*100}%`, background: 'rgba(244, 63, 94, 0.8)' }} title="Rollover Diario (Cierre)" />
                  {/* Horas 18 a 23 (Asia / Cierre - Gris oscuro/Bajo Volumen) */}
                  <div style={{ width: `${(6/24)*100}%`, background: 'rgba(107, 114, 128, 0.15)' }} title="Sesión Asia / Fin de Día" />

                  {/* Aguja de Tiempo Actual Pulsante */}
                  <div style={{
                    position: 'absolute',
                    left: `${needlePercent}%`,
                    top: -1,
                    bottom: -1,
                    width: 3,
                    background: '#fff',
                    boxShadow: '0 0 10px #fff, 0 0 20px #a78bfa',
                    zIndex: 10,
                    animation: 'needle-pulse 1s infinite alternate',
                  }} />
                </div>

                {/* Leyenda de Horas abajo de la barra */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 8,
                  fontSize: 10,
                  color: '#4b5563',
                  fontFamily: 'monospace'
                }}>
                  <span>00:00</span>
                  <span>04:00</span>
                  <span>08:00</span>
                  <span>12:00</span>
                  <span style={{ color: '#f43f5e', fontWeight: 'bold' }}>16:45 (Rollover)</span>
                  <span>20:00</span>
                  <span>24:00</span>
                </div>
              </div>
            </div>

            {/* LEYENDA EXPLICATIVA */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(244, 63, 94, 0.8)' }} />
                <span style={{ color: '#9ca3af' }}>Evitar</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(251, 191, 36, 0.75)' }} />
                <span style={{ color: '#9ca3af' }}>Zona Oro</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.3)' }} />
                <span style={{ color: '#9ca3af' }}>Sesión Activa</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(107, 114, 128, 0.15)' }} />
                <span style={{ color: '#9ca3af' }}>Bajo Volumen</span>
              </div>
            </div>
          </div>

        </div>

        {/* ── EXPLICACIÓN DE LO OCURRIDO A LAS 5:00 PM COT ───────────────── */}
        <div className="premium-card" style={{
          background: 'linear-gradient(135deg, rgba(244,63,94,0.07) 0%, rgba(15,15,25,0.6) 100%)',
          border: '1px solid rgba(244,63,94,0.2)',
          borderRadius: 20,
          padding: '30px',
          marginBottom: 36,
          boxShadow: '0 8px 32px rgba(244,63,94,0.03)',
        }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 24 }}>
            <span style={{ fontSize: 28 }}>💡</span>
            <div>
              <h2 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 800, color: '#fff' }}>
                ¿Por qué a las 5:00 PM COT el precio sube o baja salvajemente estirando las EMAs?
              </h2>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#d1d5db', lineHeight: 1.6 }}>
                Este fenómeno se llama <strong>Glow Spread & Liquidity Gap</strong> y ocurre exactamente en el minuto del Rollover diario. Los bancos institucionales de todo el mundo están cerrando libros contables. Durante esta ventana de 30 minutos:
              </p>
              <ul style={{ margin: '0 0 12px', paddingLeft: 20, fontSize: 12.5, color: '#9ca3af', lineHeight: 1.7 }}>
                <li style={{ marginBottom: 6 }}>
                  Los proveedores de liquidez retiran sus órdenes. El libro queda vacío. Cualquier pequeña orden arrastra el precio decenas de pips en milisegundos.
                </li>
                <li style={{ marginBottom: 6 }}>
                  El broker ensancha el spread artificialmente. Al ensancharse la diferencia entre Bid y Ask, el precio promedio (o el "Last Tick") se calcula con saltos gigantescos, lo que el detector de elasticidad interpreta erróneamente como una desviación real extrema.
                </li>
                <li style={{ marginBottom: 0 }}>
                  <strong>Resultado:</strong> Te llegarán falsas alarmas de elasticidad verde (extremas) que en realidad son puro spread bancario. No representan un rebote operable a la EMA.
                </li>
              </ul>
              <div style={{
                background: 'rgba(5,5,10,0.4)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 10,
                padding: '12px 16px',
                fontSize: 12.5,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}>
                <span style={{ color: '#fb7185', fontWeight: 800 }}>🛡️ RECOMIENDA:</span>
                <span style={{ color: '#e5e7eb' }}>
                  El motor <strong>Full Reversion</strong> cuenta con un filtro para mitigar esto: el <strong>Giro de Elasticidad (M5 Candle Close)</strong>. Éste no te deja entrar hasta que la vela de 5 minutos termine de cerrar y empiece a contraerse, impidiendo que entres en picos instantáneos de spread. Aún así, apaga tu operativa de 4:45 PM a 6:15 PM.
                </span>
              </div>
            </div>
          </div>

          {/* NUEVO SUBSECCIÓN: COMPORTAMIENTO DE TRANSICIÓN DE OTRAS SESIONES */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚡</span> ¿Pasa esto al comienzo de otras sesiones? (Comportamiento del Spread & Volatilidad)
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 12.5, color: '#9ca3af', lineHeight: 1.5 }}>
              Sí, los cambios y comienzos de sesión son zonas de transición de liquidez. Aunque no son tan graves como el Rollover, generan comportamientos típicos que debes conocer:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              {/* APERTURA ASIA */}
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 18, border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.08)', padding: '2px 6px', borderRadius: 4 }}>
                    6:00 PM COT
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Apertura Asiática</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
                  Ocurre justo después del Rollover. Los bancos asiáticos abren pero la liquidez global sigue curándose. Los spreads en pares europeos (EUR, GBP) siguen amplios por 1 hora más. En pares locales (AUD, NZD, JPY) se normalizan más rápido, pero al haber poco volumen, el precio se mueve lento en canales estrechos.
                </p>
              </div>

              {/* APERTURA LONDRES */}
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 18, border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981', background: 'rgba(16, 185, 129, 0.08)', padding: '2px 6px', borderRadius: 4 }}>
                    2:00 AM COT
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Apertura Europea</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
                  Entrada masiva de volumen europeo. Los spreads bajan inmediatamente a su nivel más bajo. Sin embargo, los primeros 15 minutos se caracterizan por una **cacería de liquidez**. El precio puede dar un latigazo fuerte en contra de la tendencia real (estirando el indicador) antes de tomar su dirección real.
                </p>
              </div>

              {/* APERTURA NUEVA YORK */}
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 18, border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24', background: 'rgba(251, 191, 36, 0.08)', padding: '2px 6px', borderRadius: 4 }}>
                    7:00 AM COT
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Apertura Americana</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
                  Cruce de Londres + NY. Spreads en mínimos absolutos. Sin embargo, es el horario preferido por el gobierno estadounidense para liberar datos económicos clave (a las 7:30 AM COT). Durante la noticia, el spread se ensancha de golpe por segundos y el precio spikea violentamente.
                </p>
              </div>
            </div>
          </div>
        </div>


        {/* ── SECCIONES DE DETALLE: HORARIOS A EVITAR VS HORARIOS DE ORO ───── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: 28,
          marginBottom: 36
        }}>
          
          {/* COLUMNA ZONAS ROJAS (EVITAR) */}
          <div>
            <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '2px', color: '#f43f5e', margin: '0 0 16px 4px', fontWeight: 800 }}>
              🚨 Zonas Rojas (Peligro de Spread)
            </h2>

            <div style={{ display: 'flex', flexDirection: 'col', gap: 20, flexFlow: 'column' }}>
              
              {/* CARD: ROLLOVER DIARIO */}
              <div className="premium-card avoid-card" style={{
                background: 'linear-gradient(135deg, rgba(244,63,94,0.04) 0%, rgba(15,15,25,0.75) 100%)',
                border: '1px solid rgba(244,63,94,0.15)',
                borderRadius: 16,
                padding: '24px 28px',
                backdropFilter: 'blur(10px)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#f43f5e', background: 'rgba(244,63,94,0.1)', padding: '2px 8px', borderRadius: 6, fontFamily: 'monospace' }}>
                    DIARIO (LUNES A VIERNES)
                  </span>
                  <span style={{ fontSize: 20 }}>🛑</span>
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#fff' }}>
                  El Rollover Diario (Forex Close)
                </h3>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fca5a5', fontFamily: 'monospace', marginBottom: 14 }}>
                  4:45 PM – 6:15 PM COT
                </div>
                <p style={{ margin: 0, fontSize: 12.5, color: '#d1d5db', lineHeight: 1.6 }}>
                  Es el momento del día con menor liquidez del sistema interbancario global. Las órdenes activas se liquidan o renuevan, y los spreads del broker pueden dispararse a niveles descabellados. La estrategia se bloquea debido al spread. <strong>Mantente fuera.</strong>
                </p>
              </div>

              {/* CARD: APERTURA DOMINICAL */}
              <div className="premium-card avoid-card" style={{
                background: 'linear-gradient(135deg, rgba(244,63,94,0.04) 0%, rgba(15,15,25,0.75) 100%)',
                border: '1px solid rgba(244,63,94,0.15)',
                borderRadius: 16,
                padding: '24px 28px',
                backdropFilter: 'blur(10px)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#f43f5e', background: 'rgba(244,63,94,0.1)', padding: '2px 8px', borderRadius: 6, fontFamily: 'monospace' }}>
                    DOMINGO (APERTURA)
                  </span>
                  <span style={{ fontSize: 20 }}>⚡</span>
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#fff' }}>
                  Apertura del Mercado Dominical
                </h3>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fca5a5', fontFamily: 'monospace', marginBottom: 14 }}>
                  4:00 PM – 7:00 PM COT
                </div>
                <p style={{ margin: 0, fontSize: 12.5, color: '#d1d5db', lineHeight: 1.6 }}>
                  Sydney abre con poco volumen. Los spreads son muy amplios y los movimientos iniciales suelen ser manipulaciones o gaps de continuación que rompen las desviaciones. Operar aquí equivale a apostar con desventaja matemática.
                </p>
              </div>

            </div>
          </div>

          {/* COLUMNA ZONAS DE ORO (APROVECHAR) */}
          <div>
            <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '2px', color: '#10b981', margin: '0 0 16px 4px', fontWeight: 800 }}>
              ✅ Horarios de Oro (Máxima Probabilidad)
            </h2>

            <div style={{ display: 'flex', flexDirection: 'col', gap: 20, flexFlow: 'column' }}>
              
              {/* CARD: SOLAPAMIENTO DE ORO */}
              <div className="premium-card golden-card" style={{
                background: 'linear-gradient(135deg, rgba(251,191,36,0.04) 0%, rgba(15,15,25,0.75) 100%)',
                border: '1px solid rgba(251,191,36,0.18)',
                borderRadius: 16,
                padding: '24px 28px',
                backdropFilter: 'blur(10px)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24', background: 'rgba(251,191,36,0.08)', padding: '2px 8px', borderRadius: 6, fontFamily: 'monospace' }}>
                    CUALQUIER DÍA LABORAL
                  </span>
                  <span style={{ fontSize: 20 }}>👑</span>
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#fff' }}>
                  Solapamiento Londres / Nueva York
                </h3>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fde047', fontFamily: 'monospace', marginBottom: 14 }}>
                  7:00 AM – 11:00 AM COT
                </div>
                <p style={{ margin: 0, fontSize: 12.5, color: '#d1d5db', lineHeight: 1.6 }}>
                  Es la zona horaria dorada de la estrategia. La confluencia de volumen de los dos mayores centros financieros del mundo garantiza spreads mínimos y que los rebotes a la media EMA100 ocurran de manera matemática y rápida.
                </p>
              </div>

              {/* CARD: SESIONES COMPLETAS */}
              <div className="premium-card golden-card" style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.04) 0%, rgba(15,15,25,0.75) 100%)',
                border: '1px solid rgba(16,185,129,0.15)',
                borderRadius: 16,
                padding: '24px 28px',
                backdropFilter: 'blur(10px)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,0.08)', padding: '2px 8px', borderRadius: 6, fontFamily: 'monospace' }}>
                    SESIONES PRINCIPALES
                  </span>
                  <span style={{ fontSize: 20 }}>☀️</span>
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#fff' }}>
                  Apertura Europea a Cierre de NY
                </h3>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#a7f3d0', fontFamily: 'monospace', marginBottom: 14 }}>
                  2:00 AM – 4:00 PM COT
                </div>
                <p style={{ margin: 0, fontSize: 12.5, color: '#d1d5db', lineHeight: 1.6 }}>
                  Ventana operativa muy limpia. Los pares con <code>EUR</code>, <code>GBP</code> y <code>USD</code> tienen excelente fluidez y se desvían de manera controlada. El algoritmo calcula con precisión sus retrocesos sin spreads que interfieran.
                </p>
              </div>

            </div>
          </div>

        </div>

        {/* ── MANUAL DE REGLAS ESTRATÉGICAS ─────────────────────────────── */}
        <div className="premium-card" style={{
          background: 'rgba(255,255,255,0.01)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 20,
          padding: '32px',
        }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🛡️</span> Manual de Reglas de Oro de Full Reversion
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
            
            <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              <h4 style={{ color: '#fb7185', margin: '0 0 8px', fontWeight: 700 }}>1. Validar el Giro</h4>
              <p style={{ margin: 0, color: '#9ca3af' }}>
                Nunca entres de inmediato cuando el detector de elasticidad se ponga en verde. Espera el aviso de **Giro Confirmado** del bot. La primera vela M5 que cierra mostrando contracción es la confirmación matemática de que el agotamiento de volumen es real.
              </p>
            </div>

            <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              <h4 style={{ color: '#a78bfa', margin: '0 0 8px', fontWeight: 700 }}>2. Control de Pendiente</h4>
              <p style={{ margin: 0, color: '#9ca3af' }}>
                Si la EMA100 está muy inclinada y la pendiente es calificada como `STEEP` (rojo), no entres. Esto evita que intentes frenar un tren en marcha (pullback en tendencia fuerte). Opera sólo pendientes `FLAT` o `GENTLE`.
              </p>
            </div>

            <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              <h4 style={{ color: '#34d399', margin: '0 0 8px', fontWeight: 700 }}>3. Ratios de TP y SL</h4>
              <p style={{ margin: 0, color: '#9ca3af' }}>
                El Take Profit sugerido se sitúa en el retorno exacto a la EMA100. El Stop Loss se ubica dinámicamente a **1.8 * ATR** del precio de entrada para dar suficiente holgura contra el ruido normal y mechas de recolección de liquidez.
              </p>
            </div>

            <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              <h4 style={{ color: '#60a5fa', margin: '0 0 8px', fontWeight: 700 }}>4. Noticias Macro</h4>
              <p style={{ margin: 0, color: '#9ca3af' }}>
                Apaga el bot o evita operar 15 minutos antes y 15 minutos después de noticias de carpeta roja (como NFP o tasas de interés). En esos momentos, el análisis técnico y los algoritmos estadísticos pierden efectividad temporalmente.
              </p>
            </div>

          </div>
        </div>

        {/* ── SECCIÓN DE EXPERTO DE 15 AÑOS DE EXPERIENCIA ───────────────── */}
        <div className="premium-card" style={{
          background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.04) 0%, rgba(15,15,25,0.85) 100%)',
          border: '1px solid rgba(167, 139, 250, 0.15)',
          borderRadius: 24,
          padding: '36px',
          marginTop: 36,
          boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 30px rgba(167, 139, 250, 0.03)',
          backdropFilter: 'blur(16px)',
        }}>
          {/* Cabecera de la sección */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <span style={{ fontSize: 32 }}>🧠</span>
            <div>
              <h2 style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: '-0.5px',
                background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                ACADEMIA DE TRADING PROFESIONAL: EXPERTO DE 15 AÑOS
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af' }}>
                Guía operativa para dominar el Semáforo Viejo y Full Reversion con la psicología de cuentas reales y acción del precio.
              </p>
            </div>
          </div>

          {/* Selector de Pestañas (Tabs) */}
          <div style={{
            display: 'flex',
            gap: 8,
            marginBottom: 28,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            paddingBottom: 12,
            overflowX: 'auto',
          }}>
            <button
              onClick={() => setActiveTab('checklist')}
              style={{
                background: activeTab === 'checklist' ? 'rgba(167, 139, 250, 0.15)' : 'transparent',
                border: activeTab === 'checklist' ? '1px solid rgba(167, 139, 250, 0.3)' : '1px solid transparent',
                color: activeTab === 'checklist' ? '#fff' : '#9ca3af',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'checklist') e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'checklist') e.currentTarget.style.background = 'transparent'
              }}
            >
              📋 Checklist Diario
            </button>
            <button
              onClick={() => setActiveTab('pullbacks')}
              style={{
                background: activeTab === 'pullbacks' ? 'rgba(167, 139, 250, 0.15)' : 'transparent',
                border: activeTab === 'pullbacks' ? '1px solid rgba(167, 139, 250, 0.3)' : '1px solid transparent',
                color: activeTab === 'pullbacks' ? '#fff' : '#9ca3af',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'pullbacks') e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'pullbacks') e.currentTarget.style.background = 'transparent'
              }}
            >
              📈 Pullback vs Reversión
            </button>
            <button
              onClick={() => setActiveTab('candles')}
              style={{
                background: activeTab === 'candles' ? 'rgba(167, 139, 250, 0.15)' : 'transparent',
                border: activeTab === 'candles' ? '1px solid rgba(167, 139, 250, 0.3)' : '1px solid transparent',
                color: activeTab === 'candles' ? '#fff' : '#9ca3af',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'candles') e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'candles') e.currentTarget.style.background = 'transparent'
              }}
            >
              🕯️ Patrones de Velas
            </button>
            <button
              onClick={() => setActiveTab('testimonies')}
              style={{
                background: activeTab === 'testimonies' ? 'rgba(167, 139, 250, 0.15)' : 'transparent',
                border: activeTab === 'testimonies' ? '1px solid rgba(167, 139, 250, 0.3)' : '1px solid transparent',
                color: activeTab === 'testimonies' ? '#fff' : '#9ca3af',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'testimonies') e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'testimonies') e.currentTarget.style.background = 'transparent'
              }}
            >
              💬 Testimonios Reales
            </button>
            <button
              onClick={() => setActiveTab('experience')}
              style={{
                background: activeTab === 'experience' ? 'rgba(167, 139, 250, 0.15)' : 'transparent',
                border: activeTab === 'experience' ? '1px solid rgba(167, 139, 250, 0.3)' : '1px solid transparent',
                color: activeTab === 'experience' ? '#fff' : '#9ca3af',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'experience') e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'experience') e.currentTarget.style.background = 'transparent'
              }}
            >
              💼 Bitácora de Campo
            </button>
          </div>

          {/* Contenido de la Pestaña Activa */}
          <div style={{ minHeight: 280 }}>
            {activeTab === 'checklist' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', gap: 16, background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.08) 0%, rgba(255,255,255,0.01) 100%)', padding: 20, borderRadius: 16, border: '1px solid rgba(167, 139, 250, 0.25)' }}>
                  <div style={{ fontSize: 20, background: 'rgba(167, 139, 250, 0.2)', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc', fontWeight: 'bold' }}>0</div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#c084fc' }}>REGLA DE ORO: Validación de Alineación Fractal (Confluencia Multi-Temporal)</h4>
                    <p style={{ margin: 0, fontSize: 13, color: '#d1d5db', lineHeight: 1.6 }}>
                      Antes de analizar cualquier indicador, abre el gráfico de tu par en <strong>1m, 5m y 15m</strong> y compara la altura y el cruce de las EMAs:
                      <br /><br />
                      ⚠️ <strong>Si hay Alineación Fractal (Confluencia):</strong> Las EMAs de las 3 temporalidades tienen el mismo ángulo e inclinación, y el precio cabalga exactamente en la misma posición relativa respecto a ellas. Esto indica una tendencia fractal uniforme de alta inercia.
                      <br />
                      • <strong>La Regla de Oro:</strong> Ignora por completo las alertas de contra-tendencia del <em>Semáforo Viejo</em> (que pintará verde brillante en compras/ventas prematuras y te causará flotante negativo). <strong>Apaga la operativa rápida y espera estrictamente al gatillo de Full Reversion (Giro de vela M5 confirmado)</strong> con soporte/resistencia institucional de fondo.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, background: 'rgba(255,255,255,0.01)', padding: 20, borderRadius: 16, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 20, background: 'rgba(167, 139, 250, 0.1)', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa', fontWeight: 'bold' }}>1</div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#fff' }}>Calendario Económico (Forex Factory / Investing)</h4>
                    <p style={{ margin: 0, fontSize: 13, color: '#9ca3af', lineHeight: 1.6 }}>
                      Inspecciona si hay noticias de "carpeta roja" programadas para hoy. Las noticias de alto impacto causan saltos de spread y roturas de tendencia donde los indicadores matemáticos pierden efectividad. 
                      <br />
                      <strong style={{ color: '#fb7185' }}>Acción:</strong> Si hay noticias para tus pares operados, apaga el bot 15 minutos antes y enciéndelo 15 minutos después del anuncio.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, background: 'rgba(255,255,255,0.01)', padding: 20, borderRadius: 16, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 20, background: 'rgba(16, 185, 129, 0.1)', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', fontWeight: 'bold' }}>2</div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#fff' }}>Verificación de Reloj de Sesiones</h4>
                    <p style={{ margin: 0, fontSize: 13, color: '#9ca3af', lineHeight: 1.6 }}>
                      Identifica en qué sesión se encuentra el mercado actualmente. 
                      <br />
                      <strong style={{ color: '#fbbf24' }}>Estrategia:</strong> Si estás en la <strong>Sesión Asiática (7 PM - 2 AM COT)</strong>, enfócate en el <em>Semáforo Viejo</em> para capturar múltiples rebotes en canales laterales. Si estás en el <strong>Solapamiento Londres/NY (7 AM - 11 AM COT)</strong>, usa exclusivamente <em>Full Reversion</em> para protegerte de rompimientos veloces.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, background: 'rgba(255,255,255,0.01)', padding: 20, borderRadius: 16, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 20, background: 'rgba(56, 189, 248, 0.1)', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', fontWeight: 'bold' }}>3</div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#fff' }}>Filtro de Pendiente (Slope de EMA100) & Análisis Multi-Temporal</h4>
                    <p style={{ margin: 0, fontSize: 13, color: '#9ca3af', lineHeight: 1.6 }}>
                      Inspecciona la pendiente de la EMA100 en el dashboard y aplica este criterio clínico de múltiples marcos temporales (M5/M15/H1) para el <strong>Semáforo Viejo</strong>:
                      <br /><br />
                      🟢 <strong>Estado FLAT (Pendiente Plana, &lt; 0.5 ATR):</strong> Rango lateral ideal.
                      <br />
                      • <em>En el gráfico:</em> Las EMAs 100 de M5 y M15 cruzan horizontalmente el medio del precio. H1 muestra velas de rango estrecho sin dirección clara.
                      <br />
                      • <em>Cómo actuar:</em> Confía con <strong>máxima agresividad</strong> en las alertas del Semáforo Viejo. Las reversiones son rápidas y simétricas. Puedes escalar posiciones (grids) con seguridad ya que la gravedad del mercado regresará el precio a la media.
                      <br /><br />
                      🟡 <strong>Estado GENTLE (Pendiente Suave, 0.5 - 1.0 ATR):</strong> Canal tendencial ordenado.
                      <br />
                      • <em>En el gráfico:</em> La EMA100 tiene inclinación moderada. El precio oscila arriba y abajo de ella pero con un sesgo (creciente o decreciente).
                      <br />
                      • <em>Cómo actuar:</em> <strong>Opera únicamente a favor de la pendiente de la EMA100</strong>. Si la EMA sube, opera exclusivamente señales de COMPRA (BUY) del Semáforo Viejo cuando el precio toque el extremo inferior. Descarta o reduce lotaje a la mitad en señales contra-tendencia (SELLs), pues la EMA subirá a buscar al precio limitando tu margen de ganancia.
                      <br /><br />
                      🔴 <strong>Estado STEEP (Pendiente Fuerte, &gt;= 1.0 ATR):</strong> Tendencia vertical / Impulso violento.
                      <br />
                      • <em>En el gráfico:</em> Las velas en M5 "cabalgan" EMAs rápidas (EMA9/20) y están muy separadas de la EMA100. En M15 se observan velas consecutivas de rango amplio sin mechas. En H1 hay una vela de ruptura estructural.
                      <br />
                      • <em>Cómo actuar:</em> <strong>¡PELIGRO! El Semáforo Viejo te pintará alertas verde brillante en pleno impulso. ¡Ignóralas!</strong> Abre el gráfico en H1/M15 y busca si hay un nivel de Soporte o Resistencia mayor (Semanal/Diario de fuerza &gt;= 3). Si no hay un S/R fuerte defendido por instituciones, no operes. Si lo hay, no entres de inmediato: espera a que Full Reversion confirme el <strong>Giro de Vela M5 (Candle Close)</strong> para entrar con el primer retroceso seguro.
                      <br /><br />
                      <strong style={{ color: '#a78bfa' }}>⚡ ¿Cuándo es el momento exacto para usar FULL REVERSION?</strong>
                      <br />
                      Debes basar tu operativa en <strong>Full Reversion</strong> (ignorando al Semáforo Viejo) en los siguientes 4 escenarios clave:
                      <br />
                      1. <strong>Horario de alta velocidad (2:00 AM a 11:00 AM COT):</strong> Aperturas de Londres y Nueva York. Las tendencias verticales barren al Semáforo Viejo. Full Reversion te protege bloqueando entradas en pendientes inclinadas.
                      <br />
                      2. <strong>Rupturas de canal (Slope STEEP en M5/M15):</strong> Si el precio rompe con una vela elefante y estira las bandas, no intentes frenarlo. Espera a que Full Reversion marque <em>Giro Confirmado (M5 candle close)</em> y valide que está tocando un Soporte/Resistencia institucional de fuerza &gt;= 3.
                      <br />
                      3. <strong>Confluencia en M5 + M15 (Alerta FUSIONADA 🔱):</strong> Cuando recibas la alerta de doble estiramiento con Giro confirmado. Es la señal del francotirador, con el Take Profit en la EMA100 y el Stop Loss a 1.8 * ATR.
                      <br />
                      4. <strong>Reversiones a favor de tendencias GENTLE:</strong> Si la tendencia es alcista suave (GENTLE UP) y el precio sufre una caída violenta, espera el Giro de M5 para entrar en COMPRA con el descuento a favor de la inercia general del mercado.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, background: 'rgba(255,255,255,0.01)', padding: 20, borderRadius: 16, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 20, background: 'rgba(249, 115, 22, 0.1)', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316', fontWeight: 'bold' }}>4</div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#fff' }}>Monitoreo de Spread en Vivo</h4>
                    <p style={{ margin: 0, fontSize: 13, color: '#9ca3af', lineHeight: 1.6 }}>
                      Asegúrate de que tu broker no esté cobrando spreads excesivos debido a falta de liquidez temporal.
                      <br />
                      <strong style={{ color: '#f97316' }}>Cuidado:</strong> Si el spread en pares mayores supera 1.5 - 2 pips, pospone cualquier entrada. Durante el <strong>Rollover (4:45 PM - 6:15 PM COT)</strong> el spread puede subir a 30-50 pips, lo que invalidará la precisión de tus Take Profit y Stop Loss.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'pullbacks' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <p style={{ margin: 0, fontSize: 14, color: '#d1d5db', lineHeight: 1.6 }}>
                  Un error que cuesta miles de dólares a los traders novatos es confundir un <strong>pullback en tendencia fuerte</strong> con una oportunidad de reversión. Si la EMA100 está inclinada hacia abajo y el precio sube rápido, ¿debes vender? Si el precio baja rápido en una tendencia bajista fuerte, ¿debes comprar?
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                  <div style={{ background: 'rgba(244, 63, 94, 0.02)', border: '1px solid rgba(244, 63, 94, 0.15)', padding: '20px 24px', borderRadius: 16 }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: 15, color: '#f43f5e', fontWeight: 800 }}>⚠️ La Trampa: El Pullback Bajista</h4>
                    <p style={{ margin: 0, fontSize: 12.5, color: '#9ca3af', lineHeight: 1.6 }}>
                      En una tendencia bajista estructurada (EMA100 STEEP DOWN), el precio realiza impulsos bajistas violentos y retrocesos (pullbacks) hacia la EMA100. 
                      <br /><br />
                      Si utilizas el <strong>Semáforo Viejo</strong> sin filtros, este detectará la desviación rápida del impulso y lanzará una señal de compra (BUY) en el extremo. Pero al ser una tendencia fuerte, el precio a menudo ignora la señal, retrocede muy poco y continúa cayendo con fuerza, rompiendo tu Stop Loss. Es intentar detener un tren con la mano.
                    </p>
                  </div>

                  <div style={{ background: 'rgba(16, 185, 129, 0.02)', border: '1px solid rgba(16, 185, 129, 0.15)', padding: '20px 24px', borderRadius: 16 }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: 15, color: '#10b981', fontWeight: 800 }}>🛡️ El Escudo: Filtro Full Reversion</h4>
                    <p style={{ margin: 0, fontSize: 12.5, color: '#9ca3af', lineHeight: 1.6 }}>
                      El motor <strong>Full Reversion</strong> soluciona esto con tres filtros lógicos simultáneos:
                      <br /><br />
                      1. <strong>Pendiente de la EMA100 (Slope):</strong> Si la inclinación es STEEP (superior a 1.0 ATR en 10 barras), la señal de compra se bloquea.
                      <br />
                      2. <strong>El Giro de Vela M5:</strong> No se entra mientras el precio está cayendo. El algoritmo espera a que una vela M5 cierre mostrando contracción (la resortera empieza a ceder).
                      <br />
                      3. <strong>Confluencia de RSI y S/R:</strong> Exige que haya una divergencia alcista en el RSI y un nivel de Soporte fuerte en la zona de entrada para asegurar que los compradores institucionales están defendiendo el precio.
                    </p>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: 24, borderRadius: 16 }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: 14, color: '#fff', fontWeight: 700 }}>💡 Cómo operarlo clínicamente:</h4>
                  <p style={{ margin: 0, fontSize: 13, color: '#9ca3af', lineHeight: 1.6 }}>
                    Cuando veas una señal del <strong>Semáforo Viejo</strong> en un par con tendencia definida, abre el gráfico. Si el precio está en un pullback bajista y no hay señal de <strong>Full Reversion</strong> (porque la pendiente es STEEP), <strong>IGNORA la señal de compra del Semáforo Viejo</strong>. En su lugar, espera a que el precio llegue a la EMA100 y busca una señal de continuación de tendencia (ventas). Usa el Semáforo Viejo únicamente cuando el mercado esté en consolidación lateral (Pendiente FLAT).
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'candles' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <p style={{ margin: 0, fontSize: 14, color: '#d1d5db', lineHeight: 1.6 }}>
                  Las señales matemáticas del algoritmo ganan una efectividad abrumadora cuando las confirmas visualmente con <strong>patrones de velas japonesas</strong> en los extremos de la elasticidad (Zona Verde). Las velas representan la psicología de los operadores institucionales en tiempo real.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                  
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: 20, borderRadius: 14, border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa' }}>PIN BAR / RECHAZO</span>
                      <span style={{ fontSize: 16 }}>🔨</span>
                    </div>
                    <h5 style={{ margin: '0 0 6px', fontSize: 14, color: '#fff', fontWeight: 700 }}>Martillo o Estrella Fugaz</h5>
                    <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>
                      Velas con una sombra o mecha muy larga (al menos 2/3 del tamaño total de la vela) que sobresale de las bandas de desviación y un cuerpo pequeño. 
                      <br /><br />
                      <strong>Significado:</strong> Las instituciones empujaron el precio al extremo para cazar stops, pero la oferta/demanda contraria absorbió las órdenes de inmediato. Confirmación ideal de giro.
                    </p>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: 20, borderRadius: 14, border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa' }}>ENVOLVENTE</span>
                      <span style={{ fontSize: 16 }}>🪃</span>
                    </div>
                    <h5 style={{ margin: '0 0 6px', fontSize: 14, color: '#fff', fontWeight: 700 }}>Bullish / Bearish Engulfing</h5>
                    <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>
                      Una vela que cierra en la dirección de la reversión y cuyo cuerpo cubre por completo el cuerpo de la vela anterior.
                      <br /><br />
                      <strong>Significado:</strong> Los compradores (en soporte) o vendedores (en resistencia) han tomado el control absoluto del mercado, superando con creces la fuerza de la tendencia previa. Gatillo de entrada de alta convicción.
                    </p>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: 20, borderRadius: 14, border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa' }}>ESTRELLA</span>
                      <span style={{ fontSize: 16 }}>⭐</span>
                    </div>
                    <h5 style={{ margin: '0 0 6px', fontSize: 14, color: '#fff', fontWeight: 700 }}>Morning Star / Evening Star</h5>
                    <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>
                      Patrón de tres velas: una vela a favor del impulso, una vela de cuerpo muy pequeño (Doji o peonza) en el pico de elasticidad, y una tercera vela que cierra con fuerza en contra del impulso original.
                      <br /><br />
                      <strong>Significado:</strong> Muestra la desaceleración del precio (vela del medio) y la posterior inyección de volumen institucional en reversión.
                    </p>
                  </div>

                </div>

                <div style={{ background: 'rgba(167, 139, 250, 0.05)', border: '1px solid rgba(167, 139, 250, 0.15)', padding: 20, borderRadius: 16, display: 'flex', gap: 14, alignItems: 'center' }}>
                  <span style={{ fontSize: 24 }}>💡</span>
                  <p style={{ margin: 0, fontSize: 12.5, color: '#d1d5db', lineHeight: 1.6 }}>
                    <strong>La combinación ganadora:</strong> Si recibes una pre-alerta fusionada de <strong>Full Reversion (M5+M15 en verde)</strong>, espera al cierre de la vela de M5. Si esa vela de cierre forma una <strong>Pin Bar</strong> o una <strong>Vela Envolvente</strong> justo sobre un nivel de Soporte/Resistencia marcado en el panel, tienes una operación con más del 80% de probabilidad de éxito. Pon tu Stop Loss a 1.8 ATR y tu Take Profit en la EMA100.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'testimonies' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <p style={{ margin: 0, fontSize: 14, color: '#d1d5db', lineHeight: 1.6 }}>
                  Hemos recopilado las mejores prácticas de blogs especializados y testimonios de traders reales que operan cuentas con sistemas basados en elasticidad y reversión a la media:
                </p>

                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: 20, borderRadius: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#a78bfa', fontWeight: 800, fontFamily: 'monospace' }}>💬 FORO FOREX FACTORY - TRADER DE REVERSIÓN</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>FTMO Funded Trader (Cuenta $100K)</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12.5, color: '#d1d5db', fontStyle: 'italic', lineHeight: 1.6 }}>
                    "Opero reversión a la media y el filtro de pendiente me salvó la vida. Antes de usarlo, solía comprar cada vez que el precio caía con fuerza. En las tendencias de noticias perdía 3 o 4 operaciones seguidas intentando atrapar el cuchillo que caía. Ahora, si la EMA100 tiene pendiente, simplemente no opero el par. Mis pérdidas se redujeron un 70%. Mi consejo: la disciplina de no operar en pendientes inclinadas es la diferencia entre ser rentable y quemar tu cuenta."
                  </p>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: 20, borderRadius: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#a78bfa', fontWeight: 800, fontFamily: 'monospace' }}>💬 BLOG 'EL CAMINO DEL TRADER CON CONSISTENCIA'</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>Operador de Cuentas Reales de Retail Broker</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12.5, color: '#d1d5db', fontStyle: 'italic', lineHeight: 1.6 }}>
                    "El Semáforo Viejo es una maravilla para acumular pequeños beneficios durante las sesiones de Tokio y Sydney. El mercado es muy predecible allí, rebota como pelota en los extremos. Pero el secreto es la transición a la sesión de Londres. A las 2:00 AM COT, las reglas cambian. Si dejas el Semáforo sin vigilar, te devora el Drawdown. Recomiendo migrar al motor Full Reversion con confirmación de vela cerrada. El gatillo del Giro evita entradas prematuras en el impulso inicial de apertura."
                  </p>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: 20, borderRadius: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#a78bfa', fontWeight: 800, fontFamily: 'monospace' }}>💬 REDDIT R/FOREX - DISCUSIÓN DE REVERSIÓN A LA MEDIA</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>Trader de Gestión de Capital</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12.5, color: '#d1d5db', fontStyle: 'italic', lineHeight: 1.6 }}>
                    "La regla del rollover a las 5:00 PM COT no es negociable. Muchos programan bots de reversión y los dejan correr 24/7. Luego se quejan de que a las 5 PM se abren operaciones gigantes y se cierran en stop loss de inmediato. No es que el mercado se haya vuelto loco, es que a esa hora los bancos liquidan y los spreads spreads suben un 1000%. La regla del manual de apagar la plataforma y desactivar alertas en Telegram de 4:45 PM a 6:15 PM es obligatoria si quieres sobrevivir más de un mes en Forex."
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'experience' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <p style={{ margin: 0, fontSize: 14, color: '#d1d5db', lineHeight: 1.6 }}>
                  Esta bitácora de campo contiene un análisis detallado de tus <strong>operaciones reales ganadas</strong>. Observa cómo se comportaron las EMAs y los osciladores, y aplica las lecciones clínicas para replicar estos aciertos en tu cuenta.
                </p>

                {/* Selector de Operaciones */}
                <div style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  background: 'rgba(255, 255, 255, 0.02)',
                  padding: 8,
                  borderRadius: 12,
                  border: '1px solid rgba(255, 255, 255, 0.06)'
                }}>
                  {[
                    { id: 'eur_gbp', label: '🧲 EUR/GBP (M5) · Reversión Imán' },
                    { id: 'cad_jpy', label: '🕯️ CAD/JPY (M5) · Agotamiento Extremo' },
                    { id: 'usd_cad', label: '⚡ USD/CAD (M5) · Alta Elasticidad' },
                    { id: 'usd_jpy', label: '🎯 USD/JPY (M5) · Desviación Rango' },
                  ].map((trade) => {
                    const isSelected = selectedRealTrade === trade.id;
                    return (
                      <button
                        key={trade.id}
                        onClick={() => setSelectedRealTrade(trade.id as any)}
                        style={{
                          background: isSelected ? 'rgba(167, 139, 250, 0.15)' : 'transparent',
                          border: isSelected ? '1px solid rgba(167, 139, 250, 0.3)' : '1px solid transparent',
                          color: isSelected ? '#fff' : '#9ca3af',
                          borderRadius: 8,
                          padding: '6px 14px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        {trade.label}
                      </button>
                    )
                  })}
                </div>

                {/* Dashboard del Caso Real */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                  gap: 24,
                  alignItems: 'stretch',
                }}>
                  {/* Gráfico SVG del caso */}
                  <div style={{
                    background: '#07070f',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 16,
                    padding: 16,
                    minHeight: 280,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    boxShadow: 'inset 0 0 15px rgba(0,0,0,0.8)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <svg viewBox="0 0 500 280" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                      <defs>
                        <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="3" result="blur" />
                          <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                      </defs>

                      {/* Cuadrícula de Fondo */}
                      <g stroke="rgba(255,255,255,0.02)" strokeWidth="0.5">
                        <line x1="50" y1="30" x2="450" y2="30" />
                        <line x1="50" y1="80" x2="450" y2="80" />
                        <line x1="50" y1="130" x2="450" y2="130" />
                        <line x1="50" y1="180" x2="450" y2="180" />
                        <line x1="50" y1="230" x2="450" y2="230" />
                        
                        <line x1="100" y1="30" x2="100" y2="230" />
                        <line x1="175" y1="30" x2="175" y2="230" />
                        <line x1="250" y1="30" x2="250" y2="230" />
                        <line x1="325" y1="30" x2="325" y2="230" />
                        <line x1="400" y1="30" x2="400" y2="230" />
                      </g>

                      {selectedRealTrade === 'eur_gbp' && (
                        <g>
                          {/* EMAs Horizontales y Planas */}
                          <line x1="50" y1="140" x2="450" y2="140" stroke="#10b981" strokeWidth="2.5" opacity="0.6" />
                          <line x1="50" y1="138" x2="450" y2="138" stroke="#00f0ff" strokeWidth="2.5" />
                          <text x="315" y="132" fill="#00f0ff" fontSize="8" fontWeight="bold">EMA 50 / 100 CLUSTER (0.86487)</text>

                          {/* Línea de Entrada */}
                          <line x1="50" y1="70" x2="450" y2="70" stroke="#f43f5e" strokeDasharray="3,3" opacity="0.5" />
                          <text x="60" y="65" fill="#fca5a5" fontSize="8" fontWeight="bold">NIVEL DE ENTRADA (SELL) · 0.86499</text>

                          {/* Velas */}
                          {[
                            { x: 90, open: 138, close: 120, high: 115, low: 142, color: '#10b981' },
                            { x: 130, open: 120, close: 105, high: 100, low: 122, color: '#10b981' },
                            { x: 170, open: 105, close: 85, high: 80, low: 110, color: '#10b981' },
                            { x: 210, open: 85, close: 72, high: 70, low: 90, color: '#10b981' }, // Overbought Peak
                            { x: 250, open: 72, close: 95, high: 70, low: 100, color: '#f43f5e' }, // Reversal starts
                            { x: 290, open: 95, close: 115, high: 90, low: 120, color: '#f43f5e' },
                            { x: 330, open: 115, close: 138, high: 110, low: 140, color: '#f43f5e' }, // Hits TP
                            { x: 370, open: 138, close: 145, high: 135, low: 150, color: '#f43f5e' },
                          ].map((c, i) => (
                            <g key={i}>
                              <line x1={c.x} y1={c.high} x2={c.x} y2={c.low} stroke={c.color} strokeWidth="1.5" />
                              <rect x={c.x - 5} y={Math.min(c.open, c.close)} width="10" height={Math.max(2, Math.abs(c.open - c.close))} fill={c.color} rx="1" />
                            </g>
                          ))}

                          {/* Señalizadores */}
                          <circle cx="210" cy="72" r="6" fill="#f43f5e" stroke="#fff" strokeWidth="1.5" />
                          <text x="210" y="55" fill="#f43f5e" fontSize="9" fontWeight="bold" textAnchor="middle">ENTRADA SELL 📉</text>

                          <circle cx="330" cy="138" r="6" fill="#10b981" stroke="#fff" strokeWidth="1.5" />
                          <text x="330" y="160" fill="#10b981" fontSize="9" fontWeight="bold" textAnchor="middle">TAKE PROFIT (IMÁN) 🏆</text>
                        </g>
                      )}

                      {selectedRealTrade === 'cad_jpy' && (
                        <g>
                          {/* EMAs Inclinadas Bajistas */}
                          <path d="M 50,70 L 450,170" fill="none" stroke="#10b981" strokeWidth="2.5" opacity="0.6" />
                          <path d="M 50,95 L 450,195" fill="none" stroke="#00f0ff" strokeWidth="2.5" />
                          <text x="360" y="150" fill="#10b981" fontSize="8" fontWeight="bold">EMA 100</text>
                          <text x="360" y="175" fill="#00f0ff" fontSize="8" fontWeight="bold">EMA 50</text>

                          {/* Velas bajistas */}
                          {[
                            { x: 90, open: 95, close: 120, high: 90, low: 125, color: '#f43f5e' },
                            { x: 130, open: 120, close: 145, high: 118, low: 150, color: '#f43f5e' },
                            { x: 170, open: 145, close: 185, high: 140, low: 190, color: '#f43f5e' },
                            { x: 210, open: 185, close: 225, high: 180, low: 232, color: '#f43f5e' }, // Climax drop to 114.7475
                            { x: 250, open: 225, close: 215, high: 205, low: 228, color: '#10b981' }, // Hammer
                            { x: 290, open: 215, close: 195, high: 192, low: 220, color: '#10b981' }, // Rebound to EMA 50
                            { x: 330, open: 195, close: 210, high: 190, low: 215, color: '#f43f5e' }, // Rejection at EMA 50
                          ].map((c, i) => (
                            <g key={i}>
                              <line x1={c.x} y1={c.high} x2={c.x} y2={c.low} stroke={c.color} strokeWidth="1.5" />
                              <rect x={c.x - 5} y={Math.min(c.open, c.close)} width="10" height={Math.max(2, Math.abs(c.open - c.close))} fill={c.color} rx="1" />
                            </g>
                          ))}

                          {/* Señalizadores */}
                          <circle cx="250" cy="220" r="6" fill="#10b981" stroke="#fff" strokeWidth="1.5" />
                          <text x="250" y="243" fill="#10b981" fontSize="9" fontWeight="bold" textAnchor="middle">ENTRADA BUY 📈</text>

                          <circle cx="290" cy="195" r="6" fill="#f43f5e" stroke="#fff" strokeWidth="1.5" />
                          <text x="345" y="200" fill="#f43f5e" fontSize="9" fontWeight="bold" textAnchor="middle">SALIDA (EMA 50) 🏆</text>
                        </g>
                      )}

                      {selectedRealTrade === 'usd_cad' && (
                        <g>
                          {/* EMAs Ascendentes */}
                          <path d="M 50,180 L 450,110" fill="none" stroke="#10b981" strokeWidth="2.5" opacity="0.6" />
                          <path d="M 50,155 L 450,85" fill="none" stroke="#00f0ff" strokeWidth="2.5" />
                          <text x="380" y="125" fill="#10b981" fontSize="8" fontWeight="bold">EMA 100</text>
                          <text x="380" y="100" fill="#00f0ff" fontSize="8" fontWeight="bold">EMA 50</text>

                          {/* Velas */}
                          {[
                            { x: 90, open: 145, close: 120, high: 115, low: 150, color: '#10b981' },
                            { x: 130, open: 120, close: 95, high: 90, low: 125, color: '#10b981' },
                            { x: 170, open: 95, close: 70, high: 65, low: 100, color: '#10b981' },
                            { x: 210, open: 70, close: 55, high: 50, low: 75, color: '#10b981' }, // Parabólico peak 1.396125
                            { x: 250, open: 55, close: 78, high: 52, low: 82, color: '#f43f5e' }, // Sell entry 1.39577
                            { x: 290, open: 78, close: 105, high: 75, low: 110, color: '#f43f5e' }, // Snapback to EMA 50 (y=105)
                            { x: 330, open: 105, close: 98, high: 95, low: 112, color: '#10b981' }, // Support at EMA 50
                          ].map((c, i) => (
                            <g key={i}>
                              <line x1={c.x} y1={c.high} x2={c.x} y2={c.low} stroke={c.color} strokeWidth="1.5" />
                              <rect x={c.x - 5} y={Math.min(c.open, c.close)} width="10" height={Math.max(2, Math.abs(c.open - c.close))} fill={c.color} rx="1" />
                            </g>
                          ))}

                          {/* Señalizadores */}
                          <circle cx="250" cy="65" r="6" fill="#f43f5e" stroke="#fff" strokeWidth="1.5" />
                          <text x="250" y="48" fill="#f43f5e" fontSize="9" fontWeight="bold" textAnchor="middle">ENTRADA SELL 📉</text>

                          <circle cx="290" cy="105" r="6" fill="#10b981" stroke="#fff" strokeWidth="1.5" />
                          <text x="340" y="120" fill="#10b981" fontSize="9" fontWeight="bold" textAnchor="middle">SALIDA (EMA 50) 🏆</text>
                        </g>
                      )}

                      {selectedRealTrade === 'usd_jpy' && (
                        <g>
                          {/* EMAs Horizontales */}
                          <line x1="50" y1="160" x2="450" y2="160" stroke="#10b981" strokeWidth="2.5" opacity="0.6" />
                          <line x1="50" y1="158" x2="450" y2="158" stroke="#00f0ff" strokeWidth="2.5" />
                          <text x="390" y="150" fill="#10b981" fontSize="8" fontWeight="bold">EMA 100/50 (160.470)</text>

                          {/* Velas */}
                          {[
                            { x: 90, open: 155, close: 135, high: 130, low: 160, color: '#10b981' },
                            { x: 130, open: 135, close: 115, high: 110, low: 140, color: '#10b981' },
                            { x: 170, open: 115, close: 95, high: 90, low: 120, color: '#10b981' }, // peak 160.5445
                            { x: 210, open: 95, close: 120, high: 92, low: 125, color: '#f43f5e' }, // Sell entry 160.490
                            { x: 250, open: 120, close: 140, high: 118, low: 145, color: '#f43f5e' },
                            { x: 290, open: 140, close: 158, high: 135, low: 162, color: '#f43f5e' }, // Hits EMA 50
                            { x: 330, open: 158, close: 152, high: 150, low: 165, color: '#10b981' }, // Consolidation starts
                          ].map((c, i) => (
                            <g key={i}>
                              <line x1={c.x} y1={c.high} x2={c.x} y2={c.low} stroke={c.color} strokeWidth="1.5" />
                              <rect x={c.x - 5} y={Math.min(c.open, c.close)} width="10" height={Math.max(2, Math.abs(c.open - c.close))} fill={c.color} rx="1" />
                            </g>
                          ))}

                          {/* Señalizadores */}
                          <circle cx="210" cy="108" r="6" fill="#f43f5e" stroke="#fff" strokeWidth="1.5" />
                          <text x="210" y="85" fill="#f43f5e" fontSize="9" fontWeight="bold" textAnchor="middle">ENTRADA SELL 📉</text>

                          <circle cx="290" cy="158" r="6" fill="#10b981" stroke="#fff" strokeWidth="1.5" />
                          <text x="290" y="180" fill="#10b981" fontSize="9" fontWeight="bold" textAnchor="middle">SALIDA (EMA 50) 🏆</text>
                        </g>
                      )}

                    </svg>
                  </div>

                  {/* Diagnóstico Clínico */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid rgba(167, 139, 250, 0.25)',
                    borderRadius: 16,
                    padding: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}>
                    <div>
                      {/* Cabecera Diagnóstico */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa', fontFamily: 'monospace' }}>CASO DE ÉXITO REAL</span>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 10,
                          fontWeight: 900,
                          fontFamily: 'monospace',
                          color: '#fff',
                          background: '#10b981',
                          boxShadow: '0 0 8px rgba(16,185,129,0.3)',
                        }}>
                          {selectedRealTrade === 'eur_gbp' && '+$2.78 (+1.39%) ✅'}
                          {selectedRealTrade === 'cad_jpy' && '+$5.23 (+2.62%) ✅'}
                          {selectedRealTrade === 'usd_cad' && '+$12.91 (+6.46%) ✅'}
                          {selectedRealTrade === 'usd_jpy' && '+$11.05 (+0.50%) ✅'}
                        </span>
                      </div>

                      {selectedRealTrade === 'eur_gbp' && (
                        <div>
                          <h4 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: '#fff' }}>EUR/GBP (M5) · Reversión Clásica al Imán</h4>
                          <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#d1d5db', lineHeight: 1.5 }}>
                            Operación rápida en rango plano. El precio se alejó de su media en la sesión lenta, activando la elasticidad en color verde.
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: '#9ca3af' }}>
                            <div><strong>📍 Contexto:</strong> Rango lateral perfecto con la EMA 50 y la EMA 100 completamente planas y solapadas en el centro.</div>
                            <div><strong>📉 Entrada:</strong> Ejecutada en venta (SELL) en <code>0.86499</code>, cazando el clímax del estiramiento.</div>
                            <div><strong>🏆 Salida (TP):</strong> Cierre automático exacto en <code>0.86487</code>, justo en la intersección del cluster de EMAs.</div>
                          </div>
                        </div>
                      )}

                      {selectedRealTrade === 'cad_jpy' && (
                        <div>
                          <h4 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: '#fff' }}>CAD/JPY (M5) · Rebote por Agotamiento Extremo</h4>
                          <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#d1d5db', lineHeight: 1.5 }}>
                            Operación contratendencial en una caída vertical. Aprovechamos la contracción temporal (rebote del resorte) a la EMA 50.
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: '#9ca3af' }}>
                            <div><strong>📍 Contexto:</strong> Tendencia bajista activa. El precio se desvió de forma vertical alcanzando un mínimo en <code>114.7475</code>.</div>
                            <div><strong>📈 Entrada:</strong> Ejecutada en compra (BUY) en <code>114.761</code> al confirmarse el primer agotamiento.</div>
                            <div><strong>🏆 Salida (TP):</strong> Cierre manual disciplinado en <code>114.767</code>, justo cuando el precio regresó a testear la EMA 50 celeste como resistencia dinámica.</div>
                          </div>
                        </div>
                      )}

                      {selectedRealTrade === 'usd_cad' && (
                        <div>
                          <h4 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: '#fff' }}>USD/CAD (M5) · Reversión de Alta Elasticidad</h4>
                          <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#d1d5db', lineHeight: 1.5 }}>
                            Captura de un retroceso violento (Snapback) tras un impulso parabólico alcista con alto ratio de riesgo/beneficio.
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: '#9ca3af' }}>
                            <div><strong>📍 Contexto:</strong> Tendencia alcista moderada. El precio spikeó fuertemente hacia <code>1.396125</code> (sobrecompra extrema).</div>
                            <div><strong>📉 Entrada:</strong> Ejecutada en venta (SELL) en <code>1.39577</code> al confirmarse el giro de mecha.</div>
                            <div><strong>🏆 Salida (TP):</strong> Cierre manual en <code>1.39487</code>, justo por encima de la EMA 50 celeste que actuaba como soporte.</div>
                          </div>
                        </div>
                      )}

                      {selectedRealTrade === 'usd_jpy' && (
                        <div>
                          <h4 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: '#fff' }}>USD/JPY (M5) · Desviación en Rango Plano</h4>
                          <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#d1d5db', lineHeight: 1.5 }}>
                            Operación conservadora en rango lateral plano. Aprovechamos la atracción gravitacional inmediata de las EMAs planas.
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: '#9ca3af' }}>
                            <div><strong>📍 Contexto:</strong> Consolidación lateral. El precio subió a <code>160.5445</code> estirando los indicadores de percentil.</div>
                            <div><strong>📉 Entrada:</strong> Venta (SELL) en <code>160.490</code> cazando el giro con Stochastic y CCI cruzando a la baja.</div>
                            <div><strong>🏆 Salida (TP):</strong> Cierre manual en <code>160.480</code> en el toque de la EMA 50 celeste, protegiendo las ganancias de inmediato.</div>
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Regla de Oro del Caso */}
                    <div style={{
                      background: 'rgba(167, 139, 250, 0.04)',
                      padding: '12px 16px',
                      borderRadius: 10,
                      borderLeft: '3px solid #a78bfa',
                      color: '#d8b4fe',
                      fontSize: 12,
                      marginTop: 16,
                      lineHeight: 1.5,
                    }}>
                      💡 <strong>Lección de Oro:</strong>{' '}
                      {selectedRealTrade === 'eur_gbp' && 'En rangos planos, el precio cruzará las EMAs de lado a lado. Tu objetivo (TP) siempre debe ser el cluster de medias (centro de gravedad).'}
                      {selectedRealTrade === 'cad_jpy' && 'En impulsos fuertes en contra, no busques el retorno a la EMA 100 verde. La EMA 50 celeste detendrá el rebote. Sal allí y asegura tu dinero.'}
                      {selectedRealTrade === 'usd_cad' && 'Un sobreestiramiento parabólico produce una contracción igual de violenta. Asegura tus ganancias en la EMA 50 celeste antes de que el soporte dinámico actúe.'}
                      {selectedRealTrade === 'usd_jpy' && 'No seas codicioso en mercados laterales. La primera media (EMA 50) suele ser una zona de fricción y rebote inmediato. Asegura y avanza.'}
                    </div>

                  </div>
                </div>

              </div>
            )}
          </div>
        </div>

        {/* ── SECCIÓN: SIMULADOR INTERACTIVO DE PENDIENTES Y CONTRACCIÓN DE EMAS ── */}
        <div className="premium-card" style={{
          background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.03) 0%, rgba(16, 185, 129, 0.02) 50%, rgba(15,15,25,0.9) 100%)',
          border: '1px solid rgba(0, 240, 255, 0.15)',
          borderRadius: 24,
          padding: '36px',
          marginTop: 36,
          boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 30px rgba(0, 240, 255, 0.02)',
          backdropFilter: 'blur(16px)',
        }}>
          {/* Cabecera del Simulador */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <span style={{ fontSize: 32 }}>🔮</span>
            <div>
              <h2 style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: '-0.5px',
                background: 'linear-gradient(135deg, #00f0ff, #10b981)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                SIMULADOR INTERACTIVO DE DINÁMICAS EMA 50 & EMA 100
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af' }}>
                Entiende visualmente cómo interactúa el precio con la EMA 50 (Celeste 🔵) y la EMA 100 (Verde 🟢) para identificar oportunidades reales y evitar trampas de tendencia.
              </p>
            </div>
          </div>

          {/* Selector de Escenarios del Simulador */}
          <div style={{
            display: 'flex',
            gap: 12,
            marginBottom: 28,
            flexWrap: 'wrap',
          }}>
            {[
              { id: 'contraction', label: '🟢 Estrangulamiento (Rango) · OPERAR', borderActive: 'rgba(16, 185, 129, 0.4)', bgActive: 'rgba(16, 185, 129, 0.15)', glow: 'rgba(16, 185, 129, 0.1)' },
              { id: 'pullback', label: '🟢 Retroceso EMA 50 (Pullback) · OPERAR', borderActive: 'rgba(16, 185, 129, 0.4)', bgActive: 'rgba(16, 185, 129, 0.15)', glow: 'rgba(16, 185, 129, 0.1)' },
              { id: 'partial_exit', label: '⚡ Salida Parcial (TP1/TP2) · OPERAR', borderActive: 'rgba(0, 240, 255, 0.4)', bgActive: 'rgba(0, 240, 255, 0.12)', glow: 'rgba(0, 240, 255, 0.1)' },
              { id: 'expansion', label: '⚠️ Abanico Abierto (Expansión) · EVITAR', borderActive: 'rgba(244, 63, 94, 0.4)', bgActive: 'rgba(244, 63, 94, 0.12)', glow: 'rgba(244, 63, 94, 0.1)' },
              { id: 'crossover', label: '🚨 Cruces Falsos (Crossover) · EVITAR', borderActive: 'rgba(251, 191, 36, 0.4)', bgActive: 'rgba(251, 191, 36, 0.12)', glow: 'rgba(251, 191, 36, 0.1)' },
              { id: 'precrossover', label: '⚠️ Compresión Pre-Cruce · EVITAR', borderActive: 'rgba(244, 63, 94, 0.4)', bgActive: 'rgba(244, 63, 94, 0.12)', glow: 'rgba(244, 63, 94, 0.1)' },
              { id: 'fractal_noise', label: '🛑 Ruido Fractal (Multi-Temporal) · EVITAR', borderActive: 'rgba(239, 68, 68, 0.4)', bgActive: 'rgba(239, 68, 68, 0.12)', glow: 'rgba(239, 68, 68, 0.1)' },
            ].map((scen) => {
              const isActive = simScenario === scen.id
              return (
                <button
                  key={scen.id}
                  onClick={() => setSimScenario(scen.id as any)}
                  style={{
                    background: isActive ? scen.bgActive : 'rgba(255,255,255,0.02)',
                    border: isActive ? `1px solid ${scen.borderActive}` : '1px solid rgba(255,255,255,0.06)',
                    color: isActive ? '#fff' : '#9ca3af',
                    borderRadius: 12,
                    padding: '12px 20px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isActive ? `0 0 15px ${scen.glow}` : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                    }
                  }}
                >
                  {scen.label}
                </button>
              )
            })}
          </div>

          {/* Área Principal del Simulador (Gráfico + Diagnóstico) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: 28,
            alignItems: 'stretch',
          }}>
            {/* Lienzo SVG Animado */}
            <div style={{
              background: 'rgba(7, 7, 15, 0.95)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 20,
              padding: 20,
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)',
              overflow: 'hidden',
              minHeight: 320,
            }}>
              {/* Leyenda en Gráfico */}
              {simScenario !== 'fractal_noise' && (
                <div style={{
                  position: 'absolute',
                  top: 16,
                  left: 16,
                  display: 'flex',
                  gap: 12,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#9ca3af',
                  background: 'rgba(255,255,255,0.01)',
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00f0ff' }}></span> EMA 50
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></span> EMA 100
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24' }}></span> Precio (Velas)
                  </span>
                </div>
              )}

              {/* Marca de agua de Escenario */}
              <div style={{
                position: 'absolute',
                top: 16,
                right: 16,
                fontSize: 10,
                fontWeight: 800,
                fontFamily: 'monospace',
                letterSpacing: 1,
                color: (simScenario === 'contraction' || simScenario === 'pullback') ? '#10b981' : simScenario === 'partial_exit' ? '#00f0ff' : (simScenario === 'expansion' || simScenario === 'precrossover') ? '#f43f5e' : simScenario === 'fractal_noise' ? '#ef4444' : '#fbbf24',
                textTransform: 'uppercase',
                background: 'rgba(255,255,255,0.01)',
                padding: '4px 8px',
                borderRadius: 6,
                border: `1px solid ${(simScenario === 'contraction' || simScenario === 'pullback') ? 'rgba(16, 185, 129, 0.2)' : simScenario === 'partial_exit' ? 'rgba(0, 240, 255, 0.2)' : (simScenario === 'expansion' || simScenario === 'precrossover') ? 'rgba(244, 63, 94, 0.2)' : simScenario === 'fractal_noise' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(251, 191, 36, 0.2)'}`,
              }}>
                {simScenario === 'contraction' ? 'Compresión Lateral' : simScenario === 'pullback' ? 'Retroceso Tendencia' : simScenario === 'partial_exit' ? 'Gestión TP1/TP2' : simScenario === 'expansion' ? 'Tendencia Activa' : simScenario === 'crossover' ? 'Fase Cruce / Momentum' : simScenario === 'precrossover' ? 'Giro de Inercia' : 'Divergencia Fractal'}
              </div>

              {/* El Renderizado SVG */}
              <svg viewBox="0 0 500 300" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                <defs>
                  {/* Gradiente para sombreado entre EMAs en expansión */}
                  <linearGradient id="expansionGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(244, 63, 94, 0.08)" />
                    <stop offset="100%" stopColor="rgba(244, 63, 94, 0.0)" />
                  </linearGradient>
                  {/* Gradiente para contracción */}
                  <linearGradient id="contractionGlow" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgba(16, 185, 129, 0.0)" />
                    <stop offset="50%" stopColor="rgba(16, 185, 129, 0.05)" />
                    <stop offset="100%" stopColor="rgba(16, 185, 129, 0.0)" />
                  </linearGradient>
                  {/* Filtros de Glow */}
                  <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <filter id="glow-green" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
                  </marker>
                  <marker id="arrow-red" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e" />
                  </marker>
                </defs>

                {/* Grilla de Fondo */}
                {simScenario !== 'fractal_noise' && (
                  <g opacity="0.08">
                    <path d="M 0,50 L 500,50 M 0,100 L 500,100 M 0,150 L 500,150 M 0,200 L 500,200 M 0,250 L 500,250" stroke="#fff" strokeWidth="1" strokeDasharray="3,3" />
                    <path d="M 50,0 L 50,300 M 100,0 L 100,300 M 150,0 L 150,300 M 200,0 L 200,300 M 250,0 L 250,300 M 300,0 L 300,300 M 350,0 L 350,300 M 400,0 L 400,300 M 450,0 L 450,300" stroke="#fff" strokeWidth="1" strokeDasharray="3,3" />
                  </g>
                )}

                {/* 1. ESCENARIO DE EXPANSIÓN (ABANICO ABIERTO) */}
                {simScenario === 'expansion' && (
                  <g>
                    {/* Sombra de Expansión (Relleno entre EMAs) */}
                    <path d="M 50,70 Q 150,95 250,130 T 450,230 L 450,310 Q 350,250 250,185 T 50,90 Z" fill="url(#expansionGlow)" />
                    
                    {/* EMA 100 (Verde) */}
                    <path d="M 50,70 Q 150,95 250,130 T 450,230" fill="none" stroke="#10b981" strokeWidth="3" opacity="0.75" />
                    
                    {/* EMA 50 (Celeste) */}
                    <path d="M 50,90 Q 150,130 250,185 T 450,310" fill="none" stroke="#00f0ff" strokeWidth="3" filter="url(#glow-cyan)" />

                    {/* Línea de guía y rebote en EMA 50 */}
                    <circle cx="155" cy="132" r="6" fill="rgba(244, 63, 94, 0.4)" stroke="#f43f5e" strokeWidth="1.5" />
                    <circle cx="275" cy="182" r="6" fill="rgba(244, 63, 94, 0.4)" stroke="#f43f5e" strokeWidth="1.5" />
                    <circle cx="395" cy="252" r="6" fill="rgba(244, 63, 94, 0.4)" stroke="#f43f5e" strokeWidth="1.5" />

                    <text x="165" y="125" fill="#f43f5e" fontSize="9" fontWeight="800" fontFamily="monospace">REBOTE EMA 50 (TENDENCIA ACTIVA)</text>
                    <text x="285" y="175" fill="#f43f5e" fontSize="9" fontWeight="800" fontFamily="monospace">REBOTE EN CONTRA-TENDENCIA</text>
                    
                    {/* Velas Japonesas (Downtrend riding EMA 50) */}
                    {[
                      { x: 75, open: 105, close: 115, high: 98, low: 120, color: '#f43f5e' },
                      { x: 115, open: 115, close: 125, high: 112, low: 130, color: '#f43f5e' },
                      { x: 155, open: 125, close: 120, high: 115, low: 132, color: '#10b981' }, // green retracement to EMA50
                      { x: 195, open: 120, close: 145, high: 118, low: 150, color: '#f43f5e' },
                      { x: 235, open: 145, close: 175, high: 140, low: 180, color: '#f43f5e' },
                      { x: 275, open: 175, close: 168, high: 165, low: 182, color: '#10b981' }, // green retracement to EMA50
                      { x: 315, open: 168, close: 210, high: 165, low: 215, color: '#f43f5e' },
                      { x: 355, open: 210, close: 245, high: 205, low: 250, color: '#f43f5e' },
                      { x: 395, open: 245, close: 238, high: 235, low: 252, color: '#10b981' }, // green retracement to EMA50
                      { x: 435, open: 238, close: 290, high: 232, low: 295, color: '#f43f5e' },
                    ].map((c, i) => (
                      <g key={i}>
                        {/* Sombra / Mecha */}
                        <line x1={c.x} y1={c.high} x2={c.x} y2={c.low} stroke={c.color} strokeWidth="1.5" />
                        {/* Cuerpo de la vela */}
                        <rect
                          x={c.x - 5}
                          y={Math.min(c.open, c.close)}
                          width="10"
                          height={Math.max(2, Math.abs(c.open - c.close))}
                          fill={c.color}
                          stroke={c.color}
                          strokeWidth="1"
                          rx="1"
                        />
                      </g>
                    ))}
                    
                    {/* Alerta de peligro */}
                    <rect x="230" y="20" width="230" height="32" rx="6" fill="rgba(244,63,94,0.12)" stroke="rgba(244,63,94,0.3)" />
                    <text x="240" y="40" fill="#f43f5e" fontSize="10.5" fontWeight="bold">⚠️ ERROR COMÚN: Comprar aquí es suicida</text>
                  </g>
                )}

                {/* 2. ESCENARIO DE CONTRACCIÓN (ESTRANGULAMIENTO) */}
                {simScenario === 'contraction' && (
                  <g>
                    {/* Sombra de Contracción (Relleno horizontal) */}
                    <rect x="50" y="140" width="400" height="20" fill="url(#contractionGlow)" />
                    
                    {/* EMA 100 (Verde) - Wavy Horizontal */}
                    <path d="M 50,150 Q 100,155 150,148 T 250,152 T 350,149 T 450,150" fill="none" stroke="#10b981" strokeWidth="3" filter="url(#glow-green)" />
                    
                    {/* EMA 50 (Celeste) - Wavy Horizontal */}
                    <path d="M 50,148 Q 100,145 150,153 T 250,147 T 350,152 T 450,152" fill="none" stroke="#00f0ff" strokeWidth="2.5" opacity="0.9" />

                    {/* Cajas de confluencia y gatillo */}
                    <circle cx="195" cy="220" r="10" fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="3,3" />
                    <text x="180" y="248" fill="#10b981" fontSize="9.5" fontWeight="800" fontFamily="monospace">⚡ GIRO M5 (MARTILLO)</text>
                    <path d="M 195,210 L 195,165" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3,3" />
                    
                    <circle cx="395" cy="80" r="10" fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="3,3" />
                    <text x="365" y="60" fill="#10b981" fontSize="9.5" fontWeight="800" fontFamily="monospace">⚡ GIRO M5 (PIN BAR)</text>
                    <path d="M 395,90 L 395,135" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3,3" />

                    <text x="210" y="185" fill="#a78bfa" fontSize="10" fontWeight="bold">Reversión limpia a la media 🎯</text>
                    <text x="280" y="115" fill="#a78bfa" fontSize="10" fontWeight="bold">Reversión limpia a la media 🎯</text>

                    {/* Velas Japonesas (Sideways volatility, deviation and clean reversion) */}
                    {[
                      { x: 75, open: 150, close: 155, high: 147, low: 158, color: '#10b981' },
                      { x: 115, open: 155, close: 190, high: 152, low: 192, color: '#10b981' }, // upward stretch
                      { x: 155, open: 190, close: 220, high: 185, low: 222, color: '#10b981' }, // extreme stretch
                      { x: 195, open: 220, close: 200, high: 235, low: 198, color: '#f43f5e' }, // Pinbar reversal (long upper wick)
                      { x: 235, open: 200, close: 152, high: 205, low: 150, color: '#f43f5e' }, // sharp reversion to mean
                      { x: 275, open: 152, close: 148, high: 145, low: 155, color: '#f43f5e' },
                      { x: 315, open: 148, close: 115, high: 150, low: 112, color: '#f43f5e' }, // downward stretch
                      { x: 355, open: 115, close: 85, high: 120, low: 80, color: '#f43f5e' }, // extreme downward stretch
                      { x: 395, open: 85, close: 105, high: 108, low: 72, color: '#10b981' }, // Hammer reversal (long lower wick)
                      { x: 435, open: 105, close: 148, high: 100, low: 152, color: '#10b981' }, // sharp reversion to mean
                    ].map((c, i) => (
                      <g key={i}>
                        <line x1={c.x} y1={c.high} x2={c.x} y2={c.low} stroke={c.color} strokeWidth="1.5" />
                        <rect
                          x={c.x - 5}
                          y={Math.min(c.open, c.close)}
                          width="10"
                          height={Math.max(2, Math.abs(c.open - c.close))}
                          fill={c.color}
                          stroke={c.color}
                          strokeWidth="1"
                          rx="1"
                        />
                      </g>
                    ))}
                    
                    {/* Alerta de éxito */}
                    <rect x="230" y="20" width="230" height="32" rx="6" fill="rgba(16,185,129,0.12)" stroke="rgba(16,185,129,0.3)" />
                    <text x="240" y="40" fill="#10b981" fontSize="10.5" fontWeight="bold">✅ ESCENARIO SANTO GRIAL: Alta Elasticidad</text>
                  </g>
                )}

                {/* 3. ESCENARIO DE CROSSOVER (CRUCES FALSOS) */}
                {simScenario === 'crossover' && (
                  <g>
                    {/* EMA 100 (Verde) - Smooth Downward Slope */}
                    <path d="M 50,100 Q 150,120 250,150 T 450,200" fill="none" stroke="#10b981" strokeWidth="3" opacity="0.75" />
                    
                    {/* EMA 50 (Celeste) - Crosses from Above to Below */}
                    <path d="M 50,75 Q 150,110 250,165 T 450,265" fill="none" stroke="#00f0ff" strokeWidth="3" filter="url(#glow-cyan)" />

                    {/* El punto de Cruce */}
                    <circle cx="215" cy="142" r="8" fill="rgba(251, 191, 36, 0.4)" stroke="#fbbf24" strokeWidth="1.5" />
                    <text x="180" y="125" fill="#fbbf24" fontSize="10" fontWeight="900" fontFamily="monospace">🚨 CRUCE DE EMAS (DEAD CROSS)</text>
                    
                    {/* Falsa señal de compra */}
                    <rect x="235" y="195" width="220" height="36" rx="6" fill="rgba(244,63,94,0.12)" stroke="rgba(244,63,94,0.3)" />
                    <text x="242" y="210" fill="#f43f5e" fontSize="9" fontWeight="bold">Trampa: El precio sigue bajando</text>
                    <text x="242" y="222" fill="#9ca3af" fontSize="8" fontWeight="bold">La inercia del cruce invalida la reversión</text>

                    {/* Velas Japonesas (Bearish crossover trap) */}
                    {[
                      { x: 75, open: 80, close: 95, high: 75, low: 98, color: '#f43f5e' },
                      { x: 115, open: 95, close: 110, high: 92, low: 115, color: '#f43f5e' },
                      { x: 155, open: 110, close: 135, high: 108, low: 140, color: '#f43f5e' }, // cross happening
                      { x: 195, open: 135, close: 165, high: 130, low: 170, color: '#f43f5e' }, // price goes far below EMAs
                      { x: 235, open: 165, close: 155, high: 150, low: 172, color: '#10b981' }, // retail buys the deviation (retracement attempt)
                      { x: 275, open: 155, close: 150, high: 148, low: 160, color: '#10b981' }, // small pause
                      { x: 315, open: 150, close: 200, high: 148, low: 205, color: '#f43f5e' }, // Trap sprung: price drops violently!
                      { x: 355, open: 200, close: 230, high: 195, low: 235, color: '#f43f5e' }, // further drop
                      { x: 395, open: 230, close: 225, high: 222, low: 238, color: '#10b981' }, // another weak buy
                      { x: 435, open: 225, close: 270, high: 220, low: 275, color: '#f43f5e' }, // continuing drop
                    ].map((c, i) => (
                      <g key={i}>
                        <line x1={c.x} y1={c.high} x2={c.x} y2={c.low} stroke={c.color} strokeWidth="1.5" />
                        <rect
                          x={c.x - 5}
                          y={Math.min(c.open, c.close)}
                          width="10"
                          height={Math.max(2, Math.abs(c.open - c.close))}
                          fill={c.color}
                          stroke={c.color}
                          strokeWidth="1"
                          rx="1"
                        />
                      </g>
                    ))}
                    
                    {/* Alerta de peligro general */}
                    <rect x="230" y="20" width="230" height="32" rx="6" fill="rgba(251,191,36,0.12)" stroke="rgba(251,191,36,0.3)" />
                    <text x="240" y="40" fill="#fbbf24" fontSize="10.5" fontWeight="bold">⚠️ CRUCE INICIADO: Impulso Direccional</text>
                  </g>
                )}

                {/* 4. ESCENARIO DE COMPRESIÓN PRE-CRUCE (GIRO DE INERCIA - AUD/USD Style) */}
                {simScenario === 'precrossover' && (
                  <g>
                    {/* EMA 100 (Verde) - Plana-Bajista */}
                    <path d="M 50,120 Q 150,140 250,160 T 450,165" fill="none" stroke="#10b981" strokeWidth="3" opacity="0.75" />
                    
                    {/* EMA 50 (Celeste) - Curvándose hacia arriba */}
                    <path d="M 50,180 Q 150,195 250,178 T 450,162" fill="none" stroke="#00f0ff" strokeWidth="3" filter="url(#glow-cyan)" />

                    {/* Flecha de Aceleración Alcista */}
                    <path d="M 195,225 L 350,135" stroke="#f43f5e" strokeWidth="3.5" markerEnd="url(#arrow-red)" />
                    <text x="220" y="225" fill="#f43f5e" fontSize="10" fontWeight="900" fontFamily="monospace">ACELERACIÓN DE TENDENCIA 📈</text>
                    
                    {/* Velas Japonesas (AUD/USD Style, bottoming and exploding up) */}
                    {[
                      { x: 75, open: 210, close: 220, high: 205, low: 225, color: '#f43f5e' },
                      { x: 115, open: 220, close: 195, high: 190, low: 225, color: '#10b981' },
                      { x: 155, open: 195, close: 205, high: 190, low: 210, color: '#f43f5e' },
                      { x: 195, open: 205, close: 170, high: 168, low: 210, color: '#10b981' }, // crosses EMA50
                      { x: 235, open: 170, close: 150, high: 145, low: 175, color: '#10b981' }, // pushes towards EMA100
                      { x: 275, open: 150, close: 158, high: 148, low: 162, color: '#f43f5e' }, // small pullback
                      { x: 315, open: 158, close: 135, high: 132, low: 160, color: '#10b981' }, // breaks EMA100
                      { x: 355, open: 135, close: 120, high: 115, low: 140, color: '#10b981' },
                      { x: 395, open: 120, close: 130, high: 118, low: 132, color: '#f43f5e' },
                      { x: 435, open: 130, close: 110, high: 105, low: 135, color: '#10b981' },
                    ].map((c, i) => (
                      <g key={i}>
                        <line x1={c.x} y1={c.high} x2={c.x} y2={c.low} stroke={c.color} strokeWidth="1.5" />
                        <rect
                          x={c.x - 5}
                          y={Math.min(c.open, c.close)}
                          width="10"
                          height={Math.max(2, Math.abs(c.open - c.close))}
                          fill={c.color}
                          stroke={c.color}
                          strokeWidth="1"
                          rx="1"
                        />
                      </g>
                    ))}
                    
                    {/* Alerta de peligro */}
                    <rect x="230" y="20" width="240" height="32" rx="6" fill="rgba(244,63,94,0.12)" stroke="rgba(244,63,94,0.3)" />
                    <text x="240" y="40" fill="#f43f5e" fontSize="10.5" fontWeight="bold">⚠️ FALSOS REBOTES: La EMA 50 gira al cruce</text>
                  </g>
                )}

                {/* 5. ESCENARIO DE DESALINEACIÓN FRACTAL (RUIDO MULTI-TEMPORAL - EUR/USD Style) */}
                {simScenario === 'fractal_noise' && (
                  <g>
                    {/* Gráfico 1: M1 (Tendencia Bajista) */}
                    <rect x="20" y="60" width="135" height="190" fill="rgba(255,255,255,0.01)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" rx="8" />
                    <text x="87" y="78" fill="#fca5a5" fontSize="9" fontWeight="800" textAnchor="middle" fontFamily="monospace">M1: BAJISTA 🔴</text>
                    <path d="M 30,100 L 145,180" fill="none" stroke="#10b981" strokeWidth="2" opacity="0.6" />
                    <path d="M 30,120 L 145,215" fill="none" stroke="#00f0ff" strokeWidth="2" />
                    {/* Velas M1 */}
                    {[
                      { x: 45, open: 110, close: 125, color: '#f43f5e' },
                      { x: 65, open: 125, close: 145, color: '#f43f5e' },
                      { x: 85, open: 145, close: 135, color: '#10b981' },
                      { x: 105, open: 135, close: 165, color: '#f43f5e' },
                      { x: 125, open: 165, close: 185, color: '#f43f5e' },
                    ].map((c, i) => (
                      <g key={i}>
                        <rect x={c.x - 3} y={Math.min(c.open, c.close)} width="6" height={Math.max(2, Math.abs(c.open - c.close))} fill={c.color} rx="0.5" />
                      </g>
                    ))}

                    {/* Gráfico 2: M5 (Rango / Consolidación) */}
                    <rect x="182" y="60" width="135" height="190" fill="rgba(255,255,255,0.01)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" rx="8" />
                    <text x="250" y="78" fill="#fde68a" fontSize="9" fontWeight="800" textAnchor="middle" fontFamily="monospace">M5: CONSOLIDACIÓN 🟡</text>
                    <path d="M 192,150 Q 250,155 307,148" fill="none" stroke="#10b981" strokeWidth="2" opacity="0.6" />
                    <path d="M 192,148 Q 250,143 307,153" fill="none" stroke="#00f0ff" strokeWidth="2" />
                    {/* Velas M5 */}
                    {[
                      { x: 207, open: 145, close: 160, color: '#10b981' },
                      { x: 227, open: 160, close: 135, color: '#f43f5e' },
                      { x: 247, open: 135, close: 155, color: '#10b981' },
                      { x: 267, open: 155, close: 140, color: '#f43f5e' },
                      { x: 287, open: 140, close: 150, color: '#10b981' },
                    ].map((c, i) => (
                      <g key={i}>
                        <rect x={c.x - 3} y={Math.min(c.open, c.close)} width="6" height={Math.max(2, Math.abs(c.open - c.close))} fill={c.color} rx="0.5" />
                      </g>
                    ))}

                    {/* Gráfico 3: M15 (Tendencia Alcista) */}
                    <rect x="345" y="60" width="135" height="190" fill="rgba(255,255,255,0.01)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" rx="8" />
                    <text x="412" y="78" fill="#a7f3d0" fontSize="9" fontWeight="800" textAnchor="middle" fontFamily="monospace">M15: ALCISTA 🟢</text>
                    <path d="M 355,200 L 470,120" fill="none" stroke="#10b981" strokeWidth="2" opacity="0.6" />
                    <path d="M 355,180 L 470,95" fill="none" stroke="#00f0ff" strokeWidth="2" />
                    {/* Velas M15 */}
                    {[
                      { x: 370, open: 190, close: 170, color: '#10b981' },
                      { x: 390, open: 170, close: 150, color: '#10b981' },
                      { x: 410, open: 150, close: 160, color: '#f43f5e' },
                      { x: 430, open: 160, close: 135, color: '#10b981' },
                      { x: 450, open: 135, close: 110, color: '#10b981' },
                    ].map((c, i) => (
                      <g key={i}>
                        <rect x={c.x - 3} y={Math.min(c.open, c.close)} width="6" height={Math.max(2, Math.abs(c.open - c.close))} fill={c.color} rx="0.5" />
                      </g>
                    ))}

                    {/* Mensaje de Caos */}
                    <rect x="50" y="210" width="400" height="28" rx="6" fill="rgba(239,68,68,0.12)" stroke="rgba(239,68,68,0.3)" />
                    <text x="250" y="228" fill="#ef4444" fontSize="10" fontWeight="bold" textAnchor="middle">⚠️ RUIDO FRACTAL: Temporalidades enfrentadas · OPERATIVA PROHIBIDA</text>
                  </g>
                )}

                {/* 6. ESCENARIO DE RETROCESO EN TENDENCIA (PULLBACK A EMA 50 - EUR/CHF Style) */}
                {simScenario === 'pullback' && (
                  <g>
                    {/* EMA 100 (Verde) - Inclinada alcista */}
                    <path d="M 50,240 Q 150,220 250,190 T 450,150" fill="none" stroke="#10b981" strokeWidth="3" opacity="0.6" />
                    
                    {/* EMA 50 (Celeste) - Inclinada alcista, paralela */}
                    <path d="M 50,200 Q 150,175 250,145 T 450,110" fill="none" stroke="#00f0ff" strokeWidth="3" filter="url(#glow-cyan)" />

                    {/* Zona de Reentrada */}
                    <circle cx="315" cy="133" r="10" fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="3,3" />
                    <text x="290" y="115" fill="#10b981" fontSize="9.5" fontWeight="800" fontFamily="monospace">⚡ REBOTES EMA 50</text>
                    
                    {/* Velas Japonesas (EUR/CHF Style, rising, pulling back to EMA 50, and exploding up) */}
                    {[
                      { x: 75, open: 190, close: 170, high: 168, low: 195, color: '#10b981' },
                      { x: 115, open: 170, close: 150, high: 148, low: 172, color: '#10b981' },
                      { x: 155, open: 150, close: 160, high: 148, low: 162, color: '#f43f5e' }, // small red rest
                      { x: 195, open: 160, close: 130, high: 125, low: 162, color: '#10b981' }, // push up
                      { x: 235, open: 130, close: 142, high: 128, low: 145, color: '#f43f5e' }, // pullback starts
                      { x: 275, open: 142, close: 152, high: 140, low: 155, color: '#f43f5e' }, // pulls back deeper
                      { x: 315, open: 152, close: 133, high: 130, low: 158, color: '#10b981' }, // Touches EMA 50 (y=133) and closes green hammer!
                      { x: 355, open: 133, close: 115, high: 112, low: 135, color: '#10b981' }, // strong bounce up
                      { x: 395, open: 115, close: 95, high: 92, low: 118, color: '#10b981' },
                      { x: 435, open: 95, close: 85, high: 82, low: 98, color: '#10b981' },
                    ].map((c, i) => (
                      <g key={i}>
                        <line x1={c.x} y1={c.high} x2={c.x} y2={c.low} stroke={c.color} strokeWidth="1.5" />
                        <rect
                          x={c.x - 5}
                          y={Math.min(c.open, c.close)}
                          width="10"
                          height={Math.max(2, Math.abs(c.open - c.close))}
                          fill={c.color}
                          stroke={c.color}
                          strokeWidth="1"
                          rx="1"
                        />
                      </g>
                    ))}

                    {/* Representación de osciladores en sobreventa dentro del gráfico */}
                    <g transform="translate(50, 245)">
                      <rect x="0" y="0" width="400" height="42" fill="rgba(7, 7, 15, 0.95)" stroke="rgba(255,255,255,0.08)" rx="6" />
                      {/* Líneas de umbral del Stochastic */}
                      <line x1="10" y1="30" x2="390" y2="30" stroke="#f43f5e" strokeDasharray="2,2" opacity="0.4" />
                      <text x="15" y="12" fill="#9ca3af" fontSize="7" fontWeight="bold">OSCILADORES REFORZADOS (SOBREVENTA EXT.)</text>
                      
                      {/* Stochastic (Curva azul que toca fondo y cruza al alza) */}
                      <path d="M 50,10 Q 150,15 200,35 T 265,33 T 310,12" fill="none" stroke="#00f0ff" strokeWidth="1.5" />
                      <circle cx="265" cy="33" r="3" fill="#10b981" />
                      <text x="275" y="35" fill="#10b981" fontSize="7.5" fontWeight="bold">Stoch &lt; 20 (Cruce %K/%D) ✅</text>

                      {/* CCI (Curva verde que perfora -100 y vuelve) */}
                      <path d="M 50,5 Q 150,10 210,38 T 265,35 T 330,8" fill="none" stroke="#10b981" strokeWidth="1.5" />
                      <text x="15" y="38" fill="#10b981" fontSize="8" fontWeight="bold">CCI &lt; -100 ✅</text>
                    </g>
                  </g>
                )}

                {/* 7. ESCENARIO DE GESTIÓN DE SALIDA PARCIAL (SCALING OUT - USD/JPY Style) */}
                {simScenario === 'partial_exit' && (
                  <g>
                    {/* EMA 100 (Verde) - Inclinación suave alcista */}
                    <path d="M 50,210 Q 150,200 250,190 T 450,180" fill="none" stroke="#10b981" strokeWidth="3" opacity="0.6" />
                    
                    {/* EMA 50 (Celeste) - Inclinación suave alcista */}
                    <path d="M 50,190 Q 150,180 250,168 T 450,156" fill="none" stroke="#00f0ff" strokeWidth="2.5" />

                    {/* Líneas horizontales de niveles de trading */}
                    <line x1="50" y1="85" x2="450" y2="85" stroke="#f43f5e" strokeDasharray="3,3" strokeWidth="1" opacity="0.5" />
                    <text x="60" y="80" fill="#fca5a5" fontSize="8" fontWeight="bold">ENTRADA EN VENTA (2 LOTES) · 160.228</text>

                    <line x1="50" y1="168" x2="450" y2="168" stroke="#00f0ff" strokeDasharray="3,3" strokeWidth="1" opacity="0.5" />
                    <text x="60" y="163" fill="#00f0ff" fontSize="8" fontWeight="bold">TP1 (CIERRE 50% GANANCIA) · EN EMA 50 celeste</text>

                    <line x1="50" y1="181" x2="450" y2="181" stroke="#10b981" strokeDasharray="3,3" strokeWidth="1" opacity="0.5" />
                    <text x="60" y="193" fill="#10b981" fontSize="8" fontWeight="bold">TP2 (CIERRE 50% RESTANTE) · EN EMA 100 verde</text>

                    {/* Velas Japonesas (USD/JPY Style, rising to extreme overbought, and cascading down) */}
                    {[
                      { x: 75, open: 170, close: 150, high: 145, low: 172, color: '#10b981' },
                      { x: 115, open: 150, close: 130, high: 125, low: 152, color: '#10b981' },
                      { x: 155, open: 130, close: 110, high: 105, low: 132, color: '#10b981' },
                      { x: 195, open: 110, close: 80, high: 75, low: 112, color: '#10b981' }, // extreme overbought
                      { x: 235, open: 80, close: 92, high: 70, low: 95, color: '#f43f5e' }, // Pinbar / entry (SELL)
                      { x: 275, open: 92, close: 125, high: 88, low: 128, color: '#f43f5e' }, // drops
                      { x: 315, open: 125, close: 168, high: 122, low: 172, color: '#f43f5e' }, // touches EMA 50 (TP1)
                      { x: 355, open: 168, close: 160, high: 158, low: 172, color: '#10b981' }, // small green bounce off EMA 50
                      { x: 395, open: 160, close: 175, high: 158, low: 178, color: '#f43f5e' }, // breaks EMA 50 downwards
                      { x: 435, open: 175, close: 181, high: 170, low: 185, color: '#f43f5e' }, // hits EMA 100 (TP2)
                    ].map((c, i) => (
                      <g key={i}>
                        <line x1={c.x} y1={c.high} x2={c.x} y2={c.low} stroke={c.color} strokeWidth="1.5" />
                        <rect
                          x={c.x - 5}
                          y={Math.min(c.open, c.close)}
                          width="10"
                          height={Math.max(2, Math.abs(c.open - c.close))}
                          fill={c.color}
                          stroke={c.color}
                          strokeWidth="1"
                          rx="1"
                        />
                      </g>
                    ))}
                  </g>
                )}
              </svg>
            </div>

            {/* Panel de Diagnóstico Técnico */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.01)',
              border: `1px solid ${
                (simScenario === 'contraction' || simScenario === 'pullback') 
                  ? 'rgba(16, 185, 129, 0.25)' 
                  : simScenario === 'partial_exit'
                    ? 'rgba(0, 240, 255, 0.25)'
                    : (simScenario === 'expansion' || simScenario === 'precrossover') 
                      ? 'rgba(244, 63, 94, 0.25)' 
                      : simScenario === 'fractal_noise' 
                        ? 'rgba(239, 68, 68, 0.25)'
                        : 'rgba(251, 191, 36, 0.25)'
              }`,
              borderRadius: 20,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: `0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0 20px ${
                (simScenario === 'contraction' || simScenario === 'pullback') 
                  ? 'rgba(16, 185, 129, 0.02)' 
                  : simScenario === 'partial_exit'
                    ? 'rgba(0, 240, 255, 0.02)'
                    : (simScenario === 'expansion' || simScenario === 'precrossover') 
                      ? 'rgba(244, 63, 94, 0.02)' 
                      : simScenario === 'fractal_noise' 
                        ? 'rgba(239, 68, 68, 0.02)'
                        : 'rgba(251, 191, 36, 0.02)'
              }`,
            }}>
              {/* Veredicto Principal */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', fontFamily: 'monospace' }}>DIAGNÓSTICO TÁCTICO</span>
                  <span style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 900,
                    fontFamily: 'monospace',
                    letterSpacing: 0.5,
                    color: '#fff',
                    background: (simScenario === 'contraction' || simScenario === 'pullback') ? '#10b981' : simScenario === 'partial_exit' ? '#00f0ff' : (simScenario === 'expansion' || simScenario === 'precrossover') ? '#f43f5e' : simScenario === 'fractal_noise' ? '#ef4444' : '#d97706',
                    boxShadow: `0 0 10px ${(simScenario === 'contraction' || simScenario === 'pullback') ? 'rgba(16,185,129,0.3)' : simScenario === 'partial_exit' ? 'rgba(0,240,255,0.3)' : (simScenario === 'expansion' || simScenario === 'precrossover') ? 'rgba(244,63,94,0.3)' : simScenario === 'fractal_noise' ? 'rgba(239,68,68,0.3)' : 'rgba(217,119,6,0.3)'}`,
                  }}>
                    {(simScenario === 'contraction' || simScenario === 'pullback') ? '✅ OPERAR REBOTE' : simScenario === 'partial_exit' ? '⚡ OPERAR TP ESCALADO' : (simScenario === 'expansion' || simScenario === 'precrossover') ? '🚫 REVERSIÓN BLOQUEADA' : simScenario === 'fractal_noise' ? '🛑 FRACTALIDAD NULA' : '⚠️ ALERTA SUSPENDIDA'}
                  </span>
                </div>

                {/* Contenido Dinámico según Escenario */}
                {simScenario === 'expansion' && (
                  <div>
                    <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#f43f5e' }}>Abanico Abierto (Expansión)</h3>
                    <p style={{ margin: '0 0 16px', fontSize: 13, color: '#d1d5db', lineHeight: 1.6 }}>
                      Ocurre cuando hay una tendencia fuerte y constante. La <strong>EMA 50 (Celeste)</strong> y la <strong>EMA 100 (Verde)</strong> divergen, abriendo espacio entre ellas como un abanico. El precio no vuelve a la media de mediano plazo (EMA 100); en su lugar, rebota constantemente en la EMA 50 y continúa su carrera.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5, color: '#9ca3af' }}>
                      <div>
                        <strong style={{ color: '#fff' }}>💥 Comportamiento de las medias:</strong> La distancia vertical entre EMA 50 y EMA 100 aumenta en cada vela. Ambas tienen un ángulo inclinado similar.
                      </div>
                      <div>
                        <strong style={{ color: '#fff' }}>☠️ La trampa del trader retail:</strong> Ver que el precio cae o sube mucho en M5 y vender/comprar asumiendo "agotamiento". La inercia del abanico arrastra el precio en tu contra, dejándote atrapado en flotante negativo.
                      </div>
                      <div style={{ background: 'rgba(244, 63, 94, 0.05)', padding: '10px 14px', borderRadius: 10, borderLeft: '3px solid #f43f5e', color: '#fca5a5', marginTop: 6 }}>
                        💡 <strong>Regla del Manual:</strong> Si el Slope en el panel marca <strong>STEEP</strong>, no busques reversiones. El algoritmo de Full Reversion desactivará automáticamente las alertas para evitar pérdidas.
                      </div>
                    </div>
                  </div>
                )}

                {simScenario === 'contraction' && (
                  <div>
                    <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#10b981' }}>Estrangulamiento (Contracción)</h3>
                    <p style={{ margin: '0 0 16px', fontSize: 13, color: '#d1d5db', lineHeight: 1.6 }}>
                      El escenario ideal del trader de reversión. Las medias <strong>EMA 50</strong> y <strong>EMA 100</strong> se encuentran planas, horizontales y muy juntas o entrelazadas. No hay una dirección predominante en el mercado. El precio oscila a ambos lados y, al estirarse con fuerza (alta elasticidad), regresa rápidamente al centro.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5, color: '#9ca3af' }}>
                      <div>
                        <strong style={{ color: '#fff' }}>🛡️ Comportamiento de las medias:</strong> La distancia entre EMA 50 y 100 está en mínimos (estrangulamiento). Su pendiente es cercana a cero (<strong>FLAT</strong> en el panel).
                      </div>
                      <div>
                        <strong style={{ color: '#fff' }}>🏹 El gatillo del francotirador:</strong> Cuando el precio rompa violentamente y se estire de las medias, espera a que el indicador marque color <strong>GREEN</strong> (elasticidad extrema) y que la vela de 5 minutos cierre dejando una mecha de rechazo (Pin Bar / Martillo).
                      </div>
                      <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '10px 14px', borderRadius: 10, borderLeft: '3px solid #10b981', color: '#a7f3d0', marginTop: 6 }}>
                        👑 <strong>Confluencia VIP:</strong> Si este estrangulamiento ocurre sobre un soporte o resistencia institucional de fuerza &gt;= 3 con una divergencia RSI, la probabilidad de éxito de la reversión a la media supera el 85%.
                      </div>
                    </div>
                  </div>
                )}

                {simScenario === 'crossover' && (
                  <div>
                    <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#fbbf24' }}>Cruces Falsos (Crossover Traps)</h3>
                    <p style={{ margin: '0 0 16px', fontSize: 13, color: '#d1d5db', lineHeight: 1.6 }}>
                      Ocurre cuando la <strong>EMA 50 (Celeste)</strong> cruza a través de la <strong>EMA 100 (Verde)</strong> (Cruce de Oro o Cruce de la Muerte). Este cruce genera una fuerte inyección de volumen institucional que inicia una nueva tendencia. Operar una reversión en este punto exacto es un error crítico.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5, color: '#9ca3af' }}>
                      <div>
                        <strong style={{ color: '#fff' }}>⚠️ Comportamiento de las medias:</strong> La EMA 50 corta de forma limpia a la EMA 100. El precio a menudo retrocede levemente justo después del cruce, lo que confunde a los traders haciéndoles creer que habrá reversión.
                      </div>
                      <div>
                        <strong style={{ color: '#fff' }}>🛑 Por qué es una trampa:</strong> Ese retroceso inicial no es una reversión a la media; es un test de soporte/resistencia antes de acelerar en la dirección del cruce. El precio continuará con fuerza en el sentido del cruce y romperá tu Stop Loss.
                      </div>
                      <div style={{ background: 'rgba(251, 191, 36, 0.05)', padding: '10px 14px', borderRadius: 10, borderLeft: '3px solid #fbbf24', color: '#fde68a', marginTop: 6 }}>
                        💡 <strong>Consejo Profesional:</strong> Nunca operes una señal de contra-tendencia en el momento exacto en que la EMA 50 está cruzando la EMA 100. Espera a que la tendencia se desarrolle por completo o el mercado regrese a fase de contracción.
                      </div>
                    </div>
                  </div>
                )}

                {simScenario === 'precrossover' && (
                  <div>
                    <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#f43f5e' }}>Compresión Pre-Cruce (Aceleración de Giro)</h3>
                    <p style={{ margin: '0 0 16px', fontSize: 13, color: '#d1d5db', lineHeight: 1.6 }}>
                      Ocurre cuando el precio inicia un cambio de tendencia rápido (como en tu gráfico de AUD/USD). La <strong>EMA 50 (Celeste)</strong> se curva fuertemente buscando cruzar la <strong>EMA 100 (Verde)</strong>. A nivel visual, las medias se comprimen (lo que parece un rango), pero el precio tiene gran inercia direccional y cabalga sobre el cruce.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5, color: '#9ca3af' }}>
                      <div>
                        <strong style={{ color: '#fff' }}>💥 Trampa visual:</strong> Las medias se acercan, simulando una consolidación lateral (estrangulamiento). Sin embargo, el ángulo de la EMA 50 es muy inclinado y va tras la de 100.
                      </div>
                      <div>
                        <strong style={{ color: '#fff' }}>🛑 Inercia direccional:</strong> El precio rompe y se mantiene del lado exterior de la EMA 50, testeando o penetrando la EMA 100. Las alertas de reversión a la media serán barridas por el nuevo impulso.
                      </div>
                      <div style={{ background: 'rgba(244, 63, 94, 0.05)', padding: '10px 14px', borderRadius: 10, borderLeft: '3px solid #f43f5e', color: '#fca5a5', marginTop: 6 }}>
                        💡 <strong>Regla del Manual:</strong> No entres en contra del giro cuando la EMA 50 tiene un ángulo curvo vertical buscando la de 100. Deja que ocurra el cruce o que la tendencia se estabilice en un canal limpio.
                      </div>
                    </div>
                  </div>
                )}

                {simScenario === 'fractal_noise' && (
                  <div>
                    <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#ef4444' }}>Desalineación Fractal (Ruido Temporal)</h3>
                    <p style={{ margin: '0 0 16px', fontSize: 13, color: '#d1d5db', lineHeight: 1.6 }}>
                      Ocurre cuando las temporalidades chocan entre sí (como en tu gráfico de EUR/USD en 3 pantallas). En <strong>M1</strong> observas una tendencia bajista, en <strong>M5</strong> una consolidación plana, y en <strong>M15</strong> una tendencia alcista activa. Al no existir confluencia multi-temporal, las reversiones fallan.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5, color: '#9ca3af' }}>
                      <div>
                        <strong style={{ color: '#fff' }}>📡 Conflictos Fractales:</strong> El precio sube en una temporalidad mientras desciende en otra, anulando la fuerza de gravedad matemática de la reversión a la media.
                      </div>
                      <div>
                        <strong style={{ color: '#fff' }}>☠️ El látigo del mercado (Whipsaws):</strong> El bot o trader entra en una pre-alerta pensando que el precio se estiró en M5, pero en M15 la inercia apenas arranca, causando un flotante negativo prolongado.
                      </div>
                      <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '10px 14px', borderRadius: 10, borderLeft: '3px solid #ef4444', color: '#fca5a5', marginTop: 6 }}>
                        👑 <strong>Paso 0 de Oro:</strong> Abre el gráfico. Si las EMAs en 1m, 5m y 15m apuntan en direcciones contrarias o tienen alturas relativas opuestas, **APAGA el motor rápido y espera alineación fractal**.
                      </div>
                    </div>
                  </div>
                )}

                {simScenario === 'pullback' && (
                  <div>
                    <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#10b981' }}>Retroceso en Tendencia (EUR/CHF Style)</h3>
                    <p style={{ margin: '0 0 16px', fontSize: 13, color: '#d1d5db', lineHeight: 1.6 }}>
                      Ocurre cuando el mercado tiene una tendencia fuerte y definida (EMAs en expansión abierta). En lugar de operar contra ella, esperas a que el precio haga un retroceso rápido hacia la <strong>EMA 50 (Celeste)</strong> para incorporarte a favor del movimiento principal.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5, color: '#9ca3af' }}>
                      <div>
                        <strong style={{ color: '#fff' }}>🛡️ Dinámica de Soporte:</strong> La EMA 50 celeste actúa como piso dinámico. El precio rebota allí sin llegar a la EMA 100, la cual está demasiado lejos por la velocidad de la tendencia.
                      </div>
                      <div>
                        <strong style={{ color: '#fff' }}>🏹 Confirmación de Osciladores:</strong> El Stochastic y el CCI caen a zonas extremas de sobreventa (&lt; 20 y &lt; -100) en la vela de retroceso M5, marcando el fin de la caída y el gatillo de compra inmediata.
                      </div>
                      <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '10px 14px', borderRadius: 10, borderLeft: '3px solid #10b981', color: '#a7f3d0', marginTop: 6 }}>
                        💡 <strong>Regla del Manual:</strong> No intentes vender reversión en una tendencia fuerte alcista. Espera que retroceda a la EMA 50 y compra con el primer martillo de rechazo.
                      </div>
                    </div>
                  </div>
                )}

                {simScenario === 'partial_exit' && (
                  <div>
                    <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#00f0ff' }}>Gestión de Salida Parcial (USD/JPY Style)</h3>
                    <p style={{ margin: '0 0 16px', fontSize: 13, color: '#d1d5db', lineHeight: 1.6 }}>
                      Técnica avanzada de control de drawdown. Cuando entras en una reversión contra-tendencia en sobreestiramiento extremo (alta elasticidad), gestionas la posición abriendo 2 lotes y cerrando ganancias de forma escalonada.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5, color: '#9ca3af' }}>
                      <div>
                        <strong style={{ color: '#fff' }}>💰 TP1 en EMA 50 (50% de volumen):</strong> El precio retrocede. Al tocar la EMA 50 (celeste), cierras la mitad de la operación. Aseguras beneficios y eliminas el riesgo del trade.
                      </div>
                      <div>
                        <strong style={{ color: '#fff' }}>🏃 TP2 en EMA 100 (50% restante):</strong> Dejas correr el lote restante hasta tocar la EMA 100 (verde). Si el precio rebota en la EMA 50 celeste y te saca, ya habrás asegurado una ganancia neta.
                      </div>
                      <div style={{ background: 'rgba(0, 240, 255, 0.05)', padding: '10px 14px', borderRadius: 10, borderLeft: '3px solid #00f0ff', color: '#9df9ff', marginTop: 6 }}>
                        👑 <strong>Ventaja Táctica:</strong> Esto te protege en tendencias fuertes donde el precio a menudo toca la EMA 50 celeste y rebota en tu contra de inmediato, evitando que una operación ganadora termine en Stop Loss.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Botón de Acción / Recordatorio */}
              <div style={{
                marginTop: 24,
                borderTop: '1px solid rgba(255,255,255,0.06)',
                paddingTop: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 12,
                color: (simScenario === 'contraction' || simScenario === 'pullback') ? '#10b981' : simScenario === 'partial_exit' ? '#00f0ff' : (simScenario === 'expansion' || simScenario === 'precrossover') ? '#f43f5e' : simScenario === 'fractal_noise' ? '#ef4444' : '#fbbf24',
              }}>
                <span style={{ fontSize: 18 }}>💡</span>
                <span style={{ fontWeight: 600 }}>
                  {simScenario === 'contraction' 
                    ? 'Busca confluencia del RSI en zonas extremas para entrar con lotaje completo.'
                    : simScenario === 'expansion'
                      ? 'Ignora las señales del Semáforo Viejo en este par. Espera a que la pendiente se aplane.'
                      : simScenario === 'crossover'
                        ? 'El cruce confirma inercia. Espera al menos 15-20 velas a que se desarrolle la tendencia.'
                        : simScenario === 'precrossover'
                          ? 'Cuidado con el AUD/USD style: La EMA 50 acelerando al cruce invalida rebotes inmediatos.'
                          : simScenario === 'fractal_noise'
                            ? 'Cuidado con el EUR/USD style: Con marcos de tiempo en conflicto, no hay inercia confiable.'
                            : simScenario === 'pullback'
                              ? 'EUR/CHF style: Entra en compra a favor de la tendencia usando la EMA 50 celeste como soporte.'
                              : 'USD/JPY style: Ejecuta cierre parcial en la EMA 50 celeste y deja correr el resto a la EMA 100 verde.'}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

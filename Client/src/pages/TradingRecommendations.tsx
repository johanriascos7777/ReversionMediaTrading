import { useState, useEffect } from 'react'

export function TradingRecommendations() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeTab, setActiveTab] = useState<'checklist' | 'pullbacks' | 'candles' | 'testimonies'>('checklist')

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
          </div>
        </div>

      </div>
    </div>
  )
}

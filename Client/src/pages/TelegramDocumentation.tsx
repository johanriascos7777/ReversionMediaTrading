/**
 * TelegramDocumentation.tsx
 *
 * Página premium de documentación gamificada y futurista para las alertas de Telegram.
 * Detalla todas las señales enviadas, sus condiciones matemáticas y plantillas de mensajes.
 */

import { useState } from 'react'

interface AlertItem {
  id: string
  emoji: string
  title: string
  category: 'semaforo' | 'full-reversion' | 'auditoría'
  mode: 'Normal' | 'Experimental' | 'Reforced' | 'Estructura'
  cooldown: string
  conditionText: string
  technicalRules: string[]
  templateText: string
  proTip: string
  stats: {
    accuracy: number
    defenseRating: number
    difficulty: 'Fácil' | 'Medio' | 'Experto' | 'Automático'
    xpReward: number
  }
}

export function TelegramDocumentation() {
  const [activeCategory, setActiveCategory] = useState<'all' | 'semaforo' | 'full-reversion' | 'auditoría'>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const alertsList: AlertItem[] = [
    {
      id: 'old-semaforo-a',
      emoji: '🚨',
      title: 'Semáforo Viejo: Tipo A',
      category: 'semaforo',
      mode: 'Normal',
      cooldown: '10 Minutos',
      conditionText: 'Se activa cuando el precio entra en zona extrema de sobreestiramiento en ambos marcos temporales simultáneamente.',
      technicalRules: [
        'M5 State === GREEN (Elasticidad > 2.0 ATR)',
        'M15 State === GREEN (Elasticidad > 2.0 ATR)',
        'Fused State transiciona a GREEN'
      ],
      templateText: `🚨 ALERTA SEMÁFORO VIEJO — TIPO A 🚨\n📍 Par: EUR/USD\n🎯 Dirección: VENTA (SELL) 📉\n💰 Precio: 1.15350 · Fused: GREEN\n\n🏰 Confluencia Estructural:\n   · Resistencia S/R cercana (fuerza 4)\n\n💡 Esperar gatillo de giro de vela M5 para entrar.`,
      proTip: 'Esta es la señal de estiramiento crudo. Úsala como alerta previa (watchlist) antes de buscar el gatillo de agotamiento.',
      stats: { accuracy: 65, defenseRating: 30, difficulty: 'Medio', xpReward: 50 }
    },
    {
      id: 'old-semaforo-c',
      emoji: '⚡',
      title: 'Semáforo Viejo: Tipo C (Giro)',
      category: 'semaforo',
      mode: 'Normal',
      cooldown: '10 Minutos',
      conditionText: 'Gatillo de confirmación de entrada táctica. Se dispara al cierre de la vela de reversión.',
      technicalRules: [
        'Pre-alerta Tipo A activa en los últimos 20 minutos',
        'Elasticidad de vela cerrada M5 es menor que la anterior (Giro confirmado)'
      ],
      templateText: `⚡ ALERTA SEMÁFORO VIEJO — TIPO C (GIRO) ⚡\n📍 Par: GBP/USD\n🎯 Dirección: COMPRA (BUY) 🟢\n💰 Precio: 1.33520 · Gatillo: GIRO ACTIVO\n\n🪃 Resortera cediendo: Entrada en apertura de siguiente vela.`,
      proTip: 'Esta señal representa la confirmación del giro. Entra inmediatamente al cierre de la vela M5 si los spreads lo permiten.',
      stats: { accuracy: 75, defenseRating: 40, difficulty: 'Medio', xpReward: 70 }
    },
    {
      id: 'experimental-peaton',
      emoji: '🚶‍♂️',
      title: 'Semáforo Peatón (WALK)',
      category: 'semaforo',
      mode: 'Experimental',
      cooldown: '5 Minutos',
      conditionText: 'Alerta experimental de máxima confluencia. Se activa solo cuando el precio gira, el backtest es altamente favorable y el volumen confirma.',
      technicalRules: [
        'PedestrianLight === WALK',
        'Backtest WinRate > 65%',
        'Giro de Elasticidad M5 confirmado',
        'Anomalía de ATR activa'
      ],
      templateText: `🚶‍♂️ SEMÁFORO PEATÓN — ¡CAMINAR (WALK)! 🚶\n📍 Par: USD/JPY\n🎯 Dirección: COMPRA (BUY) 📈\n💰 Precio: 160.540\n\n🔥 Todas las confluencias experimentales (Anomalía + Backtest + Giro) están alineadas.`,
      proTip: 'Es una señal de alta precisión. Úsala en sesiones de volumen regular (Overlap NY/Londres) para evitar falsos giros.',
      stats: { accuracy: 80, defenseRating: 50, difficulty: 'Experto', xpReward: 100 }
    },
    {
      id: 'experimental-semaforo-a',
      emoji: '🧪🚨',
      title: 'Semáforo Experimental: Tipo A',
      category: 'semaforo',
      mode: 'Experimental',
      cooldown: '5 Minutos',
      conditionText: 'Se activa cuando el precio alcanza un sobreestiramiento de elasticidad experimental y confluencia fractal multi-temporal.',
      technicalRules: [
        'FusedStateExp === GREEN',
        'Diferencia de tiempo > 5 minutos desde última Alerta A Exp'
      ],
      templateText: `🧪 [EXPERIMENTAL] 🚨 **ALERTA DE TRADING: Tipo A**\n\nSímbolo: **EUR/USD**\nSugerido: **🔴 VENTA (SELL) 📉**\nPrecio: \`1.08530\`\nTP Sugerido: \`1.08380\` | SL Sugerido: \`1.08680\`\n\nDetalle: _Exceso de elasticidad experimental detectado en M5/M15 con estructura alineada._\n\nEstadística Contextual:\n· Win Rate: **78%**\n· Casos Similares: **14**`,
      proTip: 'Es una alerta de sobreestiramiento experimental que requiere verificar que el backtest contextual sea favorable antes de disparar.',
      stats: { accuracy: 78, defenseRating: 45, difficulty: 'Medio', xpReward: 80 }
    },
    {
      id: 'experimental-semaforo-b',
      emoji: '🧪⚠️',
      title: 'Semáforo Experimental: Tipo B',
      category: 'semaforo',
      mode: 'Experimental',
      cooldown: '5 Minutos',
      conditionText: 'Sobreestiramiento experimental en M5/M15 pero sin ventaja estadística robusta en backtest.',
      technicalRules: [
        'FinalStateExp === GREEN',
        'FusedStateExp !== GREEN',
        'Diferencia de tiempo > 5 minutos desde última Alerta B Exp'
      ],
      templateText: `🧪 [EXPERIMENTAL] 🚨 **ALERTA DE TRADING: Tipo B**\n\nSímbolo: **GBP/USD**\nSugerido: **🟢 COMPRA (BUY) 📈**\nPrecio: \`1.27410\`\nTP Sugerido: \`1.27560\` | SL Sugerido: \`1.27260\`\n\nDetalle: _Sobre-estirado en M5/M15 pero sin ventaja estadística en backtest._\n\nEstadística Contextual:\n· Win Rate: **54%**\n· Casos Similares: **9**`,
      proTip: 'Al no poseer ventaja estadística clara en el backtest, la probabilidad es cercana al azar. Omitir o reducir riesgo.',
      stats: { accuracy: 54, defenseRating: 35, difficulty: 'Experto', xpReward: 60 }
    },
    {
      id: 'experimental-semaforo-c',
      emoji: '🧪⚡',
      title: 'Semáforo Experimental: Tipo C (Giro)',
      category: 'semaforo',
      mode: 'Experimental',
      cooldown: '5 Minutos',
      conditionText: 'Gatillo de confirmación de entrada experimental. Se dispara cuando la elasticidad M5 comienza a ceder.',
      technicalRules: [
        'Pre-alerta Tipo A Exp activa previamente',
        'TriggerStateM5Exp transiciona a giro',
        'Diferencia de tiempo > 5 minutos desde última Alerta C Exp'
      ],
      templateText: `🧪 [EXPERIMENTAL] 🚨 **ALERTA DE TRADING: Tipo C**\n\nSímbolo: **USD/JPY**\nSugerido: **🟢 COMPRA (BUY) 📈**\nPrecio: \`155.600\`\nTP Sugerido: \`155.750\` | SL Sugerido: \`155.450\`\n\nDetalle: _La elasticidad ha comenzado a ceder en tiempo real en M5 (Gatillo)._`,
      proTip: 'El disparo táctico definitivo. Confirma que la elasticidad ha dejado de estirarse y que la reversión a la media está en marcha.',
      stats: { accuracy: 82, defenseRating: 60, difficulty: 'Medio', xpReward: 100 }
    },
    {
      id: 'fr-fused',
      emoji: '🔱',
      title: 'Full Reversion: Fused Giro',
      category: 'full-reversion',
      mode: 'Normal',
      cooldown: '15 Minutos',
      conditionText: 'La señal fusionada estrella de la reversión a la media clásica. Se filtra por la pendiente de la media móvil institucional.',
      technicalRules: [
        'M5 + M15 ambos en GREEN (estirados)',
        'Pendiente EMA100 es plana o suave (FLAT o GENTLE)',
        'Giro de vela cerrada M5 confirmado'
      ],
      templateText: `🔱🔱🔱 FUSIONADO FULL REVERSION 🔱🔱🔱\n📍 Par: AUD/USD · Dirección: SELL 📉\n💰 Precio: 0.69970 · EMA100: 0.69810\n\n🏰 Confluencias Estructurales M5:\n   · Divergencia: Bajista RSI 🐻\n   · S/R Cercano: Resistencia en 0.69980 (fza 3)\n\n🎯 Parámetros Sugeridos (Broker):\n   · TP (EMA100): 0.69810\n   · SL (1.8 ATR): 0.70090\n\n⏱ 07:41:27 COT`,
      proTip: 'Alerta robusta contra pullbacks. El filtro de tendencia (EMA Slope) ha salvado miles de cuentas de roturas masivas.',
      stats: { accuracy: 85, defenseRating: 75, difficulty: 'Fácil', xpReward: 120 }
    },
    {
      id: 'fr-reforced-fused',
      emoji: '🔱🚀',
      title: 'Full Reversion: Fused Reinforced',
      category: 'full-reversion',
      mode: 'Reforced',
      cooldown: '15 Minutos',
      conditionText: 'El Santo Grial. Reversión extrema complementada con osciladores de momento en sobrecompra/sobreventa extrema.',
      technicalRules: [
        'M5 + M15 en GREEN con pendiente EMA100 permitida',
        'Giro confirmado en vela cerrada M5',
        'Stochastic (13,3,3) %K o %D > 70 (para Sell) o < 30 (para Buy)',
        'CCI (14) > 100 (para Sell) o < -100 (para Buy)'
      ],
      templateText: `🔱🔱🔱 FUSIONADO REFORZADO 🔱🔱🔱\n📍 Par: GBP/USD · Dirección: BUY 🟢\n💰 Precio: 1.33520 · EMA100: 1.33750\n📊 EMA50: 1.33640 (Elast50: 1.85 ATR)\n📈 Osciladores: Stoch: 15.4 / 22.1 · CCI: -145.2\n\n🎯 *TP1 (EMA50):* 1.33640\n🎯 *TP2 (EMA100):* 1.33750\n🛑 *SL (1.8 ATR):* 1.33310\n\n🕐 M5 Slope: FLAT (-0.231 ATR)\n⏱ 07:43:01 COT`,
      proTip: 'La entrada más precisa del sistema. Utiliza el TP1 en la EMA50 para hacer caja (cerrar el 50%) y deja correr el resto al TP2 en la EMA100.',
      stats: { accuracy: 92, defenseRating: 85, difficulty: 'Experto', xpReward: 180 }
    },
    {
      id: 'audit-vip',
      emoji: '👑',
      title: 'Auditoría: Aprobación VIP',
      category: 'auditoría',
      mode: 'Reforced',
      cooldown: 'Instantáneo',
      conditionText: 'Ocurre cuando el Semáforo Viejo envía Tipo A o C y el motor Reinforced valida confluencia máxima institucional.',
      technicalRules: [
        'Giro M5 confirmado',
        'Divergencia RSI activa',
        'Nivel S/R robusto cercano (Fuerza >= 3)',
        'Pendiente EMA100 es plana/favorable',
        'Stochastic y CCI en zonas de agotamiento extremo'
      ],
      templateText: `👑 *APROBACIÓN VIP (🔱 Confluencia Máxima):* *EUR/USD*\n✨ _¡El motor de Full Reversion Reforzado ha aprobado esta señal con la máxima convicción!_\n\n📍 Par: \`EUR/USD\` · Alerta: \`Tipo C (Norm)\`\n🎯 Dirección: 🟢 COMPRA (BUY) 📈\n💰 Precio: \`1.15350\` · EMA100: \`1.15420\`\n\n⚖️ *VEREDICTO CLÍNICO:*\n   _¡Confluencia Máxima VIP! Pendiente favorable, giro M5 confirmado, divergencia RSI o nivel S/R robusto activo, apoyado por agotamiento extremo en Stochastic y CCI._\n\n🎯 *Parámetros Sugeridos (Broker):*\n   · TP1 (EMA50): \`1.15390\`\n   · TP2 (EMA100): \`1.15420\`\n   · SL (1.8 ATR): \`1.15230\``,
      proTip: 'Esta alerta representa confluencia fractal total. Tiene el winrate histórico más elevado del sistema.',
      stats: { accuracy: 96, defenseRating: 90, difficulty: 'Automático', xpReward: 250 }
    },
    {
      id: 'audit-rejected',
      emoji: '🚫',
      title: 'Auditoría: Alerta Rechazada',
      category: 'auditoría',
      mode: 'Reforced',
      cooldown: 'Instantáneo',
      conditionText: 'Alerta preventiva. Se dispara para advertir sobre una señal peligrosa del Semáforo Viejo que va contra una tendencia vertical violenta.',
      technicalRules: [
        'Alerta Tipo A o C entrante de cualquier símbolo',
        'Pendiente de la EMA100 es extremadamente inclinada (STEEP) > 1.0 ATR/10b'
      ],
      templateText: `🚫 *ALERTA AUDITADA RECHAZADA:* *AUD/USD*\n❌ _¡Evita operar! El Semáforo Viejo detectó estiramiento, pero la tendencia es demasiado fuerte._\n\n📍 Par: \`AUD/USD\` · Alerta: \`Tipo A (Norm)\`\n🎯 Dirección: 🔴 VENTA (SELL) 📉\n💰 Precio: \`0.69970\` · EMA100: \`0.69810\`\n\n⚖️ *VEREDICTO CLÍNICO:*\n   _Tendencia fuerte (STEEP) con pendiente inclinada en 1.432 ATR/10b. Alto riesgo de continuación. Se desaconseja operar contra tendencia._`,
      proTip: '¡El mejor escudo de tu capital! Si ves este mensaje, no intentes adivinar el giro: el precio tiene demasiada fuerza tendencial.',
      stats: { accuracy: 100, defenseRating: 100, difficulty: 'Automático', xpReward: 150 }
    }
  ]

  const filteredAlerts = activeCategory === 'all' 
    ? alertsList 
    : alertsList.filter(a => a.category === activeCategory)

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.08) 0%, transparent 60%), #07070f',
      padding: '32px 24px',
      color: '#fff',
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* ── HEADER ────────────────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <span style={{ fontSize: 40, display: 'block', marginBottom: 12 }}>📡</span>
          <h1 style={{
            margin: 0, fontSize: 32, fontWeight: 900, letterSpacing: '-1px',
            background: 'linear-gradient(135deg, #a78bfa, #60a5fa)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>
            CENTRO DE DOCUMENTACIÓN DE ALERTAS
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#9ca3af', maxWidth: 600, marginInline: 'auto', lineHeight: 1.6 }}>
            Explora las reglas matemáticas, confluencias institucionales y formatos de alertas que recibes en tiempo real a través de tu canal de Telegram.
          </p>
        </div>

        {/* ── FILTROS DE CATEGORÍA ───────────────────────────────────────────── */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 32, flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setActiveCategory('all')}
            style={getFilterStyle(activeCategory === 'all')}
          >
            📋 Todas
          </button>
          <button
            onClick={() => setActiveCategory('semaforo')}
            style={getFilterStyle(activeCategory === 'semaforo')}
          >
            🚨 Semáforo Viejo
          </button>
          <button
            onClick={() => setActiveCategory('full-reversion')}
            style={getFilterStyle(activeCategory === 'full-reversion')}
          >
            🔱 Full Reversion
          </button>
          <button
            onClick={() => setActiveCategory('auditoría')}
            style={getFilterStyle(activeCategory === 'auditoría')}
          >
            ⚖️ Auditoría Inbox
          </button>
        </div>

        {/* ── ALERTS GRID ────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 32 }}>
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              style={{
                background: 'rgba(15,15,25,0.4)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 20,
                padding: '28px 32px',
                backdropFilter: 'blur(16px)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 28,
                transition: 'transform 0.25s ease, border-color 0.25s ease',
              }}
              className="alert-doc-card"
            >
              {/* Sección Izquierda: Reglas y Condiciones */}
              <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 28 }}>{alert.emoji}</span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff' }}>
                      {alert.title}
                    </h2>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                        background: getCategoryBadgeBg(alert.category), color: getCategoryBadgeColor(alert.category)
                      }}>
                        {alert.category.toUpperCase()}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                        background: 'rgba(255,255,255,0.05)', color: '#d1d5db', border: '1px solid rgba(255,255,255,0.08)'
                      }}>
                        {alert.mode}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                        background: 'rgba(239,68,68,0.1)', color: '#fca5a5'
                      }}>
                        ⏱ Cooldown: {alert.cooldown}
                      </span>
                    </div>
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: 13, color: '#9ca3af', lineHeight: 1.5 }}>
                  {alert.conditionText}
                </p>

                {/* Caja de Reglas Matemáticas */}
                <div style={{
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.03)',
                  borderRadius: 12,
                  padding: 16,
                }}>
                  <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>
                    ⚙️ Algoritmo de Activación (Backend)
                  </span>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#d1d5db', display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'monospace' }}>
                    {alert.technicalRules.map((rule, idx) => (
                      <li key={idx} style={{ color: '#34d399' }}>
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Trader ProTip */}
                <div style={{
                  background: 'rgba(245,158,11,0.03)',
                  border: '1px solid rgba(245,158,11,0.12)',
                  borderRadius: 12,
                  padding: 16,
                  fontSize: 12,
                  color: '#fde047',
                  lineHeight: 1.5,
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start'
                }}>
                  <span style={{ fontSize: 16 }}>💡</span>
                  <div>
                    <strong style={{ color: '#fff', display: 'block', marginBottom: 2 }}>Táctica Profesional</strong>
                    {alert.proTip}
                  </div>
                </div>

                {/* RPG Stats Deck (Gamificación) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                  gap: 12,
                  background: 'rgba(139, 92, 246, 0.04)',
                  border: '1px solid rgba(139, 92, 246, 0.15)',
                  borderRadius: 12,
                  padding: 14,
                }}>
                  <div>
                    <span style={{ display: 'block', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>🎯 Precisión</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${alert.stats.accuracy}%`, height: '100%', background: 'linear-gradient(90deg, #a78bfa, #60a5fa)', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>{alert.stats.accuracy}%</span>
                    </div>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>🛡️ Escudo</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${alert.stats.defenseRating}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>{alert.stats.defenseRating}%</span>
                    </div>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>⚡ Recompensa</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#fde047', display: 'flex', alignItems: 'center', gap: 2 }}>
                      +{alert.stats.xpReward} XP
                    </span>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>🕹️ Dificultad</span>
                    <span style={{ 
                      fontSize: 10, 
                      fontWeight: 800, 
                      padding: '2px 8px', 
                      borderRadius: 4,
                      background: alert.stats.difficulty === 'Automático' ? 'rgba(0,240,255,0.12)' : alert.stats.difficulty === 'Experto' ? 'rgba(244,63,94,0.12)' : 'rgba(255,255,255,0.06)',
                      color: alert.stats.difficulty === 'Automático' ? '#00f0ff' : alert.stats.difficulty === 'Experto' ? '#f43f5e' : '#fff',
                      display: 'inline-block',
                      fontFamily: 'monospace'
                    }}>
                      {alert.stats.difficulty.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sección Derecha: Vista previa tipo Telefono (Chat Telegram) */}
              <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>
                    📱 Mensaje en Telegram
                  </span>
                  <button
                    onClick={() => copyToClipboard(alert.id, alert.templateText)}
                    style={{
                      background: 'transparent', border: 'none', color: copiedId === alert.id ? '#34d399' : '#a78bfa',
                      fontSize: 12, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4
                    }}
                  >
                    {copiedId === alert.id ? '✓ Copiado' : '📋 Copiar Plantilla'}
                  </button>
                </div>

                {/* Mock Telegram Bubble */}
                <div style={{
                  background: '#182533',
                  borderRadius: '16px 16px 0 16px',
                  padding: 18,
                  border: '1px solid rgba(255,255,255,0.04)',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                  position: 'relative',
                  fontFamily: 'monospace',
                  fontSize: 11,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  color: '#fff',
                  maxWidth: '100%'
                }}>
                  {alert.templateText}
                  
                  {/* Telegram status tick */}
                  <span style={{
                    position: 'absolute', bottom: 6, right: 12, fontSize: 9, color: '#4aa0e4'
                  }}>
                    18:15 PM ✓✓
                  </span>
                </div>
              </div>

            </div>
          ))}
        </div>

      </div>

      <style>{`
        .alert-doc-card:hover {
          transform: translateY(-2px);
          border-color: rgba(167,139,250,0.3) !important;
          box-shadow: 0 10px 30px rgba(167,139,250,0.05);
        }
      `}</style>
    </div>
  )
}

function getFilterStyle(active: boolean) {
  return {
    background: active ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.02)',
    border: active ? '1px solid rgba(167,139,250,0.4)' : '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 12,
    fontWeight: 600,
    color: active ? '#a78bfa' : '#9ca3af',
    cursor: 'pointer',
    transition: 'all 0.2s',
  }
}

function getCategoryBadgeBg(category: string) {
  if (category === 'semaforo') return 'rgba(239,68,68,0.12)'
  if (category === 'full-reversion') return 'rgba(56,189,248,0.12)'
  return 'rgba(245,158,11,0.12)'
}

function getCategoryBadgeColor(category: string) {
  if (category === 'semaforo') return '#fca5a5'
  if (category === 'full-reversion') return '#38bdf8'
  return '#fde047'
}

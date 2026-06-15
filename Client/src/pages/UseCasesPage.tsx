import React, { useState } from 'react'

type Direction = 'bullish' | 'bearish'

interface CaseStudy {
  id: string
  title: string
  subtitle: string
  verdict: 'OPERAR' | 'EVITAR' | 'ALERTA'
  verdictColor: string
  verdictBg: string
  verdictText: string
  description: string
  rules: string[]
  bullishChart: React.ReactNode
  bearishChart: React.ReactNode
}

export function UseCasesPage() {
  const [direction, setDirection] = useState<Direction>('bullish')
  const [activeCase, setActiveCase] = useState<string>('fractal')
  const [animKey, setAnimKey] = useState<number>(0)

  // Reiniciar animaciones al cambiar dirección
  const handleDirectionChange = (dir: Direction) => {
    setDirection(dir)
    setAnimKey(prev => prev + 1)
  }

  // Casos de Uso
  const cases: CaseStudy[] = [
    {
      id: 'fractal',
      title: 'Alineación Fractal Perfecta',
      subtitle: 'Confluencia extrema en múltiples temporalidades (M1, M5, M15)',
      verdict: 'OPERAR',
      verdictColor: '#10b981',
      verdictBg: 'rgba(16, 185, 129, 0.12)',
      verdictText: 'Alta Probabilidad de Reversión',
      description: 'Las EMAs en todas las temporalidades tienen el mismo ángulo e inclinación. El precio ha corrido con fuerza expandiéndose (estirando el elástico) muy por encima de la EMA50 (celeste) y de la EMA100 (oscura). La tensión elástica es máxima y la dirección del fractal es unánime.',
      rules: [
        'Las pendientes de la EMA50 y EMA100 en M1, M5 y M15 son paralelas.',
        'El precio está en zona de sobrecompra/sobreventa extrema respecto a ambas EMAs.',
        'Se busca una entrada rápida apostando a que el precio colapsará de regreso hacia la EMA100 (retorno a la media).'
      ],
      bullishChart: (
        <svg viewBox="0 0 400 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          {/* Grid lines */}
          {[40, 80, 120, 160].map((y, i) => (
            <line key={i} x1="0" y1={y} x2="400" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          ))}
          {/* EMA 100 - Dark Blue */}
          <path
            d="M -10,170 C 100,165 200,135 410,90"
            fill="none"
            stroke="#1d4ed8"
            strokeWidth="3"
            strokeLinecap="round"
            filter="drop-shadow(0 2px 8px rgba(29, 78, 216, 0.4))"
          />
          {/* EMA 50 - Light Blue */}
          <path
            d="M -10,150 C 100,140 200,105 410,55"
            fill="none"
            stroke="#06b6d4"
            strokeWidth="3"
            strokeLinecap="round"
            filter="drop-shadow(0 2px 8px rgba(6, 182, 212, 0.4))"
          />
          {/* Target Zone indicator */}
          <path
            d="M 270,30 L 290,10 L 330,10 L 330,40 L 310,40 Z"
            fill="rgba(16, 185, 129, 0.1)"
            stroke="#10b981"
            strokeWidth="1"
            strokeDasharray="3,3"
          />
          <text x="300" y="25" fill="#10b981" fontSize="9" fontWeight="bold" textAnchor="middle">ZONA ENTRY</text>

          {/* Reversion path indicator arrow */}
          <path
            d="M 330,35 Q 310,95 280,122"
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeDasharray="4,4"
            markerEnd="url(#arrow-green)"
          />
          <text x="325" y="85" fill="#10b981" fontSize="10" fontWeight="bold">Reversión a la 100</text>

          {/* Candlesticks representing price */}
          {/* format: [cx, openY, closeY, lowY, highY] */}
          {[
            [20, 165, 160, 170, 158],
            [50, 160, 150, 163, 148],
            [80, 150, 138, 153, 135],
            [110, 138, 142, 145, 134], // red
            [140, 142, 120, 144, 115],
            [170, 120, 105, 125, 102],
            [200, 105, 90, 110, 85],
            [230, 90, 70, 95, 68],
            [260, 70, 45, 75, 40],
            [290, 45, 30, 48, 25],
            [320, 30, 25, 35, 18], // climax candle
            [350, 28, 48, 22, 52], // reversal starts (red)
            [380, 48, 75, 45, 80]  // heading down (red)
          ].map(([x, op, cl, lo, hi], idx) => {
            const isGreen = cl < op
            const color = isGreen ? '#10b981' : '#ef4444'
            return (
              <g key={idx} opacity="0.95">
                <line x1={x} y1={lo} x2={x} y2={hi} stroke={color} strokeWidth="1.5" />
                <rect
                  x={x - 4}
                  y={Math.min(op, cl)}
                  width="8"
                  height={Math.max(Math.abs(cl - op), 2)}
                  fill={color}
                  rx="1"
                />
              </g>
            )
          })}

          <defs>
            <marker id="arrow-green" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
            </marker>
          </defs>
        </svg>
      ),
      bearishChart: (
        <svg viewBox="0 0 400 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          {/* Grid lines */}
          {[40, 80, 120, 160].map((y, i) => (
            <line key={i} x1="0" y1={y} x2="400" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          ))}
          {/* EMA 100 - Dark Blue */}
          <path
            d="M -10,30 C 100,35 200,65 410,110"
            fill="none"
            stroke="#1d4ed8"
            strokeWidth="3"
            strokeLinecap="round"
            filter="drop-shadow(0 2px 8px rgba(29, 78, 216, 0.4))"
          />
          {/* EMA 50 - Light Blue */}
          <path
            d="M -10,50 C 100,60 200,95 410,145"
            fill="none"
            stroke="#06b6d4"
            strokeWidth="3"
            strokeLinecap="round"
            filter="drop-shadow(0 2px 8px rgba(6, 182, 212, 0.4))"
          />
          {/* Target Zone indicator */}
          <path
            d="M 270,170 L 290,190 L 330,190 L 330,160 L 310,160 Z"
            fill="rgba(16, 185, 129, 0.1)"
            stroke="#10b981"
            strokeWidth="1"
            strokeDasharray="3,3"
          />
          <text x="300" y="182" fill="#10b981" fontSize="9" fontWeight="bold" textAnchor="middle">ZONA ENTRY</text>

          {/* Reversion path indicator arrow */}
          <path
            d="M 330,165 Q 310,105 280,78"
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeDasharray="4,4"
            markerEnd="url(#arrow-green-bear)"
          />
          <text x="325" y="115" fill="#10b981" fontSize="10" fontWeight="bold">Reversión a la 100</text>

          {/* Candlesticks representing price */}
          {[
            [20, 35, 40, 30, 42],
            [50, 40, 50, 37, 52],
            [80, 50, 62, 47, 65],
            [110, 62, 58, 66, 55], // green
            [140, 58, 80, 56, 85],
            [170, 80, 95, 75, 98],
            [200, 95, 110, 90, 115],
            [230, 110, 130, 105, 132],
            [260, 130, 155, 125, 160],
            [290, 155, 170, 152, 175],
            [320, 170, 175, 165, 182], // climax
            [350, 172, 152, 178, 148], // green reversal
            [380, 152, 125, 155, 120]  // heading up (green)
          ].map(([x, op, cl, lo, hi], idx) => {
            const isGreen = cl < op
            const color = isGreen ? '#10b981' : '#ef4444'
            return (
              <g key={idx} opacity="0.95">
                <line x1={x} y1={lo} x2={x} y2={hi} stroke={color} strokeWidth="1.5" />
                <rect
                  x={x - 4}
                  y={Math.min(op, cl)}
                  width="8"
                  height={Math.max(Math.abs(cl - op), 2)}
                  fill={color}
                  rx="1"
                />
              </g>
            )
          })}

          <defs>
            <marker id="arrow-green-bear" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
            </marker>
          </defs>
        </svg>
      )
    },
    {
      id: 'cross',
      title: 'Cruce de Pendiente (Golden / Death Cross)',
      subtitle: 'Cruce de EMAs en 5m indicando fuerza en la nueva tendencia',
      verdict: 'EVITAR',
      verdictColor: '#ef4444',
      verdictBg: 'rgba(239, 68, 68, 0.12)',
      verdictText: 'Peligro de Tendencia Fuerte',
      description: 'La EMA50 (celeste) cruza la EMA100 (oscura) con una inclinación muy pronunciada. Aunque el precio retrocede hacia la EMA100, el cruce reciente genera una enorme inercia y fuerza de continuación de la tendencia. Operar reversión en contra del cruce suele terminar en rotura violenta.',
      rules: [
        'La EMA50 acaba de cruzar la EMA100 hace pocas velas.',
        'Ambas líneas se abren con ángulo divergente, demostrando aceleración.',
        'Si el precio regresa a la EMA100, NO busques reversión; la EMA100 actuará como soporte/resistencia dinámica para lanzar el precio a favor del cruce.'
      ],
      bullishChart: (
        <svg viewBox="0 0 400 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          {/* Grid lines */}
          {[40, 80, 120, 160].map((y, i) => (
            <line key={i} x1="0" y1={y} x2="400" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          ))}
          {/* EMA 100 - Dark Blue */}
          <path
            d="M -10,130 Q 150,130 410,100"
            fill="none"
            stroke="#1d4ed8"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* EMA 50 - Light Blue (Crosses from below) */}
          <path
            d="M -10,160 Q 130,135 250,110 T 410,65"
            fill="none"
            stroke="#06b6d4"
            strokeWidth="3"
            strokeLinecap="round"
            filter="drop-shadow(0 2px 8px rgba(6, 182, 212, 0.3))"
          />
          {/* Cross label indicator */}
          <circle cx="205" cy="118" r="10" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="3,2" />
          <text x="205" y="100" fill="#ef4444" fontSize="9" fontWeight="bold" textAnchor="middle">CRUCE RECIENTE</text>

          {/* Danger zone / Continuation arrow */}
          <path
            d="M 290,105 Q 330,85 370,60"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
            markerEnd="url(#arrow-red)"
          />
          <text x="350" y="95" fill="#ef4444" fontSize="10" fontWeight="bold" textAnchor="middle">Fuerza Trend</text>

          {/* Candlesticks showing price crossing and bouncing up on EMA100 */}
          {[
            [20, 150, 142, 155, 140],
            [50, 142, 145, 148, 140],
            [80, 145, 130, 148, 128],
            [110, 130, 115, 132, 110],
            [140, 115, 122, 125, 112],
            [170, 122, 95, 125, 90], // price shoots up
            [200, 95, 80, 98, 75],
            [230, 80, 90, 82, 95],   // pullback to EMA100 (red)
            [260, 90, 102, 92, 108], // touches EMA100 and holds (red)
            [290, 102, 90, 105, 88], // bounces off EMA100 (green)
            [320, 90, 75, 92, 72],   // continuation (green)
            [350, 75, 60, 78, 58],
            [380, 60, 48, 62, 45]
          ].map(([x, op, cl, lo, hi], idx) => {
            const isGreen = cl < op
            const color = isGreen ? '#10b981' : '#ef4444'
            return (
              <g key={idx} opacity="0.95">
                <line x1={x} y1={lo} x2={x} y2={hi} stroke={color} strokeWidth="1.5" />
                <rect
                  x={x - 4}
                  y={Math.min(op, cl)}
                  width="8"
                  height={Math.max(Math.abs(cl - op), 2)}
                  fill={color}
                  rx="1"
                />
              </g>
            )
          })}

          <defs>
            <marker id="arrow-red" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
            </marker>
          </defs>
        </svg>
      ),
      bearishChart: (
        <svg viewBox="0 0 400 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          {/* Grid lines */}
          {[40, 80, 120, 160].map((y, i) => (
            <line key={i} x1="0" y1={y} x2="400" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          ))}
          {/* EMA 100 - Dark Blue */}
          <path
            d="M -10,70 Q 150,70 410,100"
            fill="none"
            stroke="#1d4ed8"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* EMA 50 - Light Blue (Crosses from above) */}
          <path
            d="M -10,40 Q 130,65 250,90 T 410,135"
            fill="none"
            stroke="#06b6d4"
            strokeWidth="3"
            strokeLinecap="round"
            filter="drop-shadow(0 2px 8px rgba(6, 182, 212, 0.3))"
          />
          {/* Cross label indicator */}
          <circle cx="205" cy="82" r="10" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="3,2" />
          <text x="205" y="65" fill="#ef4444" fontSize="9" fontWeight="bold" textAnchor="middle">CRUCE RECIENTE</text>

          {/* Danger zone / Continuation arrow */}
          <path
            d="M 290,95 Q 330,115 370,140"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
            markerEnd="url(#arrow-red-bear)"
          />
          <text x="350" y="115" fill="#ef4444" fontSize="10" fontWeight="bold" textAnchor="middle">Fuerza Trend</text>

          {/* Candlesticks showing price crossing and bouncing down on EMA100 */}
          {[
            [20, 50, 58, 45, 60],
            [50, 58, 55, 60, 52],
            [80, 55, 70, 52, 72],
            [110, 70, 85, 68, 90],
            [140, 85, 78, 88, 75],
            [170, 78, 105, 75, 110], // price drops
            [200, 105, 120, 102, 125],
            [230, 120, 110, 118, 105],   // pullback to EMA100 (green)
            [260, 110, 98, 108, 92],    // touches EMA100 and holds (green)
            [290, 98, 110, 95, 112],    // bounces off EMA100 (red)
            [320, 110, 125, 108, 128],  // continuation (red)
            [350, 125, 140, 122, 142],
            [380, 140, 152, 138, 155]
          ].map(([x, op, cl, lo, hi], idx) => {
            const isGreen = cl < op
            const color = isGreen ? '#10b981' : '#ef4444'
            return (
              <g key={idx} opacity="0.95">
                <line x1={x} y1={lo} x2={x} y2={hi} stroke={color} strokeWidth="1.5" />
                <rect
                  x={x - 4}
                  y={Math.min(op, cl)}
                  width="8"
                  height={Math.max(Math.abs(cl - op), 2)}
                  fill={color}
                  rx="1"
                />
              </g>
            )
          })}

          <defs>
            <marker id="arrow-red-bear" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
            </marker>
          </defs>
        </svg>
      )
    },
    {
      id: 'sandwich',
      title: 'Sándwich de EMAs (Compresión)',
      subtitle: 'Rango de baja volatilidad, precio atrapado en zona muerta',
      verdict: 'ALERTA',
      verdictColor: '#f59e0b',
      verdictBg: 'rgba(245, 158, 11, 0.12)',
      verdictText: 'Sin Operación / Ruido Alto',
      description: 'El precio se encuentra oscilando en un rango muy estrecho entre la EMA50 y la EMA100. Ambas medias móviles están planas y no hay separación clara. La elasticidad es casi nula. Entrar aquí significa pagar comisiones e irse a pérdida en un mercado sin tendencia clara.',
      rules: [
        'EMA50 y EMA100 están casi horizontales (pendientes planas).',
        'La distancia entre ambas EMAs es muy pequeña.',
        'El precio corta continuamente ambas líneas sin decisión. Se debe esperar que el precio rompa y las EMAs se separen.'
      ],
      bullishChart: (
        <svg viewBox="0 0 400 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          {/* Grid lines */}
          {[40, 80, 120, 160].map((y, i) => (
            <line key={i} x1="0" y1={y} x2="400" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          ))}
          {/* EMA 100 - Dark Blue */}
          <line x1="-10" y1="105" x2="410" y2="105" stroke="#1d4ed8" strokeWidth="3" strokeLinecap="round" />
          {/* EMA 50 - Light Blue */}
          <line x1="-10" y1="92" x2="410" y2="92" stroke="#06b6d4" strokeWidth="3" strokeLinecap="round" />

          {/* Compressed area fill */}
          <rect x="0" y="85" width="400" height="30" fill="rgba(245, 158, 11, 0.05)" stroke="rgba(245, 158, 11, 0.15)" strokeWidth="1" strokeDasharray="2,2" />
          <text x="200" y="75" fill="#f59e0b" fontSize="9" fontWeight="bold" textAnchor="middle">ZONA MUERTA (COMPRESIÓN)</text>

          {/* Candlesticks chop */}
          {[
            [20, 95, 102, 92, 105],
            [50, 102, 90, 104, 88],
            [80, 90, 98, 88, 100],
            [110, 98, 93, 101, 91],
            [140, 93, 104, 91, 106],
            [170, 104, 89, 106, 87],
            [200, 89, 97, 86, 99],
            [230, 97, 102, 95, 105],
            [260, 102, 91, 104, 89],
            [290, 91, 95, 88, 98],
            [320, 95, 103, 93, 106],
            [350, 103, 90, 105, 88],
            [380, 90, 96, 88, 100]
          ].map(([x, op, cl, lo, hi], idx) => {
            const isGreen = cl < op
            const color = isGreen ? '#10b981' : '#ef4444'
            return (
              <g key={idx} opacity="0.8">
                <line x1={x} y1={lo} x2={x} y2={hi} stroke={color} strokeWidth="1.5" />
                <rect
                  x={x - 4}
                  y={Math.min(op, cl)}
                  width="8"
                  height={Math.max(Math.abs(cl - op), 2)}
                  fill={color}
                  rx="1"
                />
              </g>
            )
          })}
        </svg>
      ),
      bearishChart: (
        // El sándwich es el mismo lateral
        <svg viewBox="0 0 400 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          {/* Grid lines */}
          {[40, 80, 120, 160].map((y, i) => (
            <line key={i} x1="0" y1={y} x2="400" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          ))}
          {/* EMA 100 - Dark Blue */}
          <line x1="-10" y1="95" x2="410" y2="95" stroke="#1d4ed8" strokeWidth="3" strokeLinecap="round" />
          {/* EMA 50 - Light Blue */}
          <line x1="-10" y1="108" x2="410" y2="108" stroke="#06b6d4" strokeWidth="3" strokeLinecap="round" />

          {/* Compressed area fill */}
          <rect x="0" y="85" width="400" height="32" fill="rgba(245, 158, 11, 0.05)" stroke="rgba(245, 158, 11, 0.15)" strokeWidth="1" strokeDasharray="2,2" />
          <text x="200" y="75" fill="#f59e0b" fontSize="9" fontWeight="bold" textAnchor="middle">ZONA MUERTA (COMPRESIÓN)</text>

          {/* Candlesticks chop */}
          {[
            [20, 100, 95, 102, 93],
            [50, 95, 104, 93, 106],
            [80, 104, 91, 106, 89],
            [110, 91, 98, 88, 100],
            [140, 98, 102, 96, 104],
            [170, 102, 94, 105, 92],
            [200, 94, 106, 92, 108],
            [230, 106, 91, 108, 89],
            [260, 91, 98, 89, 100],
            [290, 98, 103, 96, 105],
            [320, 103, 95, 106, 93],
            [350, 95, 101, 93, 103],
            [380, 101, 92, 103, 90]
          ].map(([x, op, cl, lo, hi], idx) => {
            const isGreen = cl < op
            const color = isGreen ? '#10b981' : '#ef4444'
            return (
              <g key={idx} opacity="0.8">
                <line x1={x} y1={lo} x2={x} y2={hi} stroke={color} strokeWidth="1.5" />
                <rect
                  x={x - 4}
                  y={Math.min(op, cl)}
                  width="8"
                  height={Math.max(Math.abs(cl - op), 2)}
                  fill={color}
                  rx="1"
                />
              </g>
            )
          })}
        </svg>
      )
    },
    {
      id: 'divergence',
      title: 'Divergencia de Momentum',
      subtitle: 'EMA100 mantiene tendencia pero EMA50 se aplana (Agotamiento)',
      verdict: 'OPERAR',
      verdictColor: '#10b981',
      verdictBg: 'rgba(16, 185, 129, 0.12)',
      verdictText: 'Confirmación de Agotamiento',
      description: 'La tendencia mayor (EMA100) sigue subiendo/bajando, pero la EMA50 empieza a curvarse y ponerse completamente plana. Esto demuestra que la fuerza del corto plazo ha finalizado, incrementando drásticamente la probabilidad de que el precio regrese y cruce temporalmente la EMA100.',
      rules: [
        'La EMA100 tiene pendiente alcista/bajista clara.',
        'La EMA50 (celeste) se aplana o apunta en dirección opuesta (curvatura de hombro).',
        'El precio ya ha cruzado la EMA50 y se dirige inexorablemente a buscar la EMA100.'
      ],
      bullishChart: (
        <svg viewBox="0 0 400 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          {/* Grid lines */}
          {[40, 80, 120, 160].map((y, i) => (
            <line key={i} x1="0" y1={y} x2="400" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          ))}
          {/* EMA 100 - Dark Blue (continuing trend) */}
          <path
            d="M -10,165 C 100,150 200,120 410,75"
            fill="none"
            stroke="#1d4ed8"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* EMA 50 - Light Blue (Flattening / Curving down) */}
          <path
            d="M -10,135 C 100,110 200,70 300,70 Q 350,73 410,88"
            fill="none"
            stroke="#06b6d4"
            strokeWidth="3"
            strokeLinecap="round"
            filter="drop-shadow(0 2px 8px rgba(6, 182, 212, 0.3))"
          />
          {/* Flattening visual indicator */}
          <path d="M 280,60 L 350,60" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3,3" />
          <path d="M 350,60 L 343,56 M 350,60 L 343,64" stroke="#f59e0b" strokeWidth="1.5" />
          <text x="315" y="50" fill="#f59e0b" fontSize="8" fontWeight="bold">EMA50 SE APLANA</text>

          {/* Reversion target arrow */}
          <path
            d="M 330,85 L 345,100"
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            markerEnd="url(#arrow-green-div)"
          />
          <text x="365" y="115" fill="#10b981" fontSize="9" fontWeight="bold">Objetivo EMA100</text>

          {/* Candlesticks showing price rolling over and cutting EMA50 */}
          {[
            [20, 150, 140, 153, 138],
            [50, 140, 128, 143, 125],
            [80, 128, 115, 132, 112],
            [110, 115, 102, 118, 100],
            [140, 102, 85, 105, 82],
            [170, 85, 78, 88, 75],
            [200, 78, 75, 82, 72],
            [230, 75, 79, 82, 70],   // top starts (red)
            [260, 79, 72, 82, 70],   // green, then...
            [290, 72, 82, 70, 85],   // breaks EMA50 (red)
            [320, 82, 92, 80, 95],   // descending (red)
            [350, 92, 102, 90, 105], // reaches EMA100 (red)
            [380, 102, 98, 106, 95]  // bounce or cross
          ].map(([x, op, cl, lo, hi], idx) => {
            const isGreen = cl < op
            const color = isGreen ? '#10b981' : '#ef4444'
            return (
              <g key={idx} opacity="0.95">
                <line x1={x} y1={lo} x2={x} y2={hi} stroke={color} strokeWidth="1.5" />
                <rect
                  x={x - 4}
                  y={Math.min(op, cl)}
                  width="8"
                  height={Math.max(Math.abs(cl - op), 2)}
                  fill={color}
                  rx="1"
                />
              </g>
            )
          })}

          <defs>
            <marker id="arrow-green-div" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
            </marker>
          </defs>
        </svg>
      ),
      bearishChart: (
        <svg viewBox="0 0 400 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          {/* Grid lines */}
          {[40, 80, 120, 160].map((y, i) => (
            <line key={i} x1="0" y1={y} x2="400" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          ))}
          {/* EMA 100 - Dark Blue (continuing trend down) */}
          <path
            d="M -10,35 C 100,50 200,80 410,125"
            fill="none"
            stroke="#1d4ed8"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* EMA 50 - Light Blue (Flattening / Curving up) */}
          <path
            d="M -10,65 C 100,90 200,130 300,130 Q 350,127 410,112"
            fill="none"
            stroke="#06b6d4"
            strokeWidth="3"
            strokeLinecap="round"
            filter="drop-shadow(0 2px 8px rgba(6, 182, 212, 0.3))"
          />
          {/* Flattening visual indicator */}
          <path d="M 280,140 L 350,140" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3,3" />
          <path d="M 350,140 L 343,136 M 350,140 L 343,144" stroke="#f59e0b" strokeWidth="1.5" />
          <text x="315" y="153" fill="#f59e0b" fontSize="8" fontWeight="bold">EMA50 SE APLANA</text>

          {/* Reversion target arrow */}
          <path
            d="M 330,115 L 345,100"
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            markerEnd="url(#arrow-green-div-bear)"
          />
          <text x="365" y="85" fill="#10b981" fontSize="9" fontWeight="bold">Objetivo EMA100</text>

          {/* Candlesticks showing price rolling over and cutting EMA50 */}
          {[
            [20, 50, 60, 47, 62],
            [50, 60, 72, 57, 75],
            [80, 72, 85, 68, 88],
            [110, 85, 98, 82, 100],
            [140, 98, 115, 95, 118],
            [170, 115, 122, 112, 125],
            [200, 122, 125, 118, 128],
            [230, 125, 121, 118, 130],   // bottom starts (green)
            [260, 121, 128, 118, 130],   // red, then...
            [290, 128, 118, 130, 115],   // breaks EMA50 (green)
            [320, 118, 108, 120, 105],   // ascending (green)
            [350, 108, 98, 110, 95],     // reaches EMA100 (green)
            [380, 98, 102, 94, 105]      // bounce or cross
          ].map(([x, op, cl, lo, hi], idx) => {
            const isGreen = cl < op
            const color = isGreen ? '#10b981' : '#ef4444'
            return (
              <g key={idx} opacity="0.95">
                <line x1={x} y1={lo} x2={x} y2={hi} stroke={color} strokeWidth="1.5" />
                <rect
                  x={x - 4}
                  y={Math.min(op, cl)}
                  width="8"
                  height={Math.max(Math.abs(cl - op), 2)}
                  fill={color}
                  rx="1"
                />
              </g>
            )
          })}

          <defs>
            <marker id="arrow-green-div-bear" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
            </marker>
          </defs>
        </svg>
      )
    },
    {
      id: 'early_expansion',
      title: 'Trampa de Expansión Inicial (Desalineación M15)',
      subtitle: 'EMAs estiradas en M1/M5, pero apenas abriendo en M15',
      verdict: 'EVITAR',
      verdictColor: '#ef4444',
      verdictBg: 'rgba(239, 68, 68, 0.12)',
      verdictText: 'Falsa Extensión / Trampa',
      description: 'En las temporalidades menores (M1 y M5) el precio parece estar extremadamente estirado lejos de las EMAs, invitando a operar una reversión. Sin embargo, al mirar M15, las EMAs 50 y 100 apenas se están cruzando o comenzando a separarse. Esto indica que el gran movimiento macro acaba de nacer y tiene una enorme inercia. Operar en contra de esta naciente expansión de M15 es una trampa mortal, pues el precio ignorará la "sobrecompra" temporal y seguirá empujando a favor de M15.',
      rules: [
        'En M1 y M5 hay alta elasticidad (aparente oportunidad excelente de reversión).',
        'Al mirar M15, las EMAs 50 y 100 recién se cruzan o apenas empiezan a abrirse en abanico.',
        'La regla es clara: No operar en reversión cuando la temporalidad mayor (M15) apenas está iniciando su fase de expansión.'
      ],
      bullishChart: (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', height: '100%', width: '100%' }}>
          {/* M1 Panel */}
          <div style={{ position: 'relative', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ position: 'absolute', top: 6, left: 8, fontSize: 10, fontWeight: 800, color: '#9ca3af', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: 4 }}>M1</span>
            <svg viewBox="0 0 130 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <path d="M -10,180 Q 60,160 140,110" fill="none" stroke="#1d4ed8" strokeWidth="2" />
              <path d="M -10,150 Q 60,110 140,40" fill="none" stroke="#06b6d4" strokeWidth="2" />
              {[
                [20, 140, 120, 145, 115],
                [50, 120, 90, 125, 80],
                [80, 90, 50, 95, 40],
                [110, 50, 20, 55, 10]
              ].map(([x, op, cl, lo, hi], idx) => (
                <g key={idx} opacity="0.95">
                  <line x1={x} y1={lo} x2={x} y2={hi} stroke="#10b981" strokeWidth="1" />
                  <rect x={x - 3} y={Math.min(op, cl)} width="6" height={Math.max(Math.abs(cl - op), 2)} fill="#10b981" rx="1" />
                </g>
              ))}
            </svg>
          </div>
          {/* M5 Panel */}
          <div style={{ position: 'relative', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ position: 'absolute', top: 6, left: 8, fontSize: 10, fontWeight: 800, color: '#9ca3af', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: 4 }}>M5</span>
            <svg viewBox="0 0 130 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <path d="M -10,180 Q 60,175 140,140" fill="none" stroke="#1d4ed8" strokeWidth="2" />
              <path d="M -10,170 Q 60,150 140,80" fill="none" stroke="#06b6d4" strokeWidth="2" />
              {[
                [30, 160, 140, 165, 135],
                [70, 140, 90, 145, 80],
                [110, 90, 50, 95, 40]
              ].map(([x, op, cl, lo, hi], idx) => (
                <g key={idx} opacity="0.95">
                  <line x1={x} y1={lo} x2={x} y2={hi} stroke="#10b981" strokeWidth="1" />
                  <rect x={x - 3} y={Math.min(op, cl)} width="6" height={Math.max(Math.abs(cl - op), 2)} fill="#10b981" rx="1" />
                </g>
              ))}
              <path d="M 110,40 L 90,60" fill="none" stroke="#ef4444" strokeWidth="1" markerEnd="url(#arrow-red-trap-m5)" />
              <text x="80" y="30" fill="#ef4444" fontSize="8" fontWeight="bold">TRAMPA</text>
            </svg>
          </div>
          {/* M15 Panel */}
          <div style={{ position: 'relative', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <span style={{ position: 'absolute', top: 6, left: 8, fontSize: 10, fontWeight: 800, color: '#ef4444', background: 'rgba(239, 68, 68, 0.15)', padding: '2px 6px', borderRadius: 4 }}>M15</span>
            <svg viewBox="0 0 130 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <path d="M -10,180 Q 60,180 140,160" fill="none" stroke="#1d4ed8" strokeWidth="2" />
              <path d="M -10,180 Q 60,175 140,140" fill="none" stroke="#06b6d4" strokeWidth="2" filter="drop-shadow(0 2px 4px rgba(6, 182, 212, 0.3))" />
              {[
                [40, 180, 160, 185, 155],
                [90, 160, 110, 165, 100]
              ].map(([x, op, cl, lo, hi], idx) => (
                <g key={idx} opacity="0.95">
                  <line x1={x} y1={lo} x2={x} y2={hi} stroke="#10b981" strokeWidth="1" />
                  <rect x={x - 3} y={Math.min(op, cl)} width="6" height={Math.max(Math.abs(cl - op), 2)} fill="#10b981" rx="1" />
                </g>
              ))}
              <circle cx="20" cy="180" r="12" fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" strokeWidth="1" strokeDasharray="2,2" />
              <text x="65" y="195" fill="#ef4444" fontSize="7" fontWeight="bold" textAnchor="middle">INICIO M15</text>
            </svg>
          </div>
          <defs>
            <marker id="arrow-red-trap-m5" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
            </marker>
          </defs>
        </div>
      ),
      bearishChart: (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', height: '100%', width: '100%' }}>
          {/* M1 Panel */}
          <div style={{ position: 'relative', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ position: 'absolute', top: 6, left: 8, fontSize: 10, fontWeight: 800, color: '#9ca3af', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: 4 }}>M1</span>
            <svg viewBox="0 0 130 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <path d="M -10,20 Q 60,40 140,90" fill="none" stroke="#1d4ed8" strokeWidth="2" />
              <path d="M -10,50 Q 60,90 140,160" fill="none" stroke="#06b6d4" strokeWidth="2" />
              {[
                [20, 60, 80, 55, 85],
                [50, 80, 110, 75, 120],
                [80, 110, 150, 105, 160],
                [110, 150, 180, 145, 190]
              ].map(([x, op, cl, lo, hi], idx) => (
                <g key={idx} opacity="0.95">
                  <line x1={x} y1={lo} x2={x} y2={hi} stroke="#ef4444" strokeWidth="1" />
                  <rect x={x - 3} y={Math.min(op, cl)} width="6" height={Math.max(Math.abs(cl - op), 2)} fill="#ef4444" rx="1" />
                </g>
              ))}
            </svg>
          </div>
          {/* M5 Panel */}
          <div style={{ position: 'relative', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ position: 'absolute', top: 6, left: 8, fontSize: 10, fontWeight: 800, color: '#9ca3af', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: 4 }}>M5</span>
            <svg viewBox="0 0 130 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <path d="M -10,20 Q 60,25 140,60" fill="none" stroke="#1d4ed8" strokeWidth="2" />
              <path d="M -10,30 Q 60,50 140,120" fill="none" stroke="#06b6d4" strokeWidth="2" />
              {[
                [30, 40, 60, 35, 65],
                [70, 60, 110, 55, 120],
                [110, 110, 150, 105, 160]
              ].map(([x, op, cl, lo, hi], idx) => (
                <g key={idx} opacity="0.95">
                  <line x1={x} y1={lo} x2={x} y2={hi} stroke="#ef4444" strokeWidth="1" />
                  <rect x={x - 3} y={Math.min(op, cl)} width="6" height={Math.max(Math.abs(cl - op), 2)} fill="#ef4444" rx="1" />
                </g>
              ))}
              <path d="M 110,160 L 90,140" fill="none" stroke="#ef4444" strokeWidth="1" markerEnd="url(#arrow-red-trap-m5)" />
              <text x="80" y="170" fill="#ef4444" fontSize="8" fontWeight="bold">TRAMPA</text>
            </svg>
          </div>
          {/* M15 Panel */}
          <div style={{ position: 'relative', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <span style={{ position: 'absolute', top: 6, left: 8, fontSize: 10, fontWeight: 800, color: '#ef4444', background: 'rgba(239, 68, 68, 0.15)', padding: '2px 6px', borderRadius: 4 }}>M15</span>
            <svg viewBox="0 0 130 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <path d="M -10,20 Q 60,20 140,40" fill="none" stroke="#1d4ed8" strokeWidth="2" />
              <path d="M -10,20 Q 60,25 140,60" fill="none" stroke="#06b6d4" strokeWidth="2" filter="drop-shadow(0 2px 4px rgba(6, 182, 212, 0.3))" />
              {[
                [40, 20, 40, 15, 45],
                [90, 40, 90, 35, 100]
              ].map(([x, op, cl, lo, hi], idx) => (
                <g key={idx} opacity="0.95">
                  <line x1={x} y1={lo} x2={x} y2={hi} stroke="#ef4444" strokeWidth="1" />
                  <rect x={x - 3} y={Math.min(op, cl)} width="6" height={Math.max(Math.abs(cl - op), 2)} fill="#ef4444" rx="1" />
                </g>
              ))}
              <circle cx="20" cy="20" r="12" fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" strokeWidth="1" strokeDasharray="2,2" />
              <text x="65" y="15" fill="#ef4444" fontSize="7" fontWeight="bold" textAnchor="middle">INICIO M15</text>
            </svg>
          </div>
        </div>
      )
    }
  ]

  const activeData = cases.find(c => c.id === activeCase) || cases[0]

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 20% 0%, rgba(124,58,237,0.08) 0%, transparent 60%), #07070f',
      padding: '32px 24px',
      maxWidth: '1200px',
      margin: '0 auto',
      fontFamily: '"Outfit", "Inter", system-ui, sans-serif',
      color: '#f3f4f6'
    }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#a78bfa',
          textTransform: 'uppercase',
          letterSpacing: '1.5px',
          background: 'rgba(167,139,250,0.1)',
          padding: '4px 10px',
          borderRadius: 20,
          border: '1px solid rgba(167,139,250,0.15)'
        }}>
          💡 Guía Estratégica
        </span>
        <h1 style={{ margin: '12px 0 6px 0', fontSize: 26, fontWeight: 900, letterSpacing: '-0.5px', color: '#fff' }}>
          Casos de Uso: EMAs 50p vs 100p
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: '#9ca3af', maxWidth: '800px' }}>
          Analiza y comprende el comportamiento del precio en temporalidad de 5 minutos (M5) cuando interactúa con las EMAs.
          Aprende a identificar cuándo la desalineación o comportamiento de la EMA50 (azul celeste) anula o potencia tu estrategia de reversión a la EMA100 (azul oscura).
        </p>
      </div>

      {/* Selector de Dirección Global */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        padding: '6px',
        display: 'inline-flex',
        gap: 4,
        marginBottom: 28
      }}>
        <button
          onClick={() => handleDirectionChange('bullish')}
          style={{
            background: direction === 'bullish' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
            border: 'none',
            color: direction === 'bullish' ? '#10b981' : '#9ca3af',
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          🟢 Escenario Alcista (Compras)
        </button>
        <button
          onClick={() => handleDirectionChange('bearish')}
          style={{
            background: direction === 'bearish' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
            border: 'none',
            color: direction === 'bearish' ? '#ef4444' : '#9ca3af',
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          🔴 Escenario Bajista (Ventas)
        </button>
      </div>

      {/* Main Grid Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        gap: 24,
        alignItems: 'start'
      }}>
        
        {/* Sidebar Navigation */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          {cases.map(c => {
            const isActive = c.id === activeCase
            return (
              <div
                key={c.id}
                onClick={() => {
                  setActiveCase(c.id)
                  setAnimKey(prev => prev + 1)
                }}
                style={{
                  background: isActive ? 'rgba(255,255,255,0.03)' : 'transparent',
                  border: isActive ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
                  borderRadius: 14,
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.015)'
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.background = 'transparent'
                }}
              >
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: 3,
                    background: c.verdictColor
                  }} />
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 800,
                    background: c.verdictBg,
                    color: c.verdictColor,
                    padding: '2px 6px',
                    borderRadius: 4,
                    letterSpacing: '0.5px'
                  }}>
                    {c.verdict}
                  </span>
                  <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>M5</span>
                </div>
                
                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: isActive ? '#fff' : '#d1d5db',
                  marginBottom: 4
                }}>
                  {c.title}
                </div>
                
                <div style={{
                  fontSize: 11,
                  color: '#6b7280',
                  lineHeight: '1.4',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden'
                }}>
                  {c.subtitle}
                </div>
              </div>
            )
          })}
        </div>

        {/* Active Case Details Panel */}
        <div style={{
          background: 'rgba(17, 24, 39, 0.25)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: 20,
          padding: '28px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)'
        }}>
          
          {/* Card Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            paddingBottom: 20,
            marginBottom: 24
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#fff' }}>
                {activeData.title}
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#9ca3af' }}>
                {activeData.subtitle}
              </p>
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <div style={{
                background: activeData.verdictBg,
                color: activeData.verdictColor,
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 800,
                display: 'inline-block',
                border: `1px solid ${activeData.verdictColor}20`
              }}>
                {activeData.verdictText}
              </div>
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>
                Sugerencia Operativa
              </div>
            </div>
          </div>

          {/* Chart Display Section */}
          <div style={{
            background: '#090d16',
            border: '1px solid rgba(255, 255, 255, 0.04)',
            borderRadius: 14,
            padding: '24px 20px',
            marginBottom: 28,
            position: 'relative',
            boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }} key={animKey}>
            {/* Chart */}
            <div style={{ width: '100%', maxWidth: '500px', height: '220px' }}>
              {direction === 'bullish' ? activeData.bullishChart : activeData.bearishChart}
            </div>

            {/* EMA Legends absolute positioning */}
            <div style={{
              position: 'absolute',
              bottom: 12,
              right: 16,
              display: 'flex',
              gap: 16,
              background: 'rgba(7, 7, 15, 0.8)',
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.05)',
              backdropFilter: 'blur(4px)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 3, background: '#06b6d4', borderRadius: 2 }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#06b6d4', fontFamily: 'monospace' }}>EMA 50 (Celeste)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 3, background: '#1d4ed8', borderRadius: 2 }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', fontFamily: 'monospace' }}>EMA 100 (Oscura)</span>
              </div>
            </div>
          </div>

          {/* Explanation Text */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <h3 style={{ margin: '0 0 10px 0', fontSize: 13, textTransform: 'uppercase', color: '#a78bfa', letterSpacing: '0.5px' }}>
                📖 Dinámica del Comportamiento
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: '#d1d5db', lineHeight: '1.6' }}>
                {activeData.description}
              </p>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.015)',
              border: '1px solid rgba(255,255,255,0.03)',
              borderRadius: 12,
              padding: '16px 20px'
            }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 13, textTransform: 'uppercase', color: '#10b981', letterSpacing: '0.5px' }}>
                📌 Reglas y Validaciones
              </h3>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#9ca3af', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activeData.rules.map((rule, index) => (
                  <li key={index} style={{ lineHeight: '1.5' }}>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>

      </div>

      {/* Info panel */}
      <div style={{
        marginTop: 32,
        background: 'rgba(124, 58, 237, 0.03)',
        border: '1px solid rgba(124, 58, 237, 0.1)',
        borderRadius: 14,
        padding: '20px 24px',
        display: 'flex',
        gap: 16,
        alignItems: 'flex-start'
      }}>
        <div style={{ fontSize: 24 }}>🛡️</div>
        <div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 700, color: '#a78bfa' }}>
            Aclaración sobre la Regla de Oro (Alineación Fractal)
          </h4>
          <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', lineHeight: '1.5' }}>
            La alineación fractal perfecta en múltiples temporalidades (M1, M5, M15) es la señal de confluencia más fuerte de la inercia del mercado. 
            Sin embargo, la EMA50 en M5 es un filtro crítico de corto plazo: si observas un cruce reciente con fuerza (caso 2) o compresión extrema (caso 3), 
            la probabilidad de reversión a la media exitosa disminuye drásticamente. Utiliza esta guía para filtrar y evitar operaciones de baja calidad.
          </p>
        </div>
      </div>
    </div>
  )
}

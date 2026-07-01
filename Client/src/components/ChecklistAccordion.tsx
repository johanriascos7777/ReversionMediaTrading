import React, { useState } from 'react';

interface AccordionItemProps {
  title: string;
  isOpen: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function AccordionItem({ title, isOpen, onClick, children }: AccordionItemProps) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 8
    }}>
      <button
        onClick={onClick}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          background: isOpen ? 'rgba(124,58,237,0.1)' : 'transparent',
          border: 'none',
          color: isOpen ? '#a78bfa' : '#d1d5db',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.2s',
          textAlign: 'left'
        }}
      >
        <span>{title}</span>
        <span style={{ 
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', 
          transition: 'transform 0.3s' 
        }}>
          ▼
        </span>
      </button>
      
      {isOpen && (
        <div style={{
          padding: '20px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          color: '#9ca3af',
          fontSize: 14,
          lineHeight: '1.6'
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

export function ChecklistAccordion() {
  const [openItems, setOpenItems] = useState<number[]>([]);

  const toggleItem = (index: number) => {
    setOpenItems(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: '#a78bfa',
          boxShadow: '0 0 8px #a78bfa, 0 0 16px rgba(167,139,250,0.4)',
        }} />
        <h2 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '0.5px' }}>
          CHECKLIST DE VALIDACIÓN ESTRATÉGICA
        </h2>
      </div>

      <AccordionItem 
        title="1. Validar Pullbacks (Soportes y Resistencias)" 
        isOpen={openItems.includes(1)} 
        onClick={() => toggleItem(1)}
      >
        <p style={{ marginTop: 0, marginBottom: 16 }}>
          Observa la estructura que va dejando el precio. En una tendencia bajista, cada pullback (retroceso) hacia la EMA que luego es rechazado crea una nueva <strong>resistencia</strong>. Identificar correctamente estos niveles es vital para saber dónde está el riesgo y si el nuevo toque a la EMA respetará la estructura o la romperá.
        </p>
        
        <svg viewBox="0 0 800 400" style={{ width: '100%', height: 'auto', background: '#111827', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
          <defs>
            <marker id="arrow-red-acc" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
            </marker>
          </defs>

          {/* Grid */}
          {[100, 200, 300].map(y => (
            <line key={y} x1="0" y1={y} x2="800" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          ))}

          {/* EMAs */}
          <path d="M 0,100 Q 400,150 800,280" fill="none" stroke="#1d4ed8" strokeWidth="4" /> {/* EMA 100 */}
          <path d="M 0,130 Q 400,190 800,320" fill="none" stroke="#06b6d4" strokeWidth="4" filter="drop-shadow(0 2px 4px rgba(6, 182, 212, 0.3))" /> {/* EMA 50 */}

          {/* Price Path using candlestick-like zigzag for realism */}
          <path d="M 50,150 L 100,220 L 150,190 L 200,300 L 250,260 L 300,360 L 350,320 L 400,420 L 500,290 L 600,350 L 650,280" fill="none" stroke="#10b981" strokeWidth="3" />
          <path d="M 100,220 L 150,190" fill="none" stroke="#ef4444" strokeWidth="3" />
          <path d="M 200,300 L 250,260" fill="none" stroke="#ef4444" strokeWidth="3" />
          <path d="M 300,360 L 350,320" fill="none" stroke="#ef4444" strokeWidth="3" />
          <path d="M 400,420 L 500,290" fill="none" stroke="#ef4444" strokeWidth="3" />
          <path d="M 600,350 L 650,280" fill="none" stroke="#ef4444" strokeWidth="3" />

          {/* Resistances (Red Horizontal Lines) */}
          <line x1="120" y1="190" x2="250" y2="190" stroke="#ef4444" strokeWidth="5" />
          <line x1="220" y1="260" x2="350" y2="260" stroke="#ef4444" strokeWidth="5" />
          <line x1="320" y1="320" x2="450" y2="320" stroke="#ef4444" strokeWidth="5" />
          <line x1="480" y1="290" x2="620" y2="290" stroke="#ef4444" strokeWidth="5" />

          {/* Arrows pointing to the pullbacks */}
          <path d="M 170,250 L 210,200" stroke="#ef4444" strokeWidth="3" markerEnd="url(#arrow-red-acc)" />
          <path d="M 280,310 L 310,270" stroke="#ef4444" strokeWidth="3" markerEnd="url(#arrow-red-acc)" />
          <path d="M 380,370 L 410,330" stroke="#ef4444" strokeWidth="3" markerEnd="url(#arrow-red-acc)" />

          {/* The final ??????? circle */}
          <circle cx="720" cy="270" r="40" fill="none" stroke="#ef4444" strokeWidth="4" />
          <path d="M 650,280 L 690,270" stroke="#ef4444" strokeWidth="3" markerEnd="url(#arrow-red-acc)" />
          <text x="720" y="280" fill="#ef4444" fontSize="28" fontWeight="bold" textAnchor="middle">???</text>
        </svg>
      </AccordionItem>

      <AccordionItem 
        title="2. Momento de Entrada (Evitar Zona Tardía)" 
        isOpen={openItems.includes(2)} 
        onClick={() => toggleItem(2)}
      >
        <p style={{ marginTop: 0, marginBottom: 16 }}>
          El momento perfecto para entrar en reversión NO es cuando el precio ya ha tocado o cruzado la EMA 50. Si esperas hasta ese punto, el movimiento ya perdió tensión y estás entrando tarde. La entrada <strong>debe ser antes de tocar la EMA 50</strong>, aprovechando la compresión y el estiramiento máximo del precio.
        </p>

        <svg viewBox="0 0 800 400" style={{ width: '100%', height: 'auto', background: '#111827', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
          <defs>
            <marker id="arrow-green-acc" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
            </marker>
          </defs>

          {/* Grid */}
          {[100, 200, 300].map(y => (
            <line key={y} x1="0" y1={y} x2="800" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          ))}

          {/* EMAs */}
          <path d="M 0,120 Q 400,160 800,220" fill="none" stroke="#1d4ed8" strokeWidth="4" /> {/* EMA 100 */}
          <path d="M 0,160 Q 400,210 800,280" fill="none" stroke="#06b6d4" strokeWidth="4" filter="drop-shadow(0 2px 4px rgba(6, 182, 212, 0.3))" /> {/* EMA 50 */}

          {/* Price Drops drastically */}
          <path d="M 50,180 L 150,280 L 200,250 L 300,380 L 350,340" fill="none" stroke="#ef4444" strokeWidth="3" />
          
          {/* Price pulls back UP towards EMA 50 */}
          <path d="M 350,340 L 400,350 L 450,290 L 500,270 L 550,240 L 600,230" fill="none" stroke="#10b981" strokeWidth="4" />
          <path d="M 550,240 L 600,230" stroke="#10b981" strokeWidth="6" /> {/* Final thick green candle touching EMA */}

          {/* The BAD ENTRY point */}
          <circle cx="600" cy="230" r="10" fill="rgba(239, 68, 68, 0.3)" stroke="#ef4444" strokeWidth="3" />
          <path d="M 650,130 L 610,210" stroke="#ef4444" strokeWidth="4" markerEnd="url(#arrow-red-acc)" />
          <text x="650" y="110" fill="#ef4444" fontSize="24" fontWeight="bold" textAnchor="middle">EJEMPLO DE</text>
          <text x="650" y="145" fill="#ef4444" fontSize="24" fontWeight="bold" textAnchor="middle">ENTRADA MALA</text>

          {/* The GREEN SAFE ZONE */}
          <rect x="300" y="270" width="450" height="110" fill="rgba(16, 185, 129, 0.1)" stroke="#10b981" strokeWidth="3" />
          <text x="525" y="315" fill="#10b981" fontSize="22" fontWeight="bold" textAnchor="middle">Entrada debe ser</text>
          <text x="525" y="355" fill="#10b981" fontSize="22" fontWeight="bold" textAnchor="middle">antes de tocar EMA 50</text>
          
          {/* Green arrow pointing from box to the pullback */}
          <path d="M 360,270 L 400,210" stroke="#10b981" strokeWidth="4" markerEnd="url(#arrow-green-acc)" />
        </svg>
      </AccordionItem>

      <AccordionItem 
        title="3. Revalidar Soportes y Resistencias (Temporalidad Macro)" 
        isOpen={openItems.includes(3)} 
        onClick={() => toggleItem(3)}
      >
        <p style={{ marginTop: 0, marginBottom: 16 }}>
          Antes de entrar por un aparente "estiramiento" en temporalidades menores (M1/M5), haz zoom out y revisa el panorama macro (M15/H1). Verifica si el precio se está estrellando exactamente contra una <strong>resistencia o soporte histórico</strong> importante. Un estiramiento que confluye con el impacto contra un nivel macro fuerte es el escenario ideal para tu reversión. Operar a ciegas en M5 te expone a ser arrollado.
        </p>

        <svg viewBox="0 0 800 400" style={{ width: '100%', height: 'auto', background: '#111827', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
          {/* Grid */}
          {[100, 200, 300].map(y => (
            <line key={y} x1="0" y1={y} x2="800" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          ))}

          {/* EMAs */}
          <path d="M 0,250 Q 400,280 800,320" fill="none" stroke="#1d4ed8" strokeWidth="4" /> {/* EMA 100 */}
          <path d="M 0,280 Q 400,290 800,300" fill="none" stroke="#06b6d4" strokeWidth="4" filter="drop-shadow(0 2px 4px rgba(6, 182, 212, 0.3))" /> {/* EMA 50 */}

          {/* Macro S&R Levels */}
          <line x1="50" y1="100" x2="750" y2="100" stroke="#ef4444" strokeWidth="3" strokeDasharray="8, 8" />
          <text x="60" y="90" fill="#ef4444" fontSize="16" fontWeight="bold">Resistencia Macro Histórica (M15 / H1)</text>

          <line x1="50" y1="360" x2="750" y2="360" stroke="#10b981" strokeWidth="3" strokeDasharray="8, 8" />
          <text x="60" y="350" fill="#10b981" fontSize="16" fontWeight="bold">Soporte Macro Histórico (M15 / H1)</text>

          {/* Price Path: Huge push upwards towards resistance */}
          <path d="M 50,300 L 150,330 L 200,290 L 300,350" fill="none" stroke="#ef4444" strokeWidth="3" />
          <path d="M 300,350 L 350,250 L 400,280 L 450,150 L 500,200 L 600,100" fill="none" stroke="#10b981" strokeWidth="4" />
          
          {/* Alert Indicator on Impact */}
          <circle cx="600" cy="100" r="15" fill="rgba(239, 68, 68, 0.25)" stroke="#ef4444" strokeWidth="2" />
          <circle cx="600" cy="100" r="30" fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="4, 4" />
          
          {/* Text pointing to impact */}
          <path d="M 600,100 L 640,60" stroke="#ef4444" strokeWidth="3" markerEnd="url(#arrow-red-acc)" />
          <text x="650" y="55" fill="#ef4444" fontSize="18" fontWeight="bold">¡Impacto en Muro Macro!</text>
          <text x="650" y="75" fill="#f59e0b" fontSize="14" fontWeight="600">Confluencia perfecta para Reversión</text>
        </svg>
      </AccordionItem>
    </div>
  );
}

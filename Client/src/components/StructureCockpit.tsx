/**
 * StructureCockpit.tsx
 *
 * Panel de Confluencia y Estructura de Mercado.
 * Muestra en tiempo real RSI, divergencias, niveles S/R dinámicos
 * y la señal consolidada del motor de estructura para cada par.
 *
 * Panel completamente independiente del motor de elasticidad.
 */

import type {
  StructureData,
  StructureSnapshot,
  SignalDirection,
  StructureState,
  DivergenceType,
  TrendDirection,
} from '../hooks/useStructureData';

// ─── Colores y estilos por estado ────────────────────────────────────────────

const STATE_CONFIG: Record<StructureState, { color: string; bg: string; border: string; label: string }> = {
  STRONG:   { color: '#f43f5e', bg: 'rgba(244,63,94,0.12)',  border: '1px solid rgba(244,63,94,0.35)',  label: 'FUERTE'   },
  MODERATE: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', label: 'MODERADO' },
  WEAK:     { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: '1px solid rgba(107,114,128,0.2)', label: 'DÉBIL'   },
};

const SIGNAL_CONFIG: Record<SignalDirection, { color: string; label: string; emoji: string }> = {
  SELL: { color: '#f43f5e', label: 'VENDER', emoji: '↓' },
  BUY:  { color: '#10b981', label: 'COMPRAR', emoji: '↑' },
  WAIT: { color: '#6b7280', label: 'ESPERAR', emoji: '–' },
};

const DIVERGENCE_CONFIG: Record<DivergenceType, { color: string; label: string }> = {
  bearish: { color: '#f43f5e', label: '↓ Div. Bajista' },
  bullish: { color: '#10b981', label: '↑ Div. Alcista' },
  none:    { color: '#4b5563', label: 'Sin Divergencia' },
};

const SLOPE_CONFIG: Record<TrendDirection, { color: string; label: string }> = {
  up:   { color: '#10b981', label: '▲ Alcista' },
  down: { color: '#f43f5e', label: '▼ Bajista' },
  flat: { color: '#9ca3af', label: '→ Lateral' },
};

// ─── RSI Gauge ───────────────────────────────────────────────────────────────

function RSIGauge({ rsi }: { rsi: number }) {
  const pct   = Math.min(100, Math.max(0, rsi));
  const color = rsi >= 70 ? '#f43f5e' : rsi <= 30 ? '#10b981' : '#9ca3af';
  const zone  = rsi >= 70 ? 'Sobrecomprado' : rsi <= 30 ? 'Sobrevendido' : 'Neutral';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6b7280' }}>
        <span>RSI(14)</span>
        <span style={{ color, fontWeight: 700 }}>{rsi.toFixed(1)} — {zone}</span>
      </div>
      <div style={{ position: 'relative', height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
        {/* Zonas extremas */}
        <div style={{ position: 'absolute', left: '70%', top: 0, width: '30%', height: '100%', background: 'rgba(244,63,94,0.15)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: '30%', height: '100%', background: 'rgba(16,185,129,0.15)' }} />
        {/* Barra RSI */}
        <div style={{
          position: 'absolute', left: 0, top: 0,
          width: `${pct}%`, height: '100%',
          background: color,
          borderRadius: 3,
          transition: 'width 0.5s ease, background 0.3s ease',
        }} />
      </div>
      {/* Marcadores 30 y 70 */}
      <div style={{ position: 'relative', height: 8, fontSize: 8, color: '#4b5563', fontFamily: 'monospace' }}>
        <span style={{ position: 'absolute', left: '28%' }}>30</span>
        <span style={{ position: 'absolute', left: '68%' }}>70</span>
      </div>
    </div>
  );
}

// ─── S/R Level bar ───────────────────────────────────────────────────────────

function SRLevelRow({ level, currentPrice }: { level: import('../hooks/useStructureData').SRLevel; currentPrice: number }) {
  const isRes  = level.type === 'resistance';
  const color  = isRes ? '#f43f5e' : '#10b981';
  const label  = isRes ? 'R' : 'S';
  const pips   = Math.abs(level.price - currentPrice);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, fontFamily: 'monospace' }}>
      <span style={{ color, fontWeight: 800, minWidth: 12 }}>{label}</span>
      <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{level.price.toFixed(5)}</span>
      <span style={{ color: '#6b7280', flex: 1 }}>({pips.toFixed(5)} lejos)</span>
      {/* Dots de fuerza */}
      <div style={{ display: 'flex', gap: 2 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            width: 5, height: 5, borderRadius: '50%',
            background: i <= level.strength ? color : 'rgba(255,255,255,0.08)',
          }} />
        ))}
      </div>
    </div>
  );
}

// ─── Tarjeta de Símbolo ──────────────────────────────────────────────────────

function StructureCard({ symbol, snap }: { symbol: string; snap: StructureSnapshot }) {
  const stCfg  = STATE_CONFIG[snap.structureState];
  const sigCfg = SIGNAL_CONFIG[snap.signal];
  const divCfg = DIVERGENCE_CONFIG[snap.divergence];
  const slpCfg = SLOPE_CONFIG[snap.ema200Slope];

  const topLevels   = snap.srLevels.filter(l => l.type === 'resistance').slice(0, 2);
  const botLevels   = snap.srLevels.filter(l => l.type === 'support').slice(0, 2);
  const visibleLvls = [...topLevels, ...botLevels];

  return (
    <div style={{
      background: 'rgba(0,0,0,0.3)',
      border: stCfg.border,
      borderRadius: 14,
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      position: 'relative',
      overflow: 'hidden',
      boxShadow: snap.structureState === 'STRONG'
        ? `0 0 20px ${stCfg.color}22, 0 4px 16px rgba(0,0,0,0.4)`
        : '0 4px 16px rgba(0,0,0,0.3)',
      transition: 'box-shadow 0.3s ease',
    }}>

      {/* Línea de color superior */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: stCfg.color, opacity: snap.structureState === 'WEAK' ? 0.3 : 0.8 }} />

      {/* Header: Símbolo + Señal */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>{symbol}</span>
          <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 8 }}>{snap.price.toFixed(5)}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Badge Estado */}
          <span style={{
            fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
            padding: '2px 7px', borderRadius: 5,
            backgroundColor: stCfg.bg, color: stCfg.color,
            border: stCfg.border, fontFamily: 'monospace',
          }}>
            {stCfg.label}
          </span>
          {/* Badge Señal */}
          <span style={{
            fontSize: 12, fontWeight: 900,
            padding: '2px 10px', borderRadius: 6,
            backgroundColor: `${sigCfg.color}20`,
            color: sigCfg.color,
            border: `1px solid ${sigCfg.color}40`,
            fontFamily: 'monospace',
          }}>
            {sigCfg.emoji} {sigCfg.label}
          </span>
        </div>
      </div>

      {/* RSI Gauge */}
      <RSIGauge rsi={snap.rsi} />

      {/* Métricas compactas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {/* Divergencia */}
        <div style={{
          padding: '6px 8px', borderRadius: 7,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ fontSize: 8, color: '#6b7280', textTransform: 'uppercase', marginBottom: 2 }}>Divergencia RSI</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: divCfg.color, fontFamily: 'monospace' }}>
            {divCfg.label}
          </div>
        </div>
        {/* EMA200 slope */}
        <div style={{
          padding: '6px 8px', borderRadius: 7,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ fontSize: 8, color: '#6b7280', textTransform: 'uppercase', marginBottom: 2 }}>
            EMA200 · Precio {snap.priceVsEma200 === 'above' ? '↑ sobre' : '↓ bajo'}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: slpCfg.color, fontFamily: 'monospace' }}>
            {slpCfg.label}
          </div>
        </div>
      </div>

      {/* Niveles S/R */}
      {visibleLvls.length > 0 && (
        <div style={{
          padding: '8px 10px', borderRadius: 8,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.04)',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <span style={{ fontSize: 9, color: '#4b5563', textTransform: 'uppercase', marginBottom: 2 }}>
            Niveles S/R Detectados
          </span>
          {visibleLvls.map((lvl, i) => (
            <SRLevelRow key={i} level={lvl} currentPrice={snap.price} />
          ))}
        </div>
      )}

      {/* Confluencias activas */}
      {snap.confluences.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {snap.confluences.map((c, i) => (
            <span key={i} style={{
              fontSize: 9, padding: '2px 6px', borderRadius: 4,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#9ca3af', fontFamily: 'monospace',
            }}>
              {c}
            </span>
          ))}
        </div>
      )}

      {/* Explicación */}
      <div style={{ fontSize: 10, color: '#6b7280', fontStyle: 'italic', lineHeight: 1.4 }}>
        {snap.explanation}
      </div>

    </div>
  );
}

// ─── Panel Principal ─────────────────────────────────────────────────────────

interface StructureCockpitProps {
  data: StructureData;
}

export function StructureCockpit({ data }: StructureCockpitProps) {
  const symbols = Object.keys(data);

  return (
    <div style={{ marginBottom: 40 }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: symbols.length > 0 ? '#a78bfa' : '#4b5563',
            boxShadow: symbols.length > 0 ? '0 0 10px #a78bfa' : 'none',
          }} />
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#fff' }}>
            🏛️ Structure Engine — Confluencia &amp; Niveles S/R
          </h2>
        </div>
        <span style={{ fontSize: 10, color: '#6b7280', fontFamily: 'monospace' }}>
          RSI · EMA200 · Swing S/R · Divergencia
        </span>
      </div>

      {/* Sin datos */}
      {symbols.length === 0 && (
        <div style={{
          padding: '40px 20px', textAlign: 'center',
          borderRadius: 14, border: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(255,255,255,0.01)', color: '#4b5563', fontSize: 13,
        }}>
          Esperando datos del motor de estructura...<br />
          <span style={{ fontSize: 10 }}>(Se activa al recibir 210+ velas por símbolo)</span>
        </div>
      )}

      {/* Grid de tarjetas M5 */}
      {symbols.length > 0 && (
        <>
          <div style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>
            Timeframe M5
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}>
            {symbols.map(sym => {
              const snap = data[sym]?.m5;
              if (!snap) return null;
              return <StructureCard key={sym} symbol={sym} snap={snap} />;
            })}
          </div>

          <div style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>
            Timeframe M15
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 16,
          }}>
            {symbols.map(sym => {
              const snap = data[sym]?.m15;
              if (!snap) return null;
              return <StructureCard key={sym} symbol={sym} snap={snap} />;
            })}
          </div>
        </>
      )}
    </div>
  );
}

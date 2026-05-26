import type { ApiKeysPoolStatus, ApiKeyAssignment } from '../hooks/useMarketData';

interface ApiKeysStatusProps {
  keysStatus: ApiKeysPoolStatus | null;
}

export function ApiKeysStatus({ keysStatus }: ApiKeysStatusProps) {
  if (!keysStatus) {
    return (
      <div style={{
        padding: '16px 20px',
        borderRadius: 14,
        background: 'rgba(255, 255, 255, 0.01)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 80,
        color: '#6b7280',
        fontSize: 13,
        fontFamily: 'monospace'
      }}>
        Initializing API keys pool status...
      </div>
    );
  }

  // Helper colors for status
  const getStatusConfig = (status: ApiKeyAssignment['status']) => {
    switch (status) {
      case 'active':
        return {
          text: 'Active',
          color: '#10b981',
          bg: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          shadow: '0 0 8px rgba(16, 185, 129, 0.3)'
        };
      case 'shared':
        return {
          text: 'Shared',
          color: '#f59e0b',
          bg: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          shadow: '0 0 8px rgba(245, 158, 11, 0.3)'
        };
      case 'exhausted':
        return {
          text: 'Exhausted',
          color: '#ef4444',
          bg: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          shadow: '0 0 8px rgba(239, 68, 68, 0.3)'
        };
    }
  };

  return (
    <div style={{
      borderRadius: 16,
      border: '1px solid rgba(255, 255, 255, 0.07)',
      background: 'rgba(255, 255, 255, 0.01)',
      backdropFilter: 'blur(16px)',
      padding: '20px 24px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.24)',
      marginBottom: 32
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        paddingBottom: 14,
        marginBottom: 18,
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: keysStatus.allExhausted ? '#ef4444' : '#10b981',
            boxShadow: keysStatus.allExhausted ? '0 0 10px #ef4444' : '0 0 10px #10b981',
          }} />
          <span style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#fff' }}>
            🔑 API Keys Pool Controller
          </span>
        </div>

        {/* Global pool metrics */}
        <div style={{ display: 'flex', gap: 16, fontSize: 11, fontFamily: 'monospace' }}>
          <span style={{ color: '#9ca3af' }}>
            Total Keys: <strong style={{ color: '#fff' }}>{keysStatus.totalKeys}</strong>
          </span>
          <span style={{ color: '#9ca3af' }}>
            Exhausted: <strong style={{ color: keysStatus.exhaustedKeysCount > 0 ? '#f87171' : '#9ca3af' }}>{keysStatus.exhaustedKeysCount}</strong>
          </span>
          <span style={{ color: '#9ca3af' }}>
            Available: <strong style={{ color: '#34d399' }}>{keysStatus.totalKeys - keysStatus.exhaustedKeysCount}</strong>
          </span>
        </div>
      </div>

      {/* Grid of assignments */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16
      }}>
        {keysStatus.assignments.map((asg) => {
          const cfg = getStatusConfig(asg.status);
          
          // Color coding for minutely rates to alert visually
          const getRateColor = (rate: number) => {
            if (rate < 5) return '#10b981'; // safe green
            if (rate <= 7) return '#f59e0b'; // warning yellow
            return '#ef4444'; // dangerous red
          };

          return (
            <div
              key={asg.symbol}
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.04)',
                borderRadius: 12,
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                transition: 'border-color 0.2s',
              }}
            >
              {/* Row 1: Symbol & Status Tag */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: '#fff',
                  fontFamily: 'monospace',
                  letterSpacing: '-0.3px',
                }}>
                  {asg.symbol}
                </span>

                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                  borderRadius: 6,
                  backgroundColor: cfg.bg,
                  color: cfg.color,
                  border: cfg.border,
                  boxShadow: cfg.shadow,
                  fontFamily: 'monospace',
                  letterSpacing: '0.5px'
                }}>
                  {cfg.text}
                </span>
              </div>

              {/* Row 2: Masked API Key */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                paddingBottom: 8
              }}>
                <span style={{ color: '#6b7280' }}>Active Key:</span>
                <span style={{ fontFamily: 'monospace', color: '#9ca3af', fontWeight: 600 }}>
                  {asg.activeKeyMasked}
                </span>
              </div>

              {/* Row 3: API Credits Used */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
                
                {/* Credit count */}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>API credits used:</span>
                  <span style={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: asg.requestsCount >= 750 ? '#ef4444' : (asg.requestsCount >= 600 ? '#f59e0b' : '#34d399')
                  }}>
                    {asg.requestsCount} <span style={{ color: '#4b5563', fontWeight: 500 }}>/ 800</span>
                  </span>
                </div>

                {/* Progress bar for credit usage */}
                <div style={{
                  height: 4,
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 2,
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${Math.min(100, (asg.requestsCount / 800) * 100)}%`,
                    height: '100%',
                    borderRadius: 2,
                    background: asg.requestsCount >= 750 ? '#ef4444' : (asg.requestsCount >= 600 ? '#f59e0b' : '#10b981'),
                    transition: 'width 0.3s ease'
                  }} />
                </div>

                {/* Minutely Metrics (The new addition requested!) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                  marginTop: 6,
                  padding: '8px 10px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.02)'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ color: '#6b7280', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Minutely Rate</span>
                    <span style={{
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: getRateColor(asg.minutelyRate),
                      fontSize: 12
                    }}>
                      {asg.minutelyRate} <span style={{ color: '#4b5563', fontWeight: 500, fontSize: 10 }}>/ 8</span>
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ color: '#6b7280', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Minutely Max</span>
                    <span style={{
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: getRateColor(asg.minutelyMax),
                      fontSize: 12
                    }}>
                      {asg.minutelyMax} <span style={{ color: '#4b5563', fontWeight: 500, fontSize: 10 }}>/ 8</span>
                    </span>
                  </div>
                </div>

              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}

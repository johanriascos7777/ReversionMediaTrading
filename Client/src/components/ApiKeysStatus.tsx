import { useState } from 'react';
import type { ApiKeysPoolStatus, ApiKeyAssignment } from '../hooks/useMarketData';

interface ApiKeysStatusProps {
  keysStatus: ApiKeysPoolStatus | null;
}

export function ApiKeysStatus({ keysStatus }: ApiKeysStatusProps) {
  const [showExhaustedList, setShowExhaustedList] = useState(false);
  const [showPoolDetails, setShowPoolDetails] = useState(false);

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
        <div style={{ display: 'flex', gap: 16, fontSize: 11, fontFamily: 'monospace', alignItems: 'center' }}>
          <span
            onClick={() => setShowPoolDetails(!showPoolDetails)}
            style={{
              color: '#9ca3af',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 6,
              background: showPoolDetails ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.02)',
              border: showPoolDetails ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
              transition: 'all 0.2s',
            }}
            title="Click to view detailed list of all keys in the pool"
          >
            Total Keys: <strong style={{ color: '#fff' }}>{keysStatus.totalKeys}</strong>
          </span>
          <span
            onClick={() => setShowExhaustedList(!showExhaustedList)}
            style={{
              color: '#9ca3af',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 6,
              background: showExhaustedList ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.02)',
              border: showExhaustedList ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
              transition: 'all 0.2s',
            }}
            title="Click to view details of exhausted keys in cooldown"
          >
            Exhausted: <strong style={{ color: keysStatus.exhaustedKeysCount > 0 ? '#f87171' : '#9ca3af' }}>{keysStatus.exhaustedKeysCount}</strong>
          </span>
          <span style={{ color: '#9ca3af' }}>
            Available: <strong style={{ color: '#34d399' }}>{keysStatus.totalKeys - keysStatus.exhaustedKeysCount}</strong>
          </span>
        </div>
      </div>

      {/* Complete Pool Details Panel */}
      {showPoolDetails && (
        <div style={{
          background: 'rgba(30, 41, 59, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 18,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(12px)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              📋 Complete API Keys Pool Details ({keysStatus.poolDetails?.length || 0} keys)
            </span>
            <button
              onClick={() => setShowPoolDetails(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              Close
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 10,
            maxHeight: 280,
            overflowY: 'auto',
            paddingRight: 6
          }}>
            {keysStatus.poolDetails?.map((kd) => {
              // Get status design config
              let statusText = 'Idle';
              let statusColor = '#9ca3af';
              let statusBg = 'rgba(156, 163, 175, 0.08)';
              let statusBorder = '1px solid rgba(156, 163, 175, 0.15)';

              if (kd.status === 'daily-limit') {
                statusText = 'Daily Exhausted';
                statusColor = '#f87171';
                statusBg = 'rgba(239, 68, 68, 0.1)';
                statusBorder = '1px solid rgba(239, 68, 68, 0.25)';
              } else if (kd.status === 'rate-limit') {
                statusText = `Rate Limit (${kd.cooldownRemaining}s)`;
                statusColor = '#f59e0b';
                statusBg = 'rgba(245, 158, 11, 0.1)';
                statusBorder = '1px solid rgba(245, 158, 11, 0.25)';
              } else if (kd.status === 'active') {
                if (kd.assignedSymbol) {
                  statusText = `Active (${kd.assignedSymbol})`;
                  statusColor = '#34d399';
                  statusBg = 'rgba(16, 185, 129, 0.1)';
                  statusBorder = '1px solid rgba(16, 185, 129, 0.25)';
                } else {
                  statusText = 'Idle (Available)';
                  statusColor = '#60a5fa';
                  statusBg = 'rgba(96, 165, 250, 0.1)';
                  statusBorder = '1px solid rgba(96, 165, 250, 0.25)';
                }
              } else if (kd.status === 'shared') {
                statusText = `Shared (${kd.assignedSymbol})`;
                statusColor = '#fbbf24';
                statusBg = 'rgba(251, 191, 36, 0.1)';
                statusBorder = '1px solid rgba(251, 191, 36, 0.25)';
              }

              return (
                <div key={kd.index} style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.03)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  fontFamily: 'monospace',
                  fontSize: 11
                }}>
                  {/* Row 1: Index, Masked Key & Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#fff', fontWeight: 700 }}>
                      #{String(kd.index).padStart(2, '0')} <span style={{ color: '#9ca3af', fontWeight: 400 }}>{kd.keyMasked}</span>
                    </span>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '2px 6px',
                      borderRadius: 4,
                      backgroundColor: statusBg,
                      color: statusColor,
                      border: statusBorder
                    }}>
                      {statusText}
                    </span>
                  </div>

                  {/* Row 2: Credit counts */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280', fontSize: 10 }}>
                    <span>Credits used (session):</span>
                    <span style={{
                      fontWeight: 700,
                      color: kd.status === 'daily-limit' ? '#ef4444' : (kd.requestsCount >= 750 ? '#ef4444' : (kd.requestsCount >= 600 ? '#f59e0b' : '#9ca3af'))
                    }}>
                      {kd.status === 'daily-limit' ? 'EXHAUSTED' : `${kd.requestsCount} / 800`}
                    </span>
                  </div>

                  {/* Row 3: Minutely stats */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280', fontSize: 10 }}>
                    <span>Minutely (rate / max):</span>
                    <span style={{ fontWeight: 700, color: '#9ca3af' }}>
                      {kd.minutelyRate} / {kd.minutelyMax} <span style={{ color: '#4b5563', fontWeight: 500 }}>/ 8</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Exhausted Keys Drawer/Panel */}
      {showExhaustedList && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.04)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: 12,
          padding: '14px 18px',
          marginBottom: 18,
          boxShadow: 'inset 0 0 12px rgba(239, 68, 68, 0.05)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 6 }}>
              🛑 Cooldown Pool: {keysStatus.exhaustedKeys?.length || 0} Exhausted Keys
            </span>
            <button
              onClick={() => setShowExhaustedList(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ef4444',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              Close
            </button>
          </div>
          {(!keysStatus.exhaustedKeys || keysStatus.exhaustedKeys.length === 0) ? (
            <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>
              ✓ All API keys in the pool are currently active and available.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 8
            }}>
              {keysStatus.exhaustedKeys.map((k, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontFamily: 'monospace',
                  fontSize: 11
                }}>
                  <span style={{ color: '#f87171' }}>{k.keyMasked}</span>
                  <span style={{
                    color: '#fca5a5',
                    background: 'rgba(239, 68, 68, 0.2)',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700
                  }}>
                    ⏱️ {k.cooldownRemaining}s
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Grid of assignments */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))',
        gap: 8
      }}>
        {keysStatus.assignments.map((asg) => {
          const cfg = getStatusConfig(asg.status);

          // Color coding for minutely rates to alert visually
          const getRateColor = (rate: number) => {
            if (rate < 5) return '#10b981'; // safe green
            if (rate <= 7) return '#f59e0b'; // warning yellow
            return '#ef4444'; // dangerous red
          };

          const cardClass = `key-pool-card ${asg.status}-border`;
          const statusLabel = asg.status === 'active' ? 'ACT' : asg.status === 'shared' ? 'SHR' : 'EXH';

          return (
            <div
              key={asg.symbol}
              className={cardClass}
            >
              {/* Left: Symbol rotated -90deg */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRight: '1px solid rgba(255,255,255,0.05)',
                paddingRight: 4,
                overflow: 'hidden'
              }}>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: 10,
                  fontWeight: 900,
                  color: cfg.color,
                  textShadow: `0 0 6px ${cfg.color}`,
                  transform: 'rotate(-90deg)',
                  whiteSpace: 'nowrap',
                  letterSpacing: '-0.2px',
                  display: 'inline-block'
                }}>
                  {asg.symbol}
                </span>
              </div>

              {/* Right: stacked data */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
                {/* Key Mask & Status Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    color: '#9ca3af',
                    fontSize: 9.5,
                    fontWeight: 700,
                    opacity: 0.9
                  }}>
                    {asg.activeKeyMasked}
                  </span>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    background: cfg.bg,
                    border: cfg.border,
                    padding: '1px 4px',
                    borderRadius: 3,
                    boxShadow: cfg.shadow
                  }}>
                    <span style={{
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      backgroundColor: cfg.color,
                      boxShadow: `0 0 4px ${cfg.color}`,
                      display: 'inline-block'
                    }} />
                    <span style={{
                      fontSize: 8,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      color: cfg.color,
                      fontFamily: "'JetBrains Mono', monospace",
                      letterSpacing: '0.1px'
                    }}>
                      {statusLabel}
                    </span>
                  </div>
                </div>

                {/* Thin credits bar with overlay text */}
                <div style={{
                  height: 13,
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: 3,
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  overflow: 'hidden',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{
                    position: 'absolute',
                    left: 0, top: 0, bottom: 0,
                    width: `${Math.min(100, (asg.requestsCount / 800) * 100)}%`,
                    background: asg.requestsCount >= 750
                      ? 'linear-gradient(90deg, rgba(239,68,68,0.15), rgba(239,68,68,0.55))'
                      : asg.requestsCount >= 600
                        ? 'linear-gradient(90deg, rgba(245,158,11,0.15), rgba(245,158,11,0.55))'
                        : 'linear-gradient(90deg, rgba(16,185,129,0.15), rgba(16,185,129,0.55))',
                    boxShadow: asg.requestsCount >= 750 ? '0 0 4px rgba(239,68,68,0.3)' : (asg.requestsCount >= 600 ? '0 0 4px rgba(245,158,11,0.3)' : '0 0 4px rgba(16,185,129,0.3)'),
                    transition: 'width 0.3s ease',
                    zIndex: 1
                  }} />
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    fontWeight: 800,
                    color: '#fff',
                    zIndex: 2,
                    opacity: 0.95,
                    textShadow: '0 1px 1px rgba(0,0,0,0.8)'
                  }}>
                    {asg.requestsCount}/800
                  </span>
                </div>

                {/* Minutely Metrics */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 9,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#9ca3af'
                }}>
                  <div title="Minutely Rate">
                    Rate: <span style={{ color: getRateColor(asg.minutelyRate), fontWeight: 700 }}>{asg.minutelyRate}</span><span style={{ color: '#4b5563' }}>/8</span>
                  </div>
                  <div title="Minutely Max">
                    Max: <span style={{ color: getRateColor(asg.minutelyMax), fontWeight: 700 }}>{asg.minutelyMax}</span><span style={{ color: '#4b5563' }}>/8</span>
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

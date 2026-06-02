import { useEffect, useState } from 'react';
import { API_URL } from '@/config/env';

type HealthMetrics = {
  droppedTicksTotal: number;
  lastDroppedTickAt: number | null;
  droppedTicksPerMinute: number;
  currentDelay?: number;
  avgDelay?: number;
  maxDelay?: number;
};

export function SystemObservability() {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch(`${API_URL}/health`);
        if (!res.ok) return;
        const data = await res.json();
        setMetrics(data.metrics || null);
      } catch (err) {
        setMetrics(null);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 4000); // Poll every 4 seconds
    return () => clearInterval(interval);
  }, []);

  if (!metrics) {
    return (
      <div style={{
        marginTop: 32, padding: 16,
        border: '1px solid #2a2a2a', borderRadius: 8,
      }}>
        <h3>🧠 System Observability</h3>
        <p style={{ opacity: 0.5, fontSize: 13 }}>No data</p>
      </div>
    );
  }

  // Formatter for timestamp
  const lastDroppedStr = metrics.lastDroppedTickAt
    ? new Date(metrics.lastDroppedTickAt).toLocaleTimeString()
    : 'None';

  // Delay variables
  const currentDelay = (metrics.currentDelay === undefined || metrics.currentDelay === null) 
    ? undefined 
    : (metrics.currentDelay / 1000).toFixed(1);
    
  const avgDelay = (metrics.avgDelay === undefined || metrics.avgDelay === null) 
    ? undefined 
    : (metrics.avgDelay / 1000).toFixed(1);
    
  const maxDelay = (metrics.maxDelay === undefined || metrics.maxDelay === null) 
    ? undefined 
    : (metrics.maxDelay / 1000).toFixed(1);

  const getDelayColor = (delayStr: string | undefined) => {
    if (delayStr === undefined) return '#888'; // N/A
    const delaySec = parseFloat(delayStr);
    if (delaySec < 2) return '#16a34a'; // Green
    if (delaySec <= 5) return '#eab308'; // Yellow
    return '#dc2626'; // Red
  };

  const delayColor = getDelayColor(currentDelay);

  // Common styles
  const colStyle = {
    flex: '1 1 250px',
    background: '#111',
    border: '1px solid #222',
    borderRadius: 6,
    padding: '12px 16px',
  };

  return (
    <div style={{
      marginTop: 32, padding: 16,
      border: '1px solid #2a2a2a', borderRadius: 8,
    }}>
      <h3>🧠 System Observability</h3>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
        
        {/* LEFT COLUMN */}
        <div style={colStyle}>
          <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#aaa', borderBottom: '1px solid #333', paddingBottom: 6 }}>
            Dropped Ticks
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#888' }}>Total Dropped:</span>
              <span style={{ fontWeight: 600 }}>{metrics.droppedTicksTotal}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#888' }}>Rate (per min):</span>
              <span style={{ fontWeight: 600 }}>{metrics.droppedTicksPerMinute}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#888' }}>Last Occurrence:</span>
              <span style={{ fontWeight: 600 }}>{lastDroppedStr}</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={colStyle}>
          <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#aaa', borderBottom: '1px solid #333', paddingBottom: 6 }}>
            Data Feed Delay
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#888' }}>Current Delay:</span>
              <span style={{ fontWeight: 600, color: delayColor }}>
                 {currentDelay !== undefined ? `${currentDelay}s` : 'N/A'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#888' }}>Avg Delay:</span>
              <span style={{ fontWeight: 600, color: '#aaa' }}>
                {avgDelay !== undefined ? `${avgDelay}s` : 'N/A'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#888' }}>Max Delay (1m):</span>
              <span style={{ fontWeight: 600, color: '#aaa' }}>
                {maxDelay !== undefined ? `${maxDelay}s` : 'N/A'}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

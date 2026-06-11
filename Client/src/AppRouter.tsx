/**
 * AppRouter.tsx
 *
 * Componente raíz de enrutamiento.
 * Separa la lógica de routing del Dashboard principal (App.tsx).
 * Agrega la ruta /tower-control sin modificar la lógica existente.
 */
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import App from './App'
import { TowerControl } from './pages/TowerControl'
import { HolguraCalculator } from './pages/HolguraCalculator'
import { ExperimentalDashboard } from './pages/ExperimentalDashboard'
import { FullRevertionDashboard } from './pages/FullRevertionDashboard'
import { TradingRecommendations } from './pages/TradingRecommendations'
import { IdealSchedule } from './pages/IdealSchedule'

// ─── Barra de navegación global ──────────────────────────────────────────────

function NavBar() {
  const location = useLocation()
  const currentPath = location.pathname

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      height: 44,
      background: 'rgba(5,5,10,0.92)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '0 20px',
    }}>
      {/* Logo */}
      <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px', marginRight: 16 }}>
        📡 ElasticityMeter
      </span>

      {/* Links */}
      <NavLink to="/" label="📊 Dashboard" active={currentPath === '/'} />
      <NavLink to="/full-revertion" label="🌊 Reversión Completa" active={currentPath === '/full-revertion'} />
      <NavLink to="/horario-ideal" label="🎯 Horario Ideal" active={currentPath === '/horario-ideal'} />
      <NavLink to="/recomendaciones" label="📖 Recomendaciones" active={currentPath === '/recomendaciones'} />
      <NavLink to="/tower-control" label="🗼 Torre de Control" active={currentPath === '/tower-control'} />
      <NavLink to="/holgura-calculator" label="🧮 Calculadora de Holgura" active={currentPath === '/holgura-calculator'} />
      <NavLink to="/experimental" label="🧪 Experimental" active={currentPath === '/experimental'} />
    </nav>
  )
}

function NavLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      style={{
        textDecoration: 'none',
        padding: '4px 12px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        color: active ? '#fff' : '#6b7280',
        background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
        border: active ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
        transition: 'all 0.2s ease',
      }}
    >
      {label}
    </Link>
  )
}

// ─── Router raíz ─────────────────────────────────────────────────────────────

export function AppRouter() {
  return (
    <>
      <NavBar />
      {/* Offset para el navbar fijo */}
      <div style={{ paddingTop: 44 }}>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/full-revertion" element={<FullRevertionDashboard />} />
          <Route path="/horario-ideal" element={<IdealSchedule />} />
          <Route path="/recomendaciones" element={<TradingRecommendations />} />
          <Route path="/recoemndaciones" element={<TradingRecommendations />} />
          <Route path="/tower-control" element={<TowerControl />} />
          <Route path="/holgura-calculator" element={<HolguraCalculator />} />
          <Route path="/experimental" element={<ExperimentalDashboard />} />
        </Routes>
      </div>
    </>
  )
}

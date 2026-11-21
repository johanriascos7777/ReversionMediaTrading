import { decisionGroups, decisionRow, type AlertInput } from './decisions';

describe('decisiones por alerta', () => {
  const alert = (id: number, features: Record<string, any>, status = 'tiempo'): AlertInput => ({
    id,
    symbol: 'USD/JPY',
    direction: 'BUY',
    createdAt: new Date(Date.UTC(2026, 10, 20, 12, 0)),
    status,
    maePips: 12,
    mfePips: 3,
    features,
  });
  const contract = { size: 20000, quoteToUsd: 0.0063 };

  it('una alerta sin operación es dejada y su resultado sale del contrato', () => {
    const r = decisionRow(alert(1, { contract, outcome: { reason: 'tiempo', pips: -10, minutes: 175 } }), null);
    expect(r.decision).toBe('dejada');
    expect(r.contractUsd).toBe(-12.6);
    expect(r.reachedTarget).toBe(false);
    expect(r.realUsd).toBeNull();
  });

  it('una alerta tomada guarda el resultado real y el del contrato', () => {
    const r = decisionRow(
      alert(2, { contract, outcome: { reason: 'broker', pips: 5, minutes: 30, broker: { source: 'TP' } } }, 'broker'),
      { id: 9, status: 'closed', realizedPnl: 6.1 },
    );
    expect(r.decision).toBe('tomada');
    expect(r.reachedTarget).toBe(true);
    expect(r.contractUsd).toBe(6.3);
    expect(r.realUsd).toBe(6.1);
  });

  it('una orden rechazada cerrada como broker no tiene resultado', () => {
    const r = decisionRow(
      alert(3, { contract, outcome: { reason: 'broker', pips: -0.1, minutes: 1 } }, 'broker'),
      { id: 10, status: 'failed', realizedPnl: null },
    );
    expect(r.decision).toBe('rechazada');
    expect(r.reason).toBe('sin-resultado');
    expect(r.contractUsd).toBeNull();
  });

  it('un contrato que duró más de 4 horas es un dato roto y no cuenta', () => {
    const r = decisionRow(alert(5, { contract, outcome: { reason: 'tiempo', pips: -60, minutes: 7685 } }), { id: 22, status: 'closed', realizedPnl: null });
    expect(r.reason).toBe('sin-resultado');
    expect(r.contractUsd).toBeNull();
  });

  it('una alerta guardada sin enviar por otra operación abierta es bloqueada; una en curso no cuenta', () => {
    const blocked = decisionRow(alert(4, { contract, telegramSuppressedBy: 7 }, 'open'), null);
    expect(blocked.decision).toBe('bloqueada');
    expect(blocked.finished).toBe(false);
    const g = decisionGroups([blocked]);
    expect(g.bloqueada).toEqual({ alerts: 1, finished: 0, reachedTarget: 0, contractUsd: 0, withUsd: 0, realUsd: null });
  });
});

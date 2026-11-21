import { isSession, sessionOf } from './session';

describe('sessionOf', () => {
  it('uses the UTC hour like the trade journal', () => {
    expect(sessionOf('2026-11-20T22:59:00Z')).toBe('american');
    expect(sessionOf('2026-11-20T23:00:00Z')).toBe('asian');
    expect(sessionOf('2026-11-20T07:59:00Z')).toBe('asian');
    expect(sessionOf('2026-11-20T08:00:00Z')).toBe('european');
    expect(sessionOf('2026-11-20T11:59:00Z')).toBe('european');
    expect(sessionOf('2026-11-20T12:00:00Z')).toBe('american');
  });

  it('accepts only the three sessions', () => {
    expect(isSession('asian')).toBe(true);
    expect(isSession('pacific')).toBe(false);
    expect(isSession(undefined)).toBe(false);
  });
});

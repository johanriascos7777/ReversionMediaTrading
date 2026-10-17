const NEW_YORK = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  hour: 'numeric',
  hourCycle: 'h23',
});

export function isFxClosed(ts: number): boolean {
  const parts = NEW_YORK.formatToParts(new Date(ts));
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  if (weekday === 'Sat') return true;
  if (weekday === 'Fri') return hour >= 17;
  if (weekday === 'Sun') return hour < 17;
  return false;
}

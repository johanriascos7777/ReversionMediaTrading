export type Session = 'asian' | 'european' | 'american';

export const SESSIONS: Session[] = ['asian', 'european', 'american'];

export const sessionOf = (at: Date | string): Session => {
  const hour = new Date(at).getUTCHours();
  if (hour >= 23 || hour < 8) return 'asian';
  if (hour < 12) return 'european';
  return 'american';
};

export const isSession = (v: unknown): v is Session =>
  typeof v === 'string' && (SESSIONS as string[]).includes(v);

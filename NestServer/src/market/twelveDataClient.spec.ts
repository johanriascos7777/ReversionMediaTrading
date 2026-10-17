import { TwelveDataClient } from './twelveDataClient';

describe('TwelveDataClient · velas de 1 minuto por REST', () => {
  const values = [
    {
      datetime: '2026-10-19 12:03:00',
      open: '0.8500',
      high: '0.8504',
      low: '0.8499',
      close: '0.8503',
    },
    {
      datetime: '2026-10-19 12:02:00',
      open: '0.8502',
      high: '0.8503',
      low: '0.8497',
      close: '0.8500',
    },
    {
      datetime: '2026-10-19 12:01:00',
      open: '0.8501',
      high: '0.8502',
      low: '0.8500',
      close: '0.8502',
    },
  ];

  it('emite 4 ticks por vela cerrada, en UTC, sin la vela en formación y sin repetir', () => {
    const client = new TwelveDataClient('k', 'EUR/GBP');
    const ticks: Array<[string, number, number]> = [];
    client.on('tick', (s: string, p: number, t: number) =>
      ticks.push([s, p, t]),
    );
    const now = jest
      .spyOn(Date, 'now')
      .mockReturnValue(Date.parse('2026-10-19T12:03:30Z'));

    (client as any).emitClosedMinuteBars(values);
    expect(ticks).toHaveLength(8);
    expect(ticks[0]).toEqual([
      'EUR/GBP',
      0.8501,
      Date.parse('2026-10-19T12:01:02Z'),
    ]);
    expect(ticks[3][1]).toBe(0.8502);
    expect(ticks[5]).toEqual([
      'EUR/GBP',
      0.8503,
      Date.parse('2026-10-19T12:02:20Z'),
    ]);
    expect(ticks[7]).toEqual([
      'EUR/GBP',
      0.85,
      Date.parse('2026-10-19T12:02:58Z'),
    ]);

    now.mockReturnValue(Date.parse('2026-10-19T12:04:10Z'));
    (client as any).emitClosedMinuteBars(values);
    expect(ticks).toHaveLength(12);
    expect(ticks[8][2]).toBe(Date.parse('2026-10-19T12:03:02Z'));
    now.mockRestore();
  });
});

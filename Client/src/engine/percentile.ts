export function calculatePercentile(
  history: number[],
  current: number
): number {
  if (history.length === 0) return 0

  const sorted = [...history].sort((a, b) => a - b)
  const index = sorted.findIndex(v => v >= current)

  if (index === -1) return 100

  return Math.round((index / sorted.length) * 100)
}

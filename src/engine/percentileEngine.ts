export type PercentileEngine = {
  push: (value: number) => number
  getHistory: () => number[]
  reset: () => void
}

export function createPercentileEngine(
  windowSize: number = 300
): PercentileEngine {
  let buffer: number[] = []

  function push(value: number): number {
    buffer.push(value)

    if (buffer.length > windowSize) {
      buffer.shift()
    }

    if (buffer.length === 1) return 0

    const sorted = [...buffer].sort((a, b) => a - b)
    const index = sorted.findIndex(v => v >= value)

    if (index === -1) return 100

    return Math.round((index / (sorted.length - 1)) * 100)
  }

  function getHistory() {
    return [...buffer]
  }

  function reset() {
    buffer = []
  }

  return {
    push,
    getHistory,
    reset,
  }
}

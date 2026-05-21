import { createPercentileEngine } from './percentileEngine'

type EngineKey = string

const registry = new Map<EngineKey, ReturnType<typeof createPercentileEngine>>()

export function getPercentileEngine(key: EngineKey) {
  if (!registry.has(key)) {
    registry.set(key, createPercentileEngine(300))
  }

  return registry.get(key)!
}

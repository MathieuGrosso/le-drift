import type { QualityLevel, QualitySettings } from './types'

type Preset = Omit<QualitySettings, 'level' | 'onChange'>

export const QUALITY_PRESETS: Record<QualityLevel, Preset> = {
  high: {
    pixelRatio: 2, chunkRadius: 3, lodRadius: 6, grassDensity: 120_000, fishCount: 2500,
    shadows: true, shadowMapSize: 2048, godRayPass: true, outline: true, painterly: true,
  },
  medium: {
    pixelRatio: 1.5, chunkRadius: 2, lodRadius: 5, grassDensity: 60_000, fishCount: 1200,
    shadows: true, shadowMapSize: 1024, godRayPass: false, outline: true, painterly: false,
  },
  low: {
    pixelRatio: 1, chunkRadius: 2, lodRadius: 4, grassDensity: 25_000, fishCount: 500,
    shadows: false, shadowMapSize: 0, godRayPass: false, outline: false, painterly: false,
  },
}

export const QUALITY_ORDER: readonly QualityLevel[] = ['low', 'medium', 'high']

export interface QualityController {
  settings: QualitySettings
  set(level: QualityLevel): void
}

export function createQuality(initial: QualityLevel): QualityController {
  const listeners = new Set<(q: QualitySettings) => void>()
  const settings: QualitySettings = {
    level: initial,
    ...QUALITY_PRESETS[initial],
    onChange(fn) {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
  }
  return {
    settings,
    set(level) {
      if (level === settings.level) return
      Object.assign(settings, QUALITY_PRESETS[level], { level })
      for (const fn of [...listeners]) fn(settings)
    },
  }
}

export function isQualityLevel(v: unknown): v is QualityLevel {
  return v === 'low' || v === 'medium' || v === 'high'
}

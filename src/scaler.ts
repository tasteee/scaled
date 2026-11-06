import performanceCatalog from './data/performances.json'
import voicingCatalog from './data/voicings.json'
import type { ScaledT } from './types.js'
import { checkPerformanceAvailability } from './performanceAvailability.js'

export const performanceTemplates: readonly ScaledT.PerformanceTemplateT[] = performanceCatalog.filter(checkPerformanceAvailability)
export const voicingPresets: readonly ScaledT.VoicingPresetT[] = voicingCatalog


import summaryCatalog from './data/performanceSummaries.json'
import voicingCatalog from './data/voicings.json'
import type { ScaledT } from './types.js'
import { checkPerformanceAvailability } from './performanceAvailability.js'

export const performanceSummaries: readonly ScaledT.PerformanceSummaryT[] = summaryCatalog.filter(checkPerformanceAvailability)

export const voicingPresets: readonly ScaledT.VoicingPresetT[] = voicingCatalog

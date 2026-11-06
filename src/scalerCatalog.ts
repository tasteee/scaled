import summaryCatalog from './data/performanceSummaries.json'
import voicingCatalog from './data/voicings.json'
import type * as recovered from './recoveredTypes.js'

export const performanceSummaries: readonly recovered.RecoveredPerformanceSummaryT[] = summaryCatalog

export const voicingPresets: readonly recovered.RecoveredVoicingPresetT[] = voicingCatalog
export * from './scalerVoicing.js'

import performanceCatalog from './data/performances.json'
import voicingCatalog from './data/voicings.json'
import type * as types from './recoveredTypes.js'

export const performanceTemplates: readonly types.RecoveredPerformanceTemplateT[] = performanceCatalog
export const voicingPresets: readonly types.RecoveredVoicingPresetT[] = voicingCatalog

export type * from './recoveredTypes.js'
export * from './scalerPerformance.js'
export * from './scalerScalePerformance.js'
export * from './scalerTemplate.js'
export * from './scalerGroove.js'
export * from './scalerVoicing.js'
export * from './scalerStrummed.js'
export * from './scalerScaleMapping.js'
export * from './scalerCatalog.js'

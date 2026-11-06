export type RecoveredVoicingShapeT = {
  readonly sourceSlot: number
  readonly sourceIntervals: readonly number[]
}

export type RecoveredVoicingPresetT = {
  readonly id: string
  readonly name: string
  readonly shapes: readonly RecoveredVoicingShapeT[]
}

export type RecoveredPerformanceEventT = {
  readonly id: number
  readonly sourcePitchIndex: number
  readonly sourceMidiNote: number
  readonly startBeat: number
  readonly durationBeats: number
  readonly velocity: number
  readonly startOffsetBeats: number
  readonly durationOffsetBeats: number
}

export type RecoveredPerformanceTemplateT = {
  readonly id: string
  readonly name: string
  readonly type: string
  readonly category: string
  readonly subcategory: string
  readonly source: string
  readonly durationBeats: number
  readonly timeSignature: {
    readonly numerator: number
    readonly denominator: number
  }
  readonly referenceMidiNotes: readonly number[]
  readonly octaveDifference: number
  readonly events: readonly RecoveredPerformanceEventT[]
  readonly provenance: {
    readonly resourcePath: string
    readonly sourceSha256: string
    readonly ticksPerBeat: number
    readonly lastPositionTicks: number
  }
}

export type RecoveredPerformanceSummaryT = Pick<RecoveredPerformanceTemplateT, 'id' | 'name' | 'category' | 'subcategory' | 'durationBeats' | 'timeSignature'>

export const ChordFamily = {
  power: 'power',
  triad: 'triad',
  sixth: 'sixth',
  seventh: 'seventh',
  ninth: 'ninth',
  eleventh: 'eleventh',
  thirteenth: 'thirteenth'
} as const

export type ChordFamilyT = (typeof ChordFamily)[keyof typeof ChordFamily]

export type ChordDefinitionT = {
  readonly id: string
  readonly name: string
  readonly formula: readonly string[]
  readonly optional: readonly number[]
}

export type ScaleDefinitionT = {
  readonly id: string
  readonly name: string
  readonly formula: readonly string[]
  readonly alternateNames: readonly string[]
}

export type ChordT = {
  readonly symbol: string
  readonly rootPitch: number
  readonly chordType: string
  readonly intervals: readonly number[]
  readonly midiNotes: readonly number[]
}

export type VoicingNameT = 'rootPosition' | 'closed' | 'open' | 'drop2'

export type VoicedChordT = ChordT & {
  readonly voicing: VoicingNameT
  readonly inversion: number
}

export type GetChordInputT = {
  readonly chord: string | ChordT
  readonly octave?: number
}

export type GetChordWithVoicingInputT = GetChordInputT & {
  readonly voicing?: VoicingNameT
  readonly inversion?: number
}

export type ScaleContextT = {
  readonly key: string
  readonly scale: string
}

export type GetScaleInputT = ScaleContextT & {
  readonly octave?: number
}

export type ScaleT = {
  readonly key: string
  readonly name: string
  readonly tonicPitch: number
  readonly intervals: readonly number[]
  readonly pitches: readonly number[]
  readonly midiNotes: readonly number[]
}

export type GetScaleChordsInputT = GetScaleInputT & {
  readonly chordTypes?: readonly ChordFamilyT[]
  readonly includeSuspended?: boolean
  readonly includeAddedTone?: boolean
}

export type ChordToneSelectorT = {
  readonly type: 'chordTone'
  readonly index: number
  readonly octaveOffset?: number
}

export type ScaleDegreeSelectorT = {
  readonly type: 'scaleDegree'
  readonly index: number
  readonly octaveOffset?: number
}

export type RootOffsetSelectorT = {
  readonly type: 'rootOffset'
  readonly semitones: number
}

export type FixedPitchSelectorT = {
  readonly type: 'midi'
  readonly midiNote: number
}

export type PatternPitchSelectorT =
  | ChordToneSelectorT
  | ScaleDegreeSelectorT
  | RootOffsetSelectorT
  | FixedPitchSelectorT

export type PatternEventT = {
  readonly id?: string
  readonly startBeat: number
  readonly durationBeats: number
  readonly velocity?: number
  readonly pitch: PatternPitchSelectorT
}

export type PerformancePatternT = {
  readonly id: string
  readonly name: string
  readonly durationBeats: number
  readonly events: readonly PatternEventT[]
}

export type TickPatternEventT = {
  readonly id?: string
  readonly startTick: number
  readonly durationTicks: number
  readonly velocity?: number
  readonly pitch: PatternPitchSelectorT
}

export type TickPatternT = {
  readonly id: string
  readonly name: string
  readonly ticksPerBeat: number
  readonly durationTicks: number
  readonly events: readonly TickPatternEventT[]
}

export type ProgressionChordT = {
  readonly id?: string
  readonly chord: string | ChordT
  readonly startBeat?: number
  readonly durationBeats: number
}

export type ApplyPerformanceInputT = {
  readonly progression: readonly ProgressionChordT[]
  readonly performance: PerformancePatternT
  readonly key?: string
  readonly scale?: string
  readonly octave?: number
}

export type PerformanceNoteT = {
  readonly id: string
  readonly midiNote: number
  readonly startBeat: number
  readonly durationBeats: number
  readonly velocity: number
  readonly chordId: string
  readonly eventId: string
}

export type MidiClipT = {
  readonly durationBeats: number
  readonly notes: readonly PerformanceNoteT[]
}

export type TimeSignatureT = {
  readonly numerator: number
  readonly denominator: number
}

export type ExportMidiInputT = {
  readonly clip: MidiClipT
  readonly tempo?: number
  readonly ticksPerBeat?: number
  readonly channel?: number
  readonly timeSignature?: TimeSignatureT
}

export type ScaledEngineOptionsT = {
  readonly octave?: number
  readonly velocity?: number
}

export type ScaledEngineT = {
  readonly ticksToBeats: (ticks: number, ticksPerBeat: number) => number
  readonly beatsToTicks: (beats: number, ticksPerBeat: number) => number
  readonly barsToBeats: (bars: number, timeSignature: TimeSignatureT) => number
  readonly createPatternFromTicks: (input: TickPatternT) => PerformancePatternT
  readonly createEngine: (options?: ScaledEngineOptionsT) => ScaledEngineT
  readonly getChord: (input: GetChordInputT) => ChordT
  readonly getChordWithVoicing: (input: GetChordWithVoicingInputT) => VoicedChordT
  readonly getScale: (input: GetScaleInputT) => ScaleT
  readonly getScaleChords: (input: GetScaleChordsInputT) => readonly ChordT[]
  readonly getChordDefinitions: () => readonly ChordDefinitionT[]
  readonly getScaleDefinitions: () => readonly ScaleDefinitionT[]
  readonly applyPerformance: (input: ApplyPerformanceInputT) => MidiClipT
  readonly exportMidi: (input: ExportMidiInputT) => Uint8Array
}

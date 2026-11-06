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

export const voicingNames = [
  'rootPosition',
  'closed',
  'dynamic',
  'dynamicBass',
  'open',
  'guitar',
  'drop2',
  'drop3',
  'drop4',
  'drop2and3',
  'drop2and4',
  'spread',
  'shell'
] as const

export type VoicingNameT = (typeof voicingNames)[number]

// Fewest chord notes a voicing needs. Voicings missing here work with any chord.
export const voicingMinimumNotes: Readonly<Partial<Record<VoicingNameT, number>>> = {
  drop2: 4,
  drop3: 4,
  drop4: 4,
  drop2and3: 4,
  drop2and4: 4,
  shell: 2
}

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
  // Notes of the chord that came before. Only dynamic and dynamicBass use it:
  // they pick the inversion that moves the least from these notes.
  readonly previousMidiNotes?: readonly number[]
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
  // Optional name for the exported file. Cleaned up and given a .mid extension.
  readonly fileName?: string
}

// The encoded MIDI file bytes, carrying the file name to save them under.
export type MidiFileT = Uint8Array & { readonly fileName: string }

export type ScaledEngineOptionsT = {
  readonly octave?: number
  readonly velocity?: number
}

export type ScaledT = {
  readonly ChordFamily: typeof ChordFamily
  readonly voicingNames: typeof voicingNames
  readonly voicingMinimumNotes: typeof voicingMinimumNotes
  readonly voicingPresets: readonly ScaledT.VoicingPresetT[]
  readonly performanceTemplates: readonly ScaledT.PerformanceTemplateT[]
  readonly performanceSummaries: readonly ScaledT.PerformanceSummaryT[]
  readonly getScaleVoicingChords: typeof import('./scalerVoicing.js').getScaleVoicingChords
  readonly canAdaptPerformanceTemplate: typeof import('./scalerTemplate.js').canAdaptPerformanceTemplate
  readonly adaptPerformanceTemplate: typeof import('./scalerTemplate.js').adaptPerformanceTemplate
  readonly canAdaptRhythmTemplate: typeof import('./scalerPerformance.js').canAdaptRhythmTemplate
  readonly adaptRhythmTemplate: typeof import('./scalerPerformance.js').adaptRhythmTemplate
  readonly adaptStrummedTemplate: typeof import('./scalerStrummed.js').adaptStrummedTemplate
  readonly getGrooveMidiNotes: typeof import('./scalerGroove.js').getGrooveMidiNotes
  readonly getScalePerformance: typeof import('./scalerScalePerformance.js').getScalePerformance
  readonly mapScaleNotes: typeof import('./scalerScaleMapping.js').mapScaleNotes
  readonly ticksToBeats: (ticks: number, ticksPerBeat: number) => number
  readonly beatsToTicks: (beats: number, ticksPerBeat: number) => number
  readonly barsToBeats: (bars: number, timeSignature: TimeSignatureT) => number
  readonly createPatternFromTicks: (input: TickPatternT) => PerformancePatternT
  readonly createEngine: (options?: ScaledEngineOptionsT) => ScaledT
  readonly getChord: (input: GetChordInputT) => ChordT
  readonly getChordWithVoicing: (input: GetChordWithVoicingInputT) => VoicedChordT
  readonly getProgressionWithVoicing: (inputs: readonly GetChordWithVoicingInputT[]) => readonly VoicedChordT[]
  readonly getScale: (input: GetScaleInputT) => ScaleT
  readonly getScaleChords: (input: GetScaleChordsInputT) => readonly ChordT[]
  readonly getChordDefinitions: () => readonly ChordDefinitionT[]
  readonly getScaleDefinitions: () => readonly ScaleDefinitionT[]
  readonly applyPerformance: (input: ApplyPerformanceInputT) => MidiClipT
  readonly exportMidi: (input: ExportMidiInputT) => MidiFileT
}

export type ScaledEngineT = ScaledT

// Distinct aliases prevent circular namespace references
// when the build bundles the public declarations.
type ScaledChordFamilyT = ChordFamilyT
type ScaledChordDefinitionT = ChordDefinitionT
type ScaledScaleDefinitionT = ScaleDefinitionT
type ScaledChordT = ChordT
type ScaledVoicingNameT = VoicingNameT
type ScaledVoicedChordT = VoicedChordT
type ScaledGetChordInputT = GetChordInputT
type ScaledGetChordWithVoicingInputT = GetChordWithVoicingInputT
type ScaledScaleContextT = ScaleContextT
type ScaledGetScaleInputT = GetScaleInputT
type ScaledScaleT = ScaleT
type ScaledGetScaleChordsInputT = GetScaleChordsInputT
type ScaledChordToneSelectorT = ChordToneSelectorT
type ScaledScaleDegreeSelectorT = ScaleDegreeSelectorT
type ScaledRootOffsetSelectorT = RootOffsetSelectorT
type ScaledFixedPitchSelectorT = FixedPitchSelectorT
type ScaledPatternPitchSelectorT = PatternPitchSelectorT
type ScaledPatternEventT = PatternEventT
type ScaledPerformancePatternT = PerformancePatternT
type ScaledTickPatternEventT = TickPatternEventT
type ScaledTickPatternT = TickPatternT
type ScaledProgressionChordT = ProgressionChordT
type ScaledApplyPerformanceInputT = ApplyPerformanceInputT
type ScaledPerformanceNoteT = PerformanceNoteT
type ScaledMidiClipT = MidiClipT
type ScaledTimeSignatureT = TimeSignatureT
type ScaledExportMidiInputT = ExportMidiInputT
type ScaledMidiFileT = MidiFileT
type ScaledScaledEngineOptionsT = ScaledEngineOptionsT
type ScaledGetScaleVoicingChordsInputT = import('./scalerVoicing.js').GetScaleVoicingChordsInputT
type ScaledScaleVoicingChordT = import('./scalerVoicing.js').ScaleVoicingChordT
type ScaledAdaptPerformanceTemplateInputT = import('./scalerTemplate.js').AdaptPerformanceTemplateInputT
type ScaledAdaptRhythmTemplateInputT = import('./scalerPerformance.js').AdaptRhythmTemplateInputT
type ScaledAdaptStrummedTemplateInputT = import('./scalerStrummed.js').AdaptStrummedTemplateInputT
type ScaledGetGrooveMidiNotesInputT = import('./scalerGroove.js').GetGrooveMidiNotesInputT
type ScaledGetScalePerformanceInputT = import('./scalerScalePerformance.js').GetScalePerformanceInputT
type ScaledScalePerformanceT = import('./scalerScalePerformance.js').ScalePerformanceT
type ScaledMapScaleNotesInputT = import('./scalerScaleMapping.js').MapScaleNotesInputT
type ScaledVoicingShapeT = import('./recoveredTypes.js').RecoveredVoicingShapeT
type ScaledVoicingPresetT = import('./recoveredTypes.js').RecoveredVoicingPresetT
type ScaledPerformanceEventT = import('./recoveredTypes.js').RecoveredPerformanceEventT
type ScaledPerformanceTemplateT = import('./recoveredTypes.js').RecoveredPerformanceTemplateT
type ScaledPerformanceSummaryT = import('./recoveredTypes.js').RecoveredPerformanceSummaryT

export declare namespace ScaledT {
  export type ChordFamilyT = ScaledChordFamilyT
  export type ChordDefinitionT = ScaledChordDefinitionT
  export type ScaleDefinitionT = ScaledScaleDefinitionT
  export type ChordT = ScaledChordT
  export type VoicingNameT = ScaledVoicingNameT
  export type VoicedChordT = ScaledVoicedChordT
  export type GetChordInputT = ScaledGetChordInputT
  export type GetChordWithVoicingInputT = ScaledGetChordWithVoicingInputT
  export type ScaleContextT = ScaledScaleContextT
  export type GetScaleInputT = ScaledGetScaleInputT
  export type ScaleT = ScaledScaleT
  export type GetScaleChordsInputT = ScaledGetScaleChordsInputT
  export type ChordToneSelectorT = ScaledChordToneSelectorT
  export type ScaleDegreeSelectorT = ScaledScaleDegreeSelectorT
  export type RootOffsetSelectorT = ScaledRootOffsetSelectorT
  export type FixedPitchSelectorT = ScaledFixedPitchSelectorT
  export type PatternPitchSelectorT = ScaledPatternPitchSelectorT
  export type PatternEventT = ScaledPatternEventT
  export type PerformancePatternT = ScaledPerformancePatternT
  export type TickPatternEventT = ScaledTickPatternEventT
  export type TickPatternT = ScaledTickPatternT
  export type ProgressionChordT = ScaledProgressionChordT
  export type ApplyPerformanceInputT = ScaledApplyPerformanceInputT
  export type PerformanceNoteT = ScaledPerformanceNoteT
  export type MidiClipT = ScaledMidiClipT
  export type TimeSignatureT = ScaledTimeSignatureT
  export type ExportMidiInputT = ScaledExportMidiInputT
  export type MidiFileT = ScaledMidiFileT
  export type ScaledEngineOptionsT = ScaledScaledEngineOptionsT
  export type GetScaleVoicingChordsInputT = ScaledGetScaleVoicingChordsInputT
  export type ScaleVoicingChordT = ScaledScaleVoicingChordT
  export type AdaptPerformanceTemplateInputT = ScaledAdaptPerformanceTemplateInputT
  export type AdaptRhythmTemplateInputT = ScaledAdaptRhythmTemplateInputT
  export type AdaptStrummedTemplateInputT = ScaledAdaptStrummedTemplateInputT
  export type GetGrooveMidiNotesInputT = ScaledGetGrooveMidiNotesInputT
  export type GetScalePerformanceInputT = ScaledGetScalePerformanceInputT
  export type ScalePerformanceT = ScaledScalePerformanceT
  export type MapScaleNotesInputT = ScaledMapScaleNotesInputT
  export type VoicingShapeT = ScaledVoicingShapeT
  export type VoicingPresetT = ScaledVoicingPresetT
  export type PerformanceEventT = ScaledPerformanceEventT
  export type PerformanceTemplateT = ScaledPerformanceTemplateT
  export type PerformanceSummaryT = ScaledPerformanceSummaryT
}

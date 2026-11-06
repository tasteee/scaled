type GetScaleVoicingChordsInputT = {
  readonly presetId: string;
  readonly key: string;
  readonly scale: string;
  readonly octave?: number;
};
type ScaleVoicingChordT = {
  readonly sourceSlot: number;
  readonly presetId: string;
  readonly presetName: string;
  readonly chord: ChordT | null;
};
declare const getScaleVoicingChords: (input: GetScaleVoicingChordsInputT) => readonly ScaleVoicingChordT[];
type RecoveredVoicingShapeT = {
  readonly sourceSlot: number;
  readonly sourceIntervals: readonly number[];
};
type RecoveredVoicingPresetT = {
  readonly id: string;
  readonly name: string;
  readonly shapes: readonly RecoveredVoicingShapeT[];
};
type RecoveredPerformanceEventT = {
  readonly id: number;
  readonly sourcePitchIndex: number;
  readonly sourceMidiNote: number;
  readonly startBeat: number;
  readonly durationBeats: number;
  readonly velocity: number;
  readonly startOffsetBeats: number;
  readonly durationOffsetBeats: number;
};
type RecoveredPerformanceTemplateT = {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly category: string;
  readonly subcategory: string;
  readonly source: string;
  readonly durationBeats: number;
  readonly timeSignature: {
    readonly numerator: number;
    readonly denominator: number;
  };
  readonly referenceMidiNotes: readonly number[];
  readonly octaveDifference: number;
  readonly events: readonly RecoveredPerformanceEventT[];
  readonly provenance: {
    readonly resourcePath: string;
    readonly sourceSha256: string;
    readonly ticksPerBeat: number;
    readonly lastPositionTicks: number;
  };
};
type RecoveredPerformanceSummaryT = Pick<RecoveredPerformanceTemplateT, 'id' | 'name' | 'category' | 'subcategory' | 'durationBeats' | 'timeSignature'>;
type AdaptPerformanceTemplateInputT = {
  readonly template: RecoveredPerformanceTemplateT;
  readonly midiNotes: readonly number[];
  readonly key: string;
  readonly scale: string;
  readonly octave: number;
};
declare const canAdaptPerformanceTemplate: (template: {
  readonly category: string;
}) => boolean;
declare const adaptPerformanceTemplate: (input: AdaptPerformanceTemplateInputT) => PerformancePatternT;
type AdaptRhythmTemplateInputT = {
  readonly template: RecoveredPerformanceTemplateT;
  readonly targetNoteCount: number;
};
declare const canAdaptRhythmTemplate: (template: RecoveredPerformanceTemplateT) => boolean;
declare const adaptRhythmTemplate: (input: AdaptRhythmTemplateInputT) => PerformancePatternT;
type AdaptStrummedTemplateInputT = {
  readonly template: RecoveredPerformanceTemplateT;
  readonly targetNoteCount: number;
};
declare const adaptStrummedTemplate: (input: AdaptStrummedTemplateInputT) => PerformancePatternT;
type GetGrooveMidiNotesInputT = {
  readonly template: RecoveredPerformanceTemplateT;
  readonly midiNotes: readonly number[];
};
declare const getGrooveMidiNotes: (input: GetGrooveMidiNotesInputT) => readonly number[];
type GetScalePerformanceInputT = {
  readonly template: RecoveredPerformanceTemplateT;
  readonly midiNotes: readonly number[];
  readonly key: string;
  readonly scale: string;
  readonly octave: number;
};
type ScalePerformanceT = {
  readonly template: RecoveredPerformanceTemplateT;
  readonly midiNotes: readonly (number | undefined)[];
};
declare const getScalePerformance: (input: GetScalePerformanceInputT) => ScalePerformanceT;
type MapScaleNotesInputT = {
  readonly midiNotes: readonly number[];
  readonly sourceKey: string;
  readonly sourceScale: string;
  readonly targetKey: string;
  readonly targetScale: string;
  readonly shouldPreserveNearestRegister?: boolean;
};
declare const mapScaleNotes: (input: MapScaleNotesInputT) => readonly number[];
declare const ChordFamily: {
  readonly power: 'power';
  readonly triad: 'triad';
  readonly sixth: 'sixth';
  readonly seventh: 'seventh';
  readonly ninth: 'ninth';
  readonly eleventh: 'eleventh';
  readonly thirteenth: 'thirteenth';
};
type ChordFamilyT = (typeof ChordFamily)[keyof typeof ChordFamily];
type ChordDefinitionT = {
  readonly id: string;
  readonly name: string;
  readonly formula: readonly string[];
  readonly optional: readonly number[];
};
type ScaleDefinitionT = {
  readonly id: string;
  readonly name: string;
  readonly formula: readonly string[];
  readonly alternateNames: readonly string[];
};
type ChordT = {
  readonly symbol: string;
  readonly rootPitch: number;
  readonly chordType: string;
  readonly intervals: readonly number[];
  readonly midiNotes: readonly number[];
};
declare const voicingNames: readonly ['rootPosition', 'closed', 'dynamic', 'dynamicBass', 'open', 'guitar', 'drop2', 'drop3', 'drop4', 'drop2and3', 'drop2and4', 'spread', 'shell'];
type VoicingNameT = (typeof voicingNames)[number];
declare const voicingMinimumNotes: Readonly<Partial<Record<VoicingNameT, number>>>;
type VoicedChordT = ChordT & {
  readonly voicing: VoicingNameT;
  readonly inversion: number;
};
type GetChordInputT = {
  readonly chord: string | ChordT;
  readonly octave?: number;
};
type GetChordWithVoicingInputT = GetChordInputT & {
  readonly voicing?: VoicingNameT;
  readonly inversion?: number;
  readonly previousMidiNotes?: readonly number[];
};
type ScaleContextT = {
  readonly key: string;
  readonly scale: string;
};
type GetScaleInputT = ScaleContextT & {
  readonly octave?: number;
};
type ScaleT = {
  readonly key: string;
  readonly name: string;
  readonly tonicPitch: number;
  readonly intervals: readonly number[];
  readonly pitches: readonly number[];
  readonly midiNotes: readonly number[];
};
type GetScaleChordsInputT = GetScaleInputT & {
  readonly chordTypes?: readonly ChordFamilyT[];
  readonly includeSuspended?: boolean;
  readonly includeAddedTone?: boolean;
};
type ChordToneSelectorT = {
  readonly type: 'chordTone';
  readonly index: number;
  readonly octaveOffset?: number;
};
type ScaleDegreeSelectorT = {
  readonly type: 'scaleDegree';
  readonly index: number;
  readonly octaveOffset?: number;
};
type RootOffsetSelectorT = {
  readonly type: 'rootOffset';
  readonly semitones: number;
};
type FixedPitchSelectorT = {
  readonly type: 'midi';
  readonly midiNote: number;
};
type PatternPitchSelectorT = ChordToneSelectorT | ScaleDegreeSelectorT | RootOffsetSelectorT | FixedPitchSelectorT;
type PatternEventT = {
  readonly id?: string;
  readonly startBeat: number;
  readonly durationBeats: number;
  readonly velocity?: number;
  readonly pitch: PatternPitchSelectorT;
};
type PerformancePatternT = {
  readonly id: string;
  readonly name: string;
  readonly durationBeats: number;
  readonly events: readonly PatternEventT[];
};
type TickPatternEventT = {
  readonly id?: string;
  readonly startTick: number;
  readonly durationTicks: number;
  readonly velocity?: number;
  readonly pitch: PatternPitchSelectorT;
};
type TickPatternT = {
  readonly id: string;
  readonly name: string;
  readonly ticksPerBeat: number;
  readonly durationTicks: number;
  readonly events: readonly TickPatternEventT[];
};
type ProgressionChordT = {
  readonly id?: string;
  readonly chord: string | ChordT;
  readonly startBeat?: number;
  readonly durationBeats: number;
};
type ApplyPerformanceInputT = {
  readonly progression: readonly ProgressionChordT[];
  readonly performance: PerformancePatternT;
  readonly key?: string;
  readonly scale?: string;
  readonly octave?: number;
};
type PerformanceNoteT = {
  readonly id: string;
  readonly midiNote: number;
  readonly startBeat: number;
  readonly durationBeats: number;
  readonly velocity: number;
  readonly chordId: string;
  readonly eventId: string;
};
type MidiClipT = {
  readonly durationBeats: number;
  readonly notes: readonly PerformanceNoteT[];
};
type TimeSignatureT = {
  readonly numerator: number;
  readonly denominator: number;
};
type ExportMidiInputT = {
  readonly clip: MidiClipT;
  readonly tempo?: number;
  readonly ticksPerBeat?: number;
  readonly channel?: number;
  readonly timeSignature?: TimeSignatureT;
  readonly fileName?: string;
};
type MidiFileT = Uint8Array & {
  readonly fileName: string;
};
type ScaledEngineOptionsT = {
  readonly octave?: number;
  readonly velocity?: number;
};
type ScaledT = {
  readonly ChordFamily: typeof ChordFamily;
  readonly voicingNames: typeof voicingNames;
  readonly voicingMinimumNotes: typeof voicingMinimumNotes;
  readonly voicingPresets: readonly ScaledT.VoicingPresetT[];
  readonly performanceTemplates: readonly ScaledT.PerformanceTemplateT[];
  readonly performanceSummaries: readonly ScaledT.PerformanceSummaryT[];
  readonly getScaleVoicingChords: typeof getScaleVoicingChords;
  readonly canAdaptPerformanceTemplate: typeof canAdaptPerformanceTemplate;
  readonly adaptPerformanceTemplate: typeof adaptPerformanceTemplate;
  readonly canAdaptRhythmTemplate: typeof canAdaptRhythmTemplate;
  readonly adaptRhythmTemplate: typeof adaptRhythmTemplate;
  readonly adaptStrummedTemplate: typeof adaptStrummedTemplate;
  readonly getGrooveMidiNotes: typeof getGrooveMidiNotes;
  readonly getScalePerformance: typeof getScalePerformance;
  readonly mapScaleNotes: typeof mapScaleNotes;
  readonly ticksToBeats: (ticks: number, ticksPerBeat: number) => number;
  readonly beatsToTicks: (beats: number, ticksPerBeat: number) => number;
  readonly barsToBeats: (bars: number, timeSignature: TimeSignatureT) => number;
  readonly createPatternFromTicks: (input: TickPatternT) => PerformancePatternT;
  readonly createEngine: (options?: ScaledEngineOptionsT) => ScaledT;
  readonly getChord: (input: GetChordInputT) => ChordT;
  readonly getChordWithVoicing: (input: GetChordWithVoicingInputT) => VoicedChordT;
  readonly getProgressionWithVoicing: (inputs: readonly GetChordWithVoicingInputT[]) => readonly VoicedChordT[];
  readonly getScale: (input: GetScaleInputT) => ScaleT;
  readonly getScaleChords: (input: GetScaleChordsInputT) => readonly ChordT[];
  readonly getChordDefinitions: () => readonly ChordDefinitionT[];
  readonly getScaleDefinitions: () => readonly ScaleDefinitionT[];
  readonly applyPerformance: (input: ApplyPerformanceInputT) => MidiClipT;
  readonly exportMidi: (input: ExportMidiInputT) => MidiFileT;
};
type ScaledEngineT = ScaledT;
type ScaledChordFamilyT = ChordFamilyT;
type ScaledChordDefinitionT = ChordDefinitionT;
type ScaledScaleDefinitionT = ScaleDefinitionT;
type ScaledChordT = ChordT;
type ScaledVoicingNameT = VoicingNameT;
type ScaledVoicedChordT = VoicedChordT;
type ScaledGetChordInputT = GetChordInputT;
type ScaledGetChordWithVoicingInputT = GetChordWithVoicingInputT;
type ScaledScaleContextT = ScaleContextT;
type ScaledGetScaleInputT = GetScaleInputT;
type ScaledScaleT = ScaleT;
type ScaledGetScaleChordsInputT = GetScaleChordsInputT;
type ScaledChordToneSelectorT = ChordToneSelectorT;
type ScaledScaleDegreeSelectorT = ScaleDegreeSelectorT;
type ScaledRootOffsetSelectorT = RootOffsetSelectorT;
type ScaledFixedPitchSelectorT = FixedPitchSelectorT;
type ScaledPatternPitchSelectorT = PatternPitchSelectorT;
type ScaledPatternEventT = PatternEventT;
type ScaledPerformancePatternT = PerformancePatternT;
type ScaledTickPatternEventT = TickPatternEventT;
type ScaledTickPatternT = TickPatternT;
type ScaledProgressionChordT = ProgressionChordT;
type ScaledApplyPerformanceInputT = ApplyPerformanceInputT;
type ScaledPerformanceNoteT = PerformanceNoteT;
type ScaledMidiClipT = MidiClipT;
type ScaledTimeSignatureT = TimeSignatureT;
type ScaledExportMidiInputT = ExportMidiInputT;
type ScaledMidiFileT = MidiFileT;
type ScaledScaledEngineOptionsT = ScaledEngineOptionsT;
type ScaledGetScaleVoicingChordsInputT = GetScaleVoicingChordsInputT;
type ScaledScaleVoicingChordT = ScaleVoicingChordT;
type ScaledAdaptPerformanceTemplateInputT = AdaptPerformanceTemplateInputT;
type ScaledAdaptRhythmTemplateInputT = AdaptRhythmTemplateInputT;
type ScaledAdaptStrummedTemplateInputT = AdaptStrummedTemplateInputT;
type ScaledGetGrooveMidiNotesInputT = GetGrooveMidiNotesInputT;
type ScaledGetScalePerformanceInputT = GetScalePerformanceInputT;
type ScaledScalePerformanceT = ScalePerformanceT;
type ScaledMapScaleNotesInputT = MapScaleNotesInputT;
type ScaledVoicingShapeT = RecoveredVoicingShapeT;
type ScaledVoicingPresetT = RecoveredVoicingPresetT;
type ScaledPerformanceEventT = RecoveredPerformanceEventT;
type ScaledPerformanceTemplateT = RecoveredPerformanceTemplateT;
type ScaledPerformanceSummaryT = RecoveredPerformanceSummaryT;
declare namespace ScaledT {
  type ChordFamilyT = ScaledChordFamilyT;
  type ChordDefinitionT = ScaledChordDefinitionT;
  type ScaleDefinitionT = ScaledScaleDefinitionT;
  type ChordT = ScaledChordT;
  type VoicingNameT = ScaledVoicingNameT;
  type VoicedChordT = ScaledVoicedChordT;
  type GetChordInputT = ScaledGetChordInputT;
  type GetChordWithVoicingInputT = ScaledGetChordWithVoicingInputT;
  type ScaleContextT = ScaledScaleContextT;
  type GetScaleInputT = ScaledGetScaleInputT;
  type ScaleT = ScaledScaleT;
  type GetScaleChordsInputT = ScaledGetScaleChordsInputT;
  type ChordToneSelectorT = ScaledChordToneSelectorT;
  type ScaleDegreeSelectorT = ScaledScaleDegreeSelectorT;
  type RootOffsetSelectorT = ScaledRootOffsetSelectorT;
  type FixedPitchSelectorT = ScaledFixedPitchSelectorT;
  type PatternPitchSelectorT = ScaledPatternPitchSelectorT;
  type PatternEventT = ScaledPatternEventT;
  type PerformancePatternT = ScaledPerformancePatternT;
  type TickPatternEventT = ScaledTickPatternEventT;
  type TickPatternT = ScaledTickPatternT;
  type ProgressionChordT = ScaledProgressionChordT;
  type ApplyPerformanceInputT = ScaledApplyPerformanceInputT;
  type PerformanceNoteT = ScaledPerformanceNoteT;
  type MidiClipT = ScaledMidiClipT;
  type TimeSignatureT = ScaledTimeSignatureT;
  type ExportMidiInputT = ScaledExportMidiInputT;
  type MidiFileT = ScaledMidiFileT;
  type ScaledEngineOptionsT = ScaledScaledEngineOptionsT;
  type GetScaleVoicingChordsInputT = ScaledGetScaleVoicingChordsInputT;
  type ScaleVoicingChordT = ScaledScaleVoicingChordT;
  type AdaptPerformanceTemplateInputT = ScaledAdaptPerformanceTemplateInputT;
  type AdaptRhythmTemplateInputT = ScaledAdaptRhythmTemplateInputT;
  type AdaptStrummedTemplateInputT = ScaledAdaptStrummedTemplateInputT;
  type GetGrooveMidiNotesInputT = ScaledGetGrooveMidiNotesInputT;
  type GetScalePerformanceInputT = ScaledGetScalePerformanceInputT;
  type ScalePerformanceT = ScaledScalePerformanceT;
  type MapScaleNotesInputT = ScaledMapScaleNotesInputT;
  type VoicingShapeT = ScaledVoicingShapeT;
  type VoicingPresetT = ScaledVoicingPresetT;
  type PerformanceEventT = ScaledPerformanceEventT;
  type PerformanceTemplateT = ScaledPerformanceTemplateT;
  type PerformanceSummaryT = ScaledPerformanceSummaryT;
}
export { TimeSignatureT as A, ScaleDegreeSelectorT as C, ScaledT as D, ScaledEngineT as E, VoicingNameT as M, voicingMinimumNotes as N, TickPatternEventT as O, voicingNames as P, ScaleDefinitionT as S, ScaledEngineOptionsT as T, PerformanceNoteT as _, ChordT as a, RootOffsetSelectorT as b, FixedPitchSelectorT as c, GetScaleChordsInputT as d, GetScaleInputT as f, PatternPitchSelectorT as g, PatternEventT as h, ChordFamilyT as i, VoicedChordT as j, TickPatternT as k, GetChordInputT as l, MidiFileT as m, ChordDefinitionT as n, ChordToneSelectorT as o, MidiClipT as p, ChordFamily as r, ExportMidiInputT as s, ApplyPerformanceInputT as t, GetChordWithVoicingInputT as u, PerformancePatternT as v, ScaleT as w, ScaleContextT as x, ProgressionChordT as y };
//# sourceMappingURL=types-DLRQ9o4E.d.mts.map
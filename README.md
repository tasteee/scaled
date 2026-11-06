# @tasteee/scaled

`@tasteee/scaled` aims to provide a Scaler-like music-theory and MIDI engine
for applications: scales, compatible chords, inversions, voicings, progressions,
and performance patterns that turn harmony into playable musical phrases.
Use it to build composition tools, chord explorers, progression editors,
arpeggiators, and MIDI workflows without implementing the underlying theory
and pattern scheduling yourself.

The library combines a typed theory API with built-in Scaler catalogs and
adapters for rhythms, grooves, bass lines, melodies, phrases, sequences,
strummed sequences, and passages. Its goal is broad Scaler-level support;
current coverage and compatibility limits are described below. It generates
note data and MIDI files; audio synthesis and playback belong to the host app.

## Contents

- [Usage](#usage)
- [Custom performances](#custom-performances)
- [MIDI files](#midi-files)
- [Voicings](#voicings)
- [Factory performance templates](#factory-performance-templates)
- [API reference](#api-reference)
- [Public types](#public-types)
- [Validation and errors](#validation-and-errors)
- [Development](#development)
- [Interactive examples](#interactive-examples)

## Usage

```ts
import type { ScaledT } from '@tasteee/scaled/types'
import { scaled } from '@tasteee/scaled'

const availableChords = scaled.getScaleChords({
  key: 'C',
  scale: 'major',
  chordTypes: ['triad', 'seventh']
})

const voicedChord = scaled.getChordWithVoicing({
  chord: 'Cmaj7',
  voicing: 'drop2',
  inversion: 1
})

const independentEngine: ScaledT = scaled.createEngine({ octave: 3, velocity: 84 })
```

`scaled` is an initialized engine. Each `createEngine()` call creates a separate
engine with its own defaults. Factory defaults are octave 4 and velocity 90.
The engine uses standard scientific pitch notation: C4 is MIDI 60.

Chord symbols support roots A–G, single sharps/flats, and catalog chord
type names. Common aliases include `Cm`, `Cm7`, `CM7`, and `Cadd9`. Use
`getChordDefinitions()` and `getScaleDefinitions()` to discover the catalog.
Scale aliases include major, minor, and the seven major-scale modes.

`getScaleChords()` uses 255 chord definitions and 76 scales. It
checks every required chord pitch against the scale. Optional-index arrays
are retained as metadata; omission variants are not synthesized. Chords are
ordered by scale degree, then source chord-definition order. This is a
compatible-chord engine, not a replay of all Scaler UI grouping rules.

Chord families are classified by the highest formula degree. Suspended and
added-tone chords are included by default and can be excluded explicitly.
An empty `chordTypes` array selects no families; omitting it selects all.

## Custom performances

```ts
import type { ScaledT } from '@tasteee/scaled/types'

const pattern: ScaledT.PerformancePatternT = {
  id: 'myPattern',
  name: 'Two-bar pattern',
  durationBeats: 8,
  events: [
    { startBeat: 0, durationBeats: 1, pitch: { type: 'chordTone', index: 0 } },
    { startBeat: 2, durationBeats: 1, pitch: { type: 'chordTone', index: 1 } },
    { startBeat: 4, durationBeats: 1, pitch: { type: 'chordTone', index: 2 } },
    { startBeat: 6, durationBeats: 1, pitch: { type: 'chordTone', index: 0, octaveOffset: 1 } }
  ]
}

const progression = [
  { chord: 'C', durationBeats: 6 },
  { chord: 'Am', durationBeats: 10 }
]

const clip = scaled.applyPerformance({ progression, performance: pattern })
```

In 4/4 this is a 1.5-bar chord followed by a 2.5-bar chord. The two-bar pattern
runs continuously. At beat 6, its phase remains 6 and its onset uses Am; at
beat 8, the pattern loops while Am remains active. A one-chord progression
uses the same renderer for any positive duration.

- All timing uses quarter-note beats, independent of tempo and time signature.
- Pitch indices are zero-based: index 0 corresponds to the editor's N1.
- Chord-tone indices wrap through the voiced notes with octave shifts.
- `scaleDegree` selectors use the input key/scale, defaulting to C major.
- `rootOffset` selectors use semitones from the chord root at the requested
  octave; `midi` selectors use a fixed MIDI note.
- Chord objects preserve their existing MIDI pitches. `octave` controls
  symbol expansion, root-offset selection and scale-degree selection; it
  does not transpose a supplied chord object.
- Events retain explicit velocities. Missing velocities use the engine default.
- Notes end at the next chord boundary or clip end. No implicit retrigger occurs.
- Explicit chord starts may leave silent gaps; overlapping chords are rejected.
- The result is a `ScaledT.MidiClipT` with absolute MIDI notes. Inputs are not mutated.
- One render may schedule at most 1,000,000 pattern events.

## MIDI files

```ts
const bytes = scaled.exportMidi({
  clip,
  tempo: 110,
  ticksPerBeat: 480,
  timeSignature: { numerator: 4, denominator: 4 }
})
```

Returns a `ScaledT.MidiFileT` (a `Uint8Array` with a `fileName` property) containing a single-track Standard MIDI File with
tempo, time-signature and note events. Channel defaults to 0. Note-offs are
ordered before note-ons at the same tick. Timing is rounded only at export;
each note lasts at least one tick, which may extend the quantized clip end.
Pass `fileName` to name the file; it is stripped of illegal characters and given
a `.mid` extension (default `scaled.mid`).

## Voicings

`rootPosition` preserves the chord's original notes before inversion.
`closed` folds its formula into a single root-relative octave; `open` raises
alternating voices from that closed arrangement.

| Voicing | Behavior | Min notes |
| --- | --- | --- |
| `dynamic` | Picks the inversion (and octave) that keeps the chord in a cohesive range, or closest to `previousMidiNotes` when given. Ignores `inversion`; the result reports the chosen one. | 1 |
| `dynamicBass` | `dynamic`, plus the root added in the nearest octave below the lowest note. | 1 |
| `guitar` | A playable 6-string shape in standard tuning (E2–E4 open strings, 4-fret reach). `inversion` picks the bass note. Ignores the engine octave. | 3 |
| `drop2` | Lowers the second-highest note an octave. | 4 |
| `drop3` | Lowers the third-highest note an octave. | 4 |
| `drop4` | Lowers the fourth-highest note an octave. | 4 |
| `drop2and3` | Lowers the second- and third-highest notes. | 4 |
| `drop2and4` | Lowers the second- and fourth-highest notes. | 4 |
| `spread` | Pushes upper notes up in pairs (+1, +1, +2, +2 octaves). | 1 |
| `shell` | Keeps root, third and (with 4+ notes) seventh. | 2 |

Drop and shell voicings throw when the chord has too few notes. The exported
`voicingNames` and `voicingMinimumNotes` (from `@tasteee/scaled/types`) list
every voicing and its minimum, so UIs can disable the ones a chord can't use.

`dynamic` and `dynamicBass` depend on the chord before them. Use
`getProgressionWithVoicing(inputs)` to voice a list of chords in order; it
feeds each voiced chord into the next as `previousMidiNotes`.

Inversion is an integer, including negative values. Inversion happens before
spacing. MIDI notes outside 0–127 produce a RangeError.

## Factory performance templates

```ts
import { scaled } from '@tasteee/scaled'

const voicingPresets = scaled.voicingPresets
const performanceTemplates = scaled.performanceTemplates
```

Every engine exposes 14 voicing presets and 1,060 factory performance
templates. The main entry includes the full catalog.

Factory templates have a different type from playable custom patterns.
Their source note indices are not target chord-tone indices. Convert them
with `scaled.adaptPerformanceTemplate({ template, midiNotes, key, scale, octave })`
before calling `scaled.applyPerformance()`.

All eight factory categories are playable in the demo, including Passages.
For v1, the 10 Scale Based Sequences are hidden from the public template
catalogs and demo selectors. Bass, Grooves, Melody, Phrases, Rhythms,
Passages, Sequences, and Strummed Sequences remain available.

Rhythms, Grooves, Passages, and Strummed Sequences adapt to the supplied
chord's notes. Bass, Melody, Phrases, and Sequences follow its root and
quality while retaining scale passing tones. Scale degrees rotate to the
chord root, and chord tones replace the nearest degrees, preferring exact
scale matches. Suspended chords replace the third. Chromatic roots use
the global scale's interval structure transposed to that root.

Pass `chordRootPitch: chord.rootPitch` to `adaptPerformanceTemplate` or
`getScalePerformance`, especially for inversions, rootless voicings, and
ambiguous pitch sets such as C6/Am7. Without it, the adapter matches the
supplied pitch classes against catalog chord definitions in catalog order,
then falls back to the lowest note. Minor variants follow chord quality.
This harmonic adaptation is Scaled behavior, not a promise of exact Scaler
runtime output.

The shared adapter resolves MIDI pitches for one voiced chord. For a
progression, adapt each chord, render against the complete timeline, and
retain that chord's notes to preserve continuous pattern phase. The demo
uses this path for previews, progression playback and MIDI export.

Playback can differ from Scaler. Notes without a valid scale mapping are
omitted. Passages preserve template timing, use voiced chord positions for
base notes, and map upper ornaments to chord pitch classes. Widely spaced
or unusual voicings can produce different upper notes from Scaler. With
fewer than three voices, Passages sustain the supplied chord. Strummed
Sequences use Scaler's default strum settings and support 1–12 voices.
Suggestion APIs remain future work.

## API reference

### Package entry points

| Import path | Public exports |
| --- | --- |
| `@tasteee/scaled` | The initialized `scaled: ScaledT` object, including theory methods, catalogs, constants, adapters, and MIDI export. |
| `@tasteee/scaled/types` | Import `ScaledT` for the engine type and nested types such as `ScaledT.ChordT` and `ScaledT.PerformancePatternT`. |

Use named imports:

```ts
import type { ScaledT } from '@tasteee/scaled/types'
import { scaled } from '@tasteee/scaled'

const chord: ScaledT.ChordT = scaled.getChord({ chord: 'Cmaj7' })
```

`scaled.ChordFamily` has the keys and values `power`, `triad`, `sixth`,
`seventh`, `ninth`, `eleventh`, and `thirteenth`. Use these constants or
string literals when filtering chords. `scaled.voicingNames` lists supported
voicings; `scaled.voicingMinimumNotes` gives minimum note counts where needed.

### Engine methods

Call these methods on `scaled` or any engine returned by `scaled.createEngine()`.
They are not separate named exports from the root package.

| Method | Result | Behavior and defaults |
| --- | --- | --- |
| `scaled.createEngine(options?: ScaledT.ScaledEngineOptionsT)` | `ScaledT` | Creates an independent engine. Options: `octave = 4`, `velocity = 90`. Defaults reset to these values even when called on another configured engine. |
| `scaled.getChord(input: ScaledT.GetChordInputT)` | `ScaledT.ChordT` | Expands `chord` from a symbol or clones a supplied chord object. Optional `octave` overrides the engine default for symbols. |
| `scaled.getChordWithVoicing(input: ScaledT.GetChordWithVoicingInputT)` | `ScaledT.VoicedChordT` | Accepts the same chord input plus `voicing = 'rootPosition'` and `inversion = 0`. See [Voicings](#voicings). |
| `scaled.getScale(input: ScaledT.GetScaleInputT)` | `ScaledT.ScaleT` | Requires `key` and `scale`; optional `octave` overrides the engine default. Returns formula intervals, pitch classes, and MIDI notes without adding a closing octave tonic. |
| `scaled.getScaleChords(input: ScaledT.GetScaleChordsInputT)` | `readonly ScaledT.ChordT[]` | Requires `key` and `scale`. Accepts `octave`, `chordTypes`, `includeSuspended = true`, and `includeAddedTone = true`. Returns chords whose complete formulas fit the scale. |
| `scaled.getChordDefinitions()` | `readonly ScaledT.ChordDefinitionT[]` | Returns a fresh copy of all 255 chord definitions. |
| `scaled.getScaleDefinitions()` | `readonly ScaledT.ScaleDefinitionT[]` | Returns a fresh copy of all 76 scale definitions, including alternate names. |
| `scaled.ticksToBeats(ticks: number, ticksPerBeat: number)` | `number` | Divides ticks by resolution without rounding. |
| `scaled.beatsToTicks(beats: number, ticksPerBeat: number)` | `number` | Multiplies beats by resolution without rounding. |
| `scaled.barsToBeats(bars: number, timeSignature: ScaledT.TimeSignatureT)` | `number` | Computes `bars × numerator × 4 / denominator`; one bar of 6/8 is three quarter-note beats. |
| `scaled.createPatternFromTicks(input: ScaledT.TickPatternT)` | `ScaledT.PerformancePatternT` | Converts loop and event timing from ticks to beats, preserving selectors, IDs, and velocities. |
| `scaled.applyPerformance(input: ScaledT.ApplyPerformanceInputT)` | `ScaledT.MidiClipT` | Loops a pattern continuously over a progression. Defaults: `key = 'C'`, `scale = 'major'`, engine octave and velocity. An empty progression returns an empty, zero-duration clip. |
| `scaled.getProgressionWithVoicing(inputs: ScaledT.GetChordWithVoicingInputT[])` | `readonly ScaledT.VoicedChordT[]` | Voices chords in order so `dynamic`/`dynamicBass` follow the previous chord. |
| `scaled.exportMidi(input: ScaledT.ExportMidiInputT)` | `ScaledT.MidiFileT` | Encodes a format-0 MIDI file. Optional `fileName`. Defaults: `tempo = 120`, `ticksPerBeat = 480`, `channel = 0`, and 4/4. |

```ts
const scale = scaled.getScale({ key: 'D', scale: 'dorian', octave: 3 })
const chord = scaled.getChord({ chord: 'Dm7', octave: 3 })
const chordDefinitions = scaled.getChordDefinitions()
const scaleDefinitions = scaled.getScaleDefinitions()
const barLength = scaled.barsToBeats(1, { numerator: 6, denominator: 8 })
const beatPosition = scaled.ticksToBeats(240, 480)
const tickPosition = scaled.beatsToTicks(0.5, 480)

const tickPattern = scaled.createPatternFromTicks({
  id: 'tickPulse',
  name: 'Tick pulse',
  ticksPerBeat: 480,
  durationTicks: 1920,
  events: [
    {
      startTick: 0,
      durationTicks: 240,
      pitch: { type: 'chordTone', index: 0 }
    }
  ]
})
```

### Catalogs and scale voicings

Every property and method below is available on `scaled` and created engines.

| Property or method | Type or signature | Description |
| --- | --- | --- |
| `scaled.performanceSummaries` | `readonly ScaledT.PerformanceSummaryT[]` | Lightweight metadata for browsing the 1,060 v1 templates. Match a summary's `id` to `performanceTemplates` when loading events. |
| `scaled.performanceTemplates` | `readonly ScaledT.PerformanceTemplateT[]` | Full source templates, including reference notes, events, and provenance. |
| `scaled.voicingPresets` | `readonly ScaledT.VoicingPresetT[]` | The 14 built-in scale-context voicing presets. |
| `scaled.getScaleVoicingChords(input: ScaledT.GetScaleVoicingChordsInputT)` | `readonly ScaledT.ScaleVoicingChordT[]` | Requires `presetId`, `key`, and `scale`; `octave` defaults to 4. Returns the preset's scale-context chord sequence, transposed to the key and octave, with source slot and preset metadata. Throws for unknown presets or unsupported preset/scale combinations. |

Preset IDs come from `voicingPresets`; they are distinct from the engine's
`ScaledT.VoicingNameT` values. Preset shapes describe source scale sequences,
not interval masks to apply to arbitrary chords. Use `getScaleVoicingChords`
to obtain their actual chords.

```ts
import { scaled } from '@tasteee/scaled'

const preset = scaled.voicingPresets[0]
const isMissingPreset = preset === undefined
if (isMissingPreset) throw new Error('No voicing presets available')

const scaleVoicings = scaled.getScaleVoicingChords({
  presetId: preset.id,
  key: 'C',
  scale: 'major',
  octave: 4
})
```

### Performance adapters and pitch mapping

All functions in this table are methods on `scaled` and every created engine.
Input fields are required unless marked optional. These helpers use their
explicit inputs; they do not inherit engine defaults.

| Function | Input | Result and behavior |
| --- | --- | --- |
| `scaled.canAdaptPerformanceTemplate(template)` | `{ category: string }` | `boolean`: checks whether the category is Rhythms, Grooves, Bass, Melody, Passages, Phrases, Sequences, or StrummedSequences. Checks category support, not full template validity. |
| `scaled.adaptPerformanceTemplate(input: ScaledT.AdaptPerformanceTemplateInputT)` | `template`, nonempty `midiNotes`, `key`, `scale`, `octave`, optional `chordRootPitch` | `ScaledT.PerformancePatternT`: shared adapter for all eight categories. Resolves notes for one voiced chord into fixed `midi` selectors, applies category-specific register/velocity behavior, removes duplicate same-pitch onsets, and clips same-pitch overlaps. |
| `scaled.canAdaptRhythmTemplate(template: ScaledT.PerformanceTemplateT)` | A full factory template | `boolean`: checks category `Rhythms` and the supported register `octaveDifference === -1`. Other structural validation occurs during adaptation. |
| `scaled.adaptRhythmTemplate(input: ScaledT.AdaptRhythmTemplateInputT)` | `template`, `targetNoteCount` | `ScaledT.PerformancePatternT`: expands a supported rhythm into chord-tone selectors, cycling source voice patterns to cover 1–128 target voices. Preserves source event velocities. |
| `scaled.adaptStrummedTemplate(input: ScaledT.AdaptStrummedTemplateInputT)` | `template`, `targetNoteCount` | `ScaledT.PerformancePatternT`: uses the template ID to select a built-in strum for 1–12 voices. Returns chord-tone selectors with timing and velocities matching Scaler's default strum settings. Throws for an unknown strummed sequence. |
| `scaled.getGrooveMidiNotes(input: ScaledT.GetGrooveMidiNotesInputT)` | Grooves `template`, nonempty `midiNotes` | `readonly number[]`: builds the source-index pitch vector from unique target pitch classes and source octave repetitions, including the template register shift. This is a pitch vector, not a playable pattern. |
| `scaled.getScalePerformance(input: ScaledT.GetScalePerformanceInputT)` | `template`, nonempty `midiNotes`, `key`, `scale`, `octave`, optional `chordRootPitch` | `ScaledT.ScalePerformanceT`: supports Bass, Melody, Phrases, and Sequences. Selects chord-quality variants, maps pitches to chord harmony with scale passing tones, and applies register and pitch-count rules. The returned vector preserves source indices, including duplicate pitches and `undefined` entries for unmapped notes. |
| `scaled.mapScaleNotes(input: ScaledT.MapScaleNotesInputT)` | `midiNotes`, `sourceKey`, `sourceScale`, `targetKey`, `targetScale`, optional `shouldPreserveNearestRegister = false` | `readonly number[]`: maps notes between scales, drops unmapped notes, sorts, and deduplicates exact MIDI notes. The optional flag shifts the mapped register by an octave when tonic distance exceeds six semitones. Throws if a mapped note leaves MIDI range. |

Use the shared adapter for normal factory playback. The category-specific
helpers expose lower-level behavior and do not all apply the same velocity
normalization. `adaptRhythmTemplate` and `adaptStrummedTemplate` return
chord-relative patterns; the shared adapter resolves those to fixed pitches.
There is no separate public Passage adapter; use `adaptPerformanceTemplate`.

```ts
import { scaled } from '@tasteee/scaled'

const template = scaled.performanceTemplates.find((candidate) => {
  const isRhythm = candidate.category === 'Rhythms'
  return isRhythm
})
const isMissingTemplate = template === undefined
if (isMissingTemplate) throw new Error('No rhythm template available')

const chord = scaled.getChordWithVoicing({ chord: 'Cmaj7', voicing: 'closed' })
const performance = scaled.adaptPerformanceTemplate({
  template,
  midiNotes: chord.midiNotes,
  chordRootPitch: chord.rootPitch,
  key: 'C',
  scale: 'major',
  octave: 4
})
const factoryClip = scaled.applyPerformance({
  progression: [{ chord, durationBeats: 8 }],
  performance
})
const factoryMidi = scaled.exportMidi({ clip: factoryClip })
```

The shared adapter fixes pitches for the supplied chord. Reusing that
pattern across different chords does not reharmonize it. Adapt separately
for each chord and render each pattern against the full progression, then
retain notes matching that chord's `chordId` and combine them into one clip.
Rendering the full timeline keeps the loop phase continuous through changes.

## Public types

### Core types: `ScaledT`

All object fields and array properties are readonly in the core types.
`?` marks an optional property. Pitch classes use C = 0 through B = 11;
intervals are semitone offsets. Formula strings use degrees such as `1`,
`b3`, `5`, and `9`.

| Type | Fields or values |
| --- | --- |
| `ScaledT.ChordFamilyT` | Union of the seven `scaled.ChordFamily` values listed above. |
| `ScaledT.ChordDefinitionT` | `id: string`, `name: string`, `formula: readonly string[]`, `optional: readonly number[]` (source optional-note indices). |
| `ScaledT.ScaleDefinitionT` | `id: string`, `name: string`, `formula: readonly string[]`, `alternateNames: readonly string[]`. |
| `ScaledT.ChordT` | `symbol: string`, `rootPitch: number` (pitch class), `chordType: string`, `intervals: readonly number[]`, `midiNotes: readonly number[]`. |
| `ScaledT.VoicingNameT` | One of `scaled.voicingNames`: `rootPosition`, `closed`, `dynamic`, `dynamicBass`, `open`, `guitar`, `drop2`, `drop3`, `drop4`, `drop2and3`, `drop2and4`, `spread`, `shell`. |
| `ScaledT.VoicedChordT` | All `ScaledT.ChordT` fields plus `voicing: ScaledT.VoicingNameT`, `inversion: number`. Voicing changes MIDI notes while retaining the chord's formula intervals. |
| `ScaledT.GetChordInputT` | `chord: string \| ScaledT.ChordT`, `octave?: number`. |
| `ScaledT.GetChordWithVoicingInputT` | All `ScaledT.GetChordInputT` fields plus `voicing?: ScaledT.VoicingNameT`, `inversion?: number`, `previousMidiNotes?: readonly number[]`. |
| `ScaledT.ScaleContextT` | `key: string`, `scale: string`. |
| `ScaledT.GetScaleInputT` | All `ScaledT.ScaleContextT` fields plus `octave?: number`. |
| `ScaledT.ScaleT` | `key: string`, `name: string`, `tonicPitch: number`, `intervals: readonly number[]`, `pitches: readonly number[]` (pitch classes), `midiNotes: readonly number[]`. |
| `ScaledT.GetScaleChordsInputT` | All `ScaledT.GetScaleInputT` fields plus `chordTypes?: readonly ScaledT.ChordFamilyT[]`, `includeSuspended?: boolean`, `includeAddedTone?: boolean`. |
| `ScaledT.ChordToneSelectorT` | `type: 'chordTone'`, `index: number`, `octaveOffset?: number`. Indexes the voiced chord's MIDI notes. |
| `ScaledT.ScaleDegreeSelectorT` | `type: 'scaleDegree'`, `index: number`, `octaveOffset?: number`. Indexes the context scale's MIDI notes. |
| `ScaledT.RootOffsetSelectorT` | `type: 'rootOffset'`, `semitones: number`. Offsets the chord root at the render octave. |
| `ScaledT.FixedPitchSelectorT` | `type: 'midi'`, `midiNote: number`. An absolute MIDI pitch. |
| `ScaledT.PatternPitchSelectorT` | Union of the four selector types above. Chord-tone and scale-degree indices are zero-based integers; they wrap into higher octaves, and negative indices wrap downward into lower octaves. Fractional indices are rejected. Also `octaveOffset` defaults to 0. |
| `ScaledT.PatternEventT` | `id?: string`, `startBeat: number`, `durationBeats: number`, `velocity?: number`, `pitch: ScaledT.PatternPitchSelectorT`. |
| `ScaledT.PerformancePatternT` | `id: string`, `name: string`, `durationBeats: number` (loop length), `events: readonly ScaledT.PatternEventT[]`. |
| `ScaledT.TickPatternEventT` | `id?: string`, `startTick: number`, `durationTicks: number`, `velocity?: number`, `pitch: ScaledT.PatternPitchSelectorT`. |
| `ScaledT.TickPatternT` | `id: string`, `name: string`, `ticksPerBeat: number`, `durationTicks: number`, `events: readonly ScaledT.TickPatternEventT[]`. |
| `ScaledT.ProgressionChordT` | `id?: string`, `chord: string \| ScaledT.ChordT`, `startBeat?: number`, `durationBeats: number`. Omitted starts follow the previous chord's end, beginning at beat 0. |
| `ScaledT.ApplyPerformanceInputT` | `progression: readonly ScaledT.ProgressionChordT[]`, `performance: ScaledT.PerformancePatternT`, `key?: string`, `scale?: string`, `octave?: number`. |
| `ScaledT.PerformanceNoteT` | `id: string`, `midiNote: number`, `startBeat: number`, `durationBeats: number`, `velocity: number`, `chordId: string`, `eventId: string`. |
| `ScaledT.MidiClipT` | `durationBeats: number`, `notes: readonly ScaledT.PerformanceNoteT[]`, sorted by onset when rendered by the engine. |
| `ScaledT.TimeSignatureT` | `numerator: number`, `denominator: number`. |
| `ScaledT.ExportMidiInputT` | `clip: ScaledT.MidiClipT`, `tempo?: number` (BPM), `ticksPerBeat?: number`, `channel?: number` (zero-based), `timeSignature?: ScaledT.TimeSignatureT`, `fileName?: string`. |
| `ScaledT.MidiFileT` | A `Uint8Array` with a readonly `fileName: string` property. |
| `ScaledT.ScaledEngineOptionsT` | `octave?: number`, `velocity?: number`. |
| `ScaledT` | The complete method contract documented in [Engine methods](#engine-methods). |

Rendered note IDs use `patternId:repeatPosition:eventPosition`. When omitted,
progression IDs become `chord-position` and event IDs become `event-position`;
positions are zero-based. Supply progression IDs when merging per-chord
factory renders.

### Adapter types: `ScaledT`

| Type | Fields |
| --- | --- |
| `ScaledT.AdaptPerformanceTemplateInputT` | `template: ScaledT.PerformanceTemplateT`, `midiNotes: readonly number[]`, `key: string`, `scale: string`, `octave: number`, `chordRootPitch?: number` (integer 0–11). |
| `ScaledT.AdaptRhythmTemplateInputT` | `template: ScaledT.PerformanceTemplateT`, `targetNoteCount: number`. |
| `ScaledT.AdaptStrummedTemplateInputT` | `template: ScaledT.PerformanceTemplateT`, `targetNoteCount: number`. |
| `ScaledT.GetGrooveMidiNotesInputT` | `template: ScaledT.PerformanceTemplateT`, `midiNotes: readonly number[]`. |
| `ScaledT.GetScalePerformanceInputT` | `template: ScaledT.PerformanceTemplateT`, `midiNotes: readonly number[]`, `key: string`, `scale: string`, `octave: number`, `chordRootPitch?: number` (integer 0–11). |
| `ScaledT.ScalePerformanceT` | `template: ScaledT.PerformanceTemplateT`, `midiNotes: readonly (number \| undefined)[]`. |
| `ScaledT.MapScaleNotesInputT` | `midiNotes: readonly number[]`, `sourceKey: string`, `sourceScale: string`, `targetKey: string`, `targetScale: string`, `shouldPreserveNearestRegister?: boolean`. |
| `ScaledT.GetScaleVoicingChordsInputT` | `presetId: string`, `key: string`, `scale: string`, `octave?: number`. |
| `ScaledT.ScaleVoicingChordT` | `sourceSlot: number` (one-based), `presetId: string`, `presetName: string`, `chord: ScaledT.ChordT \| null`; consumers should handle the declared nullable chord. |

### Factory template types: `ScaledT`

These types describe factory templates, not directly playable patterns.
Access them through the same `ScaledT` type import as the core types.

| Type | Fields |
| --- | --- |
| `ScaledT.VoicingShapeT` | `sourceSlot: number`, `sourceIntervals: readonly number[]`. |
| `ScaledT.VoicingPresetT` | `id: string`, `name: string`, `shapes: readonly ScaledT.VoicingShapeT[]`. |
| `ScaledT.PerformanceEventT` | `id: number`, `sourcePitchIndex: number`, `sourceMidiNote: number`, `startBeat: number`, `durationBeats: number`, `velocity: number`, `startOffsetBeats: number`, `durationOffsetBeats: number`. Source indices address the source pitch vector; they are not chord-tone selectors. |
| `ScaledT.PerformanceTemplateT` | `id: string`, `name: string`, `type: string`, `category: string`, `subcategory: string`, `source: string`, `durationBeats: number`, `timeSignature: { numerator: number; denominator: number }`, `referenceMidiNotes: readonly number[]`, `octaveDifference: number`, `events: readonly ScaledT.PerformanceEventT[]`, `provenance` as described below. |
| `ScaledT.PerformanceSummaryT` | The template's `id`, `name`, `category`, `subcategory`, `durationBeats`, and `timeSignature` fields. |

Template `provenance` contains `resourcePath: string`, `sourceSha256: string`,
`ticksPerBeat: number`, and `lastPositionTicks: number`. Source timing offsets
remain metadata; the shared adapter uses category-specific timing rather
than promising arbitrary source-transform controls.

## Validation and errors

Calls throw synchronously for invalid inputs. Unknown symbols, scales,
presets, unsupported template categories or preset/scale combinations, overlapping
progression chords, and unsupported drop-2 chords produce `Error` instances.
Numeric range and integer checks generally produce `RangeError` instances.

- MIDI notes must be integers from 0–127; velocities must be integers from
  1–127. Octaves, inversions, selector indices, and octave offsets must be
  safe integers. Final rendered pitches must fit MIDI range.
- Pattern and chord durations must be finite and positive. Starts must be
  finite and nonnegative. Each event must start before the loop ends;
  its duration may extend beyond that loop and is clipped at chord/clip ends.
- Timing conversion resolution must be a positive safe integer. Standalone
  conversions accept finite fractional or negative positions without rounding.
  `barsToBeats` requires positive integer signature components.
- MIDI export requires resolution 1–32767, channel 0–15, positive representable
  tempo, and a time signature with numerator 1–255 and a power-of-two
  denominator from 1–128. Notes must end within the input clip. MIDI delta
  times must fit the format's four-byte limit.
- Catalog arrays have readonly public types; treat them as immutable source
  data. Engine definition getters return copies, and rendering does not
  mutate its inputs.

## Development

```sh
npm install
npm run build
```

The build produces `dist/index.mjs`, `dist/types.mjs`, source maps and type
declarations. Package exports point to those compiled artifacts. Only `dist`
and this README are included by the package files allowlist; development
scripts and reference fixtures stay outside the npm package.

`npm run dev` watches source files. `npm run typecheck` runs TypeScript checks.
`npm run catalogs` refreshes source JSON from the local catalog files;
it is a development preparation step, not a consumer install hook.

See `examples/continuousPerformance.ts` for the full first rendering flow.

## Interactive examples

Run `npm run demo`, then open http://127.0.0.1:5173.
The demo uses Zest from a pinned GitHub build and the local library source.
Each feature has its own linkable page: inversions, voicings, scales and
compatible chords, and performance patterns with MIDI export. Change a
selection, click the result to hear it, and copy the matching TypeScript
example. Controls, cards, alerts and code blocks use actual Zest elements.
Soundfont piano samples load on the first click and require a network
connection. Playback and MIDI export use 120 BPM.

`npm run demo:typecheck` checks the app. `npm run demo:build` builds it.
`npm run check:demo-performances` checks every dropdown choice through the
demo renderer across three progression scenarios, including MIDI export
and per-category chord overrides.
`npm run check:passages` checks all seven Passages against Scaler reference
performances for four common chord voicings.
`npm run check:chord-following` checks chord roots, quality, inversions,
passing tones, source indices, and all 770 scale-based factory templates.
`npm run check:playback` checks that the first bass pattern plays a four-bar
progression and its highlight wraps only after all sixteen beats.

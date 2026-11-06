# @tasteee/scaled

`@tasteee/scaled` aims to provide a Scaler-like music-theory and MIDI engine
for applications: scales, compatible chords, inversions, voicings, progressions,
and performance patterns that turn harmony into playable musical phrases.
Use it to build composition tools, chord explorers, progression editors,
arpeggiators, and MIDI workflows without implementing the underlying theory
and pattern scheduling yourself.

The library combines a typed theory API with recovered Scaler catalogs and
adapters for rhythms, grooves, bass lines, melodies, phrases, sequences,
strummed sequences, and passages. Its goal is broad Scaler-level support;
current coverage and compatibility limits are described below. It generates
note data and MIDI files; audio synthesis and playback belong to the host app.

## Contents

- [Usage](#usage)
- [Custom performances](#custom-performances)
- [MIDI files](#midi-files)
- [Voicings](#voicings)
- [Recovered Scaler templates](#recovered-scaler-templates)
- [API reference](#api-reference)
- [Public types](#public-types)
- [Validation and errors](#validation-and-errors)
- [Development](#development)
- [Interactive examples](#interactive-examples)

## Usage

```ts
import * as scaledLibrary from '@tasteee/scaled'

const scaled = scaledLibrary.scaled

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

const independentEngine = scaled.createEngine({ octave: 3, velocity: 84 })
```

`scaled` is an initialized engine. Each `createEngine()` call creates a separate
engine with its own defaults. Factory defaults are octave 4 and velocity 90.
The engine uses standard scientific pitch notation: C4 is MIDI 60.

Chord symbols support roots A–G, single sharps/flats, and recovered chord
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
import type * as scaledTypes from '@tasteee/scaled/types'

const pattern: scaledTypes.PerformancePatternT = {
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
- The result is a `MidiClipT` with absolute MIDI notes. Inputs are not mutated.
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

Returns a `Uint8Array` containing a single-track Standard MIDI File with
tempo, time-signature and note events. Channel defaults to 0. Note-offs are
ordered before note-ons at the same tick. Timing is rounded only at export;
each note lasts at least one tick, which may extend the quantized clip end.

## Voicings

`rootPosition` preserves the chord's original notes before inversion.
`closed` folds its formula into a single root-relative octave; `open` raises
alternating voices from that closed arrangement; `drop2` lowers its second
highest voice by an octave and requires at least four notes.

Inversion is an integer, including negative values. Inversion happens before
open/drop-2 spacing. MIDI notes outside 0–127 produce a RangeError.

## Recovered Scaler templates

```ts
import * as scaler from '@tasteee/scaled/scaler'

const voicingPresets = scaler.voicingPresets
const performanceTemplates = scaler.performanceTemplates
```

This separate entry contains 14 voicing presets and 1,070 source performance
templates. The root engine entry does not import that large performance file.

Recovered templates have a different type from playable custom patterns.
Their source note indices are not target chord-tone indices. Convert them
with `adaptPerformanceTemplate({ template, midiNotes, key, scale, octave })`
from the scaler entry before calling `applyPerformance()`.

All eight factory categories are playable in the demo, including Passages.
The shared adapter resolves MIDI pitches for one voiced chord. For a
progression, adapt each chord, render against the complete timeline, and
retain that chord's notes to preserve continuous pattern phase. The demo
uses this path for previews, progression playback and MIDI export.

Playable coverage does not establish complete Scaler parity. Scale mapping
safely omits unresolved source indices rather than reproducing native
out-of-range reads (22 recorded differences across 3,100 comparisons).
Passages preserve source timing, use voiced chord ordinals for base notes,
and map upper ornaments to chord pitch classes. All seven match saved
native captures for common major/minor triads and major sevenths after
normalizing the captured duration. Native chord detection for widely spaced
or unusual voicings can choose different upper notes. With fewer than three
voices, Passages sustain the supplied chord. Strummed Sequences use captured
native default settings and support 1–12 voices. Suggestion APIs remain
future work.

## API reference

### Package entry points

| Import path | Public exports |
| --- | --- |
| `@tasteee/scaled` | Only the initialized `scaled: ScaledEngineT` engine. |
| `@tasteee/scaled/types` | The runtime `ChordFamily` constant and all core types listed below. |
| `@tasteee/scaled/catalog` | `performanceSummaries`, `voicingPresets`, `getScaleVoicingChords`, `GetScaleVoicingChordsInputT`, and `ScaleVoicingChordT`. Avoids loading full performance events. |
| `@tasteee/scaled/scaler` | Everything from the catalog entry, `performanceTemplates`, all adapter and mapping functions below, their input/result types, and all recovered types. |

`ChordFamily` has the keys and values `power`, `triad`, `sixth`, `seventh`,
`ninth`, `eleventh`, and `thirteenth`. Import it from the types entry if you
prefer constants to string literals when filtering chords.

### Engine methods

Call these methods on `scaled` or any engine returned by `scaled.createEngine()`.
They are not separate named exports from the root package.

| Method | Result | Behavior and defaults |
| --- | --- | --- |
| `createEngine(options?: ScaledEngineOptionsT)` | `ScaledEngineT` | Creates an independent engine. Options: `octave = 4`, `velocity = 90`. Defaults reset to these values even when called on another configured engine. |
| `getChord(input: GetChordInputT)` | `ChordT` | Expands `chord` from a symbol or clones a supplied chord object. Optional `octave` overrides the engine default for symbols. |
| `getChordWithVoicing(input: GetChordWithVoicingInputT)` | `VoicedChordT` | Accepts the same chord input plus `voicing = 'rootPosition'` and `inversion = 0`. See [Voicings](#voicings). |
| `getScale(input: GetScaleInputT)` | `ScaleT` | Requires `key` and `scale`; optional `octave` overrides the engine default. Returns formula intervals, pitch classes, and MIDI notes without adding a closing octave tonic. |
| `getScaleChords(input: GetScaleChordsInputT)` | `readonly ChordT[]` | Requires `key` and `scale`. Accepts `octave`, `chordTypes`, `includeSuspended = true`, and `includeAddedTone = true`. Returns chords whose complete formulas fit the scale. |
| `getChordDefinitions()` | `readonly ChordDefinitionT[]` | Returns a fresh copy of all 255 chord definitions. |
| `getScaleDefinitions()` | `readonly ScaleDefinitionT[]` | Returns a fresh copy of all 76 scale definitions, including alternate names. |
| `ticksToBeats(ticks: number, ticksPerBeat: number)` | `number` | Divides ticks by resolution without rounding. |
| `beatsToTicks(beats: number, ticksPerBeat: number)` | `number` | Multiplies beats by resolution without rounding. |
| `barsToBeats(bars: number, timeSignature: TimeSignatureT)` | `number` | Computes `bars × numerator × 4 / denominator`; one bar of 6/8 is three quarter-note beats. |
| `createPatternFromTicks(input: TickPatternT)` | `PerformancePatternT` | Converts loop and event timing from ticks to beats, preserving selectors, IDs, and velocities. |
| `applyPerformance(input: ApplyPerformanceInputT)` | `MidiClipT` | Loops a pattern continuously over a progression. Defaults: `key = 'C'`, `scale = 'major'`, engine octave and velocity. An empty progression returns an empty, zero-duration clip. |
| `exportMidi(input: ExportMidiInputT)` | `Uint8Array` | Encodes a format-0 MIDI file. Defaults: `tempo = 120`, `ticksPerBeat = 480`, `channel = 0`, and 4/4. |

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

| Export | Type or signature | Description |
| --- | --- | --- |
| `performanceSummaries` | `readonly RecoveredPerformanceSummaryT[]` | Lightweight metadata for browsing the 1,070 templates. Match a summary's `id` to `performanceTemplates` when loading events. |
| `performanceTemplates` | `readonly RecoveredPerformanceTemplateT[]` | Full source templates, including reference notes, events, and provenance; available only from the scaler entry. |
| `voicingPresets` | `readonly RecoveredVoicingPresetT[]` | The 14 recovered scale-context voicing presets. |
| `getScaleVoicingChords(input: GetScaleVoicingChordsInputT)` | `readonly ScaleVoicingChordT[]` | Requires `presetId`, `key`, and `scale`; `octave` defaults to 4. Returns the captured scale-context chord sequence, transposed to the key and octave, with source slot and preset metadata. Throws for unknown presets or missing scale captures. |

Preset IDs come from `voicingPresets`; they are distinct from the engine's
four `VoicingNameT` values. Preset shapes describe source scale sequences,
not interval masks to apply to arbitrary chords. Use `getScaleVoicingChords`
to obtain their actual chords.

```ts
import * as scalerCatalog from '@tasteee/scaled/catalog'

const preset = scalerCatalog.voicingPresets[0]
const isMissingPreset = preset === undefined
if (isMissingPreset) throw new Error('No voicing presets available')

const scaleVoicings = scalerCatalog.getScaleVoicingChords({
  presetId: preset.id,
  key: 'C',
  scale: 'major',
  octave: 4
})
```

### Performance adapters and pitch mapping

All functions in this table are named exports of `@tasteee/scaled/scaler`.
Input fields are required unless marked optional. These helpers use their
explicit inputs; they do not inherit engine defaults.

| Function | Input | Result and behavior |
| --- | --- | --- |
| `canAdaptPerformanceTemplate(template)` | `{ category: string }` | `boolean`: checks whether the category is Rhythms, Grooves, Bass, Melody, Passages, Phrases, Sequences, or StrummedSequences. Checks category support, not full template validity. |
| `adaptPerformanceTemplate(input: AdaptPerformanceTemplateInputT)` | `template`, nonempty `midiNotes`, `key`, `scale`, `octave` | `PerformancePatternT`: shared adapter for all eight categories. Resolves notes for one voiced chord into fixed `midi` selectors, applies category-specific register/velocity behavior, removes duplicate same-pitch onsets, and clips same-pitch overlaps. |
| `canAdaptRhythmTemplate(template: RecoveredPerformanceTemplateT)` | A full source template | `boolean`: checks category `Rhythms` and native register `octaveDifference === -1`. Other structural validation occurs during adaptation. |
| `adaptRhythmTemplate(input: AdaptRhythmTemplateInputT)` | `template`, `targetNoteCount` | `PerformancePatternT`: expands a supported rhythm into chord-tone selectors, cycling source voice patterns to cover 1–128 target voices. Preserves source event velocities. |
| `adaptStrummedTemplate(input: AdaptStrummedTemplateInputT)` | `template`, `targetNoteCount` | `PerformancePatternT`: uses the template ID to select a captured strum for 1–12 voices. Returns chord-tone selectors with captured timing and velocities at native default settings. Throws for an unknown capture. |
| `getGrooveMidiNotes(input: GetGrooveMidiNotesInputT)` | Grooves `template`, nonempty `midiNotes` | `readonly number[]`: builds the source-index pitch vector from unique target pitch classes and source octave repetitions, including the template register shift. This is a pitch vector, not a playable pattern. |
| `getScalePerformance(input: GetScalePerformanceInputT)` | `template`, `midiNotes`, `key`, `scale`, `octave` | `ScalePerformanceT`: supports Bass, Melody, Phrases, and Sequences. Selects applicable minor variants, maps source scale pitches, applies register and pitch-count rules, and returns the selected template with its source-index pitch vector. Entries may be `undefined` and must be skipped. |
| `mapScaleNotes(input: MapScaleNotesInputT)` | `midiNotes`, `sourceKey`, `sourceScale`, `targetKey`, `targetScale`, optional `shouldPreserveNearestRegister = false` | `readonly number[]`: uses recovered scale mappings, drops unmapped notes, sorts, and deduplicates exact MIDI notes. The optional flag shifts the mapped register by an octave when tonic distance exceeds six semitones. Throws if a mapped note leaves MIDI range. |

Use the shared adapter for normal factory playback. The category-specific
helpers expose lower-level behavior and do not all apply the same velocity
normalization. `adaptRhythmTemplate` and `adaptStrummedTemplate` return
chord-relative patterns; the shared adapter resolves those to fixed pitches.
There is no separate public Passage adapter; use `adaptPerformanceTemplate`.

```ts
import * as scaler from '@tasteee/scaled/scaler'

const template = scaler.performanceTemplates.find((candidate) => {
  const isRhythm = candidate.category === 'Rhythms'
  return isRhythm
})
const isMissingTemplate = template === undefined
if (isMissingTemplate) throw new Error('No rhythm template available')

const chord = scaled.getChordWithVoicing({ chord: 'Cmaj7', voicing: 'closed' })
const performance = scaler.adaptPerformanceTemplate({
  template,
  midiNotes: chord.midiNotes,
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

### Core types: `@tasteee/scaled/types`

All object fields and array properties are readonly in the core types.
`?` marks an optional property. Pitch classes use C = 0 through B = 11;
intervals are semitone offsets. Formula strings use degrees such as `1`,
`b3`, `5`, and `9`.

| Type | Fields or values |
| --- | --- |
| `ChordFamilyT` | Union of the seven `ChordFamily` values listed above. |
| `ChordDefinitionT` | `id: string`, `name: string`, `formula: readonly string[]`, `optional: readonly number[]` (source optional-note indices). |
| `ScaleDefinitionT` | `id: string`, `name: string`, `formula: readonly string[]`, `alternateNames: readonly string[]`. |
| `ChordT` | `symbol: string`, `rootPitch: number` (pitch class), `chordType: string`, `intervals: readonly number[]`, `midiNotes: readonly number[]`. |
| `VoicingNameT` | `'rootPosition' \| 'closed' \| 'open' \| 'drop2'`. |
| `VoicedChordT` | All `ChordT` fields plus `voicing: VoicingNameT`, `inversion: number`. Voicing changes MIDI notes while retaining the chord's formula intervals. |
| `GetChordInputT` | `chord: string \| ChordT`, `octave?: number`. |
| `GetChordWithVoicingInputT` | All `GetChordInputT` fields plus `voicing?: VoicingNameT`, `inversion?: number`. |
| `ScaleContextT` | `key: string`, `scale: string`. |
| `GetScaleInputT` | All `ScaleContextT` fields plus `octave?: number`. |
| `ScaleT` | `key: string`, `name: string`, `tonicPitch: number`, `intervals: readonly number[]`, `pitches: readonly number[]` (pitch classes), `midiNotes: readonly number[]`. |
| `GetScaleChordsInputT` | All `GetScaleInputT` fields plus `chordTypes?: readonly ChordFamilyT[]`, `includeSuspended?: boolean`, `includeAddedTone?: boolean`. |
| `ChordToneSelectorT` | `type: 'chordTone'`, `index: number`, `octaveOffset?: number`. Indexes the voiced chord's MIDI notes. |
| `ScaleDegreeSelectorT` | `type: 'scaleDegree'`, `index: number`, `octaveOffset?: number`. Indexes the context scale's MIDI notes. |
| `RootOffsetSelectorT` | `type: 'rootOffset'`, `semitones: number`. Offsets the chord root at the render octave. |
| `FixedPitchSelectorT` | `type: 'midi'`, `midiNote: number`. An absolute MIDI pitch. |
| `PatternPitchSelectorT` | Union of the four selector types above. Chord-tone and scale-degree indices are nonnegative, zero-based integers; both wrap into higher octaves, and `octaveOffset` defaults to 0. |
| `PatternEventT` | `id?: string`, `startBeat: number`, `durationBeats: number`, `velocity?: number`, `pitch: PatternPitchSelectorT`. |
| `PerformancePatternT` | `id: string`, `name: string`, `durationBeats: number` (loop length), `events: readonly PatternEventT[]`. |
| `TickPatternEventT` | `id?: string`, `startTick: number`, `durationTicks: number`, `velocity?: number`, `pitch: PatternPitchSelectorT`. |
| `TickPatternT` | `id: string`, `name: string`, `ticksPerBeat: number`, `durationTicks: number`, `events: readonly TickPatternEventT[]`. |
| `ProgressionChordT` | `id?: string`, `chord: string \| ChordT`, `startBeat?: number`, `durationBeats: number`. Omitted starts follow the previous chord's end, beginning at beat 0. |
| `ApplyPerformanceInputT` | `progression: readonly ProgressionChordT[]`, `performance: PerformancePatternT`, `key?: string`, `scale?: string`, `octave?: number`. |
| `PerformanceNoteT` | `id: string`, `midiNote: number`, `startBeat: number`, `durationBeats: number`, `velocity: number`, `chordId: string`, `eventId: string`. |
| `MidiClipT` | `durationBeats: number`, `notes: readonly PerformanceNoteT[]`, sorted by onset when rendered by the engine. |
| `TimeSignatureT` | `numerator: number`, `denominator: number`. |
| `ExportMidiInputT` | `clip: MidiClipT`, `tempo?: number` (BPM), `ticksPerBeat?: number`, `channel?: number` (zero-based), `timeSignature?: TimeSignatureT`. |
| `ScaledEngineOptionsT` | `octave?: number`, `velocity?: number`. |
| `ScaledEngineT` | The complete method contract documented in [Engine methods](#engine-methods). |

Rendered note IDs use `patternId:repeatPosition:eventPosition`. When omitted,
progression IDs become `chord-position` and event IDs become `event-position`;
positions are zero-based. Supply progression IDs when merging per-chord
factory renders.

### Adapter types: `@tasteee/scaled/scaler`

| Type | Fields |
| --- | --- |
| `AdaptPerformanceTemplateInputT` | `template: RecoveredPerformanceTemplateT`, `midiNotes: readonly number[]`, `key: string`, `scale: string`, `octave: number`. |
| `AdaptRhythmTemplateInputT` | `template: RecoveredPerformanceTemplateT`, `targetNoteCount: number`. |
| `AdaptStrummedTemplateInputT` | `template: RecoveredPerformanceTemplateT`, `targetNoteCount: number`. |
| `GetGrooveMidiNotesInputT` | `template: RecoveredPerformanceTemplateT`, `midiNotes: readonly number[]`. |
| `GetScalePerformanceInputT` | `template: RecoveredPerformanceTemplateT`, `midiNotes: readonly number[]`, `key: string`, `scale: string`, `octave: number`. |
| `ScalePerformanceT` | `template: RecoveredPerformanceTemplateT`, `midiNotes: readonly (number \| undefined)[]`. |
| `MapScaleNotesInputT` | `midiNotes: readonly number[]`, `sourceKey: string`, `sourceScale: string`, `targetKey: string`, `targetScale: string`, `shouldPreserveNearestRegister?: boolean`. |
| `GetScaleVoicingChordsInputT` | `presetId: string`, `key: string`, `scale: string`, `octave?: number`. Also exported from the catalog entry. |
| `ScaleVoicingChordT` | `sourceSlot: number` (one-based), `presetId: string`, `presetName: string`, `chord: ChordT \| null`. Also exported from the catalog entry; consumers should handle the declared nullable chord. |

### Recovered types: `@tasteee/scaled/scaler`

Recovered types describe source material, not directly playable patterns.
The catalog entry exposes values typed with these shapes but does not
re-export their type names; import the types from the scaler entry.

| Type | Fields |
| --- | --- |
| `RecoveredVoicingShapeT` | `sourceSlot: number`, `sourceIntervals: readonly number[]`. |
| `RecoveredVoicingPresetT` | `id: string`, `name: string`, `shapes: readonly RecoveredVoicingShapeT[]`. |
| `RecoveredPerformanceEventT` | `id: number`, `sourcePitchIndex: number`, `sourceMidiNote: number`, `startBeat: number`, `durationBeats: number`, `velocity: number`, `startOffsetBeats: number`, `durationOffsetBeats: number`. Source indices address the source pitch vector; they are not chord-tone selectors. |
| `RecoveredPerformanceTemplateT` | `id: string`, `name: string`, `type: string`, `category: string`, `subcategory: string`, `source: string`, `durationBeats: number`, `timeSignature: { numerator: number; denominator: number }`, `referenceMidiNotes: readonly number[]`, `octaveDifference: number`, `events: readonly RecoveredPerformanceEventT[]`, `provenance` as described below. |
| `RecoveredPerformanceSummaryT` | The template's `id`, `name`, `category`, `subcategory`, `durationBeats`, and `timeSignature` fields. |

Template `provenance` contains `resourcePath: string`, `sourceSha256: string`,
`ticksPerBeat: number`, and `lastPositionTicks: number`. Source timing offsets
remain metadata; the shared adapter uses category-specific timing rather
than promising arbitrary source-transform controls.

## Validation and errors

Calls throw synchronously for invalid inputs. Unknown symbols, scales,
presets, unsupported template categories, missing captures, overlapping
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

The build produces `dist/index.mjs`, `dist/scaler.mjs`, source maps and type
declarations. Package exports point to those compiled artifacts. Only `dist`
and this README are included by the package files allowlist; reverse-engineering
scripts, native helpers and research captures stay outside the npm package.

`npm run dev` watches source files. `npm run typecheck` runs TypeScript checks.
`npm run catalogs` refreshes source JSON from the local recovered catalogs;
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
`npm run check:passages` checks all seven Passages against saved native
captures for four common chord voicings.

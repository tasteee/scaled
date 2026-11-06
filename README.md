# @tasteee/scaled

TypeScript chord, voicing and continuous performance tools. Authored in TS;
published as ESM JavaScript with `.d.ts` declarations using tsdown.

## Usage

```ts
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

const independentEngine = scaled.createEngine({ octave: 3, velocity: 84 })
```

`scaled` is an initialized engine. Each `createEngine()` call creates a separate
engine with its own defaults. Factory defaults are octave 4 and velocity 90.
The engine uses standard scientific pitch notation: C4 is MIDI 60.

Chord symbols support roots A–G, single sharps/flats, and recovered chord
type names. Common aliases include `Cm`, `Cm7`, `CM7`, and `Cadd9`. Use
`getChordDefinitions()` and `getScaleDefinitions()` to discover the catalog.
Scale aliases include major, minor, and the seven major-scale modes.

`getScaleChords()` uses 255 recovered chord definitions and 76 scales. It
checks every required chord pitch against the scale. Optional-index arrays
are retained as metadata; omission variants are not synthesized. Chords are
ordered by scale degree, then source chord-definition order. This is a
compatible-chord engine, not a replay of all Scaler UI grouping rules.

Chord families are classified by the highest formula degree. Suspended and
added-tone chords are included by default and can be excluded explicitly.
An empty `chordTypes` array selects no families; omitting it selects all.

## Custom performances

```ts
import type { PerformancePatternT } from '@tasteee/scaled/types'

const pattern: PerformancePatternT = {
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
  octave; `scaled` selectors use a fixed MIDI note.
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
import { voicingPresets, performanceTemplates } from '@tasteee/scaled/scaler'
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

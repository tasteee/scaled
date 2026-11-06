# Scaler resources for tasteee/keylime

## Recovered resources

`catalog/performanceResources/` contains the original embedded ZIP members.
The source archive is loaded by `0x1808066a0` from pointer `0x182d7a028`,
length `0xe6245`. Each extracted member has a checked ZIP CRC32 and a SHA-256
in that directory's manifest. This extraction does not execute the plugin.

`expressions.json` is the factory index, preserving its category and pattern
order. It references 1,070 distinct patterns containing 32,148 events:

| Category | Patterns |
| --- | ---: |
| Bass | 234 |
| Grooves | 151 |
| Melody | 295 |
| Passages | 7 |
| Phrases | 183 |
| Rhythms | 102 |
| Sequences | 68 |
| StrummedSequences | 30 |

The archive also includes metadata and unindexed files. Factory-index count
and ZIP-member count are different quantities.

App-facing exports:

- `catalog/performanceIndex.json`: ordered, lightweight browser catalog.
- `catalog/performances.json`: all indexed event templates, with times in
  quarter-note beats. Reference pitches, note indices, velocities, octave
  differences and timing offsets are preserved.
- `catalog/voicings.json`: 14 voicing presets with their original interval
  sequences, names and UUIDs. These are scale-context sequences rather than
  14 interchangeable interval masks for arbitrary input chords.
- `catalog/performanceLibraryManifest.json`: generated file digests.

Original pattern metadata includes ticksPerBeat, timeSignature,
lastPosition and allNotesNumber. Events include noteId, noteIndex,
noteNumber, velocity, position, position_offset, duration and duration_offset.
Source resolutions are 96 or 480 ticks per quarter note. All indexed timing
offset fields are zero; the event positions themselves contain timing detail.
Preserve those positions rather than quantizing them to the editor grid.

The source contains 4/4, 6/8, 5/4, 12/8, 3/4, 7/4 and 9/4 material.
Normalize to quarter-note beats. Bar length is numerator * 4 / denominator;
do not assume every pattern has four beats per bar.

## Observed Keylime behavior

Read from tasteee/keylime's main branch:

- [Overview](https://github.com/tasteee/keylime/blob/main/OVERVIEW.md)
- [Performance generation](https://github.com/tasteee/keylime/blob/main/src/lib/helpers/performance.ts)
- [Chord expansion](https://github.com/tasteee/keylime/blob/main/src/lib/helpers/chordToNotes.ts)
- [Signal rows](https://github.com/tasteee/keylime/blob/main/src/lib/helpers/signalRows.ts)
- [MIDI export](https://github.com/tasteee/keylime/blob/main/src/lib/helpers/midiExport.ts)

The performance generator already repeats the pattern on the progression
timeline, resolves the active chord at each absolute note onset, and clips
notes at the chord boundary and progression end. Pattern phase does not
reset at a chord change. Playback and MIDI export share that generator.

For the user's example in 4/4:

- Pattern length: two bars = eight quarter-note beats.
- First chord: 1.5 bars = six beats, spanning [0, 6).
- Second chord: 2.5 bars = ten beats, spanning [6, 16).
- At beat six, the pattern is at phase six; subsequent onsets resolve to
  the second chord. At beat eight, the pattern loops while that chord remains.

Clipping a sustained note at a chord change does not automatically retrigger
it under the new chord. Retain the existing clipping default; offer explicit
retriggering only if desired. Do not silently change this behavior while
adding imported patterns.

Keylime currently randomizes velocities between configured minimum and
maximum values. That would erase the imported performance's dynamics.
Imported patterns should retain event velocities by default, with humanizing
and velocity scaling as deliberate options.

The current MIDI exporter uses 128 ticks per beat. Converting source patterns
at 480 ticks per beat into that export resolution can round their timing.
Choose export resolution deliberately; keeping rational beat positions until
export avoids premature quantization.

## Pitch mapping is the remaining playback investigation

Scaler noteIndex refers to an entry in the source allNotesNumber list.
It is not necessarily a target chord-tone index.

Example: Common Bass/Basic-1 has reference pitches [36, 48]. Both are C,
one octave apart. Mapping indices 0 and 1 directly onto N1 and N2 of a
C-major triad would produce C and E, corrupting the bass pattern.

Melody and phrase templates can include passing notes outside the chord.
Keylime's current N1/N2/N3 model only selects voiced chord tones, so it
cannot represent every such template faithfully without an additional
pitch-selection model.

Use one shared pattern renderer, with explicit event pitch selectors such
as chord tone, scale degree, or root-relative semitone offset. User-drawn
N rows remain chord-tone selectors. Keep source reference MIDI pitches on
imported templates until their mapping has been decoded; do not label an
approximate conversion as Scaler-equivalent playback.

The native ExpressionSet adaptation helper at `0x1807ca650` changes event
mapping when the available note count changes. This is evidence that direct
index copying is insufficient. Its complete behavior and the runtime
ExpressionTransform remain to be traced before promising playback parity.

## Proposed engine contract

These are proposed calls, not an implemented package:

```ts
const voicedChord = midi.getChordWithVoicing({
  chord: 'Cmaj7',
  key: 'C',
  scale: 'major',
  voicingId: selectedVoicing.id,
  inversion: 1
})

const progression = [
  { chord: 'C', startBeat: 0, durationBeats: 6 },
  { chord: 'Am', startBeat: 6, durationBeats: 10 }
]

const performedClip = midi.applyPerformance({
  progression,
  performanceId: selectedPerformance.id,
  key: 'C',
  scale: 'major'
})
```

The default rendering contract uses progression-wide continuous phase,
onset-based chord selection, preserved velocities, and note clipping at
chord boundaries and progression end. A one-chord progression uses exactly
the same renderer for any specified duration.

`applyPerformance` should return a rendered MIDI clip containing absolute
notes, not replace the harmonic progression. Keep the harmonic source and
editable pattern so users can change either and render again. A custom
pattern uses the same schema and renderer as a library pattern.

Apply voicing, inversion and register selection before resolving chord-tone
events. Named Scaler voicing presets need a documented scale-context adapter;
ordinary inversions, open/closed spacing and drop voicings are independent
engine operations. Decide explicitly how a preset interacts with an input
chord's sevenths/extensions rather than silently dropping them.

## Repeat extraction

```powershell
node analysis/extractPerformanceCatalog.mjs
node analysis/buildPerformanceLibrary.mjs
```

No changes were made to the Keylime repository. Resource recovery is complete
for the indexed factory patterns; faithful runtime pitch adaptation and the
public MIDI engine API are not implemented by these extraction scripts.

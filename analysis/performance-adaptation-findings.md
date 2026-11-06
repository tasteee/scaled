# Performance adaptation: focused follow-up

## Result

The recovered catalog is complete for the 1,070 indexed factory resources.
The native performance adaptation is not yet reconstructed. A generic
`sourcePitchIndex` to target chord-tone conversion is not faithful across
all categories. Source-pitch transposition can provide an explicitly labeled
audition, but cannot establish Scaler playback parity.

## Evidence inspected

This follow-up inspected previously exported REA/Ghidra pseudocode in
`C:/Users/colsh/Desktop/scaler2-src/functions`. These files report Ghidra
12.1.4 and analysis profile
`64922283ade10fadf28df5d1689f74f28ec027c5180b774a9d26635c0e69c554`.
They are static evidence, not an observation of running Scaler.

- `0x1807ca650.c`: clones an ExpressionSet; when the target has more
  available notes, adds references and copies groups of events with matching
  source pitch indices into the new voice indices. This helper expands an
  expression; it does not explain melody/phrase harmonic adaptation.
- `0x1807ca940.c`: the roughly 1,800-line caller contains separate branches
  for Phrases, Melody, Sequences, Rhythms and StrummedSequences. Early
  branches look up replacement expression resources and derive another
  playable chord/scale context. The Rhythms branch around lines 915–953
  expands source voice count as needed, selects a target note by event
  pitch index, and applies expression octave metadata. StrummedSequences
  additionally processes strumming/ordering state. These distinct branches
  rule out treating the expansion helper as a universal pitch adapter.
- `0x18080e510.c`: ExpressionSet copy constructor used by the expansion
  helper; copies reference-note and event vectors plus metadata.
- `0x1807e12d0.c`: construction sequence identifies ExpressionTransform
  separately from MappingTransform, ScaleLockTransform, VoicingTransform,
  StrummingTransform, ExtraOctavesTransform and ArpeggioTransform.

REA `binary_session` reported no open target. The existing export was reused;
no plugin was launched and no new native session was opened.

## Catalog validation

An exhaustive read of `src/data/performances.json` found 128 events with
zero duration: Bass 2, Grooves 16, Melody 2, Phrases 108. Source MIDI notes
range from 20 to 108; octaveDifference values include -3 through 2.
The current custom-pattern validator rejects zero duration, so even an
audition adapter needs an explicit policy for those events. Dropping them
or extending them by a tick is a transformation and must not be described
as lossless playback.

The first Common Bass pattern uses reference notes 36 and 48: two C notes,
one octave apart. Indices 0 and 1 therefore cannot generally mean the first
and second notes of an arbitrary target chord.

## Safe interface boundaries

- Browsing all source names, categories, timings, dynamics and references
  is supported by the catalog.
- Playing original source MIDI notes, optionally shifted by an explicitly
  supplied number of semitones, is a source audition. It does not follow a
  target chord's quality or voicing and should be labeled accordingly.
- Exact chord-adapted playback needs the remaining category-specific
  branches traced and tested against native output before claiming parity.
- The custom-pattern engine remains appropriate for explicit chord-tone,
  scale-degree, fixed-MIDI and root-offset selectors.

## Implemented Rhythms subset

`src/scalerPerformance.ts` exports `canAdaptRhythmTemplate` and
`adaptRhythmTemplate({ template, targetNoteCount })` through the scaler
entry point. It accepts only the Rhythms category and native register -1.
All 102 catalog rhythms have that register and positive event durations.

The Rhythms branch uses target voice ordinals directly. If the target has
fewer voices, excess source voice events are omitted. If it has more,
source voice event groups are copied cyclically onto extra target voices.
All catalog rhythms begin with one event per source voice in index order,
matching the expansion helper's initial-event lookup.

`captureRhythmAdaptation.mjs` loaded the identified Scaler DLL into a
short-lived headless VST host, initialized its expression catalog, looked
up each template by its raw 16-byte UUID, and invoked native expansion at
`0x1807ca650`. For each of 102 templates and target voice counts one through
seven, converted event voice indices, starts, durations and velocities
matched the TypeScript adapter exactly. The 714 successful comparisons
are recorded in `catalog/rhythmAdaptationManifest.json`.

This is runtime verification of the voice-adaptation helper, with filtering
as in the Rhythms branch. It does not yet verify full ExpressionTransform,
audio processing, expression speed modifiers, or the other categories.

`scripts/checkRhythmAdaptation.mjs` also rendered all 102 adapted rhythms
against four chord sizes (408 renders), checking chord membership,
positive durations and clip bounds, plus voice expansion/reduction and
rejection of non-Rhythms input. TypeScript and build checks passed.

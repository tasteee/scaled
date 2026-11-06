# Recovered Scaler 2 catalogs

These files contain the original JSON bytes embedded in the installed
Scaler 2.9.0 VST2 DLL. They were extracted without executing the plugin.

- `chordTypes.json`: 255 chord type definitions, including formulas,
  optional-index arrays, notation and UUIDs.
- `scales.json`: 76 scale definitions, including formulas, parent scale,
  mode degree, alternate names, priority, style and UUIDs.
- `notes.json`: 12 pitch definitions with enharmonic names and UUIDs.
- `manifest.json`: source binary digest, addresses, file offsets,
  byte lengths, entry counts and individual catalog digests.
- `chordSets.json`: 14 voicing sets, 578 song sets, 283 artist sets,
  and 30 community sets. Original sequences and metadata are preserved.
- `scaleChordGroups.json`: native generated groups and compatible
  variations for all 912 combinations of 76 scales and 12 tonics.
- `suggestionsTonal.json`: 23,388 weighted transitions and 1,296
  native ordered prefix lookups.
- `suggestionsPerScale.json`: 11,683 weighted transitions and 679
  native ordered prefix lookups.
- `suggestions*.raw.json`: runtime double-array trie units and their
  packed guidance words, retained for independent decoding.
- `runtimeManifest.json`: runtime capture method and output digests.

## Evidence

The exported function `0x18078efc0` loads the chord JSON from the pointer
at `0x182d7d740`, with a byte length of `0x18967`.

The exported function `0x18078dab0` loads the scale JSON from the pointer
at `0x182d7d748`, with a byte length of `0x951d`.

The exported function `0x180790d80` loads the note JSON from the pointer
at `0x182d7d750`, with a byte length of `0x7d9`.

All three extracted payloads parse as JSON. Extraction preserves source
bytes and textual property ordering. JavaScript Object.keys enumeration
puts integer-like keys first; the manifest's firstEntries list must not
be interpreted as Scaler's display order.

## Scope

This recovers the music vocabulary, embedded curated sets, generated scale
groups, compatible variations, and both generated suggestion tables.
It does not reproduce the complete running UI or all later voicing
transformations and preferences.

### Scale groups and ordering

The native UI defines groups in this order: Triads, 7ths, 9ths, 11ths,
13ths. Their identifiers are 1 through 5 and their note counts are 3
through 7. Source: `0x180880550` and `0x180848aa0`.

`scaleChordGroups.json` calls the native `0x1807947b0` generator for every
degree of every scale with those five note counts. Chords remain in native
scale-degree order. It also calls `0x180792b40` and captures each native
compatible-chord bucket, preserving its chord order. It includes 25,128
generated non-null degree chords and 108,252 compatible-chord entries
across all transpositions. These counts include repeated chords.

There are also 4,992 null degree results. These are actual null returns
from the generator, preserved rather than replaced with invented chords.
The native UI switches five- and six-note scales away from the default
diatonic view in `0x180880550`. Do not show every exported group as if the
UI always offers it for every scale.

The capture uses native octave argument 3. The first C major triad yields
MIDI notes `[60, 64, 67]`. Transpose playback notes deliberately rather
than assuming the native octave label follows another library's naming.

The `voicingMenu` array records all 14 native menu entries in native
integer-key order, including actual identifiers and labels. The embedded
voicing sequences themselves are in `chordSets.json`.

### Suggestion tables and ordering

The plugin generates its tries from the curated sets at startup. They are
not independent embedded JSON tables. The capture invokes its music
resource initializers and suggestion initializer `0x1808129b0` in a
short-lived helper process, then reads the generated structures.

Tonal keys use semitone offsets relative to the scale tonic:
`0_maj-7_maj` means tonic major followed by major on the root seven
semitones above tonic. Its captured weight is 109.

Per Scale keys use scale-degree tokens: `I_maj-V_maj`, with captured
weight 105, expresses the corresponding degree relationship. Resolving
the target degree requires the selected scale, not a hardcoded major
scale interval table.

Each file has two representations:

- `entries`: all decoded transition tokens and stored integer weights,
  in trie traversal order. This array is not the suggestion ranking.
- `lookups`: each source key and the native lookup routine's ordered
  results, preserving its tie ordering. Use these arrays for rankings.

All 23,388 Tonal and 11,683 Per Scale decoded token/weight pairs matched
the native lookup outputs. Every recovered source key had a nonempty
native lookup. This comparison is recorded in the runtime manifest.

The UI offers profiles Tonal (identifier 1) and Per Scale (identifier 2),
mapped to state values 0 and 1. `0x18074f350` dispatches to `0x180811650`
for Tonal and `0x180811ec0` for Per Scale, requesting at most 20 outputs
per helper call. Per Scale additionally checks native scale membership
at `0x1807a0490`. Raw lookup entries therefore include candidates that
must be removed before displaying final Per Scale suggestions.

Weights are native integer values, not normalized probabilities. A score
such as 0.92 from the earlier proposed API is not recovered Scaler data.

The capture covers factory data in this installed 2.9.0 DLL. User-created
sets, persisted settings, changed octave/voicing preferences, and other
plugin versions can produce different results. Native helpers were
called directly; final UI behavior has not been exhaustively compared.

## Repeat extraction

From the repository root:

```powershell
node analysis/inspectEmbeddedCatalog.mjs --extract
```

The extractor reads the installed DLL and overwrites these extracted
catalog files and their manifest. It does not launch Ghidra or the plugin.

To repeat the runtime capture on this Windows x64 machine:

```powershell
npm install --prefix "$env:TEMP\scaler2-catalog-host" --no-save --package-lock=false --ignore-scripts koffi@3.3.7
node analysis/captureRuntimeCatalog.mjs
```

The runtime helper verifies the exact analyzed DLL digest before calling
version-specific addresses. It loads the plugin into its own process,
initializes music resources, reads tables, closes its VST instance and
exits. It does not open the editor or process audio. It is not a sandbox;
normal plugin initialization side effects are not independently monitored.

`captureScaleCatalog.mjs` and `decodeSuggestionTrie.mjs` contain the focused
capture and decoding helpers. Dependencies were installed in the Windows
temporary directory, outside the application workspace.

# Library data

These versioned JSON files are the maintained runtime data. Building, testing,
and installing scaled do not require the extraction archive or original plugin.

| Files | Role |
| --- | --- |
| chords.json, scales.json | Theory definitions |
| notes.json | Preserved pitch names, enharmonic spellings, and identifiers; not currently imported by the engine |
| voicings.json, voicingChords.json | Factory voicing presets and supported scale shapes |
| suggestionsTonal.json, suggestionsPerScale.json | Complete ranked next-chord lookup tables |
| performanceSummaries.json | Lightweight pattern metadata |
| performances.json, performanceContexts.json | Factory pattern events and adaptation context |
| strummedPatterns.json, passageChordRecognition.json, scaleMapping.json | Required performance-adapter lookup tables |

Inversions and compatible-chord discovery are computed by the library. They do
not require the original large reference matrices at runtime.

## Updates

Edit or replace the normalized catalogs here, retaining stable identifiers,
ordering, and existing schemas. If performance metadata changes, keep summaries
consistent with the corresponding templates. Run npm run check after updates.
A change to the reference behavior must be reviewed before updating regression
fixtures; do not regenerate expected results from the implementation under test.

Original extraction scripts, raw catalogs, corpora, manifests, and diagnostic
probes are kept in a separate archive. They are not build dependencies. The old
importCatalogs.mjs is archived with them for historical regeneration work.

The package files allowlist ships dist, README, and LICENSE. Imported JSON is
embedded in the compiled library; this cleanup does not change loading behavior
or introduce separate JSON exports. notes.json is retained here for future use.
The original third-party data is outside the MIT license; see LICENSE.

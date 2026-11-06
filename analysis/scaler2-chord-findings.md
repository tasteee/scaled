# Scaler 2: chord suggestions and scale-compatible chords

Update: the catalogs, native generated scale groups, compatible variations,
and both weighted suggestion tables have since been recovered. See
`catalog/README.md` and `catalog/runtimeManifest.json`. The unresolved-table
statements below describe the earlier static investigation, not the current
recovery status.

Source: C:/Users/colsh/Desktop/scaler2-src/functions, exported by REA 6.8.0 / Ghidra 12.1.4.
Target: C:/Program Files/Steinberg/VSTPlugins/Scaler2.dll
SHA-256: c2958bfc8d329d0f9752e87b07940d9467941858d49d0ace47b90fbca864445e
Export index: 32,464 written functions, 408 external functions, 1 failed.
These are static observations from decompiler output, not observations of the running plugin. Suggested meanings for unnamed functions are interpretations.

## Scale-compatible chords

- 0x180796340 constructs scaler::Scale. At line 209 it computes (tonic + scale interval) % 12. It builds a pitch-class collection and associated lookup structures.
- 0x1807a0490 is the shared membership predicate. It copies the candidate chord note collection at chord+0x50, rejects an empty collection, and checks each note value against the scale collection at scale+0xc8. Any missing note returns false; all present returns true.
- 0x180792b40 populates a cached chord collection. It iterates scale-associated entries and global candidate collections, invokes 0x1807a0490, and copies accepted Chord objects into a scale-owned collection. The work is guarded by a critical section and a flag at scale+0x120.
- 0x18087d760 constructs DiatonicChordsPanel. This identifies the relevant UI component but does not by itself establish the entire UI-to-generator call path.

Readable description of the observed filter:

    scale_notes = {(tonic + interval) % 12 for interval in scale_intervals}
    keep(chord) = chord.notes is nonempty and every chord note belongs to scale_notes

Example illustrating the rule (not a runtime test): C major contains C D E F G A B. C major, D minor, E minor, F major, G major, A minor and B diminished satisfy it; D major fails because F# is outside the scale. Seventh and extended chords can satisfy the same predicate.

## Chord suggestions

- 0x1807505a0 constructs scaler::SuggestionModel and registers state listeners.
- 0x180750340 calls 0x18074f350 to refresh suggestions.
- 0x18074f350 obtains the selected scale; it falls back to the named C Major scale if absent. A separate missing-chord path uses C maj. It dispatches to 0x180811650 or 0x180811ec0 with a limit of 0x14 (20), depending on state. It subsequently processes each candidate through 0x18074aa40 and optionally 0x18074ccd0.
- 0x180811650 builds a lookup key using 0x18080df50, queries stored structures using 0x18080d810, parses returned entries into chord types and root offsets, constructs Chord objects, and stops at the requested count. Root transposition is explicitly (scale tonic + parsed offset) % 12 at line 347.
- 0x18080df50 computes the source chord root relative to the selected scale tonic (adds 12 for a negative difference) and combines the number with a chord-type identifier into a lookup string.
- 0x180811ec0 uses a different key builder, 0x18080dc80, and different stored structures. It resolves root and chord type identifiers and calls 0x1807a0490 before accepting a chord (line 469). Thus this path explicitly enforces scale membership.
- 0x18080d810 traverses indexed stored data and emits string/integer entries. This supports a lookup-based suggestion path; the exported C files do not contain all the underlying table contents.
- 0x180025860 defines SuggestionState properties: isLiveSuggestion, isSuggestionOpen, preserveVoices, suggestionProfileId.
- 0x18093dd50 contains the controls Select Suggestion Profile, Previous Suggestion Profile and Next Suggestion Profile.
- 0x18074ccd0 calls note-list and pitch-class comparison/transformation helpers. This is consistent with voice preservation, but the exact transformation has not been fully decoded.

## What is established and what remains open

Established: scale notes are transposed modulo 12; compatibility requires every candidate chord note to be in the scale; suggestion generation has stored-lookup paths; one suggestion path explicitly filters against the scale; the refresh requests up to 20 candidates per call and has later voicing processing.

Not yet established: exact table contents and ordering, profile-to-table mapping, whether returned integers are weights or other metadata, all chord shape groups exposed in the UI, exact voice-preservation optimization, and the complete mapping from each visible control to each branch. Do not describe these as recovered ranking rules or assume the entire feature is explained by the membership predicate.

Ghidra reports unrecovered jumps in some scale helpers, including 0x180795610. Decompiled exports are incomplete evidence for those paths. The one failed function also remains unexamined.


# Reference fixtures

These saved independent reference results support the retained parity tests.
They are development-only and excluded from the npm package.

- scaleChordGroups.json: lossless projection of the fields used by the parity
  checks from the original 912-context matrix. It retains ordered variation
  chord types and degree-group MIDI notes, dropping unused metadata and duplicate
  variation MIDI arrays. The test covers 6,024 root buckets and 24,360 seven-note
  degree chords.
- Passages-*.json: original passage captures for pitch, timing, and velocity
  regression checks. Source digests and capture context remain in the files.

The complete originals and extraction tools are preserved in the separate
analysis archive. Treat these fixtures as independent expectations, not output
that should be refreshed automatically when a test fails. Their third-party
content is outside the MIT license; see LICENSE.

# Passage voicing follow-up

The exact Scaler 2 binary recorded in `Passages-voicing-probe.json` was
probed with 19 controlled voicings and 10 holdout voicings across all
seven Passage templates.
The capture script is `probePassageVoicings.mjs`.

The adapter now uses the captured native chord recognition output,
including implied chord tones and the root selected for the supplied
pitch set and bass. The capture has 4,095 nonempty pitch sets and was
checked against 110 wider inversions.
The checked playback fixtures are in
`scripts/checkPassageAdaptation.mjs`.

All 77 original fixtures, 133 controlled voicing fixtures, 70 holdout
fixtures, and 98 stress fixtures with three to eight voices now match
native pitch, timing, duration, and velocity.
`scripts/checkPassageAdaptation.mjs` checks all 378 cases.

The stress capture also contains 21 one- and two-voice cases. Native
Scaler copies the supplied notes with their input duration. The
current adapter receives only MIDI pitches, so it cannot reproduce
that duration. Its existing fallback sustains these sparse chords
for the template duration. Those cases are excluded from the exact
comparison count.

The native Passage function at `0x1807d0480` calls chord construction
at `0x1807d1650`. Without `chordName` metadata, that path invokes
`0x1807a3ba0`, which passes the pitch set to `0x18078a5d0`. The
`capturePassageChordRecognition.mjs` reads the resulting chord pitch list.
For `[60, 62, 64, 66]`, native recognition returns
`[2, 6, 9, 0, 4]` (D, F-sharp, A, C, E), adding an A that was not
supplied. For `[60, 62, 64, 65]`, it returns
`[2, 5, 9, 0, 4]` (D, F, A, C, E). This explains why mapping only
the supplied pitch classes fails. Native chord ordering can also
depend on the bass pitch class, so the capture stores each possible
bass for a pitch set.

The octave rule is in `0x1807d0480`: each upper-note onset
starts from the highest supplied MIDI note, walks upward through the
recognized chord pitch classes, and adds one octave only when the
source note is more than 12 semitones above the reference chord's
last note (MIDI 74). This explains the previous Passage 6 and 7
register failures without template-specific conditions.

import * as assert from 'node:assert/strict'
import * as library from '../dist/index.mjs'

const engine = library.scaled
const majorChord = engine.getChord({ chord: 'C' })
const minorSeventh = engine.getChord({ chord: 'Dm7' })
const enharmonicChord = engine.getChord({ chord: 'D♭' })
assert.deepEqual(majorChord.midiNotes, [60, 64, 67])
assert.deepEqual(minorSeventh.midiNotes, [62, 65, 69, 72])
assert.deepEqual(enharmonicChord.midiNotes, [61, 65, 68])

const dorianScale = engine.getScale({ key: 'D', scale: 'dorian' })
assert.deepEqual(dorianScale.midiNotes, [62, 64, 65, 67, 69, 71, 72])
const majorScale = engine.getScale({ key: 'C', scale: 'major' })
const compatibleChords = engine.getScaleChords({ key: 'C', scale: 'major', chordTypes: ['triad'] })
const hasCompatibleChords = compatibleChords.length > 0
assert.ok(hasCompatibleChords)
for (const chord of compatibleChords) {
  const hasOnlyScaleNotes = chord.midiNotes.every((midiNote) => {
    const pitchClass = midiNote % 12
    const isScalePitch = majorScale.pitches.includes(pitchClass)
    return isScalePitch
  })
  assert.ok(hasOnlyScaleNotes, chord.symbol)
}
const excludedChords = engine.getScaleChords({ key: 'C', scale: 'major', chordTypes: [] })
assert.deepEqual(excludedChords, [])

const voicingFixtures = [
  { voicing: 'rootPosition', inversion: 1, expectedNotes: [64, 67, 71, 72] },
  { voicing: 'rootPosition', inversion: -1, expectedNotes: [59, 60, 64, 67] },
  { voicing: 'closed', inversion: 0, expectedNotes: [60, 64, 67, 71] },
  { voicing: 'open', inversion: 0, expectedNotes: [60, 67, 76, 83] },
  { voicing: 'drop2', inversion: 0, expectedNotes: [55, 60, 64, 71] },
  { voicing: 'drop3', inversion: 0, expectedNotes: [52, 60, 67, 71] },
  { voicing: 'drop4', inversion: 0, expectedNotes: [48, 64, 67, 71] },
  { voicing: 'drop2and3', inversion: 0, expectedNotes: [52, 55, 60, 71] },
  { voicing: 'drop2and4', inversion: 0, expectedNotes: [48, 55, 64, 71] },
  { voicing: 'spread', inversion: 0, expectedNotes: [60, 76, 79, 95] },
  { voicing: 'shell', inversion: 0, expectedNotes: [60, 64, 71] }
]
for (const fixture of voicingFixtures) {
  const voicedChord = engine.getChordWithVoicing({ chord: 'Cmaj7', voicing: fixture.voicing, inversion: fixture.inversion })
  assert.deepEqual(voicedChord.midiNotes, fixture.expectedNotes, fixture.voicing)
}

const extendedChord = engine.getChord({ chord: 'C9' })
const lowerExtendedInversion = engine.getChordWithVoicing({ chord: 'C9', inversion: -1 })
const upperExtendedInversion = engine.getChordWithVoicing({ chord: 'C9', inversion: 1 })
assert.deepEqual(extendedChord.midiNotes, [60, 64, 67, 70, 74])
assert.deepEqual(lowerExtendedInversion.midiNotes, [50, 60, 64, 67, 70])
assert.deepEqual(upperExtendedInversion.midiNotes, [64, 67, 70, 74, 84])

const configuredEngine = engine.createEngine({ octave: 3, velocity: 77 })
const configuredChord = configuredEngine.getChord({ chord: 'C' })
const originalChord = engine.getChord({ chord: 'C' })
assert.deepEqual(configuredChord.midiNotes, [48, 52, 55])
assert.deepEqual(originalChord.midiNotes, [60, 64, 67])
const performance = {
  id: 'core', name: 'Core', durationBeats: 1,
  events: [{ startBeat: 0, durationBeats: 1, pitch: { type: 'chordTone', index: 0 } }]
}
const configuredClip = configuredEngine.applyPerformance({ progression: [{ chord: 'C', durationBeats: 1 }], performance })
assert.equal(configuredClip.notes[0].velocity, 77)
assert.equal(configuredClip.notes[0].midiNote, 48)

const definitions = engine.getChordDefinitions()
const originalFormula = definitions[0].formula[0]
definitions[0].formula[0] = 'mutated'
const freshDefinitions = engine.getChordDefinitions()
assert.equal(freshDefinitions[0].formula[0], originalFormula)

const rejectUnknownChord = () => {
  return engine.getChord({ chord: 'Cnot-a-chord' })
}
const rejectUnknownScale = () => {
  return engine.getScale({ key: 'C', scale: 'not-a-scale' })
}
const shortDropVoicing = engine.getChordWithVoicing({ chord: 'C', voicing: 'drop2' })
assert.deepEqual(shortDropVoicing.midiNotes, [52, 60, 67])
const rejectInvalidInversion = () => {
  return engine.getChordWithVoicing({ chord: 'C', inversion: 0.5 })
}
assert.throws(rejectUnknownChord, /Unknown chord type/)
assert.throws(rejectUnknownScale, /Unknown scale/)
assert.throws(rejectInvalidInversion, RangeError)

console.log('Core theory, compatible chords, voicings, engine defaults, copies and validation passed.')

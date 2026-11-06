import * as assert from 'node:assert/strict'
import * as library from '../dist/index.mjs'

const scaled = library.scaled
const pattern = {
  id: 'speed-test',
  name: 'Two-beat pulse',
  durationBeats: 2,
  events: [
    { id: 'first', startBeat: 0, durationBeats: 1, velocity: 70, pitch: { type: 'chordTone', index: 0 } },
    { id: 'second', startBeat: 1, durationBeats: 1, velocity: 100, pitch: { type: 'chordTone', index: 0 } }
  ]
}
const progression = [
  { id: 'first-chord', chord: 'C', durationBeats: 3 },
  { id: 'second-chord', chord: 'Am', durationBeats: 5 }
]
const originalPattern = structuredClone(pattern)
const originalProgression = structuredClone(progression)
const speeds = [0.25, 0.5, 1, 2]

for (const speedMultiplier of speeds) {
  const clip = scaled.applyPerformance({ progression, performance: pattern, speedMultiplier })
  const expectedCount = 8 * speedMultiplier
  const noteDuration = 1 / speedMultiplier
  assert.equal(clip.durationBeats, 8, 'Speed must preserve progression duration')
  assert.equal(clip.notes.length, expectedCount, `${speedMultiplier}: note count`)
  for (const position of clip.notes.keys()) {
    const note = clip.notes[position]
    const expectedStart = position / speedMultiplier
    const isFirstChord = expectedStart < 3
    const chordEnd = isFirstChord ? 3 : 8
    const expectedDuration = Math.min(noteDuration, chordEnd - expectedStart)
    const expectedPitch = isFirstChord ? 60 : 69
    const expectedChord = isFirstChord ? 'first-chord' : 'second-chord'
    const isFirstEvent = position % 2 === 0
    const expectedVelocity = isFirstEvent ? 70 : 100
    assert.equal(note.startBeat, expectedStart, 'Continuous phase across chord changes')
    assert.equal(note.durationBeats, expectedDuration, 'Scaled duration clips at chord boundaries')
    assert.equal(note.midiNote, expectedPitch, 'Pitch follows the chord at the scaled onset')
    assert.equal(note.chordId, expectedChord)
    assert.equal(note.velocity, expectedVelocity, 'Speed preserves dynamics')
  }
  const file = scaled.exportMidi({ clip, ticksPerBeat: 480 })
  assert.ok(file.length > 22, 'Scaled performance exports as MIDI')
}

const defaultClip = scaled.applyPerformance({ progression, performance: pattern })
const normalClip = scaled.applyPerformance({ progression, performance: pattern, speedMultiplier: 1 })
assert.deepEqual(normalClip, defaultClip, 'Default speed remains exactly 1×')
assert.deepEqual(pattern, originalPattern, 'Speed does not mutate the source pattern')
assert.deepEqual(progression, originalProgression, 'Speed does not mutate the progression')

for (const speedMultiplier of [0, -1, NaN, Infinity]) {
  const renderInvalidSpeed = () => {
    return scaled.applyPerformance({ progression: [], performance: pattern, speedMultiplier })
  }
  assert.throws(renderInvalidSpeed, RangeError, 'Reject invalid speed even for an empty progression')
}

const renderTooManyEvents = () => {
  return scaled.applyPerformance({ progression: [{ chord: 'C', durationBeats: 8 }], performance: pattern, speedMultiplier: 1000000 })
}
assert.throws(renderTooManyEvents, /1,000,000/, 'The scheduling limit applies after scaling')
console.log('Performance speed: quarter, half, normal and double speed; continuous phase, chord clipping, dynamics, MIDI, validation and scheduling limits passed.')

import * as assert from 'node:assert/strict'
import * as library from '../dist/index.mjs'

const fineBeat = library.scaled.ticksToBeats(15, 960)
assert.equal(fineBeat, 1 / 64)
assert.equal(library.scaled.beatsToTicks(fineBeat, 960), 15)
assert.equal(library.scaled.ticksToBeats(160, 480), 1 / 3)
assert.equal(library.scaled.barsToBeats(0.5, { numerator: 4, denominator: 4 }), 2)
assert.equal(library.scaled.barsToBeats(2, { numerator: 6, denominator: 8 }), 6)

const tickPattern = {
  id: 'tick-test',
  name: 'Tick test',
  ticksPerBeat: 960,
  durationTicks: 3840,
  events: [{ startTick: 15, durationTicks: 30, velocity: 80, pitch: { type: 'chordTone', index: 0 } }]
}
const originalInput = structuredClone(tickPattern)
const pattern = library.scaled.createPatternFromTicks(tickPattern)
assert.deepEqual(tickPattern, originalInput)
assert.equal(pattern.durationBeats, 4)
assert.equal(pattern.events[0].startBeat, 1 / 64)
assert.equal(pattern.events[0].durationBeats, 1 / 32)

const clip = library.scaled.applyPerformance({ progression: [{ chord: 'C', durationBeats: 8 }], performance: pattern })
assert.equal(clip.notes.length, 2)
assert.equal(clip.notes[0].startBeat, 1 / 64)
assert.equal(clip.notes[1].startBeat, 4 + 1 / 64)
const bytes = library.scaled.exportMidi({ clip, ticksPerBeat: 960 })
assert.equal(bytes[12], 3)
assert.equal(bytes[13], 192)

const invalidResolution = () => { library.scaled.ticksToBeats(1, 0); return undefined }
const invalidEvent = () => {
  library.scaled.createPatternFromTicks({ ...tickPattern, events: [{ startTick: 3840, durationTicks: 30, pitch: { type: 'midi', midiNote: 60 } }] })
  return undefined
}
assert.throws(invalidResolution, RangeError)
assert.throws(invalidEvent, RangeError)
console.log('Timing checks passed: fractional beats, PPQ, tuplets, meter, repeated rendering and MIDI resolution.')

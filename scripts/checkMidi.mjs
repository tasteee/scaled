import * as assert from 'node:assert/strict'
import * as library from '../dist/index.mjs'

const createNote = (startBeat, durationBeats, midiNote = 60) => {
  return { id: 'note', chordId: 'chord', eventId: 'event', midiNote, velocity: 90, startBeat, durationBeats }
}

const readVariableLength = (bytes, cursor) => {
  let value = 0
  for (const byteNumber of [0, 1, 2, 3]) {
    const byte = bytes[cursor.position]
    assert.notEqual(byte, undefined, `Missing delta byte ${byteNumber}`)
    cursor.position += 1
    value = value * 128 + (byte & 0x7f)
    const isFinalByte = byte < 0x80
    if (isFinalByte) return value
  }
  throw new Error('Invalid MIDI variable-length quantity')
}

const readNoteEvents = (bytes) => {
  const events = []
  const cursor = { position: 22, tick: 0 }
  for (const byteEntry of bytes.entries()) {
    const isEventStart = byteEntry[0] === cursor.position
    if (!isEventStart) continue
    const deltaTicks = readVariableLength(bytes, cursor)
    cursor.tick += deltaTicks
    const status = bytes[cursor.position]
    cursor.position += 1
    const isMetaEvent = status === 0xff
    if (isMetaEvent) {
      cursor.position += 1
      const payloadLength = readVariableLength(bytes, cursor)
      cursor.position += payloadLength
      continue
    }
    const midiNote = bytes[cursor.position]
    const velocity = bytes[cursor.position + 1]
    cursor.position += 2
    events.push({ tick: cursor.tick, status, midiNote, velocity })
  }
  assert.equal(cursor.position, bytes.length)
  return events
}

const fractionalCases = [
  { durationBeats: 0.3, loopBeats: 0.3, startBeat: 0.03 },
  { durationBeats: 1 / 3, loopBeats: 0.1, startBeat: 0.03 },
  { durationBeats: 0.3, loopBeats: 0.1, startBeat: 0.03 }
]
for (const fixture of fractionalCases) {
  const performance = {
    id: 'fractional', name: 'Fractional', durationBeats: fixture.loopBeats,
    events: [{ startBeat: fixture.startBeat, durationBeats: 10, pitch: { type: 'midi', midiNote: 60 } }]
  }
  const clip = library.scaled.applyPerformance({ progression: [{ chord: 'C', durationBeats: fixture.durationBeats }], performance })
  for (const ticksPerBeat of [1, 480, 960, 32767]) {
    const bytes = library.scaled.exportMidi({ clip, ticksPerBeat })
    const events = readNoteEvents(bytes)
    const expectedEventCount = clip.notes.length * 2
    assert.equal(events.length, expectedEventCount)
    const finalEvent = events.at(-1)
    const quantizedClipEnd = Math.round(clip.durationBeats * ticksPerBeat)
    const finalNoteStart = Math.round(clip.notes.at(-1).startBeat * ticksPerBeat)
    const expectedEndTick = Math.max(quantizedClipEnd, finalNoteStart + 1)
    assert.equal(finalEvent.tick, expectedEndTick)
  }
}

const touchingNotes = [createNote(0, 0.5), createNote(0.5, 0.5)]
const touchingBytes = library.scaled.exportMidi({ clip: { durationBeats: 1, notes: touchingNotes }, channel: 15 })
const touchingEvents = readNoteEvents(touchingBytes)
assert.deepEqual(touchingEvents, [
  { tick: 0, status: 0x9f, midiNote: 60, velocity: 90 },
  { tick: 240, status: 0x8f, midiNote: 60, velocity: 0 },
  { tick: 240, status: 0x9f, midiNote: 60, velocity: 90 },
  { tick: 480, status: 0x8f, midiNote: 60, velocity: 0 }
])
const shortNoteBytes = library.scaled.exportMidi({ clip: { durationBeats: 0.0001, notes: [createNote(0, 0.0001)] } })
const shortNoteEvents = readNoteEvents(shortNoteBytes)
assert.equal(shortNoteEvents[1].tick, 1)
const emptyBytes = library.scaled.exportMidi({ clip: { durationBeats: 0, notes: [] } })
const emptyEvents = readNoteEvents(emptyBytes)
assert.deepEqual(emptyEvents, [])

const invalidClips = [
  { durationBeats: 0.3, notes: [createNote(0.03, 0.270001)] },
  { durationBeats: 1e-20, notes: [createNote(0, 2e-20)] },
  { durationBeats: 1, notes: [createNote(1, Number.MIN_VALUE)] },
  { durationBeats: 1, notes: [createNote(0, 0)] },
  { durationBeats: 1, notes: [createNote(-0.1, 0.5)] },
  { durationBeats: 1, notes: [createNote(0, 1, 128)] },
  { durationBeats: Number.MAX_VALUE, notes: [createNote(Number.MAX_VALUE / 2, Number.MAX_VALUE)] }
]
for (const invalidClip of invalidClips) {
  const exportInvalidClip = () => {
    return library.scaled.exportMidi({ clip: invalidClip })
  }
  assert.throws(exportInvalidClip, RangeError)
}

const invalidOptions = [
  { ticksPerBeat: 0 }, { ticksPerBeat: 32768 }, { channel: 16 },
  { tempo: 0 }, { timeSignature: { numerator: 4, denominator: 3 } }
]
for (const options of invalidOptions) {
  const exportInvalidOptions = () => {
    return library.scaled.exportMidi({ clip: { durationBeats: 0, notes: [] }, ...options })
  }
  assert.throws(exportInvalidOptions, RangeError)
}

console.log('MIDI fractional boundaries, event ordering, quantization, empty clips and invalid inputs passed.')

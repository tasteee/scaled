import * as filesystem from 'node:fs'
import * as assert from 'node:assert/strict'
import * as url from 'node:url'
import * as path from 'node:path'

const requestedModule = process.argv[2]
const defaultModule = new URL('../dist/scaler.mjs', import.meta.url)
const moduleUrl = requestedModule ? url.pathToFileURL(path.resolve(requestedModule)) : defaultModule
const library = await import(moduleUrl.href)
const captured = JSON.parse(filesystem.readFileSync(new URL('catalog/voicingChords.json', import.meta.url), 'utf8'))
const presets = JSON.parse(filesystem.readFileSync(new URL('../src/data/voicings.json', import.meta.url), 'utf8'))
const keyNames = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
let comparedChords = 0
for (const preset of captured.presets) {
  const sourcePreset = presets.find((candidate) => {
    return candidate.name === preset.name
  })
  assert.ok(sourcePreset)
  for (const target of preset.targets) {
    const key = keyNames[target.tonicPitch]
    assert.ok(key)
    const chords = library.getScaleVoicingChords({ presetId: sourcePreset.id, key, scale: target.scaleName })
    assert.equal(chords.length, target.chords.length)
    for (const entry of chords) {
      const expected = target.chords[entry.sourceSlot - 1]
      assert.ok(expected)
      assert.ok(entry.chord)
      assert.deepEqual(entry.chord.midiNotes, expected.midiNotes)
      assert.equal(entry.chord.rootPitch, expected.rootPitch)
      assert.equal(entry.chord.chordType, expected.chordType)
      comparedChords += 1
    }
  }
}
const firstPreset = presets[0]
assert.ok(firstPreset)
const rootInput = { presetId: firstPreset.id, key: 'C', scale: 'Major scale' }
const reference = library.getScaleVoicingChords(rootInput)
const raised = library.getScaleVoicingChords({ ...rootInput, octave: 5 })
const lowered = library.getScaleVoicingChords({ ...rootInput, octave: 3 })
for (const entry of reference) {
  assert.ok(entry.chord)
  const raisedEntry = raised[entry.sourceSlot - 1]
  const loweredEntry = lowered[entry.sourceSlot - 1]
  assert.ok(raisedEntry?.chord)
  assert.ok(loweredEntry?.chord)
  const raisedNotes = entry.chord.midiNotes.map((note) => {
    return note + 12
  })
  const loweredNotes = entry.chord.midiNotes.map((note) => {
    return note - 12
  })
  assert.deepEqual(raisedEntry.chord.midiNotes, raisedNotes)
  assert.deepEqual(loweredEntry.chord.midiNotes, loweredNotes)
}
assert.throws(() => {
  return library.getScaleVoicingChords({ ...rootInput, presetId: 'missing' })
}, /Unknown Scaler voicing preset/)
assert.throws(() => {
  return library.getScaleVoicingChords({ ...rootInput, octave: 4.5 })
}, /Octave/)
assert.throws(() => {
  return library.getScaleVoicingChords({ ...rootInput, octave: -2 })
}, /MIDI note/)
console.log(JSON.stringify({ comparedChords, wasEveryNativeIdentityPreserved: true, wasOctaveTranspositionVerified: true }))

import * as filesystem from 'node:fs'
import * as assert from 'node:assert/strict'

const capturePath = new URL('catalog/voicingChords.json', import.meta.url)
const captured = JSON.parse(filesystem.readFileSync(capturePath, 'utf8'))
const chordTypes = []
const getChordTypeIndex = (chordType) => {
  const existingIndex = chordTypes.indexOf(chordType)
  const isExisting = existingIndex >= 0
  if (isExisting) return existingIndex
  const index = chordTypes.length
  chordTypes.push(chordType)
  return index
}
let comparedChords = 0
const presets = captured.presets.map((preset) => {
  const referenceTargets = preset.targets.filter((target) => {
    return target.tonicPitch === 0
  })
  const scales = referenceTargets.map((reference) => {
    const notes = reference.chords.map((chord) => {
      assert.ok(chord)
      return chord.midiNotes
    })
    const tonicPitches = Array.from({ length: 12 }, (_, position) => {
      return position
    })
    const identities = tonicPitches.map((tonicPitch) => {
      const target = preset.targets.find((candidate) => {
        const isMatchingPitch = candidate.tonicPitch === tonicPitch
        const isMatchingScale = candidate.scaleName === reference.scaleName
        return isMatchingPitch && isMatchingScale
      })
      assert.ok(target)
      assert.equal(target.chords.length, notes.length)
      const chordIdentities = target.chords.map((chord, position) => {
        assert.ok(chord)
        assert.equal(chord.sourceSlot, position + 1)
        assert.equal(target.hasSourceScale, true)
        const sourceNotes = notes[position]
        assert.ok(sourceNotes)
        const transposedNotes = sourceNotes.map((note) => {
          return note + tonicPitch
        })
        assert.deepEqual(chord.midiNotes, transposedNotes)
        assert.notEqual(chord.rootPitch, null)
        assert.notEqual(chord.chordType, null)
        const chordTypeIndex = getChordTypeIndex(chord.chordType)
        comparedChords += 1
        return [chord.rootPitch, chordTypeIndex]
      })
      return chordIdentities
    })
    return { name: reference.scaleName, notes, identities }
  })
  return { nativeIdentifier: preset.nativeIdentifier, name: preset.name, scales }
})
const compact = { octave: captured.octave, chordTypes, presets }
const outputText = JSON.stringify(compact)
filesystem.writeFileSync(new URL('../src/data/voicingChords.json', import.meta.url), outputText)
console.log(JSON.stringify({ comparedChords, compactBytes: Buffer.byteLength(outputText), presetCount: presets.length }))

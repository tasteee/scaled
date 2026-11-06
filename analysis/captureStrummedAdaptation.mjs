import * as filesystem from 'node:fs'
import * as assert from 'node:assert/strict'
import * as crypto from 'node:crypto'
import * as nativeHost from './nativeExpressionHost.mjs'
import * as catalog from '../dist/scaler.mjs'

const host = nativeHost.createNativeExpressionHost()
const templates = catalog.performanceTemplates.filter((template) => { return template.category === 'StrummedSequences' })
const voiceCounts = Array.from({ length: 12 }, (unused, position) => { return position + 1 })
const captures = []
let comparisonCount = 0
const getSortedNotes = (notes) => {
  const sortedNotes = [...notes].sort((first, second) => {
    const pitchDifference = first.midiNote - second.midiNote
    if (pitchDifference !== 0) return pitchDifference
    return first.startBeat - second.startBeat
  })
  return sortedNotes
}
for (const template of templates) {
  const shapes = []
  for (const voiceCount of voiceCounts) {
    const positions = Array.from({ length: voiceCount }, (unused, position) => { return position })
    const referenceNotes = positions.map((position) => { return 48 + position })
    const referenceOutput = host.renderExpression({ template, midiNotes: referenceNotes })
    const events = referenceOutput.map((note) => {
      const voice = referenceNotes.indexOf(note.midiNote)
      assert.ok(voice >= 0, `Unexpected source voice for ${template.name}: ${note.midiNote}`)
      const velocity = Math.round(note.velocity * 127)
      return [voice, note.startBeat, note.durationBeats, velocity]
    })
    const testShapes = [positions.map((position) => { return 60 + position * 2 }), positions.map((position) => { return 36 + position * 3 })]
    for (const midiNotes of testShapes) {
      const nativeNotes = getSortedNotes(host.renderExpression({ template, midiNotes }))
      const expectedNotes = events.map((event) => {
        return { midiNote: midiNotes[event[0]], startBeat: event[1], durationBeats: event[2], velocity: event[3] }
      })
      const sortedExpected = getSortedNotes(expectedNotes)
      assert.equal(nativeNotes.length, sortedExpected.length)
      for (const pair of nativeNotes.entries()) {
        const nativeNote = pair[1]
        const expectedNote = sortedExpected[pair[0]]
        assert.equal(nativeNote.midiNote, expectedNote.midiNote, template.name)
        assert.ok(Math.abs(nativeNote.startBeat - expectedNote.startBeat) < 0.00001, template.name)
        assert.ok(Math.abs(nativeNote.durationBeats - expectedNote.durationBeats) < 0.00001, template.name)
        assert.equal(Math.round(nativeNote.velocity * 127), expectedNote.velocity, template.name)
      }
      comparisonCount += 1
    }
    shapes.push(events)
  }
  captures.push({ id: template.id, durationBeats: template.durationBeats, shapes })
}
const serialized = JSON.stringify({ referenceVelocity: 0.7, strumStyle: 1, strumSpeed: 1, strumExpression: 0, strumVoicing: 0, captures })
filesystem.writeFileSync(new URL('../src/data/strummedPatterns.json', import.meta.url), serialized)
const sha256 = crypto.createHash('sha256').update(serialized).digest('hex')
const manifest = { binarySha256: host.binarySha256, comparisonCount, templateCount: templates.length, supportedVoiceCounts: voiceCounts, sha256, note: 'Native fixed strum settings captured symbolically and verified against two independent input voicings for every voice count. No Scaler runtime dependency.' }
filesystem.writeFileSync(new URL('./catalog/strummedAdaptationManifest.json', import.meta.url), JSON.stringify(manifest, null, 2))
console.log(JSON.stringify(manifest))
host.close()
process.exit(0)

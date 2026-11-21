import * as assert from 'node:assert/strict'
import * as filesystem from 'node:fs'
import { scaled } from '../dist/index.mjs'

const captureNames = ['Passages-probe.json', 'Passages-voicing-probe.json', 'Passages-voicing-holdout.json', 'Passages-voicing-stress.json']
const captures = captureNames.map((captureName) => {
  const capturePath = new URL(`../tests/fixtures/${captureName}`, import.meta.url)
  const captureText = filesystem.readFileSync(capturePath, 'utf8')
  return JSON.parse(captureText)
})
const binarySha256 = captures[0].binarySha256
for (const capture of captures) assert.equal(capture.binarySha256, binarySha256)

const getEventKeys = (notes) => {
  const keys = notes.map((note) => {
    const start = Math.round(note.startBeat * 1000000)
    const duration = Math.round(note.durationBeats * 1000000)
    const velocity = Math.round(note.velocity * 127)
    return `${note.midiNote}:${start}:${duration}:${velocity}`
  })
  keys.sort()
  return keys
}

const checkFixture = (fixture) => {
  const voicingKey = fixture.midiNotes.join(',')
  const template = scaled.performanceTemplates.find((candidate) => {
    return candidate.id === fixture.templateId
  })
  assert.ok(template)
  const pattern = scaled.adaptPerformanceTemplate({ template, midiNotes: fixture.midiNotes, key: 'C', scale: 'major', octave: 4 })
  // The saved host requested four beats for eight-beat
  // templates. Compare at that captured duration.
  const notes = pattern.events.map((event) => {
    assert.equal(event.pitch.type, 'midi')
    const startBeat = event.startBeat / 2
    const durationBeats = event.durationBeats / 2
    const velocity = event.velocity / 127
    return { midiNote: event.pitch.midiNote, startBeat, durationBeats, velocity }
  })
  const actualKeys = getEventKeys(notes)
  const expectedKeys = getEventKeys(fixture.notes)
  assert.deepEqual(actualKeys, expectedKeys, `${fixture.templateName} / ${voicingKey}`)
}

let checkedCount = 0
for (const capture of captures) {
  for (const fixture of capture.fixtures) {
    const hasFewVoices = fixture.midiNotes.length < 3
    if (hasFewVoices) continue
    checkFixture(fixture)
    checkedCount += 1
  }
}
assert.equal(checkedCount, 378)
console.log(`Passages: ${checkedCount} saved native pitch/timing/velocity comparisons passed.`)

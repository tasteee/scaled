import * as assert from 'node:assert/strict'
import * as filesystem from 'node:fs'
import { scaled } from '../dist/index.mjs'

const capturePath = new URL('../analysis/catalog/Passages-probe.json', import.meta.url)
const captureText = filesystem.readFileSync(capturePath, 'utf8')
const capture = JSON.parse(captureText)
const commonVoicings = ['60,64,67', '60,63,67', '60,64,67,71', '62,65,69']

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

let checkedCount = 0
for (const fixture of capture.fixtures) {
  const voicingKey = fixture.midiNotes.join(',')
  const isCommonVoicing = commonVoicings.includes(voicingKey)
  if (!isCommonVoicing) continue
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
  checkedCount += 1
}
assert.equal(checkedCount, 28)
console.log(`Passages: ${checkedCount} saved native pitch/timing/velocity comparisons passed.`)

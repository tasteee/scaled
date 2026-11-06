import * as assert from 'node:assert/strict'
import * as library from '../dist/index.mjs'
import * as catalog from '../dist/scaler.mjs'

const rhythms = catalog.performanceTemplates.filter(catalog.canAdaptRhythmTemplate)
assert.equal(rhythms.length, 102)
const referenceTemplate = rhythms[0]
assert.ok(referenceTemplate)
const firstEvent = referenceTemplate.events[0]
assert.ok(firstEvent)

const checkChordSize = (targetNoteCount) => {
  const pattern = catalog.adaptRhythmTemplate({ template: referenceTemplate, targetNoteCount })
  const simultaneousEvents = pattern.events.filter((event) => {
    return event.startBeat === firstEvent.startBeat
  })
  assert.equal(simultaneousEvents.length, targetNoteCount)
  const selectors = simultaneousEvents.map((event) => {
    return event.pitch.index
  })
  const expectedVoices = Array.from({ length: targetNoteCount }, (unused, position) => {
    return position
  })
  assert.deepEqual(selectors, expectedVoices)
  return undefined
}

checkChordSize(2)
checkChordSize(4)
checkChordSize(6)

const firstBassTemplate = catalog.performanceTemplates[0]
assert.ok(firstBassTemplate)
const adaptBass = () => {
  return catalog.adaptRhythmTemplate({ template: firstBassTemplate, targetNoteCount: 3 })
}
assert.throws(adaptBass, /Only recovered Rhythms/)

let checkedRenders = 0
for (const template of rhythms) {
  for (const chordSymbol of ['C', 'Cm7', 'Cmaj9', 'C13']) {
    const chord = library.scaled.getChord({ chord: chordSymbol })
    const pattern = catalog.adaptRhythmTemplate({ template, targetNoteCount: chord.midiNotes.length })
    const clip = library.scaled.applyPerformance({
      progression: [{ chord, durationBeats: template.durationBeats }],
      performance: pattern
    })
    assert.ok(clip.notes.length > 0)
    for (const note of clip.notes) {
      assert.ok(chord.midiNotes.includes(note.midiNote))
      assert.ok(note.durationBeats > 0)
      assert.ok(note.startBeat < template.durationBeats)
    }
    checkedRenders += 1
  }
}

console.log(`Checked ${rhythms.length} rhythm templates in ${checkedRenders} chord renders.`)

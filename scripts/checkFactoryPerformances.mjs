import * as assert from 'node:assert/strict'
import * as library from '../dist/index.mjs'
import * as catalog from '../dist/scaler.mjs'

const scaleDefinitions = library.scaled.getScaleDefinitions()
const templates = catalog.performanceTemplates.filter(catalog.canAdaptPerformanceTemplate)
let checkedCount = 0
for (const template of templates) {
  for (const scale of scaleDefinitions) {
    const chord = library.scaled.getChord({ chord: 'Cmaj7' })
    const pattern = catalog.adaptPerformanceTemplate({ template, midiNotes: chord.midiNotes, key: 'C', scale: scale.name, octave: 4 })
    const clip = library.scaled.applyPerformance({ progression: [{ chord, durationBeats: pattern.durationBeats }], performance: pattern })
    const hasMatchingDuration = clip.durationBeats === pattern.durationBeats
    assert.ok(hasMatchingDuration)
    for (const note of clip.notes) {
      assert.ok(note.midiNote >= 0 && note.midiNote <= 127)
      assert.ok(note.durationBeats > 0)
      assert.ok(note.startBeat >= 0 && note.startBeat < clip.durationBeats)
      assert.ok(note.velocity > 0 && note.velocity <= 127)
    }
    checkedCount += 1
  }
}
console.log(`Rendered ${templates.length} factory performances across ${scaleDefinitions.length} scales (${checkedCount} checks).`)

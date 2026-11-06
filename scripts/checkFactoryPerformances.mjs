import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { scaled } from '../dist/index.mjs'

const catalogPath = new URL('../src/data/performances.json', import.meta.url)
const catalogText = readFileSync(catalogPath, 'utf8')
const catalogTemplates = JSON.parse(catalogText)
const expectedTemplates = catalogTemplates.filter((template) => {
  const isDeferredSequence = template.subcategory === 'Scale Based Sequences'
  return !isDeferredSequence
})
const getTemplateIdentifier = (template) => {
  return template.id
}
const expectedIdentifiers = expectedTemplates.map(getTemplateIdentifier)
const publicIdentifiers = scaled.performanceTemplates.map(getTemplateIdentifier)
const summaryIdentifiers = scaled.performanceSummaries.map(getTemplateIdentifier)
assert.deepEqual(publicIdentifiers, expectedIdentifiers, 'Only Scale Based Sequences should be hidden')
assert.deepEqual(summaryIdentifiers, publicIdentifiers, 'Template summaries must match available performances')

const expectedCategories = ['Bass', 'Grooves', 'Melody', 'Passages', 'Phrases', 'Rhythms', 'Sequences', 'StrummedSequences']
for (const category of expectedCategories) {
  const hasCategory = scaled.performanceTemplates.some((template) => {
    const hasMatchingCategory = template.category === category
    return hasMatchingCategory
  })
  assert.ok(hasCategory, `${category} must remain available`)
}

const scaleDefinitions = scaled.getScaleDefinitions()
const templates = scaled.performanceTemplates.filter(scaled.canAdaptPerformanceTemplate)
let checkedCount = 0
for (const template of templates) {
  for (const scale of scaleDefinitions) {
    const chord = scaled.getChord({ chord: 'Cmaj7' })
    const pattern = scaled.adaptPerformanceTemplate({ template, midiNotes: chord.midiNotes, key: 'C', scale: scale.name, octave: 4 })
    const clip = scaled.applyPerformance({ progression: [{ chord, durationBeats: pattern.durationBeats }], performance: pattern })
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

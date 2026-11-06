import * as filesystem from 'node:fs'

const sourceDirectory = new URL('../analysis/catalog/', import.meta.url)
const outputDirectory = new URL('../src/data/', import.meta.url)
filesystem.mkdirSync(outputDirectory, { recursive: true })

const readSource = (filename) => {
  const source = filesystem.readFileSync(new URL(filename, sourceDirectory), 'utf8')
  return source
}

const writeCatalog = (filename, catalog) => {
  const serialized = JSON.stringify(catalog)
  filesystem.writeFileSync(new URL(filename, outputDirectory), serialized)
  return undefined
}

const chordSource = readSource('chordTypes.json')
const chordDefinitions = JSON.parse(chordSource)
const chordKeyMatches = chordSource.matchAll(/^    "([^"]+)": \{/gm)
const chordNames = Array.from(chordKeyMatches, (match) => {
  return match[1]
})
const normalizedChords = chordNames.map((name) => {
  const definition = chordDefinitions[name]
  return { id: definition.uuid, name: definition.name, formula: definition.formula, optional: definition.optional }
})
writeCatalog('chords.json', normalizedChords)

const scaleSource = readSource('scales.json')
const scaleDefinitions = JSON.parse(scaleSource)
const normalizedScales = Object.values(scaleDefinitions).map((definition) => {
  return { id: definition.uuid, name: definition.name, formula: definition.formula, alternateNames: definition['alt names'] }
})
writeCatalog('scales.json', normalizedScales)

const performances = JSON.parse(readSource('performances.json'))
const voicings = JSON.parse(readSource('voicings.json'))
writeCatalog('performances.json', performances.patterns)
const performanceSummaries = performances.patterns.map((performance) => {
  return { id: performance.id, name: performance.name, category: performance.category, subcategory: performance.subcategory, durationBeats: performance.durationBeats, timeSignature: performance.timeSignature }
})
writeCatalog('performanceSummaries.json', performanceSummaries)
writeCatalog('voicings.json', voicings.presets)
console.log(`Imported ${normalizedChords.length} chords, ${normalizedScales.length} scales, ${performances.patternCount} performance templates, and ${voicings.presetCount} voicing presets`)

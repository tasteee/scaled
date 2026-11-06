import * as filesystem from 'node:fs'
import * as crypto from 'node:crypto'

const catalogDirectory = new URL('./catalog/', import.meta.url)
const resourceDirectory = new URL('performanceResources/', catalogDirectory)
const sourceIndexText = filesystem.readFileSync(new URL('expressions.json', resourceDirectory), 'utf8')
const sourceIndex = JSON.parse(sourceIndexText)

const readPerformance = (input) => {
  const relativeName = input.relativeName.replace(/^\/+/, '')
  const resourcePath = `${input.category}/${relativeName}`
  const resource = filesystem.readFileSync(new URL(resourcePath, resourceDirectory), 'utf8')
  const source = JSON.parse(resource)
  const metadata = source.expressionsData.metaData
  const ticksPerBeat = metadata.ticksPerBeat
  const durationBeats = metadata.lastPosition / ticksPerBeat

  const convertEvent = (event) => {
    const startBeat = event.position / ticksPerBeat
    const durationBeats = event.duration / ticksPerBeat
    const startOffsetBeats = event.position_offset / ticksPerBeat
    const durationOffsetBeats = event.duration_offset / ticksPerBeat
    return {
      id: event.noteId,
      sourcePitchIndex: event.noteIndex,
      sourceMidiNote: event.noteNumber,
      startBeat,
      durationBeats,
      velocity: event.velocity,
      startOffsetBeats,
      durationOffsetBeats
    }
  }

  const events = source.expressionsData.events.map(convertEvent)
  const sourceSha256 = crypto.createHash('sha256').update(resource).digest('hex')
  return {
    id: source.uuid,
    name: source.name,
    type: source.type,
    category: input.category,
    subcategory: source.subfolder,
    source: source.source,
    durationBeats,
    timeSignature: metadata.timeSignature,
    referenceMidiNotes: metadata.allNotesNumber,
    octaveDifference: source.octaveDiff,
    events,
    provenance: { resourcePath, sourceSha256, ticksPerBeat, lastPositionTicks: metadata.lastPosition }
  }
}

const performances = []
const categories = []
for (const category of Object.keys(sourceIndex)) {
  const paths = sourceIndex[category]
  for (const relativeName of paths) {
    const performance = readPerformance({ category, relativeName })
    performances.push(performance)
  }
  const categorySummary = { name: category, patternCount: paths.length }
  categories.push(categorySummary)
}

const indexPerformance = (performance) => {
  const eventCount = performance.events.length
  return {
    id: performance.id,
    name: performance.name,
    category: performance.category,
    subcategory: performance.subcategory,
    durationBeats: performance.durationBeats,
    timeSignature: performance.timeSignature,
    eventCount,
    resourcePath: performance.provenance.resourcePath
  }
}

const performanceEntries = performances.map(indexPerformance)
const performanceIndex = { patternCount: performances.length, categories, patterns: performanceEntries }
const performanceLibrary = { schemaVersion: 1, timingUnit: 'quarterNoteBeats', patternCount: performances.length, patterns: performances }
const performanceIndexText = JSON.stringify(performanceIndex, null, 2)
const performanceLibraryText = JSON.stringify(performanceLibrary, null, 2)
filesystem.writeFileSync(new URL('performanceIndex.json', catalogDirectory), performanceIndexText)
filesystem.writeFileSync(new URL('performances.json', catalogDirectory), performanceLibraryText)

const chordSetsText = filesystem.readFileSync(new URL('chordSets.json', catalogDirectory), 'utf8')
const chordSets = JSON.parse(chordSetsText)
const describeVoicing = (source) => {
  const describeShape = (voicing, slotIndex) => {
    const sourceSlot = slotIndex + 1
    return { sourceSlot, sourceIntervals: voicing.intervals }
  }
  const shapes = source.voicings.map(describeShape)
  return { id: source.uuid, name: source.name, shapes }
}
const voicings = chordSets.Voicings.map(describeVoicing)
const voicingLibrary = { schemaVersion: 1, presetCount: voicings.length, presets: voicings }
const voicingLibraryText = JSON.stringify(voicingLibrary, null, 2)
filesystem.writeFileSync(new URL('voicings.json', catalogDirectory), voicingLibraryText)

const generatedFiles = ['performanceIndex.json', 'performances.json', 'voicings.json']
const describeGeneratedFile = (filename) => {
  const bytes = filesystem.readFileSync(new URL(filename, catalogDirectory))
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex')
  return { filename, byteLength: bytes.length, sha256 }
}
const files = generatedFiles.map(describeGeneratedFile)
const manifest = { method: 'Lossless event-field preservation with timing converted to quarter-note beats; pitch remapping is deliberately not inferred', files }
const manifestText = JSON.stringify(manifest, null, 2)
filesystem.writeFileSync(new URL('performanceLibraryManifest.json', catalogDirectory), manifestText)

const summary = { patternCount: performances.length, voicingPresetCount: voicings.length, categories }
const summaryText = JSON.stringify(summary, null, 2)
console.log(summaryText)

import * as filesystem from 'node:fs'
import * as assert from 'node:assert/strict'
import * as hostLibrary from './nativeExpressionHost.mjs'
import * as catalog from '../dist/scaler.mjs'

const host = hostLibrary.createNativeExpressionHost()
const scales = []
const sentinel = host.readPointer(host.pluginBase + 0x2dcf180n)
const visit = (address) => {
  const isSentinel = host.koffi.decode(address + 25n, 'uint8_t') !== 0
  if (isSentinel) return undefined
  visit(host.readPointer(address))
  const scale = host.readPointer(address + 64n)
  const hasScale = scale !== 0n
  if (hasScale) {
    const tonic = host.readPointer(scale + 168n)
    const tonicPitch = host.koffi.decode(tonic + 48n, 'int')
    const definition = host.readPointer(scale + 184n)
    const scaleName = host.koffi.decode(definition + 8n, 'str')
    const scaleKey = Buffer.from(host.koffi.decode(address + 32n, 'uint8_t', 32))
    const scaleControl = host.readPointer(address + 72n)
    scales.push({ tonicPitch, scaleName, scaleKey, scale, scaleControl })
  }
  visit(host.readPointer(address + 16n))
  return undefined
}
visit(host.readPointer(sentinel + 8n))

let selectedScale = scales[0]
const scaleModel = host.manager + 0x30n
const originalVtable = host.readPointer(scaleModel)
const copiedVtable = Buffer.from(host.koffi.decode(originalVtable, 'uint8_t', 256))
const selectedScaleType = host.koffi.proto('void *GetOracleSelectedScale(void *owner, void *output)')
const handleSelectedScale = (owner, output) => {
  const controlCount = host.koffi.decode(selectedScale.scaleControl + 8n, 'int')
  host.koffi.encode(selectedScale.scaleControl + 8n, 'int', controlCount + 1)
  host.koffi.encode(output, 'uint64_t', selectedScale.scale)
  const outputAddress = host.koffi.address(output)
  host.koffi.encode(outputAddress + 8n, 'uint64_t', selectedScale.scaleControl)
  return output
}
const selectedScaleCallback = host.koffi.register(handleSelectedScale, host.koffi.pointer(selectedScaleType))
copiedVtable.writeBigUInt64LE(host.koffi.address(selectedScaleCallback), 0x78)
host.koffi.encode(scaleModel, 'uint64_t', host.koffi.address(copiedVtable))

const getEventKey = (event) => {
  const start = Math.round(event.startBeat * 10000)
  const duration = Math.round(event.durationBeats * 10000)
  return `${event.midiNote}:${start}:${duration}`
}
const normalizeEvents = (events) => {
  const sortedEvents = events.toSorted((firstEvent, secondEvent) => {
    return firstEvent.startBeat - secondEvent.startBeat
  })
  const notes = []
  for (const event of sortedEvents) {
    const previous = notes.findLast((candidate) => {
      return candidate.midiNote === event.midiNote
    })
    const isDuplicate = previous !== undefined && previous.startBeat === event.startBeat
    if (isDuplicate) continue
    if (previous) {
      const requestedEnd = previous.startBeat + previous.durationBeats
      previous.durationBeats = Math.min(requestedEnd, event.startBeat) - previous.startBeat
    }
    notes.push({ ...event })
  }
  const finalNotes = notes.filter((note) => {
    return note.durationBeats > 0
  })
  return finalNotes
}
const sourceCategories = ['Bass', 'Melody', 'Phrases', 'Sequences']
const templates = catalog.performanceTemplates.filter((template) => {
  return sourceCategories.includes(template.category)
})
const inputs = [
  { key: 'C', tonicPitch: 0, scale: 'Major scale', midiNotes: [60, 64, 67] },
  { key: 'C', tonicPitch: 0, scale: 'Minor scale', midiNotes: [60, 63, 67] },
  { key: 'D', tonicPitch: 2, scale: 'Minor scale', midiNotes: [62, 65, 69] },
  { key: 'C', tonicPitch: 0, scale: 'Major scale', midiNotes: [60, 67] }
]
const mismatches = []
let checkedCount = 0
for (const template of templates) {
  for (const input of inputs) {
    const isUnsafeNativeVariant = template.category === 'Phrases' && template.subcategory === 'Avant Garde' && template.name.endsWith('_minor') && input.scale === 'Minor scale'
    if (isUnsafeNativeVariant) continue
    const scale = scales.find((candidate) => {
      return candidate.tonicPitch === input.tonicPitch && candidate.scaleName === input.scale
    })
    assert.ok(scale)
    selectedScale = scale
    const nativeNotes = host.renderExpression({ template, midiNotes: input.midiNotes, scaleKey: scale.scaleKey, scaleMode: 2 })
    const adapted = catalog.getScalePerformance({ template, midiNotes: input.midiNotes, key: input.key, scale: input.scale, octave: 3 })
    const events = []
    for (const sourceEvent of adapted.template.events) {
      const midiNote = adapted.midiNotes[sourceEvent.sourcePitchIndex]
      const isMissing = midiNote === undefined
      if (isMissing) continue
      const hasNoDuration = sourceEvent.durationBeats <= 0
      if (hasNoDuration) continue
      events.push({ midiNote, startBeat: sourceEvent.startBeat, durationBeats: sourceEvent.durationBeats })
    }
    const oracleEvents = events
    const sortNotes = (firstNote, secondNote) => {
      const pitchDifference = firstNote.midiNote - secondNote.midiNote
      const hasPitchDifference = pitchDifference !== 0
      if (hasPitchDifference) return pitchDifference
      return firstNote.startBeat - secondNote.startBeat
    }
    const sortedNativeNotes = nativeNotes.toSorted(sortNotes)
    const sortedAdaptedNotes = normalizeEvents(oracleEvents).toSorted(sortNotes)
    const hasMatchingCount = sortedNativeNotes.length === sortedAdaptedNotes.length
    const hasMatchingNotes = sortedAdaptedNotes.every((note, position) => {
      const nativeNote = sortedNativeNotes[position]
      const isMissing = nativeNote === undefined
      if (isMissing) return false
      const hasPitch = note.midiNote === nativeNote.midiNote
      const hasStart = Math.abs(note.startBeat - nativeNote.startBeat) < 0.00001
      const hasDuration = Math.abs(note.durationBeats - nativeNote.durationBeats) < 0.00001
      return hasPitch && hasStart && hasDuration
    })
    const nativeKeys = sortedNativeNotes.map(getEventKey)
    const adaptedKeys = sortedAdaptedNotes.map(getEventKey)
    const isMatching = hasMatchingCount && hasMatchingNotes
    if (!isMatching) mismatches.push({ id: template.id, category: template.category, name: template.name, input, mappedNotes: adapted.midiNotes, nativeKeys, adaptedKeys })
    checkedCount += 1
  }
}
host.koffi.encode(scaleModel, 'uint64_t', originalVtable)
host.close()
const result = { binarySha256: host.binarySha256, observedAt: new Date().toISOString(), checkedCount, mismatchCount: mismatches.length, mismatches }
filesystem.writeFileSync(new URL('./catalog/scalePerformanceAdaptationManifest.json', import.meta.url), JSON.stringify(result, null, 2))
console.log(JSON.stringify({ checkedCount, mismatchCount: mismatches.length, firstMismatches: mismatches.slice(0, 3) }))
assert.equal(mismatches.length, 0)
process.exit(0)

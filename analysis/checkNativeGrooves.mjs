import * as assert from 'node:assert/strict'
import * as filesystem from 'node:fs'
import * as catalog from '../dist/scaler.mjs'
import * as hostModule from './nativeExpressionHost.mjs'

const host = hostModule.createNativeExpressionHost()
const templates = catalog.performanceTemplates.filter((template) => {
  return template.category === 'Grooves'
})
const chordInputs = [
  [60],
  [60,67],
  [60,64,67],
  [60,63,67],
  [60,64,67,71],
  [60,62,64,67,71],
  [64,67,72],
  [55,60,64,67,72,76],
  [48,52,55],
  [96,100,103]
]
const getEventKey = (midiNote, startBeat, durationBeats) => {
  const roundedStart = Math.round(startBeat * 100000)
  const roundedDuration = Math.round(durationBeats * 100000)
  return `${midiNote}:${roundedStart}:${roundedDuration}`
}
const mismatches = []
const normalizeEvents = (events) => {
  const sortedEvents = events.toSorted((firstEvent, secondEvent) => {
    return firstEvent.startBeat - secondEvent.startBeat
  })
  const normalizedEvents = []
  for (const event of sortedEvents) {
    const previousEvent = normalizedEvents.at(-1)
    const hasPrevious = previousEvent !== undefined
    const isDuplicate = hasPrevious && previousEvent.midiNote === event.midiNote && previousEvent.startBeat === event.startBeat
    if (isDuplicate) continue
    const matchingPrevious = normalizedEvents.findLast((candidate) => {
      return candidate.midiNote === event.midiNote
    })
    if (matchingPrevious) {
      const requestedEnd = matchingPrevious.startBeat + matchingPrevious.durationBeats
      const clippedEnd = Math.min(requestedEnd, event.startBeat)
      matchingPrevious.durationBeats = clippedEnd - matchingPrevious.startBeat
    }
    normalizedEvents.push({...event})
  }
  const keys = normalizedEvents.map((event) => {
    return getEventKey(event.midiNote,event.startBeat,event.durationBeats)
  })
  return keys
}
let checkedCount = 0
for (const template of templates) {
  for (const midiNotes of chordInputs) {
    const nativeNotes = host.renderExpression({template,midiNotes})
    const mappedNotes = catalog.getGrooveMidiNotes({template,midiNotes})
    const adaptedEvents = []
    for (const sourceEvent of template.events) {
      const hasDuration = sourceEvent.durationBeats > 0
      if (!hasDuration) continue
      const mappedNote = mappedNotes[sourceEvent.sourcePitchIndex]
      const hasMappedNote = mappedNote !== undefined
      if (!hasMappedNote) continue
      adaptedEvents.push({midiNote:mappedNote,startBeat:sourceEvent.startBeat,durationBeats:sourceEvent.durationBeats})
    }
    const nativeEvents = nativeNotes.map((note) => {
      return getEventKey(note.midiNote,note.startBeat,note.durationBeats)
    })
    const normalizedEvents = normalizeEvents(adaptedEvents)
    normalizedEvents.sort()
    nativeEvents.sort()
    const isMatching = JSON.stringify(normalizedEvents) === JSON.stringify(nativeEvents)
    if (!isMatching) mismatches.push({templateId:template.id,name:template.name,midiNotes,mappedNotes,adaptedEvents:normalizedEvents,nativeEvents})
    checkedCount += 1
  }
}
const manifest = {binarySha256:host.binarySha256,observedAt:new Date().toISOString(),templateCount:templates.length,checkedCount,mismatchCount:mismatches.length,mismatches}
filesystem.writeFileSync(new URL('./catalog/grooveAdaptationManifest.json',import.meta.url),JSON.stringify(manifest,null,2))
console.log(JSON.stringify({checkedCount,mismatchCount:mismatches.length,firstMismatch:mismatches[0]}))
host.close()
assert.equal(mismatches.length,0)
process.exit(0)

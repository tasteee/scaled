import type * as recovered from './recoveredTypes.js'
import type * as types from './types.js'
import * as validation from './validation.js'

export type AdaptPassageTemplateInputT = {
  readonly template: recovered.RecoveredPerformanceTemplateT
  readonly midiNotes: readonly number[]
}

const referenceVoices = [60, 64, 67, 71, 74]
const referencePitches = [0, 2, 4, 7, 11]
const passageVelocity = Math.round(0.7 * 127)

const getSortedNotes = (midiNotes: readonly number[]): number[] => {
  const uniqueNotes = Array.from(new Set(midiNotes))
  const sortedNotes = uniqueNotes.sort((firstNote, secondNote) => {
    return firstNote - secondNote
  })
  return sortedNotes
}

const getRelativePitches = (midiNotes: readonly number[]): number[] => {
  const rootNote = validation.getRequiredEntry(midiNotes, 0)
  const rootPitch = rootNote % 12
  const relativePitches = new Set<number>()
  for (const midiNote of midiNotes) {
    const relativePitch = (midiNote - rootPitch + 12) % 12
    relativePitches.add(relativePitch)
  }
  const targetPitches = Array.from(relativePitches).sort((firstPitch, secondPitch) => {
    return firstPitch - secondPitch
  })
  return targetPitches
}

const getUpperVoice = (sourceNote: number, midiNotes: readonly number[]): number => {
  const rootNote = validation.getRequiredEntry(midiNotes, 0)
  const targetPitches = getRelativePitches(midiNotes)
  const sourcePitch = sourceNote % 12
  const referencePosition = referencePitches.indexOf(sourcePitch)
  const hasUnknownPitch = referencePosition < 0
  if (hasUnknownPitch) throw new Error('Unknown passage reference pitch')
  const isLeadingVoice = sourcePitch === 11
  const wrappedPosition = referencePosition % targetPitches.length
  const targetPosition = isLeadingVoice ? targetPitches.length - 1 : wrappedPosition
  const targetPitch = validation.getRequiredEntry(targetPitches, targetPosition)
  const minimumOctave = sourcePitch === 0 ? 1 : 0
  const sourceOctave = Math.floor((sourceNote - 72) / 12)
  const octaveOffset = Math.max(minimumOctave, sourceOctave)
  const mappedNote = rootNote + targetPitch + octaveOffset * 12
  const boundedNote = Math.min(127, mappedNote)
  return boundedNote
}

const buildEvent = (sourceEvent: recovered.RecoveredPerformanceEventT, midiNote: number, identifier: string): types.PatternEventT => {
  const eventPitch: types.FixedPitchSelectorT = { type: 'midi', midiNote }
  return { id: identifier, startBeat: sourceEvent.startBeat, durationBeats: sourceEvent.durationBeats, velocity: passageVelocity, pitch: eventPitch }
}

const buildSustainedEvents = (input: AdaptPassageTemplateInputT, midiNotes: readonly number[]): types.PatternEventT[] => {
  const events = midiNotes.map((midiNote, position): types.PatternEventT => {
    const identifier = `sustain-${position}`
    const eventPitch: types.FixedPitchSelectorT = { type: 'midi', midiNote }
    return { id: identifier, startBeat: 0, durationBeats: input.template.durationBeats, velocity: passageVelocity, pitch: eventPitch }
  })
  return events
}

const buildAdditionalVoices = (template: recovered.RecoveredPerformanceTemplateT, midiNotes: readonly number[]): types.PatternEventT[] => {
  const events: types.PatternEventT[] = []
  const additionalNotes = midiNotes.slice(referenceVoices.length)
  const onsetGroups = new Map<number, recovered.RecoveredPerformanceEventT[]>()
  for (const sourceEvent of template.events) {
    const group = onsetGroups.get(sourceEvent.startBeat) ?? []
    group.push(sourceEvent)
    onsetGroups.set(sourceEvent.startBeat, group)
  }
  for (const group of onsetGroups.values()) {
    const hasCompleteChord = referenceVoices.every((referenceNote) => {
      const hasReference = group.some((sourceEvent) => {
        return sourceEvent.sourceMidiNote === referenceNote
      })
      return hasReference
    })
    if (!hasCompleteChord) continue
    const longestEvents = [...group].sort((firstEvent, secondEvent) => {
      return secondEvent.durationBeats - firstEvent.durationBeats
    })
    const sourceEvent = validation.getRequiredEntry(longestEvents, 0)
    for (const midiNote of additionalNotes) {
      const identifier = `${sourceEvent.id}:voice-${midiNote}`
      const event = buildEvent(sourceEvent, midiNote, identifier)
      events.push(event)
    }
  }
  return events
}

const buildPassageEvents = (input: AdaptPassageTemplateInputT, midiNotes: readonly number[]): types.PatternEventT[] => {
  const events: types.PatternEventT[] = []
  for (const sourceEvent of input.template.events) {
    const referencePosition = referenceVoices.indexOf(sourceEvent.sourceMidiNote)
    const isUpperVoice = referencePosition < 0
    const wrappedPosition = referencePosition % midiNotes.length
    const midiNote = isUpperVoice ? getUpperVoice(sourceEvent.sourceMidiNote, midiNotes) : validation.getRequiredEntry(midiNotes, wrappedPosition)
    const identifier = String(sourceEvent.id)
    const event = buildEvent(sourceEvent, midiNote, identifier)
    events.push(event)
  }
  const additionalEvents = buildAdditionalVoices(input.template, midiNotes)
  events.push(...additionalEvents)
  return events
}

// Base voices follow native passage ordinals. Upper
// ornaments use chord pitch classes in root register;
// native chord detection for unusual voicings can differ.
export const adaptPassageTemplate = (input: AdaptPassageTemplateInputT): types.PerformancePatternT => {
  const isPassage = input.template.category === 'Passages'
  if (!isPassage) throw new Error('Passage adaptation requires a Passages template')
  for (const midiNote of input.midiNotes) validation.validateMidiNote(midiNote)
  const midiNotes = getSortedNotes(input.midiNotes)
  const hasNoNotes = midiNotes.length === 0
  if (hasNoNotes) throw new Error('Passage performance requires a voiced chord')
  const hasFewNotes = midiNotes.length < 3
  const events = hasFewNotes ? buildSustainedEvents(input, midiNotes) : buildPassageEvents(input, midiNotes)
  return { id: input.template.id, name: input.template.name, durationBeats: input.template.durationBeats, events }
}

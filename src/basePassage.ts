import chordRecognition from './data/passageChordRecognition.json'
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

type UpperVoiceContextT = {
  readonly currentNote: number
  readonly previousPitch: number
}

type UpperVoiceResultT = {
  readonly midiNote: number
  readonly nextContext: UpperVoiceContextT
}

const getSortedNotes = (midiNotes: readonly number[]): number[] => {
  const uniqueNotes = Array.from(new Set(midiNotes))
  const sortedNotes = uniqueNotes.sort((firstNote, secondNote) => {
    return firstNote - secondNote
  })
  return sortedNotes
}

const getPitchMask = (midiNotes: readonly number[]): number => {
  let pitchMask = 0
  for (const midiNote of midiNotes) {
    const pitchClass = midiNote % 12
    pitchMask |= 1 << pitchClass
  }
  return pitchMask
}

const getRecognizedPitches = (midiNotes: readonly number[]): readonly number[] => {
  const pitchMask = getPitchMask(midiNotes)
  const bassNote = validation.getRequiredEntry(midiNotes, 0)
  const bassPitch = bassNote % 12
  const chordPitchesByBass = chordRecognition.mappings[pitchMask]
  const recognizedPitches = chordPitchesByBass?.[bassPitch]
  const isMissingChord = recognizedPitches === undefined || recognizedPitches.length === 0
  if (isMissingChord) throw new Error('Missing native passage chord recognition')
  return recognizedPitches
}

const getOrderedChordPitches = (midiNotes: readonly number[]): number[] => {
  const recognizedPitches = getRecognizedPitches(midiNotes)
  const rootPitch = validation.getRequiredEntry(recognizedPitches, 0)
  const relativePitches = recognizedPitches.map((chordPitch) => {
    const relativePitch = (chordPitch - rootPitch + 12) % 12
    return relativePitch
  })
  relativePitches.sort((firstPitch, secondPitch) => {
    return firstPitch - secondPitch
  })
  const orderedPitches = relativePitches.map((relativePitch) => {
    return (rootPitch + relativePitch) % 12
  })
  return orderedPitches
}

const getUpperVoice = (sourceNote: number, targetPitches: readonly number[], context: UpperVoiceContextT): UpperVoiceResultT => {
  const sourcePitch = sourceNote % 12
  const referencePosition = referencePitches.indexOf(sourcePitch)
  const hasUnknownPitch = referencePosition < 0
  if (hasUnknownPitch) throw new Error('Unknown passage reference pitch')
  const isLeadingVoice = sourcePitch === 11
  const wrapCount = Math.max(1, targetPitches.length - 1)
  const wrappedPosition = referencePosition % wrapCount
  const targetPosition = isLeadingVoice ? targetPitches.length - 1 : wrappedPosition
  const targetPitch = validation.getRequiredEntry(targetPitches, targetPosition)
  const pitchDifference = (targetPitch - context.previousPitch + 12) % 12
  const currentNote = context.currentNote + pitchDifference
  const octaveOffset = Math.max(0, Math.trunc((sourceNote - 75) / 12))
  const mappedNote = currentNote + octaveOffset * 12
  const boundedNote = Math.min(127, mappedNote)
  const nextContext = { currentNote, previousPitch: targetPitch }
  return { midiNote: boundedNote, nextContext }
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
  const highestNote = validation.getRequiredEntry(midiNotes, midiNotes.length - 1)
  const targetPitches = getOrderedChordPitches(midiNotes)
  const upperContexts = new Map<number, UpperVoiceContextT>()
  for (const sourceEvent of input.template.events) {
    const referencePosition = referenceVoices.indexOf(sourceEvent.sourceMidiNote)
    const isUpperVoice = referencePosition < 0
    const wrappedPosition = referencePosition % midiNotes.length
    let midiNote = 0
    if (isUpperVoice) {
      const initialContext = { currentNote: highestNote, previousPitch: highestNote % 12 }
      const context = upperContexts.get(sourceEvent.startBeat) ?? initialContext
      const result = getUpperVoice(sourceEvent.sourceMidiNote, targetPitches, context)
      midiNote = result.midiNote
      upperContexts.set(sourceEvent.startBeat, result.nextContext)
    }
    if (!isUpperVoice) midiNote = validation.getRequiredEntry(midiNotes, wrappedPosition)
    const identifier = String(sourceEvent.id)
    const event = buildEvent(sourceEvent, midiNote, identifier)
    events.push(event)
  }
  const additionalEvents = buildAdditionalVoices(input.template, midiNotes)
  events.push(...additionalEvents)
  // Native keeps the longest colliding ornament.
  events.sort((firstEvent, secondEvent) => {
    return secondEvent.durationBeats - firstEvent.durationBeats
  })
  return events
}

// Base voices follow native passage ordinals. Each
// onset's upper notes walk the recognized chord from
// the highest supplied voice.
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

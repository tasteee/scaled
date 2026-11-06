import type * as recovered from './recoveredTypes.js'
import type * as types from './types.js'
import * as rhythms from './scalerPerformance.js'
import * as grooves from './scalerGroove.js'
import * as scalePerformances from './scalerScalePerformance.js'
import * as strummed from './scalerStrummed.js'
import * as passages from './scalerPassage.js'
import * as validation from './validation.js'

export type AdaptPerformanceTemplateInputT = {
  readonly template: recovered.RecoveredPerformanceTemplateT
  readonly midiNotes: readonly number[]
  readonly key: string
  readonly scale: string
  readonly octave: number
  readonly chordRootPitch?: number
}

type ResolvedEventT = {
  id: string
  startBeat: number
  durationBeats: number
  velocity: number
  midiNote: number
}

type ResolvedPatternT = { durationBeats: number; events: ResolvedEventT[] }

export const canAdaptPerformanceTemplate = (template: { readonly category: string }): boolean => {
  const categories = ['Rhythms', 'Grooves', 'Bass', 'Melody', 'Passages', 'Phrases', 'Sequences', 'StrummedSequences']
  const isSupported = categories.includes(template.category)
  return isSupported
}

const getNativeVelocity = (sourceVelocity: number): number => {
  const referenceVelocity = 0.7 * 127
  const blendedVelocity = (sourceVelocity + referenceVelocity) / 2
  const midiVelocity = Math.round(blendedVelocity)
  return midiVelocity
}

const resolveIndexedEvents = (template: recovered.RecoveredPerformanceTemplateT, midiNotes: readonly (number | undefined)[]): ResolvedEventT[] => {
  const events: ResolvedEventT[] = []
  for (const sourceEvent of template.events) {
    const midiNote = midiNotes[sourceEvent.sourcePitchIndex]
    const isMissing = midiNote === undefined
    if (isMissing) continue
    const velocity = getNativeVelocity(sourceEvent.velocity)
    const id = String(sourceEvent.id)
    events.push({ id, midiNote, startBeat: sourceEvent.startBeat, durationBeats: sourceEvent.durationBeats, velocity })
  }
  return events
}

const resolveChordToneEvents = (pattern: types.PerformancePatternT, midiNotes: readonly number[], shouldBlendVelocity: boolean): ResolvedPatternT => {
  const events: ResolvedEventT[] = []
  for (const event of pattern.events) {
    const isChordTone = event.pitch.type === 'chordTone'
    if (!isChordTone) throw new Error('Expected a chord-tone factory performance')
    const midiNote = validation.getRequiredEntry(midiNotes, event.pitch.index)
    const sourceVelocity = event.velocity ?? 90
    const velocity = shouldBlendVelocity ? getNativeVelocity(sourceVelocity) : sourceVelocity
    const id = event.id ?? String(events.length)
    events.push({ id, midiNote, startBeat: event.startBeat, durationBeats: event.durationBeats, velocity })
  }
  return { durationBeats: pattern.durationBeats, events }
}

const buildResolvedPattern = (input: AdaptPerformanceTemplateInputT): ResolvedPatternT => {
  const isPassage = input.template.category === 'Passages'
  if (isPassage) {
    const pattern = passages.adaptPassageTemplate(input)
    const events = pattern.events.map((event): ResolvedEventT => {
      const isFixedPitch = event.pitch.type === 'midi'
      if (!isFixedPitch) throw new Error('Expected a fixed-pitch passage event')
      const id = event.id ?? String(event.startBeat)
      const velocity = event.velocity ?? 90
      return { id, midiNote: event.pitch.midiNote, startBeat: event.startBeat, durationBeats: event.durationBeats, velocity }
    })
    return { durationBeats: pattern.durationBeats, events }
  }
  const isRhythm = input.template.category === 'Rhythms'
  if (isRhythm) {
    const pattern = rhythms.adaptRhythmTemplate({ template: input.template, targetNoteCount: input.midiNotes.length })
    const resolvedPattern = resolveChordToneEvents(pattern, input.midiNotes, true)
    return resolvedPattern
  }
  const isStrummed = input.template.category === 'StrummedSequences'
  if (isStrummed) {
    const pattern = strummed.adaptStrummedTemplate({ template: input.template, targetNoteCount: input.midiNotes.length })
    const resolvedPattern = resolveChordToneEvents(pattern, input.midiNotes, false)
    return resolvedPattern
  }
  const isGroove = input.template.category === 'Grooves'
  if (isGroove) {
    const midiNotes = grooves.getGrooveMidiNotes({ template: input.template, midiNotes: input.midiNotes })
    const events = resolveIndexedEvents(input.template, midiNotes)
    return { durationBeats: input.template.durationBeats, events }
  }
  const scalePerformance = scalePerformances.getScalePerformance(input)
  const events = resolveIndexedEvents(scalePerformance.template, scalePerformance.midiNotes)
  return { durationBeats: scalePerformance.template.durationBeats, events }
}

const normalizeEvents = (events: readonly ResolvedEventT[]): readonly ResolvedEventT[] => {
  const sortedEvents = [...events].sort((firstEvent, secondEvent) => {
    const pitchDifference = firstEvent.midiNote - secondEvent.midiNote
    const hasPitchDifference = pitchDifference !== 0
    if (hasPitchDifference) return pitchDifference
    return firstEvent.startBeat - secondEvent.startBeat
  })
  const normalizedEvents: ResolvedEventT[] = []
  for (const event of sortedEvents) {
    const hasNoDuration = event.durationBeats <= 0
    if (hasNoDuration) continue
    const previous = normalizedEvents.at(-1)
    const hasSamePitch = previous !== undefined && previous.midiNote === event.midiNote
    const isDuplicate = hasSamePitch && previous.startBeat === event.startBeat
    if (isDuplicate) continue
    if (hasSamePitch) {
      const requestedEnd = previous.startBeat + previous.durationBeats
      const clippedEnd = Math.min(requestedEnd, event.startBeat)
      previous.durationBeats = clippedEnd - previous.startBeat
    }
    normalizedEvents.push({ ...event })
  }
  return normalizedEvents
}

// Factory playback follows chord harmony and scale context,
// normal speed, and native reference velocity 0.7.
// Strums retain their captured native default settings.
export const adaptPerformanceTemplate = (input: AdaptPerformanceTemplateInputT): types.PerformancePatternT => {
  const isSupported = canAdaptPerformanceTemplate(input.template)
  if (!isSupported) throw new Error(`Unsupported factory performance category: ${input.template.category}`)
  for (const midiNote of input.midiNotes) validation.validateMidiNote(midiNote)
  const hasNoNotes = input.midiNotes.length === 0
  if (hasNoNotes) throw new Error('Factory performance requires a voiced chord')
  const resolvedPattern = buildResolvedPattern(input)
  const normalizedEvents = normalizeEvents(resolvedPattern.events)
  const events = normalizedEvents.map((event): types.PatternEventT => {
    const eventPitch: types.FixedPitchSelectorT = { type: 'midi', midiNote: event.midiNote }
    return { id: event.id, startBeat: event.startBeat, durationBeats: event.durationBeats, velocity: event.velocity, pitch: eventPitch }
  })
  return { id: input.template.id, name: input.template.name, durationBeats: resolvedPattern.durationBeats, events }
}

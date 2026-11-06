import type * as types from './types.js'
import type * as timelineTypes from './timeline.js'
import * as timeline from './timeline.js'
import * as chords from './chords.js'
import * as patternPitch from './patternPitch.js'
import * as validation from './validation.js'

type RenderContextT = {
  readonly timeline: readonly timelineTypes.TimelineChordT[]
  readonly pattern: types.PerformancePatternT
  readonly scale: types.ScaleT
  readonly octave: number
  readonly velocity: number
  readonly durationBeats: number
}

type RenderEventInputT = {
  readonly context: RenderContextT
  readonly event: types.PatternEventT
  readonly eventPosition: number
  readonly repeatPosition: number
}

const validatePattern = (pattern: types.PerformancePatternT): void => {
  validation.validatePositiveNumber(pattern.durationBeats, 'Pattern durationBeats')
  for (const event of pattern.events) {
    validation.validateNonnegativeNumber(event.startBeat, 'Event startBeat')
    validation.validatePositiveNumber(event.durationBeats, 'Event durationBeats')
    const isOutsideLoop = event.startBeat >= pattern.durationBeats
    if (isOutsideLoop) throw new Error('Pattern event must start before the loop ends')
    const hasVelocity = event.velocity !== undefined
    if (hasVelocity) validation.validateVelocity(event.velocity)
  }
  return undefined
}

const getPerformanceAtSpeed = (pattern: types.PerformancePatternT, speedMultiplier: number): types.PerformancePatternT => {
  validation.validatePositiveNumber(speedMultiplier, 'Performance speedMultiplier')
  const isOriginalSpeed = speedMultiplier === 1
  if (isOriginalSpeed) return pattern
  const durationBeats = pattern.durationBeats / speedMultiplier
  const events = pattern.events.map((event): types.PatternEventT => {
    const startBeat = event.startBeat / speedMultiplier
    const durationBeats = event.durationBeats / speedMultiplier
    return { ...event, startBeat, durationBeats }
  })
  const scaledPattern = { ...pattern, durationBeats, events }
  validatePattern(scaledPattern)
  return scaledPattern
}

const renderEvent = (input: RenderEventInputT): types.PerformanceNoteT | undefined => {
  const context = input.context
  const patternOffset = input.repeatPosition * context.pattern.durationBeats
  const startBeat = patternOffset + input.event.startBeat
  const isOutsideClip = startBeat >= context.durationBeats
  if (isOutsideClip) return undefined
  const activeChord = timeline.getActiveChord(context.timeline, startBeat)
  const hasNoChord = activeChord === undefined
  if (hasNoChord) return undefined
  const requestedEnd = startBeat + input.event.durationBeats
  const clippedEnd = Math.min(requestedEnd, activeChord.endBeat, context.durationBeats)
  const durationBeats = clippedEnd - startBeat
  const midiNote = patternPitch.resolvePatternPitch({
    selector: input.event.pitch,
    chord: activeChord.chord,
    scale: context.scale,
    octave: context.octave
  })
  validation.validateMidiNote(midiNote)
  const velocity = input.event.velocity ?? context.velocity
  const eventId = input.event.id ?? `event-${input.eventPosition}`
  const id = `${context.pattern.id}:${input.repeatPosition}:${input.eventPosition}`
  return { id, midiNote, startBeat, durationBeats, velocity, chordId: activeChord.id, eventId }
}

const renderPattern = (context: RenderContextT): readonly types.PerformanceNoteT[] => {
  const hasNoEvents = context.pattern.events.length === 0
  if (hasNoEvents) return []
  const repeatCount = Math.ceil(context.durationBeats / context.pattern.durationBeats)
  validation.validateInteger(repeatCount, 'Pattern repeat count')
  const scheduledEventCount = repeatCount * context.pattern.events.length
  const isTooLarge = scheduledEventCount > 1000000
  if (isTooLarge) throw new RangeError('A performance may schedule at most 1,000,000 pattern events')
  const repeatPositions = Array.from({ length: repeatCount }, (_, position) => {
    return position
  })
  const notes: types.PerformanceNoteT[] = []
  const eventEntries = context.pattern.events.entries()
  const indexedEvents = Array.from(eventEntries)
  for (const repeatPosition of repeatPositions) {
    for (const eventEntry of indexedEvents) {
      const note = renderEvent({ context, event: eventEntry[1], eventPosition: eventEntry[0], repeatPosition })
      const hasNote = note !== undefined
      if (hasNote) notes.push(note)
    }
  }
  const sortedNotes = notes.sort((firstNote, secondNote) => {
    return firstNote.startBeat - secondNote.startBeat
  })
  return sortedNotes
}

export const applyPerformance = (input: types.ApplyPerformanceInputT, options: Required<types.ScaledEngineOptionsT>): types.MidiClipT => {
  validatePattern(input.performance)
  const speedMultiplier = input.speedMultiplier ?? 1
  const performance = getPerformanceAtSpeed(input.performance, speedMultiplier)
  const octave = input.octave ?? options.octave
  const chordTimeline = timeline.buildTimeline(input.progression, octave)
  const finalChord = chordTimeline.at(-1)
  const durationBeats = finalChord?.endBeat ?? 0
  const hasNoDuration = durationBeats === 0
  if (hasNoDuration) return { durationBeats: 0, notes: [] }
  const key = input.key ?? 'C'
  const scaleName = input.scale ?? 'major'
  const scale = chords.getScale({ key, scale: scaleName, octave }, octave)
  const notes = renderPattern({
    timeline: chordTimeline,
    pattern: performance,
    scale,
    octave,
    velocity: options.velocity,
    durationBeats
  })
  return { durationBeats, notes }
}

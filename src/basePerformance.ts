import type * as recovered from './recoveredTypes.js'
import type * as types from './types.js'
import * as validation from './validation.js'

export type AdaptRhythmTemplateInputT = {
  readonly template: recovered.RecoveredPerformanceTemplateT
  readonly targetNoteCount: number
}

export const canAdaptRhythmTemplate = (template: recovered.RecoveredPerformanceTemplateT): boolean => {
  const isRhythm = template.category === 'Rhythms'
  const hasNativeRegister = template.octaveDifference === -1
  const canAdapt = isRhythm && hasNativeRegister
  return canAdapt
}

const validateRhythmTemplate = (input: AdaptRhythmTemplateInputT): void => {
  validation.validateInteger(input.targetNoteCount, 'Target note count')
  const isValidCount = input.targetNoteCount > 0 && input.targetNoteCount <= 128
  if (!isValidCount) throw new RangeError('Target note count must be between 1 and 128')
  const canAdapt = canAdaptRhythmTemplate(input.template)
  if (!canAdapt) throw new Error('Only recovered Rhythms templates with native register are supported')
  validation.validatePositiveNumber(input.template.durationBeats, 'Rhythm durationBeats')
  const sourceNoteCount = input.template.referenceMidiNotes.length
  const hasSourceNotes = sourceNoteCount > 0
  if (!hasSourceNotes) throw new Error('Rhythm template must contain reference notes')
  const initialEvents = input.template.events.slice(0, sourceNoteCount)
  const hasInitialVoices = initialEvents.length === sourceNoteCount
  if (!hasInitialVoices) throw new Error('Rhythm template is missing initial voice events')
  for (const eventEntry of initialEvents.entries()) {
    const hasExpectedVoice = eventEntry[1].sourcePitchIndex === eventEntry[0]
    if (!hasExpectedVoice) throw new Error('Rhythm template has an unsupported initial voice order')
  }
  return undefined
}

const buildRhythmEvent = (event: recovered.RecoveredPerformanceEventT, targetVoice: number): types.PatternEventT => {
  const id = `voice-${targetVoice}:event-${event.id}`
  const pitch: types.ChordToneSelectorT = { type: 'chordTone', index: targetVoice }
  return { id, startBeat: event.startBeat, durationBeats: event.durationBeats, velocity: event.velocity, pitch }
}

// Reconstructs the Rhythms branch of 0x1807ca940 and
// voice expansion in 0x1807ca650. All 102 templates
// match native expansion for one through seven voices.
// Full transform/audio parity remains a separate check.
export const adaptRhythmTemplate = (input: AdaptRhythmTemplateInputT): types.PerformancePatternT => {
  validateRhythmTemplate(input)
  const sourceNoteCount = input.template.referenceMidiNotes.length
  const targetVoices = Array.from({ length: input.targetNoteCount }, (unused, position) => {
    return position
  })
  const events: types.PatternEventT[] = []
  for (const targetVoice of targetVoices) {
    const sourceVoice = targetVoice % sourceNoteCount
    for (const sourceEvent of input.template.events) {
      const isMatchingVoice = sourceEvent.sourcePitchIndex === sourceVoice
      if (!isMatchingVoice) continue
      const event = buildRhythmEvent(sourceEvent, targetVoice)
      events.push(event)
    }
  }
  const sortedEvents = events.sort((firstEvent, secondEvent) => {
    return firstEvent.startBeat - secondEvent.startBeat
  })
  return { id: input.template.id, name: input.template.name, durationBeats: input.template.durationBeats, events: sortedEvents }
}

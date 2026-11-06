import strummedCatalog from './data/strummedPatterns.json'
import type * as recovered from './recoveredTypes.js'
import type * as types from './types.js'
import * as validation from './validation.js'

export type AdaptStrummedTemplateInputT = {
  readonly template: recovered.RecoveredPerformanceTemplateT
  readonly targetNoteCount: number
}

// Captured native default strum settings: style 1,
// speed 1, expression 0, voicing 0, velocity 0.7.
export const adaptStrummedTemplate = (input: AdaptStrummedTemplateInputT): types.PerformancePatternT => {
  validation.validateInteger(input.targetNoteCount, 'Target note count')
  const isSupportedCount = input.targetNoteCount >= 1 && input.targetNoteCount <= 12
  if (!isSupportedCount) throw new RangeError('Strummed performances support 1–12 voices')
  const capture = strummedCatalog.captures.find((candidate) => {
    return candidate.id === input.template.id
  })
  if (!capture) throw new Error('Unknown strummed sequence')
  const shapePosition = input.targetNoteCount - 1
  const shape = validation.getRequiredEntry(capture.shapes, shapePosition)
  const events = shape.map((sourceEvent, position): types.PatternEventT => {
    const index = validation.getRequiredEntry(sourceEvent, 0)
    const startBeat = validation.getRequiredEntry(sourceEvent, 1)
    const durationBeats = validation.getRequiredEntry(sourceEvent, 2)
    const velocity = validation.getRequiredEntry(sourceEvent, 3)
    const id = `strum-${position}`
    return { id, startBeat, durationBeats, velocity, pitch: { type: 'chordTone', index } }
  })
  return { id: input.template.id, name: input.template.name, durationBeats: capture.durationBeats, events }
}

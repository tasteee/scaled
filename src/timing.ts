import type * as types from './types.js'
import * as validation from './validation.js'

const validateResolution = (ticksPerBeat: number): void => {
  validation.validateInteger(ticksPerBeat, 'ticksPerBeat')
  validation.validatePositiveNumber(ticksPerBeat, 'ticksPerBeat')
  return undefined
}

export const ticksToBeats = (ticks: number, ticksPerBeat: number): number => {
  validation.validateFiniteNumber(ticks, 'Ticks')
  validateResolution(ticksPerBeat)
  const beats = ticks / ticksPerBeat
  return beats
}

// Conversion stays unrounded; MIDI export quantizes once.
export const beatsToTicks = (beats: number, ticksPerBeat: number): number => {
  validation.validateFiniteNumber(beats, 'Beats')
  validateResolution(ticksPerBeat)
  const ticks = beats * ticksPerBeat
  return ticks
}

export const barsToBeats = (bars: number, timeSignature: types.TimeSignatureT): number => {
  validation.validateFiniteNumber(bars, 'Bars')
  validation.validateInteger(timeSignature.numerator, 'Time signature numerator')
  validation.validatePositiveNumber(timeSignature.numerator, 'Time signature numerator')
  validation.validateInteger(timeSignature.denominator, 'Time signature denominator')
  validation.validatePositiveNumber(timeSignature.denominator, 'Time signature denominator')
  const beatsPerBar = timeSignature.numerator * 4 / timeSignature.denominator
  const beats = bars * beatsPerBar
  return beats
}

export const createPatternFromTicks = (input: types.TickPatternT): types.PerformancePatternT => {
  const durationBeats = ticksToBeats(input.durationTicks, input.ticksPerBeat)
  validation.validatePositiveNumber(durationBeats, 'Pattern duration')
  const events = input.events.map((event): types.PatternEventT => {
    const startBeat = ticksToBeats(event.startTick, input.ticksPerBeat)
    const eventDurationBeats = ticksToBeats(event.durationTicks, input.ticksPerBeat)
    validation.validateNonnegativeNumber(startBeat, 'Event start')
    validation.validatePositiveNumber(eventDurationBeats, 'Event duration')
    const isOutsideLoop = startBeat >= durationBeats
    if (isOutsideLoop) throw new RangeError('Event must start before the pattern ends')
    return { ...event, startBeat, durationBeats: eventDurationBeats }
  })
  return { id: input.id, name: input.name, durationBeats, events }
}

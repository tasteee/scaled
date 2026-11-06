import type * as types from './types.js'
import * as pitch from './pitch.js'
import * as validation from './validation.js'

type ResolvePitchInputT = {
  readonly selector: types.PatternPitchSelectorT
  readonly chord: types.ChordT
  readonly scale: types.ScaleT
  readonly octave: number
}

const getIndexedNote = (notes: readonly number[], index: number, octaveOffset: number): number => {
  validation.validateInteger(index, 'Pitch index')
  validation.validateInteger(octaveOffset, 'Pitch octaveOffset')
  const noteCount = notes.length
  const hasNotes = noteCount > 0
  if (!hasNotes) throw new Error('Cannot resolve a pitch against an empty note collection')
  const wrappedIndex = ((index % noteCount) + noteCount) % noteCount
  const wrappedOctaves = Math.floor(index / noteCount)
  const baseNote = validation.getRequiredEntry(notes, wrappedIndex)
  const totalOctaveOffset = wrappedOctaves + octaveOffset
  const midiNote = baseNote + totalOctaveOffset * 12
  return midiNote
}

export const resolvePatternPitch = (input: ResolvePitchInputT): number => {
  const selector = input.selector
  const isChordTone = selector.type === 'chordTone'
  if (isChordTone) {
    const octaveOffset = selector.octaveOffset ?? 0
    const midiNote = getIndexedNote(input.chord.midiNotes, selector.index, octaveOffset)
    return midiNote
  }
  const isScaleDegree = selector.type === 'scaleDegree'
  if (isScaleDegree) {
    const octaveOffset = selector.octaveOffset ?? 0
    const midiNote = getIndexedNote(input.scale.midiNotes, selector.index, octaveOffset)
    return midiNote
  }
  const isRootOffset = selector.type === 'rootOffset'
  if (isRootOffset) {
    validation.validateInteger(selector.semitones, 'Pitch semitones')
    const rootMidiNote = pitch.getRootMidiNote(input.chord.rootPitch, input.octave)
    const midiNote = rootMidiNote + selector.semitones
    return midiNote
  }
  return selector.midiNote
}

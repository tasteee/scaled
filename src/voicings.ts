import type * as types from './types.js'
import * as chords from './chords.js'
import * as pitch from './pitch.js'
import * as validation from './validation.js'

const getSortedNotes = (notes: readonly number[]): number[] => {
  const sortedNotes = [...notes].sort((firstNote, secondNote) => {
    return firstNote - secondNote
  })
  return sortedNotes
}

const getClosedNotes = (chord: types.ChordT): readonly number[] => {
  const lowestNote = validation.getRequiredEntry(chord.midiNotes, 0)
  const rootOctave = Math.floor(lowestNote / 12)
  const rootMidiNote = rootOctave * 12 + chord.rootPitch
  const notes = chord.intervals.map((interval) => {
    const pitchOffset = pitch.getPitchClass(interval)
    const midiNote = rootMidiNote + pitchOffset
    return midiNote
  })
  const sortedNotes = getSortedNotes(notes)
  return sortedNotes
}

// Move rotated bass notes above the remaining notes,
// including chords whose original span exceeds an octave.
const getInvertedNotes = (notes: readonly number[], inversion: number): readonly number[] => {
  const sortedNotes = getSortedNotes(notes)
  const noteCount = sortedNotes.length
  const rotation = ((inversion % noteCount) + noteCount) % noteCount
  const octaveShift = Math.floor(inversion / noteCount) * 12
  const remainingNotes = sortedNotes.slice(rotation)
  const movedNotes = sortedNotes.slice(0, rotation)
  const highestNote = validation.getRequiredEntry(sortedNotes, noteCount - 1)
  const raisedNotes = movedNotes.map((midiNote) => {
    const distanceAboveHighest = highestNote - midiNote + 1
    const octavesToRaise = Math.ceil(distanceAboveHighest / 12)
    const raisedNote = midiNote + octavesToRaise * 12
    return raisedNote
  })
  const rotatedNotes = remainingNotes.concat(raisedNotes)
  const invertedNotes = rotatedNotes.map((midiNote) => {
    const shiftedNote = midiNote + octaveShift
    return shiftedNote
  })
  const orderedNotes = getSortedNotes(invertedNotes)
  return orderedNotes
}

const getOpenNotes = (notes: readonly number[]): readonly number[] => {
  const openNotes = notes.map((midiNote, position) => {
    const shouldRaise = position % 2 === 1
    const octaveShift = shouldRaise ? 12 : 0
    const raisedNote = midiNote + octaveShift
    return raisedNote
  })
  const sortedNotes = getSortedNotes(openNotes)
  return sortedNotes
}

const getDropTwoNotes = (notes: readonly number[]): readonly number[] => {
  const hasEnoughNotes = notes.length >= 4
  if (!hasEnoughNotes) throw new Error('Drop-2 voicing requires at least four notes')
  const dropPosition = notes.length - 2
  const droppedNotes = notes.map((midiNote, position) => {
    const shouldDrop = position === dropPosition
    const octaveShift = shouldDrop ? -12 : 0
    const droppedNote = midiNote + octaveShift
    return droppedNote
  })
  const sortedNotes = getSortedNotes(droppedNotes)
  return sortedNotes
}

const getSpacedNotes = (notes: readonly number[], voicing: types.VoicingNameT): readonly number[] => {
  const isOpen = voicing === 'open'
  if (isOpen) return getOpenNotes(notes)
  const isDropTwo = voicing === 'drop2'
  if (isDropTwo) return getDropTwoNotes(notes)
  return notes
}

export const getChordWithVoicing = (input: types.GetChordWithVoicingInputT, defaultOctave: number): types.VoicedChordT => {
  const chord = chords.getChord(input, defaultOctave)
  const voicing = input.voicing ?? 'rootPosition'
  const inversion = input.inversion ?? 0
  validation.validateInteger(inversion, 'Inversion')
  const shouldClose = voicing !== 'rootPosition'
  const baseNotes = shouldClose ? getClosedNotes(chord) : chord.midiNotes
  const invertedNotes = getInvertedNotes(baseNotes, inversion)
  const midiNotes = getSpacedNotes(invertedNotes, voicing)
  for (const midiNote of midiNotes) validation.validateMidiNote(midiNote)
  return { ...chord, midiNotes, voicing, inversion }
}

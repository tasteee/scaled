import * as validation from './validation.js'

const naturalPitches: Readonly<Record<string, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11
}

const majorIntervals = [0, 2, 4, 5, 7, 9, 11] as const
const sharpNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

export const getPitchClass = (semitones: number): number => {
  const remainder = semitones % 12
  const pitch = (remainder + 12) % 12
  return pitch
}

export const normalizeAccidentals = (value: string): string => {
  const normalized = value.replaceAll('♯', '#').replaceAll('♭', 'b')
  return normalized
}

export const getAccidentalOffset = (accidentals: string): number => {
  const sharpCount = accidentals.split('#').length - 1
  const flatCount = accidentals.split('b').length - 1
  const semitones = sharpCount - flatCount
  return semitones
}

export const getNotePitch = (noteName: string): number => {
  const trimmedName = noteName.trim()
  const normalized = normalizeAccidentals(trimmedName)
  const match = normalized.match(/^([A-Ga-g])([#b]{0,2})$/)
  const isMissingMatch = match === null
  if (isMissingMatch) throw new Error(`Unsupported note name: ${noteName}`)
  const matchedLetter = validation.getRequiredEntry(match, 1)
  const letter = matchedLetter.toUpperCase()
  const accidentals = validation.getRequiredEntry(match, 2)
  const naturalPitch = naturalPitches[letter]
  const isMissingPitch = naturalPitch === undefined
  if (isMissingPitch) throw new Error(`Unsupported note letter: ${letter}`)
  const accidentalOffset = getAccidentalOffset(accidentals)
  const alteredPitch = naturalPitch + accidentalOffset
  const pitch = getPitchClass(alteredPitch)
  return pitch
}

export const getPitchName = (pitch: number): string => {
  const normalized = getPitchClass(pitch)
  const name = validation.getRequiredEntry(sharpNames, normalized)
  return name
}

export const getRootMidiNote = (pitch: number, octave: number): number => {
  validation.validateInteger(octave, 'Octave')
  const midiNote = (octave + 1) * 12 + pitch
  validation.validateMidiNote(midiNote)
  return midiNote
}

export const getFormulaInterval = (formula: string): number => {
  const match = formula.match(/^([#b]*)(\d+)$/)
  const isMissingMatch = match === null
  if (isMissingMatch) throw new Error(`Unsupported interval formula: ${formula}`)
  const accidentals = validation.getRequiredEntry(match, 1)
  const degreeText = validation.getRequiredEntry(match, 2)
  const degree = Number(degreeText)
  validation.validatePositiveNumber(degree, 'Formula degree')
  validation.validateInteger(degree, 'Formula degree')
  const degreeIndex = degree - 1
  const wrappedDegree = degreeIndex % 7
  const octaveOffset = Math.floor(degreeIndex / 7) * 12
  const naturalInterval = validation.getRequiredEntry(majorIntervals, wrappedDegree)
  const accidentalOffset = getAccidentalOffset(accidentals)
  const interval = naturalInterval + octaveOffset + accidentalOffset
  return interval
}

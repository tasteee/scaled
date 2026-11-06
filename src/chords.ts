import type * as types from './types.js'
import * as catalog from './catalog.js'
import * as pitch from './pitch.js'
import * as validation from './validation.js'

export const buildChord = (rootPitch: number, definition: types.ChordDefinitionT, octave: number): types.ChordT => {
  const intervals = catalog.getDefinitionIntervals(definition.formula)
  const rootMidiNote = pitch.getRootMidiNote(rootPitch, octave)
  const midiNotes = intervals.map((interval) => {
    const midiNote = rootMidiNote + interval
    validation.validateMidiNote(midiNote)
    return midiNote
  })
  const rootName = pitch.getPitchName(rootPitch)
  const isMajorTriad = definition.name === 'maj'
  const chordSuffix = isMajorTriad ? '' : definition.name
  const symbol = `${rootName}${chordSuffix}`
  return { symbol, rootPitch, chordType: definition.name, intervals, midiNotes }
}

export const getChord = (input: types.GetChordInputT, defaultOctave: number): types.ChordT => {
  const chordInput = input.chord
  const isSymbol = typeof chordInput === 'string'
  if (!isSymbol) {
    const hasNotes = chordInput.midiNotes.length > 0
    if (!hasNotes) throw new Error('Chord must contain MIDI notes')
    for (const midiNote of chordInput.midiNotes) validation.validateMidiNote(midiNote)
    const chord = structuredClone(chordInput)
    return chord
  }
  const trimmedSymbol = chordInput.trim()
  const normalizedSymbol = pitch.normalizeAccidentals(trimmedSymbol)
  const match = normalizedSymbol.match(/^([A-Ga-g])([#b]?)(.*)$/)
  const isMissingMatch = match === null
  if (isMissingMatch) throw new Error(`Unsupported chord symbol: ${input.chord}`)
  const letter = validation.getRequiredEntry(match, 1)
  const accidental = validation.getRequiredEntry(match, 2)
  const rootName = `${letter}${accidental}`
  const rootPitch = pitch.getNotePitch(rootName)
  const matchedChordType = validation.getRequiredEntry(match, 3)
  const chordType = matchedChordType.trim()
  const definition = catalog.getChordDefinition(chordType)
  const octave = input.octave ?? defaultOctave
  const chord = buildChord(rootPitch, definition, octave)
  return chord
}

export const getScale = (input: types.GetScaleInputT, defaultOctave: number): types.ScaleT => {
  const tonicPitch = pitch.getNotePitch(input.key)
  const definition = catalog.getScaleDefinition(input.scale)
  const intervals = catalog.getDefinitionIntervals(definition.formula)
  const octave = input.octave ?? defaultOctave
  const rootMidiNote = pitch.getRootMidiNote(tonicPitch, octave)
  const pitches = intervals.map((interval) => {
    const transposedPitch = tonicPitch + interval
    const normalizedPitch = pitch.getPitchClass(transposedPitch)
    return normalizedPitch
  })
  const midiNotes = intervals.map((interval) => {
    const midiNote = rootMidiNote + interval
    validation.validateMidiNote(midiNote)
    return midiNote
  })
  return { key: input.key, name: definition.name, tonicPitch, intervals, pitches, midiNotes }
}

const checkDefinitionFilters = (definition: types.ChordDefinitionT, input: types.GetScaleChordsInputT): boolean => {
  const isSuspended = definition.name.includes('sus')
  const shouldExcludeSuspended = input.includeSuspended === false && isSuspended
  if (shouldExcludeSuspended) return false
  const isAddedTone = definition.name.includes('add')
  const shouldExcludeAddedTone = input.includeAddedTone === false && isAddedTone
  if (shouldExcludeAddedTone) return false
  const chordTypes = input.chordTypes
  const hasFamilyFilter = chordTypes !== undefined
  if (!hasFamilyFilter) return true
  const family = catalog.getChordFamily(definition)
  const isMatchingFamily = chordTypes.includes(family)
  return isMatchingFamily
}

const checkScaleCompatibility = (rootPitch: number, definition: types.ChordDefinitionT, scale: types.ScaleT): boolean => {
  const intervals = catalog.getDefinitionIntervals(definition.formula)
  const isCompatible = intervals.every((interval) => {
    const transposedPitch = rootPitch + interval
    const notePitch = pitch.getPitchClass(transposedPitch)
    const isScalePitch = scale.pitches.includes(notePitch)
    return isScalePitch
  })
  return isCompatible
}

const getChordsForRoot = (rootPitch: number, definitions: readonly types.ChordDefinitionT[], scale: types.ScaleT, octave: number): readonly types.ChordT[] => {
  const chords: types.ChordT[] = []
  for (const definition of definitions) {
    const isCompatible = checkScaleCompatibility(rootPitch, definition, scale)
    if (!isCompatible) continue
    const chord = buildChord(rootPitch, definition, octave)
    chords.push(chord)
  }
  return chords
}

export const getScaleChords = (input: types.GetScaleChordsInputT, defaultOctave: number): readonly types.ChordT[] => {
  const scale = getScale(input, defaultOctave)
  const definitions = catalog.getChordDefinitions()
  const filteredDefinitions = definitions.filter((definition) => {
    const shouldInclude = checkDefinitionFilters(definition, input)
    return shouldInclude
  })
  const octave = input.octave ?? defaultOctave
  const chords: types.ChordT[] = []
  for (const rootPitch of scale.pitches) {
    const rootChords = getChordsForRoot(rootPitch, filteredDefinitions, scale, octave)
    chords.push(...rootChords)
  }
  return chords
}

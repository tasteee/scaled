import chordCatalog from './data/chords.json'
import scaleCatalog from './data/scales.json'
import type * as types from './types.js'
import * as pitch from './pitch.js'

const chordDefinitions: readonly types.ChordDefinitionT[] = chordCatalog
const scaleDefinitions: readonly types.ScaleDefinitionT[] = scaleCatalog

const chordAliases: Readonly<Record<string, string>> = {
  '': 'maj',
  M: 'maj',
  major: 'maj',
  m: 'min',
  minor: 'min',
  m7: 'min7',
  m9: 'min9',
  m11: 'min11',
  m13: 'min13',
  M7: 'maj7',
  M9: 'maj9',
  M13: 'maj13',
  m7b5: 'min7(b5)',
  'ø7': 'min7(b5)',
  dim7: 'dim7',
  '+': 'aug',
  add9: 'maj add 9'
}

const scaleAliases: Readonly<Record<string, string>> = {
  major: 'Major scale',
  ionian: 'Major scale',
  minor: 'Natural Minor scale',
  'natural minor': 'Natural Minor scale',
  aeolian: 'Natural Minor scale',
  dorian: 'Dorian mode',
  phrygian: 'Phrygian mode',
  lydian: 'Lydian mode',
  mixolydian: 'Mixolydian mode',
  locrian: 'Locrian mode'
}

export const getChordDefinition = (name: string): types.ChordDefinitionT => {
  const normalizedName = chordAliases[name] ?? name
  const definition = chordDefinitions.find((candidate) => {
    return candidate.name === normalizedName
  })
  const isMissing = definition === undefined
  if (isMissing) throw new Error(`Unknown chord type: ${name}`)
  return definition
}

export const getScaleDefinition = (name: string): types.ScaleDefinitionT => {
  const lowercaseName = name.toLowerCase()
  const normalizedName = scaleAliases[lowercaseName] ?? name
  const lookupName = normalizedName.toLowerCase()
  const definition = scaleDefinitions.find((candidate) => {
    const candidateName = candidate.name.toLowerCase()
    const isMatchingName = candidateName === lookupName
    const isMatchingAlias = candidate.alternateNames.some((alias) => {
      const candidateAlias = alias.toLowerCase()
      const isMatchingAlias = candidateAlias === lowercaseName || candidateAlias === lookupName
      return isMatchingAlias
    })
    const isMatchingDefinition = isMatchingName || isMatchingAlias
    return isMatchingDefinition
  })
  const isMissing = definition === undefined
  if (isMissing) throw new Error(`Unknown scale: ${name}`)
  return definition
}

export const getChordDefinitions = (): readonly types.ChordDefinitionT[] => {
  const definitions = structuredClone(chordDefinitions)
  return definitions
}

export const getScaleDefinitions = (): readonly types.ScaleDefinitionT[] => {
  const definitions = structuredClone(scaleDefinitions)
  return definitions
}

export const getChordFamily = (definition: types.ChordDefinitionT): types.ChordFamilyT => {
  const hasTwoNotes = definition.formula.length === 2
  if (hasTwoNotes) return 'power'
  const degrees = definition.formula.map((formula) => {
    const degreeText = formula.replace(/[#b]/g, '')
    const degree = Number(degreeText)
    return degree
  })
  const highestDegree = Math.max(...degrees)
  const isThirteenth = highestDegree >= 13
  if (isThirteenth) return 'thirteenth'
  const isEleventh = highestDegree >= 11
  if (isEleventh) return 'eleventh'
  const isNinth = highestDegree >= 9
  if (isNinth) return 'ninth'
  const isSeventh = highestDegree >= 7
  if (isSeventh) return 'seventh'
  const isSixth = highestDegree >= 6
  if (isSixth) return 'sixth'
  return 'triad'
}

export const getDefinitionIntervals = (formula: readonly string[]): readonly number[] => {
  const intervals = formula.map(pitch.getFormulaInterval)
  return intervals
}

import tonalCatalog from './data/suggestionsTonal.json'
import perScaleCatalog from './data/suggestionsPerScale.json'
import * as pitch from './pitch.js'
import * as catalog from './catalog.js'
import type {
  GetSuggestionsInputT,
  GetSuggestionsOptionsT,
  SuggestedChordT,
  SuggestionTransitionEntryT
} from './suggestionTypes.js'

const tonalLookups: Readonly<Record<string, readonly SuggestionTransitionEntryT[]>> = tonalCatalog
const perScaleLookups: Readonly<Record<string, readonly SuggestionTransitionEntryT[]>> = perScaleCatalog

const romanDegrees = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const
const romanToDegreeIndex: Readonly<Record<string, number>> = {
  I: 0,
  II: 1,
  III: 2,
  IV: 3,
  V: 4,
  VI: 5,
  VII: 6
}

const parseChordSymbol = (symbol: string): { rootPitch: number; chordType: string } => {
  const trimmed = symbol.trim()
  const normalized = pitch.normalizeAccidentals(trimmed)
  const match = normalized.match(/^([A-Ga-g])([#b]?)(.*)$/)
  if (!match) throw new Error(`Unsupported chord symbol: ${symbol}`)
  const letter = match[1]
  const accidental = match[2]
  const rootName = `${letter}${accidental}`
  const rootPitch = pitch.getNotePitch(rootName)
  const rawType = (match[3] ?? '').trim()
  const definition = catalog.getChordDefinition(rawType)
  return { rootPitch, chordType: definition.name }
}

const resolveSourceKey = (
  chord: GetSuggestionsOptionsT['chord'],
  profile: 'tonal' | 'perScale',
  tonicPitch: number,
  scalePitches: readonly number[]
): string => {
  if (typeof chord === 'string' && chord.includes('_')) return chord
  const parsed = typeof chord === 'string'
    ? parseChordSymbol(chord)
    : chord.symbol ? parseChordSymbol(chord.symbol) : undefined
  const rootPitch = typeof chord === 'string' ? parsed!.rootPitch : chord.rootPitch ?? parsed?.rootPitch
  const rawType = typeof chord === 'string' ? parsed!.chordType : chord.chordType ?? parsed?.chordType
  if (rootPitch === undefined || rawType === undefined) throw new Error('Supply a chord symbol or rootPitch and chordType')
  if (!Number.isInteger(rootPitch) || rootPitch < 0 || rootPitch > 11) throw new RangeError('Chord rootPitch must be an integer from 0 to 11')
  const chordType = catalog.getChordDefinition(rawType).name
  if (profile === 'perScale') {
    const degreeIndex = scalePitches.indexOf(rootPitch)
    const roman = romanDegrees[degreeIndex]
    if (roman === undefined) return ''
    return roman + '_' + chordType
  }
  return pitch.getPitchClass(rootPitch - tonicPitch) + '_' + chordType
}

const formatSuggestedChord = (
  entry: SuggestionTransitionEntryT,
  profile: 'tonal' | 'perScale',
  tonicPitch: number,
  scalePitches?: readonly number[]
): SuggestedChordT => {
  const targetToken = entry.token.slice(entry.token.indexOf('-') + 1)
  const targetParts = targetToken.split('_')
  const targetPrefix = targetParts[0] ?? ''
  const targetType = targetParts.slice(1).join('_')

  let rootPitch = tonicPitch
  let scaleDegree: string | undefined = undefined
  let semitoneOffset: number | undefined = undefined

  if (profile === 'perScale') {
    scaleDegree = targetPrefix
    const degreeIndex = romanToDegreeIndex[targetPrefix] ?? 0
    if (scalePitches && scalePitches.length > 0) {
      rootPitch = scalePitches[degreeIndex] ?? tonicPitch
    } else {
      // Default to major scale degree interval if no scale given
      const majorOffsets = [0, 2, 4, 5, 7, 9, 11]
      rootPitch = (tonicPitch + (majorOffsets[degreeIndex] ?? 0)) % 12
    }
    semitoneOffset = (rootPitch - tonicPitch + 12) % 12
  } else {
    semitoneOffset = Number(targetPrefix)
    rootPitch = (tonicPitch + semitoneOffset) % 12
  }

  const rootName = pitch.getPitchName(rootPitch)
  const isMajor = targetType === 'maj'
  let symbol: string | undefined
  try {
    catalog.getChordDefinition(targetType)
    symbol = rootName + (isMajor ? '' : targetType)
  } catch {
    // Preserve corpus transitions with unrecognized chord types without inventing playable notes.
  }

  let isInScale: boolean | undefined = undefined
  if (scalePitches !== undefined) {
    try {
      const chordDefinition = catalog.getChordDefinition(targetType)
      const chordIntervals = catalog.getDefinitionIntervals(chordDefinition.formula)
      isInScale = chordIntervals.every((interval) => {
        const pitchClass = (rootPitch + interval) % 12
        return scalePitches.includes(pitchClass)
      })
    } catch {
      isInScale = false
    }
  }

  return {
    token: entry.token,
    weight: entry.weight,
    targetType,
    ...(symbol === undefined ? {} : { symbol }),
    rootPitch,
    semitoneOffset,
    ...(scaleDegree === undefined ? {} : { scaleDegree }),
    ...(isInScale === undefined ? {} : { isInScale })
  }
}

/**
 * Get vast, ranked chord suggestions derived from the mined song corpus.
 * Supports a single argument:
 * - Simple: pass a chord string (e.g. "C", "0_maj", "I_maj") or Chord object
 * - Rich options: pass a single object with named parameters (GetSuggestionsOptionsT)
 */
export const getSuggestions = (input: GetSuggestionsInputT): readonly SuggestedChordT[] => {
  const isOptionsObject = typeof input === 'object' && input !== null && 'chord' in input
  const options: GetSuggestionsOptionsT = isOptionsObject ? (input as GetSuggestionsOptionsT) : { chord: input }

  const profile = options.profile ?? (typeof options.chord === 'string' && /^[IV]+_/.test(options.chord) ? 'perScale' : 'tonal')
  if (profile !== 'tonal' && profile !== 'perScale') throw new Error('Unknown suggestion profile')
  if (options.limit !== undefined && (!Number.isSafeInteger(options.limit) || options.limit < 0)) throw new RangeError('Suggestion limit must be a nonnegative safe integer')
  const keyName = options.key ?? 'C'
  const tonicPitch = pitch.getNotePitch(keyName)

  // Resolve scale pitches if scale or inScaleOnly is requested
  const scaleName = options.scale ?? (options.inScaleOnly || profile === 'perScale' ? 'major' : undefined)
  let scalePitches: readonly number[] | undefined = undefined
  if (scaleName !== undefined) {
    const scaleDefinition = catalog.getScaleDefinition(scaleName)
    const scaleIntervals = catalog.getDefinitionIntervals(scaleDefinition.formula)
    scalePitches = scaleIntervals.map((interval) => pitch.getPitchClass(tonicPitch + interval))
    if (profile === 'perScale' && scalePitches.length !== 7) throw new Error('Per Scale suggestions require a seven-note scale; use the tonal profile for other scales')
  }

  const sourceKey = resolveSourceKey(options.chord, profile, tonicPitch, scalePitches ?? [])
  const lookupTable = profile === 'perScale' ? perScaleLookups : tonalLookups
  const rawEntries = lookupTable[sourceKey] ?? []

  let formatted = rawEntries.map((entry) => formatSuggestedChord(entry, profile, tonicPitch, scalePitches))

  if (options.inScaleOnly === true) {
    formatted = formatted.filter((suggestion) => suggestion.isInScale === true)
  }

  if (options.limit !== undefined) {
    return formatted.slice(0, options.limit)
  }

  return formatted
}

import * as catalog from './catalog.js'
import * as pitch from './pitch.js'
import * as validation from './validation.js'

type HarmonyInputT = {
  readonly midiNotes: readonly number[]
  readonly key: string
  readonly scale: string
  readonly chordRootPitch?: number
}

export type PerformanceHarmonyT = {
  readonly rootPitch: number
  readonly tonicPitch: number
  readonly sourceIntervals: readonly number[]
  readonly targetIntervals: readonly number[]
  readonly isMinor: boolean
}

const chordShapes = catalog.getChordDefinitions().map((definition) => {
  const intervals = catalog.getDefinitionIntervals(definition.formula)
  const pitchClasses = intervals.map(pitch.getPitchClass)
  const uniquePitches = Array.from(new Set(pitchClasses))
  return uniquePitches
})

const getChordPitches = (midiNotes: readonly number[]): readonly number[] => {
  const hasNoNotes = midiNotes.length === 0
  if (hasNoNotes) throw new Error('Factory performance requires a voiced chord')
  for (const midiNote of midiNotes) validation.validateMidiNote(midiNote)
  const sortedNotes = [...midiNotes].sort((firstNote, secondNote) => {
    return firstNote - secondNote
  })
  const pitches = sortedNotes.map(pitch.getPitchClass)
  const uniquePitches = Array.from(new Set(pitches))
  return uniquePitches
}

const getChordRoot = (input: HarmonyInputT, chordPitches: readonly number[]): number => {
  const hasExplicitRoot = input.chordRootPitch !== undefined
  if (hasExplicitRoot) {
    validation.validateInteger(input.chordRootPitch, 'Chord root pitch')
    const isInRange = input.chordRootPitch >= 0 && input.chordRootPitch < 12
    if (!isInRange) throw new RangeError('Chord root pitch must be between 0 and 11')
    return input.chordRootPitch
  }
  for (const shape of chordShapes) {
    const hasMatchingSize = shape.length === chordPitches.length
    if (!hasMatchingSize) continue
    const rootPitch = chordPitches.find((candidateRoot) => {
      const hasEveryPitch = shape.every((interval) => {
        const chordPitch = pitch.getPitchClass(candidateRoot + interval)
        return chordPitches.includes(chordPitch)
      })
      return hasEveryPitch
    })
    const hasRoot = rootPitch !== undefined
    if (hasRoot) return rootPitch
  }
  const bassPitch = validation.getRequiredEntry(chordPitches, 0)
  return bassPitch
}

const getNearestDegree = (interval: number, scaleIntervals: readonly number[], shouldSkipRoot = false): number => {
  let nearestDegree = 0
  let nearestDistance = Infinity
  for (const degree of scaleIntervals.keys()) {
    const isRootDegree = degree === 0
    const shouldSkip = shouldSkipRoot && isRootDegree
    if (shouldSkip) continue
    const scaleInterval = validation.getRequiredEntry(scaleIntervals, degree)
    const distance = Math.abs(interval - scaleInterval)
    const isChordDegree = degree % 2 === 0
    const isPreferredTie = distance === nearestDistance && isChordDegree
    const isCloser = distance < nearestDistance || isPreferredTie
    if (!isCloser) continue
    nearestDegree = degree
    nearestDistance = distance
  }
  return nearestDegree
}

const getRotatedIntervals = (intervals: readonly number[], rootInterval: number): readonly number[] => {
  const rootDegree = intervals.indexOf(rootInterval)
  const isChromaticRoot = rootDegree < 0
  if (isChromaticRoot) return intervals
  const rotatedIntervals = intervals.map((interval) => {
    return pitch.getPitchClass(interval - rootInterval)
  })
  rotatedIntervals.sort((firstInterval, secondInterval) => {
    return firstInterval - secondInterval
  })
  return rotatedIntervals
}

// Chord tones replace their nearest scale degrees.
// Exact scale tones take priority over altered tones.
const getHarmonicIntervals = (scaleIntervals: readonly number[], chordIntervals: readonly number[]): readonly number[] => {
  const targetIntervals = [...scaleIntervals]
  const assignedDegrees = new Set<number>([0])
  const orderedChordIntervals = [...chordIntervals].sort((firstInterval, secondInterval) => {
    const isFirstExact = scaleIntervals.includes(firstInterval)
    const isSecondExact = scaleIntervals.includes(secondInterval)
    const priority = Number(isSecondExact) - Number(isFirstExact)
    return priority
  })
  for (const interval of orderedChordIntervals) {
    const isRoot = interval === 0
    if (isRoot) continue
    const degree = getNearestDegree(interval, scaleIntervals, true)
    const isAssigned = assignedDegrees.has(degree)
    if (isAssigned) continue
    targetIntervals[degree] = interval
    assignedDegrees.add(degree)
  }
  const hasThird = chordIntervals.includes(3) || chordIntervals.includes(4)
  const hasSuspendedFourth = chordIntervals.includes(5)
  const hasSuspendedSecond = chordIntervals.includes(2)
  const shouldSuspend = !hasThird && (hasSuspendedFourth || hasSuspendedSecond)
  if (shouldSuspend) {
    const thirdDegree = getNearestDegree(4, scaleIntervals)
    const suspendedInterval = hasSuspendedFourth ? 5 : 2
    targetIntervals[thirdDegree] = suspendedInterval
  }
  const isDiminishedSeventh = chordIntervals.includes(3) && chordIntervals.includes(6) && chordIntervals.includes(9)
  if (isDiminishedSeventh) {
    const seventhDegree = getNearestDegree(11, scaleIntervals)
    targetIntervals[seventhDegree] = 9
  }
  return targetIntervals
}

export const getPerformanceHarmony = (input: HarmonyInputT): PerformanceHarmonyT => {
  const chordPitches = getChordPitches(input.midiNotes)
  const rootPitch = getChordRoot(input, chordPitches)
  const tonicPitch = pitch.getNotePitch(input.key)
  const definition = catalog.getScaleDefinition(input.scale)
  const sourceIntervals = catalog.getDefinitionIntervals(definition.formula)
  const rootInterval = pitch.getPitchClass(rootPitch - tonicPitch)
  const rotatedIntervals = getRotatedIntervals(sourceIntervals, rootInterval)
  const chordIntervals = chordPitches.map((chordPitch) => {
    return pitch.getPitchClass(chordPitch - rootPitch)
  })
  const targetIntervals = getHarmonicIntervals(rotatedIntervals, chordIntervals)
  const isMinor = chordIntervals.includes(3) && !chordIntervals.includes(4)
  return { rootPitch, tonicPitch, sourceIntervals, targetIntervals, isMinor }
}

export const mapHarmonyNote = (midiNote: number, harmony: PerformanceHarmonyT): number => {
  const relativeNote = midiNote - harmony.tonicPitch
  const sourceInterval = pitch.getPitchClass(relativeNote)
  const degree = getNearestDegree(sourceInterval, harmony.sourceIntervals)
  const scaleInterval = validation.getRequiredEntry(harmony.sourceIntervals, degree)
  const targetInterval = validation.getRequiredEntry(harmony.targetIntervals, degree)
  const chromaticOffset = sourceInterval - scaleInterval
  const octaveBase = relativeNote - sourceInterval
  const mappedNote = octaveBase + harmony.rootPitch + targetInterval + chromaticOffset
  return mappedNote
}

import performanceContexts from './data/performanceContexts.json'
import performanceTemplates from './data/performances.json'
import type * as recovered from './recoveredTypes.js'
import * as scaleMapping from './scalerScaleMapping.js'
import * as catalog from './catalog.js'
import * as pitch from './pitch.js'
import * as validation from './validation.js'

export type GetScalePerformanceInputT = {
  readonly template: recovered.RecoveredPerformanceTemplateT
  readonly midiNotes: readonly number[]
  readonly key: string
  readonly scale: string
  readonly octave: number
}

export type ScalePerformanceT = {
  readonly template: recovered.RecoveredPerformanceTemplateT
  readonly midiNotes: readonly (number | undefined)[]
}

type SourceContextT = { readonly tonicPitch: number; readonly scaleName: string }

const checkMinorScale = (name: string): boolean => {
  const definition = catalog.getScaleDefinition(name)
  const third = definition.formula.find((interval) => {
    return interval.includes('3')
  })
  return third === 'b3'
}

const getMinorVariant = (input: GetScalePerformanceInputT): recovered.RecoveredPerformanceTemplateT => {
  const isMinor = checkMinorScale(input.scale)
  if (!isMinor) return input.template
  const isAvantGarde = input.template.category === 'Phrases' && input.template.subcategory === 'Avant Garde'
  const isBassVariant = input.template.category === 'Bass' && ['Melodic Bass', 'Sidechain Bass', 'Triplet Bass'].includes(input.template.subcategory)
  const shouldSelectMinor = isAvantGarde || isBassVariant
  if (!shouldSelectMinor) return input.template
  const variantName = `${input.template.name}_minor`
  const variant = performanceTemplates.find((candidate) => {
    const hasCategory = candidate.category === input.template.category
    const hasSubcategory = candidate.subcategory === input.template.subcategory
    const hasName = candidate.name === variantName
    return hasCategory && hasSubcategory && hasName
  })
  return variant ?? input.template
}

const getSourceContext = (input: GetScalePerformanceInputT, template: recovered.RecoveredPerformanceTemplateT): SourceContextT => {
  const isVariant = template.id !== input.template.id
  if (isVariant) {
    const isPhrase = template.category === 'Phrases'
    const tonicPitch = isPhrase ? 9 : 0
    return { tonicPitch, scaleName: 'Minor scale' }
  }
  const source = performanceContexts.find((context) => {
    return context.id === template.id
  })
  const isMissing = source === undefined
  if (isMissing) throw new Error(`Missing source performance context: ${template.name}`)
  return source
}

const getRegisterShift = (input: GetScalePerformanceInputT, mappedNotes: readonly number[], template: recovered.RecoveredPerformanceTemplateT): number => {
  const firstNote = validation.getRequiredEntry(mappedNotes, 0)
  const targetPitch = pitch.getNotePitch(input.key)
  const rootNote = (input.octave + 1) * 12 + targetPitch
  const sourceOctaveShift = Math.floor((rootNote - firstNote) / 12) * 12
  const isMelody = template.category === 'Melody'
  const melodyShift = isMelody ? 12 : 0
  const shouldLowerBass = template.category === 'Bass' && targetPitch >= 5
  const bassShift = shouldLowerBass ? -12 : 0
  const templateShift = template.octaveDifference * 12
  const registerShift = sourceOctaveShift + melodyShift + bassShift + templateShift
  return registerShift
}

const getAllowedPitchCount = (input: GetScalePerformanceInputT, template: recovered.RecoveredPerformanceTemplateT): number => {
  const isSequence = template.category === 'Sequences'
  if (isSequence) return 128
  const uniquePitches = new Set<number>()
  for (const midiNote of input.midiNotes) {
    const notePitch = midiNote % 12
    uniquePitches.add(notePitch)
  }
  const isSinglePitch = uniquePitches.size === 1
  if (isSinglePitch) return 2
  return uniquePitches.size
}

// Scale mapping can compact duplicate reference pitches.
// Missing source indices stay unresolved; native reads
// beyond the compacted vector are not valid MIDI input.
export const getScalePerformance = (input: GetScalePerformanceInputT): ScalePerformanceT => {
  const supportedCategories = ['Bass', 'Melody', 'Phrases', 'Sequences']
  const isSupported = supportedCategories.includes(input.template.category)
  if (!isSupported) throw new Error('Scale performance adaptation requires Bass, Melody, Phrases or Sequences')
  const template = getMinorVariant(input)
  const source = getSourceContext(input, template)
  const sourceKey = pitch.getPitchName(source.tonicPitch)
  const mappedNotes = scaleMapping.mapScaleNotes({ midiNotes: template.referenceMidiNotes, sourceKey, sourceScale: source.scaleName, targetKey: input.key, targetScale: input.scale })
  const hasNoMappedNotes = mappedNotes.length === 0
  if (hasNoMappedNotes) return { template, midiNotes: [] }
  const registerShift = getRegisterShift(input, mappedNotes, template)
  const allowedPitchCount = getAllowedPitchCount(input, template)
  const shouldFilterPitches = allowedPitchCount < 3
  const firstPitches = mappedNotes.slice(0, allowedPitchCount).map((midiNote) => {
    return midiNote % 12
  })
  const midiNotes = mappedNotes.map((midiNote): number | undefined => {
    const notePitch = midiNote % 12
    const shouldDrop = shouldFilterPitches && !firstPitches.includes(notePitch)
    if (shouldDrop) return undefined
    const shiftedNote = midiNote + registerShift
    const boundedNote = Math.max(0, Math.min(127, shiftedNote))
    return boundedNote
  })
  return { template, midiNotes }
}

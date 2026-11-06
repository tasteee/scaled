import scaleMapping from './data/scaleMapping.json'
import * as catalog from './catalog.js'
import * as pitch from './pitch.js'
import * as validation from './validation.js'

export type MapScaleNotesInputT = {
  readonly midiNotes: readonly number[]
  readonly sourceKey: string
  readonly sourceScale: string
  readonly targetKey: string
  readonly targetScale: string
  readonly shouldPreserveNearestRegister?: boolean
}

type MappingContextT = {
  readonly sourcePitch: number
  readonly targetPitch: number
  readonly registerOffset: number
  readonly mapping: readonly (number | null)[]
  readonly negativeMapping: readonly (number | null)[]
}

const getScaleIndex = (name: string): number => {
  const definition = catalog.getScaleDefinition(name)
  const index = scaleMapping.scaleNames.indexOf(definition.name)
  const isMissing = index < 0
  if (isMissing) throw new Error(`Missing native scale mapping: ${name}`)
  return index
}

const getRegisterOffset = (input: MapScaleNotesInputT, sourcePitch: number, targetPitch: number): number => {
  const shouldPreserveRegister = input.shouldPreserveNearestRegister === true
  if (!shouldPreserveRegister) return 0
  const distance = targetPitch - sourcePitch
  const shouldRaiseOctave = distance < -6
  if (shouldRaiseOctave) return 12
  const shouldLowerOctave = distance > 6
  if (shouldLowerOctave) return -12
  return 0
}

const getMappingContext = (input: MapScaleNotesInputT): MappingContextT => {
  const sourcePitch = pitch.getNotePitch(input.sourceKey)
  const targetPitch = pitch.getNotePitch(input.targetKey)
  const sourceIndex = getScaleIndex(input.sourceScale)
  const targetIndex = getScaleIndex(input.targetScale)
  const targets = validation.getRequiredEntry(scaleMapping.mappings, sourceIndex)
  const mapping = validation.getRequiredEntry(targets, targetIndex)
  const negativeTargets = validation.getRequiredEntry(scaleMapping.negativeMappings, sourceIndex)
  const negativeMapping = validation.getRequiredEntry(negativeTargets, targetIndex)
  const registerOffset = getRegisterOffset(input, sourcePitch, targetPitch)
  return { sourcePitch, targetPitch, registerOffset, mapping, negativeMapping }
}

const mapNote = (midiNote: number, context: MappingContextT): number | undefined => {
  validation.validateMidiNote(midiNote)
  const relativeNote = midiNote - context.sourcePitch
  const isBelowSourceTonic = relativeNote < 0
  if (isBelowSourceTonic) {
    const negativePosition = relativeNote + 11
    const mappedRelativeNote = validation.getRequiredEntry(context.negativeMapping, negativePosition)
    const shouldDropNote = mappedRelativeNote === null
    if (shouldDropNote) return undefined
    const mappedNote = mappedRelativeNote + context.targetPitch + context.registerOffset
    validation.validateMidiNote(mappedNote)
    return mappedNote
  }
  const relativePitch = pitch.getPitchClass(relativeNote)
  const mappedPitch = validation.getRequiredEntry(context.mapping, relativePitch)
  const shouldDropNote = mappedPitch === null
  if (shouldDropNote) return undefined
  const octaveBase = relativeNote - relativePitch
  const mappedNote = octaveBase + mappedPitch + context.targetPitch + context.registerOffset
  validation.validateMidiNote(mappedNote)
  return mappedNote
}

// Captures preserve the native pitch mapping; the native
// function then sorts and removes duplicate output pitches.
export const mapScaleNotes = (input: MapScaleNotesInputT): readonly number[] => {
  const context = getMappingContext(input)
  const notes = new Set<number>()
  for (const midiNote of input.midiNotes) {
    const mappedNote = mapNote(midiNote, context)
    const hasMappedNote = mappedNote !== undefined
    if (hasMappedNote) notes.add(mappedNote)
  }
  const sortedNotes = Array.from(notes).sort((firstNote, secondNote) => {
    return firstNote - secondNote
  })
  return sortedNotes
}

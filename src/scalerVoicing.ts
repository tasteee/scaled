import voicingChordCatalog from './data/voicingChords.json'
import voicingCatalog from './data/voicings.json'
import type * as types from './types.js'
import * as catalog from './catalog.js'
import * as pitch from './pitch.js'
import * as validation from './validation.js'

export type GetScaleVoicingChordsInputT = {
  readonly presetId: string
  readonly key: string
  readonly scale: string
  readonly octave?: number
}

export type ScaleVoicingChordT = {
  readonly sourceSlot: number
  readonly presetId: string
  readonly presetName: string
  readonly chord: types.ChordT | null
}

type CapturedScaleT = {
  readonly name: string
  readonly notes: readonly (readonly number[])[]
  readonly identities: readonly (readonly (readonly number[])[])[]
}

type CapturedPresetT = {
  readonly nativeIdentifier: number
  readonly name: string
  readonly scales: readonly CapturedScaleT[]
}

type BuildChordInputT = {
  readonly sourceNotes: readonly number[]
  readonly identity: readonly number[]
  readonly tonicPitch: number
  readonly octave: number
}

const capturedPresets: readonly CapturedPresetT[] = voicingChordCatalog.presets

const getCapturedPreset = (identifier: string): CapturedPresetT => {
  const sourcePreset = voicingCatalog.find((preset) => {
    return preset.id === identifier
  })
  const isMissingSource = sourcePreset === undefined
  if (isMissingSource) throw new Error(`Unknown Scaler voicing preset: ${identifier}`)
  const capturedPreset = capturedPresets.find((preset) => {
    return preset.name === sourcePreset.name
  })
  const isMissingCapture = capturedPreset === undefined
  if (isMissingCapture) throw new Error(`Missing native voicing capture: ${sourcePreset.name}`)
  return capturedPreset
}

const buildCapturedChord = (input: BuildChordInputT): types.ChordT => {
  const rootPitch = validation.getRequiredEntry(input.identity, 0)
  const chordTypeIndex = validation.getRequiredEntry(input.identity, 1)
  const chordType = validation.getRequiredEntry(voicingChordCatalog.chordTypes, chordTypeIndex)
  const octaveOffset = (input.octave - voicingChordCatalog.octave) * 12
  const midiNotes = input.sourceNotes.map((note) => {
    const midiNote = note + input.tonicPitch + octaveOffset
    validation.validateMidiNote(midiNote)
    return midiNote
  })
  const rootName = pitch.getPitchName(rootPitch)
  const isMajor = chordType === 'maj'
  const suffix = isMajor ? '' : chordType
  const symbol = `${rootName}${suffix}`
  const referenceRoot = 60 + rootPitch
  const intervals = input.sourceNotes.map((note) => {
    const interval = note + input.tonicPitch - referenceRoot
    return interval
  })
  return { symbol, rootPitch, chordType, intervals, midiNotes }
}

// Native presets produce full scale-context chord sequences.
// They must not be used as arbitrary chord interval masks.
export const getScaleVoicingChords = (input: GetScaleVoicingChordsInputT): readonly ScaleVoicingChordT[] => {
  const preset = getCapturedPreset(input.presetId)
  const tonicPitch = pitch.getNotePitch(input.key)
  const scaleDefinition = catalog.getScaleDefinition(input.scale)
  const octave = input.octave ?? 4
  validation.validateInteger(octave, 'Octave')
  const scale = preset.scales.find((candidate) => {
    return candidate.name === scaleDefinition.name
  })
  const isMissingScale = scale === undefined
  if (isMissingScale) throw new Error(`Missing native voicing capture for ${input.key} ${scaleDefinition.name}`)
  const identities = validation.getRequiredEntry(scale.identities, tonicPitch)
  const chords = scale.notes.map((sourceNotes, position) => {
    const identity = validation.getRequiredEntry(identities, position)
    const chord = buildCapturedChord({ sourceNotes, identity, tonicPitch, octave })
    const sourceSlot = position + 1
    return { sourceSlot, presetId: input.presetId, presetName: preset.name, chord }
  })
  return chords
}

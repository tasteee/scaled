import type * as recovered from './recoveredTypes.js'
import * as validation from './validation.js'

export type GetGrooveMidiNotesInputT = {
  readonly template: recovered.RecoveredPerformanceTemplateT
  readonly midiNotes: readonly number[]
}

const getSortedUniqueNotes = (midiNotes: readonly number[]): number[] => {
  const uniqueNotes = Array.from(new Set(midiNotes))
  const sortedNotes = uniqueNotes.sort((firstNote, secondNote) => {
    return firstNote - secondNote
  })
  return sortedNotes
}

const getUniquePitchNotes = (midiNotes: readonly number[]): number[] => {
  const sortedNotes = getSortedUniqueNotes(midiNotes)
  const pitches = new Set<number>()
  const uniquePitchNotes: number[] = []
  for (const midiNote of sortedNotes) {
    const pitch = midiNote % 12
    const hasPitch = pitches.has(pitch)
    if (hasPitch) continue
    pitches.add(pitch)
    uniquePitchNotes.push(midiNote)
  }
  return uniquePitchNotes
}

const buildSourceOctaveGroups = (template: recovered.RecoveredPerformanceTemplateT): number[][] => {
  const firstNote = validation.getRequiredEntry(template.referenceMidiNotes, 0)
  const pitchPositions = new Map<number, number>()
  const octaveGroups: number[][] = []
  for (const referenceNote of template.referenceMidiNotes) {
    const pitch = referenceNote % 12
    const octaveOffset = Math.trunc((referenceNote - firstNote) / 12)
    const existingPosition = pitchPositions.get(pitch)
    const hasPosition = existingPosition !== undefined
    if (hasPosition) {
      const octaveGroup = validation.getRequiredEntry(octaveGroups, existingPosition)
      octaveGroup.push(octaveOffset)
      continue
    }
    pitchPositions.set(pitch, octaveGroups.length)
    octaveGroups.push([octaveOffset])
  }
  return octaveGroups
}

const appendMergedOctave = (octaveGroup: number[]): void => {
  const lastOctave = validation.getRequiredEntry(octaveGroup, octaveGroup.length - 1)
  const nextOctave = lastOctave + 1
  const canRaise = nextOctave < 9
  if (canRaise) {
    octaveGroup.push(nextOctave)
    return undefined
  }
  const firstOctave = validation.getRequiredEntry(octaveGroup, 0)
  const lowerOctave = firstOctave - 1
  const canLower = lowerOctave > -3
  if (canLower) octaveGroup.push(lowerOctave)
  return undefined
}

const getTargetOctaveGroups = (template: recovered.RecoveredPerformanceTemplateT, targetPitchCount: number): number[][] => {
  const sourceGroups = buildSourceOctaveGroups(template)
  const hasFewPitches = targetPitchCount < 3
  if (hasFewPitches) return sourceGroups.slice(0, targetPitchCount)
  const targetGroups = sourceGroups.slice(0, targetPitchCount)
  const additionalGroups = sourceGroups.slice(targetPitchCount)
  for (const groupEntry of additionalGroups.entries()) {
    const originalGroupPosition = targetPitchCount + groupEntry[0]
    const targetPosition = originalGroupPosition % targetPitchCount
    const targetGroup = validation.getRequiredEntry(targetGroups, targetPosition)
    for (const unusedOctave of groupEntry[1]) appendMergedOctave(targetGroup)
  }
  return targetGroups
}

// Reconstructs the Grooves branch of 0x1807ca940.
// Source classes retain their register repetitions;
// they do not directly index arbitrary chord voices.
export const getGrooveMidiNotes = (input: GetGrooveMidiNotesInputT): readonly number[] => {
  const isGroove = input.template.category === 'Grooves'
  if (!isGroove) throw new Error('Groove pitch adaptation requires a Grooves template')
  for (const midiNote of input.midiNotes) validation.validateMidiNote(midiNote)
  const targetNotes = getUniquePitchNotes(input.midiNotes)
  const firstTarget = validation.getRequiredEntry(targetNotes, 0)
  const baseOctave = Math.trunc(firstTarget / 12)
  const firstPitch = firstTarget % 12
  const octaveGroups = getTargetOctaveGroups(input.template, targetNotes.length)
  const expandedNotes: number[] = []
  for (const groupEntry of octaveGroups.entries()) {
    const targetNote = validation.getRequiredEntry(targetNotes, groupEntry[0])
    const targetPitch = targetNote % 12
    const shouldRaise = targetPitch < firstPitch
    const octaveRaise = shouldRaise ? 1 : 0
    const targetOctave = baseOctave + octaveRaise
    for (const octaveOffset of groupEntry[1]) {
      const expandedNote = targetPitch + (targetOctave + octaveOffset) * 12
      const isValidNote = expandedNote >= 0 && expandedNote < 128
      if (isValidNote) expandedNotes.push(expandedNote)
    }
  }
  const sortedNotes = expandedNotes.sort((firstNote, secondNote) => {
    return firstNote - secondNote
  })
  // Native counts pitch buckets but indexes note entries.
  // Repeated references therefore occupy voice positions.
  const uniqueNoteCount = new Set(sortedNotes).size
  const indexedNotes = sortedNotes.slice(0, uniqueNoteCount)
  const registerShift = (input.template.octaveDifference + 1) * 12
  const shiftedNotes = indexedNotes.map((midiNote) => {
    const shiftedNote = midiNote + registerShift
    const boundedNote = Math.max(0, Math.min(127, shiftedNote))
    return boundedNote
  })
  return shiftedNotes
}

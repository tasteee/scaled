import type * as types from './types.js'
import * as chords from './chords.js'
import * as validation from './validation.js'

export type TimelineChordT = {
  readonly id: string
  readonly chord: types.ChordT
  readonly startBeat: number
  readonly endBeat: number
}

export const buildTimeline = (progression: readonly types.ProgressionChordT[], octave: number): readonly TimelineChordT[] => {
  const cursor = { endBeat: 0 }
  const timeline = progression.map((entry, position) => {
    const startBeat = entry.startBeat ?? cursor.endBeat
    validation.validateNonnegativeNumber(startBeat, 'Chord startBeat')
    validation.validatePositiveNumber(entry.durationBeats, 'Chord durationBeats')
    const hasOverlap = startBeat < cursor.endBeat
    if (hasOverlap) throw new Error('Progression chords must be chronological and must not overlap')
    const endBeat = startBeat + entry.durationBeats
    validation.validateFiniteNumber(endBeat, 'Chord endBeat')
    const chord = chords.getChord({ chord: entry.chord, octave }, octave)
    const id = entry.id ?? `chord-${position}`
    cursor.endBeat = endBeat
    return { id, chord, startBeat, endBeat }
  })
  return timeline
}

export const getActiveChord = (timeline: readonly TimelineChordT[], startBeat: number): TimelineChordT | undefined => {
  const activeChord = timeline.find((entry) => {
    const isAfterStart = startBeat >= entry.startBeat
    const isBeforeEnd = startBeat < entry.endBeat
    return isAfterStart && isBeforeEnd
  })
  return activeChord
}

import * as types from './types.js'
import * as chords from './chords.js'
import * as pitch from './pitch.js'
import * as validation from './validation.js'

const getSortedNotes = (notes: readonly number[]): number[] => {
  const sortedNotes = [...notes].sort((firstNote, secondNote) => {
    return firstNote - secondNote
  })
  return sortedNotes
}

const getClosedNotes = (chord: types.ChordT): readonly number[] => {
  const lowestNote = validation.getRequiredEntry(chord.midiNotes, 0)
  const rootOctave = Math.floor(lowestNote / 12)
  const rootMidiNote = rootOctave * 12 + chord.rootPitch
  const notes = chord.intervals.map((interval) => {
    const pitchOffset = pitch.getPitchClass(interval)
    const midiNote = rootMidiNote + pitchOffset
    return midiNote
  })
  const sortedNotes = getSortedNotes(notes)
  return sortedNotes
}

// Move rotated bass notes above the remaining notes,
// including chords whose original span exceeds an octave.
const getInvertedNotes = (notes: readonly number[], inversion: number): readonly number[] => {
  const sortedNotes = getSortedNotes(notes)
  const noteCount = sortedNotes.length
  const rotation = ((inversion % noteCount) + noteCount) % noteCount
  const octaveShift = Math.floor(inversion / noteCount) * 12
  const remainingNotes = sortedNotes.slice(rotation)
  const movedNotes = sortedNotes.slice(0, rotation)
  const highestNote = validation.getRequiredEntry(sortedNotes, noteCount - 1)
  const raisedNotes = movedNotes.map((midiNote) => {
    const distanceAboveHighest = highestNote - midiNote + 1
    const octavesToRaise = Math.ceil(distanceAboveHighest / 12)
    const raisedNote = midiNote + octavesToRaise * 12
    return raisedNote
  })
  const rotatedNotes = remainingNotes.concat(raisedNotes)
  const invertedNotes = rotatedNotes.map((midiNote) => {
    const shiftedNote = midiNote + octaveShift
    return shiftedNote
  })
  const orderedNotes = getSortedNotes(invertedNotes)
  return orderedNotes
}

const getOpenNotes = (notes: readonly number[]): readonly number[] => {
  const openNotes = notes.map((midiNote, position) => {
    const shouldRaise = position % 2 === 1
    const octaveShift = shouldRaise ? 12 : 0
    const raisedNote = midiNote + octaveShift
    return raisedNote
  })
  const sortedNotes = getSortedNotes(openNotes)
  return sortedNotes
}

const getDropTwoNotes = (notes: readonly number[]): readonly number[] => {
  const hasEnoughNotes = notes.length >= 4
  if (!hasEnoughNotes) throw new Error('Drop-2 voicing requires at least four notes')
  const dropPosition = notes.length - 2
  const droppedNotes = notes.map((midiNote, position) => {
    const shouldDrop = position === dropPosition
    const octaveShift = shouldDrop ? -12 : 0
    const droppedNote = midiNote + octaveShift
    return droppedNote
  })
  const sortedNotes = getSortedNotes(droppedNotes)
  return sortedNotes
}


// Lower the notes sitting at the given positions (counted down from the highest note) by an octave.
const getDroppedNotes = (notes: readonly number[], positionsFromTop: readonly number[], voicing: types.VoicingNameT): readonly number[] => {
  const minimumNotes = types.voicingMinimumNotes[voicing] ?? 0
  const hasEnoughNotes = notes.length >= minimumNotes
  if (!hasEnoughNotes) throw new Error(`${voicing} voicing requires at least ${minimumNotes} notes`)
  const droppedNotes = notes.map((midiNote, position) => {
    const positionFromTop = notes.length - position
    const shouldDrop = positionsFromTop.includes(positionFromTop)
    const octaveShift = shouldDrop ? -12 : 0
    return midiNote + octaveShift
  })
  const sortedNotes = getSortedNotes(droppedNotes)
  return sortedNotes
}

// Upper notes are pushed up in pairs: one octave, one octave, two octaves, two octaves...
const getSpreadNotes = (notes: readonly number[]): readonly number[] => {
  const spreadNotes = notes.map((midiNote, position) => midiNote + Math.floor((position + 1) / 2) * 12)
  return spreadNotes
}

// Root, third and seventh only: the notes that define the chord.
const getShellNotes = (notes: readonly number[]): readonly number[] => {
  const minimumNotes = types.voicingMinimumNotes.shell ?? 2
  if (notes.length < minimumNotes) throw new Error(`shell voicing requires at least ${minimumNotes} notes`)
  const hasSeventh = notes.length >= 4
  const shellNotes = hasSeventh ? [notes[0], notes[1], notes[3]] : [notes[0], notes[1]]
  return shellNotes.filter((midiNote): midiNote is number => midiNote !== undefined)
}

const getSpacedNotes = (notes: readonly number[], voicing: types.VoicingNameT): readonly number[] => {
  if (voicing === 'open') return getOpenNotes(notes)
  if (voicing === 'drop2') return getDropTwoNotes(notes)
  if (voicing === 'drop3') return getDroppedNotes(notes, [3], voicing)
  if (voicing === 'drop4') return getDroppedNotes(notes, [4], voicing)
  if (voicing === 'drop2and3') return getDroppedNotes(notes, [2, 3], voicing)
  if (voicing === 'drop2and4') return getDroppedNotes(notes, [2, 4], voicing)
  if (voicing === 'spread') return getSpreadNotes(notes)
  if (voicing === 'shell') return getShellNotes(notes)
  return notes
}

const getAverage = (notes: readonly number[]): number => {
  const total = notes.reduce((sum, midiNote) => sum + midiNote, 0)
  return total / notes.length
}

type DynamicResultT = { readonly notes: readonly number[]; readonly inversion: number }

// Try every inversion, an octave down, in place and an octave up. Keep the one
// closest to the previous chord, or closest to a comfortable middle range.
const getDynamicNotes = (chord: types.ChordT, previousNotes: readonly number[] | undefined): DynamicResultT => {
  const closedNotes = getClosedNotes(chord)
  const lowestNote = validation.getRequiredEntry(closedNotes, 0)
  const octaveBase = Math.floor(lowestNote / 12) * 12
  const hasPrevious = previousNotes !== undefined && previousNotes.length > 0
  const targetCenter = hasPrevious ? getAverage(previousNotes) : octaveBase + 5
  const best = { notes: closedNotes, inversion: 0, cost: Number.POSITIVE_INFINITY }
  for (let inversion = 0; inversion < closedNotes.length; inversion++) {
    const invertedNotes = getInvertedNotes(closedNotes, inversion)
    for (const shift of [-12, 0, 12]) {
      const shiftedNotes = invertedNotes.map((midiNote) => midiNote + shift)
      const isPlayable = shiftedNotes.every((midiNote) => midiNote >= 0 && midiNote <= 127)
      if (!isPlayable) continue
      const distance = Math.abs(getAverage(shiftedNotes) - targetCenter)
      const cost = distance + Math.abs(shift) * 0.001 + inversion * 0.0001
      const isBetter = cost < best.cost
      if (isBetter) {
        best.notes = shiftedNotes
        best.inversion = inversion
        best.cost = cost
      }
    }
  }
  return { notes: best.notes, inversion: best.inversion }
}

// Anchor the chord with its root, in the nearest octave below the lowest note.
const addBassNote = (chord: types.ChordT, notes: readonly number[]): readonly number[] => {
  const lowestNote = validation.getRequiredEntry(notes, 0)
  const stepsAboveRoot = pitch.getPitchClass(lowestNote - chord.rootPitch)
  const bassNote = lowestNote - (stepsAboveRoot === 0 ? 12 : stepsAboveRoot)
  return [bassNote, ...notes]
}

const guitarStrings = [40, 45, 50, 55, 59, 64] as const
const guitarWindowSize = 4
const guitarLastWindowStart = 9
const guitarShapeCache = new Map<string, readonly number[]>()

type GuitarShapeT = { readonly notes: readonly number[]; readonly cost: number }

// Pitch classes a guitar shape must contain. The perfect fifth may be left out,
// and very large chords keep only the notes that define them.
const getGuitarRequiredPitches = (chord: types.ChordT, pitches: readonly number[]): readonly number[] => {
  const hasPerfectFifth = chord.intervals.includes(7)
  const fifthPitch = pitch.getPitchClass(chord.rootPitch + 7)
  const hasRoomForAll = pitches.length <= 5
  if (hasRoomForAll) return pitches.filter((pitchClass) => !(hasPerfectFifth && pitchClass === fifthPitch))
  const hasThird = chord.intervals.some((interval) => interval === 3 || interval === 4)
  const steps = hasThird ? [0, 3, 4, 10, 11] : [0, 2, 3, 4, 5, 10, 11]
  const essentials = pitches.filter((pitchClass) => steps.includes(pitch.getPitchClass(pitchClass - chord.rootPitch)))
  return essentials
}

const searchGuitarShape = (chord: types.ChordT, inversion: number): readonly number[] => {
  const pitches = [...new Set(chord.intervals.map((interval) => pitch.getPitchClass(chord.rootPitch + interval)))]
  const required = getGuitarRequiredPitches(chord, pitches)
  const noteCount = chord.intervals.length
  const bassIndex = ((inversion % noteCount) + noteCount) % noteCount
  const bassPitch = pitch.getPitchClass(chord.rootPitch + validation.getRequiredEntry(chord.intervals, bassIndex))
  const minimumStrings = Math.min(4, required.length)
  const best: { shape: GuitarShapeT | null } = { shape: null }

  for (let windowStart = 0; windowStart <= guitarLastWindowStart; windowStart++) {
    const lowestFret = Math.max(windowStart, 1)
    const highestFret = windowStart + guitarWindowSize - 1
    const fretOptions = [0]
    for (let fret = lowestFret; fret <= highestFret; fret++) fretOptions.push(fret)
    for (let firstString = 0; firstString <= guitarStrings.length - minimumStrings; firstString++) {
      const frets: number[] = []
      const visit = (stringIndex: number) => {
        const isDone = stringIndex === guitarStrings.length
        if (isDone) {
          const played = frets.map((fret, offset) => guitarStrings[firstString + offset]! + fret)
          const playedPitches = played.map((midiNote) => pitch.getPitchClass(midiNote))
          const hasBass = playedPitches[0] === bassPitch
          const coversRequired = required.every((pitchClass) => playedPitches.includes(pitchClass))
          const hasDuplicates = new Set(played).size !== played.length
          const isValid = hasBass && coversRequired && !hasDuplicates && played.length >= minimumStrings
          if (!isValid) return
          const missing = pitches.filter((pitchClass) => !playedPitches.includes(pitchClass)).length
          const fretted = frets.filter((fret) => fret > 0)
          const span = fretted.length > 0 ? Math.max(...fretted) - Math.min(...fretted) : 0
          const clashes = played.filter((midiNote, offset) => offset > 0 && midiNote - played[offset - 1]! === 1).length
          const cost = missing * 50 + clashes * 30 - played.length * 40 + windowStart * 8 + span * 2
          const isBetter = best.shape === null || cost < best.shape.cost
          if (isBetter) best.shape = { notes: played, cost }
          return
        }
        const openNote = guitarStrings[stringIndex]!
        for (const fret of fretOptions) {
          const pitchClass = pitch.getPitchClass(openNote + fret)
          if (!pitches.includes(pitchClass)) continue
          frets.push(fret)
          visit(stringIndex + 1)
          frets.pop()
        }
      }
      visit(firstString)
    }
  }

  const found = best.shape
  if (found === null) throw new RangeError(`No guitar voicing found for ${chord.symbol}`)
  return getSortedNotes(found.notes)
}

// Notes of a playable 6-string guitar shape in standard tuning.
// Independent of the engine octave: guitar range is fixed by the instrument.
const getGuitarNotes = (chord: types.ChordT, inversion: number): readonly number[] => {
  const cacheKey = `${chord.rootPitch}|${chord.intervals.join(',')}|${inversion}`
  const cached = guitarShapeCache.get(cacheKey)
  if (cached) return cached
  const shape = searchGuitarShape(chord, inversion)
  guitarShapeCache.set(cacheKey, shape)
  return shape
}

type VoicedResultT = { readonly notes: readonly number[]; readonly inversion: number }

const getVoicedResult = (chord: types.ChordT, input: types.GetChordWithVoicingInputT): VoicedResultT => {
  const voicing = input.voicing ?? 'rootPosition'
  const inversion = input.inversion ?? 0
  validation.validateInteger(inversion, 'Inversion')
  if (voicing === 'guitar') return { notes: getGuitarNotes(chord, inversion), inversion }
  const isDynamic = voicing === 'dynamic' || voicing === 'dynamicBass'
  if (isDynamic) {
    const dynamic = getDynamicNotes(chord, input.previousMidiNotes)
    const notes = voicing === 'dynamicBass' ? addBassNote(chord, dynamic.notes) : dynamic.notes
    return { notes, inversion: dynamic.inversion }
  }
  const shouldClose = voicing !== 'rootPosition'
  const baseNotes = shouldClose ? getClosedNotes(chord) : chord.midiNotes
  const invertedNotes = getInvertedNotes(baseNotes, inversion)
  return { notes: getSpacedNotes(invertedNotes, voicing), inversion }
}

export const getChordWithVoicing = (input: types.GetChordWithVoicingInputT, defaultOctave: number): types.VoicedChordT => {
  const chord = chords.getChord(input, defaultOctave)
  const voicing = input.voicing ?? 'rootPosition'
  const result = getVoicedResult(chord, input)
  for (const midiNote of result.notes) validation.validateMidiNote(midiNote)
  return { ...chord, midiNotes: result.notes, voicing, inversion: result.inversion }
}

// Voices chords in order. Dynamic voicings follow the chord before them.
export const getProgressionWithVoicing = (inputs: readonly types.GetChordWithVoicingInputT[], defaultOctave: number): readonly types.VoicedChordT[] => {
  const voicedChords: types.VoicedChordT[] = []
  let previousNotes: readonly number[] | undefined
  for (const input of inputs) {
    const chainedInput = previousNotes ? { previousMidiNotes: previousNotes, ...input } : input
    const voicedChord = getChordWithVoicing(chainedInput, defaultOctave)
    voicedChords.push(voicedChord)
    previousNotes = voicedChord.voicing === 'dynamicBass' ? voicedChord.midiNotes.slice(1) : voicedChord.midiNotes
  }
  return voicedChords
}

import { scaled } from '@tasteee/scaled'
import type { ScaledT } from '@tasteee/scaled/types'
import * as model from './model'
import * as store from './store'
import * as piano from '../piano'

export const resolveVoicing = (value: string): ScaledT.VoicingNameT => {
  const isClosed = value === 'closed'
  if (isClosed) return 'closed'
  const isOpen = value === 'open'
  if (isOpen) return 'open'
  const isDropTwo = value === 'drop2'
  if (isDropTwo) return 'drop2'
  const isStandard = value === 'rootPosition'
  if (isStandard) return 'rootPosition'
  throw new Error('Source voicing adaptation is not yet verified.')
}

// Keep the requested chord tones in a preset's captured register.
const getAdaptedPresetChord = (baseChord: ScaledT.ChordT, referenceChord: ScaledT.ChordT): ScaledT.ChordT => {
  const referenceNotes = [...referenceChord.midiNotes].sort((firstNote, secondNote) => {
    return firstNote - secondNote
  })
  const hasNoReferenceNotes = referenceNotes.length === 0
  if (hasNoReferenceNotes) throw new Error('Scale voicing has no notes')
  const rootShift = baseChord.rootPitch - referenceChord.rootPitch
  const referenceBass = referenceNotes[0]
  if (referenceBass === undefined) throw new Error('Scale voicing has no bass note')
  const bassInterval = (referenceBass - referenceChord.rootPitch + 12) % 12
  const desiredBassPitch = (baseChord.rootPitch + bassInterval) % 12
  const desiredBassPosition = baseChord.midiNotes.findIndex((midiNote) => {
    const hasMatchingPitch = midiNote % 12 === desiredBassPitch
    return hasMatchingPitch
  })
  const bassPosition = desiredBassPosition < 0 ? 0 : desiredBassPosition
  const adaptedNotes: number[] = []
  for (const position of baseChord.midiNotes.keys()) {
    const targetPosition = (bassPosition + position) % baseChord.midiNotes.length
    const targetNote = baseChord.midiNotes[targetPosition]
    if (targetNote === undefined) throw new Error('Chord has no note at this position')
    const referencePosition = position % referenceNotes.length
    const referenceCycle = Math.floor(position / referenceNotes.length)
    const sourceNote = referenceNotes[referencePosition]
    if (sourceNote === undefined) throw new Error('Scale voicing has no note at this position')
    const targetReference = sourceNote + rootShift + referenceCycle * 12
    const targetPitch = targetNote % 12
    const nearestOctave = Math.round((targetReference - targetPitch) / 12)
    const candidateNote = nearestOctave * 12 + targetPitch
    const previousNote = adaptedNotes.at(-1)
    let octaveCorrection = 0
    if (previousNote !== undefined) {
      const minimumShift = previousNote + 1 - candidateNote
      const octavesToRaise = Math.max(0, Math.ceil(minimumShift / 12))
      octaveCorrection = octavesToRaise * 12
    }
    const adaptedNote = candidateNote + octaveCorrection
    adaptedNotes.push(adaptedNote)
  }
  return { ...baseChord, midiNotes: adaptedNotes }
}

export const getVoicedChord = (entry: model.EntryT, session: model.SessionT): ScaledT.ChordT => {
  const shouldInherit = entry.voicing === 'inherit'
  const selectedVoicing = shouldInherit ? session.voicing : entry.voicing
  const octave = session.octave + entry.octaveOffset
  const hasSourceVoicing = model.isSourceVoicing(selectedVoicing)
  if (hasSourceVoicing) {
    const shapes = scaled.getScaleVoicingChords({ presetId: selectedVoicing, key: session.key, scale: session.scale, octave })
    const baseChord = scaled.getChord({ chord: entry.symbol, octave })
    const matchingShapes = shapes.filter((candidate) => {
      const hasMatchingChord = candidate.chord?.symbol === baseChord.symbol
      return hasMatchingChord
    })
    const selectedShape = matchingShapes.find((candidate) => {
      const isSelectedSlot = candidate.sourceSlot === entry.sourceSlot
      return isSelectedSlot
    })
    const shape = selectedShape ?? matchingShapes[0]
    const sourceChord = shape?.chord
    if (sourceChord) {
      const chord = scaled.getChordWithVoicing({ chord: sourceChord, inversion: entry.inversion })
      return chord
    }
    const sameRootShape = shapes.find((candidate) => {
      const hasMatchingRoot = candidate.chord?.rootPitch === baseChord.rootPitch
      return hasMatchingRoot
    })
    const firstShape = shapes.find((candidate) => {
      const hasChord = candidate.chord !== null
      return hasChord
    })
    const referenceChord = sameRootShape?.chord ?? firstShape?.chord
    if (!referenceChord) throw new Error('This scale voicing has no playable chords')
    const adaptedChord = getAdaptedPresetChord(baseChord, referenceChord)
    const chord = scaled.getChordWithVoicing({ chord: adaptedChord, inversion: entry.inversion })
    return chord
  }
  const voicing = resolveVoicing(selectedVoicing)
  const chord = scaled.getChordWithVoicing({ chord: entry.symbol, voicing, inversion: entry.inversion, octave })
  return chord
}

const getSustainedNotes = (chord: ScaledT.ChordT, entry: model.EntryT, startBeat: number): ScaledT.PerformanceNoteT[] => {
  const notes = chord.midiNotes.map((midiNote, position) => {
    const identifier = `${entry.id}:${position}`
    return { id: identifier, chordId: entry.id, eventId: identifier, midiNote, startBeat, durationBeats: entry.durationBeats, velocity: 90 }
  })
  return notes
}

export const renderProgression = async (session: model.SessionT): Promise<ScaledT.MidiClipT> => {
  const progression = session.progression.map((entry) => {
    const chord = getVoicedChord(entry, session)
    return { id: entry.id, chord, durationBeats: entry.durationBeats }
  })
  const notes: ScaledT.PerformanceNoteT[] = []
  let startBeat = 0
  for (const entry of session.progression) {
    const shouldInherit = entry.performance === 'inherit'
    const performance = shouldInherit ? session.performance : entry.performance
    const isStandard = performance === 'standard'
    const chord = getVoicedChord(entry, session)
    const chordNotes = isStandard ? getSustainedNotes(chord, entry, startBeat) : await getPerformedNotes(entry, chord, progression, performance, session)
    notes.push(...chordNotes)
    startBeat += entry.durationBeats
  }
  return { durationBeats: startBeat, notes }
}

const getPerformedNotes = async (entry: model.EntryT, chord: ScaledT.ChordT, progression: ScaledT.ProgressionChordT[], identifier: string, session: model.SessionT): Promise<readonly ScaledT.PerformanceNoteT[]> => {
  const templates = scaled.performanceTemplates
  const template = templates.find((candidate) => { return candidate.id === identifier })
  if (!template) throw new Error('Unknown performance template')
  const octave = session.octave + entry.octaveOffset
  const performance = scaled.adaptPerformanceTemplate({ template, midiNotes: chord.midiNotes, chordRootPitch: chord.rootPitch, key: session.key, scale: session.scale, octave })
  const speedMultiplier = entry.speedMultiplier ?? session.speedMultiplier
  const clip = scaled.applyPerformance({ progression, performance, speedMultiplier, key: session.key, scale: session.scale, octave })
  const notes = clip.notes.filter((note) => { return note.chordId === entry.id })
  return notes
}

export const handleRenderError = (error: unknown): void => {
  const message = error instanceof Error ? error.message : 'Unable to render the progression'
  store.session.set({ error: message })
  return undefined
}

export const playProgression = async (): Promise<void> => {
  const isPlaying = piano.audioStatus.state.isLooping
  if (isPlaying) {
    piano.stopPlayback()
    return undefined
  }
  piano.stopPlayback()
  const playbackVersion = piano.getPlaybackVersion()
  piano.audioStatus.set({ isLoading: true, isLooping: true, error: '' })
  try {
    store.session.set({ error: '' })
    const clip = await renderProgression(store.session.state)
    const wasCancelled = playbackVersion !== piano.getPlaybackVersion()
    if (wasCancelled) return undefined
    const hasNotes = clip.notes.length > 0
    if (!hasNotes) {
      piano.stopPlayback()
      return undefined
    }
    void piano.playClip(clip, store.session.state.tempo, { shouldLoop: true })
  } catch (error) {
    piano.stopPlayback()
    handleRenderError(error)
  }
  return undefined
}

let refreshToken = 0

export const refreshLivePlayback = async (): Promise<void> => {
  refreshToken += 1
  const token = refreshToken
  const playbackVersion = piano.getPlaybackVersion()
  try {
    const session = store.session.state
    const clip = await renderProgression(session)
    const isSuperseded = token !== refreshToken || playbackVersion !== piano.getPlaybackVersion()
    if (isSuperseded) return undefined
    const hasNotes = clip.notes.length > 0
    if (!hasNotes) {
      piano.stopPlayback()
      return undefined
    }
    piano.updateClip(clip, session.tempo)
  } catch (error) {
    piano.stopPlayback()
    handleRenderError(error)
  }
  return undefined
}

store.setLiveRefresh(() => { void refreshLivePlayback() })

export const previewEntry = async (entry: model.EntryT): Promise<void> => {
  piano.stopPlayback()
  const playbackVersion = piano.getPlaybackVersion()
  piano.audioStatus.set({ isLoading: true, error: '' })
  try {
    const session = store.session.state
    const previewEntry = { ...entry, durationBeats: 128 }
    const shouldUsePerformance = session.shouldPreviewPerformance
    const performance = shouldUsePerformance ? session.performance : 'standard'
    const entryPerformance = shouldUsePerformance ? entry.performance : 'standard'
    const previewChord = { ...previewEntry, performance: entryPerformance }
    const previewSession = { ...session, performance, progression: [previewChord] }
    const clip = await renderProgression(previewSession)
    const wasCancelled = playbackVersion !== piano.getPlaybackVersion()
    if (wasCancelled) return undefined
    store.session.set({ error: '' })
    void piano.playClip(clip, session.tempo)
  } catch (error) {
    piano.stopPlayback()
    handleRenderError(error)
  }
  return undefined
}

export const exportProgression = async (): Promise<void> => {
  try {
    const session = store.session.state
    const clip = await renderProgression(session)
    const bytes = scaled.exportMidi({ clip, tempo: session.tempo, ticksPerBeat: 960 })
    const fileBytes = new Uint8Array(bytes)
    const file = new Blob([fileBytes], { type: 'audio/midi' })
    const downloadUrl = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = 'scaled-progression.mid'
    link.click()
    const releaseDownload = (): void => {
      URL.revokeObjectURL(downloadUrl)
      return undefined
    }
    setTimeout(releaseDownload, 1000)
  } catch (error) {
    handleRenderError(error)
  }
  return undefined
}

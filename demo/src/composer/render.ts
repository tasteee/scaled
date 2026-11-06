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

export const getVoicedChord = (entry: model.EntryT, session: model.SessionT): ScaledT.ChordT => {
  const shouldInherit = entry.voicing === 'inherit'
  const selectedVoicing = shouldInherit ? session.voicing : entry.voicing
  const octave = session.octave + entry.octaveOffset
  const hasSourceVoicing = model.isSourceVoicing(selectedVoicing)
  if (hasSourceVoicing) {
    const shapes = scaled.getScaleVoicingChords({ presetId: selectedVoicing, key: session.key, scale: session.scale, octave })
    const baseChord = scaled.getChord({ chord: entry.symbol, octave })
    const matchingShapes = shapes.filter((candidate) => {
      const hasExplicitSlot = entry.sourceSlot !== null
      if (hasExplicitSlot) return candidate.sourceSlot === entry.sourceSlot
      const hasMatchingRoot = candidate.chord?.rootPitch === baseChord.rootPitch
      return hasMatchingRoot
    })
    const hasAmbiguousRoot = matchingShapes.length > 1 && entry.sourceSlot === null
    if (hasAmbiguousRoot) throw new Error(`This scale voicing has multiple slots for ${entry.symbol}. Add the intended slot from its grid.`)
    const shape = matchingShapes[0]
    const sourceChord = shape?.chord
    if (!sourceChord) throw new Error(`This scale voicing has no slot for ${entry.symbol}. Choose a chord from its grid or override this chord's voicing.`)
    const chord = scaled.getChordWithVoicing({ chord: sourceChord, inversion: entry.inversion })
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
  const clip = scaled.applyPerformance({ progression, performance, key: session.key, scale: session.scale, octave })
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

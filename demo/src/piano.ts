import * as sampler from 'smplr'
import * as datass from 'datass'
import type { ScaledT } from '@tasteee/scaled/types'

type PianoSessionT = { context: AudioContext; instrument: sampler.Soundfont }
type PlaybackOptionsT = { shouldLoop?: boolean }
let session: PianoSessionT | null = null
let playbackVersion = 0
let scheduleTimer: ReturnType<typeof setTimeout> | undefined
export const audioStatus = datass.datass.object({ isLoading: false, isPlaying: false, isLooping: false, isReady: false, error: '' })
export const playbackBeat = datass.datass.number(0)

export const getPlaybackVersion = (): number => {
  return playbackVersion
}

export const stopPlayback = (): void => {
  playbackVersion += 1
  clearTimeout(scheduleTimer)
  live = null
  session?.instrument.stop()
  audioStatus.set({ isPlaying: false, isLoading: false, isLooping: false })
  playbackBeat.set(0)
  return undefined
}

export const stopPreview = (): void => {
  const isLooping = audioStatus.state.isLooping
  if (isLooping) return undefined
  stopPlayback()
  return undefined
}

const getPiano = (): PianoSessionT => {
  if (session) return session
  const context = new AudioContext()
  const instrument = sampler.Soundfont(context, { instrument: 'acoustic_grand_piano', kit: 'MusyngKite' })
  session = { context, instrument }
  return session
}

const handlePianoError = (error: unknown): void => {
  session = null
  const detail = error instanceof Error ? error.message : 'Audio unavailable'
  const message = `Piano samples could not load. Check your connection and try again. ${detail}`
  audioStatus.set({ isLoading: false, isPlaying: false, isReady: false, isLooping: false, error: message })
  return undefined
}

export const warmPiano = async (): Promise<void> => {
  try {
    const piano = getPiano()
    await piano.instrument.ready
    audioStatus.set({ isReady: true })
  } catch (error) {
    handlePianoError(error)
  }
  return undefined
}

export const unlockPiano = (): void => {
  const piano = getPiano()
  void piano.context.resume().catch(handlePianoError)
  return undefined
}

type NoteT = ScaledT.MidiClipT['notes'][number]
type LiveT = {
  clip: ScaledT.MidiClipT
  notes: NoteT[]
  tempo: number
  startTime: number
  shouldLoop: boolean
  started: Map<string, () => void>
}
let live: LiveT | null = null

const sortNotes = (clip: ScaledT.MidiClipT): NoteT[] => {
  return [...clip.notes].sort((first, second) => { return first.startBeat - second.startBeat })
}

const getNoteKey = (cycle: number, note: NoteT): string => {
  return `${cycle}|${note.id ?? ''}|${note.midiNote}|${note.startBeat}|${note.durationBeats}`
}

const getKeyCycle = (key: string): number => {
  return Number(key.slice(0, key.indexOf('|')))
}

export const isLivePlaying = (): boolean => {
  return live !== null
}

/**
 * Swap the clip (and optionally tempo) of the running playback without restarting it.
 * The playhead keeps its position within the loop. Notes that are unchanged and still
 * sounding are left alone; notes that no longer exist are released; new notes that
 * should be sounding at the playhead are started.
 */
export const updateClip = (clip: ScaledT.MidiClipT, tempo?: number): boolean => {
  const current = live
  const piano = session
  if (!current || !piano) return false
  const now = piano.context.currentTime
  const oldSecondsPerBeat = 60 / current.tempo
  const nextTempo = tempo ?? current.tempo
  const elapsedBeats = Math.max(0, (now - current.startTime) / oldSecondsPerBeat)
  const oldCycle = Math.floor(elapsedBeats / current.clip.durationBeats)
  const hasDuration = clip.durationBeats > 0
  if (!hasDuration) {
    stopPlayback()
    return true
  }
  const position = (elapsedBeats % current.clip.durationBeats) % clip.durationBeats
  const nextNotes = sortNotes(clip)
  const nextKeys = new Set(nextNotes.map((note) => { return getNoteKey(0, note) }))
  const kept = new Map<string, () => void>()
  for (const [key, stop] of current.started) {
    const isCurrentCycle = getKeyCycle(key) === oldCycle
    const rekeyed = `0${key.slice(key.indexOf('|'))}`
    const isUnchanged = isCurrentCycle && nextKeys.has(rekeyed)
    if (isUnchanged) kept.set(rekeyed, stop)
    else stop()
  }
  current.clip = clip
  current.notes = nextNotes
  current.tempo = nextTempo
  current.started = kept
  current.startTime = now - position * (60 / nextTempo)
  return true
}

export const playClip = async (clip: ScaledT.MidiClipT, tempo = 120, options: PlaybackOptionsT = {}): Promise<void> => {
  stopPlayback()
  const version = playbackVersion
  const shouldLoop = options.shouldLoop === true
  audioStatus.set({ isLoading: true, isLooping: shouldLoop, error: '' })
  try {
    const piano = getPiano()
    await piano.context.resume()
    await piano.instrument.ready
    const wasCancelled = version !== playbackVersion
    if (wasCancelled) return undefined
    const hasNoDuration = clip.durationBeats <= 0
    if (hasNoDuration) return undefined
    const state: LiveT = { clip, notes: sortNotes(clip), tempo, startTime: piano.context.currentTime + 0.02, shouldLoop, started: new Map() }
    live = state
    const schedulePlayback = (): void => {
      const wasStopped = version !== playbackVersion || live !== state
      if (wasStopped) return undefined
      const secondsPerBeat = 60 / state.tempo
      const duration = state.clip.durationBeats
      const elapsed = Math.max(0, piano.context.currentTime - state.startTime)
      const elapsedBeats = elapsed / secondsPerBeat
      const currentCycle = Math.floor(elapsedBeats / duration)
      for (const [key] of state.started) {
        const isStale = getKeyCycle(key) < currentCycle - 1
        if (isStale) state.started.delete(key)
      }
      for (const cycle of new Set([Math.max(0, currentCycle - 1), currentCycle])) {
        const isOutsideClip = !state.shouldLoop && cycle > 0
        if (isOutsideClip) continue
        const cycleStartBeat = cycle * duration
        for (const note of state.notes) {
          const onset = cycleStartBeat + note.startBeat
          const isFuture = onset > elapsedBeats
          if (isFuture) break
          const remainingBeats = onset + note.durationBeats - elapsedBeats
          const key = getNoteKey(cycle, note)
          const shouldSkip = state.started.has(key) || remainingBeats <= 0
          if (shouldSkip) continue
          const stop = piano.instrument.start({ note: note.midiNote, velocity: note.velocity, duration: remainingBeats * secondsPerBeat })
          state.started.set(key, () => { stop() })
        }
      }
      playbackBeat.set(elapsedBeats % duration)
      const hasFinished = !state.shouldLoop && elapsedBeats >= duration
      if (hasFinished) {
        stopPlayback()
        return undefined
      }
      scheduleTimer = setTimeout(schedulePlayback, 10)
      return undefined
    }
    audioStatus.set({ isLoading: false, isPlaying: true, isLooping: shouldLoop, isReady: true })
    schedulePlayback()
  } catch (error) {
    const wasCancelled = version !== playbackVersion
    if (wasCancelled) return undefined
    handlePianoError(error)
  }
  return undefined
}

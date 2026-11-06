import * as sampler from 'smplr'
import * as datass from 'datass'
import type * as music from '@tasteee/scaled/types'

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

export const playClip = async (clip: music.MidiClipT, tempo = 120, options: PlaybackOptionsT = {}): Promise<void> => {
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
    const startTime = piano.context.currentTime + 0.02
    const secondsPerBeat = 60 / tempo
    const loopDuration = clip.durationBeats * secondsPerBeat
    const notes = [...clip.notes].sort((first, second) => { return first.startBeat - second.startBeat })
    let scheduledThrough = -1
    const schedulePlayback = (): void => {
      const wasStopped = version !== playbackVersion
      if (wasStopped) return undefined
      const currentTime = piano.context.currentTime
      const elapsedBeats = (currentTime - startTime) / secondsPerBeat
      const firstCycle = Math.max(0, Math.floor(scheduledThrough / clip.durationBeats))
      const lastCycle = Math.floor(elapsedBeats / clip.durationBeats)
      const cycles = new Set([firstCycle, lastCycle])
      for (const cycle of cycles) {
        const isOutsideClip = cycle < 0 || (!shouldLoop && cycle > 0)
        if (isOutsideClip) continue
        const cycleStartBeat = cycle * clip.durationBeats
        for (const note of notes) {
          const onset = cycleStartBeat + note.startBeat
          const isFuture = onset > elapsedBeats
          if (isFuture) break
          const remainingBeats = onset + note.durationBeats - elapsedBeats
          const shouldSkip = onset <= scheduledThrough || remainingBeats <= 0
          if (shouldSkip) continue
          const duration = remainingBeats * secondsPerBeat
          piano.instrument.start({ note: note.midiNote, velocity: note.velocity, duration })
        }
      }
      scheduledThrough = elapsedBeats
      const elapsed = Math.max(0, piano.context.currentTime - startTime)
      const currentBeat = elapsed / secondsPerBeat
      const beat = currentBeat % clip.durationBeats
      playbackBeat.set(beat)
      const hasFinished = !shouldLoop && elapsed >= loopDuration
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

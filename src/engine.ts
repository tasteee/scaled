import type * as types from './types.js'
import * as chords from './chords.js'
import * as catalog from './catalog.js'
import * as voicings from './voicings.js'
import * as performance from './performance.js'
import * as pitch from './pitch.js'
import * as validation from './validation.js'
import * as midiFile from './midiFile.js'
import * as timing from './timing.js'

export const createEngine = (input: types.ScaledEngineOptionsT = {}): types.ScaledEngineT => {
  const octave = input.octave ?? 4
  const velocity = input.velocity ?? 90
  pitch.getRootMidiNote(0, octave)
  validation.validateVelocity(velocity)
  const options = { octave, velocity }

  const getChord = (input: types.GetChordInputT): types.ChordT => {
    const chord = chords.getChord(input, octave)
    return chord
  }
  const getChordWithVoicing = (input: types.GetChordWithVoicingInputT): types.VoicedChordT => {
    const chord = voicings.getChordWithVoicing(input, octave)
    return chord
  }
  const getScale = (input: types.GetScaleInputT): types.ScaleT => {
    const scale = chords.getScale(input, octave)
    return scale
  }
  const getScaleChords = (input: types.GetScaleChordsInputT): readonly types.ChordT[] => {
    const scaleChords = chords.getScaleChords(input, octave)
    return scaleChords
  }
  const applyPerformance = (input: types.ApplyPerformanceInputT): types.MidiClipT => {
    const clip = performance.applyPerformance(input, options)
    return clip
  }

  return {
    ticksToBeats: timing.ticksToBeats,
    beatsToTicks: timing.beatsToTicks,
    barsToBeats: timing.barsToBeats,
    createPatternFromTicks: timing.createPatternFromTicks,
    createEngine,
    getChord,
    getChordWithVoicing,
    getScale,
    getScaleChords,
    getChordDefinitions: catalog.getChordDefinitions,
    getScaleDefinitions: catalog.getScaleDefinitions,
    applyPerformance,
    exportMidi: midiFile.exportMidi
  }
}

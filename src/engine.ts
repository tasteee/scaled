import type { ScaledT } from './types.js'
import { getChord as buildChord, getScale as buildScale, getScaleChords as findScaleChords } from './chords.js'
import { getChordDefinitions, getScaleDefinitions } from './catalog.js'
import { getChordWithVoicing as buildVoicedChord, getProgressionWithVoicing as buildVoicedProgression } from './voicings.js'
import { applyPerformance as renderPerformance } from './performance.js'
import { getRootMidiNote } from './pitch.js'
import { validateVelocity } from './validation.js'
import { exportMidi } from './midiFile.js'
import { ticksToBeats, beatsToTicks, barsToBeats, createPatternFromTicks } from './timing.js'
import { ChordFamily, voicingNames, voicingMinimumNotes } from './types.js'
import { performanceTemplates } from './base.js'
import { performanceSummaries, voicingPresets } from './baseCatalog.js'
import { getScaleVoicingChords } from './baseVoicing.js'
import { adaptPerformanceTemplate, canAdaptPerformanceTemplate } from './baseTemplate.js'
import { adaptRhythmTemplate, canAdaptRhythmTemplate } from './basePerformance.js'
import { adaptStrummedTemplate } from './baseStrummed.js'
import { getGrooveMidiNotes } from './baseGroove.js'
import { getScalePerformance } from './baseScalePerformance.js'
import { mapScaleNotes } from './baseScaleMapping.js'

export const createEngine = (input: ScaledT.ScaledEngineOptionsT = {}): ScaledT => {
  const octave = input.octave ?? 4
  const velocity = input.velocity ?? 90
  getRootMidiNote(0, octave)
  validateVelocity(velocity)
  const options = { octave, velocity }

  const getChord = (input: ScaledT.GetChordInputT): ScaledT.ChordT => {
    const chord = buildChord(input, octave)
    return chord
  }
  const getChordWithVoicing = (input: ScaledT.GetChordWithVoicingInputT): ScaledT.VoicedChordT => {
    const chord = buildVoicedChord(input, octave)
    return chord
  }
  const getProgressionWithVoicing = (inputs: readonly ScaledT.GetChordWithVoicingInputT[]): readonly ScaledT.VoicedChordT[] => {
    const voicedChords = buildVoicedProgression(inputs, octave)
    return voicedChords
  }
  const getScale = (input: ScaledT.GetScaleInputT): ScaledT.ScaleT => {
    const scale = buildScale(input, octave)
    return scale
  }
  const getScaleChords = (input: ScaledT.GetScaleChordsInputT): readonly ScaledT.ChordT[] => {
    const scaleChords = findScaleChords(input, octave)
    return scaleChords
  }
  const applyPerformance = (input: ScaledT.ApplyPerformanceInputT): ScaledT.MidiClipT => {
    const clip = renderPerformance(input, options)
    return clip
  }

  return {
    ChordFamily,
    voicingNames,
    voicingMinimumNotes,
    voicingPresets,
    performanceTemplates,
    performanceSummaries,
    getScaleVoicingChords,
    canAdaptPerformanceTemplate,
    adaptPerformanceTemplate,
    canAdaptRhythmTemplate,
    adaptRhythmTemplate,
    adaptStrummedTemplate,
    getGrooveMidiNotes,
    getScalePerformance,
    mapScaleNotes,
    ticksToBeats,
    beatsToTicks,
    barsToBeats,
    createPatternFromTicks,
    createEngine,
    getChord,
    getChordWithVoicing,
    getProgressionWithVoicing,
    getScale,
    getScaleChords,
    getChordDefinitions,
    getScaleDefinitions,
    applyPerformance,
    exportMidi
  }
}

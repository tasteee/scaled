import { scaled } from '@tasteee/scaled'
import type { ScaledT } from '@tasteee/scaled/types'

const firstChord = scaled.getChordWithVoicing({
  chord: 'Cmaj7',
  voicing: 'drop2',
  inversion: 1
})

const secondChord = scaled.getChordWithVoicing({
  chord: 'Am7',
  voicing: 'open'
})

const pattern: ScaledT.PerformancePatternT = {
  id: 'customTwoBarPattern',
  name: 'Two-bar pattern',
  durationBeats: 8,
  events: [
    {
      startBeat: 0,
      durationBeats: 1,
      velocity: 96,
      pitch: { type: 'chordTone', index: 0 }
    },
    {
      startBeat: 2,
      durationBeats: 1,
      velocity: 80,
      pitch: { type: 'chordTone', index: 1 }
    },
    {
      startBeat: 4,
      durationBeats: 1,
      velocity: 88,
      pitch: { type: 'chordTone', index: 2 }
    },
    {
      startBeat: 6,
      durationBeats: 1,
      velocity: 76,
      pitch: { type: 'chordTone', index: 3 }
    }
  ]
}

const progression = [
  { id: 'firstChord', chord: firstChord, durationBeats: 6 },
  { id: 'secondChord', chord: secondChord, durationBeats: 10 }
]

export const performedClip = scaled.applyPerformance({
  progression,
  performance: pattern
})

export const midiFile = scaled.exportMidi({ clip: performedClip, tempo: 110 })

export const independentEngine = scaled.createEngine({
  octave: 3,
  velocity: 84
})

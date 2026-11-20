import * as React from 'react'
import './ApiDocs.css'

export type ParameterDocT = {
	name: string
	type: string
	required: boolean
	default?: string
	description: string
}

export type MethodDocT = {
	id: string
	name: string
	category: 'chords' | 'scales' | 'performance' | 'timing' | 'adapters'
	categoryLabel: string
	signature: string
	summary: string
	parameters: readonly ParameterDocT[]
	returnType: string
	returnDescription: string
	codeExample: string
	returnExample: string
	callout?: {
		tone: 'primary' | 'secondary' | 'warning'
		title: string
		message: string
	}
}

export const API_METHODS: readonly MethodDocT[] = [
	{
		id: 'createEngine',
		name: 'scaled.createEngine(options?)',
		category: 'adapters',
		categoryLabel: 'Engine',
		signature: 'scaled.createEngine(options?: ScaledT.ScaledEngineOptionsT): ScaledT',
		summary: 'Creates an independent engine instance with custom defaults. Useful for maintaining separate playback configurations, such as low-register bass parts or custom velocities, without mutating the global scaled engine.',
		parameters: [
			{
				name: 'options.octave',
				type: 'number',
				required: false,
				default: '4',
				description: 'Base octave used for chord symbol expansion and scale degree mapping (Scientific pitch notation, C4 = MIDI 60).'
			},
			{
				name: 'options.velocity',
				type: 'number',
				required: false,
				default: '90',
				description: 'Default MIDI velocity (0–127) assigned to scheduled pattern notes lacking an explicit velocity.'
			}
		],
		returnType: 'ScaledT',
		returnDescription: 'A complete, isolated Scaled engine instance providing the full suite of music theory, voicing, performance, and export methods.',
		codeExample: `import { scaled } from '@tasteee/scaled'
import type { ScaledT } from '@tasteee/scaled/types'

// Instantiate an independent engine tailored for bass line generation
const bassEngine: ScaledT = scaled.createEngine({
  octave: 2,
  velocity: 80
})

// Chords expand to octave 2 by default
const chord = bassEngine.getChord({ chord: 'Am7' })
console.log(chord.midiNotes) // [45, 48, 52, 55] (A2, C3, E3, G3)`,
		returnExample: `// Returns an initialized ScaledT engine instance:
{
  createEngine: [Function],
  getChord: [Function],
  getChordWithVoicing: [Function],
  getProgressionWithVoicing: [Function],
  getScale: [Function],
  getScaleChords: [Function],
  applyPerformance: [Function],
  exportMidi: [Function],
  // ... all catalogs and timing helpers
}`,
		callout: {
			tone: 'primary',
			title: 'Independent State',
			message: 'Calling createEngine() always resets options to defaults (octave 4, velocity 90) unless explicitly overridden, even when called on a configured engine instance.'
		}
	},
	{
		id: 'getChord',
		name: 'scaled.getChord(input)',
		category: 'chords',
		categoryLabel: 'Chords',
		signature: 'scaled.getChord(input: ScaledT.GetChordInputT): ScaledT.ChordT',
		summary: 'Expands a chord symbol string or clones a supplied chord object. Computes pitch class, chord type, semitone intervals, and absolute MIDI notes in root position.',
		parameters: [
			{
				name: 'input.chord',
				type: 'string | ScaledT.ChordT',
				required: true,
				description: "Chord symbol (e.g. 'Cmaj7', 'Am', 'F#m7b5', 'Bbadd9') or an existing chord object."
			},
			{
				name: 'input.octave',
				type: 'number',
				required: false,
				default: '4',
				description: 'Root octave overriding the engine default for symbol expansion.'
			}
		],
		returnType: 'ScaledT.ChordT',
		returnDescription: 'Chord representation containing normalized symbol, root pitch class (0-11), chord type, intervals, and MIDI pitches.',
		codeExample: `import { scaled } from '@tasteee/scaled'

// Expand a 7th chord symbol at root octave 4
const chord = scaled.getChord({
  chord: 'Cmaj7',
  octave: 4
})`,
		returnExample: `{
  symbol: 'Cmaj7',
  rootPitch: 0,
  chordType: 'maj7',
  intervals: [0, 4, 7, 11],
  midiNotes: [60, 64, 67, 71] // C4, E4, G4, B4
}`
	},
	{
		id: 'getChordWithVoicing',
		name: 'scaled.getChordWithVoicing(input)',
		category: 'chords',
		categoryLabel: 'Chords & Voicings',
		signature: 'scaled.getChordWithVoicing(input: ScaledT.GetChordWithVoicingInputT): ScaledT.VoicedChordT',
		summary: 'Applies keyboard and guitar voicing techniques, including drop voicings, open/closed arrangements, spread spacing, and smooth voice-leading to chord pitches.',
		parameters: [
			{
				name: 'input.chord',
				type: 'string | ScaledT.ChordT',
				required: true,
				description: 'Chord symbol or existing chord object.'
			},
			{
				name: 'input.voicing',
				type: 'ScaledT.VoicingNameT',
				required: false,
				default: "'rootPosition'",
				description: "Voicing layout: 'rootPosition' | 'closed' | 'open' | 'dynamic' | 'dynamicBass' | 'guitar' | 'drop2' | 'drop3' | 'drop4' | 'drop2and3' | 'drop2and4' | 'spread' | 'shell'."
			},
			{
				name: 'input.inversion',
				type: 'number',
				required: false,
				default: '0',
				description: 'Inversion index applied before spacing. Supports negative integers for downward rotations.'
			},
			{
				name: 'input.previousMidiNotes',
				type: 'readonly number[]',
				required: false,
				description: "Preceding chord's MIDI notes for smooth voice leading when using 'dynamic' or 'dynamicBass'."
			},
			{
				name: 'input.octave',
				type: 'number',
				required: false,
				description: 'Root octave for symbol expansion.'
			}
		],
		returnType: 'ScaledT.VoicedChordT',
		returnDescription: 'Voiced chord object retaining original formula intervals while providing voiced MIDI notes and applied voicing metadata.',
		codeExample: `import { scaled } from '@tasteee/scaled'

// Drop-2 voicing in first inversion:
const voicedChord = scaled.getChordWithVoicing({
  chord: 'Cmaj7',
  voicing: 'drop2',
  inversion: 1,
  octave: 4
})`,
		returnExample: `{
  symbol: 'Cmaj7',
  rootPitch: 0,
  chordType: 'maj7',
  intervals: [0, 4, 7, 11],
  midiNotes: [59, 64, 67, 72], // B3, E4, G4, C5 (2nd-highest note dropped an octave)
  voicing: 'drop2',
  inversion: 1
}`,
		callout: {
			tone: 'secondary',
			title: 'Short chords',
			message: "Drop voicings move the requested voices when present; shorter chords remain playable. Shell voicings use the notes available in the chord."
		}
	},
	{
		id: 'getProgressionWithVoicing',
		name: 'scaled.getProgressionWithVoicing(inputs)',
		category: 'chords',
		categoryLabel: 'Chords & Voicings',
		signature: 'scaled.getProgressionWithVoicing(inputs: readonly ScaledT.GetChordWithVoicingInputT[]): readonly ScaledT.VoicedChordT[]',
		summary: 'Voices a sequence of chords sequentially. For voice-leading voicings like dynamic and dynamicBass, each chord automatically receives the previous chord notes as previousMidiNotes.',
		parameters: [
			{
				name: 'inputs',
				type: 'readonly ScaledT.GetChordWithVoicingInputT[]',
				required: true,
				description: 'List of chord configurations to voice in progression order.'
			}
		],
		returnType: 'readonly ScaledT.VoicedChordT[]',
		returnDescription: 'Array of voiced chord objects with minimal voice movement and smooth transitions between consecutive chords.',
		codeExample: `import { scaled } from '@tasteee/scaled'

const progression = scaled.getProgressionWithVoicing([
  { chord: 'Cmaj7', voicing: 'dynamic', octave: 4 },
  { chord: 'Am7', voicing: 'dynamic' },
  { chord: 'Dm7', voicing: 'dynamic' },
  { chord: 'G7', voicing: 'dynamic' }
])`,
		returnExample: `[
  { symbol: 'Cmaj7', voicing: 'dynamic', inversion: 0, midiNotes: [60, 64, 67, 71] },
  { symbol: 'Am7', voicing: 'dynamic', inversion: 1, midiNotes: [60, 64, 67, 69] },
  { symbol: 'Dm7', voicing: 'dynamic', inversion: 2, midiNotes: [62, 65, 69, 72] },
  { symbol: 'G7', voicing: 'dynamic', inversion: 0, midiNotes: [59, 62, 65, 67] }
]`
	},
	{
		id: 'getScale',
		name: 'scaled.getScale(input)',
		category: 'scales',
		categoryLabel: 'Scales',
		signature: 'scaled.getScale(input: ScaledT.GetScaleInputT): ScaledT.ScaleT',
		summary: 'Builds scale pitch classes, semitone formula intervals, and absolute MIDI notes for any key and catalog scale without appending a redundant closing tonic.',
		parameters: [
			{
				name: 'input.key',
				type: 'string',
				required: true,
				description: "Scale root / tonic note name (e.g. 'C', 'D#', 'Eb', 'F#', 'Bb')."
			},
			{
				name: 'input.scale',
				type: 'string',
				required: true,
				description: "Scale name or alias (e.g. 'major', 'minor', 'dorian', 'harmonicMinor', 'blues', 'lydian')."
			},
			{
				name: 'input.octave',
				type: 'number',
				required: false,
				default: '4',
				description: 'Tonic starting octave for returned MIDI pitches.'
			}
		],
		returnType: 'ScaledT.ScaleT',
		returnDescription: 'Scale structure with tonic pitch class, semitone formula intervals, scale pitch classes, and octave MIDI notes.',
		codeExample: `import { scaled } from '@tasteee/scaled'

const dorian = scaled.getScale({
  key: 'D',
  scale: 'dorian',
  octave: 3
})`,
		returnExample: `{
  key: 'D',
  name: 'D Dorian',
  tonicPitch: 2,
  intervals: [0, 2, 3, 5, 7, 9, 10],
  pitches: [2, 4, 5, 7, 9, 11, 0],
  midiNotes: [50, 52, 53, 55, 57, 59, 60] // D3 through C4
}`
	},
	{
		id: 'getScaleChords',
		name: 'scaled.getScaleChords(input)',
		category: 'scales',
		categoryLabel: 'Scales & Discovery',
		signature: 'scaled.getScaleChords(input: ScaledT.GetScaleChordsInputT): readonly ScaledT.ChordT[]',
		summary: 'Discovers every chord in the 255-chord catalog whose notes fit entirely within the given scale. Chords are ordered by scale degree, then catalog formula order.',
		parameters: [
			{
				name: 'input.key',
				type: 'string',
				required: true,
				description: "Scale key (e.g. 'C', 'F#', 'Ab')."
			},
			{
				name: 'input.scale',
				type: 'string',
				required: true,
				description: "Scale name (e.g. 'major', 'minor', 'mixolydian')."
			},
			{
				name: 'input.chordTypes',
				type: 'readonly ScaledT.ChordFamilyT[]',
				required: false,
				description: "Optional filter: 'power' | 'triad' | 'sixth' | 'seventh' | 'ninth' | 'eleventh' | 'thirteenth'. Omit to select all."
			},
			{
				name: 'input.includeSuspended',
				type: 'boolean',
				required: false,
				default: 'true',
				description: 'Whether to include suspended chords (sus2, sus4).'
			},
			{
				name: 'input.includeAddedTone',
				type: 'boolean',
				required: false,
				default: 'true',
				description: 'Whether to include added-tone chords (add9, add11).'
			},
			{
				name: 'input.octave',
				type: 'number',
				required: false,
				default: '4',
				description: 'Base octave for returned chord MIDI notes.'
			}
		],
		returnType: 'readonly ScaledT.ChordT[]',
		returnDescription: 'Array of diatonic and compatible chord objects matching the scale.',
		codeExample: `import { scaled } from '@tasteee/scaled'

// Find all compatible triads and 7ths in C Major
const diatonicChords = scaled.getScaleChords({
  key: 'C',
  scale: 'major',
  chordTypes: ['triad', 'seventh'],
  includeSuspended: false
})`,
		returnExample: `[
  { symbol: 'C', rootPitch: 0, chordType: 'maj', intervals: [0, 4, 7], midiNotes: [60, 64, 67] },
  { symbol: 'Cmaj7', rootPitch: 0, chordType: 'maj7', intervals: [0, 4, 7, 11], midiNotes: [60, 64, 67, 71] },
  { symbol: 'Dm', rootPitch: 2, chordType: 'min', intervals: [0, 3, 7], midiNotes: [62, 65, 69] },
  { symbol: 'Dm7', rootPitch: 2, chordType: 'min7', intervals: [0, 3, 7, 10], midiNotes: [62, 65, 69, 72] }
  // ... all compatible chords across all degrees
]`
	},
	{
		id: 'getScaleVoicingChords',
		name: 'scaled.getScaleVoicingChords(input)',
		category: 'scales',
		categoryLabel: 'Voicing Presets',
		signature: 'scaled.getScaleVoicingChords(input: ScaledT.GetScaleVoicingChordsInputT): readonly ScaledT.ScaleVoicingChordT[]',
		summary: 'Returns the scale-context chord sequence for one of the 14 built-in voicing presets, transposed to the target key and octave.',
		parameters: [
			{
				name: 'input.presetId',
				type: 'string',
				required: true,
				description: "Identifier from 'scaled.voicingPresets' (e.g. 'triads-root', 'seventh-open')."
			},
			{
				name: 'input.key',
				type: 'string',
				required: true,
				description: 'Target musical key.'
			},
			{
				name: 'input.scale',
				type: 'string',
				required: true,
				description: 'Target musical scale.'
			},
			{
				name: 'input.octave',
				type: 'number',
				required: false,
				default: '4',
				description: 'Target octave.'
			}
		],
		returnType: 'readonly ScaledT.ScaleVoicingChordT[]',
		returnDescription: 'Transposed preset chords with slot index, presetId, and source metadata.',
		codeExample: `import { scaled } from '@tasteee/scaled'

const preset = scaled.voicingPresets[0]
const chords = scaled.getScaleVoicingChords({
  presetId: preset.id,
  key: 'C',
  scale: 'major',
  octave: 4
})`,
		returnExample: `[
  {
    slotIndex: 0,
    presetId: 'triads-root',
    symbol: 'C',
    rootPitch: 0,
    chordType: 'maj',
    intervals: [0, 4, 7],
    midiNotes: [60, 64, 67]
  }
  // ... remaining slots in preset sequence
]`
	},
	{
		id: 'applyPerformance',
		name: 'scaled.applyPerformance(input)',
		category: 'performance',
		categoryLabel: 'Performance & MIDI',
		signature: 'scaled.applyPerformance(input: ScaledT.ApplyPerformanceInputT): ScaledT.MidiClipT',
		summary: 'Loops a performance pattern continuously across a timed chord progression. Translates pattern pitch selectors (chordTone, scaleDegree, rootOffset, midi) into absolute MIDI notes with continuous pattern phase, chord clipping, and speed scaling.',
		parameters: [
			{
				name: 'input.progression',
				type: 'readonly ScaledT.ProgressionChordT[]',
				required: true,
				description: 'Array of chords with durationBeats (in quarter-note beats).'
			},
			{
				name: 'input.performance',
				type: 'ScaledT.PerformancePatternT',
				required: true,
				description: 'Pattern containing loop durationBeats and timed note events.'
			},
			{
				name: 'input.speedMultiplier',
				type: 'number',
				required: false,
				default: '1',
				description: 'Pattern speed scale: 0.5 = half speed, 2 = double speed, 1 = normal speed.'
			},
			{
				name: 'input.key',
				type: 'string',
				required: false,
				default: "'C'",
				description: "Scale key for 'scaleDegree' pitch selectors."
			},
			{
				name: 'input.scale',
				type: 'string',
				required: false,
				default: "'major'",
				description: "Scale name for 'scaleDegree' pitch selectors."
			},
			{
				name: 'input.octave',
				type: 'number',
				required: false,
				description: 'Octave for pitch selectors.'
			}
		],
		returnType: 'ScaledT.MidiClipT',
		returnDescription: 'MidiClipT containing total duration in beats and rendered notes with onset, duration, velocity, and note IDs.',
		codeExample: `import { scaled } from '@tasteee/scaled'
import type { ScaledT } from '@tasteee/scaled/types'

// Define a simple arpeggiator pattern
const arpeggio: ScaledT.PerformancePatternT = {
  id: 'arp4',
  name: '4-note Arp',
  durationBeats: 4,
  events: [
    { startBeat: 0, durationBeats: 1, pitch: { type: 'chordTone', index: 0 } },
    { startBeat: 1, durationBeats: 1, pitch: { type: 'chordTone', index: 1 } },
    { startBeat: 2, durationBeats: 1, pitch: { type: 'chordTone', index: 2 } },
    { startBeat: 3, durationBeats: 1, pitch: { type: 'chordTone', index: 3 } }
  ]
}

const clip = scaled.applyPerformance({
  progression: [
    { chord: 'Cmaj7', durationBeats: 4 },
    { chord: 'Am7', durationBeats: 4 }
  ],
  performance: arpeggio,
  speedMultiplier: 1
})`,
		returnExample: `{
  durationBeats: 8,
  notes: [
    { id: 'arp4:0:0', midiNote: 60, startBeat: 0, durationBeats: 1, velocity: 90, chordId: 'chord-0', eventId: 'event-0' },
    { id: 'arp4:0:1', midiNote: 64, startBeat: 1, durationBeats: 1, velocity: 90, chordId: 'chord-0', eventId: 'event-1' },
    { id: 'arp4:0:2', midiNote: 67, startBeat: 2, durationBeats: 1, velocity: 90, chordId: 'chord-0', eventId: 'event-2' },
    { id: 'arp4:0:3', midiNote: 71, startBeat: 3, durationBeats: 1, velocity: 90, chordId: 'chord-0', eventId: 'event-3' },
    { id: 'arp4:1:0', midiNote: 57, startBeat: 4, durationBeats: 1, velocity: 90, chordId: 'chord-1', eventId: 'event-0' }
    // ... continues seamlessly through progression
  ]
}`,
		callout: {
			tone: 'primary',
			title: 'Continuous Pattern Phase',
			message: 'When a chord changes mid-pattern, the pattern does not reset: it maintains continuous beat phase and immediately harmonizes subsequent onsets to the active chord.'
		}
	},
	{
		id: 'exportMidi',
		name: 'scaled.exportMidi(input)',
		category: 'performance',
		categoryLabel: 'Performance & MIDI',
		signature: 'scaled.exportMidi(input: ScaledT.ExportMidiInputT): ScaledT.MidiFileT',
		summary: 'Encodes a rendered MidiClipT into a binary Type 0 Standard MIDI File (.mid) with tempo, time signature, and note events.',
		parameters: [
			{
				name: 'input.clip',
				type: 'ScaledT.MidiClipT',
				required: true,
				description: 'Rendered MIDI clip containing notes and duration in quarter-note beats.'
			},
			{
				name: 'input.tempo',
				type: 'number',
				required: false,
				default: '120',
				description: 'Tempo in beats per minute (BPM).'
			},
			{
				name: 'input.ticksPerBeat',
				type: 'number',
				required: false,
				default: '480',
				description: 'PPQ resolution (pulses per quarter note).'
			},
			{
				name: 'input.channel',
				type: 'number',
				required: false,
				default: '0',
				description: 'Zero-based MIDI channel index (0–15).'
			},
			{
				name: 'input.timeSignature',
				type: 'ScaledT.TimeSignatureT',
				required: false,
				default: '{ numerator: 4, denominator: 4 }',
				description: 'Time signature for MIDI header meta event.'
			},
			{
				name: 'input.fileName',
				type: 'string',
				required: false,
				default: "'scaled.mid'",
				description: 'Suggested file name (illegal characters stripped, .mid appended automatically).'
			}
		],
		returnType: 'ScaledT.MidiFileT',
		returnDescription: 'A Uint8Array subclass holding standard binary MIDI file data with a readonly fileName property.',
		codeExample: `import { scaled } from '@tasteee/scaled'

const midi = scaled.exportMidi({
  clip,
  tempo: 124,
  ticksPerBeat: 480,
  timeSignature: { numerator: 4, denominator: 4 },
  fileName: 'progression.mid'
})

// Trigger a browser download:
const blob = new Blob([midi], { type: 'audio/midi' })
const downloadUrl = URL.createObjectURL(blob)
const link = document.createElement('a')
link.href = downloadUrl
link.download = midi.fileName
link.click()
URL.revokeObjectURL(downloadUrl)`,
		returnExample: `// Uint8Array of binary bytes starting with 'MThd' header:
Uint8Array(428) [
  0x4D, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, ...
  fileName: "progression.mid"
]`
	},
	{
		id: 'timingHelpers',
		name: 'Timing Helpers (ticks, beats, bars)',
		category: 'timing',
		categoryLabel: 'Timing Utilities',
		signature: 'scaled.ticksToBeats(...) | scaled.beatsToTicks(...) | scaled.barsToBeats(...)',
		summary: 'High-precision mathematical timing conversions between DAW PPQ ticks, musical quarter-note beats, and measure bars.',
		parameters: [
			{
				name: 'ticksToBeats(ticks, ticksPerBeat)',
				type: 'number, number',
				required: true,
				description: 'Divides tick position by PPQ resolution without rounding.'
			},
			{
				name: 'beatsToTicks(beats, ticksPerBeat)',
				type: 'number, number',
				required: true,
				description: 'Multiplies quarter-note beats by PPQ resolution without rounding.'
			},
			{
				name: 'barsToBeats(bars, timeSignature)',
				type: 'number, ScaledT.TimeSignatureT',
				required: true,
				description: 'Computes bars × numerator × 4 / denominator.'
			}
		],
		returnType: 'number',
		returnDescription: 'Exact beat or tick value as an unrounded floating-point number.',
		codeExample: `import { scaled } from '@tasteee/scaled'

// 480 ticks at 480 PPQ -> 1.0 beat
const beat = scaled.ticksToBeats(480, 480) // 1

// 2.5 beats at 480 PPQ -> 1200 ticks
const ticks = scaled.beatsToTicks(2.5, 480) // 1200

// 2 bars of 6/8 -> 6 quarter-note beats
const beatsIn68 = scaled.barsToBeats(2, { numerator: 6, denominator: 8 }) // 6`,
		returnExample: `1
1200
6`
	},
	{
		id: 'createPatternFromTicks',
		name: 'scaled.createPatternFromTicks(input)',
		category: 'timing',
		categoryLabel: 'Timing Utilities',
		signature: 'scaled.createPatternFromTicks(input: ScaledT.TickPatternT): ScaledT.PerformancePatternT',
		summary: 'Converts a tick-based sequencer pattern into an engine-compatible beat pattern, converting start and duration ticks into quarter-note beats while preserving selectors and velocities.',
		parameters: [
			{
				name: 'input.id',
				type: 'string',
				required: true,
				description: 'Unique pattern identifier.'
			},
			{
				name: 'input.name',
				type: 'string',
				required: true,
				description: 'Display name.'
			},
			{
				name: 'input.ticksPerBeat',
				type: 'number',
				required: true,
				description: 'Tick resolution of pattern events (e.g. 480 or 960).'
			},
			{
				name: 'input.durationTicks',
				type: 'number',
				required: true,
				description: 'Loop length in ticks.'
			},
			{
				name: 'input.events',
				type: 'readonly ScaledT.TickPatternEventT[]',
				required: true,
				description: 'Events with startTick and durationTicks.'
			}
		],
		returnType: 'ScaledT.PerformancePatternT',
		returnDescription: 'Standard PerformancePatternT with beat-based timing ready for applyPerformance.',
		codeExample: `import { scaled } from '@tasteee/scaled'

const beatPattern = scaled.createPatternFromTicks({
  id: 'dawPattern',
  name: 'Imported DAW Pattern',
  ticksPerBeat: 480,
  durationTicks: 1920,
  events: [
    { startTick: 0, durationTicks: 240, pitch: { type: 'chordTone', index: 0 } },
    { startTick: 480, durationTicks: 240, pitch: { type: 'chordTone', index: 1 } }
  ]
})`,
		returnExample: `{
  id: 'dawPattern',
  name: 'Imported DAW Pattern',
  durationBeats: 4,
  events: [
    { startBeat: 0, durationBeats: 0.5, pitch: { type: 'chordTone', index: 0 } },
    { startBeat: 1, durationBeats: 0.5, pitch: { type: 'chordTone', index: 1 } }
  ]
}`
	},
	{
		id: 'adaptPerformanceTemplate',
		name: 'scaled.adaptPerformanceTemplate(input)',
		category: 'adapters',
		categoryLabel: 'Factory Adapters',
		signature: 'scaled.adaptPerformanceTemplate(input: ScaledT.AdaptPerformanceTemplateInputT): ScaledT.PerformancePatternT',
		summary: 'Shared harmonic adapter supporting all eight factory categories (Rhythms, Grooves, Bass, Melody, Passages, Phrases, Sequences, Strummed Sequences). Resolves template notes for a specific voiced chord into fixed MIDI selectors with voice-leading, scale passing tones, and velocity curves.',
		parameters: [
			{
				name: 'input.template',
				type: 'ScaledT.PerformanceTemplateT',
				required: true,
				description: "Source factory template from 'scaled.performanceTemplates'."
			},
			{
				name: 'input.midiNotes',
				type: 'readonly number[]',
				required: true,
				description: 'Non-empty array of target voiced chord MIDI notes.'
			},
			{
				name: 'input.key',
				type: 'string',
				required: true,
				description: 'Progression key.'
			},
			{
				name: 'input.scale',
				type: 'string',
				required: true,
				description: 'Progression scale.'
			},
			{
				name: 'input.octave',
				type: 'number',
				required: true,
				description: 'Progression base octave.'
			},
			{
				name: 'input.chordRootPitch',
				type: 'number',
				required: false,
				description: "Chord root pitch class (e.g. chord.rootPitch). Crucial for inversions and rootless voicings."
			}
		],
		returnType: 'ScaledT.PerformancePatternT',
		returnDescription: 'Playable beat pattern with absolute MIDI pitches harmonized to the chord.',
		codeExample: `import { scaled } from '@tasteee/scaled'

// Select a phrase template from the 1,060 factory templates
const template = scaled.performanceTemplates.find(t => t.category === 'Phrases')!
const chord = scaled.getChordWithVoicing({ chord: 'Cmaj7', voicing: 'closed' })

// Adapt template specifically to Cmaj7 in C Major
const playablePattern = scaled.adaptPerformanceTemplate({
  template,
  midiNotes: chord.midiNotes,
  chordRootPitch: chord.rootPitch,
  key: 'C',
  scale: 'major',
  octave: 4
})

const clip = scaled.applyPerformance({
  progression: [{ chord, durationBeats: 8 }],
  performance: playablePattern
})`,
		returnExample: `{
  id: 'phrases-1',
  name: 'Jazz Phrase 01',
  durationBeats: 8,
  events: [
    { startBeat: 0, durationBeats: 0.5, velocity: 88, pitch: { type: 'midi', midiNote: 60 } },
    { startBeat: 0.5, durationBeats: 0.5, velocity: 84, pitch: { type: 'midi', midiNote: 64 } }
  ]
}`,
		callout: {
			tone: 'warning',
			title: 'Per-Chord Adaptation',
			message: 'Because factory templates adapt harmony and passing tones to the active chord, adapt each chord in your progression separately and combine the rendered clips to ensure faithful phrase adaptation.'
		}
	},
	{
		id: 'catalogs',
		name: 'Catalogs & Raw Definitions',
		category: 'scales',
		categoryLabel: 'Catalogs',
		signature: 'scaled.getChordDefinitions() | scaled.getScaleDefinitions() | scaled.performanceSummaries',
		summary: 'Direct access to raw music theory catalogs: 255 chord definitions, 76 scale definitions, 14 voicing presets, and 1,060 factory performance templates and summaries.',
		parameters: [
			{
				name: 'getChordDefinitions()',
				type: 'none',
				required: false,
				description: 'Returns fresh copies of all 255 chord formulas with formula degrees and optional-note indexes.'
			},
			{
				name: 'getScaleDefinitions()',
				type: 'none',
				required: false,
				description: 'Returns fresh copies of all 76 scale definitions including alternate names.'
			},
			{
				name: 'performanceSummaries',
				type: 'readonly ScaledT.PerformanceSummaryT[]',
				required: false,
				description: 'Lightweight metadata for fast UI browsing of all 1,060 performance templates.'
			}
		],
		returnType: 'readonly ScaledT.ChordDefinitionT[] | readonly ScaledT.ScaleDefinitionT[]',
		returnDescription: 'Raw data catalogs for building musical browsers and discovery interfaces.',
		codeExample: `import { scaled } from '@tasteee/scaled'

const chords = scaled.getChordDefinitions()
console.log(chords.length) // 255

const scales = scaled.getScaleDefinitions()
console.log(scales.length) // 76

const summaries = scaled.performanceSummaries
console.log(summaries.length) // 1060`,
		returnExample: `// Sample chord definition:
{
  id: 'm7b5',
  name: 'Minor 7th Flat 5th (Half-Diminished)',
  formula: ['1', 'b3', 'b5', 'b7'],
  optional: []
}`
	}
]

export const ApiDocs = () => {
	const [activeCategory, setActiveCategory] = React.useState<string>('all')
	const [searchTerm, setSearchTerm] = React.useState<string>('')

	const handleSearchInput = (event: CustomEvent<{ value: string }>): void => {
		setSearchTerm(event.detail.value ?? '')
	}

	const normalizedSearch = searchTerm.trim().toLowerCase()

	const filteredMethods = API_METHODS.filter((method) => {
		const matchesCategory = activeCategory === 'all' || method.category === activeCategory
		if (!matchesCategory) return false

		if (!normalizedSearch) return true

		const matchesName = method.name.toLowerCase().includes(normalizedSearch)
		const matchesSignature = method.signature.toLowerCase().includes(normalizedSearch)
		const matchesSummary = method.summary.toLowerCase().includes(normalizedSearch)
		const matchesParams = method.parameters.some((param) => {
			return param.name.toLowerCase().includes(normalizedSearch) || param.type.toLowerCase().includes(normalizedSearch)
		})
		const matchesReturn = method.returnType.toLowerCase().includes(normalizedSearch)

		return matchesName || matchesSignature || matchesSummary || matchesParams || matchesReturn
	})

	return (
		<z-column gap="var(--spacing-8)" isFullWidth className="apiDocsPage">
			{/* Hero Header */}
			<z-card className="apiHeroCard" gap="var(--spacing-4)">
				<z-eyebrow label="API & ENGINE DOCUMENTATION" tone="secondary" hasRule isFullWidth />

				<z-row alignsY="center" alignsX="between" gap="var(--spacing-3)" doesWrap>
					<z-heading size="xl" tag="h1" color="strong">@tasteee/scaled API Reference</z-heading>
					<z-row gap="var(--spacing-2)" alignsY="center">
						<z-badge tone="primary" kind="soft">v0.1.0</z-badge>
						<z-badge kind="outline">TypeScript</z-badge>
						<z-badge tone="success" kind="soft">Zero Dependencies</z-badge>
					</z-row>
				</z-row>

				<z-text size="md" color="muted">
					Complete, strongly-typed music theory and MIDI playback engine for modern web and Node.js audio applications. Discover chord progressions, compute advanced harmonic voicings with smooth voice-leading, generate arpeggiator patterns, and export directly to <z-inline color="strong" weight={600}>Standard MIDI Files (SMF Type 0)</z-inline>.
				</z-text>

				<z-row gap="var(--spacing-2)" doesWrap margin="var(--spacing-2) 0 0 0">
					<z-badge tone="secondary" kind="soft">255 Chords</z-badge>
					<z-badge tone="secondary" kind="soft">76 Scales</z-badge>
					<z-badge tone="secondary" kind="soft">1,060 Performance Templates</z-badge>
					<z-badge tone="secondary" kind="soft">14 Voicing Presets</z-badge>
					<z-badge tone="secondary" kind="soft">Loop-Accurate SMF Export</z-badge>
				</z-row>
			</z-card>

			{/* Quick Setup Card */}
			<z-card className="apiQuickStartCard" gap="var(--spacing-4)">
				<z-eyebrow label="GETTING STARTED" hasRule isFullWidth />
				<z-heading size="sm" tag="h2" color="strong">Installation & Engine Initialization</z-heading>
				<z-text size="sm" color="muted">
					Import the pre-initialized <code className="codeInline">scaled</code> singleton for immediate playback, or call <code className="codeInline">scaled.createEngine(options)</code> to isolate custom defaults across independent tracks:
				</z-text>
				<z-code-block
					language="typescript"
					filename="quickstart.ts"
					hasLineNumbers
					code={`import { scaled } from '@tasteee/scaled'
import type { ScaledT } from '@tasteee/scaled/types'

// 1. Discover chords in a scale
const chords = scaled.getScaleChords({ key: 'C', scale: 'major' })

// 2. Voice a chord with voice leading
const voiced = scaled.getChordWithVoicing({ chord: 'Cmaj7', voicing: 'drop2' })

// 3. Render a continuous arpeggiator or rhythm pattern
const clip = scaled.applyPerformance({
  progression: [{ chord: 'Cmaj7', durationBeats: 4 }, { chord: 'Am7', durationBeats: 4 }],
  performance: myPattern
})

// 4. Export to a Type 0 MIDI file
const midi = scaled.exportMidi({ clip, tempo: 120, fileName: 'progression.mid' })`}
				/>
			</z-card>

			{/* Interactive Filter & Search Controls */}
			<z-card gap="var(--spacing-4)" className="apiFiltersCard">
				<z-eyebrow label="METHOD CATALOG EXPLORER" hasRule isFullWidth />

				<z-row alignsY="center" alignsX="between" gap="var(--spacing-3)" doesWrap>
					<z-subheading size="xs" color="muted">Filter by Functional Category</z-subheading>
					<z-badge kind="outline">
						{filteredMethods.length} {filteredMethods.length === 1 ? 'method' : 'methods'}
					</z-badge>
				</z-row>

				<z-row gap="var(--spacing-2)" doesWrap alignsY="center">
					<z-button
						size="sm"
						kind={activeCategory === 'all' ? 'solid' : 'ghost'}
						onClick={() => setActiveCategory('all')}
					>
						All Methods
					</z-button>
					<z-button
						size="sm"
						kind={activeCategory === 'chords' ? 'solid' : 'ghost'}
						onClick={() => setActiveCategory('chords')}
					>
						Chords & Voicings
					</z-button>
					<z-button
						size="sm"
						kind={activeCategory === 'scales' ? 'solid' : 'ghost'}
						onClick={() => setActiveCategory('scales')}
					>
						Scales & Discovery
					</z-button>
					<z-button
						size="sm"
						kind={activeCategory === 'performance' ? 'solid' : 'ghost'}
						onClick={() => setActiveCategory('performance')}
					>
						Performance & MIDI
					</z-button>
					<z-button
						size="sm"
						kind={activeCategory === 'timing' ? 'solid' : 'ghost'}
						onClick={() => setActiveCategory('timing')}
					>
						Timing Utilities
					</z-button>
					<z-button
						size="sm"
						kind={activeCategory === 'adapters' ? 'solid' : 'ghost'}
						onClick={() => setActiveCategory('adapters')}
					>
						Adapters & Catalogs
					</z-button>
				</z-row>

				<z-input
					size="md"
					type="search"
					placeholder="Filter methods by name, parameter, return type, or description..."
					value={searchTerm}
					oninput={handleSearchInput}
				/>
			</z-card>

			{/* Methods List */}
			<z-column gap="var(--spacing-6)" isFullWidth>
				{filteredMethods.map((method) => {
					const hasParameters = method.parameters.length > 0

					return (
						<z-card key={method.id} id={method.id} gap="var(--spacing-5)" className="methodCard">
							{/* Category Eyebrow Division */}
							<z-eyebrow label={method.categoryLabel.toUpperCase()} tone="secondary" hasRule isFullWidth />

							{/* Method Title & Meta */}
							<z-row alignsY="center" alignsX="between" gap="var(--spacing-2)" doesWrap>
								<z-heading size="md" tag="h3" color="strong" className="methodHeading">
									{method.name}
								</z-heading>
								<z-badge tone="primary" kind="soft">
									{method.categoryLabel}
								</z-badge>
							</z-row>

							{/* Summary Description */}
							<z-text size="sm" color="muted" className="methodSummary">
								{method.summary}
							</z-text>

							{/* Callout if present */}
							{method.callout && (
								<z-callout tone={method.callout.tone} heading={method.callout.title}>
									<z-text size="xs" color="muted">
										{method.callout.message}
									</z-text>
								</z-callout>
							)}

							{/* Signature */}
							<z-column gap="var(--spacing-1)" isFullWidth>
								<z-subheading size="xs" color="muted">Type Signature</z-subheading>
								<z-code-block
									language="typescript"
									isCopyHidden
									filename="signature.ts"
									code={method.signature}
								/>
							</z-column>

							{/* Parameters / Inputs Section */}
							<z-column gap="var(--spacing-3)" isFullWidth>
								<z-eyebrow label="PARAMETERS & OPTIONS" hasRule isFullWidth />
								{hasParameters ? (
									<z-column gap="var(--spacing-2)" isFullWidth className="paramsList">
										{method.parameters.map((param) => {
											return (
												<div key={param.name} className="paramItem">
													<z-row alignsY="center" gap="var(--spacing-2)" doesWrap>
														<code className="paramName">{param.name}</code>
														<code className="paramType">{param.type}</code>
														<z-badge tone={param.required ? 'danger' : 'primary'} kind={param.required ? 'solid' : 'soft'} size="sm">
															{param.required ? 'required' : 'optional'}
														</z-badge>
														{param.default && (
															<z-text size="xs" color="muted">
																<z-inline color="muted">default: </z-inline>
																<code className="paramDefault">{param.default}</code>
															</z-text>
														)}
													</z-row>
													<z-text size="xs" color="muted" className="paramDescription">
														{param.description}
													</z-text>
												</div>
											)
										})}
									</z-column>
								) : (
									<z-text size="xs" color="muted">
										This method accepts no arguments.
									</z-text>
								)}
							</z-column>

							{/* Return Type Section */}
							<z-column gap="var(--spacing-2)" isFullWidth>
								<z-eyebrow label="RETURN VALUE" hasRule isFullWidth />
								<z-row alignsY="center" gap="var(--spacing-2)" doesWrap>
									<z-badge tone="success" kind="soft" size="sm">Type</z-badge>
									<code className="returnType">{method.returnType}</code>
								</z-row>
								<z-text size="xs" color="muted">
									{method.returnDescription}
								</z-text>
							</z-column>

							{/* Code Examples Section */}
							<z-column gap="var(--spacing-3)" isFullWidth>
								<z-eyebrow label="CODE EXAMPLES & OUTPUT" hasRule isFullWidth />
								<div className="examplesLayout">
									<z-column gap="var(--spacing-2)" isFullWidth>
										<z-subheading size="xs" color="muted">Usage Example</z-subheading>
										<z-code-block
											language="typescript"
											filename="example.ts"
											hasLineNumbers
											code={method.codeExample}
										/>
									</z-column>
									<z-column gap="var(--spacing-2)" isFullWidth>
										<z-subheading size="xs" color="muted">Return Value Output</z-subheading>
										<z-code-block
											language="typescript"
											filename="return.ts"
											code={method.returnExample}
										/>
									</z-column>
								</div>
							</z-column>
						</z-card>
					)
				})}

				{filteredMethods.length === 0 && (
					<z-card className="emptyCard" gap="var(--spacing-3)">
						<z-empty-state
							heading="No matching API methods"
							description={`No methods matched "${searchTerm}". Try checking your query or clearing filters.`}
						/>
					</z-card>
				)}
			</z-column>
		</z-column>
	)
}

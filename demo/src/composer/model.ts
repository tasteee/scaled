import { scaled } from '@tasteee/scaled'
import type { ScaledT } from '@tasteee/scaled/types'

export type OptionT = { value: string; label: string; disabled?: boolean }
export type EntryT = { id: string; symbol: string; durationBeats: number; voicing: string; performance: string; inversion: number; octaveOffset: number; sourceSlot: number | null }
export type GridChordT = ScaledT.ChordT & { sourceSlot: number | null }
export type SessionT = { key: string; scale: string; octave: number; voicing: string; performance: string; tempo: number; shouldPreviewPerformance: boolean; family: string; search: string; selectedId: string; progression: EntryT[]; error: string }

export const keyOptions = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map((key): OptionT => {
  return { value: key, label: key }
})
export const scaleOptions = scaled.getScaleDefinitions().map((scale): OptionT => {
  return { value: scale.name, label: scale.name }
})
export const voicingOptions: OptionT[] = [
  { value: 'rootPosition', label: 'Standard' },
  { value: 'closed', label: 'Closed' },
  { value: 'open', label: 'Open' },
  { value: 'drop2', label: 'Drop 2 (4+ notes)' }
]
export const sourceVoicingOptions = scaled.voicingPresets.map((preset): OptionT => {
  return { value: preset.id, label: `${preset.name} · scale voicing` }
})
export const allVoicingOptions = voicingOptions.concat(sourceVoicingOptions)
export const performanceOptions: OptionT[] = [{ value: 'standard', label: 'Standard · sustained chords' }]
export const sourcePerformanceOptions = scaled.performanceSummaries.map((template): OptionT => {
  const subcategory = template.subcategory.trim()
  const hasSubcategory = subcategory.length > 0
  const categoryLabel = hasSubcategory ? `${template.category} / ${subcategory}` : template.category
  const label = `${categoryLabel} / ${template.name}`
  return { value: template.id, label }
})
export const allPerformanceOptions = performanceOptions.concat(sourcePerformanceOptions)
export const inheritedVoicingOptions = [{ value: 'inherit', label: 'Use global voicing' }].concat(allVoicingOptions)
export const inheritedPerformanceOptions = [{ value: 'inherit', label: 'Use global performance' }].concat(allPerformanceOptions)
export const familyOptions: OptionT[] = [
  { value: 'all', label: 'All variations' },
  { value: 'triad', label: 'Triads' },
  { value: 'seventh', label: 'Sevenths' },
  { value: 'ninth', label: 'Ninths' },
  { value: 'eleventh', label: 'Elevenths' },
  { value: 'thirteenth', label: 'Thirteenths' },
  { value: 'sixth', label: 'Sixths' },
  { value: 'power', label: 'Power chords' }
]

export const getInitialSession = (): SessionT => {
  return { key: 'C', scale: 'Major scale', octave: 4, voicing: 'rootPosition', performance: 'standard', tempo: 110, shouldPreviewPerformance: false, family: 'triad', search: '', selectedId: '', progression: [], error: '' }
}

export const createEntry = (symbol: string, sourceSlot: number | null = null): EntryT => {
  return { id: crypto.randomUUID(), symbol, durationBeats: 4, voicing: 'inherit', performance: 'inherit', inversion: 0, octaveOffset: 0, sourceSlot }
}

export const getFamilyFilter = (family: string): readonly ScaledT.ChordFamilyT[] | undefined => {
  const matchingFamily = familyOptions.find((option) => {
    return option.value === family
  })
  const isAll = matchingFamily?.value === 'all'
  if (isAll) return undefined
  const families: ScaledT.ChordFamilyT[] = ['triad', 'seventh', 'ninth', 'eleventh', 'thirteenth', 'sixth', 'power']
  const selectedFamily = families.find((candidate) => {
    return candidate === family
  })
  if (!selectedFamily) return undefined
  return [selectedFamily]
}

export const isSourceVoicing = (identifier: string): boolean => {
  const hasSourcePreset = scaled.voicingPresets.some((preset) => {
    return preset.id === identifier
  })
  return hasSourcePreset
}

export const getVisibleChords = (session: SessionT): readonly GridChordT[] => {
  const hasSourceVoicing = isSourceVoicing(session.voicing)
  if (hasSourceVoicing) {
    const sequence = scaled.getScaleVoicingChords({ presetId: session.voicing, key: session.key, scale: session.scale, octave: session.octave })
    const gridChords: GridChordT[] = []
    for (const shape of sequence) {
      if (!shape.chord) continue
      gridChords.push({ ...shape.chord, sourceSlot: shape.sourceSlot })
    }
    const search = session.search.toLowerCase().trim()
    const matchingChords = gridChords.filter((chord) => {
      const symbol = chord.symbol.toLowerCase()
      return symbol.includes(search)
    })
    return matchingChords
  }
  const familyFilter = getFamilyFilter(session.family)
  const filter = familyFilter ? { chordTypes: familyFilter } : {}
  const chords = scaled.getScaleChords({ key: session.key, scale: session.scale, octave: session.octave, ...filter })
  const search = session.search.toLowerCase().trim()
  const filteredChords = chords.filter((chord) => {
    const symbol = chord.symbol.toLowerCase()
    return symbol.includes(search)
  })
  const gridChords = filteredChords.map((chord): GridChordT => {
    return { ...chord, sourceSlot: null }
  })
  return gridChords
}

export const getNoteLabel = (midiNote: number): string => {
  const names = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']
  const pitch = midiNote % 12
  const noteName = names[pitch]
  const octave = Math.floor(midiNote / 12) - 1
  return `${noteName}${octave}`
}

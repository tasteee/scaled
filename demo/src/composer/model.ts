import { scaled } from '@tasteee/scaled'
import type { ScaledT } from '@tasteee/scaled/types'

export type OptionT = { value: string; label: string; disabled?: boolean; children?: OptionT[] }
export type EntryT = { id: string; symbol: string; durationBeats: number; voicing: string; performance: string; speedMultiplier: number | null; inversion: number; octaveOffset: number; sourceSlot: number | null }
export type GridChordT = ScaledT.ChordT & { sourceSlot: number | null }
export type SessionT = { key: string; scale: string; octave: number; voicing: string; performance: string; speedMultiplier: number; tempo: number; shouldPreviewPerformance: boolean; family: string; search: string; selectedId: string; progression: EntryT[]; error: string }

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
  { value: 'drop2', label: 'Drop 2' }
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
const getPerformanceLeaf = (template: ScaledT.PerformanceSummaryT): OptionT => {
  return { value: template.id, label: template.name }
}
const getPerformanceSubcategory = (category: string, subcategory: string): OptionT => {
  const templates = scaled.performanceSummaries.filter((template) => {
    const isCategory = template.category === category
    const isSubcategory = template.subcategory.trim() === subcategory
    return isCategory && isSubcategory
  })
  const children = templates.map(getPerformanceLeaf)
  return { value: `subcategory:${category}:${subcategory}`, label: subcategory, children }
}
const getPerformanceCategory = (category: string): OptionT => {
  const templates = scaled.performanceSummaries.filter((template) => {
    return template.category === category
  })
  const directTemplates = templates.filter((template) => {
    return template.subcategory.trim().length === 0
  })
  const directOptions = directTemplates.map(getPerformanceLeaf)
  const subcategories = [...new Set(templates.map((template) => template.subcategory.trim()))]
  const namedSubcategories = subcategories.filter((subcategory) => {
    return subcategory.length > 0
  })
  const subcategoryOptions = namedSubcategories.map((subcategory) => {
    return getPerformanceSubcategory(category, subcategory)
  })
  const children = directOptions.concat(subcategoryOptions)
  return { value: `category:${category}`, label: category, children }
}
const categoryNames = [...new Set(scaled.performanceSummaries.map((template) => template.category))]
export const sourcePerformanceSelectOptions = categoryNames.map(getPerformanceCategory)
export const performanceSelectOptions = performanceOptions.concat(sourcePerformanceSelectOptions)
export const inheritedVoicingOptions = [{ value: 'inherit', label: 'Use global voicing' }].concat(allVoicingOptions)
export const inheritedPerformanceOptions = [{ value: 'inherit', label: 'Use global performance' }].concat(allPerformanceOptions)
export const inheritedPerformanceSelectOptions = [{ value: 'inherit', label: 'Use global performance' }].concat(performanceSelectOptions)
export const speedOptions: OptionT[] = [
  { value: '0.25', label: '0.25×' },
  { value: '0.5', label: '0.5×' },
  { value: '1', label: '1×' },
  { value: '2', label: '2×' }
]
export const inheritedSpeedOptions = [{ value: 'inherit', label: 'Use global speed' }].concat(speedOptions)
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
  return { key: 'C', scale: 'Major scale', octave: 4, voicing: 'rootPosition', performance: 'standard', speedMultiplier: 1, tempo: 110, shouldPreviewPerformance: false, family: 'triad', search: '', selectedId: '', progression: [], error: '' }
}

export const createEntry = (symbol: string, sourceSlot: number | null = null): EntryT => {
  return { id: crypto.randomUUID(), symbol, durationBeats: 4, voicing: 'inherit', performance: 'inherit', speedMultiplier: null, inversion: 0, octaveOffset: 0, sourceSlot }
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

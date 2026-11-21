/** Ranked corpus transition retained in the runtime suggestion tables. */
export type SuggestionTransitionEntryT = {
  readonly token: string
  readonly weight: number
}

export type SuggestedChordT = {
  readonly token: string // e.g. "0_maj-7_maj" or "I_maj-V_maj"
  readonly weight: number // Frequency weight from mined corpus
  readonly targetType: string // e.g. "maj", "min7"
  readonly symbol?: string // e.g. "G", "F", "Dm" when key is resolved
  readonly rootPitch?: number // 0-11
  readonly semitoneOffset?: number // Semitone distance from tonic (Tonal)
  readonly scaleDegree?: string // Scale degree Roman numeral (Per Scale)
  readonly isInScale?: boolean // Whether the chord notes strictly fit the active scale
}

/**
 * Rich options object for `getSuggestions` when multiple parameters are needed.
 */
export type GetSuggestionsOptionsT = {
  readonly chord: string | { readonly symbol?: string; readonly chordType?: string; readonly rootPitch?: number }
  readonly profile?: 'tonal' | 'perScale'
  readonly key?: string // Tonic key (e.g. "C", "F#") for pitch resolution
  readonly scale?: string // Scale context (e.g. "major", "dorian")
  readonly inScaleOnly?: boolean // When true, filters suggestions strictly to scale notes
  readonly limit?: number // Optional maximum number of suggestions to return
  readonly octave?: number
}

/**
 * Single-argument input for `getSuggestions`:
 * - Simple usage: pass 1 string (e.g. "C", "0_maj", "I_maj") or a Chord object.
 * - Advanced usage: pass 1 object with named properties (GetSuggestionsOptionsT).
 */
export type GetSuggestionsInputT =
  | string
  | { readonly symbol?: string; readonly chordType?: string; readonly rootPitch?: number }
  | GetSuggestionsOptionsT



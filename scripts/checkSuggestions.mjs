import * as assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { scaled } from '../dist/index.mjs'
const tonal = JSON.parse(readFileSync(new URL('../src/data/suggestionsTonal.json', import.meta.url)))
const perScale = JSON.parse(readFileSync(new URL('../src/data/suggestionsPerScale.json', import.meta.url)))
for (const [profile, table] of [['tonal', tonal], ['perScale', perScale]]) {
  for (const [source, entries] of Object.entries(table)) {
    const actual = scaled.getSuggestions({ chord: source, profile })
    assert.deepEqual(actual.map(({ token, weight }) => ({ token, weight })), entries)
    for (const chord of actual) if (chord.symbol) assert.doesNotThrow(() => scaled.getChord({ chord: chord.symbol }))
  }
}
assert.equal(scaled.getSuggestions('C').length, 165)
assert.deepEqual(scaled.getSuggestions('I_maj'), scaled.getSuggestions({ chord: 'I_maj', profile: 'perScale' }))
for (const key of ['C', 'D', 'F#', 'Bb']) {
  for (const scale of ['major', 'minor', 'dorian']) {
    const context = scaled.getScale({ key, scale })
    const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']
    for (const [degree, rootPitch] of context.pitches.entries()) {
      const chord = { rootPitch, chordType: 'maj' }
      assert.deepEqual(scaled.getSuggestions({ chord, key, scale, profile: 'perScale' }), scaled.getSuggestions({ chord: romans[degree] + '_maj', key, scale, profile: 'perScale' }))
    }
    const all = scaled.getSuggestions({ chord: { rootPitch: context.pitches[0], chordType: 'maj' }, key, scale })
    for (const suggestion of all) {
      if (!suggestion.symbol) { assert.equal(suggestion.isInScale, false); continue }
      const chord = scaled.getChord({ chord: suggestion.symbol })
      assert.equal(suggestion.isInScale, chord.midiNotes.every(note => context.pitches.includes(note % 12)))
    }
    assert.deepEqual(scaled.getSuggestions({ chord: key, key, scale, inScaleOnly: true }), all.filter(chord => chord.isInScale))
  }
}
assert.deepEqual(scaled.getSuggestions({ symbol: 'Dm7' }), scaled.getSuggestions('Dm7'))
assert.deepEqual(scaled.getSuggestions(scaled.getChord({ chord: 'Dm7' })), scaled.getSuggestions('Dm7'))
assert.equal(scaled.getSuggestions({ chord: 'C', limit: 0 }).length, 0)
assert.equal(scaled.getSuggestions({ chord: 'C', limit: 3 }).length, 3)
for (const limit of [-1, 1.5, NaN, Infinity]) assert.throws(() => scaled.getSuggestions({ chord: 'C', limit }), RangeError)
assert.deepEqual(scaled.getSuggestions({ chord: 'C#', key: 'C', scale: 'major', profile: 'perScale' }), [])
console.log('Public suggestion API: all corpus lookups, transpositions, degrees, scale membership and limits passed.')

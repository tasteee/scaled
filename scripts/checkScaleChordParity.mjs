import { scaled } from '../dist/index.mjs'
import * as assert from 'node:assert/strict'
import * as filesystem from 'node:fs'

const catalogDirectory = new URL('../tests/fixtures/', import.meta.url)
const dataDirectory = new URL('../src/data/', import.meta.url)

const scaleChordGroupsText = filesystem.readFileSync(new URL('scaleChordGroups.json', catalogDirectory), 'utf8')
const scaleChordGroups = JSON.parse(scaleChordGroupsText)

const chordCatalogText = filesystem.readFileSync(new URL('chords.json', dataDirectory), 'utf8')
const chordCatalog = JSON.parse(chordCatalogText)

const scaleCatalogText = filesystem.readFileSync(new URL('scales.json', dataDirectory), 'utf8')
const scaleCatalog = JSON.parse(scaleCatalogText)

const majorIntervals = [0, 2, 4, 5, 7, 9, 11]

const getAccidentalOffset = (accidentals) => {
  const sharpCount = accidentals.split('#').length - 1
  const flatCount = accidentals.split('b').length - 1
  return sharpCount - flatCount
}

const getFormulaInterval = (formula) => {
  const match = formula.match(/^([#b]*)(\d+)$/)
  if (!match) throw new Error(`Invalid formula: ${formula}`)
  const accidentals = match[1]
  const degree = Number(match[2])
  const degreeIndex = degree - 1
  const wrappedDegree = degreeIndex % 7
  const octaveOffset = Math.floor(degreeIndex / 7) * 12
  const naturalInterval = majorIntervals[wrappedDegree]
  const accidentalOffset = getAccidentalOffset(accidentals)
  return naturalInterval + octaveOffset + accidentalOffset
}

// Precompute chord definition intervals and pitch class sets
const parsedChords = chordCatalog.map((chord) => {
  const intervals = chord.formula.map(getFormulaInterval)
  const pitchClasses = [...new Set(intervals.map((semitones) => semitones % 12))].sort((a, b) => a - b)
  return {
    name: chord.name,
    intervals,
    pitchClasses,
    pcKey: pitchClasses.join(',')
  }
})

const chordsByPcSet = new Map()
for (const chord of parsedChords) {
  if (!chordsByPcSet.has(chord.pcKey)) {
    chordsByPcSet.set(chord.pcKey, chord.name)
  }
}

// Index scale formulas
const scaleMap = new Map()
for (const scale of scaleCatalog) {
  const intervals = scale.formula.map(getFormulaInterval)
  scaleMap.set(scale.name, {
    intervals,
    degreeCount: scale.formula.length
  })
}

// ============================================================================
// TEST 1: Audit all 912 scales & 6,024 variation buckets for 100% exact parity
// ============================================================================
let totalScalesChecked = 0
let totalVariationsChecked = 0
let totalVariationMismatches = 0

for (const scaleEntry of scaleChordGroups.scales) {
  totalScalesChecked++
  const scaleInfo = scaleMap.get(scaleEntry.scaleName)
  assert.ok(scaleInfo, `Missing scale definition for ${scaleEntry.scaleName}`)

  const scalePitches = scaleInfo.intervals.map((interval) => (scaleEntry.tonicPitch + interval) % 12)

  const apiChords = scaled.getScaleChords({ key: ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'][scaleEntry.tonicPitch], scale: scaleEntry.scaleName, octave: 4 })
  for (const variationGroup of scaleEntry.variations) {
    totalVariationsChecked++
    const rootPitch = variationGroup.rootPitch
    const nativeChordNames = variationGroup.chords.map((chord) => chord.chordType)

    // Compute compatible chords using our formula interval matching
    const computedChordNames = apiChords.filter(chord => chord.rootPitch === rootPitch).map(chord => chord.chordType)

    // Exact stringified sequence comparison
    const nativeSequence = nativeChordNames.join('|')
    const computedSequence = computedChordNames.join('|')
    if (nativeSequence !== computedSequence) {
      totalVariationMismatches++
    }
  }
}

assert.equal(totalScalesChecked, 912, 'Must check all 912 scale transpositions')
assert.equal(totalVariationsChecked, 6024, 'Must verify all 6,024 root variation groups')
assert.equal(totalVariationMismatches, 0, 'Must have ZERO variation mismatches against native scaleChordGroups.json')

// ============================================================================
// TEST 2: Audit 7-note diatonic degree groups (Triads, 7ths, 9ths, 11ths, 13ths)
// ============================================================================
let heptatonicScalesChecked = 0
let diatonicChordsChecked = 0
let diatonicPitchClassMatches = 0

for (const scaleEntry of scaleChordGroups.scales) {
  const scaleInfo = scaleMap.get(scaleEntry.scaleName)
  if (scaleInfo.degreeCount !== 7) continue
  heptatonicScalesChecked++

  const scalePitches = scaleInfo.intervals.map((interval) => (scaleEntry.tonicPitch + interval) % 12)
  const degreeCount = 7

  for (const group of scaleEntry.groups) {
    const noteCount = group.id + 2
    for (let degree = 0; degree < degreeCount; degree++) {
      diatonicChordsChecked++
      const nativeChord = group.chords[degree]
      if (nativeChord === null) continue

      const rootPitch = scalePitches[degree]
      const degreePitchClasses = []
      for (let step = 0; step < noteCount; step++) {
        const stepPitch = scalePitches[(degree + step * 2) % degreeCount]
        degreePitchClasses.push((stepPitch - rootPitch + 12) % 12)
      }

      const pcKey = [...new Set(degreePitchClasses)].sort((a, b) => a - b).join(',')
      const computedChordName = chordsByPcSet.get(pcKey)
      const hasMatchingPitchClasses = computedChordName !== undefined
      const nativePcKey = [...new Set(nativeChord.midiNotes.map(note => ((note - rootPitch) % 12 + 12) % 12))].sort((a,b) => a-b).join(',')
      assert.equal(pcKey, nativePcKey, scaleEntry.scaleName + ' group ' + group.id + ' degree ' + degree)
      if (hasMatchingPitchClasses) {
        diatonicPitchClassMatches++
      }
    }
  }
}

assert.equal(heptatonicScalesChecked, 696, 'Must check 696 7-note scale contexts')
assert.equal(diatonicChordsChecked, 24360, 'Must check all 24,360 degree chords')
assert.equal(diatonicPitchClassMatches, 24360, 'All 24,360 diatonic degree chords must match native pitch class sets')

console.log(`[PASS] Scale Chord Parity Audit Passed:
  - 912/912 Scales Audited across all 12 tonics
  - 6,024/6,024 Variation Buckets checked with 0 mismatches (100% exact parity)
  - 24,360/24,360 Diatonic degree chords matched against native C++ generator sets`)

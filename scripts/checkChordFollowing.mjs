import * as assert from 'node:assert/strict'
import * as filesystem from 'node:fs'
import * as library from '../dist/index.mjs'

const scaled = library.scaled
const contextsPath = new URL('../src/data/performanceContexts.json', import.meta.url)
const contexts = JSON.parse(filesystem.readFileSync(contextsPath, 'utf8'))
const categories = ['Bass', 'Melody', 'Phrases', 'Sequences']
const sourceNotes = [60, 62, 64, 65, 67, 69, 71, 72]

const getSourceTemplate = (category) => {
  const template = scaled.performanceTemplates.find((candidate) => {
    const context = contexts.find((sourceContext) => {
      return sourceContext.id === candidate.id
    })
    const hasMajorContext = context?.tonicPitch === 0 && context?.scaleName === 'Major scale'
    return candidate.category === category && hasMajorContext
  })
  assert.ok(template, `Missing C major fixture for ${category}`)
  return template
}

const buildTemplate = (category, referenceMidiNotes = sourceNotes) => {
  const original = getSourceTemplate(category)
  const events = referenceMidiNotes.map((midiNote, position) => {
    return { id: position, sourcePitchIndex: position, sourceMidiNote: midiNote, startBeat: position, durationBeats: 0.75, velocity: 90, startOffsetBeats: 0, durationOffsetBeats: 0 }
  })
  return { ...original, name: 'Chord-following fixture', subcategory: 'Fixture', durationBeats: 8, octaveDifference: 0, referenceMidiNotes, events }
}

const getPitches = (template, symbol, scale = 'major', inversion = 0) => {
  const chord = scaled.getChordWithVoicing({ chord: symbol, inversion })
  const adapted = scaled.getScalePerformance({ template, midiNotes: chord.midiNotes, chordRootPitch: chord.rootPitch, key: 'C', scale, octave: 4 })
  return adapted.midiNotes
}

for (const category of categories) {
  const template = buildTemplate(category)
  const melodyShift = category === 'Melody' ? 12 : 0
  const bassShift = category === 'Bass' ? -12 : 0
  const expectedMajor = sourceNotes.map((midiNote) => {
    return midiNote + melodyShift
  })
  const expectedMinor = [69, 71, 72, 74, 76, 77, 79, 81].map((midiNote) => {
    return midiNote + melodyShift + bassShift
  })
  const expectedBorrowed = [60, 62, 63, 65, 67, 69, 71, 72].map((midiNote) => {
    return midiNote + melodyShift
  })
  assert.deepEqual(getPitches(template, 'C'), expectedMajor, `${category}: tonic identity`)
  assert.deepEqual(getPitches(template, 'Am'), expectedMinor, `${category}: relative minor and passing tones`)
  assert.deepEqual(getPitches(template, 'Cm'), expectedBorrowed, `${category}: borrowed minor third`)
  assert.deepEqual(getPitches(template, 'Am', 'major', 1), expectedMinor, `${category}: inversion keeps root`)
  const chord = scaled.getChordWithVoicing({ chord: 'Am', inversion: 1 })
  const inferred = scaled.getScalePerformance({ template, midiNotes: chord.midiNotes, key: 'C', scale: 'major', octave: 4 })
  assert.deepEqual(inferred.midiNotes, expectedMinor, `${category}: infer inverted minor triad`)
  const duplicateTemplate = buildTemplate(category, [60, 64, 64, 67])
  const expectedDuplicates = [60, 63, 63, 67].map((midiNote) => {
    return midiNote + melodyShift
  })
  assert.deepEqual(getPitches(duplicateTemplate, 'Cm', 'minor'), expectedDuplicates, `${category}: preserve source pitch indices`)
  const dominant = getPitches(template, 'C7')
  assert.equal(dominant[6], 70 + melodyShift, `${category}: dominant seventh`)
  const diminished = getPitches(template, 'Cdim')
  assert.equal(diminished[2], 63 + melodyShift, `${category}: diminished third`)
  assert.equal(diminished[4], 66 + melodyShift, `${category}: diminished fifth`)
  const suspended = getPitches(template, 'Csus4')
  assert.equal(suspended[2], 65 + melodyShift, `${category}: suspended third`)
  const altered = getPitches(template, 'C7 b9')
  assert.equal(altered[1], 61 + melodyShift, `${category}: altered ninth`)
  const diminishedSeventh = getPitches(template, 'Cdim7')
  assert.equal(diminishedSeventh[6], 69 + melodyShift, `${category}: diminished seventh`)
  const chromatic = getPitches(template, 'C#')
  assert.equal(chromatic[0], 61 + melodyShift, `${category}: chromatic root`)
}

const validationTemplate = buildTemplate('Bass')
const validateRoot = (chordRootPitch) => {
  return scaled.adaptPerformanceTemplate({ template: validationTemplate, midiNotes: [60, 64, 67], chordRootPitch, key: 'C', scale: 'major', octave: 4 })
}
for (const invalidRoot of [-1, 12, 1.5, NaN, Infinity]) {
  const validateInvalidRoot = () => { return validateRoot(invalidRoot) }
  assert.throws(validateInvalidRoot, RangeError, 'Reject invalid chord root pitches')
}

let checkedTemplates = 0
for (const template of scaled.performanceTemplates) {
  const isScaleCategory = categories.includes(template.category)
  if (!isScaleCategory) continue
  const original = structuredClone(template)
  const firstChord = scaled.getChord({ chord: 'Cmaj7' })
  const secondChord = scaled.getChord({ chord: 'Fmaj7' })
  const firstPattern = scaled.adaptPerformanceTemplate({ template, midiNotes: firstChord.midiNotes, chordRootPitch: firstChord.rootPitch, key: 'C', scale: 'major', octave: 4 })
  const secondPattern = scaled.adaptPerformanceTemplate({ template, midiNotes: secondChord.midiNotes, chordRootPitch: secondChord.rootPitch, key: 'C', scale: 'major', octave: 4 })
  const firstPitches = firstPattern.events.map((event) => {
    return event.pitch
  })
  const secondPitches = secondPattern.events.map((event) => {
    return event.pitch
  })
  assert.ok(firstPitches.length > 0, `${template.name}: playable tonic`)
  assert.ok(secondPitches.length > 0, `${template.name}: playable subdominant`)
  assert.notDeepEqual(firstPitches, secondPitches, `${template.category}/${template.name}: follows changed root`)
  assert.deepEqual(template, original, `${template.name}: immutable template`)
  checkedTemplates += 1
}

console.log(`Chord following: harmonic fixtures and ${checkedTemplates} factory templates passed.`)

import * as assert from 'node:assert/strict'
import * as url from 'node:url'
import * as vite from 'vite'

const configurationPath = url.fileURLToPath(new URL('../demo/vite.config.ts', import.meta.url))
const server = await vite.createServer({ configFile: configurationPath, server: { middlewareMode: true }, appType: 'custom' })

const scenarios = [
  { key: 'C', scale: 'Major scale', symbols: ['Cmaj7', 'Am7'], voicing: 'rootPosition', inversion: 0, octaveOffset: 0 },
  { key: 'D', scale: 'Minor scale', symbols: ['Dm7', 'Gm7'], voicing: 'closed', inversion: 1, octaveOffset: -1 },
  { key: 'Ab', scale: 'Major scale', symbols: ['Abmaj7', 'Dbmaj7'], voicing: 'open', inversion: -1, octaveOffset: 1 }
]

const buildSession = (model, scenario, performance) => {
  const initialSession = model.getInitialSession()
  const firstEntry = model.createEntry(scenario.symbols[0])
  const secondEntry = model.createEntry(scenario.symbols[1])
  const progression = [
    { ...firstEntry, durationBeats: 6 },
    { ...secondEntry, durationBeats: 10, inversion: scenario.inversion, octaveOffset: scenario.octaveOffset }
  ]
  return { ...initialSession, key: scenario.key, scale: scenario.scale, voicing: scenario.voicing, performance, progression }
}

const checkClip = (clip, session, label) => {
  assert.equal(clip.durationBeats, 16, label)
  assert.ok(clip.notes.length > 0, `${label}: no playable notes`)
  const firstChordId = session.progression[0].id
  const secondChordId = session.progression[1].id
  for (const note of clip.notes) {
    const isFirstChord = note.chordId === firstChordId
    const isSecondChord = note.chordId === secondChordId
    const hasKnownChord = isFirstChord || isSecondChord
    assert.ok(hasKnownChord, `${label}: unknown chord`)
    const minimumStart = isFirstChord ? 0 : 6
    const maximumEnd = isFirstChord ? 6 : 16
    assert.ok(Number.isInteger(note.midiNote), `${label}: fractional MIDI pitch`)
    assert.ok(note.midiNote >= 0 && note.midiNote <= 127, `${label}: invalid MIDI pitch`)
    assert.ok(note.velocity > 0 && note.velocity <= 127, `${label}: invalid velocity`)
    assert.ok(note.durationBeats > 0, `${label}: nonpositive duration`)
    assert.ok(note.startBeat >= minimumStart && note.startBeat < maximumEnd, `${label}: incorrect chord onset`)
    const endBeat = note.startBeat + note.durationBeats
    assert.ok(endBeat <= maximumEnd, `${label}: note crosses chord boundary`)
  }
  return undefined
}

const checkMidi = (library, clip, tempo, label) => {
  const bytes = library.scaled.exportMidi({ clip, tempo, ticksPerBeat: 960 })
  const file = Buffer.from(bytes)
  assert.equal(file.toString('ascii', 0, 4), 'MThd', label)
  assert.equal(file.readUInt16BE(10), 1, label)
  assert.equal(file.readUInt16BE(12), 960, label)
  assert.equal(file.toString('ascii', 14, 18), 'MTrk', label)
  assert.equal(file.readUInt32BE(18), file.length - 22, label)
  const endOfTrack = [...file.subarray(-3)]
  assert.deepEqual(endOfTrack, [255, 47, 0], label)
  return undefined
}

const getNoteSummary = (notes) => {
  const summary = notes.map((note) => {
    return [note.midiNote, note.startBeat, note.durationBeats, note.velocity]
  })
  return summary
}

const checkOverrides = async (model, renderer, source, library) => {
  const categories = new Set()
  let checkedCount = 0
  for (const template of source.performanceTemplates) {
    const hasCheckedCategory = categories.has(template.category)
    if (hasCheckedCategory) continue
    categories.add(template.category)
    const session = buildSession(model, scenarios[0], 'standard')
    const originalSecondEntry = session.progression[1]
    const secondEntry = { ...originalSecondEntry, performance: template.id, voicing: 'open', inversion: 1, octaveOffset: -1 }
    session.progression[1] = secondEntry
    const clip = await renderer.renderProgression(session)
    const label = `${template.category}: per-chord overrides`
    checkClip(clip, session, label)
    const sustainedNotes = clip.notes.filter((note) => {
      return note.chordId === session.progression[0].id
    })
    const firstChord = renderer.getVoicedChord(session.progression[0], session)
    assert.equal(sustainedNotes.length, firstChord.midiNotes.length, label)
    for (const note of sustainedNotes) {
      assert.equal(note.startBeat, 0, label)
      assert.equal(note.durationBeats, 6, label)
    }
    const secondChord = renderer.getVoicedChord(secondEntry, session)
    const performance = source.adaptPerformanceTemplate({ template, midiNotes: secondChord.midiNotes, chordRootPitch: secondChord.rootPitch, key: session.key, scale: session.scale, octave: session.octave - 1 })
    const progression = session.progression.map((entry) => {
      const chord = renderer.getVoicedChord(entry, session)
      return { id: entry.id, chord, durationBeats: entry.durationBeats }
    })
    const expectedClip = library.scaled.applyPerformance({ progression, performance, key: session.key, scale: session.scale })
    const expectedNotes = expectedClip.notes.filter((note) => {
      return note.chordId === secondEntry.id
    })
    const actualNotes = clip.notes.filter((note) => {
      return note.chordId === secondEntry.id
    })
    const expectedSummary = getNoteSummary(expectedNotes)
    const actualSummary = getNoteSummary(actualNotes)
    assert.deepEqual(actualSummary, expectedSummary, `${label}: phase, pitch or dynamics changed`)
    checkedCount += 1
  }
  return checkedCount
}

try {
  const model = await server.ssrLoadModule('/demo/src/composer/model.ts')
  const renderer = await server.ssrLoadModule('/demo/src/composer/render.ts')
  const library = await server.ssrLoadModule('/src/index.ts')
  const source = library.scaled
  const dropdownIds = model.sourcePerformanceOptions.map((option) => {
    return option.value
  })
  const templateIds = source.performanceTemplates.map((template) => {
    return template.id
  })
  assert.deepEqual(dropdownIds, templateIds, 'Dropdown must expose every factory template in catalog order')
  let checkedCount = 0
  for (const option of model.allPerformanceOptions) {
    for (const scenario of scenarios) {
      const session = buildSession(model, scenario, option.value)
      const label = `${option.label} / ${scenario.key} ${scenario.scale}`
      try {
        const clip = await renderer.renderProgression(session)
        checkClip(clip, session, label)
        checkMidi(library, clip, session.tempo, label)
      } catch (error) {
        throw new Error(`Demo performance failed: ${label}`, { cause: error })
      }
      checkedCount += 1
    }
  }
  const overrideCount = await checkOverrides(model, renderer, source, library)
  console.log(`Demo renderer: ${model.allPerformanceOptions.length} dropdown options, ${checkedCount} progression/MIDI checks, ${overrideCount} category override checks passed.`)
} finally {
  await server.close()
}

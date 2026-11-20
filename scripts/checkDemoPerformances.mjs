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
    session.speedMultiplier = 0.5
    const originalSecondEntry = session.progression[1]
    const secondEntry = { ...originalSecondEntry, performance: template.id, speedMultiplier: 2, voicing: 'open', inversion: 1, octaveOffset: -1 }
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
    const expectedClip = library.scaled.applyPerformance({ progression, performance, speedMultiplier: 2, key: session.key, scale: session.scale })
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

const checkScenarioSpeeds = async (model, renderer, library, option, scenario) => {
  for (const speedOption of model.speedOptions) {
    const session = buildSession(model, scenario, option.value)
    session.speedMultiplier = Number(speedOption.value)
    const label = `${option.label} / ${scenario.key} ${scenario.scale} / ${speedOption.label}`
    try {
      const clip = await renderer.renderProgression(session)
      checkClip(clip, session, label)
      checkMidi(library, clip, session.tempo, label)
    } catch (error) {
      throw new Error(`Demo performance failed: ${label}`, { cause: error })
    }
  }
  return model.speedOptions.length
}

const checkSourceVoicingSelection = (model, renderer, source) => {
  const firstPreset = source.voicingPresets[0]
  const secondPreset = source.voicingPresets[1]
  assert.ok(firstPreset)
  assert.ok(secondPreset)

  const session = model.getInitialSession()
  session.voicing = firstPreset.id
  const sourceEntry = model.createEntry('G', 7)
  const voicedChord = renderer.getVoicedChord(sourceEntry, session)
  const firstPresetShapes = source.getScaleVoicingChords({ presetId: firstPreset.id, key: session.key, scale: session.scale })
  const matchingShape = firstPresetShapes.find((candidate) => {
    return candidate.chord?.symbol === 'G'
  })
  assert.deepEqual(voicedChord.midiNotes, matchingShape?.chord?.midiNotes)
  assert.equal(voicedChord.symbol, 'G')

  session.voicing = secondPreset.id
  const duplicateEntry = model.createEntry('C')
  const duplicateChord = renderer.getVoicedChord(duplicateEntry, session)
  assert.equal(duplicateChord.symbol, 'C')

  const unavailableEntry = model.createEntry('Cmaj7')
  const adaptedChord = renderer.getVoicedChord(unavailableEntry, session)
  assert.equal(adaptedChord.symbol, 'Cmaj7')
  assert.deepEqual(adaptedChord.midiNotes.map((midiNote) => midiNote % 12), [0, 4, 7, 11])

  session.voicing = source.voicingPresets[4].id
  const minorEntry = model.createEntry('Dmin')
  const adaptedMinor = renderer.getVoicedChord(minorEntry, session)
  assert.equal(adaptedMinor.symbol, 'Dmin')
  assert.deepEqual(adaptedMinor.midiNotes, [57, 62, 65])

  for (const preset of source.voicingPresets) {
    session.voicing = preset.id
    for (const symbol of ['C', 'Dmin', 'G7', 'Cmaj7']) {
      const entry = model.createEntry(symbol)
      const chord = renderer.getVoicedChord(entry, session)
      assert.equal(chord.symbol, symbol, `${preset.name}: ${symbol}`)
      assert.ok(chord.midiNotes.length > 0, `${preset.name}: ${symbol}`)
    }
  }
  return undefined
}

const checkChordVoicingSelection = async (model, renderer) => {
  const session = model.getInitialSession()
  const entry = model.createEntry('Cmaj7')
  session.progression = [entry]

  const standardClip = await renderer.renderProgression(session)
  const standardNotes = standardClip.notes.map((note) => note.midiNote)
  assert.deepEqual(standardNotes, [60, 64, 67, 71])

  session.voicing = 'open'
  const openClip = await renderer.renderProgression(session)
  const openNotes = openClip.notes.map((note) => note.midiNote)
  assert.deepEqual(openNotes, [60, 67, 76, 83])

  session.progression = [{ ...entry, voicing: 'drop2', inversion: 1 }]
  const droppedClip = await renderer.renderProgression(session)
  const droppedNotes = droppedClip.notes.map((note) => note.midiNote)
  assert.deepEqual(droppedNotes, [59, 64, 67, 72])
  return undefined
}

const getLeafValues = (options) => {
  const values = []
  for (const option of options) {
    const hasChildren = option.children !== undefined
    if (hasChildren) {
      values.push(...getLeafValues(option.children))
      continue
    }
    values.push(option.value)
  }
  return values
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
  const nestedValues = getLeafValues(model.performanceSelectOptions)
  const expectedValues = ['standard', ...templateIds]
  assert.deepEqual([...nestedValues].sort(), [...expectedValues].sort(), 'Nested select must expose every performance once')
  const inheritedValues = getLeafValues(model.inheritedPerformanceSelectOptions)
  assert.deepEqual([...inheritedValues].sort(), ['inherit', ...expectedValues].sort(), 'Per-chord select must add inherit')
  let checkedCount = 0
  for (const option of model.allPerformanceOptions) {
    for (const scenario of scenarios) {
      const scenarioCount = await checkScenarioSpeeds(model, renderer, library, option, scenario)
      checkedCount += scenarioCount
    }
  }
  const overrideCount = await checkOverrides(model, renderer, source, library)
  checkSourceVoicingSelection(model, renderer, source)
  await checkChordVoicingSelection(model, renderer)
  console.log(`Demo renderer: ${model.allPerformanceOptions.length} dropdown options, ${checkedCount} progression/MIDI checks, ${overrideCount} category override checks passed.`)
} finally {
  await server.close()
}

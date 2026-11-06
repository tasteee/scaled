import * as assert from 'node:assert/strict'
import * as url from 'node:url'
import * as vite from 'vite'

const configurationPath = url.fileURLToPath(new URL('../demo/vite.config.ts', import.meta.url))
const samplerModule = 'scaled-playback-sampler'
const samplerPlugin = {
  name: samplerModule,
  enforce: 'pre',
  resolveId: (identifier) => {
    const isSampler = identifier === 'smplr'
    if (isSampler) return samplerModule
    return undefined
  },
  load: (identifier) => {
    const isSampler = identifier === samplerModule
    if (isSampler) return 'export const Soundfont = () => { return globalThis.scaledPlaybackTest.instrument }'
    return undefined
  }
}
const server = await vite.createServer({ configFile: configurationPath, plugins: [samplerPlugin], ssr: { noExternal: ['smplr'] }, server: { middlewareMode: true }, appType: 'custom' })
const originalAudioContext = globalThis.AudioContext
const originalSetTimeout = globalThis.setTimeout
const originalClearTimeout = globalThis.clearTimeout
const playedNotes = []
const audioContext = { currentTime: 0, resume: async () => { return undefined } }
const instrument = {
  ready: Promise.resolve(),
  start: (note) => { playedNotes.push(note); return undefined },
  stop: () => { return undefined }
}
globalThis.scaledPlaybackTest = { instrument }
globalThis.AudioContext = new Proxy(Object, { construct: () => { return audioContext } })
let scheduledCallback

try {
  const model = await server.ssrLoadModule('/demo/src/composer/model.ts')
  const renderer = await server.ssrLoadModule('/demo/src/composer/render.ts')
  const piano = await server.ssrLoadModule('/demo/src/piano.ts')
  const template = model.sourcePerformanceOptions[0]
  const initialSession = model.getInitialSession()
  const progression = ['C', 'Dm', 'F', 'F'].map((symbol) => { return model.createEntry(symbol) })
  const session = { ...initialSession, performance: template.value, progression }
  const clip = await renderer.renderProgression(session)
  assert.equal(clip.durationBeats, 16, 'Four bars must render sixteen quarter-note beats')
  for (const chord of progression) {
    const hasNotes = clip.notes.some((note) => { return note.chordId === chord.id })
    assert.ok(hasNotes, `${chord.symbol}: bass must play in every bar`)
  }
  globalThis.setTimeout = (callback) => { scheduledCallback = callback; return 1 }
  globalThis.clearTimeout = () => { scheduledCallback = undefined; return undefined }
  await piano.playClip(clip, 110, { shouldLoop: true })
  assert.equal(piano.audioStatus.state.error, '', 'Playback must initialize the test instrument')
  const startTime = 0.02
  const secondsPerBeat = 60 / 110
  const positions = [0.1, 4.1, 8.1, 12.1, 15.9, 16.1, 20.1]
  for (const elapsedBeats of positions) {
    audioContext.currentTime = startTime + elapsedBeats * secondsPerBeat
    assert.ok(scheduledCallback, 'Loop scheduling must remain active')
    scheduledCallback()
    const expectedBeat = elapsedBeats % 16
    const beatDifference = Math.abs(piano.playbackBeat.state - expectedBeat)
    assert.ok(beatDifference < 0.00001, `Highlight at beat ${elapsedBeats}: expected ${expectedBeat}, got ${piano.playbackBeat.state}`)
    assert.equal(piano.audioStatus.state.isLooping, true)
  }
  const playedPitchClasses = playedNotes.map((note) => { return note.note % 12 })
  assert.ok(playedPitchClasses.includes(0), 'Playback includes tonic bass')
  assert.ok(playedPitchClasses.includes(2), 'Playback includes second chord bass')
  assert.ok(playedPitchClasses.includes(5), 'Playback includes final two chord bass notes')
  piano.stopPlayback()
  assert.equal(scheduledCallback, undefined, 'Stop cancels the scheduler')
  console.log('Playback: first bass pattern plays all four bars; highlight wraps at sixteen beats, with matching chord roots.')
} finally {
  globalThis.AudioContext = originalAudioContext
  globalThis.setTimeout = originalSetTimeout
  globalThis.clearTimeout = originalClearTimeout
  delete globalThis.scaledPlaybackTest
  await server.close()
}

import * as filesystem from 'node:fs'
import * as path from 'node:path'
import * as operatingSystem from 'node:os'
import * as module from 'node:module'
import * as crypto from 'node:crypto'
import * as assert from 'node:assert/strict'
import * as catalog from '../dist/scaler.mjs'

const dependencyDirectory = path.join(operatingSystem.tmpdir(), 'scaler2-catalog-host')
const requireDependency = module.createRequire(path.join(dependencyDirectory, 'capture.cjs'))
const koffi = requireDependency('koffi')
const pluginPath = 'C:/Program Files/Steinberg/VSTPlugins/Scaler2.dll'
const pluginBytes = filesystem.readFileSync(pluginPath)
const binarySha256 = crypto.createHash('sha256').update(pluginBytes).digest('hex')
assert.equal(binarySha256, 'c2958bfc8d329d0f9752e87b07940d9467941858d49d0ace47b90fbca864445e')
const hostCallbackType = koffi.proto('intptr_t ProbeHostCallback(void *effect, int opcode, int index, intptr_t value, void *pointer, float option)')
const handleHostCallback = (effect, opcode) => {
  const isVersionRequest = opcode === 1
  if (isVersionRequest) return 2400
  const isSampleRateRequest = opcode === 16
  if (isSampleRateRequest) return 44100
  const isBlockSizeRequest = opcode === 17
  if (isBlockSizeRequest) return 512
  const isProcessLevelRequest = opcode === 23
  if (isProcessLevelRequest) return 1
  return 0
}
console.log('Loading exact Scaler DLL and opening headless VST instance')
const plugin = koffi.load(pluginPath)
const hostCallback = koffi.register(handleHostCallback, koffi.pointer(hostCallbackType))
const createPlugin = plugin.func('void *VSTPluginMain(void *hostCallback)')
const effect = createPlugin(hostCallback)
const effectAddress = koffi.address(effect)
const dispatcherAddress = koffi.decode(effectAddress + 8n, 'void *')
const dispatcherType = koffi.proto('intptr_t ProbeDispatch(void *effect, int opcode, int index, intptr_t value, void *pointer, float option)')
koffi.call(dispatcherAddress, dispatcherType, effect, 0, 0, 0, null, 0)
const kernel = koffi.load('kernel32.dll')
const getModuleHandle = kernel.func('void *GetModuleHandleW(str16 name)')
const pluginBase = koffi.address(getModuleHandle('Scaler2.dll'))
const readPointer = (address) => {
  return BigInt(koffi.decode(address, 'uint64_t'))
}
const processor = readPointer(effectAddress - 0x18n)
console.log('Initializing actual Scaler manager through processor', processor.toString(16))
const initializeProcessorType = koffi.proto('void InitializeProbeProcessor(void *processor)')
koffi.call(pluginBase + 0x5a8fb0n, initializeProcessorType, processor)
const manager = readPointer(processor + 0x1c0n)
assert.notEqual(manager, 0n)
const transform = manager + 0x9540n
const storedManager = readPointer(transform + 8n)
assert.equal(storedManager, manager)
const ticksPerBeat = koffi.decode(manager + 0x99d0n, 'int')
console.log('Manager ready', JSON.stringify({manager:manager.toString(16), ticksPerBeat}))
const initializeExpressionsType = koffi.proto('void InitializeProbeExpressions(void)')
koffi.call(pluginBase + 0x8066a0n, initializeExpressionsType)
const initializePlayableType = koffi.proto('void *InitializeProbePlayable(void *output)')
const addNotesType = koffi.proto('void AddProbeNotes(void *playable, void *notes, float velocity)')
const transformType = koffi.proto('void *TransformProbeExpression(void *transform, void *output, void *input, void *uuid, int speed, int mode, int scaleMode, uint strumStyle, int strumSpeed, int strumExpression, int strumVoicing, void *scaleKey)')

const releasePlayableType = koffi.proto('void ReleaseFixturePlayable(void *playable)')
const buildInput = (midiNotes) => {
  const input = Buffer.alloc(48)
  koffi.call(pluginBase + 0x7a6290n, initializePlayableType, input)
  const pitches = Buffer.alloc(midiNotes.length * 4)
  for (const entry of midiNotes.entries()) pitches.writeInt32LE(entry[1], entry[0] * 4)
  const pitchAddress = koffi.address(pitches)
  const vector = Buffer.alloc(24)
  const endAddress = pitchAddress + BigInt(pitches.length)
  vector.writeBigUInt64LE(pitchAddress, 0)
  vector.writeBigUInt64LE(endAddress, 8)
  vector.writeBigUInt64LE(endAddress, 16)
  koffi.call(pluginBase + 0x79a4a0n, addNotesType, input, vector, 0.7)
  return input
}
const readNotes = (output) => {
  const notes = []
  const sentinel = output.readBigUInt64LE(32)
  const visitNode = (address) => {
    const isSentinel = koffi.decode(address + 25n, 'uint8_t') !== 0
    if (isSentinel) return undefined
    visitNode(readPointer(address))
    const begin = readPointer(address + 40n)
    const end = readPointer(address + 48n)
    const noteCount = Number((end - begin) / 40n)
    const positions = Array.from({length:noteCount}, (unused, position) => {
      return position
    })
    for (const position of positions) {
      const note = begin + BigInt(position * 40)
      const startBeat = koffi.decode(note, 'double') / ticksPerBeat
      const durationBeats = koffi.decode(note + 16n, 'double') / ticksPerBeat
      const midiNote = koffi.decode(note + 24n, 'int')
      const velocity = koffi.decode(note + 28n, 'float')
      notes.push({startBeat,durationBeats,midiNote,velocity})
    }
    visitNode(readPointer(address + 16n))
    return undefined
  }
  visitNode(readPointer(sentinel + 8n))
  return notes
}
const categories = ['Bass','Melody','Phrases','Sequences','Grooves','StrummedSequences','Rhythms']
const templates = categories.map((category) => {
  const template = catalog.performanceTemplates.find((candidate) => {
    return candidate.category === category
  })
  assert.ok(template)
  return template
})
const chordInputs = [
  {symbol:'C', midiNotes:[60,64,67]},
  {symbol:'Cm', midiNotes:[60,63,67]},
  {symbol:'Cmaj7', midiNotes:[60,64,67,71]}
]
const fixtures = []
for (const template of templates) {
  for (const chord of chordInputs) {
    console.log('Capturing', template.category, template.name, chord.symbol)
    const input = buildInput(chord.midiNotes)
    const key = Buffer.from(template.id.replaceAll('-', ''), 'hex')
    const output = Buffer.alloc(48)
    const scaleKey = Buffer.alloc(32)
    koffi.call(pluginBase + 0x7ca940n, transformType, transform, output, input, key, 100, 0, 1, 1, 1, 0, 0, scaleKey)
    const notes = readNotes(output)
    const pitches = [...new Set(notes.map((note) => {
      return note.midiNote
    }))]
    fixtures.push({templateId:template.id, templateName:template.name, category:template.category,inputChord:chord.symbol,inputMidiNotes:chord.midiNotes,notes})
    console.log(JSON.stringify({count:notes.length,pitches}))
    koffi.call(pluginBase + 0x7a6130n, releasePlayableType, output)
  }
}
const result = {binarySha256, observedAt:new Date().toISOString(),ticksPerBeat,inputVelocity:0.7,parameters:{speedPercent:100,mode:0,scaleMode:1,strumStyle:1,strumSpeed:1,strumExpression:0,strumVoicing:0,scaleKey:'zero bytes'},limitations:['Input contains MIDI notes but no chordName metadata. These observations establish selected invocation output, not every UI default or category mode.'],fixtures}
filesystem.writeFileSync(new URL('./catalog/expressionTransformFixtures.json', import.meta.url), JSON.stringify(result,null,2))
console.log('Closing VST instance')
koffi.call(dispatcherAddress, dispatcherType, effect, 1, 0, 0, null, 0)
console.log('Captured', fixtures.length, 'full native ExpressionTransform fixtures')
process.exit(0)

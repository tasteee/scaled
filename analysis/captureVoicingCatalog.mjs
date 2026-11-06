import * as filesystem from 'node:fs'
import * as operatingSystem from 'node:os'
import * as path from 'node:path'
import * as module from 'node:module'
import * as crypto from 'node:crypto'

const dependencyDirectory = path.join(operatingSystem.tmpdir(), 'scaler2-catalog-host')
const requireDependency = module.createRequire(path.join(dependencyDirectory, 'capture.cjs'))
const koffi = requireDependency('koffi')
const pluginPath = 'C:/Program Files/Steinberg/VSTPlugins/Scaler2.dll'
const pluginBytes = filesystem.readFileSync(pluginPath)
const binarySha256 = crypto.createHash('sha256').update(pluginBytes).digest('hex')
const expectedSha256 = 'c2958bfc8d329d0f9752e87b07940d9467941858d49d0ace47b90fbca864445e'
const isExpectedBinary = binarySha256 === expectedSha256
if (!isExpectedBinary) throw new Error('Installed DLL differs from the analyzed Scaler 2.9.0 binary')

const hostCallbackType = koffi.proto('intptr_t VoicingHostCallback(void *effect, int opcode, int index, intptr_t value, void *pointer, float option)')
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

console.log('Loading checked Scaler 2.9.0 DLL for native voicing capture')
const plugin = koffi.load(pluginPath)
const hostCallback = koffi.register(handleHostCallback, koffi.pointer(hostCallbackType))
const createPlugin = plugin.func('void *VSTPluginMain(void *hostCallback)')
const effect = createPlugin(hostCallback)
if (!effect) throw new Error('VSTPluginMain returned a null effect')
const effectAddress = koffi.address(effect)
const dispatcherAddress = koffi.decode(effectAddress + 8n, 'void *')
const dispatcherType = koffi.proto('intptr_t VoicingDispatch(void *effect, int opcode, int index, intptr_t value, void *pointer, float option)')
koffi.call(dispatcherAddress, dispatcherType, effect, 0, 0, 0, null, 0)
const kernel = koffi.load('kernel32.dll')
const getModuleHandle = kernel.func('void *GetModuleHandleW(str16 name)')
const pluginBase = koffi.address(getModuleHandle('Scaler2.dll'))
const initializeCatalogType = koffi.proto('void VoicingInitializeCatalog(void)')
const initializerOffsets = [0x7904b0n, 0x78efc0n, 0x78dab0n, 0x78d700n, 0x78c9d0n, 0x78cf40n]
const chordTypeCount = koffi.decode(pluginBase + 0x2dcf118n, 'uint64_t')
const hasCatalogs = Number(chordTypeCount) > 0
if (!hasCatalogs) {
  for (const offset of initializerOffsets) koffi.call(pluginBase + offset, initializeCatalogType)
}
const initializeSuggestionsType = koffi.proto('void *VoicingInitializeSuggestions(void *owner)')
koffi.call(pluginBase + 0x8129b0n, initializeSuggestionsType, null)

const readPointer = (address) => {
  const value = koffi.decode(address, 'uint64_t')
  return BigInt(value)
}
const readString = (address) => {
  return koffi.decode(address, 'str')
}
const readTreeNodes = (sentinel) => {
  const nodes = []
  const visitNode = (address) => {
    const isSentinel = koffi.decode(address + 25n, 'uint8_t') !== 0
    if (isSentinel) return undefined
    visitNode(readPointer(address))
    nodes.push(address)
    visitNode(readPointer(address + 16n))
    return undefined
  }
  visitNode(readPointer(sentinel + 8n))
  return nodes
}
const readIdentity = (address) => {
  const bytes = Buffer.from(koffi.decode(address, 'uint8_t', 32))
  return bytes.toString('hex')
}
const retainShared = (address) => {
  const shared = Buffer.alloc(16)
  const object = readPointer(address)
  const control = readPointer(address + 8n)
  shared.writeBigUInt64LE(object, 0)
  shared.writeBigUInt64LE(control, 8)
  const hasControl = control !== 0n
  if (hasControl) {
    const references = koffi.decode(control + 8n, 'int')
    koffi.encode(control + 8n, 'int', references + 1)
  }
  return shared
}

const sourceScaleNodes = readTreeNodes(readPointer(pluginBase + 0x2dcf180n))
const sourceScales = new Map()
for (const node of sourceScaleNodes) sourceScales.set(readIdentity(node + 32n), node + 64n)
const sourceIdentityNodes = readTreeNodes(readPointer(pluginBase + 0x2dcf530n))
const sourceIdentities = new Map()
for (const node of sourceIdentityNodes) {
  const identifier = koffi.decode(node + 28n, 'int')
  sourceIdentities.set(identifier, readIdentity(node + 32n))
}
const presetNodes = readTreeNodes(readPointer(pluginBase + 0x2dcf568n))
const scaleBegin = readPointer(pluginBase + 0x2dcf120n)
const scaleEnd = readPointer(pluginBase + 0x2dcf128n)
const targetScaleCount = Number((scaleEnd - scaleBegin) / 16n)
const scalePositions = Array.from({ length: targetScaleCount }, (_, position) => {
  return scaleBegin + BigInt(position * 16)
})
const getNotesType = koffi.proto('void *VoicingGetChordNotes(void *chord, void *output, int useVoicing)')
const adaptSequenceType = koffi.proto('void *VoicingAdaptSequence(void *output, void *preset, void *sourceScale, void *targetScale, int octave, bool preserveRegister)')
const rawSequenceType = koffi.proto('void *VoicingRawSequence(void *output, void *preset, int octave)')

const readChord = (chordPosition, sourceSlot) => {
  const chord = readPointer(chordPosition)
  const isMissingChord = chord === 0n
  if (isMissingChord) return null
  const output = Buffer.alloc(24)
  koffi.call(pluginBase + 0x7a5e90n, getNotesType, chord, output, 1)
  const begin = output.readBigUInt64LE(0)
  const end = output.readBigUInt64LE(8)
  const count = Number((end - begin) / 4n)
  const hasNotes = count > 0
  const midiNotes = hasNotes ? Array.from(koffi.decode(begin, 'int', count)) : []
  const rootNote = readPointer(chord + 48n)
  const chordType = readPointer(chord + 64n)
  const rootPitch = rootNote === 0n ? null : koffi.decode(rootNote + 48n, 'int')
  const chordTypeName = chordType === 0n ? null : readString(chordType)
  return { sourceSlot, rootPitch, chordType: chordTypeName, midiNotes }
}
const captureSequence = (presetNode, targetPosition) => {
  const identifier = koffi.decode(presetNode + 32n, 'int')
  const identity = sourceIdentities.get(identifier)
  const sourcePosition = sourceScales.get(identity)
  const output = Buffer.alloc(24)
  const preset = retainShared(presetNode + 40n)
  const hasSourceScale = sourcePosition !== undefined && readPointer(sourcePosition) !== 0n
  if (hasSourceScale) {
    const sourceScale = retainShared(sourcePosition)
    const targetScale = retainShared(targetPosition)
    koffi.call(pluginBase + 0x80ec50n, adaptSequenceType, output, preset, sourceScale, targetScale, 3, false)
  }
  if (!hasSourceScale) koffi.call(pluginBase + 0x811460n, rawSequenceType, output, preset, 3)
  const begin = output.readBigUInt64LE(0)
  const end = output.readBigUInt64LE(8)
  const count = Number((end - begin) / 16n)
  const isUnexpectedLength = count < 0 || count > 32
  if (isUnexpectedLength) throw new Error(`Unexpected voicing sequence length: ${count}`)
  const positions = Array.from({ length: count }, (_, position) => {
    return position
  })
  const chords = positions.map((position) => {
    const chordPosition = begin + BigInt(position * 16)
    return readChord(chordPosition, position + 1)
  })
  return { hasSourceScale, chords }
}

const isSmokeRun = process.argv.includes('--smoke')
const selectedScalePositions = isSmokeRun ? scalePositions.slice(0, 2) : scalePositions
const presets = presetNodes.map((presetNode) => {
  const presetObject = readPointer(presetNode + 40n)
  const name = readString(presetObject)
  const identifier = koffi.decode(presetNode + 32n, 'int')
  console.log(`Capturing ${name}`)
  const targets = selectedScalePositions.map((targetPosition) => {
    const target = readPointer(targetPosition)
    const tonic = readPointer(target + 168n)
    const tonicPitch = koffi.decode(tonic + 48n, 'int')
    const scaleType = readPointer(target + 184n)
    const scaleName = readString(scaleType + 8n)
    const sequence = captureSequence(presetNode, targetPosition)
    return { tonicPitch, scaleName, hasSourceScale: sequence.hasSourceScale, chords: sequence.chords }
  })
  return { nativeIdentifier: identifier, name, targets }
})
const outputName = isSmokeRun ? 'voicingChords.smoke.json' : 'voicingChords.json'
const outputPath = new URL(`catalog/${outputName}`, import.meta.url)
const result = { octave: 4, nativeOctaveArgument: 3, presetCount: presets.length, targetScaleCount: selectedScalePositions.length, presets }
const outputText = JSON.stringify(result)
filesystem.writeFileSync(outputPath, outputText)
const outputSha256 = crypto.createHash('sha256').update(outputText).digest('hex')
const manifest = { pluginPath, binarySha256, outputSha256, capturedAt: new Date().toISOString(), method: 'Native 0x18080ec50 sequence adaptation with loader-inferred source scales and native 0x1807a5e90 notes; fallback 0x180811460 when native source scale is absent', wasEditorOpened: false, wasAudioProcessed: false, nativeOctaveArgument: 3, presetCount: presets.length, targetScaleCount: selectedScalePositions.length }
filesystem.writeFileSync(new URL(`catalog/${outputName}.manifest.json`, import.meta.url), JSON.stringify(manifest, null, 2))
koffi.call(dispatcherAddress, dispatcherType, effect, 1, 0, 0, null, 0)
console.log(JSON.stringify(manifest))
process.exit(0)

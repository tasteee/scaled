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

const hostCallbackType = koffi.proto('intptr_t RhythmHostCallback(void *effect, int opcode, int index, intptr_t value, void *pointer, float option)')
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
console.log('Loading Scaler and opening headless VST instance')
const plugin = koffi.load(pluginPath)
const hostCallback = koffi.register(handleHostCallback, koffi.pointer(hostCallbackType))
const createPlugin = plugin.func('void *VSTPluginMain(void *hostCallback)')
const effect = createPlugin(hostCallback)
const effectAddress = koffi.address(effect)
const dispatcherAddress = koffi.decode(effectAddress + 8n, 'void *')
const dispatcherType = koffi.proto('intptr_t RhythmDispatch(void *effect, int opcode, int index, intptr_t value, void *pointer, float option)')
koffi.call(dispatcherAddress, dispatcherType, effect, 0, 0, 0, null, 0)
const kernel = koffi.load('kernel32.dll')
const getModuleHandle = kernel.func('void *GetModuleHandleW(str16 name)')
const pluginBase = koffi.address(getModuleHandle('Scaler2.dll'))
const initializeExpressionsType = koffi.proto('void InitializeRhythmExpressions(void)')
console.log('Initializing native expression catalog')
koffi.call(pluginBase + 0x8066a0n, initializeExpressionsType)
const lookupType = koffi.proto('void *LookupRhythm(void *output, void *key)')
const expandType = koffi.proto('void *ExpandRhythm(void *owner, void *output, void *source, int targetNoteCount)')
const releaseSharedType = koffi.proto('void ReleaseRhythmShared(void *source)')

const readEvents = (expression) => {
  const begin = BigInt(koffi.decode(expression + 0x60n, 'uint64_t'))
  const end = BigInt(koffi.decode(expression + 0x68n, 'uint64_t'))
  const count = Number((end - begin) / 32n)
  const positions = Array.from({ length: count }, (unused, position) => {
    return position
  })
  const events = positions.map((position) => {
    const address = begin + BigInt(position * 32)
    const values = Array.from(koffi.decode(address, 'int', 8))
    return { sourcePitchIndex: values[1], sourceMidiNote: values[2], velocity: values[3], startTicks: values[4], startOffsetTicks: values[5], durationTicks: values[6], durationOffsetTicks: values[7] }
  })
  return events
}

const rhythms = catalog.performanceTemplates.filter(catalog.canAdaptRhythmTemplate)
const checks = []
const noteCounts = [1, 2, 3, 4, 5, 6, 7]
for (const template of rhythms) {
  const identifierHex = template.id.replaceAll('-', '')
  const key = Buffer.from(identifierHex, 'hex')
  const source = Buffer.alloc(16)
  koffi.call(pluginBase + 0x812820n, lookupType, source, key)
  const sourceExpression = source.readBigUInt64LE(0)
  assert.notEqual(sourceExpression, 0n)
  for (const targetNoteCount of noteCounts) {
    const control = source.readBigUInt64LE(8)
    const referenceCount = koffi.decode(control + 8n, 'int')
    koffi.encode(control + 8n, 'int', referenceCount + 1)
    const consumedSource = Buffer.from(source)
    const output = Buffer.alloc(16)
    koffi.call(pluginBase + 0x7ca650n, expandType, null, output, consumedSource, targetNoteCount)
    const expression = output.readBigUInt64LE(0)
    const events = readEvents(expression)
    const filteredEvents = events.filter((event) => {
      return event.sourcePitchIndex < targetNoteCount
    })
    const pattern = catalog.adaptRhythmTemplate({ template, targetNoteCount })
    assert.equal(filteredEvents.length, pattern.events.length)
    const convertNative = (event) => {
      const resolution = template.provenance.ticksPerBeat
      return [event.sourcePitchIndex, event.startTicks / resolution, event.durationTicks / resolution, event.velocity]
    }
    const convertPattern = (event) => {
      return [event.pitch.index, event.startBeat, event.durationBeats, event.velocity]
    }
    const orderEvents = (firstEvent, secondEvent) => {
      const firstKey = JSON.stringify(firstEvent)
      const secondKey = JSON.stringify(secondEvent)
      return firstKey.localeCompare(secondKey)
    }
    const nativeValues = filteredEvents.map(convertNative).sort(orderEvents)
    const adaptedValues = pattern.events.map(convertPattern).sort(orderEvents)
    assert.deepEqual(adaptedValues, nativeValues)
    checks.push({ templateId: template.id, targetNoteCount, eventCount: events.length, matched: true })
    koffi.call(pluginBase + 0x189d0n, releaseSharedType, output)
  }
  koffi.call(pluginBase + 0x189d0n, releaseSharedType, source)
}

console.log('Closing VST instance')
koffi.call(dispatcherAddress, dispatcherType, effect, 1, 0, 0, null, 0)
const manifest = { binarySha256, observedAt: new Date().toISOString(), method: 'Direct native ExpressionSet expansion at 0x1807ca650; filtered to target voice count as in Rhythms branch', limitations: ['Checks voice adaptation, event timings and velocities; does not execute the full ExpressionTransform or compare audio output.'], checks }
const manifestText = JSON.stringify(manifest, null, 2)
filesystem.writeFileSync(new URL('./catalog/rhythmAdaptationManifest.json', import.meta.url), manifestText)
console.log(`Matched ${checks.length} native rhythm adaptations`)
process.exit(0)

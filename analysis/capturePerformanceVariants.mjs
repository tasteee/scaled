import * as filesystem from 'node:fs'
import * as hostLibrary from './nativeExpressionHost.mjs'
import * as catalog from '../dist/scaler.mjs'

const host = hostLibrary.createNativeExpressionHost()
const indexedIds = new Set(catalog.performanceTemplates.map((template) => {
  return template.id
}))
const resourceSentinel = host.readPointer(host.pluginBase + 0x2dcf5d8n)
const nodes = []
const visit = (address) => {
  const isSentinel = host.koffi.decode(address + 25n, 'uint8_t') !== 0
  if (isSentinel) return undefined
  visit(host.readPointer(address))
  nodes.push(address)
  visit(host.readPointer(address + 16n))
  return undefined
}
visit(host.readPointer(resourceSentinel + 8n))
const sourceScaleType = host.koffi.proto('void *GetVariantSourceScale(void *owner, void *output, void *key)')
const releaseSharedType = host.koffi.proto('void ReleaseVariantShared(void *shared)')
const readUuid = (address) => {
  const bytes = Buffer.from(host.koffi.decode(address, 'uint8_t', 16))
  const hex = bytes.toString('hex')
  const uuid = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
  return uuid
}
const resources = []
const nativeIndex = []
for (const node of nodes) {
  const expression = host.readPointer(node + 40n)
  const isMissing = expression === 0n
  if (isMissing) continue
  const key = host.koffi.decode(node + 32n, 'str')
  const id = readUuid(expression + 0x78n)
  nativeIndex.push({ key, id })
  const isIndexed = indexedIds.has(id)
  if (isIndexed) continue
  const name = host.koffi.decode(expression, 'str')
  const category = host.koffi.decode(expression + 32n, 'str')
  const subcategory = host.koffi.decode(expression + 40n, 'str')
  const ticksPerBeat = host.koffi.decode(expression + 48n, 'int')
  const lastPosition = host.koffi.decode(expression + 56n, 'int')
  const durationBeats = lastPosition / ticksPerBeat
  const referenceBegin = host.readPointer(expression + 0x40n)
  const referenceEnd = host.readPointer(expression + 0x48n)
  const referenceCount = Number((referenceEnd - referenceBegin) / 4n)
  const referenceMidiNotes = Array.from(host.koffi.decode(referenceBegin, 'int', referenceCount))
  const eventBegin = host.readPointer(expression + 0x60n)
  const eventEnd = host.readPointer(expression + 0x68n)
  const eventCount = Number((eventEnd - eventBegin) / 32n)
  const positions = Array.from({ length: eventCount }, (unused, position) => {
    return position
  })
  const events = positions.map((position) => {
    const address = eventBegin + BigInt(position * 32)
    const values = Array.from(host.koffi.decode(address, 'int', 8))
    return { id: values[0], sourcePitchIndex: values[1], sourceMidiNote: values[2], velocity: values[3], startBeat: values[4] / ticksPerBeat, startOffsetBeats: values[5] / ticksPerBeat, durationBeats: values[6] / ticksPerBeat, durationOffsetBeats: values[7] / ticksPerBeat }
  })
  const octaveDifference = host.koffi.decode(expression + 0x88n, 'int')
  const identifier = Buffer.from(id.replaceAll('-', ''), 'hex')
  const scaleOutput = Buffer.alloc(16)
  host.koffi.call(host.pluginBase + 0x7cf690n, sourceScaleType, null, scaleOutput, identifier)
  const scale = scaleOutput.readBigUInt64LE(0)
  let sourceScale = null
  const hasScale = scale !== 0n
  if (hasScale) {
    const tonic = host.readPointer(scale + 168n)
    const tonicPitch = host.koffi.decode(tonic + 48n, 'int')
    const definition = host.readPointer(scale + 184n)
    const scaleName = host.koffi.decode(definition + 8n, 'str')
    sourceScale = { tonicPitch, scaleName }
  }
  resources.push({ key, id, name, category, subcategory, durationBeats, referenceMidiNotes, octaveDifference, events, sourceScale })
  host.koffi.call(host.pluginBase + 0x189d0n, releaseSharedType, scaleOutput)
}
host.close()
const result = { binarySha256: host.binarySha256, observedAt: new Date().toISOString(), method: 'Native expression name-key index including resources outside factory menu', nativeIndex, resources }
filesystem.writeFileSync(new URL('./catalog/performanceVariants.json', import.meta.url), JSON.stringify(result, null, 2))
console.log(JSON.stringify({ nativeKeys: nativeIndex.length, extraResources: resources.length, samples: resources.slice(0, 3).map((resource) => {
  return { key: resource.key, id: resource.id, sourceScale: resource.sourceScale, durationBeats: resource.durationBeats }
}) }))
process.exit(0)

import * as filesystem from 'node:fs'
import * as hostLibrary from './nativeExpressionHost.mjs'
import * as catalog from '../dist/scaler.mjs'

const host = hostLibrary.createNativeExpressionHost()
const lookupType = host.koffi.proto('void *LookupContextExpression(void *output, void *key)')
const sourceScaleType = host.koffi.proto('void *GetContextSourceScale(void *owner, void *output, void *key)')
const releaseSharedType = host.koffi.proto('void ReleaseContextShared(void *shared)')
const readString = (address) => {
  return host.koffi.decode(address, 'str')
}
const readScale = (scale) => {
  const isMissing = scale === 0n
  if (isMissing) return null
  const tonic = host.readPointer(scale + 168n)
  const tonicPitch = host.koffi.decode(tonic + 48n, 'int')
  const definition = host.readPointer(scale + 184n)
  const scaleName = readString(definition + 8n)
  return { tonicPitch, scaleName }
}
const templates = []
for (const template of catalog.performanceTemplates) {
  const identifier = Buffer.from(template.id.replaceAll('-', ''), 'hex')
  const output = Buffer.alloc(16)
  host.koffi.call(host.pluginBase + 0x812820n, lookupType, output, identifier)
  const expression = output.readBigUInt64LE(0)
  const positions = [0, 1, 2, 3, 4, 5]
  const strings = positions.map((position) => {
    const address = expression + BigInt(position * 8)
    return readString(address)
  })
  const scaleOutput = Buffer.alloc(16)
  host.koffi.call(host.pluginBase + 0x7cf690n, sourceScaleType, null, scaleOutput, identifier)
  const scale = scaleOutput.readBigUInt64LE(0)
  const sourceScale = readScale(scale)
  const sourceScaleKey = Buffer.from(host.koffi.decode(expression + 0x8cn, 'uint8_t', 32)).toString('hex')
  templates.push({ templateId: template.id, name: template.name, category: template.category, strings, sourceScale, sourceScaleKey })
  host.koffi.call(host.pluginBase + 0x189d0n, releaseSharedType, scaleOutput)
  host.koffi.call(host.pluginBase + 0x189d0n, releaseSharedType, output)
}
host.close()
const result = { binarySha256: host.binarySha256, observedAt: new Date().toISOString(), method: 'Native source context 0x1807cf690 and original ExpressionSet strings/scale key', templates }
filesystem.writeFileSync(new URL('./catalog/performanceContexts.json', import.meta.url), JSON.stringify(result, null, 2))
console.log(JSON.stringify(templates.slice(0, 4)))
console.log(`Captured ${templates.length} native source contexts`)
process.exit(0)

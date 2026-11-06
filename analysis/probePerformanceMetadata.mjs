import * as hostLibrary from './nativeExpressionHost.mjs'
import * as metadata from './nativeChordMetadata.mjs'
import * as catalog from '../dist/scaler.mjs'

const host = hostLibrary.createNativeExpressionHost()
const template = catalog.performanceTemplates.find((candidate) => {
  return candidate.name === 'Basic 1' && candidate.category === 'Bass'
})
const playable = host.buildInput([60, 63, 67])
metadata.setNativeChordName(host, playable, 'C min')
const transformType = host.koffi.proto('void *TransformMetadataExpression(void *transform, void *output, void *input, void *uuid, int speed, int mode, int scaleMode, uint strumStyle, int strumSpeed, int strumExpression, int strumVoicing, void *scaleKey)')
const output = Buffer.alloc(48)
const key = Buffer.from(template.id.replaceAll('-', ''), 'hex')
host.koffi.call(host.pluginBase + 0x7ca940n, transformType, host.transform, output, playable, key, 100, 0, 1, 1, 1, 0, 0, Buffer.alloc(32))
const notes = host.readNotes(output)
console.log(JSON.stringify(notes))
host.close()
process.exit(0)

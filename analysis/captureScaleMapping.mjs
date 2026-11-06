import * as filesystem from 'node:fs'
import * as crypto from 'node:crypto'
import * as assert from 'node:assert/strict'
import * as url from 'node:url'
import * as path from 'node:path'
import * as native from './nativeExpressionHost.mjs'

const host = native.createNativeExpressionHost()
const koffi = host.koffi
const readPointer = host.readPointer
const scaleBegin = readPointer(host.pluginBase + 0x2dcf120n)
const scaleEnd = readPointer(host.pluginBase + 0x2dcf128n)
const scaleCount = Number((scaleEnd - scaleBegin) / 16n)
const scalePositions = Array.from({ length: scaleCount }, (_, position) => {
  return scaleBegin + BigInt(position * 16)
})
const describeScale = (position) => {
  const scale = readPointer(position)
  const tonic = readPointer(scale + 168n)
  const tonicPitch = koffi.decode(tonic + 48n, 'int')
  const definition = readPointer(scale + 184n)
  const name = koffi.decode(definition + 8n, 'str')
  return { position, tonicPitch, name }
}
const allScales = scalePositions.map(describeScale)
const referenceScales = allScales.filter((scale) => {
  return scale.tonicPitch === 0
})
assert.equal(referenceScales.length, 76)
const retainShared = (position) => {
  const shared = Buffer.alloc(16)
  const object = readPointer(position)
  const control = readPointer(position + 8n)
  shared.writeBigUInt64LE(object, 0)
  shared.writeBigUInt64LE(control, 8)
  const references = koffi.decode(control + 8n, 'int')
  koffi.encode(control + 8n, 'int', references + 1)
  return shared
}
const mapNotesType = koffi.proto('void *CaptureScaleMap(void *output, void *notes, void *sourceScale, void *targetScale, bool preserveRegister)')
const captureNotes = (input) => {
  const notes = Buffer.alloc(input.notes.length * 4)
  for (const entry of input.notes.entries()) notes.writeInt32LE(entry[1], entry[0] * 4)
  const address = koffi.address(notes)
  const vector = Buffer.alloc(24)
  vector.writeBigUInt64LE(address, 0)
  const end = address + BigInt(notes.length)
  vector.writeBigUInt64LE(end, 8)
  vector.writeBigUInt64LE(end, 16)
  const sourceScale = retainShared(input.source.position)
  const targetScale = retainShared(input.target.position)
  const output = Buffer.alloc(24)
  koffi.call(host.pluginBase + 0x7a1ce0n, mapNotesType, output, vector, sourceScale, targetScale, input.shouldPreserveNearestRegister ?? false)
  const outputBegin = output.readBigUInt64LE(0)
  const outputEnd = output.readBigUInt64LE(8)
  const count = Number((outputEnd - outputBegin) / 4n)
  const hasNoNotes = count === 0
  if (hasNoNotes) return []
  const mapped = Array.from(koffi.decode(outputBegin, 'int', count))
  return mapped
}
let capturedPitchCount = 0
const mappings = referenceScales.map((source) => {
  console.log(`Mapping ${source.name}`)
  const targets = referenceScales.map((target) => {
    const pitches = Array.from({ length: 12 }, (_, position) => {
      return position
    })
    const mapping = pitches.map((pitch) => {
      const inputNote = 60 + pitch
      const notes = captureNotes({ source, target, notes: [inputNote] })
      assert.ok(notes.length <= 1)
      capturedPitchCount += 1
      const outputNote = notes[0]
      const hasNoNote = outputNote === undefined
      if (hasNoNote) return null
      return outputNote - 60
    })
    return mapping
  })
  return targets
})
const scaleNames = referenceScales.map((scale) => {
  return scale.name
})
const negativeMappings = referenceScales.map((reference) => {
  const source = allScales.find((candidate) => {
    const hasMatchingTonic = candidate.tonicPitch === 11
    const hasMatchingScale = candidate.name === reference.name
    return hasMatchingTonic && hasMatchingScale
  })
  assert.ok(source)
  const targets = referenceScales.map((target) => {
    const relativePositions = Array.from({ length: 11 }, (_, position) => {
      return position
    })
    const mapping = relativePositions.map((position) => {
      const notes = captureNotes({ source, target, notes: [position] })
      assert.ok(notes.length <= 1)
      capturedPitchCount += 1
      const outputNote = notes[0]
      const hasNoNote = outputNote === undefined
      if (hasNoNote) return null
      return outputNote
    })
    return mapping
  })
  return targets
})
const result = { scaleNames, mappings, negativeMappings }
const outputText = JSON.stringify(result)
filesystem.writeFileSync(new URL('../src/data/scaleMapping.json', import.meta.url), outputText)
const outputSha256 = crypto.createHash('sha256').update(outputText).digest('hex')
const manifest = { binarySha256: host.binarySha256, outputSha256, capturedPitchCount, observedAt: new Date().toISOString(), method: 'Native 0x1807a1ce0 scalar mappings for all 76 source and target scales. Positive relative pitches use C4 through B4 with source and target in C; negative relative pitches use MIDI0 through10 with source in B and target in C. Portable code preserves signed-remainder behavior, sorting, deduplication and tonic/register transformations.' }
filesystem.writeFileSync(new URL('catalog/scaleMapping.manifest.json', import.meta.url), JSON.stringify(manifest, null, 2))
console.log(JSON.stringify(manifest))
const shouldVerify = process.argv.includes('--verify')
if (shouldVerify) {
  const moduleFlag = process.argv.indexOf('--module')
  const moduleArgument = process.argv[moduleFlag + 1]
  const modulePath = moduleFlag >= 0 ? moduleArgument : 'dist/scaler.mjs'
  assert.ok(modulePath)
  const moduleUrl = url.pathToFileURL(path.resolve(modulePath))
  const library = await import(moduleUrl.href)
  const keyNames = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
  const sourceContexts = JSON.parse(filesystem.readFileSync(new URL('catalog/performanceContexts.json', import.meta.url), 'utf8'))
  const uniqueSources = new Map()
  for (const template of sourceContexts.templates) {
    const context = template.sourceScale
    const identity = `${context.tonicPitch}:${context.scaleName}`
    uniqueSources.set(identity, context)
  }
  let comparedVectors = 0
  const inputNotes = [24, 35, 36, 48, 55, 60, 61, 64, 67, 72, 84]
  const registerModes = [false, true]
  for (const sourceContext of uniqueSources.values()) {
    const source = allScales.find((candidate) => {
      const hasMatchingTonic = candidate.tonicPitch === sourceContext.tonicPitch
      const hasMatchingScale = candidate.name === sourceContext.scaleName
      return hasMatchingTonic && hasMatchingScale
    })
    assert.ok(source)
    for (const target of allScales) {
      for (const shouldPreserveNearestRegister of registerModes) {
        const expected = captureNotes({ source, target, notes: inputNotes, shouldPreserveNearestRegister })
        const actual = library.mapScaleNotes({ midiNotes: inputNotes, sourceKey: keyNames[source.tonicPitch], sourceScale: source.name, targetKey: keyNames[target.tonicPitch], targetScale: target.name, shouldPreserveNearestRegister })
        const contextLabel = `${source.tonicPitch} ${source.name} -> ${target.tonicPitch} ${target.name}, nearest=${shouldPreserveNearestRegister}`
        assert.deepEqual(actual, expected, contextLabel)
        comparedVectors += 1
      }
    }
  }
  const lowNotes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  for (const sourceContext of uniqueSources.values()) {
    const source = allScales.find((candidate) => {
      const hasMatchingTonic = candidate.tonicPitch === sourceContext.tonicPitch
      const hasMatchingScale = candidate.name === sourceContext.scaleName
      return hasMatchingTonic && hasMatchingScale
    })
    assert.ok(source)
    for (const target of allScales) {
      const expected = captureNotes({ source, target, notes: lowNotes })
      const hasInvalidOutput = expected.some((note) => {
        const isInvalid = note < 0 || note > 127
        return isInvalid
      })
      const input = { midiNotes: lowNotes, sourceKey: keyNames[source.tonicPitch], sourceScale: source.name, targetKey: keyNames[target.tonicPitch], targetScale: target.name }
      if (hasInvalidOutput) {
        assert.throws(() => {
          return library.mapScaleNotes(input)
        }, /MIDI note/)
      }
      if (!hasInvalidOutput) {
        const actual = library.mapScaleNotes(input)
        assert.deepEqual(actual, expected)
      }
      comparedVectors += 1
    }
  }
  const verification = { comparedVectors, sourceContextCount: uniqueSources.size, targetContextCount: allScales.length, registerModeCount: registerModes.length }
  const verifiedManifest = { ...manifest, verification }
  filesystem.writeFileSync(new URL('catalog/scaleMapping.manifest.json', import.meta.url), JSON.stringify(verifiedManifest, null, 2))
  console.log(JSON.stringify(verification))
}
host.close()
process.exit(0)

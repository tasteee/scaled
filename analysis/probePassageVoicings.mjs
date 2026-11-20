import * as filesystem from 'node:fs'
import * as nativeHost from './nativeExpressionHost.mjs'
import { scaled } from '../dist/index.mjs'

const host = nativeHost.createNativeExpressionHost()
const templates = scaled.performanceTemplates.filter((template) => {
  return template.category === 'Passages'
})

const voicings = [
  [48, 64, 67, 72], [48, 64, 67, 71], [48, 64, 67, 73],
  [48, 60, 64, 67], [48, 64, 67], [60, 64, 67, 72],
  [60, 62, 64, 65], [60, 62, 64, 66], [60, 62, 64, 67],
  [60, 62, 64, 68], [60, 62, 64, 66, 67], [60, 62, 64, 66, 68],
  [60, 62, 64, 66, 69], [60, 62, 64, 66, 70],
  [60, 61, 64, 66], [60, 63, 64, 66], [61, 62, 64, 66],
  [48, 62, 64, 66], [72, 74, 76, 78]
]
const holdoutVoicings = [
  [48, 64, 67, 84], [60, 64, 67, 73], [60, 64, 67, 74],
  [60, 64, 67, 75], [60, 64, 67, 76], [60, 64, 67, 79],
  [60, 62, 64, 66, 74], [60, 62, 64, 66, 79],
  [64, 67, 72], [67, 72, 76]
]
const stressVoicings = [
  [60], [60, 64], [60, 72], [64, 67, 72], [55, 60, 64],
  [48, 60, 72], [60, 64, 72], [60, 72, 84], [60, 64, 76],
  [64, 67, 71], [61, 63, 65, 68],
  [48, 60, 64, 67, 72, 76], [60, 62, 64, 66, 68, 70],
  [60, 64, 67, 71, 74, 79], [60, 61, 62, 63, 64, 65],
  [60, 61, 62, 63, 64, 65, 66],
  [48, 55, 60, 64, 67, 72, 76, 79]
]
const shouldCaptureHoldout = process.argv.includes('--holdout')
const shouldCaptureStress = process.argv.includes('--stress')
let selectedVoicings = voicings
if (shouldCaptureHoldout) selectedVoicings = holdoutVoicings
if (shouldCaptureStress) selectedVoicings = stressVoicings

const passageType = host.koffi.proto('void *RenderProofPassage(void *transform, void *output, void *input, void *uuid, float timeScale, void *scaleKey)')
const fixtures = []

for (const template of templates) {
  for (const midiNotes of selectedVoicings) {
    const input = host.buildInput(midiNotes)
    const output = Buffer.alloc(48)
    const uuid = Buffer.from(template.id.replaceAll('-', ''), 'hex')
    const scaleKey = Buffer.alloc(32)
    const timeScale = 4 * host.ticksPerBeat
    host.koffi.call(host.pluginBase + 0x7d0480n, passageType, host.manager + 0x9530n, output, input, uuid, timeScale, scaleKey)
    const notes = host.readNotes(output)
    fixtures.push({ templateId: template.id, templateName: template.name, midiNotes, notes })
  }
}

const capture = { binarySha256: host.binarySha256, category: 'Passages', fixtures }
let outputName = 'Passages-voicing-probe.json'
if (shouldCaptureHoldout) outputName = 'Passages-voicing-holdout.json'
if (shouldCaptureStress) outputName = 'Passages-voicing-stress.json'
const outputPath = new URL(`./catalog/${outputName}`, import.meta.url)
filesystem.writeFileSync(outputPath, JSON.stringify(capture, null, 2))
console.log(JSON.stringify({ fixtureCount: fixtures.length, voicingCount: selectedVoicings.length }))
host.close()
process.exit(0)

import * as filesystem from 'node:fs'
import * as nativeHost from './nativeExpressionHost.mjs'
import * as source from '../dist/scaler.mjs'

const host = nativeHost.createNativeExpressionHost()
const category = process.argv[2] ?? 'StrummedSequences'
const templates = source.performanceTemplates.filter((template) => {
  return template.category === category
})
const passageType = host.koffi.proto('void *RenderProofPassage(void *transform, void *output, void *input, void *uuid, float timeScale, void *scaleKey)')
const chordShapes = [[60, 64, 67], [60, 63, 67], [60, 64, 67, 71], [62, 65, 69], [48, 64, 67, 72], [48, 49, 50], [60, 62, 64], [60, 61, 62, 63], [60, 62, 64, 66], [60, 61, 62, 63, 64], [60, 62, 64, 66, 68]]
const fixtures = []
for (const template of templates) {
  for (const midiNotes of chordShapes) {
    let notes = []
    const isPassage = category === 'Passages'
    if (isPassage) {
      const input = host.buildInput(midiNotes)
      const output = Buffer.alloc(48)
      const uuid = Buffer.from(template.id.replaceAll('-', ''), 'hex')
      const scaleKey = Buffer.alloc(32)
      const timeScale = 4 * host.ticksPerBeat
      host.koffi.call(host.pluginBase + 0x7d0480n, passageType, host.manager + 0x9530n, output, input, uuid, timeScale, scaleKey)
      notes = host.readNotes(output)
    }
    if (!isPassage) notes = host.renderExpression({ template, midiNotes })
    const fixture = { templateId: template.id, templateName: template.name, midiNotes, notes }
    fixtures.push(fixture)
  }
}
const outputPath = new URL(`./catalog/${category}-probe.json`, import.meta.url)
filesystem.writeFileSync(outputPath, JSON.stringify({ binarySha256: host.binarySha256, category, fixtures }, null, 2))
console.log(JSON.stringify({ category, fixtureCount: fixtures.length, first: fixtures[0] }))
host.close()
process.exit(0)

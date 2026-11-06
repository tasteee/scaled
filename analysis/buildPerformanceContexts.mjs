import * as filesystem from 'node:fs'

const source = JSON.parse(filesystem.readFileSync(new URL('./catalog/performanceContexts.json', import.meta.url), 'utf8'))
const templates = source.templates.map((template) => {
  return { id: template.templateId, tonicPitch: template.sourceScale.tonicPitch, scaleName: template.sourceScale.scaleName }
})
const outputText = JSON.stringify(templates)
filesystem.writeFileSync(new URL('../src/data/performanceContexts.json', import.meta.url), outputText)
console.log(`Built ${templates.length} portable source contexts`)

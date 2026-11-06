import * as filesystem from 'node:fs'
import * as operatingSystem from 'node:os'
import * as path from 'node:path'
import * as module from 'node:module'
import * as crypto from 'node:crypto'
import * as suggestionTrie from './decodeSuggestionTrie.mjs'
import * as scaleCatalog from './captureScaleCatalog.mjs'

const dependencyDirectory = path.join(operatingSystem.tmpdir(), 'scaler2-catalog-host')
const requireDependency = module.createRequire(path.join(dependencyDirectory, 'capture.cjs'))
const koffi = requireDependency('koffi')
const outputDirectory = new URL('./catalog/', import.meta.url)
const progressPath = new URL('runtimeProgress.json', outputDirectory)
const pluginPath = 'C:/Program Files/Steinberg/VSTPlugins/Scaler2.dll'
const pluginBytes = filesystem.readFileSync(pluginPath)
const binarySha256 = crypto.createHash('sha256').update(pluginBytes).digest('hex')
const expectedSha256 = 'c2958bfc8d329d0f9752e87b07940d9467941858d49d0ace47b90fbca864445e'
const isExpectedBinary = binarySha256 === expectedSha256
if (!isExpectedBinary) throw new Error('Installed DLL differs from the analyzed Scaler 2.9.0 binary')

const writeProgress = (stage) => {
  const progress = { stage, processId: process.pid, observedAt: new Date().toISOString() }
  const progressText = JSON.stringify(progress, null, 2)
  filesystem.writeFileSync(progressPath, progressText)
  console.log(stage)
  return undefined
}

const hostCallbackType = koffi.proto('intptr_t HostCallback(void *effect, int opcode, int index, intptr_t value, void *pointer, float option)')
const handleHostCallback = (effect, opcode, index, value, pointer, option) => {
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

writeProgress('Loading installed Scaler2.dll')
const plugin = koffi.load(pluginPath)
const hostCallback = koffi.register(handleHostCallback, koffi.pointer(hostCallbackType))
const createPlugin = plugin.func('void *VSTPluginMain(void *hostCallback)')
writeProgress('Creating VST instance without an editor or audio processing')
const effect = createPlugin(hostCallback)
const isMissingEffect = !effect
if (isMissingEffect) throw new Error('VSTPluginMain returned a null effect')
const effectAddress = koffi.address(effect)
const magic = koffi.decode(effect, 'int')
const isExpectedMagic = magic === 0x56737450
if (!isExpectedMagic) throw new Error('Unexpected VST effect magic')
const dispatcherAddress = koffi.decode(effectAddress + 8n, 'void *')
const dispatcherType = koffi.proto('intptr_t Dispatch(void *effect, int opcode, int index, intptr_t value, void *pointer, float option)')
writeProgress('Opening VST instance to initialize catalogs')
koffi.call(dispatcherAddress, dispatcherType, effect, 0, 0, 0, null, 0)

const kernel = koffi.load('kernel32.dll')
const getModuleHandle = kernel.func('void *GetModuleHandleW(str16 name)')
const pluginBase = koffi.address(getModuleHandle('Scaler2.dll'))
const chordTypeCount = koffi.decode(pluginBase + 0x2dcf118n, 'uint64_t')
const scaleCount = koffi.decode(pluginBase + 0x2dcf198n, 'uint64_t')
console.log(JSON.stringify({ chordTypeCount: chordTypeCount.toString(), scaleCount: scaleCount.toString() }))
const hasCatalogs = Number(chordTypeCount) > 0 && Number(scaleCount) > 0
const initializeCatalogType = koffi.proto('void InitializeCatalog(void)')
if (!hasCatalogs) {
  const catalogInitializerOffsets = [0x7904b0n, 0x78efc0n, 0x78dab0n, 0x78d700n, 0x78c9d0n, 0x78cf40n]
  for (const initializerOffset of catalogInitializerOffsets) {
    writeProgress(`Loading music resource at 0x${initializerOffset.toString(16)}`)
    koffi.call(pluginBase + initializerOffset, initializeCatalogType)
  }
}
const initializeSuggestionsType = koffi.proto('void *InitializeSuggestions(void *owner)')
writeProgress('Initializing suggestion tables from the recovered set corpus')
koffi.call(pluginBase + 0x8129b0n, initializeSuggestionsType, null)
const createStringType = koffi.proto('void *CreateString(void *output, str text)')
const lookupType = koffi.proto('void *Lookup(void *output, void *key, void *trie, void *values)')

const captureSuggestionTable = (input) => {
  const trieAddress = pluginBase + input.trieOffset
  const valuesAddress = pluginBase + input.valuesOffset
  const trieHeader = koffi.decode(trieAddress, 'uint64_t', 5)
  const valuesHeader = koffi.decode(valuesAddress, 'uint64_t', 5)
  const describeInteger = (value) => {
    return value.toString()
  }
  const diagnostic = {
    profile: input.profile,
    pluginBase: pluginBase.toString(16),
    trieHeader: Array.from(trieHeader, describeInteger),
    valuesHeader: Array.from(valuesHeader, describeInteger)
  }
  const diagnosticText = JSON.stringify(diagnostic, null, 2)
  filesystem.writeFileSync(new URL(`${input.filename}.header.json`, outputDirectory), diagnosticText)
  writeProgress(`Inspecting ${input.profile} table header`)
  const isTrieMissing = Number(trieHeader[0]) === 0
  if (isTrieMissing) throw new Error('Suggestion trie was not initialized by VST startup')
  const trieUnitCount = Number((BigInt(trieHeader[3]) - BigInt(trieHeader[2])) / 4n)
  const guidanceWordCount = Number((BigInt(valuesHeader[3]) - BigInt(valuesHeader[2])) / 4n)
  const trieUnits = Array.from(koffi.decode(trieHeader[2], 'uint32_t', trieUnitCount))
  const guidanceWords = Array.from(koffi.decode(valuesHeader[2], 'uint32_t', guidanceWordCount))
  const rawTable = { profile: input.profile, trieUnits, guidanceWords }
  const rawTableText = JSON.stringify(rawTable)
  filesystem.writeFileSync(new URL(`${input.filename}.raw.json`, outputDirectory), rawTableText)
  const entries = suggestionTrie.decodeSuggestionTrie(trieUnits)
  const sourceKeys = new Set()
  for (const entry of entries) {
    const separatorPosition = entry.token.indexOf('-')
    const sourceKey = entry.token.slice(0, separatorPosition)
    sourceKeys.add(sourceKey)
  }
  const captureLookup = (sourceKey) => {
    const key = Buffer.alloc(8)
    const output = Buffer.alloc(24)
    koffi.call(pluginBase + 0x52780n, createStringType, key, sourceKey)
    koffi.call(pluginBase + 0x80d810n, lookupType, output, key, trieAddress, valuesAddress)
    const beginAddress = output.readBigUInt64LE(0)
    const endAddress = output.readBigUInt64LE(8)
    const entryCount = Number((endAddress - beginAddress) / 16n)
    const isUnexpectedCount = entryCount < 0 || entryCount > entries.length
    if (isUnexpectedCount) throw new Error(`Unexpected lookup length for ${sourceKey}`)
    const entryNumbers = Array.from({ length: entryCount }, (_, entryNumber) => {
      return entryNumber
    })
    const rankedEntries = entryNumbers.map((entryNumber) => {
      const entryAddress = beginAddress + BigInt(entryNumber * 16)
      const token = koffi.decode(entryAddress, 'str')
      const weight = koffi.decode(entryAddress + 8n, 'int')
      return { token, weight }
    })
    return { sourceKey, entries: rankedEntries }
  }
  const lookups = Array.from(sourceKeys, captureLookup)
  const observedEntries = new Map()
  for (const lookup of lookups) {
    for (const entry of lookup.entries) observedEntries.set(entry.token, entry.weight)
  }
  const hasMatchingCount = observedEntries.size === entries.length
  const hasMatchingWeights = entries.every((entry) => {
    const observedWeight = observedEntries.get(entry.token)
    return observedWeight === entry.weight
  })
  const isMatchingNativeLookup = hasMatchingCount && hasMatchingWeights
  if (!isMatchingNativeLookup) throw new Error(`Native lookup disagrees with decoded ${input.profile} trie`)
  const result = { profile: input.profile, entryCount: entries.length, entries, lookups }
  const resultText = JSON.stringify(result, null, 2)
  filesystem.writeFileSync(new URL(input.filename, outputDirectory), resultText)
  return { profile: input.profile, entryCount: entries.length, sourceKeyCount: lookups.length, isMatchingNativeLookup }
}

writeProgress('Reading generated suggestion tries')
const tableInputs = [
  { profile: 'Tonal', filename: 'suggestionsTonal.json', trieOffset: 0x2dcf4d8n, valuesOffset: 0x2dcf5b0n },
  { profile: 'Per Scale', filename: 'suggestionsPerScale.json', trieOffset: 0x2dcf650n, valuesOffset: 0x2dcf500n }
]
const tables = tableInputs.map(captureSuggestionTable)
writeProgress('Reading generated scale chord groups and variations')
const scaleGroups = scaleCatalog.captureScaleCatalog({ koffi, pluginBase, outputDirectory })
console.log(JSON.stringify(scaleGroups))
writeProgress('Closing VST instance')
koffi.call(dispatcherAddress, dispatcherType, effect, 1, 0, 0, null, 0)
writeProgress('Finished reading runtime tables')
const capturedFiles = ['scaleChordGroups.json', 'suggestionsTonal.json', 'suggestionsPerScale.json', 'suggestionsTonal.json.raw.json', 'suggestionsPerScale.json.raw.json']
const describeFile = (filename) => {
  const bytes = filesystem.readFileSync(new URL(filename, outputDirectory))
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex')
  return { filename, byteLength: bytes.length, sha256 }
}
const files = capturedFiles.map(describeFile)
const manifest = {
  pluginPath,
  binarySha256,
  capturedAt: new Date().toISOString(),
  method: 'Native music-resource initializers, native scale generators, decoded suggestion tries, and native prefix lookups in a short-lived helper process',
  wasEditorOpened: false,
  wasAudioProcessed: false,
  tables,
  scaleGroups,
  files
}
const manifestText = JSON.stringify(manifest, null, 2)
filesystem.writeFileSync(new URL('runtimeManifest.json', outputDirectory), manifestText)
console.log(JSON.stringify(tables))
process.exit(0)

import * as filesystem from 'node:fs'
import * as crypto from 'node:crypto'

const binaryPath = 'C:/Program Files/Steinberg/VSTPlugins/Scaler2.dll'
const binary = filesystem.readFileSync(binaryPath)
const headerOffset = binary.readUInt32LE(0x3c)
const sectionCount = binary.readUInt16LE(headerOffset + 6)
const optionalHeaderSize = binary.readUInt16LE(headerOffset + 20)
const optionalHeaderOffset = headerOffset + 24
const imageBase = Number(binary.readBigUInt64LE(optionalHeaderOffset + 24))
const sectionTableOffset = optionalHeaderOffset + optionalHeaderSize
const sectionNumbers = Array.from({ length: sectionCount }, (_, sectionNumber) => {
  return sectionNumber
})
const sections = sectionNumbers.map((sectionNumber) => {
  const sectionOffset = sectionTableOffset + sectionNumber * 40
  return {
    virtualAddress: binary.readUInt32LE(sectionOffset + 12),
    rawSize: binary.readUInt32LE(sectionOffset + 16),
    rawOffset: binary.readUInt32LE(sectionOffset + 20)
  }
})

const getFileOffset = (address) => {
  const relativeAddress = address - imageBase
  const section = sections.find((candidate) => {
    const isAfterStart = relativeAddress >= candidate.virtualAddress
    const isBeforeEnd = relativeAddress < candidate.virtualAddress + candidate.rawSize
    return isAfterStart && isBeforeEnd
  })
  if (!section) throw new Error(`Unmapped address: ${address.toString(16)}`)
  const fileOffset = relativeAddress - section.virtualAddress + section.rawOffset
  return fileOffset
}

const extractCatalog = (input) => {
  const pointerOffset = getFileOffset(input.pointerAddress)
  const address = Number(binary.readBigUInt64LE(pointerOffset))
  const fileOffset = getFileOffset(address)
  const endOffset = fileOffset + input.byteLength
  const bytes = binary.subarray(fileOffset, endOffset)
  const catalogText = bytes.toString('utf8')
  const catalog = JSON.parse(catalogText)
  const outputPath = new URL(`./catalog/${input.name}.json`, import.meta.url)
  filesystem.writeFileSync(outputPath, catalogText)
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex')
  const entryNames = Object.keys(catalog)
  return {
    name: input.name,
    pointerAddress: `0x${input.pointerAddress.toString(16)}`,
    address: `0x${address.toString(16)}`,
    fileOffset,
    byteLength: bytes.length,
    sha256,
    entryCount: entryNames.length,
    firstEntries: entryNames.slice(0, 12)
  }
}

const shouldExtract = process.argv.includes('--extract')
if (shouldExtract) {
  filesystem.mkdirSync(new URL('./catalog/', import.meta.url), { recursive: true })
  const catalogs = [
    { name: 'chordTypes', pointerAddress: 0x182d7d740, byteLength: 0x18967 },
    { name: 'scales', pointerAddress: 0x182d7d748, byteLength: 0x951d },
    { name: 'notes', pointerAddress: 0x182d7d750, byteLength: 0x7d9 },
    { name: 'chordSets', pointerAddress: 0x182d7a030, byteLength: 0x59836 }
  ]
  const extractedCatalogs = catalogs.map(extractCatalog)
  const binarySha256 = crypto.createHash('sha256').update(binary).digest('hex')
  const manifest = { binaryPath, binarySha256, catalogs: extractedCatalogs }
  const manifestText = JSON.stringify(manifest, null, 2)
  filesystem.writeFileSync(new URL('./catalog/manifest.json', import.meta.url), manifestText)
  console.log(manifestText)
  process.exit(0)
}

for (const addressText of process.argv.slice(2)) {
  const address = Number(addressText)
  const fileOffset = getFileOffset(address)
  const terminatorOffset = binary.indexOf(0, fileOffset)
  const stringEnd = Math.min(terminatorOffset, fileOffset + 1000)
  const preview = binary.toString('utf8', fileOffset, stringEnd)
  const pointerValue = binary.readBigUInt64LE(fileOffset).toString(16)
  console.log(JSON.stringify({ address: addressText, fileOffset, pointerValue, length: terminatorOffset - fileOffset, preview }))
}

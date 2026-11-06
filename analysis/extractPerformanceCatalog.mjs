import * as filesystem from 'node:fs'
import * as path from 'node:path'
import * as crypto from 'node:crypto'
import * as compression from 'node:zlib'
import * as url from 'node:url'

const binaryPath = 'C:/Program Files/Steinberg/VSTPlugins/Scaler2.dll'
const binary = filesystem.readFileSync(binaryPath)
const binarySha256 = crypto.createHash('sha256').update(binary).digest('hex')
const expectedSha256 = 'c2958bfc8d329d0f9752e87b07940d9467941858d49d0ace47b90fbca864445e'
const isExpectedBinary = binarySha256 === expectedSha256
if (!isExpectedBinary) throw new Error('Installed Scaler binary differs from the analyzed version')

const archiveOffset = 11537200
const archiveLength = 0xe6245
const archiveEnd = archiveOffset + archiveLength
const archive = binary.subarray(archiveOffset, archiveEnd)
const outputDirectory = new URL('./catalog/performanceResources/', import.meta.url)
const outputPath = url.fileURLToPath(outputDirectory)
filesystem.mkdirSync(outputDirectory, { recursive: true })

const directorySignature = Buffer.from([0x50, 0x4b, 0x05, 0x06])
const directoryEnd = archive.lastIndexOf(directorySignature)
const isMissingDirectory = directoryEnd < 0
if (isMissingDirectory) throw new Error('Embedded performance archive has no ZIP directory')
const entryCount = archive.readUInt16LE(directoryEnd + 10)
const directoryOffset = archive.readUInt32LE(directoryEnd + 16)
const directoryState = { offset: directoryOffset }
const entryNumbers = Array.from({ length: entryCount }, (_, entryNumber) => {
  return entryNumber
})

const extractEntry = () => {
  const headerOffset = directoryState.offset
  const headerSignature = archive.readUInt32LE(headerOffset)
  const isExpectedHeader = headerSignature === 0x02014b50
  if (!isExpectedHeader) throw new Error('Unexpected ZIP central-directory entry')
  const flags = archive.readUInt16LE(headerOffset + 8)
  const method = archive.readUInt16LE(headerOffset + 10)
  const expectedChecksum = archive.readUInt32LE(headerOffset + 16)
  const compressedLength = archive.readUInt32LE(headerOffset + 20)
  const uncompressedLength = archive.readUInt32LE(headerOffset + 24)
  const nameLength = archive.readUInt16LE(headerOffset + 28)
  const extraLength = archive.readUInt16LE(headerOffset + 30)
  const commentLength = archive.readUInt16LE(headerOffset + 32)
  const localHeaderOffset = archive.readUInt32LE(headerOffset + 42)
  const nameOffset = headerOffset + 46
  const nameEnd = nameOffset + nameLength
  const name = archive.toString('utf8', nameOffset, nameEnd)
  directoryState.offset = nameEnd + extraLength + commentLength

  const destination = path.resolve(outputPath, name)
  const relativeDestination = path.relative(outputPath, destination)
  const isOutsideDirectory = relativeDestination.startsWith('..') || path.isAbsolute(relativeDestination)
  if (isOutsideDirectory) throw new Error(`Archive member escapes output directory: ${name}`)
  const isEncrypted = (flags & 1) !== 0
  if (isEncrypted) throw new Error(`Encrypted archive member: ${name}`)
  const isDirectory = name.endsWith('/')
  if (isDirectory) {
    filesystem.mkdirSync(destination, { recursive: true })
    return { name, isDirectory: true }
  }

  const localNameLength = archive.readUInt16LE(localHeaderOffset + 26)
  const localExtraLength = archive.readUInt16LE(localHeaderOffset + 28)
  const payloadOffset = localHeaderOffset + 30 + localNameLength + localExtraLength
  const payloadEnd = payloadOffset + compressedLength
  const compressedBytes = archive.subarray(payloadOffset, payloadEnd)
  const isStored = method === 0
  const isDeflated = method === 8
  const isSupported = isStored || isDeflated
  if (!isSupported) throw new Error(`Unsupported ZIP compression method: ${method}`)
  const bytes = isStored ? compressedBytes : compression.inflateRawSync(compressedBytes)
  const actualChecksum = compression.crc32(bytes)
  const hasExpectedLength = bytes.length === uncompressedLength
  const hasExpectedChecksum = actualChecksum === expectedChecksum
  const isValidPayload = hasExpectedLength && hasExpectedChecksum
  if (!isValidPayload) throw new Error(`Archive member integrity mismatch: ${name}`)
  const parentDirectory = path.dirname(destination)
  filesystem.mkdirSync(parentDirectory, { recursive: true })
  filesystem.writeFileSync(destination, bytes)
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex')
  return { name, compressedLength, byteLength: bytes.length, sha256 }
}

const entries = entryNumbers.map(extractEntry)
const archiveSha256 = crypto.createHash('sha256').update(archive).digest('hex')
const manifest = { binaryPath, binarySha256, pointerAddress: '0x182d7a028', address: '0x180b01730', archiveOffset, archiveLength, archiveSha256, entries }
const manifestText = JSON.stringify(manifest, null, 2)
filesystem.writeFileSync(new URL('manifest.json', outputDirectory), manifestText)
const summary = { archiveLength, entryCount: entries.length, outputPath }
const summaryText = JSON.stringify(summary, null, 2)
console.log(summaryText)

import * as filesystem from 'node:fs'

export const captureScaleCatalog = (input) => {
  const koffi = input.koffi
  const readPointer = (address) => {
    const pointer = koffi.decode(address, 'uint64_t')
    return BigInt(pointer)
  }
  const readString = (address) => {
    const value = koffi.decode(address, 'str')
    return value
  }
  const readSharedPointers = (address) => {
    const begin = readPointer(address)
    const end = readPointer(address + 8n)
    const count = Number((end - begin) / 16n)
    const positions = Array.from({ length: count }, (_, position) => {
      return begin + BigInt(position * 16)
    })
    return positions
  }
  const readTreeNodes = (sentinel) => {
    const nodes = []
    const visitNode = (address) => {
      const isSentinel = koffi.decode(address + 25n, 'uint8_t') !== 0
      if (isSentinel) return undefined
      const leftChild = readPointer(address)
      visitNode(leftChild)
      nodes.push(address)
      const rightChild = readPointer(address + 16n)
      visitNode(rightChild)
      return undefined
    }
    const root = readPointer(sentinel + 8n)
    visitNode(root)
    return nodes
  }
  const getNotesType = koffi.proto('void *GetChordNotes(void *chord, void *output, int useVoicing)')
  const readChord = (chord) => {
    const isMissing = chord === 0n
    if (isMissing) return null
    const rootNote = readPointer(chord + 48n)
    const rootPitch = koffi.decode(rootNote + 48n, 'int')
    const chordType = readPointer(chord + 64n)
    const chordTypeName = readString(chordType)
    const output = Buffer.alloc(24)
    koffi.call(input.pluginBase + 0x7a5e90n, getNotesType, chord, output, 1)
    const begin = output.readBigUInt64LE(0)
    const end = output.readBigUInt64LE(8)
    const noteCount = Number((end - begin) / 4n)
    const hasNotes = noteCount > 0
    const midiNotes = hasNotes ? Array.from(koffi.decode(begin, 'int', noteCount)) : []
    return { rootPitch, chordType: chordTypeName, midiNotes }
  }
  const buildChordType = koffi.proto('void *BuildScaleChord(void *scale, void *output, void *rootNote, int noteCount, int octave)')
  const buildCompatibleType = koffi.proto('void BuildCompatibleChords(void *scale)')
  const groupDefinitions = [
    { id: 1, name: 'Triads', noteCount: 3 },
    { id: 2, name: '7ths', noteCount: 4 },
    { id: 3, name: '9ths', noteCount: 5 },
    { id: 4, name: '11ths', noteCount: 6 },
    { id: 5, name: '13ths', noteCount: 7 }
  ]
  const scalePositions = readSharedPointers(input.pluginBase + 0x2dcf120n)
  const captureScale = (position) => {
    const scale = readPointer(position)
    const tonic = readPointer(scale + 168n)
    const tonicPitch = koffi.decode(tonic + 48n, 'int')
    const scaleType = readPointer(scale + 184n)
    const scaleName = readString(scaleType + 8n)
    const notePositions = readSharedPointers(scale + 248n)
    const captureGroup = (group) => {
      const captureDegree = (notePosition) => {
        const rootNote = readPointer(notePosition)
        const control = readPointer(notePosition + 8n)
        const referenceCount = koffi.decode(control + 8n, 'int')
        const retainedCount = referenceCount + 1
        koffi.encode(control + 8n, 'int', retainedCount)
        const root = Buffer.alloc(16)
        root.writeBigUInt64LE(rootNote, 0)
        root.writeBigUInt64LE(control, 8)
        const output = Buffer.alloc(16)
        koffi.call(input.pluginBase + 0x7947b0n, buildChordType, scale, output, root, group.noteCount, 3)
        const chord = output.readBigUInt64LE(0)
        const result = readChord(chord)
        return result
      }
      const chords = notePositions.map(captureDegree)
      return { id: group.id, name: group.name, chords }
    }
    const groups = groupDefinitions.map(captureGroup)
    koffi.call(input.pluginBase + 0x792b40n, buildCompatibleType, scale)
    const bucketSentinel = readPointer(scale + 296n)
    const bucketNodes = readTreeNodes(bucketSentinel)
    const variationBuckets = new Map()
    for (const bucket of bucketNodes) {
      const rootNote = readPointer(bucket + 32n)
      const rootPitch = koffi.decode(rootNote + 48n, 'int')
      const chordPositions = readSharedPointers(bucket + 48n)
      const readVariation = (chordPosition) => {
        const chord = readPointer(chordPosition)
        const result = readChord(chord)
        return result
      }
      const chords = chordPositions.map(readVariation)
      variationBuckets.set(rootPitch, chords)
    }
    const captureVariations = (notePosition) => {
      const note = readPointer(notePosition)
      const rootPitch = koffi.decode(note + 48n, 'int')
      const chords = variationBuckets.get(rootPitch) ?? []
      return { rootPitch, chords }
    }
    const variations = notePositions.map(captureVariations)
    return { tonicPitch, scaleName, groups, variations }
  }
  const scales = scalePositions.map(captureScale)
  const voicingSentinel = readPointer(input.pluginBase + 0x2dcf568n)
  const voicingNodes = readTreeNodes(voicingSentinel)
  const captureVoicingMenuEntry = (node) => {
    const nativeIdentifier = koffi.decode(node + 32n, 'int')
    const voicingSet = readPointer(node + 40n)
    const name = readString(voicingSet)
    const menuIdentifier = nativeIdentifier + 10000
    return { nativeIdentifier, menuIdentifier, name }
  }
  const voicingMenu = voicingNodes.map(captureVoicingMenuEntry)
  const result = { octave: 3, scaleCount: scales.length, groupDefinitions, voicingMenu, scales }
  const outputText = JSON.stringify(result, null, 2)
  filesystem.writeFileSync(new URL('scaleChordGroups.json', input.outputDirectory), outputText)
  return { scaleCount: scales.length }
}

import * as filesystem from 'node:fs'
import * as nativeHost from './nativeExpressionHost.mjs'

const host = nativeHost.createNativeExpressionHost()
const chordType = host.koffi.proto('void *GetPassageChord(void *output, void *input)')
const mappings = new Array(4096).fill(null)

const getInputNotes = (pitchMask) => {
  const midiNotes = []
  for (const pitchClass of Array.from({ length: 12 }).keys()) {
    const isIncluded = (pitchMask & (1 << pitchClass)) !== 0
    if (isIncluded) midiNotes.push(60 + pitchClass)
  }
  return midiNotes
}

const getVoicedNotes = (midiNotes, bassPosition) => {
  const voicedNotes = []
  for (const position of midiNotes.keys()) {
    const sourcePosition = (position + bassPosition) % midiNotes.length
    const sourceNote = midiNotes[sourcePosition]
    const hasWrapped = sourcePosition < bassPosition
    const octaveOffset = hasWrapped ? 12 : 0
    voicedNotes.push(sourceNote + octaveOffset)
  }
  const hasOnePitch = voicedNotes.length === 1
  if (hasOnePitch) {
    const firstNote = voicedNotes[0]
    voicedNotes.push(firstNote + 12, firstNote + 24)
  }
  const hasTwoPitches = voicedNotes.length === 2
  if (hasTwoPitches) voicedNotes.push(voicedNotes[0] + 12)
  return voicedNotes
}

const getChordPitches = (midiNotes) => {
  const input = host.buildInput(midiNotes)
  const output = Buffer.alloc(16)
  host.koffi.call(host.pluginBase + 0x7d1650n, chordType, output, input)
  const chordAddress = output.readBigUInt64LE(0)
  const begin = host.readPointer(chordAddress + 0x50n)
  const end = host.readPointer(chordAddress + 0x58n)
  const noteCount = Number((end - begin) / 16n)
  const notePitches = []
  for (const position of Array.from({ length: noteCount }).keys()) {
    const noteAddress = host.readPointer(begin + BigInt(position * 16))
    const notePitch = host.koffi.decode(noteAddress + 0x30n, 'int')
    notePitches.push(notePitch)
  }
  return notePitches
}

for (const pitchMask of mappings.keys()) {
  const midiNotes = getInputNotes(pitchMask)
  const hasNoNotes = midiNotes.length === 0
  if (hasNoNotes) continue
  const chordPitchesByBass = {}
  for (const bassPosition of midiNotes.keys()) {
    const voicedNotes = getVoicedNotes(midiNotes, bassPosition)
    const bassPitch = voicedNotes[0] % 12
    chordPitchesByBass[bassPitch] = getChordPitches(voicedNotes)
  }
  mappings[pitchMask] = chordPitchesByBass
}

const capture = { binarySha256: host.binarySha256, mappings }
const outputPath = new URL('../src/data/passageChordRecognition.json', import.meta.url)
filesystem.writeFileSync(outputPath, JSON.stringify(capture))
console.log(JSON.stringify({ mappingCount: mappings.filter((mapping) => mapping !== null).length }))
host.close()
process.exit(0)

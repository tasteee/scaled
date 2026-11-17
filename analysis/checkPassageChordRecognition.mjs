import * as assert from 'node:assert/strict'
import * as filesystem from 'node:fs'
import * as nativeHost from './nativeExpressionHost.mjs'

const captureText = filesystem.readFileSync(new URL('../src/data/passageChordRecognition.json', import.meta.url), 'utf8')
const capture = JSON.parse(captureText)
const host = nativeHost.createNativeExpressionHost()
const chordType = host.koffi.proto('void *GetPassageChord(void *output, void *input)')
assert.equal(capture.binarySha256, host.binarySha256)

const getInvertedNotes = (pitchMask) => {
  const midiNotes = []
  for (const pitchClass of Array.from({ length: 12 }).keys()) {
    const isIncluded = (pitchMask & (1 << pitchClass)) !== 0
    if (isIncluded) midiNotes.push(60 + pitchClass)
  }
  const lowestNote = midiNotes.shift()
  if (lowestNote !== undefined) midiNotes.push(lowestNote + 24)
  return midiNotes
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

let checkedCount = 0
for (const pitchMask of capture.mappings.keys()) {
  const isSelected = pitchMask % 37 === 0
  if (!isSelected) continue
  const midiNotes = getInvertedNotes(pitchMask)
  const hasEnoughNotes = midiNotes.length >= 3
  if (!hasEnoughNotes) continue
  const actualPitches = getChordPitches(midiNotes)
  const lowestNote = midiNotes[0]
  const bassPitch = lowestNote % 12
  const expectedPitches = capture.mappings[pitchMask][bassPitch]
  assert.deepEqual(actualPitches, expectedPitches, `Pitch mask ${pitchMask}`)
  checkedCount += 1
}

console.log(`Passage chord recognition: ${checkedCount} inverted pitch sets match the capture.`)
host.close()
process.exit(0)

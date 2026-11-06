import type * as types from './types.js'
import * as validation from './validation.js'

type TickEventT = {
  readonly tick: number
  readonly priority: number
  readonly bytes: readonly number[]
}

const encodeVariableLength = (value: number): readonly number[] => {
  validation.validateInteger(value, 'MIDI delta time')
  const isInRange = value >= 0 && value <= 0x0fffffff
  if (!isInRange) throw new RangeError('MIDI delta time exceeds the four-byte limit')
  const shifts = [21, 14, 7, 0]
  const bytes: number[] = []
  const state = { hasStarted: false }
  for (const shift of shifts) {
    const part = (value >>> shift) & 0x7f
    const shouldSkip = !state.hasStarted && part === 0 && shift !== 0
    if (shouldSkip) continue
    state.hasStarted = true
    const hasFollowingByte = shift !== 0
    const continuation = hasFollowingByte ? 0x80 : 0
    const encodedByte = part | continuation
    bytes.push(encodedByte)
  }
  return bytes
}

const encodeTempo = (tempo: number): readonly number[] => {
  validation.validatePositiveNumber(tempo, 'Tempo')
  const microsecondsPerBeat = Math.round(60000000 / tempo)
  const isInRange = microsecondsPerBeat >= 1 && microsecondsPerBeat <= 0xffffff
  if (!isInRange) throw new RangeError('Tempo cannot be represented in a MIDI tempo event')
  const highestByte = (microsecondsPerBeat >>> 16) & 0xff
  const middleByte = (microsecondsPerBeat >>> 8) & 0xff
  const lowestByte = microsecondsPerBeat & 0xff
  return [0xff, 0x51, 3, highestByte, middleByte, lowestByte]
}

const encodeTimeSignature = (signature: types.TimeSignatureT): readonly number[] => {
  validation.validateInteger(signature.numerator, 'Time-signature numerator')
  validation.validateInteger(signature.denominator, 'Time-signature denominator')
  const denominatorPower = Math.log2(signature.denominator)
  const hasValidNumerator = signature.numerator >= 1 && signature.numerator <= 255
  const hasValidDenominator = Number.isInteger(denominatorPower) && denominatorPower >= 0 && denominatorPower <= 7
  const isValid = hasValidNumerator && hasValidDenominator
  if (!isValid) throw new RangeError('Invalid MIDI time signature')
  return [0xff, 0x58, 4, signature.numerator, denominatorPower, 24, 8]
}

const buildNoteEvents = (input: types.ExportMidiInputT, ticksPerBeat: number, channel: number): readonly TickEventT[] => {
  const events: TickEventT[] = []
  for (const note of input.clip.notes) {
    validation.validateMidiNote(note.midiNote)
    validation.validateVelocity(note.velocity)
    validation.validateNonnegativeNumber(note.startBeat, 'Note startBeat')
    validation.validatePositiveNumber(note.durationBeats, 'Note durationBeats')
    const endBeat = note.startBeat + note.durationBeats
    const isOutsideClip = endBeat > input.clip.durationBeats
    if (isOutsideClip) throw new RangeError('MIDI note extends beyond the clip duration')
    const startTick = Math.round(note.startBeat * ticksPerBeat)
    const requestedEndTick = Math.round(endBeat * ticksPerBeat)
    const endTick = Math.max(startTick + 1, requestedEndTick)
    const noteOn = [0x90 | channel, note.midiNote, note.velocity]
    const noteOff = [0x80 | channel, note.midiNote, 0]
    events.push({ tick: startTick, priority: 1, bytes: noteOn })
    events.push({ tick: endTick, priority: 0, bytes: noteOff })
  }
  return events
}

const encodeTrack = (events: readonly TickEventT[], endTick: number): Uint8Array => {
  const sortedEvents = [...events].sort((firstEvent, secondEvent) => {
    const timeDifference = firstEvent.tick - secondEvent.tick
    const hasDifferentTimes = timeDifference !== 0
    if (hasDifferentTimes) return timeDifference
    const priorityDifference = firstEvent.priority - secondEvent.priority
    return priorityDifference
  })
  const bytes: number[] = []
  const cursor = { tick: 0 }
  for (const event of sortedEvents) {
    const delta = event.tick - cursor.tick
    const encodedDelta = encodeVariableLength(delta)
    bytes.push(...encodedDelta, ...event.bytes)
    cursor.tick = event.tick
  }
  const finalTick = Math.max(endTick, cursor.tick)
  const remainingTicks = finalTick - cursor.tick
  const finalDelta = encodeVariableLength(remainingTicks)
  bytes.push(...finalDelta, 0xff, 0x2f, 0)
  const encodedTrack = Uint8Array.from(bytes)
  return encodedTrack
}

const buildFile = (track: Uint8Array, ticksPerBeat: number): Uint8Array => {
  const outputLength = 22 + track.length
  const output = new Uint8Array(outputLength)
  const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1]
  output.set(header, 0)
  const view = new DataView(output.buffer)
  view.setUint16(12, ticksPerBeat)
  output.set([0x4d, 0x54, 0x72, 0x6b], 14)
  view.setUint32(18, track.length)
  output.set(track, 22)
  return output
}

const getFileName = (requested: string | undefined): string => {
  const withoutIllegal = (requested ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
  const baseName = withoutIllegal.trim().replace(/\.mid$/i, '').trim()
  const hasName = baseName.length > 0
  const finalName = hasName ? baseName : 'scaled'
  return `${finalName}.mid`
}

export const exportMidi = (input: types.ExportMidiInputT): types.MidiFileT => {
  const ticksPerBeat = input.ticksPerBeat ?? 480
  const channel = input.channel ?? 0
  const tempo = input.tempo ?? 120
  const timeSignature = input.timeSignature ?? { numerator: 4, denominator: 4 }
  validation.validateNonnegativeNumber(input.clip.durationBeats, 'Clip durationBeats')
  validation.validateInteger(ticksPerBeat, 'Ticks per beat')
  validation.validateInteger(channel, 'MIDI channel')
  const hasValidResolution = ticksPerBeat >= 1 && ticksPerBeat <= 0x7fff
  if (!hasValidResolution) throw new RangeError('Ticks per beat must be between 1 and 32767')
  const hasValidChannel = channel >= 0 && channel <= 15
  if (!hasValidChannel) throw new RangeError('MIDI channel must be between 0 and 15')
  const tempoBytes = encodeTempo(tempo)
  const signatureBytes = encodeTimeSignature(timeSignature)
  const noteEvents = buildNoteEvents(input, ticksPerBeat, channel)
  const events: readonly TickEventT[] = [
    { tick: 0, priority: -2, bytes: tempoBytes },
    { tick: 0, priority: -1, bytes: signatureBytes },
    ...noteEvents
  ]
  const endTick = Math.round(input.clip.durationBeats * ticksPerBeat)
  const track = encodeTrack(events, endTick)
  const file = buildFile(track, ticksPerBeat)
  const fileName = getFileName(input.fileName)
  return Object.assign(file, { fileName })
}

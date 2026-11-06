export const validateFiniteNumber = (value: number, name: string): void => {
  const isFinite = Number.isFinite(value)
  if (!isFinite) throw new RangeError(`${name} must be finite`)
  return undefined
}

export const validateInteger = (value: number, name: string): void => {
  const isInteger = Number.isSafeInteger(value)
  if (!isInteger) throw new RangeError(`${name} must be a safe integer`)
  return undefined
}

export const validateNonnegativeNumber = (value: number, name: string): void => {
  validateFiniteNumber(value, name)
  const isNegative = value < 0
  if (isNegative) throw new RangeError(`${name} must not be negative`)
  return undefined
}

export const validatePositiveNumber = (value: number, name: string): void => {
  validateFiniteNumber(value, name)
  const isPositive = value > 0
  if (!isPositive) throw new RangeError(`${name} must be positive`)
  return undefined
}

export const validateMidiNote = (value: number): void => {
  validateInteger(value, 'MIDI note')
  const isInRange = value >= 0 && value <= 127
  if (!isInRange) throw new RangeError('MIDI note must be between 0 and 127')
  return undefined
}

export const validateVelocity = (value: number): void => {
  validateInteger(value, 'Velocity')
  const isInRange = value >= 1 && value <= 127
  if (!isInRange) throw new RangeError('Velocity must be between 1 and 127')
  return undefined
}

export const getRequiredEntry = <EntryT>(entries: readonly EntryT[], index: number): EntryT => {
  const entry = entries[index]
  const isMissing = entry === undefined
  if (isMissing) throw new RangeError(`Missing entry at index ${index}`)
  return entry
}

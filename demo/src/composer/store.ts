import * as datass from 'datass'
import * as model from './model'
import * as piano from '../piano'

export const session = datass.datass.object<model.SessionT>(model.getInitialSession())

export const updateSession = (changes: Partial<model.SessionT>): void => {
  piano.stopPlayback()
  session.set({ ...changes, error: '' })
  return undefined
}

export const addChord = (symbol: string, sourceSlot: number | null = null): void => {
  const chord = model.createEntry(symbol, sourceSlot)
  const progression = session.state.progression.concat(chord)
  updateSession({ progression, selectedId: chord.id })
  return undefined
}

export const updateEntry = (identifier: string, changes: Partial<model.EntryT>): void => {
  const progression = session.state.progression.map((entry) => {
    const isMatching = entry.id === identifier
    if (!isMatching) return entry
    return { ...entry, ...changes }
  })
  updateSession({ progression })
  return undefined
}

export const moveEntry = (identifier: string, direction: number): void => {
  const progression = [...session.state.progression]
  const position = progression.findIndex((entry) => {
    return entry.id === identifier
  })
  const destination = position + direction
  const isOutside = position < 0 || destination < 0 || destination >= progression.length
  if (isOutside) return undefined
  const entry = progression[position]
  if (!entry) return undefined
  progression.splice(position, 1)
  progression.splice(destination, 0, entry)
  updateSession({ progression })
  return undefined
}

export const removeEntry = (identifier: string): void => {
  const progression = session.state.progression.filter((entry) => {
    return entry.id !== identifier
  })
  updateSession({ progression, selectedId: '' })
  return undefined
}

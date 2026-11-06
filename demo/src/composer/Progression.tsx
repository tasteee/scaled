import type * as React from 'react'
import * as fields from './Fields'
import * as model from './model'
import * as store from './store'
import * as render from './render'
import * as piano from '../piano'
import './Progression.css'

const ProgressionChord = (props: { entry: model.EntryT; isSelected: boolean; startBeat: number }) => {
  const beat = piano.playbackBeat.use()
  const status = piano.audioStatus.use()
  const endBeat = props.startBeat + props.entry.durationBeats
  const isPlaying = status.isLooping && beat >= props.startBeat && beat < endBeat
  const handlePreview = (event: React.MouseEvent<HTMLElement>): void => {
    const isPrimary = event.button === 0
    if (!isPrimary) return undefined
    event.preventDefault()
    piano.unlockPiano()
    store.session.set({ selectedId: props.entry.id })
    void render.previewEntry(props.entry)
    return undefined
  }
  const handleSelect = (): void => { store.session.set({ selectedId: props.entry.id }); return undefined }
  const durationBars = props.entry.durationBeats / 4
  const isOneBar = durationBars === 1
  const durationLabel = isOneBar ? '1 bar' : `${durationBars} bars`
  const chordWidth = `max(var(--spacing-24), calc(var(--spacing-32) * ${durationBars} + var(--spacing-12)))`
  const chordStyle = { flexBasis: chordWidth }
  return (
    <button type="button" className="progressionChord" style={chordStyle} aria-pressed={props.isSelected}  data-playing={isPlaying} onMouseDown={handlePreview} onMouseUp={piano.stopPreview} onMouseLeave={piano.stopPreview} onClick={handleSelect}>
      <strong>{props.entry.symbol}</strong><span>{durationLabel}</span>
    </button>
  )
}

const EntryControls = (props: { entry: model.EntryT; position: number; count: number }) => {
  const updateEntry = (changes: Partial<model.EntryT>): void => { store.updateEntry(props.entry.id, changes); return undefined }
  const handleDuration = (durationBars: number): void => { const durationBeats = durationBars * 4; updateEntry({ durationBeats }); return undefined }
  const handleVoicing = (voicing: string): void => { updateEntry({ voicing }); return undefined }
  const handlePerformance = (performance: string): void => { updateEntry({ performance }); return undefined }
  const handleInversion = (inversion: number): void => { updateEntry({ inversion }); return undefined }
  const handleOctaveOffset = (octaveOffset: number): void => { updateEntry({ octaveOffset }); return undefined }
  const handleMoveLeft = (): void => { store.moveEntry(props.entry.id, -1); return undefined }
  const handleMoveRight = (): void => { store.moveEntry(props.entry.id, 1); return undefined }
  const handleRemove = (): void => { store.removeEntry(props.entry.id); return undefined }
  const isFirst = props.position === 0
  const isLast = props.position === props.count - 1
  const durationBars = props.entry.durationBeats / 4
  return (
    <div className="entryControls" aria-label="Selected chord settings">
      <div className="entryNumber"><fields.NumberField label="Duration · bars" value={durationBars} min={0.00390625} max={32} step={0.25} onChange={handleDuration} /></div>
      <div className="entryChoice"><fields.Choice label="Voicing" value={props.entry.voicing} options={model.inheritedVoicingOptions} onChange={handleVoicing} isSearchable /></div>
      <div className="entryNumber"><fields.NumberField label="Inversion" value={props.entry.inversion} min={-4} max={7} step={1} onChange={handleInversion} /></div>
      <div className="entryNumber"><fields.NumberField label="Octave offset" value={props.entry.octaveOffset} min={-2} max={2} step={1} onChange={handleOctaveOffset} /></div>
      <div className="entryPerformance"><fields.Choice label="Performance" value={props.entry.performance} options={model.inheritedPerformanceOptions} onChange={handlePerformance} isSearchable /></div>
      <div className="entryActions"><z-button kind="ghost" size="sm" onClick={handleMoveLeft} isDisabled={isFirst} aria-label="Move chord left">←</z-button><z-button kind="ghost" size="sm" onClick={handleMoveRight} isDisabled={isLast} aria-label="Move chord right">→</z-button><z-button kind="ghost" size="sm" tone="danger" onClick={handleRemove} aria-label="Remove chord">×</z-button></div>
    </div>
  )
}

export const Progression = () => {
  const session: model.SessionT = store.session.use()
  const status = piano.audioStatus.use()
  let totalBeats = 0
  const entries = session.progression.map((entry) => {
    const isSelected = entry.id === session.selectedId
    const startBeat = totalBeats
    totalBeats += entry.durationBeats
    return <ProgressionChord key={entry.id} entry={entry} isSelected={isSelected} startBeat={startBeat} />
  })
  const selectedPosition = session.progression.findIndex((entry) => { return entry.id === session.selectedId })
  const selectedEntry = session.progression[selectedPosition]
  const entryControls = selectedEntry ? <EntryControls key={selectedEntry.id} entry={selectedEntry} position={selectedPosition} count={session.progression.length} /> : null
  const isEmpty = session.progression.length === 0
  const emptyMessage = isEmpty ? <p className="progressionEmpty">Use + in the library to build your progression.</p> : null
  const totalBars = totalBeats / 4
  const isSingleBar = totalBars === 1
  const totalLabel = isSingleBar ? '1 bar' : `${totalBars} bars`
  const isActive = status.isLooping
  const playLabel = isActive ? 'Stop' : 'Play progression'
  const playSymbol = isActive ? '■' : '▶'
  return (
    <section className="progression" aria-label="Chord progression">
      <div className="progressionHeading">
        <div className="progressionTitle"><h2>Progression</h2><span>{totalLabel}</span><z-button kind="soft" size="sm" tone="primary" onClick={render.playProgression} isDisabled={isEmpty} aria-label={playLabel}>{playSymbol} {playLabel}</z-button><z-button kind="ghost" size="sm" onClick={render.exportProgression} isDisabled={isEmpty}>Export MIDI</z-button></div>
        </div>
      <div className="progressionBar">{entries}{emptyMessage}</div>
      {entryControls}
    </section>
  )
}

import * as React from 'react'
import { scaled } from '@tasteee/scaled'
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
    <button type="button" className="progressionChord" style={chordStyle} aria-pressed={props.isSelected}  data-playing={isPlaying} onPointerDown={handlePreview} onPointerUp={piano.stopPreview} onPointerCancel={piano.stopPreview} onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) { event.preventDefault(); piano.unlockPiano(); store.session.set({ selectedId: props.entry.id }); void render.previewEntry(props.entry) } }} onKeyUp={piano.stopPreview} onBlur={piano.stopPreview} onMouseLeave={piano.stopPreview} onClick={handleSelect}>
      <strong>{props.entry.symbol}</strong><span>{durationLabel}</span>
    </button>
  )
}

const EntryControls = (props: { entry: model.EntryT; position: number; count: number }) => {
  const updateEntry = (changes: Partial<model.EntryT>): void => { store.updateEntry(props.entry.id, changes); return undefined }
  const handleDuration = (durationBars: number): void => { const durationBeats = durationBars * 4; updateEntry({ durationBeats }); return undefined }
  const handleVoicing = (voicing: string): void => { updateEntry({ voicing }); return undefined }
  const handlePerformance = (performance: string): void => { updateEntry({ performance }); return undefined }
  const handleSpeed = (value: string): void => {
    const shouldInherit = value === 'inherit'
    const speedMultiplier = shouldInherit ? null : Number(value)
    updateEntry({ speedMultiplier })
    return undefined
  }
  const handleInversion = (inversion: number): void => { updateEntry({ inversion }); return undefined }
  const handleOctaveOffset = (octaveOffset: number): void => { updateEntry({ octaveOffset }); return undefined }
  const handleMoveLeft = (): void => { store.moveEntry(props.entry.id, -1); return undefined }
  const handleMoveRight = (): void => { store.moveEntry(props.entry.id, 1); return undefined }
  const handleRemove = (): void => { store.removeEntry(props.entry.id); return undefined }
  const isFirst = props.position === 0
  const isLast = props.position === props.count - 1
  const durationBars = props.entry.durationBeats / 4
  const shouldInheritSpeed = props.entry.speedMultiplier === null
  const speedValue = shouldInheritSpeed ? 'inherit' : String(props.entry.speedMultiplier)
  return (
    <div className="entryControls" aria-label="Selected chord settings">
      <div className="entryNumber"><fields.NumberField label="Duration · bars" value={durationBars} min={0.00390625} max={32} step={0.25} onChange={handleDuration} /></div>
      <div className="entryChoice"><fields.Choice label="Voicing" value={props.entry.voicing} options={model.inheritedVoicingOptions} onChange={handleVoicing} isSearchable /></div>
      <div className="entryNumber"><fields.NumberField label="Inversion" value={props.entry.inversion} min={-4} max={7} step={1} onChange={handleInversion} /></div>
      <div className="entryNumber"><fields.NumberField label="Octave offset" value={props.entry.octaveOffset} min={-2} max={2} step={1} onChange={handleOctaveOffset} /></div>
      <div className="entryPerformance"><fields.Choice label="Performance" value={props.entry.performance} options={model.inheritedPerformanceSelectOptions} onChange={handlePerformance} /></div>
      <div className="entryChoice"><fields.Choice label="Pattern speed" value={speedValue} options={model.inheritedSpeedOptions} onChange={handleSpeed} /></div>
      <div className="entryActions"><z-button kind="ghost" size="sm" onClick={handleMoveLeft} isDisabled={isFirst} aria-label="Move chord left">←</z-button><z-button kind="ghost" size="sm" onClick={handleMoveRight} isDisabled={isLast} aria-label="Move chord right">→</z-button><z-button kind="ghost" size="sm" tone="danger" onClick={handleRemove} aria-label="Remove chord">×</z-button></div>
    </div>
  )
}


const Suggestions = (props: { entry: model.EntryT | undefined; session: model.SessionT }) => {
  const [inScaleOnly, setInScaleOnly] = React.useState(false)
  const result = React.useMemo(() => {
    if (!props.entry) return { chords: [], error: '' }
    try {
      return { chords: scaled.getSuggestions({ chord: props.entry.symbol, key: props.session.key, scale: props.session.scale, inScaleOnly }), error: '' }
    } catch (error) {
      return { chords: [], error: error instanceof Error ? error.message : 'Unable to load suggestions' }
    }
  }, [props.entry?.symbol, props.session.key, props.session.scale, inScaleOnly])
  return <div className="suggestions">
    <div className="suggestionHeading"><h3>{props.entry ? 'After ' + props.entry.symbol : 'Next chord suggestions'} <span>· {result.chords.length}</span></h3>
      <label><input type="checkbox" checked={inScaleOnly} onChange={(event) => setInScaleOnly(event.target.checked)} /> In-scale only</label>
    </div>
    <p className="chordHint">Hold to audition · double-click to add. Suggestions follow the selected chord.</p>
    <div className="suggestionRow" aria-label="Suggested next chords">
      {result.chords.map((chord) => <button type="button" className="suggestionChord" key={chord.token} disabled={!chord.symbol}
        title={'Corpus weight: ' + chord.weight}
        onPointerDown={(event) => { if (event.button !== 0 || !chord.symbol) return; event.preventDefault(); piano.unlockPiano(); void render.previewEntry(model.createEntry(chord.symbol)) }}
        onPointerUp={piano.stopPreview} onPointerCancel={piano.stopPreview} onPointerLeave={piano.stopPreview} onBlur={piano.stopPreview}
        onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === ' ') && !event.repeat && chord.symbol) { event.preventDefault(); piano.unlockPiano(); void render.previewEntry(model.createEntry(chord.symbol)) } }} onKeyUp={piano.stopPreview}
        onDoubleClick={() => { if (chord.symbol) store.addChord(chord.symbol) }}>
        <strong>{chord.symbol ?? chord.targetType}</strong><span>{chord.isInScale ? 'In scale' : chord.symbol ? 'Chromatic' : 'Unavailable'} · {chord.weight}</span>
      </button>)}
      {result.chords.length === 0 && <p className="progressionEmpty">{result.error || (props.entry ? 'No corpus transitions for this chord. Explore the chord library above.' : 'Add and select a chord to see suggestions.')}</p>}
    </div>
  </div>
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
  const emptyMessage = isEmpty ? <p className="progressionEmpty">Double-click a library chord to build your progression.</p> : null
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
      <Suggestions entry={selectedEntry} session={session} />
      <div className="progressionBar">{entries}{emptyMessage}</div>
      {entryControls}
    </section>
  )
}

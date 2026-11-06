import type * as React from 'react'
import * as model from './model'
import * as store from './store'
import * as render from './render'
import * as piano from '../piano'
import './ChordGrid.css'

const ChordTile = (props: { chord: model.GridChordT }) => {
  const handlePreview = (event: React.MouseEvent<HTMLElement>): void => {
    const isPrimary = event.button === 0
    if (!isPrimary) return undefined
    event.preventDefault()
    piano.unlockPiano()
    const entry = model.createEntry(props.chord.symbol, props.chord.sourceSlot)
    void render.previewEntry(entry)
    return undefined
  }
  const handleKeyboardPreview = (event: React.KeyboardEvent<HTMLElement>): void => {
    const isActivation = event.key === 'Enter' || event.key === ' '
    if (!isActivation) return undefined
    event.preventDefault()
    event.stopPropagation()
    if (event.repeat) return undefined
    piano.unlockPiano()
    const entry = model.createEntry(props.chord.symbol, props.chord.sourceSlot)
    void render.previewEntry(entry)
    return undefined
  }
  const handleAdd = (event: React.MouseEvent<HTMLElement>): void => {
    event.stopPropagation()
    store.addChord(props.chord.symbol, props.chord.sourceSlot)
    return undefined
  }
  const handleAddMouseDown = (event: React.MouseEvent<HTMLElement>): void => { event.stopPropagation(); return undefined }
  const previewLabel = `Hold to preview ${props.chord.symbol}`
  const addLabel = `Add ${props.chord.symbol} to progression`
  return (
    <div className="chordTile"><button type="button" className="previewChord" aria-label={previewLabel} onPointerDown={handlePreview} onPointerCancel={piano.stopPreview} onPointerUp={piano.stopPreview} onMouseLeave={piano.stopPreview} onKeyDown={handleKeyboardPreview} onKeyUp={piano.stopPreview}>
      <span className="chordSymbol">{props.chord.symbol}</span></button>
      <z-button className="chordAdd" size="sm" kind="ghost" aria-label={addLabel} onMouseDown={handleAddMouseDown} onClick={handleAdd}><span>+</span></z-button>
    </div>
  )
}

export const ChordGrid = () => {
  const session: model.SessionT = store.session.use()
  const chords = model.getVisibleChords(session)
  const groups = new Map<number, [model.GridChordT, ...model.GridChordT[]]>()
  for (const chord of chords) {
    const family = groups.get(chord.rootPitch)
    if (family) {
      family.push(chord)
      continue
    }
    groups.set(chord.rootPitch, [chord])
  }
  const columns = Array.from(groups.values()).map((family) => {
    const firstChord = family[0]
    const rootName = firstChord.symbol.match(/^[A-G][#b♯♭]?/)?.[0] ?? firstChord.symbol
    const tiles = family.map((chord) => {
      const chordKey = `${chord.symbol}:${chord.sourceSlot}`
      return <ChordTile key={chordKey} chord={chord} />
    })
    return <section className="rootGroup" key={firstChord.rootPitch}><h3>{rootName}</h3>{tiles}</section>
  })
  const hasNoChords = chords.length === 0
  const emptyMessage = hasNoChords ? <z-empty-state heading="No compatible chords" description="Choose another scale or chord family." /> : null
  return <div className="chordGrid" aria-label="Compatible chord library"><h2 className="libraryTitle">Chord library</h2><div className="chordTiles">{columns}</div>{emptyMessage}</div>
}



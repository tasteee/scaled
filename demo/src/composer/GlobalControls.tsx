import * as fields from './Fields'
import * as model from './model'
import * as store from './store'
import './GlobalControls.css'

const handleKey = (key: string): void => { store.updateSession({ key }); return undefined }
const handleScale = (scale: string): void => { store.updateSession({ scale }); return undefined }
const handleOctave = (octave: number): void => { store.updateSession({ octave }); return undefined }
const handleVoicing = (voicing: string): void => { store.updateSession({ voicing }); return undefined }
const handlePerformance = (performance: string): void => { store.updateSession({ performance }); return undefined }
const handleSpeed = (value: string): void => {
  const speedMultiplier = Number(value)
  store.updateSession({ speedMultiplier })
  return undefined
}
const handleTempo = (tempo: number): void => { store.updateSession({ tempo }); return undefined }
const handleFamily = (family: string): void => { store.updateSession({ family }); return undefined }
const handlePreviewSwitch = (event: CustomEvent<{ checked: boolean }>): void => { store.updateSession({ shouldPreviewPerformance: event.detail.checked }); return undefined }

export const GlobalControls = () => {
  const session: model.SessionT = store.session.use()
  const speedValue = String(session.speedMultiplier)
  return (
    <div className="globalControls" aria-label="Global musical settings">
      <div className="primaryControls">
        <fields.Choice label="Key" value={session.key} options={model.keyOptions} onChange={handleKey} />
        <fields.Choice label="Scale" value={session.scale} options={model.scaleOptions} onChange={handleScale} isSearchable />
        <fields.NumberField label="Root octave" value={session.octave} min={2} max={6} step={1} onChange={handleOctave} />
        <fields.NumberField label="BPM" value={session.tempo} min={30} max={300} step={1} onChange={handleTempo} />
      </div>
      <div className="secondaryControls">
        <fields.Choice label="Chord family" value={session.family} options={model.familyOptions} onChange={handleFamily} />
        <fields.Choice label="Global voicing" value={session.voicing} options={model.allVoicingOptions} onChange={handleVoicing} isSearchable />
        <fields.Choice label="Global performance" value={session.performance} options={model.allPerformanceOptions} onChange={handlePerformance} isSearchable />
        <fields.Choice label="Pattern speed" value={speedValue} options={model.speedOptions} onChange={handleSpeed} />
        <z-switch label="Preview with performance" isChecked={session.shouldPreviewPerformance} onchange={handlePreviewSwitch}>Preview with performance</z-switch>
      </div>
    </div>
  )
}

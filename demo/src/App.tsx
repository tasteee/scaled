import * as React from 'react'
import * as controls from './composer/GlobalControls'
import * as chords from './composer/ChordGrid'
import * as progression from './composer/Progression'
import * as store from './composer/store'
import * as render from './composer/render'
import * as piano from './piano'
import './App.css'

const subscribeToEditor = () => {
  void piano.warmPiano()
  const handleKeyDown = (event: KeyboardEvent): void => {
    const isSpace = event.code === 'Space'
    const shouldIgnore = !isSpace || event.repeat || event.altKey || event.ctrlKey || event.metaKey
    if (shouldIgnore) return undefined
    const isEditing = event.composedPath().some((element) => {
      const isElement = element instanceof HTMLElement
      if (!isElement) return false
      const isControl = element.matches('button, [role="button"], input, textarea, select, [role="combobox"], [role="switch"]')
      const shouldHandleLocally = isControl || element.isContentEditable
      return shouldHandleLocally
    })
    if (isEditing) return undefined
    event.preventDefault()
    piano.unlockPiano()
    void render.playProgression()
    return undefined
  }
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('mouseup', piano.stopPreview)
  window.addEventListener('blur', piano.stopPlayback)
  const unsubscribe = (): void => {
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('mouseup', piano.stopPreview)
    window.removeEventListener('blur', piano.stopPlayback)
    piano.stopPlayback()
    return undefined
  }
  return unsubscribe
}

export const App = () => {
  const session = store.session.use()
  const audio = piano.audioStatus.use()
  React.useEffect(subscribeToEditor, [])
  const errorMessage = session.error || audio.error
  const hasError = errorMessage.length > 0
  const errorNotice = hasError ? <z-alert tone="warning">{errorMessage}</z-alert> : null
  return <main className="app"><header className="studioHeader"><h1>Chord composer</h1><span className="studioBrand">scaled</span></header><controls.GlobalControls /><div className="editorStatus">{errorNotice}</div><progression.Progression /><chords.ChordGrid /></main>
}

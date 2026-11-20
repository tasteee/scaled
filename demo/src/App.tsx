import * as React from 'react'
import * as controls from './composer/GlobalControls'
import * as chords from './composer/ChordGrid'
import * as progression from './composer/Progression'
import * as store from './composer/store'
import * as render from './composer/render'
import * as piano from './piano'
import * as apiDocs from './api-docs/ApiDocs'
import './App.css'

type PageT = 'composer' | 'api'

const getInitialPage = (): PageT => {
  const hash = window.location.hash.toLowerCase()
  const isApi = hash === '#api' || hash === '#/api' || hash.startsWith('#api-')
  return isApi ? 'api' : 'composer'
}

const subscribeToEditor = (page: PageT) => {
  if (page !== 'composer') {
    piano.stopPlayback()
    return undefined
  }
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
  const [page, setPage] = React.useState<PageT>(getInitialPage)
  const session = store.session.use()
  const audio = piano.audioStatus.use()

  React.useEffect(() => {
    const handleHash = () => {
      setPage(getInitialPage())
    }
    window.addEventListener('hashchange', handleHash)
    return () => {
      window.removeEventListener('hashchange', handleHash)
    }
  }, [])

  React.useEffect(() => {
    return subscribeToEditor(page)
  }, [page])

  const handleNavigate = (target: PageT): void => {
    setPage(target)
    if (target === 'api') {
      window.location.hash = '#api'
    } else {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }

  const errorMessage = session.error || audio.error
  const hasError = errorMessage.length > 0
  const errorNotice = hasError ? <z-alert tone="warning">{errorMessage}</z-alert> : null

  return (
    <main className="app">
      <header className="studioHeader">
        <div className="studioBrandGroup">
          <h1>{page === 'api' ? 'API Documentation' : 'Chord composer'}</h1>
          <span className="studioBrand">scaled</span>
        </div>
        <z-row gap="var(--spacing-2)" alignsY="center">
          <z-button
            kind={page === 'composer' ? 'soft' : 'ghost'}
            size="sm"
            onClick={() => handleNavigate('composer')}
          >
            Composer
          </z-button>
          <z-button
            kind={page === 'api' ? 'soft' : 'ghost'}
            size="sm"
            onClick={() => handleNavigate('api')}
          >
            API Reference
          </z-button>
        </z-row>
      </header>

      {page === 'composer' ? (
        <>
          <controls.GlobalControls />
          <div className="editorStatus">{errorNotice}</div>
          <progression.Progression />
          <chords.ChordGrid />
        </>
      ) : (
        <apiDocs.ApiDocs />
      )}
    </main>
  )
}

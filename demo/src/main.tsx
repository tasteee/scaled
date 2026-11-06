import * as React from 'react'
import * as ReactDOM from 'react-dom/client'
import * as application from './App'
import '@tasteee/zest'
import '@tasteee/zest/ink.css'
import '@tasteee/zest/fonts.css'
import './base.css'

const container = document.getElementById('root')
const isMissingContainer = container === null
if (isMissingContainer) throw new Error('Missing application root')
const root = ReactDOM.createRoot(container)
root.render(
  <React.StrictMode>
    <application.App />
  </React.StrictMode>
)

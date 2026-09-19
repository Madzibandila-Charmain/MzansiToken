import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
/* Shared styles, in the order they must load. Pages import their own. */
import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/components.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
/*
    The shared style layers, imported in cascade order. Each page imports
    its own stylesheet from its own file, so nothing global knows about
    Home, Inspect, Rank or Compare.
*/
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

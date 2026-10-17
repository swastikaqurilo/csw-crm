import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('A new version of CSW CRM is available. Reload now?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('CSW CRM is ready for offline use.')
  },
})
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppTeacher from './AppTeacher.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppTeacher />
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import FormBuilder from './FormBuilder.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <FormBuilder />
  </StrictMode>,
)

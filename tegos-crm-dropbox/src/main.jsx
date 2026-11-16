import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AppWrapper from './AppWrapper.jsx'
import { supabase } from './lib/supabase'
import './index.css'

// Los archivos guardados en Dropbox tienen enlaces "dbx:...". Al pulsarlos se pide a Dropbox
// un enlace temporal y se abre en una pestaña nueva.
document.addEventListener('click', async e => {
  const a = e.target.closest?.('a[href^="dbx:"]')
  if (!a) return
  e.preventDefault()
  const ventana = window.open('', '_blank')
  try {
    const url = await supabase.resolverUrl(a.getAttribute('href'))
    if (ventana) ventana.location = url
    else window.location.assign(url)
  } catch (err) {
    if (ventana) ventana.close()
    alert('No se pudo abrir el archivo: ' + err.message)
  }
}, true)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppWrapper />
    </BrowserRouter>
  </React.StrictMode>
)

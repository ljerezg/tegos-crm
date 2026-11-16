import { useState } from 'react'
import { iniciarLogin } from '../lib/sesion'

export default function Login({ error: errorInicial, aviso }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(errorInicial || '')

  async function entrar() {
    setLoading(true); setError('')
    try { await iniciarLogin() }
    catch (err) { setError(err.message); setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 380, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 32, boxShadow: 'var(--shadow-md)' }}>
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.3px', color: 'var(--text)' }}>Tegos CRM</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>Gestión de alquileres</div>
        </div>
        {aviso && <div style={{ fontSize: 13, marginBottom: 14, background: 'var(--info-bg, #eef4fb)', color: 'var(--info-text)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>{aviso}</div>}
        {error && <div style={{ color: 'var(--danger-text)', fontSize: 13, marginBottom: 14, background: 'var(--danger-bg)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px' }} onClick={entrar} disabled={loading}>
          {loading ? <><i className="ti ti-loader ti-spin" /> Abriendo Dropbox...</> : <><i className="ti ti-brand-dropbox" /> Entrar con Dropbox</>}
        </button>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 16, textAlign: 'center' }}>
          Usa la cuenta de Dropbox con la que se ha compartido la carpeta del CRM.
        </p>
      </div>
    </div>
  )
}

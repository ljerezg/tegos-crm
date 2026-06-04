import { useState } from 'react'
import { login } from '../lib/auth'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await login(email, password)
      onLogin()
    } catch(err) {
      setError('Email o contraseña incorrectos')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 380, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 32, boxShadow: 'var(--shadow-md)' }}>
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.3px', color: 'var(--text)' }}>Tegos CRM</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>Gestión de alquileres</div>
        </div>
        <form onSubmit={handleLogin}>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" required autoFocus />
          </div>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          {error && <div style={{ color: 'var(--danger-text)', fontSize: 13, marginBottom: 14, background: 'var(--danger-bg)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px' }} disabled={loading}>
            {loading ? <><i className="ti ti-loader ti-spin" /> Entrando...</> : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login.jsx'
import App from './App.jsx'

export default function AppWrapper() {
  const [session, setSession] = useState(undefined)
  const [perfil, setPerfil] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) cargarPerfil(session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) cargarPerfil(session.user.id)
      else setPerfil(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function cargarPerfil(userId) {
    const { data } = await supabase.from('perfil_usuario').select('*').eq('id', userId).single()
    setPerfil(data)
  }

  if (session === undefined) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <i className="ti ti-loader ti-spin" style={{ fontSize: 24, color: 'var(--text3)' }} />
    </div>
  )

  if (!session) return <Login onLogin={() => {}} />

  return <App perfil={perfil} />
}

import { useEffect, useState } from 'react'
import { configurarBase, fijarPerfil } from './lib/supabase'
import { completarLogin, haySesion, cuentaActual, localizarCarpeta, crearCarpetaCRM, cerrarSesion, CARPETA } from './lib/sesion'
import Login from './pages/Login.jsx'
import App from './App.jsx'

const centro = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }

// Busca el perfil del usuario por su correo de Dropbox (campo email_dropbox o, si no, email)
export function elegirPerfil(perfiles, email) {
  const e = (email || '').toLowerCase()
  const porDropbox = perfiles.filter(p => (p.email_dropbox || '').toLowerCase() === e)
  const porEmail = perfiles.filter(p => !p.email_dropbox && (p.email || '').toLowerCase() === e)
  const candidatos = porDropbox.length ? porDropbox : porEmail
  const orden = { administrador: 0, visor: 1, personalizado: 2, propietario: 3 }
  return candidatos.sort((a, b) => (orden[a.rol] ?? 9) - (orden[b.rol] ?? 9))[0] || null
}

export default function AppWrapper() {
  const [estado, setEstado] = useState({ fase: 'cargando' })

  useEffect(() => { arrancar() }, [])

  async function arrancar() {
    try {
      await completarLogin()
      if (!haySesion()) return setEstado({ fase: 'login' })
      const cuenta = await cuentaActual()
      let raiz = await localizarCarpeta()
      if (!raiz) return setEstado({ fase: 'sin-carpeta', cuenta })
      const db = configurarBase(raiz)
      const perfiles = await db.tabla('perfil_usuario')
      let perfil
      if (!perfiles.length) {
        // Carpeta vacía (antes de migrar): quien la abre entra como administrador para poder importar los datos
        perfil = { id: 'inicial', email: cuenta.email, email_dropbox: cuenta.email, nombre: cuenta.nombre, rol: 'administrador', activo: true, inicial: true }
      } else {
        perfil = elegirPerfil(perfiles, cuenta.email)
        if (!perfil || perfil.activo === false) return setEstado({ fase: 'sin-permiso', cuenta })
      }
      if (perfil.propietario_id) {
        const props = await db.tabla('propietarios')
        perfil = { ...perfil, propietarios: props.find(p => p.id === perfil.propietario_id) || null }
      }
      fijarPerfil(perfil)
      setEstado({ fase: 'dentro', perfil, cuenta, raiz })
    } catch (e) {
      console.error(e)
      if (/Sesión caducada|invalid_grant|expired_access_token|401/.test(e.message)) {
        localStorage.removeItem('tegos-crm-dropbox')
        return setEstado({ fase: 'login', aviso: 'La sesión ha caducado. Vuelve a entrar.' })
      }
      setEstado({ fase: 'error', mensaje: e.message })
    }
  }

  async function crearCarpeta() {
    setEstado({ fase: 'cargando' })
    try { await crearCarpetaCRM(); await arrancar() } catch (e) { setEstado({ fase: 'error', mensaje: e.message }) }
  }

  const { fase } = estado
  if (fase === 'cargando') return <div style={centro}><i className="ti ti-loader ti-spin" style={{ fontSize: 24, color: 'var(--text3)' }} /></div>
  if (fase === 'login') return <Login aviso={estado.aviso} />
  if (fase === 'dentro') return <App perfil={estado.perfil} />

  const caja = (titulo, cuerpo, acciones) => (
    <div style={centro}>
      <div style={{ maxWidth: 460, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 28, boxShadow: 'var(--shadow-md)' }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{titulo}</h2>
        <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.5 }}>{cuerpo}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          {acciones}
          <button className="btn btn-ghost btn-sm" onClick={() => cerrarSesion()}><i className="ti ti-logout" /> Salir</button>
        </div>
      </div>
    </div>
  )

  if (fase === 'sin-carpeta') return caja('No encuentro la carpeta del CRM',
    <>
      <p>La cuenta de Dropbox <strong>{estado.cuenta.email}</strong> no tiene la carpeta <strong>{CARPETA}</strong>.</p>
      <p>Si eres un usuario del CRM, pide al administrador que te la comparta y acepta la invitación que te llegará por correo.</p>
      <p>Si eres el administrador y es la primera vez, créala aquí.</p>
    </>,
    <>
      <button className="btn btn-sm" onClick={arrancar}><i className="ti ti-refresh" /> Volver a mirar</button>
      <button className="btn btn-primary btn-sm" onClick={crearCarpeta}><i className="ti ti-folder-plus" /> Crear carpeta</button>
    </>)

  if (fase === 'sin-permiso') return caja('Sin acceso al CRM',
    <p>La cuenta de Dropbox <strong>{estado.cuenta.email}</strong> no tiene un usuario activo en el CRM. Pide al administrador que te dé de alta con este correo.</p>,
    <button className="btn btn-sm" onClick={arrancar}><i className="ti ti-refresh" /> Volver a mirar</button>)

  return caja('Algo ha fallado', <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{estado.mensaje}</p>,
    <button className="btn btn-sm" onClick={arrancar}><i className="ti ti-refresh" /> Reintentar</button>)
}

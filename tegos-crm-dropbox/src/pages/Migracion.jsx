import { useState } from 'react'
import { base } from '../lib/supabase'
import { dbx, cuentaActual, iniciarLogin, APP_KEY } from '../lib/sesion'
import { NOMBRES_TABLAS } from '../lib/schema'

// Datos públicos del CRM antiguo (los mismos que llevaba la web anterior)
const SUPABASE_URL = 'https://fkdphovtwnexipnsfslh.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrZHBob3Z0d25leGlwbnNmc2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMjE2NDQsImV4cCI6MjA5NTg5NzY0NH0.EPy6DSbHAXYwAuLsYqhtuvvGtTz-g-rdnFIKR9qjmZ0'
const PREFIJO_STORAGE = `${SUPABASE_URL}/storage/v1/object/public/documentos-tegos/`

function decodificar(s) { try { return decodeURIComponent(s) } catch { return s } }

// Convierte una URL pública de Supabase Storage en "dbx:documentos-tegos/<ruta>"
export function convertirUrl(url, archivos) {
  if (!url || typeof url !== 'string' || !url.startsWith(PREFIJO_STORAGE)) return url
  const ruta = decodificar(url.slice(PREFIJO_STORAGE.length).split('?')[0])
  archivos.set(ruta, url)
  return `dbx:documentos-tegos/${ruta}`
}

export default function Migracion() {
  const [email, setEmail] = useState('ljerezg@tegos.es')
  const [password, setPassword] = useState('')
  const [log, setLog] = useState([])
  const [trabajando, setTrabajando] = useState(false)
  const [conArchivos, setConArchivos] = useState(true)
  const [clave] = useState(() => { const c = sessionStorage.getItem('clave-servicio'); sessionStorage.removeItem('clave-servicio'); return c })

  const anotar = (texto, tipo = '') => setLog(l => [...l, { texto, tipo, t: new Date().toLocaleTimeString() }])

  async function importar() {
    if (!password) return alert('Escribe la contraseña del CRM antiguo')
    if (!confirm('Esto sustituye los datos de la versión Dropbox por los del CRM antiguo (Supabase). Los cambios hechos solo en la versión Dropbox se perderán. ¿Seguimos?')) return
    setTrabajando(true); setLog([])
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
      const { error: errLogin } = await sb.auth.signInWithPassword({ email, password })
      if (errLogin) throw new Error('No se pudo entrar en Supabase: ' + errLogin.message)
      anotar('Conectado al CRM antiguo')

      const db = base()
      const cuenta = await cuentaActual()
      const perfilesActuales = await db.tabla('perfil_usuario').catch(() => [])
      const archivos = new Map()
      const datos = {}

      for (const tabla of NOMBRES_TABLAS) {
        let filas = [], desde = 0
        for (;;) {
          const { data, error } = await sb.from(tabla).select('*').order('id').range(desde, desde + 999)
          if (error) throw new Error(`Error leyendo ${tabla}: ${error.message}`)
          filas = filas.concat(data)
          if (data.length < 1000) break
          desde += 1000
        }
        datos[tabla] = filas
      }

      // URLs de archivos → Dropbox
      for (const d of datos.documento) d.url_archivo = convertirUrl(d.url_archivo, archivos)
      for (const c of datos.correo) c.archivo_url = convertirUrl(c.archivo_url, archivos)
      for (const i of datos.inquilinos) {
        i.contrato_url = convertirUrl(i.contrato_url, archivos)
        i.fianza_ivima_url = convertirUrl(i.fianza_ivima_url, archivos)
      }

      // Usuarios: conservar el correo de Dropbox ya configurado y vincular al administrador que importa
      for (const p of datos.perfil_usuario) {
        const previo = perfilesActuales.find(x => x.id === p.id)
        p.email_dropbox = previo?.email_dropbox || null
      }
      const yaVinculado = datos.perfil_usuario.some(p => (p.email_dropbox || '').toLowerCase() === cuenta.email)
      if (!yaVinculado) {
        const admin = datos.perfil_usuario.find(p => (p.email || '').toLowerCase() === email.toLowerCase())
        if (admin) { admin.email_dropbox = cuenta.email; anotar(`El usuario ${admin.email} queda vinculado a tu Dropbox (${cuenta.email})`) }
      }

      for (const tabla of NOMBRES_TABLAS) {
        await db.reemplazarTabla(tabla, datos[tabla])
        anotar(`${tabla}: ${datos[tabla].length} registros`, 'ok')
      }
      await sb.auth.signOut()

      if (conArchivos) await copiarArchivos(db, archivos)
      await db.sincronizar(true)
      anotar('Importación terminada. Recarga la página para ver los datos.', 'ok')
    } catch (e) {
      anotar(e.message, 'error')
    }
    setTrabajando(false)
  }

  // Dropbox descarga cada archivo directamente desde Supabase (save_url), sin pasar por el navegador
  async function copiarArchivos(db, archivos) {
    anotar(`Archivos referenciados: ${archivos.size}. Comprobando cuáles faltan en Dropbox...`)
    const existentes = new Set()
    try {
      let r = await dbx.rpc('files/list_folder', { path: db.carpetaArchivos, recursive: true, limit: 2000 })
      r.entries.forEach(e => existentes.add(e.path_lower))
      while (r.has_more) { r = await dbx.rpc('files/list_folder/continue', { cursor: r.cursor }); r.entries.forEach(e => existentes.add(e.path_lower)) }
    } catch (e) { if (!(e.status === 409)) throw e }

    const pendientes = [...archivos.entries()].filter(([ruta]) => !existentes.has(`${db.carpetaArchivos}/${ruta}`.toLowerCase()))
    anotar(`Faltan ${pendientes.length}. Copiando...`)
    let hechos = 0
    const fallos = []
    // Dropbox rechaza a veces escrituras simultáneas: cada archivo se reintenta hasta 5 veces
    const copiarUno = async (ruta) => {
      const urlCodificada = PREFIJO_STORAGE + ruta.split('/').map(encodeURIComponent).join('/')
      const r = await dbx.rpc('files/save_url', { path: `${db.carpetaArchivos}/${ruta}`, url: urlCodificada })
      if (r['.tag'] !== 'async_job_id') return
      for (let i = 0; i < 200; i++) {
        await new Promise(res => setTimeout(res, 1500))
        const s = await dbx.rpc('files/save_url/check_job_status', { async_job_id: r.async_job_id })
        if (s['.tag'] === 'complete') return
        if (s['.tag'] === 'failed') throw new Error(JSON.stringify(s.failed))
      }
      throw new Error('Dropbox no terminó de descargarlo a tiempo')
    }
    const copiar = async ([ruta]) => {
      let ultimoError = null
      for (let intento = 1; intento <= 5; intento++) {
        try { await copiarUno(ruta); ultimoError = null; break }
        catch (e) {
          ultimoError = e
          if (/conflict.*file/.test(e.message)) { ultimoError = null; break } // ya existe
          await new Promise(res => setTimeout(res, 2000 * intento))
        }
      }
      if (ultimoError) fallos.push(`${ruta}: ${ultimoError.message}`)
      hechos++
      if (hechos % 10 === 0 || hechos === pendientes.length) anotar(`Archivos: ${hechos} de ${pendientes.length}`)
    }
    for (let i = 0; i < pendientes.length; i += 2) await Promise.all(pendientes.slice(i, i + 2).map(copiar))
    if (fallos.length) { anotar(`${fallos.length} archivos no se pudieron copiar:`, 'error'); fallos.forEach(f => anotar(f, 'error')) }
    else anotar('Todos los archivos están en Dropbox', 'ok')
  }

  const color = { ok: 'var(--accent)', error: 'var(--danger-text)' }

  return (
    <div className="card">
      <div className="card-header"><h2>Importar del CRM antiguo (Supabase)</h2></div>
      <div style={{ padding: 16, fontSize: 14, color: 'var(--text2)', lineHeight: 1.5 }}>
        <p style={{ marginTop: 0 }}>Copia todas las tablas y los documentos del CRM antiguo a la carpeta de Dropbox. Se puede repetir las veces que haga falta mientras los dos funcionan en paralelo: cada vez <strong>sustituye</strong> los datos de esta versión por los del antiguo. Los documentos que ya estén en Dropbox no se vuelven a copiar.</p>
        <div className="form-grid" style={{ maxWidth: 520 }}>
          <div className="form-group"><label>Usuario del CRM antiguo</label><input value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="form-group"><label>Contraseña</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
          <div className="form-group form-full">
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={conArchivos} onChange={e => setConArchivos(e.target.checked)} style={{ width: 'auto' }} />
              Copiar también los documentos y adjuntos que usa el CRM (la primera vez tarda unos minutos)
            </label>
          </div>
        </div>
        <button className="btn btn-primary" onClick={importar} disabled={trabajando}>
          {trabajando ? <><i className="ti ti-loader ti-spin" /> Importando...</> : <><i className="ti ti-database-import" /> Importar ahora</>}
        </button>
        <div style={{ marginTop: 28, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>Clave para las tareas automáticas (GitHub)</h3>
          <p style={{ margin: '0 0 10px' }}>El sondeo de correos y el informe del día 1 se ejecutan en GitHub y necesitan permiso para leer y escribir en tu Dropbox. Pulsa el botón, autoriza en Dropbox y copia los dos valores en GitHub → Settings → Secrets and variables → Actions.</p>
          {clave ? (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 10, wordBreak: 'break-all' }}>
              <div><strong>DROPBOX_APP_KEY</strong> = {APP_KEY}</div>
              <div style={{ marginTop: 6 }}><strong>DROPBOX_REFRESH_TOKEN</strong> = {clave}</div>
              <div style={{ marginTop: 8, color: 'var(--danger-text)', fontFamily: 'inherit' }}>Cópiala ahora: no se vuelve a mostrar. No la pegues en ningún otro sitio.</div>
            </div>
          ) : (
            <button className="btn btn-sm" onClick={() => iniciarLogin('servicio')}><i className="ti ti-key" /> Generar clave para GitHub</button>
          )}
        </div>
        {log.length > 0 && (
          <div style={{ marginTop: 16, fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 10, maxHeight: 360, overflowY: 'auto' }}>
            {log.map((l, i) => <div key={i} style={{ color: color[l.tipo] }}>{l.t} · {l.texto}</div>)}
          </div>
        )}
      </div>
    </div>
  )
}

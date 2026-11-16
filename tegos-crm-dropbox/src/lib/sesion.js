// Inicio de sesión con Dropbox (OAuth 2 con PKCE: no hay ningún secreto en la web).
// Cada usuario entra con su propia cuenta de Dropbox; la carpeta del CRM está compartida entre ellos.

import { crearClienteDropbox, renovarToken } from './dropbox.js'

// La clave de la app de Dropbox es pública (no es un secreto): se puede dejar escrita aquí
export const APP_KEY = import.meta.env.VITE_DROPBOX_APP_KEY || 'whovvet6t39u1yp'
export const CARPETA = import.meta.env.VITE_DROPBOX_CARPETA || '/Tegos CRM'
const NOMBRE_CARPETA = CARPETA.split('/').filter(Boolean).pop()

const CLAVE = 'tegos-crm-dropbox'
const redirectUri = () => window.location.origin + '/'

function leer() { try { return JSON.parse(localStorage.getItem(CLAVE)) || null } catch { return null } }
function guardar(d) { try { localStorage.setItem(CLAVE, JSON.stringify(d)) } catch { /* modo privado */ } }

function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function iniciarLogin(modo = 'sesion') {
  if (!APP_KEY) throw new Error('Falta configurar VITE_DROPBOX_APP_KEY en Vercel')
  const verificador = base64url(crypto.getRandomValues(new Uint8Array(48)))
  const reto = base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador)))
  const estado = base64url(crypto.getRandomValues(new Uint8Array(12)))
  sessionStorage.setItem('pkce', JSON.stringify({ verificador, estado, volver: window.location.pathname, modo }))
  const p = new URLSearchParams({
    client_id: APP_KEY, response_type: 'code', code_challenge: reto, code_challenge_method: 'S256',
    token_access_type: 'offline', redirect_uri: redirectUri(), state: estado,
  })
  window.location.assign(`https://www.dropbox.com/oauth2/authorize?${p}`)
}

// Si volvemos de Dropbox con ?code=..., cambia el código por los tokens (una sola vez)
let completando = null
export function completarLogin() {
  if (!completando) completando = completarLoginReal()
  return completando
}
async function completarLoginReal() {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const errorDbx = url.searchParams.get('error_description') || url.searchParams.get('error')
  if (!code && !errorDbx) return false
  const pkce = JSON.parse(sessionStorage.getItem('pkce') || 'null')
  sessionStorage.removeItem('pkce')
  window.history.replaceState({}, '', pkce?.volver || '/')
  if (errorDbx) throw new Error('Dropbox no autorizó el acceso: ' + errorDbx)
  if (!pkce || url.searchParams.get('state') !== pkce.estado) throw new Error('La respuesta de Dropbox no coincide. Vuelve a intentarlo.')
  const resp = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({ code, grant_type: 'authorization_code', code_verifier: pkce.verificador, client_id: APP_KEY, redirect_uri: redirectUri() }),
  })
  const d = await resp.json()
  if (!resp.ok) throw new Error('No se pudo entrar: ' + (d.error_description || d.error))
  if (pkce.modo === 'servicio') {
    // Clave aparte para GitHub Actions: no toca la sesión del navegador
    sessionStorage.setItem('clave-servicio', d.refresh_token)
    return true
  }
  guardar({ refresh: d.refresh_token, token: d.access_token, caduca: Date.now() + (d.expires_in - 120) * 1000, cuenta: d.account_id })
  return true
}

export function haySesion() { return !!leer()?.refresh }

export async function getToken() {
  const s = leer()
  if (!s?.refresh) throw new Error('Sesión caducada')
  if (s.token && s.caduca > Date.now()) return s.token
  const r = await renovarToken(APP_KEY, s.refresh)
  guardar({ ...s, token: r.token, caduca: r.caduca })
  return r.token
}

export const dbx = crearClienteDropbox(getToken)

export async function cerrarSesion() {
  try { await dbx.rpc('auth/token/revoke') } catch { /* da igual */ }
  localStorage.removeItem(CLAVE)
  window.location.assign('/')
}

export async function cuentaActual() {
  const c = await dbx.rpc('users/get_current_account')
  return { id: c.account_id, email: (c.email || '').toLowerCase(), nombre: c.name?.display_name || c.email }
}

// Encuentra la carpeta del CRM en la cuenta de este usuario. Si se la han compartido y aún
// no la ha añadido a su Dropbox, la añade. Devuelve la ruta o null si no la tiene.
export async function localizarCarpeta() {
  try {
    const m = await dbx.rpc('files/get_metadata', { path: CARPETA })
    if (m['.tag'] === 'folder') return m.path_display
  } catch (e) { if (!(e.status === 409)) throw e }
  // ¿Compartida con él pero en otro sitio o sin añadir?
  let r = await dbx.rpc('sharing/list_folders', { limit: 1000 })
  let carpetas = r.entries
  while (r.cursor) { r = await dbx.rpc('sharing/list_folders/continue', { cursor: r.cursor }); carpetas = carpetas.concat(r.entries) }
  let pendientes = []
  try {
    let p = await dbx.rpc('sharing/list_mountable_folders', { limit: 1000 })
    pendientes = p.entries
  } catch { /* sin permiso: ignorar */ }
  const todas = [...carpetas, ...pendientes].filter(c => c.name === NOMBRE_CARPETA)
  const montada = todas.find(c => c.path_lower)
  if (montada) return montada.path_display || montada.path_lower
  if (todas[0]) {
    const m = await dbx.rpc('sharing/mount_folder', { shared_folder_id: todas[0].shared_folder_id })
    return m.path_display || m.path_lower
  }
  return null
}

export async function crearCarpetaCRM() {
  const r = await dbx.rpc('files/create_folder_v2', { path: CARPETA, autorename: false })
  return r.metadata.path_display
}

// Comparte la carpeta del CRM con otra persona (por su correo de Dropbox)
export async function compartirCarpeta(ruta, email, soloLectura) {
  const meta = await dbx.rpc('files/get_metadata', { path: ruta })
  let id = meta.shared_folder_id || meta.sharing_info?.shared_folder_id
  if (!id) {
    const r = await dbx.rpc('sharing/share_folder', { path: ruta, force_async: false })
    id = r.shared_folder_id
  }
  await dbx.rpc('sharing/add_folder_member', {
    shared_folder_id: id,
    members: [{ member: { '.tag': 'email', email }, access_level: { '.tag': soloLectura ? 'viewer' : 'editor' } }],
    quiet: false,
    custom_message: 'Te comparto la carpeta del CRM de Tegos. Acéptala y entra en el CRM con esta cuenta de Dropbox.',
  })
}

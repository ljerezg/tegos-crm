// Cliente mínimo de la API de Dropbox. Funciona en el navegador y en Node 18+ (usa fetch).
// getToken: función async que devuelve un access token válido.

const API = 'https://api.dropboxapi.com/2'
const CONTENT = 'https://content.dropboxapi.com/2'

// Dropbox exige que la cabecera Dropbox-API-Arg sea ASCII: se escapan tildes, eñes, etc.
export function argCabecera(obj) {
  return JSON.stringify(obj).replace(/[\u007f-￿]/g, c => '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4))
}

export class ErrorDropbox extends Error {
  constructor(status, cuerpo) {
    super(`Dropbox ${status}: ${typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)}`)
    this.status = status
    this.cuerpo = cuerpo
    this.resumen = typeof cuerpo === 'object' ? cuerpo?.error_summary || '' : String(cuerpo || '')
  }
}

export function crearClienteDropbox(getToken) {
  async function peticion(url, opciones, reintentos = 4) {
    for (let intento = 0; ; intento++) {
      const token = await getToken()
      const resp = await fetch(url, { ...opciones, headers: { Authorization: `Bearer ${token}`, ...opciones.headers } })
      if (resp.ok) return resp
      // Límite de peticiones o error temporal: esperar y reintentar
      if ((resp.status === 429 || resp.status >= 500) && intento < reintentos) {
        const espera = Number(resp.headers.get('Retry-After')) || (intento + 1)
        await new Promise(r => setTimeout(r, espera * 1000))
        continue
      }
      let cuerpo = await resp.text()
      try { cuerpo = JSON.parse(cuerpo) } catch { /* texto plano */ }
      throw new ErrorDropbox(resp.status, cuerpo)
    }
  }

  async function rpc(ruta, args) {
    const resp = await peticion(`${API}/${ruta}`, {
      method: 'POST',
      headers: args === undefined ? {} : { 'Content-Type': 'application/json' },
      body: args === undefined ? undefined : JSON.stringify(args),
    })
    const texto = await resp.text()
    return texto ? JSON.parse(texto) : null
  }

  // Descarga un fichero. Devuelve { meta, resp } o null si no existe.
  async function descargar(path) {
    try {
      const resp = await peticion(`${CONTENT}/files/download`, {
        method: 'POST',
        headers: { 'Dropbox-API-Arg': argCabecera({ path }) },
      })
      const meta = JSON.parse(resp.headers.get('Dropbox-API-Result'))
      return { meta, resp }
    } catch (e) {
      if (e.status === 409 && /not_found/.test(e.resumen)) return null
      throw e
    }
  }

  // Sube un fichero (hasta 150 MB). modo: 'add' | 'overwrite' | { '.tag': 'update', update: rev }
  async function subir(path, datos, modo = 'add', autorename = false) {
    const mode = typeof modo === 'string' ? { '.tag': modo } : modo
    const resp = await peticion(`${CONTENT}/files/upload`, {
      method: 'POST',
      headers: {
        'Dropbox-API-Arg': argCabecera({ path, mode, autorename, mute: true, strict_conflict: true }),
        'Content-Type': 'application/octet-stream',
      },
      body: datos,
    }, 2)
    return resp.json()
  }

  async function listarCarpeta(path) {
    const entradas = []
    let r = await rpc('files/list_folder', { path, recursive: false, limit: 2000 })
    entradas.push(...r.entries)
    while (r.has_more) {
      r = await rpc('files/list_folder/continue', { cursor: r.cursor })
      entradas.push(...r.entries)
    }
    return entradas
  }

  async function crearCarpeta(path) {
    try { await rpc('files/create_folder_v2', { path, autorename: false }) }
    catch (e) { if (!(e.status === 409 && /conflict/.test(e.resumen))) throw e }
  }

  async function borrar(path) {
    try { await rpc('files/delete_v2', { path }) }
    catch (e) { if (!(e.status === 409 && /not_found/.test(e.resumen))) throw e }
  }

  async function enlaceTemporal(path) {
    const r = await rpc('files/get_temporary_link', { path })
    return r.link
  }

  return { rpc, descargar, subir, listarCarpeta, crearCarpeta, borrar, enlaceTemporal }
}

// Renueva un access token a partir de un refresh token (flujo PKCE: no hace falta el secreto de la app)
export async function renovarToken(appKey, refreshToken, appSecret) {
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: appKey })
  if (appSecret) body.set('client_secret', appSecret)
  const resp = await fetch('https://api.dropboxapi.com/oauth2/token', { method: 'POST', body })
  const datos = await resp.json()
  if (!resp.ok) throw new Error('No se pudo renovar el acceso a Dropbox: ' + (datos.error_description || datos.error))
  return { token: datos.access_token, caduca: Date.now() + (datos.expires_in - 120) * 1000 }
}

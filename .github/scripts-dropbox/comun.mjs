// Conexión con la base de datos del CRM en Dropbox desde GitHub Actions.
// Usa el mismo código que la web (tegos-crm-dropbox/src/lib).
import { crearClienteDropbox, renovarToken } from '../../tegos-crm-dropbox/src/lib/dropbox.js'
import { crearBaseDatos } from '../../tegos-crm-dropbox/src/lib/db.js'

export function conectar() {
  const appKey = process.env.DROPBOX_APP_KEY || 'whovvet6t39u1yp'
  const refresh = process.env.DROPBOX_REFRESH_TOKEN
  const faltan = ['DROPBOX_REFRESH_TOKEN'].filter(k => !process.env[k])
  if (faltan.length) { console.error('Faltan variables de entorno:', faltan.join(', ')); process.exit(1) }
  let acceso = null
  const getToken = async () => {
    if (acceso && acceso.caduca > Date.now()) return acceso.token
    acceso = await renovarToken(appKey, refresh)
    return acceso.token
  }
  const dbx = crearClienteDropbox(getToken)
  const raiz = process.env.DROPBOX_CARPETA || '/Tegos CRM'
  return { dbx, db: crearBaseDatos({ dbx, raiz }) }
}

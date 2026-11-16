// Antes era el cliente de Supabase. Ahora es la base de datos en Dropbox, con la misma interfaz
// (supabase.from(...), supabase.storage...), para que el resto de la aplicación no cambie.
import { crearBaseDatos } from './db.js'
import { dbx, cerrarSesion } from './sesion.js'

let actual = null
let perfilActual = null

export function configurarBase(raiz) {
  actual = crearBaseDatos({ dbx, raiz })
  return actual
}
export function fijarPerfil(p) { perfilActual = p }
export function base() {
  if (!actual) throw new Error('La base de datos aún no está lista')
  return actual
}

export const supabase = {
  from: tabla => base().from(tabla),
  storage: { from: bucket => base().storage.from(bucket) },
  resolverUrl: url => base().resolverUrl(url),
  auth: {
    signOut: () => cerrarSesion(),
    getUser: async () => ({ data: { user: perfilActual ? { id: perfilActual.id, email: perfilActual.email } : null } }),
  },
}

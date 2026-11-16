// Base de datos del CRM guardada en Dropbox, con la misma forma de consulta que supabase-js
// (from().select().eq().order()...), para que las páginas no tengan que cambiar.
//
// Cada tabla es un fichero JSON en <raíz>/datos/<tabla>.json.
// Los archivos (documentos, adjuntos de correo) van a <raíz>/archivos/<ruta>.
// Para no pisar cambios de otro usuario, cada escritura se hace sobre la última versión
// del fichero (control por "rev"); si alguien guardó entre medias, se recarga y se repite.

import { TABLAS, FKS, UNIQUE, NOMBRES_TABLAS } from './schema.js'

// Reglas de borrado de las claves ajenas (igual que en Supabase): c = en cascada, el resto restringe
const CASCADA = new Set(['correo_propietario_id_fkey', 'usuario_inmuebles_usuario_id_fkey', 'usuario_inmuebles_inmueble_id_fkey',
  'correo_contacto_id_fkey', 'renta_inquilino_inquilino_id_fkey', 'correo_inquilino_id_fkey', 'inmueble_propietarios_inmueble_id_fkey',
  'inmueble_propietarios_propietario_id_fkey', 'accion_propietario_propietario_id_fkey', 'persona_contacto_seguro_id_fkey',
  'correo_administrador_finca_id_fkey', 'correo_seguro_id_fkey'])

const INTERVALO_SINCRONIZACION = 10_000 // ms entre comprobaciones de cambios de otros usuarios

const clonar = typeof structuredClone === 'function' ? structuredClone : (x => JSON.parse(JSON.stringify(x)))

function err(message, code) { return { message, code: code || 'DROPBOX', details: null, hint: null } }

// ── Conversión de tipos (lo que haría Postgres al guardar) ──────────────────────────────

function convertir(tabla, col, valor) {
  const def = TABLAS[tabla]?.[col]
  if (!def || valor === undefined) return valor
  if (valor === null) return null
  switch (def.tipo) {
    case 'int':
    case 'num': {
      if (valor === '') return null
      if (typeof valor === 'number') return def.tipo === 'int' ? Math.trunc(valor) : valor
      const n = Number(String(valor).replace(',', '.'))
      if (Number.isNaN(n)) throw err(`invalid input syntax for type ${def.tipo === 'int' ? 'integer' : 'numeric'}: "${valor}"`, '22P02')
      return n
    }
    case 'bool':
      if (typeof valor === 'boolean') return valor
      if (valor === '') return null
      return ['true', 't', '1', 'yes', 'si', 'sí'].includes(String(valor).toLowerCase())
    case 'date':
      if (valor === '') return null
      if (valor instanceof Date) return valor.toISOString().slice(0, 10)
      return String(valor).slice(0, 10)
    case 'ts':
      if (valor instanceof Date) return valor.toISOString()
      return valor === '' ? null : valor
    default:
      return valor
  }
}

function valorPorDefecto(def, filas) {
  const d = def.def
  if (d == null) return null
  if (d === 'seq') return filas.reduce((m, f) => Math.max(m, Number(f.id) || 0), 0) + 1
  if (d === 'uuid') return (globalThis.crypto?.randomUUID?.() ?? `u-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  if (d === 'now()') return new Date().toISOString()
  if (d === 'CURRENT_DATE') return new Date().toISOString().slice(0, 10)
  if (d === 'true') return true
  if (d === 'false') return false
  if (/^'.*'$/.test(d)) return d.slice(1, -1)
  if (/^-?\d+(\.\d+)?$/.test(d)) return Number(d)
  return null
}

// ── Comparaciones ───────────────────────────────────────────────────────────────────────

const esNumero = v => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)))

function comparar(a, b) {
  if (typeof a === 'number' || typeof b === 'number') {
    if (esNumero(a) && esNumero(b)) return Number(a) - Number(b)
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') return (a === true) - (b === true)
  return String(a).localeCompare(String(b), 'es', { sensitivity: 'variant' })
}

function igual(a, b) {
  if (a == null || b == null) return false
  if (typeof a === 'boolean' || typeof b === 'boolean') return String(a) === String(b)
  if (esNumero(a) && esNumero(b) && (typeof a === 'number' || typeof b === 'number')) return Number(a) === Number(b)
  return String(a) === String(b)
}

function patronLike(patron, insensible) {
  const re = String(patron).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')
  return new RegExp(`^${re}$`, insensible ? 'is' : 's')
}

function valorFiltro(texto) {
  // Valores que llegan como texto dentro de .or() / .filter()
  if (texto === 'null') return null
  if (texto === 'true') return true
  if (texto === 'false') return false
  return texto
}

function evaluar(op, v, val) {
  switch (op) {
    case 'eq': return igual(v, val)
    case 'neq': return v != null && val != null && !igual(v, val)
    case 'gt': return v != null && val != null && comparar(v, val) > 0
    case 'gte': return v != null && val != null && comparar(v, val) >= 0
    case 'lt': return v != null && val != null && comparar(v, val) < 0
    case 'lte': return v != null && val != null && comparar(v, val) <= 0
    case 'like': return v != null && patronLike(val, false).test(String(v))
    case 'ilike': return v != null && patronLike(val, true).test(String(v))
    case 'is': return val === null ? v == null : v === val
    case 'in': return v != null && (val || []).some(x => igual(v, x))
    default: throw err(`Operador no soportado: ${op}`)
  }
}

// Divide por comas de primer nivel (fuera de paréntesis y comillas)
function partirComas(texto) {
  const partes = []
  let nivel = 0, actual = '', comillas = false
  for (const c of texto) {
    if (c === '"') comillas = !comillas
    if (!comillas) {
      if (c === '(') nivel++
      if (c === ')') nivel--
      if (c === ',' && nivel === 0) { partes.push(actual.trim()); actual = ''; continue }
    }
    actual += c
  }
  if (actual.trim()) partes.push(actual.trim())
  return partes
}

// Convierte "col.op.valor" (sintaxis de PostgREST) en una función de fila
function condicionTexto(expr) {
  const m = expr.match(/^(and|or)\((.*)\)$/s)
  if (m) {
    const subs = partirComas(m[2]).map(condicionTexto)
    return m[1] === 'and' ? f => subs.every(s => s(f)) : f => subs.some(s => s(f))
  }
  const p1 = expr.indexOf('.')
  const col = expr.slice(0, p1)
  let resto = expr.slice(p1 + 1)
  let negado = false
  if (resto.startsWith('not.')) { negado = true; resto = resto.slice(4) }
  const p2 = resto.indexOf('.')
  const op = resto.slice(0, p2)
  let val = resto.slice(p2 + 1)
  if (op === 'in') val = partirComas(val.replace(/^\(|\)$/g, '')).map(x => x.replace(/^"|"$/g, ''))
  else val = valorFiltro(val.replace(/^"|"$/g, ''))
  return f => { const r = evaluar(op, f[col], val); return negado ? !r : r }
}

// ── Lectura del select: '*, inmuebles(codigo), alias:tabla!fk(...)' ─────────────────────

function analizarSelect(texto) {
  if (!texto || texto.trim() === '') return [{ todo: true }]
  return partirComas(texto.replace(/\s+/g, ' ')).map(parte => {
    parte = parte.trim()
    if (parte === '*') return { todo: true }
    const m = parte.match(/^(?:(\w+):)?(\w+)(?:!(\w+))?\s*\((.*)\)$/s)
    if (m) return { alias: m[1] || m[2], tabla: m[2], pista: m[3], hijos: analizarSelect(m[4]) }
    const a = parte.match(/^(?:(\w+):)?(\w+)(?:::\w+)?$/)
    if (a) return { alias: a[1] || a[2], col: a[2] }
    throw err(`No entiendo esta parte del select: ${parte}`)
  })
}

function buscarRelacion(origen, destino, pista) {
  let candidatas = [
    ...FKS.filter(([, t, , rt]) => t === origen && rt === destino).map(([n, , c]) => ({ nombre: n, col: c, directa: true })),
    ...FKS.filter(([, t, , rt]) => t === destino && rt === origen).map(([n, , c]) => ({ nombre: n, col: c, directa: false })),
  ]
  if (pista) candidatas = candidatas.filter(r => r.nombre === pista || r.col === pista)
  if (!candidatas.length) throw err(`No hay relación entre ${origen} y ${destino}`, 'PGRST200')
  return candidatas.find(r => r.directa) || candidatas[0]
}

// ── Base de datos ───────────────────────────────────────────────────────────────────────

export function crearBaseDatos({ dbx, raiz }) {
  const carpetaDatos = `${raiz}/datos`
  const carpetaArchivos = `${raiz}/archivos`
  const cache = {}           // tabla -> { filas, rev }
  let ultimaSync = 0
  let syncEnCurso = null
  const colas = {}           // tabla -> promesa (serializa escrituras propias)

  const rutaTabla = t => `${carpetaDatos}/${t}.json`

  async function descargarTabla(tabla) {
    const r = await dbx.descargar(rutaTabla(tabla))
    if (!r) { cache[tabla] = { filas: [], rev: null }; return }
    const json = JSON.parse(await r.resp.text())
    cache[tabla] = { filas: json.filas || [], rev: r.meta.rev }
  }

  // Trae las tablas que hayan cambiado desde la última vez (una sola llamada para ver las versiones)
  async function sincronizar(forzar = false) {
    if (!forzar && Date.now() - ultimaSync < INTERVALO_SINCRONIZACION && Object.keys(cache).length) return
    if (syncEnCurso) return syncEnCurso
    syncEnCurso = (async () => {
      let entradas = []
      try { entradas = await dbx.listarCarpeta(carpetaDatos) }
      catch (e) { if (!(e.status === 409 && /not_found/.test(e.resumen))) throw e }
      const revs = {}
      for (const e of entradas) if (e['.tag'] === 'file' && e.name.endsWith('.json')) revs[e.name.slice(0, -5)] = e.rev
      const pendientes = []
      for (const t of new Set([...NOMBRES_TABLAS, ...Object.keys(revs)])) {
        if (!revs[t]) { if (!cache[t] || cache[t].rev) cache[t] = { filas: [], rev: null }; continue }
        if (cache[t]?.rev !== revs[t]) pendientes.push(t)
      }
      // descargas en grupos de 6 para no saturar
      for (let i = 0; i < pendientes.length; i += 6) await Promise.all(pendientes.slice(i, i + 6).map(descargarTabla))
      ultimaSync = Date.now()
    })()
    try { await syncEnCurso } finally { syncEnCurso = null }
  }

  const filasDe = t => (cache[t]?.filas || [])

  // Aplica una modificación sobre la versión más reciente de la tabla y la guarda
  function escribir(tabla, mutar) {
    const anterior = colas[tabla] || Promise.resolve()
    const tarea = anterior.catch(() => {}).then(async () => {
      await sincronizar()
      for (let intento = 0; intento < 8; intento++) {
        const actual = cache[tabla] || { filas: [], rev: null }
        const filas = clonar(actual.filas)
        const resultado = mutar(filas)
        if (!resultado.cambiado) return resultado
        const contenido = JSON.stringify({ tabla, actualizado: new Date().toISOString(), filas })
        try {
          const meta = await dbx.subir(rutaTabla(tabla), contenido, actual.rev ? { '.tag': 'update', update: actual.rev } : 'add')
          cache[tabla] = { filas, rev: meta.rev }
          return resultado
        } catch (e) {
          if (e.status === 409 && /conflict/.test(e.resumen)) { await descargarTabla(tabla); continue }
          throw e
        }
      }
      throw err(`No se pudo guardar ${tabla}: demasiados cambios simultáneos. Vuelve a intentarlo.`)
    })
    colas[tabla] = tarea
    return tarea
  }

  // Proyecta una fila según el select (columnas y relaciones anidadas)
  function proyectar(tabla, fila, campos) {
    const salida = {}
    for (const c of campos) {
      if (c.todo) {
        for (const col of Object.keys(TABLAS[tabla] || {})) salida[col] = fila[col] ?? null
        for (const [k, v] of Object.entries(fila)) if (!(k in salida)) salida[k] = v
      } else if (c.col) {
        salida[c.alias] = fila[c.col] ?? null
      } else {
        const rel = buscarRelacion(tabla, c.tabla, c.pista)
        if (rel.directa) {
          const id = fila[rel.col]
          const hijo = id == null ? null : filasDe(c.tabla).find(f => igual(f.id, id))
          salida[c.alias] = hijo ? proyectar(c.tabla, hijo, c.hijos) : null
        } else {
          salida[c.alias] = filasDe(c.tabla).filter(f => igual(f[rel.col], fila.id)).map(f => proyectar(c.tabla, f, c.hijos))
        }
      }
    }
    return salida
  }

  // Calcula qué borrar (con cascadas) o devuelve error si hay registros que lo impiden
  function planBorrado(tabla, ids, plan = {}) {
    plan[tabla] = plan[tabla] || new Set()
    const nuevos = ids.filter(id => !plan[tabla].has(String(id)))
    nuevos.forEach(id => plan[tabla].add(String(id)))
    if (!nuevos.length) return plan
    for (const [nombre, t, col, rt] of FKS) {
      if (rt !== tabla) continue
      const hijos = filasDe(t).filter(f => f[col] != null && nuevos.some(id => igual(f[col], id)))
      if (!hijos.length) continue
      if (CASCADA.has(nombre)) planBorrado(t, hijos.map(h => h.id), plan)
      else throw err(`update or delete on table "${tabla}" violates foreign key constraint "${nombre}" on table "${t}"`, '23503')
    }
    return plan
  }

  async function ejecutar(q) {
    const tabla = q.tabla
    if (!TABLAS[tabla]) throw err(`relation "public.${tabla}" does not exist`, '42P01')
    await sincronizar()
    const cumple = f => q.filtros.every(fn => fn(f))
    const campos = analizarSelect(q.camposSel ?? '*')

    if (q.op === 'select') {
      let filas = filasDe(tabla).filter(cumple)
      filas = ordenar(filas, q.orden)
      const total = filas.length
      if (q.rango) filas = filas.slice(q.rango[0], q.rango[1] + 1)
      if (q.limite != null) filas = filas.slice(0, q.limite)
      if (q.cabecera) return { data: null, count: total }
      return { data: filas.map(f => proyectar(tabla, f, campos)), count: q.contar ? total : null }
    }

    if (q.op === 'insert' || q.op === 'upsert') {
      const entrada = Array.isArray(q.datos) ? q.datos : [q.datos]
      const clave = q.opciones?.onConflict ? q.opciones.onConflict.split(',').map(s => s.trim()) : (q.op === 'upsert' ? ['id'] : null)
      const res = await escribir(tabla, filas => {
        const afectadas = []
        for (const obj of entrada) {
          const datos = {}
          for (const [k, v] of Object.entries(obj)) datos[k] = convertir(tabla, k, v)
          if (clave) {
            const existente = filas.find(f => clave.every(c => igual(f[c], datos[c])))
            if (existente) {
              if (q.opciones?.ignoreDuplicates) continue
              Object.assign(existente, datos)
              afectadas.push(existente)
              continue
            }
          }
          // restricciones de unicidad
          for (const col of UNIQUE[tabla] || []) {
            if (datos[col] != null && filas.some(f => igual(f[col], datos[col]))) {
              if (q.opciones?.ignoreDuplicates) { datos.__omitir = true; break }
              throw err(`duplicate key value violates unique constraint "${tabla}_${col}_key"`, '23505')
            }
          }
          if (datos.__omitir) continue
          const fila = {}
          for (const [col, def] of Object.entries(TABLAS[tabla])) fila[col] = col in datos && datos[col] !== undefined ? datos[col] : valorPorDefecto(def, filas)
          for (const [k, v] of Object.entries(datos)) if (!(k in fila)) fila[k] = v
          if (fila.id != null && filas.some(f => igual(f.id, fila.id))) throw err(`duplicate key value violates unique constraint "${tabla}_pkey"`, '23505')
          filas.push(fila)
          afectadas.push(fila)
        }
        return { cambiado: afectadas.length > 0, afectadas: clonar(afectadas) }
      })
      return { data: q.camposSel != null ? res.afectadas.map(f => proyectar(tabla, f, campos)) : null }
    }

    if (q.op === 'update') {
      const datos = {}
      for (const [k, v] of Object.entries(q.datos || {})) if (v !== undefined) datos[k] = convertir(tabla, k, v)
      const res = await escribir(tabla, filas => {
        const afectadas = filas.filter(cumple)
        afectadas.forEach(f => Object.assign(f, datos))
        return { cambiado: afectadas.length > 0, afectadas: clonar(afectadas) }
      })
      return { data: q.camposSel != null ? res.afectadas.map(f => proyectar(tabla, f, campos)) : null }
    }

    if (q.op === 'delete') {
      const aBorrar = filasDe(tabla).filter(cumple)
      if (!aBorrar.length) return { data: q.camposSel != null ? [] : null }
      const plan = planBorrado(tabla, aBorrar.map(f => f.id))
      // primero los hijos (cascadas), al final la tabla principal
      const orden = Object.keys(plan).filter(t => t !== tabla).concat(tabla)
      let borradas = []
      for (const t of orden) {
        const ids = plan[t]
        const r = await escribir(t, filas => {
          const quitar = t === tabla ? filas.filter(f => cumple(f) || ids.has(String(f.id))) : filas.filter(f => ids.has(String(f.id)))
          if (!quitar.length) return { cambiado: false, afectadas: [] }
          const set = new Set(quitar)
          const quedan = filas.filter(f => !set.has(f))
          filas.length = 0
          filas.push(...quedan)
          return { cambiado: true, afectadas: clonar(quitar) }
        })
        if (t === tabla) borradas = r.afectadas
      }
      return { data: q.camposSel != null ? borradas.map(f => proyectar(tabla, f, campos)) : null }
    }
    throw err(`Operación no soportada: ${q.op}`)
  }

  function ordenar(filas, criterios) {
    if (!criterios.length) return filas
    return [...filas].sort((a, b) => {
      for (const { col, asc, nullsFirst } of criterios) {
        const va = a[col], vb = b[col]
        if (va == null && vb == null) continue
        const nulosPrimero = nullsFirst ?? !asc // como Postgres: nulos al final en ASC, al principio en DESC
        if (va == null) return nulosPrimero ? -1 : 1
        if (vb == null) return nulosPrimero ? 1 : -1
        const c = comparar(va, vb)
        if (c !== 0) return asc ? c : -c
      }
      return 0
    })
  }

  class Consulta {
    constructor(tabla) {
      this.tabla = tabla
      this.op = 'select'
      this.camposSel = undefined
      this.filtros = []
      this.orden = []
      this.limite = null
      this.rango = null
      this.unico = null
    }
    select(campos = '*', opciones = {}) {
      if (this.op === 'select') { this.camposSel = campos; this.contar = opciones.count === 'exact' || !!opciones.count; this.cabecera = !!opciones.head }
      else this.camposSel = campos
      return this
    }
    insert(datos, opciones) { this.op = 'insert'; this.datos = datos; this.opciones = opciones; return this }
    upsert(datos, opciones) { this.op = 'upsert'; this.datos = datos; this.opciones = opciones; return this }
    update(datos) { this.op = 'update'; this.datos = datos; return this }
    delete() { this.op = 'delete'; return this }
    _f(col, op, val) { this.filtros.push(f => evaluar(op, f[col], val)); return this }
    eq(c, v) { return this._f(c, 'eq', v) }
    neq(c, v) { return this._f(c, 'neq', v) }
    gt(c, v) { return this._f(c, 'gt', v) }
    gte(c, v) { return this._f(c, 'gte', v) }
    lt(c, v) { return this._f(c, 'lt', v) }
    lte(c, v) { return this._f(c, 'lte', v) }
    like(c, v) { return this._f(c, 'like', v) }
    ilike(c, v) { return this._f(c, 'ilike', v) }
    is(c, v) { return this._f(c, 'is', v) }
    in(c, v) { return this._f(c, 'in', v) }
    match(obj) { for (const [c, v] of Object.entries(obj)) this.eq(c, v); return this }
    not(c, op, v) {
      if (typeof v === 'string' && op === 'in') v = partirComas(v.replace(/^\(|\)$/g, ''))
      this.filtros.push(f => !evaluar(op, f[c], v === 'null' ? null : v)); return this
    }
    filter(c, op, v) {
      if (op.startsWith('not.')) return this.not(c, op.slice(4), v)
      if (op === 'in' && typeof v === 'string') v = partirComas(v.replace(/^\(|\)$/g, ''))
      return this._f(c, op, v === 'null' ? null : v)
    }
    or(expr) { const cond = condicionTexto(`or(${expr})`); this.filtros.push(cond); return this }
    order(col, opciones = {}) { this.orden.push({ col, asc: opciones.ascending !== false, nullsFirst: opciones.nullsFirst }); return this }
    limit(n) { this.limite = n; return this }
    range(a, b) { this.rango = [a, b]; return this }
    single() { this.unico = 'single'; return this }
    maybeSingle() { this.unico = 'maybe'; return this }
    async _resolver() {
      try {
        const r = await ejecutar(this)
        let { data } = r
        if (this.unico && Array.isArray(data)) {
          if (data.length === 1) data = data[0]
          else if (data.length === 0 && this.unico === 'maybe') data = null
          else return { data: null, error: err(`JSON object requested, multiple (or no) rows returned`, 'PGRST116'), count: null, status: 406 }
        }
        return { data, error: null, count: r.count ?? null, status: 200 }
      } catch (e) {
        const error = e && e.code && e.message ? e : err(e?.message || String(e))
        if (typeof console !== 'undefined') console.error(`[db] ${this.op} ${this.tabla}:`, error.message)
        return { data: null, error, count: null, status: 400 }
      }
    }
    then(ok, ko) { return this._resolver().then(ok, ko) }
    catch(ko) { return this._resolver().catch(ko) }
    finally(fn) { return this._resolver().finally(fn) }
  }

  // ── Archivos ──────────────────────────────────────────────────────────────────────────
  // Las URL de archivo se guardan como "dbx:<bucket>/<ruta>" y se abren con un enlace temporal.
  function rutaArchivo(url) {
    const resto = url.slice(4)
    const i = resto.indexOf('/')
    return `${carpetaArchivos}/${resto.slice(i + 1)}`
  }

  const storage = {
    from(bucket) {
      return {
        async upload(ruta, datos, opciones = {}) {
          try {
            await dbx.subir(`${carpetaArchivos}/${ruta}`, datos, opciones.upsert ? 'overwrite' : 'add')
            return { data: { path: ruta }, error: null }
          } catch (e) { return { data: null, error: err(e.message) } }
        },
        getPublicUrl(ruta) { return { data: { publicUrl: `dbx:${bucket}/${ruta}` } } },
        async remove(rutas) {
          try { for (const r of rutas) await dbx.borrar(`${carpetaArchivos}/${r}`); return { data: rutas, error: null } }
          catch (e) { return { data: null, error: err(e.message) } }
        },
      }
    },
  }

  // Devuelve una URL que el navegador puede abrir o descargar
  async function resolverUrl(url) {
    if (!url || !String(url).startsWith('dbx:')) return url
    return dbx.enlaceTemporal(rutaArchivo(url))
  }

  return {
    from: tabla => new Consulta(tabla),
    storage,
    resolverUrl,
    rutaArchivo,
    sincronizar,
    carpetaDatos,
    carpetaArchivos,
    // acceso directo a la tabla (para informes y migración)
    async tabla(nombre) { await sincronizar(); return clonar(filasDe(nombre)) },
    async reemplazarTabla(nombre, filas) {
      await escribir(nombre, actuales => { actuales.length = 0; actuales.push(...filas); return { cambiado: true, afectadas: [] } })
    },
  }
}

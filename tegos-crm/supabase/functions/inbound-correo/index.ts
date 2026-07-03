// Función Supabase Edge: recibe correos entrantes (vía CloudMailin) reenviados
// desde inquilinos@tegos.es, los empareja con inquilino/propietario/contacto por
// email y los guarda en la tabla `correo`. Lo que no casa queda "sin asignar"
// (las tres FKs a null) para revisarlo en la app.
//
// Variables de entorno necesarias (Secrets de la función):
//   INBOUND_TOKEN  -> token secreto que CloudMailin debe enviar en ?token=...
// (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los proporciona Supabase automáticamente)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const INBOUND_TOKEN = Deno.env.get('INBOUND_TOKEN') ?? ''
const BUCKET = 'documentos-tegos'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

function extractEmail(s?: string | null): string | null {
  if (!s) return null
  const m = s.match(/<([^>]+)>/)
  const raw = (m ? m[1] : s).trim().toLowerCase()
  return /\S+@\S+\.\S+/.test(raw) ? raw.replace(/[",]/g, '') : null
}

// Tablas, su FK en `correo`, y TODAS sus columnas de email (principal, 2,
// cónyuge, 2º/3º inquilino, otra persona...) para emparejar por cualquiera de ellas.
const TABLAS_EMAIL: Array<[string, string, string[]]> = [
  ['inquilinos', 'inquilino_id', ['email', 'email_2', 'email_conyuge', 'email_2_conyuge', 'email_inq2', 'email_2_inq2', 'email_inq3', 'email_2_inq3', 'email_otra_persona']],
  ['propietarios', 'propietario_id', ['email', 'email_2', 'email_conyuge', 'email_2_conyuge', 'email_otra_persona']],
  ['persona_contacto', 'contacto_id', ['email', 'email_2', 'email_conyuge', 'email_2_conyuge']],
  // Compañías: administradores de fincas y aseguradoras. Sus contactos (persona_contacto
  // con administrador_finca_id/seguro_id) ya casan arriba por 'contacto_id'; la ficha de
  // Adm. Fincas / Seguros en la app muestra ambos (correo propio + el de sus contactos).
  ['administrador_finca', 'administrador_finca_id', ['email', 'email_2']],
  ['seguro', 'seguro_id', ['email', 'email_2']],
]

// Direcciones "propias" (buzón de captura y cuentas desde las que Luis reenvía).
// Se ignoran al emparejar para que un reenvío no caiga en la ficha del propio Luis
// y se busque al remitente original en el cuerpo.
const OWN = new Set(['inquilinos@tegos.es', 'ljerezg@yahoo.es', 'ljerezg@tegos.es'])

async function findEntity(email: string | null) {
  if (!email) return {}
  const e = email.replace(/[%,]/g, '')
  for (const [tabla, key, cols] of TABLAS_EMAIL) {
    const orStr = cols.map(c => `${c}.ilike.${e}`).join(',')
    const { data } = await supabase.from(tabla).select('id').or(orStr).limit(1)
    if (data && data.length) return { [key]: data[0].id }
  }
  return {}
}

// Todas las direcciones de email que aparezcan en un texto (cuerpo del correo)
function emailsEnTexto(txt?: string | null): string[] {
  if (!txt) return []
  const m = txt.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []
  return [...new Set(m.map(x => x.toLowerCase()))]
}

const ISO = (d: Date) => isNaN(+d) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const MESES: Record<string, number> = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, set: 8, oct: 9, nov: 10, dic: 11, jan: 0, apr: 3, aug: 7, dec: 11 }

// Parsea una cadena de fecha (ISO/RFC en inglés, "15 de marzo de 2026", "15/03/2026", "Mar 15, 2026")
function parseFecha(s: string): string | null {
  if (!s) return null
  let m = s.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\.?\s+de\s+(\d{4})/i)
  if (m) { const mo = MESES[m[2].slice(0, 3).toLowerCase()]; if (mo != null) return ISO(new Date(+m[3], mo, +m[1])) }
  m = s.match(/([a-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/i)
  if (m) { const mo = MESES[m[1].slice(0, 3).toLowerCase()]; if (mo != null) return ISO(new Date(+m[3], mo, +m[2])) }
  m = s.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/)
  if (m) return ISO(new Date(+m[3], +m[2] - 1, +m[1]))
  const d = new Date(s)
  return ISO(d)
}

// Si el correo es un reenvío, intenta sacar la fecha del mensaje ORIGINAL del cuerpo.
function fechaOriginal(plain: string): string | null {
  if (!plain) return null
  const esReenvio = /reenviad|forwarded|mensaje reenviado|begin forwarded/i.test(plain)
  if (!esReenvio) return null
  const lab = plain.match(/(?:Fecha|Enviado|Date|Sent)\s*:\s*(.+)/i)
  if (lab) { const d = parseFecha(lab[1]); if (d) return d }
  const esc = plain.match(/El\s+(.+?)\s+(?:a las\b.*)?escribió:/i) || plain.match(/On\s+(.+?)\s+wrote:/i)
  if (esc) { const d = parseFecha(esc[1]); if (d) return d }
  return null
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url)
    if (INBOUND_TOKEN && url.searchParams.get('token') !== INBOUND_TOKEN) {
      return new Response('forbidden', { status: 403 })
    }

    const payload = await req.json()
    const headers = payload.headers || {}
    const h = (k: string) => headers[k] ?? headers[k.toLowerCase()] ?? headers[k.toUpperCase()]
    const fromRaw = h('From') || payload.envelope?.from
    const toRaw = h('To') || payload.envelope?.to
    const subject = h('Subject') || ''
    const messageId = h('Message-ID') || h('Message-Id') || null
    const plain = payload.plain || payload.reply_plain || ''
    const dateHdr = h('Date')
    let fecha = new Date().toISOString().slice(0, 10)
    if (dateHdr) { const d = new Date(dateHdr); if (!isNaN(+d)) fecha = d.toISOString().slice(0, 10) }
    // En reenvíos, usar la fecha del mensaje original si se puede extraer del cuerpo
    const fOrig = fechaOriginal(plain)
    if (fOrig) fecha = fOrig

    // Emparejar con TODAS las personas implicadas y guardar una entrada por cada una:
    //  - el remitente (From) -> en su ficha como 'enviado' (esa persona lo envió)
    //  - cada destinatario (To/Cc) -> en su ficha como 'recibido' (lo recibió)
    //  - si nada casa (p.ej. reenvío desde dirección ajena), se rastrea el cuerpo
    //    para localizar al remitente original -> 'enviado'
    const ccRaw = h('Cc')
    const matches: Array<{ col: string, id: number, sentido: string }> = []
    const seen = new Set<string>()
    const addMatch = (m: Record<string, number>, sentido: string) => {
      const col = Object.keys(m)[0]
      if (!col) return
      const id = m[col]
      const key = `${col}:${id}`
      if (seen.has(key)) return
      seen.add(key)
      matches.push({ col, id, sentido })
    }
    const fromE = extractEmail(fromRaw)
    if (fromE && !OWN.has(fromE)) addMatch(await findEntity(fromE), 'enviado')
    for (const e of [...emailsEnTexto(toRaw), ...emailsEnTexto(ccRaw)]) if (!OWN.has(e)) addMatch(await findEntity(e), 'recibido')
    if (matches.length === 0) {
      for (const e of emailsEnTexto(plain)) if (!OWN.has(e)) addMatch(await findEntity(e), 'enviado')
    }
    const msgKey = messageId || `${fromRaw || ''}|${subject}|${fecha}`

    // Primer adjunto (si lo hay)
    let archivo_url: string | null = null, archivo_nombre: string | null = null
    const atts = payload.attachments || []
    if (atts.length && atts[0].content) {
      const a = atts[0]
      const bytes = Uint8Array.from(atob(a.content), c => c.charCodeAt(0))
      const path = `correo/inbound/${Date.now()}_${(a.file_name || 'adjunto').replace(/\s+/g, '_')}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: a.content_type || 'application/octet-stream' })
      if (!upErr) {
        archivo_url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
        archivo_nombre = a.file_name || 'adjunto'
      }
    }

    const base = {
      fecha,
      asunto: subject || null,
      cuerpo: plain || null,
      remitente: fromRaw || null,
      destinatario: toRaw || null,
      message_id: messageId,
      archivo_url, archivo_nombre,
    }
    // Una fila por persona implicada; si no casa nadie, una fila "sin asignar".
    const filas = matches.length
      ? matches.map(m => ({ ...base, [m.col]: m.id, sentido: m.sentido, dedupe_key: `${msgKey}|${m.col}:${m.id}` }))
      : [{ ...base, sentido: 'recibido', dedupe_key: `${msgKey}|none` }]

    const { error } = await supabase.from('correo').upsert(filas, { onConflict: 'dedupe_key', ignoreDuplicates: true })
    if (error) throw error

    return new Response(JSON.stringify({ ok: true, fichas: matches.length, matches }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})

// Informe mensual "Acciones que vencen" del CRM Tegos (versión Dropbox).
// Sustituye a la Edge Function informe-acciones-mensual y a la función SQL informe_acciones_mes.
//
// Variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, DROPBOX_APP_KEY, DROPBOX_REFRESH_TOKEN
// Opcionales: MES=AAAA-MM, DRY_RUN=1 (no envía, muestra el HTML), PRUEBA=1, DESTINO=correo, ASUNTO_PREFIJO

import nodemailer from 'nodemailer'
import { conectar } from './comun.mjs'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function rangoMes(mesParam, hoy = new Date()) {
  let year, month
  if (mesParam && /^\d{4}-\d{2}$/.test(mesParam)) [year, month] = mesParam.split('-').map(Number)
  else { year = hoy.getUTCFullYear(); month = hoy.getUTCMonth() + 1 }
  const fmt = d => d.toISOString().slice(0, 10)
  return { inicio: fmt(new Date(Date.UTC(year, month - 1, 1))), fin: fmt(new Date(Date.UTC(year, month, 0))), nombre: `${MESES[month - 1]} ${year}` }
}

// Suma meses como Postgres (si el día no existe, se queda en el último del mes)
export function sumarMeses(iso, meses) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const total = y * 12 + (m - 1) + meses
  const ny = Math.floor(total / 12), nm = total % 12
  const ultimo = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  return new Date(Date.UTC(ny, nm, Math.min(d, ultimo))).toISOString().slice(0, 10)
}
const restarDia = iso => new Date(Date.parse(iso.slice(0, 10) + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10)
const fechaDe = v => (v ? String(v).slice(0, 10) : null)
const nombreCompleto = x => x ? `${x.nombre ?? ''} ${x.apellidos ?? ''}`.trim() : null

// Misma lógica que la función SQL informe_acciones_mes
export function calcularInforme(t, inicio, fin) {
  const porId = (tabla) => new Map((t[tabla] || []).map(r => [Number(r.id), r]))
  const tipos = porId('tipo_contacto'), resp = porId('responsable')
  const entra = f => f && f >= inicio && f <= fin
  const filas = []
  const bloques = [
    ['Inquilinos', 'accion_inquilino', 'inquilino_id', porId('inquilinos'), nombreCompleto],
    ['Inmuebles', 'accion_inmueble', 'inmueble_id', porId('inmuebles'), x => x ? (x.codigo ?? x.calle) : null],
    ['Propietarios', 'accion_propietario', 'propietario_id', porId('propietarios'), nombreCompleto],
    ['Contactos', 'accion_persona_contacto', 'persona_id', porId('persona_contacto'), nombreCompleto],
  ]
  for (const [seccion, tabla, col, entidades, nombre] of bloques) {
    for (const a of t[tabla] || []) {
      if (a.completada === true || !entra(fechaDe(a.fecha))) continue
      filas.push({
        seccion, entidad: nombre(entidades.get(Number(a[col]))), fecha: fechaDe(a.fecha),
        tipo: tipos.get(Number(a.tipo_contacto_id))?.tipo_contacto ?? null, indicaciones: a.indicaciones ?? null,
        responsable: resp.get(Number(a.responsable_id))?.nombre_responsable ?? null,
      })
    }
  }
  // Vencimientos y revisiones calculados en vivo (red de seguridad)
  const accionesInq = t.accion_inquilino || []
  for (const i of t.inquilinos || []) {
    if (i.fecha_baja != null || i.aviso_fin !== true || !i.fecha_contrato) continue
    const dur = i.duracion_contrato == null ? null : Number(i.duracion_contrato)
    const inicioDev = fechaDe(i.fecha_inicio_devengo) || fechaDe(i.fecha_contrato)
    const venc = fechaDe(i.fecha_fin_contrato) || (dur == null ? null : restarDia(sumarMeses(i.fecha_contrato, dur * 12)))
    const eventos = []
    if (venc && i.aviso_meses_antes != null) {
      const [d, m, y] = venc.split('-').reverse()
      eventos.push({ tipo: 'Vencimiento de contrato', fecha: sumarMeses(venc, -Number(i.aviso_meses_antes)), texto: `Vencimiento de contrato el ${d}/${m}/${y}` })
    }
    if (dur != null) for (let n = 1; n <= Math.max(dur - 1, 0); n++) eventos.push({ tipo: 'Revisión de renta', fecha: sumarMeses(inicioDev, n * 12), texto: 'Revisión anual de renta' })
    for (const e of eventos) {
      if (!entra(e.fecha)) continue
      if (accionesInq.some(a => Number(a.inquilino_id) === Number(i.id) && fechaDe(a.fecha) === e.fecha)) continue
      filas.push({ seccion: 'Inquilinos', entidad: nombreCompleto(i), fecha: e.fecha, tipo: e.tipo, indicaciones: e.texto, responsable: resp.get(Number(i.responsable_id))?.nombre_responsable ?? null })
    }
  }
  return filas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.seccion.localeCompare(b.seccion))
}

const formatFecha = iso => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }

export function construirHtml(filas, nombreMes) {
  const secciones = {}
  for (const f of filas) (secciones[f.seccion] ||= []).push(f)
  let cuerpo = ''
  if (!filas.length) cuerpo = '<p>No hay acciones pendientes que venzan este mes.</p>'
  else for (const sec of ['Inquilinos', 'Inmuebles', 'Propietarios', 'Contactos']) {
    const items = secciones[sec]
    if (!items?.length) continue
    cuerpo += `<h3 style="color:#8E1104;margin-top:24px;">${sec}</h3>`
    cuerpo += '<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px;">'
    cuerpo += '<tr style="background:#8E1104;color:#fff;text-align:left;"><th>Fecha</th><th>Entidad</th><th>Tipo</th><th>Indicaciones</th><th>Responsable</th></tr>'
    for (const it of items) {
      cuerpo += `<tr style="border-bottom:1px solid #eee;"><td>${formatFecha(it.fecha)}</td><td>${it.entidad ?? ''}</td><td>${it.tipo ?? ''}</td><td>${(it.indicaciones ?? '').replace(/</g, '&lt;')}</td><td>${it.responsable ?? ''}</td></tr>`
    }
    cuerpo += '</table>'
  }
  return `<div style="font-family:Arial,sans-serif;"><h2 style="color:#8E1104;">Acciones que vencen en ${nombreMes}</h2>${cuerpo}<p style="color:#888;font-size:12px;margin-top:32px;">Correo generado automáticamente por el CRM Tegos el día 1 de cada mes.</p></div>`
}

async function main() {
  const { inicio, fin, nombre } = rangoMes(process.env.MES)
  const { db } = conectar()
  const tablas = {}
  for (const t of ['accion_inquilino', 'accion_inmueble', 'accion_propietario', 'accion_persona_contacto', 'inquilinos', 'inmuebles', 'propietarios', 'persona_contacto', 'tipo_contacto', 'responsable']) tablas[t] = await db.tabla(t)
  const filas = calcularInforme(tablas, inicio, fin)
  const html = construirHtml(filas, nombre)
  console.log(`Informe de ${nombre}: ${filas.length} acciones`)
  if (process.env.DRY_RUN === '1') { console.log(JSON.stringify(filas, null, 2)); return }

  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) throw new Error('Faltan los secretos SMTP_HOST / SMTP_USER / SMTP_PASS')
  const port = Number(process.env.SMTP_PORT || 587)
  const transporter = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } })
  const destino = process.env.DESTINO || 'ljerezg@tegos.es'
  const asunto = `${process.env.ASUNTO_PREFIJO || ''}${process.env.PRUEBA === '1' ? '[PRUEBA] ' : ''}Acciones que vencen en ${nombre}`
  await transporter.sendMail({ from: `Tegos CRM <${SMTP_USER}>`, to: destino, subject: asunto, html })
  console.log(`Enviado a ${destino}`)
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(1) })

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCtrlG } from '../lib/useCtrlG'
import { supabase } from '../lib/supabase'
import Documentos from '../components/Documentos.jsx'
import { useSortable } from '../components/SortableTable.jsx'
import * as XLSX from 'xlsx'

function norm(s) {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}
function ms(fields, q) {
  var n = norm(q)
  if (!n) return true
  return fields.some(function(f) { return norm(f).indexOf(n) !== -1 })
}

function calcVenc(r) {
  if (r.fecha_fin_contrato) return r.fecha_fin_contrato
  if (!r.fecha_contrato || !r.duracion_contrato) return null
  const [y, m, d] = String(r.fecha_contrato).split('-').map(Number)
  const v = new Date(y + Number(r.duracion_contrato), m - 1, d)
  v.setDate(v.getDate() - 1)
  return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
}
function ultimaRentaVal(r) {
  const arr = r.renta_inquilino || []
  if (!arr.length) return null
  const last = arr.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0]
  return last && last.importe != null ? last.importe : null
}

const EMPTY = { nombre: '', apellidos: '', dni_cif: '', tipo_id: '', responsable_id: '', telefono: '', movil: '', telefono_2: '', email: '', email_2: '', observaciones: '', nombre_conyuge: '', apellidos_conyuge: '', movil_conyuge: '', email_conyuge: '', telefono_2_conyuge: '', email_2_conyuge: '', otra_persona_contacto: '', movil_otra_persona: '', email_otra_persona: '', relacion_otra_persona: '', inmueble_id: '', fecha_contrato: '', fecha_inicio_devengo: '', duracion_contrato: 5, aviso_fin: true, aviso_meses_antes: 5, fecha_fin_contrato: '', mes_contrato: '', importe_fianza_ivima: '', importe_deposito: '', seguro_rentas_id: '', num_poliza_seg_rentas: '', carpeta_dropbox: '', fianza_ivima_url: '', contrato_url: '', nombre_inq2: '', apellidos_inq2: '', dni_inq2: '', tipo_inq2_id: '', relacion_inq2: '', telefono_inq2: '', telefono_2_inq2: '', movil_inq2: '', email_inq2: '', email_2_inq2: '', nombre_inq3: '', apellidos_inq3: '', dni_inq3: '', tipo_inq3_id: '', relacion_inq3: '', telefono_inq3: '', telefono_2_inq3: '', movil_inq3: '', email_inq3: '', email_2_inq3: '' }

export default function Inquilinos({ perfil }) {
  const [rows, setRows] = useState([])
  const [inmuebles, setInmuebles] = useState([])
  const [seguros, setSeguros] = useState([])
  const [responsables, setResponsables] = useState([])
  const [tipos, setTipos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [sortCol, setSortCol] = useState('nombre')
  const [sortDir, setSortDir] = useState('asc')
  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [acciones, setAcciones] = useState([])
  const [errors, setErrors] = useState({})
  const [searchParams, setSearchParams] = useSearchParams()
  const readOnly = perfil?.rol === 'visor'
  const [tabInq, setTabInq] = useState('1')
  const [tiposContacto, setTiposContacto] = useState([])
  const [nuevaAccion, setNuevaAccion] = useState(null)
  const [guardandoAccion, setGuardandoAccion] = useState(false)
  const [rentas, setRentas] = useState([])
  const [nuevaRenta, setNuevaRenta] = useState(null)
  const [guardandoRenta, setGuardandoRenta] = useState(false)

  useEffect(() => { load() }, [])
  useEffect(() => { if (modal) { setTabInq('1'); setNuevaAccion(null); setNuevaRenta(null) } }, [modal])
  useCtrlG(save, !!modal)

  async function load() {
    setLoading(true)

    // Si es propietario, primero obtenemos sus inmueble_ids (principal + adicionales)
    let inmuebleIds = null
    if (perfil?.rol === 'propietario' && perfil?.propietario_id) {
      const [{ data: inmsDelProp }, { data: inmsCo }] = await Promise.all([
        supabase.from('inmuebles').select('id').eq('propietario_id', perfil.propietario_id),
        supabase.from('inmueble_propietarios').select('inmueble_id').eq('propietario_id', perfil.propietario_id),
      ])
      inmuebleIds = [...new Set([...(inmsDelProp || []).map(i => i.id), ...(inmsCo || []).map(i => i.inmueble_id)])]
    }

    const [{ data: inqs }, { data: inms }, { data: segs }, { data: resps }, { data: tip }, { data: tc }] = await Promise.all([
      (() => {
        let q = supabase.from('inquilinos').select('*, inmuebles(codigo, calle, numero_calle, piso), seguro(compania), responsable(nombre_responsable), tipo_persona!inquilinos_tipo_id_fkey(tipo), renta_inquilino(importe, fecha)').order('nombre')
        if (inmuebleIds !== null) {
          if (inmuebleIds.length === 0) q = q.eq('inmueble_id', -1) // sin resultados
          else q = q.in('inmueble_id', inmuebleIds)
        }
        return q
      })(),
      (() => {
        let q = supabase.from('inmuebles').select('id, codigo, calle').order('codigo')
        if (inmuebleIds !== null) {
          if (inmuebleIds.length === 0) return Promise.resolve({ data: [] })
          q = q.in('id', inmuebleIds)
        }
        return q
      })(),
      supabase.from('seguro').select('id, compania'),
      supabase.from('responsable').select('*'),
      supabase.from('tipo_persona').select('*'),
      supabase.from('tipo_contacto').select('*'),
    ])
    const lista = inqs || []
    setRows(lista)
    const sel = searchParams.get('sel')
    if (sel) {
      const encontrado = lista.find(r => String(r.id) === String(sel))
      if (encontrado) selectRow(encontrado)
      setSearchParams({}, { replace: true })
    }
    setInmuebles(inms || [])
    setSeguros(segs || [])
    setResponsables(resps || [])
    setTipos(tip || [])
    setTiposContacto(tc || [])
    setLoading(false)
  }

  async function loadAcciones(inquilinoId) {
    const { data } = await supabase.from('accion_inquilino').select('*, responsable(nombre_responsable), tipo_contacto(tipo_contacto)').eq('inquilino_id', inquilinoId).order('fecha', { ascending: false })
    setAcciones(data || [])
  }

  async function loadRentas(inquilinoId) {
    const { data } = await supabase.from('renta_inquilino').select('*').eq('inquilino_id', inquilinoId).order('fecha', { ascending: false })
    setRentas(data || [])
  }

  async function guardarRenta() {
    if (!form.id) return
    if (!nuevaRenta?.fecha && !nuevaRenta?.importe) { alert('Indica al menos la fecha o el importe'); return }
    setGuardandoRenta(true)
    const { error } = await supabase.from('renta_inquilino').insert({
      inquilino_id: form.id,
      fecha: nuevaRenta.fecha || null,
      importe: nuevaRenta.importe === '' || nuevaRenta.importe == null ? null : Number(nuevaRenta.importe),
      observaciones: nuevaRenta.observaciones || null,
    })
    setGuardandoRenta(false)
    if (error) { alert('Error al guardar la renta: ' + error.message); return }
    setNuevaRenta(null)
    loadRentas(form.id)
  }

  async function borrarRenta(id) {
    if (!confirm('¿Eliminar este cambio de renta?')) return
    await supabase.from('renta_inquilino').delete().eq('id', id)
    if (form.id) loadRentas(form.id)
  }

  async function selectRow(row) {
    setSelected(row)
    loadAcciones(row.id)
    loadRentas(row.id)
  }

  async function guardarAccion() {
    if (!form.id) return
    if (!nuevaAccion?.fecha) { alert('Indica la fecha de la acción'); return }
    setGuardandoAccion(true)
    const payload = {
      inquilino_id: form.id,
      fecha: nuevaAccion.fecha || null,
      hora: nuevaAccion.hora || null,
      tipo_contacto_id: nuevaAccion.tipo_contacto_id || null,
      responsable_id: nuevaAccion.responsable_id || null,
      indicaciones: nuevaAccion.indicaciones || null,
      proxima_fecha: nuevaAccion.proxima_fecha || null,
      proxima_accion: nuevaAccion.proxima_accion || null,
      documento: nuevaAccion.documento || null,
      completada: false,
    }
    const { error } = await supabase.from('accion_inquilino').insert(payload)
    setGuardandoAccion(false)
    if (error) { alert('Error al guardar la acción: ' + error.message); return }
    setNuevaAccion(null)
    loadAcciones(form.id)
  }

  async function completarAccion(id) {
    await supabase.from('accion_inquilino').update({ completada: true }).eq('id', id)
    if (form.id) loadAcciones(form.id)
  }

  function validate(data) {
    const errs = {}
    if (!data.tipo_id) errs.tipo_id = 'Obligatorio'
    return errs
  }

  async function sincronizarAvisoFin(inquilinoId, d) {
    if (!inquilinoId) return
    await supabase.from('accion_inquilino').delete().eq('inquilino_id', inquilinoId).like('proxima_accion', 'Vencimiento de contrato%')
    await supabase.from('accion_inquilino').delete().eq('inquilino_id', inquilinoId).like('proxima_accion', 'Revisión de renta%')
    if (d.aviso_fin && !d.fecha_fin_contrato && d.fecha_contrato && d.duracion_contrato) {
      const iso = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
      const resp = d.responsable_id || null
      const [y, m, dd] = String(d.fecha_contrato).split('-').map(Number)
      const venc = new Date(y + Number(d.duracion_contrato), m - 1, dd)
      venc.setDate(venc.getDate() - 1)
      const meses = Number(d.aviso_meses_antes) || 5
      const aviso = new Date(venc)
      aviso.setMonth(aviso.getMonth() - meses)
      const rows = [{
        inquilino_id: inquilinoId,
        fecha: iso(aviso),
        proxima_fecha: iso(aviso),
        proxima_accion: 'Vencimiento de contrato el ' + venc.toLocaleDateString('es-ES'),
        indicaciones: 'Aviso automático: el contrato vence en ' + meses + ' meses',
        completada: false,
        responsable_id: resp,
      }]
      // Última revisión e importe actual de la renta (del historial renta_inquilino)
      let ultRev = '—', ultImp = '—'
      const { data: rentas } = await supabase.from('renta_inquilino').select('importe, fecha').eq('inquilino_id', inquilinoId).order('fecha', { ascending: false }).limit(1)
      if (rentas && rentas.length) {
        if (rentas[0].fecha) ultRev = new Date(rentas[0].fecha).toLocaleDateString('es-ES')
        if (rentas[0].importe != null) ultImp = Number(rentas[0].importe).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
      }
      const indicRev = `Revisión anual de renta. Última revisión: ${ultRev} · Renta actual: ${ultImp}`
      // Revisión de renta: aniversario del inicio de devengo, cada año hasta el vencimiento
      const base = d.fecha_inicio_devengo || d.fecha_contrato
      const [by, bm, bdd] = String(base).split('-').map(Number)
      const dur = Number(d.duracion_contrato)
      for (let yy = 1; yy < dur; yy++) {
        const rev = new Date(by + yy, bm - 1, bdd)
        rows.push({
          inquilino_id: inquilinoId,
          fecha: iso(rev),
          proxima_fecha: iso(rev),
          proxima_accion: 'Revisión de renta',
          indicaciones: indicRev,
          completada: false,
          responsable_id: resp,
        })
      }
      await supabase.from('accion_inquilino').insert(rows)
    }
  }

  async function save() {
    const errs = validate(form)
    if (Object.keys(errs).length) {
      setErrors(errs)
      setTabInq('1')
      alert('Falta el campo obligatorio "Tipo" en la pestaña Inquilino 1')
      return
    }
    const data = { ...form }
    Object.keys(data).forEach(k => { if (data[k] === '' || data[k] === undefined) data[k] = null })
    let inquilinoId = form.id
    if (modal === 'new') {
      const { data: creado, error } = await supabase.from('inquilinos').insert(data).select('id').single()
      if (error) { alert('Error al guardar: ' + error.message); return }
      inquilinoId = creado?.id
    } else {
      const { id: _id, inmuebles: _, seguro: __, responsable: ___, tipo_persona: ____, ...updateData } = data
      const { error } = await supabase.from('inquilinos').update(updateData).eq('id', form.id)
      if (error) { alert('Error al guardar: ' + error.message); return }
    }
    await sincronizarAvisoFin(inquilinoId, data)
    setModal(null); setErrors({}); load()
  }

  async function del(id) {
    if (!confirm('¿Eliminar este inquilino?')) return
    await supabase.from('inquilinos').delete().eq('id', id)
    setSelected(null); load()
  }

  function exportExcel() {
    const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES') : ''
    const fmtMoney = v => v != null && v !== '' ? Number(v).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : ''

    const data = sortedFiltered().map(r => ({
      'Nombre': r.nombre || '',
      'Apellidos': r.apellidos || '',
      'DNI / NIE': r.dni_cif || '',
      'Tipo': r.tipo_persona?.tipo || '',
      'Responsable': r.responsable?.nombre_responsable || '',
      'Teléfono': r.telefono || '',
      'Teléfono 2': r.telefono_2 || '',
      'Móvil': r.movil || '',
      'Email': r.email || '',
      'Email 2': r.email_2 || '',
      'Inmueble': r.inmuebles?.codigo || '',
      'Dirección inmueble': r.inmuebles ? `${r.inmuebles.calle || ''}${r.inmuebles.numero_calle ? ` ${r.inmuebles.numero_calle}` : ''}${r.inmuebles.piso ? `, ${r.inmuebles.piso}` : ''}` : '',
      'Firma contrato': fmtDate(r.fecha_contrato),
      'Inicio devengo': fmtDate(r.fecha_inicio_devengo),
      'Duración (años)': r.duracion_contrato ?? '',
      'Fin contrato': fmtDate(r.fecha_fin_contrato),
      'Fianza IVIMA': fmtMoney(r.importe_fianza_ivima),
      'Depósito': fmtMoney(r.importe_deposito),
      'Seg. rentas': r.seguro?.compania || '',
      'Nº póliza seg. rentas': r.num_poliza_seg_rentas || '',
      'Nombre cónyuge': r.nombre_conyuge || '',
      'Apellidos cónyuge': r.apellidos_conyuge || '',
      'Móvil cónyuge': r.movil_conyuge || '',
      'Email cónyuge': r.email_conyuge || '',
      'Teléfono 2 cónyuge': r.telefono_2_conyuge || '',
      'Email 2 cónyuge': r.email_2_conyuge || '',
      '2º inq. Nombre': r.nombre_inq2 || '',
      '2º inq. Apellidos': r.apellidos_inq2 || '',
      '2º inq. DNI': r.dni_inq2 || '',
      '2º inq. Tipo': tipos.find(t => t.id === r.tipo_inq2_id)?.tipo || '',
      '2º inq. Relación': r.relacion_inq2 || '',
      '2º inq. Teléfono': r.telefono_inq2 || '',
      '2º inq. Teléfono 2': r.telefono_2_inq2 || '',
      '2º inq. Móvil': r.movil_inq2 || '',
      '2º inq. Email': r.email_inq2 || '',
      '2º inq. Email 2': r.email_2_inq2 || '',
      '3º inq. Nombre': r.nombre_inq3 || '',
      '3º inq. Apellidos': r.apellidos_inq3 || '',
      '3º inq. DNI': r.dni_inq3 || '',
      '3º inq. Tipo': tipos.find(t => t.id === r.tipo_inq3_id)?.tipo || '',
      '3º inq. Relación': r.relacion_inq3 || '',
      '3º inq. Teléfono': r.telefono_inq3 || '',
      '3º inq. Teléfono 2': r.telefono_2_inq3 || '',
      '3º inq. Móvil': r.movil_inq3 || '',
      '3º inq. Email': r.email_inq3 || '',
      '3º inq. Email 2': r.email_2_inq3 || '',
      'Otra persona contacto': r.otra_persona_contacto || '',
      'Relación otra persona': r.relacion_otra_persona || '',
      'Móvil otra persona': r.movil_otra_persona || '',
      'Email otra persona': r.email_otra_persona || '',
      'Carpeta Dropbox': r.carpeta_dropbox || '',
      'Fianza IVIMA (URL)': r.fianza_ivima_url || '',
      'Contrato (URL)': r.contrato_url || '',
      'Observaciones': r.observaciones || '',
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inquilinos')
    XLSX.writeFile(wb, 'Inquilinos.xlsx')
  }

  const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES') : '—'
  const fmtMoney = v => v != null ? Number(v).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : '—'
  const nombre = r => `${r.nombre || ''} ${r.apellidos || ''}`.trim() || '—'
  const initials = r => nombre(r).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const f = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }))
  const diasRestantes = d => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null

  const extraInqGrid = suf => (
    <div className="form-grid">
      <div className="form-group"><label>Nombre</label><input value={form[`nombre_${suf}`] ?? ''} onChange={f(`nombre_${suf}`)} /></div>
      <div className="form-group"><label>Apellidos</label><input value={form[`apellidos_${suf}`] ?? ''} onChange={f(`apellidos_${suf}`)} /></div>
      <div className="form-group"><label>DNI / NIE</label><input value={form[`dni_${suf}`] ?? ''} onChange={f(`dni_${suf}`)} /></div>
      <div className="form-group"><label>Tipo</label>
        <select value={form[`tipo_${suf}_id`] ?? ''} onChange={f(`tipo_${suf}_id`)}>
          <option value="">—</option>
          {tipos.map(t => <option key={t.id} value={t.id}>{t.tipo}</option>)}
        </select>
      </div>
      <div className="form-group"><label>Relación</label><input value={form[`relacion_${suf}`] ?? ''} onChange={f(`relacion_${suf}`)} placeholder="Ej: pareja, compañero piso..." /></div>
      <div className="form-group"><label>Teléfono</label><input value={form[`telefono_${suf}`] ?? ''} onChange={f(`telefono_${suf}`)} /></div>
      <div className="form-group"><label>Teléfono 2</label><input value={form[`telefono_2_${suf}`] ?? ''} onChange={f(`telefono_2_${suf}`)} /></div>
      <div className="form-group"><label>Móvil</label><input value={form[`movil_${suf}`] ?? ''} onChange={f(`movil_${suf}`)} /></div>
      <div className="form-group"><label>Email</label><input value={form[`email_${suf}`] ?? ''} onChange={f(`email_${suf}`)} /></div>
      <div className="form-group"><label>Email 2</label><input value={form[`email_2_${suf}`] ?? ''} onChange={f(`email_2_${suf}`)} /></div>
    </div>
  )

  const inqTabs = conAcciones => (
    <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
      {[['1','Inquilino 1'],['2','2º inquilino'],['3','3º inquilino'], ...(conAcciones ? [['renta', `Renta (${rentas.length})`], ['acc', `Acciones (${acciones.length})`], ['docs', 'Documentos']] : [])].map(([v,l]) => (
        <button key={v} className={`btn btn-sm ${tabInq === v ? 'btn-tab-active' : ''}`} onClick={() => setTabInq(v)}>{l}</button>
      ))}
    </div>
  )

  const fR = key => e => setNuevaRenta(prev => ({ ...prev, [key]: e.target.value }))

  const calcDevengo = (firma) => {
    if (!firma) return ''
    const [y, m, d] = firma.split('-').map(Number)
    if (d === 1) return firma
    const ny = m === 12 ? y + 1 : y
    const nm = m === 12 ? 1 : m + 1
    return `${ny}-${String(nm).padStart(2, '0')}-01`
  }

  const rentaTab = (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--text3)' }}>{rentas.length} {rentas.length === 1 ? 'registro' : 'registros'} de renta</span>
        {!readOnly && !nuevaRenta && <button className="btn btn-primary btn-sm" onClick={() => setNuevaRenta({ fecha: '', importe: '', observaciones: '' })}><i className="ti ti-plus" /> Nueva renta</button>}
      </div>
      {nuevaRenta && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 14 }}>
          <div className="form-grid">
            <div className="form-group"><label>Fecha</label><input type="date" value={nuevaRenta.fecha ?? ''} onChange={fR('fecha')} /></div>
            <div className="form-group"><label>Importe (€)</label><input type="number" value={nuevaRenta.importe ?? ''} onChange={fR('importe')} /></div>
            <div className="form-group form-full"><label>Observaciones</label><textarea value={nuevaRenta.observaciones ?? ''} onChange={fR('observaciones')} rows={2} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
            <button className="btn btn-sm" onClick={() => setNuevaRenta(null)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={guardarRenta} disabled={guardandoRenta}>{guardandoRenta ? <><i className="ti ti-loader ti-spin" /> Guardando...</> : 'Guardar renta'}</button>
          </div>
        </div>
      )}
      {rentas.length === 0 ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Sin registros de renta</div> : (
        <table>
          <thead><tr><th>Fecha</th><th>Importe</th><th>Observaciones</th>{!readOnly && <th></th>}</tr></thead>
          <tbody>
            {rentas.map(r => (
              <tr key={r.id}>
                <td>{fmtDate(r.fecha)}</td>
                <td>{r.importe != null ? fmtMoney(r.importe) : '—'}</td>
                <td style={{ fontSize: 13, color: 'var(--text2)' }}>{r.observaciones || '—'}</td>
                {!readOnly && <td><button className="btn btn-ghost btn-sm" title="Eliminar" onClick={() => borrarRenta(r.id)}><i className="ti ti-trash" style={{ color: 'var(--danger-text)' }} /></button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )

  const fA = key => e => setNuevaAccion(prev => ({ ...prev, [key]: e.target.value }))

  const accionesTab = (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--text3)' }}>{acciones.length} {acciones.length === 1 ? 'acción' : 'acciones'}</span>
        {!nuevaAccion && <button className="btn btn-primary btn-sm" onClick={() => setNuevaAccion({ fecha: new Date().toISOString().split('T')[0], hora: '', tipo_contacto_id: '', responsable_id: '', indicaciones: '', proxima_fecha: '', proxima_accion: '', documento: '' })}><i className="ti ti-plus" /> Nueva acción</button>}
      </div>
      {nuevaAccion && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 14 }}>
          <div className="form-grid">
            <div className="form-group"><label>Fecha *</label><input type="date" value={nuevaAccion.fecha ?? ''} onChange={fA('fecha')} /></div>
            <div className="form-group"><label>Hora</label><input type="time" value={nuevaAccion.hora ?? ''} onChange={fA('hora')} /></div>
            <div className="form-group"><label>Tipo de contacto</label>
              <select value={nuevaAccion.tipo_contacto_id ?? ''} onChange={fA('tipo_contacto_id')}>
                <option value="">—</option>
                {tiposContacto.map(t => <option key={t.id} value={t.id}>{t.tipo_contacto}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Responsable</label>
              <select value={nuevaAccion.responsable_id ?? ''} onChange={fA('responsable_id')}>
                <option value="">—</option>
                {responsables.map(r => <option key={r.id} value={r.id}>{r.nombre_responsable}</option>)}
              </select>
            </div>
            <div className="form-group form-full"><label>Indicaciones / Notas</label><textarea value={nuevaAccion.indicaciones ?? ''} onChange={fA('indicaciones')} rows={3} /></div>
            <div className="form-group"><label>Próxima fecha</label><input type="date" value={nuevaAccion.proxima_fecha ?? ''} onChange={fA('proxima_fecha')} /></div>
            <div className="form-group"><label>Próxima acción</label><input value={nuevaAccion.proxima_accion ?? ''} onChange={fA('proxima_accion')} /></div>
            <div className="form-group form-full"><label>Documento (URL)</label><input value={nuevaAccion.documento ?? ''} onChange={fA('documento')} placeholder="https://..." /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
            <button className="btn btn-sm" onClick={() => setNuevaAccion(null)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={guardarAccion} disabled={guardandoAccion}>{guardandoAccion ? <><i className="ti ti-loader ti-spin" /> Guardando...</> : 'Guardar acción'}</button>
          </div>
        </div>
      )}
      {acciones.length === 0 ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Sin acciones</div> : (
        <div className="timeline">
          {acciones.map(a => (
            <div className="tl-item" key={a.id}>
              <div className="tl-dot" style={{ background: a.completada ? 'var(--accent)' : 'var(--border2)' }} />
              <div className="tl-content">
                <div className="tl-text">{a.indicaciones || '—'} {a.completada ? <span className="badge badge-green" style={{ fontSize: 10 }}>Completada</span> : <button className="btn btn-ghost btn-sm" title="Marcar completada" style={{ padding: '0 6px' }} onClick={() => completarAccion(a.id)}><i className="ti ti-check" style={{ color: 'var(--accent)' }} /></button>}</div>
                <div className="tl-meta">{fmtDate(a.fecha)}{a.hora ? ` ${a.hora.slice(0,5)}` : ''} · {a.tipo_contacto?.tipo_contacto || ''} · {a.responsable?.nombre_responsable || '—'}{a.proxima_fecha ? ` · Próx: ${fmtDate(a.proxima_fecha)}${a.proxima_accion ? ' — ' + a.proxima_accion : ''}` : ''}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  function sortedFiltered() {
    let data = rows.filter(r => {
      const matchSearch = ms([r.nombre, r.apellidos, r.email, r.movil, r.dni_cif, r.inmuebles?.codigo], search)
      const matchEstado = filtroEstado === 'todos' ? true : filtroEstado === 'vigor' ? !r.fecha_fin_contrato : !!r.fecha_fin_contrato
      return matchSearch && matchEstado
    })
    return [...data].sort((a, b) => {
      let va = '', vb = ''
      if (sortCol === 'nombre') { va = nombre(a); vb = nombre(b) }
      else if (sortCol === 'inmueble') { va = a.inmuebles?.codigo || ''; vb = b.inmuebles?.codigo || '' }
      else if (sortCol === 'fecha_contrato') { va = a.fecha_contrato || ''; vb = b.fecha_contrato || '' }
      else if (sortCol === 'fecha_fin_contrato') { va = a.fecha_fin_contrato || ''; vb = b.fecha_fin_contrato || '' }
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })
  }

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const SortIcon = ({ col }) => sortCol === col ? <i className={`ti ti-chevron-${sortDir === 'asc' ? 'up' : 'down'}`} style={{ fontSize: 12 }} /> : <i className="ti ti-selector" style={{ fontSize: 11, opacity: 0.3 }} />

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>Inquilinos <span className="badge badge-gray" style={{ marginLeft: 6 }}>{sortedFiltered().length}</span></h2>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['todos','Todos'],['vigor','En vigor'],['finalizados','Finalizados']].map(([v,l]) => (
              <button key={v} className={`btn btn-sm ${filtroEstado === v ? 'btn-primary' : ''}`} onClick={() => setFiltroEstado(v)}>{l}</button>
            ))}
          </div>
          <div className="search-input"><i className="ti ti-search" /><input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <button className="btn btn-sm" onClick={exportExcel} title="Exportar Excel"><i className="ti ti-file-spreadsheet" /> Excel</button>
          {!readOnly && <button className="btn btn-primary btn-sm" onClick={() => { setForm(EMPTY); setErrors({}); setModal('new') }}><i className="ti ti-plus" /> Nuevo</button>}
        </div>
        <div className="table-wrap">
          {loading ? <div className="loading"><i className="ti ti-loader ti-spin" /> Cargando...</div> : (
            <table>
              <thead>
                <tr>
                  <th onClick={() => toggleSort('nombre')} style={{ cursor: 'pointer' }}>Nombre <SortIcon col="nombre" /></th>
                  <th onClick={() => toggleSort('inmueble')} style={{ cursor: 'pointer' }}>Inmueble <SortIcon col="inmueble" /></th>
                  <th>Móvil</th>
                  <th onClick={() => toggleSort('fecha_contrato')} style={{ cursor: 'pointer' }}>Inicio <SortIcon col="fecha_contrato" /></th>
                  <th onClick={() => toggleSort('fecha_fin_contrato')} style={{ cursor: 'pointer' }}>Fin previsto <SortIcon col="fecha_fin_contrato" /></th>
                  <th>Última renta</th>
                  <th>Seg. rentas</th>
                </tr>
              </thead>
              <tbody>
                {sortedFiltered().map(r => {
                  const dias = diasRestantes(r.fecha_fin_contrato)
                  const badge = dias === null ? null : dias < 30 ? 'badge-red' : dias < 90 ? 'badge-yellow' : 'badge-green'
                  return (
                    <tr key={r.id} onClick={() => selectRow(r)} onDoubleClick={() => { selectRow(r); if (!readOnly) { setForm({ ...r, tipo_id: r.tipo_id || '', responsable_id: r.responsable_id || '', inmueble_id: r.inmueble_id || '', seguro_rentas_id: r.seguro_rentas_id || '', fecha_contrato: r.fecha_contrato || '', fecha_fin_contrato: r.fecha_fin_contrato || '' }); setErrors({}); setModal('edit') } }}>
                      <td><strong>{nombre(r)}</strong></td>
                      <td>{r.inmuebles ? <><span className="badge badge-gray">{r.inmuebles.codigo}</span> <span style={{ fontSize: 12, color: 'var(--text2)' }}>{r.inmuebles.calle}{r.inmuebles.numero_calle ? ` ${r.inmuebles.numero_calle}` : ''}{r.inmuebles.piso ? `, ${r.inmuebles.piso}` : ''}</span></> : '—'}</td>
                      <td>{r.movil || '—'}</td>
                      <td>{fmtDate(r.fecha_contrato)}</td>
                      <td>{r.fecha_fin_contrato
                        ? <span className={`badge ${badge}`}>{fmtDate(r.fecha_fin_contrato)} · Finalizado</span>
                        : <span>{calcVenc(r) ? fmtDate(calcVenc(r)) + ' ' : ''}<span className="badge badge-green">En vigor</span></span>}</td>
                      <td>{ultimaRentaVal(r) != null ? Number(ultimaRentaVal(r)).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : '—'}</td>
                      <td>{r.seguro?.compania || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected && (
        <>
          {modal !== 'edit' && <div className="detail-overlay" onClick={() => setSelected(null)} />}
          <div className="detail-panel">
            <div className="panel-header">
              <div className="panel-avatar av-yellow">{initials(selected)}</div>
              <div style={{ flex: 1 }}>
                <h3>{nombre(selected)}</h3>
                <div className="panel-sub">{selected.inmuebles ? `${selected.inmuebles.codigo} · ${selected.inmuebles.calle}${selected.inmuebles.numero_calle ? ` ${selected.inmuebles.numero_calle}` : ''}${selected.inmuebles.piso ? `, ${selected.inmuebles.piso}` : ''}` : 'Sin inmueble'}</div>
              </div>
              {!readOnly && <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ ...selected, tipo_id: selected.tipo_id || '', responsable_id: selected.responsable_id || '', inmueble_id: selected.inmueble_id || '', seguro_rentas_id: selected.seguro_rentas_id || '', fecha_contrato: selected.fecha_contrato || '', fecha_fin_contrato: selected.fecha_fin_contrato || '', fecha_baja: selected.fecha_baja || '' }); setErrors({}); setModal('edit') }}><i className="ti ti-edit" /></button>}
              {!readOnly && <button className="btn btn-ghost btn-sm" onClick={() => del(selected.id)}><i className="ti ti-trash" style={{ color: 'var(--danger-text)' }} /></button>}
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="panel-body">
              <div className="field-section">Datos personales</div>
              <div className="field-grid">
                <div className="field"><label>DNI / NIE</label><div className="val">{selected.dni_cif || '—'}</div></div>
                <div className="field"><label>Tipo</label><div className="val">{selected.tipo_persona?.tipo || '—'}</div></div>
                <div className="field"><label>Teléfono</label><div className="val">{selected.telefono || '—'}</div></div>
                <div className="field"><label>Teléfono 2</label><div className="val">{selected.telefono_2 || '—'}</div></div>
                <div className="field"><label>Móvil</label><div className="val">{selected.movil || '—'}</div></div>
                <div className="field"><label>Email</label><div className="val">{selected.email || '—'}</div></div>
                <div className="field field-full"><label>Email 2</label><div className="val">{selected.email_2 || '—'}</div></div>
              </div>
              <div className="field-section">Contrato</div>
              <div className="field-grid">
                <div className="field"><label>Firma</label><div className="val">{fmtDate(selected.fecha_contrato)}</div></div>
                <div className="field"><label>Inicio devengo</label><div className="val">{fmtDate(selected.fecha_inicio_devengo)}</div></div>
                <div className="field"><label>Duración</label><div className="val">{selected.duracion_contrato != null ? `${selected.duracion_contrato} año${selected.duracion_contrato === 1 ? '' : 's'}` : '—'}</div></div>
                <div className="field"><label>Fin</label><div className="val">{selected.fecha_fin_contrato ? fmtDate(selected.fecha_fin_contrato) : <span className="badge badge-green">En vigor</span>}</div></div>
                <div className="field"><label>Fianza IVIMA</label><div className="val">{fmtMoney(selected.importe_fianza_ivima)}</div></div>
                <div className="field"><label>Depósito</label><div className="val">{fmtMoney(selected.importe_deposito)}</div></div>
                <div className="field"><label>Seg. rentas</label><div className="val">{selected.seguro?.compania || '—'}</div></div>
                <div className="field"><label>Nº póliza</label><div className="val">{selected.num_poliza_seg_rentas || '—'}</div></div>
              </div>
              <div className="field-section">Enlaces</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selected.carpeta_dropbox && <a href={selected.carpeta_dropbox} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }}><i className="ti ti-folder" /> Carpeta Dropbox</a>}
                {selected.fianza_ivima_url && <a href={selected.fianza_ivima_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }}><i className="ti ti-file-type-pdf" /> Fianza IVIMA</a>}
                {selected.contrato_url && <a href={selected.contrato_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }}><i className="ti ti-file-type-pdf" /> Contrato</a>}
                {!selected.carpeta_dropbox && !selected.fianza_ivima_url && !selected.contrato_url && <span style={{ fontSize: 13, color: 'var(--text3)' }}>Sin enlaces</span>}
              </div>
              {(selected.nombre_conyuge || selected.movil_conyuge) && <>
                <div className="field-section">Cónyuge</div>
                <div className="field-grid">
                  <div className="field"><label>Nombre</label><div className="val">{`${selected.nombre_conyuge || ''} ${selected.apellidos_conyuge || ''}`.trim() || '—'}</div></div>
                  <div className="field"><label>Móvil</label><div className="val">{selected.movil_conyuge || '—'}</div></div>
                  <div className="field"><label>Email</label><div className="val">{selected.email_conyuge || '—'}</div></div>
                  <div className="field"><label>Email 2</label><div className="val">{selected.email_2_conyuge || '—'}</div></div>
                  <div className="field"><label>Teléfono 2</label><div className="val">{selected.telefono_2_conyuge || '—'}</div></div>
                </div>
              </>}
              {(selected.nombre_inq2 || selected.movil_inq2) && <>
                <div className="field-section">2º inquilino</div>
                <div className="field-grid">
                  <div className="field"><label>Nombre</label><div className="val">{`${selected.nombre_inq2 || ''} ${selected.apellidos_inq2 || ''}`.trim() || '—'}</div></div>
                  <div className="field"><label>DNI / NIE</label><div className="val">{selected.dni_inq2 || '—'}</div></div>
                  <div className="field"><label>Tipo</label><div className="val">{tipos.find(t => t.id === selected.tipo_inq2_id)?.tipo || '—'}</div></div>
                  <div className="field"><label>Relación</label><div className="val">{selected.relacion_inq2 || '—'}</div></div>
                  <div className="field"><label>Teléfono</label><div className="val">{selected.telefono_inq2 || '—'}</div></div>
                  <div className="field"><label>Móvil</label><div className="val">{selected.movil_inq2 || '—'}</div></div>
                  <div className="field field-full"><label>Email</label><div className="val">{selected.email_inq2 || '—'}</div></div>
                </div>
              </>}
              {(selected.nombre_inq3 || selected.movil_inq3) && <>
                <div className="field-section">3º inquilino</div>
                <div className="field-grid">
                  <div className="field"><label>Nombre</label><div className="val">{`${selected.nombre_inq3 || ''} ${selected.apellidos_inq3 || ''}`.trim() || '—'}</div></div>
                  <div className="field"><label>DNI / NIE</label><div className="val">{selected.dni_inq3 || '—'}</div></div>
                  <div className="field"><label>Tipo</label><div className="val">{tipos.find(t => t.id === selected.tipo_inq3_id)?.tipo || '—'}</div></div>
                  <div className="field"><label>Relación</label><div className="val">{selected.relacion_inq3 || '—'}</div></div>
                  <div className="field"><label>Teléfono</label><div className="val">{selected.telefono_inq3 || '—'}</div></div>
                  <div className="field"><label>Móvil</label><div className="val">{selected.movil_inq3 || '—'}</div></div>
                  <div className="field field-full"><label>Email</label><div className="val">{selected.email_inq3 || '—'}</div></div>
                </div>
              </>}
              <div className="field-section">Documentos</div>
              <Documentos entidadTipo="inquilino" entidadId={selected.id} readOnly={readOnly} />
              <div className="field-section">Acciones recientes</div>
              {acciones.length === 0 ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Sin acciones</div> : (
                <div className="timeline">
                  {acciones.map(a => (
                    <div className="tl-item" key={a.id}>
                      <div className="tl-dot" />
                      <div className="tl-content">
                        <div className="tl-text">{a.indicaciones || '—'}</div>
                        <div className="tl-meta">{fmtDate(a.fecha)}{a.hora ? ` ${a.hora}` : ''} · {a.tipo_contacto?.tipo_contacto || ''} · {a.responsable?.nombre_responsable || '—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {modal === 'edit' && (
            <div className="edit-modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
              <div className="modal">
                <div className="modal-header">
                  <h2>Editar inquilino</h2>
                  <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><i className="ti ti-x" /></button>
                </div>
                <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                  {inqTabs(true)}
                  {tabInq === 'acc' && accionesTab}
                  {tabInq === 'renta' && rentaTab}
                  {tabInq === 'docs' && <Documentos entidadTipo="inquilino" entidadId={form.id} readOnly={readOnly} />}
                  {tabInq === '2' && extraInqGrid('inq2')}
                  {tabInq === '3' && extraInqGrid('inq3')}
                  {tabInq === '1' && <div className="form-grid">
                    <div className="form-group"><label>Nombre</label><input value={form.nombre ?? ''} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} /></div>
                    <div className="form-group"><label>Apellidos</label><input value={form.apellidos ?? ''} onChange={e => setForm(p => ({ ...p, apellidos: e.target.value }))} /></div>
                    <div className="form-group"><label>DNI / NIE</label><input value={form.dni_cif ?? ''} onChange={e => setForm(p => ({ ...p, dni_cif: e.target.value }))} /></div>
                    <div className="form-group"><label>Tipo *</label>
                      <select value={form.tipo_id ?? ''} onChange={e => setForm(p => ({ ...p, tipo_id: e.target.value }))}>
                        <option value="">— Selecciona —</option>
                        {tipos.map(t => <option key={t.id} value={t.id}>{t.tipo}</option>)}
                      </select>
                    </div>
                    <div className="form-group"><label>Responsable</label>
                      <select value={form.responsable_id ?? ''} onChange={e => setForm(p => ({ ...p, responsable_id: e.target.value }))}>
                        <option value="">—</option>
                        {responsables.map(r => <option key={r.id} value={r.id}>{r.nombre_responsable}</option>)}
                      </select>
                    </div>
                    <div className="form-group"><label>Teléfono</label><input value={form.telefono ?? ''} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} /></div>
                    <div className="form-group"><label>Teléfono 2</label><input value={form.telefono_2 ?? ''} onChange={e => setForm(p => ({ ...p, telefono_2: e.target.value }))} /></div>
                    <div className="form-group"><label>Móvil</label><input value={form.movil ?? ''} onChange={e => setForm(p => ({ ...p, movil: e.target.value }))} /></div>
                    <div className="form-group"><label>Email</label><input value={form.email ?? ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
                    <div className="form-group"><label>Email 2</label><input value={form.email_2 ?? ''} onChange={e => setForm(p => ({ ...p, email_2: e.target.value }))} /></div>
                    <div className="form-section-title">Contrato</div>
                    <div className="form-group"><label>Inmueble</label>
                      <select value={form.inmueble_id ?? ''} onChange={e => setForm(p => ({ ...p, inmueble_id: e.target.value }))}>
                        <option value="">— Sin asignar —</option>
                        {inmuebles.map(i => <option key={i.id} value={i.id}>{i.codigo} — {i.calle}</option>)}
                      </select>
                    </div>
                    <div className="form-group"><label>Firma contrato</label><input type="date" value={form.fecha_contrato ?? ''} onChange={e => setForm(p => ({ ...p, fecha_contrato: e.target.value, fecha_inicio_devengo: calcDevengo(e.target.value) }))} /></div>
                    <div className="form-group"><label>Inicio devengo</label><input type="date" value={form.fecha_inicio_devengo ?? ''} onChange={e => setForm(p => ({ ...p, fecha_inicio_devengo: e.target.value }))} /></div>
                    <div className="form-group"><label>Duración (años)</label><input type="number" min="1" value={form.duracion_contrato ?? ''} onChange={e => setForm(p => ({ ...p, duracion_contrato: e.target.value }))} /></div>
                    <div className="form-group"><label>Fin</label><input type="date" value={form.fecha_fin_contrato ?? ''} onChange={e => setForm(p => ({ ...p, fecha_fin_contrato: e.target.value }))} /></div>
                    <div className="form-group form-full"><label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><input type="checkbox" checked={form.aviso_fin ?? false} onChange={e => setForm(p => ({ ...p, aviso_fin: e.target.checked }))} style={{ width: 16, height: 16 }} /> Generar aviso de fin de contrato</label>{form.aviso_fin && (<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}><span style={{ fontSize: 13, color: 'var(--text2)' }}>Avisar</span><input type="number" min="1" max="60" value={form.aviso_meses_antes ?? 5} onChange={e => setForm(p => ({ ...p, aviso_meses_antes: e.target.value }))} style={{ width: 70 }} /><span style={{ fontSize: 13, color: 'var(--text2)' }}>meses antes del vencimiento</span></div>)}</div>
                    <div className="form-group"><label>Fianza IVIMA (€)</label><input type="number" value={form.importe_fianza_ivima ?? ''} onChange={e => setForm(p => ({ ...p, importe_fianza_ivima: e.target.value }))} /></div>
                    <div className="form-group"><label>Depósito (€)</label><input type="number" value={form.importe_deposito ?? ''} onChange={e => setForm(p => ({ ...p, importe_deposito: e.target.value }))} /></div>
                    <div className="form-group"><label>Seg. rentas</label>
                      <select value={form.seguro_rentas_id ?? ''} onChange={e => setForm(p => ({ ...p, seguro_rentas_id: e.target.value }))}>
                        <option value="">—</option>
                        {seguros.map(s => <option key={s.id} value={s.id}>{s.compania}</option>)}
                      </select>
                    </div>
                    <div className="form-group form-full"><label>Observaciones</label><textarea value={form.observaciones ?? ''} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} /></div>
                  </div>}
                  {tabInq !== 'acc' && tabInq !== 'docs' && tabInq !== 'renta' && <div className="form-actions">
                    <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
                    <button className="btn btn-primary" onClick={save}>Guardar</button>
                  </div>}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {(modal === 'new' || (modal === 'edit' && !selected)) && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2>{modal === 'new' ? 'Nuevo inquilino' : 'Editar inquilino'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              {inqTabs(false)}
              {tabInq === '2' && extraInqGrid('inq2')}
              {tabInq === '3' && extraInqGrid('inq3')}
              {tabInq === '1' && <div className="form-grid">
                <div className="form-group"><label>Nombre</label><input value={form.nombre || ''} onChange={f('nombre')} /></div>
                <div className="form-group"><label>Apellidos</label><input value={form.apellidos || ''} onChange={f('apellidos')} /></div>
                <div className="form-group"><label>DNI / NIE</label><input value={form.dni_cif || ''} onChange={f('dni_cif')} /></div>
                <div className="form-group">
                  <label>Tipo <span style={{ color: 'var(--danger-text)' }}>*</span></label>
                  <select value={form.tipo_id || ''} onChange={f('tipo_id')} style={{ borderColor: errors.tipo_id ? 'var(--danger-text)' : '' }}>
                    <option value="">— Selecciona —</option>
                    {tipos.map(t => <option key={t.id} value={t.id}>{t.tipo}</option>)}
                  </select>
                  {errors.tipo_id && <span style={{ color: 'var(--danger-text)', fontSize: 11 }}>{errors.tipo_id}</span>}
                </div>
                <div className="form-group"><label>Responsable</label>
                  <select value={form.responsable_id || ''} onChange={f('responsable_id')}>
                    <option value="">—</option>
                    {responsables.map(r => <option key={r.id} value={r.id}>{r.nombre_responsable}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Teléfono</label><input value={form.telefono || ''} onChange={f('telefono')} /></div>
                <div className="form-group"><label>Teléfono 2</label><input value={form.telefono_2 || ''} onChange={f('telefono_2')} /></div>
                <div className="form-group"><label>Móvil</label><input value={form.movil || ''} onChange={f('movil')} /></div>
                <div className="form-group"><label>Email</label><input value={form.email || ''} onChange={f('email')} /></div>
                <div className="form-group"><label>Email 2</label><input value={form.email_2 || ''} onChange={f('email_2')} /></div>
                <div className="form-section-title">Contrato</div>
                <div className="form-group"><label>Inmueble</label>
                  <select value={form.inmueble_id || ''} onChange={f('inmueble_id')}>
                    <option value="">— Sin asignar —</option>
                    {inmuebles.map(i => <option key={i.id} value={i.id}>{i.codigo} — {i.calle}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Seg. rentas</label>
                  <select value={form.seguro_rentas_id || ''} onChange={f('seguro_rentas_id')}>
                    <option value="">—</option>
                    {seguros.map(s => <option key={s.id} value={s.id}>{s.compania}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Firma contrato</label><input type="date" value={form.fecha_contrato || ''} onChange={e => setForm(p => ({ ...p, fecha_contrato: e.target.value, fecha_inicio_devengo: calcDevengo(e.target.value) }))} /></div>
                <div className="form-group"><label>Inicio devengo</label><input type="date" value={form.fecha_inicio_devengo || ''} onChange={f('fecha_inicio_devengo')} /></div>
                <div className="form-group"><label>Duración (años)</label><input type="number" min="1" value={form.duracion_contrato ?? ''} onChange={f('duracion_contrato')} /></div>
                <div className="form-group"><label>Fin contrato</label><input type="date" value={form.fecha_fin_contrato || ''} onChange={f('fecha_fin_contrato')} /></div>
                <div className="form-group form-full"><label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><input type="checkbox" checked={form.aviso_fin ?? false} onChange={e => setForm(p => ({ ...p, aviso_fin: e.target.checked }))} style={{ width: 16, height: 16 }} /> Generar aviso de fin de contrato</label>{form.aviso_fin && (<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}><span style={{ fontSize: 13, color: 'var(--text2)' }}>Avisar</span><input type="number" min="1" max="60" value={form.aviso_meses_antes ?? 5} onChange={e => setForm(p => ({ ...p, aviso_meses_antes: e.target.value }))} style={{ width: 70 }} /><span style={{ fontSize: 13, color: 'var(--text2)' }}>meses antes del vencimiento</span></div>)}</div>
                <div className="form-group"><label>Fianza IVIMA (€)</label><input type="number" value={form.importe_fianza_ivima || ''} onChange={f('importe_fianza_ivima')} /></div>
                <div className="form-group"><label>Depósito (€)</label><input type="number" value={form.importe_deposito || ''} onChange={f('importe_deposito')} /></div>
                <div className="form-group form-full"><label>Nº póliza seg. rentas</label><input value={form.num_poliza_seg_rentas || ''} onChange={f('num_poliza_seg_rentas')} /></div>
                <div className="form-section-title">Enlaces Dropbox / documentos</div>
                <div className="form-group form-full"><label>Carpeta Dropbox (URL)</label><input value={form.carpeta_dropbox || ''} onChange={f('carpeta_dropbox')} placeholder="https://..." /></div>
                <div className="form-group form-full"><label>Fianza IVIMA (URL PDF)</label><input value={form.fianza_ivima_url || ''} onChange={f('fianza_ivima_url')} placeholder="https://..." /></div>
                <div className="form-group form-full"><label>Contrato (URL PDF)</label><input value={form.contrato_url || ''} onChange={f('contrato_url')} placeholder="https://..." /></div>
                <div className="form-section-title">Cónyuge</div>
                <div className="form-group"><label>Nombre cónyuge</label><input value={form.nombre_conyuge || ''} onChange={f('nombre_conyuge')} /></div>
                <div className="form-group"><label>Apellidos cónyuge</label><input value={form.apellidos_conyuge || ''} onChange={f('apellidos_conyuge')} /></div>
                <div className="form-group"><label>Móvil cónyuge</label><input value={form.movil_conyuge || ''} onChange={f('movil_conyuge')} /></div>
                <div className="form-group"><label>Email cónyuge</label><input value={form.email_conyuge || ''} onChange={f('email_conyuge')} /></div>
                <div className="form-group"><label>Teléfono 2 cónyuge</label><input value={form.telefono_2_conyuge || ''} onChange={f('telefono_2_conyuge')} /></div>
                <div className="form-group"><label>Email 2 cónyuge</label><input value={form.email_2_conyuge || ''} onChange={f('email_2_conyuge')} /></div>
                <div className="form-group form-full"><label>Observaciones</label><textarea value={form.observaciones || ''} onChange={f('observaciones')} /></div>
              </div>}
              <div className="form-actions">
                <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={save}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

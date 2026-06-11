import { useEffect, useState } from 'react'
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

const EMPTY = { nombre: '', apellidos: '', dni_cif: '', tipo_id: '', responsable_id: '', telefono: '', movil: '', telefono_2: '', email: '', email_2: '', observaciones: '', nombre_conyuge: '', apellidos_conyuge: '', movil_conyuge: '', email_conyuge: '', telefono_2_conyuge: '', email_2_conyuge: '', otra_persona_contacto: '', movil_otra_persona: '', email_otra_persona: '', relacion_otra_persona: '', inmueble_id: '', fecha_contrato: '', fecha_fin_contrato: '', mes_contrato: '', importe_fianza_ivima: '', importe_deposito: '', seguro_rentas_id: '', num_poliza_seg_rentas: '', carpeta_dropbox: '', fianza_ivima_url: '', contrato_url: '' }

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

  useEffect(() => { load() }, [])
  useCtrlG(save, !!modal)

  async function load() {
    setLoading(true)
    const [{ data: inqs }, { data: inms }, { data: segs }, { data: resps }, { data: tip }] = await Promise.all([
      (() => {
        let q = supabase.from('inquilinos').select('*, inmuebles(codigo, calle, piso), seguro(compania), responsable(nombre_responsable), tipo_persona(tipo)').order('nombre')
        if (perfil?.rol === 'propietario' && perfil?.propietario_id) {
          q = q.eq('inmuebles.propietario_id', perfil.propietario_id)
        }
        return q
      })(),
      supabase.from('inmuebles').select('id, codigo, calle').order('codigo'),
      supabase.from('seguro').select('id, compania'),
      supabase.from('responsable').select('*'),
      supabase.from('tipo_persona').select('*'),
    ])
    setRows(inqs || [])
    setInmuebles(inms || [])
    setSeguros(segs || [])
    setResponsables(resps || [])
    setTipos(tip || [])
    setLoading(false)
  }

  async function selectRow(row) {
    setSelected(row)
    const { data } = await supabase.from('accion_inquilino').select('*, responsable(nombre_responsable), tipo_contacto(tipo_contacto)').eq('inquilino_id', row.id).order('fecha', { ascending: false })
    setAcciones(data || [])
  }

  function validate(data) {
    const errs = {}
    if (!data.tipo_id) errs.tipo_id = 'Obligatorio'
    return errs
  }

  async function save() {
    const errs = validate(form)
    if (Object.keys(errs).length) { setErrors(errs); return }
    const data = { ...form }
    Object.keys(data).forEach(k => { if (data[k] === '' || data[k] === undefined) data[k] = null })
    if (modal === 'new') {
      await supabase.from('inquilinos').insert(data)
    } else {
      const { id: _id, inmuebles: _, seguro: __, responsable: ___, tipo_persona: ____, ...updateData } = data
      const { error } = await supabase.from('inquilinos').update(updateData).eq('id', form.id)
      if (error) { alert('Error al guardar: ' + error.message); return }
    }
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
      'Dirección inmueble': r.inmuebles ? `${r.inmuebles.calle || ''}${r.inmuebles.piso ? `, ${r.inmuebles.piso}` : ''}` : '',
      'Inicio contrato': fmtDate(r.fecha_contrato),
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
          <button className="btn btn-primary btn-sm" onClick={() => { setForm(EMPTY); setErrors({}); setModal('new') }}><i className="ti ti-plus" /> Nuevo</button>
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
                  <th onClick={() => toggleSort('fecha_fin_contrato')} style={{ cursor: 'pointer' }}>Fin <SortIcon col="fecha_fin_contrato" /></th>
                  <th>Seg. rentas</th>
                </tr>
              </thead>
              <tbody>
                {sortedFiltered().map(r => {
                  const dias = diasRestantes(r.fecha_fin_contrato)
                  const badge = dias === null ? null : dias < 30 ? 'badge-red' : dias < 90 ? 'badge-yellow' : 'badge-green'
                  return (
                    <tr key={r.id} onClick={() => selectRow(r)} onDoubleClick={() => { selectRow(r); setForm({ ...r, tipo_id: r.tipo_id || '', responsable_id: r.responsable_id || '', inmueble_id: r.inmueble_id || '', seguro_rentas_id: r.seguro_rentas_id || '', fecha_contrato: r.fecha_contrato || '', fecha_fin_contrato: r.fecha_fin_contrato || '' }); setErrors({}); setModal('edit') }}>
                      <td><strong>{nombre(r)}</strong></td>
                      <td>{r.inmuebles ? <span className="badge badge-gray">{r.inmuebles.codigo}</span> : '—'}</td>
                      <td>{r.movil || '—'}</td>
                      <td>{fmtDate(r.fecha_contrato)}</td>
                      <td>{r.fecha_fin_contrato ? <span className={`badge ${badge}`}>{fmtDate(r.fecha_fin_contrato)}</span> : <span className="badge badge-green">En vigor</span>}</td>
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
                <div className="panel-sub">{selected.inmuebles ? `${selected.inmuebles.codigo} · ${selected.inmuebles.calle}` : 'Sin inmueble'}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ ...selected, tipo_id: selected.tipo_id || '', responsable_id: selected.responsable_id || '', inmueble_id: selected.inmueble_id || '', seguro_rentas_id: selected.seguro_rentas_id || '', fecha_contrato: selected.fecha_contrato || '', fecha_fin_contrato: selected.fecha_fin_contrato || '', fecha_baja: selected.fecha_baja || '' }); setErrors({}); setModal('edit') }}><i className="ti ti-edit" /></button>
              <button className="btn btn-ghost btn-sm" onClick={() => del(selected.id)}><i className="ti ti-trash" style={{ color: 'var(--danger-text)' }} /></button>
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
                <div className="field"><label>Inicio</label><div className="val">{fmtDate(selected.fecha_contrato)}</div></div>
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
              <div className="field-section">Documentos</div>
              <Documentos entidadTipo="inquilino" entidadId={selected.id} />
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
                  <div className="form-grid">
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
                    <div className="form-group"><label>Inicio</label><input type="date" value={form.fecha_contrato ?? ''} onChange={e => setForm(p => ({ ...p, fecha_contrato: e.target.value }))} /></div>
                    <div className="form-group"><label>Fin</label><input type="date" value={form.fecha_fin_contrato ?? ''} onChange={e => setForm(p => ({ ...p, fecha_fin_contrato: e.target.value }))} /></div>
                    <div className="form-group"><label>Fianza IVIMA (€)</label><input type="number" value={form.importe_fianza_ivima ?? ''} onChange={e => setForm(p => ({ ...p, importe_fianza_ivima: e.target.value }))} /></div>
                    <div className="form-group"><label>Depósito (€)</label><input type="number" value={form.importe_deposito ?? ''} onChange={e => setForm(p => ({ ...p, importe_deposito: e.target.value }))} /></div>
                    <div className="form-group"><label>Seg. rentas</label>
                      <select value={form.seguro_rentas_id ?? ''} onChange={e => setForm(p => ({ ...p, seguro_rentas_id: e.target.value }))}>
                        <option value="">—</option>
                        {seguros.map(s => <option key={s.id} value={s.id}>{s.compania}</option>)}
                      </select>
                    </div>
                    <div className="form-group form-full"><label>Observaciones</label><textarea value={form.observaciones ?? ''} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} /></div>
                  </div>
                  <div className="form-actions">
                    <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
                    <button className="btn btn-primary" onClick={save}>Guardar</button>
                  </div>
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
              <div className="form-grid">
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
                <div className="form-group"><label>Inicio contrato</label><input type="date" value={form.fecha_contrato || ''} onChange={f('fecha_contrato')} /></div>
                <div className="form-group"><label>Fin contrato</label><input type="date" value={form.fecha_fin_contrato || ''} onChange={f('fecha_fin_contrato')} /></div>
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
              </div>
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


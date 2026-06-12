import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCtrlG } from '../lib/useCtrlG'
import { supabase } from '../lib/supabase'
import { useSortable } from '../components/SortableTable.jsx'

function norm(s) {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}
function ms(fields, q) {
  var n = norm(q)
  if (!n) return true
  return fields.some(function(f) { return norm(f).indexOf(n) !== -1 })
}


const ACCION_EMPTY = { fecha: '', hora: '', tipo_contacto_id: '', responsable_id: '', indicaciones: '', proxima_fecha: '', proxima_accion: '', entidad_id: '', documento: '' }

// ============================================================
// CONTACTOS
// ============================================================
const CONTACTO_EMPTY = { nombre: '', apellidos: '', dni_cif: '', telefono: '', movil: '', telefono_2: '', email: '', email_2: '', calle: '', numero: '', piso: '', municipio: '', provincia: '', cod_postal: '', fecha_baja: '', observaciones: '', tipo_id: '', responsable_id: '', conocimiento_id: '', clasificacion_id: '', referenciado_por: '', empresa_tasacion: '', edad_estimada: '', estado_civil: '', nombre_conyuge: '', apellidos_conyuge: '', movil_conyuge: '', email_conyuge: '', telefono_2_conyuge: '', email_2_conyuge: '' }

export function Contactos({ perfil }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null)
  const [editModal, setEditModal] = useState(false)
  const [form, setForm] = useState(CONTACTO_EMPTY)
  const [acciones, setAcciones] = useState([])
  const [clasificaciones, setClasificaciones] = useState([])
  const [conocimientos, setConocimientos] = useState([])
  const [responsables, setResponsables] = useState([])
  const [tipos, setTipos] = useState([])
  const { sortData, sortIcon, thProps } = useSortable('nombre')
  const readOnly = perfil?.rol === 'visor'
  const [tiposContacto, setTiposContacto] = useState([])
  const [tabCont, setTabCont] = useState('datos')
  const [nuevaAccion, setNuevaAccion] = useState(null)
  const [guardandoAccion, setGuardandoAccion] = useState(false)

  useEffect(() => { load() }, [])
  useEffect(() => { if (modal || editModal) { setTabCont('datos'); setNuevaAccion(null) } }, [modal, editModal])
  useCtrlG(save, !!(modal || editModal))

  async function load() {
    setLoading(true)
    const [{ data }, { data: clas }, { data: conoc }, { data: resps }, { data: tips }, { data: tc }] = await Promise.all([
      supabase.from('persona_contacto').select('*, clasificacion_contacto(clasificacion), responsable(nombre_responsable), conocimiento(origen), tipo_persona(tipo)').order('nombre'),
      supabase.from('clasificacion_contacto').select('*'),
      supabase.from('conocimiento').select('*').order('origen'),
      supabase.from('responsable').select('*'),
      supabase.from('tipo_persona').select('*'),
      supabase.from('tipo_contacto').select('*'),
    ])
    setRows(data || [])
    setClasificaciones(clas || [])
    setConocimientos(conoc || [])
    setResponsables(resps || [])
    setTipos(tips || [])
    setTiposContacto(tc || [])
    setLoading(false)
  }

  async function loadAcciones(personaId) {
    const { data } = await supabase.from('accion_persona_contacto').select('*, responsable(nombre_responsable), tipo_contacto(tipo_contacto)').eq('persona_id', personaId).order('fecha', { ascending: false })
    setAcciones(data || [])
  }

  async function selectRow(row) {
    setSelected(row)
    loadAcciones(row.id)
  }

  async function guardarAccion() {
    if (!form.id) return
    if (!nuevaAccion?.fecha) { alert('Indica la fecha de la acción'); return }
    setGuardandoAccion(true)
    const { error } = await supabase.from('accion_persona_contacto').insert({
      persona_id: form.id,
      fecha: nuevaAccion.fecha || null,
      hora: nuevaAccion.hora || null,
      tipo_contacto_id: nuevaAccion.tipo_contacto_id || null,
      responsable_id: nuevaAccion.responsable_id || null,
      indicaciones: nuevaAccion.indicaciones || null,
      proxima_fecha: nuevaAccion.proxima_fecha || null,
      proxima_accion: nuevaAccion.proxima_accion || null,
      documento: nuevaAccion.documento || null,
      completada: false,
    })
    setGuardandoAccion(false)
    if (error) { alert('Error al guardar la acción: ' + error.message); return }
    setNuevaAccion(null)
    loadAcciones(form.id)
  }

  async function completarAccion(id) {
    await supabase.from('accion_persona_contacto').update({ completada: true }).eq('id', id)
    if (form.id) loadAcciones(form.id)
  }

  function openEdit(row) {
    setForm({ ...row, tipo_id: row.tipo_id || '', responsable_id: row.responsable_id || '', conocimiento_id: row.conocimiento_id || '', clasificacion_id: row.clasificacion_id || '' })
    setEditModal(true)
  }

  async function save() {
    const data = { ...form }
    Object.keys(data).forEach(k => { if (data[k] === '' || data[k] === undefined) data[k] = null })
    const isEdit = editModal || modal === 'edit'
    if (!isEdit) {
      await supabase.from('persona_contacto').insert(data)
    } else {
      const { id, clasificacion_contacto: _, responsable: __, conocimiento: ___, tipo_persona: ____, administrador_finca: _____, ...updateData } = data
      await supabase.from('persona_contacto').update(updateData).eq('id', form.id)
    }
    setModal(null); setEditModal(false); load()
  }

  async function del(id) {
    if (!confirm('¿Eliminar este contacto?')) return
    await supabase.from('persona_contacto').delete().eq('id', id)
    setSelected(null); load()
  }

  const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES') : '—'
  const nombre = r => `${r.nombre || ''} ${r.apellidos || ''}`.trim() || '—'
  const initials = r => nombre(r).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const f = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }))
  const clsBadge = cl => ({ 'Propietario': 'badge-blue', 'Cliente potencial': 'badge-yellow', 'Proveedor': 'badge-gray', 'Administrador Finca': 'badge-green' })[cl] || 'badge-gray'

  function filtered() {
    let data = rows.filter(r => ms([r.nombre, r.apellidos, r.email, r.movil, r.clasificacion_contacto?.clasificacion], search))
    return sortData(data, (r, col) => {
      if (col === 'nombre') return nombre(r)
      if (col === 'clasificacion') return r.clasificacion_contacto?.clasificacion
      if (col === 'origen') return r.conocimiento?.origen
      if (col === 'responsable') return r.responsable?.nombre_responsable
      return r[col]
    })
  }

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

  const FormModal = () => (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && (setModal(null), setEditModal(false))}>
      <div className="modal">
        <div className="modal-header">
          <h2>{modal === 'new' ? 'Nuevo contacto' : `Editar — ${nombre(form)}`}</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => { setModal(null); setEditModal(false) }}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          {editModal && form.id && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {[['datos','Datos'],['acc',`Acciones (${acciones.length})`]].map(([v,l]) => (
                <button key={v} className={`btn btn-sm ${tabCont === v ? 'btn-primary' : ''}`} onClick={() => setTabCont(v)}>{l}</button>
              ))}
            </div>
          )}
          {editModal && tabCont === 'acc' && accionesTab}
          {(!editModal || tabCont === 'datos') && <div className="form-grid">
            <div className="form-group"><label>Nombre</label><input value={form.nombre ?? ''} onChange={f('nombre')} /></div>
            <div className="form-group"><label>Apellidos</label><input value={form.apellidos ?? ''} onChange={f('apellidos')} /></div>
            <div className="form-group"><label>Tipo <span style={{ color: 'var(--danger-text)' }}>*</span></label>
              <select value={form.tipo_id ?? ''} onChange={f('tipo_id')}>
                <option value="">— Selecciona —</option>
                {tipos.map(t => <option key={t.id} value={t.id}>{t.tipo}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Clasificación</label>
              <select value={form.clasificacion_id ?? ''} onChange={f('clasificacion_id')}>
                <option value="">—</option>
                {clasificaciones.map(c => <option key={c.id} value={c.id}>{c.clasificacion}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Responsable</label>
              <select value={form.responsable_id ?? ''} onChange={f('responsable_id')}>
                <option value="">—</option>
                {responsables.map(r => <option key={r.id} value={r.id}>{r.nombre_responsable}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Origen conocimiento</label>
              <select value={form.conocimiento_id ?? ''} onChange={f('conocimiento_id')}>
                <option value="">—</option>
                {conocimientos.map(c => <option key={c.id} value={c.id}>{c.origen}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Teléfono</label><input value={form.telefono ?? ''} onChange={f('telefono')} /></div>
            <div className="form-group"><label>Teléfono 2</label><input value={form.telefono_2 ?? ''} onChange={f('telefono_2')} /></div>
            <div className="form-group"><label>Móvil</label><input value={form.movil ?? ''} onChange={f('movil')} /></div>
            <div className="form-group"><label>Email</label><input value={form.email ?? ''} onChange={f('email')} /></div>
            <div className="form-group"><label>Email 2</label><input value={form.email_2 ?? ''} onChange={f('email_2')} /></div>
            <div className="form-group"><label>Referenciado por</label><input value={form.referenciado_por ?? ''} onChange={f('referenciado_por')} /></div>
            <div className="form-group form-full"><label>Dirección</label><input value={form.calle ?? ''} onChange={f('calle')} /></div>
            <div className="form-section-title">Cónyuge</div>
            <div className="form-group"><label>Nombre</label><input value={form.nombre_conyuge ?? ''} onChange={f('nombre_conyuge')} /></div>
            <div className="form-group"><label>Apellidos</label><input value={form.apellidos_conyuge ?? ''} onChange={f('apellidos_conyuge')} /></div>
            <div className="form-group"><label>Móvil</label><input value={form.movil_conyuge ?? ''} onChange={f('movil_conyuge')} /></div>
            <div className="form-group"><label>Email</label><input value={form.email_conyuge ?? ''} onChange={f('email_conyuge')} /></div>
            <div className="form-group"><label>Teléfono 2</label><input value={form.telefono_2_conyuge ?? ''} onChange={f('telefono_2_conyuge')} /></div>
            <div className="form-group"><label>Email 2</label><input value={form.email_2_conyuge ?? ''} onChange={f('email_2_conyuge')} /></div>
            <div className="form-group form-full"><label>Observaciones</label><textarea value={form.observaciones ?? ''} onChange={f('observaciones')} /></div>
          </div>}
          {(!editModal || tabCont !== 'acc') && <div className="form-actions">
            <button className="btn" onClick={() => { setModal(null); setEditModal(false) }}>Cancelar</button>
            <button className="btn btn-primary" onClick={save}>Guardar</button>
          </div>}
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>Contactos <span className="badge badge-gray" style={{ marginLeft: 6 }}>{filtered().length}</span></h2>
          <div className="search-input"><i className="ti ti-search" /><input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          {!readOnly && <button className="btn btn-primary btn-sm" onClick={() => { setForm(CONTACTO_EMPTY); setModal('new') }}><i className="ti ti-plus" /> Nuevo</button>}
        </div>
        <div className="table-wrap">
          {loading ? <div className="loading"><i className="ti ti-loader ti-spin" /> Cargando...</div> : (
            <table>
              <thead><tr>
                <th {...thProps('nombre')}>Nombre <span style={{fontSize:10}}>{sortIcon('nombre')}</span></th>
                <th {...thProps('clasificacion')}>Clasificación <span style={{fontSize:10}}>{sortIcon('clasificacion')}</span></th>
                <th {...thProps('origen')}>Origen <span style={{fontSize:10}}>{sortIcon('origen')}</span></th>
                <th {...thProps('movil')}>Móvil <span style={{fontSize:10}}>{sortIcon('movil')}</span></th>
                <th {...thProps('email')}>Email <span style={{fontSize:10}}>{sortIcon('email')}</span></th>
                <th {...thProps('responsable')}>Responsable <span style={{fontSize:10}}>{sortIcon('responsable')}</span></th>
              </tr></thead>
              <tbody>
                {filtered().map(r => (
                  <tr key={r.id}
                    onClick={() => selectRow(r)}
                    onDoubleClick={() => { selectRow(r); if (!readOnly) openEdit(r) }}>
                    <td><strong>{nombre(r)}</strong></td>
                    <td>{r.clasificacion_contacto ? <span className={`badge ${clsBadge(r.clasificacion_contacto.clasificacion)}`}>{r.clasificacion_contacto.clasificacion}</span> : '—'}</td>
                    <td>{r.conocimiento?.origen || '—'}</td>
                    <td>{r.movil || '—'}</td>
                    <td style={{ color: 'var(--info-text)' }}>{r.email || '—'}</td>
                    <td>{r.responsable?.nombre_responsable || '—'}</td>
                  </tr>
                ))}
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
              <div className="panel-avatar av-gray">{initials(selected)}</div>
              <div style={{ flex: 1 }}>
                <h3>{nombre(selected)}</h3>
                <div className="panel-sub">{selected.clasificacion_contacto?.clasificacion || ''}</div>
              </div>
              {!readOnly && <button className="btn btn-ghost btn-sm" onClick={() => openEdit(selected)}><i className="ti ti-edit" /></button>}
              {!readOnly && <button className="btn btn-ghost btn-sm" onClick={() => del(selected.id)}><i className="ti ti-trash" style={{ color: 'var(--danger-text)' }} /></button>}
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="panel-body">
              <div className="field-section">Datos de contacto</div>
              <div className="field-grid">
                <div className="field"><label>Teléfono</label><div className="val">{selected.telefono || '—'}</div></div>
                <div className="field"><label>Teléfono 2</label><div className="val">{selected.telefono_2 || '—'}</div></div>
                <div className="field"><label>Móvil</label><div className="val">{selected.movil || '—'}</div></div>
                <div className="field field-full"><label>Email</label><div className="val">{selected.email || '—'}</div></div>
                <div className="field field-full"><label>Email 2</label><div className="val">{selected.email_2 || '—'}</div></div>
                <div className="field field-full"><label>Dirección</label><div className="val">{[selected.calle, selected.numero, selected.piso, selected.municipio, selected.provincia, selected.cod_postal].filter(Boolean).join(', ') || '—'}</div></div>
              </div>
              <div className="field-section">CRM</div>
              <div className="field-grid">
                <div className="field"><label>Responsable</label><div className="val">{selected.responsable?.nombre_responsable || '—'}</div></div>
                <div className="field"><label>Origen</label><div className="val">{selected.conocimiento?.origen || '—'}</div></div>
                <div className="field"><label>Referenciado por</label><div className="val">{selected.referenciado_por || '—'}</div></div>
              </div>
              {selected.nombre_conyuge && <>
                <div className="field-section">Cónyuge</div>
                <div className="field-grid">
                  <div className="field"><label>Nombre</label><div className="val">{`${selected.nombre_conyuge || ''} ${selected.apellidos_conyuge || ''}`.trim()}</div></div>
                  <div className="field"><label>Móvil</label><div className="val">{selected.movil_conyuge || '—'}</div></div>
                </div>
              </>}
              <div className="field-section">Acciones ({acciones.length})</div>
              {acciones.length === 0 ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Sin acciones</div> : (
                <div className="timeline">
                  {acciones.map(a => (
                    <div className="tl-item" key={a.id}>
                      <div className="tl-dot" style={{ background: a.completada ? 'var(--accent)' : 'var(--border2)' }} />
                      <div className="tl-content">
                        <div className="tl-text">{a.indicaciones || '—'} {a.completada && <span className="badge badge-green" style={{ fontSize: 10 }}>Completada</span>}</div>
                        <div className="tl-meta">{fmtDate(a.fecha)} · {a.tipo_contacto?.tipo_contacto || ''} · {a.responsable?.nombre_responsable || '—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {editModal && <FormModal />}
        </>
      )}

      {modal === 'new' && <FormModal />}
    </div>
  )
}

// ============================================================
// ACCIONES
// ============================================================
export function Acciones({ perfil }) {
  const [rows, setRows] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('inquilino')
  const [filtroEstado, setFiltroEstado] = useState('pendientes')
  const [modal, setModal] = useState(false)
  const [editData, setEditData] = useState(null)
  const [form, setForm] = useState({ ...ACCION_EMPTY, fecha: '' })
  const [entidades, setEntidades] = useState([])
  const [tiposContacto, setTiposContacto] = useState([])
  const [responsables, setResponsables] = useState([])
  const navigate = useNavigate()
  const { sortData, sortIcon, thProps } = useSortable('fecha')
  const readOnly = perfil?.rol === 'visor'

  useEffect(() => { loadAll() }, [])
  useCtrlG(save, modal)

  async function loadAll() {
    setLoading(true)

    // Si es propietario, obtener sus inmueble_ids para filtrar
    let inmuebleIds = null
    if (perfil?.rol === 'propietario' && perfil?.propietario_id) {
      const [{ data: inmsDelProp }, { data: inmsCo }] = await Promise.all([
        supabase.from('inmuebles').select('id').eq('propietario_id', perfil.propietario_id),
        supabase.from('inmueble_propietarios').select('inmueble_id').eq('propietario_id', perfil.propietario_id),
      ])
      inmuebleIds = [...new Set([...(inmsDelProp || []).map(i => i.id), ...(inmsCo || []).map(i => i.inmueble_id)])]
    }

    const buildInmuebleQuery = () => {
      let q = supabase.from('accion_inmueble').select('*, responsable(nombre_responsable), inmuebles(id, codigo, calle), tipo_contacto(tipo_contacto)').order('fecha', { ascending: false })
      if (inmuebleIds !== null) {
        if (inmuebleIds.length === 0) q = q.eq('inmueble_id', -1)
        else q = q.in('inmueble_id', inmuebleIds)
      }
      return q
    }

    const buildInquilinoQuery = () => {
      let q = supabase.from('accion_inquilino').select('*, responsable(nombre_responsable), inquilinos(id, nombre, apellidos, inmuebles(id, codigo)), tipo_contacto(tipo_contacto)').order('fecha', { ascending: false })
      if (inmuebleIds !== null) {
        // filtrar acciones de inquilinos que viven en inmuebles del propietario
        // se hace post-fetch ya que Supabase no permite filtrar por relación anidada
      }
      return q
    }

    const buildPropietarioQuery = () => {
      let q = supabase.from('accion_propietario').select('*, responsable(nombre_responsable), propietarios(id, nombre, apellidos), tipo_contacto(tipo_contacto)').order('fecha', { ascending: false })
      if (perfil?.rol === 'propietario' && perfil?.propietario_id) q = q.eq('propietario_id', perfil.propietario_id)
      return q
    }

    const [{ data: ai }, { data: ainq }, { data: aprop }, { data: ap }, { data: tc }, { data: resps }] = await Promise.all([
      buildInmuebleQuery(),
      buildInquilinoQuery(),
      buildPropietarioQuery(),
      supabase.from('accion_persona_contacto').select('*, responsable(nombre_responsable), persona_contacto(id, nombre, apellidos), tipo_contacto(tipo_contacto)').order('fecha', { ascending: false }),
      supabase.from('tipo_contacto').select('*'),
      supabase.from('responsable').select('*'),
    ])

    // Filtrar acciones de inquilinos post-fetch si es propietario
    let ainqFiltrado = ainq || []
    if (inmuebleIds !== null) {
      ainqFiltrado = ainqFiltrado.filter(a => inmuebleIds.includes(a.inquilinos?.inmuebles?.id))
    }

    setRows({ inmueble: ai || [], inquilino: ainqFiltrado, propietario: aprop || [], contacto: ap || [] })
    setTiposContacto(tc || [])
    setResponsables(resps || [])
    setLoading(false)
  }

  async function openModal(editRow = null) {
    let data = []
    if (tab === 'inquilino') {
      const { data: d } = await supabase.from('inquilinos').select('id, nombre, apellidos').order('nombre')
      data = (d || []).map(r => ({ id: r.id, label: `${r.nombre || ''} ${r.apellidos || ''}`.trim() }))
    } else if (tab === 'inmueble') {
      const { data: d } = await supabase.from('inmuebles').select('id, codigo, calle').order('codigo')
      data = (d || []).map(r => ({ id: r.id, label: `${r.codigo} — ${r.calle || ''}` }))
    } else if (tab === 'propietario') {
      const { data: d } = await supabase.from('propietarios').select('id, nombre, apellidos').order('nombre')
      data = (d || []).map(r => ({ id: r.id, label: `${r.nombre || ''} ${r.apellidos || ''}`.trim() }))
    } else {
      const { data: d } = await supabase.from('persona_contacto').select('id, nombre, apellidos').order('nombre')
      data = (d || []).map(r => ({ id: r.id, label: `${r.nombre || ''} ${r.apellidos || ''}`.trim() }))
    }
    setEntidades(data)
    if (editRow) {
      const fkField = tab === 'inquilino' ? 'inquilino_id' : tab === 'inmueble' ? 'inmueble_id' : tab === 'propietario' ? 'propietario_id' : 'persona_id'
      setEditData(editRow)
      setForm({ ...ACCION_EMPTY, ...editRow, entidad_id: editRow[fkField] || '', fecha: editRow.fecha || '', hora: editRow.hora || '', proxima_fecha: editRow.proxima_fecha || '' })
    } else {
      setEditData(null)
      setForm({ ...ACCION_EMPTY, fecha: new Date().toISOString().split('T')[0] })
    }
    setModal(true)
  }

  async function save() {
    const tabla = tab === 'inquilino' ? 'accion_inquilino' : tab === 'inmueble' ? 'accion_inmueble' : tab === 'propietario' ? 'accion_propietario' : 'accion_persona_contacto'
    const fkField = tab === 'inquilino' ? 'inquilino_id' : tab === 'inmueble' ? 'inmueble_id' : tab === 'propietario' ? 'propietario_id' : 'persona_id'
    const data = {
      [fkField]: form.entidad_id || null,
      tipo_contacto_id: form.tipo_contacto_id || null,
      responsable_id: form.responsable_id || null,
      fecha: form.fecha || null,
      hora: form.hora || null,
      indicaciones: form.indicaciones || null,
      proxima_fecha: form.proxima_fecha || null,
      proxima_accion: form.proxima_accion || null,
      documento: form.documento || null,
    }
    if (editData) {
      await supabase.from(tabla).update(data).eq('id', editData.id)
    } else {
      await supabase.from(tabla).insert({ ...data, completada: false })
    }
    setModal(false); loadAll()
  }

  async function completar(tabla, id) {
    const t = tabla === 'inquilino' ? 'accion_inquilino' : tabla === 'inmueble' ? 'accion_inmueble' : tabla === 'propietario' ? 'accion_propietario' : 'accion_persona_contacto'
    await supabase.from(t).update({ completada: true }).eq('id', id)
    loadAll()
  }

  const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES') : '—'
  const f = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }))

  function current() {
    let data = (rows[tab] || []).filter(r => {
      const entidad = tab === 'inmueble' ? r.inmuebles?.codigo : tab === 'inquilino' ? `${r.inquilinos?.nombre || ''} ${r.inquilinos?.apellidos || ''}` : tab === 'propietario' ? `${r.propietarios?.nombre || ''} ${r.propietarios?.apellidos || ''}` : `${r.persona_contacto?.nombre || ''} ${r.persona_contacto?.apellidos || ''}`
      const matchSearch_ = ms([entidad, r.indicaciones, r.proxima_accion], search)
      const matchEstado = filtroEstado === 'todas' ? true : filtroEstado === 'pendientes' ? !r.completada : !!r.completada
      return matchSearch_ && matchEstado
    })
    return sortData(data, (r, col) => {
      if (col === 'fecha') return r.fecha
      if (col === 'proxima_fecha') return r.proxima_fecha
      if (col === 'responsable') return r.responsable?.nombre_responsable
      if (col === 'tipo') return r.tipo_contacto?.tipo_contacto
      if (col === 'entidad') return tab === 'inmueble' ? r.inmuebles?.codigo : tab === 'inquilino' ? r.inquilinos?.nombre : tab === 'propietario' ? r.propietarios?.nombre : r.persona_contacto?.nombre
      return r[col]
    })
  }

  const hoy = new Date(); hoy.setHours(0,0,0,0)
  const accionBadge = d => {
    if (!d) return 'badge-gray'
    const f = new Date(d); f.setHours(0,0,0,0)
    if (f < hoy) return 'badge-red'
    if (f.getTime() === hoy.getTime()) return 'badge-yellow'
    return 'badge-green'
  }

  const tabLabel = { inquilino: 'Inquilino', inmueble: 'Inmueble', propietario: 'Propietario', contacto: 'Contacto' }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['inquilino', 'Inquilinos'], ['inmueble', 'Inmuebles'], ['propietario', 'Propietarios'], ['contacto', 'Contactos']].map(([k, l]) => (
          <button key={k} className={`btn ${tab === k ? 'btn-primary' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {[['pendientes','Pendientes'],['completadas','Completadas'],['todas','Todas']].map(([v,l]) => (
            <button key={v} className={`btn btn-sm ${filtroEstado === v ? 'btn-primary' : ''}`} onClick={() => setFiltroEstado(v)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <h2>Acciones — {tab === 'inquilino' ? 'Inquilinos' : tab === 'inmueble' ? 'Inmuebles' : tab === 'propietario' ? 'Propietarios' : 'Contactos'} <span className="badge badge-gray" style={{ marginLeft: 6 }}>{current().length}</span></h2>
          <div className="search-input"><i className="ti ti-search" /><input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          {!readOnly && <button className="btn btn-primary btn-sm" onClick={() => openModal()}><i className="ti ti-plus" /> Nueva acción</button>}
        </div>
        <div className="table-wrap">
          {loading ? <div className="loading"><i className="ti ti-loader ti-spin" /> Cargando...</div> : (
            <table>
              <thead><tr>
                <th {...thProps('fecha')}>Fecha <span style={{fontSize:10}}>{sortIcon('fecha')}</span></th>
                <th>Hora</th>
                <th {...thProps('entidad')}>{tabLabel[tab]} <span style={{fontSize:10}}>{sortIcon('entidad')}</span></th>
                {tab === 'inquilino' && <th>Inmueble</th>}
                <th {...thProps('tipo')}>Tipo <span style={{fontSize:10}}>{sortIcon('tipo')}</span></th>
                <th>Indicaciones</th>
                <th {...thProps('proxima_fecha')}>Próx. fecha <span style={{fontSize:10}}>{sortIcon('proxima_fecha')}</span></th>
                <th>Próx. acción</th>
                <th {...thProps('responsable')}>Responsable <span style={{fontSize:10}}>{sortIcon('responsable')}</span></th>
                <th></th>
              </tr></thead>
              <tbody>
                {current().length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>Sin acciones</td></tr>}
                {current().map(r => {
                  const entidad = tab === 'inmueble' ? r.inmuebles : tab === 'inquilino' ? r.inquilinos : tab === 'propietario' ? r.propietarios : r.persona_contacto
                  const entidadNombre = tab === 'inmueble' ? r.inmuebles?.codigo : tab === 'inquilino' ? `${r.inquilinos?.nombre || ''} ${r.inquilinos?.apellidos || ''}`.trim() : tab === 'propietario' ? `${r.propietarios?.nombre || ''} ${r.propietarios?.apellidos || ''}`.trim() : `${r.persona_contacto?.nombre || ''} ${r.persona_contacto?.apellidos || ''}`.trim()
                  const codigoInm = tab === 'inquilino' ? r.inquilinos?.inmuebles?.codigo : null

                  return (
                    <tr key={r.id} style={{ opacity: r.completada ? 0.6 : 1 }}>
                      <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{fmtDate(r.fecha)}</span></td>
                      <td style={{ fontSize: 12 }}>{r.hora ? r.hora.slice(0,5) : '—'}</td>
                      <td>
                        <span
                          style={{ fontWeight: 500, cursor: entidad?.id ? 'pointer' : 'default', color: entidad?.id ? 'var(--info-text)' : 'inherit' }}
                          onClick={() => entidad?.id && navigate(`/${tab === 'inmueble' ? 'inmuebles' : tab === 'inquilino' ? 'inquilinos' : tab === 'propietario' ? 'propietarios' : 'contactos'}`)}
                        >{entidadNombre || '—'}</span>
                      </td>
                      {tab === 'inquilino' && <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{codigoInm || '—'}</span></td>}
                      <td>{r.tipo_contacto?.tipo_contacto ? <span className="badge badge-blue">{r.tipo_contacto.tipo_contacto}</span> : '—'}</td>
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text2)', fontSize: 12 }}>{r.indicaciones || '—'}</td>
                      <td>{r.proxima_fecha ? <span className={`badge ${accionBadge(r.proxima_fecha)}`}>{fmtDate(r.proxima_fecha)}</span> : '—'}</td>
                      <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{r.proxima_accion || '—'}</td>
                      <td style={{ fontSize: 12 }}>{r.responsable?.nombre_responsable || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {!readOnly && <button className="btn btn-ghost btn-sm" title="Editar" onClick={() => openModal(r)}><i className="ti ti-edit" /></button>}
                        {!readOnly && !r.completada && (
                          <button className="btn btn-ghost btn-sm" title="Marcar completada" onClick={() => completar(tab, r.id)}>
                            <i className="ti ti-check" style={{ color: 'var(--accent)' }} />
                          </button>
                        )}
                        {r.completada && <span className="badge badge-green" style={{ fontSize: 10 }}>✓</span>}
                        {r.documento && <a href={r.documento} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"><i className="ti ti-paperclip" /></a>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>{editData ? 'Editar acción' : `Nueva acción — ${tabLabel[tab]}`}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group form-full">
                  <label>{tabLabel[tab]}</label>
                  <select value={form.entidad_id ?? ''} onChange={f('entidad_id')}>
                    <option value="">— Selecciona —</option>
                    {entidades.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Fecha *</label><input type="date" value={form.fecha ?? ''} onChange={f('fecha')} /></div>
                <div className="form-group"><label>Hora</label><input type="time" value={form.hora ?? ''} onChange={f('hora')} /></div>
                <div className="form-group"><label>Tipo de contacto</label>
                  <select value={form.tipo_contacto_id ?? ''} onChange={f('tipo_contacto_id')}>
                    <option value="">—</option>
                    {tiposContacto.map(t => <option key={t.id} value={t.id}>{t.tipo_contacto}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Responsable</label>
                  <select value={form.responsable_id ?? ''} onChange={f('responsable_id')}>
                    <option value="">—</option>
                    {responsables.map(r => <option key={r.id} value={r.id}>{r.nombre_responsable}</option>)}
                  </select>
                </div>
                <div className="form-group form-full"><label>Indicaciones / Notas</label><textarea value={form.indicaciones ?? ''} onChange={f('indicaciones')} rows={3} /></div>
                <div className="form-group"><label>Próxima fecha</label><input type="date" value={form.proxima_fecha ?? ''} onChange={f('proxima_fecha')} /></div>
                <div className="form-group"><label>Próxima acción</label><input value={form.proxima_accion ?? ''} onChange={f('proxima_accion')} /></div>
                <div className="form-group form-full"><label>Documento (URL)</label><input value={form.documento ?? ''} onChange={f('documento')} placeholder="https://..." /></div>
              </div>
              <div className="form-actions">
                <button className="btn" onClick={() => setModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={save}>Guardar acción</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// COMERCIALIZANDO
// ============================================================
export function Comercializando() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const { sortData, sortIcon, thProps } = useSortable('descripcion')

  useEffect(() => {
    supabase.from('inmuebles_comercializando')
      .select('*, seguro(compania), inmuebles(codigo, propietarios!inmuebles_propietario_id_fkey(nombre, apellidos))')
      .order('descripcion')
      .then(({ data }) => { setRows(data || []); setLoading(false) })
  }, [])

  function filtered() {
    let data = rows.filter(r => ms([r.descripcion, r.calle, r.poblacion, r.propietario], search))
    return sortData(data, (r, col) => {
      if (col === 'seguro') return r.seguro?.compania
      return r[col]
    })
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>Inmuebles en comercialización <span className="badge badge-gray" style={{ marginLeft: 6 }}>{filtered().length}</span></h2>
        <div className="search-input"><i className="ti ti-search" /><input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      </div>
      <div className="table-wrap">
        {loading ? <div className="loading"><i className="ti ti-loader ti-spin" /> Cargando...</div> : (
          <table>
            <thead><tr>
              <th {...thProps('descripcion')}>Código <span style={{fontSize:10}}>{sortIcon('descripcion')}</span></th>
              <th {...thProps('calle')}>Calle <span style={{fontSize:10}}>{sortIcon('calle')}</span></th>
              <th {...thProps('piso')}>Piso <span style={{fontSize:10}}>{sortIcon('piso')}</span></th>
              <th {...thProps('poblacion')}>Población <span style={{fontSize:10}}>{sortIcon('poblacion')}</span></th>
              <th {...thProps('propietario')}>Propietario <span style={{fontSize:10}}>{sortIcon('propietario')}</span></th>
              <th {...thProps('seguro')}>Seguro <span style={{fontSize:10}}>{sortIcon('seguro')}</span></th>
            </tr></thead>
            <tbody>
              {filtered().map(r => (
                <tr key={r.id}>
                  <td><strong style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.descripcion || '—'}</strong></td>
                  <td>{r.calle || '—'}</td>
                  <td>{r.piso || '—'}</td>
                  <td>{r.poblacion || '—'}</td>
                  <td>{r.propietario || '—'}</td>
                  <td>{r.seguro?.compania || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

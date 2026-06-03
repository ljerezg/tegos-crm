import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const EMPTY = { nombre: '', apellidos: '', dni_cif: '', telefono: '', movil: '', email: '', calle: '', municipio: '', cod_postal: '', observaciones: '', tipo_id: '', responsable_id: '', conocimiento_id: '', clasificacion_id: '', referenciado_por: '', empresa_tasacion: '', edad_estimada: '', estado_civil: '', nombre_conyuge: '', apellidos_conyuge: '', movil_conyuge: '', email_conyuge: '' }

export function Contactos() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [acciones, setAcciones] = useState([])
  const [clasificaciones, setClasificaciones] = useState([])
  const [conocimientos, setConocimientos] = useState([])
  const [responsables, setResponsables] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data }, { data: clas }, { data: conoc }, { data: resps }] = await Promise.all([
      supabase.from('persona_contacto').select('*, clasificacion_contacto(clasificacion), responsable(nombre_responsable), conocimiento(origen)').order('nombre'),
      supabase.from('clasificacion_contacto').select('*'),
      supabase.from('conocimiento').select('*').order('origen'),
      supabase.from('responsable').select('*'),
    ])
    setRows(data || [])
    setClasificaciones(clas || [])
    setConocimientos(conoc || [])
    setResponsables(resps || [])
    setLoading(false)
  }

  async function selectRow(row) {
    setSelected(row)
    const { data } = await supabase.from('accion_persona_contacto').select('*, responsable(nombre_responsable)').eq('persona_id', row.id).order('fecha', { ascending: false }).limit(8)
    setAcciones(data || [])
  }

  async function save() {
    const data = { ...form }
    Object.keys(data).forEach(k => { if (data[k] === '') data[k] = null })
    if (modal === 'new') await supabase.from('persona_contacto').insert(data)
    else await supabase.from('persona_contacto').update(data).eq('id', form.id)
    setModal(null); load()
  }

  async function del(id) {
    if (!confirm('¿Eliminar este contacto?')) return
    await supabase.from('persona_contacto').delete().eq('id', id)
    setSelected(null); load()
  }

  const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES') : '—'
  const nombre = r => `${r.nombre || ''} ${r.apellidos || ''}`.trim() || '—'
  const initials = r => nombre(r).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const filtered = rows.filter(r => [r.nombre, r.apellidos, r.email, r.movil].join(' ').toLowerCase().includes(search.toLowerCase()))
  const f = key => e => setForm({ ...form, [key]: e.target.value })
  const clsBadge = cl => ({ 'Propietario': 'badge-blue', 'Cliente potencial': 'badge-yellow', 'Proveedor': 'badge-gray', 'Administrador Finca': 'badge-green' })[cl] || 'badge-gray'

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>Contactos <span className="badge badge-gray" style={{ marginLeft: 6 }}>{filtered.length}</span></h2>
          <div className="search-input"><i className="ti ti-search" /><input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <button className="btn btn-primary btn-sm" onClick={() => { setForm(EMPTY); setModal('new') }}><i className="ti ti-plus" /> Nuevo</button>
        </div>
        <div className="table-wrap">
          {loading ? <div className="loading"><i className="ti ti-loader ti-spin" /> Cargando...</div> : (
            <table>
              <thead><tr><th>Nombre</th><th>Clasificación</th><th>Origen</th><th>Móvil</th><th>Responsable</th></tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} onClick={() => selectRow(r)}>
                    <td><strong>{nombre(r)}</strong></td>
                    <td>{r.clasificacion_contacto ? <span className={`badge ${clsBadge(r.clasificacion_contacto.clasificacion)}`}>{r.clasificacion_contacto.clasificacion}</span> : '—'}</td>
                    <td>{r.conocimiento?.origen || '—'}</td>
                    <td>{r.movil || '—'}</td>
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
          <div className="detail-overlay" onClick={() => setSelected(null)} />
          <div className="detail-panel">
            <div className="panel-header">
              <div className="panel-avatar av-gray">{initials(selected)}</div>
              <div style={{ flex: 1 }}>
                <h3>{nombre(selected)}</h3>
                <div className="panel-sub">{selected.clasificacion_contacto?.clasificacion || ''}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ ...selected }); setModal('edit') }}><i className="ti ti-edit" /></button>
              <button className="btn btn-ghost btn-sm" onClick={() => del(selected.id)}><i className="ti ti-trash" style={{ color: 'var(--danger-text)' }} /></button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="panel-body">
              <div className="field-section">Datos de contacto</div>
              <div className="field-grid">
                <div className="field"><label>Teléfono</label><div className="val">{selected.telefono || '—'}</div></div>
                <div className="field"><label>Móvil</label><div className="val">{selected.movil || '—'}</div></div>
                <div className="field field-full"><label>Email</label><div className="val">{selected.email || '—'}</div></div>
                <div className="field field-full"><label>Dirección</label><div className="val">{[selected.calle, selected.municipio].filter(Boolean).join(', ') || '—'}</div></div>
              </div>
              <div className="field-section">CRM</div>
              <div className="field-grid">
                <div className="field"><label>Responsable</label><div className="val">{selected.responsable?.nombre_responsable || '—'}</div></div>
                <div className="field"><label>Origen</label><div className="val">{selected.conocimiento?.origen || '—'}</div></div>
                <div className="field"><label>Referenciado por</label><div className="val">{selected.referenciado_por || '—'}</div></div>
                <div className="field"><label>Edad estimada</label><div className="val">{selected.edad_estimada || '—'}</div></div>
              </div>
              {selected.nombre_conyuge && <>
                <div className="field-section">Cónyuge</div>
                <div className="field-grid">
                  <div className="field"><label>Nombre</label><div className="val">{`${selected.nombre_conyuge || ''} ${selected.apellidos_conyuge || ''}`.trim()}</div></div>
                  <div className="field"><label>Móvil</label><div className="val">{selected.movil_conyuge || '—'}</div></div>
                </div>
              </>}
              <div className="field-section">Acciones recientes</div>
              {acciones.length === 0 ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Sin acciones registradas</div> : (
                <div className="timeline">
                  {acciones.map(a => (
                    <div className="tl-item" key={a.id}>
                      <div className="tl-dot" />
                      <div className="tl-content">
                        <div className="tl-text">{a.indicaciones || '—'}</div>
                        <div className="tl-meta">{fmtDate(a.fecha)} · {a.responsable?.nombre_responsable || '—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2>{modal === 'new' ? 'Nuevo contacto' : 'Editar contacto'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group"><label>Nombre</label><input value={form.nombre || ''} onChange={f('nombre')} /></div>
                <div className="form-group"><label>Apellidos</label><input value={form.apellidos || ''} onChange={f('apellidos')} /></div>
                <div className="form-group"><label>Clasificación</label>
                  <select value={form.clasificacion_id || ''} onChange={f('clasificacion_id')}>
                    <option value="">—</option>
                    {clasificaciones.map(c => <option key={c.id} value={c.id}>{c.clasificacion}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Responsable</label>
                  <select value={form.responsable_id || ''} onChange={f('responsable_id')}>
                    <option value="">—</option>
                    {responsables.map(r => <option key={r.id} value={r.id}>{r.nombre_responsable}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Móvil</label><input value={form.movil || ''} onChange={f('movil')} /></div>
                <div className="form-group"><label>Email</label><input value={form.email || ''} onChange={f('email')} /></div>
                <div className="form-group form-full"><label>Dirección</label><input value={form.calle || ''} onChange={f('calle')} /></div>
                <div className="form-group"><label>Origen conocimiento</label>
                  <select value={form.conocimiento_id || ''} onChange={f('conocimiento_id')}>
                    <option value="">—</option>
                    {conocimientos.map(c => <option key={c.id} value={c.id}>{c.origen}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Referenciado por</label><input value={form.referenciado_por || ''} onChange={f('referenciado_por')} /></div>
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

const ACCION_EMPTY = { fecha: '', hora: '', tipo_contacto_id: '', responsable_id: '', indicaciones: '', proxima_fecha: '', proxima_accion: '', entidad_id: '', documento: '' }

export function Acciones() {
  const [rows, setRows] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('inquilino')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(ACCION_EMPTY)
  const [entidades, setEntidades] = useState([])
  const [tiposContacto, setTiposContacto] = useState([])
  const [responsables, setResponsables] = useState([])

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: ai }, { data: ainq }, { data: ap }, { data: tc }, { data: resps }] = await Promise.all([
      supabase.from('accion_inmueble').select('*, responsable(nombre_responsable), inmuebles(codigo, calle), tipo_contacto(tipo_contacto)').eq('completada', false).order('fecha', { ascending: false }),
      supabase.from('accion_inquilino').select('*, responsable(nombre_responsable), inquilinos(nombre, apellidos), tipo_contacto(tipo_contacto)').eq('completada', false).order('fecha', { ascending: false }),
      supabase.from('accion_persona_contacto').select('*, responsable(nombre_responsable), persona_contacto(nombre, apellidos), tipo_contacto(tipo_contacto)').eq('completada', false).order('fecha', { ascending: false }),
      supabase.from('tipo_contacto').select('*'),
      supabase.from('responsable').select('*'),
    ])
    setRows({ inmueble: ai || [], inquilino: ainq || [], contacto: ap || [] })
    setTiposContacto(tc || [])
    setResponsables(resps || [])
    setLoading(false)
  }

  async function openModal() {
    let data = []
    if (tab === 'inquilino') {
      const { data: d } = await supabase.from('inquilinos').select('id, nombre, apellidos').order('nombre')
      data = (d || []).map(r => ({ id: r.id, label: `${r.nombre || ''} ${r.apellidos || ''}`.trim() }))
    } else if (tab === 'inmueble') {
      const { data: d } = await supabase.from('inmuebles').select('id, codigo, calle').order('codigo')
      data = (d || []).map(r => ({ id: r.id, label: `${r.codigo} — ${r.calle || ''}` }))
    } else {
      const { data: d } = await supabase.from('persona_contacto').select('id, nombre, apellidos').order('nombre')
      data = (d || []).map(r => ({ id: r.id, label: `${r.nombre || ''} ${r.apellidos || ''}`.trim() }))
    }
    setEntidades(data)
    setForm({ ...ACCION_EMPTY, fecha: new Date().toISOString().split('T')[0] })
    setModal(true)
  }

  async function save() {
    const tabla = tab === 'inquilino' ? 'accion_inquilino' : tab === 'inmueble' ? 'accion_inmueble' : 'accion_persona_contacto'
    const fkField = tab === 'inquilino' ? 'inquilino_id' : tab === 'inmueble' ? 'inmueble_id' : 'persona_id'
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
      completada: false,
    }
    await supabase.from(tabla).insert(data)
    setModal(false)
    loadAll()
  }

  async function completar(tabla, id) {
    const t = tabla === 'inquilino' ? 'accion_inquilino' : tabla === 'inmueble' ? 'accion_inmueble' : 'accion_persona_contacto'
    await supabase.from(t).update({ completada: true }).eq('id', id)
    loadAll()
  }

  const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES') : '—'
  const current = (rows[tab] || []).filter(r => {
    const entidad = tab === 'inmueble' ? r.inmuebles?.codigo : tab === 'inquilino' ? `${r.inquilinos?.nombre || ''} ${r.inquilinos?.apellidos || ''}` : `${r.persona_contacto?.nombre || ''} ${r.persona_contacto?.apellidos || ''}`
    return [entidad, r.indicaciones].join(' ').toLowerCase().includes(search.toLowerCase())
  })
  const f = key => e => setForm({ ...form, [key]: e.target.value })

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['inquilino', 'Inquilinos'], ['inmueble', 'Inmuebles'], ['contacto', 'Contactos']].map(([k, l]) => (
          <button key={k} className={`btn ${tab === k ? 'btn-primary' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <div className="card">
        <div className="card-header">
          <h2>Acciones pendientes <span className="badge badge-gray" style={{ marginLeft: 6 }}>{current.length}</span></h2>
          <div className="search-input"><i className="ti ti-search" /><input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <button className="btn btn-primary btn-sm" onClick={openModal}><i className="ti ti-plus" /> Nueva acción</button>
        </div>
        <div className="table-wrap">
          {loading ? <div className="loading"><i className="ti ti-loader ti-spin" /> Cargando...</div> : (
            <table>
              <thead><tr><th>Fecha</th><th>Hora</th><th>Entidad</th><th>Tipo</th><th>Indicaciones</th><th>Próx. fecha</th><th>Próx. acción</th><th>Responsable</th><th></th></tr></thead>
              <tbody>
                {current.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>Sin acciones pendientes</td></tr>}
                {current.map(r => {
                  const entidad = tab === 'inmueble' ? (r.inmuebles ? `${r.inmuebles.codigo}` : '—') : tab === 'inquilino' ? `${r.inquilinos?.nombre || ''} ${r.inquilinos?.apellidos || ''}`.trim() || '—' : `${r.persona_contacto?.nombre || ''} ${r.persona_contacto?.apellidos || ''}`.trim() || '—'
                  return (
                    <tr key={r.id}>
                      <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{fmtDate(r.fecha)}</span></td>
                      <td style={{ fontSize: 12 }}>{r.hora || '—'}</td>
                      <td><strong>{entidad}</strong></td>
                      <td>{r.tipo_contacto?.tipo_contacto ? <span className="badge badge-blue">{r.tipo_contacto.tipo_contacto}</span> : '—'}</td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text2)' }}>{r.indicaciones || '—'}</td>
                      <td>{r.proxima_fecha ? <span className="badge badge-yellow">{fmtDate(r.proxima_fecha)}</span> : '—'}</td>
                      <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{r.proxima_accion || '—'}</td>
                      <td>{r.responsable?.nombre_responsable || '—'}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" title="Marcar completada" onClick={() => completar(tab, r.id)}>
                          <i className="ti ti-check" style={{ color: 'var(--accent)' }} />
                        </button>
                        {r.documento && <a href={r.documento} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" title="Ver documento"><i className="ti ti-paperclip" /></a>}
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
              <h2>Nueva acción — {tab === 'inquilino' ? 'Inquilino' : tab === 'inmueble' ? 'Inmueble' : 'Contacto'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group form-full">
                  <label>{tab === 'inquilino' ? 'Inquilino' : tab === 'inmueble' ? 'Inmueble' : 'Contacto'}</label>
                  <select value={form.entidad_id || ''} onChange={f('entidad_id')}>
                    <option value="">— Selecciona —</option>
                    {entidades.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Fecha *</label><input type="date" value={form.fecha || ''} onChange={f('fecha')} /></div>
                <div className="form-group"><label>Hora</label><input type="time" value={form.hora || ''} onChange={f('hora')} /></div>
                <div className="form-group"><label>Tipo de contacto</label>
                  <select value={form.tipo_contacto_id || ''} onChange={f('tipo_contacto_id')}>
                    <option value="">—</option>
                    {tiposContacto.map(t => <option key={t.id} value={t.id}>{t.tipo_contacto}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Responsable</label>
                  <select value={form.responsable_id || ''} onChange={f('responsable_id')}>
                    <option value="">—</option>
                    {responsables.map(r => <option key={r.id} value={r.id}>{r.nombre_responsable}</option>)}
                  </select>
                </div>
                <div className="form-group form-full"><label>Indicaciones / Notas</label><textarea value={form.indicaciones || ''} onChange={f('indicaciones')} rows={3} /></div>
                <div className="form-group"><label>Próxima fecha</label><input type="date" value={form.proxima_fecha || ''} onChange={f('proxima_fecha')} /></div>
                <div className="form-group"><label>Próxima acción</label><input value={form.proxima_accion || ''} onChange={f('proxima_accion')} placeholder="Qué hacer..." /></div>
                <div className="form-group form-full"><label>Documento (URL)</label><input value={form.documento || ''} onChange={f('documento')} placeholder="https://dropbox.com/..." /></div>
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


export function Comercializando() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.from('inmuebles_comercializando').select('*').order('descripcion').then(({ data }) => { setRows(data || []); setLoading(false) })
  }, [])

  const filtered = rows.filter(r => [r.descripcion, r.calle, r.poblacion].join(' ').toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="card">
      <div className="card-header">
        <h2>Inmuebles en comercialización <span className="badge badge-gray" style={{ marginLeft: 6 }}>{filtered.length}</span></h2>
        <div className="search-input"><i className="ti ti-search" /><input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      </div>
      <div className="table-wrap">
        {loading ? <div className="loading"><i className="ti ti-loader ti-spin" /> Cargando...</div> : (
          <table>
            <thead><tr><th>Código</th><th>Calle</th><th>Piso</th><th>Población</th><th>Propietario</th><th>Seguro</th></tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td><strong style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.descripcion || '—'}</strong></td>
                  <td>{r.calle || '—'}</td>
                  <td>{r.piso || '—'}</td>
                  <td>{r.poblacion || '—'}</td>
                  <td>{r.propietario || '—'}</td>
                  <td>{r.cia_seguro || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}


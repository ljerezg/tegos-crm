import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const EMPTY = { nombre: '', apellidos: '', dni_cif: '', tipo_id: '', responsable_id: '', telefono: '', movil: '', email: '', email_2: '', calle: '', numero: '', piso: '', municipio: '', provincia: '', cod_postal: '', observaciones: '', nombre_conyuge: '', apellidos_conyuge: '', dni_conyuge: '', movil_conyuge: '', email_conyuge: '', otra_persona_contacto: '', movil_otra_persona: '', email_otra_persona: '', relacion_otra_persona: '', prop_final: '' }

export default function Propietarios() {
  const [rows, setRows] = useState([])
  const [tipos, setTipos] = useState([])
  const [responsables, setResponsables] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [inmuebles, setInmuebles] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: props }, { data: tipos }, { data: resps }] = await Promise.all([
      supabase.from('propietarios').select('*, tipo_persona(tipo), responsable(nombre_responsable)').order('nombre'),
      supabase.from('tipo_persona').select('*'),
      supabase.from('responsable').select('*'),
    ])
    setRows(props || [])
    setTipos(tipos || [])
    setResponsables(resps || [])
    setLoading(false)
  }

  async function selectRow(row) {
    setSelected(row)
    const { data } = await supabase.from('inmuebles').select('id, codigo, calle, piso').eq('propietario_id', row.id)
    setInmuebles(data || [])
  }

  async function save() {
    const data = { ...form }
    Object.keys(data).forEach(k => { if (data[k] === '') data[k] = null })
    if (modal === 'new') await supabase.from('propietarios').insert(data)
    else await supabase.from('propietarios').update(data).eq('id', form.id)
    setModal(null); load()
  }

  async function del(id) {
    if (!confirm('¿Eliminar este propietario?')) return
    await supabase.from('propietarios').delete().eq('id', id)
    setSelected(null); load()
  }

  const filtered = rows.filter(r => [r.nombre, r.apellidos, r.email, r.movil, r.dni_cif].join(' ').toLowerCase().includes(search.toLowerCase()))
  const nombre = r => `${r.nombre || ''} ${r.apellidos || ''}`.trim() || '—'
  const initials = r => nombre(r).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const f = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>Propietarios <span className="badge badge-gray" style={{ marginLeft: 6 }}>{filtered.length}</span></h2>
          <div className="search-input">
            <i className="ti ti-search" />
            <input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setForm(EMPTY); setModal('new') }}>
            <i className="ti ti-plus" /> Nuevo
          </button>
        </div>
        <div className="table-wrap">
          {loading ? <div className="loading"><i className="ti ti-loader ti-spin" /> Cargando...</div> : (
            <table>
              <thead><tr><th>Nombre / Razón social</th><th>Tipo</th><th>Móvil</th><th>Email</th><th>Responsable</th></tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} onClick={() => selectRow(r)}>
                    <td><strong>{nombre(r)}</strong></td>
                    <td><span className="badge badge-gray">{r.tipo_persona?.tipo || '—'}</span></td>
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
          <div className="detail-overlay" onClick={() => setSelected(null)} />
          <div className="detail-panel">
            <div className="panel-header">
              <div className="panel-avatar av-blue">{initials(selected)}</div>
              <div style={{ flex: 1 }}>
                <h3>{nombre(selected)}</h3>
                <div className="panel-sub">{selected.tipo_persona?.tipo || ''}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ ...selected }); setModal('edit') }}><i className="ti ti-edit" /></button>
              <button className="btn btn-ghost btn-sm" onClick={() => del(selected.id)}><i className="ti ti-trash" style={{ color: 'var(--danger-text)' }} /></button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="panel-body">
              <div className="field-section">Datos personales</div>
              <div className="field-grid">
                <div className="field"><label>DNI / CIF</label><div className="val">{selected.dni_cif || '—'}</div></div>
                <div className="field"><label>Responsable</label><div className="val">{selected.responsable?.nombre_responsable || '—'}</div></div>
                <div className="field"><label>Teléfono</label><div className="val">{selected.telefono || '—'}</div></div>
                <div className="field"><label>Móvil</label><div className="val">{selected.movil || '—'}</div></div>
                <div className="field field-full"><label>Email</label><div className="val">{selected.email || '—'}</div></div>
                <div className="field field-full"><label>Dirección</label><div className="val">{[selected.calle, selected.numero, selected.piso, selected.municipio].filter(Boolean).join(', ') || '—'}</div></div>
              </div>

              {(selected.nombre_conyuge || selected.movil_conyuge) && <>
                <div className="field-section">Cónyuge</div>
                <div className="field-grid">
                  <div className="field"><label>Nombre</label><div className="val">{`${selected.nombre_conyuge || ''} ${selected.apellidos_conyuge || ''}`.trim() || '—'}</div></div>
                  <div className="field"><label>Móvil</label><div className="val">{selected.movil_conyuge || '—'}</div></div>
                  <div className="field field-full"><label>Email</label><div className="val">{selected.email_conyuge || '—'}</div></div>
                </div>
              </>}

              <div className="field-section">Inmuebles asignados</div>
              {inmuebles.length === 0 ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Sin inmuebles</div> : (
                inmuebles.map(i => (
                  <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                    <i className="ti ti-building" style={{ color: 'var(--text3)' }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500 }}>{i.codigo}</span>
                    <span style={{ color: 'var(--text2)', fontSize: 13 }}>{i.calle}{i.piso ? `, ${i.piso}` : ''}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2>{modal === 'new' ? 'Nuevo propietario' : 'Editar propietario'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group"><label>Nombre</label><input value={form.nombre || ''} onChange={f('nombre')} /></div>
                <div className="form-group"><label>Apellidos</label><input value={form.apellidos || ''} onChange={f('apellidos')} /></div>
                <div className="form-group"><label>DNI / CIF</label><input value={form.dni_cif || ''} onChange={f('dni_cif')} /></div>
                <div className="form-group"><label>Tipo</label>
                  <select value={form.tipo_id || ''} onChange={f('tipo_id')}>
                    <option value="">—</option>
                    {tipos.map(t => <option key={t.id} value={t.id}>{t.tipo}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Responsable</label>
                  <select value={form.responsable_id || ''} onChange={f('responsable_id')}>
                    <option value="">—</option>
                    {responsables.map(r => <option key={r.id} value={r.id}>{r.nombre_responsable}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Teléfono</label><input value={form.telefono || ''} onChange={f('telefono')} /></div>
                <div className="form-group"><label>Móvil</label><input value={form.movil || ''} onChange={f('movil')} /></div>
                <div className="form-group"><label>Email</label><input value={form.email || ''} onChange={f('email')} /></div>
                <div className="form-group form-full"><label>Dirección</label><input value={form.calle || ''} onChange={f('calle')} placeholder="Calle" /></div>
                <div className="form-group"><label>Número</label><input value={form.numero || ''} onChange={f('numero')} /></div>
                <div className="form-group"><label>Piso</label><input value={form.piso || ''} onChange={f('piso')} /></div>
                <div className="form-group"><label>Municipio</label><input value={form.municipio || ''} onChange={f('municipio')} /></div>
                <div className="form-group"><label>Provincia</label><input value={form.provincia || ''} onChange={f('provincia')} /></div>
                <div className="form-section-title">Cónyuge</div>
                <div className="form-group"><label>Nombre cónyuge</label><input value={form.nombre_conyuge || ''} onChange={f('nombre_conyuge')} /></div>
                <div className="form-group"><label>Apellidos cónyuge</label><input value={form.apellidos_conyuge || ''} onChange={f('apellidos_conyuge')} /></div>
                <div className="form-group"><label>Móvil cónyuge</label><input value={form.movil_conyuge || ''} onChange={f('movil_conyuge')} /></div>
                <div className="form-group"><label>Email cónyuge</label><input value={form.email_conyuge || ''} onChange={f('email_conyuge')} /></div>
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

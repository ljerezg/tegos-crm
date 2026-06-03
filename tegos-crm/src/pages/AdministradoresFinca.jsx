import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const EMPTY = { nombre: '', calle: '', numero: '', piso: '', municipio: '', provincia: '', cod_postal: '', telefono: '', movil: '', email: '', email_2: '', observaciones: '' }

export default function AdministradoresFinca() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [contactos, setContactos] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('administrador_finca').select('*').order('nombre')
    setRows(data || [])
    setLoading(false)
  }

  async function selectRow(row) {
    setSelected(row)
    const { data } = await supabase.from('persona_contacto').select('id, nombre, apellidos, movil, email').eq('administrador_finca_id', row.id)
    setContactos(data || [])
  }

  async function save() {
    const data = { ...form }
    Object.keys(data).forEach(k => { if (data[k] === '') data[k] = null })
    if (!data.nombre) return alert('El nombre es obligatorio')
    if (modal === 'new') await supabase.from('administrador_finca').insert(data)
    else await supabase.from('administrador_finca').update(data).eq('id', form.id)
    setModal(null); load()
  }

  async function del(id) {
    if (!confirm('¿Eliminar este administrador?')) return
    await supabase.from('administrador_finca').delete().eq('id', id)
    setSelected(null); load()
  }

  const filtered = rows.filter(r => [r.nombre, r.email, r.telefono, r.municipio].join(' ').toLowerCase().includes(search.toLowerCase()))
  const f = key => e => setForm({ ...form, [key]: e.target.value })
  const initials = r => (r.nombre || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>Administradores de fincas <span className="badge badge-gray" style={{ marginLeft: 6 }}>{filtered.length}</span></h2>
          <div className="search-input"><i className="ti ti-search" /><input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <button className="btn btn-primary btn-sm" onClick={() => { setForm(EMPTY); setModal('new') }}><i className="ti ti-plus" /> Nuevo</button>
        </div>
        <div className="table-wrap">
          {loading ? <div className="loading"><i className="ti ti-loader ti-spin" /> Cargando...</div> : (
            <table>
              <thead><tr><th>Nombre / Razón social</th><th>Municipio</th><th>Teléfono</th><th>Email</th></tr></thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>Sin administradores</td></tr>}
                {filtered.map(r => (
                  <tr key={r.id} onClick={() => selectRow(r)}>
                    <td><strong>{r.nombre}</strong></td>
                    <td>{r.municipio || '—'}</td>
                    <td>{r.telefono || r.movil || '—'}</td>
                    <td style={{ color: 'var(--info-text)' }}>{r.email || '—'}</td>
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
              <div style={{ flex: 1 }}><h3>{selected.nombre}</h3><div className="panel-sub">{selected.municipio || ''}</div></div>
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
                <div className="field field-full"><label>Dirección</label><div className="val">{[selected.calle, selected.numero, selected.piso, selected.municipio, selected.cod_postal].filter(Boolean).join(', ') || '—'}</div></div>
              </div>
              {selected.observaciones && <>
                <div className="field-section">Observaciones</div>
                <div className="field field-full"><div className="val">{selected.observaciones}</div></div>
              </>}
              <div className="field-section">Personas de contacto</div>
              {contactos.length === 0 ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Sin contactos asociados</div> : (
                contactos.map(c => (
                  <div key={c.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <i className="ti ti-user" style={{ color: 'var(--text3)', marginTop: 2 }} />
                    <div>
                      <div style={{ fontWeight: 500 }}>{`${c.nombre || ''} ${c.apellidos || ''}`.trim()}</div>
                      <div style={{ color: 'var(--text3)', fontSize: 12 }}>{[c.movil, c.email].filter(Boolean).join(' · ')}</div>
                    </div>
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
              <h2>{modal === 'new' ? 'Nuevo administrador' : 'Editar administrador'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group form-full"><label>Nombre / Razón social *</label><input value={form.nombre || ''} onChange={f('nombre')} /></div>
                <div className="form-group"><label>Teléfono</label><input value={form.telefono || ''} onChange={f('telefono')} /></div>
                <div className="form-group"><label>Móvil</label><input value={form.movil || ''} onChange={f('movil')} /></div>
                <div className="form-group"><label>Email</label><input value={form.email || ''} onChange={f('email')} /></div>
                <div className="form-group"><label>Email 2</label><input value={form.email_2 || ''} onChange={f('email_2')} /></div>
                <div className="form-section-title">Dirección</div>
                <div className="form-group form-full"><label>Calle</label><input value={form.calle || ''} onChange={f('calle')} /></div>
                <div className="form-group"><label>Número</label><input value={form.numero || ''} onChange={f('numero')} /></div>
                <div className="form-group"><label>Piso</label><input value={form.piso || ''} onChange={f('piso')} /></div>
                <div className="form-group"><label>Municipio</label><input value={form.municipio || ''} onChange={f('municipio')} /></div>
                <div className="form-group"><label>Provincia</label><input value={form.provincia || ''} onChange={f('provincia')} /></div>
                <div className="form-group"><label>Código postal</label><input value={form.cod_postal || ''} onChange={f('cod_postal')} /></div>
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

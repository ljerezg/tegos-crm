import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useCtrlG } from '../lib/useCtrlG'
import { useSortable } from '../components/SortableTable.jsx'
import { useSearchParams } from 'react-router-dom'

const EMPTY = { compania: '', calle: '', numero: '', piso: '', municipio: '', provincia: '', cod_postal: '', telefono: '', movil: '', email: '', email_2: '', observaciones: '', fecha_baja: '' }
const CONTACTO_EMPTY = { nombre: '', apellidos: '', cargo: '', telefono: '', movil: '', email: '', email_2: '', observaciones: '' }

export default function Seguros({ perfil }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [filtro, setFiltro] = useState('vigor')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [contactos, setContactos] = useState([])
  const [tab, setTab] = useState('datos')
  const [contactoForm, setContactoForm] = useState(null)
  const [guardandoContacto, setGuardandoContacto] = useState(false)
  const readOnly = perfil?.rol === 'visor'
  const { sortData, sortIcon, thProps } = useSortable('compania')
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => { load() }, [])
  useEffect(() => { if (modal) { setTab('datos'); setContactoForm(null) } }, [modal])
  useCtrlG(save, !!modal)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('seguro').select('*').order('compania')
    setRows(data || [])
    const sel = searchParams.get('sel')
    if (sel) { const found = (data || []).find(r => String(r.id) === String(sel)); if (found) selectRow(found); setSearchParams({}, { replace: true }) }
    setLoading(false)
  }

  async function loadContactos(seguroId) {
    const { data } = await supabase.from('persona_contacto').select('id, nombre, apellidos, cargo, telefono, movil, email, email_2, observaciones').eq('seguro_id', seguroId).order('nombre')
    setContactos(data || [])
  }

  async function selectRow(row) {
    setSelected(row)
    loadContactos(row.id)
  }

  async function save() {
    const data = { ...form }
    Object.keys(data).forEach(k => { if (data[k] === '') data[k] = null })
    if (!data.compania) return alert('La compañía es obligatoria')
    if (modal === 'new') {
      await supabase.from('seguro').insert(data)
    } else {
      const { id: _id, ...updateData } = data
      const { error } = await supabase.from('seguro').update(updateData).eq('id', form.id)
      if (error) { alert('Error: ' + error.message); return }
    }
    setModal(null); load()
  }

  async function del(id) {
    if (!confirm('¿Eliminar esta aseguradora?')) return
    await supabase.from('seguro').delete().eq('id', id)
    setSelected(null); load()
  }

  function nuevoContacto() { setContactoForm({ ...CONTACTO_EMPTY }) }
  function editarContacto(c) { setContactoForm({ ...c }) }

  async function guardarContacto() {
    if (!contactoForm?.nombre) { alert('El nombre del contacto es obligatorio'); return }
    setGuardandoContacto(true)
    const data = { ...contactoForm, seguro_id: form.id }
    Object.keys(data).forEach(k => { if (data[k] === '') data[k] = null })
    let error
    if (data.id) {
      const { id, ...updateData } = data
      const res = await supabase.from('persona_contacto').update(updateData).eq('id', id)
      error = res.error
    } else {
      const { id: _id, ...insertData } = data
      const res = await supabase.from('persona_contacto').insert(insertData)
      error = res.error
    }
    setGuardandoContacto(false)
    if (error) { alert('Error al guardar el contacto: ' + error.message); return }
    setContactoForm(null)
    loadContactos(form.id)
  }

  async function borrarContacto(id) {
    if (!confirm('¿Eliminar este contacto?')) return
    await supabase.from('persona_contacto').delete().eq('id', id)
    loadContactos(form.id)
  }

  function filtered() {
    const data = rows.filter(r => {
      const q = (search || '').toLowerCase()
      const matchSearch = [r.compania, r.email, r.telefono, r.municipio].join(' ').toLowerCase().includes(q)
      const matchFiltro = filtro === 'todos' ? true : filtro === 'vigor' ? !r.fecha_baja : !!r.fecha_baja
      return matchSearch && matchFiltro
    })
    return sortData(data, (r, col) => {
      if (col === 'telefono') return r.telefono || r.movil || ''
      return r[col]
    })
  }
  const f = key => e => setForm({ ...form, [key]: e.target.value })
  const fC = key => e => setContactoForm(prev => ({ ...prev, [key]: e.target.value }))
  const initials = r => (r.compania || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const contactosTab = (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--text3)' }}>{contactos.length} {contactos.length === 1 ? 'contacto' : 'contactos'}</span>
        {!readOnly && !contactoForm && <button className="btn btn-primary btn-sm" onClick={nuevoContacto}><i className="ti ti-plus" /> Nuevo contacto</button>}
      </div>
      {contactoForm && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 14 }}>
          <div className="form-grid">
            <div className="form-group"><label>Nombre *</label><input value={contactoForm.nombre ?? ''} onChange={fC('nombre')} /></div>
            <div className="form-group"><label>Apellidos</label><input value={contactoForm.apellidos ?? ''} onChange={fC('apellidos')} /></div>
            <div className="form-group"><label>Cargo</label><input value={contactoForm.cargo ?? ''} onChange={fC('cargo')} /></div>
            <div className="form-group"><label>Teléfono</label><input value={contactoForm.telefono ?? ''} onChange={fC('telefono')} /></div>
            <div className="form-group"><label>Móvil</label><input value={contactoForm.movil ?? ''} onChange={fC('movil')} /></div>
            <div className="form-group"><label>Email</label><input value={contactoForm.email ?? ''} onChange={fC('email')} /></div>
            <div className="form-group"><label>Email 2</label><input value={contactoForm.email_2 ?? ''} onChange={fC('email_2')} /></div>
            <div className="form-group form-full"><label>Observaciones</label><textarea value={contactoForm.observaciones ?? ''} onChange={fC('observaciones')} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
            <button className="btn btn-sm" onClick={() => setContactoForm(null)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={guardarContacto} disabled={guardandoContacto}>{guardandoContacto ? <><i className="ti ti-loader ti-spin" /> Guardando...</> : 'Guardar contacto'}</button>
          </div>
        </div>
      )}
      {contactos.length === 0 ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Sin contactos</div> : (
        <table>
          <thead><tr><th>Nombre</th><th>Cargo</th><th>Teléfono</th><th>Móvil</th><th>Email</th>{!readOnly && <th></th>}</tr></thead>
          <tbody>
            {contactos.map(c => (
              <tr key={c.id}>
                <td>{`${c.nombre || ''} ${c.apellidos || ''}`.trim()}</td>
                <td>{c.cargo || '—'}</td>
                <td>{c.telefono || '—'}</td>
                <td>{c.movil || '—'}</td>
                <td style={{ color: 'var(--info-text)' }}>{c.email || '—'}</td>
                {!readOnly && <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-ghost btn-sm" title="Editar" onClick={() => editarContacto(c)}><i className="ti ti-edit" /></button>
                  <button className="btn btn-ghost btn-sm" title="Eliminar" onClick={() => borrarContacto(c.id)}><i className="ti ti-trash" style={{ color: 'var(--danger-text)' }} /></button>
                </td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>Seguros <span className="badge badge-gray" style={{ marginLeft: 6 }}>{filtered().length}</span></h2>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['vigor','En vigor'],['finalizados','Con baja'],['todos','Todos']].map(([v,l]) => (
              <button key={v} className={`btn btn-sm ${filtro === v ? 'btn-primary' : ''}`} onClick={() => setFiltro(v)}>{l}</button>
            ))}
          </div>
          <div className="search-input"><i className="ti ti-search" /><input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          {!readOnly && <button className="btn btn-primary btn-sm" onClick={() => { setForm(EMPTY); setModal('new') }}><i className="ti ti-plus" /> Nuevo</button>}
        </div>
        <div className="table-wrap">
          {loading ? <div className="loading"><i className="ti ti-loader ti-spin" /> Cargando...</div> : (
            <table>
              <thead><tr><th {...thProps('compania')}>Compañía <span style={{fontSize:10}}>{sortIcon('compania')}</span></th><th {...thProps('municipio')}>Municipio <span style={{fontSize:10}}>{sortIcon('municipio')}</span></th><th {...thProps('telefono')}>Teléfono <span style={{fontSize:10}}>{sortIcon('telefono')}</span></th><th {...thProps('email')}>Email <span style={{fontSize:10}}>{sortIcon('email')}</span></th></tr></thead>
              <tbody>
                {filtered().length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>Sin aseguradoras</td></tr>}
                {filtered().map(r => (
                  <tr key={r.id} onClick={() => selectRow(r)} onDoubleClick={() => { selectRow(r); setForm({ ...r, fecha_baja: r.fecha_baja || '' }); setModal('edit') }}>
                    <td><strong>{r.compania}</strong></td>
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
              <div style={{ flex: 1 }}><h3>{selected.compania}</h3><div className="panel-sub">{selected.municipio || ''}</div></div>
              <button className="btn btn-ghost btn-sm" title={readOnly ? 'Ver' : 'Editar'} onClick={() => { setForm({ ...selected }); setModal('edit') }}><i className={readOnly ? 'ti ti-eye' : 'ti ti-edit'} /></button>
              {!readOnly && <button className="btn btn-ghost btn-sm" onClick={() => del(selected.id)}><i className="ti ti-trash" style={{ color: 'var(--danger-text)' }} /></button>}
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
              <div className="field-section">Personas de contacto ({contactos.length})</div>
              {contactos.length === 0 ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Sin contactos asociados</div> : (
                contactos.map(c => (
                  <div key={c.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <i className="ti ti-user" style={{ color: 'var(--text3)', marginTop: 2 }} />
                    <div>
                      <div style={{ fontWeight: 500 }}>{`${c.nombre || ''} ${c.apellidos || ''}`.trim()}{c.cargo ? ` — ${c.cargo}` : ''}</div>
                      <div style={{ color: 'var(--text3)', fontSize: 12 }}>{[c.movil || c.telefono, c.email].filter(Boolean).join(' · ')}</div>
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
          <div className={`modal${readOnly ? ' modal-ro' : ''}`}>
            <div className="modal-header">
              <h2>{modal === 'new' ? 'Nueva aseguradora' : (readOnly ? 'Ver aseguradora' : 'Editar aseguradora')}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              {readOnly && <div className="ro-banner"><i className="ti ti-eye" /> Solo lectura — no puedes modificar estos datos</div>}
              {modal === 'edit' && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                  {[['datos','Datos'],['contactos',`Contactos (${contactos.length})`]].map(([v,l]) => (
                    <button key={v} className={`btn btn-sm ${tab === v ? 'btn-tab-active' : ''}`} onClick={() => setTab(v)}>{l}</button>
                  ))}
                </div>
              )}
              {modal === 'edit' && tab === 'contactos' && contactosTab}
              {(modal === 'new' || tab === 'datos') && <div className="form-grid">
                <div className="form-group form-full"><label>Compañía *</label><input value={form.compania || ''} onChange={f('compania')} /></div>
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
                <div className="form-group"><label>Fecha baja</label><input type="date" value={form.fecha_baja || ''} onChange={f('fecha_baja')} /></div>
                <div className="form-group form-full"><label>Observaciones</label><textarea value={form.observaciones || ''} onChange={f('observaciones')} /></div>
              </div>}
              {(modal === 'new' || tab === 'datos') && <div className="form-actions">
                <button className="btn" onClick={() => setModal(null)}>{readOnly ? 'Cerrar' : 'Cancelar'}</button>
                {!readOnly && <button className="btn btn-primary" onClick={save}>Guardar</button>}
              </div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

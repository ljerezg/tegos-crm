import { useEffect, useState } from 'react'
import { useCtrlG } from '../lib/useCtrlG'
import { supabase } from '../lib/supabase'
import Documentos from '../components/Documentos.jsx'
import { useSortable } from '../components/SortableTable.jsx'

function norm(s) {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}
function ms(fields, q) {
  var n = norm(q)
  if (!n) return true
  return fields.some(function(f) { return norm(f).indexOf(n) !== -1 })
}


const EMPTY = { nombre: '', apellidos: '', dni_cif: '', tipo_id: '', responsable_id: '', telefono: '', movil: '', telefono_2: '', email: '', email_2: '', calle: '', numero: '', piso: '', municipio: '', provincia: '', cod_postal: '', observaciones: '', nombre_conyuge: '', apellidos_conyuge: '', dni_conyuge: '', movil_conyuge: '', email_conyuge: '', telefono_2_conyuge: '', email_2_conyuge: '', otra_persona_contacto: '', movil_otra_persona: '', email_otra_persona: '', relacion_otra_persona: '', prop_final: '', fecha_baja: '' }

export default function Propietarios({ perfil }) {
  const [rows, setRows] = useState([])
  const [tipos, setTipos] = useState([])
  const [responsables, setResponsables] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState('vigor')
  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [inmuebles, setInmuebles] = useState([])
  const { sortData, sortIcon, thProps } = useSortable('nombre')

  useEffect(() => { load() }, [])
  useCtrlG(save, !!modal)

  async function load() {
    setLoading(true)
    const [{ data: props }, { data: tipos }, { data: resps }] = await Promise.all([
      (() => {
        let q = supabase.from('propietarios').select('*, tipo_persona(tipo), responsable(nombre_responsable)').order('nombre')
        if (perfil?.rol === 'propietario' && perfil?.propietario_id) q = q.eq('id', perfil.propietario_id)
        return q
      })(),
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
    Object.keys(data).forEach(k => { if (data[k] === '' || data[k] === undefined) data[k] = null })
    if (modal === 'new') {
      await supabase.from('propietarios').insert(data)
    } else {
      const { id: _id, tipo_persona: _, responsable: __, ...updateData } = data
      const { error } = await supabase.from('propietarios').update(updateData).eq('id', form.id)
      if (error) { alert('Error al guardar: ' + error.message); return }
    }
    setModal(null); load()
  }

  async function del(id) {
    if (!confirm('¿Eliminar este propietario?')) return
    await supabase.from('propietarios').delete().eq('id', id)
    setSelected(null); load()
  }

  const nombre = r => `${r.nombre || ''} ${r.apellidos || ''}`.trim() || '—'
  const initials = r => nombre(r).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES') : '—'
  const f = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }))

  function filtered() {
    let data = rows.filter(r => {
      const matchSearch = ms([r.nombre, r.apellidos, r.email, r.movil, r.dni_cif], search)
      const matchFiltro = filtro === 'todos' ? true : filtro === 'vigor' ? !r.fecha_baja : !!r.fecha_baja
      return matchSearch && matchFiltro
    })
    return sortData(data, (r, col) => {
      if (col === 'nombre') return nombre(r)
      if (col === 'tipo') return r.tipo_persona?.tipo
      if (col === 'responsable') return r.responsable?.nombre_responsable
      return r[col]
    })
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>Propietarios <span className="badge badge-gray" style={{ marginLeft: 6 }}>{filtered().length}</span></h2>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['vigor','En vigor'],['finalizados','Con baja'],['todos','Todos']].map(([v,l]) => (
              <button key={v} className={`btn btn-sm ${filtro === v ? 'btn-primary' : ''}`} onClick={() => setFiltro(v)}>{l}</button>
            ))}
          </div>
          <div className="search-input"><i className="ti ti-search" /><input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <button className="btn btn-primary btn-sm" onClick={() => { setForm(EMPTY); setModal('new') }}><i className="ti ti-plus" /> Nuevo</button>
        </div>
        <div className="table-wrap">
          {loading ? <div className="loading"><i className="ti ti-loader ti-spin" /> Cargando...</div> : (
            <table>
              <thead><tr>
                <th {...thProps('nombre')}>Nombre / Razón social <span style={{fontSize:10}}>{sortIcon('nombre')}</span></th>
                <th {...thProps('tipo')}>Tipo <span style={{fontSize:10}}>{sortIcon('tipo')}</span></th>
                <th {...thProps('movil')}>Móvil <span style={{fontSize:10}}>{sortIcon('movil')}</span></th>
                <th {...thProps('email')}>Email <span style={{fontSize:10}}>{sortIcon('email')}</span></th>
                <th {...thProps('responsable')}>Responsable <span style={{fontSize:10}}>{sortIcon('responsable')}</span></th>
              </tr></thead>
              <tbody>
                {filtered().map(r => (
                  <tr key={r.id}
                    onClick={() => selectRow(r)}
                    onDoubleClick={() => { selectRow(r); setForm({ ...r, tipo_id: r.tipo_id || '', responsable_id: r.responsable_id || '', fecha_baja: r.fecha_baja || '' }); setModal('edit') }}>
                    <td><strong>{nombre(r)}</strong>{r.fecha_baja && <span className="badge badge-red" style={{ marginLeft: 6, fontSize: 10 }}>Baja</span>}</td>
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
          {modal !== 'edit' && <div className="detail-overlay" onClick={() => setSelected(null)} />}
          <div className="detail-panel">
            <div className="panel-header">
              <div className="panel-avatar av-blue">{initials(selected)}</div>
              <div style={{ flex: 1 }}>
                <h3>{nombre(selected)}</h3>
                <div className="panel-sub">{selected.tipo_persona?.tipo || ''}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ ...selected, tipo_id: selected.tipo_id || '', responsable_id: selected.responsable_id || '', fecha_baja: selected.fecha_baja || '' }); setModal('edit') }}><i className="ti ti-edit" /></button>
              <button className="btn btn-ghost btn-sm" onClick={() => del(selected.id)}><i className="ti ti-trash" style={{ color: 'var(--danger-text)' }} /></button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="panel-body">
              <div className="field-section">Datos personales</div>
              <div className="field-grid">
                <div className="field"><label>DNI / CIF</label><div className="val">{selected.dni_cif || '—'}</div></div>
                <div className="field"><label>Responsable</label><div className="val">{selected.responsable?.nombre_responsable || '—'}</div></div>
                <div className="field"><label>Teléfono</label><div className="val">{selected.telefono || '—'}</div></div>
                <div className="field"><label>Teléfono 2</label><div className="val">{selected.telefono_2 || '—'}</div></div>
                <div className="field"><label>Móvil</label><div className="val">{selected.movil || '—'}</div></div>
                <div className="field"><label>Email</label><div className="val">{selected.email || '—'}</div></div>
                <div className="field field-full"><label>Email 2</label><div className="val">{selected.email_2 || '—'}</div></div>
                <div className="field field-full"><label>Dirección</label><div className="val">{[selected.calle, selected.numero, selected.piso, selected.municipio, selected.provincia].filter(Boolean).join(', ') || '—'}</div></div>
                {selected.fecha_baja && <div className="field"><label>Fecha baja</label><div className="val" style={{ color: 'var(--danger-text)' }}>{fmtDate(selected.fecha_baja)}</div></div>}
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
              {selected.otra_persona_contacto && <>
                <div className="field-section">Otra persona de contacto</div>
                <div className="field-grid">
                  <div className="field"><label>Nombre</label><div className="val">{selected.otra_persona_contacto}</div></div>
                  <div className="field"><label>Relación</label><div className="val">{selected.relacion_otra_persona || '—'}</div></div>
                  <div className="field"><label>Móvil</label><div className="val">{selected.movil_otra_persona || '—'}</div></div>
                  <div className="field"><label>Email</label><div className="val">{selected.email_otra_persona || '—'}</div></div>
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
              <div className="field-section">Documentos</div>
              <Documentos entidadTipo="propietario" entidadId={selected.id} />
            </div>
          </div>
        </>
      )}

      {modal && (
        <div className={modal === 'edit' && selected ? "edit-modal-overlay" : "modal-overlay"} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2>{modal === 'new' ? 'Nuevo propietario' : `Editar — ${nombre(form)}`}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group"><label>Nombre</label><input value={form.nombre ?? ''} onChange={f('nombre')} /></div>
                <div className="form-group"><label>Apellidos</label><input value={form.apellidos ?? ''} onChange={f('apellidos')} /></div>
                <div className="form-group"><label>DNI / CIF</label><input value={form.dni_cif ?? ''} onChange={f('dni_cif')} /></div>
                <div className="form-group"><label>Tipo <span style={{ color: 'var(--danger-text)' }}>*</span></label>
                  <select value={form.tipo_id ?? ''} onChange={f('tipo_id')}>
                    <option value="">— Selecciona —</option>
                    {tipos.map(t => <option key={t.id} value={t.id}>{t.tipo}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Responsable</label>
                  <select value={form.responsable_id ?? ''} onChange={f('responsable_id')}>
                    <option value="">—</option>
                    {responsables.map(r => <option key={r.id} value={r.id}>{r.nombre_responsable}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Teléfono</label><input value={form.telefono ?? ''} onChange={f('telefono')} /></div>
                <div className="form-group"><label>Teléfono 2</label><input value={form.telefono_2 ?? ''} onChange={f('telefono_2')} /></div>
                <div className="form-group"><label>Móvil</label><input value={form.movil ?? ''} onChange={f('movil')} /></div>
                <div className="form-group"><label>Email</label><input value={form.email ?? ''} onChange={f('email')} /></div>
                <div className="form-group"><label>Email 2</label><input value={form.email_2 ?? ''} onChange={f('email_2')} /></div>
                <div className="form-group form-full"><label>Calle</label><input value={form.calle ?? ''} onChange={f('calle')} /></div>
                <div className="form-group"><label>Número</label><input value={form.numero ?? ''} onChange={f('numero')} /></div>
                <div className="form-group"><label>Piso</label><input value={form.piso ?? ''} onChange={f('piso')} /></div>
                <div className="form-group"><label>Municipio</label><input value={form.municipio ?? ''} onChange={f('municipio')} /></div>
                <div className="form-group"><label>Provincia</label><input value={form.provincia ?? ''} onChange={f('provincia')} /></div>
                <div className="form-group"><label>Fecha baja</label><input type="date" value={form.fecha_baja ?? ''} onChange={f('fecha_baja')} /></div>
                <div className="form-section-title">Cónyuge</div>
                <div className="form-group"><label>Nombre</label><input value={form.nombre_conyuge ?? ''} onChange={f('nombre_conyuge')} /></div>
                <div className="form-group"><label>Apellidos</label><input value={form.apellidos_conyuge ?? ''} onChange={f('apellidos_conyuge')} /></div>
                <div className="form-group"><label>DNI cónyuge</label><input value={form.dni_conyuge ?? ''} onChange={f('dni_conyuge')} /></div>
                <div className="form-group"><label>Móvil</label><input value={form.movil_conyuge ?? ''} onChange={f('movil_conyuge')} /></div>
                <div className="form-group"><label>Email</label><input value={form.email_conyuge ?? ''} onChange={f('email_conyuge')} /></div>
                <div className="form-group"><label>Teléfono 2</label><input value={form.telefono_2_conyuge ?? ''} onChange={f('telefono_2_conyuge')} /></div>
                <div className="form-group"><label>Email 2</label><input value={form.email_2_conyuge ?? ''} onChange={f('email_2_conyuge')} /></div>
                <div className="form-section-title">Otra persona de contacto</div>
                <div className="form-group form-full"><label>Nombre</label><input value={form.otra_persona_contacto ?? ''} onChange={f('otra_persona_contacto')} /></div>
                <div className="form-group"><label>Relación</label><input value={form.relacion_otra_persona ?? ''} onChange={f('relacion_otra_persona')} /></div>
                <div className="form-group"><label>Móvil</label><input value={form.movil_otra_persona ?? ''} onChange={f('movil_otra_persona')} /></div>
                <div className="form-group form-full"><label>Email</label><input value={form.email_otra_persona ?? ''} onChange={f('email_otra_persona')} /></div>
                <div className="form-group form-full"><label>Observaciones</label><textarea value={form.observaciones ?? ''} onChange={f('observaciones')} /></div>
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

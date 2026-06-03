import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const EMPTY = { nombre: '', apellidos: '', dni_cif: '', tipo_id: '', responsable_id: '', telefono: '', movil: '', email: '', observaciones: '', nombre_conyuge: '', apellidos_conyuge: '', movil_conyuge: '', email_conyuge: '', otra_persona_contacto: '', movil_otra_persona: '', relacion_otra_persona: '', inmueble_id: '', fecha_contrato: '', fecha_fin_contrato: '', mes_contrato: '', importe_fianza_ivima: '', importe_deposito: '', seguro_rentas_id: '', num_poliza_seg_rentas: '' }

export default function Inquilinos() {
  const [rows, setRows] = useState([])
  const [inmuebles, setInmuebles] = useState([])
  const [seguros, setSeguros] = useState([])
  const [responsables, setResponsables] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [acciones, setAcciones] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: inqs }, { data: inms }, { data: segs }, { data: resps }] = await Promise.all([
      supabase.from('inquilinos').select('*, inmuebles(codigo, calle, piso), seguro(compania), responsable(nombre_responsable)').order('nombre'),
      supabase.from('inmuebles').select('id, codigo, calle').order('codigo'),
      supabase.from('seguro').select('id, compania'),
      supabase.from('responsable').select('*'),
    ])
    setRows(inqs || [])
    setInmuebles(inms || [])
    setSeguros(segs || [])
    setResponsables(resps || [])
    setLoading(false)
  }

  async function selectRow(row) {
    setSelected(row)
    const { data } = await supabase.from('accion_inquilino').select('*, responsable(nombre_responsable)').eq('inquilino_id', row.id).order('fecha', { ascending: false }).limit(10)
    setAcciones(data || [])
  }

  async function save() {
    const data = { ...form }
    Object.keys(data).forEach(k => { if (data[k] === '') data[k] = null })
    if (modal === 'new') await supabase.from('inquilinos').insert(data)
    else await supabase.from('inquilinos').update(data).eq('id', form.id)
    setModal(null); load()
  }

  async function del(id) {
    if (!confirm('¿Eliminar este inquilino?')) return
    await supabase.from('inquilinos').delete().eq('id', id)
    setSelected(null); load()
  }

  const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES') : '—'
  const fmtMoney = v => v != null ? Number(v).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : '—'
  const nombre = r => `${r.nombre || ''} ${r.apellidos || ''}`.trim() || '—'
  const initials = r => nombre(r).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const diasRestantes = d => {
    if (!d) return null
    return Math.ceil((new Date(d) - new Date()) / 86400000)
  }

  const filtered = rows.filter(r => [r.nombre, r.apellidos, r.email, r.movil, r.dni_cif, r.inmuebles?.codigo].join(' ').toLowerCase().includes(search.toLowerCase()))
  const f = key => e => setForm({ ...form, [key]: e.target.value })

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>Inquilinos <span className="badge badge-gray" style={{ marginLeft: 6 }}>{filtered.length}</span></h2>
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
              <thead><tr><th>Nombre</th><th>Inmueble</th><th>Móvil</th><th>Seg. rentas</th><th>Fin contrato</th></tr></thead>
              <tbody>
                {filtered.map(r => {
                  const dias = diasRestantes(r.fecha_fin_contrato)
                  const badge = dias === null ? null : dias < 30 ? 'badge-red' : dias < 90 ? 'badge-yellow' : 'badge-green'
                  return (
                    <tr key={r.id} onClick={() => selectRow(r)}>
                      <td><strong>{nombre(r)}</strong></td>
                      <td>{r.inmuebles ? <span className="badge badge-gray">{r.inmuebles.codigo}</span> : '—'}</td>
                      <td>{r.movil || '—'}</td>
                      <td>{r.seguro?.compania || '—'}</td>
                      <td>{r.fecha_fin_contrato ? <span className={`badge ${badge}`}>{fmtDate(r.fecha_fin_contrato)}</span> : '—'}</td>
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
          <div className="detail-overlay" onClick={() => setSelected(null)} />
          <div className="detail-panel">
            <div className="panel-header">
              <div className="panel-avatar av-yellow">{initials(selected)}</div>
              <div style={{ flex: 1 }}>
                <h3>{nombre(selected)}</h3>
                <div className="panel-sub">{selected.inmuebles ? `${selected.inmuebles.codigo} · ${selected.inmuebles.calle}` : 'Sin inmueble asignado'}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ ...selected }); setModal('edit') }}><i className="ti ti-edit" /></button>
              <button className="btn btn-ghost btn-sm" onClick={() => del(selected.id)}><i className="ti ti-trash" style={{ color: 'var(--danger-text)' }} /></button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="panel-body">
              <div className="field-section">Datos personales</div>
              <div className="field-grid">
                <div className="field"><label>DNI / NIE</label><div className="val">{selected.dni_cif || '—'}</div></div>
                <div className="field"><label>Responsable</label><div className="val">{selected.responsable?.nombre_responsable || '—'}</div></div>
                <div className="field"><label>Teléfono</label><div className="val">{selected.telefono || '—'}</div></div>
                <div className="field"><label>Móvil</label><div className="val">{selected.movil || '—'}</div></div>
                <div className="field field-full"><label>Email</label><div className="val">{selected.email || '—'}</div></div>
              </div>

              <div className="field-section">Contrato</div>
              <div className="field-grid">
                <div className="field"><label>Inicio contrato</label><div className="val">{fmtDate(selected.fecha_contrato)}</div></div>
                <div className="field"><label>Fin contrato</label><div className="val">{fmtDate(selected.fecha_fin_contrato)}</div></div>
                <div className="field"><label>Fianza IVIMA</label><div className="val">{fmtMoney(selected.importe_fianza_ivima)}</div></div>
                <div className="field"><label>Depósito</label><div className="val">{fmtMoney(selected.importe_deposito)}</div></div>
              </div>

              <div className="field-section">Seguro de rentas</div>
              <div className="field-grid">
                <div className="field"><label>Compañía</label><div className="val">{selected.seguro?.compania || '—'}</div></div>
                <div className="field"><label>Nº póliza</label><div className="val">{selected.num_poliza_seg_rentas || '—'}</div></div>
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
                        <div className="tl-text">{a.indicaciones || a.proxima_accion || '—'}</div>
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
              <h2>{modal === 'new' ? 'Nuevo inquilino' : 'Editar inquilino'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group"><label>Nombre</label><input value={form.nombre || ''} onChange={f('nombre')} /></div>
                <div className="form-group"><label>Apellidos</label><input value={form.apellidos || ''} onChange={f('apellidos')} /></div>
                <div className="form-group"><label>DNI / NIE</label><input value={form.dni_cif || ''} onChange={f('dni_cif')} /></div>
                <div className="form-group"><label>Responsable</label>
                  <select value={form.responsable_id || ''} onChange={f('responsable_id')}>
                    <option value="">—</option>
                    {responsables.map(r => <option key={r.id} value={r.id}>{r.nombre_responsable}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Teléfono</label><input value={form.telefono || ''} onChange={f('telefono')} /></div>
                <div className="form-group"><label>Móvil</label><input value={form.movil || ''} onChange={f('movil')} /></div>
                <div className="form-group form-full"><label>Email</label><input value={form.email || ''} onChange={f('email')} /></div>
                <div className="form-section-title">Contrato</div>
                <div className="form-group"><label>Inmueble</label>
                  <select value={form.inmueble_id || ''} onChange={f('inmueble_id')}>
                    <option value="">— Sin asignar —</option>
                    {inmuebles.map(i => <option key={i.id} value={i.id}>{i.codigo} — {i.calle}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Seguro de rentas</label>
                  <select value={form.seguro_rentas_id || ''} onChange={f('seguro_rentas_id')}>
                    <option value="">—</option>
                    {seguros.map(s => <option key={s.id} value={s.id}>{s.compania}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Inicio contrato</label><input type="date" value={form.fecha_contrato || ''} onChange={f('fecha_contrato')} /></div>
                <div className="form-group"><label>Fin contrato</label><input type="date" value={form.fecha_fin_contrato || ''} onChange={f('fecha_fin_contrato')} /></div>
                <div className="form-group"><label>Fianza IVIMA (€)</label><input type="number" value={form.importe_fianza_ivima || ''} onChange={f('importe_fianza_ivima')} /></div>
                <div className="form-group"><label>Depósito (€)</label><input type="number" value={form.importe_deposito || ''} onChange={f('importe_deposito')} /></div>
                <div className="form-group form-full"><label>Nº póliza seguro rentas</label><input value={form.num_poliza_seg_rentas || ''} onChange={f('num_poliza_seg_rentas')} /></div>
                <div className="form-section-title">Cónyuge</div>
                <div className="form-group"><label>Nombre cónyuge</label><input value={form.nombre_conyuge || ''} onChange={f('nombre_conyuge')} /></div>
                <div className="form-group"><label>Móvil cónyuge</label><input value={form.movil_conyuge || ''} onChange={f('movil_conyuge')} /></div>
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

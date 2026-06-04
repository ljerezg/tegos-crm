import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const EMPTY = { codigo: '', calle: '', numero_calle: '', piso: '', poblacion: '', provincia: '', codigo_postal: '', propietario_id: '', registro: '', num_finca_registral_vivienda: '', num_catastro_vivienda: '', num_garaje_1: '', num_garaje_2: '', num_trastero: '', seguro_id: '', num_poliza_seg_hogar: '', administrador_finca: '', cia_electrica: '', num_contrato_electricidad: '', cups_electricidad: '', titular_contrato_electricidad: '', cia_gas: '', num_contrato_gas: '', cups_gas: '', titular_contrato_gas: '', cia_agua: '', num_contrato_agua: '', titular_contrato_agua: '', observaciones: '' }

export default function Inmuebles() {
  const [rows, setRows] = useState([])
  const [propietarios, setPropietarios] = useState([])
  const [seguros, setSeguros] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null) // null | 'new' | 'edit'
  const [form, setForm] = useState(EMPTY)
  const [acciones, setAcciones] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: inmuebles }, { data: props }, { data: segs }] = await Promise.all([
      supabase.from('inmuebles').select('*, propietarios(nombre, apellidos), seguro(compania)').order('codigo'),
      supabase.from('propietarios').select('id, nombre, apellidos').order('nombre'),
      supabase.from('seguro').select('id, compania').order('compania'),
    ])
    setRows(inmuebles || [])
    setPropietarios(props || [])
    setSeguros(segs || [])
    setLoading(false)
  }

  async function selectRow(row) {
    setSelected(row)
    const { data } = await supabase.from('accion_inmueble').select('*, responsable(nombre_responsable)').eq('inmueble_id', row.id).order('fecha', { ascending: false }).limit(10)
    setAcciones(data || [])
  }

  async function save() {
    const data = { ...form }
    Object.keys(data).forEach(k => { if (data[k] === '') data[k] = null })
    if (modal === 'new') await supabase.from('inmuebles').insert(data)
    else await supabase.from('inmuebles').update(data).eq('id', form.id)
    setModal(null); load()
  }

  async function del(id) {
    if (!confirm('¿Eliminar este inmueble?')) return
    await supabase.from('inmuebles').delete().eq('id', id)
    setSelected(null); load()
  }

  const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES') : '—'
  const filtered = rows.filter(r => [r.codigo, r.calle, r.poblacion, r.propietarios?.nombre].join(' ').toLowerCase().includes(search.toLowerCase()))
  const initials = s => s ? s.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'
  const propNombre = p => p ? `${p.nombre || ''} ${p.apellidos || ''}`.trim() : '—'

  return (
    <div style={{ display: 'flex', gap: 0, height: '100%' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="card">
          <div className="card-header">
            <h2>Inmuebles <span className="badge badge-gray" style={{ marginLeft: 6 }}>{filtered.length}</span></h2>
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
                <thead><tr><th>Código</th><th>Dirección</th><th>Población</th><th>Propietario</th><th>Seguro</th></tr></thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} onClick={() => selectRow(r)} style={{ background: selected?.id === r.id ? 'var(--accent-bg)' : '' }}>
                      <td><strong style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.codigo}</strong></td>
                      <td>{r.calle}{r.numero_calle ? ` ${r.numero_calle}` : ''}{r.piso ? `, ${r.piso}` : ''}</td>
                      <td>{r.poblacion || '—'}</td>
                      <td>{propNombre(r.propietarios)}</td>
                      <td>{r.seguro?.compania ? <span className="badge badge-gray">{r.seguro.compania}</span> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {selected && (
        <>
          <div className="detail-overlay" onClick={() => setSelected(null)} />
          <div className="detail-panel">
            <div className="panel-header">
              <div className="panel-avatar av-green">{initials(selected.codigo)}</div>
              <div style={{ flex: 1 }}>
                <h3>{selected.codigo}</h3>
                <div className="panel-sub">{selected.calle}{selected.piso ? `, ${selected.piso}` : ''}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ ...selected }); setModal('edit') }}><i className="ti ti-edit" /></button>
              <button className="btn btn-ghost btn-sm" onClick={() => del(selected.id)}><i className="ti ti-trash" style={{ color: 'var(--danger-text)' }} /></button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="panel-body">
              <div className="field-section">Localización</div>
              <div className="field-grid">
                <div className="field"><label>Calle</label><div className="val">{selected.calle || '—'}</div></div>
                <div className="field"><label>Nº / Piso</label><div className="val">{[selected.numero_calle, selected.piso].filter(Boolean).join(', ') || '—'}</div></div>
                <div className="field"><label>Población</label><div className="val">{selected.poblacion || '—'}</div></div>
                <div className="field"><label>C.P.</label><div className="val">{selected.codigo_postal || '—'}</div></div>
              </div>

              <div className="field-section">Propietario y seguro</div>
              <div className="field-grid">
                <div className="field"><label>Propietario</label><div className="val">{propNombre(selected.propietarios)}</div></div>
                <div className="field"><label>Seguro hogar</label><div className="val">{selected.seguro?.compania || '—'}</div></div>
                <div className="field"><label>Nº póliza</label><div className="val">{selected.num_poliza_seg_hogar || '—'}</div></div>
                <div className="field"><label>Adm. finca</label><div className="val">{selected.administrador_finca || '—'}</div></div>
              </div>

              <div className="field-section">Datos registrales</div>
              <div className="field-grid">
                <div className="field"><label>Registro</label><div className="val">{selected.registro || '—'}</div></div>
                <div className="field"><label>Finca registral</label><div className="val">{selected.num_finca_registral_vivienda || '—'}</div></div>
                <div className="field field-full"><label>Catastro</label><div className="val">{selected.num_catastro_vivienda || '—'}</div></div>
              </div>

              <div className="field-section">Suministros</div>
              <div className="field-grid">
                <div className="field"><label>Cía. eléctrica</label><div className="val">{selected.cia_electrica || '—'}</div></div>
                <div className="field"><label>CUPS electricidad</label><div className="val" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{selected.cups_electricidad || '—'}</div></div>
                <div className="field"><label>Titular elect.</label><div className="val">{selected.titular_contrato_electricidad || '—'}</div></div>
                <div className="field"><label>Cía. gas</label><div className="val">{selected.cia_gas || '—'}</div></div>
                <div className="field"><label>CUPS gas</label><div className="val" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{selected.cups_gas || '—'}</div></div>
                <div className="field"><label>Cía. agua</label><div className="val">{selected.cia_agua || '—'}</div></div>
              </div>

              <div className="field-section">Garajes y trastero</div>
              <div className="field-grid">
                <div className="field"><label>Garaje 1</label><div className="val">{selected.num_garaje_1 || '—'}</div></div>
                <div className="field"><label>Garaje 2</label><div className="val">{selected.num_garaje_2 || '—'}</div></div>
                <div className="field"><label>Trastero</label><div className="val">{selected.num_trastero || '—'}</div></div>
              </div>

              {selected.observaciones && <>
                <div className="field-section">Observaciones</div>
                <div className="field field-full"><div className="val">{selected.observaciones}</div></div>
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
              <h2>{modal === 'new' ? 'Nuevo inmueble' : 'Editar inmueble'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group"><label>Código *</label><input value={form.codigo || ''} onChange={e => setForm({ ...form, codigo: e.target.value })} /></div>
                <div className="form-group"><label>Propietario</label>
                  <select value={form.propietario_id || ''} onChange={e => setForm({ ...form, propietario_id: e.target.value })}>
                    <option value="">— Sin asignar —</option>
                    {propietarios.map(p => <option key={p.id} value={p.id}>{propNombre(p)}</option>)}
                  </select>
                </div>
                <div className="form-section-title">Localización</div>
                <div className="form-group form-full"><label>Calle</label><input value={form.calle || ''} onChange={e => setForm({ ...form, calle: e.target.value })} /></div>
                <div className="form-group"><label>Número</label><input value={form.numero_calle || ''} onChange={e => setForm({ ...form, numero_calle: e.target.value })} /></div>
                <div className="form-group"><label>Piso / Puerta</label><input value={form.piso || ''} onChange={e => setForm({ ...form, piso: e.target.value })} /></div>
                <div className="form-group"><label>Población</label><input value={form.poblacion || ''} onChange={e => setForm({ ...form, poblacion: e.target.value })} /></div>
                <div className="form-group"><label>Código postal</label><input value={form.codigo_postal || ''} onChange={e => setForm({ ...form, codigo_postal: e.target.value })} /></div>
                <div className="form-section-title">Seguro y administración</div>
                <div className="form-group"><label>Seguro hogar</label>
                  <select value={form.seguro_id || ''} onChange={e => setForm({ ...form, seguro_id: e.target.value })}>
                    <option value="">—</option>
                    {seguros.map(s => <option key={s.id} value={s.id}>{s.compania}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Nº póliza</label><input value={form.num_poliza_seg_hogar || ''} onChange={e => setForm({ ...form, num_poliza_seg_hogar: e.target.value })} /></div>
                <div className="form-group form-full"><label>Administrador de finca</label><input value={form.administrador_finca || ''} onChange={e => setForm({ ...form, administrador_finca: e.target.value })} /></div>
                <div className="form-section-title">Datos registrales</div>
                <div className="form-group"><label>Registro</label><input value={form.registro || ''} onChange={e => setForm({ ...form, registro: e.target.value })} /></div>
                <div className="form-group"><label>Nº finca registral</label><input value={form.num_finca_registral_vivienda || ''} onChange={e => setForm({ ...form, num_finca_registral_vivienda: e.target.value })} /></div>
                <div className="form-group form-full"><label>Referencia catastral</label><input value={form.num_catastro_vivienda || ''} onChange={e => setForm({ ...form, num_catastro_vivienda: e.target.value })} /></div>
                <div className="form-section-title">Suministros — Electricidad</div>
                <div className="form-group"><label>Compañía</label><input value={form.cia_electrica || ''} onChange={e => setForm({ ...form, cia_electrica: e.target.value })} /></div>
                <div className="form-group"><label>CUPS</label><input value={form.cups_electricidad || ''} onChange={e => setForm({ ...form, cups_electricidad: e.target.value })} /></div>
                <div className="form-group form-full"><label>Titular contrato</label><input value={form.titular_contrato_electricidad || ''} onChange={e => setForm({ ...form, titular_contrato_electricidad: e.target.value })} /></div>
                <div className="form-section-title">Suministros — Gas</div>
                <div className="form-group"><label>Compañía</label><input value={form.cia_gas || ''} onChange={e => setForm({ ...form, cia_gas: e.target.value })} /></div>
                <div className="form-group"><label>CUPS</label><input value={form.cups_gas || ''} onChange={e => setForm({ ...form, cups_gas: e.target.value })} /></div>
                <div className="form-group form-full"><label>Titular contrato</label><input value={form.titular_contrato_gas || ''} onChange={e => setForm({ ...form, titular_contrato_gas: e.target.value })} /></div>
                <div className="form-section-title">Suministros — Agua</div>
                <div className="form-group"><label>Compañía</label><input value={form.cia_agua || ''} onChange={e => setForm({ ...form, cia_agua: e.target.value })} /></div>
                <div className="form-group"><label>Titular contrato</label><input value={form.titular_contrato_agua || ''} onChange={e => setForm({ ...form, titular_contrato_agua: e.target.value })} /></div>
                <div className="form-section-title">Garajes y trastero</div>
                <div className="form-group"><label>Garaje 1</label><input value={form.num_garaje_1 || ''} onChange={e => setForm({ ...form, num_garaje_1: e.target.value })} /></div>
                <div className="form-group"><label>Garaje 2</label><input value={form.num_garaje_2 || ''} onChange={e => setForm({ ...form, num_garaje_2: e.target.value })} /></div>
                <div className="form-group"><label>Trastero</label><input value={form.num_trastero || ''} onChange={e => setForm({ ...form, num_trastero: e.target.value })} /></div>
                <div className="form-group form-full"><label>Observaciones</label><textarea value={form.observaciones || ''} onChange={e => setForm({ ...form, observaciones: e.target.value })} /></div>
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

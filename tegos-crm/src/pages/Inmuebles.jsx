import { useEffect, useState } from 'react'
import { useCtrlG } from '../lib/useCtrlG'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import Documentos from '../components/Documentos.jsx'
import SearchSelect from '../components/SearchSelect.jsx'
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

const EMPTY = { codigo: '', calle: '', numero_calle: '', piso: '', poblacion: '', provincia: '', codigo_postal: '', propietario_id: '', tipo_inmueble_id: '', registro: '', num_finca_registral_vivienda: '', cru: '', num_catastro_vivienda: '', num_garaje_1: '', num_garaje_2: '', num_trastero: '', seguro_id: '', num_poliza_seg_hogar: '', administrador_finca_id: '', cia_electrica: '', num_contrato_electricidad: '', cups_electricidad: '', titular_contrato_electricidad: '', cia_gas: '', num_contrato_gas: '', cups_gas: '', titular_contrato_gas: '', cia_agua: '', num_contrato_agua: '', titular_contrato_agua: '', carpeta_dropbox: '', observaciones: '', fecha_baja: '' }

export default function Inmuebles({ perfil }) {
  const [rows, setRows] = useState([])
  const [propietarios, setPropietarios] = useState([])
  const [seguros, setSeguros] = useState([])
  const [admFincas, setAdmFincas] = useState([])
  const [tiposInmueble, setTiposInmueble] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState('vigor')
  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [acciones, setAcciones] = useState([])
  const [otrosProps, setOtrosProps] = useState([])
  const navigate = useNavigate()
  const readOnly = perfil?.rol === 'visor'
  const { sortData, sortIcon, thProps } = useSortable('codigo')

  useEffect(() => { load() }, [])
  useCtrlG(save, !!modal)

  async function load() {
    setLoading(true)
    let inmuebleIds = null
    if (perfil?.rol === 'propietario' && perfil?.propietario_id) {
      const [{ data: dir }, { data: co }] = await Promise.all([
        supabase.from('inmuebles').select('id').eq('propietario_id', perfil.propietario_id),
        supabase.from('inmueble_propietarios').select('inmueble_id').eq('propietario_id', perfil.propietario_id),
      ])
      inmuebleIds = [...new Set([...(dir || []).map(i => i.id), ...(co || []).map(i => i.inmueble_id)])]
    }
    const [{ data: inmuebles }, { data: props }, { data: segs }, { data: adms }, { data: tipsinm }] = await Promise.all([
      (() => {
        let q = supabase.from('inmuebles').select('*, propietarios!inmuebles_propietario_id_fkey(nombre, apellidos), inmueble_propietarios(propietario_id, propietarios(id, nombre, apellidos)), seguro(compania), administrador_finca(nombre), tipo_inmueble(tipo)').order('codigo')
        if (inmuebleIds !== null) {
          if (inmuebleIds.length === 0) q = q.eq('id', -1)
          else q = q.in('id', inmuebleIds)
        }
        return q
      })(),
      supabase.from('propietarios').select('id, nombre, apellidos').order('nombre'),
      supabase.from('seguro').select('id, compania').order('compania'),
      supabase.from('administrador_finca').select('id, nombre').order('nombre'),
      supabase.from('tipo_inmueble').select('*').order('tipo'),
    ])
    setRows(inmuebles || [])
    setPropietarios(props || [])
    setSeguros(segs || [])
    setAdmFincas(adms || [])
    setTiposInmueble(tipsinm || [])
    setLoading(false)
  }

  async function selectRow(row) {
    setSelected(row)
    const { data } = await supabase.from('accion_inmueble').select('*, responsable(nombre_responsable), tipo_contacto(tipo_contacto)').eq('inmueble_id', row.id).order('fecha', { ascending: false })
    setAcciones(data || [])
  }

  async function save() {
    const data = { ...form }
    Object.keys(data).forEach(k => { if (data[k] === '' || data[k] === undefined) data[k] = null })
    let inmuebleId = form.id
    if (modal === 'new') {
      const { data: creado, error } = await supabase.from('inmuebles').insert(data).select('id').single()
      if (error) { alert('Error al guardar: ' + error.message); return }
      inmuebleId = creado?.id
    } else {
      const { id: _id, propietarios: _, inmueble_propietarios: _____, seguro: __, administrador_finca: ___, tipo_inmueble: ____, ...updateData } = data
      const { error } = await supabase.from('inmuebles').update(updateData).eq('id', form.id)
      if (error) { alert('Error al guardar: ' + error.message); return }
    }
    if (inmuebleId) {
      await supabase.from('inmueble_propietarios').delete().eq('inmueble_id', inmuebleId)
      const extras = [...new Set(otrosProps.filter(pid => pid && String(pid) !== String(data.propietario_id ?? '')))]
      if (extras.length > 0) {
        const { error: errRel } = await supabase.from('inmueble_propietarios').insert(extras.map(pid => ({ inmueble_id: inmuebleId, propietario_id: pid })))
        if (errRel) alert('Inmueble guardado, pero error al guardar propietarios adicionales: ' + errRel.message)
      }
    }
    setModal(null); load()
    if (selected && inmuebleId) {
      const { data: updated } = await supabase.from('inmuebles').select('*, propietarios!inmuebles_propietario_id_fkey(nombre, apellidos), inmueble_propietarios(propietario_id, propietarios(id, nombre, apellidos)), seguro(compania), administrador_finca(nombre), tipo_inmueble(tipo)').eq('id', inmuebleId).single()
      if (updated) setSelected(updated)
    }
  }

  async function del(id) {
    if (!confirm('¿Eliminar este inmueble?')) return
    await supabase.from('inmuebles').delete().eq('id', id)
    setSelected(null); load()
  }

  async function exportExcel() {
    const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES') : ''

    const data = filtered().map(r => ({
      'Código': r.codigo || '',
      'Calle': r.calle || '',
      'Número': r.numero_calle || '',
      'Piso': r.piso || '',
      'Población': r.poblacion || '',
      'Provincia': r.provincia || '',
      'Código postal': r.codigo_postal || '',
      'Tipo inmueble': r.tipo_inmueble?.tipo || '',
      'Propietario': propNombre(r.propietarios),
      'Otros propietarios': (r.inmueble_propietarios || []).map(x => propNombre(x.propietarios)).join(' | '),
      'Administrador finca': r.administrador_finca?.nombre || '',
      'Seguro hogar': r.seguro?.compania || '',
      'Nº póliza': r.num_poliza_seg_hogar || '',
      'Registro': r.registro || '',
      'Nº finca registral': r.num_finca_registral_vivienda || '',
      'CRU': r.cru || '',
      'Referencia catastral': r.num_catastro_vivienda || '',
      'Nº garaje 1': r.num_garaje_1 || '',
      'Nº garaje 2': r.num_garaje_2 || '',
      'Nº trastero': r.num_trastero || '',
      'Cía. eléctrica': r.cia_electrica || '',
      'Nº contrato electricidad': r.num_contrato_electricidad || '',
      'CUPS electricidad': r.cups_electricidad || '',
      'Titular electricidad': r.titular_contrato_electricidad || '',
      'Cía. gas': r.cia_gas || '',
      'Nº contrato gas': r.num_contrato_gas || '',
      'CUPS gas': r.cups_gas || '',
      'Titular gas': r.titular_contrato_gas || '',
      'Cía. agua': r.cia_agua || '',
      'Nº contrato agua': r.num_contrato_agua || '',
      'Titular agua': r.titular_contrato_agua || '',
      'Carpeta Dropbox': r.carpeta_dropbox || '',
      'Observaciones': r.observaciones || '',
      'Fecha baja': fmtDate(r.fecha_baja),
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inmuebles')
    XLSX.writeFile(wb, 'Inmuebles.xlsx')
  }

  const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES') : '—'
  const propNombre = p => p ? `${p.nombre || ''} ${p.apellidos || ''}`.trim() : '—'
  const initials = s => s ? s.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'
  const f = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }))

  function filtered() {
    let data = rows.filter(r => {
      const matchSearch = ms([r.codigo, r.calle, r.poblacion, r.propietarios?.nombre, r.propietarios?.apellidos], search)
      const matchFiltro = filtro === 'todos' ? true : filtro === 'vigor' ? !r.fecha_baja : !!r.fecha_baja
      return matchSearch && matchFiltro
    })
    return sortData(data, (r, col) => {
      if (col === 'codigo') return r.codigo
      if (col === 'calle') return r.calle
      if (col === 'poblacion') return r.poblacion
      if (col === 'tipo') return r.tipo_inmueble?.tipo
      if (col === 'propietario') return propNombre(r.propietarios)
      if (col === 'seguro') return r.seguro?.compania
      return r[col]
    })
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>Inmuebles <span className="badge badge-gray" style={{ marginLeft: 6 }}>{filtered().length}</span></h2>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['vigor','En vigor'],['finalizados','Con baja'],['todos','Todos']].map(([v,l]) => (
              <button key={v} className={`btn btn-sm ${filtro === v ? 'btn-primary' : ''}`} onClick={() => setFiltro(v)}>{l}</button>
            ))}
          </div>
          <div className="search-input"><i className="ti ti-search" /><input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <button className="btn btn-sm" onClick={exportExcel} title="Exportar Excel"><i className="ti ti-file-spreadsheet" /> Excel</button>
          {!readOnly && <button className="btn btn-primary btn-sm" onClick={() => { setForm(EMPTY); setOtrosProps([]); setModal('new') }}><i className="ti ti-plus" /> Nuevo</button>}
        </div>
        <div className="table-wrap">
          {loading ? <div className="loading"><i className="ti ti-loader ti-spin" /> Cargando...</div> : (
            <table>
              <thead><tr>
                <th {...thProps('codigo')}>Código <span style={{fontSize:10}}>{sortIcon('codigo')}</span></th>
                <th {...thProps('calle')}>Dirección <span style={{fontSize:10}}>{sortIcon('calle')}</span></th>
                <th {...thProps('poblacion')}>Población <span style={{fontSize:10}}>{sortIcon('poblacion')}</span></th>
                <th {...thProps('tipo')}>Tipo <span style={{fontSize:10}}>{sortIcon('tipo')}</span></th>
                <th {...thProps('propietario')}>Propietario <span style={{fontSize:10}}>{sortIcon('propietario')}</span></th>
                <th {...thProps('seguro')}>Seguro <span style={{fontSize:10}}>{sortIcon('seguro')}</span></th>
              </tr></thead>
              <tbody>
                {filtered().map(r => (
                  <tr key={r.id}
                    onClick={() => selectRow(r)}
                    onDoubleClick={() => { selectRow(r); if (!readOnly) { setForm({ ...r, propietario_id: r.propietario_id || '', seguro_id: r.seguro_id || '', administrador_finca_id: r.administrador_finca_id || '', tipo_inmueble_id: r.tipo_inmueble_id || '' }); setOtrosProps((r.inmueble_propietarios || []).map(x => x.propietario_id)); setModal('edit') } }}
                    style={{ background: selected?.id === r.id ? 'var(--accent-bg)' : '' }}>
                    <td><strong style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.codigo}</strong></td>
                    <td>{r.calle}{r.numero_calle ? ` ${r.numero_calle}` : ''}{r.piso ? `, ${r.piso}` : ''}</td>
                    <td>{r.poblacion || '—'}</td>
                    <td>{r.tipo_inmueble?.tipo || '—'}</td>
                    <td>{propNombre(r.propietarios)}{(r.inmueble_propietarios || []).length > 0 && <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 10 }}>+{r.inmueble_propietarios.length}</span>}</td>
                    <td>{r.seguro?.compania ? <span className="badge badge-gray">{r.seguro.compania}</span> : '—'}</td>
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
              <div className="panel-avatar av-green">{initials(selected.codigo)}</div>
              <div style={{ flex: 1 }}>
                <h3>{selected.codigo}</h3>
                <div className="panel-sub">{selected.calle}{selected.piso ? `, ${selected.piso}` : ''}</div>
              </div>
              {!readOnly && <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ ...selected, propietario_id: selected.propietario_id || '', seguro_id: selected.seguro_id || '', administrador_finca_id: selected.administrador_finca_id || '', tipo_inmueble_id: selected.tipo_inmueble_id || '', fecha_baja: selected.fecha_baja || '' }); setOtrosProps((selected.inmueble_propietarios || []).map(x => x.propietario_id)); setModal('edit') }}><i className="ti ti-edit" /></button>}
              {!readOnly && <button className="btn btn-ghost btn-sm" onClick={() => del(selected.id)}><i className="ti ti-trash" style={{ color: 'var(--danger-text)' }} /></button>}
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="panel-body">
              <div className="field-section">Localización</div>
              <div className="field-grid">
                <div className="field"><label>Tipo inmueble</label><div className="val">{selected.tipo_inmueble?.tipo || '—'}</div></div>
                <div className="field"><label>Calle</label><div className="val">{selected.calle || '—'}</div></div>
                <div className="field"><label>Nº / Piso</label><div className="val">{[selected.numero_calle, selected.piso].filter(Boolean).join(', ') || '—'}</div></div>
                <div className="field"><label>Población</label><div className="val">{selected.poblacion || '—'}</div></div>
                <div className="field"><label>Provincia</label><div className="val">{selected.provincia || '—'}</div></div>
                <div className="field"><label>C.P.</label><div className="val">{selected.codigo_postal || '—'}</div></div>
                {selected.fecha_baja && <div className="field"><label>Fecha baja</label><div className="val" style={{ color: 'var(--danger-text)' }}>{fmtDate(selected.fecha_baja)}</div></div>}
              </div>
              <div className="field-section">Propietario y gestión</div>
              <div className="field-grid">
                <div className="field"><label>Propietario</label><div className="val">{propNombre(selected.propietarios)}</div></div>
                <div className="field"><label>Otros propietarios</label><div className="val">{(selected.inmueble_propietarios || []).length > 0 ? selected.inmueble_propietarios.map(x => propNombre(x.propietarios)).join(', ') : '—'}</div></div>
                <div className="field"><label>Adm. finca</label><div className="val">{selected.administrador_finca?.nombre || '—'}</div></div>
                <div className="field"><label>Seguro hogar</label><div className="val">{selected.seguro?.compania || '—'}</div></div>
                <div className="field"><label>Nº póliza</label><div className="val">{selected.num_poliza_seg_hogar || '—'}</div></div>
              </div>
              <div className="field-section">Datos registrales</div>
              <div className="field-grid">
                <div className="field"><label>Registro</label><div className="val">{selected.registro || '—'}</div></div>
                <div className="field"><label>Finca registral</label><div className="val">{selected.num_finca_registral_vivienda || '—'}</div></div>
                <div className="field"><label>CRU</label><div className="val">{selected.cru || '—'}</div></div>
                <div className="field"><label>Catastro</label><div className="val">{selected.num_catastro_vivienda || '—'}</div></div>
              </div>
              <div className="field-section">Suministros</div>
              <div className="field-grid">
                <div className="field"><label>Cía. eléctrica</label><div className="val">{selected.cia_electrica || '—'}</div></div>
                <div className="field"><label>CUPS elect.</label><div className="val" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{selected.cups_electricidad || '—'}</div></div>
                <div className="field field-full"><label>Titular elect.</label><div className="val">{selected.titular_contrato_electricidad || '—'}</div></div>
                <div className="field"><label>Cía. gas</label><div className="val">{selected.cia_gas || '—'}</div></div>
                <div className="field"><label>CUPS gas</label><div className="val" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{selected.cups_gas || '—'}</div></div>
                <div className="field field-full"><label>Titular gas</label><div className="val">{selected.titular_contrato_gas || '—'}</div></div>
                <div className="field"><label>Cía. agua</label><div className="val">{selected.cia_agua || '—'}</div></div>
                <div className="field"><label>Nº contrato agua</label><div className="val">{selected.num_contrato_agua || '—'}</div></div>
                <div className="field field-full"><label>Titular agua</label><div className="val">{selected.titular_contrato_agua || '—'}</div></div>
              </div>
              <div className="field-section">Garajes y trastero</div>
              <div className="field-grid">
                <div className="field"><label>Garaje 1</label><div className="val">{selected.num_garaje_1 || '—'}</div></div>
                <div className="field"><label>Garaje 2</label><div className="val">{selected.num_garaje_2 || '—'}</div></div>
                <div className="field"><label>Trastero</label><div className="val">{selected.num_trastero || '—'}</div></div>
              </div>
              {selected.carpeta_dropbox && <>
                <div className="field-section">Enlace</div>
                <a href={selected.carpeta_dropbox} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }}><i className="ti ti-folder" /> Carpeta Dropbox</a>
              </>}
              <div className="field-section">Documentos</div>
              <Documentos entidadTipo="inmueble" entidadId={selected.id} readOnly={readOnly} />
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
        </>
      )}

      {modal && (
        <div className={modal === 'edit' && selected ? "edit-modal-overlay" : "modal-overlay"} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2>{modal === 'new' ? 'Nuevo inmueble' : `Editar — ${form.codigo}`}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group"><label>Código *</label><input value={form.codigo ?? ''} onChange={f('codigo')} /></div>
                <div className="form-group"><label>Propietario</label>
                  <SearchSelect
                    options={propietarios.map(p => ({ id: p.id, label: propNombre(p) }))}
                    value={form.propietario_id}
                    onChange={v => setForm(prev => ({ ...prev, propietario_id: v }))}
                    placeholder="Buscar propietario..."
                  />
                </div>
                <div className="form-group"><label>Otros propietarios</label>
                  <SearchSelect
                    options={propietarios.filter(p => String(p.id) !== String(form.propietario_id ?? '') && !otrosProps.some(x => String(x) === String(p.id))).map(p => ({ id: p.id, label: propNombre(p) }))}
                    value={''}
                    onChange={v => { if (v) setOtrosProps(prev => prev.some(x => String(x) === String(v)) ? prev : [...prev, v]) }}
                    placeholder="Buscar propietario..."
                    emptyLabel="— Añadir propietario —"
                  />
                  {otrosProps.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {otrosProps.map(pid => {
                        const p = propietarios.find(x => String(x.id) === String(pid))
                        return (
                          <span key={pid} className="badge badge-gray" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {p ? propNombre(p) : pid}
                            <i className="ti ti-x" style={{ cursor: 'pointer' }} onClick={() => setOtrosProps(prev => prev.filter(x => String(x) !== String(pid)))} />
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="form-group"><label>Tipo inmueble</label>
                  <select value={form.tipo_inmueble_id ?? ''} onChange={f('tipo_inmueble_id')}>
                    <option value="">—</option>
                    {tiposInmueble.map(t => <option key={t.id} value={t.id}>{t.tipo}</option>)}
                  </select>
                </div>
                <div className="form-section-title">Localización</div>
                <div className="form-group form-full"><label>Calle</label><input value={form.calle ?? ''} onChange={f('calle')} /></div>
                <div className="form-group"><label>Número</label><input value={form.numero_calle ?? ''} onChange={f('numero_calle')} /></div>
                <div className="form-group"><label>Piso / Puerta</label><input value={form.piso ?? ''} onChange={f('piso')} /></div>
                <div className="form-group"><label>Población</label><input value={form.poblacion ?? ''} onChange={f('poblacion')} /></div>
                <div className="form-group"><label>Provincia</label><input value={form.provincia ?? ''} onChange={f('provincia')} /></div>
                <div className="form-group"><label>Código postal</label><input value={form.codigo_postal ?? ''} onChange={f('codigo_postal')} /></div>
                <div className="form-group"><label>Fecha baja</label><input type="date" value={form.fecha_baja ?? ''} onChange={f('fecha_baja')} /></div>
                <div className="form-section-title">Gestión</div>
                <div className="form-group"><label>Administrador de finca</label>
                  <SearchSelect
                    options={admFincas.map(a => ({ id: a.id, label: a.nombre }))}
                    value={form.administrador_finca_id}
                    onChange={v => setForm(prev => ({ ...prev, administrador_finca_id: v }))}
                    placeholder="Buscar administrador..."
                    emptyLabel="— Sin administrador —"
                  />
                </div>
                <div className="form-group"><label>Seguro hogar</label>
                  <select value={form.seguro_id ?? ''} onChange={f('seguro_id')}>
                    <option value="">—</option>
                    {seguros.map(s => <option key={s.id} value={s.id}>{s.compania}</option>)}
                  </select>
                </div>
                <div className="form-group form-full"><label>Nº póliza</label><input value={form.num_poliza_seg_hogar ?? ''} onChange={f('num_poliza_seg_hogar')} /></div>
                <div className="form-section-title">Datos registrales</div>
                <div className="form-group"><label>Registro</label><input value={form.registro ?? ''} onChange={f('registro')} /></div>
                <div className="form-group"><label>Nº finca registral</label><input value={form.num_finca_registral_vivienda ?? ''} onChange={f('num_finca_registral_vivienda')} /></div>
                <div className="form-group"><label>CRU</label><input value={form.cru ?? ''} onChange={f('cru')} /></div>
                <div className="form-group"><label>Referencia catastral</label><input value={form.num_catastro_vivienda ?? ''} onChange={f('num_catastro_vivienda')} /></div>
                <div className="form-section-title">Suministros — Electricidad</div>
                <div className="form-group"><label>Compañía</label><input value={form.cia_electrica ?? ''} onChange={f('cia_electrica')} /></div>
                <div className="form-group"><label>Nº contrato</label><input value={form.num_contrato_electricidad ?? ''} onChange={f('num_contrato_electricidad')} /></div>
                <div className="form-group"><label>CUPS</label><input value={form.cups_electricidad ?? ''} onChange={f('cups_electricidad')} /></div>
                <div className="form-group"><label>Titular</label><input value={form.titular_contrato_electricidad ?? ''} onChange={f('titular_contrato_electricidad')} /></div>
                <div className="form-section-title">Suministros — Gas</div>
                <div className="form-group"><label>Compañía</label><input value={form.cia_gas ?? ''} onChange={f('cia_gas')} /></div>
                <div className="form-group"><label>Nº contrato</label><input value={form.num_contrato_gas ?? ''} onChange={f('num_contrato_gas')} /></div>
                <div className="form-group"><label>CUPS</label><input value={form.cups_gas ?? ''} onChange={f('cups_gas')} /></div>
                <div className="form-group"><label>Titular</label><input value={form.titular_contrato_gas ?? ''} onChange={f('titular_contrato_gas')} /></div>
                <div className="form-section-title">Suministros — Agua</div>
                <div className="form-group"><label>Compañía</label><input value={form.cia_agua ?? ''} onChange={f('cia_agua')} /></div>
                <div className="form-group"><label>Nº contrato</label><input value={form.num_contrato_agua ?? ''} onChange={f('num_contrato_agua')} /></div>
                <div className="form-group form-full"><label>Titular</label><input value={form.titular_contrato_agua ?? ''} onChange={f('titular_contrato_agua')} /></div>
                <div className="form-section-title">Garajes y trastero</div>
                <div className="form-group"><label>Garaje 1</label><input value={form.num_garaje_1 ?? ''} onChange={f('num_garaje_1')} /></div>
                <div className="form-group"><label>Garaje 2</label><input value={form.num_garaje_2 ?? ''} onChange={f('num_garaje_2')} /></div>
                <div className="form-group"><label>Trastero</label><input value={form.num_trastero ?? ''} onChange={f('num_trastero')} /></div>
                <div className="form-section-title">Enlace</div>
                <div className="form-group form-full"><label>Carpeta Dropbox (URL)</label><input value={form.carpeta_dropbox ?? ''} onChange={f('carpeta_dropbox')} placeholder="https://..." /></div>
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

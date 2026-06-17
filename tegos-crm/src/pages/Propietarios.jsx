import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCtrlG } from '../lib/useCtrlG'
import { supabase } from '../lib/supabase'
import Documentos from '../components/Documentos.jsx'
import Correos from '../components/Correos.jsx'
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

function mailLink(v) {
  return v ? <a href={`mailto:${v}`} style={{ color: 'var(--info-text)' }}>{v}</a> : '—'
}
function waLink(v) {
  if (!v) return '—'
  let d = String(v).replace(/[^\d+]/g, '')
  if (d.startsWith('+')) d = d.slice(1)
  else if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 9) d = '34' + d
  return <a href={`https://wa.me/${d}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info-text)' }}>{v}</a>
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
  const readOnly = perfil?.rol === 'visor'
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [acciones, setAcciones] = useState([])
  const [tiposContacto, setTiposContacto] = useState([])
  const [tabProp, setTabProp] = useState('datos')
  const [nuevaAccion, setNuevaAccion] = useState(null)
  const [guardandoAccion, setGuardandoAccion] = useState(false)

  useEffect(() => { load() }, [])
  useEffect(() => { if (modal) { setTabProp('datos'); setNuevaAccion(null) } }, [modal])
  useCtrlG(save, !!modal)

  async function load() {
    setLoading(true)
    const [{ data: props }, { data: tipos }, { data: resps }, { data: tc }] = await Promise.all([
      (() => {
        let q = supabase.from('propietarios').select('*, tipo_persona(tipo), responsable(nombre_responsable)').order('nombre')
        if (perfil?.rol === 'propietario' && perfil?.propietario_id) q = q.eq('id', perfil.propietario_id)
        return q
      })(),
      supabase.from('tipo_persona').select('*'),
      supabase.from('responsable').select('*'),
      supabase.from('tipo_contacto').select('*'),
    ])
    const listaProp = props || []
    setRows(listaProp)
    const sel = searchParams.get('sel')
    if (sel) {
      const encontrado = listaProp.find(r => String(r.id) === String(sel))
      if (encontrado) selectRow(encontrado)
      setSearchParams({}, { replace: true })
    }
    setTipos(tipos || [])
    setResponsables(resps || [])
    setTiposContacto(tc || [])
    setLoading(false)
  }

  async function selectRow(row) {
    setSelected(row)
    const [{ data: dir }, { data: co }] = await Promise.all([
      supabase.from('inmuebles').select('id, codigo, calle, piso').eq('propietario_id', row.id),
      supabase.from('inmueble_propietarios').select('inmuebles(id, codigo, calle, piso)').eq('propietario_id', row.id),
    ])
    const extra = (co || []).map(x => x.inmuebles).filter(Boolean).filter(e => !(dir || []).some(d => d.id === e.id))
    setInmuebles([...(dir || []), ...extra])
    loadAcciones(row.id)
  }

  async function loadAcciones(propietarioId) {
    const { data } = await supabase.from('accion_propietario').select('*, responsable(nombre_responsable), tipo_contacto(tipo_contacto)').eq('propietario_id', propietarioId).order('fecha', { ascending: false })
    setAcciones(data || [])
  }

  async function guardarAccion() {
    if (!form.id) return
    if (!nuevaAccion?.fecha) { alert('Indica la fecha de la acción'); return }
    setGuardandoAccion(true)
    const { error } = await supabase.from('accion_propietario').insert({
      propietario_id: form.id,
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
    await supabase.from('accion_propietario').update({ completada: true }).eq('id', id)
    if (form.id) loadAcciones(form.id)
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

  async function exportExcel() {
    const ids = rows.map(r => r.id)
    const [{ data: todosInmuebles }, { data: coInmuebles }] = await Promise.all([
      supabase.from('inmuebles').select('propietario_id, codigo, calle, piso, municipio, provincia').in('propietario_id', ids),
      supabase.from('inmueble_propietarios').select('propietario_id, inmuebles(codigo, calle, piso, municipio, provincia)').in('propietario_id', ids),
    ])

    const inmueblesPorPropietario = {}
    ;(todosInmuebles || []).forEach(i => {
      if (!inmueblesPorPropietario[i.propietario_id]) inmueblesPorPropietario[i.propietario_id] = []
      inmueblesPorPropietario[i.propietario_id].push(i)
    })
    ;(coInmuebles || []).forEach(x => {
      if (!x.inmuebles) return
      if (!inmueblesPorPropietario[x.propietario_id]) inmueblesPorPropietario[x.propietario_id] = []
      if (!inmueblesPorPropietario[x.propietario_id].some(i => i.codigo === x.inmuebles.codigo)) inmueblesPorPropietario[x.propietario_id].push(x.inmuebles)
    })

    const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES') : ''

    const data = filtered().map(r => {
      const inms = inmueblesPorPropietario[r.id] || []
      const inmsStr = inms.map(i => [i.codigo, i.calle, i.piso, i.municipio, i.provincia].filter(Boolean).join(' ')).join(' | ')
      return {
        'Nombre': r.nombre || '',
        'Apellidos': r.apellidos || '',
        'DNI / CIF': r.dni_cif || '',
        'Tipo': r.tipo_persona?.tipo || '',
        'Responsable': r.responsable?.nombre_responsable || '',
        'Teléfono': r.telefono || '',
        'Teléfono 2': r.telefono_2 || '',
        'Móvil': r.movil || '',
        'Email': r.email || '',
        'Email 2': r.email_2 || '',
        'Dirección': r.calle || '',
        'Municipio': r.municipio || '',
        'Provincia': r.provincia || '',
        'Código postal': r.cod_postal || '',
        'Fecha baja': fmtDate(r.fecha_baja),
        'Nombre cónyuge': r.nombre_conyuge || '',
        'Apellidos cónyuge': r.apellidos_conyuge || '',
        'DNI cónyuge': r.dni_conyuge || '',
        'Móvil cónyuge': r.movil_conyuge || '',
        'Email cónyuge': r.email_conyuge || '',
        'Teléfono 2 cónyuge': r.telefono_2_conyuge || '',
        'Email 2 cónyuge': r.email_2_conyuge || '',
        'Otra persona contacto': r.otra_persona_contacto || '',
        'Relación otra persona': r.relacion_otra_persona || '',
        'Móvil otra persona': r.movil_otra_persona || '',
        'Email otra persona': r.email_otra_persona || '',
        'Observaciones': r.observaciones || '',
        'Inmuebles': inmsStr,
      }
    })

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Propietarios')
    XLSX.writeFile(wb, 'Propietarios.xlsx')
  }

  const nombre = r => `${r.nombre || ''} ${r.apellidos || ''}`.trim() || '—'
  const initials = r => nombre(r).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES') : '—'
  const f = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }))

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
          <button className="btn btn-sm" onClick={exportExcel} title="Exportar Excel"><i className="ti ti-file-spreadsheet" /> Excel</button>
          {!readOnly && <button className="btn btn-primary btn-sm" onClick={() => { setForm(EMPTY); setModal('new') }}><i className="ti ti-plus" /> Nuevo</button>}
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
                    onDoubleClick={() => { selectRow(r); if (!readOnly) { setForm({ ...r, tipo_id: r.tipo_id || '', responsable_id: r.responsable_id || '', fecha_baja: r.fecha_baja || '' }); setModal('edit') } }}>
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
              {!readOnly && <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ ...selected, tipo_id: selected.tipo_id || '', responsable_id: selected.responsable_id || '', fecha_baja: selected.fecha_baja || '' }); setModal('edit') }}><i className="ti ti-edit" /></button>}
              {!readOnly && <button className="btn btn-ghost btn-sm" onClick={() => del(selected.id)}><i className="ti ti-trash" style={{ color: 'var(--danger-text)' }} /></button>}
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="panel-body">
              <div className="field-section">Datos personales</div>
              <div className="field-grid">
                <div className="field"><label>DNI / CIF</label><div className="val">{selected.dni_cif || '—'}</div></div>
                <div className="field"><label>Responsable</label><div className="val">{selected.responsable?.nombre_responsable || '—'}</div></div>
                <div className="field"><label>Teléfono</label><div className="val">{waLink(selected.telefono)}</div></div>
                <div className="field"><label>Teléfono 2</label><div className="val">{waLink(selected.telefono_2)}</div></div>
                <div className="field"><label>Móvil</label><div className="val">{waLink(selected.movil)}</div></div>
                <div className="field"><label>Email</label><div className="val">{mailLink(selected.email)}</div></div>
                <div className="field field-full"><label>Email 2</label><div className="val">{mailLink(selected.email_2)}</div></div>
                <div className="field field-full"><label>Dirección</label><div className="val">{[selected.calle, selected.municipio, selected.provincia, selected.cod_postal].filter(Boolean).join(', ') || '—'}</div></div>
                {selected.fecha_baja && <div className="field"><label>Fecha baja</label><div className="val" style={{ color: 'var(--danger-text)' }}>{fmtDate(selected.fecha_baja)}</div></div>}
              </div>
              {(selected.nombre_conyuge || selected.movil_conyuge) && <>
                <div className="field-section">Cónyuge</div>
                <div className="field-grid">
                  <div className="field"><label>Nombre</label><div className="val">{`${selected.nombre_conyuge || ''} ${selected.apellidos_conyuge || ''}`.trim() || '—'}</div></div>
                  <div className="field"><label>Móvil</label><div className="val">{waLink(selected.movil_conyuge)}</div></div>
                  <div className="field"><label>Email</label><div className="val">{mailLink(selected.email_conyuge)}</div></div>
                  <div className="field"><label>Email 2</label><div className="val">{mailLink(selected.email_2_conyuge)}</div></div>
                  <div className="field"><label>Teléfono 2</label><div className="val">{waLink(selected.telefono_2_conyuge)}</div></div>
                </div>
              </>}
              {selected.otra_persona_contacto && <>
                <div className="field-section">Otra persona de contacto</div>
                <div className="field-grid">
                  <div className="field"><label>Nombre</label><div className="val">{selected.otra_persona_contacto}</div></div>
                  <div className="field"><label>Relación</label><div className="val">{selected.relacion_otra_persona || '—'}</div></div>
                  <div className="field"><label>Móvil</label><div className="val">{waLink(selected.movil_otra_persona)}</div></div>
                  <div className="field"><label>Email</label><div className="val">{mailLink(selected.email_otra_persona)}</div></div>
                </div>
              </>}
              <div className="field-section">Inmuebles asignados</div>
              {inmuebles.length === 0 ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Sin inmuebles</div> : (
                inmuebles.map(i => (
                  <div key={i.id} onClick={() => navigate(`/inmuebles?sel=${i.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                    <i className="ti ti-building" style={{ color: 'var(--brand)' }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, color: 'var(--info-text)' }}>{i.codigo}</span>
                    <span style={{ color: 'var(--text2)', fontSize: 13 }}>{i.calle}{i.piso ? `, ${i.piso}` : ''}</span>
                  </div>
                ))
              )}
              <div className="field-section">Documentos</div>
              <Documentos entidadTipo="propietario" entidadId={selected.id} readOnly={readOnly} />
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
              <h2>{modal === 'new' ? 'Nuevo propietario' : `Editar — ${nombre(form)}`}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              {modal === 'edit' && form.id && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                  {[['datos','Datos'],['acc',`Acciones (${acciones.length})`],['docs','Documentos'],['correos','Correos']].map(([v,l]) => (
                    <button key={v} className={`btn btn-sm ${tabProp === v ? 'btn-tab-active' : ''}`} onClick={() => setTabProp(v)}>{l}</button>
                  ))}
                </div>
              )}
              {modal === 'edit' && tabProp === 'acc' && accionesTab}
              {modal === 'edit' && tabProp === 'docs' && <Documentos entidadTipo="propietario" entidadId={form.id} readOnly={readOnly} />}
              {modal === 'edit' && tabProp === 'correos' && <Correos entidadTipo="propietario" entidadId={form.id} email={form.email} readOnly={readOnly} />}
              {(modal !== 'edit' || tabProp === 'datos') && <div className="form-grid">
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
                <div className="form-group form-full"><label>Dirección</label><input value={form.calle ?? ''} onChange={f('calle')} placeholder="Calle, número, piso/puerta" /></div>
                <div className="form-group"><label>Municipio</label><input value={form.municipio ?? ''} onChange={f('municipio')} /></div>
                <div className="form-group"><label>Provincia</label><input value={form.provincia ?? ''} onChange={f('provincia')} /></div>
                <div className="form-group"><label>Código postal</label><input value={form.cod_postal ?? ''} onChange={f('cod_postal')} /></div>
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
              </div>}
              {(modal !== 'edit' || tabProp === 'datos') && <div className="form-actions">
                <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={save}>Guardar</button>
              </div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

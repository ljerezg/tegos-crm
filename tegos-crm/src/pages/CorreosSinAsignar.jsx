import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import SearchSelect from '../components/SearchSelect.jsx'

const TIPOS = [
  { tipo: 'inquilino', col: 'inquilino_id', tabla: 'inquilinos', label: 'Inquilino' },
  { tipo: 'propietario', col: 'propietario_id', tabla: 'propietarios', label: 'Propietario' },
  { tipo: 'contacto', col: 'contacto_id', tabla: 'persona_contacto', label: 'Contacto' },
]

export default function CorreosSinAsignar({ perfil }) {
  const readOnly = perfil?.rol === 'visor'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [opciones, setOpciones] = useState({ inquilino: [], propietario: [], contacto: [] })
  const [sel, setSel] = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: correos }, { data: inq }, { data: prop }, { data: cont }] = await Promise.all([
      supabase.from('correo').select('*').is('inquilino_id', null).is('propietario_id', null).is('contacto_id', null).order('fecha', { ascending: false }).order('id', { ascending: false }),
      supabase.from('inquilinos').select('id, nombre, apellidos').order('nombre'),
      supabase.from('propietarios').select('id, nombre, apellidos').order('nombre'),
      supabase.from('persona_contacto').select('id, nombre, apellidos').order('nombre'),
    ])
    const lbl = r => `${r.nombre || ''} ${r.apellidos || ''}`.trim() || '(sin nombre)'
    setOpciones({
      inquilino: (inq || []).map(r => ({ id: r.id, label: lbl(r) })),
      propietario: (prop || []).map(r => ({ id: r.id, label: lbl(r) })),
      contacto: (cont || []).map(r => ({ id: r.id, label: lbl(r) })),
    })
    setRows(correos || [])
    setLoading(false)
  }

  function setSelRow(id, patch) { setSel(s => ({ ...s, [id]: { ...s[id], ...patch } })) }

  async function asignar(row) {
    const s = sel[row.id] || {}
    const tipo = s.tipo || 'inquilino'
    const def = TIPOS.find(t => t.tipo === tipo)
    if (!s.entidadId) return alert('Selecciona a quién asignar el correo')
    const { error } = await supabase.from('correo').update({ [def.col]: s.entidadId }).eq('id', row.id)
    if (error) return alert('Error: ' + error.message)
    load()
  }

  async function eliminar(row) {
    if (!confirm('¿Eliminar este correo?')) return
    await supabase.from('correo').delete().eq('id', row.id)
    load()
  }

  const fmt = d => d ? new Date(d).toLocaleDateString('es-ES') : ''

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>Correos sin asignar <span className="badge badge-gray" style={{ marginLeft: 6 }}>{rows.length}</span></h2>
          <button className="btn btn-ghost btn-sm" onClick={load}><i className="ti ti-refresh" /> Actualizar</button>
        </div>
        <div style={{ padding: 16 }}>
          {loading ? <div className="loading"><i className="ti ti-loader ti-spin" /> Cargando...</div> : (
            rows.length === 0
              ? <div style={{ color: 'var(--text3)', fontSize: 14, padding: 12 }}>No hay correos pendientes de asignar 🎉</div>
              : rows.map(r => {
                const s = sel[r.id] || {}
                const tipo = s.tipo || 'inquilino'
                return (
                  <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span className={`badge ${r.sentido === 'recibido' ? 'badge-blue' : 'badge-green'}`}>{r.sentido === 'recibido' ? 'Recibido' : 'Enviado'}</span>
                      <strong style={{ fontSize: 14 }}>{r.asunto || '(sin asunto)'}</strong>
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>{fmt(r.fecha)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                      {r.remitente && <div><strong>De:</strong> {r.remitente}</div>}
                      {r.destinatario && <div><strong>Para:</strong> {r.destinatario}</div>}
                    </div>
                    {r.cuerpo && <div style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'pre-wrap', marginTop: 6, maxHeight: 120, overflow: 'auto', background: 'var(--bg)', padding: 8, borderRadius: 'var(--radius-sm)' }}>{r.cuerpo}</div>}
                    {r.archivo_url && <div style={{ marginTop: 6 }}><a href={r.archivo_url} target="_blank" rel="noreferrer" style={{ color: 'var(--info-text)', fontSize: 12 }}><i className="ti ti-paperclip" /> {r.archivo_nombre || 'adjunto'}</a></div>}
                    {!readOnly && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <select value={tipo} onChange={e => setSelRow(r.id, { tipo: e.target.value, entidadId: '' })} style={{ maxWidth: 150 }}>
                          {TIPOS.map(t => <option key={t.tipo} value={t.tipo}>{t.label}</option>)}
                        </select>
                        <div style={{ minWidth: 240, flex: 1, maxWidth: 360 }}>
                          <SearchSelect options={opciones[tipo]} value={s.entidadId || ''} onChange={v => setSelRow(r.id, { entidadId: v })} placeholder="Buscar..." emptyLabel="— Selecciona —" />
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={() => asignar(r)}><i className="ti ti-check" /> Asignar</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => eliminar(r)} title="Eliminar"><i className="ti ti-trash" style={{ color: 'var(--danger-text)' }} /></button>
                      </div>
                    )}
                  </div>
                )
              })
          )}
        </div>
      </div>
    </div>
  )
}

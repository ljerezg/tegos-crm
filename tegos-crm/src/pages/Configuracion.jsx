import { useEffect, useState } from 'react'
import { useCtrlG } from '../lib/useCtrlG'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

const TABLAS_BACKUP = ['inmuebles', 'propietarios', 'inquilinos', 'inmueble_propietarios', 'persona_contacto', 'administrador_finca', 'accion_inmueble', 'accion_inquilino', 'accion_persona_contacto', 'inmuebles_comercializando', 'documento', 'seguro', 'tipo_persona', 'tipo_inmueble', 'tipo_contacto', 'responsable', 'conocimiento', 'clasificacion_contacto', 'perfil_usuario', 'usuario_inmuebles']

function CopiaSeguridad() {
  const [generando, setGenerando] = useState(false)
  const [resumen, setResumen] = useState(null)

  async function generar() {
    setGenerando(true)
    setResumen(null)
    try {
      const wb = XLSX.utils.book_new()
      let total = 0
      const fallidas = []
      for (const tabla of TABLAS_BACKUP) {
        const { data, error } = await supabase.from(tabla).select('*')
        if (error) { fallidas.push(tabla); continue }
        const filas = data || []
        total += filas.length
        const ws = filas.length > 0 ? XLSX.utils.json_to_sheet(filas) : XLSX.utils.aoa_to_sheet([['(sin datos)']])
        XLSX.utils.book_append_sheet(wb, ws, tabla.slice(0, 31))
      }
      const ahora = new Date()
      const fecha = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}_${String(ahora.getHours()).padStart(2, '0')}${String(ahora.getMinutes()).padStart(2, '0')}`
      XLSX.writeFile(wb, `copia_seguridad_tegos_${fecha}.xlsx`)
      setResumen({ total, hojas: wb.SheetNames.length, fallidas })
    } catch (e) {
      alert('Error al generar la copia: ' + e.message)
    }
    setGenerando(false)
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <h2>Copia de seguridad</h2>
        <button className="btn btn-primary btn-sm" onClick={generar} disabled={generando}>
          {generando ? <><i className="ti ti-loader ti-spin" /> Generando...</> : <><i className="ti ti-database-export" /> Descargar copia</>}
        </button>
      </div>
      <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text2)' }}>
        <p style={{ margin: 0 }}>Descarga un archivo Excel con todos los datos de la base de datos: una hoja por tabla ({TABLAS_BACKUP.length} tablas). Guárdalo en un lugar seguro (Dropbox, disco externo...).</p>
        {resumen && (
          <p style={{ margin: '10px 0 0', color: 'var(--accent)' }}>
            <i className="ti ti-check" /> Copia generada: {resumen.total} registros en {resumen.hojas} hojas.
            {resumen.fallidas.length > 0 && <span style={{ color: 'var(--danger-text)' }}> No se pudieron leer: {resumen.fallidas.join(', ')}</span>}
          </p>
        )}
      </div>
    </div>
  )
}

function TablaAuxiliar({ titulo, tabla, campoNombre, columnas }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({})
  const [modal, setModal] = useState(null)

  useEffect(() => { load() }, [tabla])
  useCtrlG(save, !!modal)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from(tabla).select('*').order('id')
    setRows(data || [])
    setLoading(false)
  }

  async function save() {
    const data = { ...form }
    Object.keys(data).forEach(k => { if (data[k] === '') data[k] = null })
    let error
    if (modal === 'new') {
      const res = await supabase.from(tabla).insert(data)
      error = res.error
    } else {
      const { id, ...updateData } = data
      const res = await supabase.from(tabla).update(updateData).eq('id', form.id)
      error = res.error
    }
    if (error) { alert('Error: ' + error.message); return }
    setModal(null); load()
  }

  async function del(id) {
    if (!confirm('¿Eliminar este registro?')) return
    await supabase.from(tabla).delete().eq('id', id)
    load()
  }

  const EMPTY = columnas.reduce((acc, c) => ({ ...acc, [c.field]: '' }), {})

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <h2>{titulo} <span className="badge badge-gray" style={{ marginLeft: 6 }}>{rows.length}</span></h2>
        <button className="btn btn-primary btn-sm" onClick={() => { setForm(EMPTY); setModal('new') }}>
          <i className="ti ti-plus" /> Nuevo
        </button>
      </div>
      <div className="table-wrap">
        {loading ? <div className="loading"><i className="ti ti-loader ti-spin" /> Cargando...</div> : (
          <table>
            <thead>
              <tr>
                {columnas.map(c => <th key={c.field}>{c.label}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={columnas.length + 1} style={{ textAlign: 'center', color: 'var(--text3)', padding: 20 }}>Sin registros</td></tr>}
              {rows.map(r => (
                <tr key={r.id}>
                  {columnas.map(c => <td key={c.field}>{r[c.field] || '—'}</td>)}
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ ...r }); setModal('edit') }}><i className="ti ti-edit" /></button>
                    <button className="btn btn-ghost btn-sm" onClick={() => del(r.id)}><i className="ti ti-trash" style={{ color: 'var(--danger-text)' }} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ width: 480 }}>
            <div className="modal-header">
              <h2>{modal === 'new' ? `Nuevo — ${titulo}` : `Editar — ${titulo}`}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                {columnas.map(c => (
                  <div key={c.field} className={`form-group ${c.full ? 'form-full' : ''}`}>
                    <label>{c.label}</label>
                    <input value={form[c.field] || ''} onChange={e => setForm({ ...form, [c.field]: e.target.value })} />
                  </div>
                ))}
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

export default function Configuracion() {
  const [tab, setTab] = useState('responsables')

  const tabs = [
    { id: 'responsables', label: 'Responsables' },
    { id: 'seguros', label: 'Seguros' },
    { id: 'tipo_inmueble', label: 'Tipos de inmueble' },
    { id: 'tipo_contacto', label: 'Tipos de contacto' },
    { id: 'clasificacion', label: 'Clasificaciones' },
    { id: 'conocimiento', label: 'Orígenes' },
    { id: 'backup', label: 'Copia de seguridad' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} className={`btn ${tab === t.id ? 'btn-primary' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'responsables' && (
        <TablaAuxiliar
          titulo="Responsables"
          tabla="responsable"
          columnas={[{ field: 'nombre_responsable', label: 'Nombre', full: true }]}
        />
      )}

      {tab === 'seguros' && (
        <TablaAuxiliar
          titulo="Compañías de seguros"
          tabla="seguro"
          columnas={[
            { field: 'compania', label: 'Compañía' },
            { field: 'persona_contacto', label: 'Contacto' },
            { field: 'telefono_1', label: 'Teléfono 1' },
            { field: 'telefono_2', label: 'Teléfono 2' },
            { field: 'correo_1', label: 'Email' },
          ]}
        />
      )}

      {tab === 'tipo_inmueble' && (
        <TablaAuxiliar
          titulo="Tipos de inmueble"
          tabla="tipo_inmueble"
          columnas={[{ field: 'tipo', label: 'Tipo', full: true }]}
        />
      )}

      {tab === 'tipo_contacto' && (
        <TablaAuxiliar
          titulo="Tipos de contacto"
          tabla="tipo_contacto"
          columnas={[{ field: 'tipo_contacto', label: 'Tipo', full: true }]}
        />
      )}

      {tab === 'clasificacion' && (
        <TablaAuxiliar
          titulo="Clasificaciones de contacto"
          tabla="clasificacion_contacto"
          columnas={[{ field: 'clasificacion', label: 'Clasificación', full: true }]}
        />
      )}

      {tab === 'conocimiento' && (
        <TablaAuxiliar
          titulo="Orígenes de conocimiento"
          tabla="conocimiento"
          columnas={[{ field: 'origen', label: 'Origen', full: true }]}
        />
      )}

      {tab === 'backup' && <CopiaSeguridad />}
    </div>
  )
}

import { useEffect, useState, useRef } from 'react'
import { subirDocumento, obtenerDocumentos, eliminarDocumento } from '../lib/documentos'

export default function Documentos({ entidadTipo, entidadId, readOnly }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [nombre, setNombre] = useState('')
  const [showForm, setShowForm] = useState(false)
  const fileRef = useRef()

  useEffect(() => { if (entidadId) cargar() }, [entidadId])

  async function cargar() {
    setLoading(true)
    try {
      const data = await obtenerDocumentos(entidadTipo, entidadId)
      setDocs(data)
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  async function subir() {
    const file = fileRef.current?.files[0]
    if (!file || !nombre.trim()) return alert('Indica el nombre del documento y selecciona un archivo')
    setUploading(true)
    try {
      await subirDocumento(file, entidadTipo, entidadId, nombre.trim())
      setNombre(''); fileRef.current.value = ''; setShowForm(false)
      cargar()
    } catch(e) { alert('Error al subir: ' + e.message) }
    setUploading(false)
  }

  async function eliminar(doc) {
    if (!confirm(`¿Eliminar "${doc.nombre}"?`)) return
    try { await eliminarDocumento(doc); cargar() }
    catch(e) { alert('Error al eliminar: ' + e.message) }
  }

  const iconDoc = url => {
    const ext = url.split('.').pop().toLowerCase()
    if (ext === 'pdf') return 'ti-file-type-pdf'
    if (['doc','docx'].includes(ext)) return 'ti-file-type-doc'
    if (['jpg','jpeg','png'].includes(ext)) return 'ti-photo'
    return 'ti-file'
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{docs.length} documento{docs.length !== 1 ? 's' : ''}</span>
        {!readOnly && <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(!showForm)}>
          <i className="ti ti-plus" /> Añadir
        </button>}
      </div>

      {showForm && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 12 }}>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label>Nombre del documento</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Contrato 2024, Fianza IVIMA..." />
          </div>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label>Archivo (PDF, Word, imagen...)</label>
            <input type="file" ref={fileRef} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" style={{ fontSize: 13 }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={subir} disabled={uploading}>
              {uploading ? <><i className="ti ti-loader ti-spin" /> Subiendo...</> : <><i className="ti ti-upload" /> Subir</>}
            </button>
          </div>
        </div>
      )}

      {loading ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Cargando...</div> : (
        docs.length === 0
          ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Sin documentos</div>
          : docs.map(doc => (
            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <i className={`ti ${iconDoc(doc.url_archivo)}`} style={{ color: 'var(--accent)', fontSize: 20, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.nombre}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{doc.tamano} · {new Date(doc.created_at).toLocaleDateString('es-ES')}</div>
              </div>
              <a href={doc.url_archivo} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" title="Abrir">
                <i className="ti ti-external-link" />
              </a>
              {!readOnly && <button className="btn btn-ghost btn-sm" title="Eliminar" onClick={() => eliminar(doc)}>
                <i className="ti ti-trash" style={{ color: 'var(--danger-text)' }} />
              </button>}
            </div>
          ))
      )}
    </div>
  )
}

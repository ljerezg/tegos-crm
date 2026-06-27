import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const BUCKET = 'documentos-tegos'
const COL = { inquilino: 'inquilino_id', propietario: 'propietario_id', contacto: 'contacto_id' }

export default function Correos({ entidadTipo, entidadId, email, readOnly, onCountChange }) {
  const col = COL[entidadTipo]
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const empty = { sentido: 'enviado', fecha: new Date().toISOString().split('T')[0], asunto: '', cuerpo: '' }
  const [form, setForm] = useState(empty)
  const fileRef = useRef()

  useEffect(() => { if (entidadId) cargar() }, [entidadId])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('correo').select('*').eq(col, entidadId).order('fecha', { ascending: false }).order('id', { ascending: false })
    const result = data || []
    setRows(result)
    onCountChange?.(result.length)
    setLoading(false)
  }

  function redactar() {
    const su = encodeURIComponent(form.asunto || '')
    const bo = encodeURIComponent(form.cuerpo || '')
    window.location.href = `mailto:${email || ''}?subject=${su}&body=${bo}`
  }

  async function guardar() {
    if (!form.asunto && !form.cuerpo) return alert('Indica al menos el asunto o el texto del correo')
    setUploading(true)
    try {
      let archivo_url = null, archivo_nombre = null
      const file = fileRef.current?.files[0]
      if (file) {
        const path = `correo/${entidadTipo}/${entidadId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file)
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
        archivo_url = publicUrl; archivo_nombre = file.name
      }
      const { error } = await supabase.from('correo').insert({
        [col]: entidadId,
        sentido: form.sentido,
        fecha: form.fecha || null,
        asunto: form.asunto || null,
        cuerpo: form.cuerpo || null,
        archivo_url, archivo_nombre,
      })
      if (error) throw error
      setForm(empty); if (fileRef.current) fileRef.current.value = ''; setShowForm(false); cargar()
    } catch (e) { alert('Error: ' + e.message) }
    setUploading(false)
  }

  async function eliminar(r) {
    if (!confirm('\u00BFEliminar este correo del registro?')) return
    if (r.archivo_url) { const p = r.archivo_url.split(`${BUCKET}/`)[1]; if (p) await supabase.storage.from(BUCKET).remove([p]) }
    await supabase.from('correo').delete().eq('id', r.id); cargar()
  }

  const fmt = d => d ? new Date(d).toLocaleDateString('es-ES') : ''

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{rows.length} correo{rows.length !== 1 ? 's' : ''}</span>
        {!readOnly && <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(!showForm)}><i className="ti ti-plus" /> Nuevo correo</button>}
      </div>

      {showForm && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 12 }}>
          <div className="form-grid">
            <div className="form-group"><label>Tipo</label>
              <select value={form.sentido} onChange={e => setForm(p => ({ ...p, sentido: e.target.value }))}>
                <option value="enviado">Enviado</option>
                <option value="recibido">Recibido</option>
              </select>
            </div>
            <div className="form-group"><label>Fecha</label><input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} /></div>
            <div className="form-group form-full"><label>Asunto</label><input value={form.asunto} onChange={e => setForm(p => ({ ...p, asunto: e.target.value }))} /></div>
            <div className="form-group form-full"><label>Texto / resumen</label><textarea rows={4} value={form.cuerpo} onChange={e => setForm(p => ({ ...p, cuerpo: e.target.value }))} /></div>
            <div className="form-group form-full"><label>Adjunto (opcional)</label><input type="file" ref={fileRef} style={{ fontSize: 13 }} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setForm(empty) }}>Cancelar</button>
            {form.sentido === 'enviado' && email && <button className="btn btn-ghost btn-sm" onClick={redactar} title={`Redactar a ${email}`}><i className="ti ti-mail-forward" /> Redactar en mi correo</button>}
            <button className="btn btn-primary btn-sm" onClick={guardar} disabled={uploading}>{uploading ? <><i className="ti ti-loader ti-spin" /> Guardando...</> : <><i className="ti ti-device-floppy" /> Guardar</>}</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Cargando...</div> : (
        rows.length === 0
          ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Sin correos registrados</div>
          : rows.map(r => {
            const open = expanded === r.id
            return (
              <div key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <div
                  onClick={() => setExpanded(open ? null : r.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', cursor: 'pointer', userSelect: 'none' }}
                >
                  <i className={`ti ${open ? 'ti-chevron-down' : 'ti-chevron-right'}`} style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }} />
                  <span className={`badge ${r.sentido === 'recibido' ? 'badge-blue' : 'badge-green'}`} style={{ flexShrink: 0 }}>{r.sentido === 'recibido' ? 'Recib.' : 'Env.'}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.asunto || '(sin asunto)'}</span>
                  {r.archivo_url && <i className="ti ti-paperclip" style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }} />}
                  {!readOnly && <button className="btn btn-ghost btn-sm" title="Eliminar" onClick={e => { e.stopPropagation(); eliminar(r) }} style={{ padding: '0 4px', height: 'fit-content' }}><i className="ti ti-trash" style={{ color: 'var(--danger-text)' }} /></button>}
                </div>
                {open && (
                  <div style={{ padding: '4px 0 12px 20px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{fmt(r.fecha)}{r.remitente ? ` \u00B7 De: ${r.remitente}` : ''}{r.destinatario ? ` \u2192 ${r.destinatario}` : ''}</div>
                    {r.cuerpo && <div style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: 300, overflowY: 'auto', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>{r.cuerpo}</div>}
                    {r.archivo_url && <div style={{ marginTop: 6 }}><a href={r.archivo_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--info-text)' }}><i className="ti ti-paperclip" /> {r.archivo_nombre || 'adjunto'}</a></div>}
                  </div>
                )}
              </div>
            )
          })
      )}
    </div>
  )
}

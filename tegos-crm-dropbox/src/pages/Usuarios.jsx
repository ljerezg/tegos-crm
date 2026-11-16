import { useEffect, useState } from 'react'
import { supabase, base } from '../lib/supabase'
import { compartirCarpeta } from '../lib/sesion'

const EMPTY = { email: '', email_dropbox: '', nombre: '', rol: 'propietario', propietario_id: '', activo: true, compartir: false }

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [propietarios, setPropietarios] = useState([])
  const [inmuebles, setInmuebles] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [inmueblesAsignados, setInmueblesAsignados] = useState([])
  const [selected, setSelected] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: us }, { data: props }, { data: inms }] = await Promise.all([
      supabase.from('perfil_usuario').select('*, propietarios(nombre, apellidos)').order('nombre'),
      supabase.from('propietarios').select('id, nombre, apellidos').order('nombre'),
      supabase.from('inmuebles').select('id, codigo, calle').order('codigo'),
    ])
    setUsuarios(us || [])
    setPropietarios(props || [])
    setInmuebles(inms || [])
    setLoading(false)
  }

  async function selectUsuario(u) {
    setSelected(u)
    const { data } = await supabase.from('usuario_inmuebles').select('inmueble_id').eq('usuario_id', u.id)
    setInmueblesAsignados((data || []).map(r => r.inmueble_id))
  }

  async function save() {
    const data = { ...form }
    if (!data.email) return alert('El email es obligatorio')
    if (!data.rol) return alert('El rol es obligatorio')

    let usuarioId = form.id
    const emailDropbox = (data.email_dropbox || data.email).trim().toLowerCase()
    if (modal === 'new') {
      // En la versión con Dropbox no hay contraseña: el usuario entra con su cuenta de Dropbox
      const { data: creado, error } = await supabase.from('perfil_usuario').insert({
        email: data.email.trim().toLowerCase(),
        email_dropbox: emailDropbox,
        nombre: data.nombre,
        rol: data.rol,
        propietario_id: data.propietario_id || null,
        activo: true,
      }).select('id').single()
      if (error) { alert('Error al crear usuario: ' + error.message); return }
      usuarioId = creado.id
    } else {
      const { error } = await supabase.from('perfil_usuario').update({
        nombre: data.nombre,
        rol: data.rol,
        propietario_id: data.propietario_id || null,
        activo: data.activo,
        email_dropbox: emailDropbox,
      }).eq('id', form.id)
      if (error) { alert('Error al guardar: ' + error.message); return }
    }

    if (data.compartir) {
      try {
        const raiz = base().carpetaDatos.replace(/\/datos$/, '')
        await compartirCarpeta(raiz, emailDropbox, data.rol === 'visor')
        alert(`Carpeta compartida con ${emailDropbox}. Le llegará una invitación de Dropbox; cuando la acepte podrá entrar en el CRM.`)
      } catch (e) {
        alert('El usuario está guardado, pero no se pudo compartir la carpeta de Dropbox: ' + e.message + '\nCompártela a mano desde Dropbox.')
      }
    }

    // Guardar inmuebles asignados si rol personalizado
    if (data.rol === 'personalizado' && usuarioId) {
      await supabase.from('usuario_inmuebles').delete().eq('usuario_id', usuarioId)
      if (inmueblesAsignados.length > 0) {
        await supabase.from('usuario_inmuebles').insert(
          inmueblesAsignados.map(id => ({ usuario_id: usuarioId, inmueble_id: id }))
        )
      }
    }

    setModal(null); load()
  }

  async function toggleActivo(u) {
    await supabase.from('perfil_usuario').update({ activo: !u.activo }).eq('id', u.id)
    load()
  }

  function toggleInmueble(id) {
    setInmueblesAsignados(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const f = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }))
  const rolBadge = rol => ({ administrador: 'badge-blue', propietario: 'badge-green', personalizado: 'badge-yellow', visor: 'badge-gray' })[rol] || 'badge-gray'
  const nombreProp = p => p ? `${p.nombre || ''} ${p.apellidos || ''}`.trim() : '—'

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>Usuarios <span className="badge badge-gray" style={{ marginLeft: 6 }}>{usuarios.length}</span></h2>
          <button className="btn btn-primary btn-sm" onClick={() => { setForm({ ...EMPTY }); setInmueblesAsignados([]); setModal('new') }}>
            <i className="ti ti-plus" /> Nuevo usuario
          </button>
        </div>
        <div className="table-wrap">
          {loading ? <div className="loading"><i className="ti ti-loader ti-spin" /> Cargando...</div> : (
            <table>
              <thead><tr><th>Nombre</th><th>Email / Dropbox</th><th>Rol</th><th>Propietario vinculado</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {usuarios.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>Sin usuarios. Crea el primero.</td></tr>}
                {usuarios.map(u => (
                  <tr key={u.id}>
                    <td><strong>{u.nombre || '—'}</strong></td>
                    <td style={{ color: 'var(--info-text)' }}>{u.email}{u.email_dropbox && u.email_dropbox !== u.email && <div style={{ fontSize: 11, color: 'var(--text3)' }}><i className="ti ti-brand-dropbox" /> {u.email_dropbox}</div>}</td>
                    <td><span className={`badge ${rolBadge(u.rol)}`}>{u.rol}</span></td>
                    <td>{nombreProp(u.propietarios)}</td>
                    <td>
                      <span className={`badge ${u.activo ? 'badge-green' : 'badge-gray'}`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => { selectUsuario(u); setForm({ ...u }); setModal('edit') }}><i className="ti ti-edit" /></button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleActivo(u)} title={u.activo ? 'Desactivar' : 'Activar'}>
                        <i className={`ti ${u.activo ? 'ti-user-off' : 'ti-user-check'}`} style={{ color: u.activo ? 'var(--danger-text)' : 'var(--accent)' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ width: 560 }}>
            <div className="modal-header">
              <h2>{modal === 'new' ? 'Nuevo usuario' : 'Editar usuario'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group"><label>Nombre</label><input value={form.nombre || ''} onChange={f('nombre')} /></div>
                <div className="form-group"><label>Email *</label><input type="email" name="nuevo-usuario-email" autoComplete="off" value={form.email || ''} onChange={f('email')} disabled={modal === 'edit'} /></div>
                <div className="form-group form-full"><label>Correo de su cuenta de Dropbox</label><input type="email" autoComplete="off" value={form.email_dropbox || ''} onChange={f('email_dropbox')} placeholder={form.email || 'Si es distinto del email'} /></div>
                <div className="form-group form-full">
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!form.compartir} onChange={e => setForm({ ...form, compartir: e.target.checked })} style={{ width: 'auto' }} />
                    Compartirle ahora la carpeta del CRM en Dropbox
                  </label>
                  {form.compartir && (form.rol === 'propietario' || form.rol === 'personalizado') && (
                    <div style={{ fontSize: 12, color: 'var(--danger-text)', marginTop: 6 }}>
                      Ojo: con la carpeta compartida podrá abrir en su Dropbox los datos de todos los propietarios, no solo los suyos.
                    </div>
                  )}
                </div>
                <div className="form-group"><label>Rol *</label>
                  <select value={form.rol || ''} onChange={f('rol')}>
                    <option value="administrador">Administrador</option>
                    <option value="propietario">Propietario</option>
                    <option value="personalizado">Personalizado</option>
                    <option value="visor">Visor (solo lectura)</option>
                  </select>
                </div>
                {(form.rol === 'propietario' || form.rol === 'personalizado') && (
                  <div className="form-group"><label>Propietario vinculado</label>
                    <select value={form.propietario_id || ''} onChange={f('propietario_id')}>
                      <option value="">— Sin vincular —</option>
                      {propietarios.map(p => <option key={p.id} value={p.id}>{nombreProp(p)}</option>)}
                    </select>
                  </div>
                )}
                {modal === 'edit' && (
                  <div className="form-group"><label>Estado</label>
                    <select value={form.activo ? 'true' : 'false'} onChange={e => setForm({ ...form, activo: e.target.value === 'true' })}>
                      <option value="true">Activo</option>
                      <option value="false">Inactivo</option>
                    </select>
                  </div>
                )}
              </div>

              {form.rol === 'personalizado' && (
                <>
                  <div style={{ fontWeight: 500, fontSize: 13, margin: '16px 0 10px', paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                    Inmuebles asignados
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 8 }}>
                    {inmuebles.map(inm => (
                      <label key={inm.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', cursor: 'pointer', fontSize: 13 }}>
                        <input type="checkbox" checked={inmueblesAsignados.includes(inm.id)} onChange={() => toggleInmueble(inm.id)} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500 }}>{inm.codigo}</span>
                        <span style={{ color: 'var(--text2)' }}>{inm.calle}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}

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


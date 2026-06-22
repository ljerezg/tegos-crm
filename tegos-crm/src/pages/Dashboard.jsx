import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function Dashboard({ perfil }) {
  const [stats, setStats] = useState({ inmuebles: 0, inquilinos: 0, propietarios: 0 })
  const [proxAcciones, setProxAcciones] = useState([])
  const [vencimientos, setVencimientos] = useState([])
  const navigate = useNavigate()
  const veTodo = perfil?.rol === 'administrador' || perfil?.rol === 'visor'

  // ---- Buscador global ----
  const [gq, setGq] = useState('')
  const [gres, setGres] = useState(null)
  const [gloading, setGloading] = useState(false)

  useEffect(() => {
    const q = gq.trim()
    if (q.length < 2) { setGres(null); setGloading(false); return }
    setGloading(true)
    const t = setTimeout(async () => {
      const safe = q.replace(/[,()%*]/g, ' ').trim()
      if (safe.length < 2) { setGres(null); setGloading(false); return }
      const words = safe.split(/\s+/).filter(Boolean)
      // Cada palabra debe aparecer en alguno de los campos (AND entre palabras, OR entre campos).
      // Así "Luis Jerez" casa con nombre="Luis" y apellidos="Jerez".
      const aplicar = (query, cols) => {
        words.forEach(w => { const l = `%${w}%`; query = query.or(cols.map(c => `${c}.ilike.${l}`).join(',')) })
        return query.limit(8)
      }
      const tasks = [
        aplicar(supabase.from('inmuebles').select('id, codigo, calle, poblacion'), ['codigo', 'calle', 'poblacion']),
        aplicar(supabase.from('inquilinos').select('id, nombre, apellidos, movil, email, inmuebles(codigo)'), ['nombre', 'apellidos', 'dni_cif', 'movil', 'email']),
        aplicar(supabase.from('propietarios').select('id, nombre, apellidos, movil, email'), ['nombre', 'apellidos', 'dni_cif', 'movil', 'email']),
      ]
      if (veTodo) {
        tasks.push(aplicar(supabase.from('persona_contacto').select('id, nombre, apellidos, movil, email'), ['nombre', 'apellidos', 'movil', 'email']))
        tasks.push(aplicar(supabase.from('administrador_finca').select('id, nombre, email'), ['nombre', 'email']))
      }
      const res = await Promise.all(tasks)
      setGres({
        inmuebles: res[0]?.data || [],
        inquilinos: res[1]?.data || [],
        propietarios: res[2]?.data || [],
        contactos: veTodo ? (res[3]?.data || []) : [],
        administradores: veTodo ? (res[4]?.data || []) : [],
      })
      setGloading(false)
    }, 250)
    return () => clearTimeout(t)
  }, [gq, veTodo])

  const irA = path => { setGq(''); setGres(null); navigate(path) }
  const nom = r => `${r.nombre || ''} ${r.apellidos || ''}`.trim() || '—'
  const totalRes = gres ? gres.inmuebles.length + gres.inquilinos.length + gres.propietarios.length + gres.contactos.length + gres.administradores.length : 0

  useEffect(() => { load() }, [perfil])

  async function load() {
    // Si es propietario, limitar todo a SUS inmuebles (propios + en copropiedad)
    let inmuebleIds = null
    if (perfil?.rol === "propietario" && perfil?.propietario_id) {
      const [{ data: dir }, { data: co }] = await Promise.all([
        supabase.from("inmuebles").select("id").eq("propietario_id", perfil.propietario_id),
        supabase.from("inmueble_propietarios").select("inmueble_id").eq("propietario_id", perfil.propietario_id),
      ])
      inmuebleIds = [...new Set([...(dir || []).map(i => i.id), ...(co || []).map(i => i.inmueble_id)])]
      if (inmuebleIds.length === 0) inmuebleIds = [-1]
    }

    let qCntInm = supabase.from("inmuebles").select("*", { count: "exact", head: true })
    if (inmuebleIds) qCntInm = qCntInm.in("id", inmuebleIds)
    let qCntInq = supabase.from("inquilinos").select("*", { count: "exact", head: true })
    if (inmuebleIds) qCntInq = qCntInq.in("inmueble_id", inmuebleIds)
    let qCntProp = supabase.from("propietarios").select("*", { count: "exact", head: true })
    if (inmuebleIds) qCntProp = qCntProp.eq("id", perfil.propietario_id)

    let qAccInm = supabase.from("accion_inmueble").select("id, proxima_fecha, proxima_accion, indicaciones, completada, responsable(nombre_responsable), inmuebles(codigo)").eq("completada", false).not("proxima_fecha", "is", null)
    if (inmuebleIds) qAccInm = qAccInm.in("inmueble_id", inmuebleIds)
    qAccInm = qAccInm.order("proxima_fecha").limit(10)

    const qAccInq = supabase.from("accion_inquilino").select("id, proxima_fecha, proxima_accion, indicaciones, completada, responsable(nombre_responsable), inquilinos(nombre, apellidos, inmueble_id, inmuebles(codigo))").eq("completada", false).not("proxima_fecha", "is", null).order("proxima_fecha").limit(50)

    let qContr = supabase.from("inquilinos").select("id, nombre, apellidos, fecha_contrato, fecha_fin_contrato, duracion_contrato, inmueble_id, inmuebles(codigo, calle, propietarios!inmuebles_propietario_id_fkey(nombre, apellidos))").is("fecha_fin_contrato", null).not("fecha_contrato", "is", null)
    if (inmuebleIds) qContr = qContr.in("inmueble_id", inmuebleIds)

    const [{ count: totalInm }, { count: totalInq }, { count: totalProps }, { data: accInm }, { data: accInq }, { data: contratos }] = await Promise.all([
      qCntInm, qCntInq, qCntProp, qAccInm, qAccInq, qContr,
    ])

    setStats({ inmuebles: totalInm || 0, inquilinos: totalInq || 0, propietarios: totalProps || 0 })

    let accInqList = accInq || []
    if (inmuebleIds) accInqList = accInqList.filter(a => inmuebleIds.includes(a.inquilinos?.inmueble_id))

    const allAcciones = [
      ...(accInm || []).map(a => ({ ...a, entidad: a.inmuebles?.codigo || "—", tabla: "accion_inmueble" })),
      ...accInqList.map(a => ({
        ...a,
        entidad: `${a.inquilinos?.nombre || ""} ${a.inquilinos?.apellidos || ""}`.trim() || "—",
        codigo: a.inquilinos?.inmuebles?.codigo || "",
        tabla: "accion_inquilino"
      })),
    ].sort((a, b) => new Date(a.proxima_fecha) - new Date(b.proxima_fecha)).slice(0, 8)

    setProxAcciones(allAcciones)

    const proximaAct = d => {
      const inicio = new Date(d)
      const hoyD = new Date()
      const anios = Math.floor((hoyD - inicio) / (365.25 * 86400000))
      const proxima = new Date(inicio)
      proxima.setFullYear(inicio.getFullYear() + anios + 1)
      return proxima
    }
    const sorted = (contratos || []).sort((a, b) => proximaAct(a.fecha_contrato) - proximaAct(b.fecha_contrato))
    setVencimientos(sorted)
  }

  async function completar(accion) {
    await supabase.from(accion.tabla).update({ completada: true }).eq('id', accion.id)
    load()
  }

  const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
  const hoy = new Date(); hoy.setHours(0,0,0,0)

  const accionBadge = d => {
    const fecha = new Date(d); fecha.setHours(0,0,0,0)
    if (fecha < hoy) return 'badge-red'
    if (fecha.getTime() === hoy.getTime()) return 'badge-yellow'
    return 'badge-green'
  }

  const proximaActualizacion = d => {
    if (!d) return null
    const inicio = new Date(d)
    const hoyD = new Date()
    const anios = Math.floor((hoyD - inicio) / (365.25 * 86400000))
    const proxima = new Date(inicio)
    proxima.setFullYear(inicio.getFullYear() + anios + 1)
    const dias = Math.ceil((proxima - hoyD) / 86400000)
    return { fecha: proxima, dias }
  }

  const ResGrupo = ({ icon, label, items, render }) => items.length === 0 ? null : (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
        <i className={`ti ${icon}`} /> {label} <span className="badge badge-gray" style={{ fontSize: 10 }}>{items.length}</span>
      </div>
      {items.map(render)}
    </div>
  )

  const resItem = (key, primary, secondary, onClick) => (
    <div key={key} onClick={onClick} className="search-result-item" style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '8px 12px', cursor: 'pointer', borderRadius: 'var(--radius-sm)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'} onMouseLeave={e => e.currentTarget.style.background = ''}>
      <span style={{ fontWeight: 500 }}>{primary}</span>
      {secondary && <span style={{ fontSize: 12, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{secondary}</span>}
    </div>
  )

  return (
    <div>
      {/* Buscador global */}
      <div style={{ position: 'relative', marginBottom: 18 }}>
        <div className="search-input" style={{ width: '100%', maxWidth: 'none' }}>
          <i className="ti ti-search" />
          <input
            placeholder="Buscar en inmuebles, inquilinos, propietarios..."
            value={gq}
            onChange={e => setGq(e.target.value)}
            style={{ width: '100%' }}
          />
          {gq && <i className="ti ti-x" style={{ cursor: 'pointer', color: 'var(--text3)' }} onClick={() => { setGq(''); setGres(null) }} />}
        </div>
        {gq.trim().length >= 2 && (
          <div className="card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4, padding: '6px 0', maxHeight: 420, overflowY: 'auto', boxShadow: 'var(--shadow-md)' }}>
            {gloading ? (
              <div style={{ padding: '14px 12px', color: 'var(--text3)', fontSize: 13 }}><i className="ti ti-loader ti-spin" /> Buscando...</div>
            ) : totalRes === 0 ? (
              <div style={{ padding: '14px 12px', color: 'var(--text3)', fontSize: 13 }}>Sin resultados para "{gq.trim()}"</div>
            ) : (
              <>
                <ResGrupo icon="ti-building" label="Inmuebles" items={gres.inmuebles}
                  render={r => resItem('inm-' + r.id, r.codigo, [r.calle, r.poblacion].filter(Boolean).join(', '), () => irA(`/inmuebles?sel=${r.id}`))} />
                <ResGrupo icon="ti-users" label="Inquilinos" items={gres.inquilinos}
                  render={r => resItem('inq-' + r.id, nom(r), [r.inmuebles?.codigo, r.movil].filter(Boolean).join(' · '), () => irA(`/inquilinos?sel=${r.id}`))} />
                <ResGrupo icon="ti-id-badge" label="Propietarios" items={gres.propietarios}
                  render={r => resItem('prop-' + r.id, nom(r), [r.movil, r.email].filter(Boolean).join(' · '), () => irA(`/propietarios?sel=${r.id}`))} />
                <ResGrupo icon="ti-address-book" label="Contactos" items={gres.contactos}
                  render={r => resItem('con-' + r.id, nom(r), [r.movil, r.email].filter(Boolean).join(' · '), () => irA(`/contactos?sel=${r.id}`))} />
                <ResGrupo icon="ti-building-community" label="Adm. Fincas" items={gres.administradores}
                  render={r => resItem('adm-' + r.id, r.nombre || '—', r.email, () => irA(`/administradores?sel=${r.id}`))} />
              </>
            )}
          </div>
        )}
      </div>

      {/* Stats - 2x2 en móvil, 4 en escritorio */}
      <div className="stats-grid">
        <div className="stat-card" onClick={() => navigate('/inmuebles')} style={{ cursor: 'pointer' }}>
          <div className="stat-label">Inmuebles</div>
          <div className="stat-value">{stats.inmuebles}</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/inquilinos')} style={{ cursor: 'pointer' }}>
          <div className="stat-label">Inquilinos activos</div>
          <div className="stat-value">{stats.inquilinos}</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/propietarios')} style={{ cursor: 'pointer' }}>
          <div className="stat-label">Propietarios</div>
          <div className="stat-value">{stats.propietarios}</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/acciones')} style={{ cursor: 'pointer' }}>
          <div className="stat-label">Acciones pendientes</div>
          <div className="stat-value">{proxAcciones.length}</div>
        </div>
      </div>

      {/* Próximas acciones - pantalla completa en móvil */}
      <div className="dashboard-grid">
        <div className="card dashboard-full">
          <div className="card-header">
            <i className="ti ti-activity" style={{ color: 'var(--text3)' }} />
            <h2>Próximas acciones</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Código</th><th>Entidad</th><th>Acción</th><th></th></tr></thead>
              <tbody>
                {proxAcciones.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)', padding: 20 }}>Sin acciones pendientes</td></tr>}
                {proxAcciones.map(a => (
                  <tr key={`${a.tabla}-${a.id}`}>
                    <td><span className={`badge ${accionBadge(a.proxima_fecha)}`}>{fmtDate(a.proxima_fecha)}</span></td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500 }}>{a.codigo || a.entidad}</span></td>
                    <td style={{ fontSize: 12, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.tabla === 'accion_inquilino' ? a.entidad : ''}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.proxima_accion || a.indicaciones || '—'}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" title="Marcar completada" onClick={() => completar(a)}>
                        <i className="ti ti-check" style={{ color: 'var(--accent)' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Contratos en vigor - pantalla completa en móvil */}
        <div className="card dashboard-full">
          <div className="card-header">
            <i className="ti ti-calendar-event" style={{ color: 'var(--text3)' }} />
            <h2>Contratos en vigor</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Inquilino</th><th>Inmueble</th><th>Vencimiento</th><th>Próx. actualiz. renta</th></tr></thead>
              <tbody>
                {vencimientos.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text3)', padding: 20 }}>Sin contratos</td></tr>}
                {vencimientos.map(c => {
                  const act = proximaActualizacion(c.fecha_contrato)
                  const badge = act ? (act.dias < 30 ? 'badge-red' : act.dias < 90 ? 'badge-yellow' : 'badge-green') : 'badge-gray'
                  let venc = null
                  if (c.fecha_contrato && c.duracion_contrato) {
                    const [vy, vm, vd] = String(c.fecha_contrato).split('-').map(Number)
                    const v = new Date(vy + Number(c.duracion_contrato), vm - 1, vd)
                    v.setDate(v.getDate() - 1)
                    venc = v
                  }
                  return (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/inquilinos?sel=${c.id}`)}>
                      <td>{`${c.nombre || ''} ${c.apellidos || ''}`.trim()}</td>
                      <td><span className="badge badge-gray">{c.inmuebles?.codigo || '—'}</span>{c.inmuebles?.propietarios && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text2)' }}>{`${c.inmuebles.propietarios.nombre || ''} ${c.inmuebles.propietarios.apellidos || ''}`.trim()}</span>}</td>
                      <td>{venc ? `${venc.toLocaleDateString('es-ES')} (${c.duracion_contrato} años)` : '—'}</td>
                      <td>{act ? <span className={`badge ${badge}`}>{fmtDate(act.fecha)} ({act.dias}d)</span> : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

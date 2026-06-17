import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const [stats, setStats] = useState({ inmuebles: 0, inquilinos: 0, propietarios: 0 })
  const [proxAcciones, setProxAcciones] = useState([])
  const [vencimientos, setVencimientos] = useState([])
  const navigate = useNavigate()

  useEffect(() => { load() }, [])

  async function load() {
    const [{ count: totalInm }, { count: totalInq }, { count: totalProps }, { data: accInm }, { data: accInq }, { data: contratos }] = await Promise.all([
      supabase.from('inmuebles').select('*', { count: 'exact', head: true }),
      supabase.from('inquilinos').select('*', { count: 'exact', head: true }),
      supabase.from('propietarios').select('*', { count: 'exact', head: true }),
      supabase.from('accion_inmueble').select('id, proxima_fecha, proxima_accion, indicaciones, completada, responsable(nombre_responsable), inmuebles(codigo)').eq('completada', false).not('proxima_fecha', 'is', null).order('proxima_fecha').limit(10),
      supabase.from('accion_inquilino').select('id, proxima_fecha, proxima_accion, indicaciones, completada, responsable(nombre_responsable), inquilinos(nombre, apellidos, inmuebles(codigo))').eq('completada', false).not('proxima_fecha', 'is', null).order('proxima_fecha').limit(10),
      supabase.from('inquilinos').select('id, nombre, apellidos, fecha_contrato, fecha_fin_contrato, duracion_contrato, inmuebles(codigo, calle, propietarios!inmuebles_propietario_id_fkey(nombre, apellidos))').is('fecha_fin_contrato', null).not('fecha_contrato', 'is', null),
    ])

    setStats({ inmuebles: totalInm || 0, inquilinos: totalInq || 0, propietarios: totalProps || 0 })

    const hoy = new Date(); hoy.setHours(0,0,0,0)
    const allAcciones = [
      ...(accInm || []).map(a => ({ ...a, entidad: a.inmuebles?.codigo || '—', tabla: 'accion_inmueble' })),
      ...(accInq || []).map(a => ({
        ...a,
        entidad: `${a.inquilinos?.nombre || ''} ${a.inquilinos?.apellidos || ''}`.trim() || '—',
        codigo: a.inquilinos?.inmuebles?.codigo || '',
        tabla: 'accion_inquilino'
      })),
    ].sort((a, b) => new Date(a.proxima_fecha) - new Date(b.proxima_fecha)).slice(0, 8)

    setProxAcciones(allAcciones)

    // Ordenar contratos por próxima actualización
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

  return (
    <div>
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
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/inquilinos')}>
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

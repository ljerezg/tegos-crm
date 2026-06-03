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
      supabase.from('accion_inmueble').select('id, proxima_fecha, proxima_accion, indicaciones, completada, responsable(nombre_responsable), inmuebles(codigo, calle)').eq('completada', false).not('proxima_fecha', 'is', null).order('proxima_fecha').limit(10),
      supabase.from('accion_inquilino').select('id, proxima_fecha, proxima_accion, indicaciones, completada, responsable(nombre_responsable), inquilinos(nombre, apellidos)').eq('completada', false).not('proxima_fecha', 'is', null).order('proxima_fecha').limit(10),
      supabase.from('inquilinos').select('id, nombre, apellidos, fecha_contrato, fecha_fin_contrato, inmuebles(codigo, calle)').is('fecha_fin_contrato', null).not('fecha_contrato', 'is', null).order('fecha_contrato').limit(10),
    ])

    setStats({ inmuebles: totalInm || 0, inquilinos: totalInq || 0, propietarios: totalProps || 0 })

    const hoy = new Date()
    const allAcciones = [
      ...(accInm || []).map(a => ({ ...a, entidad: a.inmuebles ? `${a.inmuebles.codigo} · ${a.inmuebles.calle || ''}` : '—', tabla: 'accion_inmueble' })),
      ...(accInq || []).map(a => ({ ...a, entidad: a.inquilinos ? `${a.inquilinos.nombre || ''} ${a.inquilinos.apellidos || ''}`.trim() : '—', tabla: 'accion_inquilino' })),
    ].sort((a, b) => new Date(a.proxima_fecha) - new Date(b.proxima_fecha)).slice(0, 8)

    setProxAcciones(allAcciones)
    setVencimientos(contratos || [])
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

  const diasDesdeInicio = d => {
    if (!d) return null
    const inicio = new Date(d)
    const hoyD = new Date()
    return Math.floor((hoyD - inicio) / 86400000)
  }

  const proximaActualizacion = d => {
    if (!d) return null
    const inicio = new Date(d)
    const hoyD = new Date()
    const anios = Math.floor((hoyD - inicio) / (365.25 * 86400000))
    const proxima = new Date(inicio)
    proxima.setFullYear(inicio.getFullYear() + anios + 1)
    const diasRestantes = Math.ceil((proxima - hoyD) / 86400000)
    return { fecha: proxima, dias: diasRestantes }
  }

  return (
    <div>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Próximas acciones */}
        <div className="card">
          <div className="card-header">
            <i className="ti ti-activity" style={{ color: 'var(--text3)' }} />
            <h2>Próximas acciones</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Entidad</th><th>Acción</th><th></th></tr></thead>
              <tbody>
                {proxAcciones.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text3)', padding: 20 }}>Sin acciones pendientes</td></tr>}
                {proxAcciones.map(a => (
                  <tr key={`${a.tabla}-${a.id}`}>
                    <td><span className={`badge ${accionBadge(a.proxima_fecha)}`}>{fmtDate(a.proxima_fecha)}</span></td>
                    <td style={{ fontSize: 12, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.entidad}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.proxima_accion || a.indicaciones || '—'}</td>
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

        {/* Contratos en vigor */}
        <div className="card">
          <div className="card-header">
            <i className="ti ti-calendar-event" style={{ color: 'var(--text3)' }} />
            <h2>Contratos en vigor</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Inquilino</th><th>Inmueble</th><th>Próx. actualiz.</th></tr></thead>
              <tbody>
                {vencimientos.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text3)', padding: 20 }}>Sin contratos</td></tr>}
                {vencimientos.map(c => {
                  const act = proximaActualizacion(c.fecha_contrato)
                  const badge = act ? (act.dias < 30 ? 'badge-red' : act.dias < 90 ? 'badge-yellow' : 'badge-green') : 'badge-gray'
                  return (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/inquilinos')}>
                      <td>{`${c.nombre || ''} ${c.apellidos || ''}`.trim()}</td>
                      <td><span className="badge badge-gray">{c.inmuebles?.codigo || '—'}</span></td>
                      <td>{act ? <span className={`badge ${badge}`}>{fmtDate(act.fecha)}</span> : '—'}</td>
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


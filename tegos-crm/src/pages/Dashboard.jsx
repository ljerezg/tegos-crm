import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const [stats, setStats] = useState({ inmuebles: 0, libres: 0, inquilinos: 0, propietarios: 0 })
  const [proxAcciones, setProxAcciones] = useState([])
  const [contratosVencer, setContratosVencer] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const [{ count: totalInm }, { data: inq }, { count: props }, { data: accInm }, { data: accInq }, { data: proxContratos }] = await Promise.all([
        supabase.from('inmuebles').select('*', { count: 'exact', head: true }),
        supabase.from('inquilinos').select('id, nombre, apellidos, fecha_fin_contrato, inmueble_id, inmuebles(codigo)'),
        supabase.from('propietarios').select('*', { count: 'exact', head: true }),
        supabase.from('accion_inmueble').select('id, fecha, proxima_fecha, proxima_accion, indicaciones, responsable(nombre_responsable), inmuebles(codigo, calle)').not('proxima_fecha', 'is', null).order('proxima_fecha').limit(5),
        supabase.from('accion_inquilino').select('id, fecha, proxima_fecha, proxima_accion, indicaciones, responsable(nombre_responsable), inquilinos(nombre, apellidos)').not('proxima_fecha', 'is', null).order('proxima_fecha').limit(5),
        supabase.from('inquilinos').select('id, nombre, apellidos, fecha_fin_contrato, inmuebles(codigo)').not('fecha_fin_contrato', 'is', null).order('fecha_fin_contrato').limit(5),
      ])

      const libres = (inq || []).filter(i => !i.inmueble_id).length
      setStats({ inmuebles: totalInm || 0, libres, inquilinos: (inq || []).length, propietarios: props || 0 })

      const allAcciones = [
        ...(accInm || []).map(a => ({ ...a, entidad: a.inmuebles ? `${a.inmuebles.codigo} · ${a.inmuebles.calle}` : '—', tipo: 'Inmueble' })),
        ...(accInq || []).map(a => ({ ...a, entidad: a.inquilinos ? `${a.inquilinos.nombre} ${a.inquilinos.apellidos || ''}`.trim() : '—', tipo: 'Inquilino' })),
      ].sort((a, b) => new Date(a.proxima_fecha) - new Date(b.proxima_fecha)).slice(0, 6)

      setProxAcciones(allAcciones)
      setContratosVencer(proxContratos || [])
    }
    load()
  }, [])

  const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
  const diasRestantes = d => { const diff = Math.ceil((new Date(d) - new Date()) / 86400000); return diff }

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card" onClick={() => navigate('/inmuebles')} style={{ cursor: 'pointer' }}>
          <div className="stat-label">Inmuebles</div>
          <div className="stat-value">{stats.inmuebles}</div>
          <div className="stat-sub">{stats.libres} libres</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/inquilinos')} style={{ cursor: 'pointer' }}>
          <div className="stat-label">Inquilinos activos</div>
          <div className="stat-value">{stats.inquilinos}</div>
          <div className="stat-sub">{contratosVencer.length} contratos por vencer</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/propietarios')} style={{ cursor: 'pointer' }}>
          <div className="stat-label">Propietarios</div>
          <div className="stat-value">{stats.propietarios}</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/acciones')} style={{ cursor: 'pointer' }}>
          <div className="stat-label">Próximas acciones</div>
          <div className="stat-value">{proxAcciones.length}</div>
          <div className="stat-sub">pendientes</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-header">
            <i className="ti ti-activity" style={{ color: 'var(--text3)' }} />
            <h2>Próximas acciones</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Entidad</th><th>Responsable</th></tr></thead>
              <tbody>
                {proxAcciones.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>Sin acciones pendientes</td></tr>}
                {proxAcciones.map(a => (
                  <tr key={a.id}>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{fmtDate(a.proxima_fecha)}</span></td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.entidad}</td>
                    <td><span className="badge badge-gray">{a.responsable?.nombre_responsable || '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <i className="ti ti-calendar-event" style={{ color: 'var(--text3)' }} />
            <h2>Contratos por vencer</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Inquilino</th><th>Inmueble</th><th>Vence</th></tr></thead>
              <tbody>
                {contratosVencer.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>Sin contratos próximos</td></tr>}
                {contratosVencer.map(c => {
                  const dias = diasRestantes(c.fecha_fin_contrato)
                  const badge = dias < 30 ? 'badge-red' : dias < 90 ? 'badge-yellow' : 'badge-green'
                  return (
                    <tr key={c.id}>
                      <td>{`${c.nombre || ''} ${c.apellidos || ''}`.trim()}</td>
                      <td><span className="badge badge-gray">{c.inmuebles?.codigo || '—'}</span></td>
                      <td><span className={`badge ${badge}`}>{fmtDate(c.fecha_fin_contrato)}</span></td>
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

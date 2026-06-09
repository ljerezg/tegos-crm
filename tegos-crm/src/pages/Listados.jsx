import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { matchSearch } from '../lib/utils'

function exportarExcel(rows, tab) {
  try {
    if (typeof XLSX !== 'undefined') {
      exportarXLSX(rows, tab); return
    }
  } catch(e) {}
  exportarCSV(rows, tab)
}

function exportarXLSX(rows, tab) {
  const { ws_data, filename } = getExportData(rows, tab)
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(ws_data)
  XLSX.utils.book_append_sheet(wb, ws, tab)
  XLSX.writeFile(wb, filename.replace('.csv', '.xlsx'))
}

function exportarCSV(rows, tab) {
  const { ws_data, filename } = getExportData(rows, tab)
  const csv = ws_data.map(row => row.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function getExportData(rows, tab) {
  const headers = {
    contratos: ['Nombre','Apellidos','Móvil','Email','Fecha contrato','Inmueble','Calle','Seguro rentas'],
    inquilinos: ['Nombre','Apellidos','DNI/NIE','Teléfono','Móvil','Email','Email 2','Fecha contrato','Fecha fin contrato','Inmueble','Fianza IVIMA','Depósito','Seg. rentas','Nº póliza','Responsable'],
    inmuebles: ['Código','Calle','Número','Piso','Población','Provincia','CP','Seguro','Adm. finca'],
    propietarios: ['Nombre','Apellidos','DNI/CIF','Tipo','Teléfono','Móvil','Email','Municipio','Responsable'],
    contactos: ['Nombre','Apellidos','Móvil','Email','Clasificación','Origen','Responsable'],
  }
  const getRow = (r) => {  // eslint-disable-line no-unused-vars
    if (tab === 'contratos') return [r.nombre||'',r.apellidos||'',r.movil||'',r.email||'',r.fecha_contrato||'',r.inmuebles?.codigo||'',r.inmuebles?.calle||'',r.seguro?.compania||'']
    if (tab === 'inquilinos') return [r.nombre||'',r.apellidos||'',r.dni_cif||'',r.telefono||'',r.movil||'',r.email||'',r.email_2||'',r.fecha_contrato||'',r.fecha_fin_contrato||'',r.inmuebles?.codigo||'',r.importe_fianza_ivima||'',r.importe_deposito||'',r.seguro?.compania||'',r.num_poliza_seg_rentas||'',r.responsable?.nombre_responsable||'']
    if (tab === 'inmuebles') return [r.codigo||'',r.calle||'',r.numero_calle||'',r.piso||'',r.poblacion||'',r.provincia||'',r.codigo_postal||'',r.seguro?.compania||'',r.administrador_finca||'']
    if (tab === 'propietarios') return [r.nombre||'',r.apellidos||'',r.dni_cif||'',r.tipo_persona?.tipo||'',r.telefono||'',r.movil||'',r.email||'',r.municipio||'',r.responsable?.nombre_responsable||'']
    if (tab === 'contactos') return [r.nombre||'',r.apellidos||'',r.movil||'',r.email||'',r.clasificacion_contacto?.clasificacion||'',r.conocimiento?.origen||'',r.responsable?.nombre_responsable||'']
    return []
  }
  const hdrs = headers[tab] || []
  const csvRows = [hdrs, ...rows.map(getRow)]
  const filename = `listado_${tab}.csv`
  return { ws_data: csvRows, filename }
}

function imprimirListado() {
  window.print()
}

export default function Listados() {
  const [tab, setTab] = useState('contratos')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState('asc')

  useEffect(() => { loadTab(tab) }, [tab])

  async function loadTab(t) {
    setLoading(true)
    setSortCol('')
    let data = []
    if (t === 'contratos') {
      const { data: d } = await supabase.from('inquilinos')
        .select('id, nombre, apellidos, movil, email, fecha_contrato, inmuebles(codigo, calle), seguro(compania)')
        .is('fecha_fin_contrato', null)
        .not('fecha_contrato', 'is', null)
        .order('fecha_contrato')
      data = d || []
    } else if (t === 'inquilinos') {
      const { data: d } = await supabase.from('inquilinos')
        .select('id, nombre, apellidos, dni_cif, movil, email, fecha_contrato, fecha_fin_contrato, inmuebles(codigo, calle), responsable(nombre_responsable)')
        .order('nombre')
      data = d || []
    } else if (t === 'inmuebles') {
      const { data: d } = await supabase.from('inmuebles')
        .select('id, codigo, calle, numero_calle, piso, poblacion, seguro(compania), administrador_finca')
        .order('codigo')
      data = d || []
    } else if (t === 'propietarios') {
      const { data: d } = await supabase.from('propietarios')
        .select('id, nombre, apellidos, dni_cif, movil, email, tipo_persona(tipo), responsable(nombre_responsable)')
        .order('nombre')
      data = d || []
    } else if (t === 'contactos') {
      const { data: d } = await supabase.from('persona_contacto')
        .select('id, nombre, apellidos, movil, email, clasificacion_contacto(clasificacion), responsable(nombre_responsable), conocimiento(origen)')
        .order('nombre')
      data = d || []
    }
    setRows(data)
    setLoading(false)
  }

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function sorted(data, col, getValue) {
    if (!col) return data
    return [...data].sort((a, b) => {
      const va = getValue(a, col) || ''
      const vb = getValue(b, col) || ''
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })
  }

  const SortIcon = ({ col }) => sortCol === col
    ? <i className={`ti ti-chevron-${sortDir === 'asc' ? 'up' : 'down'}`} style={{ fontSize: 11, marginLeft: 3 }} />
    : <i className="ti ti-selector" style={{ fontSize: 11, marginLeft: 3, opacity: 0.3 }} />

  const Th = ({ col, label }) => (
    <th onClick={() => toggleSort(col)} style={{ cursor: 'pointer', userSelect: 'none' }}>
      {label}<SortIcon col={col} />
    </th>
  )

  const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES') : '—'
  const nombre = r => `${r.nombre || ''} ${r.apellidos || ''}`.trim() || '—'

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

  const tabs = [
    { id: 'contratos', label: 'Contratos vigentes' },
    { id: 'inquilinos', label: 'Inquilinos' },
    { id: 'inmuebles', label: 'Inmuebles' },
    { id: 'propietarios', label: 'Propietarios' },
    { id: 'contactos', label: 'Contactos' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} className={`btn ${tab === t.id ? 'btn-primary' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>{tabs.find(t => t.id === tab)?.label} <span className="badge badge-gray" style={{ marginLeft: 6 }}>{rows.length}</span></h2>
          <button className="btn btn-ghost btn-sm" onClick={imprimirListado}><i className="ti ti-printer" /> Imprimir</button>
          <button className="btn btn-ghost btn-sm" onClick={() => exportarExcel(rows, tab)}><i className="ti ti-table-export" /> Exportar CSV</button>
        </div>
        <div className="table-wrap">
          {loading ? <div className="loading"><i className="ti ti-loader ti-spin" /> Cargando...</div> : (<>

            {tab === 'contratos' && (
              <table>
                <thead><tr>
                  <Th col="nombre" label="Inquilino" />
                  <Th col="inmueble" label="Inmueble" />
                  <th>Móvil</th>
                  <Th col="fecha_contrato" label="Inicio contrato" />
                  <th>Próx. actualización renta</th>
                  <th>Seg. rentas</th>
                </tr></thead>
                <tbody>
                  {sorted(rows, sortCol, (r, c) => {
                    if (c === 'nombre') return nombre(r)
                    if (c === 'inmueble') return r.inmuebles?.codigo || ''
                    if (c === 'fecha_contrato') return r.fecha_contrato || ''
                    return ''
                  }).map(r => {
                    const act = proximaActualizacion(r.fecha_contrato)
                    const badge = act ? (act.dias < 30 ? 'badge-red' : act.dias < 90 ? 'badge-yellow' : 'badge-green') : 'badge-gray'
                    return (
                      <tr key={r.id}>
                        <td><strong>{nombre(r)}</strong></td>
                        <td>{r.inmuebles ? <><span className="badge badge-gray">{r.inmuebles.codigo}</span> <span style={{ fontSize: 12, color: 'var(--text2)' }}>{r.inmuebles.calle}</span></> : '—'}</td>
                        <td>{r.movil || '—'}</td>
                        <td>{fmtDate(r.fecha_contrato)}</td>
                        <td>{act ? <span className={`badge ${badge}`}>{fmtDate(act.fecha)} ({act.dias}d)</span> : '—'}</td>
                        <td>{r.seguro?.compania || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {tab === 'inquilinos' && (
              <table>
                <thead><tr>
                  <Th col="nombre" label="Nombre" />
                  <Th col="inmueble" label="Inmueble" />
                  <th>DNI/NIE</th>
                  <th>Móvil</th>
                  <th>Email</th>
                  <Th col="fecha_contrato" label="Inicio" />
                  <Th col="fecha_fin_contrato" label="Fin" />
                  <th>Responsable</th>
                </tr></thead>
                <tbody>
                  {sorted(rows, sortCol, (r, c) => {
                    if (c === 'nombre') return nombre(r)
                    if (c === 'inmueble') return r.inmuebles?.codigo || ''
                    if (c === 'fecha_contrato') return r.fecha_contrato || ''
                    if (c === 'fecha_fin_contrato') return r.fecha_fin_contrato || ''
                    return ''
                  }).map(r => (
                    <tr key={r.id}>
                      <td><strong>{nombre(r)}</strong></td>
                      <td>{r.inmuebles ? <span className="badge badge-gray">{r.inmuebles.codigo}</span> : '—'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.dni_cif || '—'}</td>
                      <td>{r.movil || '—'}</td>
                      <td style={{ color: 'var(--info-text)' }}>{r.email || '—'}</td>
                      <td>{fmtDate(r.fecha_contrato)}</td>
                      <td>{r.fecha_fin_contrato ? fmtDate(r.fecha_fin_contrato) : <span className="badge badge-green">En vigor</span>}</td>
                      <td>{r.responsable?.nombre_responsable || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'inmuebles' && (
              <table>
                <thead><tr>
                  <Th col="codigo" label="Código" />
                  <Th col="calle" label="Dirección" />
                  <Th col="poblacion" label="Población" />
                  <th>Seguro</th>
                  <th>Adm. finca</th>
                </tr></thead>
                <tbody>
                  {sorted(rows, sortCol, (r, c) => r[c] || '').map(r => (
                    <tr key={r.id}>
                      <td><strong style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.codigo}</strong></td>
                      <td>{[r.calle, r.numero_calle, r.piso].filter(Boolean).join(', ') || '—'}</td>
                      <td>{r.poblacion || '—'}</td>
                      <td>{r.seguro?.compania || '—'}</td>
                      <td>{r.administrador_finca || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'propietarios' && (
              <table>
                <thead><tr>
                  <Th col="nombre" label="Nombre" />
                  <th>Tipo</th>
                  <th>DNI/CIF</th>
                  <th>Móvil</th>
                  <th>Email</th>
                  <th>Responsable</th>
                </tr></thead>
                <tbody>
                  {sorted(rows, sortCol, (r, c) => c === 'nombre' ? nombre(r) : r[c] || '').map(r => (
                    <tr key={r.id}>
                      <td><strong>{nombre(r)}</strong></td>
                      <td><span className="badge badge-gray">{r.tipo_persona?.tipo || '—'}</span></td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.dni_cif || '—'}</td>
                      <td>{r.movil || '—'}</td>
                      <td style={{ color: 'var(--info-text)' }}>{r.email || '—'}</td>
                      <td>{r.responsable?.nombre_responsable || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'contactos' && (
              <table>
                <thead><tr>
                  <Th col="nombre" label="Nombre" />
                  <th>Clasificación</th>
                  <th>Origen</th>
                  <th>Móvil</th>
                  <th>Email</th>
                  <th>Responsable</th>
                </tr></thead>
                <tbody>
                  {sorted(rows, sortCol, (r, c) => c === 'nombre' ? nombre(r) : r[c] || '').map(r => (
                    <tr key={r.id}>
                      <td><strong>{nombre(r)}</strong></td>
                      <td>{r.clasificacion_contacto?.clasificacion ? <span className="badge badge-gray">{r.clasificacion_contacto.clasificacion}</span> : '—'}</td>
                      <td>{r.conocimiento?.origen || '—'}</td>
                      <td>{r.movil || '—'}</td>
                      <td style={{ color: 'var(--info-text)' }}>{r.email || '—'}</td>
                      <td>{r.responsable?.nombre_responsable || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>)}
        </div>
      </div>
    </div>
  )
}

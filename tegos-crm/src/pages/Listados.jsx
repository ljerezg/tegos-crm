import * as XLSX from 'xlsx'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function norm(s) {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function exportarExcel(rows, tab) {
  try {
    const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES') : ''
    const fmtMoney = v => v != null && v !== '' ? Number(v).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : ''
    const nombre = r => `${r.nombre || ''} ${r.apellidos || ''}`.trim()

    const proximaActualizacion = d => {
      if (!d) return ''
      const inicio = new Date(d)
      const hoyD = new Date()
      const anios = Math.floor((hoyD - inicio) / (365.25 * 86400000))
      const proxima = new Date(inicio)
      proxima.setFullYear(inicio.getFullYear() + anios + 1)
      return fmtDate(proxima)
    }

    let headers = []
    let getRow = () => []

    if (tab === 'contratos') {
      headers = ['Inquilino', 'DNI/NIE', 'Móvil', 'Email', 'Inmueble', 'Dirección inmueble', 'Inicio contrato', 'Próx. actualización renta', 'Seg. rentas', 'Nº póliza seg. rentas', 'Fianza IVIMA', 'Depósito']
      getRow = r => [
        nombre(r),
        r.dni_cif || '',
        r.movil || '',
        r.email || '',
        r.inmuebles?.codigo || '',
        r.inmuebles?.calle || '',
        fmtDate(r.fecha_contrato),
        proximaActualizacion(r.fecha_contrato),
        r.seguro?.compania || '',
        r.num_poliza_seg_rentas || '',
        fmtMoney(r.importe_fianza_ivima),
        fmtMoney(r.importe_deposito),
      ]
    } else if (tab === 'inquilinos') {
      headers = ['Nombre', 'Apellidos', 'DNI/NIE', 'Tipo', 'Responsable', 'Teléfono', 'Teléfono 2', 'Móvil', 'Email', 'Email 2', 'Inmueble', 'Dirección inmueble', 'Inicio contrato', 'Fin contrato', 'Fianza IVIMA', 'Depósito', 'Seg. rentas', 'Nº póliza', 'Nombre cónyuge', 'Apellidos cónyuge', 'Móvil cónyuge', 'Email cónyuge', 'Teléfono 2 cónyuge', 'Email 2 cónyuge', '2º inq. Nombre', '2º inq. Apellidos', '2º inq. DNI', '2º inq. Tipo', '2º inq. Relación', '2º inq. Teléfono', '2º inq. Teléfono 2', '2º inq. Móvil', '2º inq. Email', '2º inq. Email 2', '3º inq. Nombre', '3º inq. Apellidos', '3º inq. DNI', '3º inq. Tipo', '3º inq. Relación', '3º inq. Teléfono', '3º inq. Teléfono 2', '3º inq. Móvil', '3º inq. Email', '3º inq. Email 2', 'Otra persona contacto', 'Relación otra persona', 'Móvil otra persona', 'Email otra persona', 'Carpeta Dropbox', 'Fianza IVIMA (URL)', 'Contrato (URL)', 'Observaciones']
      getRow = r => [
        r.nombre || '',
        r.apellidos || '',
        r.dni_cif || '',
        r.tipo_persona?.tipo || '',
        r.responsable?.nombre_responsable || '',
        r.telefono || '',
        r.telefono_2 || '',
        r.movil || '',
        r.email || '',
        r.email_2 || '',
        r.inmuebles?.codigo || '',
        r.inmuebles ? `${r.inmuebles.calle || ''}${r.inmuebles.piso ? `, ${r.inmuebles.piso}` : ''}` : '',
        fmtDate(r.fecha_contrato),
        fmtDate(r.fecha_fin_contrato),
        fmtMoney(r.importe_fianza_ivima),
        fmtMoney(r.importe_deposito),
        r.seguro?.compania || '',
        r.num_poliza_seg_rentas || '',
        r.nombre_conyuge || '',
        r.apellidos_conyuge || '',
        r.movil_conyuge || '',
        r.email_conyuge || '',
        r.telefono_2_conyuge || '',
        r.email_2_conyuge || '',
        r.nombre_inq2 || '',
        r.apellidos_inq2 || '',
        r.dni_inq2 || '',
        r.tipo_inq2?.tipo || '',
        r.relacion_inq2 || '',
        r.telefono_inq2 || '',
        r.telefono_2_inq2 || '',
        r.movil_inq2 || '',
        r.email_inq2 || '',
        r.email_2_inq2 || '',
        r.nombre_inq3 || '',
        r.apellidos_inq3 || '',
        r.dni_inq3 || '',
        r.tipo_inq3?.tipo || '',
        r.relacion_inq3 || '',
        r.telefono_inq3 || '',
        r.telefono_2_inq3 || '',
        r.movil_inq3 || '',
        r.email_inq3 || '',
        r.email_2_inq3 || '',
        r.otra_persona_contacto || '',
        r.relacion_otra_persona || '',
        r.movil_otra_persona || '',
        r.email_otra_persona || '',
        r.carpeta_dropbox || '',
        r.fianza_ivima_url || '',
        r.contrato_url || '',
        r.observaciones || '',
      ]
    } else if (tab === 'inmuebles') {
      headers = ['Código', 'Calle', 'Número', 'Piso', 'Población', 'Provincia', 'Código postal', 'Tipo inmueble', 'Propietario', 'Otros propietarios', 'Administrador finca', 'Seguro hogar', 'Nº póliza', 'Registro', 'Nº finca registral', 'CRU', 'Referencia catastral', 'Nº garaje 1', 'Nº garaje 2', 'Nº trastero', 'Cía. eléctrica', 'CUPS electricidad', 'Titular electricidad', 'Cía. gas', 'CUPS gas', 'Titular gas', 'Cía. agua', 'Nº contrato agua', 'Titular agua', 'Carpeta Dropbox', 'Observaciones', 'Fecha baja']
      getRow = r => [
        r.codigo || '',
        r.calle || '',
        r.numero_calle || '',
        r.piso || '',
        r.poblacion || '',
        r.provincia || '',
        r.codigo_postal || '',
        r.tipo_inmueble?.tipo || '',
        r.propietarios ? `${r.propietarios.nombre || ''} ${r.propietarios.apellidos || ''}`.trim() : '',
        (r.inmueble_propietarios || []).map(x => `${x.propietarios?.nombre || ''} ${x.propietarios?.apellidos || ''}`.trim()).join(' | '),
        r.administrador_finca?.nombre || '',
        r.seguro?.compania || '',
        r.num_poliza_seg_hogar || '',
        r.registro || '',
        r.num_finca_registral_vivienda || '',
        r.cru || '',
        r.num_catastro_vivienda || '',
        r.num_garaje_1 || '',
        r.num_garaje_2 || '',
        r.num_trastero || '',
        r.cia_electrica || '',
        r.cups_electricidad || '',
        r.titular_contrato_electricidad || '',
        r.cia_gas || '',
        r.cups_gas || '',
        r.titular_contrato_gas || '',
        r.cia_agua || '',
        r.num_contrato_agua || '',
        r.titular_contrato_agua || '',
        r.carpeta_dropbox || '',
        r.observaciones || '',
        fmtDate(r.fecha_baja),
      ]
    } else if (tab === 'propietarios') {
      headers = ['Nombre', 'Apellidos', 'DNI/CIF', 'Tipo', 'Responsable', 'Teléfono', 'Teléfono 2', 'Móvil', 'Email', 'Email 2', 'Calle', 'Número', 'Piso', 'Municipio', 'Provincia', 'Código postal', 'Fecha baja', 'Nombre cónyuge', 'Apellidos cónyuge', 'DNI cónyuge', 'Móvil cónyuge', 'Email cónyuge', 'Teléfono 2 cónyuge', 'Email 2 cónyuge', 'Otra persona contacto', 'Relación otra persona', 'Móvil otra persona', 'Email otra persona', 'Observaciones', 'Inmuebles']
      getRow = r => [
        r.nombre || '',
        r.apellidos || '',
        r.dni_cif || '',
        r.tipo_persona?.tipo || '',
        r.responsable?.nombre_responsable || '',
        r.telefono || '',
        r.telefono_2 || '',
        r.movil || '',
        r.email || '',
        r.email_2 || '',
        r.calle || '',
        r.numero || '',
        r.piso || '',
        r.municipio || '',
        r.provincia || '',
        r.cod_postal || '',
        fmtDate(r.fecha_baja),
        r.nombre_conyuge || '',
        r.apellidos_conyuge || '',
        r.dni_conyuge || '',
        r.movil_conyuge || '',
        r.email_conyuge || '',
        r.telefono_2_conyuge || '',
        r.email_2_conyuge || '',
        r.otra_persona_contacto || '',
        r.relacion_otra_persona || '',
        r.movil_otra_persona || '',
        r.email_otra_persona || '',
        r.observaciones || '',
        (r.inmuebles_list || []).map(i => i.codigo).join(' | '),
      ]
    } else if (tab === 'contactos') {
      headers = ['Nombre', 'Apellidos', 'DNI/CIF', 'Tipo', 'Clasificación', 'Responsable', 'Origen conocimiento', 'Referenciado por', 'Teléfono', 'Teléfono 2', 'Móvil', 'Email', 'Email 2', 'Dirección', 'Fecha baja', 'Nombre cónyuge', 'Apellidos cónyuge', 'Móvil cónyuge', 'Email cónyuge', 'Observaciones']
      getRow = r => [
        r.nombre || '',
        r.apellidos || '',
        r.dni_cif || '',
        r.tipo_persona?.tipo || '',
        r.clasificacion_contacto?.clasificacion || '',
        r.responsable?.nombre_responsable || '',
        r.conocimiento?.origen || '',
        r.referenciado_por || '',
        r.telefono || '',
        r.telefono_2 || '',
        r.movil || '',
        r.email || '',
        r.email_2 || '',
        [r.calle, r.numero, r.piso, r.municipio, r.provincia, r.cod_postal].filter(Boolean).join(', '),
        fmtDate(r.fecha_baja),
        r.nombre_conyuge || '',
        r.apellidos_conyuge || '',
        r.movil_conyuge || '',
        r.email_conyuge || '',
        r.observaciones || '',
      ]
    }

    const ws_data = [headers, ...rows.map(getRow)]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(ws_data)
    XLSX.utils.book_append_sheet(wb, ws, tab)
    XLSX.writeFile(wb, `listado_${tab}.xlsx`)
  } catch(e) {
    console.error('Error exportando Excel:', e)
    alert('Error al exportar: ' + e.message)
  }
}

function imprimirListado() {
  window.print()
}

export default function Listados({ perfil }) {
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

    // Si es propietario, obtener sus inmueble_ids (principal + adicionales)
    let inmuebleIds = null
    if (perfil?.rol === 'propietario' && perfil?.propietario_id) {
      const [{ data: inmsDelProp }, { data: inmsCo }] = await Promise.all([
        supabase.from('inmuebles').select('id').eq('propietario_id', perfil.propietario_id),
        supabase.from('inmueble_propietarios').select('inmueble_id').eq('propietario_id', perfil.propietario_id),
      ])
      inmuebleIds = [...new Set([...(inmsDelProp || []).map(i => i.id), ...(inmsCo || []).map(i => i.inmueble_id)])]
    }

    if (t === 'contratos') {
      let q = supabase.from('inquilinos')
        .select('id, nombre, apellidos, dni_cif, movil, email, telefono, fecha_contrato, num_poliza_seg_rentas, importe_fianza_ivima, importe_deposito, inmuebles(codigo, calle, piso), seguro(compania)')
        .is('fecha_fin_contrato', null)
        .not('fecha_contrato', 'is', null)
        .order('fecha_contrato')
      if (inmuebleIds !== null) {
        if (inmuebleIds.length === 0) q = q.eq('inmueble_id', -1)
        else q = q.in('inmueble_id', inmuebleIds)
      }
      const { data: d } = await q
      data = d || []
    } else if (t === 'inquilinos') {
      let q = supabase.from('inquilinos')
        .select('*, inmuebles(codigo, calle, piso), seguro(compania), responsable(nombre_responsable), tipo_persona!inquilinos_tipo_id_fkey(tipo), tipo_inq2:tipo_persona!inquilinos_tipo_inq2_id_fkey(tipo), tipo_inq3:tipo_persona!inquilinos_tipo_inq3_id_fkey(tipo)')
        .order('nombre')
      if (inmuebleIds !== null) {
        if (inmuebleIds.length === 0) q = q.eq('inmueble_id', -1)
        else q = q.in('inmueble_id', inmuebleIds)
      }
      const { data: d } = await q
      data = d || []
    } else if (t === 'inmuebles') {
      let q = supabase.from('inmuebles')
        .select('id, codigo, calle, numero_calle, piso, poblacion, provincia, codigo_postal, registro, num_finca_registral_vivienda, cru, num_catastro_vivienda, num_garaje_1, num_garaje_2, num_trastero, num_poliza_seg_hogar, cia_electrica, cups_electricidad, titular_contrato_electricidad, cia_gas, cups_gas, titular_contrato_gas, cia_agua, num_contrato_agua, titular_contrato_agua, carpeta_dropbox, observaciones, fecha_baja, tipo_inmueble(tipo), seguro(compania), administrador_finca(nombre), propietarios!inmuebles_propietario_id_fkey(nombre, apellidos), inmueble_propietarios(propietarios(nombre, apellidos))')
        .order('codigo')
      if (inmuebleIds !== null) {
        if (inmuebleIds.length === 0) q = q.eq('id', -1)
        else q = q.in('id', inmuebleIds)
      }
      const { data: d } = await q
      data = d || []
    } else if (t === 'propietarios') {
      let q = supabase.from('propietarios')
        .select('id, nombre, apellidos, dni_cif, telefono, telefono_2, movil, email, email_2, calle, numero, piso, municipio, provincia, cod_postal, fecha_baja, nombre_conyuge, apellidos_conyuge, dni_conyuge, movil_conyuge, email_conyuge, telefono_2_conyuge, email_2_conyuge, otra_persona_contacto, relacion_otra_persona, movil_otra_persona, email_otra_persona, observaciones, tipo_persona(tipo), responsable(nombre_responsable)')
        .order('nombre')
      if (perfil?.rol === 'propietario' && perfil?.propietario_id) {
        q = q.eq('id', perfil.propietario_id)
      }
      const { data: d } = await q
      // Fetch inmuebles por propietario (principal + adicionales)
      const [{ data: inms }, { data: coInms }] = await Promise.all([
        supabase.from('inmuebles').select('propietario_id, codigo'),
        supabase.from('inmueble_propietarios').select('propietario_id, inmuebles(codigo)'),
      ])
      const inmMap = {}
      ;(inms || []).forEach(i => {
        if (!inmMap[i.propietario_id]) inmMap[i.propietario_id] = []
        inmMap[i.propietario_id].push(i)
      })
      ;(coInms || []).forEach(i => {
        if (!i.inmuebles) return
        if (!inmMap[i.propietario_id]) inmMap[i.propietario_id] = []
        if (!inmMap[i.propietario_id].some(x => x.codigo === i.inmuebles.codigo)) inmMap[i.propietario_id].push({ codigo: i.inmuebles.codigo })
      })
      data = (d || []).map(r => ({ ...r, inmuebles_list: inmMap[r.id] || [] }))
    } else if (t === 'contactos') {
      const { data: d } = await supabase.from('persona_contacto')
        .select('id, nombre, apellidos, dni_cif, telefono, telefono_2, movil, email, email_2, calle, numero, piso, municipio, provincia, cod_postal, fecha_baja, referenciado_por, observaciones, nombre_conyuge, apellidos_conyuge, movil_conyuge, email_conyuge, clasificacion_contacto(clasificacion), responsable(nombre_responsable), conocimiento(origen), tipo_persona(tipo)')
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

  function thProps(col) {
    return { onClick: () => toggleSort(col), style: { cursor: 'pointer', userSelect: 'none' } }
  }
  function sortIcon(col) {
    if (sortCol !== col) return '↕'
    return sortDir === 'asc' ? '↑' : '↓'
  }

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
          <button className="btn btn-ghost btn-sm" onClick={() => exportarExcel(rows, tab)}><i className="ti ti-table-export" /> Exportar Excel</button>
        </div>
        <div className="table-wrap">
          {loading ? <div className="loading"><i className="ti ti-loader ti-spin" /> Cargando...</div> : (<>

            {tab === 'contratos' && (
              <table>
                <thead><tr>
                  <th {...thProps('nombre')}>Inquilino <span style={{fontSize:10}}>{sortIcon('nombre')}</span></th>
                  <th {...thProps('inmueble')}>Inmueble <span style={{fontSize:10}}>{sortIcon('inmueble')}</span></th>
                  <th>Móvil</th>
                  <th {...thProps('fecha_contrato')}>Inicio contrato <span style={{fontSize:10}}>{sortIcon('fecha_contrato')}</span></th>
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
                  <th {...thProps('nombre')}>Nombre <span style={{fontSize:10}}>{sortIcon('nombre')}</span></th>
                  <th {...thProps('inmueble')}>Inmueble <span style={{fontSize:10}}>{sortIcon('inmueble')}</span></th>
                  <th>DNI/NIE</th>
                  <th>Móvil</th>
                  <th>Email</th>
                  <th {...thProps('fecha_contrato')}>Inicio <span style={{fontSize:10}}>{sortIcon('fecha_contrato')}</span></th>
                  <th {...thProps('fecha_fin_contrato')}>Fin <span style={{fontSize:10}}>{sortIcon('fecha_fin_contrato')}</span></th>
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
                  <th {...thProps('codigo')}>Código <span style={{fontSize:10}}>{sortIcon('codigo')}</span></th>
                  <th {...thProps('calle')}>Dirección <span style={{fontSize:10}}>{sortIcon('calle')}</span></th>
                  <th {...thProps('poblacion')}>Población <span style={{fontSize:10}}>{sortIcon('poblacion')}</span></th>
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
                      <td>{r.administrador_finca?.nombre || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'propietarios' && (
              <table>
                <thead><tr>
                  <th {...thProps('nombre')}>Nombre <span style={{fontSize:10}}>{sortIcon('nombre')}</span></th>
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
                  <th {...thProps('nombre')}>Nombre <span style={{fontSize:10}}>{sortIcon('nombre')}</span></th>
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

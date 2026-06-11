import { useEffect, useState } from 'react'
import { useCtrlG } from '../lib/useCtrlG'
import { supabase } from '../lib/supabase'
import Documentos from '../components/Documentos.jsx'
import { useSortable } from '../components/SortableTable.jsx'
import * as XLSX from 'xlsx'

function norm(s) {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}
function ms(fields, q) {
  var n = norm(q)
  if (!n) return true
  return fields.some(function(f) { return norm(f).indexOf(n) !== -1 })
}

const EMPTY = { nombre: '', apellidos: '', dni_cif: '', tipo_id: '', responsable_id: '', telefono: '', movil: '', telefono_2: '', email: '', email_2: '', calle: '', numero: '', piso: '', municipio: '', provincia: '', cod_postal: '', observaciones: '', nombre_conyuge: '', apellidos_conyuge: '', dni_conyuge: '', movil_conyuge: '', email_conyuge: '', telefono_2_conyuge: '', email_2_conyuge: '', otra_persona_contacto: '', movil_otra_persona: '', email_otra_persona: '', relacion_otra_persona: '', prop_final: '', fecha_baja: '' }

export default function Propietarios({ perfil }) {
  const [rows, setRows] = useState([])
  const [tipos, setTipos] = useState([])
  const [responsables, setResponsables] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState('vigor')
  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [inmuebles, setInmuebles] = useState([])
  const { sortData, sortIcon, thProps } = useSortable('nombre')

  useEffect(() => { load() }, [])
  useCtrlG(save, !!modal)

  async function load() {
    setLoading(true)
    const [{ data: props }, { data: tipos }, { data: resps }] = await Promise.all([
      (() => {
        let q = supabase.from('propietarios').select('*, tipo_persona(tipo), responsable(nombre_responsable)').order('nombre')
        if (perfil?.rol === 'propietario' && perfil?.propietario_id) q = q.eq('id', perfil.propietario_id)
        return q
      })(),
      supabase.from('tipo_persona').select('*'),
      supabase.from('responsable').select('*'),
    ])
    setRows(props || [])
    setTipos(tipos || [])
    setResponsables(resps || [])
    setLoading(false)
  }

  async function selectRow(row) {
    setSelected(row)
    const { data } = await supabase.from('inmuebles').select('id, codigo, calle, piso').eq('propietario_id', row.id)
    setInmuebles(data || [])
  }

  async function save() {
    const data = { ...form }
    Object.keys(data).forEach(k => { if (data[k] === '' || data[k] === undefined) data[k] = null })
    if (modal === 'new') {
      await supabase.from('propietarios').insert(data)
    } else {
      const { id: _id, tipo_persona: _, responsable: __, ...updateData } = data
      const { error } = await supabase.from('propietarios').update(updateData).eq('id', form.id)
      if (error) { alert('Error al guardar: ' + error.message); return }
    }
    setModal(null); load()
  }

  async function del(id) {
    if (!confirm('¿Eliminar este propietario?')) return
    await supabase.from('propietarios').delete().eq('id', id)
    setSelected(null); load()
  }

  async function exportExcel() {
    // Fetch inmuebles de todos los propietarios de una vez
    const ids = rows.map(r => r.id)
    const { data: todosInmuebles } = await supabase
      .from('inmuebles')
      .select('propietario_id, codigo, calle, piso, municipio, provincia')
      .in('propietario_id', ids)

    const inmueblesPorPropietario = {}
    ;(todosInmuebles || []).forEach(i => {
      if (!inmueblesPorPropietario[i.propietario_id]) inmueblesPorPropietario[i.propietario_id] = []
      inmueblesPorPropietario[i.propietario_id].push(i)
    })

    const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES') : ''

    const data = filtered().map(r => {
      const inms = inmueblesPorPropietario[r.id] || []
      const inmsStr = inms.map(i => [i.codigo, i.calle, i.piso, i.municipio, i.provincia].filter(Boolean).join(' ')).join(' | ')
      return {
        'Nombre': r.nombre || '',
        'Apellidos': r.apellidos || '',
        'DNI / CIF': r.dni_cif || '',
        'Tipo': r.tipo_persona?.tipo || '',
        'Responsable': r.responsable?.nombre_responsable || '',
        'Teléfono': r.telefono || '',
        'Teléfono 2': r.telefono_2 || '',
        'Móvil': r.movil || '',
        'Email': r.email || '',
        'Email 2': r.email_2 || '',
        'Calle': r.calle || '',
        'Número': r.numero || '',
        'Piso': r.piso || '',
        'Municipio': r.municipio || '',
        'Provincia': r.provincia || '',
        'Código postal': r.cod_postal || '',
        'Fecha baja': fmtDate(r.fecha_baja),
        'Nombre cónyuge': r.nombre_conyuge || '',
        'Apellidos cónyuge': r.apellidos_conyuge || '',
        'DNI cónyuge': r.dni_conyuge || '',
        'Móvil cónyuge': r.movil_conyuge || '',
        'Email cónyuge': r.email_conyuge || '',
        'Teléfono 2 cónyuge': r.telefono_2_conyuge || '',
        'Email 2 cónyuge': r.email_2_conyuge || '',
        'Otra persona contacto': r.otra_persona_contacto || '',
        'Relación otra persona': r.relacion_otra_persona || '',
        'Móvil otra persona': r.movil_otra_persona || '',
        'Email otra persona': r.email_otra_persona || '',
        'Observaciones': r.observaciones || '',
        'Inmuebles': inmsStr,
      }
    })

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Propietarios')
    XLSX.writeFile(wb, 'Propietarios.xlsx')
  }

  const nombre = r => `${r.nombre || ''} ${r.apellidos || ''}`.trim() || '—'
  const initials = r => nombre(r).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES') : '—'
  const f = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }))

  function filtered() {
    let data = rows.filter(r => {
      const matchSearch = ms([r.nombre, r.apellidos, r.email, r.movil, r.dni_cif], search)
      const matchFiltro = filtro === 'todos' ? true : filtro === 'vigor' ? !r.fecha_baja : !!r.fecha_baja
      return matchSearch && matchFiltro
    })
    return sortData(data, (r, col) => {
      if (col === 'nombre') return nombre(r)
      if (col === 'tipo') return r.tipo_persona?.tipo
      if (col === 'responsable') return r.responsable?.nombre_responsable
      return r[col]
    })
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>Propietarios <span className="badge badge-gray" style={{ marginLeft: 6 }}>{filtered().length}</span></h2>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['vigor','En vigor'],['finalizados','Con baja'],['todos','Todos']].map(([v,l]) => (
              <button key={v} className={`btn btn-sm ${filtro === v ? 'btn-primary' : ''}`} onClick={() => setFiltro(v)}>{l}</button>
            ))}
          </div>
          <div className="search-input"><i className="ti ti-search" /><input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <button className="btn btn-sm" onClick={exportExcel} title="Exportar Excel"><i className="ti ti-file-spreadsheet" /> Excel</button>
          <button className="btn btn-primary btn-sm" onClick={() => { setForm(EMPTY); setModal('new') }}><i className="ti ti-plus" /> Nuevo</button>
        </div>

        {/* ... resto del JSX sin cambios ... */}

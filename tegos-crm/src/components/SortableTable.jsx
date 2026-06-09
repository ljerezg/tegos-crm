import { useState } from 'react'

export function useSortable(defaultCol, defaultDir) {
  const col0 = defaultCol || ''
  const dir0 = defaultDir || 'asc'
  const [sortCol, setSortCol] = useState(col0)
  const [sortDir, setSortDir] = useState(dir0)

  function toggleSort(col) {
    if (sortCol === col) {
      setSortDir(function(d) { return d === 'asc' ? 'desc' : 'asc' })
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  function sortData(data, getValue) {
    if (!sortCol) return data
    var dir = sortDir
    var col = sortCol
    return data.slice().sort(function(a, b) {
      var va = getValue(a, col) || ''
      var vb = getValue(b, col) || ''
      var cmp = String(va).localeCompare(String(vb))
      return dir === 'asc' ? cmp : -cmp
    })
  }

  function Th(props) {
    var col = props.col
    var label = props.label
    var icon = null
    if (sortCol !== col) {
      icon = <i className="ti ti-selector" style={{ fontSize: 11, marginLeft: 3, opacity: 0.3 }} />
    } else {
      icon = <i className={sortDir === 'asc' ? 'ti ti-chevron-up' : 'ti ti-chevron-down'} style={{ fontSize: 11, marginLeft: 3 }} />
    }
    return (
      <th onClick={function() { toggleSort(col) }} style={{ cursor: 'pointer', userSelect: 'none' }}>
        {label}{icon}
      </th>
    )
  }

  return { sortCol: sortCol, sortDir: sortDir, toggleSort: toggleSort, sortData: sortData, Th: Th }
}

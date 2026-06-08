import { useState } from 'react'

export function useSortable(defaultCol = '', defaultDir = 'asc') {
  const [sortCol, setSortCol] = useState(defaultCol)
  const [sortDir, setSortDir] = useState(defaultDir)

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function sortData(data, getValue) {
    if (!sortCol) return data
    return [...data].sort((a, b) => {
      const va = getValue(a, sortCol) || ''
      const vb = getValue(b, sortCol) || ''
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
    })
  }

  function SortIcon({ col }) {
    if (sortCol !== col) return <i className="ti ti-selector" style={{ fontSize: 11, marginLeft: 3, opacity: 0.3 }} />
    return <i className={`ti ti-chevron-${sortDir === 'asc' ? 'up' : 'down'}`} style={{ fontSize: 11, marginLeft: 3 }} />
  }

  function Th({ col, label, style = {} }) {
    return (
      <th onClick={() => toggleSort(col)} style={{ cursor: 'pointer', userSelect: 'none', ...style }}>
        {label}<SortIcon col={col} />
      </th>
    )
  }

  return { sortCol, sortDir, toggleSort, sortData, SortIcon, Th }
}

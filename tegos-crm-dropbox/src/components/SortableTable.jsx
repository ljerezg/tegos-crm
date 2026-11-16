import { useState } from 'react'

export function useSortable(defaultCol, defaultDir) {
  const [sortCol, setSortCol] = useState(defaultCol || '')
  const [sortDir, setSortDir] = useState(defaultDir || 'asc')

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function sortData(data, getValue) {
    if (!sortCol) return data
    return [...data].sort((a, b) => {
      const va = getValue(a, sortCol)
      const vb = getValue(b, sortCol)
      const ea = va === null || va === undefined || va === ''
      const eb = vb === null || vb === undefined || vb === ''
      if (ea && eb) return 0
      if (ea) return 1
      if (eb) return -1
      let cmp
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb
      else cmp = String(va).localeCompare(String(vb), 'es', { numeric: true, sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  function sortIcon(col) {
    if (sortCol !== col) return '↕'
    return sortDir === 'asc' ? '↑' : '↓'
  }

  function thProps(col) {
    return {
      onClick: () => toggleSort(col),
      style: { cursor: 'pointer', userSelect: 'none' }
    }
  }

  return { sortCol, sortDir, toggleSort, sortData, sortIcon, thProps }
}

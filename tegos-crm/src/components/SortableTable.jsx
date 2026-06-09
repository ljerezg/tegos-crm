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
      const va = getValue(a, sortCol) || ''
      const vb = getValue(b, sortCol) || ''
      const cmp = String(va).localeCompare(String(vb))
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

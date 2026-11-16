// Normaliza texto eliminando tildes para búsquedas insensibles a acentos
export function normalize(str) {
  if (!str) return ''
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

// Busca en múltiples campos ignorando tildes y mayúsculas
export function matchSearch(fields, query) {
  const q = normalize(query)
  if (!q) return true
  return fields.some(f => normalize(f).includes(q))
}

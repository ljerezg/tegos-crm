import { useState, useRef, useEffect } from 'react'

export default function SearchSelect({ options, value, onChange, placeholder = 'Buscar...', emptyLabel = '— Sin asignar —' }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const ref = useRef()
  const triggerRef = useRef()

  const selected = options.find(o => String(o.id) === String(value))

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function handleOpen() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 2, left: rect.left, width: rect.width })
    }
    setOpen(o => !o)
    setSearch('')
  }

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase())).slice(0, 20)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        ref={triggerRef}
        onClick={handleOpen}
        style={{ padding: '8px 11px', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', fontSize: 13, background: 'var(--bg2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span style={{ color: selected ? 'var(--text)' : 'var(--text3)' }}>{selected ? selected.label : emptyLabel}</span>
        <i className="ti ti-chevron-down" style={{ fontSize: 14, color: 'var(--text3)' }} />
      </div>
      {open && (
        <div style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)' }}>
          <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={placeholder}
              style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, background: 'transparent', fontFamily: 'var(--font)' }}
            />
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            <div
              onClick={() => { onChange(''); setOpen(false) }}
              style={{ padding: '7px 11px', fontSize: 13, cursor: 'pointer', color: 'var(--text3)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >{emptyLabel}</div>
            {filtered.map(o => (
              <div
                key={o.id}
                onClick={() => { onChange(o.id); setOpen(false) }}
                style={{ padding: '7px 11px', fontSize: 13, cursor: 'pointer', background: String(o.id) === String(value) ? 'var(--accent-bg)' : '', color: String(o.id) === String(value) ? 'var(--accent)' : 'var(--text)' }}
                onMouseEnter={e => { if (String(o.id) !== String(value)) e.currentTarget.style.background = 'var(--bg3)' }}
                onMouseLeave={e => { if (String(o.id) !== String(value)) e.currentTarget.style.background = '' }}
              >{o.label}</div>
            ))}
            {filtered.length === 0 && <div style={{ padding: '7px 11px', fontSize: 13, color: 'var(--text3)' }}>Sin resultados</div>}
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect } from 'react'

export function useCtrlG(onSave, active = true) {
  useEffect(() => {
    if (!active) return
    function handler(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault()
        onSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onSave, active])
}

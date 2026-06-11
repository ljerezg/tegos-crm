import { useEffect, useRef } from 'react'

export function useCtrlG(onSave, active = true) {
  const savedCallback = useRef(onSave)
  
  useEffect(() => {
    savedCallback.current = onSave
  }, [onSave])

  useEffect(() => {
    function handler(e) {
      if (!active) return
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault()
        savedCallback.current()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [active])
}

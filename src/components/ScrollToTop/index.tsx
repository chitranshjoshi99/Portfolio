import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Scrolls the window back to (0, 0) on every route change.
 * Place this anywhere inside <BrowserRouter> — it renders nothing.
 */
export function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])

  return null
}

import { useEffect } from 'react'
import { HashRouter } from 'react-router-dom'

import { useAppStore } from '@/stores/useAppStore'

import { AppRouter } from './router'

export function App() {
  const initialize = useAppStore((state) => state.initialize)

  useEffect(() => {
    void initialize()
  }, [initialize])

  return (
    <HashRouter>
      <AppRouter />
    </HashRouter>
  )
}


import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { createDemoRepository } from '../demo/demoRepository'
import { SessionContext, type SessionMode, type SessionValue } from './context'

const demoKey = 'ws12.demo'

function readStoredMode(): SessionMode {
  try {
    return window.sessionStorage.getItem(demoKey) === 'on' ? 'demo' : 'signed-out'
  } catch {
    return 'signed-out'
  }
}

function storeDemo(on: boolean) {
  try {
    if (on) window.sessionStorage.setItem(demoKey, 'on')
    else window.sessionStorage.removeItem(demoKey)
  } catch {
    // Storage can be blocked; demo mode then lasts until the page is closed.
  }
}

// Sign-in with Supabase is added in Sprint 2. Until then the app runs in demo mode only,
// which needs no Supabase project or environment variables.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<SessionMode>(readStoredMode)

  const enterDemo = useCallback(() => {
    storeDemo(true)
    setMode('demo')
  }, [])

  const leaveDemo = useCallback(() => {
    storeDemo(false)
    setMode('signed-out')
  }, [])

  const repository = useMemo(() => (mode === 'demo' ? createDemoRepository() : null), [mode])

  const value = useMemo<SessionValue>(
    () => ({ mode, repository, enterDemo, leaveDemo }),
    [mode, repository, enterDemo, leaveDemo],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

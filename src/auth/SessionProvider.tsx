import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AuthService, Backend, SessionUser } from '../data/auth'
import { loadBackend } from '../data/backend'
import { createDemoRepository } from '../demo/demoRepository'
import { SessionContext, type SessionMode, type SessionValue } from './context'

const demoKey = 'ws12.demo'

function readDemoFlag(): boolean {
  try {
    return window.sessionStorage.getItem(demoKey) === 'on'
  } catch {
    return false
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

// Keeps the same object for the same person, so a token refresh does not rebuild the repository.
function sameUser(current: SessionUser | null, next: SessionUser | null): SessionUser | null {
  if (current && next && current.id === next.id && current.emailVerified === next.emailVerified) {
    return current
  }
  return next
}

interface SessionProviderProps {
  children: ReactNode
  // Tests pass a fake backend. By default Supabase is used when it is configured.
  backend?: Promise<Backend> | null
}

const defaultBackend = loadBackend()

export function SessionProvider({ children, backend = defaultBackend }: SessionProviderProps) {
  const [demo, setDemo] = useState(readDemoFlag)
  const [loaded, setLoaded] = useState<Backend | null>(null)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [checking, setChecking] = useState(backend !== null)
  const claimed = useRef(new Set<string>())

  useEffect(() => {
    if (!backend) return
    let active = true
    let unsubscribe: (() => void) | undefined

    backend
      .then(async (ready) => {
        if (!active) return
        setLoaded(ready)
        unsubscribe = ready.auth.onChange((next, event) => {
          if (event === 'signed-out') claimed.current.clear()
          if (event === 'signed-in' && next) {
            storeDemo(false)
            setDemo(false)
          }
          setUser((current) => sameUser(current, next))
        })
        const current = await ready.auth.getSessionUser().catch(() => null)
        if (active) setUser((previous) => sameUser(previous, current))
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setChecking(false)
      })

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [backend])

  const auth: AuthService | null = loaded?.auth ?? null

  const mode: SessionMode = demo
    ? 'demo'
    : checking
      ? 'loading'
      : user && loaded
        ? 'signed-in'
        : 'signed-out'

  const repository = useMemo(() => {
    if (mode === 'demo') return createDemoRepository()
    if (mode === 'signed-in' && user && loaded) return loaded.createRepository(user)
    return null
  }, [mode, user, loaded])

  const enterDemo = useCallback(() => {
    storeDemo(true)
    setDemo(true)
  }, [])

  const leaveDemo = useCallback(() => {
    storeDemo(false)
    setDemo(false)
  }, [])

  const signOut = useCallback(async () => {
    if (demo) {
      leaveDemo()
      return
    }
    claimed.current.clear()
    try {
      await auth?.signOut()
    } finally {
      setUser(null)
    }
  }, [auth, demo, leaveDemo])

  const claimEntitlementsOnce = useCallback(async () => {
    if (!repository || repository.isDemo || !user || claimed.current.has(user.id)) return
    claimed.current.add(user.id)
    try {
      await repository.claimEntitlements()
    } catch {
      // Claiming is retried on the next sign-in; it never blocks the learner.
      claimed.current.delete(user.id)
    }
  }, [repository, user])

  const value = useMemo<SessionValue>(
    () => ({
      mode,
      user: mode === 'signed-in' ? user : null,
      repository,
      auth,
      authConfigured: backend !== null,
      enterDemo,
      leaveDemo,
      signOut,
      claimEntitlementsOnce,
    }),
    [mode, user, repository, auth, backend, enterDemo, leaveDemo, signOut, claimEntitlementsOnce],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

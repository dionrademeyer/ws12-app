import { useMemo } from 'react'
import { createBrowserRouter, createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '../auth/SessionProvider'
import type { Backend } from '../data/auth'
import { I18nProvider } from '../i18n/I18nProvider'
import { routes } from './routes'

interface AppProps {
  initialPath?: string
  // Tests pass a fake backend; the app uses Supabase when it is configured.
  backend?: Promise<Backend> | null
}

export function App({ initialPath, backend }: AppProps) {
  const router = useMemo(
    () =>
      initialPath
        ? createMemoryRouter(routes, { initialEntries: [initialPath] })
        : createBrowserRouter(routes),
    [initialPath],
  )

  return (
    <I18nProvider>
      <SessionProvider {...(backend !== undefined ? { backend } : {})}>
        <RouterProvider router={router} />
      </SessionProvider>
    </I18nProvider>
  )
}

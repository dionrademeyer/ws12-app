import { useMemo } from 'react'
import { createBrowserRouter, createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '../auth/SessionProvider'
import { I18nProvider } from '../i18n/I18nProvider'
import { routes } from './routes'

export function App({ initialPath }: { initialPath?: string }) {
  const router = useMemo(
    () =>
      initialPath
        ? createMemoryRouter(routes, { initialEntries: [initialPath] })
        : createBrowserRouter(routes),
    [initialPath],
  )

  return (
    <I18nProvider>
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
    </I18nProvider>
  )
}

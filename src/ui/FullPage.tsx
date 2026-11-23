import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { FullPageLoading } from './FullPageLoading'

// Route wrapper for lazy screens that fill the page, outside the app shell.
export function FullPage() {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <Outlet />
    </Suspense>
  )
}

import { Navigate, Outlet } from 'react-router-dom'
import { FullPageLoading } from '../ui/FullPageLoading'
import { useSession } from './useSession'

export function RequireSession() {
  const { mode } = useSession()
  if (mode === 'loading') return <FullPageLoading />
  return mode === 'signed-out' ? <Navigate to="/" replace /> : <Outlet />
}

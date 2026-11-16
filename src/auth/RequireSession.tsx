import { Navigate, Outlet } from 'react-router-dom'
import { useSession } from './useSession'

export function RequireSession() {
  const { mode } = useSession()
  return mode === 'signed-out' ? <Navigate to="/" replace /> : <Outlet />
}

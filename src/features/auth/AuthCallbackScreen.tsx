import { Navigate, useLocation } from 'react-router-dom'
import { startPath } from '../../auth/accountRouting'
import { useSession } from '../../auth/useSession'
import { FullPageLoading } from '../../ui/FullPageLoading'
import { authErrorInUrl } from './authLinks'

// Google and the email links return here. Supabase reads the session from the URL while it
// starts, so once the session check is done the person is either signed in or the link failed.
export function AuthCallbackScreen() {
  const { mode } = useSession()
  const location = useLocation()

  if (authErrorInUrl(location.search, location.hash)) {
    return <Navigate to="/?auth_error=1" replace />
  }
  if (mode === 'loading') return <FullPageLoading />
  if (mode === 'signed-in') return <Navigate to={startPath} replace />
  return <Navigate to="/?auth_error=1" replace />
}

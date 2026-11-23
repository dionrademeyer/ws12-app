import { useEffect, useRef } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useRepositoryQuery } from '../data/useRepositoryQuery'
import { errorMessageKey } from '../i18n/errorMessages'
import { useI18n } from '../i18n/useI18n'
import { Button } from '../ui/Button'
import { FullPageLoading } from '../ui/FullPageLoading'
import { Notice } from '../ui/Notice'
import { StandaloneLayout } from '../ui/StandaloneLayout'
import { isAccountReady, startPath } from './accountRouting'
import { useSyncAccountLanguage } from './useAccountLanguage'
import { useSession } from './useSession'

// The app opens only for an account that is ready for it. Anyone who still has to answer the
// age question, wait for consent or finish onboarding goes back through the account check.
export function RequireAccountReady() {
  const { mode } = useSession()
  if (mode === 'demo') return <Outlet />
  return <AccountCheck />
}

function AccountCheck() {
  const { t } = useI18n()
  const { repository } = useSession()
  const query = useRepositoryQuery((loaded) => loaded.getAccountState())
  const syncLanguage = useSyncAccountLanguage()
  const synced = useRef(false)

  const state = query.state.status === 'ready' ? query.state.data : null
  useEffect(() => {
    if (!state || !repository || synced.current) return
    synced.current = true
    syncLanguage(state, repository)
  }, [state, repository, syncLanguage])

  if (query.state.status === 'loading') return <FullPageLoading />
  if (query.state.status === 'error') {
    return (
      <StandaloneLayout>
        <h1 className="text-2xl font-bold">{t('gate.failed')}</h1>
        <Notice tone="error">{t(errorMessageKey(query.state.code))}</Notice>
        <Button full onClick={query.retry}>
          {t('common.retry')}
        </Button>
      </StandaloneLayout>
    )
  }
  return isAccountReady(query.state.data) ? <Outlet /> : <Navigate to={startPath} replace />
}

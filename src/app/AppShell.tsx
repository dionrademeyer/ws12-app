import { Suspense, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useSession } from '../auth/useSession'
import { useLearnerProfile } from '../data/useLearnerProfile'
import { useI18n } from '../i18n/useI18n'
import { AvatarMenu } from '../ui/AvatarMenu'
import { BottomNav } from '../ui/BottomNav'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { DemoBanner } from '../ui/DemoBanner'
import { Header } from '../ui/Header'
import { Icon } from '../ui/Icon'
import { LoadingCard } from '../ui/LoadStates'
import { Sidebar } from '../ui/Sidebar'
import { avatarMenu, dashboardPath, primaryNav, secondaryNav } from './navigation'

function initialsOf(firstName?: string, lastName?: string): string {
  return [firstName, lastName]
    .map((part) => part?.trim().charAt(0) ?? '')
    .join('')
    .toUpperCase()
}

export function AppShell() {
  const { t } = useI18n()
  const { mode, signOut } = useSession()
  const profile = useLearnerProfile()
  const navigate = useNavigate()
  const location = useLocation()
  const onDashboard = location.pathname === dashboardPath
  const unread = 0
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutFailed, setLogoutFailed] = useState(false)

  async function logOut() {
    setLoggingOut(true)
    setLogoutFailed(false)
    try {
      await signOut()
      navigate('/', { replace: true })
    } catch {
      setLogoutFailed(true)
      setLoggingOut(false)
    }
  }

  const initials =
    profile.status === 'ready'
      ? initialsOf(profile.profile.firstName, profile.profile.lastName)
      : ''

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded bg-white px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('a11y.skipToContent')}
      </a>
      {mode === 'demo' && <DemoBanner />}
      <Header
        onBack={onDashboard ? undefined : () => navigate(dashboardPath)}
        notificationsLink={
          <Link
            to="/app/notifications"
            aria-label={t('a11y.notifications', { count: unread })}
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
          >
            <Icon name="bell" />
          </Link>
        }
        avatar={
          <AvatarMenu
            initials={initials}
            items={avatarMenu}
            onLogout={() => setConfirmLogout(true)}
          />
        }
      />
      <div className="mx-auto flex w-full max-w-6xl flex-1">
        <Sidebar primary={primaryNav} secondary={secondaryNav} />
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 pt-5 pb-24 lg:px-8 lg:pb-10">
          <Suspense fallback={<LoadingCard />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <BottomNav items={primaryNav} />
      {confirmLogout && (
        <ConfirmDialog
          title={t('logout.title')}
          confirmLabel={t('menu.logout')}
          cancelLabel={t('common.cancel')}
          busy={loggingOut}
          onConfirm={logOut}
          onCancel={() => {
            setConfirmLogout(false)
            setLogoutFailed(false)
          }}
        >
          {logoutFailed ? t('logout.failed') : t('logout.body')}
        </ConfirmDialog>
      )}
    </div>
  )
}

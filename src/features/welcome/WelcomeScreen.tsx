import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { dashboardPath } from '../../app/navigation'
import { startPath } from '../../auth/accountRouting'
import { useSession } from '../../auth/useSession'
import { errorCodeOf } from '../../data/errors'
import { errorMessageKey } from '../../i18n/errorMessages'
import { useI18n } from '../../i18n/useI18n'
import { buttonClass } from '../../ui/buttonClass'
import { FullPageLoading } from '../../ui/FullPageLoading'
import { LanguageSwitch } from '../../ui/LanguageSwitch'
import { useOnline } from '../../ui/useOnline'
import { absoluteUrl, callbackPath, registerPath, signInPath } from '../auth/authLinks'
import { GoogleButton } from '../auth/GoogleButton'

const linkClass =
  'inline-flex min-h-11 items-center px-2 font-bold text-white underline underline-offset-4'

export function WelcomeScreen() {
  const { t } = useI18n()
  const { mode, auth, authConfigured, enterDemo } = useSession()
  const navigate = useNavigate()
  const online = useOnline()
  const [params] = useSearchParams()
  const [googleBusy, setGoogleBusy] = useState(false)
  const [googleError, setGoogleError] = useState<string | null>(
    params.has('auth_error') ? t('auth.googleFailed') : null,
  )
  const [notSetUp, setNotSetUp] = useState(false)

  if (mode === 'loading') return <FullPageLoading />
  if (mode === 'signed-in') return <Navigate to={startPath} replace />

  async function continueWithGoogle() {
    if (!auth) {
      setNotSetUp(true)
      return
    }
    setGoogleError(null)
    setGoogleBusy(true)
    try {
      await auth.signInWithProvider('google', absoluteUrl(callbackPath))
    } catch (error) {
      const code = errorCodeOf(error)
      setGoogleError(code === 'network' ? t(errorMessageKey(code)) : t('auth.googleFailed'))
      setGoogleBusy(false)
    }
  }

  function continueWithEmail() {
    if (!authConfigured) setNotSetUp(true)
    else navigate(registerPath)
  }

  return (
    <main className="on-dark flex min-h-dvh flex-col bg-gradient-to-b from-navy via-navy to-indigo px-5 py-6 text-white">
      <div className="flex justify-end">
        <LanguageSwitch tone="dark" />
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 text-center">
        <p className="text-5xl font-extrabold tracking-wide text-gold">{t('app.shortName')}</p>
        <h1 className="text-2xl font-bold">{t('app.name')}</h1>
        <p className="text-lg">{t('welcome.tagline')}</p>

        {!online && (
          <p role="status" className="rounded-2xl bg-white/10 px-4 py-3 font-semibold">
            {t('welcome.offline')}
          </p>
        )}

        <div className="flex flex-col gap-3">
          <GoogleButton
            variant="gold"
            onClick={continueWithGoogle}
            busy={googleBusy}
            disabled={!online}
            describedBy={googleError ? 'google-error' : undefined}
          />
          {googleError && (
            <p id="google-error" role="alert" className="text-sm font-semibold text-gold">
              {googleError}
            </p>
          )}
          <button
            type="button"
            onClick={continueWithEmail}
            disabled={!online}
            className={buttonClass('light', true)}
          >
            {t('auth.continueEmail')}
          </button>
          {notSetUp && (
            <p role="alert" className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold">
              {t('auth.notSetUp')}
            </p>
          )}
        </div>

        <p className="flex flex-wrap items-center justify-center gap-x-4">
          <Link to={signInPath} className={linkClass}>
            {t('auth.login')}
          </Link>
          <span aria-hidden="true">|</span>
          <Link to={registerPath} className={linkClass}>
            {t('auth.register')}
          </Link>
        </p>

        <button
          type="button"
          onClick={() => {
            enterDemo()
            navigate(dashboardPath)
          }}
          className={linkClass + ' self-center'}
        >
          {t('welcome.tryDemo')}
        </button>
        <p className="text-sm text-white/85">{t('welcome.basedOn')}</p>
      </div>
    </main>
  )
}

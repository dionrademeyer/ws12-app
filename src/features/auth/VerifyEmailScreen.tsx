import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { startPath } from '../../auth/accountRouting'
import { useSession } from '../../auth/useSession'
import { errorCodeOf, type ErrorCode } from '../../data/errors'
import { errorMessageKey } from '../../i18n/errorMessages'
import { useI18n } from '../../i18n/useI18n'
import { Button } from '../../ui/Button'
import { Notice } from '../../ui/Notice'
import { StandaloneLayout } from '../../ui/StandaloneLayout'
import { absoluteUrl, callbackPath, registerPath, signInPath } from './authLinks'

export const resendDelaySeconds = 60

const textLink = 'inline-flex min-h-11 items-center font-bold text-indigo underline'

export function VerifyEmailScreen() {
  const { t } = useI18n()
  const { mode, auth } = useSession()
  const location = useLocation()
  const email = (location.state as { email?: string } | null)?.email ?? null
  const [secondsLeft, setSecondsLeft] = useState(resendDelaySeconds)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<'sent' | ErrorCode | null>(null)

  useEffect(() => {
    if (secondsLeft <= 0) return
    const timer = window.setTimeout(() => setSecondsLeft((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [secondsLeft])

  if (mode === 'signed-in') return <Navigate to={startPath} replace />

  async function resend() {
    if (!auth || !email) return
    setBusy(true)
    setResult(null)
    try {
      await auth.resendVerification(email, absoluteUrl(callbackPath))
      setResult('sent')
      setSecondsLeft(resendDelaySeconds)
    } catch (error) {
      setResult(errorCodeOf(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <StandaloneLayout>
      <h1 className="text-2xl font-bold">{t('verify.title')}</h1>
      <p>{email ? t('verify.sentTo', { email }) : t('verify.sentGeneric')}</p>
      <p className="text-navy/80">{t('verify.spam')}</p>
      {result === 'sent' && <Notice tone="success">{t('verify.resent')}</Notice>}
      {result && result !== 'sent' && <Notice tone="error">{t(errorMessageKey(result))}</Notice>}
      {email ? (
        <Button
          full
          variant="secondary"
          busy={busy}
          disabled={secondsLeft > 0 || !auth}
          onClick={resend}
        >
          {secondsLeft > 0 ? t('verify.resendIn', { seconds: secondsLeft }) : t('verify.resend')}
        </Button>
      ) : null}
      <div className="flex flex-col items-center">
        <Link to={signInPath} className={textLink}>
          {t('verify.verified')}
        </Link>
        <Link to={registerPath} className={textLink}>
          {t('verify.differentEmail')}
        </Link>
      </div>
    </StandaloneLayout>
  )
}

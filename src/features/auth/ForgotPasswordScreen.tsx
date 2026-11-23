import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../../auth/useSession'
import { errorCodeOf, type ErrorCode } from '../../data/errors'
import { errorMessageKey } from '../../i18n/errorMessages'
import { useI18n } from '../../i18n/useI18n'
import { Button } from '../../ui/Button'
import { Notice } from '../../ui/Notice'
import { StandaloneLayout } from '../../ui/StandaloneLayout'
import { TextField } from '../../ui/TextField'
import { absoluteUrl, looksLikeEmail, resetPasswordPath, signInPath } from './authLinks'
import { NotSetUp } from './NotSetUp'

export function ForgotPasswordScreen() {
  const { t } = useI18n()
  const { auth, authConfigured } = useSession()
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<'sent' | ErrorCode | null>(null)

  async function send(event: FormEvent) {
    event.preventDefault()
    if (!auth) return
    if (!looksLikeEmail(email)) {
      setEmailError(t('auth.emailInvalid'))
      return
    }
    setEmailError(null)
    setBusy(true)
    setResult(null)
    try {
      await auth.sendPasswordReset(email.trim(), absoluteUrl(resetPasswordPath))
      setResult('sent')
    } catch (error) {
      setResult(errorCodeOf(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <StandaloneLayout>
      <h1 className="text-2xl font-bold">{t('forgot.title')}</h1>
      <p>{t('forgot.intro')}</p>
      {!authConfigured ? (
        <NotSetUp />
      ) : result === 'sent' ? (
        <Notice tone="success">{t('forgot.sent', { email: email.trim() })}</Notice>
      ) : (
        <form noValidate onSubmit={send} className="flex flex-col gap-5">
          <TextField
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={emailError}
          />
          {result && <Notice tone="error">{t(errorMessageKey(result))}</Notice>}
          <Button type="submit" full busy={busy}>
            {t('forgot.submit')}
          </Button>
        </form>
      )}
      <Link
        to={signInPath}
        className="inline-flex min-h-11 items-center self-center font-bold text-indigo underline"
      >
        {t('forgot.back')}
      </Link>
    </StandaloneLayout>
  )
}

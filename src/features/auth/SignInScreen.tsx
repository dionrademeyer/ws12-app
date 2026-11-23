import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { startPath } from '../../auth/accountRouting'
import { useSession } from '../../auth/useSession'
import { errorCodeOf, type ErrorCode } from '../../data/errors'
import { errorMessageKey } from '../../i18n/errorMessages'
import { useI18n } from '../../i18n/useI18n'
import { Button } from '../../ui/Button'
import { Notice } from '../../ui/Notice'
import { StandaloneLayout } from '../../ui/StandaloneLayout'
import { TextField } from '../../ui/TextField'
import {
  absoluteUrl,
  callbackPath,
  forgotPasswordPath,
  looksLikeEmail,
  registerPath,
  verifyEmailPath,
} from './authLinks'
import { GoogleButton } from './GoogleButton'
import { NotSetUp } from './NotSetUp'

const textLink = 'inline-flex min-h-11 items-center font-bold text-indigo underline'

export function SignInScreen() {
  const { t } = useI18n()
  const { mode, auth, authConfigured } = useSession()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [formError, setFormError] = useState<ErrorCode | null>(null)
  const [busy, setBusy] = useState<'email' | 'google' | null>(null)

  if (mode === 'signed-in') return <Navigate to={startPath} replace />

  async function signIn(event: FormEvent) {
    event.preventDefault()
    if (!auth) return
    const validEmail = looksLikeEmail(email)
    setEmailError(validEmail ? null : t('auth.emailInvalid'))
    setFormError(null)
    if (!validEmail || !password) {
      if (validEmail) setFormError('invalid_credentials')
      return
    }
    setBusy('email')
    try {
      await auth.signInWithEmail(email.trim(), password)
      navigate(startPath)
    } catch (error) {
      const code = errorCodeOf(error)
      if (code === 'email_not_verified') {
        navigate(verifyEmailPath, { state: { email: email.trim() } })
        return
      }
      setFormError(code)
      setBusy(null)
    }
  }

  async function google() {
    if (!auth) return
    setFormError(null)
    setBusy('google')
    try {
      await auth.signInWithProvider('google', absoluteUrl(callbackPath))
    } catch {
      setFormError('unknown')
      setBusy(null)
    }
  }

  return (
    <StandaloneLayout>
      <h1 className="text-2xl font-bold">{t('signIn.title')}</h1>
      <p>{t('signIn.intro')}</p>
      {!authConfigured ? (
        <NotSetUp />
      ) : (
        <form noValidate onSubmit={signIn} className="flex flex-col gap-5">
          <TextField
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={emailError}
          />
          <div className="flex flex-col gap-1">
            <TextField
              label={t('auth.password')}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Link to={forgotPasswordPath} className={`${textLink} self-end`}>
              {t('signIn.forgot')}
            </Link>
          </div>
          {formError && <Notice tone="error">{t(errorMessageKey(formError))}</Notice>}
          <Button type="submit" full busy={busy === 'email'} disabled={busy !== null}>
            {t('signIn.submit')}
          </Button>
          <p className="text-center text-sm font-semibold text-navy/70">{t('auth.or')}</p>
          <GoogleButton
            variant="secondary"
            onClick={google}
            busy={busy === 'google'}
            disabled={busy !== null}
          />
        </form>
      )}
      <div className="flex flex-col items-center">
        <p>
          {t('signIn.newHere')}{' '}
          <Link to={registerPath} className={textLink}>
            {t('auth.register')}
          </Link>
        </p>
        <Link to={`${registerPath}?parent=1`} className={textLink}>
          {t('age.parent')}
        </Link>
      </div>
    </StandaloneLayout>
  )
}

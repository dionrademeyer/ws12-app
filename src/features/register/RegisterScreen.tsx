import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { startPath } from '../../auth/accountRouting'
import { useSession } from '../../auth/useSession'
import { writePendingAge, writePendingInvite } from '../../data/deviceStorage'
import { errorCodeOf, type ErrorCode } from '../../data/errors'
import { errorMessageKey } from '../../i18n/errorMessages'
import { useI18n } from '../../i18n/useI18n'
import { Button } from '../../ui/Button'
import { Notice } from '../../ui/Notice'
import { StandaloneLayout } from '../../ui/StandaloneLayout'
import { TextField } from '../../ui/TextField'
import { AgeQuestion, type AgeAnswer } from '../auth/AgeQuestion'
import {
  absoluteUrl,
  callbackPath,
  looksLikeEmail,
  minPasswordLength,
  signInPath,
  verifyEmailPath,
} from '../auth/authLinks'
import { GoogleButton } from '../auth/GoogleButton'
import { NotSetUp } from '../auth/NotSetUp'

interface FieldErrors {
  email?: string
  password?: string
  age?: string
}

export function RegisterScreen() {
  const { t, language } = useI18n()
  const { mode, auth, authConfigured } = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [age, setAge] = useState<AgeAnswer>(() =>
    params.get('parent') === '1'
      ? { isAdult: true, isParent: true }
      : { isAdult: null, isParent: false },
  )
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<ErrorCode | null>(null)
  const [busy, setBusy] = useState<'email' | 'google' | null>(null)

  const invite = params.get('invite')
  useEffect(() => {
    if (invite) writePendingInvite(invite)
  }, [invite])

  if (mode === 'signed-in') return <Navigate to={startPath} replace />

  function rememberAge(): boolean {
    if (age.isAdult === null) {
      setFieldErrors((current) => ({ ...current, age: t('age.required') }))
      return false
    }
    writePendingAge({ isAdult: age.isAdult, isParent: age.isAdult && age.isParent })
    return true
  }

  async function register(event: FormEvent) {
    event.preventDefault()
    if (!auth) return
    const errors: FieldErrors = {}
    if (!looksLikeEmail(email)) errors.email = t('auth.emailInvalid')
    if (password.length < minPasswordLength) errors.password = t('auth.passwordShort')
    if (age.isAdult === null) errors.age = t('age.required')
    setFieldErrors(errors)
    setFormError(null)
    if (Object.keys(errors).length > 0 || !rememberAge()) return

    setBusy('email')
    try {
      const result = await auth.signUpWithEmail(
        email.trim(),
        password,
        absoluteUrl(callbackPath),
        language,
      )
      if (result.needsVerification) {
        navigate(verifyEmailPath, { state: { email: email.trim() } })
      } else {
        navigate(startPath)
      }
    } catch (error) {
      setFormError(errorCodeOf(error))
      setBusy(null)
    }
  }

  async function google() {
    if (!auth) return
    setFormError(null)
    if (!rememberAge()) return
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
      <h1 className="text-2xl font-bold">{t('register.title')}</h1>
      <p>{t('register.intro')}</p>
      {!authConfigured ? (
        <NotSetUp />
      ) : (
        <form noValidate onSubmit={register} className="flex flex-col gap-5">
          <AgeQuestion
            value={age}
            onChange={(next) => {
              setAge(next)
              setFieldErrors((current) => ({ ...current, age: undefined }))
            }}
            error={fieldErrors.age}
          />
          <TextField
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fieldErrors.email}
          />
          <TextField
            label={t('auth.password')}
            hint={t('auth.passwordHint', { count: minPasswordLength })}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldErrors.password}
          />
          {formError === 'email_taken' ? (
            <Notice tone="error">
              {t('error.email_taken')}{' '}
              <Link to={signInPath} className="font-bold underline">
                {t('auth.signInInstead')}
              </Link>
            </Notice>
          ) : (
            formError && <Notice tone="error">{t(errorMessageKey(formError))}</Notice>
          )}
          <Button type="submit" full busy={busy === 'email'} disabled={busy !== null}>
            {t('register.create')}
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
      <p className="text-center">
        {t('register.haveAccount')}{' '}
        <Link
          to={signInPath}
          className="inline-flex min-h-11 items-center font-bold text-indigo underline"
        >
          {t('auth.login')}
        </Link>
      </p>
    </StandaloneLayout>
  )
}

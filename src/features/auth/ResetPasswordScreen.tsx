import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { startPath } from '../../auth/accountRouting'
import { useSession } from '../../auth/useSession'
import { errorCodeOf, type ErrorCode } from '../../data/errors'
import { errorMessageKey } from '../../i18n/errorMessages'
import { useI18n } from '../../i18n/useI18n'
import { Button } from '../../ui/Button'
import { buttonClass } from '../../ui/buttonClass'
import { FullPageLoading } from '../../ui/FullPageLoading'
import { Notice } from '../../ui/Notice'
import { StandaloneLayout } from '../../ui/StandaloneLayout'
import { TextField } from '../../ui/TextField'
import { forgotPasswordPath, minPasswordLength } from './authLinks'
import { NotSetUp } from './NotSetUp'

// Opened from the reset link in the email, which signs the person in for this one change.
export function ResetPasswordScreen() {
  const { t } = useI18n()
  const { mode, auth, authConfigured } = useSession()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<'changed' | ErrorCode | null>(null)

  if (mode === 'loading') return <FullPageLoading />

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!auth) return
    const next: typeof errors = {}
    if (password.length < minPasswordLength) next.password = t('auth.passwordShort')
    else if (password !== confirm) next.confirm = t('reset.mismatch')
    setErrors(next)
    if (next.password || next.confirm) return
    setBusy(true)
    setResult(null)
    try {
      await auth.updatePassword(password)
      setResult('changed')
    } catch (error) {
      setResult(errorCodeOf(error))
    } finally {
      setBusy(false)
    }
  }

  function body() {
    if (!authConfigured) return <NotSetUp />
    if (mode !== 'signed-in') {
      return (
        <>
          <Notice tone="error">{t('reset.expired')}</Notice>
          <Link to={forgotPasswordPath} className={buttonClass('primary', true)}>
            {t('reset.newLink')}
          </Link>
        </>
      )
    }
    if (result === 'changed') {
      return (
        <>
          <Notice tone="success">{t('reset.changed')}</Notice>
          <Button full onClick={() => navigate(startPath)}>
            {t('common.continue')}
          </Button>
        </>
      )
    }
    return (
      <form noValidate onSubmit={save} className="flex flex-col gap-5">
        <TextField
          label={t('reset.newPassword')}
          hint={t('auth.passwordHint', { count: minPasswordLength })}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        <TextField
          label={t('reset.confirmPassword')}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          error={errors.confirm}
        />
        {result && <Notice tone="error">{t(errorMessageKey(result))}</Notice>}
        <Button type="submit" full busy={busy}>
          {t('reset.submit')}
        </Button>
      </form>
    )
  }

  return (
    <StandaloneLayout>
      <h1 className="text-2xl font-bold">{t('reset.title')}</h1>
      {body()}
    </StandaloneLayout>
  )
}

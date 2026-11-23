import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { startPath } from '../../auth/accountRouting'
import { useSession } from '../../auth/useSession'
import { errorCodeOf, type ErrorCode } from '../../data/errors'
import { errorMessageKey } from '../../i18n/errorMessages'
import { useI18n } from '../../i18n/useI18n'
import { Button } from '../../ui/Button'
import { Notice } from '../../ui/Notice'
import { StandaloneLayout } from '../../ui/StandaloneLayout'
import { AgeQuestion, type AgeAnswer } from '../auth/AgeQuestion'

// For accounts made with Google from the Welcome screen, which had no age question yet.
export function AgeScreen() {
  const { t } = useI18n()
  const { repository } = useSession()
  const navigate = useNavigate()
  const [age, setAge] = useState<AgeAnswer>({ isAdult: null, isParent: false })
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!repository) return
    if (age.isAdult === null) {
      setFieldError(t('age.required'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await repository.declareAge(age.isAdult)
      if (age.isAdult && age.isParent) await repository.claimParentRole()
      navigate(startPath, { replace: true })
    } catch (cause) {
      setError(errorCodeOf(cause))
      setBusy(false)
    }
  }

  return (
    <StandaloneLayout>
      <h1 className="text-2xl font-bold">{t('age.title')}</h1>
      <p>{t('age.why')}</p>
      <AgeQuestion
        value={age}
        onChange={(next) => {
          setAge(next)
          setFieldError(null)
        }}
        error={fieldError}
      />
      <p className="text-sm text-navy/75">{t('age.locked')}</p>
      {error && <Notice tone="error">{t(errorMessageKey(error))}</Notice>}
      <Button full busy={busy} onClick={save}>
        {t('common.continue')}
      </Button>
    </StandaloneLayout>
  )
}

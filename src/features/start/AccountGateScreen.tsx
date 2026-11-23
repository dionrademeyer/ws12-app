import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  canSaveLearnerData,
  dashboardWelcomePath,
  isParent,
  nextAccountPath,
  onboardingPath,
} from '../../auth/accountRouting'
import { useAccountKey } from '../../auth/useAccountKey'
import { useSession } from '../../auth/useSession'
import {
  clearOnboardingDraft,
  readOnboardingDraft,
  readPendingAge,
  readReturnTo,
  writePendingAge,
  writeReturnTo,
} from '../../data/deviceStorage'
import { errorCodeOf, type ErrorCode } from '../../data/errors'
import { finalAnswers } from '../../domain/onboarding'
import { errorMessageKey } from '../../i18n/errorMessages'
import { useI18n } from '../../i18n/useI18n'
import { Button } from '../../ui/Button'
import { FullPageLoading } from '../../ui/FullPageLoading'
import { Notice } from '../../ui/Notice'
import { StandaloneLayout } from '../../ui/StandaloneLayout'

type GateError = { code: ErrorCode; during: 'state' | 'onboarding' }

// Runs once after every sign-in: claims purchases, applies the age answer given before the
// account existed, sends onboarding answers kept on the device, then routes the person on.
export function AccountGateScreen() {
  const { t } = useI18n()
  const { repository, claimEntitlementsOnce } = useSession()
  const accountKey = useAccountKey()
  const navigate = useNavigate()
  const [error, setError] = useState<GateError | null>(null)
  const [attempt, setAttempt] = useState(0)

  const run = useCallback(async () => {
    if (!repository || !accountKey) return
    await claimEntitlementsOnce()
    let state = await repository.getAccountState()

    const pendingAge = readPendingAge()
    if (state.isAdult === null && pendingAge) {
      await repository.declareAge(pendingAge.isAdult)
      if (pendingAge.isAdult && pendingAge.isParent) {
        await repository.claimParentRole().catch(() => undefined)
      }
      state = await repository.getAccountState()
    }
    if (state.isAdult !== null) writePendingAge(null)

    const draft = readOnboardingDraft(accountKey)
    if (draft?.complete && canSaveLearnerData(state) && !state.onboarded && !isParent(state)) {
      try {
        await repository.saveOnboarding(finalAnswers(draft.answers))
      } catch (cause) {
        throw { code: errorCodeOf(cause), during: 'onboarding' } satisfies GateError
      }
      clearOnboardingDraft(accountKey)
      navigate(dashboardWelcomePath, { replace: true })
      return
    }

    const returnTo = readReturnTo()
    const path = nextAccountPath(state, returnTo)
    if (path === returnTo) writeReturnTo(null)
    navigate(path, { replace: true })
  }, [repository, accountKey, claimEntitlementsOnce, navigate])

  // Runs once per attempt, also under React strict mode, because declaring the age is one-off.
  const started = useRef<number | null>(null)
  useEffect(() => {
    if (!repository || !accountKey || started.current === attempt) return
    started.current = attempt
    run().catch((cause: unknown) => {
      const gateError = cause as Partial<GateError>
      setError(
        gateError.during === 'onboarding' && gateError.code
          ? { code: gateError.code, during: 'onboarding' }
          : { code: errorCodeOf(cause), during: 'state' },
      )
    })
  }, [run, attempt, repository, accountKey])

  if (!error) return <FullPageLoading />

  return (
    <StandaloneLayout>
      <h1 className="text-2xl font-bold">
        {error.during === 'onboarding' ? t('gate.onboardingFailed') : t('gate.failed')}
      </h1>
      <Notice tone="error">{t(errorMessageKey(error.code))}</Notice>
      <Button
        full
        onClick={() => {
          setError(null)
          setAttempt((value) => value + 1)
        }}
      >
        {t('common.retry')}
      </Button>
      {error.during === 'onboarding' && (
        <Button full variant="secondary" onClick={() => navigate(onboardingPath)}>
          {t('gate.reviewAnswers')}
        </Button>
      )}
    </StandaloneLayout>
  )
}

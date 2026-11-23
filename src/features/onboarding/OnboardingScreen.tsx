import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { canSaveLearnerData, consentPath, dashboardWelcomePath } from '../../auth/accountRouting'
import { useAccountKey } from '../../auth/useAccountKey'
import { useSession } from '../../auth/useSession'
import {
  clearOnboardingDraft,
  readOnboardingDraft,
  writeOnboardingDraft,
} from '../../data/deviceStorage'
import { errorCodeOf, type ErrorCode } from '../../data/errors'
import type { AccountState, SubjectOption } from '../../data/learner'
import { useRepositoryQuery } from '../../data/useRepositoryQuery'
import type { Language } from '../../domain/language'
import {
  emptyAnswers,
  finalAnswers,
  onboardingStepCount,
  stepProblems,
  suggestedSubjectCodes,
  type OnboardingDraft,
  type StepProblem,
} from '../../domain/onboarding'
import { errorMessageKey } from '../../i18n/errorMessages'
import type { MessageKey } from '../../i18n/messages'
import { useI18n } from '../../i18n/useI18n'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { LoadError, LoadingCard } from '../../ui/LoadStates'
import { Notice } from '../../ui/Notice'
import { ProgressBar } from '../../ui/ProgressBar'
import { StandaloneLayout } from '../../ui/StandaloneLayout'
import { AboutStep, ExamStep, GoalStep, StudyStep, SubjectStep } from './steps'

const stepTitles: MessageKey[] = [
  'onboarding.step1',
  'onboarding.step2',
  'onboarding.step3',
  'onboarding.step4',
  'onboarding.step5',
]

function suggestedSubjects(language: Language): string[] {
  return [suggestedSubjectCodes.lifeOrientation, suggestedSubjectCodes[language]]
}

function freshDraft(language: Language): OnboardingDraft {
  const answers = emptyAnswers()
  answers.subjects = suggestedSubjects(language).map((code) => ({ code, target_mark: null }))
  return { step: 1, complete: false, answers }
}

export function OnboardingScreen() {
  const { t } = useI18n()
  const query = useRepositoryQuery((repository) =>
    Promise.all([repository.listSubjects(), repository.getAccountState()]),
  )

  return (
    <StandaloneLayout wide>
      {query.state.status === 'loading' && <LoadingCard />}
      {query.state.status === 'error' && (
        <LoadError message={t('onboarding.loadError')} onRetry={query.retry} />
      )}
      {query.state.status === 'ready' && (
        <OnboardingSteps subjects={query.state.data[0]} account={query.state.data[1]} />
      )}
    </StandaloneLayout>
  )
}

function OnboardingSteps({
  subjects,
  account,
}: {
  subjects: SubjectOption[]
  account: AccountState
}) {
  const { t, language } = useI18n()
  const { repository } = useSession()
  const accountKey = useAccountKey()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<OnboardingDraft>(
    () => (accountKey && readOnboardingDraft(accountKey)) || freshDraft(language),
  )
  const [problems, setProblems] = useState<StepProblem[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<ErrorCode | null>(null)
  const [keptOnDevice, setKeptOnDevice] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const step = Math.min(Math.max(draft.step, 1), onboardingStepCount)
  const answers = draft.answers

  useEffect(() => {
    if (accountKey) writeOnboardingDraft(accountKey, draft)
  }, [accountKey, draft])

  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    headingRef.current?.focus()
  }, [step])

  if (account.onboarded && !repository?.isDemo) return <Navigate to="/app/dashboard" replace />

  function update(next: OnboardingDraft['answers']) {
    setDraft((current) => ({ ...current, answers: next, complete: false }))
    setProblems([])
  }

  function goTo(nextStep: number) {
    setDraft((current) => ({ ...current, step: nextStep }))
    setProblems([])
    setSaveError(null)
  }

  function next() {
    const found = stepProblems(step, answers)
    setProblems(found)
    if (found.length > 0) return
    if (step < onboardingStepCount) goTo(step + 1)
    else void finish()
  }

  async function finish() {
    if (!repository || !accountKey) return
    const known = new Set(subjects.map((subject) => subject.code))
    const form = {
      ...answers,
      subjects: answers.subjects.filter((subject) => known.has(subject.code)),
    }
    const keepOnDevice = () => {
      const done = { step, complete: true, answers: form }
      writeOnboardingDraft(accountKey, done)
      setDraft(done)
      setKeptOnDevice(true)
    }

    if (!canSaveLearnerData(account)) {
      keepOnDevice()
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      await repository.saveOnboarding(finalAnswers(form))
      clearOnboardingDraft(accountKey)
      navigate(dashboardWelcomePath, { replace: true })
    } catch (cause) {
      const code = errorCodeOf(cause)
      if (code === 'consent_required') {
        keepOnDevice()
      } else {
        setSaveError(code)
      }
      setSaving(false)
    }
  }

  if (keptOnDevice) {
    return (
      <Card className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">{t('onboarding.keptTitle')}</h1>
        <p>{t('onboarding.keptBody')}</p>
        <Button full onClick={() => navigate(consentPath)}>
          {t('onboarding.backToConsent')}
        </Button>
      </Card>
    )
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        next()
      }}
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold tracking-widest text-indigo">
          {t('onboarding.stepOf', { step, total: onboardingStepCount })}
        </p>
        <ProgressBar
          value={step}
          max={onboardingStepCount}
          label={t('onboarding.progress')}
          valueText={t('onboarding.stepOf', { step, total: onboardingStepCount })}
        />
        <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-2xl font-bold">
          {t(stepTitles[step - 1] ?? 'onboarding.step1')}
        </h1>
        {!canSaveLearnerData(account) && (
          <p className="text-sm text-navy/80">{t('onboarding.deviceOnlyNote')}</p>
        )}
      </div>

      <Card className="flex flex-col gap-5">
        {step === 1 && <AboutStep answers={answers} onChange={update} problems={problems} />}
        {step === 2 && (
          <SubjectStep
            answers={answers}
            subjects={subjects}
            suggested={suggestedSubjects(language)}
            onChange={update}
            problems={problems}
          />
        )}
        {step === 3 && <ExamStep answers={answers} onChange={update} problems={problems} />}
        {step === 4 && <StudyStep answers={answers} onChange={update} />}
        {step === 5 && <GoalStep answers={answers} subjects={subjects} onChange={update} />}
      </Card>

      {saveError && (
        <Notice tone="error">
          {t(errorMessageKey(saveError))} {t('onboarding.answersKept')}
        </Notice>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {step > 1 ? (
          <Button variant="secondary" onClick={() => goTo(step - 1)} disabled={saving}>
            {t('common.back')}
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="submit"
          busy={saving}
          variant={step === onboardingStepCount ? 'gold' : 'primary'}
        >
          {step === onboardingStepCount
            ? saveError
              ? t('common.retry')
              : t('onboarding.start')
            : t('common.next')}
        </Button>
      </div>
    </form>
  )
}

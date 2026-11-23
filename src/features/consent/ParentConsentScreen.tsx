import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { familyPath, isParent } from '../../auth/accountRouting'
import { useSession } from '../../auth/useSession'
import { writeReturnTo } from '../../data/deviceStorage'
import { errorCodeOf, type ErrorCode } from '../../data/errors'
import type { ConsentRequest } from '../../data/learner'
import { useRepositoryQuery } from '../../data/useRepositoryQuery'
import { errorMessageKey } from '../../i18n/errorMessages'
import { useI18n } from '../../i18n/useI18n'
import { Button } from '../../ui/Button'
import { buttonClass } from '../../ui/buttonClass'
import { Card } from '../../ui/Card'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { formatDate } from '../../ui/formatDate'
import { FullPageLoading } from '../../ui/FullPageLoading'
import { LoadError, LoadingCard } from '../../ui/LoadStates'
import { Notice } from '../../ui/Notice'
import { StandaloneLayout } from '../../ui/StandaloneLayout'
import { registerPath, signInPath } from '../auth/authLinks'
import { NotSetUp } from '../auth/NotSetUp'

// The page a parent opens from the consent link (Product Bible 3.3).
export function ParentConsentScreen() {
  const { t } = useI18n()
  const { consentId = '' } = useParams()
  const { mode, authConfigured } = useSession()
  const navigate = useNavigate()

  if (mode === 'loading') return <FullPageLoading />

  if (mode === 'signed-out') {
    const go = (path: string) => {
      writeReturnTo(`/consent/${consentId}`)
      navigate(path)
    }
    return (
      <StandaloneLayout>
        <h1 className="text-2xl font-bold">{t('parentConsent.signInTitle')}</h1>
        <p>{t('parentConsent.signInBody')}</p>
        {!authConfigured ? (
          <NotSetUp />
        ) : (
          <>
            <Button full onClick={() => go(signInPath)}>
              {t('auth.login')}
            </Button>
            <Button full variant="secondary" onClick={() => go(`${registerPath}?parent=1`)}>
              {t('parentConsent.createParent')}
            </Button>
          </>
        )}
      </StandaloneLayout>
    )
  }

  return (
    <StandaloneLayout wide>
      <ConsentDecision consentId={consentId} />
    </StandaloneLayout>
  )
}

function ConsentDecision({ consentId }: { consentId: string }) {
  const { t } = useI18n()
  const query = useRepositoryQuery((repository) =>
    Promise.all([repository.getConsentRequest(consentId), repository.getAccountState()]),
  )

  if (query.state.status === 'loading') return <LoadingCard />
  if (query.state.status === 'error') {
    const { code } = query.state
    return (
      <>
        <h1 className="text-2xl font-bold">{t('parentConsent.title')}</h1>
        <LoadError message={t(errorMessageKey(code))} onRetry={query.retry} />
      </>
    )
  }
  const [request, account] = query.state.data
  return <ConsentDetails consentId={consentId} request={request} parent={isParent(account)} />
}

function ConsentDetails({
  consentId,
  request,
  parent,
}: {
  consentId: string
  request: ConsentRequest
  parent: boolean
}) {
  const { t, language } = useI18n()
  const { repository } = useSession()
  const [outcome, setOutcome] = useState<'given' | 'declined' | null>(null)
  const [busy, setBusy] = useState<'give' | 'decline' | null>(null)
  const [confirmDecline, setConfirmDecline] = useState(false)
  const [error, setError] = useState<ErrorCode | null>(null)

  const name = request.learnerFirstName

  async function decide(choice: 'give' | 'decline') {
    if (!repository) return
    setBusy(choice)
    setError(null)
    try {
      // Giving consent needs the parent role, which an adult can claim for themselves.
      if (choice === 'give' && !parent) await repository.claimParentRole()
      if (choice === 'give') await repository.giveConsent(consentId)
      else await repository.declineConsent(consentId)
      setOutcome(choice === 'give' ? 'given' : 'declined')
    } catch (cause) {
      setError(errorCodeOf(cause))
    } finally {
      setBusy(null)
      setConfirmDecline(false)
    }
  }

  if (outcome === 'given') {
    return (
      <>
        <h1 className="text-2xl font-bold">{t('parentConsent.thanks')}</h1>
        <Notice tone="success">
          {name ? t('parentConsent.givenNamed', { name }) : t('parentConsent.given')}
        </Notice>
        <Link to={familyPath} className={buttonClass('primary', true)}>
          {t('parentConsent.openFamily')}
        </Link>
      </>
    )
  }
  if (outcome === 'declined') {
    return (
      <>
        <h1 className="text-2xl font-bold">{t('parentConsent.thanks')}</h1>
        <Notice>{t('parentConsent.declined')}</Notice>
      </>
    )
  }

  const open = request.status === 'pending'

  return (
    <>
      <h1 className="text-2xl font-bold">
        {name ? t('parentConsent.titleNamed', { name }) : t('parentConsent.title')}
      </h1>
      <p className="text-navy/80">
        {t('parentConsent.requested', {
          date: formatDate(request.requestedAt, language),
          expires: formatDate(request.expiresAt, language),
        })}
      </p>
      {!open && <Notice>{t('parentConsent.closed')}</Notice>}

      <Card>
        <h2 className="text-lg font-bold">{t('parentConsent.whatTitle')}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{t('parentConsent.what1')}</li>
          <li>{t('parentConsent.what2')}</li>
          <li>{t('parentConsent.what3')}</li>
          <li>{t('parentConsent.what4')}</li>
        </ul>
        <p className="mt-3 text-sm text-navy/80">{t('parentConsent.notCollected')}</p>
      </Card>
      <Card>
        <h2 className="text-lg font-bold">{t('parentConsent.whyTitle')}</h2>
        <p className="mt-2">{t('parentConsent.why')}</p>
        <h2 className="mt-4 text-lg font-bold">{t('parentConsent.seeTitle')}</h2>
        <p className="mt-2">{t('parentConsent.youSee')}</p>
        <h2 className="mt-4 text-lg font-bold">{t('parentConsent.withdrawTitle')}</h2>
        <p className="mt-2">{t('parentConsent.withdraw')}</p>
      </Card>

      {error && <Notice tone="error">{t(errorMessageKey(error))}</Notice>}
      {open && (
        <div className="flex flex-col gap-3">
          <Button
            full
            busy={busy === 'give'}
            disabled={busy !== null}
            onClick={() => decide('give')}
          >
            {t('parentConsent.give')}
          </Button>
          <Button
            full
            variant="secondary"
            disabled={busy !== null}
            onClick={() => setConfirmDecline(true)}
          >
            {t('parentConsent.notMyChild')}
          </Button>
        </div>
      )}
      {confirmDecline && (
        <ConfirmDialog
          title={t('parentConsent.declineConfirm')}
          confirmLabel={t('parentConsent.notMyChild')}
          cancelLabel={t('common.cancel')}
          tone="danger"
          busy={busy === 'decline'}
          onConfirm={() => decide('decline')}
          onCancel={() => setConfirmDecline(false)}
        >
          {t('parentConsent.declineBody')}
        </ConfirmDialog>
      )}
    </>
  )
}

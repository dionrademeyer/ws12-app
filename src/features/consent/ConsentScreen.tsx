import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { canSaveLearnerData, onboardingPath, startPath } from '../../auth/accountRouting'
import { useSession } from '../../auth/useSession'
import {
  readConsentContact,
  readConsentRequest,
  readPendingInvite,
  writeConsentContact,
  writeConsentRequest,
  writePendingInvite,
} from '../../data/deviceStorage'
import { errorCodeOf, type ErrorCode } from '../../data/errors'
import type { AccountState, ConsentRequestSent } from '../../data/learner'
import { useRepositoryQuery } from '../../data/useRepositoryQuery'
import { looksLikeEmail } from '../auth/authLinks'
import { errorMessageKey } from '../../i18n/errorMessages'
import { useI18n } from '../../i18n/useI18n'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { LoadError, LoadingCard } from '../../ui/LoadStates'
import { Notice } from '../../ui/Notice'
import { StandaloneLayout } from '../../ui/StandaloneLayout'
import { TextField } from '../../ui/TextField'
import { ConsentLinkShare } from './ConsentLinkShare'

type View = 'choose' | 'waiting'
type Waiting = 'email' | 'code'

export function ConsentScreen() {
  const { t } = useI18n()
  const query = useRepositoryQuery((repository) => repository.getAccountState())

  return (
    <StandaloneLayout>
      {query.state.status === 'loading' && <LoadingCard />}
      {query.state.status === 'error' && (
        <LoadError message={t('consent.loadError')} onRetry={query.retry} />
      )}
      {query.state.status === 'ready' && (
        <ConsentFlow state={query.state.data} onRefresh={query.retry} />
      )}
    </StandaloneLayout>
  )
}

function ConsentFlow({ state, onRefresh }: { state: AccountState; onRefresh: () => void }) {
  const { t } = useI18n()
  const { repository, signOut } = useSession()
  const navigate = useNavigate()
  const [view, setView] = useState<View>(state.consentStatus === 'pending' ? 'waiting' : 'choose')
  const [waitingVia, setWaitingVia] = useState<Waiting>('email')
  const [email, setEmail] = useState(() => readConsentContact() ?? '')
  const [code, setCode] = useState(() => readPendingInvite() ?? '')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)
  const [busy, setBusy] = useState<'send' | 'code' | 'resend' | null>(null)
  const [resent, setResent] = useState(false)
  const [request, setRequest] = useState<ConsentRequestSent | null>(readConsentRequest)

  if (canSaveLearnerData(state)) return <Navigate to={startPath} replace />

  async function sendLink(event?: FormEvent) {
    event?.preventDefault()
    if (!repository) return
    if (!looksLikeEmail(email)) {
      setEmailError(t('auth.emailInvalid'))
      return
    }
    setEmailError(null)
    setError(null)
    const resending = view === 'waiting'
    setBusy(resending ? 'resend' : 'send')
    try {
      const sentRequest = await repository.requestConsent(email.trim())
      writeConsentContact(email.trim())
      writeConsentRequest(sentRequest)
      setRequest(sentRequest)
      setWaitingVia('email')
      setResent(resending)
      setView('waiting')
    } catch (cause) {
      setError(errorCodeOf(cause))
    } finally {
      setBusy(null)
    }
  }

  async function redeemCode(event: FormEvent) {
    event.preventDefault()
    if (!repository) return
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) {
      setCodeError(t('family.codeRequired'))
      return
    }
    setCodeError(null)
    setError(null)
    setBusy('code')
    try {
      await repository.redeemInvite(trimmed)
      writePendingInvite(null)
      setWaitingVia('code')
      setView('waiting')
    } catch (cause) {
      const failure = errorCodeOf(cause)
      if (failure === 'invalid_code' || failure === 'code_expired') {
        setCodeError(t('error.invalid_code'))
      } else {
        setError(failure)
      }
    } finally {
      setBusy(null)
    }
  }

  if (view === 'waiting') {
    const remembered = readConsentContact()
    return (
      <>
        <h1 className="text-2xl font-bold">{t('consent.waitingTitle')}</h1>
        <p>
          {waitingVia === 'code'
            ? t('consent.waitingCode')
            : request?.sent
              ? t('consent.waitingEmail')
              : t('consent.waitingShare')}
        </p>
        {resent && (
          <Notice tone="success">
            {request?.sent ? t('consent.resent') : t('consent.resentShare')}
          </Notice>
        )}
        {waitingVia === 'email' && request && <ConsentLinkShare consentId={request.consentId} />}
        {error && <Notice tone="error">{t(errorMessageKey(error))}</Notice>}
        <Button full onClick={onRefresh}>
          {t('consent.checkAgain')}
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="secondary"
            full
            busy={busy === 'resend'}
            onClick={() => (remembered ? sendLink() : setView('choose'))}
          >
            {t('consent.resend')}
          </Button>
          <Button
            variant="secondary"
            full
            onClick={() => {
              setResent(false)
              setError(null)
              setView('choose')
            }}
          >
            {t('consent.changeContact')}
          </Button>
        </div>
        <Card className="bg-indigo/5">
          <h2 className="font-bold">{t('consent.whileWaiting')}</h2>
          <p className="mt-1 text-navy/80">{t('consent.deviceOnly')}</p>
          <Button variant="ghost" className="mt-2 px-0" onClick={() => navigate(onboardingPath)}>
            {t('consent.setUpNow')}
          </Button>
        </Card>
        <Button variant="ghost" onClick={() => signOut().then(() => navigate('/'))}>
          {t('menu.logout')}
        </Button>
      </>
    )
  }

  return (
    <>
      <h1 className="text-2xl font-bold">{t('consent.title')}</h1>
      <p>{t('consent.why')}</p>
      <p className="rounded-2xl bg-indigo/10 px-4 py-3 font-medium">{t('consent.parentSees')}</p>
      {error && <Notice tone="error">{t(errorMessageKey(error))}</Notice>}

      <Card>
        <form noValidate onSubmit={sendLink} className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">{t('consent.sendTitle')}</h2>
          <TextField
            label={t('consent.parentEmail')}
            type="email"
            autoComplete="off"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={emailError}
          />
          <Button type="submit" full busy={busy === 'send'} disabled={busy !== null}>
            {t('consent.sendLink')}
          </Button>
        </form>
      </Card>

      <Card>
        <form noValidate onSubmit={redeemCode} className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">{t('consent.codeTitle')}</h2>
          <TextField
            label={t('family.codeLabel')}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            error={codeError}
          />
          <Button
            type="submit"
            variant="secondary"
            full
            busy={busy === 'code'}
            disabled={busy !== null}
          >
            {t('family.useCode')}
          </Button>
        </form>
      </Card>
    </>
  )
}

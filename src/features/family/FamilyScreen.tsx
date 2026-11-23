import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { isParent } from '../../auth/accountRouting'
import { useSession } from '../../auth/useSession'
import { readPendingInvite, writePendingInvite } from '../../data/deviceStorage'
import { AppError, errorCodeOf, type ErrorCode } from '../../data/errors'
import type { FamilyLink, Invite, InviteKind } from '../../data/learner'
import { useRepositoryQuery } from '../../data/useRepositoryQuery'
import { errorMessageKey } from '../../i18n/errorMessages'
import { useI18n } from '../../i18n/useI18n'
import { Button } from '../../ui/Button'
import { buttonClass } from '../../ui/buttonClass'
import { Card } from '../../ui/Card'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { LoadError, LoadingCard } from '../../ui/LoadStates'
import { Notice } from '../../ui/Notice'
import { PageTitle } from '../../ui/PageTitle'
import { TextField } from '../../ui/TextField'
import { InviteShare } from './InviteShare'

export function FamilyScreen() {
  const { t } = useI18n()
  const query = useRepositoryQuery((repository) =>
    Promise.all([repository.getFamily(), repository.getAccountState()]),
  )

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{t('menu.family')}</PageTitle>
      {query.state.status === 'loading' && <LoadingCard />}
      {query.state.status === 'error' && (
        <LoadError message={t('family.loadError')} onRetry={query.retry} />
      )}
      {query.state.status === 'ready' && (
        <Family
          links={query.state.data[0]}
          parentView={isParent(query.state.data[1])}
          onChanged={query.retry}
        />
      )}
    </div>
  )
}

function nameOf(link: FamilyLink, fallback: string): string {
  return link.otherFirstName?.trim() || fallback
}

interface FamilyProps {
  links: FamilyLink[]
  parentView: boolean
  onChanged: () => void
}

function Family({ links, parentView, onChanged }: FamilyProps) {
  const { t } = useI18n()
  const { repository } = useSession()
  const inviteKind: InviteKind = parentView ? 'parent_to_learner' : 'learner_to_parent'
  const [invite, setInvite] = useState<Invite | null>(null)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)
  const [removing, setRemoving] = useState<FamilyLink | null>(null)

  const fallback = parentView ? t('family.yourChild') : t('family.yourParent')
  const shown = links.filter((link) => link.relation === (parentView ? 'child' : 'parent'))
  const others = links.filter((link) => link.relation !== (parentView ? 'child' : 'parent'))
  const all = [...shown, ...others]

  async function act(key: string, action: () => Promise<unknown>, refresh = true) {
    setBusy(key)
    setError(null)
    try {
      await action()
      if (refresh) onChanged()
    } catch (cause) {
      setError(errorCodeOf(cause))
    } finally {
      setBusy(null)
    }
  }

  async function newInvite() {
    if (!repository) return
    setAdding(true)
    await act('invite', async () => setInvite(await repository.createInvite(inviteKind)), false)
  }

  return (
    <>
      {error && <Notice tone="error">{t(errorMessageKey(error))}</Notice>}

      {all.length === 0 ? (
        <section className="on-dark rounded-3xl bg-gradient-to-br from-navy to-indigo p-6 text-white shadow-md">
          <h2 className="text-xl font-bold">
            {parentView ? t('family.emptyParent') : t('family.emptyLearner')}
          </h2>
          {!adding && (
            <Button
              variant="gold"
              className="mt-4 uppercase"
              busy={busy === 'invite'}
              onClick={parentView ? newInvite : () => setAdding(true)}
            >
              {parentView ? t('family.inviteChild') : t('family.addParent')}
            </Button>
          )}
        </section>
      ) : (
        <Card>
          <h2 className="text-lg font-bold">
            {parentView ? t('family.childrenTitle') : t('family.parentsTitle')}
          </h2>
          <ul className="mt-2 flex flex-col divide-y divide-navy/10">
            {all.map((link) => (
              <LinkRow
                key={link.linkId}
                link={link}
                name={nameOf(link, fallback)}
                busy={busy}
                onAccept={() =>
                  repository &&
                  act(`accept-${link.linkId}`, () => repository.acceptLink(link.linkId))
                }
                onRemove={() => setRemoving(link)}
                onResend={newInvite}
              />
            ))}
          </ul>
          {!adding && (
            <Button
              className="mt-4"
              full
              busy={busy === 'invite'}
              onClick={parentView ? newInvite : () => setAdding(true)}
            >
              {parentView ? t('family.inviteChild') : t('family.addParent')}
            </Button>
          )}
        </Card>
      )}

      {adding && (
        <Card className="flex flex-col gap-5">
          <h2 className="text-lg font-bold">
            {parentView ? t('family.inviteChild') : t('family.addParent')}
          </h2>
          {invite ? (
            <InviteShare invite={invite} kind={inviteKind} />
          ) : (
            !parentView && (
              <div className="flex flex-col gap-2">
                <h3 className="font-semibold">{t('family.sendLinkTitle')}</h3>
                <p className="text-sm text-navy/80">{t('family.sendLinkHint')}</p>
                <Button full busy={busy === 'invite'} onClick={newInvite}>
                  {t('family.makeLink')}
                </Button>
              </div>
            )
          )}
          <RedeemCode
            title={parentView ? t('family.haveChildCode') : t('family.haveParentCode')}
            onRedeemed={onChanged}
          />
        </Card>
      )}

      {!adding && parentView && (
        <Card>
          <RedeemCode title={t('family.haveChildCode')} onRedeemed={onChanged} />
        </Card>
      )}

      {!parentView && (
        <Card>
          <h2 className="text-lg font-bold">{t('family.seesTitle')}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>{t('family.sees1')}</li>
            <li>{t('family.sees2')}</li>
            <li>{t('family.sees3')}</li>
          </ul>
          <p className="mt-3 text-sm text-navy/80">{t('family.neverSees')}</p>
        </Card>
      )}

      {removing && (
        <ConfirmDialog
          title={t('family.removeConfirm', { name: nameOf(removing, fallback) })}
          confirmLabel={
            removing.status === 'pending' ? t('family.cancelInvite') : t('family.remove')
          }
          cancelLabel={t('common.cancel')}
          tone="danger"
          busy={busy === 'remove'}
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            if (!repository) return
            const target = removing
            void act('remove', () => repository.removeLink(target.linkId)).then(() =>
              setRemoving(null),
            )
          }}
        >
          {t('family.removeBody')}
        </ConfirmDialog>
      )}
    </>
  )
}

function LinkRow({
  link,
  name,
  busy,
  onAccept,
  onRemove,
  onResend,
}: {
  link: FamilyLink
  name: string
  busy: string | null
  onAccept: () => void
  onRemove: () => void
  onResend: () => void
}) {
  const { t } = useI18n()
  const pending = link.status === 'pending'
  const removeLabel = pending
    ? link.waitingOnMe
      ? t('family.decline')
      : t('family.cancelInvite')
    : t('family.remove')
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{name}</p>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            pending ? 'bg-gold/30 text-navy' : 'bg-emerald-50 text-emerald-900'
          }`}
        >
          {pending ? t('family.statusPending') : t('family.statusActive')}
        </span>
      </div>
      {pending && (
        <p className="text-sm text-navy/80">
          {link.waitingOnMe ? t('family.wantsToLink', { name }) : t('family.waitingFor', { name })}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {pending && link.waitingOnMe && link.consentId && (
          <Link
            to={`/consent/${encodeURIComponent(link.consentId)}`}
            className={`${buttonClass('primary')} px-5`}
          >
            {t('family.reviewConsent')}
          </Link>
        )}
        {pending && link.waitingOnMe && !link.consentId && (
          <Button className="px-5" busy={busy === `accept-${link.linkId}`} onClick={onAccept}>
            {t('family.accept')}
          </Button>
        )}
        {pending && !link.waitingOnMe && (
          <Button variant="secondary" className="px-5" onClick={onResend}>
            {t('family.resend')}
          </Button>
        )}
        <Button
          variant="secondary"
          className="px-5"
          onClick={onRemove}
          aria-label={t('family.actionFor', { action: removeLabel, name })}
        >
          {removeLabel}
        </Button>
      </div>
    </li>
  )
}

function RedeemCode({ title, onRedeemed }: { title: string; onRedeemed: () => void }) {
  const { t } = useI18n()
  const { repository } = useSession()
  const [code, setCode] = useState(() => readPendingInvite() ?? '')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function redeem(event: FormEvent) {
    event.preventDefault()
    if (!repository) return
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) {
      setFieldError(t('family.codeRequired'))
      return
    }
    setBusy(true)
    setFieldError(null)
    try {
      await repository.redeemInvite(trimmed)
      writePendingInvite(null)
      setCode('')
      onRedeemed()
    } catch (cause) {
      const failure = errorCodeOf(cause)
      setFieldError(
        failure === 'invalid_code' || failure === 'code_expired'
          ? t('error.invalid_code')
          : t(errorMessageKey(cause instanceof AppError ? cause.code : 'unknown')),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form noValidate onSubmit={redeem} className="flex flex-col gap-3">
      <h3 className="font-semibold">{title}</h3>
      <TextField
        label={t('family.codeLabel')}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        value={code}
        onChange={(event) => setCode(event.target.value)}
        error={fieldError}
      />
      <Button type="submit" variant="secondary" full busy={busy}>
        {t('family.useCode')}
      </Button>
    </form>
  )
}

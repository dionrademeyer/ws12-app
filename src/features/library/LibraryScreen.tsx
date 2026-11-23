import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../../auth/useSession'
import { AppError, errorCodeOf, type ErrorCode } from '../../data/errors'
import type { LibraryItem, Tier } from '../../data/learner'
import { useRepositoryQuery } from '../../data/useRepositoryQuery'
import type { MessageKey } from '../../i18n/messages'
import { useI18n } from '../../i18n/useI18n'
import { Button } from '../../ui/Button'
import { buttonClass } from '../../ui/buttonClass'
import { Card } from '../../ui/Card'
import { formatSize, startDownload } from '../../ui/download'
import { LoadError, LoadingCard } from '../../ui/LoadStates'
import { Notice } from '../../ui/Notice'
import { PageTitle } from '../../ui/PageTitle'

const tierLabels: Record<Tier, MessageKey> = {
  free: 'library.tier.free',
  r99: 'library.tier.r99',
  r199: 'library.tier.r199',
  r349: 'library.tier.r349',
}

type DownloadFailure = { fileId: string; code: ErrorCode; purchaseRef?: string }

export function LibraryScreen() {
  const { t } = useI18n()
  const query = useRepositoryQuery((repository) => repository.getLibrary())

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{t('nav.library')}</PageTitle>
      {query.state.status === 'loading' && <LoadingCard />}
      {query.state.status === 'error' && (
        <LoadError message={t('library.loadError')} onRetry={query.retry} />
      )}
      {query.state.status === 'ready' && <Library items={query.state.data} />}
    </div>
  )
}

function Library({ items }: { items: LibraryItem[] }) {
  const { t } = useI18n()
  const { repository } = useSession()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [failure, setFailure] = useState<DownloadFailure | null>(null)
  const [upgradeNote, setUpgradeNote] = useState(false)

  const unlocked = items.filter((item) => item.unlocked)
  const books = unlocked.filter((item) => item.kind === 'book')
  const bonus = unlocked.filter((item) => item.kind === 'bonus')
  const planners = unlocked.filter((item) => item.kind === 'planner')
  const locked = items.filter((item) => !item.unlocked)
  const freeOnly = books.length === 0 && bonus.length === 0

  async function download(item: LibraryItem) {
    if (!repository) return
    setBusyId(item.fileId)
    setFailure(null)
    try {
      // Each try asks for a fresh signed link, so an expired link renews itself on Retry.
      const link = await repository.getDownloadLink(item.fileId)
      startDownload(link.url)
    } catch (cause) {
      setFailure({
        fileId: item.fileId,
        code: errorCodeOf(cause),
        purchaseRef: cause instanceof AppError ? cause.purchaseRef : undefined,
      })
    } finally {
      setBusyId(null)
    }
  }

  const rowProps = { busyId, failure, onDownload: download }

  return (
    <>
      {freeOnly && (
        <section className="on-dark rounded-3xl bg-gradient-to-br from-navy to-indigo p-6 text-white shadow-md">
          <h2 className="text-xl font-bold">
            {planners.length > 0 ? t('library.freeReady') : t('library.empty')}
          </h2>
          {planners[0] && (
            <Button
              variant="gold"
              className="mt-4"
              busy={busyId === planners[0].fileId}
              onClick={() => planners[0] && download(planners[0])}
            >
              {t('library.downloadPlanner')}
            </Button>
          )}
          {locked.length > 0 && (
            <a
              href="#library-locked"
              className="mt-3 block min-h-11 py-2 font-bold text-gold underline"
            >
              {t('library.seeBook')}
            </a>
          )}
          {failure && planners[0]?.fileId === failure.fileId && (
            <DownloadProblem
              failure={failure}
              onRetry={() => planners[0] && download(planners[0])}
            />
          )}
        </section>
      )}

      {books.length > 0 && (
        <Shelf title={t('library.books')}>
          {books.map((item) => (
            <ItemRow key={item.fileId} item={item} {...rowProps} />
          ))}
        </Shelf>
      )}
      {bonus.length > 0 && (
        <Shelf title={t('library.bonus')}>
          {bonus.map((item) => (
            <ItemRow key={item.fileId} item={item} {...rowProps} />
          ))}
        </Shelf>
      )}
      {planners.length > 0 && (
        <Shelf title={t('library.planners')}>
          {planners.map((item) => (
            <ItemRow key={item.fileId} item={item} {...rowProps} />
          ))}
        </Shelf>
      )}
      {locked.length > 0 && (
        <Shelf id="library-locked" title={t('library.locked')}>
          {locked.map((item) => (
            <LockedRow key={item.fileId} item={item} onUpgrade={() => setUpgradeNote(true)} />
          ))}
          {upgradeNote && <Notice className="mt-3">{t('library.upgradeSoon')}</Notice>}
        </Shelf>
      )}
    </>
  )
}

function Shelf({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <Card>
      <h2 id={id} className="text-lg font-bold">
        {title}
      </h2>
      <ul className="mt-2 flex flex-col divide-y divide-navy/10">{children}</ul>
    </Card>
  )
}

function ItemMeta({ item }: { item: LibraryItem }) {
  const { t, language } = useI18n()
  return (
    <div className="min-w-0">
      <p className="font-semibold break-words">{item.title[language]}</p>
      <p className="text-sm text-navy/75">
        {t('library.meta', {
          language: t(`language.${item.language}`),
          size: formatSize(item.sizeBytes, language),
        })}
      </p>
    </div>
  )
}

function ItemRow({
  item,
  busyId,
  failure,
  onDownload,
}: {
  item: LibraryItem
  busyId: string | null
  failure: DownloadFailure | null
  onDownload: (item: LibraryItem) => void
}) {
  const { t, language } = useI18n()
  const failed = failure?.fileId === item.fileId ? failure : null
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ItemMeta item={item} />
        <Button
          variant="secondary"
          className="px-5"
          busy={busyId === item.fileId}
          disabled={busyId !== null && busyId !== item.fileId}
          onClick={() => onDownload(item)}
          aria-label={t('library.downloadItem', { title: item.title[language] })}
        >
          {t('library.download')}
        </Button>
      </div>
      {failed && <DownloadProblem failure={failed} onRetry={() => onDownload(item)} />}
    </li>
  )
}

function LockedRow({ item, onUpgrade }: { item: LibraryItem; onUpgrade: () => void }) {
  const { t, language } = useI18n()
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <ItemMeta item={item} />
          <p className="mt-1 text-sm font-semibold text-indigo">
            {t('library.includedIn', { tier: t(tierLabels[item.minTier]) })}
          </p>
        </div>
        <Button
          variant="secondary"
          className="px-5"
          onClick={onUpgrade}
          aria-label={t('library.upgradeItem', { title: item.title[language] })}
        >
          {t('library.upgrade')}
        </Button>
      </div>
    </li>
  )
}

function DownloadProblem({ failure, onRetry }: { failure: DownloadFailure; onRetry: () => void }) {
  const { t } = useI18n()
  if (failure.code === 'demo_unavailable') {
    return <Notice className="mt-3">{t('error.demo_unavailable')}</Notice>
  }
  if (failure.code === 'not_allowed') {
    return (
      <div
        role="alert"
        className="on-light mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800"
      >
        <p className="font-semibold">{t('library.entitlementFailed')}</p>
        {failure.purchaseRef && (
          <p className="mt-1">{t('library.purchaseRef', { ref: failure.purchaseRef })}</p>
        )}
        <Link to="/app/help" className={`${buttonClass('secondary')} mt-3 min-h-11`}>
          {t('library.contactSupport')}
        </Link>
      </div>
    )
  }
  return (
    <div
      role="alert"
      className="on-light mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <p className="font-semibold">{t('library.downloadFailed')}</p>
      <Button variant="secondary" className="mt-3" onClick={onRetry}>
        {t('common.retry')}
      </Button>
    </div>
  )
}

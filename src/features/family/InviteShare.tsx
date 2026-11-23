import { useState } from 'react'
import type { Invite, InviteKind } from '../../data/learner'
import { useI18n } from '../../i18n/useI18n'
import { buttonClass } from '../../ui/buttonClass'
import { formatDate } from '../../ui/formatDate'
import { Notice } from '../../ui/Notice'
import { inviteUrl } from './inviteUrl'

// Shows a new invite code with WhatsApp and email share links. Nothing is sent by WS12 itself.
export function InviteShare({ invite, kind }: { invite: Invite; kind: InviteKind }) {
  const { t, language } = useI18n()
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null)
  const url = inviteUrl(kind, invite.code)
  const message = t(kind === 'parent_to_learner' ? 'family.shareToChild' : 'family.shareToParent', {
    code: invite.code,
    url,
  })

  async function copy() {
    try {
      await navigator.clipboard.writeText(invite.code)
      setCopied('yes')
    } catch {
      setCopied('no')
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-indigo/5 p-4 ring-1 ring-indigo/15">
      <p className="font-semibold">{t('family.yourCode')}</p>
      <p
        className="text-center font-mono text-3xl font-extrabold tracking-[0.25em] break-all text-navy"
        aria-label={t('family.codeSpelled', { code: invite.code.split('').join(' ') })}
      >
        {invite.code}
      </p>
      <p className="text-center text-sm text-navy/75">
        {t('family.expires', { date: formatDate(invite.expiresAt, language) })}
      </p>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass('primary', true)}
      >
        {t('family.shareWhatsApp')}
      </a>
      <div className="flex flex-col gap-3 sm:flex-row">
        <a
          href={`mailto:?subject=${encodeURIComponent(t('family.shareSubject'))}&body=${encodeURIComponent(message)}`}
          className={buttonClass('secondary', true)}
        >
          {t('family.shareEmail')}
        </a>
        <button type="button" onClick={copy} className={buttonClass('secondary', true)}>
          {t('family.copyCode')}
        </button>
      </div>
      {copied === 'yes' && <Notice tone="success">{t('family.copied')}</Notice>}
      {copied === 'no' && <Notice>{t('family.copyFailed')}</Notice>}
    </div>
  )
}

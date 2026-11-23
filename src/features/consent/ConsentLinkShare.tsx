import { useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { buttonClass } from '../../ui/buttonClass'
import { Notice } from '../../ui/Notice'

// The learner can also pass the consent link on themselves. Only the parent whose verified
// email matches the request can answer it.
export function ConsentLinkShare({ consentId }: { consentId: string }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null)
  const url = `${window.location.origin}/consent/${encodeURIComponent(consentId)}`
  const message = t('consent.shareMessage', { url })

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied('yes')
    } catch {
      setCopied('no')
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-indigo/5 p-4 ring-1 ring-indigo/15">
      <p className="font-semibold">{t('consent.shareTitle')}</p>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass('primary', true)}
      >
        {t('family.shareWhatsApp')}
      </a>
      <button type="button" onClick={copy} className={buttonClass('secondary', true)}>
        {t('consent.copyLink')}
      </button>
      {copied === 'yes' && <Notice tone="success">{t('consent.copied')}</Notice>}
      {copied === 'no' && <Notice>{t('consent.copyFailed', { url })}</Notice>}
    </div>
  )
}

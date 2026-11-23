import { useI18n } from '../i18n/useI18n'

export function FullPageLoading() {
  const { t } = useI18n()
  return (
    <div role="status" className="flex min-h-dvh items-center justify-center bg-mist">
      <span
        aria-hidden="true"
        className="h-10 w-10 animate-spin rounded-full border-4 border-indigo border-t-transparent motion-reduce:animate-none"
      />
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  )
}

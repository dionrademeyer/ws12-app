import { useI18n } from '../i18n/useI18n'

export function LoadingCard() {
  const { t } = useI18n()
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">{t('common.loading')}</span>
      <div className="h-32 animate-pulse rounded-3xl bg-navy/10 motion-reduce:animate-none" />
      <div className="h-24 animate-pulse rounded-3xl bg-navy/10 motion-reduce:animate-none" />
    </div>
  )
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useI18n()
  return (
    <div role="alert" className="rounded-3xl bg-white p-5 text-center shadow-sm">
      <p className="font-medium">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 min-h-11 rounded-full bg-indigo px-5 font-semibold text-white"
      >
        {t('common.retry')}
      </button>
    </div>
  )
}

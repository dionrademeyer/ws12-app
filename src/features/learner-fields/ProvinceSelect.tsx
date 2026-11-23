import { useId } from 'react'
import { provinces, type Province } from '../../domain/onboarding'
import { useI18n } from '../../i18n/useI18n'

interface ProvinceSelectProps {
  value: string
  onChange: (next: Province | '') => void
  error?: string | null
}

export function ProvinceSelect({ value, onChange, error }: ProvinceSelectProps) {
  const { t } = useI18n()
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-semibold">
        {t('province.label')}
      </label>
      <select
        id={id}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value as Province | '')}
        className={`min-h-12 w-full rounded-2xl border-2 bg-white px-4 text-base ${
          error ? 'border-red-700' : 'border-navy/20'
        }`}
      >
        <option value="">{t('province.choose')}</option>
        {provinces.map((code) => (
          <option key={code} value={code}>
            {t(`province.${code}`)}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

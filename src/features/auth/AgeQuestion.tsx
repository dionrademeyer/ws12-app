import { useId } from 'react'
import { useI18n } from '../../i18n/useI18n'

export interface AgeAnswer {
  isAdult: boolean | null
  isParent: boolean
}

interface AgeQuestionProps {
  value: AgeAnswer
  onChange: (next: AgeAnswer) => void
  error?: string | null
}

const optionClass =
  'flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-full border-2 px-4 font-bold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo'

// "Are you 18 or older?" with the parent path, which needs Yes (Product Bible 3.2).
export function AgeQuestion({ value, onChange, error }: AgeQuestionProps) {
  const { t } = useI18n()
  const name = useId()
  const parentHint = `${name}-parent-hint`
  const errorId = `${name}-error`

  return (
    <div className="flex flex-col gap-3">
      <fieldset aria-describedby={error ? errorId : undefined}>
        <legend className="font-semibold">{t('age.question')}</legend>
        <div className="mt-2 flex gap-3">
          {([true, false] as const).map((adult) => {
            const checked = value.isAdult === adult
            return (
              <label
                key={String(adult)}
                className={`${optionClass} ${
                  checked ? 'border-indigo bg-indigo text-white' : 'border-navy/20 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name={name}
                  className="sr-only"
                  checked={checked}
                  onChange={() =>
                    onChange({ isAdult: adult, isParent: adult ? value.isParent : false })
                  }
                />
                {adult ? t('common.yes') : t('common.no')}
              </label>
            )
          })}
        </div>
        {error && (
          <p id={errorId} className="mt-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </fieldset>
      <label className="flex min-h-11 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 shrink-0 accent-indigo"
          checked={value.isParent}
          disabled={value.isAdult !== true}
          aria-describedby={parentHint}
          onChange={(event) => onChange({ ...value, isParent: event.target.checked })}
        />
        <span>
          <span className="font-semibold">{t('age.parent')}</span>
          <span id={parentHint} className="block text-sm text-navy/75">
            {t('age.parentHint')}
          </span>
        </span>
      </label>
    </div>
  )
}

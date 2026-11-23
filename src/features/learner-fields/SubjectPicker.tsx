import { useId } from 'react'
import type { SubjectOption } from '../../data/learner'
import { useI18n } from '../../i18n/useI18n'

export interface ChosenSubject {
  code: string
  targetMark: number | null
}

interface SubjectPickerProps {
  subjects: SubjectOption[]
  chosen: ChosenSubject[]
  suggested?: readonly string[]
  onChange: (next: ChosenSubject[]) => void
  error?: string | null
}

export const defaultTarget = 60

export function SubjectPicker({
  subjects,
  chosen,
  suggested = [],
  onChange,
  error,
}: SubjectPickerProps) {
  const { t, language } = useI18n()
  const errorId = useId()
  const isChosen = (code: string) => chosen.some((entry) => entry.code === code)

  function toggle(code: string) {
    onChange(
      isChosen(code)
        ? chosen.filter((entry) => entry.code !== code)
        : [...chosen, { code, targetMark: null }],
    )
  }

  function setTarget(code: string, targetMark: number | null) {
    onChange(chosen.map((entry) => (entry.code === code ? { ...entry, targetMark } : entry)))
  }

  const ordered = [...subjects].sort((a, b) => {
    const rank = (code: string) => (suggested.includes(code) ? 0 : 1)
    return rank(a.code) - rank(b.code) || a.name[language].localeCompare(b.name[language])
  })
  const chosenSubjects = chosen.flatMap((entry) => {
    const subject = subjects.find((option) => option.code === entry.code)
    return subject ? [{ subject, targetMark: entry.targetMark }] : []
  })

  return (
    <div className="flex flex-col gap-5">
      <fieldset aria-describedby={error ? errorId : undefined} className="min-w-0">
        <legend className="font-semibold">{t('subjects.choose')}</legend>
        <p className="mt-1 text-sm text-navy/75">{t('subjects.chooseHint')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ordered.map((subject) => {
            const checked = isChosen(subject.code)
            return (
              <label
                key={subject.code}
                className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-4 py-1.5 text-sm font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo ${
                  checked ? 'border-indigo bg-indigo text-white' : 'border-navy/20 bg-white'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => toggle(subject.code)}
                />
                {subject.name[language]}
                {suggested.includes(subject.code) && (
                  <span
                    className={`rounded-full px-2 text-xs ${checked ? 'bg-white/20' : 'bg-gold text-navy'}`}
                  >
                    {t('subjects.suggested')}
                  </span>
                )}
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

      {chosenSubjects.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="font-semibold">{t('subjects.targetsTitle')}</h3>
          <p className="-mt-2 text-sm text-navy/75">{t('subjects.targetsHint')}</p>
          <ul className="flex flex-col gap-3">
            {chosenSubjects.map(({ subject, targetMark }) => (
              <TargetRow
                key={subject.code}
                name={subject.name[language]}
                value={targetMark}
                onChange={(next) => setTarget(subject.code, next)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function TargetRow({
  name,
  value,
  onChange,
}: {
  name: string
  value: number | null
  onChange: (next: number | null) => void
}) {
  const { t } = useI18n()
  const id = useId()
  return (
    <li className="rounded-2xl bg-white px-4 py-3 ring-1 ring-navy/10">
      {value === null ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">{name}</span>
          <button
            type="button"
            className="min-h-11 px-2 font-bold text-indigo underline"
            onClick={() => onChange(defaultTarget)}
            aria-label={t('subjects.addTargetFor', { subject: name })}
          >
            {t('subjects.addTarget')}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={id} className="font-medium">
              {t('subjects.targetFor', { subject: name })}
            </label>
            <output
              htmlFor={id}
              className="shrink-0 text-lg font-bold whitespace-nowrap text-indigo"
            >
              {t('subjects.percent', { mark: value })}
            </output>
          </div>
          <input
            id={id}
            type="range"
            min={30}
            max={100}
            step={5}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            className="h-11 w-full accent-indigo"
          />
          <button
            type="button"
            className="min-h-11 self-start px-0 text-sm font-bold text-indigo underline"
            onClick={() => onChange(null)}
            aria-label={t('subjects.clearTargetFor', { subject: name })}
          >
            {t('subjects.clearTarget')}
          </button>
        </div>
      )}
    </li>
  )
}

import { useEffect, useId, useState } from 'react'
import { useSession } from '../../auth/useSession'
import type { SchoolOption } from '../../data/learner'
import { useI18n } from '../../i18n/useI18n'
import { TextField } from '../../ui/TextField'

export interface SchoolValue {
  school: SchoolOption | null
  other: string | null
}

interface SchoolPickerProps {
  province: string | null
  value: SchoolValue
  onChange: (next: SchoolValue) => void
}

type Search =
  { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; results: SchoolOption[] }

// Search the school list, or type the name when the school is not listed (Product Bible 3.4).
export function SchoolPicker({ province, value, onChange }: SchoolPickerProps) {
  const { t } = useI18n()
  const { repository } = useSession()
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<Search>({ status: 'idle' })
  const [attempt, setAttempt] = useState(0)
  const resultsId = useId()
  const notListed = value.other !== null

  useEffect(() => {
    if (!repository || notListed || value.school || query.trim().length < 2) return
    let active = true
    const timer = window.setTimeout(() => {
      setSearch({ status: 'loading' })
      repository.searchSchools(query, province).then(
        (results) => active && setSearch({ status: 'ready', results }),
        () => active && setSearch({ status: 'error' }),
      )
    }, 250)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [repository, query, province, notListed, value.school, attempt])

  if (value.school) {
    return (
      <div className="flex flex-col gap-1">
        <p className="font-semibold">{t('school.label')}</p>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-indigo/10 px-4 py-2">
          <span className="font-medium">{value.school.name}</span>
          <button
            type="button"
            className="min-h-11 px-2 font-bold text-indigo underline"
            onClick={() => onChange({ school: null, other: null })}
          >
            {t('school.change')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {!notListed && (
        <>
          <TextField
            label={t('school.label')}
            hint={t('school.searchHint')}
            type="search"
            autoComplete="off"
            value={query}
            aria-controls={resultsId}
            onChange={(event) => {
              setQuery(event.target.value)
              if (event.target.value.trim().length < 2) setSearch({ status: 'idle' })
            }}
          />
          <div id={resultsId} aria-live="polite">
            {search.status === 'loading' && (
              <p className="text-sm text-navy/75">{t('school.searching')}</p>
            )}
            {search.status === 'error' && (
              <p className="text-sm font-medium text-red-700">
                {t('school.searchError')}{' '}
                <button
                  type="button"
                  className="min-h-11 font-bold underline"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  {t('common.retry')}
                </button>
              </p>
            )}
            {search.status === 'ready' &&
              (search.results.length === 0 ? (
                <p className="text-sm text-navy/75">{t('school.noResults')}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {search.results.map((school) => (
                    <li key={school.id}>
                      <button
                        type="button"
                        className="min-h-11 w-full rounded-2xl border-2 border-navy/15 bg-white px-4 py-2 text-left font-medium hover:border-indigo"
                        onClick={() => onChange({ school, other: null })}
                      >
                        {school.name}
                      </button>
                    </li>
                  ))}
                </ul>
              ))}
          </div>
        </>
      )}
      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          className="h-5 w-5 accent-indigo"
          checked={notListed}
          onChange={(event) =>
            onChange({ school: null, other: event.target.checked ? query.trim() : null })
          }
        />
        <span className="font-semibold">{t('school.notListed')}</span>
      </label>
      {notListed && (
        <TextField
          label={t('school.otherName')}
          maxLength={120}
          value={value.other ?? ''}
          onChange={(event) => onChange({ school: null, other: event.target.value })}
        />
      )}
    </div>
  )
}

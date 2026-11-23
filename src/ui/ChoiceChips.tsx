import { useId } from 'react'

export interface ChipOption<T extends string> {
  value: T
  label: string
  detail?: string
}

interface ChoiceChipsProps<T extends string> {
  legend: string
  hint?: string
  options: ChipOption<T>[]
  selected: readonly T[]
  onChange: (next: T[]) => void
  single?: boolean
  error?: string | null
}

// Chips are real checkboxes (or radios for a single choice), so keyboards and screen readers
// work without extra code.
export function ChoiceChips<T extends string>({
  legend,
  hint,
  options,
  selected,
  onChange,
  single = false,
  error,
}: ChoiceChipsProps<T>) {
  const name = useId()
  const errorId = `${name}-error`

  function toggle(value: T) {
    if (single) return onChange([value])
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="min-w-0">
      <legend className="font-semibold">{legend}</legend>
      {hint && <p className="mt-1 text-sm text-navy/75">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = selected.includes(option.value)
          return (
            <label
              key={option.value}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-4 py-1.5 text-sm font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo ${
                checked
                  ? 'border-indigo bg-indigo text-white'
                  : 'border-navy/20 bg-white text-navy hover:border-indigo/60'
              }`}
            >
              <input
                type={single ? 'radio' : 'checkbox'}
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => toggle(option.value)}
                className="sr-only"
              />
              <span>{option.label}</span>
              {option.detail && (
                <span className={checked ? 'text-white/85' : 'text-navy/70'}>{option.detail}</span>
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
  )
}

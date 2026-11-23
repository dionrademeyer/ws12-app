interface ProgressBarProps {
  value: number
  max: number
  label: string
  valueText: string
}

export function ProgressBar({ value, max, label, valueText }: ProgressBarProps) {
  const percent = Math.round((Math.min(Math.max(value, 0), max) / max) * 100)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      className="h-2.5 w-full overflow-hidden rounded-full bg-navy/10"
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-indigo to-violet-500 transition-[width] motion-reduce:transition-none"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

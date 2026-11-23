import type { ReactNode } from 'react'

type Tone = 'info' | 'success' | 'error'

const tones: Record<Tone, string> = {
  info: 'bg-indigo/10 text-navy',
  success: 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-700/20',
  error: 'bg-red-50 text-red-800 ring-1 ring-red-700/20',
}

// Errors are announced straight away; other notices politely.
export function Notice({
  tone = 'info',
  children,
  className = '',
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-2xl px-4 py-3 text-sm font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </div>
  )
}

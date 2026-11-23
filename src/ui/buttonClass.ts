export type ButtonVariant = 'primary' | 'secondary' | 'gold' | 'ghost' | 'danger' | 'light'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-indigo text-white shadow-sm hover:bg-indigo/90',
  secondary: 'bg-white text-indigo ring-2 ring-indigo/30 hover:bg-indigo/5',
  gold: 'bg-gold text-navy shadow-md hover:bg-gold/90',
  ghost: 'text-indigo underline-offset-2 hover:underline',
  danger: 'bg-red-700 text-white shadow-sm hover:bg-red-800',
  light: 'bg-white text-navy shadow-sm hover:bg-white/90',
}

export function buttonClass(variant: ButtonVariant = 'primary', full = false): string {
  return `inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-base font-bold disabled:cursor-not-allowed disabled:opacity-60 ${
    full ? 'w-full' : ''
  } ${variants[variant]}`
}

// Starts a browser download from a short-lived signed link.
export function startDownload(url: string) {
  const link = document.createElement('a')
  link.href = url
  link.rel = 'noopener'
  link.download = ''
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function formatSize(bytes: number, language: 'en' | 'af'): string {
  const locale = language === 'af' ? 'af-ZA' : 'en-ZA'
  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 1 })} MB`
  }
  return `${Math.max(1, Math.round(bytes / 1000)).toLocaleString(locale)} KB`
}

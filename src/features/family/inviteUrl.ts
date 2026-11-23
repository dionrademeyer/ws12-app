import type { InviteKind } from '../../data/learner'

// A parent's invite opens Register for the child; a learner's invite opens the parent path.
export function inviteUrl(kind: InviteKind, code: string): string {
  const params = new URLSearchParams({ invite: code })
  if (kind === 'learner_to_parent') params.set('parent', '1')
  return `${window.location.origin}/register?${params.toString()}`
}

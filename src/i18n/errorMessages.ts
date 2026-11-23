import type { ErrorCode } from '../data/errors'
import type { MessageKey } from './messages'

export function errorMessageKey(code: ErrorCode): MessageKey {
  return `error.${code}`
}

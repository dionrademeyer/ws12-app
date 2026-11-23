import { AppError, isErrorCode, type ErrorCode } from './errors'

interface ErrorLike {
  message?: unknown
  code?: unknown
  name?: unknown
  context?: unknown
}

function looksLikeNetwork(message: string): boolean {
  return /failed to fetch|networkerror|network request failed|load failed/i.test(message)
}

// Database functions raise one of the stable codes as the exception message.
export function fromPostgrestError(error: ErrorLike): AppError {
  const message = typeof error.message === 'string' ? error.message.trim() : ''
  if (isErrorCode(message)) return new AppError(message, { cause: error })
  if (error.code === '42501') return new AppError('not_allowed', { cause: error })
  if (looksLikeNetwork(message)) return new AppError('network', { cause: error })
  return new AppError('unknown', { cause: error })
}

interface FunctionErrorBody {
  error?: unknown
  purchase_ref?: unknown
}

// Edge functions answer with { "error": "<code>" } and a 4xx status.
export async function fromFunctionError(error: ErrorLike): Promise<AppError> {
  if (error.name === 'FunctionsFetchError' || error.name === 'FunctionsRelayError') {
    return new AppError('network', { cause: error })
  }
  const response = error.context
  if (response instanceof Response) {
    try {
      const body = (await response.clone().json()) as FunctionErrorBody
      const code: ErrorCode = isErrorCode(body.error) ? body.error : 'unknown'
      const purchaseRef = typeof body.purchase_ref === 'string' ? body.purchase_ref : undefined
      return new AppError(code, { purchaseRef, cause: error })
    } catch {
      return new AppError('unknown', { cause: error })
    }
  }
  return new AppError('unknown', { cause: error })
}

const authCodes: Record<string, ErrorCode> = {
  invalid_credentials: 'invalid_credentials',
  email_not_confirmed: 'email_not_verified',
  user_already_exists: 'email_taken',
  email_exists: 'email_taken',
  weak_password: 'weak_password',
  over_email_send_rate_limit: 'rate_limited',
  over_request_rate_limit: 'rate_limited',
  validation_failed: 'invalid_input',
  email_address_invalid: 'invalid_input',
}

export function fromAuthError(error: ErrorLike): AppError {
  const code = typeof error.code === 'string' ? authCodes[error.code] : undefined
  if (code) return new AppError(code, { cause: error })
  const message = typeof error.message === 'string' ? error.message : ''
  if (error.name === 'AuthRetryableFetchError' || looksLikeNetwork(message)) {
    return new AppError('network', { cause: error })
  }
  return new AppError('unknown', { cause: error })
}

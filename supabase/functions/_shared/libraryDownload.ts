// library-download: checks the caller's entitlement in the database and returns a signed link
// to the private "library" bucket that is valid for 300 seconds (Product Bible 3.17).

import {
  CodedError,
  corsHeaders,
  errorResponse,
  jsonResponse,
  parseOrigins,
  readJsonObject,
  type EnvReader,
} from './http.ts'

export const LIBRARY_BUCKET = 'library'
export const SIGNED_URL_SECONDS = 300

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface LibraryDownloadDeps {
  allowedOrigins: string[]
  // Calls public.library_download_path with the caller's session. Throws a CodedError
  // (not_signed_in, not_found or not_allowed) when the caller may not download the file.
  downloadPath(authorization: string, fileId: string): Promise<string>
  // The caller's latest purchase reference, so support can help when the check fails.
  latestPurchaseRef(authorization: string): Promise<string | null>
  // Signs a link with the service role.
  createSignedUrl(bucket: string, path: string, expiresInSeconds: number): Promise<string>
}

export function readLibraryDownloadOrigins(env: EnvReader): string[] {
  return parseOrigins(env('ALLOWED_ORIGINS'))
}

export function createLibraryDownloadHandler(deps: LibraryDownloadDeps) {
  return async (request: Request): Promise<Response> => {
    const cors = corsHeaders(request, deps.allowedOrigins)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (request.method !== 'POST') return errorResponse('invalid_input', {}, cors)

    const authorization = request.headers.get('Authorization') ?? ''
    if (!authorization.startsWith('Bearer ')) return errorResponse('not_signed_in', {}, cors)

    const body = await readJsonObject(request)
    const fileId = typeof body?.file_id === 'string' ? body.file_id : ''
    if (!uuidPattern.test(fileId)) return errorResponse('invalid_input', {}, cors)

    let path: string
    try {
      path = await deps.downloadPath(authorization, fileId)
    } catch (error) {
      if (!(error instanceof CodedError)) throw error
      if (error.code === 'not_allowed') {
        const purchaseRef = await deps.latestPurchaseRef(authorization)
        return errorResponse('not_allowed', { purchase_ref: purchaseRef }, cors)
      }
      return errorResponse(error.code, {}, cors)
    }

    const url = await deps.createSignedUrl(LIBRARY_BUCKET, path, SIGNED_URL_SECONDS)
    return jsonResponse(200, { url, expires_in: SIGNED_URL_SECONDS }, cors)
  }
}

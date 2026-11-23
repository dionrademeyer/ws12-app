import { serviceClient, userClient } from '../_shared/clients.ts'
import { codedOrThrow } from '../_shared/http.ts'
import {
  createLibraryDownloadHandler,
  readLibraryDownloadOrigins,
} from '../_shared/libraryDownload.ts'

const service = serviceClient()

const handler = createLibraryDownloadHandler({
  allowedOrigins: readLibraryDownloadOrigins((name) => Deno.env.get(name)),
  async downloadPath(authorization, fileId) {
    const { data, error } = await userClient(authorization).rpc('library_download_path', {
      p_file_id: fileId,
    })
    codedOrThrow(error)
    return data as string
  },
  async latestPurchaseRef(authorization) {
    const { data } = await userClient(authorization)
      .from('purchases')
      .select('provider_ref')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return (data?.provider_ref as string | undefined) ?? null
  },
  async createSignedUrl(bucket, path, expiresInSeconds) {
    const { data, error } = await service.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds)
    if (error || !data) throw new Error(error?.message ?? 'could not sign the download link')
    return data.signedUrl
  },
})

Deno.serve(handler)

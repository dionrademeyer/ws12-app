// The part of the Deno runtime the edge functions use, so the TypeScript check in Node can
// cover the entry points. Deno itself provides the real types at deploy time.
declare namespace Deno {
  const env: { get(name: string): string | undefined }
  function serve(handler: (request: Request) => Response | Promise<Response>): unknown
}

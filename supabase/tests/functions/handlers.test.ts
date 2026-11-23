// @vitest-environment node
// The edge function handlers run against the PGlite database, with the Supabase clients replaced
// by direct calls as the caller or as the service role.
import { createHmac, randomBytes } from 'node:crypto'
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  decryptContact,
  importContactKey,
  type ContactKey,
} from '../../functions/_shared/contact.ts'
import { codedOrThrow } from '../../functions/_shared/http.ts'
import { createLibraryDownloadHandler } from '../../functions/_shared/libraryDownload.ts'
import {
  createPayfastItnHandler,
  forwardedClientIp,
  payfastSignature,
  phpUrlEncode,
  type PayfastConfigResult,
} from '../../functions/_shared/payfast.ts'
import {
  isRecordPaymentResult,
  recordPaymentArgs,
  type RecordPayment,
} from '../../functions/_shared/payments.ts'
import {
  createRequestConsentHandler,
  type ConsentMessage,
} from '../../functions/_shared/requestConsent.ts'
import { createStripeWebhookHandler } from '../../functions/_shared/stripe.ts'
import {
  asService,
  asUser,
  createAdultLearner,
  createMinorLearner,
  createParent,
  createTestDatabase,
} from '../harness.ts'

let db: PGlite
let contactKey: ContactKey

beforeAll(async () => {
  db = await createTestDatabase({ seed: true })
  contactKey = await importContactKey(randomBytes(32).toString('base64'))
  await db.exec(`
    insert into public.products (code, tier, price_cents, active) values
      ('ws12-r99', 'r99', 9900, true),
      ('ws12-r349', 'r349', 34900, true);
  `)
})

afterAll(async () => {
  await db.close()
})

const bearer = (userId: string) => `Bearer ${userId}`

async function asCaller<T>(authorization: string, sql: string, params: unknown[]) {
  try {
    const result = await asUser(db, authorization.slice('Bearer '.length), (tx) =>
      tx.query<T>(sql, params),
    )
    return result.rows
  } catch (error) {
    codedOrThrow({ message: (error as Error).message })
    throw error
  }
}

const recordPayment: RecordPayment = async (record) => {
  const args = recordPaymentArgs(record)
  const result = await asService(db, (tx) =>
    tx.query<{ result: string }>(
      'select public.record_payment($1, $2, $3, $4, $5, $6, $7, $8) as result',
      [
        args.p_provider,
        args.p_event_id,
        args.p_payload_hash,
        args.p_provider_ref,
        args.p_outcome,
        args.p_product_code,
        args.p_buyer_email,
        args.p_amount_cents,
      ],
    ),
  )
  const value = result.rows[0]?.result
  if (!isRecordPaymentResult(value)) throw new Error(`unexpected result ${value}`)
  return value
}

async function purchase(providerRef: string) {
  const result = await db.query(
    `select p.status, p.amount_cents, p.buyer_email, e.tier, e.status as entitlement
     from public.purchases p
     left join public.entitlements e on e.source_purchase_id = p.id
     where p.provider_ref = $1`,
    [providerRef],
  )
  return result.rows
}

async function eventCount(eventId: string) {
  const result = await db.query<{ n: number }>(
    'select count(*)::int as n from public.payment_events where event_id = $1',
    [eventId],
  )
  return result.rows[0]?.n
}

describe('request-consent', () => {
  function handler(options: { sendingEnabled?: boolean; sender?: boolean } = {}) {
    const sent: ConsentMessage[] = []
    const handle = createRequestConsentHandler({
      config: {
        contactKey,
        sendingEnabled: options.sendingEnabled ?? false,
        allowedOrigins: ['https://app.winstrat12.co.za'],
      },
      async requestConsent(authorization, hash, policyVersion) {
        const rows = await asCaller<{ id: string }>(
          authorization,
          'select public.request_consent($1, $2) as id',
          [hash, policyVersion],
        )
        return rows[0]!.id
      },
      async storeContact(consentId, channel, encrypted) {
        await asService(db, (tx) =>
          tx.query('select public.store_consent_contact($1, $2, $3)', [
            consentId,
            channel,
            encrypted,
          ]),
        )
      },
      sendConsentMessage: options.sender
        ? async (message) => {
            sent.push(message)
          }
        : undefined,
    })
    return { handle, sent }
  }

  const post = (body: unknown, authorization?: string, origin?: string) =>
    new Request('https://functions.test/request-consent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
        ...(origin ? { Origin: origin } : {}),
      },
      body: JSON.stringify(body),
    })

  it('opens a request bound to the contact and stores the contact encrypted, without sending', async () => {
    const learner = await createMinorLearner(db, 'consent.fn.learner@example.test')
    const { handle, sent } = handler({ sender: true })
    const response = await handle(
      post({ channel: 'email', contact: ' Consent.Fn.Parent@Example.test ' }, bearer(learner)),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { consent_id: string; sent: boolean }
    expect(body.sent).toBe(false)
    expect(sent).toEqual([])

    const stored = await db.query<{ contact_encrypted: Uint8Array; channel: string; days: number }>(
      `select cc.contact_encrypted, cc.channel,
         round(extract(epoch from cc.expires_at - c.requested_at) / 86400)::int as days
       from public.consent_contacts cc join public.parental_consents c on c.id = cc.consent_id
       where cc.consent_id = $1`,
      [body.consent_id],
    )
    expect(stored.rows[0]).toMatchObject({ channel: 'email', days: 30 })
    expect(await decryptContact(stored.rows[0]!.contact_encrypted, contactKey)).toBe(
      'consent.fn.parent@example.test',
    )

    const parent = await createParent(db, 'consent.fn.parent@example.test')
    await asUser(db, parent, (tx) => tx.query('select public.give_consent($1)', [body.consent_id]))
    const contacts = await db.query('select * from public.consent_contacts where consent_id = $1', [
      body.consent_id,
    ])
    expect(contacts.rows).toEqual([])
  })

  it('sends only when CONSENT_SENDING_ENABLED is on and a sender is wired in', async () => {
    const learner = await createMinorLearner(db, 'consent.send.learner@example.test')
    const enabled = handler({ sendingEnabled: true, sender: true })
    const response = await enabled.handle(
      post({ channel: 'email', contact: 'consent.send.parent@example.test' }, bearer(learner)),
    )
    const body = (await response.json()) as { consent_id: string; sent: boolean }
    expect(body.sent).toBe(true)
    expect(enabled.sent).toEqual([
      { consentId: body.consent_id, channel: 'email', contact: 'consent.send.parent@example.test' },
    ])

    const noSender = handler({ sendingEnabled: true })
    const quiet = await noSender.handle(
      post({ channel: 'email', contact: 'consent.send.parent@example.test' }, bearer(learner)),
    )
    expect(((await quiet.json()) as { sent: boolean }).sent).toBe(false)
  })

  it('answers with stable error codes', async () => {
    const adult = await createAdultLearner(db, 'consent.fn.adult@example.test')
    const learner = await createMinorLearner(db, 'consent.fn.codes@example.test')
    const { handle } = handler()
    const cases: [Request, number, string][] = [
      [post({ channel: 'email', contact: 'p@example.test' }), 401, 'not_signed_in'],
      [post({ channel: 'email', contact: 'p@example.test' }, bearer(adult)), 403, 'not_allowed'],
      [post({ channel: 'sms', contact: '+27820000000' }, bearer(learner)), 400, 'invalid_input'],
      [post({ channel: 'email', contact: 'not an email' }, bearer(learner)), 400, 'invalid_input'],
      [post(['email'], bearer(learner)), 400, 'invalid_input'],
    ]
    for (const [request, status, code] of cases) {
      const response = await handle(request)
      expect(response.status, code).toBe(status)
      expect(await response.json()).toEqual({ error: code })
    }
  })

  it('answers CORS preflight for listed origins only', async () => {
    const { handle } = handler()
    const preflight = (origin: string) =>
      handle(
        new Request('https://functions.test/x', { method: 'OPTIONS', headers: { Origin: origin } }),
      )
    const allowed = await preflight('https://app.winstrat12.co.za')
    expect(allowed.status).toBe(204)
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('https://app.winstrat12.co.za')
    const other = await preflight('https://evil.example')
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})

describe('library-download', () => {
  let freeFile: string
  let paidFile: string

  const signer = vi.fn(
    async (bucket: string, path: string, seconds: number) =>
      `https://storage.test/${bucket}/${path}?expires=${seconds}`,
  )

  const handle = createLibraryDownloadHandler({
    allowedOrigins: [],
    async downloadPath(authorization, fileId) {
      const rows = await asCaller<{ path: string }>(
        authorization,
        'select public.library_download_path($1) as path',
        [fileId],
      )
      return rows[0]!.path
    },
    async latestPurchaseRef(authorization) {
      const rows = await asCaller<{ provider_ref: string }>(
        authorization,
        'select provider_ref from public.purchases order by created_at desc limit 1',
        [],
      )
      return rows[0]?.provider_ref ?? null
    },
    createSignedUrl: signer,
  })

  const post = (body: unknown, authorization?: string) =>
    handle(
      new Request('https://functions.test/library-download', {
        method: 'POST',
        headers: authorization ? { Authorization: authorization } : {},
        body: JSON.stringify(body),
      }),
    )

  beforeAll(async () => {
    const result = await db.query<{ id: string; min_tier: string }>(`
      insert into public.library_files (title_en, language, storage_path, min_tier, kind) values
        ('Planner', 'en', 'planners/week.pdf', 'free', 'planner'),
        ('Boek', 'af', 'books/ws12-af.pdf', 'r349', 'book')
      returning id, min_tier
    `)
    freeFile = result.rows.find((row) => row.min_tier === 'free')!.id
    paidFile = result.rows.find((row) => row.min_tier === 'r349')!.id
  })

  it('returns a 300 second signed link for an unlocked file', async () => {
    const learner = await createAdultLearner(db, 'download.fn.free@example.test')
    const response = await post({ file_id: freeFile }, bearer(learner))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      url: 'https://storage.test/library/planners/week.pdf?expires=300',
      expires_in: 300,
    })
    expect(signer).toHaveBeenLastCalledWith('library', 'planners/week.pdf', 300)
  })

  it('refuses a locked file with the purchase reference, and never signs a link', async () => {
    const buyerEmail = 'download.fn.refunded@example.test'
    const learner = await createAdultLearner(db, buyerEmail)
    await recordPayment({
      provider: 'stripe',
      eventId: 'evt_download_paid',
      payloadHash: 'b'.repeat(64),
      providerRef: 'pi_download',
      outcome: 'paid',
      productCode: 'ws12-r349',
      buyerEmail,
      amountCents: 34900,
    })
    const paid = await post({ file_id: paidFile }, bearer(learner))
    expect(paid.status).toBe(200)

    await recordPayment({
      provider: 'stripe',
      eventId: 'evt_download_refund',
      payloadHash: 'c'.repeat(64),
      providerRef: 'pi_download',
      outcome: 'refunded',
      productCode: null,
      buyerEmail: null,
      amountCents: null,
    })
    signer.mockClear()
    const refused = await post({ file_id: paidFile }, bearer(learner))
    expect(refused.status).toBe(403)
    expect(await refused.json()).toEqual({ error: 'not_allowed', purchase_ref: 'pi_download' })
    expect(signer).not.toHaveBeenCalled()

    const noPurchase = await createAdultLearner(db, 'download.fn.none@example.test')
    const none = await post({ file_id: paidFile }, bearer(noPurchase))
    expect(await none.json()).toEqual({ error: 'not_allowed', purchase_ref: null })
  })

  it('answers with stable error codes for bad requests', async () => {
    const learner = await createAdultLearner(db, 'download.fn.codes@example.test')
    expect((await post({ file_id: freeFile })).status).toBe(401)
    expect(await (await post({ file_id: 'abc' }, bearer(learner))).json()).toEqual({
      error: 'invalid_input',
    })
    const missing = await post({ file_id: '00000000-0000-4000-8000-000000000000' }, bearer(learner))
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: 'not_found' })
  })
})

describe('payfast-itn', () => {
  const passphrase = 'sandbox passphrase'
  const config: PayfastConfigResult = {
    ok: true,
    config: { merchantId: '10000100', passphrase, allowedRanges: ['197.97.145.144/28'] },
  }

  function itnFields(overrides: Record<string, string> = {}): [string, string][] {
    const base: Record<string, string> = {
      m_payment_id: 'WS12-PF-1',
      pf_payment_id: '1089250',
      payment_status: 'COMPLETE',
      item_name: 'WS12 Book (EN)',
      amount_gross: '99.00',
      amount_fee: '-2.28',
      amount_net: '96.72',
      custom_str1: 'ws12-r99',
      email_address: 'payfast.buyer@example.test',
      merchant_id: '10000100',
      ...overrides,
    }
    return Object.entries(base)
  }

  function itnRequest(
    fields: [string, string][],
    options: { ip?: string; signature?: string } = {},
  ): Request {
    const signature = options.signature ?? payfastSignature(fields, passphrase)
    const body = [...fields, ['signature', signature]]
      .map(([key, value]) => `${key}=${phpUrlEncode(value!)}`)
      .join('&')
    return new Request('https://functions.test/payfast-itn', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Forwarded-For': `${options.ip ?? '197.97.145.150'}, 10.0.0.1`,
      },
      body,
    })
  }

  function setup(validateResult = true, payfastConfig = config) {
    const validate = vi.fn(async () => validateResult)
    const record = vi.fn(recordPayment)
    const handle = createPayfastItnHandler({
      config: payfastConfig,
      validate,
      recordPayment: record,
      clientIp: forwardedClientIp,
    })
    return { handle, validate, record }
  }

  it('records a verified sandbox payment once, and ignores the same notification again', async () => {
    const { handle, validate } = setup()
    const fields = itnFields()
    const response = await handle(itnRequest(fields))
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('OK')
    expect(validate).toHaveBeenCalledWith(
      expect.stringMatching(/^m_payment_id=WS12-PF-1&.*merchant_id=10000100$/),
    )
    expect(await purchase('WS12-PF-1')).toEqual([
      {
        status: 'paid',
        amount_cents: 9900,
        buyer_email: 'payfast.buyer@example.test',
        tier: 'r99',
        entitlement: 'active',
      },
    ])

    const again = await handle(itnRequest(fields))
    expect(again.status).toBe(200)
    expect(await purchase('WS12-PF-1')).toHaveLength(1)
    expect(await eventCount('payfast:1089250:COMPLETE')).toBe(1)
  })

  it('refuses a wrong signature or passphrase before calling PayFast', async () => {
    const { handle, validate, record } = setup()
    const fields = itnFields({ m_payment_id: 'WS12-PF-SIG', pf_payment_id: '2' })
    const tampered = await handle(itnRequest(fields, { signature: 'f'.repeat(32) }))
    expect(tampered.status).toBe(400)
    const otherPassphrase = await handle(
      itnRequest(fields, { signature: payfastSignature(fields, 'not the passphrase') }),
    )
    expect(otherPassphrase.status).toBe(400)
    expect(validate).not.toHaveBeenCalled()
    expect(record).not.toHaveBeenCalled()
    expect(await purchase('WS12-PF-SIG')).toEqual([])
  })

  it('refuses a source address outside the allow list', async () => {
    const { handle, record } = setup()
    const response = await handle(
      itnRequest(itnFields({ m_payment_id: 'WS12-PF-IP', pf_payment_id: '3' }), { ip: '8.8.8.8' }),
    )
    expect(response.status).toBe(403)
    expect(record).not.toHaveBeenCalled()
  })

  it('refuses another merchant id', async () => {
    const { handle, record } = setup()
    const response = await handle(itnRequest(itnFields({ merchant_id: '999', pf_payment_id: '4' })))
    expect(response.status).toBe(400)
    expect(record).not.toHaveBeenCalled()
  })

  it('refuses an amount that is not the product price', async () => {
    const { handle } = setup()
    const response = await handle(
      itnRequest(
        itnFields({ m_payment_id: 'WS12-PF-CHEAP', pf_payment_id: '5', amount_gross: '9.90' }),
      ),
    )
    expect(response.status).toBe(400)
    expect(await response.text()).toBe('amount_mismatch')
    expect(await purchase('WS12-PF-CHEAP')).toEqual([])
  })

  it('refuses a notification PayFast does not confirm', async () => {
    const { handle, record } = setup(false)
    const response = await handle(
      itnRequest(itnFields({ m_payment_id: 'WS12-PF-NV', pf_payment_id: '6' })),
    )
    expect(response.status).toBe(400)
    expect(record).not.toHaveBeenCalled()
  })

  it('sets the entitlement inactive when the payment fails', async () => {
    const { handle } = setup()
    const reference = { m_payment_id: 'WS12-PF-FAIL', pf_payment_id: '7' }
    await handle(itnRequest(itnFields(reference)))
    const failed = await handle(itnRequest(itnFields({ ...reference, payment_status: 'FAILED' })))
    expect(failed.status).toBe(200)
    expect(await purchase('WS12-PF-FAIL')).toEqual([
      expect.objectContaining({ status: 'failed', entitlement: 'inactive' }),
    ])
  })

  it('refuses to run unless configured for the sandbox', async () => {
    const { handle, record, validate } = setup(true, { ok: false, reason: 'live' })
    const response = await handle(itnRequest(itnFields({ pf_payment_id: '8' })))
    expect(response.status).toBe(503)
    expect(record).not.toHaveBeenCalled()
    expect(validate).not.toHaveBeenCalled()
  })
})

describe('stripe-webhook', () => {
  const secret = 'whsec_handler_secret'
  const now = 1_800_000_000

  function stripeRequest(event: unknown, options: { secret?: string; timestamp?: number } = {}) {
    const payload = JSON.stringify(event)
    const timestamp = options.timestamp ?? now
    const signature = createHmac('sha256', options.secret ?? secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex')
    return new Request('https://functions.test/stripe-webhook', {
      method: 'POST',
      headers: { 'Stripe-Signature': `t=${timestamp},v1=${signature}` },
      body: payload,
    })
  }

  function checkoutEvent(id: string, overrides: Record<string, unknown> = {}) {
    return {
      id,
      type: 'checkout.session.completed',
      livemode: false,
      data: {
        object: {
          id: `cs_${id}`,
          payment_intent: `pi_${id}`,
          payment_status: 'paid',
          amount_total: 34900,
          currency: 'zar',
          metadata: { product_code: 'ws12-r349' },
          customer_details: { email: 'stripe.buyer@example.test' },
          ...overrides,
        },
      },
    }
  }

  function setup(
    config: Parameters<typeof createStripeWebhookHandler>[0]['config'] = {
      ok: true,
      config: { webhookSecret: secret },
    },
  ) {
    const record = vi.fn(recordPayment)
    const handle = createStripeWebhookHandler({
      config,
      recordPayment: record,
      nowSeconds: () => now,
    })
    return { handle, record }
  }

  it('records a completed checkout once and reports the duplicate', async () => {
    const { handle } = setup()
    const first = await handle(stripeRequest(checkoutEvent('evt_s1')))
    expect(first.status).toBe(200)
    expect(await first.json()).toEqual({ received: true, result: 'recorded' })
    expect(await purchase('pi_evt_s1')).toEqual([
      expect.objectContaining({ status: 'paid', tier: 'r349', entitlement: 'active' }),
    ])

    const again = await handle(stripeRequest(checkoutEvent('evt_s1')))
    expect(await again.json()).toEqual({ received: true, result: 'duplicate' })
    expect(await purchase('pi_evt_s1')).toHaveLength(1)
    expect(await eventCount('evt_s1')).toBe(1)
  })

  it('refuses a bad signature or a stale timestamp without recording anything', async () => {
    const { handle, record } = setup()
    const wrongSecret = await handle(stripeRequest(checkoutEvent('evt_s2'), { secret: 'whsec_x' }))
    expect(wrongSecret.status).toBe(400)
    expect(await wrongSecret.json()).toEqual({ error: 'invalid_signature' })
    const stale = await handle(stripeRequest(checkoutEvent('evt_s2'), { timestamp: now - 600 }))
    expect(stale.status).toBe(400)
    const unsigned = await handle(
      new Request('https://functions.test/stripe-webhook', {
        method: 'POST',
        body: JSON.stringify(checkoutEvent('evt_s2')),
      }),
    )
    expect(unsigned.status).toBe(400)
    expect(record).not.toHaveBeenCalled()
  })

  it('refuses an amount that is not the product price, and a currency other than rand', async () => {
    const { handle } = setup()
    const cheap = await handle(stripeRequest(checkoutEvent('evt_s3', { amount_total: 100 })))
    expect(cheap.status).toBe(400)
    expect(await cheap.json()).toEqual({ error: 'amount_mismatch' })
    const dollars = await handle(stripeRequest(checkoutEvent('evt_s4', { currency: 'usd' })))
    expect(dollars.status).toBe(400)
    expect(await purchase('pi_evt_s3')).toEqual([])
    expect(await purchase('pi_evt_s4')).toEqual([])
  })

  it('refuses live mode events', async () => {
    const { handle, record } = setup()
    const response = await handle(stripeRequest({ ...checkoutEvent('evt_s5'), livemode: true }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'live_mode_refused' })
    expect(record).not.toHaveBeenCalled()
  })

  it('sets the entitlement inactive on a full refund and ignores a partial one', async () => {
    const { handle } = setup()
    await handle(stripeRequest(checkoutEvent('evt_s6')))
    const refund = (id: string, refunded: boolean) => ({
      id,
      type: 'charge.refunded',
      livemode: false,
      data: { object: { id: `ch_${id}`, payment_intent: 'pi_evt_s6', refunded } },
    })

    const partial = await handle(stripeRequest(refund('evt_s6_partial', false)))
    expect(await partial.json()).toEqual({ received: true, ignored: true })
    expect((await purchase('pi_evt_s6'))[0]).toMatchObject({ entitlement: 'active' })

    const full = await handle(stripeRequest(refund('evt_s6_full', true)))
    expect(await full.json()).toEqual({ received: true, result: 'recorded' })
    expect((await purchase('pi_evt_s6'))[0]).toMatchObject({
      status: 'refunded',
      entitlement: 'inactive',
    })
  })

  it('acknowledges events it does not act on', async () => {
    const { handle, record } = setup()
    const response = await handle(
      stripeRequest({
        id: 'evt_s7',
        type: 'customer.created',
        livemode: false,
        data: { object: {} },
      }),
    )
    expect(await response.json()).toEqual({ received: true, ignored: true })
    const unpaid = await handle(
      stripeRequest(checkoutEvent('evt_s8', { payment_status: 'unpaid' })),
    )
    expect(await unpaid.json()).toEqual({ received: true, ignored: true })
    expect(record).not.toHaveBeenCalled()
  })

  it('refuses to run without a test mode configuration', async () => {
    const { handle, record } = setup({ ok: false, reason: 'live key' })
    const response = await handle(stripeRequest(checkoutEvent('evt_s9')))
    expect(response.status).toBe(503)
    expect(record).not.toHaveBeenCalled()
  })
})

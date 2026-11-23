import { serviceClient } from '../_shared/clients.ts'
import { isRecordPaymentResult, recordPaymentArgs } from '../_shared/payments.ts'
import { createStripeWebhookHandler, readStripeConfig } from '../_shared/stripe.ts'

const config = readStripeConfig((name) => Deno.env.get(name))
if (!config.ok) console.error(`stripe-webhook refuses to run: ${config.reason}`)

const service = serviceClient()

const handler = createStripeWebhookHandler({
  config,
  async recordPayment(record) {
    const { data, error } = await service.rpc('record_payment', recordPaymentArgs(record))
    if (error) throw new Error(error.message)
    if (!isRecordPaymentResult(data)) throw new Error('unexpected record_payment result')
    return data
  },
})

Deno.serve(handler)

import { serviceClient } from '../_shared/clients.ts'
import {
  createPayfastItnHandler,
  forwardedClientIp,
  PAYFAST_SANDBOX_VALIDATE_URL,
  readPayfastConfig,
} from '../_shared/payfast.ts'
import { isRecordPaymentResult, recordPaymentArgs } from '../_shared/payments.ts'

const config = readPayfastConfig((name) => Deno.env.get(name))
if (!config.ok) console.error(`payfast-itn refuses to run: ${config.reason}`)

const service = serviceClient()

const handler = createPayfastItnHandler({
  config,
  clientIp: forwardedClientIp,
  async validate(paramString) {
    const response = await fetch(PAYFAST_SANDBOX_VALIDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: paramString,
    })
    return response.ok && (await response.text()).trim() === 'VALID'
  },
  async recordPayment(record) {
    const { data, error } = await service.rpc('record_payment', recordPaymentArgs(record))
    if (error) throw new Error(error.message)
    if (!isRecordPaymentResult(data)) throw new Error('unexpected record_payment result')
    return data
  },
})

Deno.serve(handler)

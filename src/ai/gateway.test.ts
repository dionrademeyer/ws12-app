import { describe, expect, it, vi } from 'vitest'
import { createAiGateway } from './gateway'

const reply = {
  conversationId: 'c1',
  text: 'That is not covered in the WS12 content yet. Please ask your teacher.',
  sourceIds: [],
  answeredFromContent: false,
}

describe('AI gateway client', () => {
  it('sends requests to the ai-gateway edge function', async () => {
    const invoke = vi.fn().mockResolvedValue(reply)
    const gateway = createAiGateway(invoke)
    await expect(
      gateway.ask({ agent: 'tutor', message: '  What is momentum?  ', language: 'en' }),
    ).resolves.toEqual(reply)
    expect(invoke).toHaveBeenCalledWith('ai-gateway', {
      agent: 'tutor',
      message: 'What is momentum?',
      language: 'en',
    })
  })

  it('rejects empty or very long messages before calling the server', async () => {
    const invoke = vi.fn()
    const gateway = createAiGateway(invoke)
    await expect(gateway.ask({ agent: 'tutor', message: ' ', language: 'en' })).rejects.toThrow(
      RangeError,
    )
    await expect(
      gateway.ask({ agent: 'tutor', message: 'a'.repeat(1001), language: 'af' }),
    ).rejects.toThrow(RangeError)
    expect(invoke).not.toHaveBeenCalled()
  })

  it('rejects a reply with an unexpected shape', async () => {
    const gateway = createAiGateway(vi.fn().mockResolvedValue({ text: 'no sources' }))
    await expect(gateway.ask({ agent: 'tutor', message: 'Hi', language: 'en' })).rejects.toThrow(
      /unexpected reply/,
    )
  })
})

import type { Language } from '../domain/language'

// The browser never calls a model directly. Every agent request goes to the ai-gateway edge
// function (Product Bible 7.2), which holds the model keys and answers only from approved
// WS12 content.

export type AgentName = 'tutor'

export interface AgentRequest {
  agent: AgentName
  message: string
  language: Language
  conversationId?: string
}

export interface AgentReply {
  conversationId: string
  text: string
  sourceIds: string[]
  answeredFromContent: boolean
}

export type InvokeEdgeFunction = (name: string, body: unknown) => Promise<unknown>

export const maxMessageLength = 1000

function isAgentReply(value: unknown): value is AgentReply {
  if (typeof value !== 'object' || value === null) return false
  const reply = value as Record<string, unknown>
  return (
    typeof reply.conversationId === 'string' &&
    typeof reply.text === 'string' &&
    typeof reply.answeredFromContent === 'boolean' &&
    Array.isArray(reply.sourceIds) &&
    reply.sourceIds.every((id) => typeof id === 'string')
  )
}

export function createAiGateway(invoke: InvokeEdgeFunction) {
  return {
    async ask(request: AgentRequest): Promise<AgentReply> {
      const message = request.message.trim()
      if (message.length === 0 || message.length > maxMessageLength) {
        throw new RangeError(`message must be 1 to ${maxMessageLength} characters`)
      }
      const reply = await invoke('ai-gateway', { ...request, message })
      if (!isAgentReply(reply)) throw new Error('ai-gateway returned an unexpected reply')
      return reply
    },
  }
}

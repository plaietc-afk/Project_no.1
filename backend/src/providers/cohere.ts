import { ProviderAdapter, ChatCompletionRequest, ChatCompletionResponse } from './base';
import crypto from 'crypto';

interface CohereMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class CohereAdapter implements ProviderAdapter {
  name = 'cohere';

  async chatCompletion(req: ChatCompletionRequest, apiKey: string): Promise<ChatCompletionResponse> {
    const targetModel = req.model.startsWith('command') ? req.model : 'command-r';

    // Convert OpenAI messages to Cohere format:
    // - system messages become preamble (last one wins)
    // - user/assistant alternate as chat_history + message
    const systemMsgs = req.messages.filter(m => m.role === 'system');
    const chatMsgs = req.messages.filter(m => m.role !== 'system');

    const preamble = systemMsgs.length > 0 ? systemMsgs[systemMsgs.length - 1].content : undefined;

    // Last user message becomes `message`; prior messages become chat_history
    const lastUserIndex = [...chatMsgs].reverse().findIndex(m => m.role === 'user');
    const splitIndex = chatMsgs.length - 1 - lastUserIndex;
    const message = chatMsgs[splitIndex].content;
    const chatHistory: CohereMessage[] = chatMsgs.slice(0, splitIndex).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }));

    const body: Record<string, unknown> = { model: targetModel, message, chat_history: chatHistory };
    if (preamble) body.preamble = preamble;
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.max_tokens !== undefined) body.max_tokens = req.max_tokens;

    const response = await fetch('https://api.cohere.com/v2/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-Client-Name': 'tokenguard'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Cohere API Error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    const text = data.message?.content?.[0]?.text ?? data.text ?? '';
    const billed = data.usage?.billed_units ?? {};
    const promptTokens = billed.input_tokens ?? data.meta?.tokens?.input_tokens ?? 0;
    const completionTokens = billed.output_tokens ?? data.meta?.tokens?.output_tokens ?? 0;

    return {
      id: `chatcmpl-${crypto.randomUUID()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: targetModel,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: text },
        finish_reason: data.finish_reason === 'COMPLETE' ? 'stop' : 'length'
      }],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens
      }
    };
  }
}

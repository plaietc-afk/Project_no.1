import { ProviderAdapter, ChatCompletionRequest, ChatCompletionResponse } from './base';
import crypto from 'crypto';

export class AnthropicAdapter implements ProviderAdapter {
  name = 'anthropic';

  async chatCompletion(req: ChatCompletionRequest, apiKey: string): Promise<ChatCompletionResponse> {
    const { model, messages, max_tokens, temperature } = req;
    
    // Default model if standard openai names are passed
    let targetModel = model;
    if (model === 'gpt-4' || model === 'gpt-3.5-turbo') targetModel = 'claude-3-haiku-20240307';
    
    const anthropicMessages = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: targetModel,
        max_tokens: max_tokens || 1024,
        temperature: temperature || 0.7,
        messages: anthropicMessages
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Anthropic API Error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    return {
      id: `chatcmpl-${crypto.randomUUID()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: targetModel,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: data.content[0].text },
        finish_reason: data.stop_reason === 'end_turn' ? 'stop' : 'length'
      }],
      usage: {
        prompt_tokens: data.usage.input_tokens,
        completion_tokens: data.usage.output_tokens,
        total_tokens: data.usage.input_tokens + data.usage.output_tokens
      }
    };
  }
}

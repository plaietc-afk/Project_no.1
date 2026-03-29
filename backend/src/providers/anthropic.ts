import { ProviderAdapter, ChatCompletionRequest, ChatCompletionResponse, StreamResult } from './base';
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

  // Anthropic streams in its own SSE format. We convert it to OpenAI-compatible SSE
  // so the client sees a unified format regardless of provider.
  async chatCompletionStream(req: ChatCompletionRequest, apiKey: string): Promise<StreamResult> {
    const { model, messages, max_tokens, temperature } = req;
    let targetModel = model;
    if (model === 'gpt-4' || model === 'gpt-3.5-turbo') targetModel = 'claude-3-haiku-20240307';

    const anthropicMessages = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }));

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
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
        messages: anthropicMessages,
        stream: true
      })
    });

    if (!upstream.ok) {
      const errorData = await upstream.json().catch(() => ({}));
      throw new Error(`Anthropic API Error: ${upstream.status} - ${JSON.stringify(errorData)}`);
    }

    if (!upstream.body) throw new Error('Anthropic returned empty stream');

    const completionId = `chatcmpl-${crypto.randomUUID()}`;
    const createdAt = Math.floor(Date.now() / 1000);
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let inputTokens = 0;
    let outputTokens = 0;

    // Transform Anthropic SSE → OpenAI-compatible SSE
    const transformed = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        const text = decoder.decode(chunk, { stream: true });
        for (const line of text.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (!data) continue;
          try {
            const event = JSON.parse(data) as Record<string, unknown>;
            const type = event.type as string;

            if (type === 'content_block_delta') {
              const delta = event.delta as { type: string; text?: string };
              if (delta?.type === 'text_delta' && delta.text) {
                const oaiChunk = {
                  id: completionId, object: 'chat.completion.chunk', created: createdAt, model: targetModel,
                  choices: [{ index: 0, delta: { content: delta.text }, finish_reason: null }]
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(oaiChunk)}\n\n`));
              }
            } else if (type === 'message_delta') {
              const usage = (event.usage as { output_tokens?: number }) ?? {};
              outputTokens = usage.output_tokens ?? 0;
            } else if (type === 'message_start') {
              const msg = (event.message as { usage?: { input_tokens?: number } }) ?? {};
              inputTokens = msg.usage?.input_tokens ?? 0;
            } else if (type === 'message_stop') {
              const stopChunk = {
                id: completionId, object: 'chat.completion.chunk', created: createdAt, model: targetModel,
                choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens, total_tokens: inputTokens + outputTokens }
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(stopChunk)}\n\n`));
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            }
          } catch { /* skip malformed SSE lines */ }
        }
      }
    });

    return {
      stream: upstream.body.pipeThrough(transformed),
      headers: { 'Content-Type': 'text/event-stream' }
    };
  }
}

import { ProviderAdapter, ChatCompletionRequest, ChatCompletionResponse, StreamResult } from './base';

export class OpenAIAdapter implements ProviderAdapter {
  name = 'openai';
  protected apiBase = 'https://api.openai.com/v1';
  protected authHeader(apiKey: string): string { return `Bearer ${apiKey}`; }
  protected providerName = 'OpenAI';

  async chatCompletion(req: ChatCompletionRequest, apiKey: string): Promise<ChatCompletionResponse> {
    const response = await fetch(`${this.apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.authHeader(apiKey)
      },
      body: JSON.stringify(req)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`${this.providerName} API Error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    return await response.json() as ChatCompletionResponse;
  }

  async chatCompletionStream(req: ChatCompletionRequest, apiKey: string): Promise<StreamResult> {
    const streamReq = { ...req, stream: true, stream_options: { include_usage: true } };
    const response = await fetch(`${this.apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.authHeader(apiKey)
      },
      body: JSON.stringify(streamReq)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`${this.providerName} API Error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    if (!response.body) throw new Error(`${this.providerName} returned empty stream`);
    return { stream: response.body, headers: { 'Content-Type': 'text/event-stream' } };
  }
}

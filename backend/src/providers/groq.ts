import { ProviderAdapter, ChatCompletionRequest, ChatCompletionResponse, StreamResult } from './base';
import { OpenAIAdapter } from './openai';

export class GroqAdapter extends OpenAIAdapter implements ProviderAdapter {
  name = 'groq';
  protected apiBase = 'https://api.groq.com/openai/v1';
  protected providerName = 'Groq';

  async chatCompletion(req: ChatCompletionRequest, apiKey: string): Promise<ChatCompletionResponse> {
    const response = await fetch(`${this.apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(req)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Groq API Error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    return await response.json() as ChatCompletionResponse;
  }

  async chatCompletionStream(req: ChatCompletionRequest, apiKey: string): Promise<StreamResult> {
    return super.chatCompletionStream(req, apiKey);
  }
}

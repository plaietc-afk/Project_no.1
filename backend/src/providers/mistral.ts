import { ProviderAdapter, ChatCompletionRequest, ChatCompletionResponse, StreamResult } from './base';
import { OpenAIAdapter } from './openai';

// Mistral AI uses an OpenAI-compatible /v1/chat/completions endpoint.
export class MistralAdapter extends OpenAIAdapter implements ProviderAdapter {
  name = 'mistral';
  protected apiBase = 'https://api.mistral.ai/v1';
  protected providerName = 'Mistral';

  async chatCompletion(req: ChatCompletionRequest, apiKey: string): Promise<ChatCompletionResponse> {
    const targetModel = req.model.startsWith('mistral') || req.model.startsWith('open-') || req.model.startsWith('codestral')
      ? req.model
      : 'mistral-small-latest';

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: targetModel,
        messages: req.messages,
        temperature: req.temperature,
        max_tokens: req.max_tokens
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Mistral API Error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    return await response.json() as ChatCompletionResponse;
  }

  async chatCompletionStream(req: ChatCompletionRequest, apiKey: string): Promise<StreamResult> {
    const targetModel = req.model.startsWith('mistral') || req.model.startsWith('open-') || req.model.startsWith('codestral')
      ? req.model
      : 'mistral-small-latest';
    return super.chatCompletionStream({ ...req, model: targetModel }, apiKey);
  }
}

import { ProviderAdapter, ChatCompletionRequest, ChatCompletionResponse } from './base';

// Mistral AI uses an OpenAI-compatible /v1/chat/completions endpoint.
export class MistralAdapter implements ProviderAdapter {
  name = 'mistral';

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
}

import { ProviderAdapter, ChatCompletionRequest, ChatCompletionResponse } from './base';

// Azure OpenAI requires: AZURE_OPENAI_ENDPOINT (e.g. https://<resource>.openai.azure.com)
// and AZURE_OPENAI_DEPLOYMENT (the deployment name, e.g. "gpt-4o")
// The apiKey param is the Azure API key.
export class AzureOpenAIAdapter implements ProviderAdapter {
  name = 'azure';

  async chatCompletion(req: ChatCompletionRequest, apiKey: string): Promise<ChatCompletionResponse> {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || req.model;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-01';

    if (!endpoint) throw new Error('AZURE_OPENAI_ENDPOINT environment variable is not set');

    const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        messages: req.messages,
        temperature: req.temperature,
        max_tokens: req.max_tokens
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Azure OpenAI API Error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json() as ChatCompletionResponse;
    return { ...data, model: `azure/${deployment}` };
  }
}

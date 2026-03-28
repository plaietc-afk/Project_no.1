import { ProviderAdapter, ChatCompletionRequest, ChatCompletionResponse } from './base';
import crypto from 'crypto';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type ContentBlock
} from '@aws-sdk/client-bedrock-runtime';

// AWS Bedrock uses IAM credentials from environment:
//   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
// The `apiKey` parameter is not used (auth is via AWS credentials).
// Supported model IDs: amazon.titan-text-*, anthropic.claude-*, meta.llama*, mistral.mistral-*
export class BedrockAdapter implements ProviderAdapter {
  name = 'bedrock';

  private getClient(): BedrockRuntimeClient {
    const region = process.env.AWS_REGION || 'us-east-1';
    return new BedrockRuntimeClient({ region });
  }

  async chatCompletion(req: ChatCompletionRequest, _apiKey: string): Promise<ChatCompletionResponse> {
    const client = this.getClient();

    // Default to a Claude model on Bedrock if a generic model name is given
    const modelId = req.model.includes('.') ? req.model : `anthropic.claude-3-haiku-20240307-v1:0`;

    // Convert OpenAI messages to Bedrock Converse format (system messages handled separately)
    const systemContent = req.messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n');

    const messages: Message[] = req.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: [{ text: m.content } as ContentBlock]
      }));

    const command = new ConverseCommand({
      modelId,
      messages,
      ...(systemContent && { system: [{ text: systemContent }] }),
      inferenceConfig: {
        maxTokens: req.max_tokens ?? 1024,
        temperature: req.temperature ?? 0.7
      }
    });

    const result = await client.send(command);

    const outputText = result.output?.message?.content
      ?.filter((b): b is { text: string } => 'text' in b)
      .map(b => b.text)
      .join('') ?? '';

    const usage = result.usage ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

    return {
      id: `chatcmpl-${crypto.randomUUID()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: modelId,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: outputText },
        finish_reason: result.stopReason === 'end_turn' ? 'stop' : 'length'
      }],
      usage: {
        prompt_tokens: usage.inputTokens ?? 0,
        completion_tokens: usage.outputTokens ?? 0,
        total_tokens: usage.totalTokens ?? 0
      }
    };
  }
}

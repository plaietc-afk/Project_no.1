import { ProviderAdapter } from './base';
import { OpenAIAdapter } from './openai';
import { GeminiAdapter } from './gemini';
import { AnthropicAdapter } from './anthropic';
import { GroqAdapter } from './groq';
import { AzureOpenAIAdapter } from './azure';
import { CohereAdapter } from './cohere';
import { MistralAdapter } from './mistral';
import { BedrockAdapter } from './bedrock';

export const ProviderRegistry: Record<string, ProviderAdapter> = {
  openai: new OpenAIAdapter(),
  gemini: new GeminiAdapter(),
  anthropic: new AnthropicAdapter(),
  groq: new GroqAdapter(),
  azure: new AzureOpenAIAdapter(),
  cohere: new CohereAdapter(),
  mistral: new MistralAdapter(),
  bedrock: new BedrockAdapter()
};

export const SUPPORTED_PROVIDERS = Object.keys(ProviderRegistry);

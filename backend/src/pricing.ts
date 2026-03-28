// Prices per 1,000 tokens in USD
export const PRICING: Record<string, { prompt: number; completion: number }> = {
  // OpenAI
  'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },
  'gpt-4': { prompt: 0.03, completion: 0.06 },
  'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
  'gpt-4o': { prompt: 0.005, completion: 0.015 },
  'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },

  // Azure OpenAI (same as OpenAI)
  'azure/gpt-4o': { prompt: 0.005, completion: 0.015 },
  'azure/gpt-4': { prompt: 0.03, completion: 0.06 },

  // Gemini
  'gemini-1.5-pro-latest': { prompt: 0.0035, completion: 0.0105 },
  'gemini-1.5-flash-latest': { prompt: 0.000075, completion: 0.0003 },
  'gemini-2.0-flash': { prompt: 0.0001, completion: 0.0004 },

  // Anthropic
  'claude-3-haiku-20240307': { prompt: 0.00025, completion: 0.00125 },
  'claude-3-sonnet-20240229': { prompt: 0.003, completion: 0.015 },
  'claude-3-opus-20240229': { prompt: 0.015, completion: 0.075 },
  'claude-3-5-sonnet-20241022': { prompt: 0.003, completion: 0.015 },
  'claude-3-5-haiku-20241022': { prompt: 0.0008, completion: 0.004 },

  // Groq
  'llama3-8b-8192': { prompt: 0.00005, completion: 0.0001 },
  'llama3-70b-8192': { prompt: 0.00059, completion: 0.00079 },
  'mixtral-8x7b-32768': { prompt: 0.00024, completion: 0.00024 },
  'llama-3.1-8b-instant': { prompt: 0.00005, completion: 0.00008 },
  'llama-3.3-70b-versatile': { prompt: 0.00059, completion: 0.00079 },

  // Cohere
  'command-r': { prompt: 0.0005, completion: 0.0015 },
  'command-r-plus': { prompt: 0.003, completion: 0.015 },
  'command-r7b-12-2024': { prompt: 0.0000375, completion: 0.00015 },

  // Mistral AI
  'mistral-small-latest': { prompt: 0.0002, completion: 0.0006 },
  'mistral-medium-latest': { prompt: 0.00275, completion: 0.0081 },
  'mistral-large-latest': { prompt: 0.002, completion: 0.006 },
  'codestral-latest': { prompt: 0.001, completion: 0.003 },
  'open-mistral-7b': { prompt: 0.00025, completion: 0.00025 },
  'open-mixtral-8x7b': { prompt: 0.0007, completion: 0.0007 },

  // AWS Bedrock — Claude models via Bedrock (same pricing as Anthropic)
  'anthropic.claude-3-haiku-20240307-v1:0': { prompt: 0.00025, completion: 0.00125 },
  'anthropic.claude-3-sonnet-20240229-v1:0': { prompt: 0.003, completion: 0.015 },
  'anthropic.claude-3-5-sonnet-20241022-v2:0': { prompt: 0.003, completion: 0.015 },
  // Bedrock — Meta Llama
  'meta.llama3-8b-instruct-v1:0': { prompt: 0.0003, completion: 0.0006 },
  'meta.llama3-70b-instruct-v1:0': { prompt: 0.00265, completion: 0.0035 },
  // Bedrock — Amazon Titan
  'amazon.titan-text-express-v1': { prompt: 0.0002, completion: 0.0006 },
  'amazon.titan-text-lite-v1': { prompt: 0.00015, completion: 0.0002 }
};

export function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const modelKey = Object.keys(PRICING).find(k => model === k || model.includes(k)) || 'gpt-3.5-turbo';
  const modelPricing = PRICING[modelKey] ?? { prompt: 0, completion: 0 };
  return (promptTokens / 1000) * modelPricing.prompt + (completionTokens / 1000) * modelPricing.completion;
}

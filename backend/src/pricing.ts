// Prices per 1,000 tokens in USD
export const PRICING: Record<string, { prompt: number, completion: number }> = {
  // OpenAI
  'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },
  'gpt-4': { prompt: 0.03, completion: 0.06 },
  'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
  'gpt-4o': { prompt: 0.005, completion: 0.015 },
  
  // Gemini
  'gemini-1.5-pro-latest': { prompt: 0.0035, completion: 0.0105 },
  'gemini-1.5-flash-latest': { prompt: 0.000075, completion: 0.0003 },
  
  // Anthropic
  'claude-3-haiku-20240307': { prompt: 0.00025, completion: 0.00125 },
  'claude-3-sonnet-20240229': { prompt: 0.003, completion: 0.015 },
  'claude-3-opus-20240229': { prompt: 0.015, completion: 0.075 },
  
  // Groq
  'llama3-8b-8192': { prompt: 0.00005, completion: 0.0001 },
  'llama3-70b-8192': { prompt: 0.00059, completion: 0.00079 },
  'mixtral-8x7b-32768': { prompt: 0.00024, completion: 0.00024 },
  
  // Cohere
  'command-r': { prompt: 0.0005, completion: 0.0015 },
  'command-r-plus': { prompt: 0.003, completion: 0.015 },
};

export function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  // Find closest matching model pricing
  const modelKey = Object.keys(PRICING).find(k => model.includes(k)) || 'gpt-3.5-turbo';
  const modelPricing = PRICING[modelKey] || { prompt: 0, completion: 0 };
  
  const cost = (promptTokens / 1000) * modelPricing.prompt + (completionTokens / 1000) * modelPricing.completion;
  return cost;
}

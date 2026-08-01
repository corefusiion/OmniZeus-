export const USD_TO_BRL = 5.80;

export const FALLBACK_PRICING: Record<string, { prompt: number; completion: number }> = {
  "openai/gpt-4o": { prompt: 2.5, completion: 10.0 },
  "openai/o3-mini": { prompt: 1.1, completion: 4.4 },
  "openai/o3-mini-high": { prompt: 1.1, completion: 4.4 },
  "anthropic/claude-3.7-sonnet": { prompt: 3.0, completion: 15.0 },
  "anthropic/claude-3.5-haiku": { prompt: 0.8, completion: 4.0 },
  "google/gemini-2.5-pro": { prompt: 1.25, completion: 5.0 },
  "google/gemini-2.5-flash": { prompt: 0.075, completion: 0.30 },
  "google/gemini-pro-1.5": { prompt: 1.25, completion: 5.0 },
  "deepseek/deepseek-chat": { prompt: 0.14, completion: 0.28 },
  "deepseek/deepseek-r1": { prompt: 0.55, completion: 2.19 },
  "qwen/qwen-2.5-72b-instruct": { prompt: 0.35, completion: 0.40 },
  "meta-llama/llama-3.1-405b-instruct": { prompt: 0.65, completion: 0.65 },
};

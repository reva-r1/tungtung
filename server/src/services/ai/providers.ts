import dotenv from 'dotenv';

dotenv.config();

export interface LlmConfig {
  isGemini: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: string;
}

/**
 * Local Ollama LLaMA LLM configuration (sole primary model, offline on user machine)
 */
export function getOllamaConfig(): LlmConfig {
  dotenv.config({ override: true });
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
  const model = process.env.OLLAMA_MODEL || 'llama3.2:3b';
  return {
    isGemini: false,
    apiKey: 'ollama',
    baseUrl,
    model,
    provider: `Ollama (${model})`,
  };
}

/**
 * Standard LLM configuration - directly uses local LLaMA model
 */
export function getLlmConfig(): LlmConfig {
  return getOllamaConfig();
}

/**
 * All external cloud API LLMs (Gemini, Groq, xAI) have been removed.
 * Returns local LLaMA config to ensure 0 external API timeouts or quota errors.
 */
export function getCloudLlmConfig(): LlmConfig {
  return getOllamaConfig();
}

/**
 * Check if local Ollama daemon is actively running and has pulled models
 */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const data = (await res.json()) as any;
    return Array.isArray(data?.models) && data.models.length > 0;
  } catch (_) {
    return false;
  }
}


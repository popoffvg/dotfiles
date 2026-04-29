// Multi-provider LLM client via Vercel AI SDK.
//
// Supported providers:
//   google    — Google Gemini (native @ai-sdk/google)
//   openrouter — OpenRouter (200+ models)
//   openai    — OpenAI direct
//   ollama    — Local Ollama
//   custom    — Any OpenAI-compatible endpoint (set llm_base_url)
//
// Config in memory-keeper.local.md:
//   llm_provider: google
//   llm_api_key: AIza...
//   llm_model: gemini-2.0-flash

import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const OPENAI_COMPAT_URLS = {
  openrouter: "https://openrouter.ai/api/v1",
  openai: "https://api.openai.com/v1",
  ollama: "http://localhost:11434/v1",
};

const PROVIDER_DEFAULTS = {
  google: "gemini-2.5-flash-lite-preview-06-17",
  openrouter: "anthropic/claude-sonnet-4",
  openai: "gpt-4o-mini",
  ollama: "llama3.1",
};

export function createModel(config) {
  const provider = config.llm_provider || "openrouter";
  const apiKey =
    config.llm_api_key ||
    config.openrouter_api_key ||
    process.env.GOOGLE_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENAI_API_KEY ||
    (provider === "ollama" ? "ollama" : undefined);

  if (!apiKey) {
    throw new Error(
      `No API key for provider "${provider}". Set llm_api_key in memory-keeper.local.md or the corresponding env var.`
    );
  }

  const model = config.llm_model || config.openrouter_model || PROVIDER_DEFAULTS[provider] || "gpt-4o-mini";

  // Google Gemini — native provider (not OpenAI-compatible)
  if (provider === "google") {
    const google = createGoogleGenerativeAI({ apiKey });
    return google(model);
  }

  // OpenAI-compatible providers (OpenRouter, OpenAI, Ollama, custom)
  const baseURL = config.llm_base_url || OPENAI_COMPAT_URLS[provider];
  if (!baseURL) {
    throw new Error(
      `Unknown provider "${provider}". Set llm_base_url in memory-keeper.local.md.`
    );
  }

  const client = createOpenAI({ baseURL, apiKey });
  return client(model);
}

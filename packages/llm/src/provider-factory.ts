import { MockLlmProvider } from "./mock-provider.js";
import { OpenAiProvider } from "./openai-provider.js";
import type { LlmProvider } from "./types.js";

export function createLlmProvider(
  providerName?: string,
  model?: string
): LlmProvider {
  const normalizedName =
    process.env.LLM_PROVIDER?.trim().toLowerCase() ||
    providerName?.trim().toLowerCase() ||
    "mock";

  switch (normalizedName) {
    case "mock":
      return new MockLlmProvider(model);
    case "openai":
      return new OpenAiProvider(model);
    default:
      throw new Error(
        `Unsupported LLM_PROVIDER "${normalizedName}". Expected "mock" or "openai".`
      );
  }
}

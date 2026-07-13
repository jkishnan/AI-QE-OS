import { MockLlmProvider } from "./mock-provider.js";
import { OpenAiProvider } from "./openai-provider.js";
import type { LlmProvider } from "./types.js";

export function createLlmProvider(
  providerName = process.env.LLM_PROVIDER
): LlmProvider {
  const normalizedName = providerName?.trim().toLowerCase() || "mock";

  switch (normalizedName) {
    case "mock":
      return new MockLlmProvider();
    case "openai":
      return new OpenAiProvider();
    default:
      throw new Error(
        `Unsupported LLM_PROVIDER "${normalizedName}". Expected "mock" or "openai".`
      );
  }
}

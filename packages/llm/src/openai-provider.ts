import OpenAI from "openai";
import type {
  GenerateRequest,
  GenerateResponse,
  LlmProvider,
} from "./types.js";

const DEFAULT_MAX_RETRIES = 2;
const MAX_CONFIGURABLE_RETRIES = 10;

export class OpenAiProvider implements LlmProvider {
  readonly name = "openai";
  private client: OpenAI | undefined;

  constructor(private readonly configuredModel?: string) {}

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    this.validateRequest(request);

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const model =
      process.env.OPENAI_MODEL?.trim() || this.configuredModel?.trim();

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER=openai");
    }

    if (!model) {
      throw new Error("OPENAI_MODEL is required when LLM_PROVIDER=openai");
    }

    const client = this.getClient(apiKey);

    try {
      const response = await client.responses.create({
        model,
        instructions: request.systemPrompt,
        input: request.userPrompt,
      });

      if (!response.output_text.trim()) {
        throw new Error(`OpenAI returned an empty response for model "${model}"`);
      }

      const result: GenerateResponse = {
        text: response.output_text,
        provider: this.name,
        model,
      };

      return result;
    } catch (error) {
      throw this.createRequestError(error);
    }
  }

  private getClient(apiKey: string): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({
        apiKey,
        maxRetries: this.readMaxRetries(),
      });
    }

    return this.client;
  }

  private readMaxRetries(): number {
    const configuredRetries = process.env.OPENAI_MAX_RETRIES?.trim();

    if (!configuredRetries) {
      return DEFAULT_MAX_RETRIES;
    }

    if (!/^\d+$/.test(configuredRetries)) {
      throw new Error("OPENAI_MAX_RETRIES must be a non-negative integer");
    }

    const maxRetries = Number(configuredRetries);

    if (
      !Number.isSafeInteger(maxRetries) ||
      maxRetries > MAX_CONFIGURABLE_RETRIES
    ) {
      throw new Error(
        `OPENAI_MAX_RETRIES must be between 0 and ${MAX_CONFIGURABLE_RETRIES}`
      );
    }

    return maxRetries;
  }

  private validateRequest(request: GenerateRequest): void {
    if (!request.systemPrompt.trim()) {
      throw new Error("OpenAI system prompt must not be empty");
    }

    if (!request.userPrompt.trim()) {
      throw new Error("OpenAI user prompt must not be empty");
    }
  }

  private createRequestError(error: unknown): Error {
    if (error instanceof OpenAI.APIError) {
      const status = error.status ? ` (HTTP ${error.status})` : "";
      const requestId = error.requestID
        ? ` [request ${error.requestID}]`
        : "";

      return new Error(
        `OpenAI request failed${status}${requestId}: ${error.message}`,
        { cause: error }
      );
    }

    if (error instanceof Error && error.message.startsWith("OpenAI returned")) {
      return error;
    }

    return new Error(
      `OpenAI request failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error }
    );
  }
}

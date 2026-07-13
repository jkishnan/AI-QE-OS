import OpenAI from "openai";
import type {
  GenerateRequest,
  GenerateResponse,
  LlmProvider,
} from "./types.js";

export class OpenAiProvider implements LlmProvider {
  readonly name = "openai";

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const model = process.env.OPENAI_MODEL?.trim();

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER=openai");
    }

    if (!model) {
      throw new Error("OPENAI_MODEL is required when LLM_PROVIDER=openai");
    }

    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model,
      instructions: request.systemPrompt,
      input: request.userPrompt,
    });

    return {
      text: response.output_text,
      provider: this.name,
      model,
    };
  }
}

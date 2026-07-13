export interface GenerateRequest {
  systemPrompt: string;
  userPrompt: string;
}

export interface GenerateResponse {
  text: string;
  provider: string;
  model: string;
}

export interface LlmProvider {
  readonly name: string;

  generate(request: GenerateRequest): Promise<GenerateResponse>;
}

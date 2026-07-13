import type {
  GenerateRequest,
  GenerateResponse,
  LlmProvider,
} from "./types.js";

const PLACEHOLDER_PLAYWRIGHT_TEST = `import { expect, test } from "@playwright/test";

test("placeholder test", async ({ page }) => {
  await page.goto("https://example.com");
  await expect(page).toHaveTitle(/Example Domain/);
});`;

export class MockLlmProvider implements LlmProvider {
  readonly name = "mock";

  constructor(private readonly model = "mock-playwright-0.1") {}

  async generate(_request: GenerateRequest): Promise<GenerateResponse> {
    return {
      text: PLACEHOLDER_PLAYWRIGHT_TEST,
      provider: this.name,
      model: this.model,
    };
  }
}

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  Capability,
  CapabilityContext,
  CapabilityResult,
} from "../../../capability-sdk/src/types.js";
import { MockLlmProvider } from "../../../llm/src/index.js";
import type { LlmProvider } from "../../../llm/src/index.js";
import { ProjectAnalyzer } from "../../../project-analyzer/src/project-analyzer.js";
import { buildPlaywrightPrompt } from "./prompt-builder.js";

export { buildPlaywrightPrompt } from "./prompt-builder.js";

export class PlaywrightGeneratorCapability implements Capability {
  readonly id = "playwright-generator";
  readonly name = "Playwright Test Generator";
  readonly version = "0.1.0";

  constructor(
    private readonly provider: LlmProvider = new MockLlmProvider(),
    private readonly analyzer = new ProjectAnalyzer()
  ) {}

  async validate(context: CapabilityContext): Promise<void> {
    if (context.request.trim().length === 0) {
      throw new Error("A test generation request is required");
    }
  }

  async execute(context: CapabilityContext): Promise<CapabilityResult> {
    const analysis = await this.analyzer.analyze(context.projectRoot);
    const prompt = buildPlaywrightPrompt(context.request, analysis);
    const response = await this.provider.generate(prompt);
    const artifactPath = path.join(
      context.outputDirectory,
      "generated.spec.ts"
    );

    await mkdir(context.outputDirectory, { recursive: true });
    await writeFile(artifactPath, response.text, "utf8");

    return {
      success: true,
      summary: `Generated a Playwright test with ${response.provider}/${response.model}.`,
      artifacts: [
        {
          path: artifactPath,
          content: response.text,
          type: "test",
        },
      ],
      warnings: analysis.warnings,
    };
  }
}

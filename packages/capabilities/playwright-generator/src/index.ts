import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  Capability,
  CapabilityArtifact,
  CapabilityContext,
  CapabilityResult,
} from "../../../capability-sdk/src/types.js";
import { MockLlmProvider } from "../../../llm/src/index.js";
import type { LlmProvider } from "../../../llm/src/index.js";
import {
  ProjectAnalyzer,
  type ProjectAnalysis,
} from "../../../project-analyzer/src/project-analyzer.js";
import { buildPlaywrightPrompt } from "./prompt-builder.js";

export { buildPlaywrightPrompt } from "./prompt-builder.js";

export class PlaywrightGeneratorCapability implements Capability {
  readonly id = "playwright-generator";
  readonly name = "Playwright Test Generator";
  readonly version = "0.1.0";

  constructor(
    private readonly provider: LlmProvider = new MockLlmProvider(),
    private readonly analyzer: ProjectAnalyzer = new ProjectAnalyzer()
  ) {}

  async validate(context: CapabilityContext): Promise<void> {
    if (!context.projectRoot.trim()) {
      throw new Error("A project root is required.");
    }

    if (!context.request.trim()) {
      throw new Error("A test generation request is required.");
    }

    if (!context.outputDirectory.trim()) {
      throw new Error("An output directory is required.");
    }
  }

  async execute(context: CapabilityContext): Promise<CapabilityResult> {
    await this.validate(context);

    const analysis = await this.analyzeProject(context.projectRoot);
    const generatedCode = await this.generateTest(context.request, analysis);
    const artifact = await this.saveArtifact(
      context.outputDirectory,
      generatedCode
    );

    return this.buildResult(analysis, artifact);
  }

  private async analyzeProject(projectRoot: string): Promise<ProjectAnalysis> {
    return this.analyzer.analyze(projectRoot);
  }

  private async generateTest(
    request: string,
    analysis: ProjectAnalysis
  ): Promise<{
    text: string;
    provider: string;
    model: string;
  }> {
    const prompt = buildPlaywrightPrompt(request, analysis);
    return this.provider.generate(prompt);
  }

  private async saveArtifact(
    outputDirectory: string,
    generated: {
      text: string;
      provider: string;
      model: string;
    }
  ): Promise<CapabilityArtifact & { provider: string; model: string }> {
    const artifactPath = path.join(outputDirectory, "generated.spec.ts");

    await mkdir(outputDirectory, { recursive: true });

    const content = generated.text.endsWith("\n")
      ? generated.text
      : `${generated.text}\n`;

    await writeFile(artifactPath, content, "utf8");

    return {
      path: artifactPath,
      content,
      type: "test",
      provider: generated.provider,
      model: generated.model,
    };
  }

  private buildResult(
    analysis: ProjectAnalysis,
    artifact: CapabilityArtifact & {
      provider: string;
      model: string;
    }
  ): CapabilityResult {
    return {
      success: true,
      summary: `Generated a Playwright test with ${artifact.provider}/${artifact.model}.`,
      artifacts: [
        {
          path: artifact.path,
          content: artifact.content,
          type: artifact.type,
        },
      ],
      warnings: analysis.warnings,
    };
  }
}
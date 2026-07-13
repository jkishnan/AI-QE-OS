import { Command } from "commander";
import { config as loadEnvironment } from "dotenv";
import process from "node:process";
import {
  buildPlaywrightPrompt,
  PlaywrightGeneratorCapability,
} from "../../../packages/capabilities/playwright-generator/src/index.js";
import { ContextBuilder } from "../../../packages/context-builder/src/context-builder.js";
import { CapabilityRegistry } from "../../../packages/core/src/capability-registry.js";
import {
  loadProjectConfig,
  ProjectConfigFileNotFoundError,
} from "../../../packages/core/src/config.js";
import type { ProjectConfig } from "../../../packages/core/src/config.js";
import {
  createLlmProvider,
  MockLlmProvider,
} from "../../../packages/llm/src/index.js";
import { ProjectAnalyzer } from "../../../packages/project-analyzer/src/project-analyzer.js";

loadEnvironment({ quiet: true });

const program = new Command();
const registry = new CapabilityRegistry();
registry.register(new PlaywrightGeneratorCapability(createLlmProvider()));

interface RunOptions {
  request: string;
  project?: string;
  output?: string;
  config?: string;
}

interface PromptPreviewOptions {
  request: string;
}

interface ConfigCheckOptions {
  config: string;
}

async function loadRunConfig(configPath?: string): Promise<ProjectConfig | null> {
  const resolvedPath = configPath ?? "./project.yml";

  try {
    return await loadProjectConfig(resolvedPath);
  } catch (error) {
    if (!configPath && error instanceof ProjectConfigFileNotFoundError) {
      return null;
    }

    throw error;
  }
}

program
  .name("ai-qe")
  .description("AI-powered Quality Engineering platform")
  .version("0.1.0");

program
  .command("list")
  .description("List registered capabilities")
  .action(() => {
    const capabilities = registry.list();

    console.log("AI-QE OS");
    console.log("");

    if (capabilities.length === 0) {
      console.log("No capabilities registered.");
      return;
    }

    for (const capability of capabilities) {
      console.log(
        `- ${capability.name} (${capability.id}) v${capability.version}`
      );
    }
  });

program
  .command("run <id>")
  .description("Run a registered capability")
  .requiredOption("--request <text>", "Capability request")
  .option("--project <path>", "Project root")
  .option("--output <path>", "Output directory")
  .option("--config <path>", "Project configuration file")
  .action(async (id: string, options: RunOptions) => {
    try {
      const config = await loadRunConfig(options.config);
      const runRegistry = new CapabilityRegistry();
      runRegistry.register(
        new PlaywrightGeneratorCapability(
          createLlmProvider(config?.llm.provider, config?.llm.model)
        )
      );
      const capability = runRegistry.get(id);
      const context = {
        projectRoot: options.project ?? config?.project.root ?? ".",
        request: options.request,
        outputDirectory:
          options.output ?? config?.generation.outputDirectory ?? "./generated",
      };

      await capability.validate(context);
      const result = await capability.execute(context);

      console.log(`Capability: ${capability.name}`);
      console.log(`Status: ${result.success ? "Success" : "Failure"}`);
      console.log(`Summary: ${result.summary}`);
      console.log("Warnings:");

      if (result.warnings?.length) {
        for (const warning of result.warnings) {
          console.log(`- ${warning}`);
        }
      } else {
        console.log("- None");
      }

      console.log("Generated:");

      if (result.artifacts.length > 0) {
        for (const artifact of result.artifacts) {
          console.log(artifact.path);
        }
      } else {
        console.log("None");
      }

      if (!result.success) {
        process.exitCode = 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Unable to run capability "${id}": ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command("config-check")
  .description("Validate an AI-QE OS project configuration")
  .option("--config <path>", "Project configuration file", "./project.yml")
  .action(async (options: ConfigCheckOptions) => {
    try {
      const config = await loadProjectConfig(options.config);

      console.log("Validated configuration:");
      console.log(JSON.stringify(config, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Configuration error: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command("analyze <path>")
  .description("Analyze a Playwright project")
  .action(async (projectPath: string) => {
    try {
      const analysis = await new ProjectAnalyzer().analyze(projectPath);

      console.log(
        `Playwright config: ${analysis.playwrightConfig?.path ?? "Not found"}`
      );
      console.log(`Number of page objects: ${analysis.pageObjects.length}`);
      for (const file of analysis.pageObjects) {
        console.log(`- ${file.path}`);
      }

      console.log(`Number of fixtures: ${analysis.fixtures.length}`);
      for (const file of analysis.fixtures) {
        console.log(`- ${file.path}`);
      }

      console.log(`Number of tests found: ${analysis.sampleTests.length}`);
      for (const file of analysis.sampleTests) {
        console.log(`- ${file.path}`);
      }

      if (analysis.warnings.length > 0) {
        console.log("Warnings:");
        for (const warning of analysis.warnings) {
          console.log(`- ${warning}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Unable to analyze project "${projectPath}": ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command("llm-test")
  .description("Test the configured LLM provider")
  .action(async () => {
    try {
      const provider = new MockLlmProvider();
      const response = await provider.generate({
        systemPrompt: "Generate Playwright tests in TypeScript.",
        userPrompt: "Generate a placeholder test.",
      });

      console.log(`Provider: ${response.provider}`);
      console.log(`Model: ${response.model}`);
      console.log("Generated text:");
      console.log(response.text);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Unable to test LLM provider: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command("prompt-preview <path>")
  .description("Preview the Playwright generation prompt")
  .requiredOption("--request <text>", "Test-generation request")
  .action(async (projectPath: string, options: PromptPreviewOptions) => {
    try {
      const analysis = await new ProjectAnalyzer().analyze(projectPath);
      const prompt = buildPlaywrightPrompt(options.request, analysis);

      console.log("System prompt:");
      console.log(prompt.systemPrompt);
      console.log("");
      console.log("User prompt:");
      console.log(prompt.userPrompt);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Unable to build prompt preview: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command("context <path>")
  .description("Build a bounded context for a Playwright project")
  .action(async (projectPath: string) => {
    try {
      const analysis = await new ProjectAnalyzer().analyze(projectPath);
      const context = new ContextBuilder().build(analysis);

      console.log("Context Summary");
      console.log("----------------");
      console.log(`Files: ${context.totalFiles}`);
      console.log(`Characters: ${context.totalCharacters}`);
      console.log(`Estimated Tokens: ${context.estimatedTokenCount}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Unable to build project context: ${message}`);
      process.exitCode = 1;
    }
  });

await program.parseAsync();

import { Command } from "commander";
import process from "node:process";
import { PlaywrightGeneratorCapability } from "../../../packages/capabilities/playwright-generator/src/index.js";
import { CapabilityRegistry } from "../../../packages/core/src/capability-registry.js";

const program = new Command();
const registry = new CapabilityRegistry();
registry.register(new PlaywrightGeneratorCapability());

interface RunOptions {
  request: string;
  project: string;
  output: string;
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
  .option("--project <path>", "Project root", ".")
  .option("--output <path>", "Output directory", "./generated")
  .action(async (id: string, options: RunOptions) => {
    try {
      const capability = registry.get(id);
      const context = {
        projectRoot: options.project,
        request: options.request,
        outputDirectory: options.output,
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

      console.log("Generated artifacts:");

      if (result.artifacts.length > 0) {
        for (const artifact of result.artifacts) {
          console.log(`- ${artifact.path}`);
        }
      } else {
        console.log("- None");
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

await program.parseAsync();

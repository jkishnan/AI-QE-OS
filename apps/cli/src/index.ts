import { Command } from "commander";
import { PlaywrightGeneratorCapability } from "../../../packages/capabilities/playwright-generator/src/index.js";
import { CapabilityRegistry } from "../../../packages/core/src/capability-registry.js";

const program = new Command();
const registry = new CapabilityRegistry();
registry.register(new PlaywrightGeneratorCapability());

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

program.parse();

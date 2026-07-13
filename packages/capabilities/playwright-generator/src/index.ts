import type {
  Capability,
  CapabilityContext,
  CapabilityResult,
} from "../../../capability-sdk/src/types.js";

export class PlaywrightGeneratorCapability implements Capability {
  readonly id = "playwright-generator";
  readonly name = "Playwright Test Generator";
  readonly version = "0.1.0";

  async validate(context: CapabilityContext): Promise<void> {
    if (context.request.trim().length === 0) {
      throw new Error("A test generation request is required");
    }
  }

  async execute(_context: CapabilityContext): Promise<CapabilityResult> {
    return {
      success: true,
      summary: "Playwright test generation is not implemented yet.",
      artifacts: [],
    };
  }
}

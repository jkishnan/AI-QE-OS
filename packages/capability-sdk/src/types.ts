export interface CapabilityContext {
  projectRoot: string;
  request: string;
  outputDirectory: string;
}

export interface CapabilityArtifact {
  path: string;
  content: string;
  type: "test" | "report" | "metadata";
}

export interface CapabilityResult {
  success: boolean;
  summary: string;
  artifacts: CapabilityArtifact[];
  warnings?: string[];
}

export interface Capability {
  readonly id: string;
  readonly name: string;
  readonly version: string;

  validate(context: CapabilityContext): Promise<void>;

  execute(
    context: CapabilityContext
  ): Promise<CapabilityResult>;
}
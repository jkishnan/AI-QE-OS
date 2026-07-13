import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { z } from "zod";

const projectConfigSchema = z
  .object({
    project: z
      .object({
        name: z.string().trim().min(1).default("playwright-project"),
        root: z.string().trim().min(1).default("."),
      })
      .strict()
      .default({ name: "playwright-project", root: "." }),
    llm: z
      .object({
        provider: z.enum(["mock", "openai"]).default("mock"),
        model: z.string().trim().min(1).default("mock-playwright-0.1"),
      })
      .strict()
      .default({ provider: "mock", model: "mock-playwright-0.1" }),
    generation: z
      .object({
        outputDirectory: z.string().trim().min(1).default("./generated"),
      })
      .strict()
      .default({ outputDirectory: "./generated" }),
    context: z
      .object({
        maxPageObjects: z.number().int().positive().default(5),
        maxFixtures: z.number().int().positive().default(5),
        maxTests: z.number().int().positive().default(3),
        maxCharactersPerFile: z.number().int().positive().default(12_000),
      })
      .strict()
      .default({
        maxPageObjects: 5,
        maxFixtures: 5,
        maxTests: 3,
        maxCharactersPerFile: 12_000,
      }),
  })
  .strict();

export type ProjectConfig = z.infer<typeof projectConfigSchema>;

export class ProjectConfigFileNotFoundError extends Error {
  constructor(configPath: string) {
    super(`Configuration file not found: ${configPath}`);
    this.name = "ProjectConfigFileNotFoundError";
  }
}

export async function loadProjectConfig(
  configPath = "./project.yml"
): Promise<ProjectConfig> {
  let source: string;

  try {
    source = await readFile(configPath, "utf8");
  } catch (error) {
    if (isFileNotFoundError(error)) {
      throw new ProjectConfigFileNotFoundError(configPath);
    }

    throw new Error(
      `Unable to read configuration file "${configPath}": ${getErrorMessage(error)}`
    );
  }

  let parsed: unknown;

  try {
    parsed = parse(source);
  } catch (error) {
    throw new Error(
      `Invalid YAML in "${configPath}": ${getErrorMessage(error)}`
    );
  }

  const result = projectConfigSchema.safeParse(parsed ?? {});

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => {
        const location = issue.path.length > 0 ? issue.path.join(".") : "configuration";
        return `${location}: ${issue.message}`;
      })
      .join("; ");

    throw new Error(`Invalid configuration in "${configPath}": ${issues}`);
  }

  return result.data;
}

function isFileNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

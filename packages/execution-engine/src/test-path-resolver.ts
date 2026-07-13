import path from "node:path";

const DEFAULT_TEST_DIRECTORY = "tests";
const DEFAULT_GENERATED_DIRECTORY = "generated";
const DEFAULT_GENERATED_FILE = "generated.spec.ts";
const TEST_DIRECTORY_PATTERN =
  /(?:^|[,{])\s*testDir\s*:\s*(["'`])([^"'`\r\n]+)\1/m;

export interface GeneratedTestPathOptions {
  projectRoot: string;
  outputDirectory?: string;
  playwrightConfigContent?: string;
  fileName?: string;
}

export function detectPlaywrightTestDir(configContent: string): string | null {
  return TEST_DIRECTORY_PATTERN.exec(configContent)?.[2]?.trim() || null;
}

export function resolveGeneratedTestPath(
  options: GeneratedTestPathOptions
): string {
  const projectRoot = path.resolve(options.projectRoot);
  const configuredTestDirectory = options.playwrightConfigContent
    ? detectPlaywrightTestDir(options.playwrightConfigContent)
    : null;
  const testDirectory = path.resolve(
    projectRoot,
    configuredTestDirectory ?? DEFAULT_TEST_DIRECTORY
  );
  const requestedOutput =
    options.outputDirectory?.trim() || DEFAULT_GENERATED_DIRECTORY;

  let outputDirectory: string;

  if (path.isAbsolute(requestedOutput)) {
    outputDirectory = path.resolve(requestedOutput);
  } else {
    const projectRelativeOutput = path.resolve(projectRoot, requestedOutput);
    outputDirectory = isPathInside(testDirectory, projectRelativeOutput)
      ? projectRelativeOutput
      : path.resolve(testDirectory, requestedOutput);
  }

  const testFile = path.resolve(
    outputDirectory,
    options.fileName ?? DEFAULT_GENERATED_FILE
  );

  if (!isPathInside(projectRoot, testFile)) {
    throw new Error(
      `Generated test path must be inside the Playwright project: ${testFile}`
    );
  }

  return testFile;
}

function isPathInside(parent: string, candidate: string): boolean {
  const relativePath = path.relative(parent, candidate);

  return (
    relativePath === "" ||
    (!relativePath.startsWith(`..${path.sep}`) &&
      relativePath !== ".." &&
      !path.isAbsolute(relativePath))
  );
}

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  "test-results",
  "playwright-report",
  ".git",
  "dist",
]);

const SOURCE_FILE_PATTERN = /\.[cm]?[jt]sx?$/i;
const TEST_FILE_PATTERN = /\.(?:spec|test)\.[cm]?[jt]sx?$/i;
const FIXTURE_FILE_PATTERN = /(?:^|[._-])fixtures?\.[cm]?[jt]sx?$/i;
const PAGE_FILE_PATTERN = /(?:\.page|Page)\.[cm]?[jt]sx?$/i;
const PAGE_OBJECT_DIRECTORIES = new Set([
  "pages",
  "page-objects",
  "pageobjects",
]);

export interface ProjectAnalysis {
  playwrightConfig: AnalyzedFile | null;
  pageObjects: AnalyzedFile[];
  fixtures: AnalyzedFile[];
  sampleTests: AnalyzedFile[];
  warnings: string[];
}

export interface AnalyzedFile {
  path: string;
  content: string;
}

export class ProjectAnalyzer {
  async analyze(projectRoot: string): Promise<ProjectAnalysis> {
    const root = path.resolve(projectRoot);
    const files: string[] = [];
    const warnings: string[] = [];

    await this.scanDirectory(root, root, files, warnings);
    files.sort();

    const configPath = files.find((file) =>
      /^playwright\.config\./i.test(path.basename(file))
    );
    const pageObjectPaths = files
      .filter((file) => this.isPageObject(file))
      .slice(0, 5);
    const fixturePaths = files
      .filter((file) => this.isFixture(file))
      .slice(0, 5);
    const sampleTestPaths = files
      .filter((file) => TEST_FILE_PATTERN.test(path.basename(file)))
      .slice(0, 3);

    return {
      playwrightConfig: configPath
        ? await this.readAnalyzedFile(root, configPath, warnings)
        : null,
      pageObjects: await this.readAnalyzedFiles(root, pageObjectPaths, warnings),
      fixtures: await this.readAnalyzedFiles(root, fixturePaths, warnings),
      sampleTests: await this.readAnalyzedFiles(root, sampleTestPaths, warnings),
      warnings,
    };
  }

  private async scanDirectory(
    root: string,
    directory: string,
    files: string[],
    warnings: string[]
  ): Promise<void> {
    let entries;

    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      const relativeDirectory = path.relative(root, directory) || ".";
      warnings.push(
        `Unable to scan "${relativeDirectory}": ${this.getErrorMessage(error)}`
      );
      return;
    }

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          await this.scanDirectory(root, absolutePath, files, warnings);
        }

        continue;
      }

      if (entry.isFile()) {
        files.push(path.relative(root, absolutePath));
      }
    }
  }

  private async readAnalyzedFiles(
    root: string,
    files: string[],
    warnings: string[]
  ): Promise<AnalyzedFile[]> {
    const analyzedFiles = await Promise.all(
      files.map((file) => this.readAnalyzedFile(root, file, warnings))
    );

    return analyzedFiles.filter(
      (file): file is AnalyzedFile => file !== null
    );
  }

  private async readAnalyzedFile(
    root: string,
    relativePath: string,
    warnings: string[]
  ): Promise<AnalyzedFile | null> {
    try {
      const buffer = await readFile(path.join(root, relativePath));

      if (buffer.includes(0)) {
        warnings.push(`Skipped binary file "${relativePath}"`);
        return null;
      }

      let content: string;

      try {
        content = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      } catch {
        warnings.push(`Skipped non-UTF-8 file "${relativePath}"`);
        return null;
      }

      return { path: relativePath, content };
    } catch (error) {
      warnings.push(
        `Unable to read "${relativePath}": ${this.getErrorMessage(error)}`
      );
      return null;
    }
  }

  private isPageObject(file: string): boolean {
    if (!SOURCE_FILE_PATTERN.test(file) || TEST_FILE_PATTERN.test(file)) {
      return false;
    }

    const directories = path.dirname(file).split(path.sep);

    return (
      PAGE_FILE_PATTERN.test(path.basename(file)) ||
      directories.some((directory) => PAGE_OBJECT_DIRECTORIES.has(directory.toLowerCase()))
    );
  }

  private isFixture(file: string): boolean {
    if (!SOURCE_FILE_PATTERN.test(file)) {
      return false;
    }

    const directories = path.dirname(file).split(path.sep);

    return (
      FIXTURE_FILE_PATTERN.test(path.basename(file)) ||
      directories.some((directory) => directory.toLowerCase() === "fixtures")
    );
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

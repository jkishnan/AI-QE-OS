import { readdir } from "node:fs/promises";
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
  playwrightConfig: string | null;
  pageObjects: string[];
  fixtures: string[];
  tests: string[];
}

export class ProjectAnalyzer {
  async analyze(projectRoot: string): Promise<ProjectAnalysis> {
    const root = path.resolve(projectRoot);
    const files: string[] = [];

    await this.scanDirectory(root, root, files);
    files.sort();

    return {
      playwrightConfig:
        files.find((file) => /^playwright\.config\./i.test(path.basename(file))) ??
        null,
      pageObjects: files.filter((file) => this.isPageObject(file)),
      fixtures: files.filter((file) => this.isFixture(file)),
      tests: files.filter((file) => TEST_FILE_PATTERN.test(path.basename(file))),
    };
  }

  private async scanDirectory(
    root: string,
    directory: string,
    files: string[]
  ): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          await this.scanDirectory(root, absolutePath, files);
        }

        continue;
      }

      if (entry.isFile()) {
        files.push(path.relative(root, absolutePath));
      }
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
}

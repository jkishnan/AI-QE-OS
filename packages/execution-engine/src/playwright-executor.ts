import { spawn } from "node:child_process";
import { mkdir, readFile, stat, unlink } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  parsePlaywrightJsonReport,
  type TestSummary,
} from "./json-report-parser.js";

const NO_TESTS_FOUND_PATTERN = /No tests found/i;
const NO_TESTS_FOUND_HELP =
  'Playwright reported "No tests found". The test file may be outside the configured testDir; move it under testDir or update playwright.config.ts.';
const DEFAULT_RESULTS_DIRECTORY = "./test-results/ai-qe-os";
const REPORT_FILE_NAME = "playwright-report.json";
const EMPTY_SUMMARY: TestSummary = {
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  skippedTests: 0,
};

export interface ExecutionResult {
  success: boolean;
  exitCode: number;
  durationMs: number;
  stdout: string;
  stderr: string;
  testFile: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  reportPath: string;
}

export class PlaywrightExecutor {
  async execute(
    testFile: string,
    projectRoot: string,
    resultsDirectory = DEFAULT_RESULTS_DIRECTORY
  ): Promise<ExecutionResult> {
    const startedAt = Date.now();
    const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
    const resolvedTestFile = path.resolve(projectRoot, testFile);
    const resolvedResultsDirectory = path.resolve(
      projectRoot,
      resultsDirectory
    );
    const reportPath = path.join(resolvedResultsDirectory, REPORT_FILE_NAME);

    try {
      const testFileStats = await stat(resolvedTestFile);

      if (!testFileStats.isFile()) {
        return this.failureResult(
          testFile,
          startedAt,
          `Test file does not reference a file: ${resolvedTestFile}`,
          reportPath
        );
      }
    } catch (error) {
      return this.failureResult(
        testFile,
        startedAt,
        `Test file was not found or is not readable: ${resolvedTestFile}. ${this.getErrorMessage(error)}`,
        reportPath
      );
    }

    try {
      await mkdir(resolvedResultsDirectory, { recursive: true });
    } catch (error) {
      return this.failureResult(
        testFile,
        startedAt,
        `Unable to create results directory "${resolvedResultsDirectory}": ${this.getErrorMessage(error)}`,
        reportPath
      );
    }

    try {
      await unlink(reportPath);
    } catch (error) {
      if (!this.isFileNotFoundError(error)) {
        return this.failureResult(
          testFile,
          startedAt,
          `Unable to prepare JSON report path "${reportPath}": ${this.getErrorMessage(error)}`,
          reportPath
        );
      }
    }

    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let settled = false;

      const finish = async (exitCode: number): Promise<void> => {
        if (settled) {
          return;
        }

        settled = true;
        const noTestsFound = NO_TESTS_FOUND_PATTERN.test(
          `${stdout}\n${stderr}`
        );

        if (noTestsFound && !stderr.includes(NO_TESTS_FOUND_HELP)) {
          const separator =
            stderr.length > 0 && !stderr.endsWith("\n") ? "\n" : "";
          stderr += `${separator}${NO_TESTS_FOUND_HELP}`;
        }

        const resolvedExitCode = noTestsFound && exitCode === 0 ? 1 : exitCode;
        const report =
          exitCode === -1
            ? { summary: EMPTY_SUMMARY, warning: null }
            : await this.collectReport(reportPath);

        if (report.warning) {
          const separator =
            stderr.length > 0 && !stderr.endsWith("\n") ? "\n" : "";
          stderr += `${separator}${report.warning}`;
        }

        resolve({
          success: resolvedExitCode === 0,
          exitCode: resolvedExitCode,
          durationMs: Date.now() - startedAt,
          stdout,
          stderr,
          testFile,
          ...report.summary,
          reportPath,
        });
      };

      let child;

      try {
        child = spawn(
          npxCommand,
          ["playwright", "test", testFile, "--reporter=json"],
          {
            cwd: projectRoot,
            env: {
              ...process.env,
              PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath,
            },
            shell: false,
          }
        );
      } catch (error) {
        stderr = `Unable to start Playwright: ${this.getErrorMessage(error)}`;
        void finish(-1);
        return;
      }

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      child.once("error", (error) => {
        const separator = stderr.length > 0 && !stderr.endsWith("\n") ? "\n" : "";
        stderr += `${separator}Unable to start Playwright: ${error.message}`;
        void finish(-1);
      });

      child.once("close", (exitCode) => {
        void finish(exitCode ?? 1);
      });
    });
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private isFileNotFoundError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    );
  }

  private failureResult(
    testFile: string,
    startedAt: number,
    stderr: string,
    reportPath: string
  ): ExecutionResult {
    return {
      success: false,
      exitCode: -1,
      durationMs: Date.now() - startedAt,
      stdout: "",
      stderr,
      testFile,
      ...EMPTY_SUMMARY,
      reportPath,
    };
  }

  private async collectReport(reportPath: string): Promise<{
    summary: TestSummary;
    warning: string | null;
  }> {
    let reportContent: string;

    try {
      reportContent = await readFile(reportPath, "utf8");
    } catch (error) {
      return {
        summary: EMPTY_SUMMARY,
        warning: `Playwright JSON report was not available at "${reportPath}": ${this.getErrorMessage(error)}`,
      };
    }

    const summary = parsePlaywrightJsonReport(reportContent);

    if (!summary) {
      return {
        summary: EMPTY_SUMMARY,
        warning: `Playwright JSON report at "${reportPath}" was malformed and could not be parsed.`,
      };
    }

    return { summary, warning: null };
  }
}

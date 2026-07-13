import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const NO_TESTS_FOUND_PATTERN = /No tests found/i;
const NO_TESTS_FOUND_HELP =
  'Playwright reported "No tests found". The test file may be outside the configured testDir; move it under testDir or update playwright.config.ts.';

export interface ExecutionResult {
  success: boolean;
  exitCode: number;
  durationMs: number;
  stdout: string;
  stderr: string;
  testFile: string;
}

export class PlaywrightExecutor {
  async execute(
    testFile: string,
    projectRoot: string
  ): Promise<ExecutionResult> {
    const startedAt = Date.now();
    const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
    const resolvedTestFile = path.resolve(projectRoot, testFile);

    try {
      const testFileStats = await stat(resolvedTestFile);

      if (!testFileStats.isFile()) {
        return this.failureResult(
          testFile,
          startedAt,
          `Test file does not reference a file: ${resolvedTestFile}`
        );
      }
    } catch (error) {
      return this.failureResult(
        testFile,
        startedAt,
        `Test file was not found or is not readable: ${resolvedTestFile}. ${this.getErrorMessage(error)}`
      );
    }

    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let settled = false;

      const finish = (exitCode: number): void => {
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
        resolve({
          success: resolvedExitCode === 0,
          exitCode: resolvedExitCode,
          durationMs: Date.now() - startedAt,
          stdout,
          stderr,
          testFile,
        });
      };

      let child;

      try {
        child = spawn(npxCommand, ["playwright", "test", testFile], {
          cwd: projectRoot,
          shell: false,
        });
      } catch (error) {
        stderr = `Unable to start Playwright: ${this.getErrorMessage(error)}`;
        finish(-1);
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
        finish(-1);
      });

      child.once("close", (exitCode) => {
        finish(exitCode ?? 1);
      });
    });
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private failureResult(
    testFile: string,
    startedAt: number,
    stderr: string
  ): ExecutionResult {
    return {
      success: false,
      exitCode: -1,
      durationMs: Date.now() - startedAt,
      stdout: "",
      stderr,
      testFile,
    };
  }
}

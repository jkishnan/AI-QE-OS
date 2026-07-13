import { spawn } from "node:child_process";
import process from "node:process";

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

    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let settled = false;

      const finish = (exitCode: number): void => {
        if (settled) {
          return;
        }

        settled = true;
        resolve({
          success: exitCode === 0,
          exitCode,
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
}

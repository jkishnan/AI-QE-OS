import type { GenerateRequest } from "../../../llm/src/types.js";
import type {
  AnalyzedFile,
  ProjectAnalysis,
} from "../../../project-analyzer/src/project-analyzer.js";

const SYSTEM_PROMPT = `You are a senior Playwright automation engineer.
Generate complete Playwright tests in TypeScript.
Prefer accessible, resilient locators: getByRole, getByLabel, and getByTestId.
Avoid fragile CSS selectors and XPath locators.
Reuse existing fixtures and page objects when they are available.
Use Playwright web-first assertions.
Return only complete TypeScript test code with no Markdown fences or explanation.`;

function formatFiles(files: AnalyzedFile[], emptyMessage: string): string {
  if (files.length === 0) {
    return emptyMessage;
  }

  return files
    .map(
      (file) => `Path: ${file.path}
Content:
${file.content}`
    )
    .join("\n\n---\n\n");
}

export function buildPlaywrightPrompt(
  request: string,
  analysis: ProjectAnalysis
): GenerateRequest {
  const config = analysis.playwrightConfig
    ? `Path: ${analysis.playwrightConfig.path}\nContent:\n${analysis.playwrightConfig.content}`
    : "No Playwright config was found.";
  const warnings =
    analysis.warnings.length > 0
      ? analysis.warnings.map((warning) => `- ${warning}`).join("\n")
      : "No analyzer warnings.";

  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `User request:
${request.trim() || "No test-generation request was provided."}

Playwright config:
${config}

Fixtures:
${formatFiles(analysis.fixtures, "No fixtures were found.")}

Page objects:
${formatFiles(analysis.pageObjects, "No page objects were found.")}

Sample tests:
${formatFiles(analysis.sampleTests, "No sample tests were found.")}

Analyzer warnings:
${warnings}`,
  };
}

export interface TestSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
}

export function parsePlaywrightJsonReport(
  reportContent: string
): TestSummary | null {
  let report: unknown;

  try {
    report = JSON.parse(reportContent);
  } catch {
    return null;
  }

  if (!isRecord(report) || !Array.isArray(report.suites)) {
    return null;
  }

  const summary: TestSummary = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
  };

  collectSuites(report.suites, summary);
  return summary;
}

function collectSuites(suites: unknown[], summary: TestSummary): void {
  for (const suite of suites) {
    if (!isRecord(suite)) {
      continue;
    }

    if (Array.isArray(suite.specs)) {
      collectSpecs(suite.specs, summary);
    }

    if (Array.isArray(suite.suites)) {
      collectSuites(suite.suites, summary);
    }
  }
}

function collectSpecs(specs: unknown[], summary: TestSummary): void {
  for (const spec of specs) {
    if (!isRecord(spec) || !Array.isArray(spec.tests)) {
      continue;
    }

    for (const test of spec.tests) {
      if (!isRecord(test)) {
        continue;
      }

      summary.totalTests += 1;
      const status = getFinalStatus(test);

      if (status === "passed") {
        summary.passedTests += 1;
      } else if (status === "skipped") {
        summary.skippedTests += 1;
      } else {
        summary.failedTests += 1;
      }
    }
  }
}

function getFinalStatus(test: Record<string, unknown>): string {
  if (Array.isArray(test.results)) {
    for (let index = test.results.length - 1; index >= 0; index -= 1) {
      const result = test.results[index];

      if (isRecord(result) && typeof result.status === "string") {
        return result.status;
      }
    }
  }

  return test.expectedStatus === "skipped" ? "skipped" : "failed";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

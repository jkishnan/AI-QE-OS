import assert from "node:assert/strict";
import test from "node:test";
import { parsePlaywrightJsonReport } from "./json-report-parser.js";

test("counts passed, failed, and skipped Playwright tests", () => {
  const report = {
    suites: [
      {
        specs: [
          {
            tests: [
              { results: [{ status: "passed" }] },
              { results: [{ status: "failed" }] },
              { results: [{ status: "skipped" }] },
            ],
          },
        ],
      },
    ],
  };

  assert.deepEqual(parsePlaywrightJsonReport(JSON.stringify(report)), {
    totalTests: 3,
    passedTests: 1,
    failedTests: 1,
    skippedTests: 1,
  });
});

test("uses the final retry result", () => {
  const report = {
    suites: [
      {
        specs: [
          {
            tests: [
              { results: [{ status: "failed" }, { status: "passed" }] },
            ],
          },
        ],
      },
    ],
  };

  assert.deepEqual(parsePlaywrightJsonReport(JSON.stringify(report)), {
    totalTests: 1,
    passedTests: 1,
    failedTests: 0,
    skippedTests: 0,
  });
});

test("collects tests from nested suites", () => {
  const report = {
    suites: [
      {
        suites: [
          {
            specs: [
              {
                tests: [{ expectedStatus: "skipped", results: [] }],
              },
            ],
          },
        ],
      },
    ],
  };

  assert.deepEqual(parsePlaywrightJsonReport(JSON.stringify(report)), {
    totalTests: 1,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 1,
  });
});

test("returns null for malformed JSON", () => {
  assert.equal(parsePlaywrightJsonReport("{ invalid"), null);
});

test("returns null when the report has no suites array", () => {
  assert.equal(parsePlaywrightJsonReport(JSON.stringify({ suites: {} })), null);
});

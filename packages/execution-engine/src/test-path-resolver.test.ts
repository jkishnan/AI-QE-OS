import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  detectPlaywrightTestDir,
  resolveGeneratedTestPath,
} from "./test-path-resolver.js";

const projectRoot = path.resolve("/tmp/example-playwright-project");

test("detects a static testDir from Playwright config", () => {
  const config = `export default defineConfig({
  testDir: "./e2e",
});`;

  assert.equal(detectPlaywrightTestDir(config), "./e2e");
});

test("detects testDir in a compact config", () => {
  assert.equal(
    detectPlaywrightTestDir("export default defineConfig({ testDir: './specs' });"),
    "./specs"
  );
});

test("defaults generated tests to tests/generated", () => {
  assert.equal(
    resolveGeneratedTestPath({ projectRoot }),
    path.join(projectRoot, "tests", "generated", "generated.spec.ts")
  );
});

test("places relative output under the configured testDir", () => {
  assert.equal(
    resolveGeneratedTestPath({
      projectRoot,
      outputDirectory: "./generated",
      playwrightConfigContent: "  testDir: './e2e',",
    }),
    path.join(projectRoot, "e2e", "generated", "generated.spec.ts")
  );
});

test("does not duplicate an output path already under testDir", () => {
  assert.equal(
    resolveGeneratedTestPath({
      projectRoot,
      outputDirectory: "e2e/generated",
      playwrightConfigContent: "  testDir: `./e2e`,",
    }),
    path.join(projectRoot, "e2e", "generated", "generated.spec.ts")
  );
});

test("allows an absolute generated path inside the project", () => {
  const outputDirectory = path.join(projectRoot, "custom-output");

  assert.equal(
    resolveGeneratedTestPath({ projectRoot, outputDirectory }),
    path.join(outputDirectory, "generated.spec.ts")
  );
});

test("rejects a generated path outside the project", () => {
  assert.throws(
    () =>
      resolveGeneratedTestPath({
        projectRoot,
        outputDirectory: path.resolve("/tmp/outside-project"),
      }),
    /must be inside the Playwright project/
  );
});

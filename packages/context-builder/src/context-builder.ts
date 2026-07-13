import type {
  AnalyzedFile,
  ProjectAnalysis,
} from "../../project-analyzer/src/project-analyzer.js";

const PAGE_OBJECT_LIMIT = 5;
const FIXTURE_LIMIT = 5;
const SAMPLE_TEST_LIMIT = 3;
const DEFAULT_CHARACTER_LIMIT = 12_000;
const CHARACTERS_PER_TOKEN = 4;
const TRUNCATION_MARKER = "\n... [truncated]";

export interface ContextBuilderOptions {
  playwrightConfigCharacterLimit?: number;
  pageObjectCharacterLimit?: number;
  fixtureCharacterLimit?: number;
  sampleTestCharacterLimit?: number;
}

export interface ProjectContext {
  playwrightConfig: AnalyzedFile | null;
  pageObjects: AnalyzedFile[];
  fixtures: AnalyzedFile[];
  sampleTests: AnalyzedFile[];
  analyzerWarnings: string[];
  totalFiles: number;
  totalCharacters: number;
  estimatedTokenCount: number;
}

interface ResolvedContextBuilderOptions {
  playwrightConfigCharacterLimit: number;
  pageObjectCharacterLimit: number;
  fixtureCharacterLimit: number;
  sampleTestCharacterLimit: number;
}

export class ContextBuilder {
  private readonly options: ResolvedContextBuilderOptions;

  constructor(options: ContextBuilderOptions = {}) {
    this.options = {
      playwrightConfigCharacterLimit: this.resolveLimit(
        options.playwrightConfigCharacterLimit,
        "playwrightConfigCharacterLimit"
      ),
      pageObjectCharacterLimit: this.resolveLimit(
        options.pageObjectCharacterLimit,
        "pageObjectCharacterLimit"
      ),
      fixtureCharacterLimit: this.resolveLimit(
        options.fixtureCharacterLimit,
        "fixtureCharacterLimit"
      ),
      sampleTestCharacterLimit: this.resolveLimit(
        options.sampleTestCharacterLimit,
        "sampleTestCharacterLimit"
      ),
    };
  }

  build(analysis: ProjectAnalysis): ProjectContext {
    const playwrightConfig = analysis.playwrightConfig
      ? this.truncateFile(
          analysis.playwrightConfig,
          this.options.playwrightConfigCharacterLimit
        )
      : null;
    const pageObjects = analysis.pageObjects
      .slice(0, PAGE_OBJECT_LIMIT)
      .map((file) =>
        this.truncateFile(file, this.options.pageObjectCharacterLimit)
      );
    const fixtures = analysis.fixtures
      .slice(0, FIXTURE_LIMIT)
      .map((file) =>
        this.truncateFile(file, this.options.fixtureCharacterLimit)
      );
    const sampleTests = analysis.sampleTests
      .slice(0, SAMPLE_TEST_LIMIT)
      .map((file) =>
        this.truncateFile(file, this.options.sampleTestCharacterLimit)
      );
    const files = [
      ...(playwrightConfig ? [playwrightConfig] : []),
      ...pageObjects,
      ...fixtures,
      ...sampleTests,
    ];
    const totalCharacters = files.reduce(
      (total, file) => total + file.content.length,
      0
    );

    return {
      playwrightConfig,
      pageObjects,
      fixtures,
      sampleTests,
      analyzerWarnings: [...analysis.warnings],
      totalFiles: files.length,
      totalCharacters,
      estimatedTokenCount: Math.ceil(totalCharacters / CHARACTERS_PER_TOKEN),
    };
  }

  private truncateFile(file: AnalyzedFile, limit: number): AnalyzedFile {
    if (file.content.length <= limit) {
      return { ...file };
    }

    if (limit <= TRUNCATION_MARKER.length) {
      return { path: file.path, content: file.content.slice(0, limit) };
    }

    return {
      path: file.path,
      content:
        file.content.slice(0, limit - TRUNCATION_MARKER.length) +
        TRUNCATION_MARKER,
    };
  }

  private resolveLimit(value: number | undefined, name: string): number {
    const limit = value ?? DEFAULT_CHARACTER_LIMIT;

    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error(`${name} must be a positive integer`);
    }

    return limit;
  }
}

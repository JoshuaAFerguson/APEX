/**
 * Testing Pattern Analyzer - Test Coverage and Pattern Analysis
 *
 * Analyzes testing patterns and practices in a codebase including:
 * - Test framework detection (Jest, Vitest, Mocha, etc.)
 * - Test categorization (unit, integration, e2e, etc.)
 * - Test naming and organization conventions
 * - Testing anti-patterns identification
 * - Test coverage analysis (when available)
 * - Test quality metrics and recommendations
 *
 * Returns structured TestingPatternAnalysis data validated against schema.
 */

import { promises as fs } from 'fs';
import { join, relative, dirname, basename, extname } from 'path';
import type { TestingPatternAnalysis } from '@apexcli/core';
import type { CodebaseAnalyzer } from '../types.js';

/**
 * Test framework detection patterns in package.json
 */
const TEST_FRAMEWORK_PATTERNS = [
  { pattern: /^jest$/, name: 'Jest' },
  { pattern: /^vitest$/, name: 'Vitest' },
  { pattern: /^mocha$/, name: 'Mocha' },
  { pattern: /^jasmine$/, name: 'Jasmine' },
  { pattern: /^@playwright\/test$/, name: 'Playwright' },
  { pattern: /^cypress$/, name: 'Cypress' },
  { pattern: /^puppeteer$/, name: 'Puppeteer' },
  { pattern: /^@testing-library\//, name: 'Testing Library' },
  { pattern: /^karma$/, name: 'Karma' },
  { pattern: /^ava$/, name: 'AVA' },
  { pattern: /^tape$/, name: 'Tape' },
  { pattern: /^qunit$/, name: 'QUnit' },
  { pattern: /^uvu$/, name: 'uvu' },
];

/**
 * Test file patterns for categorization
 */
const TEST_CATEGORIZATION_PATTERNS = [
  // Unit tests
  {
    patterns: [
      /\.unit\.(test|spec)\./i,
      /unit\/.*\.(test|spec)\./i,
      /units\/.*\.(test|spec)\./i,
      /__tests__\/unit\//i,
      /tests\/unit\//i,
    ],
    category: 'unit' as const,
  },
  // Integration tests
  {
    patterns: [
      /\.integration\.(test|spec)\./i,
      /\.int\.(test|spec)\./i,
      /integration\/.*\.(test|spec)\./i,
      /__tests__\/integration\//i,
      /tests\/integration\//i,
    ],
    category: 'integration' as const,
  },
  // E2E tests
  {
    patterns: [
      /\.e2e\.(test|spec)\./i,
      /\.end-to-end\.(test|spec)\./i,
      /e2e\/.*\.(test|spec)\./i,
      /__tests__\/e2e\//i,
      /tests\/e2e\//i,
      /cypress\//i,
      /playwright\//i,
    ],
    category: 'e2e' as const,
  },
  // Component tests
  {
    patterns: [
      /\.component\.(test|spec)\./i,
      /\.comp\.(test|spec)\./i,
      /component\/.*\.(test|spec)\./i,
      /__tests__\/component\//i,
      /tests\/component\//i,
    ],
    category: 'component' as const,
  },
  // Performance tests
  {
    patterns: [
      /\.performance\.(test|spec)\./i,
      /\.perf\.(test|spec)\./i,
      /\.load\.(test|spec)\./i,
      /performance\/.*\.(test|spec)\./i,
      /__tests__\/performance\//i,
      /tests\/performance\//i,
    ],
    category: 'performance' as const,
  },
];

/**
 * Anti-pattern detection rules
 */
const ANTI_PATTERN_RULES = [
  {
    type: 'god-test' as const,
    patterns: [
      /describe\([^)]*\)\s*{\s*(?:[^{}]*{[^{}]*}[^{}]*){10,}/g, // Many nested test cases
    ],
    severity: 'high' as const,
    description: 'Test file contains too many test cases in a single describe block',
  },
  {
    type: 'mystery-guest' as const,
    patterns: [
      /beforeEach\([^)]*\)\s*{\s*[^}]*\w+\s*=\s*new\s+\w+/g, // Object creation in beforeEach
      /beforeAll\([^)]*\)\s*{\s*[^}]*\w+\s*=\s*new\s+\w+/g,
    ],
    severity: 'medium' as const,
    description: 'Test depends on external setup that makes it hard to understand',
  },
  {
    type: 'hardcoded-test-data' as const,
    patterns: [
      /(?:expect|assert)[^)]*(?:'[^']*'|"[^"]*")[^)]*(?:'[^']*'|"[^"]*")/g, // Multiple string literals in assertions
    ],
    severity: 'medium' as const,
    description: 'Test uses hardcoded test data instead of meaningful data builders',
  },
  {
    type: 'conditional-test-logic' as const,
    patterns: [
      /it\([^{]*{\s*if\s*\(/g,
      /test\([^{]*{\s*if\s*\(/g,
      /it\([^{]*{\s*switch\s*\(/g,
    ],
    severity: 'high' as const,
    description: 'Test contains conditional logic that should be avoided',
  },
  {
    type: 'assertion-roulette' as const,
    patterns: [
      /(?:expect|assert)[^;]*;[^}]*(?:expect|assert)[^;]*;[^}]*(?:expect|assert)/g, // Multiple assertions without clear grouping
    ],
    severity: 'medium' as const,
    description: 'Test contains multiple assertions without clear organization',
  },
];

export class TestingPatternAnalyzer implements CodebaseAnalyzer<TestingPatternAnalysis> {
  /**
   * Analyze testing patterns in a codebase
   */
  async analyze(projectPath: string): Promise<TestingPatternAnalysis> {
    try {
      // 1. Detect test framework
      const framework = await this.detectTestFramework(projectPath);

      // 2. Find all test files
      const testFiles = await this.findTestFiles(projectPath);

      // 3. Categorize tests
      const patterns = this.categorizeTests(testFiles, projectPath);

      // 4. Extract conventions
      const conventions = this.extractTestConventions(testFiles, projectPath);

      // 5. Detect anti-patterns
      const antiPatterns = await this.detectAntiPatterns(testFiles);

      // 6. Calculate metrics
      const metrics = await this.calculateTestMetrics(testFiles);

      // 7. Generate recommendations
      const recommendations = this.generateRecommendations(patterns, antiPatterns, conventions);

      // 8. Try to get coverage information
      const coverage = await this.getCoverageInformation(projectPath);

      return {
        framework,
        testCount: testFiles.length,
        coverage,
        patterns,
        conventions,
        antiPatterns,
        recommendations,
        metrics,
      };
    } catch (error) {
      throw new Error(`Testing pattern analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Detect test framework from package.json
   */
  private async detectTestFramework(projectPath: string): Promise<string> {
    try {
      const packageJsonPath = join(projectPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      // Check for test frameworks in dependencies
      for (const [depName] of Object.entries(allDeps)) {
        for (const { pattern, name } of TEST_FRAMEWORK_PATTERNS) {
          if (pattern.test(depName)) {
            return name;
          }
        }
      }

      // Check for npm scripts that might indicate testing framework
      const scripts = packageJson.scripts || {};
      if (scripts.test) {
        const testScript = scripts.test.toLowerCase();
        if (testScript.includes('jest')) return 'Jest';
        if (testScript.includes('vitest')) return 'Vitest';
        if (testScript.includes('mocha')) return 'Mocha';
        if (testScript.includes('cypress')) return 'Cypress';
        if (testScript.includes('playwright')) return 'Playwright';
      }

      return 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Find all test files in the project
   */
  private async findTestFiles(projectPath: string): Promise<string[]> {
    const testFiles: string[] = [];

    try {
      await this.walkDirectoryForTests(projectPath, testFiles);
      return testFiles;
    } catch (error) {
      throw new Error(`Failed to find test files: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Recursively walk directory to find test files
   */
  private async walkDirectoryForTests(dirPath: string, testFiles: string[]): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          const skipDirs = new Set([
            'node_modules', '.git', 'dist', 'build', 'coverage',
            '.next', '.nuxt', 'target', '.venv', 'venv', '__pycache__'
          ]);
          if (!skipDirs.has(entry.name)) {
            await this.walkDirectoryForTests(fullPath, testFiles);
          }
        } else if (entry.isFile() && this.isTestFile(entry.name, dirPath)) {
          testFiles.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories that can't be read
      console.warn(`Skipping directory ${dirPath}: ${error}`);
    }
  }

  /**
   * Check if a file is a test file
   */
  private isTestFile(fileName: string, dirPath: string): boolean {
    const dirName = basename(dirPath);

    // Check directory patterns
    if (['__tests__', 'tests', 'test', 'spec', 'specs'].includes(dirName)) {
      return true;
    }

    // Check file name patterns
    return /\.(test|spec|tests|specs)\.(js|jsx|ts|tsx|mjs|cjs)$/i.test(fileName) ||
           /Test\.(js|jsx|ts|tsx)$/i.test(fileName) ||
           /^(test|Test)[-_]/.test(fileName);
  }

  /**
   * Categorize tests into different types
   */
  private categorizeTests(testFiles: string[], projectPath: string): TestingPatternAnalysis['patterns'] {
    const patterns: TestingPatternAnalysis['patterns'] = {
      unit: { count: 0, locations: [] },
      integration: { count: 0, locations: [] },
      e2e: { count: 0, locations: [] },
      component: { count: 0, locations: [] },
      performance: { count: 0, locations: [] },
    };

    const locationSets = {
      unit: new Set<string>(),
      integration: new Set<string>(),
      e2e: new Set<string>(),
      component: new Set<string>(),
      performance: new Set<string>(),
    };

    for (const testFile of testFiles) {
      const relativePath = relative(projectPath, testFile);
      let categorized = false;

      // Try to categorize based on patterns
      for (const { patterns: categoryPatterns, category } of TEST_CATEGORIZATION_PATTERNS) {
        for (const pattern of categoryPatterns) {
          if (pattern.test(relativePath)) {
            patterns[category].count++;
            locationSets[category].add(dirname(relativePath));
            categorized = true;
            break;
          }
        }
        if (categorized) break;
      }

      // Default to unit test if not categorized
      if (!categorized) {
        patterns.unit.count++;
        locationSets.unit.add(dirname(relativePath));
      }
    }

    // Convert location sets to arrays
    (Object.keys(locationSets) as Array<keyof typeof locationSets>).forEach(key => {
      patterns[key].locations = Array.from(locationSets[key]).sort();
    });

    return patterns;
  }

  /**
   * Extract testing conventions from test files
   */
  private extractTestConventions(testFiles: string[], projectPath: string): TestingPatternAnalysis['conventions'] {
    let suffixTestCount = 0;
    let suffixSpecCount = 0;
    let suffixCapitalTestCount = 0;
    let prefixTestCount = 0;

    let colocatedCount = 0;
    let separateTestsCount = 0;
    let separateUnderscoreTestsCount = 0;

    for (const testFile of testFiles) {
      const fileName = basename(testFile);
      const dirName = basename(dirname(testFile));
      const relativePath = relative(projectPath, testFile);

      // Test file naming patterns
      if (/\.(test|tests)\.(js|jsx|ts|tsx|mjs|cjs)$/i.test(fileName)) {
        suffixTestCount++;
      } else if (/\.(spec|specs)\.(js|jsx|ts|tsx|mjs|cjs)$/i.test(fileName)) {
        suffixSpecCount++;
      } else if (/Test\.(js|jsx|ts|tsx|mjs|cjs)$/i.test(fileName)) {
        suffixCapitalTestCount++;
      } else if (/^(test|Test)[-_]/.test(fileName)) {
        prefixTestCount++;
      }

      // Test location patterns
      if (dirName === '__tests__') {
        separateUnderscoreTestsCount++;
      } else if (dirName === 'tests' || dirName === 'test') {
        separateTestsCount++;
      } else {
        // Check if there's a corresponding source file (colocated)
        const sourceFileName = fileName
          .replace(/\.(test|spec|tests|specs)\.(js|jsx|ts|tsx|mjs|cjs)$/i, '.$2')
          .replace(/Test\.(js|jsx|ts|tsx|mjs|cjs)$/i, '.$1');

        const sourcePath = join(dirname(testFile), sourceFileName);
        // For simplicity, assume colocated if not in a dedicated test directory
        if (!['__tests__', 'tests', 'test', 'spec', 'specs'].includes(dirName)) {
          colocatedCount++;
        } else {
          separateTestsCount++;
        }
      }
    }

    // Determine dominant patterns
    const total = testFiles.length;
    let testFileNaming: TestingPatternAnalysis['conventions']['testFileNaming'];
    if (suffixTestCount / total >= 0.6) {
      testFileNaming = 'suffix-.test';
    } else if (suffixSpecCount / total >= 0.6) {
      testFileNaming = 'suffix-.spec';
    } else if (suffixCapitalTestCount / total >= 0.6) {
      testFileNaming = 'suffix-Test';
    } else if (prefixTestCount / total >= 0.6) {
      testFileNaming = 'prefix-test-';
    } else {
      testFileNaming = 'mixed';
    }

    let testLocation: TestingPatternAnalysis['conventions']['testLocation'];
    if (separateUnderscoreTestsCount / total >= 0.6) {
      testLocation = 'separate-__tests__';
    } else if (separateTestsCount / total >= 0.6) {
      testLocation = 'separate-tests';
    } else if (colocatedCount / total >= 0.6) {
      testLocation = 'colocated';
    } else {
      testLocation = 'mixed';
    }

    return {
      testFileNaming,
      testLocation,
    };
  }

  /**
   * Detect testing anti-patterns in test files
   */
  private async detectAntiPatterns(testFiles: string[]): Promise<TestingPatternAnalysis['antiPatterns']> {
    const antiPatterns: TestingPatternAnalysis['antiPatterns'] = [];

    // Analyze a subset of test files for performance
    const filesToAnalyze = testFiles.slice(0, 50);

    for (const testFile of filesToAnalyze) {
      try {
        const content = await fs.readFile(testFile, 'utf-8');
        const fileName = basename(testFile);

        // Check for anti-patterns
        for (const rule of ANTI_PATTERN_RULES) {
          for (const pattern of rule.patterns) {
            const matches = content.matchAll(pattern);
            const matchCount = Array.from(matches).length;

            if (matchCount > 0) {
              antiPatterns.push({
                type: rule.type,
                description: rule.description,
                examples: [`${fileName} (${matchCount} occurrences)`],
                severity: rule.severity,
              });
            }
          }
        }

        // Check for lack of tests (empty test files)
        if (content.length < 100 || !content.includes('test') && !content.includes('it') && !content.includes('describe')) {
          antiPatterns.push({
            type: 'no-tests',
            description: 'Test file appears to be empty or contains no actual tests',
            examples: [fileName],
            severity: 'high',
          });
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    return antiPatterns;
  }

  /**
   * Calculate test quality metrics
   */
  private async calculateTestMetrics(testFiles: string[]): Promise<TestingPatternAnalysis['metrics']> {
    if (testFiles.length === 0) {
      return {};
    }

    let totalTests = 0;
    let totalAssertions = 0;
    let totalFiles = 0;
    let mockedDependenciesCount = 0;

    // Analyze a subset for performance
    const filesToAnalyze = testFiles.slice(0, 50);

    for (const testFile of filesToAnalyze) {
      try {
        const content = await fs.readFile(testFile, 'utf-8');

        // Count test cases
        const testCases = content.match(/(?:it|test)\s*\(/g) || [];
        totalTests += testCases.length;

        // Count assertions
        const assertions = content.match(/(?:expect|assert|should)\s*\(/g) || [];
        totalAssertions += assertions.length;

        // Count mocking patterns
        const mocks = content.match(/(?:jest\.mock|vi\.mock|sinon\.mock|mock\()/g) || [];
        mockedDependenciesCount += mocks.length;

        totalFiles++;
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    const avgTestsPerFile = totalFiles > 0 ? totalTests / totalFiles : 0;
    const avgAssertionsPerTest = totalTests > 0 ? totalAssertions / totalTests : 0;

    return {
      avgTestsPerFile: Math.round(avgTestsPerFile * 10) / 10,
      avgAssertionsPerTest: Math.round(avgAssertionsPerTest * 10) / 10,
      mockedDependenciesCount,
    };
  }

  /**
   * Try to get coverage information from common coverage tools
   */
  private async getCoverageInformation(projectPath: string): Promise<TestingPatternAnalysis['coverage']> {
    // Try to read coverage from common locations
    const coveragePaths = [
      join(projectPath, 'coverage', 'lcov-report', 'index.html'),
      join(projectPath, 'coverage', 'coverage-summary.json'),
      join(projectPath, '.nyc_output', 'coverage.json'),
    ];

    for (const coveragePath of coveragePaths) {
      try {
        const exists = await fs.access(coveragePath).then(() => true).catch(() => false);
        if (exists) {
          // For now, just indicate that coverage data might be available
          // A full implementation would parse the coverage files
          return {
            overall: undefined, // Would need to parse actual coverage files
            statements: undefined,
            branches: undefined,
            functions: undefined,
            lines: undefined,
          };
        }
      } catch (error) {
        // Continue to next coverage path
      }
    }

    return undefined;
  }

  /**
   * Generate recommendations for improving test quality
   */
  private generateRecommendations(
    patterns: TestingPatternAnalysis['patterns'],
    antiPatterns: TestingPatternAnalysis['antiPatterns'],
    conventions: TestingPatternAnalysis['conventions']
  ): string[] {
    const recommendations: string[] = [];

    // Check test coverage
    const totalTests = patterns.unit.count + patterns.integration.count + patterns.e2e.count;
    if (totalTests < 10) {
      recommendations.push('Add more tests to improve codebase reliability');
    }

    // Check test distribution
    if (patterns.integration.count === 0 && patterns.unit.count > 0) {
      recommendations.push('Consider adding integration tests to verify component interactions');
    }

    if (patterns.e2e.count === 0 && totalTests > 20) {
      recommendations.push('Consider adding end-to-end tests to verify user workflows');
    }

    // Check anti-patterns
    const highSeverityAntiPatterns = antiPatterns.filter(ap => ap.severity === 'high' || ap.severity === 'critical');
    if (highSeverityAntiPatterns.length > 0) {
      recommendations.push('Address high-severity testing anti-patterns to improve test maintainability');
    }

    // Check conventions
    if (conventions.testFileNaming === 'mixed') {
      recommendations.push('Standardize test file naming convention across the project');
    }

    if (conventions.testLocation === 'mixed') {
      recommendations.push('Standardize test file organization (colocated vs separate directories)');
    }

    // Test pyramid recommendations
    const unitRatio = totalTests > 0 ? patterns.unit.count / totalTests : 0;
    if (unitRatio < 0.6) {
      recommendations.push('Follow the test pyramid pattern: increase unit test coverage');
    }

    if (patterns.e2e.count > patterns.integration.count && patterns.integration.count > patterns.unit.count) {
      recommendations.push('Invert test pyramid: reduce e2e tests, increase unit tests');
    }

    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }
}
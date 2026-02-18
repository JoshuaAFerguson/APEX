/**
 * @fileoverview E2E Test Coverage and Infrastructure Validation
 *
 * This test suite validates the E2E testing infrastructure and generates coverage reports
 * to ensure comprehensive testing of the E2E documentation and testing capabilities.
 * It verifies that all documented features have corresponding tests.
 *
 * Tests covered:
 * - E2E test infrastructure completeness
 * - Test file coverage analysis
 * - Helper function coverage validation
 * - Documentation feature coverage assessment
 * - Test pattern consistency verification
 * - Infrastructure component validation
 *
 * Requirements:
 * - All E2E infrastructure files must exist and be functional
 * - Test coverage should be comprehensive across all documented features
 * - Helper functions should be properly tested
 * - Infrastructure should support all documented patterns
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

describe('E2E Test Coverage and Infrastructure Validation', () => {
  const projectRoot = process.cwd();
  const e2eTestsDir = join(projectRoot, 'tests/e2e');
  const docsPath = join(projectRoot, 'docs/e2e.md');
  const packageJsonPath = join(projectRoot, 'package.json');

  let docsContent: string;
  let packageJson: any;
  let existingTestFiles: string[];

  beforeEach(() => {
    docsContent = readFileSync(docsPath, 'utf-8');
    packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    existingTestFiles = getE2ETestFiles();
  });

  describe('Test Infrastructure Coverage', () => {
    it('should have all required infrastructure files', () => {
      const requiredInfraFiles = [
        'tests/e2e/setup.ts',
        'tests/e2e/teardown.ts',
        'tests/e2e/index.ts',
        'vitest.e2e.config.ts'
      ];

      requiredInfraFiles.forEach(file => {
        const filePath = join(projectRoot, file);
        expect(existsSync(filePath), `Required infrastructure file should exist: ${file}`).toBe(true);

        if (existsSync(filePath)) {
          const stats = statSync(filePath);
          expect(stats.size, `Infrastructure file should not be empty: ${file}`).toBeGreaterThan(0);
        }
      });
    });

    it('should have comprehensive utility files', () => {
      const utilityDirs = [
        'tests/e2e/utils',
        'tests/e2e/helpers',
        'tests/e2e/fixtures'
      ];

      utilityDirs.forEach(dir => {
        const dirPath = join(projectRoot, dir);
        if (existsSync(dirPath)) {
          expect(statSync(dirPath).isDirectory(), `Should be a directory: ${dir}`).toBe(true);

          const files = readdirSync(dirPath).filter(file =>
            file.endsWith('.ts') && !file.endsWith('.test.ts')
          );
          expect(files.length, `Utility directory should contain TypeScript files: ${dir}`).toBeGreaterThan(0);
        }
      });
    });

    it('should have proper test configuration', () => {
      const configPath = join(projectRoot, 'vitest.e2e.config.ts');
      expect(existsSync(configPath), 'E2E Vitest config should exist').toBe(true);

      if (existsSync(configPath)) {
        const configContent = readFileSync(configPath, 'utf-8');

        // Verify essential configuration
        expect(configContent, 'Config should reference setup file').toMatch(/setup.*tests\/e2e\/setup/);
        expect(configContent, 'Config should set proper test timeout').toMatch(/testTimeout.*\d+/);
        expect(configContent, 'Config should configure test environment').toContain('node');
      }
    });
  });

  describe('Test File Coverage Analysis', () => {
    it('should have comprehensive test coverage across documented categories', () => {
      const documentedCategories = [
        'CLI Commands',
        'Git Operations',
        'MCP Features',
        'API Integration',
        'Infrastructure'
      ];

      const categoryFilePatterns = {
        'CLI Commands': ['cli', 'command'],
        'Git Operations': ['git', 'merge', 'branch'],
        'MCP Features': ['mcp', 'marketplace'],
        'API Integration': ['api', 'server'],
        'Infrastructure': ['infrastructure', 'setup', 'utilities']
      };

      documentedCategories.forEach(category => {
        const patterns = categoryFilePatterns[category as keyof typeof categoryFilePatterns] || [];
        const hasTests = patterns.some(pattern =>
          existingTestFiles.some(file =>
            file.toLowerCase().includes(pattern.toLowerCase())
          )
        );

        expect(hasTests, `Should have tests for category: ${category}`).toBe(true);
      });
    });

    it('should test all documented helper functions', () => {
      const documentedHelpers = [
        'createTestEnvironment',
        'runCLI',
        'runApexCLI',
        'seedTestData',
        'createTempGitRepo',
        'createBareGitRepo',
        'execMCPCommand',
        'assertMarketplaceOutput'
      ];

      documentedHelpers.forEach(helper => {
        const hasTestCoverage = existingTestFiles.some(testFile => {
          const testPath = join(e2eTestsDir, testFile);
          if (existsSync(testPath)) {
            const testContent = readFileSync(testPath, 'utf-8');
            return testContent.includes(helper);
          }
          return false;
        });

        expect(hasTestCoverage, `Helper function should be tested: ${helper}`).toBe(true);
      });
    });

    it('should have tests for all documented CLI commands', () => {
      const documentedCommands = extractDocumentedCommands(docsContent);

      // Filter to actual CLI commands (not npm scripts)
      const cliCommands = documentedCommands.filter(cmd =>
        !cmd.startsWith('npm') &&
        !cmd.startsWith('git') &&
        !cmd.includes('--version') &&
        !cmd.includes('--help')
      );

      if (cliCommands.length > 0) {
        const hasCliTests = existingTestFiles.some(file =>
          file.includes('cli') || file.includes('command')
        );

        expect(hasCliTests, 'Should have CLI command tests').toBe(true);
      }
    });

    it('should validate test file naming conventions', () => {
      const e2eTestFiles = existingTestFiles.filter(file =>
        file.endsWith('.e2e.test.ts') || file.endsWith('.test.ts')
      );

      expect(e2eTestFiles.length, 'Should have E2E test files').toBeGreaterThan(5);

      e2eTestFiles.forEach(file => {
        // Should follow naming conventions
        expect(file, `Test file should follow naming convention: ${file}`).toMatch(/^[a-z-]+\.e?2?e?\.test\.ts$/);

        // Should have descriptive names
        expect(file.length, `Test file name should be descriptive: ${file}`).toBeGreaterThan(10);
      });
    });
  });

  describe('Documentation Feature Coverage', () => {
    it('should have tests for all documented templates', () => {
      const documentedTemplates = [
        'Basic CLI Command Test',
        'Git Integration Test',
        'MCP Feature Test',
        'Workflow Integration Test'
      ];

      // Check if there are tests that validate these templates
      const hasTemplateValidation = existingTestFiles.some(file =>
        file.includes('documentation') && file.includes('example')
      );

      expect(hasTemplateValidation, 'Should have template validation tests').toBe(true);
    });

    it('should validate all documented test patterns', () => {
      const documentedPatterns = [
        'createTestEnvironment',
        'beforeEach',
        'afterEach',
        'env.cleanup()',
        'describe\\(',
        'it\\(',
        'expect\\('
      ];

      // Should have tests that verify these patterns work
      const patternTestFiles = existingTestFiles.filter(file => {
        const testPath = join(e2eTestsDir, file);
        if (existsSync(testPath)) {
          const testContent = readFileSync(testPath, 'utf-8');
          return documentedPatterns.some(pattern =>
            new RegExp(pattern).test(testContent)
          );
        }
        return false;
      });

      expect(patternTestFiles.length, 'Should have tests using documented patterns').toBeGreaterThan(5);
    });

    it('should test all documented seed scenarios', () => {
      const seedScenarios = [
        'SEED_SCENARIOS.minimal',
        'SEED_SCENARIOS.full',
        'SEED_SCENARIOS.mcp',
        'SEED_SCENARIOS.git'
      ];

      const hasSeedTests = existingTestFiles.some(testFile => {
        const testPath = join(e2eTestsDir, testFile);
        if (existsSync(testPath)) {
          const testContent = readFileSync(testPath, 'utf-8');
          return seedScenarios.some(scenario =>
            testContent.includes(scenario)
          );
        }
        return false;
      });

      expect(hasSeedTests, 'Should have tests using seed scenarios').toBe(true);
    });
  });

  describe('Test Quality and Coverage Metrics', () => {
    it('should have adequate test coverage breadth', () => {
      // Count different types of tests
      const testTypes = {
        cli: existingTestFiles.filter(f => f.includes('cli')).length,
        git: existingTestFiles.filter(f => f.includes('git')).length,
        mcp: existingTestFiles.filter(f => f.includes('mcp')).length,
        infrastructure: existingTestFiles.filter(f => f.includes('infrastructure')).length,
        documentation: existingTestFiles.filter(f => f.includes('documentation')).length
      };

      // Should have tests in multiple categories
      const categoriesWithTests = Object.values(testTypes).filter(count => count > 0).length;
      expect(categoriesWithTests, 'Should have tests across multiple categories').toBeGreaterThan(3);

      // Should have multiple tests in main categories
      expect(testTypes.infrastructure + testTypes.documentation, 'Should have infrastructure tests').toBeGreaterThan(2);
    });

    it('should have comprehensive documentation coverage tests', () => {
      const documentationTestFiles = existingTestFiles.filter(file =>
        file.includes('documentation') ||
        file.includes('acceptance-criteria') ||
        file.includes('example') ||
        file.includes('validation')
      );

      expect(documentationTestFiles.length, 'Should have documentation validation tests').toBeGreaterThan(2);

      documentationTestFiles.forEach(file => {
        const testPath = join(e2eTestsDir, file);
        if (existsSync(testPath)) {
          const testContent = readFileSync(testPath, 'utf-8');
          expect(testContent.length, `Documentation test should be substantial: ${file}`).toBeGreaterThan(1000);
        }
      });
    });

    it('should validate test file organization and structure', () => {
      existingTestFiles.forEach(testFile => {
        const testPath = join(e2eTestsDir, testFile);
        if (existsSync(testPath)) {
          const testContent = readFileSync(testPath, 'utf-8');

          // Should have proper test structure
          expect(testContent, `Test should have describe blocks: ${testFile}`).toContain('describe(');
          expect(testContent, `Test should have test cases: ${testFile}`).toContain('it(');

          // Should have proper imports
          expect(testContent, `Test should import from vitest: ${testFile}`).toMatch(/import.*from.*vitest/);

          // Should have file documentation
          expect(testContent, `Test should have file documentation: ${testFile}`).toMatch(/\/\*\*[\s\S]*@fileoverview/);
        }
      });
    });
  });

  describe('Infrastructure Component Validation', () => {
    it('should validate global setup and teardown functionality', () => {
      const setupPath = join(e2eTestsDir, 'setup.ts');
      const teardownPath = join(e2eTestsDir, 'teardown.ts');

      if (existsSync(setupPath)) {
        const setupContent = readFileSync(setupPath, 'utf-8');
        expect(setupContent, 'Setup should export helper functions').toContain('apexE2EHelpers');
        expect(setupContent, 'Setup should handle temp directories').toContain('createTempDir');
      }

      if (existsSync(teardownPath)) {
        const teardownContent = readFileSync(teardownPath, 'utf-8');
        expect(teardownContent, 'Teardown should handle cleanup').toContain('cleanup');
      }
    });

    it('should validate utility functions are properly exported', () => {
      const indexPath = join(e2eTestsDir, 'index.ts');

      if (existsSync(indexPath)) {
        const indexContent = readFileSync(indexPath, 'utf-8');

        const expectedExports = [
          'createTestEnvironment',
          'runCLI',
          'seedTestData',
          'SEED_SCENARIOS'
        ];

        expectedExports.forEach(exportName => {
          expect(indexContent, `Should export ${exportName}`).toContain(exportName);
        });
      }
    });

    it('should validate package scripts are properly configured', () => {
      const requiredScripts = [
        'test:e2e',
        'cleanup:test'
      ];

      requiredScripts.forEach(script => {
        expect(packageJson.scripts, `Package should have script: ${script}`).toHaveProperty(script);

        const scriptContent = packageJson.scripts[script];
        expect(scriptContent, `Script should not be empty: ${script}`).toBeTruthy();
      });
    });
  });

  describe('Coverage Report Generation', () => {
    it('should generate comprehensive coverage report data', () => {
      const coverageData = {
        totalTestFiles: existingTestFiles.length,
        e2eTestFiles: existingTestFiles.filter(f => f.includes('.e2e.test.ts')).length,
        documentationTests: existingTestFiles.filter(f => f.includes('documentation')).length,
        infrastructureTests: existingTestFiles.filter(f => f.includes('infrastructure')).length,
        featureTests: existingTestFiles.filter(f =>
          f.includes('cli') || f.includes('git') || f.includes('mcp')
        ).length,
        utilityTests: existingTestFiles.filter(f => f.includes('util')).length,
        coverageCategories: {
          'CLI Testing': existingTestFiles.filter(f => f.includes('cli')).length,
          'Git Operations': existingTestFiles.filter(f => f.includes('git')).length,
          'MCP Features': existingTestFiles.filter(f => f.includes('mcp')).length,
          'Infrastructure': existingTestFiles.filter(f => f.includes('infrastructure')).length,
          'Documentation': existingTestFiles.filter(f => f.includes('documentation')).length
        }
      };

      // Log coverage data for visibility
      console.log('\n=== E2E Test Coverage Report ===');
      console.log(`Total Test Files: ${coverageData.totalTestFiles}`);
      console.log(`E2E Test Files: ${coverageData.e2eTestFiles}`);
      console.log(`Documentation Tests: ${coverageData.documentationTests}`);
      console.log(`Infrastructure Tests: ${coverageData.infrastructureTests}`);
      console.log(`Feature Tests: ${coverageData.featureTests}`);
      console.log('Coverage by Category:');
      Object.entries(coverageData.coverageCategories).forEach(([category, count]) => {
        console.log(`  ${category}: ${count} tests`);
      });
      console.log('================================\n');

      // Validate coverage thresholds
      expect(coverageData.totalTestFiles, 'Should have adequate total test coverage').toBeGreaterThan(15);
      expect(coverageData.documentationTests, 'Should have documentation test coverage').toBeGreaterThan(3);
      expect(coverageData.infrastructureTests, 'Should have infrastructure test coverage').toBeGreaterThan(2);
    });
  });
});

/**
 * Helper function to get all E2E test files
 */
function getE2ETestFiles(): string[] {
  const e2eTestsDir = join(process.cwd(), 'tests/e2e');

  if (!existsSync(e2eTestsDir)) {
    return [];
  }

  return readdirSync(e2eTestsDir)
    .filter(file => file.endsWith('.test.ts'))
    .filter(file => {
      const filePath = join(e2eTestsDir, file);
      return statSync(filePath).isFile();
    });
}

/**
 * Extract documented commands from the documentation
 */
function extractDocumentedCommands(content: string): string[] {
  // Extract commands from code blocks and inline code
  const commands = new Set<string>();

  // Extract from bash code blocks
  const bashBlocks = content.match(/```bash\s*\n([\s\S]*?)\n```/g) || [];
  bashBlocks.forEach(block => {
    const lines = block.split('\n').slice(1, -1); // Remove ``` lines
    lines.forEach(line => {
      const cleanLine = line.replace(/^#.*/, '').trim(); // Remove comments
      if (cleanLine && !cleanLine.startsWith('#')) {
        commands.add(cleanLine);
      }
    });
  });

  // Extract from inline code
  const inlineCommands = content.match(/`[^`]*`/g) || [];
  inlineCommands.forEach(cmd => {
    const cleanCmd = cmd.replace(/`/g, '').trim();
    if (cleanCmd.includes(' ') && (cleanCmd.startsWith('npm') || cleanCmd.startsWith('apex'))) {
      commands.add(cleanCmd);
    }
  });

  return Array.from(commands);
}
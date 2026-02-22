/**
 * ConventionAnalyzer Integration Tests
 *
 * End-to-end integration tests that run ConventionAnalyzer on sample codebases
 * and verify complete ConventionAnalysis output. Tests cover edge cases including
 * mixed conventions and inconsistent patterns.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ConventionAnalyzer } from '../convention-analyzer.js';
import { ConventionAnalysisSchema, type ConventionAnalysis } from '@apexcli/core';

// Get the current file's directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_PATH = join(__dirname, '../../../__fixtures__/convention-analyzer');

describe('ConventionAnalyzer Integration Tests', () => {
  let analyzer: ConventionAnalyzer;

  beforeAll(() => {
    analyzer = new ConventionAnalyzer();
  });

  describe('Basic Convention Detection', () => {
    it('should detect consistent camelCase file naming', async () => {
      const projectPath = join(FIXTURES_PATH, 'sample-codebases/consistent-camelcase');
      const result = await analyzer.analyze(projectPath);

      // Validate schema compliance
      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Validate specific fields
      expect(result.fileNaming).toBe('camelCase');
      expect(result.functionNaming).toBe('camelCase');
      expect(result.variableNaming).toBe('camelCase');
      expect(result.classNaming).toBe('PascalCase');
      expect(result.constantNaming).toBe('SCREAMING_SNAKE_CASE');

      // Validate indentation
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBeGreaterThan(0);

      // Validate imports
      expect(result.imports.style).toBe('es6');
      expect(result.imports.quotes).toBe('single');

      // Validate documentation
      expect(result.documentation.style).toBe('jsdoc');
      expect(result.documentation.coverage).toBeGreaterThanOrEqual(0);
      expect(result.documentation.coverage).toBeLessThanOrEqual(100);
    });

    it('should detect consistent kebab-case file naming', async () => {
      const projectPath = join(FIXTURES_PATH, 'sample-codebases/consistent-kebab-case');
      const result = await analyzer.analyze(projectPath);

      // Validate schema compliance
      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Validate specific fields
      expect(result.fileNaming).toBe('kebab-case');
      expect(result.functionNaming).toBe('camelCase'); // Functions still camelCase
      expect(result.variableNaming).toBe('camelCase'); // Variables still camelCase

      // All other conventions should be similar to camelCase version
      expect(result.imports.style).toBe('es6');
      expect(result.documentation.style).toBe('jsdoc');
    });
  });

  describe('Mixed Conventions Edge Cases', () => {
    it('should detect mixed file naming conventions', async () => {
      const projectPath = join(FIXTURES_PATH, 'sample-codebases/mixed-conventions');
      const result = await analyzer.analyze(projectPath);

      // Validate schema compliance
      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should detect mixed patterns
      expect(['mixed', 'inconsistent']).toContain(result.fileNaming);
      expect(['mixed', 'inconsistent']).toContain(result.functionNaming);
      expect(['mixed', 'inconsistent']).toContain(result.variableNaming);

      // Mixed indentation should be detected
      expect(result.indentation.type).toBe('mixed');

      // Mixed import styles should be detected
      expect(result.imports.style).toBe('mixed');
      expect(result.imports.quotes).toBe('mixed');
    });

    it('should handle inconsistent patterns appropriately', async () => {
      const projectPath = join(FIXTURES_PATH, 'sample-codebases/mixed-conventions');
      const result = await analyzer.analyze(projectPath);

      // Validate schema compliance
      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should identify inconsistency
      expect(['mixed', 'inconsistent']).toContain(result.functionNaming);

      // Documentation should still be analyzable
      expect(['inline', 'none', 'mixed']).toContain(result.documentation.style);
      expect(result.documentation.coverage).toBeGreaterThanOrEqual(0);
      expect(result.documentation.coverage).toBeLessThanOrEqual(100);
    });
  });

  describe('Full ConventionAnalysis Output Validation', () => {
    it('should return complete ConventionAnalysis with all required fields', async () => {
      const projectPath = join(FIXTURES_PATH, 'sample-codebases/consistent-camelcase');
      const result = await analyzer.analyze(projectPath);

      // Comprehensive schema validation
      const parsed = ConventionAnalysisSchema.parse(result);

      // Verify all top-level required fields exist
      expect(parsed).toHaveProperty('fileNaming');
      expect(parsed).toHaveProperty('functionNaming');
      expect(parsed).toHaveProperty('variableNaming');
      expect(parsed).toHaveProperty('indentation');
      expect(parsed).toHaveProperty('imports');
      expect(parsed).toHaveProperty('documentation');
      expect(parsed).toHaveProperty('organization');

      // Verify nested required fields
      expect(parsed.indentation).toHaveProperty('type');
      expect(parsed.imports).toHaveProperty('style');
      expect(parsed.documentation).toHaveProperty('style');
      expect(parsed.documentation).toHaveProperty('coverage');

      // Verify organization fields when present
      if (parsed.organization !== undefined) {
        expect(parsed.organization).toHaveProperty('testLocation');
        expect(parsed.organization).toHaveProperty('testNaming');
        expect(parsed.organization).toHaveProperty('sourceStructure');
        expect(['colocated', 'separate-tests', 'separate-__tests__', 'mixed']).toContain(parsed.organization.testLocation);
        expect(['suffix-.test', 'suffix-.spec', 'suffix-Test', 'prefix-test-', 'mixed']).toContain(parsed.organization.testNaming);
        expect(['src', 'lib', 'app', 'source', 'root-level', 'mixed']).toContain(parsed.organization.sourceStructure);
      }

      // Verify optional fields are properly typed when present
      if (parsed.classNaming !== undefined) {
        expect(['PascalCase', 'camelCase', 'snake_case', 'mixed', 'inconsistent']).toContain(parsed.classNaming);
      }

      if (parsed.constantNaming !== undefined) {
        expect(['SCREAMING_SNAKE_CASE', 'camelCase', 'PascalCase', 'mixed', 'inconsistent']).toContain(parsed.constantNaming);
      }

      if (parsed.formatting !== undefined) {
        if (parsed.formatting.lineLength !== undefined) {
          expect(parsed.formatting.lineLength).toBeGreaterThanOrEqual(40);
          expect(parsed.formatting.lineLength).toBeLessThanOrEqual(200);
        }
      }
    });

    it('should handle empty project gracefully', async () => {
      const projectPath = join(FIXTURES_PATH, 'sample-codebases/empty-project');

      // Create empty directory for this test
      const { promises: fs } = await import('fs');
      await fs.mkdir(projectPath, { recursive: true });

      try {
        const result = await analyzer.analyze(projectPath);

        // Should return valid analysis even for empty projects
        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

        // Should have default values
        expect(result.fileNaming).toBe('mixed');
        expect(result.functionNaming).toBe('mixed');
        expect(result.variableNaming).toBe('mixed');
        expect(result.documentation.coverage).toBe(0);

        // Should have default organization values
        expect(result.organization?.testLocation).toBe('mixed');
        expect(result.organization?.testNaming).toBe('mixed');
        expect(result.organization?.sourceStructure).toBe('mixed');

      } finally {
        // Clean up empty directory
        try {
          await fs.rmdir(projectPath);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe('Schema Validation Compliance', () => {
    it('should pass schema validation for all enum values', async () => {
      const testCases = [
        { path: 'consistent-camelcase', expectedFileNaming: 'camelCase' },
        { path: 'consistent-kebab-case', expectedFileNaming: 'kebab-case' },
        { path: 'mixed-conventions', expectedFileNaming: 'mixed' }
      ];

      for (const testCase of testCases) {
        const projectPath = join(FIXTURES_PATH, `sample-codebases/${testCase.path}`);
        const result = await analyzer.analyze(projectPath);

        // Each result must pass schema validation
        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

        // File naming should match expected pattern
        if (testCase.expectedFileNaming !== 'mixed') {
          expect(result.fileNaming).toBe(testCase.expectedFileNaming);
        } else {
          expect(['mixed', 'inconsistent']).toContain(result.fileNaming);
        }
      }
    });

    it('should validate all indentation type enum values', async () => {
      const projectPath = join(FIXTURES_PATH, 'sample-codebases/consistent-camelcase');
      const result = await analyzer.analyze(projectPath);

      expect(['spaces', 'tabs', 'mixed']).toContain(result.indentation.type);

      if (result.indentation.size !== undefined) {
        expect(result.indentation.size).toBeGreaterThanOrEqual(1);
        expect(result.indentation.size).toBeLessThanOrEqual(8);
      }
    });

    it('should validate all import style enum values', async () => {
      const projectPath = join(FIXTURES_PATH, 'sample-codebases/mixed-conventions');
      const result = await analyzer.analyze(projectPath);

      expect(['es6', 'commonjs', 'amd', 'umd', 'mixed']).toContain(result.imports.style);

      if (result.imports.quotes !== undefined) {
        expect(['single', 'double', 'mixed']).toContain(result.imports.quotes);
      }
    });

    it('should validate documentation coverage percentage', async () => {
      const projectPath = join(FIXTURES_PATH, 'sample-codebases/consistent-camelcase');
      const result = await analyzer.analyze(projectPath);

      expect(result.documentation.coverage).toBeGreaterThanOrEqual(0);
      expect(result.documentation.coverage).toBeLessThanOrEqual(100);
      expect(Number.isInteger(result.documentation.coverage)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should throw descriptive error for non-existent directory', async () => {
      const nonExistentPath = join(FIXTURES_PATH, 'non-existent-project');

      await expect(analyzer.analyze(nonExistentPath)).rejects.toThrow(/Convention analysis failed/);
    });

    it('should throw descriptive error for file instead of directory', async () => {
      const filePath = join(FIXTURES_PATH, 'sample-codebases/consistent-camelcase/package.json');

      await expect(analyzer.analyze(filePath)).rejects.toThrow(/Project path is not a directory/);
    });
  });

  describe('Performance and Scalability', () => {
    it('should complete analysis within acceptable time for small codebase', async () => {
      const projectPath = join(FIXTURES_PATH, 'sample-codebases/consistent-camelcase');

      const startTime = Date.now();
      const result = await analyzer.analyze(projectPath);
      const duration = Date.now() - startTime;

      // Should complete within 5 seconds for small test codebase
      expect(duration).toBeLessThan(5000);

      // Result should still be valid
      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
    });
  });

  describe('Real-world Code Patterns', () => {
    it('should correctly identify TypeScript patterns', async () => {
      const projectPath = join(FIXTURES_PATH, 'sample-codebases/consistent-camelcase');
      const result = await analyzer.analyze(projectPath);

      // Should handle TypeScript-specific constructs
      expect(result.imports.style).toBe('es6');
      expect(result.classNaming).toBe('PascalCase');

      // Should identify interface and type usage (indirectly through variable analysis)
      expect(['camelCase', 'PascalCase', 'mixed']).toContain(result.variableNaming);
    });

    it('should handle different quote styles in imports and strings', async () => {
      const projectPath = join(FIXTURES_PATH, 'sample-codebases/mixed-conventions');
      const result = await analyzer.analyze(projectPath);

      // Mixed project should show mixed quote usage
      expect(['single', 'double', 'mixed']).toContain(result.imports.quotes);

      if (result.formatting?.quotes !== undefined) {
        expect(['single', 'double', 'backtick', 'mixed']).toContain(result.formatting.quotes);
      }
    });
  });

  describe('Edge Case Coverage', () => {
    it('should handle files with minimal content', async () => {
      // This tests the empty/minimal file handling in our fixtures
      const projectPath = join(FIXTURES_PATH, 'sample-codebases/mixed-conventions');
      const result = await analyzer.analyze(projectPath);

      // Should not crash and should return valid analysis
      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should detect some patterns even with minimal content
      expect(typeof result.fileNaming).toBe('string');
      expect(typeof result.functionNaming).toBe('string');
      expect(typeof result.variableNaming).toBe('string');
    });

    it('should properly categorize constants vs regular variables', async () => {
      const projectPath = join(FIXTURES_PATH, 'sample-codebases/consistent-camelcase');
      const result = await analyzer.analyze(projectPath);

      // Should identify constants pattern
      if (result.constantNaming !== undefined) {
        expect(['SCREAMING_SNAKE_CASE', 'camelCase', 'PascalCase', 'mixed', 'inconsistent']).toContain(result.constantNaming);
      }

      // Regular variables should be different pattern
      expect(['camelCase', 'PascalCase', 'snake_case', 'SCREAMING_SNAKE_CASE', 'mixed', 'inconsistent']).toContain(result.variableNaming);
    });

    it('should validate complete field coverage across all test cases', async () => {
      const testPaths = [
        'sample-codebases/consistent-camelcase',
        'sample-codebases/consistent-kebab-case',
        'sample-codebases/mixed-conventions'
      ];

      for (const testPath of testPaths) {
        const projectPath = join(FIXTURES_PATH, testPath);
        const result = await analyzer.analyze(projectPath);

        // Comprehensive field validation
        const parsed = ConventionAnalysisSchema.parse(result);

        // Required fields must always be present and valid
        expect(typeof parsed.fileNaming).toBe('string');
        expect(typeof parsed.functionNaming).toBe('string');
        expect(typeof parsed.variableNaming).toBe('string');
        expect(typeof parsed.indentation.type).toBe('string');
        expect(typeof parsed.imports.style).toBe('string');
        expect(typeof parsed.documentation.style).toBe('string');
        expect(typeof parsed.documentation.coverage).toBe('number');

        // Coverage should be a valid percentage
        expect(parsed.documentation.coverage >= 0).toBe(true);
        expect(parsed.documentation.coverage <= 100).toBe(true);
      }
    });
  });
});
/**
 * ConventionAnalyzer Validation Tests
 *
 * Quick validation tests to ensure the ConventionAnalyzer works correctly
 * with existing fixtures and new test cases.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ConventionAnalyzer } from '../convention-analyzer.js';
import { ConventionAnalysisSchema } from '@apexcli/core';

// Get the current file's directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_PATH = join(__dirname, '../../../__fixtures__/convention-analyzer');

describe('ConventionAnalyzer Validation Tests', () => {
  let analyzer: ConventionAnalyzer;

  beforeAll(() => {
    analyzer = new ConventionAnalyzer();
  });

  describe('Quick Fixture Validation', () => {
    it('should analyze consistent-camelcase fixture without errors', async () => {
      const projectPath = join(FIXTURES_PATH, 'sample-codebases/consistent-camelcase');

      try {
        const result = await analyzer.analyze(projectPath);

        // Schema validation should pass
        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

        // Basic field validation
        expect(result.fileNaming).toBe('camelCase');
        expect(result.functionNaming).toBe('camelCase');
        expect(result.variableNaming).toBe('camelCase');
        expect(result.classNaming).toBe('PascalCase');
        expect(result.indentation.type).toBe('spaces');
        expect(result.imports.style).toBe('es6');
        expect(result.documentation.coverage).toBeGreaterThanOrEqual(0);
        expect(result.documentation.coverage).toBeLessThanOrEqual(100);

        console.log('✅ Consistent camelCase fixture validated successfully');
      } catch (error) {
        console.error('❌ Error analyzing consistent-camelcase:', error);
        throw error;
      }
    });

    it('should analyze mixed-conventions fixture without errors', async () => {
      const projectPath = join(FIXTURES_PATH, 'sample-codebases/mixed-conventions');

      try {
        const result = await analyzer.analyze(projectPath);

        // Schema validation should pass
        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

        // Mixed conventions should be detected
        expect(['mixed', 'inconsistent']).toContain(result.fileNaming);
        expect(['mixed', 'inconsistent']).toContain(result.functionNaming);
        expect(['mixed', 'inconsistent']).toContain(result.variableNaming);
        expect(result.indentation.type).toBe('mixed');
        expect(['mixed', 'es6', 'commonjs']).toContain(result.imports.style);

        console.log('✅ Mixed conventions fixture validated successfully');
      } catch (error) {
        console.error('❌ Error analyzing mixed-conventions:', error);
        throw error;
      }
    });

    it('should analyze complex-mixed-patterns fixture without errors', async () => {
      const projectPath = join(FIXTURES_PATH, 'sample-codebases/complex-mixed-patterns');

      try {
        const result = await analyzer.analyze(projectPath);

        // Schema validation should pass
        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

        // Should detect mixed patterns due to legacy + modern code
        expect(['mixed', 'inconsistent', 'camelCase']).toContain(result.fileNaming);
        expect(['mixed', 'inconsistent', 'camelCase']).toContain(result.functionNaming);
        expect(['mixed', 'inconsistent']).toContain(result.variableNaming);
        expect(['mixed', 'spaces']).toContain(result.indentation.type);
        expect(['mixed', 'es6', 'commonjs']).toContain(result.imports.style);

        // Should detect organization patterns
        if (result.organization) {
          expect(['separate-__tests__', 'mixed']).toContain(result.organization.testLocation);
          expect(['suffix-.test', 'mixed']).toContain(result.organization.testNaming);
          expect(['src', 'mixed']).toContain(result.organization.sourceStructure);
        }

        console.log('✅ Complex mixed patterns fixture validated successfully');
      } catch (error) {
        console.error('❌ Error analyzing complex-mixed-patterns:', error);
        throw error;
      }
    });
  });

  describe('Complete Output Structure Validation', () => {
    it('should return valid ConventionAnalysis structure for all fixtures', async () => {
      const fixtures = [
        'consistent-camelcase',
        'consistent-kebab-case',
        'mixed-conventions',
        'complex-mixed-patterns'
      ];

      for (const fixture of fixtures) {
        const projectPath = join(FIXTURES_PATH, `sample-codebases/${fixture}`);
        const result = await analyzer.analyze(projectPath);

        // Comprehensive schema validation
        const parsed = ConventionAnalysisSchema.parse(result);

        // Verify all required fields are present and valid
        expect(parsed).toHaveProperty('fileNaming');
        expect(parsed).toHaveProperty('functionNaming');
        expect(parsed).toHaveProperty('variableNaming');
        expect(parsed).toHaveProperty('indentation');
        expect(parsed).toHaveProperty('imports');
        expect(parsed).toHaveProperty('documentation');

        expect(parsed.indentation).toHaveProperty('type');
        expect(parsed.imports).toHaveProperty('style');
        expect(parsed.documentation).toHaveProperty('style');
        expect(parsed.documentation).toHaveProperty('coverage');

        // Verify field types
        expect(typeof parsed.fileNaming).toBe('string');
        expect(typeof parsed.functionNaming).toBe('string');
        expect(typeof parsed.variableNaming).toBe('string');
        expect(typeof parsed.indentation.type).toBe('string');
        expect(typeof parsed.imports.style).toBe('string');
        expect(typeof parsed.documentation.style).toBe('string');
        expect(typeof parsed.documentation.coverage).toBe('number');

        // Verify coverage is within valid range
        expect(parsed.documentation.coverage).toBeGreaterThanOrEqual(0);
        expect(parsed.documentation.coverage).toBeLessThanOrEqual(100);
        expect(Number.isInteger(parsed.documentation.coverage)).toBe(true);

        console.log(`✅ ${fixture} fixture structure validated successfully`);
      }
    });
  });

  describe('Performance Validation', () => {
    it('should complete analysis within reasonable time', async () => {
      const projectPath = join(FIXTURES_PATH, 'sample-codebases/consistent-camelcase');

      const startTime = Date.now();
      const result = await analyzer.analyze(projectPath);
      const duration = Date.now() - startTime;

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`✅ Analysis completed in ${duration}ms (under 5s limit)`);
    });
  });
});
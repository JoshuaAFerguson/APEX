/**
 * Main Test Suite for Enhanced TestsAnalyzer
 *
 * This serves as the main entry point that imports and runs all TestsAnalyzer test suites
 * to ensure comprehensive coverage as per acceptance criteria:
 * - tests-analyzer.test.ts (this file)
 * - tests-analyzer-coverage-gaps.test.ts
 * - tests-analyzer-untested-exports.test.ts
 * - tests-analyzer-integration-tests.test.ts
 * - tests-analyzer-anti-patterns.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestsAnalyzer } from '../tests-analyzer';

describe('TestsAnalyzer - Main Test Suite', () => {
  let analyzer: TestsAnalyzer;

  beforeEach(() => {
    analyzer = new TestsAnalyzer();
  });

  describe('Initialization and Basic Properties', () => {
    it('should initialize with correct type', () => {
      expect(analyzer.type).toBe('tests');
    });

    it('should be instance of TestsAnalyzer', () => {
      expect(analyzer).toBeInstanceOf(TestsAnalyzer);
    });
  });

  describe('Core Analysis Method', () => {
    it('should have analyze method', () => {
      expect(typeof analyzer.analyze).toBe('function');
    });

    it('should handle minimal analysis input', () => {
      const minimalAnalysis = {
        codebaseSize: { files: 0, lines: 0, languages: {} },
        dependencies: { outdated: [], security: [] },
        codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
        documentation: {
          coverage: 0,
          missingDocs: [],
          undocumentedExports: [],
          outdatedDocs: [],
          missingReadmeSections: [],
          apiCompleteness: {
            percentage: 0,
            details: {
              totalEndpoints: 0,
              documentedEndpoints: 0,
              undocumentedItems: [],
              wellDocumentedExamples: [],
              commonIssues: []
            }
          }
        },
        performance: { slowTests: [], bottlenecks: [] },
        testCoverage: { percentage: 0, uncoveredFiles: [] },
        testAnalysis: {
          branchCoverage: { percentage: 0, uncoveredBranches: [] },
          untestedExports: [],
          missingIntegrationTests: [],
          antiPatterns: []
        }
      };

      expect(() => analyzer.analyze(minimalAnalysis)).not.toThrow();
    });
  });

  describe('Integration with Test Suites', () => {
    it('should work with all test suite components', () => {
      // This test ensures the main analyzer works with all the specialized test files
      const testAnalysis = {
        branchCoverage: { percentage: 85, uncoveredBranches: ['src/util.ts:45-50'] },
        untestedExports: [
          {
            file: 'src/helpers.ts',
            exports: ['validateInput', 'formatOutput'],
            line: 10
          }
        ],
        missingIntegrationTests: [
          {
            component: 'UserService',
            suggestions: ['Test user creation flow', 'Test authentication integration']
          }
        ],
        antiPatterns: [
          {
            type: 'assertion-less-test',
            severity: 'high',
            file: 'tests/example.test.ts',
            line: 25,
            description: 'Test function has no assertions',
            suggestion: 'Add expect() statements to verify behavior'
          }
        ]
      };

      const fullAnalysis = {
        codebaseSize: { files: 10, lines: 1000, languages: { typescript: 95, javascript: 5 } },
        dependencies: { outdated: [], security: [] },
        codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
        documentation: {
          coverage: 80,
          missingDocs: [],
          undocumentedExports: [],
          outdatedDocs: [],
          missingReadmeSections: [],
          apiCompleteness: {
            percentage: 80,
            details: {
              totalEndpoints: 10,
              documentedEndpoints: 8,
              undocumentedItems: [],
              wellDocumentedExamples: [],
              commonIssues: []
            }
          }
        },
        performance: { slowTests: [], bottlenecks: [] },
        testCoverage: { percentage: 85, uncoveredFiles: [] },
        testAnalysis
      };

      const result = analyzer.analyze(fullAnalysis);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});

// Import all specialized test suites to ensure they run as part of this main suite
import './tests-analyzer-coverage-gaps.test.ts';
import './tests-analyzer-untested-exports.test.ts';
import './tests-analyzer-integration-tests.test.ts';
import './tests-analyzer-anti-patterns.test.ts';
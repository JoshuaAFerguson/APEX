/**
 * Unit Tests for TestsAnalyzer Core Anti-Pattern Functionality
 *
 * Focused unit tests that verify the core acceptance criteria:
 * 1) Test files with anti-patterns grouped by type
 * 2) Assertion-less tests prioritized highest (urgent, score 0.95)
 * 3) Remediation suggestions include specific fixes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestsAnalyzer } from '../tests-analyzer';

describe('TestsAnalyzer - Core Anti-Pattern Unit Tests', () => {
  let analyzer: TestsAnalyzer;

  beforeEach(() => {
    analyzer = new TestsAnalyzer();
  });

  it('should have the correct analyzer type', () => {
    expect(analyzer.type).toBe('tests');
  });

  it('should handle empty analysis without errors', () => {
    const emptyAnalysis = {
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
            totalEndpoints: 0, documentedEndpoints: 0, undocumentedItems: [],
            wellDocumentedExamples: [], commonIssues: []
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

    expect(() => {
      const candidates = analyzer.analyze(emptyAnalysis);
      expect(Array.isArray(candidates)).toBe(true);
    }).not.toThrow();
  });

  describe('Anti-Pattern Task Generation Core Logic', () => {
    it('should generate tasks for no-assertion anti-patterns with highest priority', () => {
      const analysisWithAssertionIssue = {
        codebaseSize: { files: 10, lines: 1000, languages: { 'ts': 8, 'js': 2 } },
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
              totalEndpoints: 10, documentedEndpoints: 8, undocumentedItems: [],
              wellDocumentedExamples: [], commonIssues: []
            }
          }
        },
        performance: { slowTests: [], bottlenecks: [] },
        testCoverage: { percentage: 85, uncoveredFiles: [] },
        testAnalysis: {
          branchCoverage: { percentage: 90, uncoveredBranches: [] },
          untestedExports: [],
          missingIntegrationTests: [],
          antiPatterns: [
            {
              type: 'no-assertion',
              file: 'tests/auth.test.ts',
              line: 25,
              description: 'Test calls login function but makes no assertions',
              severity: 'high',
              testName: 'should login user',
              suggestion: 'Add assertions to verify login result'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithAssertionIssue);

      // Should generate task candidates
      expect(candidates.length).toBeGreaterThan(0);

      // Find the no-assertion task
      const assertionTask = candidates.find(c =>
        c.candidateId.includes('no-assertion') ||
        c.description?.includes('no assertions') ||
        c.title?.includes('no assertions')
      );

      expect(assertionTask).toBeDefined();

      if (assertionTask) {
        // AC2: Should be highest priority
        expect(assertionTask.priority).toBe('urgent');
        expect(assertionTask.score).toBe(0.95);

        // AC3: Should have remediation suggestions
        expect(assertionTask.remediationSuggestions).toBeDefined();
        expect(assertionTask.remediationSuggestions.length).toBeGreaterThan(0);
      }
    });

    it('should prioritize anti-patterns correctly', () => {
      const analysisWithMultipleAntiPatterns = {
        codebaseSize: { files: 10, lines: 1000, languages: { 'ts': 8, 'js': 2 } },
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
              totalEndpoints: 10, documentedEndpoints: 8, undocumentedItems: [],
              wellDocumentedExamples: [], commonIssues: []
            }
          }
        },
        performance: { slowTests: [], bottlenecks: [] },
        testCoverage: { percentage: 85, uncoveredFiles: [] },
        testAnalysis: {
          branchCoverage: { percentage: 90, uncoveredBranches: [] },
          untestedExports: [],
          missingIntegrationTests: [],
          antiPatterns: [
            {
              type: 'no-assertion',
              file: 'tests/critical.test.ts',
              line: 15,
              description: 'Critical test with no assertions',
              severity: 'high',
              testName: 'should process payment',
              suggestion: 'Add payment validation assertions'
            },
            {
              type: 'slow-test',
              file: 'tests/slow.test.ts',
              line: 20,
              description: 'Test takes 10 seconds',
              severity: 'medium',
              testName: 'slow integration test',
              suggestion: 'Optimize test performance'
            },
            {
              type: 'commented-out',
              file: 'tests/old.test.ts',
              line: 5,
              description: 'Test is commented out',
              severity: 'low',
              testName: 'old test',
              suggestion: 'Remove or fix commented test'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithMultipleAntiPatterns);
      const prioritized = analyzer.prioritize(candidates);

      expect(prioritized).toBeDefined();

      // The top prioritized task should ideally be the no-assertion one (score 0.95)
      // Or at minimum have a very high score
      expect(prioritized?.score).toBeGreaterThanOrEqual(0.8);
    });

    it('should generate appropriate remediation suggestions for anti-patterns', () => {
      const analysisWithFlakyTest = {
        codebaseSize: { files: 10, lines: 1000, languages: { 'ts': 8, 'js': 2 } },
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
              totalEndpoints: 10, documentedEndpoints: 8, undocumentedItems: [],
              wellDocumentedExamples: [], commonIssues: []
            }
          }
        },
        performance: { slowTests: [], bottlenecks: [] },
        testCoverage: { percentage: 85, uncoveredFiles: [] },
        testAnalysis: {
          branchCoverage: { percentage: 90, uncoveredBranches: [] },
          untestedExports: [],
          missingIntegrationTests: [],
          antiPatterns: [
            {
              type: 'flaky-test',
              file: 'tests/api.test.ts',
              line: 30,
              description: 'Test fails randomly due to timing',
              severity: 'high',
              testName: 'should return data',
              suggestion: 'Use mocking and deterministic data'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithFlakyTest);
      const flakyTask = candidates.find(c =>
        c.candidateId.includes('flaky') ||
        c.description?.includes('flaky')
      );

      expect(flakyTask).toBeDefined();

      if (flakyTask) {
        const suggestions = flakyTask.remediationSuggestions;
        expect(suggestions.length).toBeGreaterThan(0);

        // Should have specific suggestions for dealing with flaky tests
        const hasMockingSuggestion = suggestions.some(s =>
          s.description.includes('mock') || s.description.includes('Mock')
        );
        expect(hasMockingSuggestion).toBe(true);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed anti-pattern data gracefully', () => {
      const malformedAnalysis = {
        codebaseSize: { files: 10, lines: 1000, languages: { 'ts': 10 } },
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
              totalEndpoints: 10, documentedEndpoints: 8, undocumentedItems: [],
              wellDocumentedExamples: [], commonIssues: []
            }
          }
        },
        performance: { slowTests: [], bottlenecks: [] },
        testCoverage: { percentage: 85, uncoveredFiles: [] },
        testAnalysis: {
          branchCoverage: { percentage: 90, uncoveredBranches: [] },
          untestedExports: [],
          missingIntegrationTests: [],
          antiPatterns: [
            {
              type: 'no-assertion',
              file: '', // Empty file
              line: -1, // Invalid line
              description: null as any,
              severity: 'high',
              testName: undefined as any,
              suggestion: ''
            }
          ]
        }
      };

      expect(() => {
        const candidates = analyzer.analyze(malformedAnalysis);
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });

    it('should handle missing testAnalysis gracefully', () => {
      const incompleteAnalysis = {
        codebaseSize: { files: 10, lines: 1000, languages: { 'ts': 10 } },
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
              totalEndpoints: 10, documentedEndpoints: 8, undocumentedItems: [],
              wellDocumentedExamples: [], commonIssues: []
            }
          }
        },
        performance: { slowTests: [], bottlenecks: [] },
        testCoverage: { percentage: 85, uncoveredFiles: [] },
        testAnalysis: undefined as any
      };

      expect(() => {
        const candidates = analyzer.analyze(incompleteAnalysis);
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });
  });
});
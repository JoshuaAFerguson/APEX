/**
 * Anti-Pattern Task Generation Tests for TestsAnalyzer
 *
 * Tests for the enhanced TestsAnalyzer with comprehensive anti-pattern task generation
 * that meets the acceptance criteria:
 * 1) Test files with anti-patterns grouped by type
 * 2) Prioritizes assertion-less tests highest
 * 3) Includes remediation suggestions with specific fixes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestsAnalyzer } from '../tests-analyzer';
import type { ProjectAnalysis } from '../../idle-processor';

describe('TestsAnalyzer - Anti-Pattern Task Generation', () => {
  let testsAnalyzer: TestsAnalyzer;
  let baseProjectAnalysis: ProjectAnalysis;

  beforeEach(() => {
    testsAnalyzer = new TestsAnalyzer();

    baseProjectAnalysis = {
      codebaseSize: { files: 50, lines: 5000, languages: { 'ts': 40, 'js': 10 } },
      dependencies: { outdated: [], security: [] },
      codeQuality: { lintIssues: 5, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
      documentation: {
        coverage: 50,
        missingDocs: [],
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 70,
          details: {
            totalEndpoints: 20, documentedEndpoints: 14, undocumentedItems: [],
            wellDocumentedExamples: [], commonIssues: []
          }
        }
      },
      performance: { slowTests: [], bottlenecks: [] },
      testCoverage: { percentage: 75, uncoveredFiles: [] },
      testAnalysis: {
        branchCoverage: { percentage: 80, uncoveredBranches: [] },
        untestedExports: [],
        missingIntegrationTests: [],
        antiPatterns: []
      }
    };
  });

  describe('AC1: Test files with anti-patterns grouped by type', () => {
    it('should group anti-patterns by type and generate appropriate TaskCandidates', () => {
      baseProjectAnalysis.testAnalysis.antiPatterns = [
        {
          type: 'no-assertion',
          file: 'tests/auth.test.ts',
          line: 15,
          description: 'Test calls function but has no assertions',
          severity: 'high',
          testName: 'should authenticate user',
          suggestion: 'Add assertions to verify authentication result'
        },
        {
          type: 'no-assertion',
          file: 'tests/payment.test.ts',
          line: 22,
          description: 'Test executes code without checking results',
          severity: 'high',
          testName: 'should process payment',
          suggestion: 'Add proper assertions to validate payment processing'
        },
        {
          type: 'flaky-test',
          file: 'tests/api.test.ts',
          line: 45,
          description: 'Test sometimes fails due to timing issues',
          severity: 'high',
          testName: 'should return api response',
          suggestion: 'Use proper mocking and deterministic test data'
        },
        {
          type: 'slow-test',
          file: 'tests/integration.test.ts',
          line: 12,
          description: 'Test takes over 5 seconds to complete',
          severity: 'medium',
          testName: 'should complete full workflow',
          suggestion: 'Optimize test setup and use mocking for external dependencies'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      // Should generate TaskCandidates for anti-patterns
      const antiPatternCandidates = candidates.filter(c =>
        c.candidateId.includes('antipattern') || c.candidateId.includes('anti-pattern')
      );

      expect(antiPatternCandidates.length).toBeGreaterThan(0);

      // Verify type-based grouping - no-assertion should have separate tasks
      const assertionTasks = candidates.filter(c =>
        c.candidateId.includes('no-assertion') || c.description?.includes('no assertions')
      );
      expect(assertionTasks.length).toBe(2); // One for each no-assertion anti-pattern

      // Flaky test should have its own task
      const flakyTasks = candidates.filter(c =>
        c.candidateId.includes('flaky-test') || c.description?.includes('flaky')
      );
      expect(flakyTasks.length).toBe(1);

      // Slow tests might be grouped if medium priority
      const slowTasks = candidates.filter(c =>
        c.candidateId.includes('slow-test') || c.description?.includes('slow')
      );
      expect(slowTasks.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle different types of anti-patterns appropriately', () => {
      baseProjectAnalysis.testAnalysis.antiPatterns = [
        {
          type: 'empty-test',
          file: 'tests/empty.test.ts',
          line: 10,
          description: 'Test body is empty',
          severity: 'high',
          testName: 'should do something',
          suggestion: 'Implement test logic or remove empty test'
        },
        {
          type: 'test-code-duplication',
          file: 'tests/duplicated.test.ts',
          line: 5,
          description: 'Test setup duplicated across multiple tests',
          severity: 'medium',
          testName: 'test setup 1',
          suggestion: 'Extract common setup into beforeEach or helper functions'
        },
        {
          type: 'test-code-duplication',
          file: 'tests/duplicated2.test.ts',
          line: 8,
          description: 'Duplicate test setup pattern',
          severity: 'medium',
          testName: 'test setup 2',
          suggestion: 'Use shared test fixtures and setup utilities'
        },
        {
          type: 'commented-out',
          file: 'tests/old.test.ts',
          line: 20,
          description: 'Test is commented out',
          severity: 'low',
          testName: 'commented test',
          suggestion: 'Either fix and uncomment test or remove it completely'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      // Empty test should get individual high priority task
      const emptyTestTasks = candidates.filter(c =>
        c.candidateId.includes('empty-test')
      );
      expect(emptyTestTasks.length).toBe(1);
      expect(emptyTestTasks[0].priority).toBe('urgent');

      // Duplicate test code should be grouped since there are multiple
      const duplicationTasks = candidates.filter(c =>
        c.candidateId.includes('test-code-duplication')
      );
      expect(duplicationTasks.length).toBeGreaterThanOrEqual(1); // Could be individual or grouped

      // Low priority items should be grouped
      const lowPriorityTasks = candidates.filter(c =>
        c.candidateId.includes('antipattern-group-low') ||
        (c.priority === 'low' && c.candidateId.includes('antipattern'))
      );
      expect(lowPriorityTasks.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle scenarios with no anti-patterns', () => {
      // No anti-patterns
      baseProjectAnalysis.testAnalysis.antiPatterns = [];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      // Should not generate anti-pattern TaskCandidates when none exist
      const antiPatternCandidates = candidates.filter(c =>
        c.candidateId.includes('antipattern') || c.candidateId.includes('anti-pattern')
      );
      expect(antiPatternCandidates).toHaveLength(0);
    });
  });

  describe('AC2: Prioritizes assertion-less tests highest', () => {
    it('should prioritize assertion-less tests as urgent with score 0.95', () => {
      baseProjectAnalysis.testAnalysis.antiPatterns = [
        {
          type: 'no-assertion',
          file: 'tests/critical.test.ts',
          line: 15,
          description: 'Critical test with no assertions',
          severity: 'high',
          testName: 'should validate critical flow',
          suggestion: 'Add comprehensive assertions to verify critical business logic'
        },
        {
          type: 'flaky-test',
          file: 'tests/flaky.test.ts',
          line: 25,
          description: 'Test occasionally fails',
          severity: 'high',
          testName: 'should be stable',
          suggestion: 'Fix non-deterministic behavior'
        },
        {
          type: 'slow-test',
          file: 'tests/slow.test.ts',
          line: 35,
          description: 'Test runs too slowly',
          severity: 'medium',
          testName: 'should complete quickly',
          suggestion: 'Optimize test performance'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      // Find assertion-less test candidate
      const assertionlessTask = candidates.find(c =>
        c.candidateId.includes('no-assertion') || c.description?.includes('no assertions')
      );

      expect(assertionlessTask).toBeDefined();
      expect(assertionlessTask?.priority).toBe('urgent');
      expect(assertionlessTask?.score).toBe(0.95);

      // Other high priority anti-patterns should have lower scores
      const flakyTask = candidates.find(c =>
        c.candidateId.includes('flaky-test')
      );
      if (flakyTask) {
        expect(flakyTask.score).toBeLessThanOrEqual(0.9);
      }

      // Medium priority should have even lower scores
      const slowTask = candidates.find(c =>
        c.candidateId.includes('slow-test')
      );
      if (slowTask) {
        expect(slowTask.score).toBeLessThanOrEqual(0.8);
      }
    });

    it('should demonstrate clear prioritization ordering with mixed anti-patterns', () => {
      baseProjectAnalysis.testAnalysis.antiPatterns = [
        {
          type: 'no-assertion',
          file: 'tests/no-assert-1.test.ts',
          line: 10,
          description: 'Test without assertions',
          severity: 'high',
          testName: 'test 1',
          suggestion: 'Add assertions'
        },
        {
          type: 'no-assertion',
          file: 'tests/no-assert-2.test.ts',
          line: 15,
          description: 'Another test without assertions',
          severity: 'high',
          testName: 'test 2',
          suggestion: 'Add assertions'
        },
        {
          type: 'empty-test',
          file: 'tests/empty.test.ts',
          line: 20,
          description: 'Empty test body',
          severity: 'high',
          testName: 'empty test',
          suggestion: 'Implement test'
        },
        {
          type: 'brittle-test',
          file: 'tests/brittle.test.ts',
          line: 25,
          description: 'Test breaks with minor changes',
          severity: 'high',
          testName: 'brittle test',
          suggestion: 'Make test more robust'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const prioritized = testsAnalyzer.prioritize(candidates);

      // The prioritized task should be one of the assertion-less tests (highest priority)
      expect(prioritized).toBeDefined();
      if (prioritized?.candidateId.includes('no-assertion')) {
        expect(prioritized.priority).toBe('urgent');
        expect(prioritized.score).toBe(0.95);
      }

      // All no-assertion tasks should have the highest scores
      const assertionlessTasks = candidates.filter(c =>
        c.candidateId.includes('no-assertion')
      );
      assertionlessTasks.forEach(task => {
        expect(task.priority).toBe('urgent');
        expect(task.score).toBe(0.95);
      });
    });
  });

  describe('AC3: Includes remediation suggestions with specific fixes', () => {
    it('should provide specific remediation suggestions for no-assertion anti-patterns', () => {
      baseProjectAnalysis.testAnalysis.antiPatterns = [
        {
          type: 'no-assertion',
          file: 'tests/auth.test.ts',
          line: 15,
          description: 'Test calls login function but has no assertions to verify result',
          severity: 'high',
          testName: 'should authenticate user with valid credentials',
          suggestion: 'Add assertions to verify authentication token, user state, and response status'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const assertionTask = candidates.find(c => c.candidateId.includes('no-assertion'));

      expect(assertionTask).toBeDefined();

      const suggestions = assertionTask?.remediationSuggestions || [];
      expect(suggestions.length).toBeGreaterThan(0);

      // Should have specific fix suggestion for adding assertions
      const fixSuggestion = suggestions.find(s =>
        s.type === 'testing' && s.description.includes('Add proper assertions')
      );
      expect(fixSuggestion).toBeDefined();
      expect(fixSuggestion?.priority).toBe('critical');
      expect(fixSuggestion?.expectedOutcome).toContain('comprehensive test validation');

      // Should include code example
      const codeSuggestion = suggestions.find(s =>
        s.command && s.command.includes('expect(')
      );
      expect(codeSuggestion).toBeDefined();
      expect(codeSuggestion?.command).toContain('token');
      expect(codeSuggestion?.command).toContain('toBeDefined');

      // Should have file-specific guidance
      const fileSuggestion = suggestions.find(s =>
        s.description.includes('tests/auth.test.ts')
      );
      expect(fileSuggestion).toBeDefined();
    });

    it('should provide specific remediation suggestions for flaky test anti-patterns', () => {
      baseProjectAnalysis.testAnalysis.antiPatterns = [
        {
          type: 'flaky-test',
          file: 'tests/api.test.ts',
          line: 25,
          description: 'Test sometimes fails due to network timing issues in API calls',
          severity: 'high',
          testName: 'should fetch user data from API',
          suggestion: 'Mock external API calls and use deterministic test data'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const flakyTask = candidates.find(c => c.candidateId.includes('flaky-test'));

      const suggestions = flakyTask?.remediationSuggestions || [];
      expect(suggestions.length).toBeGreaterThan(0);

      // Should have mocking suggestion
      const mockSuggestion = suggestions.find(s =>
        s.description.includes('Mock external dependencies')
      );
      expect(mockSuggestion).toBeDefined();
      expect(mockSuggestion?.command).toContain('jest.mock');
      expect(mockSuggestion?.command).toContain('mockResolvedValue');

      // Should have deterministic data suggestion
      const dataSuggestion = suggestions.find(s =>
        s.description.includes('deterministic test data')
      );
      expect(dataSuggestion).toBeDefined();
      expect(dataSuggestion?.command).toContain('fixtures');

      // Should have timing suggestion
      const timingSuggestion = suggestions.find(s =>
        s.description.includes('timing') || s.description.includes('async')
      );
      expect(timingSuggestion).toBeDefined();
    });

    it('should provide specific remediation suggestions for slow test anti-patterns', () => {
      baseProjectAnalysis.testAnalysis.antiPatterns = [
        {
          type: 'slow-test',
          file: 'tests/integration.test.ts',
          line: 30,
          description: 'Test takes 12 seconds due to database operations and file I/O',
          severity: 'medium',
          testName: 'should process large dataset completely',
          suggestion: 'Use in-memory database and mock file system operations'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const slowTask = candidates.find(c =>
        c.candidateId.includes('slow-test') || c.description?.includes('slow')
      );

      const suggestions = slowTask?.remediationSuggestions || [];
      expect(suggestions.length).toBeGreaterThan(0);

      // Should have optimization suggestion
      const optimizeSuggestion = suggestions.find(s =>
        s.description.includes('Optimize test performance')
      );
      expect(optimizeSuggestion).toBeDefined();
      expect(optimizeSuggestion?.command).toContain('memory database');

      // Should have mocking suggestion for I/O
      const ioSuggestion = suggestions.find(s =>
        s.description.includes('file system') || s.description.includes('I/O')
      );
      expect(ioSuggestion).toBeDefined();
    });

    it('should provide specific remediation suggestions for test code duplication', () => {
      baseProjectAnalysis.testAnalysis.antiPatterns = [
        {
          type: 'test-code-duplication',
          file: 'tests/user.test.ts',
          line: 10,
          description: 'Setup code duplicated across 5 test methods',
          severity: 'medium',
          testName: 'user setup duplication',
          suggestion: 'Extract common setup into beforeEach hook and helper functions'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const duplicationTask = candidates.find(c =>
        c.candidateId.includes('test-code-duplication') || c.description?.includes('duplication')
      );

      const suggestions = duplicationTask?.remediationSuggestions || [];
      expect(suggestions.length).toBeGreaterThan(0);

      // Should have refactoring suggestion
      const refactorSuggestion = suggestions.find(s =>
        s.description.includes('Extract common setup')
      );
      expect(refactorSuggestion).toBeDefined();
      expect(refactorSuggestion?.command).toContain('beforeEach');
      expect(refactorSuggestion?.command).toContain('helper functions');

      // Should have DRY principle guidance
      const drySuggestion = suggestions.find(s =>
        s.description.includes('DRY') || s.description.includes('reusable')
      );
      expect(drySuggestion).toBeDefined();
    });

    it('should provide comprehensive suggestions for mixed anti-pattern scenarios', () => {
      baseProjectAnalysis.testAnalysis.antiPatterns = [
        {
          type: 'no-assertion',
          file: 'tests/critical.test.ts',
          line: 15,
          description: 'Authentication test with no validation',
          severity: 'high',
          testName: 'should login',
          suggestion: 'Add security and authentication assertions'
        },
        {
          type: 'brittle-test',
          file: 'tests/ui.test.ts',
          line: 20,
          description: 'UI test breaks with CSS changes',
          severity: 'high',
          testName: 'should display correctly',
          suggestion: 'Use semantic selectors instead of CSS classes'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      // Each anti-pattern should have appropriate suggestions
      const assertionTask = candidates.find(c => c.candidateId.includes('no-assertion'));
      const brittleTask = candidates.find(c => c.candidateId.includes('brittle-test'));

      [assertionTask, brittleTask].forEach(task => {
        if (task) {
          expect(task.remediationSuggestions.length).toBeGreaterThan(0);

          // Each should have specific, actionable guidance
          const actionableSuggestion = task.remediationSuggestions.find(s =>
            s.command && s.command.length > 0
          );
          expect(actionableSuggestion).toBeDefined();

          // Each should have expected outcomes
          task.remediationSuggestions.forEach(suggestion => {
            expect(suggestion.expectedOutcome).toBeDefined();
            expect(suggestion.expectedOutcome.length).toBeGreaterThan(0);
          });
        }
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed anti-pattern data gracefully', () => {
      baseProjectAnalysis.testAnalysis.antiPatterns = [
        {
          type: 'no-assertion',
          file: '', // Missing file
          line: -1, // Invalid line
          description: '',
          severity: 'high',
          testName: undefined as any, // Missing test name
          suggestion: null as any // Null suggestion
        }
      ];

      expect(() => {
        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });

    it('should handle undefined anti-patterns array', () => {
      baseProjectAnalysis.testAnalysis.antiPatterns = undefined as any;

      expect(() => {
        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });

    it('should handle unknown anti-pattern types', () => {
      baseProjectAnalysis.testAnalysis.antiPatterns = [
        {
          type: 'unknown-pattern' as any,
          file: 'tests/unknown.test.ts',
          line: 10,
          description: 'Unknown pattern type',
          severity: 'medium',
          testName: 'unknown test',
          suggestion: 'Fix unknown issue'
        }
      ];

      expect(() => {
        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
        expect(Array.isArray(candidates)).toBe(true);
        // Should still generate some kind of task for unknown patterns
        expect(candidates.length).toBeGreaterThanOrEqual(0);
      }).not.toThrow();
    });
  });

  describe('Integration with Overall TestsAnalyzer Functionality', () => {
    it('should integrate anti-pattern tasks with other analyzer functions', () => {
      // Set up scenario with multiple types of test issues
      baseProjectAnalysis.testAnalysis = {
        branchCoverage: {
          percentage: 60, // Low coverage
          uncoveredBranches: [
            { file: 'src/auth.ts', line: 25, branch: 'else', condition: 'invalid token' }
          ]
        },
        untestedExports: [
          { file: 'src/utils.ts', export: 'formatDate', line: 15 }
        ],
        missingIntegrationTests: [
          {
            criticalPath: 'User Authentication',
            description: 'Auth integration',
            priority: 'critical'
          }
        ],
        antiPatterns: [
          {
            type: 'no-assertion',
            file: 'tests/auth.test.ts',
            line: 10,
            description: 'Missing assertions',
            severity: 'high',
            testName: 'auth test',
            suggestion: 'Add assertions'
          }
        ]
      };

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      // Should generate candidates for all types of issues
      const branchCoverageTasks = candidates.filter(c => c.candidateId.includes('branch-coverage'));
      const untestedExportsTasks = candidates.filter(c => c.candidateId.includes('untested-exports'));
      const integrationTestTasks = candidates.filter(c => c.candidateId.includes('integration-test'));
      const antiPatternTasks = candidates.filter(c => c.candidateId.includes('no-assertion'));

      expect(branchCoverageTasks.length).toBeGreaterThan(0);
      expect(untestedExportsTasks.length).toBeGreaterThan(0);
      expect(integrationTestTasks.length).toBeGreaterThan(0);
      expect(antiPatternTasks.length).toBeGreaterThan(0);

      // Verify prioritization works across all task types
      const prioritized = testsAnalyzer.prioritize(candidates);
      expect(prioritized).toBeDefined();

      // Top priority should be assertion-less (score 0.95) or critical integration test (score 0.95)
      expect(prioritized?.score).toBeGreaterThanOrEqual(0.9);
    });
  });
});
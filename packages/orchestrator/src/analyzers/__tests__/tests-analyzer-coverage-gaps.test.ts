/**
 * Tests Analyzer - Branch Coverage Gaps Tests
 *
 * Comprehensive tests for branch coverage gap analysis functionality.
 * Tests the TestsAnalyzer's ability to identify, prioritize, and create
 * remediation suggestions for branch coverage gaps.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestsAnalyzer } from '../tests-analyzer';
import type { ProjectAnalysis } from '../../idle-processor';

describe('TestsAnalyzer - Branch Coverage Gaps', () => {
  let analyzer: TestsAnalyzer;
  let baseAnalysis: ProjectAnalysis;

  beforeEach(() => {
    analyzer = new TestsAnalyzer();
    baseAnalysis = {
      codebaseSize: {
        files: 25,
        lines: 3000,
        languages: { 'ts': 20, 'js': 5 }
      },
      dependencies: {
        outdated: [],
        security: []
      },
      codeQuality: {
        lintIssues: 2,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: {
        coverage: 60,
        missingDocs: [],
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 70,
          details: {
            totalEndpoints: 10,
            documentedEndpoints: 7,
            undocumentedItems: [],
            wellDocumentedExamples: [],
            commonIssues: []
          }
        }
      },
      performance: {
        slowTests: [],
        bottlenecks: []
      },
      testCoverage: {
        percentage: 80,
        uncoveredFiles: []
      },
      testAnalysis: {
        branchCoverage: {
          percentage: 75,
          uncoveredBranches: []
        },
        untestedExports: [],
        missingIntegrationTests: [],
        antiPatterns: []
      }
    };
  });

  describe('branch coverage threshold detection', () => {
    it('should create tasks when coverage is below 70% threshold', () => {
      baseAnalysis.testAnalysis.branchCoverage = {
        percentage: 65,
        uncoveredBranches: [
          {
            file: 'src/core/service.ts',
            line: 25,
            type: 'if',
            description: 'Error handling branch not covered'
          }
        ]
      };

      const candidates = analyzer.analyze(baseAnalysis);

      const branchTasks = candidates.filter(c =>
        c.candidateId.includes('branch-coverage')
      );

      expect(branchTasks.length).toBeGreaterThan(0);

      const serviceTask = branchTasks.find(t =>
        t.candidateId.includes('service')
      );
      expect(serviceTask).toBeDefined();
      expect(serviceTask?.description).toContain('1 uncovered branch');
    });

    it('should not create tasks when coverage is above 70% threshold', () => {
      baseAnalysis.testAnalysis.branchCoverage = {
        percentage: 85,
        uncoveredBranches: []
      };

      const candidates = analyzer.analyze(baseAnalysis);

      const branchTasks = candidates.filter(c =>
        c.candidateId.includes('branch-coverage')
      );

      expect(branchTasks.length).toBe(0);
    });

    it('should create overall coverage task when below 40%', () => {
      baseAnalysis.testAnalysis.branchCoverage = {
        percentage: 35,
        uncoveredBranches: [
          {
            file: 'src/test.ts',
            line: 10,
            type: 'if',
            description: 'Test branch'
          }
        ]
      };

      const candidates = analyzer.analyze(baseAnalysis);

      const overallTask = candidates.find(c =>
        c.candidateId === 'tests-overall-branch-coverage'
      );
      expect(overallTask).toBeDefined();
      expect(overallTask?.title).toBe('Improve Overall Branch Coverage');
      expect(overallTask?.priority).toBe('high');
      expect(overallTask?.score).toBe(0.85);
      expect(overallTask?.description).toContain('from 35.0% to at least 60%');
    });
  });

  describe('critical file prioritization', () => {
    it('should prioritize critical files (service, controller, api, core)', () => {
      baseAnalysis.testAnalysis.branchCoverage = {
        percentage: 60,
        uncoveredBranches: [
          {
            file: 'src/core/auth-service.ts',
            line: 25,
            type: 'if',
            description: 'Authentication error handling'
          },
          {
            file: 'src/api/user-controller.ts',
            line: 45,
            type: 'catch',
            description: 'Database connection error'
          },
          {
            file: 'src/utils/helper.ts',
            line: 15,
            type: 'else',
            description: 'Utility fallback'
          },
          {
            file: 'src/middleware/validation.ts',
            line: 35,
            type: 'switch',
            description: 'Validation rules'
          }
        ]
      };

      const candidates = analyzer.analyze(baseAnalysis);

      const criticalTasks = candidates.filter(c =>
        c.candidateId.includes('branch-coverage') &&
        c.priority === 'urgent'
      );
      const normalTasks = candidates.filter(c =>
        c.candidateId.includes('branch-coverage') &&
        c.priority === 'normal'
      );

      expect(criticalTasks.length).toBe(3); // service, controller, middleware
      expect(normalTasks.length).toBe(1); // utils helper

      criticalTasks.forEach(task => {
        expect(task.score).toBe(0.9);
        expect(task.estimatedEffort).toBe('medium');
      });

      normalTasks.forEach(task => {
        expect(task.score).toBe(0.6);
      });
    });

    it('should identify API files correctly', () => {
      baseAnalysis.testAnalysis.branchCoverage = {
        percentage: 60,
        uncoveredBranches: [
          {
            file: 'src/api/endpoints/users.ts',
            line: 25,
            type: 'if',
            description: 'User validation branch'
          },
          {
            file: 'src/controllers/auth-controller.ts',
            line: 45,
            type: 'catch',
            description: 'Auth error handling'
          }
        ]
      };

      const candidates = analyzer.analyze(baseAnalysis);

      const apiTasks = candidates.filter(c =>
        c.candidateId.includes('branch-coverage') &&
        c.priority === 'urgent'
      );

      expect(apiTasks.length).toBe(2);

      const userApiTask = apiTasks.find(t =>
        t.candidateId.includes('users')
      );
      expect(userApiTask).toBeDefined();
      expect(userApiTask?.description).toContain('User validation branch');
    });
  });

  describe('uncovered branch grouping', () => {
    it('should group branches by file for better organization', () => {
      baseAnalysis.testAnalysis.branchCoverage = {
        percentage: 60,
        uncoveredBranches: [
          {
            file: 'src/utils/parser.ts',
            line: 10,
            type: 'if',
            description: 'Parse error handling'
          },
          {
            file: 'src/utils/parser.ts',
            line: 25,
            type: 'else',
            description: 'Default parsing'
          },
          {
            file: 'src/utils/parser.ts',
            line: 40,
            type: 'catch',
            description: 'Exception handling'
          }
        ]
      };

      const candidates = analyzer.analyze(baseAnalysis);

      const parserTask = candidates.find(c =>
        c.candidateId.includes('parser')
      );

      expect(parserTask).toBeDefined();
      expect(parserTask?.title).toBe('Add Branch Coverage: parser.ts');
      expect(parserTask?.description).toContain('3 uncovered branches');
      expect(parserTask?.description).toContain('Parse error handling');
      expect(parserTask?.description).toContain('Default parsing');
      expect(parserTask?.description).toContain('Exception handling');
    });

    it('should group many non-critical files into single task', () => {
      const manyBranches = Array.from({ length: 10 }, (_, i) => ({
        file: `src/utils/file${i}.ts`,
        line: 10 + i,
        type: 'if' as const,
        description: `Branch ${i + 1} description`
      }));

      baseAnalysis.testAnalysis.branchCoverage = {
        percentage: 60,
        uncoveredBranches: manyBranches
      };

      const candidates = analyzer.analyze(baseAnalysis);

      const groupedTask = candidates.find(c =>
        c.candidateId === 'tests-branch-coverage-group'
      );

      expect(groupedTask).toBeDefined();
      expect(groupedTask?.title).toBe('Add Branch Coverage for 10 Files');
      expect(groupedTask?.description).toContain('10 uncovered branches across 10 files');
      expect(groupedTask?.description).toContain('file0.ts, file1.ts, file2.ts...');
      expect(groupedTask?.estimatedEffort).toBe('medium');
      expect(groupedTask?.priority).toBe('normal');
    });

    it('should handle individual files when few non-critical files', () => {
      baseAnalysis.testAnalysis.branchCoverage = {
        percentage: 60,
        uncoveredBranches: [
          {
            file: 'src/utils/helper1.ts',
            line: 10,
            type: 'if',
            description: 'Helper 1 branch'
          },
          {
            file: 'src/utils/helper2.ts',
            line: 20,
            type: 'else',
            description: 'Helper 2 branch'
          }
        ]
      };

      const candidates = analyzer.analyze(baseAnalysis);

      const individualTasks = candidates.filter(c =>
        c.candidateId.includes('branch-coverage') &&
        c.candidateId.includes('helper')
      );

      expect(individualTasks.length).toBe(2);

      const helper1Task = individualTasks.find(t =>
        t.candidateId.includes('helper1')
      );
      const helper2Task = individualTasks.find(t =>
        t.candidateId.includes('helper2')
      );

      expect(helper1Task).toBeDefined();
      expect(helper2Task).toBeDefined();

      expect(helper1Task?.priority).toBe('normal');
      expect(helper2Task?.priority).toBe('normal');
    });
  });

  describe('branch coverage remediation suggestions', () => {
    it('should include comprehensive remediation for individual files', () => {
      baseAnalysis.testAnalysis.branchCoverage = {
        percentage: 60,
        uncoveredBranches: [
          {
            file: 'src/core/service.ts',
            line: 25,
            type: 'if',
            description: 'Error handling branch'
          },
          {
            file: 'src/core/service.ts',
            line: 35,
            type: 'catch',
            description: 'Exception handling'
          }
        ]
      };

      const candidates = analyzer.analyze(baseAnalysis);

      const serviceTask = candidates.find(c =>
        c.candidateId.includes('service')
      );
      const suggestions = serviceTask?.remediationSuggestions || [];

      expect(suggestions.length).toBeGreaterThan(0);

      // Should have testing suggestion
      const testingSuggestion = suggestions.find(s =>
        s.type === 'testing'
      );
      expect(testingSuggestion).toBeDefined();
      expect(testingSuggestion?.description).toContain('Create tests for uncovered branches');
      expect(testingSuggestion?.priority).toBe('urgent');

      // Should have coverage analysis suggestion
      const coverageSuggestion = suggestions.find(s =>
        s.command === 'npm run test -- --coverage'
      );
      expect(coverageSuggestion).toBeDefined();
      expect(coverageSuggestion?.expectedOutcome).toContain('improved branch coverage');

      // Should have branch analysis suggestion
      const branchSuggestion = suggestions.find(s =>
        s.type === 'manual_review' &&
        s.description.includes('analyze each uncovered branch')
      );
      expect(branchSuggestion).toBeDefined();
    });

    it('should include overall coverage remediation for very low coverage', () => {
      baseAnalysis.testAnalysis.branchCoverage = {
        percentage: 35,
        uncoveredBranches: []
      };

      const candidates = analyzer.analyze(baseAnalysis);

      const overallTask = candidates.find(c =>
        c.candidateId === 'tests-overall-branch-coverage'
      );
      const suggestions = overallTask?.remediationSuggestions || [];

      // Should have systematic coverage improvement suggestions
      const systematicSuggestion = suggestions.find(s =>
        s.description.includes('systematic approach to increase branch coverage')
      );
      expect(systematicSuggestion).toBeDefined();

      // Should have coverage tooling suggestion
      const toolingSuggestion = suggestions.find(s =>
        s.description.includes('coverage reporting tools')
      );
      expect(toolingSuggestion).toBeDefined();

      // Should have test generation suggestion
      const generationSuggestion = suggestions.find(s =>
        s.description.includes('automated test generation tools')
      );
      expect(generationSuggestion).toBeDefined();
    });

    it('should provide specific remediation for different branch types', () => {
      baseAnalysis.testAnalysis.branchCoverage = {
        percentage: 60,
        uncoveredBranches: [
          {
            file: 'src/handler.ts',
            line: 25,
            type: 'if',
            description: 'Input validation check'
          },
          {
            file: 'src/handler.ts',
            line: 35,
            type: 'catch',
            description: 'Network error handling'
          },
          {
            file: 'src/handler.ts',
            line: 45,
            type: 'switch',
            description: 'Action type handling'
          }
        ]
      };

      const candidates = analyzer.analyze(baseAnalysis);

      const handlerTask = candidates.find(c =>
        c.candidateId.includes('handler')
      );

      expect(handlerTask).toBeDefined();
      expect(handlerTask?.description).toContain('Input validation check');
      expect(handlerTask?.description).toContain('Network error handling');
      expect(handlerTask?.description).toContain('Action type handling');

      const suggestions = handlerTask?.remediationSuggestions || [];

      // Should include suggestions for different branch types
      const testingSuggestion = suggestions.find(s =>
        s.type === 'testing' &&
        s.description.includes('Create tests for uncovered branches')
      );
      expect(testingSuggestion).toBeDefined();
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty uncovered branches array', () => {
      baseAnalysis.testAnalysis.branchCoverage = {
        percentage: 60, // Below threshold but no branches
        uncoveredBranches: []
      };

      const candidates = analyzer.analyze(baseAnalysis);

      const branchTasks = candidates.filter(c =>
        c.candidateId.includes('branch-coverage') &&
        !c.candidateId.includes('overall')
      );

      expect(branchTasks.length).toBe(0);
    });

    it('should handle malformed branch data gracefully', () => {
      baseAnalysis.testAnalysis.branchCoverage = {
        percentage: 60,
        uncoveredBranches: [
          {
            file: '',
            line: 0,
            type: 'if',
            description: ''
          },
          {
            file: 'src/valid.ts',
            line: 25,
            type: 'else',
            description: 'Valid branch'
          }
        ] as any
      };

      expect(() => {
        const candidates = analyzer.analyze(baseAnalysis);
        expect(candidates.length).toBeGreaterThan(0);
      }).not.toThrow();
    });

    it('should handle extreme coverage percentages', () => {
      // Test 0% coverage
      baseAnalysis.testAnalysis.branchCoverage = {
        percentage: 0,
        uncoveredBranches: []
      };

      let candidates = analyzer.analyze(baseAnalysis);
      let overallTask = candidates.find(c =>
        c.candidateId === 'tests-overall-branch-coverage'
      );
      expect(overallTask).toBeDefined();
      expect(overallTask?.description).toContain('0.0%');

      // Test 100% coverage
      baseAnalysis.testAnalysis.branchCoverage.percentage = 100;
      candidates = analyzer.analyze(baseAnalysis);
      const branchTasks = candidates.filter(c =>
        c.candidateId.includes('branch-coverage')
      );
      expect(branchTasks.length).toBe(0);
    });

    it('should handle very long file paths', () => {
      baseAnalysis.testAnalysis.branchCoverage = {
        percentage: 60,
        uncoveredBranches: [
          {
            file: 'src/very/deeply/nested/path/to/some/complex/service/with/long/name.ts',
            line: 25,
            type: 'if',
            description: 'Deep nesting test'
          }
        ]
      };

      const candidates = analyzer.analyze(baseAnalysis);

      const deepTask = candidates.find(c =>
        c.candidateId.includes('name')
      );

      expect(deepTask).toBeDefined();
      expect(deepTask?.title).toContain('name.ts'); // Should extract filename
    });

    it('should handle missing testAnalysis branch coverage', () => {
      const incompleteAnalysis = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          branchCoverage: undefined as any
        }
      };

      expect(() => {
        const candidates = analyzer.analyze(incompleteAnalysis);
        // Should still work with other analysis parts
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });
  });

  describe('scoring and prioritization', () => {
    it('should assign correct scores based on criticality', () => {
      baseAnalysis.testAnalysis.branchCoverage = {
        percentage: 60,
        uncoveredBranches: [
          {
            file: 'src/core/critical-service.ts',
            line: 25,
            type: 'if',
            description: 'Critical path'
          },
          {
            file: 'src/utils/helper.ts',
            line: 15,
            type: 'else',
            description: 'Helper function'
          }
        ]
      };

      const candidates = analyzer.analyze(baseAnalysis);

      const criticalTask = candidates.find(c =>
        c.candidateId.includes('critical-service') &&
        c.priority === 'urgent'
      );
      const normalTask = candidates.find(c =>
        c.candidateId.includes('helper') &&
        c.priority === 'normal'
      );

      expect(criticalTask?.score).toBe(0.9);
      expect(normalTask?.score).toBe(0.6);
    });

    it('should maintain consistent task structure', () => {
      baseAnalysis.testAnalysis.branchCoverage = {
        percentage: 50,
        uncoveredBranches: [
          {
            file: 'src/api/test.ts',
            line: 10,
            type: 'if',
            description: 'Test branch'
          }
        ]
      };

      const candidates = analyzer.analyze(baseAnalysis);

      const branchTask = candidates.find(c =>
        c.candidateId.includes('branch-coverage')
      );

      expect(branchTask).toBeDefined();
      expect(branchTask?.candidateId).toMatch(/^tests-/);
      expect(branchTask?.suggestedWorkflow).toBe('testing');
      expect(['low', 'normal', 'high', 'urgent']).toContain(branchTask?.priority);
      expect(['low', 'medium', 'high']).toContain(branchTask?.estimatedEffort);
      expect(branchTask?.score).toBeGreaterThan(0);
      expect(branchTask?.score).toBeLessThanOrEqual(1);
      expect(branchTask?.rationale).toBeTruthy();
      expect(branchTask?.description).toBeTruthy();
      expect(branchTask?.remediationSuggestions?.length).toBeGreaterThan(0);
    });
  });
});
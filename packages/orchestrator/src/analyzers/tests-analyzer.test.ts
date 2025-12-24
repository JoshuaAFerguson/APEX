/**
 * Tests Analyzer Tests
 *
 * Comprehensive tests for the TestsAnalyzer class, including coverage gap
 * task generation, untested exports analysis, integration test identification,
 * anti-pattern detection, and enhanced remediation recommendations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestsAnalyzer } from './tests-analyzer';
import type { ProjectAnalysis } from '../idle-processor';

describe('TestsAnalyzer', () => {
  let testsAnalyzer: TestsAnalyzer;
  let baseProjectAnalysis: ProjectAnalysis;

  beforeEach(() => {
    testsAnalyzer = new TestsAnalyzer();

    // Base project analysis structure
    baseProjectAnalysis = {
      codebaseSize: {
        files: 50,
        lines: 5000,
        languages: { 'ts': 40, 'js': 10 }
      },
      dependencies: {
        outdated: [],
        security: []
      },
      codeQuality: {
        lintIssues: 5,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: {
        coverage: 50,
        missingDocs: [],
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 70,
          details: {
            totalEndpoints: 20,
            documentedEndpoints: 14,
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
        percentage: 75,
        uncoveredFiles: []
      },
      testAnalysis: {
        branchCoverage: {
          percentage: 80,
          uncoveredBranches: []
        },
        untestedExports: [],
        missingIntegrationTests: [],
        antiPatterns: []
      }
    };
  });

  describe('type property', () => {
    it('should have tests type', () => {
      expect(testsAnalyzer.type).toBe('tests');
    });
  });

  // ============================================================================
  // Branch Coverage Analysis Tests
  // ============================================================================

  describe('branch coverage analysis', () => {
    describe('low branch coverage with specific files and branches', () => {
      it('should generate tasks for critical files with uncovered branches', () => {
        baseProjectAnalysis.testAnalysis.branchCoverage = {
          percentage: 60, // Below 70% threshold
          uncoveredBranches: [
            {
              file: 'src/core/service.ts',
              line: 25,
              type: 'if',
              description: 'Validation error handling branch'
            },
            {
              file: 'src/api/controller.ts',
              line: 45,
              type: 'catch',
              description: 'Database error handling'
            },
            {
              file: 'src/utils/helper.ts',
              line: 12,
              type: 'else',
              description: 'Fallback logic branch'
            }
          ]
        };

        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

        const criticalTasks = candidates.filter(c =>
          c.candidateId.includes('branch-coverage') &&
          (c.candidateId.includes('service') || c.candidateId.includes('controller'))
        );
        const nonCriticalTask = candidates.find(c =>
          c.candidateId.includes('branch-coverage') &&
          c.candidateId.includes('helper')
        );

        expect(criticalTasks.length).toBe(2);
        expect(nonCriticalTask).toBeDefined();

        // Critical files should have urgent priority
        const serviceTask = criticalTasks.find(t => t.candidateId.includes('service'));
        expect(serviceTask?.priority).toBe('urgent');
        expect(serviceTask?.score).toBe(0.9);
        expect(serviceTask?.description).toContain('1 uncovered branch');
        expect(serviceTask?.description).toContain('service.ts');

        // Non-critical should have normal priority
        expect(nonCriticalTask?.priority).toBe('normal');
        expect(nonCriticalTask?.score).toBe(0.6);
      });

      it('should group many non-critical files into single task', () => {
        baseProjectAnalysis.testAnalysis.branchCoverage = {
          percentage: 65,
          uncoveredBranches: [
            { file: 'src/utils/file1.ts', line: 10, type: 'if', description: 'Branch 1' },
            { file: 'src/utils/file2.ts', line: 20, type: 'else', description: 'Branch 2' },
            { file: 'src/utils/file3.ts', line: 30, type: 'switch', description: 'Branch 3' },
            { file: 'src/utils/file4.ts', line: 40, type: 'ternary', description: 'Branch 4' },
            { file: 'src/utils/file5.ts', line: 50, type: 'logical', description: 'Branch 5' }
          ]
        };

        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

        const groupedTask = candidates.find(c => c.candidateId === 'tests-branch-coverage-group');
        expect(groupedTask).toBeDefined();
        expect(groupedTask?.title).toBe('Add Branch Coverage for 5 Files');
        expect(groupedTask?.description).toContain('5 uncovered branches across 5 files');
        expect(groupedTask?.description).toContain('file1.ts, file2.ts, file3.ts...');
        expect(groupedTask?.priority).toBe('normal');
        expect(groupedTask?.estimatedEffort).toBe('medium');
        expect(groupedTask?.score).toBe(0.6);
      });

      it('should generate overall branch coverage task for very low coverage', () => {
        baseProjectAnalysis.testAnalysis.branchCoverage = {
          percentage: 35, // Below 40% threshold
          uncoveredBranches: [
            { file: 'src/test.ts', line: 10, type: 'if', description: 'Test branch' }
          ]
        };

        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

        const overallTask = candidates.find(c => c.candidateId === 'tests-overall-branch-coverage');
        expect(overallTask).toBeDefined();
        expect(overallTask?.title).toBe('Improve Overall Branch Coverage');
        expect(overallTask?.description).toContain('from 35.0% to at least 60%');
        expect(overallTask?.priority).toBe('high');
        expect(overallTask?.score).toBe(0.85);
      });

      it('should include remediation suggestions for branch coverage', () => {
        baseProjectAnalysis.testAnalysis.branchCoverage = {
          percentage: 60,
          uncoveredBranches: [
            {
              file: 'src/service.ts',
              line: 25,
              type: 'if',
              description: 'Error handling branch'
            },
            {
              file: 'src/service.ts',
              line: 35,
              type: 'catch',
              description: 'Exception handling'
            }
          ]
        };

        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

        const branchTask = candidates.find(c => c.candidateId.includes('branch-coverage'));
        expect(branchTask?.remediationSuggestions).toBeDefined();
        expect(branchTask?.remediationSuggestions?.length).toBeGreaterThan(0);

        const suggestions = branchTask?.remediationSuggestions || [];

        // Should have testing suggestion
        const testingSuggestion = suggestions.find(s => s.type === 'testing');
        expect(testingSuggestion).toBeDefined();
        expect(testingSuggestion?.description).toContain('Create tests for uncovered branches');

        // Should have coverage command
        const coverageCommand = suggestions.find(s => s.command === 'npm run test -- --coverage');
        expect(coverageCommand).toBeDefined();
        expect(coverageCommand?.expectedOutcome).toContain('improved branch coverage');
      });
    });

    describe('no branch coverage issues', () => {
      it('should not generate branch coverage tasks when coverage is good', () => {
        baseProjectAnalysis.testAnalysis.branchCoverage = {
          percentage: 85, // Above 70% threshold
          uncoveredBranches: []
        };

        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

        const branchTasks = candidates.filter(c => c.candidateId.includes('branch-coverage'));
        expect(branchTasks).toHaveLength(0);
      });
    });
  });

  // ============================================================================
  // Untested Exports Analysis Tests
  // ============================================================================

  describe('untested exports analysis', () => {
    describe('exports grouped by severity', () => {
      it('should prioritize critical public API exports', () => {
        baseProjectAnalysis.testAnalysis.untestedExports = [
          {
            file: 'src/api/endpoints.ts',
            exportName: 'createUser',
            exportType: 'function',
            line: 25,
            isPublic: true
          },
          {
            file: 'src/api/auth.ts',
            exportName: 'AuthController',
            exportType: 'class',
            line: 10,
            isPublic: true
          }
        ];

        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

        const criticalTasks = candidates.filter(c =>
          c.candidateId.includes('untested-export') &&
          c.priority === 'urgent'
        );

        expect(criticalTasks.length).toBe(2);

        const functionTask = criticalTasks.find(t => t.candidateId.includes('createUser'));
        expect(functionTask?.title).toBe('Test Public function: createUser');
        expect(functionTask?.description).toContain('public function createUser');
        expect(functionTask?.score).toBe(0.95);
        expect(functionTask?.estimatedEffort).toBe('low');

        const classTask = criticalTasks.find(t => t.candidateId.includes('AuthController'));
        expect(classTask?.title).toBe('Test Public class: AuthController');
        expect(classTask?.estimatedEffort).toBe('medium');
      });

      it('should handle high priority public non-API exports', () => {
        baseProjectAnalysis.testAnalysis.untestedExports = [
          {
            file: 'src/utils/validator.ts',
            exportName: 'validateEmail',
            exportType: 'function',
            isPublic: true
          },
          {
            file: 'src/types/user.ts',
            exportName: 'UserType',
            exportType: 'interface',
            isPublic: true
          }
        ];

        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

        const highTasks = candidates.filter(c =>
          c.candidateId.includes('untested-export') &&
          c.priority === 'high'
        );

        expect(highTasks.length).toBe(2);
        highTasks.forEach(task => {
          expect(task.score).toBe(0.8);
        });
      });

      it('should group many high priority exports', () => {
        const manyExports = Array.from({ length: 5 }, (_, i) => ({
          file: `src/utils/file${i}.ts`,
          exportName: `function${i}`,
          exportType: 'function' as const,
          isPublic: true
        }));

        baseProjectAnalysis.testAnalysis.untestedExports = manyExports;

        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

        const groupedTask = candidates.find(c => c.candidateId === 'tests-untested-exports-group-high');
        expect(groupedTask).toBeDefined();
        expect(groupedTask?.title).toBe('Test 5 Untested Public Exports');
        expect(groupedTask?.description).toContain('5 untested exports (5 public)');
        expect(groupedTask?.priority).toBe('high');
        expect(groupedTask?.score).toBe(0.8);
      });

      it('should handle medium and low priority exports', () => {
        baseProjectAnalysis.testAnalysis.untestedExports = [
          {
            file: 'src/internal/helper.ts',
            exportName: 'processData',
            exportType: 'function',
            isPublic: false
          },
          {
            file: 'src/internal/config.ts',
            exportName: 'CONFIG_VALUE',
            exportType: 'const',
            isPublic: false
          }
        ];

        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

        const mediumTask = candidates.find(c =>
          c.candidateId === 'tests-untested-exports-group-normal' &&
          c.description.includes('processData')
        );
        const lowTask = candidates.find(c =>
          c.candidateId === 'tests-untested-exports-group-low' &&
          c.description.includes('CONFIG_VALUE')
        );

        expect(mediumTask).toBeDefined();
        expect(mediumTask?.priority).toBe('normal');
        expect(mediumTask?.score).toBe(0.6);

        expect(lowTask).toBeDefined();
        expect(lowTask?.priority).toBe('low');
        expect(lowTask?.score).toBe(0.4);
      });

      it('should include comprehensive remediation suggestions', () => {
        baseProjectAnalysis.testAnalysis.untestedExports = [
          {
            file: 'src/api/service.ts',
            exportName: 'UserService',
            exportType: 'class',
            isPublic: true
          }
        ];

        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

        const exportTask = candidates.find(c => c.candidateId.includes('untested-export'));
        const suggestions = exportTask?.remediationSuggestions || [];

        // Should have primary testing suggestion with test file location
        const primaryTestSuggestion = suggestions.find(s =>
          s.type === 'testing' &&
          s.description.includes('Create class tests in')
        );
        expect(primaryTestSuggestion).toBeDefined();
        expect(primaryTestSuggestion?.description).toContain('src/api/service.test.ts');
        expect(primaryTestSuggestion?.command).toContain('# Create test file:');
        expect(primaryTestSuggestion?.command).toContain('import { UserService }');

        // Should have class-specific suggestions
        const classTestSuggestion = suggestions.find(s =>
          s.type === 'manual_review' &&
          s.description.includes('Test all public methods')
        );
        expect(classTestSuggestion).toBeDefined();

        // Should have class template suggestion
        const classTemplateSuggestion = suggestions.find(s =>
          s.type === 'testing' &&
          s.description.includes('Use class testing template')
        );
        expect(classTemplateSuggestion).toBeDefined();
        expect(classTemplateSuggestion?.command).toContain('describe(\'UserService\'');

        // Should have public API integration test suggestion
        const integrationSuggestion = suggestions.find(s =>
          s.type === 'testing' &&
          s.description.includes('Add integration tests for public API')
        );
        expect(integrationSuggestion).toBeDefined();
        expect(integrationSuggestion?.warning).toContain('Public APIs require both unit and integration tests');
      });

      it('should include function-specific remediation suggestions', () => {
        baseProjectAnalysis.testAnalysis.untestedExports = [
          {
            file: 'src/utils/helper.ts',
            exportName: 'formatDate',
            exportType: 'function',
            isPublic: false
          }
        ];

        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

        const exportTask = candidates.find(c => c.candidateId.includes('untested-export'));
        const suggestions = exportTask?.remediationSuggestions || [];

        // Should have primary testing suggestion with test file location
        const primaryTestSuggestion = suggestions.find(s =>
          s.type === 'testing' &&
          s.description.includes('Create function tests in')
        );
        expect(primaryTestSuggestion).toBeDefined();
        expect(primaryTestSuggestion?.description).toContain('src/utils/helper.test.ts');
        expect(primaryTestSuggestion?.command).toContain('import { formatDate }');

        // Should have function template suggestion
        const functionTemplateSuggestion = suggestions.find(s =>
          s.type === 'testing' &&
          s.description.includes('Use function testing template')
        );
        expect(functionTemplateSuggestion).toBeDefined();
        expect(functionTemplateSuggestion?.command).toContain('should return expected result with valid input');
        expect(functionTemplateSuggestion?.command).toContain('should handle edge cases');
      });

      it('should include grouped exports remediation suggestions with test file locations', () => {
        const groupedExports = [
          {
            file: 'src/utils/math.ts',
            exportName: 'add',
            exportType: 'function' as const,
            isPublic: true
          },
          {
            file: 'src/utils/math.ts',
            exportName: 'subtract',
            exportType: 'function' as const,
            isPublic: false
          },
          {
            file: 'src/utils/string.ts',
            exportName: 'capitalize',
            exportType: 'function' as const,
            isPublic: true
          }
        ];

        baseProjectAnalysis.testAnalysis.untestedExports = groupedExports;

        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

        const groupedTask = candidates.find(c => c.candidateId === 'tests-untested-exports-group-high');
        const suggestions = groupedTask?.remediationSuggestions || [];

        // Should have file-specific suggestions
        const mathFileSuggestion = suggestions.find(s =>
          s.description.includes('src/utils/math.test.ts')
        );
        expect(mathFileSuggestion).toBeDefined();
        expect(mathFileSuggestion?.description).toContain('add, subtract');
        expect(mathFileSuggestion?.command).toContain('import { add, subtract }');

        const stringFileSuggestion = suggestions.find(s =>
          s.description.includes('src/utils/string.test.ts')
        );
        expect(stringFileSuggestion).toBeDefined();
        expect(stringFileSuggestion?.description).toContain('capitalize');
      });
    });
  });

  // ============================================================================
  // Missing Integration Tests Analysis
  // ============================================================================

  describe('missing integration tests analysis', () => {
    it('should prioritize critical integration tests', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'User Registration Flow',
          description: 'End-to-end user registration from signup to email verification',
          priority: 'critical',
          relatedFiles: ['src/api/auth.ts', 'src/services/email.ts', 'src/models/user.ts']
        },
        {
          criticalPath: 'Payment Processing',
          description: 'Complete payment flow including validation and confirmation',
          priority: 'high',
          relatedFiles: ['src/api/payment.ts', 'src/services/stripe.ts']
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      const criticalTask = candidates.find(c =>
        c.candidateId.includes('integration-test') &&
        c.candidateId.includes('User-Registration-Flow')
      );
      const highTask = candidates.find(c =>
        c.candidateId.includes('integration-test') &&
        c.candidateId.includes('Payment-Processing')
      );

      expect(criticalTask).toBeDefined();
      expect(criticalTask?.title).toBe('Add Integration Test: User Registration Flow');
      expect(criticalTask?.priority).toBe('urgent');
      expect(criticalTask?.score).toBe(0.95);
      expect(criticalTask?.description).toContain('End-to-end user registration');

      expect(highTask).toBeDefined();
      expect(highTask?.priority).toBe('high');
      expect(highTask?.score).toBe(0.8);
    });

    it('should group multiple high priority integration tests', () => {
      const manyTests = Array.from({ length: 4 }, (_, i) => ({
        criticalPath: `Critical Path ${i + 1}`,
        description: `Description for critical path ${i + 1}`,
        priority: 'high' as const,
        relatedFiles: [`src/file${i}.ts`]
      }));

      baseProjectAnalysis.testAnalysis.missingIntegrationTests = manyTests;

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      const groupedTask = candidates.find(c => c.candidateId === 'tests-integration-tests-group-high');
      expect(groupedTask).toBeDefined();
      expect(groupedTask?.title).toBe('Add 4 Integration Tests');
      expect(groupedTask?.description).toContain('Critical Path 1, Critical Path 2, Critical Path 3...');
      expect(groupedTask?.priority).toBe('high');
      expect(groupedTask?.estimatedEffort).toBe('medium');
    });

    it('should include detailed remediation suggestions', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Login Flow',
          description: 'User authentication end-to-end test',
          priority: 'critical',
          relatedFiles: ['src/auth.ts', 'src/session.ts', 'src/middleware.ts']
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      const integrationTask = candidates.find(c => c.candidateId.includes('integration-test'));
      const suggestions = integrationTask?.remediationSuggestions || [];

      // Should have test creation suggestion
      const testSuggestion = suggestions.find(s => s.type === 'testing');
      expect(testSuggestion?.priority).toBe('urgent');
      expect(testSuggestion?.expectedOutcome).toContain('User authentication end-to-end test');

      // Should have related files review suggestion
      const reviewSuggestion = suggestions.find(s => s.type === 'manual_review');
      expect(reviewSuggestion?.description).toContain('src/auth.ts, src/session.ts, src/middleware.ts');

      // Should have test environment setup suggestion
      const setupSuggestion = suggestions.find(s =>
        s.type === 'testing' &&
        s.description.includes('Set up test environment')
      );
      expect(setupSuggestion).toBeDefined();
    });
  });

  // ============================================================================
  // Testing Anti-Patterns Analysis
  // ============================================================================

  describe('testing anti-patterns analysis', () => {
    describe('individual high-severity anti-patterns', () => {
      it('should create individual tasks for high severity anti-patterns', () => {
        baseProjectAnalysis.testAnalysis.antiPatterns = [
          {
            file: 'src/tests/flaky.test.ts',
            line: 25,
            type: 'flaky-test',
            description: 'Test intermittently fails due to timing issues',
            severity: 'high',
            suggestion: 'Add proper wait conditions and mock time-dependent operations'
          },
          {
            file: 'src/tests/pollution.test.ts',
            line: 45,
            type: 'test-pollution',
            description: 'Test modifies global state affecting other tests',
            severity: 'high',
            suggestion: 'Isolate test state with proper setup and teardown'
          }
        ];

        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

        const flakyTask = candidates.find(c => c.candidateId.includes('flaky-test'));
        const pollutionTask = candidates.find(c => c.candidateId.includes('test-pollution'));

        expect(flakyTask).toBeDefined();
        expect(flakyTask?.title).toBe('Fix Flaky Test: flaky.test.ts:25');
        expect(flakyTask?.priority).toBe('high');
        expect(flakyTask?.estimatedEffort).toBe('high'); // High effort anti-pattern
        expect(flakyTask?.score).toBe(0.8);

        expect(pollutionTask).toBeDefined();
        expect(pollutionTask?.title).toBe('Fix Test Pollution: pollution.test.ts:45');
        expect(pollutionTask?.estimatedEffort).toBe('high');
      });

      it('should include type-specific remediation suggestions', () => {
        baseProjectAnalysis.testAnalysis.antiPatterns = [
          {
            file: 'src/tests/slow.test.ts',
            line: 15,
            type: 'slow-test',
            description: 'Test takes over 5 seconds to complete',
            severity: 'medium'
          }
        ];

        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

        const slowTask = candidates.find(c => c.candidateId.includes('slow-test'));
        const suggestions = slowTask?.remediationSuggestions || [];

        // Should have general fix suggestion
        const fixSuggestion = suggestions.find(s => s.type === 'manual_review');
        expect(fixSuggestion?.description).toContain('Fix slow-test in slow.test.ts:15');

        // Should have slow-test specific suggestion
        const optimizeSuggestion = suggestions.find(s =>
          s.type === 'testing' &&
          s.description.includes('Optimize test performance')
        );
        expect(optimizeSuggestion).toBeDefined();
        expect(optimizeSuggestion?.expectedOutcome).toContain('reduced to acceptable levels');
      });
    });

    describe('grouped medium and low severity anti-patterns', () => {
      it('should group medium severity anti-patterns', () => {
        const mediumPatterns = [
          {
            file: 'src/tests/brittle1.test.ts',
            line: 10,
            type: 'brittle-test' as const,
            description: 'Test is too dependent on implementation details',
            severity: 'medium' as const
          },
          {
            file: 'src/tests/brittle2.test.ts',
            line: 20,
            type: 'brittle-test' as const,
            description: 'Another brittle test case',
            severity: 'medium' as const
          }
        ];

        baseProjectAnalysis.testAnalysis.antiPatterns = mediumPatterns;

        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

        const groupedTask = candidates.find(c => c.candidateId === 'tests-anti-patterns-group-normal');
        expect(groupedTask).toBeDefined();
        expect(groupedTask?.title).toBe('Fix 2 Testing Anti-Patterns');
        expect(groupedTask?.description).toContain('Brittle Test');
        expect(groupedTask?.priority).toBe('normal');
        expect(groupedTask?.score).toBe(0.6);
      });

      it('should include documentation suggestion for grouped anti-patterns', () => {
        baseProjectAnalysis.testAnalysis.antiPatterns = [
          {
            file: 'src/tests/test1.ts',
            line: 10,
            type: 'test-code-duplication',
            description: 'Duplicate test setup code',
            severity: 'low'
          },
          {
            file: 'src/tests/test2.ts',
            line: 20,
            type: 'test-code-duplication',
            description: 'More duplicate code',
            severity: 'low'
          }
        ];

        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

        const groupedTask = candidates.find(c => c.candidateId === 'tests-anti-patterns-group-low');
        const suggestions = groupedTask?.remediationSuggestions || [];

        const docSuggestion = suggestions.find(s => s.type === 'documentation');
        expect(docSuggestion).toBeDefined();
        expect(docSuggestion?.description).toContain('Document testing standards');
        expect(docSuggestion?.priority).toBe('low');
      });
    });
  });

  // ============================================================================
  // Legacy Coverage Analysis Tests
  // ============================================================================

  describe('legacy coverage analysis', () => {
    it('should generate task for critically low test coverage', () => {
      baseProjectAnalysis.testCoverage = {
        percentage: 25, // Below 30% threshold
        uncoveredFiles: ['src/service.ts', 'src/utils.ts']
      };

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      const coverageTask = candidates.find(c => c.candidateId === 'tests-critical-coverage-legacy');
      expect(coverageTask).toBeDefined();
      expect(coverageTask?.title).toBe('Add Critical Test Coverage');
      expect(coverageTask?.description).toContain('from 25.0% to at least 50%');
      expect(coverageTask?.priority).toBe('high');
      expect(coverageTask?.score).toBe(0.9);
    });

    it('should generate task for slow tests', () => {
      baseProjectAnalysis.performance.slowTests = [
        'src/tests/integration.test.ts',
        'src/tests/e2e.test.ts'
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      const slowTestsTask = candidates.find(c => c.candidateId === 'tests-slow-tests');
      expect(slowTestsTask).toBeDefined();
      expect(slowTestsTask?.title).toBe('Optimize Slow Tests');
      expect(slowTestsTask?.description).toContain('2 slow tests');
      expect(slowTestsTask?.priority).toBe('low');
      expect(slowTestsTask?.score).toBe(0.4);
    });

    it('should not generate legacy tasks when no issues exist', () => {
      baseProjectAnalysis.testCoverage = {
        percentage: 85, // Good coverage
        uncoveredFiles: []
      };
      baseProjectAnalysis.performance.slowTests = [];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      const legacyTasks = candidates.filter(c =>
        c.candidateId.includes('-legacy') ||
        c.candidateId.includes('slow-tests')
      );
      expect(legacyTasks).toHaveLength(0);
    });
  });

  // ============================================================================
  // Task Prioritization Tests
  // ============================================================================

  describe('task prioritization', () => {
    it('should prioritize critical branch coverage over low priority issues', () => {
      baseProjectAnalysis.testAnalysis.branchCoverage = {
        percentage: 35, // Very low - should generate urgent overall task
        uncoveredBranches: []
      };
      baseProjectAnalysis.performance.slowTests = ['slow.test.ts']; // Low priority

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const prioritized = testsAnalyzer.prioritize(candidates);

      expect(prioritized).toBeDefined();
      expect(prioritized?.candidateId).toBe('tests-overall-branch-coverage');
      expect(prioritized?.score).toBe(0.85);
    });

    it('should return highest scoring candidate', () => {
      baseProjectAnalysis.testAnalysis.untestedExports = [
        {
          file: 'src/api/critical.ts',
          exportName: 'criticalFunction',
          exportType: 'function',
          isPublic: true
        }
      ];
      baseProjectAnalysis.testAnalysis.antiPatterns = [
        {
          file: 'src/test.ts',
          line: 10,
          type: 'test-code-duplication',
          description: 'Low priority issue',
          severity: 'low'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const prioritized = testsAnalyzer.prioritize(candidates);

      expect(prioritized).toBeDefined();
      expect(prioritized?.candidateId).toContain('untested-export'); // Score 0.95
    });

    it('should return null when no candidates', () => {
      // Well-tested project
      baseProjectAnalysis.testCoverage = { percentage: 95, uncoveredFiles: [] };
      baseProjectAnalysis.testAnalysis.branchCoverage.percentage = 90;
      baseProjectAnalysis.performance.slowTests = [];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const prioritized = testsAnalyzer.prioritize(candidates);

      expect(candidates).toHaveLength(0);
      expect(prioritized).toBeNull();
    });
  });

  // ============================================================================
  // Complex Scenarios Tests
  // ============================================================================

  describe('complex scenarios', () => {
    it('should handle project with multiple testing issues', () => {
      baseProjectAnalysis.testCoverage = { percentage: 25, uncoveredFiles: [] };
      baseProjectAnalysis.testAnalysis = {
        branchCoverage: {
          percentage: 40, // Low but not critical
          uncoveredBranches: [
            { file: 'src/core/service.ts', line: 25, type: 'if', description: 'Error handling' },
            { file: 'src/utils/helper.ts', line: 10, type: 'else', description: 'Fallback logic' }
          ]
        },
        untestedExports: [
          {
            file: 'src/api/endpoints.ts',
            exportName: 'createUser',
            exportType: 'function',
            isPublic: true
          }
        ],
        missingIntegrationTests: [
          {
            criticalPath: 'User Registration',
            description: 'End-to-end registration test',
            priority: 'critical'
          }
        ],
        antiPatterns: [
          {
            file: 'src/tests/flaky.test.ts',
            line: 15,
            type: 'flaky-test',
            description: 'Intermittent failures',
            severity: 'high'
          }
        ]
      };
      baseProjectAnalysis.performance.slowTests = ['src/tests/slow.test.ts'];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      expect(candidates.length).toBeGreaterThanOrEqual(6);

      // Should have critical coverage task
      const criticalCoverage = candidates.find(c => c.candidateId === 'tests-critical-coverage-legacy');
      expect(criticalCoverage).toBeDefined();

      // Should have branch coverage tasks
      const branchTasks = candidates.filter(c => c.candidateId.includes('branch-coverage'));
      expect(branchTasks.length).toBeGreaterThan(0);

      // Should have untested export task
      const untestedTask = candidates.find(c => c.candidateId.includes('untested-export'));
      expect(untestedTask).toBeDefined();

      // Should have integration test task
      const integrationTask = candidates.find(c => c.candidateId.includes('integration-test'));
      expect(integrationTask).toBeDefined();

      // Should have anti-pattern task
      const antiPatternTask = candidates.find(c => c.candidateId.includes('flaky-test'));
      expect(antiPatternTask).toBeDefined();

      // Should have slow tests task
      const slowTask = candidates.find(c => c.candidateId === 'tests-slow-tests');
      expect(slowTask).toBeDefined();

      // All candidates should have valid structure
      candidates.forEach(candidate => {
        expect(candidate.candidateId).toMatch(/^tests-/);
        expect(candidate.suggestedWorkflow).toBe('testing');
        expect(['low', 'normal', 'high', 'urgent']).toContain(candidate.priority);
        expect(['low', 'medium', 'high']).toContain(candidate.estimatedEffort);
        expect(candidate.score).toBeGreaterThan(0);
        expect(candidate.score).toBeLessThanOrEqual(1);
        expect(candidate.rationale).toBeTruthy();
        expect(candidate.description).toBeTruthy();
      });
    });

    it('should handle well-tested project', () => {
      baseProjectAnalysis.testCoverage = { percentage: 95, uncoveredFiles: [] };
      baseProjectAnalysis.testAnalysis.branchCoverage.percentage = 90;
      baseProjectAnalysis.testAnalysis.untestedExports = [];
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [];
      baseProjectAnalysis.testAnalysis.antiPatterns = [];
      baseProjectAnalysis.performance.slowTests = [];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      expect(candidates).toHaveLength(0);
    });

    it('should handle missing testAnalysis gracefully', () => {
      const incompleteAnalysis = {
        ...baseProjectAnalysis,
        testAnalysis: undefined as any
      };

      expect(() => {
        const candidates = testsAnalyzer.analyze(incompleteAnalysis);
        expect(candidates.length).toBeGreaterThan(0); // Should still have legacy tasks
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Utility Methods Tests
  // ============================================================================

  describe('utility methods', () => {
    it('should handle file paths correctly', () => {
      baseProjectAnalysis.testAnalysis.branchCoverage = {
        percentage: 60,
        uncoveredBranches: [
          {
            file: 'src/very/deep/nested/path/service.ts',
            line: 25,
            type: 'if',
            description: 'Deep nesting test'
          }
        ]
      };

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const task = candidates[0];

      expect(task.title).toContain('service.ts'); // Should extract filename
      expect(task.candidateId).toContain('src-very-deep-nested-path-service-ts'); // Safe filename
    });

    it('should classify API files correctly', () => {
      baseProjectAnalysis.testAnalysis.untestedExports = [
        {
          file: 'src/api/users.ts',
          exportName: 'getUsers',
          exportType: 'function',
          isPublic: true
        },
        {
          file: 'src/controllers/auth.ts',
          exportName: 'login',
          exportType: 'function',
          isPublic: true
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      // Both should be classified as critical (API files)
      const criticalTasks = candidates.filter(c => c.priority === 'urgent');
      expect(criticalTasks.length).toBe(2);
    });

    it('should format anti-pattern types correctly', () => {
      baseProjectAnalysis.testAnalysis.antiPatterns = [
        {
          file: 'src/test.ts',
          line: 10,
          type: 'test-code-duplication',
          description: 'Duplication found',
          severity: 'high'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const task = candidates[0];

      expect(task.title).toBe('Fix Test Code Duplication: test.ts:10');
    });
  });

  // ============================================================================
  // Utility Methods Tests (Additional Coverage)
  // ============================================================================

  describe('utility methods detailed tests', () => {
    describe('generateTestFilePath', () => {
      it('should generate test file path for src structure', () => {
        const analyzer = testsAnalyzer as any; // Access private method

        expect(analyzer.generateTestFilePath('src/components/Button.ts'))
          .toBe('src/components/Button.test.ts');
        expect(analyzer.generateTestFilePath('src/utils/helper.js'))
          .toBe('src/utils/helper.test.js');
        expect(analyzer.generateTestFilePath('./src/services/api.tsx'))
          .toBe('src/services/api.test.tsx');
      });

      it('should handle root src files', () => {
        const analyzer = testsAnalyzer as any;

        expect(analyzer.generateTestFilePath('src/index.ts'))
          .toBe('src/index.test.ts');
        expect(analyzer.generateTestFilePath('src/app.jsx'))
          .toBe('src/app.test.jsx');
      });

      it('should handle non-src files', () => {
        const analyzer = testsAnalyzer as any;

        expect(analyzer.generateTestFilePath('components/Header.ts'))
          .toBe('components/Header.test.ts');
        expect(analyzer.generateTestFilePath('utils/math.js'))
          .toBe('utils/math.test.js');
      });
    });

    describe('getRelativeImportPath', () => {
      it('should calculate import path for same directory', () => {
        const analyzer = testsAnalyzer as any;

        expect(analyzer.getRelativeImportPath('src/Button.test.ts', 'src/Button.ts'))
          .toBe('./Button');
        expect(analyzer.getRelativeImportPath('utils/helper.test.js', 'utils/helper.js'))
          .toBe('./helper');
      });

      it('should calculate import path for different directories', () => {
        const analyzer = testsAnalyzer as any;

        expect(analyzer.getRelativeImportPath('src/components/Button.test.ts', 'src/utils/helper.ts'))
          .toContain('utils/helper');
        expect(analyzer.getRelativeImportPath('tests/unit/api.test.ts', 'src/services/api.ts'))
          .toContain('src/services/api');
      });

      it('should handle complex nested paths', () => {
        const analyzer = testsAnalyzer as any;

        const result = analyzer.getRelativeImportPath(
          'src/components/forms/inputs/TextInput.test.ts',
          'src/utils/validation.ts'
        );
        expect(result).toMatch(/validation$/);
      });
    });

    describe('generateTestTemplate', () => {
      it('should generate basic test template with correct import', () => {
        const analyzer = testsAnalyzer as any;
        const exportItem = {
          file: 'src/utils/helper.ts',
          exportName: 'formatNumber',
          exportType: 'function',
          isPublic: true
        };

        const template = analyzer.generateTestTemplate(exportItem, 'src/utils/helper.test.ts');

        expect(template).toContain('import { formatNumber }');
        expect(template).toContain('describe(\'formatNumber\'');
        expect(template).toContain('should be defined');
        expect(template).toContain('# Create test file: src/utils/helper.test.ts');
      });

      it('should handle different export types in template', () => {
        const analyzer = testsAnalyzer as any;
        const classExport = {
          file: 'src/models/User.ts',
          exportName: 'UserModel',
          exportType: 'class',
          isPublic: false
        };

        const template = analyzer.generateTestTemplate(classExport, 'src/models/User.test.ts');
        expect(template).toContain('import { UserModel }');
        expect(template).toContain('describe(\'UserModel\'');
        expect(template).toContain('based on the class functionality');
      });
    });

    describe('generateClassTestTemplate', () => {
      it('should generate comprehensive class test template', () => {
        const analyzer = testsAnalyzer as any;

        const template = analyzer.generateClassTestTemplate('UserService', 'src/services/User.test.ts');

        expect(template).toContain('Class test template for UserService');
        expect(template).toContain('let instance: UserService');
        expect(template).toContain('beforeEach(() => {');
        expect(template).toContain('instance = new UserService');
        expect(template).toContain('describe(\'constructor\'');
        expect(template).toContain('describe(\'methods\'');
        expect(template).toContain('should create instance with valid parameters');
        expect(template).toContain('should throw error with invalid parameters');
        expect(template).toContain('should handle normal cases');
        expect(template).toContain('should handle edge cases');
        expect(template).toContain('should handle error cases');
      });
    });

    describe('generateFunctionTestTemplate', () => {
      it('should generate comprehensive function test template', () => {
        const analyzer = testsAnalyzer as any;

        const template = analyzer.generateFunctionTestTemplate('calculateTotal', 'src/utils/math.test.ts');

        expect(template).toContain('Function test template for calculateTotal');
        expect(template).toContain('should return expected result with valid input');
        expect(template).toContain('should handle edge cases');
        expect(template).toContain('expect(calculateTotal(null))');
        expect(template).toContain('expect(calculateTotal(undefined))');
        expect(template).toContain('expect(calculateTotal(\'\'))');
        expect(template).toContain('should throw error with invalid input');
        expect(template).toContain('should handle async operations correctly');
        expect(template).toContain('return expect(calculateTotal');
        expect(template).toContain('.resolves.toBe');
      });
    });

    describe('generateGroupedTestTemplate', () => {
      it('should generate template for multiple exports from same file', () => {
        const analyzer = testsAnalyzer as any;
        const exports = [
          {
            file: 'src/utils/math.ts',
            exportName: 'add',
            exportType: 'function',
            isPublic: true
          },
          {
            file: 'src/utils/math.ts',
            exportName: 'subtract',
            exportType: 'function',
            isPublic: false
          }
        ];

        const template = analyzer.generateGroupedTestTemplate(exports, 'src/utils/math.test.ts');

        expect(template).toContain('# Create test file: src/utils/math.test.ts');
        expect(template).toContain('import { add, subtract }');
        expect(template).toContain('describe(\'add\'');
        expect(template).toContain('describe(\'subtract\'');
        expect(template).toContain('NOTE: This is a public API - ensure comprehensive coverage');
      });

      it('should handle empty exports array', () => {
        const analyzer = testsAnalyzer as any;

        const template = analyzer.generateGroupedTestTemplate([], 'test.ts');
        expect(template).toContain('# Create test file: test.ts');
        expect(template).toContain('import {  }');
      });
    });

    describe('groupExportsByFile', () => {
      it('should group exports by their source file', () => {
        const analyzer = testsAnalyzer as any;
        const exports = [
          {
            file: 'src/utils/math.ts',
            exportName: 'add',
            exportType: 'function',
            isPublic: true
          },
          {
            file: 'src/utils/math.ts',
            exportName: 'subtract',
            exportType: 'function',
            isPublic: false
          },
          {
            file: 'src/utils/string.ts',
            exportName: 'capitalize',
            exportType: 'function',
            isPublic: true
          }
        ];

        const grouped = analyzer.groupExportsByFile(exports);

        expect(Object.keys(grouped)).toHaveLength(2);
        expect(grouped['src/utils/math.ts']).toHaveLength(2);
        expect(grouped['src/utils/string.ts']).toHaveLength(1);
        expect(grouped['src/utils/math.ts'][0].exportName).toBe('add');
        expect(grouped['src/utils/math.ts'][1].exportName).toBe('subtract');
        expect(grouped['src/utils/string.ts'][0].exportName).toBe('capitalize');
      });

      it('should handle empty exports array', () => {
        const analyzer = testsAnalyzer as any;

        const grouped = analyzer.groupExportsByFile([]);
        expect(Object.keys(grouped)).toHaveLength(0);
      });
    });

    describe('formatAntiPatternType', () => {
      it('should format anti-pattern types correctly', () => {
        const analyzer = testsAnalyzer as any;

        expect(analyzer.formatAntiPatternType('test-code-duplication')).toBe('Test Code Duplication');
        expect(analyzer.formatAntiPatternType('flaky-test')).toBe('Flaky Test');
        expect(analyzer.formatAntiPatternType('slow-test')).toBe('Slow Test');
        expect(analyzer.formatAntiPatternType('brittle-test')).toBe('Brittle Test');
        expect(analyzer.formatAntiPatternType('mystery-guest')).toBe('Mystery Guest');
        expect(analyzer.formatAntiPatternType('assertion-roulette')).toBe('Assertion Roulette');
      });

      it('should handle single words', () => {
        const analyzer = testsAnalyzer as any;

        expect(analyzer.formatAntiPatternType('pollution')).toBe('Pollution');
        expect(analyzer.formatAntiPatternType('eager')).toBe('Eager');
      });
    });

    describe('getAntiPatternEffort', () => {
      it('should classify high effort patterns', () => {
        const analyzer = testsAnalyzer as any;

        expect(analyzer.getAntiPatternEffort('test-pollution')).toBe('high');
        expect(analyzer.getAntiPatternEffort('eager-test')).toBe('high');
        expect(analyzer.getAntiPatternEffort('flaky-test')).toBe('high');
      });

      it('should classify medium effort patterns', () => {
        const analyzer = testsAnalyzer as any;

        expect(analyzer.getAntiPatternEffort('brittle-test')).toBe('medium');
        expect(analyzer.getAntiPatternEffort('slow-test')).toBe('medium');
        expect(analyzer.getAntiPatternEffort('test-code-duplication')).toBe('medium');
      });

      it('should classify low effort patterns as default', () => {
        const analyzer = testsAnalyzer as any;

        expect(analyzer.getAntiPatternEffort('mystery-guest')).toBe('low');
        expect(analyzer.getAntiPatternEffort('assertion-roulette')).toBe('low');
        expect(analyzer.getAntiPatternEffort('unknown-pattern')).toBe('low');
      });
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling Tests
  // ============================================================================

  describe('edge cases and error handling', () => {
    it('should handle undefined testAnalysis properties gracefully', () => {
      const incompleteAnalysis = {
        ...baseProjectAnalysis,
        testAnalysis: {
          branchCoverage: undefined as any,
          untestedExports: undefined as any,
          missingIntegrationTests: undefined as any,
          antiPatterns: undefined as any
        }
      };

      expect(() => {
        testsAnalyzer.analyze(incompleteAnalysis);
      }).not.toThrow();
    });

    it('should handle empty arrays gracefully', () => {
      baseProjectAnalysis.testAnalysis.branchCoverage = {
        percentage: 100,
        uncoveredBranches: []
      };
      baseProjectAnalysis.testAnalysis.untestedExports = [];
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [];
      baseProjectAnalysis.testAnalysis.antiPatterns = [];
      baseProjectAnalysis.performance.slowTests = [];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      expect(candidates).toHaveLength(0);
    });

    it('should handle very large datasets', () => {
      // Simulate large number of untested exports
      const manyExports = Array.from({ length: 100 }, (_, i) => ({
        file: `src/file${i}.ts`,
        exportName: `function${i}`,
        exportType: 'function' as const,
        isPublic: i % 2 === 0 // Half public, half private
      }));

      baseProjectAnalysis.testAnalysis.untestedExports = manyExports;

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates.some(c => c.candidateId.includes('group'))).toBe(true);
    });

    it('should handle malformed file paths', () => {
      baseProjectAnalysis.testAnalysis.branchCoverage = {
        percentage: 50,
        uncoveredBranches: [
          {
            file: '',
            line: 10,
            type: 'if',
            description: 'Empty file path'
          },
          {
            file: '///multiple///slashes///',
            line: 20,
            type: 'else',
            description: 'Multiple slashes'
          }
        ]
      };

      expect(() => {
        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
        expect(candidates.length).toBeGreaterThan(0);
      }).not.toThrow();
    });

    it('should handle extreme branch coverage percentages', () => {
      baseProjectAnalysis.testAnalysis.branchCoverage = {
        percentage: 0, // Absolute minimum
        uncoveredBranches: []
      };

      let candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const zeroPercentTask = candidates.find(c => c.candidateId === 'tests-overall-branch-coverage');
      expect(zeroPercentTask).toBeDefined();
      expect(zeroPercentTask?.description).toContain('0.0%');

      baseProjectAnalysis.testAnalysis.branchCoverage.percentage = 100;
      candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const maxPercentTasks = candidates.filter(c => c.candidateId.includes('branch-coverage'));
      expect(maxPercentTasks).toHaveLength(0);
    });

    it('should handle mixed priority anti-patterns', () => {
      baseProjectAnalysis.testAnalysis.antiPatterns = [
        {
          file: 'test1.ts',
          line: 10,
          type: 'flaky-test',
          description: 'High severity',
          severity: 'high'
        },
        {
          file: 'test2.ts',
          line: 20,
          type: 'slow-test',
          description: 'Medium severity',
          severity: 'medium'
        },
        {
          file: 'test3.ts',
          line: 30,
          type: 'test-code-duplication',
          description: 'Low severity',
          severity: 'low'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      // Should have individual high severity task
      const highTask = candidates.find(c => c.candidateId.includes('flaky-test'));
      expect(highTask).toBeDefined();
      expect(highTask?.priority).toBe('high');

      // Should have grouped medium severity task
      const mediumGroupTask = candidates.find(c => c.candidateId === 'tests-anti-patterns-group-normal');
      expect(mediumGroupTask).toBeDefined();

      // Should have grouped low severity task
      const lowGroupTask = candidates.find(c => c.candidateId === 'tests-anti-patterns-group-low');
      expect(lowGroupTask).toBeDefined();
    });

    it('should handle exports with missing properties', () => {
      baseProjectAnalysis.testAnalysis.untestedExports = [
        {
          file: 'src/incomplete.ts',
          exportName: 'incompleteExport',
          exportType: 'function',
          // Missing line property
          isPublic: true
        } as any,
        {
          file: 'src/another.ts',
          exportName: '',  // Empty name
          exportType: 'const',
          line: 15,
          isPublic: false
        }
      ];

      expect(() => {
        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
        expect(candidates.length).toBeGreaterThan(0);
      }).not.toThrow();
    });

    it('should handle numerical edge cases in scoring', () => {
      baseProjectAnalysis.testCoverage = { percentage: 0, uncoveredFiles: [] };
      baseProjectAnalysis.testAnalysis.branchCoverage = { percentage: 0, uncoveredBranches: [] };

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      candidates.forEach(candidate => {
        expect(candidate.score).toBeGreaterThanOrEqual(0);
        expect(candidate.score).toBeLessThanOrEqual(1);
        expect(Number.isFinite(candidate.score)).toBe(true);
      });
    });

    it('should handle template generation edge cases', () => {
      const analyzer = testsAnalyzer as any;

      // Test with undefined/null values
      const exportItemWithMissingData = {
        file: 'src/test.ts',
        exportName: 'testFunction',
        exportType: 'function',
        isPublic: true
      };

      expect(() => {
        analyzer.generateTestTemplate(exportItemWithMissingData, 'src/test.test.ts');
        analyzer.generateClassTestTemplate('TestClass', 'src/TestClass.test.ts');
        analyzer.generateFunctionTestTemplate('testFunction', 'src/test.test.ts');
      }).not.toThrow();
    });
  });
});
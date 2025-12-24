/**
 * Tests Analyzer - Untested Exports Tests
 *
 * Comprehensive tests for untested exports analysis functionality.
 * Tests the TestsAnalyzer's ability to identify, prioritize, and create
 * remediation suggestions for untested exports grouped by severity.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestsAnalyzer } from '../tests-analyzer';
import type { ProjectAnalysis } from '../../idle-processor';

describe('TestsAnalyzer - Untested Exports', () => {
  let analyzer: TestsAnalyzer;
  let baseAnalysis: ProjectAnalysis;

  beforeEach(() => {
    analyzer = new TestsAnalyzer();
    baseAnalysis = {
      codebaseSize: {
        files: 30,
        lines: 4000,
        languages: { 'ts': 25, 'js': 5 }
      },
      dependencies: {
        outdated: [],
        security: []
      },
      codeQuality: {
        lintIssues: 1,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: {
        coverage: 70,
        missingDocs: [],
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 80,
          details: {
            totalEndpoints: 15,
            documentedEndpoints: 12,
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
        percentage: 85,
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

  describe('critical public API exports prioritization', () => {
    it('should prioritize public API exports as critical (urgent, score 0.95)', () => {
      baseAnalysis.testAnalysis.untestedExports = [
        {
          file: 'src/api/user-endpoints.ts',
          exportName: 'createUser',
          exportType: 'function',
          line: 25,
          isPublic: true
        },
        {
          file: 'src/api/auth-endpoints.ts',
          exportName: 'loginUser',
          exportType: 'function',
          line: 40,
          isPublic: true
        }
      ];

      const candidates = analyzer.analyze(baseAnalysis);

      const criticalTasks = candidates.filter(c =>
        c.candidateId.includes('untested-export') &&
        c.priority === 'urgent'
      );

      expect(criticalTasks.length).toBe(2);

      const createUserTask = criticalTasks.find(t =>
        t.candidateId.includes('createUser')
      );
      const loginUserTask = criticalTasks.find(t =>
        t.candidateId.includes('loginUser')
      );

      expect(createUserTask).toBeDefined();
      expect(createUserTask?.title).toBe('Test Public function: createUser');
      expect(createUserTask?.priority).toBe('urgent');
      expect(createUserTask?.score).toBe(0.95);
      expect(createUserTask?.estimatedEffort).toBe('low');
      expect(createUserTask?.description).toContain('public function createUser');
      expect(createUserTask?.description).toContain('user-endpoints.ts:25');

      expect(loginUserTask).toBeDefined();
      expect(loginUserTask?.title).toBe('Test Public function: loginUser');
      expect(loginUserTask?.score).toBe(0.95);
    });

    it('should identify API files correctly', () => {
      baseAnalysis.testAnalysis.untestedExports = [
        {
          file: 'src/controllers/payment-controller.ts',
          exportName: 'PaymentController',
          exportType: 'class',
          line: 15,
          isPublic: true
        },
        {
          file: 'src/handlers/webhook-handler.ts',
          exportName: 'processWebhook',
          exportType: 'function',
          line: 30,
          isPublic: true
        },
        {
          file: 'src/middleware/auth-middleware.ts',
          exportName: 'requireAuth',
          exportType: 'function',
          line: 20,
          isPublic: true
        }
      ];

      const candidates = analyzer.analyze(baseAnalysis);

      const criticalTasks = candidates.filter(c =>
        c.candidateId.includes('untested-export') &&
        c.priority === 'urgent'
      );

      expect(criticalTasks.length).toBe(3); // All should be critical API exports

      criticalTasks.forEach(task => {
        expect(task.score).toBe(0.95);
        expect(task.suggestedWorkflow).toBe('testing');
      });
    });

    it('should handle class exports appropriately', () => {
      baseAnalysis.testAnalysis.untestedExports = [
        {
          file: 'src/api/user-service.ts',
          exportName: 'UserService',
          exportType: 'class',
          line: 10,
          isPublic: true
        }
      ];

      const candidates = analyzer.analyze(baseAnalysis);

      const classTask = candidates.find(c =>
        c.candidateId.includes('UserService')
      );

      expect(classTask).toBeDefined();
      expect(classTask?.title).toBe('Test Public class: UserService');
      expect(classTask?.estimatedEffort).toBe('medium'); // Classes are medium effort
      expect(classTask?.score).toBe(0.95);
      expect(classTask?.description).toContain('public class UserService');
    });
  });

  describe('high priority public non-API exports', () => {
    it('should classify public non-API exports as high priority (score 0.8)', () => {
      baseAnalysis.testAnalysis.untestedExports = [
        {
          file: 'src/utils/validation.ts',
          exportName: 'validateEmail',
          exportType: 'function',
          line: 15,
          isPublic: true
        },
        {
          file: 'src/types/user.ts',
          exportName: 'UserType',
          exportType: 'interface',
          line: 5,
          isPublic: true
        },
        {
          file: 'src/services/email-service.ts',
          exportName: 'EmailService',
          exportType: 'class',
          line: 20,
          isPublic: true
        }
      ];

      const candidates = analyzer.analyze(baseAnalysis);

      const highTasks = candidates.filter(c =>
        c.candidateId.includes('untested-export') &&
        c.priority === 'high'
      );

      expect(highTasks.length).toBe(3);

      highTasks.forEach(task => {
        expect(task.score).toBe(0.8);
        expect(task.suggestedWorkflow).toBe('testing');
      });

      const emailValidationTask = highTasks.find(t =>
        t.candidateId.includes('validateEmail')
      );
      expect(emailValidationTask?.title).toBe('Test Public function: validateEmail');

      const userTypeTask = highTasks.find(t =>
        t.candidateId.includes('UserType')
      );
      expect(userTypeTask?.title).toBe('Test Public interface: UserType');
    });

    it('should handle different export types correctly', () => {
      baseAnalysis.testAnalysis.untestedExports = [
        {
          file: 'src/constants/config.ts',
          exportName: 'API_CONFIG',
          exportType: 'const',
          line: 10,
          isPublic: true
        },
        {
          file: 'src/enums/status.ts',
          exportName: 'UserStatus',
          exportType: 'enum',
          line: 5,
          isPublic: true
        },
        {
          file: 'src/types/response.ts',
          exportName: 'ApiResponse',
          exportType: 'type',
          line: 15,
          isPublic: true
        }
      ];

      const candidates = analyzer.analyze(baseAnalysis);

      const constTask = candidates.find(c =>
        c.candidateId.includes('API_CONFIG')
      );
      const enumTask = candidates.find(c =>
        c.candidateId.includes('UserStatus')
      );
      const typeTask = candidates.find(c =>
        c.candidateId.includes('ApiResponse')
      );

      expect(constTask?.title).toBe('Test Public const: API_CONFIG');
      expect(enumTask?.title).toBe('Test Public enum: UserStatus');
      expect(typeTask?.title).toBe('Test Public type: ApiResponse');

      [constTask, enumTask, typeTask].forEach(task => {
        expect(task?.priority).toBe('high');
        expect(task?.score).toBe(0.8);
      });
    });
  });

  describe('medium and low priority exports', () => {
    it('should classify private exports by type and content', () => {
      baseAnalysis.testAnalysis.untestedExports = [
        {
          file: 'src/internal/data-processor.ts',
          exportName: 'processUserData',
          exportType: 'function',
          line: 25,
          isPublic: false
        },
        {
          file: 'src/internal/config.ts',
          exportName: 'INTERNAL_CONFIG',
          exportType: 'const',
          line: 10,
          isPublic: false
        },
        {
          file: 'src/helpers/string-utils.ts',
          exportName: 'capitalize',
          exportType: 'function',
          line: 15,
          isPublic: false
        }
      ];

      const candidates = analyzer.analyze(baseAnalysis);

      // Data processing function should be medium priority
      const mediumTask = candidates.find(c =>
        c.candidateId === 'tests-untested-exports-group-normal' &&
        c.description.includes('processUserData')
      );
      expect(mediumTask).toBeDefined();
      expect(mediumTask?.priority).toBe('normal');
      expect(mediumTask?.score).toBe(0.6);

      // Config constants should be low priority
      const lowTask = candidates.find(c =>
        c.candidateId === 'tests-untested-exports-group-low' &&
        c.description.includes('INTERNAL_CONFIG')
      );
      expect(lowTask).toBeDefined();
      expect(lowTask?.priority).toBe('low');
      expect(lowTask?.score).toBe(0.4);

      // Utility function should be low priority
      const utilTask = candidates.find(c =>
        c.candidateId === 'tests-untested-exports-group-low' &&
        c.description.includes('capitalize')
      );
      expect(utilTask).toBeDefined();
      expect(utilTask?.priority).toBe('low');
    });
  });

  describe('grouping behavior', () => {
    it('should group many high priority exports into single task', () => {
      const manyExports = Array.from({ length: 6 }, (_, i) => ({
        file: `src/utils/file${i}.ts`,
        exportName: `function${i}`,
        exportType: 'function' as const,
        line: 10 + i,
        isPublic: true
      }));

      baseAnalysis.testAnalysis.untestedExports = manyExports;

      const candidates = analyzer.analyze(baseAnalysis);

      const groupedTask = candidates.find(c =>
        c.candidateId === 'tests-untested-exports-group-high'
      );

      expect(groupedTask).toBeDefined();
      expect(groupedTask?.title).toBe('Test 6 Untested Public Exports');
      expect(groupedTask?.description).toContain('6 untested exports (6 public)');
      expect(groupedTask?.description).toContain('function0, function1, function2...');
      expect(groupedTask?.priority).toBe('high');
      expect(groupedTask?.score).toBe(0.8);
      expect(groupedTask?.estimatedEffort).toBe('medium');
    });

    it('should create individual tasks for few high priority exports', () => {
      baseAnalysis.testAnalysis.untestedExports = [
        {
          file: 'src/utils/validator.ts',
          exportName: 'validateInput',
          exportType: 'function',
          line: 20,
          isPublic: true
        },
        {
          file: 'src/utils/formatter.ts',
          exportName: 'formatOutput',
          exportType: 'function',
          line: 30,
          isPublic: true
        }
      ];

      const candidates = analyzer.analyze(baseAnalysis);

      const individualTasks = candidates.filter(c =>
        c.candidateId.includes('untested-export') &&
        !c.candidateId.includes('group')
      );

      expect(individualTasks.length).toBe(2);

      const validatorTask = individualTasks.find(t =>
        t.candidateId.includes('validateInput')
      );
      const formatterTask = individualTasks.find(t =>
        t.candidateId.includes('formatOutput')
      );

      expect(validatorTask?.priority).toBe('high');
      expect(formatterTask?.priority).toBe('high');
    });

    it('should handle mixed priority exports correctly', () => {
      baseAnalysis.testAnalysis.untestedExports = [
        // Critical API export
        {
          file: 'src/api/users.ts',
          exportName: 'getUsers',
          exportType: 'function',
          line: 15,
          isPublic: true
        },
        // High priority public export
        {
          file: 'src/utils/crypto.ts',
          exportName: 'hashPassword',
          exportType: 'function',
          line: 25,
          isPublic: true
        },
        // Medium priority private export
        {
          file: 'src/internal/parser.ts',
          exportName: 'parseData',
          exportType: 'function',
          line: 35,
          isPublic: false
        },
        // Low priority constant
        {
          file: 'src/constants/defaults.ts',
          exportName: 'DEFAULT_TIMEOUT',
          exportType: 'const',
          line: 5,
          isPublic: false
        }
      ];

      const candidates = analyzer.analyze(baseAnalysis);

      const criticalTask = candidates.find(c =>
        c.candidateId.includes('getUsers') &&
        c.priority === 'urgent'
      );
      const highTask = candidates.find(c =>
        c.candidateId.includes('hashPassword') &&
        c.priority === 'high'
      );
      const mediumGroupTask = candidates.find(c =>
        c.candidateId === 'tests-untested-exports-group-normal'
      );
      const lowGroupTask = candidates.find(c =>
        c.candidateId === 'tests-untested-exports-group-low'
      );

      expect(criticalTask).toBeDefined();
      expect(criticalTask?.score).toBe(0.95);

      expect(highTask).toBeDefined();
      expect(highTask?.score).toBe(0.8);

      expect(mediumGroupTask).toBeDefined();
      expect(mediumGroupTask?.score).toBe(0.6);
      expect(mediumGroupTask?.description).toContain('parseData');

      expect(lowGroupTask).toBeDefined();
      expect(lowGroupTask?.score).toBe(0.4);
      expect(lowGroupTask?.description).toContain('DEFAULT_TIMEOUT');
    });
  });

  describe('remediation suggestions', () => {
    it('should include comprehensive suggestions for individual class exports', () => {
      baseAnalysis.testAnalysis.untestedExports = [
        {
          file: 'src/api/user-service.ts',
          exportName: 'UserService',
          exportType: 'class',
          line: 10,
          isPublic: true
        }
      ];

      const candidates = analyzer.analyze(baseAnalysis);

      const classTask = candidates.find(c =>
        c.candidateId.includes('UserService')
      );
      const suggestions = classTask?.remediationSuggestions || [];

      expect(suggestions.length).toBeGreaterThan(0);

      // Should have primary testing suggestion with test file location
      const primarySuggestion = suggestions.find(s =>
        s.type === 'testing' &&
        s.description.includes('Create class tests in')
      );
      expect(primarySuggestion).toBeDefined();
      expect(primarySuggestion?.description).toContain('src/api/user-service.test.ts');
      expect(primarySuggestion?.command).toContain('import { UserService }');

      // Should have class-specific test method suggestions
      const methodSuggestion = suggestions.find(s =>
        s.type === 'manual_review' &&
        s.description.includes('Test all public methods')
      );
      expect(methodSuggestion).toBeDefined();

      // Should have class template suggestion
      const templateSuggestion = suggestions.find(s =>
        s.type === 'testing' &&
        s.description.includes('Use class testing template')
      );
      expect(templateSuggestion).toBeDefined();
      expect(templateSuggestion?.command).toContain('describe(\'UserService\'');

      // Should have integration test suggestion for public API
      const integrationSuggestion = suggestions.find(s =>
        s.type === 'testing' &&
        s.description.includes('Add integration tests for public API')
      );
      expect(integrationSuggestion).toBeDefined();
      expect(integrationSuggestion?.warning).toContain('Public APIs require both unit and integration tests');
    });

    it('should include function-specific suggestions', () => {
      baseAnalysis.testAnalysis.untestedExports = [
        {
          file: 'src/utils/helpers.ts',
          exportName: 'formatDate',
          exportType: 'function',
          line: 25,
          isPublic: false
        }
      ];

      const candidates = analyzer.analyze(baseAnalysis);

      const functionTask = candidates.find(c =>
        c.candidateId.includes('formatDate')
      );
      const suggestions = functionTask?.remediationSuggestions || [];

      // Should have primary testing suggestion
      const primarySuggestion = suggestions.find(s =>
        s.type === 'testing' &&
        s.description.includes('Create function tests in')
      );
      expect(primarySuggestion).toBeDefined();
      expect(primarySuggestion?.description).toContain('src/utils/helpers.test.ts');
      expect(primarySuggestion?.command).toContain('import { formatDate }');

      // Should have function template suggestion
      const templateSuggestion = suggestions.find(s =>
        s.type === 'testing' &&
        s.description.includes('Use function testing template')
      );
      expect(templateSuggestion).toBeDefined();
      expect(templateSuggestion?.command).toContain('should return expected result with valid input');
      expect(templateSuggestion?.command).toContain('should handle edge cases');
    });

    it('should include grouped export suggestions with file organization', () => {
      const groupedExports = [
        {
          file: 'src/utils/math.ts',
          exportName: 'add',
          exportType: 'function' as const,
          line: 10,
          isPublic: true
        },
        {
          file: 'src/utils/math.ts',
          exportName: 'subtract',
          exportType: 'function' as const,
          line: 20,
          isPublic: false
        },
        {
          file: 'src/utils/string.ts',
          exportName: 'capitalize',
          exportType: 'function' as const,
          line: 15,
          isPublic: true
        }
      ];

      baseAnalysis.testAnalysis.untestedExports = groupedExports;

      const candidates = analyzer.analyze(baseAnalysis);

      const groupedTask = candidates.find(c =>
        c.candidateId === 'tests-untested-exports-group-high'
      );
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

      // Should have grouped test execution suggestion
      const executionSuggestion = suggestions.find(s =>
        s.type === 'testing' &&
        s.command === 'npm run test -- --testNamePattern="add|subtract|capitalize"'
      );
      expect(executionSuggestion).toBeDefined();
    });

    it('should provide coverage analysis suggestions', () => {
      baseAnalysis.testAnalysis.untestedExports = [
        {
          file: 'src/core/service.ts',
          exportName: 'CoreService',
          exportType: 'class',
          line: 10,
          isPublic: true
        }
      ];

      const candidates = analyzer.analyze(baseAnalysis);

      const serviceTask = candidates.find(c =>
        c.candidateId.includes('CoreService')
      );
      const suggestions = serviceTask?.remediationSuggestions || [];

      // Should have coverage verification suggestion
      const coverageSuggestion = suggestions.find(s =>
        s.command === 'npm run test -- --coverage'
      );
      expect(coverageSuggestion).toBeDefined();
      expect(coverageSuggestion?.expectedOutcome).toContain('improved test coverage');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty untested exports array', () => {
      baseAnalysis.testAnalysis.untestedExports = [];

      const candidates = analyzer.analyze(baseAnalysis);

      const exportTasks = candidates.filter(c =>
        c.candidateId.includes('untested-export')
      );

      expect(exportTasks.length).toBe(0);
    });

    it('should handle exports with missing properties', () => {
      baseAnalysis.testAnalysis.untestedExports = [
        {
          file: 'src/incomplete.ts',
          exportName: 'incompleteExport',
          exportType: 'function',
          // Missing line property
          isPublic: true
        } as any,
        {
          file: 'src/another.ts',
          exportName: '', // Empty name
          exportType: 'const',
          line: 15,
          isPublic: false
        }
      ];

      expect(() => {
        const candidates = analyzer.analyze(baseAnalysis);
        expect(candidates.length).toBeGreaterThan(0);
      }).not.toThrow();
    });

    it('should handle undefined export properties gracefully', () => {
      baseAnalysis.testAnalysis.untestedExports = [
        {
          file: undefined as any,
          exportName: 'testExport',
          exportType: 'function',
          line: 10,
          isPublic: true
        }
      ];

      expect(() => {
        const candidates = analyzer.analyze(baseAnalysis);
        // Should handle gracefully
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });

    it('should handle very large numbers of exports', () => {
      const manyExports = Array.from({ length: 50 }, (_, i) => ({
        file: `src/file${Math.floor(i / 5)}.ts`,
        exportName: `export${i}`,
        exportType: 'function' as const,
        line: 10 + i,
        isPublic: i % 3 === 0 // Mix of public and private
      }));

      baseAnalysis.testAnalysis.untestedExports = manyExports;

      const candidates = analyzer.analyze(baseAnalysis);

      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates.some(c => c.candidateId.includes('group'))).toBe(true);

      // Should maintain performance with large datasets
      candidates.forEach(candidate => {
        expect(candidate.score).toBeGreaterThan(0);
        expect(candidate.score).toBeLessThanOrEqual(1);
        expect(candidate.remediationSuggestions?.length).toBeGreaterThan(0);
      });
    });

    it('should handle missing testAnalysis untested exports', () => {
      const incompleteAnalysis = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          untestedExports: undefined as any
        }
      };

      expect(() => {
        const candidates = analyzer.analyze(incompleteAnalysis);
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });

    it('should maintain task structure consistency', () => {
      baseAnalysis.testAnalysis.untestedExports = [
        {
          file: 'src/test.ts',
          exportName: 'testFunction',
          exportType: 'function',
          line: 10,
          isPublic: true
        }
      ];

      const candidates = analyzer.analyze(baseAnalysis);

      const exportTask = candidates.find(c =>
        c.candidateId.includes('testFunction')
      );

      expect(exportTask).toBeDefined();
      expect(exportTask?.candidateId).toMatch(/^tests-/);
      expect(exportTask?.suggestedWorkflow).toBe('testing');
      expect(['low', 'normal', 'high', 'urgent']).toContain(exportTask?.priority);
      expect(['low', 'medium', 'high']).toContain(exportTask?.estimatedEffort);
      expect(exportTask?.score).toBeGreaterThan(0);
      expect(exportTask?.score).toBeLessThanOrEqual(1);
      expect(exportTask?.rationale).toBeTruthy();
      expect(exportTask?.description).toBeTruthy();
      expect(exportTask?.remediationSuggestions?.length).toBeGreaterThan(0);
    });
  });

  describe('test file path generation', () => {
    it('should generate correct test file paths for different source structures', () => {
      baseAnalysis.testAnalysis.untestedExports = [
        {
          file: 'src/components/Button.tsx',
          exportName: 'Button',
          exportType: 'function',
          line: 10,
          isPublic: true
        },
        {
          file: 'src/utils/helpers/string.js',
          exportName: 'capitalize',
          exportType: 'function',
          line: 15,
          isPublic: true
        }
      ];

      const candidates = analyzer.analyze(baseAnalysis);

      const buttonTask = candidates.find(c =>
        c.candidateId.includes('Button')
      );
      const stringTask = candidates.find(c =>
        c.candidateId.includes('capitalize')
      );

      const buttonSuggestions = buttonTask?.remediationSuggestions || [];
      const stringSuggestions = stringTask?.remediationSuggestions || [];

      const buttonTestSuggestion = buttonSuggestions.find(s =>
        s.description.includes('src/components/Button.test.tsx')
      );
      const stringTestSuggestion = stringSuggestions.find(s =>
        s.description.includes('src/utils/helpers/string.test.js')
      );

      expect(buttonTestSuggestion).toBeDefined();
      expect(stringTestSuggestion).toBeDefined();
    });

    it('should handle relative import path generation', () => {
      baseAnalysis.testAnalysis.untestedExports = [
        {
          file: 'src/services/deep/nested/auth.ts',
          exportName: 'authenticate',
          exportType: 'function',
          line: 20,
          isPublic: true
        }
      ];

      const candidates = analyzer.analyze(baseAnalysis);

      const authTask = candidates.find(c =>
        c.candidateId.includes('authenticate')
      );
      const suggestions = authTask?.remediationSuggestions || [];

      const testSuggestion = suggestions.find(s =>
        s.type === 'testing' &&
        s.command?.includes('import { authenticate }')
      );

      expect(testSuggestion).toBeDefined();
      expect(testSuggestion?.command).toContain('./auth');
    });
  });
});
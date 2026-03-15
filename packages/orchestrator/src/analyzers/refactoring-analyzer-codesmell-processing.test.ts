/**
 * RefactoringAnalyzer Code Smell Processing Tests
 *
 * Tests for comprehensive code smell detection, categorization, and processing
 * that validates the acceptance criteria:
 * - Process codeSmells from codeQuality section
 * - Map to 'code-smell' categories
 * - Calculate appropriate severity scores for different smell types
 * - Generate type-specific recommendations and rationales
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RefactoringAnalyzer } from './refactoring-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type { CodeSmell } from '@apexcli/core';

describe('RefactoringAnalyzer - Code Smell Processing Tests', () => {
  let analyzer: RefactoringAnalyzer;
  let baseAnalysis: ProjectAnalysis;

  beforeEach(() => {
    analyzer = new RefactoringAnalyzer();

    baseAnalysis = {
      codebaseSize: {
        files: 100,
        lines: 12000,
        languages: { 'ts': 80, 'js': 20 }
      },
      dependencies: {
        outdated: [],
        security: []
      },
      codeQuality: {
        lintIssues: 0,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: {
        coverage: 75,
        missingDocs: [],
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 80,
          details: {
            totalEndpoints: 20,
            documentedEndpoints: 16,
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
      testAnalysis: {
        branchCoverage: {
          percentage: 85,
          uncoveredBranches: []
        },
        untestedExports: [],
        testAntiPatterns: [],
        missedAssertions: []
      }
    };
  });

  describe('code smell type processing', () => {
    it('should process long-method code smells with appropriate recommendations', () => {
      const longMethodSmells: CodeSmell[] = [
        {
          file: 'src/services/PaymentService.ts',
          type: 'long-method',
          severity: 'high',
          details: 'Method processPayment has 95 lines with complex branching logic'
        },
        {
          file: 'src/utils/DataProcessor.ts',
          type: 'long-method',
          severity: 'medium',
          details: 'Method processData has 75 lines and handles multiple concerns'
        }
      ];

      baseAnalysis.codeQuality.codeSmells = longMethodSmells;

      const candidates = analyzer.analyze(baseAnalysis);
      const longMethodTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');

      expect(longMethodTask).toBeDefined();
      expect(longMethodTask!.title).toBe('Refactor Long Methods');
      expect(longMethodTask!.description).toContain('2 long methods');
      expect(longMethodTask!.description).toContain('PaymentService.ts, DataProcessor.ts');

      // Should include specific long-method recommendations
      expect(longMethodTask!.rationale).toContain('Break long methods into smaller, focused functions');
      expect(longMethodTask!.rationale).toContain('Extract common logic into utility methods');
      expect(longMethodTask!.rationale).toContain('Use the Single Responsibility Principle');
      expect(longMethodTask!.rationale).toContain('Consider using method objects for complex algorithms');

      // Should include details from both smells
      expect(longMethodTask!.rationale).toContain('processPayment has 95 lines');
      expect(longMethodTask!.rationale).toContain('processData has 75 lines');

      expect(longMethodTask!.priority).toBe('high'); // High due to high severity smell
      expect(longMethodTask!.suggestedWorkflow).toBe('refactoring');
    });

    it('should process large-class code smells with appropriate recommendations', () => {
      const largeClassSmells: CodeSmell[] = [
        {
          file: 'src/models/UserManager.ts',
          type: 'large-class',
          severity: 'critical',
          details: 'Class UserManager has 750 lines and handles user auth, profile, preferences, and notifications'
        }
      ];

      baseAnalysis.codeQuality.codeSmells = largeClassSmells;

      const candidates = analyzer.analyze(baseAnalysis);
      const largeClassTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class');

      expect(largeClassTask).toBeDefined();
      expect(largeClassTask!.title).toBe('Break Down Large Classes');
      expect(largeClassTask!.description).toContain('1 oversized class');
      expect(largeClassTask!.description).toContain('UserManager.ts');

      // Should include specific large-class recommendations
      expect(largeClassTask!.rationale).toContain('Apply Single Responsibility Principle to split classes');
      expect(largeClassTask!.rationale).toContain('Extract related functionality into separate modules');
      expect(largeClassTask!.rationale).toContain('Use composition over inheritance where appropriate');
      expect(largeClassTask!.rationale).toContain('Consider using facade pattern to simplify interfaces');

      expect(largeClassTask!.priority).toBe('urgent'); // Critical severity
    });

    it('should process deep-nesting code smells with appropriate recommendations', () => {
      const deepNestingSmells: CodeSmell[] = [
        {
          file: 'src/validators/FormValidator.ts',
          type: 'deep-nesting',
          severity: 'high',
          details: 'Validation logic has 7 levels of nested conditionals making it hard to follow'
        }
      ];

      baseAnalysis.codeQuality.codeSmells = deepNestingSmells;

      const candidates = analyzer.analyze(baseAnalysis);
      const deepNestingTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-deep-nesting');

      expect(deepNestingTask).toBeDefined();
      expect(deepNestingTask!.title).toBe('Reduce Deep Nesting');

      // Should include specific deep-nesting recommendations
      expect(deepNestingTask!.rationale).toContain('Use early returns to reduce nesting levels');
      expect(deepNestingTask!.rationale).toContain('Extract nested logic into separate methods');
      expect(deepNestingTask!.rationale).toContain('Replace complex conditionals with polymorphism');
      expect(deepNestingTask!.rationale).toContain('Apply guard clauses for input validation');
    });

    it('should process duplicate-code smell type (different from duplicatedCode analysis)', () => {
      const duplicateCodeSmells: CodeSmell[] = [
        {
          file: 'src/helpers/ValidationHelpers.ts',
          type: 'duplicate-code',
          severity: 'medium',
          details: 'Similar validation patterns found in 4 different methods within the same file'
        }
      ];

      baseAnalysis.codeQuality.codeSmells = duplicateCodeSmells;

      const candidates = analyzer.analyze(baseAnalysis);
      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-duplicate-code');

      expect(duplicateTask).toBeDefined();
      expect(duplicateTask!.title).toBe('Eliminate Code Duplication');

      // Should include specific duplicate-code recommendations
      expect(duplicateTask!.rationale).toContain('Extract common code into reusable functions');
      expect(duplicateTask!.rationale).toContain('Create utility modules for shared logic');
      expect(duplicateTask!.rationale).toContain('Use inheritance or composition for similar classes');
      expect(duplicateTask!.rationale).toContain("Apply DRY (Don't Repeat Yourself) principle");
    });

    it('should process dead-code smells with appropriate recommendations', () => {
      const deadCodeSmells: CodeSmell[] = [
        {
          file: 'src/legacy/DeprecatedAuth.ts',
          type: 'dead-code',
          severity: 'low',
          details: 'Unused authentication methods from previous implementation - 3 functions, 150 lines'
        }
      ];

      baseAnalysis.codeQuality.codeSmells = deadCodeSmells;

      const candidates = analyzer.analyze(baseAnalysis);
      const deadCodeTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-dead-code');

      expect(deadCodeTask).toBeDefined();
      expect(deadCodeTask!.title).toBe('Remove Dead Code');

      // Should include specific dead-code recommendations
      expect(deadCodeTask!.rationale).toContain('Remove unused functions, variables, and imports');
      expect(deadCodeTask!.rationale).toContain('Clean up commented-out code blocks');
      expect(deadCodeTask!.rationale).toContain('Delete unreachable code paths');
      expect(deadCodeTask!.rationale).toContain('Use static analysis tools to identify dead code');
    });

    it('should process magic-numbers smells with appropriate recommendations', () => {
      const magicNumbersSmells: CodeSmell[] = [
        {
          file: 'src/config/ApiConfig.ts',
          type: 'magic-numbers',
          severity: 'medium',
          details: 'Hardcoded timeout values 30000, 60000, retry counts 3, 5 without explanation'
        }
      ];

      baseAnalysis.codeQuality.codeSmells = magicNumbersSmells;

      const candidates = analyzer.analyze(baseAnalysis);
      const magicNumbersTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-magic-numbers');

      expect(magicNumbersTask).toBeDefined();
      expect(magicNumbersTask!.title).toBe('Replace Magic Numbers');

      // Should include specific magic-numbers recommendations
      expect(magicNumbersTask!.rationale).toContain('Replace numbers with named constants');
      expect(magicNumbersTask!.rationale).toContain('Use enums for related constant values');
      expect(magicNumbersTask!.rationale).toContain('Group constants in configuration objects');
      expect(magicNumbersTask!.rationale).toContain('Add comments explaining the meaning of numbers');
    });

    it('should process feature-envy smells with appropriate recommendations', () => {
      const featureEnvySmells: CodeSmell[] = [
        {
          file: 'src/services/NotificationService.ts',
          type: 'feature-envy',
          severity: 'medium',
          details: 'Method formatUserNotification accesses more User properties than NotificationService properties'
        }
      ];

      baseAnalysis.codeQuality.codeSmells = featureEnvySmells;

      const candidates = analyzer.analyze(baseAnalysis);
      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');

      expect(featureEnvyTask).toBeDefined();
      expect(featureEnvyTask!.title).toBe('Fix Feature Envy');

      // Should include specific feature-envy recommendations
      expect(featureEnvyTask!.rationale).toContain('Move methods closer to the data they use');
      expect(featureEnvyTask!.rationale).toContain('Extract methods into the appropriate classes');
      expect(featureEnvyTask!.rationale).toContain("Use delegation pattern when moving isn't possible");
      expect(featureEnvyTask!.rationale).toContain('Consider creating new classes for complex interactions');
    });

    it('should process data-clumps smells with appropriate recommendations', () => {
      const dataClumpsSmells: CodeSmell[] = [
        {
          file: 'src/api/UserController.ts',
          type: 'data-clumps',
          severity: 'medium',
          details: 'Parameters firstName, lastName, email, phoneNumber always passed together in 5 methods'
        }
      ];

      baseAnalysis.codeQuality.codeSmells = dataClumpsSmells;

      const candidates = analyzer.analyze(baseAnalysis);
      const dataClumpsTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-data-clumps');

      expect(dataClumpsTask).toBeDefined();
      expect(dataClumpsTask!.title).toBe('Consolidate Data Clumps');

      // Should include specific data-clumps recommendations
      expect(dataClumpsTask!.rationale).toContain('Create parameter objects for grouped data');
      expect(dataClumpsTask!.rationale).toContain('Extract data into domain-specific classes');
      expect(dataClumpsTask!.rationale).toContain('Use value objects for related parameters');
      expect(dataClumpsTask!.rationale).toContain('Consider using builder pattern for complex objects');
    });

    it('should handle unknown code smell types gracefully', () => {
      const unknownSmells: CodeSmell[] = [
        {
          file: 'src/unknown/UnknownService.ts',
          type: 'unknown-smell-type' as any,
          severity: 'medium',
          details: 'Some unknown code smell detected by a custom analyzer'
        }
      ];

      baseAnalysis.codeQuality.codeSmells = unknownSmells;

      const candidates = analyzer.analyze(baseAnalysis);
      const unknownTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-unknown-smell-type');

      expect(unknownTask).toBeDefined();
      expect(unknownTask!.title).toBe('Fix unknown-smell-type Code Smells');
      expect(unknownTask!.description).toContain('1 unknown-smell-type issue');
      expect(unknownTask!.rationale).toContain("Code smell type 'unknown-smell-type' detected");
    });
  });

  describe('code smell grouping and aggregation', () => {
    it('should group multiple code smells of the same type correctly', () => {
      const multipleLongMethods: CodeSmell[] = [
        {
          file: 'src/service1.ts',
          type: 'long-method',
          severity: 'high',
          details: 'Method processOrder has 90 lines'
        },
        {
          file: 'src/service2.ts',
          type: 'long-method',
          severity: 'medium',
          details: 'Method calculateTax has 70 lines'
        },
        {
          file: 'src/service3.ts',
          type: 'long-method',
          severity: 'critical',
          details: 'Method processPayment has 150 lines and handles critical business logic'
        }
      ];

      baseAnalysis.codeQuality.codeSmells = multipleLongMethods;

      const candidates = analyzer.analyze(baseAnalysis);
      const longMethodTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');

      expect(longMethodTask).toBeDefined();
      expect(longMethodTask!.description).toContain('3 long methods');
      expect(longMethodTask!.description).toContain('service1.ts, service2.ts, service3.ts');

      // Should take highest severity (critical) for overall classification
      expect(longMethodTask!.priority).toBe('urgent');
      expect(longMethodTask!.estimatedEffort).toBe('high');

      // Should include details from all smells
      expect(longMethodTask!.rationale).toContain('processOrder has 90 lines');
      expect(longMethodTask!.rationale).toContain('calculateTax has 70 lines');
      expect(longMethodTask!.rationale).toContain('processPayment has 150 lines');
    });

    it('should create separate tasks for different code smell types', () => {
      const mixedCodeSmells: CodeSmell[] = [
        {
          file: 'src/file1.ts',
          type: 'long-method',
          severity: 'high',
          details: 'Long method detected'
        },
        {
          file: 'src/file2.ts',
          type: 'large-class',
          severity: 'medium',
          details: 'Large class detected'
        },
        {
          file: 'src/file3.ts',
          type: 'deep-nesting',
          severity: 'high',
          details: 'Deep nesting detected'
        }
      ];

      baseAnalysis.codeQuality.codeSmells = mixedCodeSmells;

      const candidates = analyzer.analyze(baseAnalysis);
      const codeSmellTasks = candidates.filter(c => c.candidateId.includes('code-smell-'));

      expect(codeSmellTasks).toHaveLength(3);

      const taskIds = codeSmellTasks.map(t => t.candidateId);
      expect(taskIds).toContain('refactoring-code-smell-long-method');
      expect(taskIds).toContain('refactoring-code-smell-large-class');
      expect(taskIds).toContain('refactoring-code-smell-deep-nesting');
    });

    it('should handle large numbers of smells for same type efficiently', () => {
      const manyLongMethods: CodeSmell[] = Array.from({ length: 15 }, (_, i) => ({
        file: `src/service${i}.ts`,
        type: 'long-method' as const,
        severity: 'medium' as const,
        details: `Method in service${i} has too many lines`
      }));

      baseAnalysis.codeQuality.codeSmells = manyLongMethods;

      const candidates = analyzer.analyze(baseAnalysis);
      const longMethodTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');

      expect(longMethodTask).toBeDefined();
      expect(longMethodTask!.description).toContain('15 long methods');

      // Should mention first 3 files and indicate more
      expect(longMethodTask!.description).toContain('service0.ts, service1.ts, service2.ts, and 12 more');

      // Should get higher score due to large count
      expect(longMethodTask!.score).toBeGreaterThan(0.7); // Base medium + count bonuses
    });

    it('should calculate overall severity based on individual smell severities', () => {
      const mixedSeveritySmells: CodeSmell[] = [
        {
          file: 'src/file1.ts',
          type: 'long-method',
          severity: 'low',
          details: 'Low severity method'
        },
        {
          file: 'src/file2.ts',
          type: 'long-method',
          severity: 'medium',
          details: 'Medium severity method'
        },
        {
          file: 'src/file3.ts',
          type: 'long-method',
          severity: 'critical',
          details: 'Critical severity method'
        }
      ];

      baseAnalysis.codeQuality.codeSmells = mixedSeveritySmells;

      const candidates = analyzer.analyze(baseAnalysis);
      const task = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');

      // Should take highest severity (critical) for classification
      expect(task!.priority).toBe('urgent');
      expect(task!.estimatedEffort).toBe('high');
      expect(task!.score).toBe(0.85); // Critical base score
    });
  });

  describe('code smell categorization', () => {
    it('should map all code smell tasks to refactoring workflow', () => {
      const variousCodeSmells: CodeSmell[] = [
        {
          file: 'src/file1.ts',
          type: 'long-method',
          severity: 'medium',
          details: 'Long method'
        },
        {
          file: 'src/file2.ts',
          type: 'large-class',
          severity: 'medium',
          details: 'Large class'
        },
        {
          file: 'src/file3.ts',
          type: 'feature-envy',
          severity: 'medium',
          details: 'Feature envy'
        }
      ];

      baseAnalysis.codeQuality.codeSmells = variousCodeSmells;

      const candidates = analyzer.analyze(baseAnalysis);
      const codeSmellTasks = candidates.filter(c => c.candidateId.includes('code-smell-'));

      expect(codeSmellTasks).toHaveLength(3);

      // All code smell tasks should use refactoring workflow
      codeSmellTasks.forEach(task => {
        expect(task.suggestedWorkflow).toBe('refactoring');
        expect(task.candidateId).toMatch(/^refactoring-code-smell-/);
      });
    });

    it('should create proper candidate IDs for all code smell types', () => {
      const allSmellTypes: CodeSmell[] = [
        { file: 'src/1.ts', type: 'long-method', severity: 'medium', details: 'Long method' },
        { file: 'src/2.ts', type: 'large-class', severity: 'medium', details: 'Large class' },
        { file: 'src/3.ts', type: 'deep-nesting', severity: 'medium', details: 'Deep nesting' },
        { file: 'src/4.ts', type: 'duplicate-code', severity: 'medium', details: 'Duplicate code' },
        { file: 'src/5.ts', type: 'dead-code', severity: 'medium', details: 'Dead code' },
        { file: 'src/6.ts', type: 'magic-numbers', severity: 'medium', details: 'Magic numbers' },
        { file: 'src/7.ts', type: 'feature-envy', severity: 'medium', details: 'Feature envy' },
        { file: 'src/8.ts', type: 'data-clumps', severity: 'medium', details: 'Data clumps' }
      ];

      baseAnalysis.codeQuality.codeSmells = allSmellTypes;

      const candidates = analyzer.analyze(baseAnalysis);
      const codeSmellTasks = candidates.filter(c => c.candidateId.includes('code-smell-'));

      expect(codeSmellTasks).toHaveLength(8);

      const expectedIds = [
        'refactoring-code-smell-long-method',
        'refactoring-code-smell-large-class',
        'refactoring-code-smell-deep-nesting',
        'refactoring-code-smell-duplicate-code',
        'refactoring-code-smell-dead-code',
        'refactoring-code-smell-magic-numbers',
        'refactoring-code-smell-feature-envy',
        'refactoring-code-smell-data-clumps'
      ];

      const taskIds = codeSmellTasks.map(t => t.candidateId).sort();
      expect(taskIds).toEqual(expectedIds.sort());
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty code smells array', () => {
      baseAnalysis.codeQuality.codeSmells = [];

      const candidates = analyzer.analyze(baseAnalysis);
      const codeSmellTasks = candidates.filter(c => c.candidateId.includes('code-smell-'));

      expect(codeSmellTasks).toHaveLength(0);
    });

    it('should handle null or undefined code smells gracefully', () => {
      baseAnalysis.codeQuality.codeSmells = null as any;

      expect(() => {
        const candidates = analyzer.analyze(baseAnalysis);
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });

    it('should handle malformed code smell objects gracefully', () => {
      const malformedSmells = [
        {
          file: 'src/valid.ts',
          type: 'long-method',
          severity: 'medium',
          details: 'Valid code smell'
        },
        {
          // Missing required fields
          type: undefined,
          severity: null,
          details: ''
        },
        null, // Null entry
        {
          file: 'src/incomplete.ts',
          // Missing type and other fields
          severity: 'high'
        }
      ] as any[];

      baseAnalysis.codeQuality.codeSmells = malformedSmells;

      expect(() => {
        const candidates = analyzer.analyze(baseAnalysis);
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });

    it('should handle code smells with invalid severity values', () => {
      const invalidSeveritySmells: CodeSmell[] = [
        {
          file: 'src/invalid-severity.ts',
          type: 'long-method',
          severity: 'invalid-severity' as any,
          details: 'Code smell with invalid severity'
        }
      ];

      baseAnalysis.codeQuality.codeSmells = invalidSeveritySmells;

      expect(() => {
        const candidates = analyzer.analyze(baseAnalysis);
        const task = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');

        if (task) {
          // Should handle gracefully and assign some default priority
          expect(task.priority).toBeDefined();
          expect(task.score).toBeGreaterThan(0);
        }
      }).not.toThrow();
    });

    it('should handle extremely long file paths and details gracefully', () => {
      const longPathSmell: CodeSmell = {
        file: 'src/extremely/long/nested/path/that/goes/on/and/on/through/many/directories/and/subdirectories/until/it/becomes/unwieldy/ExtremelyLongFileNameThatSomeoneWroteForSomeReason.ts',
        type: 'long-method',
        severity: 'medium',
        details: 'This is an extremely long description that goes on and on about the code smell, providing excessive detail about what the problem is, why it occurs, how it manifests, what the impact might be, and various other considerations that make this description unusually verbose and lengthy for a typical code smell detection system.'
      };

      baseAnalysis.codeQuality.codeSmells = [longPathSmell];

      expect(() => {
        const candidates = analyzer.analyze(baseAnalysis);
        const task = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');

        expect(task).toBeDefined();
        expect(task!.description).toContain('1 long method');
        expect(task!.rationale).toContain('extremely long description');
      }).not.toThrow();
    });

    it('should handle Unicode characters in code smell data', () => {
      const unicodeSmell: CodeSmell = {
        file: 'src/国际化/服务.ts', // Chinese characters
        type: 'long-method',
        severity: 'medium',
        details: 'Method 处理复杂业务逻辑 has too many lines'
      };

      baseAnalysis.codeQuality.codeSmells = [unicodeSmell];

      expect(() => {
        const candidates = analyzer.analyze(baseAnalysis);
        const task = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');

        expect(task).toBeDefined();
        expect(task!.description).toContain('服务.ts');
        expect(task!.rationale).toContain('处理复杂业务逻辑');
      }).not.toThrow();
    });
  });

  describe('integration with other RefactoringAnalyzer features', () => {
    it('should process both code smells and complexity hotspots in same analysis', () => {
      const codeSmells: CodeSmell[] = [
        {
          file: 'src/smelly.ts',
          type: 'long-method',
          severity: 'high',
          details: 'Long method smell'
        }
      ];

      const complexityHotspots = [
        {
          file: 'src/complex.ts',
          functionName: 'complexFunction',
          cyclomaticComplexity: 40,
          cognitiveComplexity: 45,
          lineCount: 800
        }
      ];

      baseAnalysis.codeQuality.codeSmells = codeSmells;
      baseAnalysis.codeQuality.complexityHotspots = complexityHotspots;

      const candidates = analyzer.analyze(baseAnalysis);

      const codeSmellTasks = candidates.filter(c => c.candidateId.includes('code-smell-'));
      const complexityTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

      expect(codeSmellTasks).toHaveLength(1);
      expect(complexityTasks).toHaveLength(1);

      // Both should be processed independently
      expect(codeSmellTasks[0].title).toBe('Refactor Long Methods');
      expect(complexityTasks[0].title).toBe('Refactor complex.ts');
    });

    it('should maintain proper task ordering across all refactoring types', () => {
      // Setup mixed refactoring data with different priorities
      baseAnalysis.codeQuality = {
        lintIssues: 100, // Should create normal priority task
        duplicatedCode: ['src/dup1.ts', 'src/dup2.ts'], // Should create high priority task
        complexityHotspots: [
          {
            file: 'src/critical.ts',
            functionName: 'criticalFunction',
            cyclomaticComplexity: 65,
            cognitiveComplexity: 70,
            lineCount: 2200
          }
        ], // Should create urgent priority task
        codeSmells: [
          {
            file: 'src/smell.ts',
            type: 'large-class',
            severity: 'critical',
            details: 'Critical code smell'
          }
        ] // Should create urgent priority task
      };

      const candidates = analyzer.analyze(baseAnalysis);

      // Should have all types of refactoring tasks
      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      const complexityTask = candidates.find(c => c.candidateId.includes('complexity-hotspot-'));
      const smellTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class');
      const lintTask = candidates.find(c => c.candidateId === 'refactoring-lint-issues');

      expect(duplicateTask).toBeDefined();
      expect(complexityTask).toBeDefined();
      expect(smellTask).toBeDefined();
      expect(lintTask).toBeDefined();

      // Critical/urgent tasks should have higher scores than normal priority
      expect(complexityTask!.score).toBeGreaterThan(lintTask!.score);
      expect(smellTask!.score).toBeGreaterThan(lintTask!.score);
      expect(duplicateTask!.score).toBeGreaterThan(lintTask!.score);
    });
  });
});
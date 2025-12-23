/**
 * RefactoringAnalyzer Feature Envy Pattern Detection Tests
 *
 * Comprehensive tests specifically for feature envy pattern detection including:
 * - Various severity levels and their priority mapping
 * - Multiple feature envy instances in a project
 * - Edge cases and error handling
 * - Integration with other code smell types
 * - Recommendation accuracy and actionability
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RefactoringAnalyzer } from './refactoring-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type { CodeSmell } from '@apexcli/core';

describe('RefactoringAnalyzer - Feature Envy Pattern Detection', () => {
  let refactoringAnalyzer: RefactoringAnalyzer;
  let baseProjectAnalysis: ProjectAnalysis;

  beforeEach(() => {
    refactoringAnalyzer = new RefactoringAnalyzer();

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
        lintIssues: 0,
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
      }
    };
  });

  describe('Feature Envy Code Smell Detection', () => {
    it('should detect single feature envy pattern and generate appropriate task', () => {
      const featureEnvySmell: CodeSmell = {
        file: 'src/services/NotificationService.ts',
        type: 'feature-envy',
        severity: 'medium',
        details: 'Method sendNotification uses 8 properties from User class but only 2 from its own'
      };

      baseProjectAnalysis.codeQuality.codeSmells = [featureEnvySmell];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      expect(candidates).toHaveLength(1);

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask).toBeDefined();
      expect(featureEnvyTask?.title).toBe('Fix Feature Envy');
      expect(featureEnvyTask?.description).toBe('Relocate 1 misplaced method in NotificationService.ts');
      expect(featureEnvyTask?.priority).toBe('normal');
      expect(featureEnvyTask?.estimatedEffort).toBe('medium');
      expect(featureEnvyTask?.suggestedWorkflow).toBe('refactoring');
      expect(featureEnvyTask?.candidateId).toBe('refactoring-code-smell-feature-envy');
    });

    it('should handle multiple feature envy instances in different files', () => {
      const multipleFeatureEnvySmells: CodeSmell[] = [
        {
          file: 'src/services/EmailService.ts',
          type: 'feature-envy',
          severity: 'medium',
          details: 'sendEmail method accesses 12 properties from User object but only 3 from its own class'
        },
        {
          file: 'src/controllers/UserController.ts',
          type: 'feature-envy',
          severity: 'high',
          details: 'validateUserInput method heavily relies on ValidationRules class properties (15 accesses vs 2 local)'
        },
        {
          file: 'src/utils/FormatHelper.ts',
          type: 'feature-envy',
          severity: 'low',
          details: 'formatAddress method uses 4 Address properties but only 1 from FormatHelper'
        }
      ];

      baseProjectAnalysis.codeQuality.codeSmells = multipleFeatureEnvySmells;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      expect(candidates).toHaveLength(1); // Should group by type

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask).toBeDefined();
      expect(featureEnvyTask?.title).toBe('Fix Feature Envy');
      expect(featureEnvyTask?.description).toContain('3 misplaced methods');
      expect(featureEnvyTask?.description).toContain('EmailService.ts, UserController.ts, FormatHelper.ts');
      expect(featureEnvyTask?.priority).toBe('high'); // Should be high due to high severity smell
      expect(featureEnvyTask?.estimatedEffort).toBe('high');
    });

    it('should provide detailed rationale with feature envy recommendations', () => {
      const featureEnvySmell: CodeSmell = {
        file: 'src/business/OrderProcessor.ts',
        type: 'feature-envy',
        severity: 'medium',
        details: 'calculateShipping method extensively uses Customer and Product data instead of order data'
      };

      baseProjectAnalysis.codeQuality.codeSmells = [featureEnvySmell];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask).toBeDefined();
      expect(featureEnvyTask?.rationale).toContain('Feature envy indicates poor method placement and weak cohesion');
      expect(featureEnvyTask?.rationale).toContain('Move methods closer to the data they use');
      expect(featureEnvyTask?.rationale).toContain('Extract methods into the appropriate classes');
      expect(featureEnvyTask?.rationale).toContain('Use delegation pattern when moving isn\'t possible');
      expect(featureEnvyTask?.rationale).toContain('Consider creating new classes for complex interactions');
      expect(featureEnvyTask?.rationale).toContain('calculateShipping method extensively uses Customer and Product data');
    });

    it('should handle critical severity feature envy with urgent priority', () => {
      const criticalFeatureEnvy: CodeSmell = {
        file: 'src/core/PaymentProcessor.ts',
        type: 'feature-envy',
        severity: 'critical',
        details: 'processPayment method uses 20+ properties from CreditCard, Bank, and Merchant classes while only using 1 local property - major architectural violation'
      };

      baseProjectAnalysis.codeQuality.codeSmells = [criticalFeatureEnvy];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask).toBeDefined();
      expect(featureEnvyTask?.priority).toBe('urgent');
      expect(featureEnvyTask?.estimatedEffort).toBe('high');
      expect(featureEnvyTask?.score).toBeGreaterThan(0.8);
    });

    it('should handle low severity feature envy appropriately', () => {
      const lowFeatureEnvy: CodeSmell = {
        file: 'src/helpers/StringHelper.ts',
        type: 'feature-envy',
        severity: 'low',
        details: 'capitalize method uses 2 String prototype methods but could be more cohesive'
      };

      baseProjectAnalysis.codeQuality.codeSmells = [lowFeatureEnvy];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask).toBeDefined();
      expect(featureEnvyTask?.priority).toBe('low');
      expect(featureEnvyTask?.estimatedEffort).toBe('low');
      expect(featureEnvyTask?.score).toBeLessThan(0.5);
    });
  });

  describe('Feature Envy Score Calculation', () => {
    it('should increase score for multiple feature envy instances', () => {
      const manyFeatureEnvySmells = Array.from({ length: 12 }, (_, i) => ({
        file: `src/service${i}.ts`,
        type: 'feature-envy' as const,
        severity: 'medium' as const,
        details: `Method ${i} envies external class data`
      }));

      baseProjectAnalysis.codeQuality.codeSmells = manyFeatureEnvySmells;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask).toBeDefined();
      // Score should be increased due to high count (>10)
      expect(featureEnvyTask?.score).toBeGreaterThan(0.8);
    });

    it('should cap score at maximum value of 0.95', () => {
      const manyHighSeverityFeatureEnvy = Array.from({ length: 20 }, (_, i) => ({
        file: `src/critical${i}.ts`,
        type: 'feature-envy' as const,
        severity: 'critical' as const,
        details: `Critical feature envy ${i}`
      }));

      baseProjectAnalysis.codeQuality.codeSmells = manyHighSeverityFeatureEnvy;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask).toBeDefined();
      expect(featureEnvyTask?.score).toBeLessThanOrEqual(0.95); // Should be capped
      expect(featureEnvyTask?.priority).toBe('urgent');
    });
  });

  describe('Feature Envy File Path Handling', () => {
    it('should handle long file paths gracefully', () => {
      const longPath = 'src/' + 'very-long-directory-name/'.repeat(10) + 'FeatureEnvyService.ts';
      const featureEnvySmell: CodeSmell = {
        file: longPath,
        type: 'feature-envy',
        severity: 'medium',
        details: 'Method envies external data'
      };

      baseProjectAnalysis.codeQuality.codeSmells = [featureEnvySmell];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask).toBeDefined();
      expect(featureEnvyTask?.description).toContain('FeatureEnvyService.ts'); // Should extract filename
    });

    it('should handle file paths without extension', () => {
      const featureEnvySmell: CodeSmell = {
        file: 'src/services/notification-service',
        type: 'feature-envy',
        severity: 'medium',
        details: 'Method envies external data'
      };

      baseProjectAnalysis.codeQuality.codeSmells = [featureEnvySmell];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask).toBeDefined();
      expect(featureEnvyTask?.description).toContain('notification-service');
    });

    it('should handle multiple files with truncation when more than 3', () => {
      const manyFeatureEnvySmells: CodeSmell[] = [
        { file: 'src/Service1.ts', type: 'feature-envy', severity: 'medium', details: 'Feature envy 1' },
        { file: 'src/Service2.ts', type: 'feature-envy', severity: 'medium', details: 'Feature envy 2' },
        { file: 'src/Service3.ts', type: 'feature-envy', severity: 'medium', details: 'Feature envy 3' },
        { file: 'src/Service4.ts', type: 'feature-envy', severity: 'medium', details: 'Feature envy 4' },
        { file: 'src/Service5.ts', type: 'feature-envy', severity: 'medium', details: 'Feature envy 5' }
      ];

      baseProjectAnalysis.codeQuality.codeSmells = manyFeatureEnvySmells;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask).toBeDefined();
      expect(featureEnvyTask?.description).toContain('Service1.ts, Service2.ts, Service3.ts, and 2 more');
    });
  });

  describe('Integration with Other Code Smells', () => {
    it('should handle feature envy alongside other code smell types', () => {
      const mixedCodeSmells: CodeSmell[] = [
        {
          file: 'src/services/UserService.ts',
          type: 'long-method',
          severity: 'high',
          details: 'validateUser method has 95 lines'
        },
        {
          file: 'src/services/EmailService.ts',
          type: 'feature-envy',
          severity: 'medium',
          details: 'sendEmail method uses more User properties than its own'
        },
        {
          file: 'src/models/OrderModel.ts',
          type: 'large-class',
          severity: 'medium',
          details: 'Class has 800 lines and 25 methods'
        }
      ];

      baseProjectAnalysis.codeQuality.codeSmells = mixedCodeSmells;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      expect(candidates).toHaveLength(3);

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      const longMethodTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
      const largeClassTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class');

      expect(featureEnvyTask).toBeDefined();
      expect(longMethodTask).toBeDefined();
      expect(largeClassTask).toBeDefined();

      // All tasks should have proper structure
      [featureEnvyTask, longMethodTask, largeClassTask].forEach(task => {
        expect(task?.candidateId).toMatch(/^refactoring-code-smell-/);
        expect(task?.suggestedWorkflow).toBe('refactoring');
        expect(['low', 'normal', 'high', 'urgent']).toContain(task?.priority);
        expect(['low', 'medium', 'high']).toContain(task?.estimatedEffort);
        expect(task?.rationale).toBeTruthy();
      });
    });

    it('should prioritize feature envy appropriately among mixed severities', () => {
      const mixedSeveritySmells: CodeSmell[] = [
        { file: 'src/file1.ts', type: 'dead-code', severity: 'low', details: 'Unused code' },
        { file: 'src/file2.ts', type: 'feature-envy', severity: 'critical', details: 'Critical feature envy' },
        { file: 'src/file3.ts', type: 'magic-numbers', severity: 'medium', details: 'Magic numbers' }
      ];

      baseProjectAnalysis.codeQuality.codeSmells = mixedSeveritySmells;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      const deadCodeTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-dead-code');
      const magicNumbersTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-magic-numbers');

      expect(featureEnvyTask?.priority).toBe('urgent');
      expect(deadCodeTask?.priority).toBe('low');
      expect(magicNumbersTask?.priority).toBe('normal');

      // Critical feature envy should have highest score
      expect(featureEnvyTask?.score).toBeGreaterThan(deadCodeTask?.score || 0);
      expect(featureEnvyTask?.score).toBeGreaterThan(magicNumbersTask?.score || 0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty details gracefully', () => {
      const featureEnvyWithEmptyDetails: CodeSmell = {
        file: 'src/service.ts',
        type: 'feature-envy',
        severity: 'medium',
        details: ''
      };

      baseProjectAnalysis.codeQuality.codeSmells = [featureEnvyWithEmptyDetails];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask).toBeDefined();
      expect(featureEnvyTask?.rationale).toContain('Feature envy indicates poor method placement');
    });

    it('should handle very long details without breaking', () => {
      const longDetails = 'Method '.repeat(100) + 'extensively uses external class data instead of its own, creating tight coupling and reducing cohesion';
      const featureEnvyWithLongDetails: CodeSmell = {
        file: 'src/service.ts',
        type: 'feature-envy',
        severity: 'medium',
        details: longDetails
      };

      baseProjectAnalysis.codeQuality.codeSmells = [featureEnvyWithLongDetails];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask).toBeDefined();
      expect(featureEnvyTask?.rationale).toContain(longDetails);
    });

    it('should handle special characters in file paths', () => {
      const specialCharPath = 'src/services/user-service@v2.0.ts';
      const featureEnvySmell: CodeSmell = {
        file: specialCharPath,
        type: 'feature-envy',
        severity: 'medium',
        details: 'Method envies external data'
      };

      baseProjectAnalysis.codeQuality.codeSmells = [featureEnvySmell];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask).toBeDefined();
      expect(featureEnvyTask?.description).toContain('user-service@v2.0.ts');
    });

    it('should handle undefined severity by defaulting to normal priority', () => {
      const featureEnvyWithUndefinedSeverity: any = {
        file: 'src/service.ts',
        type: 'feature-envy',
        severity: undefined,
        details: 'Method envies external data'
      };

      baseProjectAnalysis.codeQuality.codeSmells = [featureEnvyWithUndefinedSeverity];

      // Should not throw an error
      expect(() => {
        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);
        expect(candidates).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Feature Envy Recommendations Validation', () => {
    it('should provide all expected feature envy recommendations', () => {
      const featureEnvySmell: CodeSmell = {
        file: 'src/service.ts',
        type: 'feature-envy',
        severity: 'medium',
        details: 'Method uses extensive external class data'
      };

      baseProjectAnalysis.codeQuality.codeSmells = [featureEnvySmell];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask).toBeDefined();

      const expectedRecommendations = [
        'Move methods closer to the data they use',
        'Extract methods into the appropriate classes',
        'Use delegation pattern when moving isn\'t possible',
        'Consider creating new classes for complex interactions'
      ];

      expectedRecommendations.forEach(recommendation => {
        expect(featureEnvyTask?.rationale).toContain(recommendation);
      });
    });

    it('should include specific details from the code smell in rationale', () => {
      const specificDetails = 'calculateTotalPrice method uses 15 properties from Product, Customer, and Tax classes but only 2 from Order';
      const featureEnvySmell: CodeSmell = {
        file: 'src/order/OrderService.ts',
        type: 'feature-envy',
        severity: 'high',
        details: specificDetails
      };

      baseProjectAnalysis.codeQuality.codeSmells = [featureEnvySmell];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask).toBeDefined();
      expect(featureEnvyTask?.rationale).toContain(specificDetails);
    });
  });

  describe('Task Structure Validation', () => {
    it('should generate proper task structure for feature envy', () => {
      const featureEnvySmell: CodeSmell = {
        file: 'src/service.ts',
        type: 'feature-envy',
        severity: 'medium',
        details: 'Method envies external data'
      };

      baseProjectAnalysis.codeQuality.codeSmells = [featureEnvySmell];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask).toBeDefined();

      // Validate required properties
      expect(featureEnvyTask?.candidateId).toBe('refactoring-code-smell-feature-envy');
      expect(featureEnvyTask?.title).toBeTruthy();
      expect(featureEnvyTask?.description).toBeTruthy();
      expect(featureEnvyTask?.rationale).toBeTruthy();
      expect(featureEnvyTask?.suggestedWorkflow).toBe('refactoring');
      expect(['low', 'normal', 'high', 'urgent']).toContain(featureEnvyTask?.priority);
      expect(['low', 'medium', 'high']).toContain(featureEnvyTask?.estimatedEffort);
      expect(featureEnvyTask?.score).toBeGreaterThan(0);
      expect(featureEnvyTask?.score).toBeLessThanOrEqual(1);
    });
  });
});
/**
 * RefactoringAnalyzer - TechnicalDebtAnalyzer Integration Tests
 *
 * Tests the integration patterns between RefactoringAnalyzer and TechnicalDebtAnalyzer
 * to ensure proper data flow, categorization, and weighted scoring across both analyzers.
 *
 * Validates that:
 * - RefactoringAnalyzer properly processes data that TechnicalDebtAnalyzer generates
 * - Both analyzers handle the same data structures consistently
 * - Scoring algorithms align for comparable results
 * - Category mapping works seamlessly between analyzers
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RefactoringAnalyzer } from './refactoring-analyzer';
import { TechnicalDebtAnalyzer } from './technical-debt-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type { ComplexityHotspot, CodeSmell, DuplicatePattern } from '@apexcli/core';

describe('RefactoringAnalyzer - TechnicalDebtAnalyzer Integration', () => {
  let refactoringAnalyzer: RefactoringAnalyzer;
  let technicalDebtAnalyzer: TechnicalDebtAnalyzer;
  let sharedAnalysis: ProjectAnalysis;

  beforeEach(() => {
    refactoringAnalyzer = new RefactoringAnalyzer();
    technicalDebtAnalyzer = new TechnicalDebtAnalyzer();

    sharedAnalysis = {
      codebaseSize: {
        files: 85,
        lines: 11000,
        languages: { 'ts': 75, 'js': 25 }
      },
      testCoverage: {
        percentage: 72,
        uncoveredFiles: ['src/legacy.ts', 'src/utils/old.ts']
      },
      dependencies: {
        outdated: [],
        security: [],
        outdatedPackages: [],
        securityIssues: [],
        deprecatedPackages: []
      },
      codeQuality: {
        lintIssues: 0,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: {
        coveragePercentage: 78,
        undocumentedExports: [],
        outdatedDocumentation: [],
        missingReadmeSections: [],
        apiCompleteness: {
          documented: 78,
          total: 100,
          coveragePercentage: 78
        }
      },
      performance: {
        bundleSize: 1800,
        slowTests: [],
        bottlenecks: []
      },
      testAnalysis: {
        branchCoverage: {
          percentage: 68,
          uncoveredBranches: []
        },
        antiPatterns: [],
        untestedExports: []
      }
    };
  });

  describe('Data Structure Compatibility', () => {
    it('should handle identical ComplexityHotspot data across both analyzers', () => {
      const sharedComplexityData: ComplexityHotspot[] = [
        {
          file: 'src/shared/ComplexService.ts',
          cyclomaticComplexity: 42,
          cognitiveComplexity: 48,
          lineCount: 950
        },
        {
          file: 'src/shared/DataProcessor.ts',
          cyclomaticComplexity: 28,
          cognitiveComplexity: 32,
          lineCount: 680
        }
      ];

      sharedAnalysis.codeQuality.complexityHotspots = sharedComplexityData;

      const refactoringCandidates = refactoringAnalyzer.analyze(sharedAnalysis);
      const technicalDebtCandidates = technicalDebtAnalyzer.analyze(sharedAnalysis);

      // Both analyzers should generate complexity-related tasks
      const refactoringComplexityTasks = refactoringCandidates.filter(c =>
        c.candidateId.includes('complexity-hotspot-')
      );
      const debtComplexityTasks = technicalDebtCandidates.filter(c =>
        c.candidateId.includes('complexity-')
      );

      expect(refactoringComplexityTasks.length).toBeGreaterThan(0);
      expect(debtComplexityTasks.length).toBeGreaterThan(0);

      // Both should reference the same files
      refactoringComplexityTasks.forEach(task => {
        expect(task.description).toMatch(/ComplexService\.ts|DataProcessor\.ts/);
      });
    });

    it('should handle identical CodeSmell data across both analyzers', () => {
      const sharedCodeSmells: CodeSmell[] = [
        {
          file: 'src/shared/AuthService.ts',
          type: 'long-method',
          severity: 'high',
          details: 'Authentication method spans 90 lines with complex branching'
        },
        {
          file: 'src/shared/UserManager.ts',
          type: 'large-class',
          severity: 'medium',
          details: 'User management class has grown to 720 lines'
        }
      ];

      sharedAnalysis.codeQuality.codeSmells = sharedCodeSmells;

      const refactoringCandidates = refactoringAnalyzer.analyze(sharedAnalysis);
      const technicalDebtCandidates = technicalDebtAnalyzer.analyze(sharedAnalysis);

      // Both analyzers should generate code smell tasks
      const refactoringSmellTasks = refactoringCandidates.filter(c =>
        c.candidateId.includes('code-smell-')
      );
      const debtSmellTasks = technicalDebtCandidates.filter(c =>
        c.candidateId.includes('smell') || c.candidateId.includes('quality')
      );

      expect(refactoringSmellTasks.length).toBeGreaterThan(0);
      expect(debtSmellTasks.length).toBeGreaterThan(0);

      // Tasks should reference same smell types
      const refactoringTypes = refactoringSmellTasks.map(t => t.candidateId);
      expect(refactoringTypes).toContain('refactoring-code-smell-long-method');
      expect(refactoringTypes).toContain('refactoring-code-smell-large-class');
    });

    it('should handle identical DuplicatePattern data with enhanced similarity analysis', () => {
      const duplicatePatterns: DuplicatePattern[] = [
        {
          pattern: 'validateUserInput(data, rules)',
          locations: [
            'src/auth/LoginValidator.ts',
            'src/api/UserController.ts',
            'src/services/UserService.ts'
          ],
          similarity: 0.92
        },
        {
          pattern: 'formatErrorMessage(error, context)',
          locations: [
            'src/utils/ErrorHandler.ts',
            'src/api/ErrorController.ts'
          ],
          similarity: 0.78
        }
      ];

      sharedAnalysis.codeQuality.duplicatedCode = duplicatePatterns as any;

      const refactoringCandidates = refactoringAnalyzer.analyze(sharedAnalysis);
      const technicalDebtCandidates = technicalDebtAnalyzer.analyze(sharedAnalysis);

      // Both should create duplicate code tasks
      const refactoringDuplicateTask = refactoringCandidates.find(c =>
        c.candidateId.includes('duplicated-code')
      );
      const debtDuplicateTask = technicalDebtCandidates.find(c =>
        c.candidateId.includes('duplicate') || c.candidateId.includes('duplication')
      );

      expect(refactoringDuplicateTask).toBeDefined();
      expect(debtDuplicateTask).toBeDefined();

      // Both should handle high similarity appropriately
      expect(refactoringDuplicateTask?.priority).toBe('high'); // Due to 92% similarity
      expect(refactoringDuplicateTask?.score).toBe(0.9); // Expected high similarity score
    });
  });

  describe('Category Mapping Consistency', () => {
    it('should map complexity hotspots to appropriate categories in both analyzers', () => {
      const complexityData: ComplexityHotspot[] = [
        {
          file: 'src/analysis/ComplexAlgorithm.ts',
          cyclomaticComplexity: 55, // Critical
          cognitiveComplexity: 62,  // Critical
          lineCount: 1800          // High
        }
      ];

      sharedAnalysis.codeQuality.complexityHotspots = complexityData;

      const refactoringCandidates = refactoringAnalyzer.analyze(sharedAnalysis);
      const debtCandidates = technicalDebtAnalyzer.analyze(sharedAnalysis);

      // RefactoringAnalyzer should categorize as complexity
      const refactoringComplexityTask = refactoringCandidates.find(c =>
        c.candidateId.includes('complexity')
      );
      expect(refactoringComplexityTask).toBeDefined();
      expect(refactoringComplexityTask?.suggestedWorkflow).toBe('refactoring');

      // TechnicalDebtAnalyzer should also handle complexity
      const debtComplexityTask = debtCandidates.find(c =>
        c.candidateId.includes('complexity') || c.title.toLowerCase().includes('complexity')
      );
      expect(debtComplexityTask).toBeDefined();

      // Both should recognize critical severity
      expect(refactoringComplexityTask?.priority).toBe('urgent');
    });

    it('should map code smells to code-smell category consistently', () => {
      const codeSmellData: CodeSmell[] = [
        {
          file: 'src/legacy/MonolithService.ts',
          type: 'feature-envy',
          severity: 'high',
          details: 'Service method accesses external class properties excessively'
        },
        {
          file: 'src/utils/MagicConstants.ts',
          type: 'magic-numbers',
          severity: 'medium',
          details: 'Hardcoded timeout values 30000, 60000, 120000 without named constants'
        }
      ];

      sharedAnalysis.codeQuality.codeSmells = codeSmellData;

      const refactoringCandidates = refactoringAnalyzer.analyze(sharedAnalysis);
      const debtCandidates = technicalDebtAnalyzer.analyze(sharedAnalysis);

      // RefactoringAnalyzer should create code-smell tasks
      const featureEnvyTask = refactoringCandidates.find(c =>
        c.candidateId === 'refactoring-code-smell-feature-envy'
      );
      const magicNumbersTask = refactoringCandidates.find(c =>
        c.candidateId === 'refactoring-code-smell-magic-numbers'
      );

      expect(featureEnvyTask).toBeDefined();
      expect(magicNumbersTask).toBeDefined();
      expect(featureEnvyTask?.suggestedWorkflow).toBe('refactoring');
      expect(magicNumbersTask?.suggestedWorkflow).toBe('refactoring');

      // TechnicalDebtAnalyzer should handle similar categorization
      const debtSmellTasks = debtCandidates.filter(c =>
        c.candidateId.includes('smell') ||
        c.description.toLowerCase().includes('feature envy') ||
        c.description.toLowerCase().includes('magic number')
      );
      expect(debtSmellTasks.length).toBeGreaterThan(0);
    });
  });

  describe('Weighted Severity Score Alignment', () => {
    it('should produce comparable scores for identical complexity data', () => {
      const testComplexity: ComplexityHotspot = {
        file: 'src/test/ScoringTest.ts',
        cyclomaticComplexity: 35, // High
        cognitiveComplexity: 42,  // High
        lineCount: 850           // Medium-High
      };

      sharedAnalysis.codeQuality.complexityHotspots = [testComplexity];

      const refactoringCandidates = refactoringAnalyzer.analyze(sharedAnalysis);
      const debtCandidates = technicalDebtAnalyzer.analyze(sharedAnalysis);

      const refactoringTask = refactoringCandidates.find(c => c.candidateId.includes('complexity'));
      const debtTask = debtCandidates.find(c => c.candidateId.includes('complexity'));

      if (refactoringTask && debtTask) {
        // Scores should be in similar ranges (both use sophisticated algorithms)
        const scoreDifference = Math.abs(refactoringTask.score - debtTask.score);
        expect(scoreDifference).toBeLessThan(0.3); // Allow some algorithmic differences

        // Both should assign similar priority for same data
        expect(refactoringTask.priority).toBe(debtTask.priority);
      }
    });

    it('should handle score adjustments consistently across analyzers', () => {
      // Test with multiple smells of same type to trigger count-based scoring
      const multipleSmells: CodeSmell[] = Array.from({ length: 8 }, (_, i) => ({
        file: `src/test/LongMethod${i}.ts`,
        type: 'long-method' as const,
        severity: 'medium' as const,
        details: `Long method ${i} requiring refactoring`
      }));

      sharedAnalysis.codeQuality.codeSmells = multipleSmells;

      const refactoringCandidates = refactoringAnalyzer.analyze(sharedAnalysis);
      const debtCandidates = technicalDebtAnalyzer.analyze(sharedAnalysis);

      const refactoringTask = refactoringCandidates.find(c =>
        c.candidateId === 'refactoring-code-smell-long-method'
      );

      expect(refactoringTask).toBeDefined();

      // Score should be adjusted for high count (8 > 5)
      expect(refactoringTask?.score).toBeGreaterThan(0.6); // Base medium score
      expect(refactoringTask?.description).toContain('8 long methods');
    });

    it('should prioritize critical issues consistently', () => {
      const criticalData: ComplexityHotspot[] = [
        {
          file: 'src/critical/PaymentProcessor.ts',
          cyclomaticComplexity: 75, // Critical
          cognitiveComplexity: 85,  // Critical
          lineCount: 2800          // Critical
        }
      ];

      const criticalSmells: CodeSmell[] = [
        {
          file: 'src/critical/SecurityHandler.ts',
          type: 'long-method',
          severity: 'critical',
          details: 'Critical security method with 200+ lines handling authentication'
        }
      ];

      sharedAnalysis.codeQuality.complexityHotspots = criticalData;
      sharedAnalysis.codeQuality.codeSmells = criticalSmells;

      const refactoringCandidates = refactoringAnalyzer.analyze(sharedAnalysis);
      const debtCandidates = technicalDebtAnalyzer.analyze(sharedAnalysis);

      // Both analyzers should mark critical items as urgent
      const refactoringCriticalTasks = refactoringCandidates.filter(c => c.priority === 'urgent');
      const debtCriticalTasks = debtCandidates.filter(c => c.priority === 'urgent');

      expect(refactoringCriticalTasks.length).toBeGreaterThan(0);
      expect(debtCriticalTasks.length).toBeGreaterThan(0);

      // Critical tasks should have high scores
      refactoringCriticalTasks.forEach(task => {
        expect(task.score).toBeGreaterThan(0.8);
      });
    });
  });

  describe('Cross-Analyzer Task Generation Patterns', () => {
    it('should handle comprehensive technical debt scenarios across both analyzers', () => {
      // Create a comprehensive scenario with multiple debt types
      const comprehensiveData = {
        complexityHotspots: [
          {
            file: 'src/core/MainProcessor.ts',
            cyclomaticComplexity: 45,
            cognitiveComplexity: 52,
            lineCount: 1200
          },
          {
            file: 'src/utils/DataTransformer.ts',
            cyclomaticComplexity: 28,
            cognitiveComplexity: 35,
            lineCount: 780
          }
        ] as ComplexityHotspot[],
        codeSmells: [
          {
            file: 'src/services/UserService.ts',
            type: 'long-method',
            severity: 'high',
            details: 'Method createUser has 85 lines'
          },
          {
            file: 'src/models/ProductManager.ts',
            type: 'large-class',
            severity: 'medium',
            details: 'Product management class has 650 lines'
          },
          {
            file: 'src/validators/InputValidator.ts',
            type: 'deep-nesting',
            severity: 'high',
            details: 'Validation logic has 7 levels of nesting'
          }
        ] as CodeSmell[],
        duplicatedCode: [
          {
            pattern: 'validateAndTransform(input, schema)',
            locations: ['src/api/v1/users.ts', 'src/api/v1/products.ts', 'src/api/v2/common.ts'],
            similarity: 0.88
          }
        ] as DuplicatePattern[]
      };

      sharedAnalysis.codeQuality = {
        lintIssues: 15,
        ...comprehensiveData
      };

      const refactoringCandidates = refactoringAnalyzer.analyze(sharedAnalysis);
      const debtCandidates = technicalDebtAnalyzer.analyze(sharedAnalysis);

      // RefactoringAnalyzer should generate multiple task types
      expect(refactoringCandidates.length).toBeGreaterThanOrEqual(6);

      const refactoringTypes = refactoringCandidates.map(c => c.candidateId);
      expect(refactoringTypes).toEqual(
        expect.arrayContaining([
          expect.stringContaining('complexity-hotspot'),
          expect.stringContaining('code-smell'),
          expect.stringContaining('duplicated-code'),
          expect.stringContaining('lint-issues')
        ])
      );

      // TechnicalDebtAnalyzer should also generate comprehensive analysis
      expect(debtCandidates.length).toBeGreaterThan(0);

      // Both analyzers should identify high-priority items
      const refactoringHighPriority = refactoringCandidates.filter(c =>
        c.priority === 'high' || c.priority === 'urgent'
      );
      const debtHighPriority = debtCandidates.filter(c =>
        c.priority === 'high' || c.priority === 'urgent'
      );

      expect(refactoringHighPriority.length).toBeGreaterThan(0);
      expect(debtHighPriority.length).toBeGreaterThan(0);
    });

    it('should handle analyzer-specific optimizations while maintaining compatibility', () => {
      // RefactoringAnalyzer has specific optimizations like aggregate complexity tasks
      const manyComplexityHotspots: ComplexityHotspot[] = Array.from({ length: 6 }, (_, i) => ({
        file: `src/complex/File${i}.ts`,
        cyclomaticComplexity: 25 + i * 2,
        cognitiveComplexity: 30 + i * 3,
        lineCount: 600 + i * 100
      }));

      sharedAnalysis.codeQuality.complexityHotspots = manyComplexityHotspots;

      const refactoringCandidates = refactoringAnalyzer.analyze(sharedAnalysis);

      // RefactoringAnalyzer should create individual tasks + aggregate
      const individualTasks = refactoringCandidates.filter(c =>
        c.candidateId.includes('complexity-hotspot-')
      );
      const aggregateTask = refactoringCandidates.find(c =>
        c.candidateId === 'refactoring-complexity-sweep'
      );

      expect(individualTasks).toHaveLength(3); // Top 3 individual
      expect(aggregateTask).toBeDefined();
      expect(aggregateTask?.description).toContain('6 complexity hotspots');
    });

    it('should ensure task candidate structure compatibility', () => {
      const testData: ComplexityHotspot[] = [
        {
          file: 'src/structure/TestFile.ts',
          cyclomaticComplexity: 30,
          cognitiveComplexity: 35,
          lineCount: 700
        }
      ];

      sharedAnalysis.codeQuality.complexityHotspots = testData;

      const refactoringCandidates = refactoringAnalyzer.analyze(sharedAnalysis);
      const debtCandidates = technicalDebtAnalyzer.analyze(sharedAnalysis);

      // All candidates from both analyzers should have consistent structure
      const allCandidates = [...refactoringCandidates, ...debtCandidates];

      allCandidates.forEach(candidate => {
        // Required fields
        expect(candidate.candidateId).toBeTruthy();
        expect(candidate.title).toBeTruthy();
        expect(candidate.description).toBeTruthy();
        expect(candidate.rationale).toBeTruthy();
        expect(candidate.suggestedWorkflow).toBeTruthy();

        // Valid values
        expect(['low', 'normal', 'high', 'urgent']).toContain(candidate.priority);
        expect(['low', 'medium', 'high']).toContain(candidate.estimatedEffort);
        expect(candidate.score).toBeGreaterThanOrEqual(0);
        expect(candidate.score).toBeLessThanOrEqual(1);
      });
    });
  });
});
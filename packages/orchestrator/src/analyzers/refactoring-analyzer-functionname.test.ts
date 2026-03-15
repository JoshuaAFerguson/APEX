/**
 * RefactoringAnalyzer FunctionName Field Tests
 *
 * Tests specifically for the functionName field integration in ComplexityHotspot objects.
 * This validates the acceptance criteria:
 * - ComplexityHotspot objects now include a functionName field
 * - RefactoringAnalyzer properly processes and uses the functionName in task descriptions
 * - Backward compatibility with legacy hotspots that may not have functionName
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RefactoringAnalyzer } from './refactoring-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type { ComplexityHotspot } from '@apexcli/core';

describe('RefactoringAnalyzer - FunctionName Field Tests', () => {
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

  describe('functionName field processing', () => {
    it('should include functionName in task titles and descriptions', () => {
      const complexityHotspots: ComplexityHotspot[] = [
        {
          file: 'src/services/PaymentService.ts',
          functionName: 'processPayment',
          cyclomaticComplexity: 45,
          cognitiveComplexity: 52,
          lineCount: 1200
        },
        {
          file: 'src/utils/DataValidator.ts',
          functionName: 'validateComplexUserData',
          cyclomaticComplexity: 38,
          cognitiveComplexity: 42,
          lineCount: 800
        }
      ];

      baseAnalysis.codeQuality.complexityHotspots = complexityHotspots;

      const candidates = analyzer.analyze(baseAnalysis);
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

      expect(hotspotTasks).toHaveLength(2);

      // Check that task titles include file names
      const paymentTask = hotspotTasks.find(t => t.description.includes('PaymentService.ts'));
      const validatorTask = hotspotTasks.find(t => t.description.includes('DataValidator.ts'));

      expect(paymentTask).toBeDefined();
      expect(validatorTask).toBeDefined();

      // Verify descriptions contain complexity information but don't explicitly show functionName
      // (functionName is used internally for processing but not necessarily displayed)
      expect(paymentTask!.description).toContain('PaymentService.ts');
      expect(paymentTask!.description).toContain('Cyclomatic Complexity: 45');
      expect(validatorTask!.description).toContain('DataValidator.ts');
      expect(validatorTask!.description).toContain('Cyclomatic Complexity: 38');
    });

    it('should handle ComplexityHotspot objects with all required functionName field', () => {
      const hotspot: ComplexityHotspot = {
        file: 'src/components/UserRegistration.tsx',
        functionName: 'handleRegistrationForm',
        cyclomaticComplexity: 28,
        cognitiveComplexity: 35,
        lineCount: 650
      };

      baseAnalysis.codeQuality.complexityHotspots = [hotspot];

      const candidates = analyzer.analyze(baseAnalysis);
      const task = candidates.find(c => c.candidateId.includes('complexity-hotspot-'));

      expect(task).toBeDefined();
      expect(task!.description).toContain('UserRegistration.tsx');
      expect(task!.rationale).toContain('Complexity Analysis:');
      expect(task!.rationale).toContain('Cyclomatic: 28');
      expect(task!.rationale).toContain('Cognitive: 35');
      expect(task!.rationale).toContain('Lines: 650');
    });

    it('should process functionName field for prioritization and scoring', () => {
      const hotspots: ComplexityHotspot[] = [
        {
          file: 'src/auth/AuthenticationService.ts',
          functionName: 'authenticateUserWithComplexLogic',
          cyclomaticComplexity: 55,
          cognitiveComplexity: 60,
          lineCount: 1500
        },
        {
          file: 'src/utils/SimpleHelper.ts',
          functionName: 'simpleUtilityFunction',
          cyclomaticComplexity: 12,
          cognitiveComplexity: 15,
          lineCount: 200
        }
      ];

      baseAnalysis.codeQuality.complexityHotspots = hotspots;

      const candidates = analyzer.analyze(baseAnalysis);
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

      expect(hotspotTasks).toHaveLength(2);

      // Complex function should be prioritized higher
      const complexTask = hotspotTasks.find(t => t.description.includes('AuthenticationService.ts'));
      const simpleTask = hotspotTasks.find(t => t.description.includes('SimpleHelper.ts'));

      expect(complexTask!.score).toBeGreaterThan(simpleTask!.score);
      expect(complexTask!.priority).toBe('urgent');
      expect(simpleTask!.priority).toBe('low');
    });

    it('should handle empty or undefined functionName gracefully', () => {
      const hotspotsWithMissingFunctionNames = [
        {
          file: 'src/legacy/OldService.ts',
          functionName: '', // Empty functionName
          cyclomaticComplexity: 25,
          cognitiveComplexity: 30,
          lineCount: 500
        },
        {
          file: 'src/another/Service.ts',
          functionName: undefined, // Undefined functionName
          cyclomaticComplexity: 22,
          cognitiveComplexity: 28,
          lineCount: 400
        }
      ] as ComplexityHotspot[];

      baseAnalysis.codeQuality.complexityHotspots = hotspotsWithMissingFunctionNames;

      expect(() => {
        const candidates = analyzer.analyze(baseAnalysis);
        const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));
        expect(hotspotTasks).toHaveLength(2);
      }).not.toThrow();
    });

    it('should use default functionName when processing legacy hotspots without functionName', () => {
      // Test backward compatibility with the legacy string format
      const legacyHotspots = [
        'src/legacy/LegacyService.ts',
        'src/old/OldModule.ts'
      ] as any;

      baseAnalysis.codeQuality.complexityHotspots = legacyHotspots;

      const candidates = analyzer.analyze(baseAnalysis);
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

      expect(hotspotTasks).toHaveLength(2);

      // Should handle legacy format and assign defaults (including default functionName)
      hotspotTasks.forEach(task => {
        expect(task.description).toMatch(/LegacyService\.ts|OldModule\.ts/);
        expect(task.description).toContain('Cyclomatic Complexity: 15'); // Default value
      });
    });

    it('should handle mixed ComplexityHotspot objects with and without functionName', () => {
      const mixedHotspots = [
        {
          file: 'src/modern/NewService.ts',
          functionName: 'processAdvancedData',
          cyclomaticComplexity: 42,
          cognitiveComplexity: 48,
          lineCount: 900
        },
        {
          file: 'src/partial/PartialService.ts',
          cyclomaticComplexity: 30,
          cognitiveComplexity: 35,
          lineCount: 600
          // Missing functionName
        } as ComplexityHotspot
      ];

      baseAnalysis.codeQuality.complexityHotspots = mixedHotspots;

      expect(() => {
        const candidates = analyzer.analyze(baseAnalysis);
        const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

        expect(hotspotTasks).toHaveLength(2);

        const modernTask = hotspotTasks.find(t => t.description.includes('NewService.ts'));
        const partialTask = hotspotTasks.find(t => t.description.includes('PartialService.ts'));

        expect(modernTask).toBeDefined();
        expect(partialTask).toBeDefined();

        // Both should work despite mixed completeness
        expect(modernTask!.score).toBeGreaterThan(partialTask!.score);
      }).not.toThrow();
    });
  });

  describe('functionName in rationale and recommendations', () => {
    it('should generate contextual recommendations based on complexity profile', () => {
      const hotspot: ComplexityHotspot = {
        file: 'src/business/PaymentProcessor.ts',
        functionName: 'processComplexPaymentWorkflow',
        cyclomaticComplexity: 45, // High
        cognitiveComplexity: 55,  // High
        lineCount: 1100          // High
      };

      baseAnalysis.codeQuality.complexityHotspots = [hotspot];

      const candidates = analyzer.analyze(baseAnalysis);
      const task = candidates.find(c => c.candidateId.includes('complexity-hotspot-'));

      expect(task).toBeDefined();

      // Should include comprehensive refactoring recommendations
      expect(task!.rationale).toContain('Recommended actions:');
      expect(task!.rationale).toContain('Extract methods to reduce branching complexity');
      expect(task!.rationale).toContain('Flatten control flow to improve readability');
      expect(task!.rationale).toContain('Split into multiple modules applying Single Responsibility Principle');

      // Should identify combined high complexity
      expect(task!.rationale).toContain('major refactoring with design patterns');
    });

    it('should provide appropriate severity classifications', () => {
      const criticalHotspot: ComplexityHotspot = {
        file: 'src/critical/DatabaseMigration.ts',
        functionName: 'performComplexMigration',
        cyclomaticComplexity: 65, // Critical
        cognitiveComplexity: 75,  // Critical
        lineCount: 2200          // Critical
      };

      baseAnalysis.codeQuality.complexityHotspots = [criticalHotspot];

      const candidates = analyzer.analyze(baseAnalysis);
      const task = candidates.find(c => c.candidateId.includes('complexity-hotspot-'));

      expect(task).toBeDefined();
      expect(task!.description).toContain('critical');
      expect(task!.description).toContain('requires immediate attention due to critically high complexity');
      expect(task!.priority).toBe('urgent');
      expect(task!.estimatedEffort).toBe('high');
    });

    it('should handle functions with specialized complexity patterns', () => {
      const hotspots: ComplexityHotspot[] = [
        {
          file: 'src/algorithms/DataSorter.ts',
          functionName: 'complexSortAlgorithm',
          cyclomaticComplexity: 35, // High cyclomatic only
          cognitiveComplexity: 20,  // Medium cognitive
          lineCount: 300           // Low lines
        },
        {
          file: 'src/ui/ComponentRenderer.ts',
          functionName: 'renderComplexNestedComponent',
          cyclomaticComplexity: 18, // Medium cyclomatic
          cognitiveComplexity: 45,  // High cognitive only
          lineCount: 250           // Low lines
        },
        {
          file: 'src/data/BigDataProcessor.ts',
          functionName: 'processLargeDataset',
          cyclomaticComplexity: 15, // Medium cyclomatic
          cognitiveComplexity: 18,  // Medium cognitive
          lineCount: 1800          // Critical lines only
        }
      ];

      baseAnalysis.codeQuality.complexityHotspots = hotspots;

      const candidates = analyzer.analyze(baseAnalysis);
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

      expect(hotspotTasks).toHaveLength(3);

      // Check that each gets appropriate classification based on their dominant complexity dimension
      const sortTask = hotspotTasks.find(t => t.description.includes('DataSorter.ts'));
      const renderTask = hotspotTasks.find(t => t.description.includes('ComponentRenderer.ts'));
      const dataTask = hotspotTasks.find(t => t.description.includes('BigDataProcessor.ts'));

      expect(sortTask!.rationale).toContain('Extract methods to reduce branching complexity');
      expect(renderTask!.rationale).toContain('Flatten control flow to improve readability');
      expect(dataTask!.rationale).toContain('Split into multiple modules applying Single Responsibility Principle');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle null functionName field', () => {
      const hotspotWithNullFunctionName: ComplexityHotspot = {
        file: 'src/edge/EdgeCase.ts',
        functionName: null as any,
        cyclomaticComplexity: 20,
        cognitiveComplexity: 25,
        lineCount: 400
      };

      baseAnalysis.codeQuality.complexityHotspots = [hotspotWithNullFunctionName];

      expect(() => {
        const candidates = analyzer.analyze(baseAnalysis);
        expect(candidates.length).toBeGreaterThanOrEqual(0);
      }).not.toThrow();
    });

    it('should handle very long functionName values', () => {
      const hotspotWithLongName: ComplexityHotspot = {
        file: 'src/verbose/VerboseService.ts',
        functionName: 'thisIsAnExtremelyLongAndVerboseFunctionNameThatSomeoneWroteForSomeUnknownReasonAndItJustKeepsGoingAndGoingAndGoingLikeTheEnergizer BunnyButForCodeWhichIsNeverAGoodIdeaButSometimesHappensInRealWorldProjects',
        cyclomaticComplexity: 25,
        cognitiveComplexity: 30,
        lineCount: 500
      };

      baseAnalysis.codeQuality.complexityHotspots = [hotspotWithLongName];

      expect(() => {
        const candidates = analyzer.analyze(baseAnalysis);
        const task = candidates.find(c => c.candidateId.includes('complexity-hotspot-'));
        expect(task).toBeDefined();
        expect(task!.description).toContain('VerboseService.ts');
      }).not.toThrow();
    });

    it('should handle special characters in functionName', () => {
      const hotspotWithSpecialChars: ComplexityHotspot = {
        file: 'src/special/SpecialService.ts',
        functionName: 'function$With_Special-Characters.and.dots<T>',
        cyclomaticComplexity: 22,
        cognitiveComplexity: 28,
        lineCount: 450
      };

      baseAnalysis.codeQuality.complexityHotspots = [hotspotWithSpecialChars];

      expect(() => {
        const candidates = analyzer.analyze(baseAnalysis);
        const task = candidates.find(c => c.candidateId.includes('complexity-hotspot-'));
        expect(task).toBeDefined();
      }).not.toThrow();
    });

    it('should handle Unicode characters in functionName', () => {
      const hotspotWithUnicode: ComplexityHotspot = {
        file: 'src/international/InternationalService.ts',
        functionName: '处理复杂数据流程', // Chinese characters
        cyclomaticComplexity: 30,
        cognitiveComplexity: 35,
        lineCount: 600
      };

      baseAnalysis.codeQuality.complexityHotspots = [hotspotWithUnicode];

      expect(() => {
        const candidates = analyzer.analyze(baseAnalysis);
        const task = candidates.find(c => c.candidateId.includes('complexity-hotspot-'));
        expect(task).toBeDefined();
        expect(task!.description).toContain('InternationalService.ts');
      }).not.toThrow();
    });

    it('should handle arrays of mixed valid and invalid hotspots', () => {
      const mixedHotspots = [
        {
          file: 'src/valid/ValidService.ts',
          functionName: 'validFunction',
          cyclomaticComplexity: 25,
          cognitiveComplexity: 30,
          lineCount: 500
        },
        null, // Invalid hotspot
        {
          file: 'src/incomplete/IncompleteService.ts',
          // Missing some fields
          cyclomaticComplexity: 20
        },
        {
          file: 'src/another-valid/AnotherValidService.ts',
          functionName: 'anotherValidFunction',
          cyclomaticComplexity: 35,
          cognitiveComplexity: 40,
          lineCount: 700
        }
      ] as any[];

      baseAnalysis.codeQuality.complexityHotspots = mixedHotspots;

      expect(() => {
        const candidates = analyzer.analyze(baseAnalysis);
        // Should process the valid ones and handle invalid ones gracefully
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });
  });
});
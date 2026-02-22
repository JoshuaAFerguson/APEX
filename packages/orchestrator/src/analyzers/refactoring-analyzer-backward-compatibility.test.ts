/**
 * RefactoringAnalyzer Backward Compatibility Tests
 *
 * Tests for ensuring backward compatibility with legacy data formats,
 * specifically handling older complexity hotspot data structures that
 * may not include the new functionName field.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RefactoringAnalyzer } from './refactoring-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type { ComplexityHotspot } from '@apexcli/core';

describe('RefactoringAnalyzer - Backward Compatibility Tests', () => {
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

  describe('legacy string format hotspots', () => {
    it('should handle legacy string array format for complexity hotspots', () => {
      const legacyHotspots = [
        'src/legacy/service1.ts',
        'src/legacy/service2.ts',
        'src/legacy/service3.ts'
      ] as any;

      baseAnalysis.codeQuality.complexityHotspots = legacyHotspots;

      const candidates = analyzer.analyze(baseAnalysis);
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

      expect(hotspotTasks).toHaveLength(3);

      // Verify that default values are assigned for legacy format
      hotspotTasks.forEach(task => {
        expect(task.description).toContain('Cyclomatic Complexity: 15 (medium)');
        expect(task.description).toContain('Cognitive Complexity: 20 (medium)');
        expect(task.description).toContain('Lines: 300 (medium)');
        expect(task.rationale).toContain('Complexity Analysis:');
        expect(task.suggestedWorkflow).toBe('refactoring');
      });
    });

    it('should assign appropriate default functionName for legacy hotspots', () => {
      const legacyHotspots = [
        'src/utils/helper.ts',
        'src/api/controller.ts'
      ] as any;

      baseAnalysis.codeQuality.complexityHotspots = legacyHotspots;

      const candidates = analyzer.analyze(baseAnalysis);
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

      expect(hotspotTasks).toHaveLength(2);

      // Legacy format should work without throwing errors
      // and tasks should be created with default complexity values
      const helperTask = hotspotTasks.find(t => t.description.includes('helper.ts'));
      const controllerTask = hotspotTasks.find(t => t.description.includes('controller.ts'));

      expect(helperTask).toBeDefined();
      expect(controllerTask).toBeDefined();

      // Both should have medium priority (based on default medium complexity values)
      expect(helperTask!.priority).toBe('normal');
      expect(controllerTask!.priority).toBe('normal');
    });

    it('should create proper task candidates with legacy data', () => {
      const legacyHotspots = ['src/complex/ComplexService.ts'] as any;

      baseAnalysis.codeQuality.complexityHotspots = legacyHotspots;

      const candidates = analyzer.analyze(baseAnalysis);
      const task = candidates.find(c => c.candidateId.includes('complexity-hotspot-'));

      expect(task).toBeDefined();
      expect(task!.title).toBe('Refactor ComplexService.ts');
      expect(task!.candidateId).toBe('refactoring-complexity-hotspot-0');
      expect(task!.description).toContain('Reduce complexity in src/complex/ComplexService.ts');
      expect(task!.priority).toBe('normal');
      expect(task!.estimatedEffort).toBe('medium');
      expect(task!.suggestedWorkflow).toBe('refactoring');
    });

    it('should handle empty legacy arrays gracefully', () => {
      baseAnalysis.codeQuality.complexityHotspots = [];

      const candidates = analyzer.analyze(baseAnalysis);
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

      expect(hotspotTasks).toHaveLength(0);
    });

    it('should handle mixed legacy and modern hotspot formats', () => {
      const mixedHotspots = [
        'src/legacy.ts', // Legacy string format
        {
          file: 'src/modern.ts',
          functionName: 'modernFunction',
          cyclomaticComplexity: 40,
          cognitiveComplexity: 45,
          lineCount: 800
        }
      ] as any[];

      baseAnalysis.codeQuality.complexityHotspots = mixedHotspots;

      const candidates = analyzer.analyze(baseAnalysis);
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

      expect(hotspotTasks).toHaveLength(2);

      const legacyTask = hotspotTasks.find(t => t.description.includes('legacy.ts'));
      const modernTask = hotspotTasks.find(t => t.description.includes('modern.ts'));

      expect(legacyTask).toBeDefined();
      expect(modernTask).toBeDefined();

      // Legacy task should have medium priority (default values)
      expect(legacyTask!.priority).toBe('normal');

      // Modern task should have high priority (high complexity values)
      expect(modernTask!.priority).toBe('high');

      // Modern task should score higher due to actual complexity values
      expect(modernTask!.score).toBeGreaterThan(legacyTask!.score);
    });
  });

  describe('incomplete modern hotspot objects', () => {
    it('should handle hotspots with missing functionName field', () => {
      const incompleteHotspots: Partial<ComplexityHotspot>[] = [
        {
          file: 'src/incomplete/Service1.ts',
          cyclomaticComplexity: 25,
          cognitiveComplexity: 30,
          lineCount: 500
          // Missing functionName
        },
        {
          file: 'src/incomplete/Service2.ts',
          functionName: '', // Empty functionName
          cyclomaticComplexity: 35,
          cognitiveComplexity: 40,
          lineCount: 700
        }
      ] as ComplexityHotspot[];

      baseAnalysis.codeQuality.complexityHotspots = incompleteHotspots;

      const candidates = analyzer.analyze(baseAnalysis);
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

      expect(hotspotTasks).toHaveLength(2);

      // Both should be processed successfully despite missing functionName
      hotspotTasks.forEach(task => {
        expect(task.description).toMatch(/Service[12]\.ts/);
        expect(task.rationale).toContain('Complexity Analysis:');
      });

      // The second one should have higher score due to higher complexity
      const service1Task = hotspotTasks.find(t => t.description.includes('Service1.ts'));
      const service2Task = hotspotTasks.find(t => t.description.includes('Service2.ts'));

      expect(service2Task!.score).toBeGreaterThan(service1Task!.score);
    });

    it('should provide default functionName when field is missing', () => {
      const hotspotMissingFunctionName: Partial<ComplexityHotspot> = {
        file: 'src/test/TestService.ts',
        cyclomaticComplexity: 30,
        cognitiveComplexity: 35,
        lineCount: 600
        // Missing functionName - should default to 'unknown'
      };

      baseAnalysis.codeQuality.complexityHotspots = [hotspotMissingFunctionName] as ComplexityHotspot[];

      const candidates = analyzer.analyze(baseAnalysis);
      const task = candidates.find(c => c.candidateId.includes('complexity-hotspot-'));

      expect(task).toBeDefined();
      expect(task!.description).toContain('TestService.ts');

      // Should work without throwing errors despite missing functionName
      expect(task!.rationale).toContain('Cyclomatic: 30');
      expect(task!.rationale).toContain('Cognitive: 35');
      expect(task!.rationale).toContain('Lines: 600');
    });

    it('should handle hotspots with some missing complexity fields', () => {
      const partialHotspots = [
        {
          file: 'src/partial/Service1.ts',
          functionName: 'partialFunction1',
          cyclomaticComplexity: 25,
          // Missing cognitiveComplexity and lineCount
        },
        {
          file: 'src/partial/Service2.ts',
          functionName: 'partialFunction2',
          cognitiveComplexity: 30,
          // Missing cyclomaticComplexity and lineCount
        },
        {
          file: 'src/partial/Service3.ts',
          functionName: 'partialFunction3',
          lineCount: 800,
          // Missing both complexity metrics
        }
      ] as any[];

      baseAnalysis.codeQuality.complexityHotspots = partialHotspots;

      expect(() => {
        const candidates = analyzer.analyze(baseAnalysis);
        // Should handle partial data gracefully and create tasks for valid parts
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });
  });

  describe('mixed data type handling', () => {
    it('should handle null and undefined values in hotspots array', () => {
      const mixedArray = [
        'src/valid/ValidService.ts',
        null,
        {
          file: 'src/modern/ModernService.ts',
          functionName: 'modernFunction',
          cyclomaticComplexity: 30,
          cognitiveComplexity: 35,
          lineCount: 600
        },
        undefined,
        'src/another/AnotherService.ts'
      ] as any[];

      baseAnalysis.codeQuality.complexityHotspots = mixedArray;

      expect(() => {
        const candidates = analyzer.analyze(baseAnalysis);
        const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

        // Should create tasks only for valid entries, ignoring null/undefined
        expect(hotspotTasks.length).toBeGreaterThan(0);
        expect(hotspotTasks.length).toBeLessThanOrEqual(3); // Only valid entries
      }).not.toThrow();
    });

    it('should prioritize modern format over legacy when both present', () => {
      const mixedFormats = [
        'src/legacy/LegacyService.ts', // Legacy format - gets defaults
        {
          file: 'src/modern/HighComplexityService.ts',
          functionName: 'veryComplexFunction',
          cyclomaticComplexity: 50, // High
          cognitiveComplexity: 55,  // High
          lineCount: 1200          // High
        },
        'src/legacy/AnotherLegacyService.ts' // Legacy format - gets defaults
      ] as any[];

      baseAnalysis.codeQuality.complexityHotspots = mixedFormats;

      const candidates = analyzer.analyze(baseAnalysis);
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

      expect(hotspotTasks).toHaveLength(3);

      // Find tasks by their descriptions
      const modernTask = hotspotTasks.find(t => t.description.includes('HighComplexityService.ts'));
      const legacyTasks = hotspotTasks.filter(t =>
        t.description.includes('LegacyService.ts') ||
        t.description.includes('AnotherLegacyService.ts')
      );

      expect(modernTask).toBeDefined();
      expect(legacyTasks).toHaveLength(2);

      // Modern task should be prioritized first (highest score)
      expect(modernTask!.score).toBeGreaterThan(legacyTasks[0].score);
      expect(modernTask!.score).toBeGreaterThan(legacyTasks[1].score);
      expect(modernTask!.priority).toBe('high');

      legacyTasks.forEach(legacyTask => {
        expect(legacyTask.priority).toBe('normal'); // Default medium complexity = normal priority
      });
    });

    it('should handle transformation from legacy to modern format internally', () => {
      const legacyData = ['src/transform/TransformTest.ts'] as any;

      baseAnalysis.codeQuality.complexityHotspots = legacyData;

      const candidates = analyzer.analyze(baseAnalysis);
      const task = candidates.find(c => c.candidateId.includes('complexity-hotspot-'));

      expect(task).toBeDefined();

      // Verify that internal transformation creates a valid task structure
      expect(task!.title).toBe('Refactor TransformTest.ts');
      expect(task!.description).toContain('TransformTest.ts');
      expect(task!.description).toContain('Cyclomatic Complexity: 15');
      expect(task!.description).toContain('Cognitive Complexity: 20');
      expect(task!.description).toContain('Lines: 300');
      expect(task!.rationale).toContain('Complexity Analysis:');
      expect(task!.rationale).toContain('- Cyclomatic: 15 (medium)');
      expect(task!.rationale).toContain('- Cognitive: 20 (medium)');
      expect(task!.rationale).toContain('- Lines: 300');
    });
  });

  describe('aggregate task creation with mixed formats', () => {
    it('should create aggregate complexity sweep task with mixed data', () => {
      const manyMixedHotspots = [
        'src/legacy1.ts',
        'src/legacy2.ts',
        'src/legacy3.ts',
        'src/legacy4.ts',
        {
          file: 'src/modern1.ts',
          functionName: 'modernFunc1',
          cyclomaticComplexity: 30,
          cognitiveComplexity: 35,
          lineCount: 600
        },
        {
          file: 'src/modern2.ts',
          functionName: 'modernFunc2',
          cyclomaticComplexity: 25,
          cognitiveComplexity: 30,
          lineCount: 500
        }
      ] as any[];

      baseAnalysis.codeQuality.complexityHotspots = manyMixedHotspots;

      const candidates = analyzer.analyze(baseAnalysis);

      // Should create 3 individual tasks (top priority) + 1 aggregate task
      const individualTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));
      const aggregateTask = candidates.find(c => c.candidateId === 'refactoring-complexity-sweep');

      expect(individualTasks).toHaveLength(3);
      expect(aggregateTask).toBeDefined();

      expect(aggregateTask!.title).toContain('Address Codebase Complexity');
      expect(aggregateTask!.description).toContain('6 complexity hotspots');
      expect(aggregateTask!.priority).toBe('normal'); // No critical hotspots in this set
      expect(aggregateTask!.estimatedEffort).toBe('high');
    });

    it('should handle edge case of all legacy hotspots in aggregate task', () => {
      const manyLegacyHotspots = Array.from({ length: 5 }, (_, i) => `src/legacy${i}.ts`) as any[];

      baseAnalysis.codeQuality.complexityHotspots = manyLegacyHotspots;

      const candidates = analyzer.analyze(baseAnalysis);

      const individualTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));
      const aggregateTask = candidates.find(c => c.candidateId === 'refactoring-complexity-sweep');

      expect(individualTasks).toHaveLength(3); // Top 3 individual tasks
      expect(aggregateTask).toBeDefined(); // Aggregate for remaining 2

      expect(aggregateTask!.description).toContain('5 complexity hotspots');
      // No critical hotspots (legacy uses defaults) so should be normal priority
      expect(aggregateTask!.priority).toBe('normal');
    });
  });

  describe('error resilience with corrupted legacy data', () => {
    it('should handle corrupted string entries gracefully', () => {
      const corruptedData = [
        '', // Empty string
        '   ', // Whitespace only
        'src/valid/ValidService.ts',
        null,
        'src/another/valid.ts'
      ] as any[];

      baseAnalysis.codeQuality.complexityHotspots = corruptedData;

      expect(() => {
        const candidates = analyzer.analyze(baseAnalysis);
        // Should process valid entries and ignore corrupted ones
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });

    it('should handle non-string legacy entries gracefully', () => {
      const invalidData = [
        123, // Number
        true, // Boolean
        { invalid: 'object' }, // Invalid object structure
        'src/valid/ValidService.ts', // Valid entry
        ['nested', 'array'], // Array instead of string
      ] as any[];

      baseAnalysis.codeQuality.complexityHotspots = invalidData;

      expect(() => {
        const candidates = analyzer.analyze(baseAnalysis);
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });
  });
});
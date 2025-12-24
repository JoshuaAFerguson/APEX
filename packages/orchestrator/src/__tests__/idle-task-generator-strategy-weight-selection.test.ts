/**
 * Comprehensive tests for IdleTaskGenerator strategy weight selection mechanism
 *
 * This test suite focuses specifically on testing the weighted random selection
 * algorithm and its statistical behavior across various scenarios.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IdleTaskGenerator } from '../idle-task-generator';
import { IdleTaskType, StrategyWeights } from '@apexcli/core';
import type { ProjectAnalysis } from '../idle-processor';

// Mock Math.random to enable deterministic testing
const mockMathRandom = vi.fn();
vi.stubGlobal('Math', { ...Math, random: mockMathRandom });

describe('IdleTaskGenerator Strategy Weight Selection', () => {
  let generator: IdleTaskGenerator;
  let mockAnalysis: ProjectAnalysis;

  beforeEach(() => {
    mockAnalysis = {
      codebaseSize: { files: 50, lines: 5000, languages: { ts: 40, js: 10 } },
      testCoverage: { percentage: 45, uncoveredFiles: ['src/utils.ts'] },
      dependencies: { outdated: ['old-lib@^0.1.0'], security: [] },
      codeQuality: {
        lintIssues: 25,
        duplicatedCode: [],
        complexityHotspots: [{ file: 'src/complex.ts', cyclomaticComplexity: 20, cognitiveComplexity: 24, lineCount: 380 }],
        codeSmells: []
      },
      documentation: { coverage: 35, missingDocs: ['src/core.ts'] },
      performance: { slowTests: [], bottlenecks: [] },
    };

    // Reset mock
    mockMathRandom.mockReset();
  });

  describe('Weighted Random Selection Algorithm', () => {
    it('should select first type when random is 0', () => {
      generator = new IdleTaskGenerator({
        maintenance: 0.4,
        refactoring: 0.3,
        docs: 0.2,
        tests: 0.1,
      });

      // Mock random to return exactly 0
      mockMathRandom.mockReturnValue(0.0);

      const selectedType = generator.selectTaskType();

      expect(selectedType).toBe('maintenance');
    });

    it('should select correct type based on cumulative probability', () => {
      generator = new IdleTaskGenerator({
        maintenance: 0.2, // 0.0 to 0.2
        refactoring: 0.3, // 0.2 to 0.5
        docs: 0.4,        // 0.5 to 0.9
        tests: 0.1,       // 0.9 to 1.0
      });

      // Test selection at boundary points
      const testCases = [
        { random: 0.1, expected: 'maintenance' },
        { random: 0.2, expected: 'refactoring' },
        { random: 0.35, expected: 'refactoring' },
        { random: 0.5, expected: 'docs' },
        { random: 0.75, expected: 'docs' },
        { random: 0.9, expected: 'tests' },
        { random: 0.95, expected: 'tests' },
      ];

      testCases.forEach(({ random, expected }) => {
        mockMathRandom.mockReturnValue(random);
        const selectedType = generator.selectTaskType();
        expect(selectedType).toBe(expected);
      });
    });

    it('should handle floating point precision edge cases', () => {
      generator = new IdleTaskGenerator({
        maintenance: 0.1,
        refactoring: 0.2,
        docs: 0.3,
        tests: 0.4000000000000001, // Floating point precision issue
      });

      // Test near the total sum
      mockMathRandom.mockReturnValue(0.9999999999999999);
      const selectedType = generator.selectTaskType();

      expect(['maintenance', 'refactoring', 'docs', 'tests']).toContain(selectedType);
    });

    it('should return last type when random equals total weight', () => {
      generator = new IdleTaskGenerator({
        maintenance: 0.25,
        refactoring: 0.25,
        docs: 0.25,
        tests: 0.25,
      });

      // Mock random to return exactly 1.0 (total weight)
      mockMathRandom.mockReturnValue(1.0);

      const selectedType = generator.selectTaskType();

      // Should fallback to last type for edge case
      expect(selectedType).toBe('tests');
    });

    it('should handle edge case where random exceeds total due to floating point', () => {
      generator = new IdleTaskGenerator({
        maintenance: 0.1,
        refactoring: 0.1,
        docs: 0.1,
        tests: 0.1,
      });

      // Mock random that when multiplied by total (0.4) exceeds cumulative weights
      mockMathRandom.mockReturnValue(0.99999);

      const selectedType = generator.selectTaskType();

      // Should fallback to last type
      expect(selectedType).toBe('tests');
    });
  });

  describe('Zero Weight Fallback Behavior', () => {
    it('should use uniform distribution when all weights are zero', () => {
      generator = new IdleTaskGenerator({
        maintenance: 0,
        refactoring: 0,
        docs: 0,
        tests: 0,
      });

      const testCases = [
        { random: 0.0, expected: 'maintenance' },  // 0.0 to 0.25
        { random: 0.24, expected: 'maintenance' },
        { random: 0.25, expected: 'refactoring' }, // 0.25 to 0.5
        { random: 0.49, expected: 'refactoring' },
        { random: 0.5, expected: 'docs' },         // 0.5 to 0.75
        { random: 0.74, expected: 'docs' },
        { random: 0.75, expected: 'tests' },       // 0.75 to 1.0
        { random: 0.99, expected: 'tests' },
      ];

      testCases.forEach(({ random, expected }) => {
        mockMathRandom.mockReturnValue(random);
        const selectedType = generator.selectTaskType();
        expect(selectedType).toBe(expected);
      });
    });

    it('should handle negative weights by treating them as zero', () => {
      generator = new IdleTaskGenerator({
        maintenance: -0.5,  // Should be treated as 0
        refactoring: 0.5,
        docs: 0.5,
        tests: 0,
      });

      // Since total is 1.0 and maintenance is effectively 0
      // refactoring: 0.0 to 0.5, docs: 0.5 to 1.0

      const testCases = [
        { random: 0.0, expected: 'refactoring' },
        { random: 0.25, expected: 'refactoring' },
        { random: 0.5, expected: 'docs' },
        { random: 0.75, expected: 'docs' },
      ];

      testCases.forEach(({ random, expected }) => {
        mockMathRandom.mockReturnValue(random);
        const selectedType = generator.selectTaskType();
        expect(selectedType).toBe(expected);
      });
    });

    it('should handle undefined weights as zero', () => {
      generator = new IdleTaskGenerator({
        maintenance: undefined as any,
        refactoring: 1.0,
        docs: undefined as any,
        tests: undefined as any,
      });

      // Only refactoring has weight, should always be selected
      mockMathRandom.mockReturnValue(0.5);
      const selectedType = generator.selectTaskType();

      expect(selectedType).toBe('refactoring');
    });
  });

  describe('Extreme Weight Values', () => {
    it('should handle very large weights', () => {
      generator = new IdleTaskGenerator({
        maintenance: 1000000,
        refactoring: 1000000,
        docs: 0,
        tests: 0,
      });

      // Each type should have 50% probability
      const testCases = [
        { random: 0.0, expected: 'maintenance' },
        { random: 0.49, expected: 'maintenance' },
        { random: 0.5, expected: 'refactoring' },
        { random: 0.99, expected: 'refactoring' },
      ];

      testCases.forEach(({ random, expected }) => {
        mockMathRandom.mockReturnValue(random);
        const selectedType = generator.selectTaskType();
        expect(selectedType).toBe(expected);
      });
    });

    it('should handle very small weights', () => {
      generator = new IdleTaskGenerator({
        maintenance: Number.MIN_VALUE,
        refactoring: Number.MIN_VALUE * 2,
        docs: 0,
        tests: 0,
      });

      // refactoring should be twice as likely as maintenance
      const total = Number.MIN_VALUE * 3;
      const maintenanceThreshold = Number.MIN_VALUE / total; // ~0.333

      mockMathRandom.mockReturnValue(0.2); // Should select maintenance
      expect(generator.selectTaskType()).toBe('maintenance');

      mockMathRandom.mockReturnValue(0.5); // Should select refactoring
      expect(generator.selectTaskType()).toBe('refactoring');
    });

    it('should handle infinite weights', () => {
      generator = new IdleTaskGenerator({
        maintenance: Infinity,
        refactoring: 100,
        docs: 0,
        tests: 0,
      });

      // Infinite weight should dominate
      mockMathRandom.mockReturnValue(0.5);
      const selectedType = generator.selectTaskType();

      expect(selectedType).toBe('maintenance');
    });

    it('should handle NaN weights', () => {
      generator = new IdleTaskGenerator({
        maintenance: NaN,
        refactoring: 0.5,
        docs: 0.5,
        tests: 0,
      });

      // NaN should be treated as 0, leaving only refactoring and docs
      const testCases = [
        { random: 0.25, expected: 'refactoring' },
        { random: 0.75, expected: 'docs' },
      ];

      testCases.forEach(({ random, expected }) => {
        mockMathRandom.mockReturnValue(random);
        const selectedType = generator.selectTaskType();
        expect(selectedType).toBe(expected);
      });
    });
  });

  describe('Statistical Distribution Testing', () => {
    // Restore real Math.random for statistical tests
    beforeEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it('should approximate expected distribution over many selections', () => {
      const weights = {
        maintenance: 0.1,  // 10%
        refactoring: 0.3,  // 30%
        docs: 0.5,         // 50%
        tests: 0.1,        // 10%
      };

      generator = new IdleTaskGenerator(weights);

      const counts: Record<IdleTaskType, number> = {
        maintenance: 0,
        refactoring: 0,
        docs: 0,
        tests: 0,
      };

      const numSelections = 10000;

      for (let i = 0; i < numSelections; i++) {
        const selectedType = generator.selectTaskType();
        counts[selectedType]++;
      }

      // Check that distribution roughly matches weights (within 2% tolerance)
      const tolerance = 0.02;

      expect(counts.maintenance / numSelections).toBeCloseTo(weights.maintenance, 2);
      expect(counts.refactoring / numSelections).toBeCloseTo(weights.refactoring, 2);
      expect(counts.docs / numSelections).toBeCloseTo(weights.docs, 2);
      expect(counts.tests / numSelections).toBeCloseTo(weights.tests, 2);

      // More lenient check for CI environments
      expect(counts.maintenance / numSelections).toBeGreaterThan(weights.maintenance - tolerance);
      expect(counts.maintenance / numSelections).toBeLessThan(weights.maintenance + tolerance);

      expect(counts.refactoring / numSelections).toBeGreaterThan(weights.refactoring - tolerance);
      expect(counts.refactoring / numSelections).toBeLessThan(weights.refactoring + tolerance);

      expect(counts.docs / numSelections).toBeGreaterThan(weights.docs - tolerance);
      expect(counts.docs / numSelections).toBeLessThan(weights.docs + tolerance);

      expect(counts.tests / numSelections).toBeGreaterThan(weights.tests - tolerance);
      expect(counts.tests / numSelections).toBeLessThan(weights.tests + tolerance);
    });

    it('should handle skewed distributions correctly', () => {
      const weights = {
        maintenance: 0.01,  // 1%
        refactoring: 0.01,  // 1%
        docs: 0.01,         // 1%
        tests: 0.97,        // 97%
      };

      generator = new IdleTaskGenerator(weights);

      const counts: Record<IdleTaskType, number> = {
        maintenance: 0,
        refactoring: 0,
        docs: 0,
        tests: 0,
      };

      const numSelections = 5000;

      for (let i = 0; i < numSelections; i++) {
        const selectedType = generator.selectTaskType();
        counts[selectedType]++;
      }

      // Tests should dominate
      expect(counts.tests / numSelections).toBeGreaterThan(0.95);

      // Other types should have minimal representation
      expect(counts.maintenance / numSelections).toBeLessThan(0.03);
      expect(counts.refactoring / numSelections).toBeLessThan(0.03);
      expect(counts.docs / numSelections).toBeLessThan(0.03);
    });

    it('should be random across multiple generators', () => {
      const weights = { maintenance: 0.5, refactoring: 0.5, docs: 0, tests: 0 };

      const generator1 = new IdleTaskGenerator(weights);
      const generator2 = new IdleTaskGenerator(weights);

      const selections1: IdleTaskType[] = [];
      const selections2: IdleTaskType[] = [];

      // Generate sequences from both generators
      for (let i = 0; i < 50; i++) {
        selections1.push(generator1.selectTaskType());
        selections2.push(generator2.selectTaskType());
      }

      // Sequences should be different (very high probability)
      const identical = selections1.every((type, index) => type === selections2[index]);
      expect(identical).toBe(false);
    });
  });

  describe('Weight Normalization Behavior', () => {
    it('should work correctly with non-normalized weights', () => {
      // Weights that don't sum to 1
      generator = new IdleTaskGenerator({
        maintenance: 20,    // 20/80 = 25%
        refactoring: 20,    // 20/80 = 25%
        docs: 20,           // 20/80 = 25%
        tests: 20,          // 20/80 = 25%
      });

      const counts: Record<IdleTaskType, number> = {
        maintenance: 0,
        refactoring: 0,
        docs: 0,
        tests: 0,
      };

      // Generate many selections
      for (let i = 0; i < 2000; i++) {
        const selectedType = generator.selectTaskType();
        counts[selectedType]++;
      }

      // Should be roughly equally distributed
      const expectedPercentage = 0.25;
      const tolerance = 0.05;

      Object.values(counts).forEach(count => {
        const percentage = count / 2000;
        expect(percentage).toBeGreaterThan(expectedPercentage - tolerance);
        expect(percentage).toBeLessThan(expectedPercentage + tolerance);
      });
    });

    it('should handle fractional weights correctly', () => {
      generator = new IdleTaskGenerator({
        maintenance: 0.33333,  // ~1/3
        refactoring: 0.33333,  // ~1/3
        docs: 0.33334,         // ~1/3
        tests: 0,
      });

      const counts: Record<IdleTaskType, number> = {
        maintenance: 0,
        refactoring: 0,
        docs: 0,
        tests: 0,
      };

      for (let i = 0; i < 3000; i++) {
        const selectedType = generator.selectTaskType();
        counts[selectedType]++;
      }

      // Each should be roughly 1/3
      expect(counts.maintenance).toBeGreaterThan(800);
      expect(counts.refactoring).toBeGreaterThan(800);
      expect(counts.docs).toBeGreaterThan(800);
      expect(counts.tests).toBe(0);
    });
  });

  describe('Edge Cases in Selection Logic', () => {
    it('should handle weights with different scales', () => {
      generator = new IdleTaskGenerator({
        maintenance: 0.001,
        refactoring: 1000,
        docs: 0.001,
        tests: 0.001,
      });

      // Refactoring should dominate due to much higher weight
      const counts: Record<IdleTaskType, number> = {
        maintenance: 0,
        refactoring: 0,
        docs: 0,
        tests: 0,
      };

      for (let i = 0; i < 1000; i++) {
        const selectedType = generator.selectTaskType();
        counts[selectedType]++;
      }

      expect(counts.refactoring).toBeGreaterThan(990);
    });

    it('should maintain selection consistency for the same weights', () => {
      const weights = { maintenance: 0.3, refactoring: 0.7, docs: 0, tests: 0 };

      const generator1 = new IdleTaskGenerator(weights);
      const generator2 = new IdleTaskGenerator({ ...weights }); // Copy weights

      // Both generators should have the same weight distribution behavior
      // (though individual selections will be random)
      const counts1: Record<IdleTaskType, number> = { maintenance: 0, refactoring: 0, docs: 0, tests: 0 };
      const counts2: Record<IdleTaskType, number> = { maintenance: 0, refactoring: 0, docs: 0, tests: 0 };

      for (let i = 0; i < 1000; i++) {
        const type1 = generator1.selectTaskType();
        const type2 = generator2.selectTaskType();
        counts1[type1]++;
        counts2[type2]++;
      }

      // Both should have similar distributions (within tolerance)
      const ratio1 = counts1.maintenance / (counts1.maintenance + counts1.refactoring);
      const ratio2 = counts2.maintenance / (counts2.maintenance + counts2.refactoring);

      expect(Math.abs(ratio1 - ratio2)).toBeLessThan(0.1);
    });
  });
});
/**
 * RefactoringAnalyzer Severity Scoring Tests
 *
 * Comprehensive tests for the weighted severity score calculation algorithms
 * used by RefactoringAnalyzer to prioritize complexity hotspots and code smells.
 *
 * Tests the sophisticated scoring system that considers:
 * - Multiple complexity dimensions (cyclomatic, cognitive, line count)
 * - Weighted prioritization formulas
 * - Combined complexity bonuses
 * - Severity-based score adjustments
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RefactoringAnalyzer } from './refactoring-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type { ComplexityHotspot, CodeSmell } from '@apexcli/core';

describe('RefactoringAnalyzer - Severity Scoring System', () => {
  let analyzer: RefactoringAnalyzer;
  let baseAnalysis: ProjectAnalysis;

  beforeEach(() => {
    analyzer = new RefactoringAnalyzer();

    baseAnalysis = {
      codebaseSize: {
        files: 75,
        lines: 10000,
        languages: { 'ts': 70, 'js': 30 }
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
        coverage: 65,
        missingDocs: [],
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 70,
          details: {
            totalEndpoints: 15,
            documentedEndpoints: 10,
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

  describe('Weighted Complexity Scoring Algorithm', () => {
    it('should apply correct weights to complexity dimensions (40% cyclomatic, 35% cognitive, 25% lines)', () => {
      // Test case designed to verify exact weighting
      const testHotspot: ComplexityHotspot = {
        file: 'src/weighted-test.ts',
        cyclomaticComplexity: 50, // At critical threshold
        cognitiveComplexity: 60,  // At critical threshold
        lineCount: 2000          // At critical threshold
      };

      baseAnalysis.codeQuality.complexityHotspots = [testHotspot];

      const candidates = analyzer.analyze(baseAnalysis);
      const task = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');

      expect(task).toBeDefined();

      // At critical thresholds with perfect scores, base calculation should be:
      // (0.40 * 1.0) + (0.35 * 1.0) + (0.25 * 1.0) = 1.0
      // Plus combined high complexity bonus of 0.15
      // Final score: 0.6 base + (1.0 * 0.35) + 0.15 bonus = 0.95 (capped)
      expect(task.score).toBeCloseTo(0.95, 2);
      expect(task.priority).toBe('urgent');
    });

    it('should normalize complexity values against critical thresholds', () => {
      const extremeComplexity: ComplexityHotspot = {
        file: 'src/extreme.ts',
        cyclomaticComplexity: 150, // 3x critical threshold (50)
        cognitiveComplexity: 180,  // 3x critical threshold (60)
        lineCount: 6000           // 3x critical threshold (2000)
      };

      baseAnalysis.codeQuality.complexityHotspots = [extremeComplexity];

      const candidates = analyzer.analyze(baseAnalysis);
      const task = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');

      expect(task).toBeDefined();

      // Values should be normalized (capped at 1.0) despite being well above thresholds
      expect(task.score).toBeLessThanOrEqual(0.95); // Should be capped
      expect(task.priority).toBe('urgent');
    });

    it('should calculate different scores for different complexity profiles', () => {
      const complexityProfiles: ComplexityHotspot[] = [
        {
          file: 'src/high-cyclomatic.ts',
          cyclomaticComplexity: 45, // High
          cognitiveComplexity: 20,  // Medium
          lineCount: 300           // Medium
        },
        {
          file: 'src/high-cognitive.ts',
          cyclomaticComplexity: 15, // Medium
          cognitiveComplexity: 50,  // High
          lineCount: 400           // Medium
        },
        {
          file: 'src/high-lines.ts',
          cyclomaticComplexity: 12, // Low
          cognitiveComplexity: 18,  // Low
          lineCount: 1800          // High
        }
      ];

      baseAnalysis.codeQuality.complexityHotspots = complexityProfiles;

      const candidates = analyzer.analyze(baseAnalysis);
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

      expect(hotspotTasks).toHaveLength(3);

      const cyclomaticTask = hotspotTasks.find(t => t.description.includes('high-cyclomatic'));
      const cognitiveTask = hotspotTasks.find(t => t.description.includes('high-cognitive'));
      const linesTask = hotspotTasks.find(t => t.description.includes('high-lines'));

      expect(cyclomaticTask).toBeDefined();
      expect(cognitiveTask).toBeDefined();
      expect(linesTask).toBeDefined();

      // Due to higher weight (40%), cyclomatic complexity should score highest
      expect(cyclomaticTask!.score).toBeGreaterThan(cognitiveTask!.score);
      expect(cognitiveTask!.score).toBeGreaterThan(linesTask!.score);
    });

    it('should apply combined high complexity bonus correctly', () => {
      const withBonus: ComplexityHotspot = {
        file: 'src/with-bonus.ts',
        cyclomaticComplexity: 35, // High
        cognitiveComplexity: 42,  // High
        lineCount: 400           // Medium
      };

      const withoutBonus: ComplexityHotspot = {
        file: 'src/without-bonus.ts',
        cyclomaticComplexity: 35, // High
        cognitiveComplexity: 20,  // Medium (no bonus)
        lineCount: 400           // Medium
      };

      baseAnalysis.codeQuality.complexityHotspots = [withBonus, withoutBonus];

      const candidates = analyzer.analyze(baseAnalysis);

      const bonusTask = candidates.find(c => c.description.includes('with-bonus'));
      const noBonusTask = candidates.find(c => c.description.includes('without-bonus'));

      expect(bonusTask).toBeDefined();
      expect(noBonusTask).toBeDefined();

      // Task with combined high complexity should have higher score
      expect(bonusTask!.score).toBeGreaterThan(noBonusTask!.score);

      // Bonus task should mention combined complexity
      expect(bonusTask!.description).toContain('combination of high cyclomatic and cognitive complexity');
      expect(bonusTask!.rationale).toContain('major refactoring with design patterns');
    });
  });

  describe('Complexity Threshold Classification', () => {
    it('should correctly classify cyclomatic complexity thresholds', () => {
      const thresholdTests: ComplexityHotspot[] = [
        { file: 'src/cyc-low.ts', cyclomaticComplexity: 8, cognitiveComplexity: 10, lineCount: 100 },
        { file: 'src/cyc-medium.ts', cyclomaticComplexity: 15, cognitiveComplexity: 10, lineCount: 100 },
        { file: 'src/cyc-high.ts', cyclomaticComplexity: 25, cognitiveComplexity: 10, lineCount: 100 },
        { file: 'src/cyc-critical.ts', cyclomaticComplexity: 55, cognitiveComplexity: 10, lineCount: 100 }
      ];

      baseAnalysis.codeQuality.complexityHotspots = thresholdTests;

      const candidates = analyzer.analyze(baseAnalysis);

      const lowTask = candidates.find(c => c.description.includes('cyc-low'));
      const mediumTask = candidates.find(c => c.description.includes('cyc-medium'));
      const highTask = candidates.find(c => c.description.includes('cyc-high'));
      const criticalTask = candidates.find(c => c.description.includes('cyc-critical'));

      expect(lowTask?.description).toContain('Cyclomatic Complexity: 8 (low)');
      expect(mediumTask?.description).toContain('Cyclomatic Complexity: 15 (medium)');
      expect(highTask?.description).toContain('Cyclomatic Complexity: 25 (high)');
      expect(criticalTask?.description).toContain('Cyclomatic Complexity: 55 (critical');

      expect(lowTask?.priority).toBe('low');
      expect(mediumTask?.priority).toBe('normal');
      expect(highTask?.priority).toBe('high');
      expect(criticalTask?.priority).toBe('urgent');
    });

    it('should correctly classify cognitive complexity thresholds', () => {
      const thresholdTests: ComplexityHotspot[] = [
        { file: 'src/cog-low.ts', cyclomaticComplexity: 5, cognitiveComplexity: 12, lineCount: 100 },
        { file: 'src/cog-medium.ts', cyclomaticComplexity: 5, cognitiveComplexity: 20, lineCount: 100 },
        { file: 'src/cog-high.ts', cyclomaticComplexity: 5, cognitiveComplexity: 35, lineCount: 100 },
        { file: 'src/cog-critical.ts', cyclomaticComplexity: 5, cognitiveComplexity: 65, lineCount: 100 }
      ];

      baseAnalysis.codeQuality.complexityHotspots = thresholdTests;

      const candidates = analyzer.analyze(baseAnalysis);

      const lowTask = candidates.find(c => c.description.includes('cog-low'));
      const mediumTask = candidates.find(c => c.description.includes('cog-medium'));
      const highTask = candidates.find(c => c.description.includes('cog-high'));
      const criticalTask = candidates.find(c => c.description.includes('cog-critical'));

      expect(lowTask?.description).toContain('Cognitive Complexity: 12 (low)');
      expect(mediumTask?.description).toContain('Cognitive Complexity: 20 (medium)');
      expect(highTask?.description).toContain('Cognitive Complexity: 35 (high)');
      expect(criticalTask?.description).toContain('Cognitive Complexity: 65 (critical');
    });

    it('should correctly classify line count thresholds', () => {
      const thresholdTests: ComplexityHotspot[] = [
        { file: 'src/lines-low.ts', cyclomaticComplexity: 5, cognitiveComplexity: 8, lineCount: 150 },
        { file: 'src/lines-medium.ts', cyclomaticComplexity: 5, cognitiveComplexity: 8, lineCount: 350 },
        { file: 'src/lines-high.ts', cyclomaticComplexity: 5, cognitiveComplexity: 8, lineCount: 1200 },
        { file: 'src/lines-critical.ts', cyclomaticComplexity: 5, cognitiveComplexity: 8, lineCount: 2500 }
      ];

      baseAnalysis.codeQuality.complexityHotspots = thresholdTests;

      const candidates = analyzer.analyze(baseAnalysis);

      const lowTask = candidates.find(c => c.description.includes('lines-low'));
      const mediumTask = candidates.find(c => c.description.includes('lines-medium'));
      const highTask = candidates.find(c => c.description.includes('lines-high'));
      const criticalTask = candidates.find(c => c.description.includes('lines-critical'));

      expect(lowTask?.description).toContain('Lines: 150 (low)');
      expect(mediumTask?.description).toContain('Lines: 350 (medium)');
      expect(highTask?.description).toContain('Lines: 1200 (high');
      expect(criticalTask?.description).toContain('Lines: 2500 (critical');
    });

    it('should use maximum severity for overall classification', () => {
      const mixedSeverity: ComplexityHotspot = {
        file: 'src/mixed.ts',
        cyclomaticComplexity: 8,   // Low
        cognitiveComplexity: 65,   // Critical
        lineCount: 300            // Medium
      };

      baseAnalysis.codeQuality.complexityHotspots = [mixedSeverity];

      const candidates = analyzer.analyze(baseAnalysis);
      const task = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');

      expect(task).toBeDefined();

      // Overall severity should be critical (max of low, critical, medium)
      expect(task.priority).toBe('urgent'); // Maps from critical severity
      expect(task.estimatedEffort).toBe('high');
      expect(task.description).toContain('requires immediate attention');
    });
  });

  describe('Code Smell Severity Scoring', () => {
    it('should assign correct scores based on code smell severity levels', () => {
      const severityTests: CodeSmell[] = [
        {
          file: 'src/critical-smell.ts',
          type: 'long-method',
          severity: 'critical',
          details: 'Critical method requiring immediate attention'
        },
        {
          file: 'src/high-smell.ts',
          type: 'large-class',
          severity: 'high',
          details: 'High severity class issue'
        },
        {
          file: 'src/medium-smell.ts',
          type: 'deep-nesting',
          severity: 'medium',
          details: 'Medium severity nesting issue'
        },
        {
          file: 'src/low-smell.ts',
          type: 'dead-code',
          severity: 'low',
          details: 'Low severity dead code'
        }
      ];

      baseAnalysis.codeQuality.codeSmells = severityTests;

      const candidates = analyzer.analyze(baseAnalysis);

      const criticalTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
      const highTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class');
      const mediumTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-deep-nesting');
      const lowTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-dead-code');

      // Verify score ordering
      expect(criticalTask?.score).toBeGreaterThan(highTask?.score || 0);
      expect(highTask?.score).toBeGreaterThan(mediumTask?.score || 0);
      expect(mediumTask?.score).toBeGreaterThan(lowTask?.score || 0);

      // Verify expected score ranges
      expect(criticalTask?.score).toBe(0.85); // Expected for critical
      expect(highTask?.score).toBe(0.75);     // Expected for high
      expect(mediumTask?.score).toBe(0.6);    // Expected for medium
      expect(lowTask?.score).toBe(0.4);       // Expected for low

      // Verify priority mapping
      expect(criticalTask?.priority).toBe('urgent');
      expect(highTask?.priority).toBe('high');
      expect(mediumTask?.priority).toBe('normal');
      expect(lowTask?.priority).toBe('low');
    });

    it('should adjust scores based on code smell count', () => {
      const baseSmells: CodeSmell[] = [
        {
          file: 'src/smell1.ts',
          type: 'long-method',
          severity: 'medium',
          details: 'Method 1'
        },
        {
          file: 'src/smell2.ts',
          type: 'long-method',
          severity: 'medium',
          details: 'Method 2'
        },
        {
          file: 'src/smell3.ts',
          type: 'long-method',
          severity: 'medium',
          details: 'Method 3'
        }
      ];

      const manySmells: CodeSmell[] = [
        ...baseSmells,
        ...Array.from({ length: 4 }, (_, i) => ({
          file: `src/smell${i + 4}.ts`,
          type: 'long-method' as const,
          severity: 'medium' as const,
          details: `Method ${i + 4}`
        }))
      ]; // 7 total

      const extremeSmells: CodeSmell[] = [
        ...manySmells,
        ...Array.from({ length: 8 }, (_, i) => ({
          file: `src/smell${i + 8}.ts`,
          type: 'long-method' as const,
          severity: 'medium' as const,
          details: `Method ${i + 8}`
        }))
      ]; // 15 total

      // Test base case (3 smells)
      baseAnalysis.codeQuality.codeSmells = baseSmells;
      const baseCandidates = analyzer.analyze(baseAnalysis);
      const baseTask = baseCandidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
      const baseScore = baseTask?.score || 0;

      // Test many smells (7 > 5, should get +0.1 bonus)
      baseAnalysis.codeQuality.codeSmells = manySmells;
      const manyCandidates = analyzer.analyze(baseAnalysis);
      const manyTask = manyCandidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
      const manyScore = manyTask?.score || 0;

      // Test extreme smells (15 > 10, should get +0.2 bonus total)
      baseAnalysis.codeQuality.codeSmells = extremeSmells;
      const extremeCandidates = analyzer.analyze(baseAnalysis);
      const extremeTask = extremeCandidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
      const extremeScore = extremeTask?.score || 0;

      expect(manyScore).toBeGreaterThan(baseScore);
      expect(extremeScore).toBeGreaterThan(manyScore);
      expect(extremeScore).toBeCloseTo(0.8, 1); // 0.6 base + 0.1 + 0.1 bonuses
    });

    it('should handle mixed severity levels within same code smell type', () => {
      const mixedSeveritySmells: CodeSmell[] = [
        { file: 'src/critical.ts', type: 'long-method', severity: 'critical', details: 'Critical method' },
        { file: 'src/high.ts', type: 'long-method', severity: 'high', details: 'High severity method' },
        { file: 'src/medium1.ts', type: 'long-method', severity: 'medium', details: 'Medium method 1' },
        { file: 'src/medium2.ts', type: 'long-method', severity: 'medium', details: 'Medium method 2' },
        { file: 'src/low.ts', type: 'long-method', severity: 'low', details: 'Low severity method' }
      ];

      baseAnalysis.codeQuality.codeSmells = mixedSeveritySmells;

      const candidates = analyzer.analyze(baseAnalysis);
      const task = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');

      expect(task).toBeDefined();

      // Overall severity should be critical (presence of critical smell)
      expect(task.priority).toBe('urgent');
      expect(task.estimatedEffort).toBe('high');
      expect(task.score).toBe(0.85); // Critical severity score

      // Should include details from all smells
      expect(task.rationale).toContain('Critical method');
      expect(task.rationale).toContain('High severity method');
      expect(task.rationale).toContain('Medium method 1');
    });
  });

  describe('Prioritization and Scoring Edge Cases', () => {
    it('should handle boundary values correctly', () => {
      const boundaryTests: ComplexityHotspot[] = [
        {
          file: 'src/boundary-low.ts',
          cyclomaticComplexity: 10,  // Exactly at low/medium boundary
          cognitiveComplexity: 15,   // Exactly at low/medium boundary
          lineCount: 200            // Exactly at low/medium boundary
        },
        {
          file: 'src/boundary-medium.ts',
          cyclomaticComplexity: 20,  // Exactly at medium/high boundary
          cognitiveComplexity: 25,   // Exactly at medium/high boundary
          lineCount: 500            // Exactly at medium/high boundary
        }
      ];

      baseAnalysis.codeQuality.complexityHotspots = boundaryTests;

      const candidates = analyzer.analyze(baseAnalysis);

      const lowTask = candidates.find(c => c.description.includes('boundary-low'));
      const mediumTask = candidates.find(c => c.description.includes('boundary-medium'));

      expect(lowTask?.description).toContain('(low)');
      expect(mediumTask?.description).toContain('(medium)');
    });

    it('should handle zero complexity values', () => {
      const zeroComplexity: ComplexityHotspot = {
        file: 'src/zero.ts',
        cyclomaticComplexity: 0,
        cognitiveComplexity: 0,
        lineCount: 0
      };

      baseAnalysis.codeQuality.complexityHotspots = [zeroComplexity];

      const candidates = analyzer.analyze(baseAnalysis);
      const task = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');

      expect(task).toBeDefined();
      expect(task.priority).toBe('low');
      expect(task.score).toBeGreaterThan(0); // Should still have minimum score
    });

    it('should cap scores at maximum threshold', () => {
      const maxComplexity: ComplexityHotspot = {
        file: 'src/maximum.ts',
        cyclomaticComplexity: 1000, // Far beyond critical
        cognitiveComplexity: 1000,  // Far beyond critical
        lineCount: 10000           // Far beyond critical
      };

      baseAnalysis.codeQuality.complexityHotspots = [maxComplexity];

      const candidates = analyzer.analyze(baseAnalysis);
      const task = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');

      expect(task).toBeDefined();
      expect(task.score).toBeLessThanOrEqual(0.95); // Should be capped at 0.95
      expect(task.priority).toBe('urgent');
    });
  });
});
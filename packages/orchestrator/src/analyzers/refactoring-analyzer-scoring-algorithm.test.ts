/**
 * RefactoringAnalyzer Weighted Severity Scoring Algorithm Tests
 *
 * Tests for the sophisticated weighted scoring algorithm that calculates
 * priority scores for complexity hotspots and code smells based on:
 * - Multiple complexity dimensions (cyclomatic, cognitive, line count)
 * - Weighted formula with configurable priority weights
 * - Severity classification and mapping to task priorities
 * - Bonus scoring for combined high complexity
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RefactoringAnalyzer } from './refactoring-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type { ComplexityHotspot, CodeSmell } from '@apexcli/core';

describe('RefactoringAnalyzer - Weighted Severity Scoring Algorithm Tests', () => {
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

  describe('complexity hotspot severity classification', () => {
    it('should classify cyclomatic complexity levels correctly', () => {
      const hotspots: ComplexityHotspot[] = [
        {
          file: 'src/low.ts',
          functionName: 'lowComplexity',
          cyclomaticComplexity: 8,   // Low (< 10)
          cognitiveComplexity: 10,
          lineCount: 100
        },
        {
          file: 'src/medium.ts',
          functionName: 'mediumComplexity',
          cyclomaticComplexity: 15,  // Medium (10-20)
          cognitiveComplexity: 10,
          lineCount: 100
        },
        {
          file: 'src/high.ts',
          functionName: 'highComplexity',
          cyclomaticComplexity: 25,  // High (20-30)
          cognitiveComplexity: 10,
          lineCount: 100
        },
        {
          file: 'src/critical.ts',
          functionName: 'criticalComplexity',
          cyclomaticComplexity: 60,  // Critical (> 50)
          cognitiveComplexity: 10,
          lineCount: 100
        }
      ];

      baseAnalysis.codeQuality.complexityHotspots = hotspots;

      const candidates = analyzer.analyze(baseAnalysis);
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

      expect(hotspotTasks).toHaveLength(4);

      // Tasks should be ordered by score (highest first)
      const criticalTask = hotspotTasks.find(t => t.description.includes('critical.ts'));
      const highTask = hotspotTasks.find(t => t.description.includes('high.ts'));
      const mediumTask = hotspotTasks.find(t => t.description.includes('medium.ts'));
      const lowTask = hotspotTasks.find(t => t.description.includes('low.ts'));

      // Verify priority mapping
      expect(criticalTask!.priority).toBe('urgent');
      expect(highTask!.priority).toBe('high');
      expect(mediumTask!.priority).toBe('normal');
      expect(lowTask!.priority).toBe('low');

      // Verify score ordering
      expect(criticalTask!.score).toBeGreaterThan(highTask!.score);
      expect(highTask!.score).toBeGreaterThan(mediumTask!.score);
      expect(mediumTask!.score).toBeGreaterThan(lowTask!.score);
    });

    it('should classify cognitive complexity levels correctly', () => {
      const hotspots: ComplexityHotspot[] = [
        {
          file: 'src/low-cognitive.ts',
          functionName: 'lowCognitive',
          cyclomaticComplexity: 5,
          cognitiveComplexity: 10,   // Low (< 15)
          lineCount: 100
        },
        {
          file: 'src/medium-cognitive.ts',
          functionName: 'mediumCognitive',
          cyclomaticComplexity: 5,
          cognitiveComplexity: 20,   // Medium (15-25)
          lineCount: 100
        },
        {
          file: 'src/high-cognitive.ts',
          functionName: 'highCognitive',
          cyclomaticComplexity: 5,
          cognitiveComplexity: 35,   // High (25-40)
          lineCount: 100
        },
        {
          file: 'src/critical-cognitive.ts',
          functionName: 'criticalCognitive',
          cyclomaticComplexity: 5,
          cognitiveComplexity: 70,   // Critical (> 60)
          lineCount: 100
        }
      ];

      baseAnalysis.codeQuality.complexityHotspots = hotspots;

      const candidates = analyzer.analyze(baseAnalysis);
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

      expect(hotspotTasks).toHaveLength(4);

      const criticalTask = hotspotTasks.find(t => t.description.includes('critical-cognitive.ts'));
      const highTask = hotspotTasks.find(t => t.description.includes('high-cognitive.ts'));

      // High cognitive complexity should result in appropriate priority and recommendations
      expect(criticalTask!.priority).toBe('urgent');
      expect(highTask!.priority).toBe('high');

      expect(criticalTask!.rationale).toContain('Flatten control flow to improve readability');
      expect(highTask!.rationale).toContain('Extract helper methods for complex logic blocks');
    });

    it('should classify line count levels correctly', () => {
      const hotspots: ComplexityHotspot[] = [
        {
          file: 'src/small.ts',
          functionName: 'smallFile',
          cyclomaticComplexity: 5,
          cognitiveComplexity: 8,
          lineCount: 150            // Low (< 200)
        },
        {
          file: 'src/medium-size.ts',
          functionName: 'mediumFile',
          cyclomaticComplexity: 5,
          cognitiveComplexity: 8,
          lineCount: 350            // Medium (200-500)
        },
        {
          file: 'src/large.ts',
          functionName: 'largeFile',
          cyclomaticComplexity: 5,
          cognitiveComplexity: 8,
          lineCount: 750            // High (500-1000)
        },
        {
          file: 'src/huge.ts',
          functionName: 'hugeFile',
          cyclomaticComplexity: 5,
          cognitiveComplexity: 8,
          lineCount: 2500           // Critical (> 2000)
        }
      ];

      baseAnalysis.codeQuality.complexityHotspots = hotspots;

      const candidates = analyzer.analyze(baseAnalysis);
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

      const hugeTask = hotspotTasks.find(t => t.description.includes('huge.ts'));
      const largeTask = hotspotTasks.find(t => t.description.includes('large.ts'));

      expect(hugeTask!.priority).toBe('urgent');
      expect(largeTask!.priority).toBe('high');

      // Large file recommendations
      expect(hugeTask!.rationale).toContain('Split into multiple modules applying Single Responsibility Principle');
      expect(largeTask!.rationale).toContain('Extract related functionality into separate classes');
    });

    it('should use maximum severity across all dimensions for overall classification', () => {
      const mixedComplexityHotspot: ComplexityHotspot = {
        file: 'src/mixed.ts',
        functionName: 'mixedComplexity',
        cyclomaticComplexity: 8,   // Low
        cognitiveComplexity: 70,   // Critical
        lineCount: 300            // Medium
      };

      baseAnalysis.codeQuality.complexityHotspots = [mixedComplexityHotspot];

      const candidates = analyzer.analyze(baseAnalysis);
      const task = candidates.find(c => c.candidateId.includes('complexity-hotspot-'));

      // Overall severity should be Critical (from cognitive complexity)
      expect(task!.priority).toBe('urgent');
      expect(task!.description).toContain('very hard to understand');
    });
  });

  describe('weighted priority scoring formula', () => {
    it('should apply correct weights to complexity dimensions', () => {
      // Test hotspots with identical values in one dimension and different in others
      const hotspots: ComplexityHotspot[] = [
        {
          file: 'src/high-cyclomatic.ts',
          functionName: 'highCyclomatic',
          cyclomaticComplexity: 50,  // High contribution (weight 0.40)
          cognitiveComplexity: 15,   // Low contribution (weight 0.35)
          lineCount: 200            // Low contribution (weight 0.25)
        },
        {
          file: 'src/high-cognitive.ts',
          functionName: 'highCognitive',
          cyclomaticComplexity: 10,  // Low contribution
          cognitiveComplexity: 50,   // High contribution (weight 0.35)
          lineCount: 200            // Low contribution
        },
        {
          file: 'src/high-lines.ts',
          functionName: 'highLines',
          cyclomaticComplexity: 10,  // Low contribution
          cognitiveComplexity: 15,   // Low contribution
          lineCount: 1500           // High contribution (weight 0.25)
        }
      ];

      baseAnalysis.codeQuality.complexityHotspots = hotspots;

      const candidates = analyzer.analyze(baseAnalysis);
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

      const cyclomaticTask = hotspotTasks.find(t => t.description.includes('high-cyclomatic.ts'));
      const cognitiveTask = hotspotTasks.find(t => t.description.includes('high-cognitive.ts'));
      const linesTask = hotspotTasks.find(t => t.description.includes('high-lines.ts'));

      // Due to weighting (cyclomatic: 0.40, cognitive: 0.35, lines: 0.25)
      // High cyclomatic should score highest, cognitive next, lines last
      expect(cyclomaticTask!.score).toBeGreaterThan(cognitiveTask!.score);
      expect(cognitiveTask!.score).toBeGreaterThan(linesTask!.score);
    });

    it('should normalize values against critical thresholds', () => {
      const extremeComplexityHotspot: ComplexityHotspot = {
        file: 'src/extreme.ts',
        functionName: 'extremeFunction',
        cyclomaticComplexity: 100, // 2x critical threshold (50)
        cognitiveComplexity: 120,  // 2x critical threshold (60)
        lineCount: 4000           // 2x critical threshold (2000)
      };

      baseAnalysis.codeQuality.complexityHotspots = [extremeComplexityHotspot];

      const candidates = analyzer.analyze(baseAnalysis);
      const task = candidates.find(c => c.candidateId.includes('complexity-hotspot-'));

      expect(task).toBeDefined();
      // Score should be capped properly - normalized values are capped at 1.0
      expect(task!.score).toBeLessThanOrEqual(0.95); // Algorithm caps score at 0.95
      expect(task!.priority).toBe('urgent');
    });

    it('should apply bonus scoring for combined high complexity', () => {
      const combinedHighHotspot: ComplexityHotspot = {
        file: 'src/combined-high.ts',
        functionName: 'combinedHigh',
        cyclomaticComplexity: 35,  // High
        cognitiveComplexity: 45,   // High
        lineCount: 600            // Medium
      };

      const singleHighHotspot: ComplexityHotspot = {
        file: 'src/single-high.ts',
        functionName: 'singleHigh',
        cyclomaticComplexity: 35,  // High
        cognitiveComplexity: 20,   // Medium
        lineCount: 600            // Medium
      };

      baseAnalysis.codeQuality.complexityHotspots = [combinedHighHotspot, singleHighHotspot];

      const candidates = analyzer.analyze(baseAnalysis);

      const combinedTask = candidates.find(c => c.description.includes('combined-high.ts'));
      const singleTask = candidates.find(c => c.description.includes('single-high.ts'));

      expect(combinedTask).toBeDefined();
      expect(singleTask).toBeDefined();

      // Combined high complexity should get bonus and score higher
      expect(combinedTask!.score).toBeGreaterThan(singleTask!.score);

      // Combined task should include specific messaging about combined complexity
      expect(combinedTask!.description).toContain('combination of high cyclomatic and cognitive complexity');
      expect(combinedTask!.rationale).toContain('major refactoring with design patterns');
    });

    it('should calculate base score ranges correctly for different severity levels', () => {
      const severityHotspots: ComplexityHotspot[] = [
        {
          file: 'src/low-severity.ts',
          functionName: 'lowSeverity',
          cyclomaticComplexity: 8,   // All low
          cognitiveComplexity: 12,
          lineCount: 150
        },
        {
          file: 'src/medium-severity.ts',
          functionName: 'mediumSeverity',
          cyclomaticComplexity: 15,  // All medium
          cognitiveComplexity: 20,
          lineCount: 350
        },
        {
          file: 'src/high-severity.ts',
          functionName: 'highSeverity',
          cyclomaticComplexity: 25,  // All high
          cognitiveComplexity: 30,
          lineCount: 750
        },
        {
          file: 'src/critical-severity.ts',
          functionName: 'criticalSeverity',
          cyclomaticComplexity: 60,  // All critical
          cognitiveComplexity: 70,
          lineCount: 2200
        }
      ];

      baseAnalysis.codeQuality.complexityHotspots = severityHotspots;

      const candidates = analyzer.analyze(baseAnalysis);
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

      const criticalTask = hotspotTasks.find(t => t.description.includes('critical-severity.ts'));
      const highTask = hotspotTasks.find(t => t.description.includes('high-severity.ts'));
      const mediumTask = hotspotTasks.find(t => t.description.includes('medium-severity.ts'));
      const lowTask = hotspotTasks.find(t => t.description.includes('low-severity.ts'));

      // Verify score ranges for different severity levels
      expect(criticalTask!.score).toBeGreaterThan(0.85); // High range
      expect(highTask!.score).toBeGreaterThan(0.75);     // Medium-high range
      expect(highTask!.score).toBeLessThan(criticalTask!.score);
      expect(mediumTask!.score).toBeGreaterThan(0.6);    // Medium range
      expect(mediumTask!.score).toBeLessThan(highTask!.score);
      expect(lowTask!.score).toBeLessThan(mediumTask!.score); // Low range
    });
  });

  describe('code smell weighted scoring', () => {
    it('should score code smells based on severity levels', () => {
      const codeSmells: CodeSmell[] = [
        {
          file: 'src/critical-smell.ts',
          type: 'long-method',
          severity: 'critical',
          details: 'Critical method complexity'
        },
        {
          file: 'src/high-smell.ts',
          type: 'large-class',
          severity: 'high',
          details: 'High severity class size'
        },
        {
          file: 'src/medium-smell.ts',
          type: 'deep-nesting',
          severity: 'medium',
          details: 'Medium nesting complexity'
        },
        {
          file: 'src/low-smell.ts',
          type: 'dead-code',
          severity: 'low',
          details: 'Low priority dead code'
        }
      ];

      baseAnalysis.codeQuality.codeSmells = codeSmells;

      const candidates = analyzer.analyze(baseAnalysis);
      const smellTasks = candidates.filter(c => c.candidateId.includes('code-smell-'));

      expect(smellTasks).toHaveLength(4);

      const criticalTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
      const highTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class');
      const mediumTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-deep-nesting');
      const lowTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-dead-code');

      // Verify score ordering based on severity
      expect(criticalTask!.score).toBeGreaterThan(highTask!.score);
      expect(highTask!.score).toBeGreaterThan(mediumTask!.score);
      expect(mediumTask!.score).toBeGreaterThan(lowTask!.score);

      // Verify expected score ranges
      expect(criticalTask!.score).toBeGreaterThan(0.8);
      expect(highTask!.score).toBeGreaterThan(0.7);
      expect(mediumTask!.score).toBeGreaterThan(0.5);
      expect(lowTask!.score).toBeGreaterThan(0.3);

      // Verify priority mapping
      expect(criticalTask!.priority).toBe('urgent');
      expect(highTask!.priority).toBe('high');
      expect(mediumTask!.priority).toBe('normal');
      expect(lowTask!.priority).toBe('low');
    });

    it('should adjust code smell scores based on count', () => {
      const fewSmells: CodeSmell[] = [
        {
          file: 'src/smell1.ts',
          type: 'long-method',
          severity: 'medium',
          details: 'Medium smell 1'
        },
        {
          file: 'src/smell2.ts',
          type: 'long-method',
          severity: 'medium',
          details: 'Medium smell 2'
        }
      ];

      const manySmells: CodeSmell[] = Array.from({ length: 12 }, (_, i) => ({
        file: `src/smell${i}.ts`,
        type: 'long-method' as const,
        severity: 'medium' as const,
        details: `Medium smell ${i}`
      }));

      // Test with few smells
      baseAnalysis.codeQuality.codeSmells = fewSmells;
      const fewCandidates = analyzer.analyze(baseAnalysis);
      const fewTask = fewCandidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');

      // Test with many smells
      baseAnalysis.codeQuality.codeSmells = manySmells;
      const manyCandidates = analyzer.analyze(baseAnalysis);
      const manyTask = manyCandidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');

      expect(fewTask).toBeDefined();
      expect(manyTask).toBeDefined();

      // Many smells should have higher score due to count adjustment
      expect(manyTask!.score).toBeGreaterThan(fewTask!.score);

      // Verify the score increase is appropriate (should get bonus for >5 and >10 smells)
      const scoreDifference = manyTask!.score - fewTask!.score;
      expect(scoreDifference).toBeGreaterThan(0.1); // Should get at least 0.1 bonus
    });

    it('should handle mixed severity code smells for same type', () => {
      const mixedSeveritySmells: CodeSmell[] = [
        {
          file: 'src/critical.ts',
          type: 'long-method',
          severity: 'critical',
          details: 'Critical long method'
        },
        {
          file: 'src/high.ts',
          type: 'long-method',
          severity: 'high',
          details: 'High severity long method'
        },
        {
          file: 'src/medium.ts',
          type: 'long-method',
          severity: 'medium',
          details: 'Medium severity long method'
        }
      ];

      baseAnalysis.codeQuality.codeSmells = mixedSeveritySmells;

      const candidates = analyzer.analyze(baseAnalysis);
      const task = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');

      expect(task).toBeDefined();

      // Should take highest severity (critical) for overall classification
      expect(task!.priority).toBe('urgent');
      expect(task!.estimatedEffort).toBe('high');
      expect(task!.score).toBe(0.85); // Critical severity base score

      // Description should reflect the count
      expect(task!.description).toContain('3 long methods');
    });
  });

  describe('lint issues severity scoring', () => {
    it('should calculate lint severity based on issue count', () => {
      const lintIssueCounts = [5, 25, 75, 250];
      const expectedPriorities = ['low', 'low', 'normal', 'high'] as const;
      const expectedEfforts = ['low', 'low', 'medium', 'high'] as const;

      for (let i = 0; i < lintIssueCounts.length; i++) {
        baseAnalysis.codeQuality.lintIssues = lintIssueCounts[i];

        const candidates = analyzer.analyze(baseAnalysis);
        const lintTask = candidates.find(c => c.candidateId === 'refactoring-lint-issues');

        expect(lintTask).toBeDefined();
        expect(lintTask!.priority).toBe(expectedPriorities[i]);
        expect(lintTask!.estimatedEffort).toBe(expectedEfforts[i]);

        // Verify score increases with issue count
        if (i > 0) {
          baseAnalysis.codeQuality.lintIssues = lintIssueCounts[i - 1];
          const prevCandidates = analyzer.analyze(baseAnalysis);
          const prevLintTask = prevCandidates.find(c => c.candidateId === 'refactoring-lint-issues');

          if (prevLintTask) {
            expect(lintTask!.score).toBeGreaterThan(prevLintTask.score);
          }
        }
      }
    });

    it('should handle edge case of zero lint issues', () => {
      baseAnalysis.codeQuality.lintIssues = 0;

      const candidates = analyzer.analyze(baseAnalysis);
      const lintTask = candidates.find(c => c.candidateId === 'refactoring-lint-issues');

      // Should not create a task for zero lint issues
      expect(lintTask).toBeUndefined();
    });

    it('should create appropriate lint task descriptions', () => {
      baseAnalysis.codeQuality.lintIssues = 42;

      const candidates = analyzer.analyze(baseAnalysis);
      const lintTask = candidates.find(c => c.candidateId === 'refactoring-lint-issues');

      expect(lintTask).toBeDefined();
      expect(lintTask!.title).toBe('Fix Linting Issues');
      expect(lintTask!.description).toBe('Address 42 linting issues in the codebase');
      expect(lintTask!.rationale).toContain('Linting issues indicate code quality problems');
    });
  });

  describe('task ordering and prioritization', () => {
    it('should order tasks by score in descending order', () => {
      const mixedComplexityData: ComplexityHotspot[] = [
        {
          file: 'src/medium-priority.ts',
          functionName: 'mediumFunction',
          cyclomaticComplexity: 18,
          cognitiveComplexity: 22,
          lineCount: 400
        },
        {
          file: 'src/high-priority.ts',
          functionName: 'highFunction',
          cyclomaticComplexity: 40,
          cognitiveComplexity: 45,
          lineCount: 900
        },
        {
          file: 'src/low-priority.ts',
          functionName: 'lowFunction',
          cyclomaticComplexity: 8,
          cognitiveComplexity: 12,
          lineCount: 200
        }
      ];

      baseAnalysis.codeQuality.complexityHotspots = mixedComplexityData;

      const candidates = analyzer.analyze(baseAnalysis);
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

      expect(hotspotTasks).toHaveLength(3);

      // Tasks should be ordered by score (highest first)
      expect(hotspotTasks[0].score).toBeGreaterThan(hotspotTasks[1].score);
      expect(hotspotTasks[1].score).toBeGreaterThan(hotspotTasks[2].score);

      // Verify the actual ordering matches expectations
      expect(hotspotTasks[0].description).toContain('high-priority.ts');
      expect(hotspotTasks[1].description).toContain('medium-priority.ts');
      expect(hotspotTasks[2].description).toContain('low-priority.ts');
    });

    it('should limit individual hotspot tasks to top 3', () => {
      const manyHotspots: ComplexityHotspot[] = Array.from({ length: 6 }, (_, i) => ({
        file: `src/hotspot${i}.ts`,
        functionName: `function${i}`,
        cyclomaticComplexity: 20 + i * 5,
        cognitiveComplexity: 25 + i * 5,
        lineCount: 400 + i * 100
      }));

      baseAnalysis.codeQuality.complexityHotspots = manyHotspots;

      const candidates = analyzer.analyze(baseAnalysis);
      const individualTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));
      const aggregateTask = candidates.find(c => c.candidateId === 'refactoring-complexity-sweep');

      expect(individualTasks).toHaveLength(3);
      expect(aggregateTask).toBeDefined();

      // Top 3 should be the highest complexity ones (highest indices due to our generation)
      expect(individualTasks[0].description).toContain('hotspot5.ts');
      expect(individualTasks[1].description).toContain('hotspot4.ts');
      expect(individualTasks[2].description).toContain('hotspot3.ts');
    });
  });
});
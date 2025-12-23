/**
 * Enhanced RefactoringAnalyzer - Complexity Metrics Tests
 *
 * This test suite provides comprehensive coverage for complexity hotspot detection
 * with various metric combinations, priority scoring, and edge cases.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RefactoringAnalyzer } from './refactoring-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type { ComplexityHotspot } from '@apexcli/core';

describe('Enhanced RefactoringAnalyzer - Complexity Metrics', () => {
  let analyzer: RefactoringAnalyzer;
  let baseProjectAnalysis: ProjectAnalysis;

  beforeEach(() => {
    analyzer = new RefactoringAnalyzer();

    baseProjectAnalysis = {
      codebaseSize: {
        files: 80,
        lines: 12000,
        languages: { 'ts': 75, 'js': 20, 'json': 5 }
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
        coverage: 60,
        missingDocs: [],
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 65,
          details: {
            totalEndpoints: 25,
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
      }
    };
  });

  describe('Single Dimension High Complexity', () => {
    it('should detect cyclomatic-only complexity hotspots', () => {
      const hotspot: ComplexityHotspot = {
        file: 'src/algorithms/SortingEngine.ts',
        cyclomaticComplexity: 42, // High (>30)
        cognitiveComplexity: 14, // Low (<15)
        lineCount: 190 // Low (<200)
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [hotspot];
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(hotspotTask).toBeDefined();
      expect(hotspotTask?.priority).toBe('high');
      expect(hotspotTask?.description).toContain('Cyclomatic Complexity: 42 (high)');
      expect(hotspotTask?.description).toContain('Cognitive Complexity: 14 (low)');
      expect(hotspotTask?.rationale).toContain('Extract methods to reduce branching complexity');
      expect(hotspotTask?.rationale).toContain('Replace complex conditionals with polymorphism');
    });

    it('should detect cognitive-only complexity hotspots', () => {
      const hotspot: ComplexityHotspot = {
        file: 'src/parsers/JSONAnalyzer.ts',
        cyclomaticComplexity: 8, // Low
        cognitiveComplexity: 52, // High (>40)
        lineCount: 175 // Low
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [hotspot];
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(hotspotTask).toBeDefined();
      expect(hotspotTask?.priority).toBe('high');
      expect(hotspotTask?.description).toContain('Cognitive Complexity: 52 (high)');
      expect(hotspotTask?.rationale).toContain('Flatten control flow to improve readability');
      expect(hotspotTask?.rationale).toContain('Add explanatory intermediate variables');
    });

    it('should detect line-count-only complexity hotspots', () => {
      const hotspot: ComplexityHotspot = {
        file: 'src/models/ComprehensiveUserModel.ts',
        cyclomaticComplexity: 9, // Low
        cognitiveComplexity: 13, // Low
        lineCount: 1350 // High (>1000)
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [hotspot];
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(hotspotTask).toBeDefined();
      expect(hotspotTask?.priority).toBe('high');
      expect(hotspotTask?.description).toContain('Lines: 1350 (high');
      expect(hotspotTask?.rationale).toContain('Split into multiple modules applying Single Responsibility');
      expect(hotspotTask?.rationale).toContain('Extract related functionality into separate classes');
    });
  });

  describe('Multi-Dimension Complexity Combinations', () => {
    it('should detect and bonus combined high cyclomatic + cognitive complexity', () => {
      const hotspot: ComplexityHotspot = {
        file: 'src/core/BusinessLogicEngine.ts',
        cyclomaticComplexity: 38, // High
        cognitiveComplexity: 47, // High
        lineCount: 580 // Medium
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [hotspot];
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(hotspotTask).toBeDefined();
      expect(hotspotTask?.description).toContain('combination of high cyclomatic and cognitive complexity');
      expect(hotspotTask?.rationale).toContain('major refactoring with design patterns');
      expect(hotspotTask?.rationale).toContain('Break down into smaller, focused modules');
      expect(hotspotTask?.rationale).toContain('Apply SOLID principles systematically');
      // Should receive combined high complexity bonus
      expect(hotspotTask?.score).toBeGreaterThan(0.75);
    });

    it('should handle triple high complexity (all dimensions)', () => {
      const hotspot: ComplexityHotspot = {
        file: 'src/legacy/MonolithicProcessor.ts',
        cyclomaticComplexity: 55, // Critical
        cognitiveComplexity: 72, // Critical
        lineCount: 2800 // Critical
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [hotspot];
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(hotspotTask).toBeDefined();
      expect(hotspotTask?.priority).toBe('urgent');
      expect(hotspotTask?.estimatedEffort).toBe('high');
      expect(hotspotTask?.description).toContain('requires immediate attention');

      // Should have recommendations for all dimensions
      expect(hotspotTask?.rationale).toContain('Extract methods to reduce branching complexity'); // Cyclomatic
      expect(hotspotTask?.rationale).toContain('Flatten control flow to improve readability'); // Cognitive
      expect(hotspotTask?.rationale).toContain('Split into multiple modules'); // Lines
      expect(hotspotTask?.rationale).toContain('major refactoring with design patterns'); // Combined
    });

    it('should handle mixed medium/high combinations', () => {
      const hotspot: ComplexityHotspot = {
        file: 'src/services/DataTransformer.ts',
        cyclomaticComplexity: 22, // Medium
        cognitiveComplexity: 44, // High
        lineCount: 750 // Medium
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [hotspot];
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(hotspotTask).toBeDefined();
      expect(hotspotTask?.priority).toBe('high'); // Overall high due to cognitive complexity
      expect(hotspotTask?.description).toContain('Cyclomatic Complexity: 22 (medium)');
      expect(hotspotTask?.description).toContain('Cognitive Complexity: 44 (high');
    });
  });

  describe('Complexity Threshold Classification', () => {
    it('should correctly classify low complexity across all dimensions', () => {
      const hotspot: ComplexityHotspot = {
        file: 'src/utils/SimpleHelpers.ts',
        cyclomaticComplexity: 6, // Low (<10)
        cognitiveComplexity: 9, // Low (<15)
        lineCount: 120 // Low (<200)
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [hotspot];
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(hotspotTask).toBeDefined();
      expect(hotspotTask?.priority).toBe('low');
      expect(hotspotTask?.description).toContain('Cyclomatic Complexity: 6 (low)');
      expect(hotspotTask?.description).toContain('Cognitive Complexity: 9 (low)');
      expect(hotspotTask?.description).toContain('Lines: 120 (low)');
      expect(hotspotTask?.rationale).toContain('Review for potential simplification opportunities');
    });

    it('should correctly classify medium complexity at boundaries', () => {
      const hotspot: ComplexityHotspot = {
        file: 'src/modules/DataProcessor.ts',
        cyclomaticComplexity: 15, // Medium (10-20)
        cognitiveComplexity: 20, // Medium (15-25)
        lineCount: 350 // Medium (200-500)
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [hotspot];
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(hotspotTask).toBeDefined();
      expect(hotspotTask?.priority).toBe('normal');
      expect(hotspotTask?.estimatedEffort).toBe('medium');
      expect(hotspotTask?.description).toContain('Cyclomatic Complexity: 15 (medium)');
      expect(hotspotTask?.description).toContain('Cognitive Complexity: 20 (medium)');
    });

    it('should correctly classify critical complexity thresholds', () => {
      const hotspot: ComplexityHotspot = {
        file: 'src/critical/SystemCore.ts',
        cyclomaticComplexity: 51, // Critical (>50)
        cognitiveComplexity: 61, // Critical (>60)
        lineCount: 2100 // Critical (>2000)
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [hotspot];
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(hotspotTask).toBeDefined();
      expect(hotspotTask?.priority).toBe('urgent');
      expect(hotspotTask?.description).toContain('Cyclomatic Complexity: 51 (critical');
      expect(hotspotTask?.description).toContain('Cognitive Complexity: 61 (critical');
      expect(hotspotTask?.description).toContain('Lines: 2100 (critical');
    });
  });

  describe('Priority Scoring Algorithm', () => {
    it('should score by weighted formula with correct weights', () => {
      // Test the weighted scoring: cyclomatic(40%) + cognitive(35%) + lineCount(25%)
      const hotspots: ComplexityHotspot[] = [
        {
          file: 'src/cyclomatic-heavy.ts',
          cyclomaticComplexity: 50, // High weight contribution
          cognitiveComplexity: 20, // Medium
          lineCount: 400 // Medium
        },
        {
          file: 'src/cognitive-heavy.ts',
          cyclomaticComplexity: 20, // Medium
          cognitiveComplexity: 60, // High weight contribution
          lineCount: 400 // Medium
        },
        {
          file: 'src/lines-heavy.ts',
          cyclomaticComplexity: 20, // Medium
          cognitiveComplexity: 20, // Medium
          lineCount: 2000 // High (but lowest weight)
        }
      ];

      baseProjectAnalysis.codeQuality.complexityHotspots = hotspots;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));
      expect(hotspotTasks).toHaveLength(3);

      // Cyclomatic-heavy should score highest due to higher weight (40% vs 35%)
      expect(hotspotTasks[0].description).toContain('cyclomatic-heavy.ts');
      expect(hotspotTasks[1].description).toContain('cognitive-heavy.ts');

      // Lines-heavy should score lowest due to lowest weight (25%)
      expect(hotspotTasks[2].description).toContain('lines-heavy.ts');
    });

    it('should normalize values against critical thresholds', () => {
      const hotspot: ComplexityHotspot = {
        file: 'src/extreme-values.ts',
        cyclomaticComplexity: 200, // Far exceeds critical threshold (50)
        cognitiveComplexity: 300, // Far exceeds critical threshold (60)
        lineCount: 10000 // Far exceeds critical threshold (2000)
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [hotspot];
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(hotspotTask).toBeDefined();
      // Score should be capped despite extreme values
      expect(hotspotTask?.score).toBeLessThanOrEqual(0.95);
      expect(hotspotTask?.priority).toBe('urgent');
    });

    it('should apply bonus for combined high complexity', () => {
      const hotspotWithBonus: ComplexityHotspot = {
        file: 'src/bonus-eligible.ts',
        cyclomaticComplexity: 35, // High
        cognitiveComplexity: 45, // High
        lineCount: 600 // Medium
      };

      const hotspotWithoutBonus: ComplexityHotspot = {
        file: 'src/no-bonus.ts',
        cyclomaticComplexity: 35, // High
        cognitiveComplexity: 20, // Medium (no bonus)
        lineCount: 600 // Medium
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [hotspotWithBonus, hotspotWithoutBonus];
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

      // Bonus-eligible should have higher score
      const bonusTask = hotspotTasks.find(t => t.description.includes('bonus-eligible.ts'));
      const noBonusTask = hotspotTasks.find(t => t.description.includes('no-bonus.ts'));

      expect(bonusTask?.score).toBeGreaterThan(noBonusTask?.score || 0);
      expect(bonusTask?.description).toContain('combination of high cyclomatic and cognitive complexity');
    });
  });

  describe('Contextual Descriptions and Recommendations', () => {
    it('should provide contextual severity descriptions', () => {
      const hotspot: ComplexityHotspot = {
        file: 'src/contexts/TestContexts.ts',
        cyclomaticComplexity: 55, // Critical - should get context
        cognitiveComplexity: 65, // Critical - should get context
        lineCount: 2200 // Critical - should get context
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [hotspot];
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(hotspotTask?.description).toContain('many execution paths'); // Critical cyclomatic context
      expect(hotspotTask?.description).toContain('very hard to understand'); // Critical cognitive context
      expect(hotspotTask?.description).toContain('extremely large file'); // Critical line count context
      expect(hotspotTask?.description).toContain('requires immediate attention');
    });

    it('should provide different context for high vs critical complexity', () => {
      const highComplexityHotspot: ComplexityHotspot = {
        file: 'src/high-complexity.ts',
        cyclomaticComplexity: 35, // High
        cognitiveComplexity: 45, // High
        lineCount: 1200 // High
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [highComplexityHotspot];
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(hotspotTask?.description).toContain('complex branching'); // High cyclomatic context
      expect(hotspotTask?.description).toContain('difficult to follow'); // High cognitive context
      expect(hotspotTask?.description).toContain('consider splitting'); // High line count context
      expect(hotspotTask?.description).toContain('should be prioritized for refactoring');
    });

    it('should provide appropriate recommendations for different complexity types', () => {
      // Test that different types of complexity get different recommendations
      const cyclomaticHotspot: ComplexityHotspot = {
        file: 'src/branchy.ts',
        cyclomaticComplexity: 40, // High
        cognitiveComplexity: 10, // Low
        lineCount: 200 // Low
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [cyclomaticHotspot];
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const task = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(task?.rationale).toContain('Extract methods to reduce branching complexity');
      expect(task?.rationale).toContain('Simplify nested control structures using early returns');
      // Should NOT contain cognitive or line count specific recommendations
      expect(task?.rationale).not.toContain('Flatten control flow');
      expect(task?.rationale).not.toContain('Split into multiple modules');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle undefined/null complexity values', () => {
      const malformedHotspots = [
        {
          file: 'src/undefined-values.ts',
          cyclomaticComplexity: undefined,
          cognitiveComplexity: null,
          lineCount: NaN
        },
        {
          file: 'src/missing-props.ts'
          // Missing complexity properties
        }
      ] as any[];

      baseProjectAnalysis.codeQuality.complexityHotspots = malformedHotspots;

      expect(() => {
        const candidates = analyzer.analyze(baseProjectAnalysis);
        expect(candidates).toBeDefined();
      }).not.toThrow();
    });

    it('should handle negative complexity values', () => {
      const negativeHotspot: ComplexityHotspot = {
        file: 'src/negative.ts',
        cyclomaticComplexity: -10,
        cognitiveComplexity: -20,
        lineCount: -500
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [negativeHotspot];
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(hotspotTask).toBeDefined();
      expect(hotspotTask?.priority).toBe('low'); // Should classify as low
    });

    it('should handle zero complexity values', () => {
      const zeroHotspot: ComplexityHotspot = {
        file: 'src/empty.ts',
        cyclomaticComplexity: 0,
        cognitiveComplexity: 0,
        lineCount: 0
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [zeroHotspot];
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(hotspotTask).toBeDefined();
      expect(hotspotTask?.priority).toBe('low');
      expect(hotspotTask?.score).toBeGreaterThan(0); // Should still have valid score
    });

    it('should handle extremely long file paths', () => {
      const longPath = 'src/' + 'nested/'.repeat(50) + 'deeply-nested-component.ts';
      const hotspot: ComplexityHotspot = {
        file: longPath,
        cyclomaticComplexity: 25,
        cognitiveComplexity: 30,
        lineCount: 500
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [hotspot];
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(hotspotTask?.title).toContain('deeply-nested-component.ts'); // Should extract filename
    });
  });

  describe('Multiple Hotspots Aggregation', () => {
    it('should generate aggregate task when more than 3 hotspots exist', () => {
      const manyHotspots: ComplexityHotspot[] = Array.from({ length: 5 }, (_, i) => ({
        file: `src/hotspot-${i}.ts`,
        cyclomaticComplexity: 15 + i * 5,
        cognitiveComplexity: 20 + i * 5,
        lineCount: 300 + i * 100
      }));

      baseProjectAnalysis.codeQuality.complexityHotspots = manyHotspots;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));
      const aggregateTask = candidates.find(c => c.candidateId === 'refactoring-complexity-sweep');

      expect(hotspotTasks).toHaveLength(3); // Top 3 individual tasks
      expect(aggregateTask).toBeDefined();
      expect(aggregateTask?.description).toContain('5 complexity hotspots');
      expect(aggregateTask?.priority).toBe('normal');
    });

    it('should detect critical hotspots in aggregate and increase priority', () => {
      const hotspotsWithCritical: ComplexityHotspot[] = [
        { file: 'src/normal1.ts', cyclomaticComplexity: 20, cognitiveComplexity: 25, lineCount: 400 },
        { file: 'src/normal2.ts', cyclomaticComplexity: 18, cognitiveComplexity: 22, lineCount: 350 },
        { file: 'src/critical1.ts', cyclomaticComplexity: 60, cognitiveComplexity: 70, lineCount: 2500 },
        { file: 'src/normal3.ts', cyclomaticComplexity: 22, cognitiveComplexity: 28, lineCount: 450 },
        { file: 'src/critical2.ts', cyclomaticComplexity: 55, cognitiveComplexity: 65, lineCount: 2200 }
      ];

      baseProjectAnalysis.codeQuality.complexityHotspots = hotspotsWithCritical;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const aggregateTask = candidates.find(c => c.candidateId === 'refactoring-complexity-sweep');
      expect(aggregateTask).toBeDefined();
      expect(aggregateTask?.description).toContain('5 complexity hotspots (2 critical)');
      expect(aggregateTask?.priority).toBe('high'); // Elevated due to critical hotspots
    });

    it('should not generate aggregate task for 3 or fewer hotspots', () => {
      const fewHotspots: ComplexityHotspot[] = [
        { file: 'src/hotspot1.ts', cyclomaticComplexity: 25, cognitiveComplexity: 30, lineCount: 500 },
        { file: 'src/hotspot2.ts', cyclomaticComplexity: 20, cognitiveComplexity: 25, lineCount: 400 },
        { file: 'src/hotspot3.ts', cyclomaticComplexity: 22, cognitiveComplexity: 28, lineCount: 450 }
      ];

      baseProjectAnalysis.codeQuality.complexityHotspots = fewHotspots;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const aggregateTask = candidates.find(c => c.candidateId === 'refactoring-complexity-sweep');
      expect(aggregateTask).toBeUndefined();

      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));
      expect(hotspotTasks).toHaveLength(3); // All individual tasks
    });
  });

  describe('Integration with Other Analysis Types', () => {
    it('should work correctly alongside code smells and duplicate patterns', () => {
      baseProjectAnalysis.codeQuality = {
        lintIssues: 25,
        duplicatedCode: [
          {
            pattern: 'validation function',
            locations: ['src/auth.ts', 'src/user.ts'],
            similarity: 0.88
          }
        ],
        complexityHotspots: [
          {
            file: 'src/complex.ts',
            cyclomaticComplexity: 35,
            cognitiveComplexity: 40,
            lineCount: 800
          }
        ],
        codeSmells: [
          {
            file: 'src/smell.ts',
            type: 'long-method',
            severity: 'high',
            details: 'Long method detected'
          }
        ]
      };

      const candidates = analyzer.analyze(baseProjectAnalysis);

      // Should generate tasks for all issue types
      expect(candidates.length).toBe(4); // duplicate, complexity, code smell, lint

      const complexityTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(complexityTask).toBeDefined();
      expect(complexityTask?.suggestedWorkflow).toBe('refactoring');
    });
  });
});
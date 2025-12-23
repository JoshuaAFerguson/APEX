/**
 * RefactoringAnalyzer Tests
 *
 * Comprehensive tests for the RefactoringAnalyzer class, including complexity
 * hotspot detection with cyclomatic and cognitive complexity metrics, weighted
 * prioritization algorithm, and enhanced refactoring recommendations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RefactoringAnalyzer } from './refactoring-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type { ComplexityHotspot } from '@apexcli/core';

describe('RefactoringAnalyzer', () => {
  let refactoringAnalyzer: RefactoringAnalyzer;
  let baseProjectAnalysis: ProjectAnalysis;

  beforeEach(() => {
    refactoringAnalyzer = new RefactoringAnalyzer();

    // Base project analysis structure
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
        lintIssues: 5,
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

  describe('type property', () => {
    it('should have refactoring type', () => {
      expect(refactoringAnalyzer.type).toBe('refactoring');
    });
  });

  // ============================================================================
  // Duplicated Code Analysis Tests
  // ============================================================================

  describe('duplicated code analysis', () => {
    it('should generate high priority task for duplicated code', () => {
      baseProjectAnalysis.codeQuality.duplicatedCode = [
        'src/utils/helper.ts',
        'src/api/auth.ts',
        'src/components/form.ts'
      ];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.title.includes('Duplicated Code'));
      expect(duplicateTask).toBeDefined();
      expect(duplicateTask?.priority).toBe('high');
      expect(duplicateTask?.estimatedEffort).toBe('high');
      expect(duplicateTask?.score).toBe(0.9);
      expect(duplicateTask?.candidateId).toBe('refactoring-duplicated-code');
      expect(duplicateTask?.description).toContain('3 instances');
      expect(duplicateTask?.rationale).toContain('maintenance burden');
    });

    it('should handle single instance of duplicated code', () => {
      baseProjectAnalysis.codeQuality.duplicatedCode = ['src/utils/helper.ts'];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.title.includes('Duplicated Code'));
      expect(duplicateTask).toBeDefined();
      expect(duplicateTask?.description).toContain('1 instance');
    });

    it('should not generate duplicate code task when none found', () => {
      baseProjectAnalysis.codeQuality.duplicatedCode = [];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.title.includes('Duplicated Code'));
      expect(duplicateTask).toBeUndefined();
    });
  });

  // ============================================================================
  // Complexity Hotspots Analysis Tests
  // ============================================================================

  describe('complexity hotspots analysis', () => {
    describe('severity classification', () => {
      it('should classify low complexity correctly', () => {
        const lowComplexityHotspot: ComplexityHotspot = {
          file: 'src/simple.ts',
          cyclomaticComplexity: 5,
          cognitiveComplexity: 8,
          lineCount: 100
        };

        baseProjectAnalysis.codeQuality.complexityHotspots = [lowComplexityHotspot];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
        expect(hotspotTask).toBeDefined();
        expect(hotspotTask?.priority).toBe('low');
        expect(hotspotTask?.estimatedEffort).toBe('medium');
        expect(hotspotTask?.description).toContain('Cyclomatic Complexity: 5 (low)');
        expect(hotspotTask?.description).toContain('Cognitive Complexity: 8 (low)');
        expect(hotspotTask?.description).toContain('Lines: 100 (low)');
      });

      it('should classify medium complexity correctly', () => {
        const mediumComplexityHotspot: ComplexityHotspot = {
          file: 'src/moderate.ts',
          cyclomaticComplexity: 15,
          cognitiveComplexity: 20,
          lineCount: 350
        };

        baseProjectAnalysis.codeQuality.complexityHotspots = [mediumComplexityHotspot];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
        expect(hotspotTask).toBeDefined();
        expect(hotspotTask?.priority).toBe('normal');
        expect(hotspotTask?.estimatedEffort).toBe('medium');
        expect(hotspotTask?.description).toContain('Cyclomatic Complexity: 15 (medium)');
        expect(hotspotTask?.description).toContain('Cognitive Complexity: 20 (medium)');
        expect(hotspotTask?.description).toContain('Lines: 350 (medium)');
      });

      it('should classify high complexity correctly', () => {
        const highComplexityHotspot: ComplexityHotspot = {
          file: 'src/complex.ts',
          cyclomaticComplexity: 35,
          cognitiveComplexity: 45,
          lineCount: 1200
        };

        baseProjectAnalysis.codeQuality.complexityHotspots = [highComplexityHotspot];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
        expect(hotspotTask).toBeDefined();
        expect(hotspotTask?.priority).toBe('high');
        expect(hotspotTask?.estimatedEffort).toBe('high');
        expect(hotspotTask?.description).toContain('Cyclomatic Complexity: 35 (high)');
        expect(hotspotTask?.description).toContain('Cognitive Complexity: 45 (high)');
        expect(hotspotTask?.description).toContain('Lines: 1200 (high');
        expect(hotspotTask?.description).toContain('should be prioritized for refactoring');
      });

      it('should classify critical complexity correctly', () => {
        const criticalComplexityHotspot: ComplexityHotspot = {
          file: 'src/critical.ts',
          cyclomaticComplexity: 55,
          cognitiveComplexity: 65,
          lineCount: 2500
        };

        baseProjectAnalysis.codeQuality.complexityHotspots = [criticalComplexityHotspot];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
        expect(hotspotTask).toBeDefined();
        expect(hotspotTask?.priority).toBe('urgent');
        expect(hotspotTask?.estimatedEffort).toBe('high');
        expect(hotspotTask?.description).toContain('Cyclomatic Complexity: 55 (critical');
        expect(hotspotTask?.description).toContain('Cognitive Complexity: 65 (critical');
        expect(hotspotTask?.description).toContain('Lines: 2500 (critical');
        expect(hotspotTask?.description).toContain('requires immediate attention');
      });
    });

    describe('prioritization scoring', () => {
      it('should prioritize hotspots by weighted score', () => {
        const hotspots: ComplexityHotspot[] = [
          {
            file: 'src/low-score.ts',
            cyclomaticComplexity: 10, // Low
            cognitiveComplexity: 15, // Low
            lineCount: 200 // Low
          },
          {
            file: 'src/high-score.ts',
            cyclomaticComplexity: 40, // High
            cognitiveComplexity: 50, // High
            lineCount: 1500 // High
          },
          {
            file: 'src/medium-score.ts',
            cyclomaticComplexity: 25, // Medium
            cognitiveComplexity: 30, // High
            lineCount: 800 // Medium
          }
        ];

        baseProjectAnalysis.codeQuality.complexityHotspots = hotspots;

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));
        expect(hotspotTasks).toHaveLength(3);

        // First task should be the highest scoring (high-score.ts)
        expect(hotspotTasks[0].description).toContain('high-score.ts');
        expect(hotspotTasks[0].score).toBeGreaterThan(hotspotTasks[1].score);
        expect(hotspotTasks[1].score).toBeGreaterThan(hotspotTasks[2].score);
      });

      it('should apply bonus for combined high complexity', () => {
        const combinedHighComplexity: ComplexityHotspot = {
          file: 'src/combined-high.ts',
          cyclomaticComplexity: 35, // High
          cognitiveComplexity: 45, // High
          lineCount: 300 // Medium
        };

        baseProjectAnalysis.codeQuality.complexityHotspots = [combinedHighComplexity];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
        expect(hotspotTask).toBeDefined();
        expect(hotspotTask?.description).toContain('combination of high cyclomatic and cognitive complexity');
        expect(hotspotTask?.rationale).toContain('major refactoring with design patterns');
      });

      it('should cap normalized values at 1.0 for extremely high complexity', () => {
        const extremeComplexity: ComplexityHotspot = {
          file: 'src/extreme.ts',
          cyclomaticComplexity: 200, // Far above critical threshold
          cognitiveComplexity: 300, // Far above critical threshold
          lineCount: 10000 // Far above critical threshold
        };

        baseProjectAnalysis.codeQuality.complexityHotspots = [extremeComplexity];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
        expect(hotspotTask).toBeDefined();
        expect(hotspotTask?.score).toBeLessThanOrEqual(0.95); // Should not exceed maximum
        expect(hotspotTask?.priority).toBe('urgent');
      });
    });

    describe('refactoring recommendations', () => {
      it('should provide cyclomatic complexity recommendations', () => {
        const highCyclomaticHotspot: ComplexityHotspot = {
          file: 'src/branchy.ts',
          cyclomaticComplexity: 35, // High
          cognitiveComplexity: 10, // Low
          lineCount: 200 // Low
        };

        baseProjectAnalysis.codeQuality.complexityHotspots = [highCyclomaticHotspot];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
        expect(hotspotTask).toBeDefined();
        expect(hotspotTask?.rationale).toContain('Extract methods to reduce branching complexity');
        expect(hotspotTask?.rationale).toContain('Replace complex conditionals with polymorphism');
        expect(hotspotTask?.rationale).toContain('Simplify nested control structures');
      });

      it('should provide cognitive complexity recommendations', () => {
        const highCognitiveHotspot: ComplexityHotspot = {
          file: 'src/confusing.ts',
          cyclomaticComplexity: 10, // Low
          cognitiveComplexity: 45, // High
          lineCount: 200 // Low
        };

        baseProjectAnalysis.codeQuality.complexityHotspots = [highCognitiveHotspot];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
        expect(hotspotTask).toBeDefined();
        expect(hotspotTask?.rationale).toContain('Flatten control flow to improve readability');
        expect(hotspotTask?.rationale).toContain('Extract helper methods for complex logic blocks');
        expect(hotspotTask?.rationale).toContain('Add explanatory intermediate variables');
        expect(hotspotTask?.rationale).toContain('Improve variable and method naming for clarity');
      });

      it('should provide line count recommendations', () => {
        const largeFileHotspot: ComplexityHotspot = {
          file: 'src/huge.ts',
          cyclomaticComplexity: 10, // Low
          cognitiveComplexity: 10, // Low
          lineCount: 1500 // High
        };

        baseProjectAnalysis.codeQuality.complexityHotspots = [largeFileHotspot];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
        expect(hotspotTask).toBeDefined();
        expect(hotspotTask?.rationale).toContain('Split into multiple modules applying Single Responsibility');
        expect(hotspotTask?.rationale).toContain('Extract related functionality into separate classes');
        expect(hotspotTask?.rationale).toContain('Consider using composition over inheritance');
      });

      it('should provide combined recommendations for multiple high dimensions', () => {
        const multiDimensionalHotspot: ComplexityHotspot = {
          file: 'src/nightmare.ts',
          cyclomaticComplexity: 40, // High
          cognitiveComplexity: 50, // High
          lineCount: 1500 // High
        };

        baseProjectAnalysis.codeQuality.complexityHotspots = [multiDimensionalHotspot];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
        expect(hotspotTask).toBeDefined();
        expect(hotspotTask?.rationale).toContain('major refactoring with design patterns');
        expect(hotspotTask?.rationale).toContain('Break down into smaller, focused modules');
        expect(hotspotTask?.rationale).toContain('Apply SOLID principles systematically');
        // Should also include specific recommendations for each dimension
        expect(hotspotTask?.rationale).toContain('Extract methods to reduce branching complexity');
        expect(hotspotTask?.rationale).toContain('Flatten control flow to improve readability');
        expect(hotspotTask?.rationale).toContain('Split into multiple modules');
      });

      it('should provide general recommendations for low complexity', () => {
        const lowComplexityHotspot: ComplexityHotspot = {
          file: 'src/simple.ts',
          cyclomaticComplexity: 8, // Low
          cognitiveComplexity: 12, // Low
          lineCount: 150 // Low
        };

        baseProjectAnalysis.codeQuality.complexityHotspots = [lowComplexityHotspot];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
        expect(hotspotTask).toBeDefined();
        expect(hotspotTask?.rationale).toContain('Review for potential simplification opportunities');
        expect(hotspotTask?.rationale).toContain('Consider extracting reusable utility functions');
      });
    });

    describe('legacy string format support', () => {
      it('should handle legacy string format hotspots', () => {
        // Legacy format: complexity hotspots as string array
        baseProjectAnalysis.codeQuality.complexityHotspots = [
          'src/legacy1.ts',
          'src/legacy2.ts'
        ] as any;

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));
        expect(hotspotTasks).toHaveLength(2);

        // Should assign default complexity values
        expect(hotspotTasks[0].description).toContain('Cyclomatic Complexity: 15 (medium)');
        expect(hotspotTasks[0].description).toContain('Cognitive Complexity: 20 (medium)');
        expect(hotspotTasks[0].description).toContain('Lines: 300 (medium)');
      });

      it('should mix legacy and new format gracefully', () => {
        const mixedHotspots = [
          'src/legacy.ts', // Legacy string
          {
            file: 'src/modern.ts',
            cyclomaticComplexity: 40,
            cognitiveComplexity: 50,
            lineCount: 800
          }
        ] as any;

        baseProjectAnalysis.codeQuality.complexityHotspots = mixedHotspots;

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));
        expect(hotspotTasks).toHaveLength(2);

        // Modern format should be prioritized higher due to higher complexity
        expect(hotspotTasks[0].description).toContain('modern.ts');
        expect(hotspotTasks[1].description).toContain('legacy.ts');
      });
    });

    describe('aggregate complexity sweep task', () => {
      it('should generate aggregate task for many hotspots (> 3)', () => {
        const manyHotspots: ComplexityHotspot[] = Array.from({ length: 5 }, (_, i) => ({
          file: `src/file${i}.ts`,
          cyclomaticComplexity: 20,
          cognitiveComplexity: 25,
          lineCount: 400
        }));

        baseProjectAnalysis.codeQuality.complexityHotspots = manyHotspots;

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        // Should have 3 individual hotspot tasks + 1 aggregate task
        const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));
        const sweepTask = candidates.find(c => c.candidateId === 'refactoring-complexity-sweep');

        expect(hotspotTasks).toHaveLength(3); // Top 3 individual tasks
        expect(sweepTask).toBeDefined();
        expect(sweepTask?.title).toContain('Address Codebase Complexity');
        expect(sweepTask?.description).toContain('5 complexity hotspots');
        expect(sweepTask?.priority).toBe('normal');
        expect(sweepTask?.estimatedEffort).toBe('high');
        expect(sweepTask?.score).toBe(0.55);
      });

      it('should handle critical hotspots in aggregate task', () => {
        const hotspotsWithCritical: ComplexityHotspot[] = [
          { file: 'src/critical1.ts', cyclomaticComplexity: 60, cognitiveComplexity: 70, lineCount: 2500 },
          { file: 'src/critical2.ts', cyclomaticComplexity: 55, cognitiveComplexity: 65, lineCount: 2200 },
          { file: 'src/normal1.ts', cyclomaticComplexity: 25, cognitiveComplexity: 30, lineCount: 600 },
          { file: 'src/normal2.ts', cyclomaticComplexity: 20, cognitiveComplexity: 25, lineCount: 400 },
          { file: 'src/normal3.ts', cyclomaticComplexity: 18, cognitiveComplexity: 22, lineCount: 350 }
        ];

        baseProjectAnalysis.codeQuality.complexityHotspots = hotspotsWithCritical;

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const sweepTask = candidates.find(c => c.candidateId === 'refactoring-complexity-sweep');
        expect(sweepTask).toBeDefined();
        expect(sweepTask?.description).toContain('5 complexity hotspots (2 critical)');
        expect(sweepTask?.priority).toBe('high'); // Due to critical hotspots
      });

      it('should not generate aggregate task for <= 3 hotspots', () => {
        const fewHotspots: ComplexityHotspot[] = [
          { file: 'src/file1.ts', cyclomaticComplexity: 20, cognitiveComplexity: 25, lineCount: 400 },
          { file: 'src/file2.ts', cyclomaticComplexity: 15, cognitiveComplexity: 20, lineCount: 300 },
          { file: 'src/file3.ts', cyclomaticComplexity: 18, cognitiveComplexity: 22, lineCount: 350 }
        ];

        baseProjectAnalysis.codeQuality.complexityHotspots = fewHotspots;

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const sweepTask = candidates.find(c => c.candidateId === 'refactoring-complexity-sweep');
        expect(sweepTask).toBeUndefined();

        // Should have only individual hotspot tasks
        const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));
        expect(hotspotTasks).toHaveLength(3);
      });
    });

    it('should not generate hotspot tasks when none exist', () => {
      baseProjectAnalysis.codeQuality.complexityHotspots = [];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-'));
      expect(hotspotTasks).toHaveLength(0);
    });
  });

  // ============================================================================
  // Code Smell Analysis Tests
  // ============================================================================

  describe('code smell analysis', () => {
    describe('long-method code smells', () => {
      it('should generate task for long method smells', () => {
        baseProjectAnalysis.codeQuality.codeSmells = [
          {
            file: 'src/service.ts',
            type: 'long-method',
            severity: 'medium',
            details: "Method 'processData' has 75 lines (line 25), consider refactoring"
          },
          {
            file: 'src/utils.ts',
            type: 'long-method',
            severity: 'high',
            details: "Method 'calculateStats' has 120 lines (line 50), consider refactoring"
          }
        ];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const longMethodTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
        expect(longMethodTask).toBeDefined();
        expect(longMethodTask?.title).toBe('Refactor Long Methods');
        expect(longMethodTask?.description).toContain('2 long methods');
        expect(longMethodTask?.description).toContain('service.ts, utils.ts');
        expect(longMethodTask?.priority).toBe('high'); // Due to high severity smell
        expect(longMethodTask?.estimatedEffort).toBe('high');
        expect(longMethodTask?.rationale).toContain('Long methods reduce readability');
        expect(longMethodTask?.rationale).toContain('Break long methods into smaller');
        expect(longMethodTask?.rationale).toContain("Method 'processData' has 75 lines");
        expect(longMethodTask?.score).toBeGreaterThan(0.7);
      });

      it('should handle single long method smell', () => {
        baseProjectAnalysis.codeQuality.codeSmells = [
          {
            file: 'src/complex.ts',
            type: 'long-method',
            severity: 'low',
            details: "Method 'helper' has 55 lines (line 10), consider refactoring"
          }
        ];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const longMethodTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
        expect(longMethodTask).toBeDefined();
        expect(longMethodTask?.description).toContain('1 long method');
        expect(longMethodTask?.description).toContain('complex.ts');
        expect(longMethodTask?.priority).toBe('low');
        expect(longMethodTask?.estimatedEffort).toBe('low');
      });

      it('should prioritize critical long method smells', () => {
        baseProjectAnalysis.codeQuality.codeSmells = [
          {
            file: 'src/massive.ts',
            type: 'long-method',
            severity: 'critical',
            details: "Method 'monolith' has 500 lines (line 1), consider refactoring"
          }
        ];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const longMethodTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
        expect(longMethodTask).toBeDefined();
        expect(longMethodTask?.priority).toBe('urgent');
        expect(longMethodTask?.estimatedEffort).toBe('high');
        expect(longMethodTask?.score).toBeGreaterThan(0.8);
      });
    });

    describe('large-class code smells', () => {
      it('should generate task for large class smells', () => {
        baseProjectAnalysis.codeQuality.codeSmells = [
          {
            file: 'src/Manager.ts',
            type: 'large-class',
            severity: 'high',
            details: 'File has 800 lines and 25 methods, consider breaking into smaller modules'
          },
          {
            file: 'src/Controller.ts',
            type: 'large-class',
            severity: 'medium',
            details: 'File has 600 lines, consider breaking into smaller modules'
          }
        ];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const largeClassTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class');
        expect(largeClassTask).toBeDefined();
        expect(largeClassTask?.title).toBe('Break Down Large Classes');
        expect(largeClassTask?.description).toContain('2 oversized classes');
        expect(largeClassTask?.description).toContain('Manager.ts, Controller.ts');
        expect(largeClassTask?.priority).toBe('high');
        expect(largeClassTask?.rationale).toContain('Large classes violate Single Responsibility');
        expect(largeClassTask?.rationale).toContain('Apply Single Responsibility Principle');
        expect(largeClassTask?.rationale).toContain('800 lines and 25 methods');
      });

      it('should handle many large class smells with truncation', () => {
        baseProjectAnalysis.codeQuality.codeSmells = [
          { file: 'src/Class1.ts', type: 'large-class', severity: 'medium', details: 'Large class 1' },
          { file: 'src/Class2.ts', type: 'large-class', severity: 'medium', details: 'Large class 2' },
          { file: 'src/Class3.ts', type: 'large-class', severity: 'medium', details: 'Large class 3' },
          { file: 'src/Class4.ts', type: 'large-class', severity: 'medium', details: 'Large class 4' },
          { file: 'src/Class5.ts', type: 'large-class', severity: 'medium', details: 'Large class 5' }
        ];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const largeClassTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class');
        expect(largeClassTask).toBeDefined();
        expect(largeClassTask?.description).toContain('5 oversized classes');
        expect(largeClassTask?.description).toContain('Class1.ts, Class2.ts, Class3.ts, and 2 more');
        expect(largeClassTask?.score).toBeGreaterThan(0.6); // Score increased due to high count
      });
    });

    describe('deep-nesting code smells', () => {
      it('should generate task for deep nesting smells', () => {
        baseProjectAnalysis.codeQuality.codeSmells = [
          {
            file: 'src/parser.ts',
            type: 'deep-nesting',
            severity: 'high',
            details: 'Found 6 levels of nesting at line 45'
          },
          {
            file: 'src/validator.ts',
            type: 'deep-nesting',
            severity: 'medium',
            details: 'Found 5 levels of nesting at line 120'
          }
        ];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const deepNestingTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-deep-nesting');
        expect(deepNestingTask).toBeDefined();
        expect(deepNestingTask?.title).toBe('Reduce Deep Nesting');
        expect(deepNestingTask?.description).toContain('2 deeply nested code blocks');
        expect(deepNestingTask?.description).toContain('parser.ts, validator.ts');
        expect(deepNestingTask?.priority).toBe('high');
        expect(deepNestingTask?.rationale).toContain('Deep nesting makes code difficult');
        expect(deepNestingTask?.rationale).toContain('Use early returns to reduce');
        expect(deepNestingTask?.rationale).toContain('6 levels of nesting at line 45');
      });

      it('should handle critical deep nesting', () => {
        baseProjectAnalysis.codeQuality.codeSmells = [
          {
            file: 'src/nightmare.ts',
            type: 'deep-nesting',
            severity: 'critical',
            details: 'Found 8 levels of nesting at line 10 - immediate refactoring needed'
          }
        ];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const deepNestingTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-deep-nesting');
        expect(deepNestingTask).toBeDefined();
        expect(deepNestingTask?.priority).toBe('urgent');
        expect(deepNestingTask?.estimatedEffort).toBe('high');
        expect(deepNestingTask?.score).toBeGreaterThan(0.8);
      });
    });

    describe('other code smell types', () => {
      it('should handle duplicate-code smells', () => {
        baseProjectAnalysis.codeQuality.codeSmells = [
          {
            file: 'src/auth.ts',
            type: 'duplicate-code',
            severity: 'medium',
            details: 'Duplicate validation logic found in multiple methods'
          }
        ];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-duplicate-code');
        expect(duplicateTask).toBeDefined();
        expect(duplicateTask?.title).toBe('Eliminate Code Duplication');
        expect(duplicateTask?.description).toContain('1 duplicate code pattern');
        expect(duplicateTask?.rationale).toContain('Duplicate code increases maintenance burden');
        expect(duplicateTask?.rationale).toContain('Extract common code into reusable functions');
      });

      it('should handle dead-code smells', () => {
        baseProjectAnalysis.codeQuality.codeSmells = [
          {
            file: 'src/legacy.ts',
            type: 'dead-code',
            severity: 'low',
            details: 'Unused function detectLegacyPattern never called'
          }
        ];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const deadCodeTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-dead-code');
        expect(deadCodeTask).toBeDefined();
        expect(deadCodeTask?.title).toBe('Remove Dead Code');
        expect(deadCodeTask?.rationale).toContain('Dead code clutters the codebase');
        expect(deadCodeTask?.rationale).toContain('Remove unused functions, variables, and imports');
      });

      it('should handle magic-numbers smells', () => {
        baseProjectAnalysis.codeQuality.codeSmells = [
          {
            file: 'src/config.ts',
            type: 'magic-numbers',
            severity: 'medium',
            details: 'Magic number 42 used without explanation at line 15'
          }
        ];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const magicNumbersTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-magic-numbers');
        expect(magicNumbersTask).toBeDefined();
        expect(magicNumbersTask?.title).toBe('Replace Magic Numbers');
        expect(magicNumbersTask?.rationale).toContain('Magic numbers make code less readable');
        expect(magicNumbersTask?.rationale).toContain('Replace numbers with named constants');
      });

      it('should handle feature-envy smells', () => {
        baseProjectAnalysis.codeQuality.codeSmells = [
          {
            file: 'src/service.ts',
            type: 'feature-envy',
            severity: 'medium',
            details: 'Method uses more properties from User class than its own'
          }
        ];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
        expect(featureEnvyTask).toBeDefined();
        expect(featureEnvyTask?.title).toBe('Fix Feature Envy');
        expect(featureEnvyTask?.rationale).toContain('Feature envy indicates poor method placement');
        expect(featureEnvyTask?.rationale).toContain('Move methods closer to the data they use');
      });

      it('should handle data-clumps smells', () => {
        baseProjectAnalysis.codeQuality.codeSmells = [
          {
            file: 'src/api.ts',
            type: 'data-clumps',
            severity: 'medium',
            details: 'Parameters firstName, lastName, email always passed together'
          }
        ];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const dataClumpsTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-data-clumps');
        expect(dataClumpsTask).toBeDefined();
        expect(dataClumpsTask?.title).toBe('Consolidate Data Clumps');
        expect(dataClumpsTask?.rationale).toContain('Data clumps indicate missing abstractions');
        expect(dataClumpsTask?.rationale).toContain('Create parameter objects for grouped data');
      });

      it('should handle unknown code smell types with fallback', () => {
        baseProjectAnalysis.codeQuality.codeSmells = [
          {
            file: 'src/custom.ts',
            type: 'custom-smell-type' as any,
            severity: 'medium',
            details: 'Custom code smell detected'
          }
        ];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const customTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-custom-smell-type');
        expect(customTask).toBeDefined();
        expect(customTask?.title).toBe('Fix custom-smell-type Code Smells');
        expect(customTask?.description).toContain('1 custom-smell-type issue');
        expect(customTask?.rationale).toContain("Code smell type 'custom-smell-type' detected");
      });
    });

    describe('mixed code smell scenarios', () => {
      it('should handle mixed severity levels correctly', () => {
        baseProjectAnalysis.codeQuality.codeSmells = [
          { file: 'src/file1.ts', type: 'long-method', severity: 'low', details: 'Low severity method' },
          { file: 'src/file2.ts', type: 'long-method', severity: 'medium', details: 'Medium severity method' },
          { file: 'src/file3.ts', type: 'long-method', severity: 'medium', details: 'Another medium severity method' },
          { file: 'src/file4.ts', type: 'long-method', severity: 'high', details: 'High severity method' }
        ];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const longMethodTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
        expect(longMethodTask).toBeDefined();
        // Should be high priority due to presence of high severity smell
        expect(longMethodTask?.priority).toBe('high');
        expect(longMethodTask?.estimatedEffort).toBe('high');
      });

      it('should handle multiple code smell types in same analysis', () => {
        baseProjectAnalysis.codeQuality.codeSmells = [
          { file: 'src/service.ts', type: 'long-method', severity: 'medium', details: 'Long method detected' },
          { file: 'src/model.ts', type: 'large-class', severity: 'high', details: 'Large class detected' },
          { file: 'src/parser.ts', type: 'deep-nesting', severity: 'medium', details: 'Deep nesting detected' }
        ];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        // Should create separate tasks for each smell type
        const longMethodTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
        const largeClassTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class');
        const deepNestingTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-deep-nesting');

        expect(longMethodTask).toBeDefined();
        expect(largeClassTask).toBeDefined();
        expect(deepNestingTask).toBeDefined();

        // Large class task should have highest priority due to high severity
        expect(largeClassTask?.priority).toBe('high');
        expect(longMethodTask?.priority).toBe('normal');
        expect(deepNestingTask?.priority).toBe('normal');
      });

      it('should adjust scores based on smell count', () => {
        const manySmells = Array.from({ length: 12 }, (_, i) => ({
          file: `src/file${i}.ts`,
          type: 'long-method' as const,
          severity: 'medium' as const,
          details: `Long method ${i}`
        }));

        baseProjectAnalysis.codeQuality.codeSmells = manySmells;

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const longMethodTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
        expect(longMethodTask).toBeDefined();
        // Score should be increased due to high count (>10)
        expect(longMethodTask?.score).toBeGreaterThan(0.8);
      });
    });

    describe('code smell integration with other issues', () => {
      it('should prioritize code smells appropriately with complexity hotspots', () => {
        baseProjectAnalysis.codeQuality.codeSmells = [
          { file: 'src/critical.ts', type: 'long-method', severity: 'critical', details: 'Critical long method' }
        ];
        baseProjectAnalysis.codeQuality.complexityHotspots = [{
          file: 'src/complex.ts',
          cyclomaticComplexity: 25,
          cognitiveComplexity: 30,
          lineCount: 500
        }];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const codeSmellTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
        const complexityTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');

        expect(codeSmellTask).toBeDefined();
        expect(complexityTask).toBeDefined();

        // Critical code smell should score higher than medium complexity hotspot
        expect(codeSmellTask?.score).toBeGreaterThan(complexityTask?.score || 0);
      });
    });
  });

  // ============================================================================
  // Linting Issues Analysis Tests
  // ============================================================================

  describe('linting issues analysis', () => {
    it('should generate low priority task for few lint issues (1-10)', () => {
      baseProjectAnalysis.codeQuality.lintIssues = 5;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const lintTask = candidates.find(c => c.candidateId === 'refactoring-lint-issues');
      expect(lintTask).toBeDefined();
      expect(lintTask?.title).toBe('Fix Linting Issues');
      expect(lintTask?.description).toContain('5 linting issues');
      expect(lintTask?.priority).toBe('low');
      expect(lintTask?.estimatedEffort).toBe('low');
      expect(lintTask?.score).toBe(0.2);
      expect(lintTask?.rationale).toContain('code quality problems');
    });

    it('should generate normal priority task for moderate lint issues (11-50)', () => {
      baseProjectAnalysis.codeQuality.lintIssues = 25;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const lintTask = candidates.find(c => c.candidateId === 'refactoring-lint-issues');
      expect(lintTask).toBeDefined();
      expect(lintTask?.description).toContain('25 linting issues');
      expect(lintTask?.priority).toBe('low');
      expect(lintTask?.estimatedEffort).toBe('low');
      expect(lintTask?.score).toBe(0.3);
    });

    it('should generate normal priority task for many lint issues (51-200)', () => {
      baseProjectAnalysis.codeQuality.lintIssues = 75;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const lintTask = candidates.find(c => c.candidateId === 'refactoring-lint-issues');
      expect(lintTask).toBeDefined();
      expect(lintTask?.description).toContain('75 linting issues');
      expect(lintTask?.priority).toBe('normal');
      expect(lintTask?.estimatedEffort).toBe('medium');
      expect(lintTask?.score).toBe(0.5);
    });

    it('should generate high priority task for excessive lint issues (> 200)', () => {
      baseProjectAnalysis.codeQuality.lintIssues = 350;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const lintTask = candidates.find(c => c.candidateId === 'refactoring-lint-issues');
      expect(lintTask).toBeDefined();
      expect(lintTask?.description).toContain('350 linting issues');
      expect(lintTask?.priority).toBe('high');
      expect(lintTask?.estimatedEffort).toBe('high');
      expect(lintTask?.score).toBe(0.7);
    });

    it('should handle singular form for 1 lint issue', () => {
      baseProjectAnalysis.codeQuality.lintIssues = 1;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const lintTask = candidates.find(c => c.candidateId === 'refactoring-lint-issues');
      expect(lintTask).toBeDefined();
      expect(lintTask?.description).toContain('1 linting issue');
      expect(lintTask?.description).not.toContain('issues');
    });

    it('should not generate lint task when no issues exist', () => {
      baseProjectAnalysis.codeQuality.lintIssues = 0;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const lintTask = candidates.find(c => c.candidateId === 'refactoring-lint-issues');
      expect(lintTask).toBeUndefined();
    });
  });

  // ============================================================================
  // Task Prioritization Tests
  // ============================================================================

  describe('task prioritization', () => {
    it('should prioritize duplicated code over complexity hotspots', () => {
      baseProjectAnalysis.codeQuality.duplicatedCode = ['src/dup.ts'];
      baseProjectAnalysis.codeQuality.complexityHotspots = [{
        file: 'src/complex.ts',
        cyclomaticComplexity: 40,
        cognitiveComplexity: 50,
        lineCount: 800
      }];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const prioritized = refactoringAnalyzer.prioritize(candidates);
      expect(prioritized).toBeDefined();
      expect(prioritized?.title).toContain('Duplicated Code'); // Score 0.9
    });

    it('should prioritize critical complexity over normal complexity', () => {
      const hotspots: ComplexityHotspot[] = [
        {
          file: 'src/critical.ts',
          cyclomaticComplexity: 60, // Critical
          cognitiveComplexity: 70, // Critical
          lineCount: 2500 // Critical
        },
        {
          file: 'src/normal.ts',
          cyclomaticComplexity: 20, // Medium
          cognitiveComplexity: 25, // Medium
          lineCount: 400 // Low
        }
      ];

      baseProjectAnalysis.codeQuality.complexityHotspots = hotspots;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const prioritized = refactoringAnalyzer.prioritize(candidates);
      expect(prioritized).toBeDefined();
      expect(prioritized?.description).toContain('critical.ts');
    });

    it('should return highest scoring candidate', () => {
      baseProjectAnalysis.codeQuality.lintIssues = 300; // Score 0.7
      baseProjectAnalysis.codeQuality.complexityHotspots = [{
        file: 'src/high-score.ts',
        cyclomaticComplexity: 45,
        cognitiveComplexity: 55,
        lineCount: 1200
      }]; // Should score higher than 0.7

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const prioritized = refactoringAnalyzer.prioritize(candidates);
      expect(prioritized).toBeDefined();
      expect(prioritized?.description).toContain('high-score.ts');
    });

    it('should return null when no candidates', () => {
      // Clean project with no refactoring issues
      baseProjectAnalysis.codeQuality.lintIssues = 0;
      baseProjectAnalysis.codeQuality.duplicatedCode = [];
      baseProjectAnalysis.codeQuality.complexityHotspots = [];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);
      const prioritized = refactoringAnalyzer.prioritize(candidates);

      expect(candidates).toHaveLength(0);
      expect(prioritized).toBeNull();
    });
  });

  // ============================================================================
  // Complex Scenarios Tests
  // ============================================================================

  describe('complex scenarios', () => {
    it('should handle project with multiple refactoring issues including code smells', () => {
      baseProjectAnalysis.codeQuality = {
        lintIssues: 150, // Medium priority
        duplicatedCode: ['src/dup1.ts', 'src/dup2.ts'], // High priority
        complexityHotspots: [
          {
            file: 'src/critical.ts',
            cyclomaticComplexity: 55,
            cognitiveComplexity: 65,
            lineCount: 2200
          },
          {
            file: 'src/normal.ts',
            cyclomaticComplexity: 20,
            cognitiveComplexity: 25,
            lineCount: 400
          }
        ],
        codeSmells: [
          { file: 'src/service.ts', type: 'long-method', severity: 'medium', details: 'Long method detected' },
          { file: 'src/model.ts', type: 'large-class', severity: 'high', details: 'Large class detected' }
        ]
      };

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      expect(candidates.length).toBeGreaterThanOrEqual(6);

      // Should have duplicated code task
      const duplicateTask = candidates.find(c => c.title.includes('Duplicated Code'));
      expect(duplicateTask).toBeDefined();

      // Should have complexity hotspot tasks
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));
      expect(hotspotTasks).toHaveLength(2);

      // Should have code smell tasks
      const longMethodTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
      const largeClassTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class');
      expect(longMethodTask).toBeDefined();
      expect(largeClassTask).toBeDefined();

      // Should have lint issues task
      const lintTask = candidates.find(c => c.title.includes('Linting Issues'));
      expect(lintTask).toBeDefined();

      // All candidates should have valid structure
      candidates.forEach(candidate => {
        expect(candidate.candidateId).toMatch(/^refactoring-/);
        expect(candidate.suggestedWorkflow).toBe('refactoring');
        expect(['low', 'normal', 'high', 'urgent']).toContain(candidate.priority);
        expect(['low', 'medium', 'high']).toContain(candidate.estimatedEffort);
        expect(candidate.score).toBeGreaterThan(0);
        expect(candidate.score).toBeLessThanOrEqual(1);
        expect(candidate.rationale).toBeTruthy();
        expect(candidate.description).toBeTruthy();
      });
    });

    it('should handle well-maintained project', () => {
      baseProjectAnalysis.codeQuality = {
        lintIssues: 0,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      };

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      // Should generate no candidates for well-maintained project
      expect(candidates).toHaveLength(0);
    });

    it('should handle undefined code smells gracefully', () => {
      baseProjectAnalysis.codeQuality = {
        lintIssues: 0,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: undefined as any
      };

      // Should not throw an error
      expect(() => {
        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);
        expect(candidates).toHaveLength(0);
      }).not.toThrow();
    });

    it('should handle empty code smells array', () => {
      baseProjectAnalysis.codeQuality.codeSmells = [];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      // Should not generate any code smell tasks
      const codeSmellTasks = candidates.filter(c => c.candidateId.includes('code-smell-'));
      expect(codeSmellTasks).toHaveLength(0);
    });

    it('should handle project with only minor issues', () => {
      baseProjectAnalysis.codeQuality = {
        lintIssues: 3, // Low
        duplicatedCode: [],
        complexityHotspots: [{
          file: 'src/simple.ts',
          cyclomaticComplexity: 8,
          cognitiveComplexity: 12,
          lineCount: 150
        }],
        codeSmells: []
      };

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      expect(candidates.length).toBe(2); // Lint task + complexity task

      // All tasks should be low priority
      candidates.forEach(candidate => {
        expect(['low', 'normal']).toContain(candidate.priority);
      });
    });
  });

  // ============================================================================
  // Workflow and Structure Tests
  // ============================================================================

  describe('workflow and structure validation', () => {
    it('should always suggest refactoring workflow', () => {
      baseProjectAnalysis.codeQuality.lintIssues = 50;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      expect(candidates.length).toBeGreaterThan(0);
      candidates.forEach(candidate => {
        expect(candidate.suggestedWorkflow).toBe('refactoring');
      });
    });

    it('should generate valid candidate IDs for deduplication', () => {
      baseProjectAnalysis.codeQuality.duplicatedCode = ['src/dup.ts'];
      baseProjectAnalysis.codeQuality.complexityHotspots = [{
        file: 'src/complex.ts',
        cyclomaticComplexity: 25,
        cognitiveComplexity: 30,
        lineCount: 500
      }];
      baseProjectAnalysis.codeQuality.lintIssues = 20;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      expect(candidates.length).toBeGreaterThan(0);

      const candidateIds = candidates.map(c => c.candidateId);
      const uniqueIds = new Set(candidateIds);

      // All IDs should be unique
      expect(candidateIds.length).toBe(uniqueIds.size);

      // All IDs should start with 'refactoring-'
      candidateIds.forEach(id => {
        expect(id).toMatch(/^refactoring-/);
      });
    });

    it('should provide meaningful rationales and descriptions', () => {
      baseProjectAnalysis.codeQuality.duplicatedCode = ['src/dup.ts'];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      expect(candidates.length).toBeGreaterThan(0);
      candidates.forEach(candidate => {
        expect(candidate.rationale).toBeTruthy();
        expect(candidate.rationale.length).toBeGreaterThan(20);
        expect(candidate.description).toBeTruthy();
        expect(candidate.description.length).toBeGreaterThan(10);
      });
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling Tests
  // ============================================================================

  describe('edge cases and error handling', () => {
    it('should handle undefined complexity values gracefully', () => {
      const malformedHotspot = {
        file: 'src/malformed.ts',
        cyclomaticComplexity: undefined,
        cognitiveComplexity: null,
        lineCount: NaN
      } as any;

      baseProjectAnalysis.codeQuality.complexityHotspots = [malformedHotspot];

      // Should not throw an error
      expect(() => {
        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);
        expect(candidates).toBeDefined();
      }).not.toThrow();
    });

    it('should handle negative complexity values', () => {
      const negativeComplexityHotspot: ComplexityHotspot = {
        file: 'src/negative.ts',
        cyclomaticComplexity: -5,
        cognitiveComplexity: -10,
        lineCount: -100
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [negativeComplexityHotspot];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      // Should handle gracefully and classify as low
      const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(hotspotTask).toBeDefined();
      expect(hotspotTask?.priority).toBe('low');
    });

    it('should handle extremely large complexity values', () => {
      const extremeHotspot: ComplexityHotspot = {
        file: 'src/extreme.ts',
        cyclomaticComplexity: Number.MAX_SAFE_INTEGER,
        cognitiveComplexity: Number.MAX_SAFE_INTEGER,
        lineCount: Number.MAX_SAFE_INTEGER
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [extremeHotspot];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(hotspotTask).toBeDefined();
      expect(hotspotTask?.priority).toBe('urgent');
      expect(hotspotTask?.score).toBeLessThanOrEqual(0.95); // Should be capped
    });

    it('should handle zero complexity values', () => {
      const zeroComplexityHotspot: ComplexityHotspot = {
        file: 'src/empty.ts',
        cyclomaticComplexity: 0,
        cognitiveComplexity: 0,
        lineCount: 0
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [zeroComplexityHotspot];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(hotspotTask).toBeDefined();
      expect(hotspotTask?.priority).toBe('low');
    });

    it('should handle negative lint issues count', () => {
      baseProjectAnalysis.codeQuality.lintIssues = -10;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const lintTask = candidates.find(c => c.candidateId === 'refactoring-lint-issues');
      expect(lintTask).toBeUndefined(); // Should not generate task for negative count
    });

    it('should handle very long file paths gracefully', () => {
      const longPath = 'src/' + 'very-long-directory-name/'.repeat(50) + 'file.ts';
      const hotspot: ComplexityHotspot = {
        file: longPath,
        cyclomaticComplexity: 25,
        cognitiveComplexity: 30,
        lineCount: 500
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [hotspot];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(hotspotTask).toBeDefined();
      expect(hotspotTask?.title).toContain('file.ts'); // Should extract filename
    });
  });
});
/**
 * RefactoringAnalyzer Code Smell Processing Tests
 *
 * Comprehensive tests specifically for the code smell processing functionality
 * ensuring all 8 code smell types are properly handled with appropriate
 * TaskCandidate generation, priority assignment, and actionable recommendations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RefactoringAnalyzer } from './refactoring-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type { CodeSmell } from '@apexcli/core';

describe('RefactoringAnalyzer Code Smell Processing', () => {
  let analyzer: RefactoringAnalyzer;
  let baseProjectAnalysis: ProjectAnalysis;

  beforeEach(() => {
    analyzer = new RefactoringAnalyzer();

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

  describe('All 8 Code Smell Types Processing', () => {
    it('should process all supported code smell types correctly', () => {
      const allCodeSmellTypes: CodeSmell[] = [
        {
          file: 'src/service.ts',
          type: 'long-method',
          severity: 'high',
          details: "Method 'processData' has 120 lines, consider refactoring"
        },
        {
          file: 'src/Manager.ts',
          type: 'large-class',
          severity: 'high',
          details: 'Class has 800 lines and 25 methods'
        },
        {
          file: 'src/parser.ts',
          type: 'deep-nesting',
          severity: 'medium',
          details: 'Found 6 levels of nesting at line 45'
        },
        {
          file: 'src/auth.ts',
          type: 'duplicate-code',
          severity: 'medium',
          details: 'Duplicate validation logic found in multiple methods'
        },
        {
          file: 'src/legacy.ts',
          type: 'dead-code',
          severity: 'low',
          details: 'Unused function detectLegacyPattern never called'
        },
        {
          file: 'src/config.ts',
          type: 'magic-numbers',
          severity: 'medium',
          details: 'Magic number 42 used without explanation at line 15'
        },
        {
          file: 'src/service.ts',
          type: 'feature-envy',
          severity: 'medium',
          details: 'Method uses more properties from User class than its own'
        },
        {
          file: 'src/api.ts',
          type: 'data-clumps',
          severity: 'medium',
          details: 'Parameters firstName, lastName, email always passed together'
        }
      ];

      baseProjectAnalysis.codeQuality.codeSmells = allCodeSmellTypes;

      const candidates = analyzer.analyze(baseProjectAnalysis);

      // Should create a task for each code smell type
      expect(candidates).toHaveLength(8);

      // Verify each code smell type has corresponding task
      const expectedTaskIds = [
        'refactoring-code-smell-long-method',
        'refactoring-code-smell-large-class',
        'refactoring-code-smell-deep-nesting',
        'refactoring-code-smell-duplicate-code',
        'refactoring-code-smell-dead-code',
        'refactoring-code-smell-magic-numbers',
        'refactoring-code-smell-feature-envy',
        'refactoring-code-smell-data-clumps'
      ];

      const actualTaskIds = candidates.map(c => c.candidateId).sort();
      expect(actualTaskIds).toEqual(expectedTaskIds.sort());

      // Verify all tasks have proper structure
      candidates.forEach(candidate => {
        expect(candidate.candidateId).toMatch(/^refactoring-code-smell-/);
        expect(candidate.suggestedWorkflow).toBe('refactoring');
        expect(['low', 'normal', 'high', 'urgent']).toContain(candidate.priority);
        expect(['low', 'medium', 'high']).toContain(candidate.estimatedEffort);
        expect(candidate.score).toBeGreaterThan(0);
        expect(candidate.score).toBeLessThanOrEqual(1);
        expect(candidate.rationale).toBeTruthy();
        expect(candidate.description).toBeTruthy();
        expect(candidate.title).toBeTruthy();
      });
    });

    it('should provide appropriate priority for each code smell severity', () => {
      const criticalSmell: CodeSmell = {
        file: 'src/critical.ts',
        type: 'long-method',
        severity: 'critical',
        details: 'Critical long method'
      };

      const highSmell: CodeSmell = {
        file: 'src/high.ts',
        type: 'large-class',
        severity: 'high',
        details: 'High severity large class'
      };

      const mediumSmell: CodeSmell = {
        file: 'src/medium.ts',
        type: 'deep-nesting',
        severity: 'medium',
        details: 'Medium severity nesting'
      };

      const lowSmell: CodeSmell = {
        file: 'src/low.ts',
        type: 'dead-code',
        severity: 'low',
        details: 'Low severity dead code'
      };

      baseProjectAnalysis.codeQuality.codeSmells = [criticalSmell, highSmell, mediumSmell, lowSmell];

      const candidates = analyzer.analyze(baseProjectAnalysis);
      expect(candidates).toHaveLength(4);

      const criticalTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
      const highTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class');
      const mediumTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-deep-nesting');
      const lowTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-dead-code');

      expect(criticalTask?.priority).toBe('urgent');
      expect(highTask?.priority).toBe('high');
      expect(mediumTask?.priority).toBe('normal');
      expect(lowTask?.priority).toBe('low');

      // Verify scores are ordered by priority
      expect(criticalTask?.score).toBeGreaterThan(highTask?.score || 0);
      expect(highTask?.score).toBeGreaterThan(mediumTask?.score || 0);
      expect(mediumTask?.score).toBeGreaterThan(lowTask?.score || 0);
    });
  });

  describe('Code Smell Type Specific Tests', () => {
    it('should generate appropriate effort estimates for each smell type', () => {
      const codeSmells: CodeSmell[] = [
        { file: 'src/test1.ts', type: 'long-method', severity: 'critical', details: 'Critical method' },
        { file: 'src/test2.ts', type: 'large-class', severity: 'high', details: 'Large class' },
        { file: 'src/test3.ts', type: 'duplicate-code', severity: 'medium', details: 'Duplicate code' },
        { file: 'src/test4.ts', type: 'dead-code', severity: 'low', details: 'Dead code' }
      ];

      baseProjectAnalysis.codeQuality.codeSmells = codeSmells;

      const candidates = analyzer.analyze(baseProjectAnalysis);

      const criticalTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
      const highTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class');
      const mediumTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-duplicate-code');
      const lowTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-dead-code');

      // Critical and high severity should have high effort
      expect(criticalTask?.estimatedEffort).toBe('high');
      expect(highTask?.estimatedEffort).toBe('high');

      // Medium severity should have medium effort
      expect(mediumTask?.estimatedEffort).toBe('medium');

      // Low severity should have low effort
      expect(lowTask?.estimatedEffort).toBe('low');
    });

    it('should provide actionable recommendations for each smell type', () => {
      const testSmells: CodeSmell[] = [
        { file: 'src/method.ts', type: 'long-method', severity: 'medium', details: 'Long method' },
        { file: 'src/class.ts', type: 'large-class', severity: 'medium', details: 'Large class' },
        { file: 'src/nested.ts', type: 'deep-nesting', severity: 'medium', details: 'Deep nesting' },
        { file: 'src/dup.ts', type: 'duplicate-code', severity: 'medium', details: 'Duplicate code' },
        { file: 'src/dead.ts', type: 'dead-code', severity: 'medium', details: 'Dead code' },
        { file: 'src/magic.ts', type: 'magic-numbers', severity: 'medium', details: 'Magic numbers' },
        { file: 'src/envy.ts', type: 'feature-envy', severity: 'medium', details: 'Feature envy' },
        { file: 'src/clumps.ts', type: 'data-clumps', severity: 'medium', details: 'Data clumps' }
      ];

      baseProjectAnalysis.codeQuality.codeSmells = testSmells;

      const candidates = analyzer.analyze(baseProjectAnalysis);

      // Verify specific recommendations for each type
      const longMethodTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
      expect(longMethodTask?.rationale).toContain('Break long methods into smaller');
      expect(longMethodTask?.rationale).toContain('Single Responsibility Principle');

      const largeClassTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class');
      expect(largeClassTask?.rationale).toContain('Apply Single Responsibility Principle');
      expect(largeClassTask?.rationale).toContain('Extract related functionality');

      const deepNestingTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-deep-nesting');
      expect(deepNestingTask?.rationale).toContain('Use early returns to reduce');
      expect(deepNestingTask?.rationale).toContain('Extract nested logic');

      const duplicateCodeTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-duplicate-code');
      expect(duplicateCodeTask?.rationale).toContain('Extract common code into reusable functions');
      expect(duplicateCodeTask?.rationale).toContain('DRY');

      const deadCodeTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-dead-code');
      expect(deadCodeTask?.rationale).toContain('Remove unused functions');
      expect(deadCodeTask?.rationale).toContain('Clean up commented-out code');

      const magicNumbersTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-magic-numbers');
      expect(magicNumbersTask?.rationale).toContain('Replace numbers with named constants');
      expect(magicNumbersTask?.rationale).toContain('Use enums for related constant values');

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask?.rationale).toContain('Move methods closer to the data');
      expect(featureEnvyTask?.rationale).toContain('delegation pattern');

      const dataClumpsTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-data-clumps');
      expect(dataClumpsTask?.rationale).toContain('Create parameter objects');
      expect(dataClumpsTask?.rationale).toContain('value objects');
    });

    it('should handle code smells with descriptive rationales including original details', () => {
      const detailedSmell: CodeSmell = {
        file: 'src/complex.ts',
        type: 'long-method',
        severity: 'high',
        details: "Method 'processComplexData' has 150 lines (starting at line 42) with high cyclomatic complexity"
      };

      baseProjectAnalysis.codeQuality.codeSmells = [detailedSmell];

      const candidates = analyzer.analyze(baseProjectAnalysis);
      const task = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');

      expect(task?.rationale).toContain("Method 'processComplexData' has 150 lines");
      expect(task?.rationale).toContain('Long methods reduce readability and maintainability');
      expect(task?.rationale).toContain('Recommended actions:');
    });
  });

  describe('Code Smell Grouping and Scoring', () => {
    it('should adjust scores based on number of smells of same type', () => {
      // Few smells (should get base score)
      const fewSmells: CodeSmell[] = [
        { file: 'src/file1.ts', type: 'long-method', severity: 'medium', details: 'Method 1' },
        { file: 'src/file2.ts', type: 'long-method', severity: 'medium', details: 'Method 2' }
      ];

      // Many smells (should get bonus score)
      const manySmells: CodeSmell[] = Array.from({ length: 12 }, (_, i) => ({
        file: `src/file${i}.ts`,
        type: 'long-method' as const,
        severity: 'medium' as const,
        details: `Long method ${i}`
      }));

      // Test few smells
      baseProjectAnalysis.codeQuality.codeSmells = fewSmells;
      let candidates = analyzer.analyze(baseProjectAnalysis);
      const fewSmellsTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');

      // Test many smells
      baseProjectAnalysis.codeQuality.codeSmells = manySmells;
      candidates = analyzer.analyze(baseProjectAnalysis);
      const manySmellsTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');

      // Many smells should have higher score due to count bonus
      expect(manySmellsTask?.score).toBeGreaterThan(fewSmellsTask?.score || 0);
    });

    it('should properly group mixed severity levels and prioritize accordingly', () => {
      const mixedSeveritySmells: CodeSmell[] = [
        { file: 'src/critical.ts', type: 'long-method', severity: 'critical', details: 'Critical method' },
        { file: 'src/high1.ts', type: 'long-method', severity: 'high', details: 'High method 1' },
        { file: 'src/high2.ts', type: 'long-method', severity: 'high', details: 'High method 2' },
        { file: 'src/medium1.ts', type: 'long-method', severity: 'medium', details: 'Medium method 1' },
        { file: 'src/medium2.ts', type: 'long-method', severity: 'medium', details: 'Medium method 2' },
        { file: 'src/low.ts', type: 'long-method', severity: 'low', details: 'Low method' }
      ];

      baseProjectAnalysis.codeQuality.codeSmells = mixedSeveritySmells;

      const candidates = analyzer.analyze(baseProjectAnalysis);
      const longMethodTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');

      // Should prioritize based on highest severity (critical)
      expect(longMethodTask?.priority).toBe('urgent');
      expect(longMethodTask?.estimatedEffort).toBe('high');

      // Description should include count
      expect(longMethodTask?.description).toContain('6 long methods');

      // Should list affected files (truncated to 3 + "and X more")
      expect(longMethodTask?.description).toContain('critical.ts, high1.ts, high2.ts, and 3 more');
    });

    it('should handle dominant severity groups correctly', () => {
      // Mostly medium severity with one high
      const mostlyMediumSmells: CodeSmell[] = [
        { file: 'src/high.ts', type: 'large-class', severity: 'high', details: 'High class' },
        ...Array.from({ length: 6 }, (_, i) => ({
          file: `src/medium${i}.ts`,
          type: 'large-class' as const,
          severity: 'medium' as const,
          details: `Medium class ${i}`
        }))
      ];

      baseProjectAnalysis.codeQuality.codeSmells = mostlyMediumSmells;

      const candidates = analyzer.analyze(baseProjectAnalysis);
      const largeClassTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class');

      // Should prioritize based on highest severity, but with high severity present
      expect(largeClassTask?.priority).toBe('high');
    });
  });

  describe('Code Smell Edge Cases', () => {
    it('should handle empty code smells array', () => {
      baseProjectAnalysis.codeQuality.codeSmells = [];

      const candidates = analyzer.analyze(baseProjectAnalysis);
      const codeSmellTasks = candidates.filter(c => c.candidateId.includes('code-smell-'));

      expect(codeSmellTasks).toHaveLength(0);
    });

    it('should handle undefined code smells gracefully', () => {
      baseProjectAnalysis.codeQuality.codeSmells = undefined as any;

      expect(() => {
        const candidates = analyzer.analyze(baseProjectAnalysis);
        const codeSmellTasks = candidates.filter(c => c.candidateId.includes('code-smell-'));
        expect(codeSmellTasks).toHaveLength(0);
      }).not.toThrow();
    });

    it('should handle malformed code smell objects', () => {
      const malformedSmell = {
        file: 'src/malformed.ts',
        type: 'invalid-type' as any,
        severity: 'invalid-severity' as any,
        details: 'Malformed smell'
      };

      baseProjectAnalysis.codeQuality.codeSmells = [malformedSmell];

      expect(() => {
        const candidates = analyzer.analyze(baseProjectAnalysis);
        // Should handle gracefully and create fallback task
        const fallbackTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-invalid-type');
        expect(fallbackTask).toBeDefined();
        expect(fallbackTask?.title).toBe('Fix invalid-type Code Smells');
      }).not.toThrow();
    });

    it('should handle very long file paths in code smells', () => {
      const longPath = 'src/' + 'very-long-directory-name/'.repeat(20) + 'file.ts';
      const codeSmell: CodeSmell = {
        file: longPath,
        type: 'long-method',
        severity: 'medium',
        details: 'Long method in deeply nested file'
      };

      baseProjectAnalysis.codeQuality.codeSmells = [codeSmell];

      const candidates = analyzer.analyze(baseProjectAnalysis);
      const task = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');

      expect(task).toBeDefined();
      expect(task?.description).toContain('file.ts'); // Should extract filename
    });

    it('should handle code smells with empty details', () => {
      const smellWithEmptyDetails: CodeSmell = {
        file: 'src/empty.ts',
        type: 'dead-code',
        severity: 'low',
        details: ''
      };

      baseProjectAnalysis.codeQuality.codeSmells = [smellWithEmptyDetails];

      const candidates = analyzer.analyze(baseProjectAnalysis);
      const task = candidates.find(c => c.candidateId === 'refactoring-code-smell-dead-code');

      expect(task).toBeDefined();
      expect(task?.rationale).toBeTruthy();
      expect(task?.description).toBeTruthy();
    });
  });

  describe('Integration with Other Refactoring Issues', () => {
    it('should work alongside complexity hotspots and duplicated code', () => {
      baseProjectAnalysis.codeQuality = {
        lintIssues: 50,
        duplicatedCode: ['src/dup1.ts', 'src/dup2.ts'],
        complexityHotspots: [{
          file: 'src/complex.ts',
          cyclomaticComplexity: 40,
          cognitiveComplexity: 50,
          lineCount: 800
        }],
        codeSmells: [
          { file: 'src/method.ts', type: 'long-method', severity: 'high', details: 'Long method' },
          { file: 'src/class.ts', type: 'large-class', severity: 'medium', details: 'Large class' }
        ]
      };

      const candidates = analyzer.analyze(baseProjectAnalysis);

      // Should have tasks from all categories
      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      const complexityTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      const longMethodTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
      const largeClassTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class');
      const lintTask = candidates.find(c => c.candidateId === 'refactoring-lint-issues');

      expect(duplicateTask).toBeDefined();
      expect(complexityTask).toBeDefined();
      expect(longMethodTask).toBeDefined();
      expect(largeClassTask).toBeDefined();
      expect(lintTask).toBeDefined();

      // All should be refactoring workflow
      candidates.forEach(candidate => {
        expect(candidate.suggestedWorkflow).toBe('refactoring');
      });
    });

    it('should maintain proper task prioritization across all issue types', () => {
      baseProjectAnalysis.codeQuality = {
        lintIssues: 25, // Normal priority
        duplicatedCode: ['src/dup.ts'], // High priority (score 0.9)
        complexityHotspots: [{
          file: 'src/critical.ts',
          cyclomaticComplexity: 60, // Critical complexity
          cognitiveComplexity: 70,
          lineCount: 2500
        }],
        codeSmells: [
          { file: 'src/critical-smell.ts', type: 'long-method', severity: 'critical', details: 'Critical method' }
        ]
      };

      const candidates = analyzer.analyze(baseProjectAnalysis);
      const prioritized = analyzer.prioritize(candidates);

      expect(prioritized).toBeDefined();

      // Should prioritize duplicated code (highest fixed score of 0.9)
      expect(prioritized?.candidateId).toBe('refactoring-duplicated-code');
    });
  });
});
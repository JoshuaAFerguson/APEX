/**
 * Enhanced RefactoringAnalyzer Comprehensive Unit Tests
 *
 * This test suite provides comprehensive coverage for the enhanced RefactoringAnalyzer,
 * specifically testing all acceptance criteria:
 * - Complexity hotspot detection with various metric combinations
 * - All code smell types (long methods, large classes, deep nesting, feature envy)
 * - Duplicate pattern detection with different similarity levels
 * - Edge cases (empty analysis, missing fields)
 * - Priority ordering when multiple issues exist
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RefactoringAnalyzer } from './refactoring-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type { ComplexityHotspot, CodeSmell, DuplicatePattern } from '@apexcli/core';

describe('Enhanced RefactoringAnalyzer - Comprehensive Unit Tests', () => {
  let analyzer: RefactoringAnalyzer;
  let baseProjectAnalysis: ProjectAnalysis;

  beforeEach(() => {
    analyzer = new RefactoringAnalyzer();

    baseProjectAnalysis = {
      codebaseSize: {
        files: 100,
        lines: 10000,
        languages: { 'ts': 80, 'js': 15, 'json': 5 }
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
        coverage: 70,
        missingDocs: [],
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 75,
          details: {
            totalEndpoints: 30,
            documentedEndpoints: 23,
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

  // ============================================================================
  // COMPLEXITY HOTSPOT DETECTION WITH VARIOUS METRIC COMBINATIONS
  // ============================================================================

  describe('Complexity Hotspot Detection with Various Metric Combinations', () => {
    it('should detect hotspots with high cyclomatic complexity only', () => {
      const hotspot: ComplexityHotspot = {
        file: 'src/algorithms/PathFinder.ts',
        cyclomaticComplexity: 45, // High
        cognitiveComplexity: 12, // Low
        lineCount: 180 // Low
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [hotspot];
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(hotspotTask).toBeDefined();
      expect(hotspotTask?.priority).toBe('high');
      expect(hotspotTask?.description).toContain('Cyclomatic Complexity: 45 (high)');
      expect(hotspotTask?.description).toContain('Cognitive Complexity: 12 (low)');
      expect(hotspotTask?.rationale).toContain('Extract methods to reduce branching complexity');
    });

    it('should detect hotspots with high cognitive complexity only', () => {
      const hotspot: ComplexityHotspot = {
        file: 'src/parsers/JSONParser.ts',
        cyclomaticComplexity: 8, // Low
        cognitiveComplexity: 50, // High
        lineCount: 220 // Low
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [hotspot];
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(hotspotTask).toBeDefined();
      expect(hotspotTask?.priority).toBe('high');
      expect(hotspotTask?.description).toContain('Cognitive Complexity: 50 (high)');
      expect(hotspotTask?.rationale).toContain('Flatten control flow to improve readability');
      expect(hotspotTask?.rationale).toContain('Extract helper methods for complex logic blocks');
    });

    it('should detect hotspots with high line count only', () => {
      const hotspot: ComplexityHotspot = {
        file: 'src/models/UserManager.ts',
        cyclomaticComplexity: 12, // Low
        cognitiveComplexity: 18, // Low
        lineCount: 1200 // High
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [hotspot];
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(hotspotTask).toBeDefined();
      expect(hotspotTask?.priority).toBe('high');
      expect(hotspotTask?.description).toContain('Lines: 1200 (high');
      expect(hotspotTask?.rationale).toContain('Split into multiple modules applying Single Responsibility');
    });

    it('should detect and properly score combined high complexity (cyclomatic + cognitive)', () => {
      const hotspot: ComplexityHotspot = {
        file: 'src/core/Engine.ts',
        cyclomaticComplexity: 38, // High
        cognitiveComplexity: 48, // High
        lineCount: 600 // Medium
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [hotspot];
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(hotspotTask).toBeDefined();
      expect(hotspotTask?.priority).toBe('high');
      expect(hotspotTask?.description).toContain('combination of high cyclomatic and cognitive complexity');
      expect(hotspotTask?.rationale).toContain('major refactoring with design patterns');
      expect(hotspotTask?.rationale).toContain('Apply SOLID principles systematically');
      // Should have bonus applied for combined high complexity
      expect(hotspotTask?.score).toBeGreaterThan(0.75);
    });

    it('should detect critical complexity across all dimensions', () => {
      const hotspot: ComplexityHotspot = {
        file: 'src/legacy/MonolithProcessor.ts',
        cyclomaticComplexity: 75, // Critical
        cognitiveComplexity: 85, // Critical
        lineCount: 3000 // Critical
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [hotspot];
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(hotspotTask).toBeDefined();
      expect(hotspotTask?.priority).toBe('urgent');
      expect(hotspotTask?.estimatedEffort).toBe('high');
      expect(hotspotTask?.description).toContain('Cyclomatic Complexity: 75 (critical');
      expect(hotspotTask?.description).toContain('Cognitive Complexity: 85 (critical');
      expect(hotspotTask?.description).toContain('Lines: 3000 (critical');
      expect(hotspotTask?.description).toContain('requires immediate attention');
    });

    it('should properly prioritize multiple hotspots by weighted complexity score', () => {
      const hotspots: ComplexityHotspot[] = [
        {
          file: 'src/low-priority.ts',
          cyclomaticComplexity: 12, // Medium
          cognitiveComplexity: 18, // Low
          lineCount: 300 // Medium
        },
        {
          file: 'src/high-priority.ts',
          cyclomaticComplexity: 42, // High
          cognitiveComplexity: 55, // High
          lineCount: 800 // Medium
        },
        {
          file: 'src/medium-priority.ts',
          cyclomaticComplexity: 25, // Medium
          cognitiveComplexity: 35, // High
          lineCount: 450 // Low
        }
      ];

      baseProjectAnalysis.codeQuality.complexityHotspots = hotspots;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));
      expect(hotspotTasks).toHaveLength(3);

      // Verify ordering by score (highest first)
      expect(hotspotTasks[0].description).toContain('high-priority.ts');
      expect(hotspotTasks[1].description).toContain('medium-priority.ts');
      expect(hotspotTasks[2].description).toContain('low-priority.ts');

      // Verify scores are properly calculated and ordered
      expect(hotspotTasks[0].score).toBeGreaterThan(hotspotTasks[1].score);
      expect(hotspotTasks[1].score).toBeGreaterThan(hotspotTasks[2].score);
    });

    it('should handle edge case metrics (zero, negative, extreme values)', () => {
      const edgeCaseHotspots: ComplexityHotspot[] = [
        {
          file: 'src/zero-values.ts',
          cyclomaticComplexity: 0,
          cognitiveComplexity: 0,
          lineCount: 0
        },
        {
          file: 'src/negative-values.ts',
          cyclomaticComplexity: -5,
          cognitiveComplexity: -10,
          lineCount: -100
        },
        {
          file: 'src/extreme-values.ts',
          cyclomaticComplexity: 999999,
          cognitiveComplexity: 999999,
          lineCount: 999999
        }
      ];

      baseProjectAnalysis.codeQuality.complexityHotspots = edgeCaseHotspots;

      // Should not throw errors and should handle gracefully
      expect(() => {
        const candidates = analyzer.analyze(baseProjectAnalysis);
        expect(candidates).toHaveLength(3); // Should generate tasks for all

        // Extreme values should be classified as critical but score should be capped
        const extremeTask = candidates.find(c => c.description.includes('extreme-values.ts'));
        expect(extremeTask?.priority).toBe('urgent');
        expect(extremeTask?.score).toBeLessThanOrEqual(0.95);

        // Zero and negative should be classified as low
        const zeroTask = candidates.find(c => c.description.includes('zero-values.ts'));
        const negativeTask = candidates.find(c => c.description.includes('negative-values.ts'));
        expect(zeroTask?.priority).toBe('low');
        expect(negativeTask?.priority).toBe('low');
      }).not.toThrow();
    });
  });

  // ============================================================================
  // ALL CODE SMELL TYPES WITH DIFFERENT SEVERITY LEVELS
  // ============================================================================

  describe('All Code Smell Types with Different Severity Levels', () => {
    it('should handle long-method code smells with varying severity', () => {
      const codeSmells: CodeSmell[] = [
        {
          file: 'src/services/CriticalService.ts',
          type: 'long-method',
          severity: 'critical',
          details: "Method 'processPayment' has 500+ lines and handles critical business logic"
        },
        {
          file: 'src/utils/HighComplexity.ts',
          type: 'long-method',
          severity: 'high',
          details: "Method 'calculateTax' has 150 lines with complex nested logic"
        },
        {
          file: 'src/helpers/MediumMethod.ts',
          type: 'long-method',
          severity: 'medium',
          details: "Method 'formatData' has 80 lines, could be split"
        },
        {
          file: 'src/utils/SmallMethod.ts',
          type: 'long-method',
          severity: 'low',
          details: "Method 'validateInput' has 55 lines, minor cleanup needed"
        }
      ];

      baseProjectAnalysis.codeQuality.codeSmells = codeSmells;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const longMethodTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
      expect(longMethodTask).toBeDefined();
      expect(longMethodTask?.title).toBe('Refactor Long Methods');
      expect(longMethodTask?.description).toContain('4 long methods');
      expect(longMethodTask?.priority).toBe('urgent'); // Due to critical severity
      expect(longMethodTask?.estimatedEffort).toBe('high');
      expect(longMethodTask?.rationale).toContain('Break long methods into smaller, focused functions');
      expect(longMethodTask?.rationale).toContain('Single Responsibility Principle');
      expect(longMethodTask?.score).toBeGreaterThan(0.8);
    });

    it('should handle large-class code smells with varying severity', () => {
      const codeSmells: CodeSmell[] = [
        {
          file: 'src/models/MonolithManager.ts',
          type: 'large-class',
          severity: 'high',
          details: 'Class has 1200 lines, 35 methods, handles users, orders, and payments'
        },
        {
          file: 'src/services/LargeService.ts',
          type: 'large-class',
          severity: 'medium',
          details: 'Class has 600 lines, 18 methods, moderately complex'
        }
      ];

      baseProjectAnalysis.codeQuality.codeSmells = codeSmells;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const largeClassTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class');
      expect(largeClassTask).toBeDefined();
      expect(largeClassTask?.title).toBe('Break Down Large Classes');
      expect(largeClassTask?.description).toContain('2 oversized classes');
      expect(largeClassTask?.priority).toBe('high'); // Due to high severity smell
      expect(largeClassTask?.rationale).toContain('Apply Single Responsibility Principle to split classes');
      expect(largeClassTask?.rationale).toContain('composition over inheritance');
    });

    it('should handle deep-nesting code smells with varying severity', () => {
      const codeSmells: CodeSmell[] = [
        {
          file: 'src/parsers/ComplexParser.ts',
          type: 'deep-nesting',
          severity: 'critical',
          details: 'Found 10 levels of nesting in parseDocument method - extreme complexity'
        },
        {
          file: 'src/validators/Validator.ts',
          type: 'deep-nesting',
          severity: 'medium',
          details: 'Found 5 levels of nesting in validateForm method'
        }
      ];

      baseProjectAnalysis.codeQuality.codeSmells = codeSmells;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const deepNestingTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-deep-nesting');
      expect(deepNestingTask).toBeDefined();
      expect(deepNestingTask?.title).toBe('Reduce Deep Nesting');
      expect(deepNestingTask?.priority).toBe('urgent'); // Due to critical severity
      expect(deepNestingTask?.rationale).toContain('Use early returns to reduce nesting levels');
      expect(deepNestingTask?.rationale).toContain('Apply guard clauses');
    });

    it('should handle feature-envy code smells with varying severity', () => {
      const codeSmells: CodeSmell[] = [
        {
          file: 'src/services/UserService.ts',
          type: 'feature-envy',
          severity: 'high',
          details: 'Method updateProfile uses 15 properties from User class, only 2 from its own'
        },
        {
          file: 'src/utils/Formatter.ts',
          type: 'feature-envy',
          severity: 'medium',
          details: 'Method formatUser accesses 8 User properties, 3 own properties'
        }
      ];

      baseProjectAnalysis.codeQuality.codeSmells = codeSmells;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask).toBeDefined();
      expect(featureEnvyTask?.title).toBe('Fix Feature Envy');
      expect(featureEnvyTask?.priority).toBe('high');
      expect(featureEnvyTask?.rationale).toContain('Move methods closer to the data they use');
      expect(featureEnvyTask?.rationale).toContain('delegation pattern');
    });

    it('should handle all additional code smell types', () => {
      const codeSmells: CodeSmell[] = [
        {
          file: 'src/auth/AuthService.ts',
          type: 'duplicate-code',
          severity: 'medium',
          details: 'Validation logic duplicated across 4 methods'
        },
        {
          file: 'src/legacy/OldCode.ts',
          type: 'dead-code',
          severity: 'low',
          details: 'Unused functions from previous version'
        },
        {
          file: 'src/config/Constants.ts',
          type: 'magic-numbers',
          severity: 'medium',
          details: 'Numbers 42, 100, 500 used without explanation'
        },
        {
          file: 'src/api/UserController.ts',
          type: 'data-clumps',
          severity: 'medium',
          details: 'firstName, lastName, email passed together across 6 methods'
        }
      ];

      baseProjectAnalysis.codeQuality.codeSmells = codeSmells;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      // Check all expected code smell tasks are generated
      const expectedSmells = ['duplicate-code', 'dead-code', 'magic-numbers', 'data-clumps'];
      expectedSmells.forEach(smellType => {
        const task = candidates.find(c => c.candidateId === `refactoring-code-smell-${smellType}`);
        expect(task).toBeDefined();
        expect(task?.suggestedWorkflow).toBe('refactoring');
        expect(task?.rationale).toContain('Recommended actions:');
      });

      // Verify specific rationale content
      const deadCodeTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-dead-code');
      expect(deadCodeTask?.rationale).toContain('Remove unused functions, variables, and imports');

      const magicNumbersTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-magic-numbers');
      expect(magicNumbersTask?.rationale).toContain('Replace numbers with named constants');

      const dataClumpsTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-data-clumps');
      expect(dataClumpsTask?.rationale).toContain('Create parameter objects for grouped data');
    });
  });

  // ============================================================================
  // DUPLICATE PATTERN DETECTION WITH DIFFERENT SIMILARITY LEVELS
  // ============================================================================

  describe('Duplicate Pattern Detection with Different Similarity Levels', () => {
    it('should prioritize high similarity duplicate patterns (>80%)', () => {
      const duplicatePatterns: DuplicatePattern[] = [
        {
          pattern: 'function validateEmail(email: string) { return /^[^@]+@[^@]+\\.[^@]+$/.test(email); }',
          locations: ['src/auth/AuthService.ts', 'src/user/UserValidator.ts', 'src/api/UserController.ts'],
          similarity: 0.95 // Very high similarity
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = duplicatePatterns;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      expect(duplicateTask).toBeDefined();
      expect(duplicateTask?.priority).toBe('high');
      expect(duplicateTask?.estimatedEffort).toBe('high');
      expect(duplicateTask?.score).toBe(0.9); // High score for high similarity
      expect(duplicateTask?.description).toContain('95% average similarity');
      expect(duplicateTask?.rationale).toContain('High-similarity patterns (>80%) pose significant maintenance risks');
      expect(duplicateTask?.rationale).toContain('Extract identical methods into shared utility functions');
      expect(duplicateTask?.rationale).toContain('Template Method pattern');
    });

    it('should handle medium similarity duplicate patterns (60-80%)', () => {
      const duplicatePatterns: DuplicatePattern[] = [
        {
          pattern: 'class UserProcessor { validate() { /* similar but different logic */ } }',
          locations: ['src/user/UserProcessor.ts', 'src/admin/AdminProcessor.ts'],
          similarity: 0.72 // Medium similarity
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = duplicatePatterns;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      expect(duplicateTask).toBeDefined();
      expect(duplicateTask?.priority).toBe('normal');
      expect(duplicateTask?.estimatedEffort).toBe('medium');
      expect(duplicateTask?.description).toContain('72% average similarity');
      expect(duplicateTask?.rationale).toContain('Medium-similarity patterns (60-80%) indicate structural similarities');
      expect(duplicateTask?.rationale).toContain('Extract common interface or abstract methods');
      expect(duplicateTask?.rationale).toContain('Strategy pattern for algorithmic differences');
    });

    it('should handle low similarity duplicate patterns (<60%)', () => {
      const duplicatePatterns: DuplicatePattern[] = [
        {
          pattern: 'console.log("debug:", value);',
          locations: ['src/utils/Logger.ts', 'src/debug/Debugger.ts'],
          similarity: 0.45 // Low similarity
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = duplicatePatterns;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      expect(duplicateTask).toBeDefined();
      expect(duplicateTask?.priority).toBe('low');
      expect(duplicateTask?.estimatedEffort).toBe('low');
      expect(duplicateTask?.description).toContain('45% average similarity');
      expect(duplicateTask?.rationale).toContain('Extract common code into reusable functions');
      expect(duplicateTask?.rationale).toContain("Don't Repeat Yourself");
    });

    it('should handle multiple patterns with mixed similarity levels', () => {
      const duplicatePatterns: DuplicatePattern[] = [
        {
          pattern: 'validateEmail function',
          locations: ['src/auth.ts', 'src/user.ts'],
          similarity: 0.92 // High
        },
        {
          pattern: 'logging utility',
          locations: ['src/log1.ts', 'src/log2.ts'],
          similarity: 0.68 // Medium
        },
        {
          pattern: 'error handling',
          locations: ['src/error1.ts', 'src/error2.ts'],
          similarity: 0.35 // Low
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = duplicatePatterns;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      expect(duplicateTask).toBeDefined();

      // Should be high priority due to presence of high-similarity pattern
      expect(duplicateTask?.priority).toBe('high');
      expect(duplicateTask?.estimatedEffort).toBe('high');

      // Average similarity should be calculated
      const expectedAvgSimilarity = Math.round(((0.92 + 0.68 + 0.35) / 3) * 100);
      expect(duplicateTask?.description).toContain(`${expectedAvgSimilarity}% average similarity`);

      // Should contain details for all patterns
      expect(duplicateTask?.rationale).toContain('Pattern in src/auth.ts, src/user.ts (92% similarity)');
      expect(duplicateTask?.rationale).toContain('Pattern in src/log1.ts, src/log2.ts (68% similarity)');
      expect(duplicateTask?.rationale).toContain('Pattern in src/error1.ts, src/error2.ts (35% similarity)');
    });

    it('should handle patterns with many locations', () => {
      const duplicatePatterns: DuplicatePattern[] = [
        {
          pattern: 'const API_TIMEOUT = 5000; // Standard timeout configuration',
          locations: [
            'src/api/UserAPI.ts',
            'src/api/OrderAPI.ts',
            'src/api/PaymentAPI.ts',
            'src/api/NotificationAPI.ts',
            'src/api/AdminAPI.ts',
            'src/api/ReportsAPI.ts'
          ],
          similarity: 0.88
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = duplicatePatterns;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      expect(duplicateTask).toBeDefined();

      // Score should be adjusted upward for many locations
      expect(duplicateTask?.score).toBeGreaterThan(0.9);

      // Should show truncated location list
      expect(duplicateTask?.rationale).toContain('UserAPI.ts, OrderAPI.ts, PaymentAPI.ts and 3 more files');
    });

    it('should handle legacy string format for backward compatibility', () => {
      // Legacy format: just file paths as strings
      baseProjectAnalysis.codeQuality.duplicatedCode = [
        'src/legacy1.ts',
        'src/legacy2.ts',
        'src/legacy3.ts'
      ] as any;

      const candidates = analyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      expect(duplicateTask).toBeDefined();
      expect(duplicateTask?.description).toContain('3 instances');
      expect(duplicateTask?.priority).toBe('high'); // Default high priority for legacy format
      expect(duplicateTask?.score).toBe(0.9); // Default high score
    });
  });

  // ============================================================================
  // EDGE CASES AND ERROR HANDLING
  // ============================================================================

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty analysis gracefully', () => {
      // Completely empty analysis
      baseProjectAnalysis.codeQuality = {
        lintIssues: 0,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      };

      const candidates = analyzer.analyze(baseProjectAnalysis);
      expect(candidates).toHaveLength(0);
    });

    it('should handle missing fields in complexity hotspots', () => {
      const malformedHotspots = [
        {
          file: 'src/malformed1.ts',
          cyclomaticComplexity: undefined,
          cognitiveComplexity: null,
          lineCount: NaN
        },
        {
          // Missing required fields
          file: 'src/malformed2.ts'
        }
      ] as any[];

      baseProjectAnalysis.codeQuality.complexityHotspots = malformedHotspots;

      expect(() => {
        const candidates = analyzer.analyze(baseProjectAnalysis);
        expect(candidates).toBeDefined();
      }).not.toThrow();
    });

    it('should handle missing fields in code smells', () => {
      const malformedSmells = [
        {
          file: 'src/incomplete1.ts',
          type: 'long-method',
          // Missing severity and details
        },
        {
          // Missing type
          file: 'src/incomplete2.ts',
          severity: 'medium',
          details: 'Some details'
        }
      ] as any[];

      baseProjectAnalysis.codeQuality.codeSmells = malformedSmells;

      expect(() => {
        const candidates = analyzer.analyze(baseProjectAnalysis);
        expect(candidates).toBeDefined();
      }).not.toThrow();
    });

    it('should handle undefined/null code smells array', () => {
      baseProjectAnalysis.codeQuality.codeSmells = undefined as any;

      expect(() => {
        const candidates = analyzer.analyze(baseProjectAnalysis);
        expect(candidates).toBeDefined();
      }).not.toThrow();

      baseProjectAnalysis.codeQuality.codeSmells = null as any;

      expect(() => {
        const candidates = analyzer.analyze(baseProjectAnalysis);
        expect(candidates).toBeDefined();
      }).not.toThrow();
    });

    it('should handle malformed duplicate patterns', () => {
      const malformedPatterns = [
        {
          pattern: '',
          locations: [],
          similarity: NaN
        },
        {
          pattern: null,
          locations: null,
          similarity: -1
        },
        {
          // Missing fields
          pattern: 'some pattern'
        }
      ] as any[];

      baseProjectAnalysis.codeQuality.duplicatedCode = malformedPatterns;

      expect(() => {
        const candidates = analyzer.analyze(baseProjectAnalysis);
        expect(candidates).toBeDefined();
      }).not.toThrow();
    });

    it('should handle very long file paths', () => {
      const longPath = 'src/' + 'very-long-directory/'.repeat(30) + 'deeply-nested-file.ts';

      const hotspot: ComplexityHotspot = {
        file: longPath,
        cyclomaticComplexity: 25,
        cognitiveComplexity: 30,
        lineCount: 400
      };

      baseProjectAnalysis.codeQuality.complexityHotspots = [hotspot];
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const hotspotTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      expect(hotspotTask).toBeDefined();
      expect(hotspotTask?.title).toContain('deeply-nested-file.ts'); // Should extract filename
    });

    it('should handle extreme number of code smells without performance issues', () => {
      const manySmells: CodeSmell[] = Array.from({ length: 100 }, (_, i) => ({
        file: `src/file${i}.ts`,
        type: i % 2 === 0 ? 'long-method' : 'large-class',
        severity: ['low', 'medium', 'high'][i % 3] as any,
        details: `Code smell ${i} details`
      }));

      baseProjectAnalysis.codeQuality.codeSmells = manySmells;

      const startTime = Date.now();
      const candidates = analyzer.analyze(baseProjectAnalysis);
      const endTime = Date.now();

      expect(candidates.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in reasonable time

      // Should create tasks for different smell types
      const longMethodTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
      const largeClassTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class');
      expect(longMethodTask).toBeDefined();
      expect(largeClassTask).toBeDefined();
    });
  });

  // ============================================================================
  // PRIORITY ORDERING WHEN MULTIPLE ISSUES EXIST
  // ============================================================================

  describe('Priority Ordering When Multiple Issues Exist', () => {
    it('should correctly prioritize mixed complexity and code smell issues', () => {
      // Set up scenario with multiple issue types
      baseProjectAnalysis.codeQuality = {
        lintIssues: 150,
        duplicatedCode: [
          {
            pattern: 'validation logic',
            locations: ['src/auth.ts', 'src/user.ts', 'src/admin.ts'],
            similarity: 0.93
          }
        ],
        complexityHotspots: [
          {
            file: 'src/critical.ts',
            cyclomaticComplexity: 60,
            cognitiveComplexity: 70,
            lineCount: 2500
          }
        ],
        codeSmells: [
          {
            file: 'src/service.ts',
            type: 'long-method',
            severity: 'critical',
            details: 'Critical long method in payment processing'
          }
        ]
      };

      const candidates = analyzer.analyze(baseProjectAnalysis);
      const prioritized = analyzer.prioritize(candidates);

      expect(prioritized).toBeDefined();

      // Should prioritize by score - duplicated code typically scores highest (0.9)
      expect(prioritized?.candidateId).toBe('refactoring-duplicated-code');

      // Verify all expected candidates are present
      expect(candidates).toHaveLength(4); // duplicate, complexity, code smell, lint

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      const complexityTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      const codeSmellTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
      const lintTask = candidates.find(c => c.candidateId === 'refactoring-lint-issues');

      // Verify score ordering
      expect(duplicateTask?.score).toBeGreaterThan(complexityTask?.score || 0);
      expect(codeSmellTask?.score).toBeGreaterThan(lintTask?.score || 0);
    });

    it('should handle priority conflicts between urgent and high priority tasks', () => {
      const codeSmells: CodeSmell[] = [
        {
          file: 'src/critical1.ts',
          type: 'long-method',
          severity: 'critical',
          details: 'Critical payment method'
        },
        {
          file: 'src/critical2.ts',
          type: 'deep-nesting',
          severity: 'critical',
          details: 'Critical data processing'
        }
      ];

      const complexityHotspots: ComplexityHotspot[] = [
        {
          file: 'src/urgent.ts',
          cyclomaticComplexity: 80,
          cognitiveComplexity: 90,
          lineCount: 3500
        }
      ];

      baseProjectAnalysis.codeQuality.codeSmells = codeSmells;
      baseProjectAnalysis.codeQuality.complexityHotspots = complexityHotspots;

      const candidates = analyzer.analyze(baseProjectAnalysis);

      // All should have urgent priority, but ordering should be by score
      const urgentTasks = candidates.filter(c => c.priority === 'urgent');
      expect(urgentTasks.length).toBeGreaterThan(0);

      // Sort by score to verify ordering logic
      const sortedByScore = candidates.sort((a, b) => b.score - a.score);
      expect(sortedByScore[0].score).toBeGreaterThan(sortedByScore[1].score);
    });

    it('should handle scenario where no high-priority issues exist', () => {
      baseProjectAnalysis.codeQuality = {
        lintIssues: 5, // Low
        duplicatedCode: [],
        complexityHotspots: [
          {
            file: 'src/simple.ts',
            cyclomaticComplexity: 8,
            cognitiveComplexity: 12,
            lineCount: 150
          }
        ],
        codeSmells: [
          {
            file: 'src/minor.ts',
            type: 'dead-code',
            severity: 'low',
            details: 'Some unused utilities'
          }
        ]
      };

      const candidates = analyzer.analyze(baseProjectAnalysis);
      const prioritized = analyzer.prioritize(candidates);

      expect(prioritized).toBeDefined();
      expect(candidates).toHaveLength(3);

      // All tasks should be low priority
      candidates.forEach(candidate => {
        expect(['low', 'normal']).toContain(candidate.priority);
      });

      // Should still return the highest scoring among low-priority tasks
      expect(prioritized?.score).toBeGreaterThan(0);
    });

    it('should properly aggregate multiple hotspots when count exceeds threshold', () => {
      // Create 6 complexity hotspots to trigger aggregation
      const manyHotspots: ComplexityHotspot[] = Array.from({ length: 6 }, (_, i) => ({
        file: `src/hotspot${i}.ts`,
        cyclomaticComplexity: 20 + i * 5,
        cognitiveComplexity: 25 + i * 5,
        lineCount: 400 + i * 100
      }));

      // Add one critical hotspot
      manyHotspots.push({
        file: 'src/critical-hotspot.ts',
        cyclomaticComplexity: 70,
        cognitiveComplexity: 80,
        lineCount: 3000
      });

      baseProjectAnalysis.codeQuality.complexityHotspots = manyHotspots;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      // Should have 3 individual hotspot tasks + 1 aggregate task
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));
      const aggregateTask = candidates.find(c => c.candidateId === 'refactoring-complexity-sweep');

      expect(hotspotTasks).toHaveLength(3); // Top 3 individual
      expect(aggregateTask).toBeDefined();
      expect(aggregateTask?.description).toContain('7 complexity hotspots');
      expect(aggregateTask?.description).toContain('1 critical'); // Should detect critical count
      expect(aggregateTask?.priority).toBe('high'); // Due to critical hotspots
    });

    it('should return null when no refactoring candidates exist', () => {
      baseProjectAnalysis.codeQuality = {
        lintIssues: 0,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      };

      const candidates = analyzer.analyze(baseProjectAnalysis);
      const prioritized = analyzer.prioritize(candidates);

      expect(candidates).toHaveLength(0);
      expect(prioritized).toBeNull();
    });

    it('should maintain consistent scoring across multiple analysis runs', () => {
      const testAnalysis = {
        ...baseProjectAnalysis,
        codeQuality: {
          lintIssues: 75,
          duplicatedCode: [
            {
              pattern: 'test pattern',
              locations: ['src/a.ts', 'src/b.ts'],
              similarity: 0.85
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
              severity: 'medium',
              details: 'Medium complexity method'
            }
          ]
        }
      };

      // Run analysis multiple times
      const results1 = analyzer.analyze(testAnalysis);
      const results2 = analyzer.analyze(testAnalysis);
      const results3 = analyzer.analyze(testAnalysis);

      // Results should be identical across runs
      expect(results1.length).toBe(results2.length);
      expect(results2.length).toBe(results3.length);

      // Scores should be consistent
      for (let i = 0; i < results1.length; i++) {
        expect(results1[i].score).toBe(results2[i].score);
        expect(results2[i].score).toBe(results3[i].score);
        expect(results1[i].candidateId).toBe(results2[i].candidateId);
      }
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration Tests - End-to-End Scenarios', () => {
    it('should handle a realistic large codebase scenario', () => {
      const realisticAnalysis = {
        ...baseProjectAnalysis,
        codeQuality: {
          lintIssues: 89,
          duplicatedCode: [
            {
              pattern: 'user validation',
              locations: ['src/auth/validator.ts', 'src/user/service.ts', 'src/admin/controller.ts'],
              similarity: 0.91
            },
            {
              pattern: 'error handling',
              locations: ['src/api/base.ts', 'src/services/base.ts'],
              similarity: 0.73
            }
          ],
          complexityHotspots: [
            {
              file: 'src/core/PaymentProcessor.ts',
              cyclomaticComplexity: 65,
              cognitiveComplexity: 75,
              lineCount: 2200
            },
            {
              file: 'src/legacy/UserManager.ts',
              cyclomaticComplexity: 45,
              cognitiveComplexity: 55,
              lineCount: 1800
            },
            {
              file: 'src/utils/DataTransformer.ts',
              cyclomaticComplexity: 28,
              cognitiveComplexity: 35,
              lineCount: 650
            }
          ],
          codeSmells: [
            {
              file: 'src/services/OrderService.ts',
              type: 'long-method',
              severity: 'high',
              details: 'processOrder method spans 180 lines with complex branching logic'
            },
            {
              file: 'src/models/UserModel.ts',
              type: 'large-class',
              severity: 'medium',
              details: 'User model class has grown to 650 lines with 28 methods'
            },
            {
              file: 'src/parsers/XMLParser.ts',
              type: 'deep-nesting',
              severity: 'high',
              details: 'XML parsing logic has 8 levels of nested conditionals'
            },
            {
              file: 'src/utils/Helpers.ts',
              type: 'feature-envy',
              severity: 'medium',
              details: 'Helper methods access more User properties than their own'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(realisticAnalysis);

      // Should generate comprehensive task list
      expect(candidates.length).toBeGreaterThanOrEqual(8);

      // Verify structure and completeness
      candidates.forEach(candidate => {
        expect(candidate.candidateId).toMatch(/^refactoring-/);
        expect(candidate.suggestedWorkflow).toBe('refactoring');
        expect(['low', 'normal', 'high', 'urgent']).toContain(candidate.priority);
        expect(['low', 'medium', 'high']).toContain(candidate.estimatedEffort);
        expect(candidate.score).toBeGreaterThan(0);
        expect(candidate.score).toBeLessThanOrEqual(1);
        expect(candidate.title).toBeTruthy();
        expect(candidate.description).toBeTruthy();
        expect(candidate.rationale).toBeTruthy();
      });

      // Should prioritize correctly
      const prioritized = analyzer.prioritize(candidates);
      expect(prioritized).toBeDefined();
      expect(prioritized?.score).toBeGreaterThan(0.8); // Should be high-impact task
    });
  });
});
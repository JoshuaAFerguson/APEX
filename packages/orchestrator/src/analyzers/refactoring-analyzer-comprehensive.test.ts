/**
 * Comprehensive RefactoringAnalyzer Unit Test Suite
 *
 * This test suite provides comprehensive coverage for the enhanced RefactoringAnalyzer,
 * covering complexity hotspot detection with various metric combinations, all code smell
 * types, duplicate pattern detection with different similarity levels, edge cases, and
 * priority ordering when multiple issues exist.
 *
 * Acceptance Criteria Coverage:
 * ✅ Complexity hotspot detection with various metric combinations
 * ✅ All code smell types (long methods, large classes, deep nesting, feature envy)
 * ✅ Duplicate pattern detection with different similarity levels
 * ✅ Edge cases (empty analysis, missing fields)
 * ✅ Priority ordering when multiple issues exist
 * ✅ All tests pass with npm test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RefactoringAnalyzer } from './refactoring-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type { ComplexityHotspot, DuplicatePattern, CodeSmell } from '@apexcli/core';

describe('RefactoringAnalyzer - Comprehensive Unit Tests', () => {
  let analyzer: RefactoringAnalyzer;
  let baseAnalysis: ProjectAnalysis;

  beforeEach(() => {
    analyzer = new RefactoringAnalyzer();

    // Clean base analysis for each test
    baseAnalysis = {
      codebaseSize: {
        files: 100,
        lines: 10000,
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
          percentage: 85,
          details: {
            totalEndpoints: 20,
            documentedEndpoints: 17,
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

  describe('Complexity Hotspot Detection', () => {
    describe('Various metric combinations', () => {
      it('should detect high cyclomatic, low cognitive, medium line count', () => {
        const hotspot: ComplexityHotspot = {
          file: 'src/branchy.ts',
          cyclomaticComplexity: 40, // High
          cognitiveComplexity: 12,  // Low
          lineCount: 400            // Medium
        };

        baseAnalysis.codeQuality.complexityHotspots = [hotspot];
        const candidates = analyzer.analyze(baseAnalysis);

        const task = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
        expect(task).toBeDefined();
        expect(task?.priority).toBe('high'); // High due to cyclomatic complexity
        expect(task?.description).toContain('Cyclomatic Complexity: 40 (high)');
        expect(task?.description).toContain('Cognitive Complexity: 12 (low)');
        expect(task?.description).toContain('Lines: 400 (medium)');
        expect(task?.rationale).toContain('Extract methods to reduce branching complexity');
      });

      it('should detect low cyclomatic, high cognitive, high line count', () => {
        const hotspot: ComplexityHotspot = {
          file: 'src/confusing-large.ts',
          cyclomaticComplexity: 8,   // Low
          cognitiveComplexity: 55,   // High
          lineCount: 1800            // High
        };

        baseAnalysis.codeQuality.complexityHotspots = [hotspot];
        const candidates = analyzer.analyze(baseAnalysis);

        const task = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
        expect(task).toBeDefined();
        expect(task?.priority).toBe('high'); // High due to cognitive complexity or line count
        expect(task?.description).toContain('Cognitive Complexity: 55 (high)');
        expect(task?.description).toContain('Lines: 1800 (high');
        expect(task?.rationale).toContain('Flatten control flow to improve readability');
        expect(task?.rationale).toContain('Split into multiple modules');
      });

      it('should detect critical cyclomatic, critical cognitive, low line count', () => {
        const hotspot: ComplexityHotspot = {
          file: 'src/nightmare-short.ts',
          cyclomaticComplexity: 75,  // Critical
          cognitiveComplexity: 85,   // Critical
          lineCount: 150             // Low
        };

        baseAnalysis.codeQuality.complexityHotspots = [hotspot];
        const candidates = analyzer.analyze(baseAnalysis);

        const task = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
        expect(task).toBeDefined();
        expect(task?.priority).toBe('urgent'); // Critical overall severity
        expect(task?.description).toContain('requires immediate attention');
        expect(task?.description).toContain('combination of high cyclomatic and cognitive complexity');
        expect(task?.rationale).toContain('major refactoring with design patterns');
        expect(task?.rationale).toContain('Apply SOLID principles systematically');
      });

      it('should apply combined high complexity bonus correctly', () => {
        const highCombined: ComplexityHotspot = {
          file: 'src/high-combined.ts',
          cyclomaticComplexity: 35,  // High
          cognitiveComplexity: 42,   // High
          lineCount: 300             // Medium
        };

        const highSingle: ComplexityHotspot = {
          file: 'src/high-single.ts',
          cyclomaticComplexity: 35,  // High
          cognitiveComplexity: 10,   // Low
          lineCount: 300             // Medium
        };

        baseAnalysis.codeQuality.complexityHotspots = [highCombined, highSingle];
        const candidates = analyzer.analyze(baseAnalysis);

        // Combined high should score higher than single high
        const combinedTask = candidates.find(c => c.description.includes('high-combined.ts'));
        const singleTask = candidates.find(c => c.description.includes('high-single.ts'));

        expect(combinedTask).toBeDefined();
        expect(singleTask).toBeDefined();
        expect(combinedTask?.score).toBeGreaterThan(singleTask?.score || 0);
      });

      it('should handle metric boundary values correctly', () => {
        const boundaryHotspot: ComplexityHotspot = {
          file: 'src/boundary.ts',
          cyclomaticComplexity: 20,  // Exactly at medium/high threshold
          cognitiveComplexity: 25,   // Exactly at medium/high threshold
          lineCount: 500             // Exactly at medium/high threshold
        };

        baseAnalysis.codeQuality.complexityHotspots = [boundaryHotspot];
        const candidates = analyzer.analyze(baseAnalysis);

        const task = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
        expect(task).toBeDefined();
        expect(task?.description).toContain('Cyclomatic Complexity: 20 (medium)');
        expect(task?.description).toContain('Cognitive Complexity: 25 (medium)');
        expect(task?.description).toContain('Lines: 500 (medium)');
        expect(task?.priority).toBe('normal');
      });
    });

    describe('Multiple hotspot prioritization', () => {
      it('should correctly prioritize multiple hotspots by weighted score', () => {
        const hotspots: ComplexityHotspot[] = [
          {
            file: 'src/low-priority.ts',
            cyclomaticComplexity: 12,
            cognitiveComplexity: 15,
            lineCount: 250
          },
          {
            file: 'src/high-priority.ts',
            cyclomaticComplexity: 45,
            cognitiveComplexity: 55,
            lineCount: 1200
          },
          {
            file: 'src/medium-priority.ts',
            cyclomaticComplexity: 25,
            cognitiveComplexity: 30,
            lineCount: 600
          }
        ];

        baseAnalysis.codeQuality.complexityHotspots = hotspots;
        const candidates = analyzer.analyze(baseAnalysis);

        const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));
        expect(hotspotTasks).toHaveLength(3);

        // Verify correct prioritization order
        expect(hotspotTasks[0].description).toContain('high-priority.ts');
        expect(hotspotTasks[1].description).toContain('medium-priority.ts');
        expect(hotspotTasks[2].description).toContain('low-priority.ts');

        // Verify scores are in descending order
        expect(hotspotTasks[0].score).toBeGreaterThan(hotspotTasks[1].score);
        expect(hotspotTasks[1].score).toBeGreaterThan(hotspotTasks[2].score);
      });

      it('should generate aggregate task for many hotspots', () => {
        const manyHotspots = Array.from({ length: 6 }, (_, i) => ({
          file: `src/hotspot-${i}.ts`,
          cyclomaticComplexity: 20 + i * 5,
          cognitiveComplexity: 25 + i * 5,
          lineCount: 400 + i * 100
        }));

        baseAnalysis.codeQuality.complexityHotspots = manyHotspots;
        const candidates = analyzer.analyze(baseAnalysis);

        // Should have 3 individual tasks + 1 aggregate task
        const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));
        const sweepTask = candidates.find(c => c.candidateId === 'refactoring-complexity-sweep');

        expect(hotspotTasks).toHaveLength(3);
        expect(sweepTask).toBeDefined();
        expect(sweepTask?.description).toContain('6 complexity hotspots');
      });
    });
  });

  // ============================================================================
  // ALL CODE SMELL TYPES DETECTION
  // ============================================================================

  describe('Code Smell Detection', () => {
    describe('Long Method code smells', () => {
      it('should detect and create appropriate task for long methods', () => {
        const longMethodSmell: CodeSmell = {
          file: 'src/service/DataProcessor.ts',
          type: 'long-method',
          severity: 'high',
          details: "Method 'processComplexData' spans 150 lines (lines 42-192) with multiple responsibilities"
        };

        baseAnalysis.codeQuality.codeSmells = [longMethodSmell];
        const candidates = analyzer.analyze(baseAnalysis);

        const task = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
        expect(task).toBeDefined();
        expect(task?.title).toBe('Refactor Long Methods');
        expect(task?.description).toContain('1 long method');
        expect(task?.description).toContain('DataProcessor.ts');
        expect(task?.priority).toBe('high');
        expect(task?.rationale).toContain('Long methods reduce readability and maintainability');
        expect(task?.rationale).toContain('Break long methods into smaller, focused functions');
        expect(task?.rationale).toContain("Method 'processComplexData' spans 150 lines");
      });

      it('should handle multiple long method smells with severity aggregation', () => {
        const longMethodSmells: CodeSmell[] = [
          { file: 'src/service1.ts', type: 'long-method', severity: 'medium', details: 'Method A: 80 lines' },
          { file: 'src/service2.ts', type: 'long-method', severity: 'critical', details: 'Method B: 200 lines' },
          { file: 'src/service3.ts', type: 'long-method', severity: 'low', details: 'Method C: 60 lines' }
        ];

        baseAnalysis.codeQuality.codeSmells = longMethodSmells;
        const candidates = analyzer.analyze(baseAnalysis);

        const task = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
        expect(task).toBeDefined();
        expect(task?.description).toContain('3 long methods');
        expect(task?.priority).toBe('urgent'); // Due to critical severity smell
        expect(task?.estimatedEffort).toBe('high');
      });
    });

    describe('Large Class code smells', () => {
      it('should detect and create appropriate task for large classes', () => {
        const largeClassSmell: CodeSmell = {
          file: 'src/models/UserManager.ts',
          type: 'large-class',
          severity: 'high',
          details: 'Class has 850 lines, 28 methods, handles users, permissions, notifications'
        };

        baseAnalysis.codeQuality.codeSmells = [largeClassSmell];
        const candidates = analyzer.analyze(baseAnalysis);

        const task = candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class');
        expect(task).toBeDefined();
        expect(task?.title).toBe('Break Down Large Classes');
        expect(task?.description).toContain('1 oversized class');
        expect(task?.description).toContain('UserManager.ts');
        expect(task?.priority).toBe('high');
        expect(task?.rationale).toContain('Large classes violate Single Responsibility Principle');
        expect(task?.rationale).toContain('Apply Single Responsibility Principle to split classes');
        expect(task?.rationale).toContain('850 lines, 28 methods');
      });
    });

    describe('Deep Nesting code smells', () => {
      it('should detect and create appropriate task for deep nesting', () => {
        const deepNestingSmell: CodeSmell = {
          file: 'src/parsers/ComplexParser.ts',
          type: 'deep-nesting',
          severity: 'high',
          details: 'Found 7 levels of nesting in parseNestedStructure method at line 95'
        };

        baseAnalysis.codeQuality.codeSmells = [deepNestingSmell];
        const candidates = analyzer.analyze(baseAnalysis);

        const task = candidates.find(c => c.candidateId === 'refactoring-code-smell-deep-nesting');
        expect(task).toBeDefined();
        expect(task?.title).toBe('Reduce Deep Nesting');
        expect(task?.description).toContain('1 deeply nested code block');
        expect(task?.description).toContain('ComplexParser.ts');
        expect(task?.priority).toBe('high');
        expect(task?.rationale).toContain('Deep nesting makes code difficult to understand and test');
        expect(task?.rationale).toContain('Use early returns to reduce nesting levels');
        expect(task?.rationale).toContain('7 levels of nesting');
      });
    });

    describe('Feature Envy code smells', () => {
      it('should detect and create appropriate task for feature envy', () => {
        const featureEnvySmell: CodeSmell = {
          file: 'src/services/NotificationService.ts',
          type: 'feature-envy',
          severity: 'medium',
          details: 'Method sendUserNotification accesses 10 User properties but only 2 from its own class'
        };

        baseAnalysis.codeQuality.codeSmells = [featureEnvySmell];
        const candidates = analyzer.analyze(baseAnalysis);

        const task = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
        expect(task).toBeDefined();
        expect(task?.title).toBe('Fix Feature Envy');
        expect(task?.description).toContain('1 misplaced method');
        expect(task?.description).toContain('NotificationService.ts');
        expect(task?.priority).toBe('normal');
        expect(task?.rationale).toContain('Feature envy indicates poor method placement and weak cohesion');
        expect(task?.rationale).toContain('Move methods closer to the data they use');
        expect(task?.rationale).toContain('10 User properties');
      });
    });

    describe('Additional code smell types', () => {
      it('should handle duplicate-code smells', () => {
        const duplicateCodeSmell: CodeSmell = {
          file: 'src/validators/InputValidator.ts',
          type: 'duplicate-code',
          severity: 'medium',
          details: 'Validation logic duplicated across validateEmail, validatePassword, validateUsername'
        };

        baseAnalysis.codeQuality.codeSmells = [duplicateCodeSmell];
        const candidates = analyzer.analyze(baseAnalysis);

        const task = candidates.find(c => c.candidateId === 'refactoring-code-smell-duplicate-code');
        expect(task).toBeDefined();
        expect(task?.title).toBe('Eliminate Code Duplication');
        expect(task?.rationale).toContain('Duplicate code increases maintenance burden');
      });

      it('should handle dead-code smells', () => {
        const deadCodeSmell: CodeSmell = {
          file: 'src/legacy/OldUtils.ts',
          type: 'dead-code',
          severity: 'low',
          details: 'Functions legacyFormatter, oldHashFunction never called'
        };

        baseAnalysis.codeQuality.codeSmells = [deadCodeSmell];
        const candidates = analyzer.analyze(baseAnalysis);

        const task = candidates.find(c => c.candidateId === 'refactoring-code-smell-dead-code');
        expect(task).toBeDefined();
        expect(task?.title).toBe('Remove Dead Code');
        expect(task?.rationale).toContain('Dead code clutters the codebase');
      });

      it('should handle magic-numbers smells', () => {
        const magicNumbersSmell: CodeSmell = {
          file: 'src/config/TimeoutConfig.ts',
          type: 'magic-numbers',
          severity: 'medium',
          details: 'Magic numbers 30000, 60000, 300000 used without explanation'
        };

        baseAnalysis.codeQuality.codeSmells = [magicNumbersSmell];
        const candidates = analyzer.analyze(baseAnalysis);

        const task = candidates.find(c => c.candidateId === 'refactoring-code-smell-magic-numbers');
        expect(task).toBeDefined();
        expect(task?.title).toBe('Replace Magic Numbers');
        expect(task?.rationale).toContain('Magic numbers make code less readable');
      });

      it('should handle data-clumps smells', () => {
        const dataClumpsSmell: CodeSmell = {
          file: 'src/api/UserController.ts',
          type: 'data-clumps',
          severity: 'medium',
          details: 'Parameters firstName, lastName, email consistently passed together across 6 methods'
        };

        baseAnalysis.codeQuality.codeSmells = [dataClumpsSmell];
        const candidates = analyzer.analyze(baseAnalysis);

        const task = candidates.find(c => c.candidateId === 'refactoring-code-smell-data-clumps');
        expect(task).toBeDefined();
        expect(task?.title).toBe('Consolidate Data Clumps');
        expect(task?.rationale).toContain('Data clumps indicate missing abstractions');
      });
    });

    describe('Mixed code smell scenarios', () => {
      it('should handle multiple different code smell types simultaneously', () => {
        const mixedSmells: CodeSmell[] = [
          { file: 'src/service.ts', type: 'long-method', severity: 'high', details: 'Long method' },
          { file: 'src/model.ts', type: 'large-class', severity: 'medium', details: 'Large class' },
          { file: 'src/parser.ts', type: 'deep-nesting', severity: 'high', details: 'Deep nesting' },
          { file: 'src/notify.ts', type: 'feature-envy', severity: 'low', details: 'Feature envy' }
        ];

        baseAnalysis.codeQuality.codeSmells = mixedSmells;
        const candidates = analyzer.analyze(baseAnalysis);

        // Should create separate tasks for each smell type
        expect(candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method')).toBeDefined();
        expect(candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class')).toBeDefined();
        expect(candidates.find(c => c.candidateId === 'refactoring-code-smell-deep-nesting')).toBeDefined();
        expect(candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy')).toBeDefined();

        expect(candidates).toHaveLength(4);
      });
    });
  });

  // ============================================================================
  // DUPLICATE PATTERN DETECTION WITH DIFFERENT SIMILARITY LEVELS
  // ============================================================================

  describe('Duplicate Pattern Detection', () => {
    describe('High similarity patterns (>80%)', () => {
      it('should assign high priority and appropriate recommendations for high similarity', () => {
        const highSimilarityPatterns: DuplicatePattern[] = [
          {
            pattern: 'async function saveUser(userData: User): Promise<void> { await db.save(userData); }',
            locations: ['src/UserService.ts', 'src/AdminService.ts', 'src/GuestService.ts'],
            similarity: 0.95
          },
          {
            pattern: 'const validateEmail = (email: string) => /^[^@]+@[^@]+\.[^@]+$/.test(email);',
            locations: ['src/auth/EmailValidator.ts', 'src/forms/ContactForm.ts'],
            similarity: 0.92
          }
        ];

        baseAnalysis.codeQuality.duplicatedCode = highSimilarityPatterns;
        const candidates = analyzer.analyze(baseAnalysis);

        const task = candidates.find(c => c.title.includes('Duplicated Code'));
        expect(task).toBeDefined();
        expect(task?.priority).toBe('high');
        expect(task?.score).toBe(0.9);
        expect(task?.description).toContain('2 instances');
        expect(task?.description).toContain('(94% average similarity)'); // (0.95 + 0.92) / 2 = 0.935 rounded to 94%
        expect(task?.rationale).toContain('High-similarity patterns (>80%)');
        expect(task?.rationale).toContain('Extract identical methods into shared utility functions');
        expect(task?.rationale).toContain('Template Method pattern');
      });

      it('should handle perfect similarity (100%)', () => {
        const perfectPattern: DuplicatePattern[] = [
          {
            pattern: 'console.log("Debug: Processing started");',
            locations: ['src/module1.ts', 'src/module2.ts', 'src/module3.ts'],
            similarity: 1.0
          }
        ];

        baseAnalysis.codeQuality.duplicatedCode = perfectPattern;
        const candidates = analyzer.analyze(baseAnalysis);

        const task = candidates.find(c => c.title.includes('Duplicated Code'));
        expect(task).toBeDefined();
        expect(task?.priority).toBe('high');
        expect(task?.description).toContain('(100% average similarity)');
      });
    });

    describe('Medium similarity patterns (60-80%)', () => {
      it('should assign normal priority and appropriate recommendations for medium similarity', () => {
        const mediumSimilarityPatterns: DuplicatePattern[] = [
          {
            pattern: 'function processInput(data: any) { return validate(transform(data)); }',
            locations: ['src/processor1.ts', 'src/processor2.ts'],
            similarity: 0.75
          },
          {
            pattern: 'if (user.isActive && user.hasPermissions()) { processRequest(); }',
            locations: ['src/auth.ts', 'src/security.ts'],
            similarity: 0.68
          }
        ];

        baseAnalysis.codeQuality.duplicatedCode = mediumSimilarityPatterns;
        const candidates = analyzer.analyze(baseAnalysis);

        const task = candidates.find(c => c.title.includes('Duplicated Code'));
        expect(task).toBeDefined();
        expect(task?.priority).toBe('normal');
        expect(task?.estimatedEffort).toBe('medium');
        expect(task?.description).toContain('(72% average similarity)'); // (0.75 + 0.68) / 2 = 0.715 rounded to 72%
        expect(task?.rationale).toContain('Medium-similarity patterns (60-80%)');
        expect(task?.rationale).toContain('Extract common interface or abstract methods');
        expect(task?.rationale).toContain('Strategy pattern');
      });
    });

    describe('Low similarity patterns (<60%)', () => {
      it('should assign low priority and basic recommendations for low similarity', () => {
        const lowSimilarityPatterns: DuplicatePattern[] = [
          {
            pattern: 'return result;',
            locations: ['src/util1.ts', 'src/util2.ts'],
            similarity: 0.45
          },
          {
            pattern: 'logger.info(message);',
            locations: ['src/service1.ts', 'src/service2.ts'],
            similarity: 0.55
          }
        ];

        baseAnalysis.codeQuality.duplicatedCode = lowSimilarityPatterns;
        const candidates = analyzer.analyze(baseAnalysis);

        const task = candidates.find(c => c.title.includes('Duplicated Code'));
        expect(task).toBeDefined();
        expect(task?.priority).toBe('low');
        expect(task?.estimatedEffort).toBe('low');
        expect(task?.description).toContain('(50% average similarity)'); // (0.45 + 0.55) / 2 = 0.5 = 50%
        expect(task?.rationale).toContain('Extract common code into reusable functions');
        expect(task?.rationale).toContain("Don't Repeat Yourself");
      });
    });

    describe('Boundary similarity values', () => {
      it('should handle exact threshold boundaries correctly', () => {
        const boundaryPatterns: DuplicatePattern[] = [
          {
            pattern: 'function atHighBoundary() {}',
            locations: ['src/file1.ts', 'src/file2.ts'],
            similarity: 0.80 // Exactly at 80% threshold
          },
          {
            pattern: 'function atMediumBoundary() {}',
            locations: ['src/file3.ts', 'src/file4.ts'],
            similarity: 0.60 // Exactly at 60% threshold
          }
        ];

        baseAnalysis.codeQuality.duplicatedCode = boundaryPatterns;
        const candidates = analyzer.analyze(baseAnalysis);

        const task = candidates.find(c => c.title.includes('Duplicated Code'));
        expect(task).toBeDefined();
        // Should be normal priority since highest similarity is exactly 80% (high boundary)
        expect(task?.priority).toBe('normal');
      });
    });

    describe('Enhanced scoring with location spread', () => {
      it('should increase score for patterns with many locations', () => {
        const wideSpreadPattern: DuplicatePattern[] = [
          {
            pattern: 'const DEFAULT_TIMEOUT = 30000;',
            locations: [
              'src/api/UserAPI.ts',
              'src/api/ProductAPI.ts',
              'src/api/OrderAPI.ts',
              'src/api/PaymentAPI.ts',
              'src/api/NotificationAPI.ts'
            ],
            similarity: 0.88
          }
        ];

        baseAnalysis.codeQuality.duplicatedCode = wideSpreadPattern;
        const candidates = analyzer.analyze(baseAnalysis);

        const task = candidates.find(c => c.title.includes('Duplicated Code'));
        expect(task).toBeDefined();
        expect(task?.score).toBeGreaterThan(0.9); // Should get bonus for wide spread (5 locations > 2)
      });

      it('should cap scores at maximum value', () => {
        const extremePatterns: DuplicatePattern[] = Array.from({ length: 10 }, (_, i) => ({
          pattern: `extreme pattern ${i}`,
          locations: Array.from({ length: 10 }, (_, j) => `src/file${i}-${j}.ts`),
          similarity: 1.0
        }));

        baseAnalysis.codeQuality.duplicatedCode = extremePatterns;
        const candidates = analyzer.analyze(baseAnalysis);

        const task = candidates.find(c => c.title.includes('Duplicated Code'));
        expect(task).toBeDefined();
        expect(task?.score).toBe(0.95); // Should be capped at 0.95
      });
    });

    describe('Legacy format compatibility', () => {
      it('should handle legacy string format with default similarity', () => {
        const legacyFormat = [
          'src/legacy-duplicate1.ts',
          'src/legacy-duplicate2.ts'
        ] as any;

        baseAnalysis.codeQuality.duplicatedCode = legacyFormat;
        const candidates = analyzer.analyze(baseAnalysis);

        const task = candidates.find(c => c.title.includes('Duplicated Code'));
        expect(task).toBeDefined();
        expect(task?.priority).toBe('high'); // Default 0.85 similarity should be high priority
        expect(task?.description).toContain('2 instances');
      });

      it('should handle mixed legacy and new formats', () => {
        const mixedFormats = [
          'src/legacy.ts', // Legacy string
          {
            pattern: 'modern pattern',
            locations: ['src/modern1.ts', 'src/modern2.ts'],
            similarity: 0.76
          } as DuplicatePattern
        ] as any;

        baseAnalysis.codeQuality.duplicatedCode = mixedFormats;
        const candidates = analyzer.analyze(baseAnalysis);

        const task = candidates.find(c => c.title.includes('Duplicated Code'));
        expect(task).toBeDefined();
        expect(task?.description).toContain('2 instances');
        expect(task?.priority).toBe('high'); // Due to legacy default 0.85 > 0.8
      });
    });
  });

  // ============================================================================
  // EDGE CASES (EMPTY ANALYSIS, MISSING FIELDS)
  // ============================================================================

  describe('Edge Cases', () => {
    describe('Empty analysis scenarios', () => {
      it('should handle completely empty code quality analysis', () => {
        baseAnalysis.codeQuality = {
          lintIssues: 0,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        };

        const candidates = analyzer.analyze(baseAnalysis);
        expect(candidates).toEqual([]);
      });

      it('should handle undefined code smells gracefully', () => {
        baseAnalysis.codeQuality.codeSmells = undefined as any;

        expect(() => {
          const candidates = analyzer.analyze(baseAnalysis);
          expect(candidates).toBeDefined();
        }).not.toThrow();
      });

      it('should handle null complexity hotspots', () => {
        baseAnalysis.codeQuality.complexityHotspots = null as any;

        expect(() => {
          const candidates = analyzer.analyze(baseAnalysis);
          expect(candidates).toBeDefined();
        }).not.toThrow();
      });

      it('should handle undefined duplicated code', () => {
        baseAnalysis.codeQuality.duplicatedCode = undefined as any;

        expect(() => {
          const candidates = analyzer.analyze(baseAnalysis);
          expect(candidates).toBeDefined();
        }).not.toThrow();
      });
    });

    describe('Missing fields scenarios', () => {
      it('should handle complexity hotspots with missing fields', () => {
        const malformedHotspot = {
          file: 'src/malformed.ts',
          // Missing cyclomaticComplexity, cognitiveComplexity, lineCount
        } as any;

        baseAnalysis.codeQuality.complexityHotspots = [malformedHotspot];

        expect(() => {
          const candidates = analyzer.analyze(baseAnalysis);
          expect(candidates).toBeDefined();
        }).not.toThrow();
      });

      it('should handle code smells with missing fields', () => {
        const malformedSmell = {
          file: 'src/incomplete.ts',
          // Missing type, severity, details
        } as any;

        baseAnalysis.codeQuality.codeSmells = [malformedSmell];

        expect(() => {
          const candidates = analyzer.analyze(baseAnalysis);
          expect(candidates).toBeDefined();
        }).not.toThrow();
      });

      it('should handle duplicate patterns with missing fields', () => {
        const malformedPattern = {
          pattern: 'incomplete pattern',
          // Missing locations, similarity
        } as any;

        baseAnalysis.codeQuality.duplicatedCode = [malformedPattern];

        expect(() => {
          const candidates = analyzer.analyze(baseAnalysis);
          expect(candidates).toBeDefined();
        }).not.toThrow();
      });
    });

    describe('Invalid data scenarios', () => {
      it('should handle negative complexity values', () => {
        const negativeHotspot: ComplexityHotspot = {
          file: 'src/negative.ts',
          cyclomaticComplexity: -10,
          cognitiveComplexity: -5,
          lineCount: -100
        };

        baseAnalysis.codeQuality.complexityHotspots = [negativeHotspot];
        const candidates = analyzer.analyze(baseAnalysis);

        const task = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
        expect(task).toBeDefined();
        expect(task?.priority).toBe('low'); // Negative values should be treated as low
      });

      it('should handle extreme complexity values', () => {
        const extremeHotspot: ComplexityHotspot = {
          file: 'src/extreme.ts',
          cyclomaticComplexity: Number.MAX_SAFE_INTEGER,
          cognitiveComplexity: Number.MAX_SAFE_INTEGER,
          lineCount: Number.MAX_SAFE_INTEGER
        };

        baseAnalysis.codeQuality.complexityHotspots = [extremeHotspot];
        const candidates = analyzer.analyze(baseAnalysis);

        const task = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
        expect(task).toBeDefined();
        expect(task?.priority).toBe('urgent');
        expect(task?.score).toBeLessThanOrEqual(0.95); // Should be capped
      });

      it('should handle NaN similarity values', () => {
        const nanPattern: DuplicatePattern = {
          pattern: 'test pattern',
          locations: ['file1.ts', 'file2.ts'],
          similarity: NaN
        };

        baseAnalysis.codeQuality.duplicatedCode = [nanPattern];

        expect(() => {
          const candidates = analyzer.analyze(baseAnalysis);
          expect(candidates).toBeDefined();
        }).not.toThrow();
      });

      it('should handle negative lint issue count', () => {
        baseAnalysis.codeQuality.lintIssues = -50;

        const candidates = analyzer.analyze(baseAnalysis);
        const lintTask = candidates.find(c => c.candidateId === 'refactoring-lint-issues');

        // Should not create task for negative lint count
        expect(lintTask).toBeUndefined();
      });
    });
  });

  // ============================================================================
  // PRIORITY ORDERING WHEN MULTIPLE ISSUES EXIST
  // ============================================================================

  describe('Priority Ordering with Multiple Issues', () => {
    it('should correctly order tasks by priority and score when multiple issue types exist', () => {
      // Set up comprehensive analysis with all issue types
      baseAnalysis.codeQuality = {
        lintIssues: 100, // Normal priority, score ~0.5
        duplicatedCode: [{
          pattern: 'critical duplicate pattern',
          locations: ['src/dup1.ts', 'src/dup2.ts', 'src/dup3.ts'],
          similarity: 0.98 // High priority, score 0.9
        }],
        complexityHotspots: [
          {
            file: 'src/critical-complex.ts',
            cyclomaticComplexity: 70, // Critical
            cognitiveComplexity: 80,  // Critical
            lineCount: 2500           // Critical
          },
          {
            file: 'src/medium-complex.ts',
            cyclomaticComplexity: 22,  // Medium
            cognitiveComplexity: 28,   // High
            lineCount: 600             // Medium
          }
        ],
        codeSmells: [
          {
            file: 'src/critical-smell.ts',
            type: 'long-method',
            severity: 'critical',
            details: 'Critical long method'
          },
          {
            file: 'src/medium-smell.ts',
            type: 'large-class',
            severity: 'medium',
            details: 'Medium large class'
          }
        ]
      };

      const candidates = analyzer.analyze(baseAnalysis);
      const prioritized = analyzer.prioritize(candidates);

      // Verify we have multiple candidates
      expect(candidates.length).toBeGreaterThanOrEqual(5);

      // Verify the highest priority candidate is returned by prioritize()
      expect(prioritized).toBeDefined();

      // Find the highest scoring candidate manually
      const highestScore = Math.max(...candidates.map(c => c.score));
      const highestCandidate = candidates.find(c => c.score === highestScore);

      expect(prioritized).toEqual(highestCandidate);
    });

    it('should maintain consistent scoring across different issue types', () => {
      const highComplexity: ComplexityHotspot = {
        file: 'src/high-complexity.ts',
        cyclomaticComplexity: 45,
        cognitiveComplexity: 55,
        lineCount: 1200
      };

      const highDuplicate: DuplicatePattern = {
        pattern: 'high similarity duplicate',
        locations: ['src/dup1.ts', 'src/dup2.ts'],
        similarity: 0.96
      };

      const criticalSmell: CodeSmell = {
        file: 'src/critical-smell.ts',
        type: 'long-method',
        severity: 'critical',
        details: 'Critical method'
      };

      // Test each issue type separately to verify scoring consistency
      baseAnalysis.codeQuality.complexityHotspots = [highComplexity];
      const complexityCandidates = analyzer.analyze(baseAnalysis);

      baseAnalysis.codeQuality = { ...baseAnalysis.codeQuality, complexityHotspots: [], duplicatedCode: [highDuplicate] };
      const duplicateCandidates = analyzer.analyze(baseAnalysis);

      baseAnalysis.codeQuality = { ...baseAnalysis.codeQuality, duplicatedCode: [], codeSmells: [criticalSmell] };
      const smellCandidates = analyzer.analyze(baseAnalysis);

      // Verify consistent scoring patterns
      const complexityTask = complexityCandidates[0];
      const duplicateTask = duplicateCandidates[0];
      const smellTask = smellCandidates[0];

      expect(complexityTask.score).toBeGreaterThan(0);
      expect(duplicateTask.score).toBeGreaterThan(0);
      expect(smellTask.score).toBeGreaterThan(0);

      // Duplicate code should generally score highest due to architectural impact
      expect(duplicateTask.score).toBeGreaterThanOrEqual(complexityTask.score);
    });

    it('should handle equal scores gracefully', () => {
      // Create scenarios with very similar scores
      const similarHotspots: ComplexityHotspot[] = [
        {
          file: 'src/similar1.ts',
          cyclomaticComplexity: 25,
          cognitiveComplexity: 30,
          lineCount: 500
        },
        {
          file: 'src/similar2.ts',
          cyclomaticComplexity: 25,
          cognitiveComplexity: 30,
          lineCount: 500
        }
      ];

      baseAnalysis.codeQuality.complexityHotspots = similarHotspots;
      const candidates = analyzer.analyze(baseAnalysis);
      const prioritized = analyzer.prioritize(candidates);

      expect(prioritized).toBeDefined();
      expect(candidates).toHaveLength(2);

      // Both should have very similar scores
      const score1 = candidates[0].score;
      const score2 = candidates[1].score;
      expect(Math.abs(score1 - score2)).toBeLessThan(0.01);
    });

    it('should return null when no candidates exist', () => {
      // Clean analysis with no issues
      baseAnalysis.codeQuality = {
        lintIssues: 0,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      };

      const candidates = analyzer.analyze(baseAnalysis);
      const prioritized = analyzer.prioritize(candidates);

      expect(candidates).toEqual([]);
      expect(prioritized).toBeNull();
    });

    describe('Comprehensive integration test', () => {
      it('should handle real-world scenario with all issue types and correct prioritization', () => {
        // Simulate a real codebase with multiple issues
        baseAnalysis.codeQuality = {
          lintIssues: 85, // Medium priority
          duplicatedCode: [
            {
              pattern: 'async function authenticateUser(token: string): Promise<User> { /* auth logic */ }',
              locations: ['src/auth/AuthService.ts', 'src/api/UserAPI.ts', 'src/middleware/AuthMiddleware.ts'],
              similarity: 0.94 // High similarity
            },
            {
              pattern: 'const DEFAULT_CONFIG = { timeout: 30000, retries: 3 };',
              locations: ['src/config/api.ts', 'src/config/db.ts'],
              similarity: 0.67 // Medium similarity
            }
          ],
          complexityHotspots: [
            {
              file: 'src/services/PaymentProcessor.ts',
              cyclomaticComplexity: 55, // Critical
              cognitiveComplexity: 70,  // Critical
              lineCount: 1800           // High
            },
            {
              file: 'src/utils/DataTransformer.ts',
              cyclomaticComplexity: 28, // High
              cognitiveComplexity: 35,  // High
              lineCount: 800            // Medium
            },
            {
              file: 'src/helpers/ValidationUtils.ts',
              cyclomaticComplexity: 18, // Medium
              cognitiveComplexity: 22,  // Medium
              lineCount: 400            // Medium
            }
          ],
          codeSmells: [
            { file: 'src/models/UserModel.ts', type: 'large-class', severity: 'high', details: '750 lines, 22 methods' },
            { file: 'src/services/ReportGenerator.ts', type: 'long-method', severity: 'medium', details: '95 line method' },
            { file: 'src/parsers/XMLParser.ts', type: 'deep-nesting', severity: 'high', details: '6 levels of nesting' },
            { file: 'src/legacy/OldFeatures.ts', type: 'dead-code', severity: 'low', details: 'Unused functions' }
          ]
        };

        const candidates = analyzer.analyze(baseAnalysis);

        // Verify comprehensive candidate generation
        expect(candidates.length).toBeGreaterThanOrEqual(8); // Should generate multiple candidates

        // Verify all issue types are represented
        expect(candidates.some(c => c.title.includes('Duplicated Code'))).toBe(true);
        expect(candidates.some(c => c.candidateId.includes('complexity-hotspot'))).toBe(true);
        expect(candidates.some(c => c.candidateId.includes('code-smell'))).toBe(true);
        expect(candidates.some(c => c.title.includes('Linting Issues'))).toBe(true);

        // Verify prioritization
        const prioritized = analyzer.prioritize(candidates);
        expect(prioritized).toBeDefined();

        // Should prioritize based on score
        const sortedByScore = [...candidates].sort((a, b) => b.score - a.score);
        expect(prioritized).toEqual(sortedByScore[0]);

        // Verify all candidates have proper structure
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
      });
    });
  });

  // ============================================================================
  // ANALYZER PROPERTIES AND WORKFLOW VALIDATION
  // ============================================================================

  describe('Analyzer Properties and Workflow', () => {
    it('should have correct analyzer type', () => {
      expect(analyzer.type).toBe('refactoring');
    });

    it('should always suggest refactoring workflow for all candidates', () => {
      baseAnalysis.codeQuality.lintIssues = 50;
      baseAnalysis.codeQuality.duplicatedCode = [{ pattern: 'test', locations: ['file1.ts'], similarity: 0.8 }];

      const candidates = analyzer.analyze(baseAnalysis);

      candidates.forEach(candidate => {
        expect(candidate.suggestedWorkflow).toBe('refactoring');
      });
    });

    it('should generate unique candidate IDs', () => {
      baseAnalysis.codeQuality = {
        lintIssues: 25,
        duplicatedCode: [{ pattern: 'duplicate', locations: ['file1.ts', 'file2.ts'], similarity: 0.85 }],
        complexityHotspots: [{ file: 'src/complex.ts', cyclomaticComplexity: 30, cognitiveComplexity: 35, lineCount: 600 }],
        codeSmells: [{ file: 'src/smell.ts', type: 'long-method', severity: 'medium', details: 'Long method' }]
      };

      const candidates = analyzer.analyze(baseAnalysis);
      const candidateIds = candidates.map(c => c.candidateId);
      const uniqueIds = new Set(candidateIds);

      expect(candidateIds.length).toBe(uniqueIds.size); // All IDs should be unique
      candidateIds.forEach(id => {
        expect(id).toMatch(/^refactoring-/); // All IDs should start with 'refactoring-'
      });
    });
  });
});
/**
 * Enhanced Duplicate Code Pattern Detection - Edge Cases Test Suite
 *
 * This test suite focuses on edge cases and advanced scenarios for the enhanced
 * duplicate code pattern detection feature. Tests boundary conditions, similarity
 * scoring edge cases, and enhanced rationale generation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RefactoringAnalyzer } from './refactoring-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type { DuplicatePattern } from '@apexcli/core';

describe('Enhanced Duplicate Code Detection - Edge Cases', () => {
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

  // ============================================================================
  // Similarity Boundary Condition Tests
  // ============================================================================

  describe('Similarity boundary conditions', () => {
    it('should handle exact similarity thresholds (80% boundary)', () => {
      const boundaryPatterns: DuplicatePattern[] = [
        {
          pattern: 'function calculateTotal() { return items.reduce((sum, item) => sum + item.price, 0); }',
          locations: ['src/order/OrderCalculator.ts', 'src/cart/CartCalculator.ts'],
          similarity: 0.80 // Exactly at 80% threshold
        },
        {
          pattern: 'const validateInput = (input) => input && input.trim().length > 0;',
          locations: ['src/auth/InputValidator.ts', 'src/forms/FormValidator.ts'],
          similarity: 0.799 // Just below 80% threshold
        },
        {
          pattern: 'if (user.isActive && user.hasPermission) { return true; }',
          locations: ['src/auth/PermissionChecker.ts', 'src/security/AccessControl.ts'],
          similarity: 0.801 // Just above 80% threshold
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = boundaryPatterns;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.title.includes('Duplicated Code'));
      expect(duplicateTask).toBeDefined();

      // Should be high priority due to presence of patterns >= 80%
      expect(duplicateTask?.priority).toBe('high');
      expect(duplicateTask?.score).toBe(0.9);
    });

    it('should handle extreme similarity values (0%, 100%)', () => {
      const extremePatterns: DuplicatePattern[] = [
        {
          pattern: 'console.log("test");',
          locations: ['src/debug1.ts', 'src/debug2.ts'],
          similarity: 0.0 // Minimum similarity
        },
        {
          pattern: 'export const API_ENDPOINT = "https://api.example.com/v1";',
          locations: ['src/config/dev.ts', 'src/config/prod.ts', 'src/config/test.ts'],
          similarity: 1.0 // Perfect similarity
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = extremePatterns;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.title.includes('Duplicated Code'));
      expect(duplicateTask).toBeDefined();

      // Should still get high priority due to one perfect match
      expect(duplicateTask?.priority).toBe('high');
      expect(duplicateTask?.description).toContain('2 instances');
      expect(duplicateTask?.description).toContain('(50% average similarity)');
    });

    it('should correctly classify patterns near medium similarity threshold (60%)', () => {
      const mediumSimilarityPatterns: DuplicatePattern[] = [
        {
          pattern: 'validateUser(userData)',
          locations: ['src/service1.ts', 'src/service2.ts'],
          similarity: 0.60 // Exactly at medium/low boundary
        },
        {
          pattern: 'formatDate(new Date())',
          locations: ['src/utils1.ts', 'src/utils2.ts'],
          similarity: 0.65 // Solidly medium
        },
        {
          pattern: 'handleError(error)',
          locations: ['src/handler1.ts', 'src/handler2.ts'],
          similarity: 0.59 // Just below medium threshold
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = mediumSimilarityPatterns;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.title.includes('Duplicated Code'));
      expect(duplicateTask).toBeDefined();

      // Should be normal priority due to medium similarity range
      expect(duplicateTask?.priority).toBe('normal');
      expect(duplicateTask?.estimatedEffort).toBe('medium');
    });
  });

  // ============================================================================
  // Enhanced Rationale Generation Tests
  // ============================================================================

  describe('Enhanced rationale generation', () => {
    it('should provide specific extract method recommendations for high similarity', () => {
      const highSimilarityPattern: DuplicatePattern[] = [
        {
          pattern: 'async function saveUserData(user: User): Promise<void> { await db.users.save(user); }',
          locations: [
            'src/services/UserService.ts',
            'src/services/AdminService.ts',
            'src/services/GuestService.ts'
          ],
          similarity: 0.96
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = highSimilarityPattern;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.title.includes('Duplicated Code'));
      expect(duplicateTask).toBeDefined();

      // Should include high-similarity specific recommendations
      expect(duplicateTask?.rationale).toContain('High-similarity patterns (>80%)');
      expect(duplicateTask?.rationale).toContain('Extract identical methods into shared utility functions');
      expect(duplicateTask?.rationale).toContain('Create abstract base classes for common functionality');
      expect(duplicateTask?.rationale).toContain('Apply Template Method pattern');
      expect(duplicateTask?.rationale).toContain('Use composition to share behavior between classes');
      expect(duplicateTask?.rationale).toContain('Consider creating dedicated service classes for shared logic');
    });

    it('should provide medium similarity pattern recommendations', () => {
      const mediumSimilarityPattern: DuplicatePattern[] = [
        {
          pattern: 'function processData(input: any) { return transform(validate(input)); }',
          locations: ['src/processor1.ts', 'src/processor2.ts'],
          similarity: 0.75
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = mediumSimilarityPattern;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.title.includes('Duplicated Code'));
      expect(duplicateTask).toBeDefined();

      // Should include medium-similarity specific recommendations
      expect(duplicateTask?.rationale).toContain('Medium-similarity patterns (60-80%)');
      expect(duplicateTask?.rationale).toContain('Extract common interface or abstract methods');
      expect(duplicateTask?.rationale).toContain('Create parameterized functions to handle variations');
      expect(duplicateTask?.rationale).toContain('Apply Strategy pattern for algorithmic differences');
      expect(duplicateTask?.rationale).toContain('Consider using dependency injection');
      expect(duplicateTask?.rationale).toContain('Refactor toward shared utility modules');
    });

    it('should provide detailed pattern analysis with file locations', () => {
      const detailedPattern: DuplicatePattern[] = [
        {
          pattern: 'export class ApiClient { constructor(private baseUrl: string) {} async get(path: string) { return fetch(this.baseUrl + path); } }',
          locations: [
            'src/services/user-api-client.ts',
            'src/services/product-api-client.ts',
            'src/services/order-api-client.ts',
            'src/services/notification-api-client.ts',
            'src/services/analytics-api-client.ts'
          ],
          similarity: 0.94
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = detailedPattern;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.title.includes('Duplicated Code'));
      expect(duplicateTask).toBeDefined();

      // Should include pattern details with truncated locations for readability
      expect(duplicateTask?.rationale).toContain('Pattern in user-api-client.ts, product-api-client.ts, order-api-client.ts and 2 more files');
      expect(duplicateTask?.rationale).toContain('(94% similarity)');

      // Should truncate very long patterns
      const patternInRationale = duplicateTask?.rationale.match(/: (.+?)$/m)?.[1];
      if (patternInRationale && detailedPattern[0].pattern.length > 80) {
        expect(patternInRationale).toContain('...');
      }
    });

    it('should handle multiple patterns with different characteristics', () => {
      const mixedPatterns: DuplicatePattern[] = [
        {
          pattern: 'Short pattern',
          locations: ['file1.ts', 'file2.ts'],
          similarity: 0.98
        },
        {
          pattern: 'This is a much longer code pattern that should be truncated when displayed in the rationale because it exceeds the reasonable length',
          locations: ['fileA.ts', 'fileB.ts', 'fileC.ts'],
          similarity: 0.85
        },
        {
          pattern: 'Medium pattern example',
          locations: Array.from({ length: 8 }, (_, i) => `module${i + 1}.ts`),
          similarity: 0.92
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = mixedPatterns;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.title.includes('Duplicated Code'));
      expect(duplicateTask).toBeDefined();

      // Should handle all patterns appropriately
      expect(duplicateTask?.rationale).toContain('Short pattern');
      expect(duplicateTask?.rationale).toContain('This is a much longer code pattern that should be truncated');
      expect(duplicateTask?.rationale).toContain('module1.ts, module2.ts, module3.ts and 5 more files');
    });
  });

  // ============================================================================
  // Enhanced Scoring Algorithm Tests
  // ============================================================================

  describe('Enhanced scoring algorithm', () => {
    it('should correctly calculate scores for high similarity patterns', () => {
      const highSimilarityPattern: DuplicatePattern[] = [
        {
          pattern: 'test pattern',
          locations: ['file1.ts', 'file2.ts'],
          similarity: 0.95
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = highSimilarityPattern;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.title.includes('Duplicated Code'));
      expect(duplicateTask).toBeDefined();
      expect(duplicateTask?.score).toBe(0.9); // High similarity base score
    });

    it('should adjust scores based on pattern count', () => {
      const multiplePatterns: DuplicatePattern[] = [
        { pattern: 'pattern1', locations: ['file1.ts', 'file2.ts'], similarity: 0.85 },
        { pattern: 'pattern2', locations: ['file3.ts', 'file4.ts'], similarity: 0.87 },
        { pattern: 'pattern3', locations: ['file5.ts', 'file6.ts'], similarity: 0.89 }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = multiplePatterns;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.title.includes('Duplicated Code'));
      expect(duplicateTask).toBeDefined();

      // Score should be adjusted upward for multiple patterns
      expect(duplicateTask?.score).toBeGreaterThan(0.9);
      expect(duplicateTask?.score).toBeLessThanOrEqual(0.95); // Capped at 0.95
    });

    it('should adjust scores based on location spread', () => {
      const wideSpreadPattern: DuplicatePattern[] = [
        {
          pattern: 'widespread pattern',
          locations: ['file1.ts', 'file2.ts', 'file3.ts', 'file4.ts', 'file5.ts'],
          similarity: 0.88
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = wideSpreadPattern;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.title.includes('Duplicated Code'));
      expect(duplicateTask).toBeDefined();

      // Should get bonus for wide location spread (average > 2 locations per pattern)
      expect(duplicateTask?.score).toBeGreaterThan(0.9);
    });

    it('should cap scores at 0.95 maximum', () => {
      const perfectPatterns: DuplicatePattern[] = [
        { pattern: 'perfect1', locations: Array.from({ length: 10 }, (_, i) => `file${i}.ts`), similarity: 1.0 },
        { pattern: 'perfect2', locations: Array.from({ length: 8 }, (_, i) => `module${i}.ts`), similarity: 1.0 },
        { pattern: 'perfect3', locations: Array.from({ length: 6 }, (_, i) => `service${i}.ts`), similarity: 1.0 }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = perfectPatterns;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.title.includes('Duplicated Code'));
      expect(duplicateTask).toBeDefined();

      // Should be capped at 0.95 even with perfect scores and many patterns
      expect(duplicateTask?.score).toBe(0.95);
    });
  });

  // ============================================================================
  // Legacy Format Compatibility Tests
  // ============================================================================

  describe('Legacy format compatibility', () => {
    it('should handle mixed legacy strings and new DuplicatePattern objects', () => {
      const mixedFormats = [
        'src/legacy-duplicate.ts', // Legacy string format
        {
          pattern: 'modern pattern',
          locations: ['src/modern1.ts', 'src/modern2.ts'],
          similarity: 0.92
        } as DuplicatePattern
      ] as any;

      baseProjectAnalysis.codeQuality.duplicatedCode = mixedFormats;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.title.includes('Duplicated Code'));
      expect(duplicateTask).toBeDefined();

      // Should handle the mixed format gracefully
      expect(duplicateTask?.description).toContain('2 instances');
      expect(duplicateTask?.priority).toBe('high'); // High due to modern pattern similarity > 80%
    });

    it('should provide default values for legacy string format', () => {
      const legacyFormats = [
        'src/legacy1.ts',
        'src/legacy2.ts',
        'src/legacy3.ts'
      ] as any;

      baseProjectAnalysis.codeQuality.duplicatedCode = legacyFormats;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.title.includes('Duplicated Code'));
      expect(duplicateTask).toBeDefined();

      // Should assign default medium-high similarity (0.85) for legacy strings
      expect(duplicateTask?.description).toContain('3 instances');
      expect(duplicateTask?.priority).toBe('high'); // High due to default 0.85 similarity
    });
  });

  // ============================================================================
  // Error Handling and Edge Cases
  // ============================================================================

  describe('Error handling and edge cases', () => {
    it('should handle empty locations array gracefully', () => {
      const emptyLocationsPattern: DuplicatePattern[] = [
        {
          pattern: 'orphaned pattern',
          locations: [],
          similarity: 0.9
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = emptyLocationsPattern;

      // Should not throw error
      expect(() => {
        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);
        const duplicateTask = candidates.find(c => c.title.includes('Duplicated Code'));
        expect(duplicateTask).toBeDefined();
      }).not.toThrow();
    });

    it('should handle single location patterns', () => {
      const singleLocationPattern: DuplicatePattern[] = [
        {
          pattern: 'singleton pattern',
          locations: ['src/single.ts'],
          similarity: 0.95
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = singleLocationPattern;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.title.includes('Duplicated Code'));
      expect(duplicateTask).toBeDefined();
      expect(duplicateTask?.description).toContain('1 instance');
    });

    it('should handle malformed similarity values gracefully', () => {
      const malformedPattern = [
        {
          pattern: 'test pattern',
          locations: ['file1.ts', 'file2.ts'],
          similarity: NaN
        },
        {
          pattern: 'another pattern',
          locations: ['file3.ts', 'file4.ts'],
          similarity: Infinity
        },
        {
          pattern: 'valid pattern',
          locations: ['file5.ts', 'file6.ts'],
          similarity: 0.85
        }
      ] as any;

      baseProjectAnalysis.codeQuality.duplicatedCode = malformedPattern;

      // Should not throw error and should handle valid patterns
      expect(() => {
        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);
        const duplicateTask = candidates.find(c => c.title.includes('Duplicated Code'));
        expect(duplicateTask).toBeDefined();
      }).not.toThrow();
    });

    it('should handle extremely long patterns and file paths', () => {
      const longPattern = 'x'.repeat(1000); // Very long pattern
      const longPath = 'src/' + 'very-long-directory-name/'.repeat(50) + 'file.ts';

      const extremePattern: DuplicatePattern[] = [
        {
          pattern: longPattern,
          locations: [longPath, 'src/normal.ts'],
          similarity: 0.9
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = extremePattern;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.title.includes('Duplicated Code'));
      expect(duplicateTask).toBeDefined();

      // Should truncate the pattern in rationale
      expect(duplicateTask?.rationale).toContain('...');
    });
  });

  // ============================================================================
  // Integration with Other Analysis Results
  // ============================================================================

  describe('Integration with other analysis results', () => {
    it('should correctly prioritize duplicate code among multiple refactoring issues', () => {
      // Add both duplicate code and complexity hotspots
      baseProjectAnalysis.codeQuality.duplicatedCode = [{
        pattern: 'critical duplication',
        locations: ['src/dup1.ts', 'src/dup2.ts'],
        similarity: 0.98
      }];
      baseProjectAnalysis.codeQuality.complexityHotspots = [{
        file: 'src/complex.ts',
        cyclomaticComplexity: 25,
        cognitiveComplexity: 30,
        lineCount: 500
      }];
      baseProjectAnalysis.codeQuality.lintIssues = 50;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      // Should generate multiple candidates
      expect(candidates.length).toBeGreaterThan(1);

      // Duplicate code should get high score
      const duplicateTask = candidates.find(c => c.title.includes('Duplicated Code'));
      const complexityTask = candidates.find(c => c.candidateId.includes('complexity-hotspot'));

      expect(duplicateTask).toBeDefined();
      expect(complexityTask).toBeDefined();

      // Duplicate code should have higher priority
      expect(duplicateTask?.score).toBeGreaterThan(complexityTask?.score || 0);
    });
  });
});
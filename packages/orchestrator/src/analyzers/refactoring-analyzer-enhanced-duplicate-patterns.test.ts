/**
 * Enhanced RefactoringAnalyzer - Duplicate Pattern Detection Tests
 *
 * This test suite provides specific coverage for the enhanced duplicate pattern detection
 * functionality in the RefactoringAnalyzer, testing similarity-based prioritization
 * and enhanced analysis features.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RefactoringAnalyzer } from './refactoring-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type { DuplicatePattern } from '@apexcli/core';

describe('Enhanced RefactoringAnalyzer - Duplicate Pattern Detection', () => {
  let analyzer: RefactoringAnalyzer;
  let baseProjectAnalysis: ProjectAnalysis;

  beforeEach(() => {
    analyzer = new RefactoringAnalyzer();

    baseProjectAnalysis = {
      codebaseSize: {
        files: 50,
        lines: 8000,
        languages: { 'ts': 70, 'js': 25, 'json': 5 }
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

  describe('High Similarity Patterns (>80%)', () => {
    it('should assign high priority and score for very high similarity (90%+)', () => {
      const patterns: DuplicatePattern[] = [
        {
          pattern: 'function validateUser(user) { if (!user.email) throw new Error("Email required"); if (!user.name) throw new Error("Name required"); return true; }',
          locations: [
            'src/auth/UserValidator.ts',
            'src/admin/AdminValidator.ts',
            'src/api/UserController.ts'
          ],
          similarity: 0.96
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = patterns;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      expect(duplicateTask).toBeDefined();
      expect(duplicateTask?.priority).toBe('high');
      expect(duplicateTask?.estimatedEffort).toBe('high');
      expect(duplicateTask?.score).toBe(0.9);
      expect(duplicateTask?.description).toContain('96% average similarity');
    });

    it('should provide high-similarity specific recommendations', () => {
      const patterns: DuplicatePattern[] = [
        {
          pattern: 'email validation regex pattern',
          locations: ['src/auth.ts', 'src/user.ts', 'src/forms.ts'],
          similarity: 0.88
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = patterns;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      expect(duplicateTask?.rationale).toContain('High-similarity patterns (>80%) pose significant maintenance risks');
      expect(duplicateTask?.rationale).toContain('Extract identical methods into shared utility functions');
      expect(duplicateTask?.rationale).toContain('Template Method pattern for algorithmic similarities');
      expect(duplicateTask?.rationale).toContain('composition to share behavior between classes');
    });

    it('should include enhanced pattern analysis in rationale', () => {
      const patterns: DuplicatePattern[] = [
        {
          pattern: 'const apiTimeout = 5000; const retryCount = 3; const baseURL = "/api/v1";',
          locations: [
            'src/services/UserService.ts',
            'src/services/OrderService.ts',
            'src/services/PaymentService.ts'
          ],
          similarity: 0.92
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = patterns;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      expect(duplicateTask?.rationale).toContain('Pattern in UserService.ts, OrderService.ts, PaymentService.ts (92% similarity)');
      expect(duplicateTask?.rationale).toContain('const apiTimeout = 5000; const retryCount = 3; const baseURL = "/api/v1";');
    });
  });

  describe('Medium Similarity Patterns (60-80%)', () => {
    it('should assign normal priority for medium similarity', () => {
      const patterns: DuplicatePattern[] = [
        {
          pattern: 'error handling with different message formats',
          locations: ['src/errors/APIError.ts', 'src/errors/ValidationError.ts'],
          similarity: 0.74
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = patterns;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      expect(duplicateTask?.priority).toBe('normal');
      expect(duplicateTask?.estimatedEffort).toBe('medium');
      expect(duplicateTask?.description).toContain('74% average similarity');
    });

    it('should provide medium-similarity specific recommendations', () => {
      const patterns: DuplicatePattern[] = [
        {
          pattern: 'database connection setup with variations',
          locations: ['src/db/UserDB.ts', 'src/db/OrderDB.ts'],
          similarity: 0.67
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = patterns;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      expect(duplicateTask?.rationale).toContain('Medium-similarity patterns (60-80%) indicate structural similarities');
      expect(duplicateTask?.rationale).toContain('Extract common interface or abstract methods');
      expect(duplicateTask?.rationale).toContain('Strategy pattern for algorithmic differences');
      expect(duplicateTask?.rationale).toContain('dependency injection for configurable behavior');
    });
  });

  describe('Low Similarity Patterns (<60%)', () => {
    it('should assign low priority for low similarity', () => {
      const patterns: DuplicatePattern[] = [
        {
          pattern: 'console.log statements with different messages',
          locations: ['src/debug/Logger.ts', 'src/utils/Debug.ts'],
          similarity: 0.43
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = patterns;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      expect(duplicateTask?.priority).toBe('low');
      expect(duplicateTask?.estimatedEffort).toBe('low');
      expect(duplicateTask?.description).toContain('43% average similarity');
    });

    it('should provide standard recommendations for low similarity', () => {
      const patterns: DuplicatePattern[] = [
        {
          pattern: 'basic utility functions',
          locations: ['src/utils/helpers.ts', 'src/lib/utils.ts'],
          similarity: 0.35
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = patterns;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      expect(duplicateTask?.rationale).toContain('Extract common code into reusable functions');
      expect(duplicateTask?.rationale).toContain("Don't Repeat Yourself");
      expect(duplicateTask?.rationale).toContain('design patterns for recurring structures');
    });
  });

  describe('Mixed Similarity Scenarios', () => {
    it('should prioritize by highest similarity when multiple patterns exist', () => {
      const patterns: DuplicatePattern[] = [
        {
          pattern: 'low similarity pattern',
          locations: ['src/a.ts', 'src/b.ts'],
          similarity: 0.45
        },
        {
          pattern: 'high similarity pattern',
          locations: ['src/c.ts', 'src/d.ts'],
          similarity: 0.94
        },
        {
          pattern: 'medium similarity pattern',
          locations: ['src/e.ts', 'src/f.ts'],
          similarity: 0.72
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = patterns;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      // Should be high priority due to the 94% similarity pattern
      expect(duplicateTask?.priority).toBe('high');
      expect(duplicateTask?.estimatedEffort).toBe('high');
    });

    it('should correctly calculate average similarity for mixed patterns', () => {
      const patterns: DuplicatePattern[] = [
        {
          pattern: 'pattern1',
          locations: ['src/a.ts', 'src/b.ts'],
          similarity: 0.80
        },
        {
          pattern: 'pattern2',
          locations: ['src/c.ts', 'src/d.ts'],
          similarity: 0.90
        },
        {
          pattern: 'pattern3',
          locations: ['src/e.ts', 'src/f.ts'],
          similarity: 0.60
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = patterns;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      // Average: (80 + 90 + 60) / 3 = 77%
      expect(duplicateTask?.description).toContain('77% average similarity');
    });
  });

  describe('Pattern Location Handling', () => {
    it('should handle patterns with many locations and increase score', () => {
      const patterns: DuplicatePattern[] = [
        {
          pattern: 'API endpoint configuration',
          locations: [
            'src/api/users.ts',
            'src/api/orders.ts',
            'src/api/products.ts',
            'src/api/categories.ts',
            'src/api/reviews.ts',
            'src/api/payments.ts'
          ],
          similarity: 0.85
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = patterns;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      // Score should be boosted for many locations
      expect(duplicateTask?.score).toBeGreaterThan(0.9);
    });

    it('should truncate location lists in rationale when many files', () => {
      const patterns: DuplicatePattern[] = [
        {
          pattern: 'configuration pattern',
          locations: [
            'src/config/database.ts',
            'src/config/cache.ts',
            'src/config/logging.ts',
            'src/config/monitoring.ts',
            'src/config/security.ts'
          ],
          similarity: 0.87
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = patterns;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      expect(duplicateTask?.rationale).toContain('database.ts, cache.ts, logging.ts and 2 more files');
    });

    it('should show all locations when count is 3 or less', () => {
      const patterns: DuplicatePattern[] = [
        {
          pattern: 'small pattern',
          locations: [
            'src/module1.ts',
            'src/module2.ts',
            'src/module3.ts'
          ],
          similarity: 0.85
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = patterns;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      expect(duplicateTask?.rationale).toContain('module1.ts, module2.ts, module3.ts');
      expect(duplicateTask?.rationale).not.toContain('and 0 more files');
    });
  });

  describe('Pattern Snippet Handling', () => {
    it('should truncate very long patterns in rationale', () => {
      const longPattern = 'function processComplexData(input) { ' +
        'const validated = validateInput(input); ' +
        'const processed = transformData(validated); ' +
        'const filtered = filterResults(processed); ' +
        'const sorted = sortByPriority(filtered); ' +
        'return formatOutput(sorted); }';

      const patterns: DuplicatePattern[] = [
        {
          pattern: longPattern,
          locations: ['src/processor1.ts', 'src/processor2.ts'],
          similarity: 0.88
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = patterns;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      // Should truncate at 80 characters and add "..."
      expect(duplicateTask?.rationale).toContain('function processComplexData(input) { const validated = validateInput(input);...');
    });

    it('should show full pattern when under 80 characters', () => {
      const shortPattern = 'const API_URL = "/api/v1";';

      const patterns: DuplicatePattern[] = [
        {
          pattern: shortPattern,
          locations: ['src/config1.ts', 'src/config2.ts'],
          similarity: 0.90
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = patterns;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      expect(duplicateTask?.rationale).toContain('const API_URL = "/api/v1";');
      expect(duplicateTask?.rationale).not.toContain('...');
    });
  });

  describe('Score Calculation Edge Cases', () => {
    it('should cap final score at 0.95', () => {
      const patterns: DuplicatePattern[] = [
        {
          pattern: 'extremely similar pattern',
          locations: Array.from({ length: 10 }, (_, i) => `src/file${i}.ts`),
          similarity: 0.99
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = patterns;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      expect(duplicateTask?.score).toBeLessThanOrEqual(0.95);
    });

    it('should handle zero similarity gracefully', () => {
      const patterns: DuplicatePattern[] = [
        {
          pattern: 'no similarity pattern',
          locations: ['src/a.ts', 'src/b.ts'],
          similarity: 0.0
        }
      ];

      baseProjectAnalysis.codeQuality.duplicatedCode = patterns;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      expect(duplicateTask).toBeDefined();
      expect(duplicateTask?.priority).toBe('low');
    });

    it('should handle invalid similarity values', () => {
      const patterns: DuplicatePattern[] = [
        {
          pattern: 'invalid similarity pattern',
          locations: ['src/a.ts', 'src/b.ts'],
          similarity: -0.5
        },
        {
          pattern: 'another invalid similarity pattern',
          locations: ['src/c.ts', 'src/d.ts'],
          similarity: 1.5
        }
      ] as DuplicatePattern[];

      baseProjectAnalysis.codeQuality.duplicatedCode = patterns;

      expect(() => {
        const candidates = analyzer.analyze(baseProjectAnalysis);
        expect(candidates).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle mixed legacy string and new DuplicatePattern format', () => {
      const mixedInput = [
        'src/legacy1.ts', // Legacy string format
        {
          pattern: 'modern pattern',
          locations: ['src/modern1.ts', 'src/modern2.ts'],
          similarity: 0.85
        },
        'src/legacy2.ts' // Another legacy string
      ] as any;

      baseProjectAnalysis.codeQuality.duplicatedCode = mixedInput;
      const candidates = analyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      expect(duplicateTask).toBeDefined();
      expect(duplicateTask?.description).toContain('3 instances');
    });

    it('should assign default high priority/score for legacy string format', () => {
      baseProjectAnalysis.codeQuality.duplicatedCode = [
        'src/legacy1.ts',
        'src/legacy2.ts'
      ] as any;

      const candidates = analyzer.analyze(baseProjectAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      expect(duplicateTask?.priority).toBe('high');
      expect(duplicateTask?.score).toBe(0.9); // Default high score for legacy
    });
  });
});
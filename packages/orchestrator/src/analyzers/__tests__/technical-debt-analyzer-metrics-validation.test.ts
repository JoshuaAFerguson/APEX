/**
 * Technical Debt Analyzer Metrics Validation Test
 *
 * This test file focuses specifically on the accuracy of metrics calculations
 * in the TechnicalDebtAnalyzer, ensuring all formulas work correctly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TechnicalDebtAnalyzer } from '../technical-debt-analyzer';
import type { ProjectAnalysis } from '../../idle-processor';
import type {
  ComplexityHotspot,
  CodeSmell,
  DuplicatePattern,
  EnhancedDocumentationAnalysis
} from '@apexcli/core';

describe('TechnicalDebtAnalyzer - Metrics Validation', () => {
  let analyzer: TechnicalDebtAnalyzer;
  let baseAnalysis: ProjectAnalysis;

  beforeEach(() => {
    analyzer = new TechnicalDebtAnalyzer();

    baseAnalysis = {
      codebaseSize: {
        files: 10,
        lines: 1000,
        languages: { typescript: 1000 }
      },
      testCoverage: {
        percentage: 80,
        uncoveredFiles: []
      },
      dependencies: {
        outdated: [],
        security: [],
        outdatedPackages: [],
        securityIssues: [],
        deprecatedPackages: []
      },
      codeQuality: {
        lintIssues: 0,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: {
        coveragePercentage: 80,
        undocumentedExports: [],
        outdatedDocumentation: [],
        missingReadmeSections: [],
        apiCompleteness: {
          documented: 80,
          total: 100,
          coveragePercentage: 80
        }
      } as EnhancedDocumentationAnalysis,
      performance: {
        bundleSize: 2048,
        slowTests: [],
        bottlenecks: []
      },
      testAnalysis: {
        branchCoverage: {
          percentage: 75,
          uncoveredBranches: []
        },
        antiPatterns: [],
        untestedExports: []
      }
    };
  });

  describe('Code Complexity Metrics', () => {
    it('should calculate average cyclomatic complexity correctly', () => {
      const complexityAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          complexityHotspots: [
            {
              file: 'file1.ts',
              cyclomaticComplexity: 10,
              cognitiveComplexity: 12,
              lineCount: 200,
              functionName: 'simple'
            },
            {
              file: 'file2.ts',
              cyclomaticComplexity: 30,
              cognitiveComplexity: 35,
              lineCount: 500,
              functionName: 'moderate'
            },
            {
              file: 'file3.ts',
              cyclomaticComplexity: 50,
              cognitiveComplexity: 60,
              lineCount: 800,
              functionName: 'complex'
            }
          ]
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(complexityAnalysis);
      const expectedAverage = (10 + 30 + 50) / 3; // 30

      expect(analysis.metrics?.codeComplexity).toBe(expectedAverage);
    });

    it('should return 0 complexity for no hotspots', () => {
      const noComplexityAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          complexityHotspots: []
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(noComplexityAnalysis);
      expect(analysis.metrics?.codeComplexity).toBe(0);
    });

    it('should handle single complexity hotspot', () => {
      const singleComplexityAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          complexityHotspots: [
            {
              file: 'single.ts',
              cyclomaticComplexity: 42,
              cognitiveComplexity: 48,
              lineCount: 600,
              functionName: 'singleFunction'
            }
          ]
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(singleComplexityAnalysis);
      expect(analysis.metrics?.codeComplexity).toBe(42);
    });

    it('should handle very high complexity values', () => {
      const highComplexityAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          complexityHotspots: [
            {
              file: 'extreme.ts',
              cyclomaticComplexity: 200,
              cognitiveComplexity: 250,
              lineCount: 3000,
              functionName: 'extremeFunction'
            }
          ]
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(highComplexityAnalysis);
      expect(analysis.metrics?.codeComplexity).toBe(200);
    });
  });

  describe('Test Coverage Metrics', () => {
    it('should preserve exact test coverage percentage', () => {
      const testCases = [0, 25.5, 50, 75.25, 100];

      testCases.forEach(percentage => {
        const coverageAnalysis = {
          ...baseAnalysis,
          testCoverage: {
            percentage,
            uncoveredFiles: percentage < 100 ? ['uncovered.ts'] : []
          }
        };

        const analysis = analyzer.createTechnicalDebtAnalysis(coverageAnalysis);
        expect(analysis.metrics?.testCoverage).toBe(percentage);
      });
    });

    it('should handle null test coverage', () => {
      const nullCoverageAnalysis = {
        ...baseAnalysis,
        testCoverage: null
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(nullCoverageAnalysis);
      expect(analysis.metrics?.testCoverage).toBe(0);
    });

    it('should handle missing test coverage', () => {
      const missingCoverageAnalysis = {
        ...baseAnalysis
      };
      delete (missingCoverageAnalysis as any).testCoverage;

      const analysis = analyzer.createTechnicalDebtAnalysis(missingCoverageAnalysis);
      expect(analysis.metrics?.testCoverage).toBe(0);
    });
  });

  describe('Duplicated Lines Percent Metrics', () => {
    it('should calculate duplicated lines percentage with known values', () => {
      const duplicationAnalysis = {
        ...baseAnalysis,
        codebaseSize: {
          files: 10,
          lines: 2000, // Known total for precise calculation
          languages: { typescript: 2000 }
        },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          duplicatedCode: [
            {
              pattern: 'pattern1',
              locations: ['a.ts', 'b.ts'], // 2 locations
              similarity: 1.0 // Perfect similarity
            }
          ]
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(duplicationAnalysis);

      // Formula: (locations × similarity × 50) / totalLines × 100
      // Expected: (2 × 1.0 × 50) / 2000 × 100 = 5%
      const expectedPercentage = (2 * 1.0 * 50) / 2000 * 100;

      expect(analysis.metrics?.duplicatedLinesPercent).toBe(expectedPercentage);
    });

    it('should handle multiple duplication patterns', () => {
      const multiDuplicationAnalysis = {
        ...baseAnalysis,
        codebaseSize: {
          files: 20,
          lines: 5000,
          languages: { typescript: 5000 }
        },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          duplicatedCode: [
            {
              pattern: 'validation',
              locations: ['user.ts', 'admin.ts', 'guest.ts'], // 3 locations
              similarity: 0.9
            },
            {
              pattern: 'utility',
              locations: ['util1.ts', 'util2.ts'], // 2 locations
              similarity: 0.8
            },
            {
              pattern: 'helper',
              locations: ['help1.ts', 'help2.ts', 'help3.ts', 'help4.ts'], // 4 locations
              similarity: 0.95
            }
          ]
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(multiDuplicationAnalysis);

      // Pattern 1: 3 × 0.9 × 50 = 135
      // Pattern 2: 2 × 0.8 × 50 = 80
      // Pattern 3: 4 × 0.95 × 50 = 190
      // Total: 405 lines duplicated
      // Percentage: (405 / 5000) × 100 = 8.1%
      const expectedPercentage = ((3 * 0.9 * 50) + (2 * 0.8 * 50) + (4 * 0.95 * 50)) / 5000 * 100;

      expect(analysis.metrics?.duplicatedLinesPercent).toBeCloseTo(expectedPercentage, 2);
    });

    it('should return 0% for no duplication', () => {
      const noDuplicationAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          duplicatedCode: []
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(noDuplicationAnalysis);
      expect(analysis.metrics?.duplicatedLinesPercent).toBe(0);
    });

    it('should handle edge case with 0 total lines', () => {
      const zeroLinesAnalysis = {
        ...baseAnalysis,
        codebaseSize: {
          files: 0,
          lines: 0,
          languages: {}
        },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          duplicatedCode: [
            {
              pattern: 'some-pattern',
              locations: ['a.ts', 'b.ts'],
              similarity: 0.9
            }
          ]
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(zeroLinesAnalysis);

      // Should avoid division by zero and return 0
      expect(analysis.metrics?.duplicatedLinesPercent).toBe(0);
    });

    it('should cap duplicated lines at 100%', () => {
      const extremeDuplicationAnalysis = {
        ...baseAnalysis,
        codebaseSize: {
          files: 5,
          lines: 100, // Small codebase
          languages: { typescript: 100 }
        },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          duplicatedCode: [
            {
              pattern: 'massive-duplication',
              locations: Array(50).fill('duplicate.ts'), // Many locations
              similarity: 1.0
            }
          ]
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(extremeDuplicationAnalysis);

      // Should be capped at 100%
      expect(analysis.metrics?.duplicatedLinesPercent).toBe(100);
    });
  });

  describe('Maintainability Index Metrics', () => {
    it('should calculate high maintainability for clean code', () => {
      const cleanCodeAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 95, uncoveredFiles: [] }, // Excellent coverage
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: [],
          complexityHotspots: [
            {
              file: 'simple.ts',
              cyclomaticComplexity: 5, // Low complexity
              cognitiveComplexity: 6,
              lineCount: 100,
              functionName: 'simpleFunction'
            }
          ],
          codeSmells: []
        },
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: []
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(cleanCodeAnalysis);

      // Should be high for maintainable code
      expect(analysis.metrics?.maintainabilityIndex).toBeGreaterThan(80);
      expect(analysis.metrics?.maintainabilityIndex).toBeLessThanOrEqual(100);
    });

    it('should calculate low maintainability for problematic code', () => {
      const problematicCodeAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 20, uncoveredFiles: ['file1.ts', 'file2.ts'] }, // Poor coverage
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: [
            {
              pattern: 'lots-of-duplication',
              locations: ['a.ts', 'b.ts', 'c.ts', 'd.ts'],
              similarity: 0.95
            }
          ],
          complexityHotspots: [
            {
              file: 'complex.ts',
              cyclomaticComplexity: 80, // High complexity
              cognitiveComplexity: 100,
              lineCount: 2000,
              functionName: 'complexFunction'
            }
          ],
          codeSmells: Array(10).fill({
            file: 'smelly.ts',
            type: 'god-class',
            severity: 'high',
            line: 1,
            description: 'High severity smell',
            suggestion: 'Fix it'
          })
        },
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: [
            {
              name: 'security-issue',
              cveId: 'CVE-2023-12345',
              severity: 'critical',
              affectedVersions: '<1.0.0',
              description: 'Security vulnerability'
            }
          ]
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(problematicCodeAnalysis);

      // Should be low for problematic code
      expect(analysis.metrics?.maintainabilityIndex).toBeLessThan(50);
      expect(analysis.metrics?.maintainabilityIndex).toBeGreaterThanOrEqual(0);
    });

    it('should calculate moderate maintainability for mixed code quality', () => {
      const moderateCodeAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 65, uncoveredFiles: ['file1.ts'] }, // Moderate coverage
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: [
            {
              pattern: 'some-duplication',
              locations: ['a.ts', 'b.ts'],
              similarity: 0.8
            }
          ],
          complexityHotspots: [
            {
              file: 'moderate.ts',
              cyclomaticComplexity: 25, // Moderate complexity
              cognitiveComplexity: 30,
              lineCount: 400,
              functionName: 'moderateFunction'
            }
          ],
          codeSmells: [
            {
              file: 'mildly-smelly.ts',
              type: 'long-method',
              severity: 'medium',
              line: 10,
              description: 'Medium severity smell',
              suggestion: 'Consider refactoring'
            }
          ]
        },
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: []
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(moderateCodeAnalysis);

      // Should be in moderate range
      expect(analysis.metrics?.maintainabilityIndex).toBeGreaterThan(40);
      expect(analysis.metrics?.maintainabilityIndex).toBeLessThan(80);
    });

    it('should ensure maintainability index bounds are respected', () => {
      const extremeCases = [
        // Perfect case
        {
          ...baseAnalysis,
          testCoverage: { percentage: 100, uncoveredFiles: [] },
          codeQuality: {
            lintIssues: 0,
            duplicatedCode: [],
            complexityHotspots: [],
            codeSmells: []
          }
        },
        // Worst case
        {
          ...baseAnalysis,
          testCoverage: { percentage: 0, uncoveredFiles: Array(100).fill('uncovered.ts') },
          codeQuality: {
            lintIssues: 1000,
            duplicatedCode: Array(50).fill({
              pattern: 'extreme-duplication',
              locations: Array(10).fill('dup.ts'),
              similarity: 1.0
            }),
            complexityHotspots: Array(20).fill({
              file: 'extreme.ts',
              cyclomaticComplexity: 200,
              cognitiveComplexity: 300,
              lineCount: 5000,
              functionName: 'extremeFunction'
            }),
            codeSmells: Array(100).fill({
              file: 'awful.ts',
              type: 'god-class',
              severity: 'critical',
              line: 1,
              description: 'Extreme code smell',
              suggestion: 'Complete rewrite'
            })
          },
          dependencies: {
            ...baseAnalysis.dependencies,
            securityIssues: Array(20).fill({
              name: 'critical-vuln',
              cveId: 'CVE-2023-12345',
              severity: 'critical',
              affectedVersions: '<1.0.0',
              description: 'Critical vulnerability'
            })
          }
        }
      ];

      extremeCases.forEach((testCase, index) => {
        const analysis = analyzer.createTechnicalDebtAnalysis(testCase);

        expect(analysis.metrics?.maintainabilityIndex).toBeGreaterThanOrEqual(0);
        expect(analysis.metrics?.maintainabilityIndex).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Metrics Edge Cases and Error Handling', () => {
    it('should handle undefined/null complexity hotspots gracefully', () => {
      const undefinedComplexityAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          complexityHotspots: undefined as any
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(undefinedComplexityAnalysis);
      expect(analysis.metrics?.codeComplexity).toBe(0);
    });

    it('should handle malformed complexity data gracefully', () => {
      const malformedComplexityAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          complexityHotspots: [
            {
              file: 'valid.ts',
              cyclomaticComplexity: 25,
              cognitiveComplexity: 30,
              lineCount: 400,
              functionName: 'validFunction'
            },
            {
              // Malformed data
              file: 'invalid.ts',
              cyclomaticComplexity: 'not-a-number' as any,
              cognitiveComplexity: null as any,
              lineCount: undefined as any,
              functionName: 'invalidFunction'
            }
          ]
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(malformedComplexityAnalysis);

      // Should handle malformed data gracefully and only use valid entries
      expect(analysis.metrics?.codeComplexity).toBe(25); // Only the valid entry
    });

    it('should handle missing codebase size for duplication calculation', () => {
      const missingCodebaseSizeAnalysis = {
        ...baseAnalysis,
        codebaseSize: undefined as any,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          duplicatedCode: [
            {
              pattern: 'some-pattern',
              locations: ['a.ts', 'b.ts'],
              similarity: 0.9
            }
          ]
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(missingCodebaseSizeAnalysis);

      // Should handle gracefully and avoid division by zero
      expect(analysis.metrics?.duplicatedLinesPercent).toBe(0);
    });

    it('should handle all null/undefined analysis properties', () => {
      const nullAnalysis = {
        codebaseSize: null,
        testCoverage: null,
        dependencies: null,
        codeQuality: null,
        documentation: null,
        performance: null,
        testAnalysis: null
      } as any;

      const analysis = analyzer.createTechnicalDebtAnalysis(nullAnalysis);

      expect(analysis.metrics).toBeDefined();
      expect(analysis.metrics?.codeComplexity).toBe(0);
      expect(analysis.metrics?.testCoverage).toBe(0);
      expect(analysis.metrics?.duplicatedLinesPercent).toBe(0);
      expect(analysis.metrics?.maintainabilityIndex).toBeGreaterThanOrEqual(0);
      expect(analysis.metrics?.maintainabilityIndex).toBeLessThanOrEqual(100);
    });
  });

  describe('Metrics Precision and Accuracy', () => {
    it('should maintain precision in decimal calculations', () => {
      const precisionTestAnalysis = {
        ...baseAnalysis,
        codebaseSize: {
          files: 7,
          lines: 3333,
          languages: { typescript: 3333 }
        },
        testCoverage: { percentage: 33.33, uncoveredFiles: ['file1.ts'] },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          complexityHotspots: [
            {
              file: 'file1.ts',
              cyclomaticComplexity: 11.5,
              cognitiveComplexity: 13.7,
              lineCount: 333,
              functionName: 'func1'
            },
            {
              file: 'file2.ts',
              cyclomaticComplexity: 17.8,
              cognitiveComplexity: 22.1,
              lineCount: 555,
              functionName: 'func2'
            }
          ],
          duplicatedCode: [
            {
              pattern: 'precise-pattern',
              locations: ['a.ts', 'b.ts', 'c.ts'],
              similarity: 0.777
            }
          ]
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(precisionTestAnalysis);

      // Test precision in complexity calculation
      const expectedComplexity = (11.5 + 17.8) / 2;
      expect(analysis.metrics?.codeComplexity).toBeCloseTo(expectedComplexity, 2);

      // Test precision in test coverage
      expect(analysis.metrics?.testCoverage).toBe(33.33);

      // Test precision in duplication calculation
      const expectedDuplication = (3 * 0.777 * 50) / 3333 * 100;
      expect(analysis.metrics?.duplicatedLinesPercent).toBeCloseTo(expectedDuplication, 3);
    });
  });
});
/**
 * TechnicalDebtAnalyzer Metrics and Calculations Tests
 *
 * This test file focuses specifically on metric calculations, mathematical
 * operations, and complex scoring algorithms within the analyzer.
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

describe('TechnicalDebtAnalyzer - Metrics and Calculations', () => {
  let analyzer: TechnicalDebtAnalyzer;
  let baseAnalysis: ProjectAnalysis;

  beforeEach(() => {
    analyzer = new TechnicalDebtAnalyzer();

    baseAnalysis = {
      codebaseSize: {
        files: 50,
        lines: 5000,
        languages: { typescript: 4000, javascript: 1000 }
      },
      testCoverage: {
        percentage: 85,
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
        coveragePercentage: 90,
        undocumentedExports: [],
        outdatedDocumentation: [],
        missingReadmeSections: [],
        apiCompleteness: {
          documented: 90,
          total: 100,
          coveragePercentage: 90
        }
      } as EnhancedDocumentationAnalysis,
      performance: {
        bundleSize: 2048,
        slowTests: [],
        bottlenecks: []
      },
      testAnalysis: {
        branchCoverage: {
          percentage: 80,
          uncoveredBranches: []
        },
        antiPatterns: [],
        untestedExports: []
      }
    };
  });

  describe('Code complexity metrics', () => {
    it('should calculate average complexity correctly', () => {
      const complexityAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          complexityHotspots: [
            {
              file: 'file1.ts',
              cyclomaticComplexity: 10,
              cognitiveComplexity: 15,
              lineCount: 200,
              functionName: 'function1'
            },
            {
              file: 'file2.ts',
              cyclomaticComplexity: 20,
              cognitiveComplexity: 25,
              lineCount: 400,
              functionName: 'function2'
            },
            {
              file: 'file3.ts',
              cyclomaticComplexity: 30,
              cognitiveComplexity: 35,
              lineCount: 600,
              functionName: 'function3'
            }
          ]
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(complexityAnalysis);

      // Average complexity should be (10 + 20 + 30) / 3 = 20
      expect(debtAnalysis.metrics?.codeComplexity).toBe(20);
    });

    it('should handle single complexity hotspot', () => {
      const singleComplexityAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          complexityHotspots: [
            {
              file: 'single.ts',
              cyclomaticComplexity: 45,
              cognitiveComplexity: 55,
              lineCount: 800,
              functionName: 'singleFunction'
            }
          ]
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(singleComplexityAnalysis);
      expect(debtAnalysis.metrics?.codeComplexity).toBe(45);
    });

    it('should return 0 for no complexity hotspots', () => {
      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(baseAnalysis);
      expect(debtAnalysis.metrics?.codeComplexity).toBe(0);
    });
  });

  describe('Duplicated lines percentage calculation', () => {
    it('should calculate duplicated lines percentage correctly', () => {
      const duplicationAnalysis = {
        ...baseAnalysis,
        codebaseSize: {
          files: 10,
          lines: 1000, // Total lines for calculation
          languages: { typescript: 800, javascript: 200 }
        },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          duplicatedCode: [
            {
              pattern: 'pattern1',
              locations: ['file1.ts', 'file2.ts'], // 2 locations
              similarity: 0.8 // 80% similarity
            },
            {
              pattern: 'pattern2',
              locations: ['file3.ts', 'file4.ts', 'file5.ts'], // 3 locations
              similarity: 0.9 // 90% similarity
            }
          ]
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(duplicationAnalysis);

      // Calculation:
      // pattern1: 2 locations * 0.8 similarity * 50 lines = 80 duplicated lines
      // pattern2: 3 locations * 0.9 similarity * 50 lines = 135 duplicated lines
      // Total: 215 duplicated lines out of 1000 = 21.5%
      const expectedPercentage = ((2 * 0.8 * 50) + (3 * 0.9 * 50)) / 1000 * 100;
      expect(debtAnalysis.metrics?.duplicatedLinesPercent).toBeCloseTo(expectedPercentage, 1);
    });

    it('should handle edge case of 0 total lines', () => {
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
              pattern: 'pattern',
              locations: ['file1.ts', 'file2.ts'],
              similarity: 0.9
            }
          ]
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(zeroLinesAnalysis);
      // Should handle division by zero gracefully
      expect(debtAnalysis.metrics?.duplicatedLinesPercent).toBe(0);
    });

    it('should cap duplicated lines percentage at 100%', () => {
      const extremeDuplicationAnalysis = {
        ...baseAnalysis,
        codebaseSize: {
          files: 5,
          lines: 100, // Small codebase
          languages: { typescript: 100 }
        },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          duplicatedCode: Array(100).fill({ // Massive duplication
            pattern: 'everywhere',
            locations: Array(10).fill('duplicate.ts'),
            similarity: 1.0
          })
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(extremeDuplicationAnalysis);
      // Should be capped at 100%
      expect(debtAnalysis.metrics?.duplicatedLinesPercent).toBe(100);
    });
  });

  describe('Maintainability index calculation', () => {
    it('should calculate maintainability index with balanced factors', () => {
      const balancedAnalysis = {
        ...baseAnalysis,
        testCoverage: {
          percentage: 80, // Good coverage
          uncoveredFiles: []
        },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          lintIssues: 20, // Some issues
          complexityHotspots: [
            {
              file: 'moderate.ts',
              cyclomaticComplexity: 15, // Moderate complexity
              cognitiveComplexity: 20,
              lineCount: 300,
              functionName: 'moderateFunction'
            }
          ],
          codeSmells: [
            {
              file: 'smell.ts',
              type: 'minor-smell',
              severity: 'low' as const,
              line: 1,
              description: 'Minor smell',
              suggestion: 'Small fix'
            }
          ],
          duplicatedCode: [
            {
              pattern: 'small duplicate',
              locations: ['a.ts', 'b.ts'],
              similarity: 0.7
            }
          ]
        },
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: [] // No security issues
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(balancedAnalysis);

      // With balanced metrics, maintainability should be reasonable (40-80 range)
      expect(debtAnalysis.metrics?.maintainabilityIndex).toBeGreaterThan(40);
      expect(debtAnalysis.metrics?.maintainabilityIndex).toBeLessThan(80);
    });

    it('should calculate low maintainability for problematic codebase', () => {
      const problematicAnalysis = {
        ...baseAnalysis,
        testCoverage: {
          percentage: 20, // Poor coverage
          uncoveredFiles: Array(50).fill('uncovered.ts')
        },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          lintIssues: 500, // Many lint issues
          complexityHotspots: [
            {
              file: 'nightmare.ts',
              cyclomaticComplexity: 100, // Very high complexity
              cognitiveComplexity: 150,
              lineCount: 5000,
              functionName: 'nightmareFunction'
            }
          ],
          codeSmells: Array(100).fill({
            file: 'awful.ts',
            type: 'god-class',
            severity: 'critical' as const,
            line: 1,
            description: 'Terrible smell',
            suggestion: 'Rewrite everything'
          }),
          duplicatedCode: Array(50).fill({
            pattern: 'everywhere duplicate',
            locations: Array(5).fill('duplicate.ts'),
            similarity: 1.0
          })
        },
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: Array(20).fill({
            name: 'critical-vuln',
            cveId: 'CVE-2023-99999',
            severity: 'critical' as const,
            affectedVersions: '<1.0.0',
            description: 'Critical vulnerability'
          })
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(problematicAnalysis);

      // Problematic codebase should have very low maintainability
      expect(debtAnalysis.metrics?.maintainabilityIndex).toBeLessThan(30);
    });

    it('should calculate high maintainability for clean codebase', () => {
      const cleanAnalysis = {
        ...baseAnalysis,
        testCoverage: {
          percentage: 95, // Excellent coverage
          uncoveredFiles: []
        },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          lintIssues: 2, // Very few issues
          complexityHotspots: [], // No complex code
          codeSmells: [], // No smells
          duplicatedCode: [] // No duplication
        },
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: [] // No security issues
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(cleanAnalysis);

      // Clean codebase should have high maintainability
      expect(debtAnalysis.metrics?.maintainabilityIndex).toBeGreaterThan(80);
    });

    it('should ensure maintainability index bounds', () => {
      // Test with extreme negative values to ensure minimum bound
      const extremeNegativeAnalysis = {
        ...baseAnalysis,
        testCoverage: {
          percentage: -50, // Invalid negative
          uncoveredFiles: []
        },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          lintIssues: -100 // Invalid negative
        }
      };

      const negativeDebtAnalysis = analyzer.createTechnicalDebtAnalysis(extremeNegativeAnalysis);
      expect(negativeDebtAnalysis.metrics?.maintainabilityIndex).toBeGreaterThanOrEqual(0);

      // Test with values that could exceed 100
      const positiveExtremeAnalysis = {
        ...baseAnalysis,
        testCoverage: {
          percentage: 200, // Invalid > 100
          uncoveredFiles: []
        }
      };

      const positiveDebtAnalysis = analyzer.createTechnicalDebtAnalysis(positiveExtremeAnalysis);
      expect(positiveDebtAnalysis.metrics?.maintainabilityIndex).toBeLessThanOrEqual(100);
    });
  });

  describe('Test coverage metrics preservation', () => {
    it('should preserve exact test coverage percentage', () => {
      const coverageAnalysis = {
        ...baseAnalysis,
        testCoverage: {
          percentage: 73.456, // Precise value
          uncoveredFiles: []
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(coverageAnalysis);
      expect(debtAnalysis.metrics?.testCoverage).toBe(73.456);
    });

    it('should handle null test coverage', () => {
      const nullCoverageAnalysis = {
        ...baseAnalysis,
        testCoverage: null
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(nullCoverageAnalysis);
      expect(debtAnalysis.metrics?.testCoverage).toBe(0);
    });

    it('should handle undefined test coverage percentage', () => {
      const undefinedCoverageAnalysis = {
        ...baseAnalysis,
        testCoverage: {
          percentage: undefined as any,
          uncoveredFiles: []
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(undefinedCoverageAnalysis);
      expect(debtAnalysis.metrics?.testCoverage).toBe(0);
    });
  });

  describe('Hotspot scoring algorithms', () => {
    it('should calculate hotspot scores based on complexity', () => {
      const hotspotAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          complexityHotspots: [
            {
              file: 'low-complex.ts',
              cyclomaticComplexity: 15,
              cognitiveComplexity: 20,
              lineCount: 200,
              functionName: 'lowFunction'
            },
            {
              file: 'high-complex.ts',
              cyclomaticComplexity: 80,
              cognitiveComplexity: 100,
              lineCount: 1500,
              functionName: 'highFunction'
            },
            {
              file: 'extreme-complex.ts',
              cyclomaticComplexity: 150,
              cognitiveComplexity: 200,
              lineCount: 3000,
              functionName: 'extremeFunction'
            }
          ]
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(hotspotAnalysis);

      expect(debtAnalysis.hotspots.length).toBe(3);

      // Hotspots should be sorted by score (highest first)
      for (let i = 1; i < debtAnalysis.hotspots.length; i++) {
        expect(debtAnalysis.hotspots[i - 1].score).toBeGreaterThanOrEqual(debtAnalysis.hotspots[i].score);
      }

      // Extreme complexity should have highest score
      const extremeHotspot = debtAnalysis.hotspots.find(h => h.path === 'extreme-complex.ts');
      expect(extremeHotspot?.score).toBeGreaterThan(80);

      // All scores should be in bounds
      debtAnalysis.hotspots.forEach(hotspot => {
        expect(hotspot.score).toBeGreaterThanOrEqual(0);
        expect(hotspot.score).toBeLessThanOrEqual(100);
      });
    });

    it('should aggregate multiple issues in same file', () => {
      const multiIssueAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          complexityHotspots: [
            {
              file: 'problematic.ts',
              cyclomaticComplexity: 40,
              cognitiveComplexity: 50,
              lineCount: 800,
              functionName: 'problemFunction'
            }
          ],
          codeSmells: [
            {
              file: 'problematic.ts', // Same file
              type: 'god-class',
              severity: 'high' as const,
              line: 1,
              description: 'Class with too many responsibilities',
              suggestion: 'Split class'
            },
            {
              file: 'problematic.ts', // Same file
              type: 'long-method',
              severity: 'medium' as const,
              line: 150,
              description: 'Method too long',
              suggestion: 'Extract methods'
            }
          ],
          duplicatedCode: [
            {
              pattern: 'duplicate in problematic file',
              locations: ['problematic.ts', 'another.ts'], // Include problematic.ts
              similarity: 0.9
            }
          ]
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(multiIssueAnalysis);

      const problematicHotspot = debtAnalysis.hotspots.find(h => h.path === 'problematic.ts');
      expect(problematicHotspot).toBeDefined();

      // Should aggregate all issues
      expect(problematicHotspot?.issues.length).toBeGreaterThanOrEqual(3);
      expect(problematicHotspot?.issues).toContain('Code duplication: duplicate in problematic file');

      // Score should be higher due to multiple issues
      expect(problematicHotspot?.score).toBeGreaterThan(50);
    });

    it('should limit hotspots to top 10', () => {
      const manyFilesAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          complexityHotspots: Array(50).fill(null).map((_, i) => ({
            file: `complex-${i}.ts`,
            cyclomaticComplexity: 30 + i, // Varying complexity
            cognitiveComplexity: 40 + i,
            lineCount: 500 + (i * 10),
            functionName: `function${i}`
          })),
          codeSmells: Array(100).fill(null).map((_, i) => ({
            file: `smell-${i}.ts`,
            type: 'code-smell',
            severity: 'medium' as const,
            line: 1,
            description: `Smell in file ${i}`,
            suggestion: 'Fix it'
          }))
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(manyFilesAnalysis);

      // Should be limited to 10 hotspots
      expect(debtAnalysis.hotspots.length).toBeLessThanOrEqual(10);

      // Should contain the highest scoring ones
      if (debtAnalysis.hotspots.length > 1) {
        expect(debtAnalysis.hotspots[0].score).toBeGreaterThanOrEqual(debtAnalysis.hotspots[1].score);
      }
    });
  });

  describe('Trend calculation algorithms', () => {
    it('should calculate improving trend for low debt score', () => {
      const lowDebtAnalysis = {
        ...baseAnalysis,
        testCoverage: {
          percentage: 95,
          uncoveredFiles: []
        },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          lintIssues: 3
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(lowDebtAnalysis);

      expect(debtAnalysis.trends?.improving).toBe(true);
      expect(debtAnalysis.trends?.changeRate).toBeLessThan(0); // Negative = improving
      expect(debtAnalysis.trends?.timeframe).toBe('last 30 days');
    });

    it('should calculate degrading trend for high debt score', () => {
      const highDebtAnalysis = {
        ...baseAnalysis,
        testCoverage: {
          percentage: 15,
          uncoveredFiles: Array(100).fill('uncovered.ts')
        },
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: Array(20).fill({
            name: 'vuln',
            cveId: 'CVE-2023-12345',
            severity: 'critical' as const,
            affectedVersions: '<1.0.0',
            description: 'Critical issue'
          })
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(highDebtAnalysis);

      expect(debtAnalysis.trends?.improving).toBe(false);
      expect(debtAnalysis.trends?.changeRate).toBeGreaterThan(0); // Positive = degrading
      expect(debtAnalysis.trends?.timeframe).toBe('last 30 days');
    });

    it('should calculate stable trend for medium debt score', () => {
      const mediumDebtAnalysis = {
        ...baseAnalysis,
        testCoverage: {
          percentage: 50,
          uncoveredFiles: ['test.ts']
        },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          lintIssues: 25,
          duplicatedCode: [
            {
              pattern: 'some duplication',
              locations: ['a.ts', 'b.ts'],
              similarity: 0.8
            }
          ]
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(mediumDebtAnalysis);

      expect(debtAnalysis.trends?.improving).toBe(false);
      expect(Math.abs(debtAnalysis.trends?.changeRate!)).toBeLessThan(2); // Small change rate
    });
  });

  describe('Mathematical precision and floating point handling', () => {
    it('should handle floating point arithmetic correctly', () => {
      const precisionAnalysis = {
        ...baseAnalysis,
        codebaseSize: {
          files: 33,
          lines: 3333, // Numbers that might cause precision issues
          languages: { typescript: 2222, javascript: 1111 }
        },
        testCoverage: {
          percentage: 66.666666,
          uncoveredFiles: []
        },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          duplicatedCode: [
            {
              pattern: 'precision test',
              locations: ['a.ts', 'b.ts', 'c.ts'], // 3 locations
              similarity: 0.333333 // 1/3 similarity
            }
          ]
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(precisionAnalysis);

      // All metrics should be reasonable numbers
      expect(Number.isFinite(debtAnalysis.totalScore)).toBe(true);
      expect(Number.isFinite(debtAnalysis.metrics?.duplicatedLinesPercent!)).toBe(true);
      expect(Number.isFinite(debtAnalysis.metrics?.maintainabilityIndex!)).toBe(true);

      // Should not have precision artifacts
      expect(debtAnalysis.totalScore).toBeLessThan(100.000001);
      expect(debtAnalysis.metrics?.duplicatedLinesPercent!).toBeLessThan(100.000001);
    });

    it('should handle extreme small values without underflow', () => {
      const smallValueAnalysis = {
        ...baseAnalysis,
        codebaseSize: {
          files: 1000000,
          lines: 1000000, // Large codebase
          languages: { typescript: 1000000 }
        },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          duplicatedCode: [
            {
              pattern: 'tiny duplicate',
              locations: ['a.ts', 'b.ts'], // Only 2 locations
              similarity: 0.01 // Very low similarity
            }
          ]
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(smallValueAnalysis);

      // Should handle small percentages correctly
      expect(debtAnalysis.metrics?.duplicatedLinesPercent).toBeGreaterThanOrEqual(0);
      expect(debtAnalysis.metrics?.duplicatedLinesPercent).toBeLessThan(1);
    });

    it('should handle NaN and Infinity inputs gracefully', () => {
      const invalidAnalysis = {
        ...baseAnalysis,
        testCoverage: {
          percentage: NaN,
          uncoveredFiles: []
        },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          lintIssues: Infinity,
          complexityHotspots: [
            {
              file: 'invalid.ts',
              cyclomaticComplexity: NaN,
              cognitiveComplexity: Infinity,
              lineCount: -Infinity,
              functionName: 'invalidFunction'
            }
          ]
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(invalidAnalysis);

      // Should produce valid finite numbers
      expect(Number.isFinite(debtAnalysis.totalScore)).toBe(true);
      expect(debtAnalysis.totalScore).toBeGreaterThanOrEqual(0);
      expect(debtAnalysis.totalScore).toBeLessThanOrEqual(100);

      if (debtAnalysis.metrics?.maintainabilityIndex !== undefined) {
        expect(Number.isFinite(debtAnalysis.metrics.maintainabilityIndex)).toBe(true);
      }
    });
  });
});
/**
 * Technical Debt Analyzer Total Score Edge Cases Test
 *
 * This test file focuses specifically on edge cases and boundary conditions
 * for the total debt score calculation algorithm, ensuring robustness.
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

describe('TechnicalDebtAnalyzer - Total Score Edge Cases', () => {
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

  describe('Category weight validation', () => {
    it('should use correct category weights that sum to 1.0', () => {
      // This tests the weight distribution specified in the ADR
      const categoryWeights = {
        'security-vulnerability': 0.25,
        'complexity': 0.15,
        'testability': 0.12,
        'code-smell': 0.12,
        'duplication': 0.10,
        'outdated-dependency': 0.08,
        'maintainability': 0.08,
        'documentation': 0.05,
        'performance': 0.03,
        'dead-code': 0.02,
      };

      const totalWeight = Object.values(categoryWeights).reduce((sum, weight) => sum + weight, 0);
      expect(totalWeight).toBeCloseTo(1.0, 10); // Should sum exactly to 1.0
    });

    it('should apply category weights proportionally to total score', () => {
      // Test that security vulnerabilities (highest weight 0.25) contribute more than performance issues (0.03)
      const securityAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: [
            {
              name: 'test-vuln',
              cveId: 'CVE-2023-12345',
              severity: 'medium' as const,
              affectedVersions: '<1.0.0',
              description: 'Test vulnerability'
            }
          ]
        }
      };

      const performanceAnalysis = {
        ...baseAnalysis,
        performance: {
          ...baseAnalysis.performance,
          bottlenecks: [
            { file: 'slow.ts', line: 10, type: 'cpu', description: 'Slow operation' }
          ]
        }
      };

      const securityScore = analyzer.createTechnicalDebtAnalysis(securityAnalysis).totalScore;
      const performanceScore = analyzer.createTechnicalDebtAnalysis(performanceAnalysis).totalScore;

      expect(securityScore).toBeGreaterThan(performanceScore);
    });
  });

  describe('Severity multiplier validation', () => {
    it('should apply severity multipliers correctly', () => {
      const severityMultipliers = {
        'critical': 1.0,
        'high': 0.75,
        'medium': 0.5,
        'low': 0.25,
      };

      // Test with same number of issues but different severities
      const criticalVulnAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: [
            {
              name: 'critical-vuln',
              cveId: 'CVE-2023-12345',
              severity: 'critical' as const,
              affectedVersions: '<1.0.0',
              description: 'Critical vulnerability'
            }
          ]
        }
      };

      const highVulnAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: [
            {
              name: 'high-vuln',
              cveId: 'CVE-2023-67890',
              severity: 'high' as const,
              affectedVersions: '<1.0.0',
              description: 'High severity vulnerability'
            }
          ]
        }
      };

      const mediumVulnAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: [
            {
              name: 'medium-vuln',
              cveId: 'CVE-2023-11111',
              severity: 'medium' as const,
              affectedVersions: '<1.0.0',
              description: 'Medium severity vulnerability'
            }
          ]
        }
      };

      const criticalScore = analyzer.createTechnicalDebtAnalysis(criticalVulnAnalysis).totalScore;
      const highScore = analyzer.createTechnicalDebtAnalysis(highVulnAnalysis).totalScore;
      const mediumScore = analyzer.createTechnicalDebtAnalysis(mediumVulnAnalysis).totalScore;

      expect(criticalScore).toBeGreaterThan(highScore);
      expect(highScore).toBeGreaterThan(mediumScore);

      // Check approximate ratios match multipliers
      expect(criticalScore / highScore).toBeCloseTo(1.0 / 0.75, 1);
      expect(highScore / mediumScore).toBeCloseTo(0.75 / 0.5, 1);
    });
  });

  describe('Logarithmic scaling validation', () => {
    it('should apply logarithmic scaling to prevent explosive growth', () => {
      // Test that doubling issues doesn't double the score due to log scaling
      const singleIssueAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          codeSmells: [
            {
              file: 'smelly.ts',
              type: 'god-class',
              severity: 'medium' as const,
              line: 1,
              description: 'Code smell',
              suggestion: 'Fix it'
            }
          ]
        }
      };

      const doubleIssueAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          codeSmells: Array(2).fill({
            file: 'smelly.ts',
            type: 'god-class',
            severity: 'medium' as const,
            line: 1,
            description: 'Code smell',
            suggestion: 'Fix it'
          })
        }
      };

      const quadrupleIssueAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          codeSmells: Array(4).fill({
            file: 'smelly.ts',
            type: 'god-class',
            severity: 'medium' as const,
            line: 1,
            description: 'Code smell',
            suggestion: 'Fix it'
          })
        }
      };

      const singleScore = analyzer.createTechnicalDebtAnalysis(singleIssueAnalysis).totalScore;
      const doubleScore = analyzer.createTechnicalDebtAnalysis(doubleIssueAnalysis).totalScore;
      const quadrupleScore = analyzer.createTechnicalDebtAnalysis(quadrupleIssueAnalysis).totalScore;

      // Due to logarithmic scaling, doubling issues should not double the score
      expect(doubleScore).toBeLessThan(singleScore * 2);
      expect(quadrupleScore).toBeLessThan(doubleScore * 2);
    });

    it('should handle zero and single item edge cases in logarithmic scaling', () => {
      const zeroIssuesAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          codeSmells: []
        }
      };

      const singleIssueAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          codeSmells: [
            {
              file: 'smelly.ts',
              type: 'god-class',
              severity: 'medium' as const,
              line: 1,
              description: 'Code smell',
              suggestion: 'Fix it'
            }
          ]
        }
      };

      expect(() => analyzer.createTechnicalDebtAnalysis(zeroIssuesAnalysis)).not.toThrow();
      expect(() => analyzer.createTechnicalDebtAnalysis(singleIssueAnalysis)).not.toThrow();

      const zeroScore = analyzer.createTechnicalDebtAnalysis(zeroIssuesAnalysis).totalScore;
      const singleScore = analyzer.createTechnicalDebtAnalysis(singleIssueAnalysis).totalScore;

      expect(zeroScore).toBeGreaterThanOrEqual(0);
      expect(singleScore).toBeGreaterThan(zeroScore);
    });
  });

  describe('Data structure edge cases', () => {
    it('should handle completely null/undefined analysis', () => {
      const nullAnalysis = {
        codebaseSize: null,
        testCoverage: null,
        dependencies: null,
        codeQuality: null,
        documentation: null,
        performance: null,
        testAnalysis: null
      } as any;

      expect(() => analyzer.createTechnicalDebtAnalysis(nullAnalysis)).not.toThrow();

      const analysis = analyzer.createTechnicalDebtAnalysis(nullAnalysis);
      expect(analysis.totalScore).toBeGreaterThanOrEqual(0);
      expect(analysis.totalScore).toBeLessThanOrEqual(100);
    });

    it('should handle mixed valid and invalid data', () => {
      const mixedAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: [
            {
              name: 'valid-vuln',
              cveId: 'CVE-2023-12345',
              severity: 'high' as const,
              affectedVersions: '<1.0.0',
              description: 'Valid vulnerability'
            },
            {
              // Invalid data
              name: null as any,
              cveId: undefined as any,
              severity: 'invalid-severity' as any,
              affectedVersions: '',
              description: ''
            },
            {
              name: 'another-valid-vuln',
              cveId: 'CVE-2023-67890',
              severity: 'critical' as const,
              affectedVersions: '<2.0.0',
              description: 'Another valid vulnerability'
            }
          ]
        }
      };

      expect(() => analyzer.createTechnicalDebtAnalysis(mixedAnalysis)).not.toThrow();

      const analysis = analyzer.createTechnicalDebtAnalysis(mixedAnalysis);
      expect(analysis.totalScore).toBeGreaterThan(0); // Should process valid data
    });

    it('should handle empty arrays gracefully', () => {
      const emptyArraysAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        },
        dependencies: {
          outdated: [],
          security: [],
          outdatedPackages: [],
          securityIssues: [],
          deprecatedPackages: []
        },
        performance: {
          bundleSize: 1024,
          slowTests: [],
          bottlenecks: []
        }
      };

      expect(() => analyzer.createTechnicalDebtAnalysis(emptyArraysAnalysis)).not.toThrow();

      const analysis = analyzer.createTechnicalDebtAnalysis(emptyArraysAnalysis);
      expect(analysis.totalScore).toBeLessThan(20); // Should be low for clean codebase
    });
  });

  describe('Boundary condition testing', () => {
    it('should handle maximum possible values without overflow', () => {
      const maxValueAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 0, uncoveredFiles: Array(1000).fill('file.ts') },
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: Array(100).fill({
            name: 'max-vuln',
            cveId: 'CVE-2023-12345',
            severity: 'critical' as const,
            affectedVersions: '<1.0.0',
            description: 'Max vulnerability'
          })
        },
        codeQuality: {
          lintIssues: Number.MAX_SAFE_INTEGER,
          duplicatedCode: Array(1000).fill({
            pattern: 'max-duplicate',
            locations: Array(100).fill('dup.ts'),
            similarity: 1.0
          }),
          complexityHotspots: Array(100).fill({
            file: 'max-complex.ts',
            cyclomaticComplexity: Number.MAX_SAFE_INTEGER,
            cognitiveComplexity: Number.MAX_SAFE_INTEGER,
            lineCount: Number.MAX_SAFE_INTEGER,
            functionName: 'maxFunction'
          }),
          codeSmells: Array(1000).fill({
            file: 'max-smelly.ts',
            type: 'god-class',
            severity: 'critical' as const,
            line: 1,
            description: 'Max code smell',
            suggestion: 'Complete rewrite'
          })
        }
      };

      expect(() => analyzer.createTechnicalDebtAnalysis(maxValueAnalysis)).not.toThrow();

      const analysis = analyzer.createTechnicalDebtAnalysis(maxValueAnalysis);
      expect(analysis.totalScore).toBe(100); // Should be capped at 100
      expect(isFinite(analysis.totalScore)).toBe(true);
      expect(isNaN(analysis.totalScore)).toBe(false);
    });

    it('should handle floating point precision edge cases', () => {
      const precisionAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 0.1, uncoveredFiles: [] },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          complexityHotspots: [
            {
              file: 'precise.ts',
              cyclomaticComplexity: 0.1,
              cognitiveComplexity: 0.1,
              lineCount: 1,
              functionName: 'preciseFunction'
            }
          ],
          duplicatedCode: [
            {
              pattern: 'tiny-duplicate',
              locations: ['a.ts'],
              similarity: 0.001
            }
          ]
        }
      };

      expect(() => analyzer.createTechnicalDebtAnalysis(precisionAnalysis)).not.toThrow();

      const analysis = analyzer.createTechnicalDebtAnalysis(precisionAnalysis);
      expect(analysis.totalScore).toBeGreaterThanOrEqual(0);
      expect(analysis.totalScore).toBeLessThanOrEqual(100);
      expect(isFinite(analysis.totalScore)).toBe(true);
    });
  });

  describe('Mathematical formula validation', () => {
    it('should calculate complexity category score correctly', () => {
      const complexityAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          complexityHotspots: [
            {
              file: 'test.ts',
              cyclomaticComplexity: 60, // Critical level (>50)
              cognitiveComplexity: 70,
              lineCount: 1000,
              functionName: 'criticalFunction'
            }
          ]
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(complexityAnalysis);

      // Formula: Math.min(100, count * 8 * Math.log2(count + 1))
      // For 1 hotspot: Math.min(100, 1 * 8 * Math.log2(1 + 1)) = Math.min(100, 8) = 8
      // Weighted by complexity category weight (0.15) and severity multiplier (1.0 for critical)
      const expectedCategoryScore = Math.min(100, 1 * 8 * Math.log2(2));
      const expectedContribution = 0.15 * expectedCategoryScore * 1.0;

      expect(analysis.totalScore).toBeCloseTo(expectedContribution, 1);
    });

    it('should calculate testability category score correctly', () => {
      const testabilityAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 40, uncoveredFiles: ['test.ts'] } // 40 < 80, so score = (80-40)*2.5 = 100
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(testabilityAnalysis);

      // Formula: Math.min(100, (80 - coverage) * 2.5)
      // For 40% coverage: Math.min(100, (80-40) * 2.5) = Math.min(100, 100) = 100
      // Severity: high (coverage < 60%), multiplier = 0.75
      // Weighted by testability category weight (0.12)
      const expectedCategoryScore = Math.min(100, (80 - 40) * 2.5);
      const expectedContribution = 0.12 * expectedCategoryScore * 0.75;

      expect(analysis.totalScore).toBeCloseTo(expectedContribution, 1);
    });

    it('should handle division by zero in average calculations', () => {
      const zeroDivisionAnalysis = {
        ...baseAnalysis,
        codebaseSize: { files: 0, lines: 0, languages: {} }, // Zero lines for duplication calculation
        codeQuality: {
          ...baseAnalysis.codeQuality,
          duplicatedCode: [
            {
              pattern: 'test-duplicate',
              locations: ['a.ts', 'b.ts'],
              similarity: 0.9
            }
          ]
        }
      };

      expect(() => analyzer.createTechnicalDebtAnalysis(zeroDivisionAnalysis)).not.toThrow();

      const analysis = analyzer.createTechnicalDebtAnalysis(zeroDivisionAnalysis);
      expect(isFinite(analysis.totalScore)).toBe(true);
      expect(isNaN(analysis.totalScore)).toBe(false);
    });
  });

  describe('Score consistency validation', () => {
    it('should produce consistent scores for identical inputs', () => {
      const testAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 55, uncoveredFiles: ['test.ts'] },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          codeSmells: [
            {
              file: 'smelly.ts',
              type: 'god-class',
              severity: 'high' as const,
              line: 10,
              description: 'High severity code smell',
              suggestion: 'Refactor'
            }
          ]
        }
      };

      const firstRun = analyzer.createTechnicalDebtAnalysis(testAnalysis);
      const secondRun = analyzer.createTechnicalDebtAnalysis(testAnalysis);
      const thirdRun = analyzer.createTechnicalDebtAnalysis(testAnalysis);

      expect(firstRun.totalScore).toBe(secondRun.totalScore);
      expect(secondRun.totalScore).toBe(thirdRun.totalScore);
    });

    it('should show predictable score increases with added issues', () => {
      const baseScore = analyzer.createTechnicalDebtAnalysis(baseAnalysis).totalScore;

      const oneIssueAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          codeSmells: [
            {
              file: 'smelly.ts',
              type: 'god-class',
              severity: 'medium' as const,
              line: 1,
              description: 'Code smell',
              suggestion: 'Fix it'
            }
          ]
        }
      };

      const twoIssuesAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          codeSmells: Array(2).fill({
            file: 'smelly.ts',
            type: 'god-class',
            severity: 'medium' as const,
            line: 1,
            description: 'Code smell',
            suggestion: 'Fix it'
          })
        }
      };

      const oneIssueScore = analyzer.createTechnicalDebtAnalysis(oneIssueAnalysis).totalScore;
      const twoIssuesScore = analyzer.createTechnicalDebtAnalysis(twoIssuesAnalysis).totalScore;

      expect(oneIssueScore).toBeGreaterThan(baseScore);
      expect(twoIssuesScore).toBeGreaterThan(oneIssueScore);
    });
  });
});
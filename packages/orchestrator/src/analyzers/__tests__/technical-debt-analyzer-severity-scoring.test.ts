/**
 * TechnicalDebtAnalyzer Severity Scoring Tests
 *
 * This test file focuses specifically on severity calculation, score validation,
 * and priority assignment to ensure the scoring algorithm works correctly.
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

describe('TechnicalDebtAnalyzer - Severity Scoring', () => {
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

  describe('Total debt score calculation', () => {
    it('should calculate 0 score for pristine codebase', () => {
      const analysis = analyzer.createTechnicalDebtAnalysis(baseAnalysis);
      expect(analysis.totalScore).toBeLessThan(5); // Should be very low
    });

    it('should calculate appropriate score ranges for different debt levels', () => {
      // Low debt scenario
      const lowDebtAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 75, uncoveredFiles: ['file1.ts'] },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          lintIssues: 15
        }
      };

      const lowDebtScore = analyzer.createTechnicalDebtAnalysis(lowDebtAnalysis).totalScore;
      expect(lowDebtScore).toBeGreaterThan(0);
      expect(lowDebtScore).toBeLessThan(30);

      // Medium debt scenario
      const mediumDebtAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 50, uncoveredFiles: ['file1.ts', 'file2.ts'] },
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: [
            {
              name: 'medium-vuln',
              cveId: 'CVE-2023-12345',
              severity: 'medium' as const,
              affectedVersions: '<2.0.0',
              description: 'Medium security issue'
            }
          ]
        },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          lintIssues: 50,
          complexityHotspots: [
            {
              file: 'complex.ts',
              cyclomaticComplexity: 25,
              cognitiveComplexity: 30,
              lineCount: 400,
              functionName: 'mediumFunction'
            }
          ]
        }
      };

      const mediumDebtScore = analyzer.createTechnicalDebtAnalysis(mediumDebtAnalysis).totalScore;
      expect(mediumDebtScore).toBeGreaterThanOrEqual(30);
      expect(mediumDebtScore).toBeLessThan(70);

      // High debt scenario
      const highDebtAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 20, uncoveredFiles: Array(10).fill('uncovered.ts') },
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: [
            {
              name: 'critical-vuln',
              cveId: 'CVE-2023-67890',
              severity: 'critical' as const,
              affectedVersions: '<1.0.0',
              description: 'Critical security vulnerability'
            }
          ]
        },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          lintIssues: 200,
          complexityHotspots: [
            {
              file: 'very-complex.ts',
              cyclomaticComplexity: 80,
              cognitiveComplexity: 100,
              lineCount: 2000,
              functionName: 'veryComplexFunction'
            }
          ],
          codeSmells: Array(50).fill({
            file: 'smelly.ts',
            type: 'god-class',
            severity: 'critical' as const,
            line: 1,
            description: 'Critical code smell',
            suggestion: 'Refactor'
          })
        }
      };

      const highDebtScore = analyzer.createTechnicalDebtAnalysis(highDebtAnalysis).totalScore;
      expect(highDebtScore).toBeGreaterThanOrEqual(70);
      expect(highDebtScore).toBeLessThanOrEqual(100);

      // Verify ordering
      expect(lowDebtScore).toBeLessThan(mediumDebtScore);
      expect(mediumDebtScore).toBeLessThan(highDebtScore);
    });

    it('should cap total score at 100 even with extreme debt', () => {
      const extremeDebtAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 0, uncoveredFiles: Array(100).fill('uncovered.ts') },
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: Array(50).fill({
            name: 'critical-vuln',
            cveId: 'CVE-2023-12345',
            severity: 'critical' as const,
            affectedVersions: '<1.0.0',
            description: 'Critical vulnerability'
          })
        },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          lintIssues: 1000,
          complexityHotspots: Array(100).fill({
            file: 'extreme.ts',
            cyclomaticComplexity: 200,
            cognitiveComplexity: 300,
            lineCount: 10000,
            functionName: 'extremeFunction'
          }),
          codeSmells: Array(200).fill({
            file: 'awful.ts',
            type: 'god-class',
            severity: 'critical' as const,
            line: 1,
            description: 'Extreme code smell',
            suggestion: 'Complete rewrite'
          }),
          duplicatedCode: Array(100).fill({
            pattern: 'exact duplicate',
            locations: Array(10).fill('duplicate.ts'),
            similarity: 1.0
          })
        }
      };

      const extremeScore = analyzer.createTechnicalDebtAnalysis(extremeDebtAnalysis).totalScore;
      expect(extremeScore).toBe(100);
    });

    it('should weight categories according to severity multipliers', () => {
      // Test that critical issues get higher weight than high issues
      const criticalSecurityAnalysis = {
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

      const highSecurityAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: [
            {
              name: 'high-vuln',
              cveId: 'CVE-2023-67890',
              severity: 'high' as const,
              affectedVersions: '<2.0.0',
              description: 'High severity vulnerability'
            }
          ]
        }
      };

      const criticalScore = analyzer.createTechnicalDebtAnalysis(criticalSecurityAnalysis).totalScore;
      const highScore = analyzer.createTechnicalDebtAnalysis(highSecurityAnalysis).totalScore;

      expect(criticalScore).toBeGreaterThan(highScore);
    });
  });

  describe('Category severity assignment', () => {
    it('should assign correct severity levels for complexity hotspots', () => {
      const analysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          complexityHotspots: [
            {
              file: 'critical-complex.ts',
              cyclomaticComplexity: 75, // Critical level
              cognitiveComplexity: 90,
              lineCount: 1500,
              functionName: 'criticalFunction'
            },
            {
              file: 'high-complex.ts',
              cyclomaticComplexity: 35, // High level
              cognitiveComplexity: 45,
              lineCount: 600,
              functionName: 'highFunction'
            },
            {
              file: 'medium-complex.ts',
              cyclomaticComplexity: 20, // Medium level
              cognitiveComplexity: 25,
              lineCount: 300,
              functionName: 'mediumFunction'
            }
          ]
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(analysis);
      const complexityCategory = debtAnalysis.categories.find(c => c.category === 'complexity');

      expect(complexityCategory).toBeDefined();
      expect(complexityCategory?.severity).toBe('critical'); // Should be critical due to 75+ complexity
      expect(complexityCategory?.count).toBe(3);
    });

    it('should assign correct severity levels for test coverage', () => {
      // Critical coverage (< 20%)
      const criticalCoverageAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 15, uncoveredFiles: Array(20).fill('uncovered.ts') }
      };

      const criticalDebtAnalysis = analyzer.createTechnicalDebtAnalysis(criticalCoverageAnalysis);
      const criticalCategory = criticalDebtAnalysis.categories.find(c => c.category === 'testability');
      expect(criticalCategory?.severity).toBe('high'); // High for coverage < 60%

      // High coverage (20-40%)
      const highCoverageAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 35, uncoveredFiles: Array(10).fill('uncovered.ts') }
      };

      const highDebtAnalysis = analyzer.createTechnicalDebtAnalysis(highCoverageAnalysis);
      const highCategory = highDebtAnalysis.categories.find(c => c.category === 'testability');
      expect(highCategory?.severity).toBe('high');

      // Medium coverage (60-70%)
      const mediumCoverageAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 65, uncoveredFiles: ['file1.ts'] }
      };

      const mediumDebtAnalysis = analyzer.createTechnicalDebtAnalysis(mediumCoverageAnalysis);
      const mediumCategory = mediumDebtAnalysis.categories.find(c => c.category === 'testability');
      expect(mediumCategory?.severity).toBe('medium');
    });

    it('should assign correct severity levels for code duplication', () => {
      // High duplication (> 10 patterns)
      const highDuplicationAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          duplicatedCode: Array(15).fill({
            pattern: 'duplicate pattern',
            locations: ['a.ts', 'b.ts', 'c.ts'],
            similarity: 0.9
          })
        }
      };

      const highDuplication = analyzer.createTechnicalDebtAnalysis(highDuplicationAnalysis);
      const highCategory = highDuplication.categories.find(c => c.category === 'duplication');
      expect(highCategory?.severity).toBe('high');

      // Medium duplication (5-10 patterns)
      const mediumDuplicationAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          duplicatedCode: Array(7).fill({
            pattern: 'duplicate pattern',
            locations: ['a.ts', 'b.ts'],
            similarity: 0.85
          })
        }
      };

      const mediumDuplication = analyzer.createTechnicalDebtAnalysis(mediumDuplicationAnalysis);
      const mediumCategory = mediumDuplication.categories.find(c => c.category === 'duplication');
      expect(mediumCategory?.severity).toBe('medium');

      // Low duplication (< 5 patterns)
      const lowDuplicationAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          duplicatedCode: Array(3).fill({
            pattern: 'duplicate pattern',
            locations: ['a.ts', 'b.ts'],
            similarity: 0.8
          })
        }
      };

      const lowDuplication = analyzer.createTechnicalDebtAnalysis(lowDuplicationAnalysis);
      const lowCategory = lowDuplication.categories.find(c => c.category === 'duplication');
      expect(lowCategory?.severity).toBe('low');
    });
  });

  describe('Priority assignment in task candidates', () => {
    it('should assign critical priority to critical security vulnerabilities', () => {
      const securityAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: [
            {
              name: 'critical-vuln',
              cveId: 'CVE-2023-12345',
              severity: 'critical' as const,
              affectedVersions: '<1.0.0',
              description: 'Critical security vulnerability'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(securityAnalysis);
      const securityCandidate = candidates.find(c => c.candidateId.includes('security'));

      expect(securityCandidate).toBeDefined();
      expect(securityCandidate?.priority).toBe('critical');
    });

    it('should assign high priority to low test coverage', () => {
      const lowCoverageAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 40, uncoveredFiles: ['test1.ts', 'test2.ts'] }
      };

      const candidates = analyzer.analyze(lowCoverageAnalysis);
      const coverageCandidate = candidates.find(c => c.candidateId.includes('test-coverage'));

      expect(coverageCandidate).toBeDefined();
      expect(coverageCandidate?.priority).toBe('high');
    });

    it('should assign appropriate priorities based on effort and impact', () => {
      const mixedAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 30, uncoveredFiles: ['test.ts'] }, // High priority
        dependencies: {
          ...baseAnalysis.dependencies,
          outdatedPackages: [
            {
              name: 'minor-update',
              currentVersion: '1.0.0',
              latestVersion: '1.1.0',
              updateType: 'minor' as const
            }
          ]
        }, // Low priority
        codeQuality: {
          ...baseAnalysis.codeQuality,
          complexityHotspots: [
            {
              file: 'complex.ts',
              cyclomaticComplexity: 35, // High complexity -> Normal priority
              cognitiveComplexity: 42,
              lineCount: 500,
              functionName: 'complexFunction'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(mixedAnalysis);

      const testCandidate = candidates.find(c => c.candidateId.includes('test-coverage'));
      const outdatedCandidate = candidates.find(c => c.candidateId.includes('outdated-dependencies'));
      const complexityCandidate = candidates.find(c => c.candidateId.includes('high-complexity'));

      expect(testCandidate?.priority).toBe('high');
      expect(outdatedCandidate?.priority).toBe('low');
      expect(complexityCandidate?.priority).toBe('normal');
    });
  });

  describe('Score normalization and bounds', () => {
    it('should ensure all candidate scores are between 0 and 1', () => {
      const mixedAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 10, uncoveredFiles: Array(50).fill('uncovered.ts') },
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: Array(10).fill({
            name: 'vuln',
            cveId: 'CVE-2023-12345',
            severity: 'critical' as const,
            affectedVersions: '<1.0.0',
            description: 'Vulnerability'
          }),
          deprecatedPackages: Array(20).fill({
            name: 'deprecated',
            currentVersion: '1.0.0',
            reason: 'Deprecated',
            replacement: 'new-package'
          })
        },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          lintIssues: 500,
          duplicatedCode: Array(50).fill({
            pattern: 'duplicate',
            locations: ['a.ts', 'b.ts'],
            similarity: 0.9
          }),
          complexityHotspots: Array(20).fill({
            file: 'complex.ts',
            cyclomaticComplexity: 100,
            cognitiveComplexity: 150,
            lineCount: 2000,
            functionName: 'complexFunction'
          })
        }
      };

      const candidates = analyzer.analyze(mixedAnalysis);

      candidates.forEach(candidate => {
        expect(candidate.score).toBeGreaterThanOrEqual(0);
        expect(candidate.score).toBeLessThanOrEqual(1);
      });
    });

    it('should ensure total debt score bounds are respected', () => {
      // Test minimum bound
      const cleanAnalysis = analyzer.createTechnicalDebtAnalysis(baseAnalysis);
      expect(cleanAnalysis.totalScore).toBeGreaterThanOrEqual(0);
      expect(cleanAnalysis.totalScore).toBeLessThanOrEqual(100);

      // Test maximum bound with extreme scenario
      const extremeAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 0, uncoveredFiles: Array(1000).fill('file.ts') },
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: Array(1000).fill({
            name: 'vuln',
            cveId: 'CVE-2023-12345',
            severity: 'critical' as const,
            affectedVersions: '<1.0.0',
            description: 'Critical vulnerability'
          })
        }
      };

      const extremeDebt = analyzer.createTechnicalDebtAnalysis(extremeAnalysis);
      expect(extremeDebt.totalScore).toBe(100); // Should be capped at 100
    });

    it('should ensure metrics are within expected bounds', () => {
      const analysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 45, uncoveredFiles: ['test.ts'] },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          complexityHotspots: [
            {
              file: 'complex1.ts',
              cyclomaticComplexity: 30,
              cognitiveComplexity: 35,
              lineCount: 400,
              functionName: 'function1'
            },
            {
              file: 'complex2.ts',
              cyclomaticComplexity: 50,
              cognitiveComplexity: 60,
              lineCount: 800,
              functionName: 'function2'
            }
          ]
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(analysis);

      if (debtAnalysis.metrics) {
        // Test coverage should be preserved
        expect(debtAnalysis.metrics.testCoverage).toBe(45);

        // Code complexity should be reasonable
        expect(debtAnalysis.metrics.codeComplexity).toBeGreaterThanOrEqual(0);
        expect(debtAnalysis.metrics.codeComplexity).toBe(40); // Average of 30 and 50

        // Maintainability index should be 0-100
        if (debtAnalysis.metrics.maintainabilityIndex !== undefined) {
          expect(debtAnalysis.metrics.maintainabilityIndex).toBeGreaterThanOrEqual(0);
          expect(debtAnalysis.metrics.maintainabilityIndex).toBeLessThanOrEqual(100);
        }

        // Duplicated lines percent should be 0-100
        if (debtAnalysis.metrics.duplicatedLinesPercent !== undefined) {
          expect(debtAnalysis.metrics.duplicatedLinesPercent).toBeGreaterThanOrEqual(0);
          expect(debtAnalysis.metrics.duplicatedLinesPercent).toBeLessThanOrEqual(100);
        }
      }
    });
  });

  describe('Severity progression validation', () => {
    it('should show increasing debt scores as issues increase', () => {
      const scenarios = [
        { issues: 1, label: 'minimal' },
        { issues: 5, label: 'few' },
        { issues: 20, label: 'many' },
        { issues: 100, label: 'extreme' }
      ];

      const scores = scenarios.map(scenario => {
        const analysis = {
          ...baseAnalysis,
          codeQuality: {
            ...baseAnalysis.codeQuality,
            codeSmells: Array(scenario.issues).fill({
              file: 'smelly.ts',
              type: 'code-smell',
              severity: 'medium' as const,
              line: 1,
              description: 'Code smell',
              suggestion: 'Fix it'
            })
          }
        };

        return {
          ...scenario,
          score: analyzer.createTechnicalDebtAnalysis(analysis).totalScore
        };
      });

      // Verify increasing trend
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i].score).toBeGreaterThanOrEqual(scores[i - 1].score);
      }

      // Verify bounds
      scores.forEach(({ score }) => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });
  });
});
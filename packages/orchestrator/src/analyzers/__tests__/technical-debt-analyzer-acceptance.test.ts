/**
 * Technical Debt Analyzer Acceptance Test
 *
 * This test file validates that the TechnicalDebtAnalyzer meets the acceptance criteria:
 * - Calculates totalScore (0-100) based on weighted category severities
 * - Populates metrics object with accurate calculations
 * - Outputs valid TechnicalDebtAnalysis schema
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TechnicalDebtAnalyzer } from '../technical-debt-analyzer';
import { TechnicalDebtAnalysisSchema } from '@apexcli/core';
import type { ProjectAnalysis } from '../../idle-processor';
import type {
  ComplexityHotspot,
  CodeSmell,
  DuplicatePattern,
  EnhancedDocumentationAnalysis
} from '@apexcli/core';

describe('TechnicalDebtAnalyzer - Acceptance Criteria', () => {
  let analyzer: TechnicalDebtAnalyzer;
  let baseAnalysis: ProjectAnalysis;

  beforeEach(() => {
    analyzer = new TechnicalDebtAnalyzer();

    baseAnalysis = {
      codebaseSize: {
        files: 100,
        lines: 10000,
        languages: { typescript: 8000, javascript: 2000 }
      },
      testCoverage: {
        percentage: 75,
        uncoveredFiles: ['uncovered1.ts', 'uncovered2.ts']
      },
      dependencies: {
        outdated: [],
        security: [],
        outdatedPackages: [],
        securityIssues: [],
        deprecatedPackages: []
      },
      codeQuality: {
        lintIssues: 10,
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
          percentage: 70,
          uncoveredBranches: []
        },
        antiPatterns: [],
        untestedExports: []
      }
    };
  });

  describe('Acceptance Criteria 1: Total Score Calculation (0-100)', () => {
    it('should calculate totalScore between 0 and 100 for clean codebase', () => {
      const analysis = analyzer.createTechnicalDebtAnalysis(baseAnalysis);

      expect(analysis.totalScore).toBeGreaterThanOrEqual(0);
      expect(analysis.totalScore).toBeLessThanOrEqual(100);
      expect(typeof analysis.totalScore).toBe('number');
      expect(analysis.totalScore).toBeLessThan(20); // Clean codebase should have low debt
    });

    it('should calculate totalScore based on weighted category severities', () => {
      // Create analysis with known security vulnerabilities (highest weight: 0.25)
      const securityAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: [
            {
              name: 'test-vuln',
              cveId: 'CVE-2023-12345',
              severity: 'critical' as const,
              affectedVersions: '<1.0.0',
              description: 'Test vulnerability'
            }
          ]
        }
      };

      // Create analysis with complexity issues (weight: 0.15)
      const complexityAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          complexityHotspots: [
            {
              file: 'complex.ts',
              cyclomaticComplexity: 80, // Critical level
              cognitiveComplexity: 90,
              lineCount: 1200,
              functionName: 'criticalFunction'
            }
          ]
        }
      };

      const securityScore = analyzer.createTechnicalDebtAnalysis(securityAnalysis).totalScore;
      const complexityScore = analyzer.createTechnicalDebtAnalysis(complexityAnalysis).totalScore;

      // Security vulnerabilities should contribute more to total score than complexity
      expect(securityScore).toBeGreaterThan(complexityScore);
      expect(securityScore).toBeGreaterThan(20); // Should have significant impact
      expect(complexityScore).toBeGreaterThan(10); // Should have some impact
    });

    it('should cap totalScore at 100 for extreme debt scenarios', () => {
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
          lintIssues: 1000,
          duplicatedCode: Array(100).fill({
            pattern: 'duplicate pattern',
            locations: Array(10).fill('duplicate.ts'),
            similarity: 1.0
          }),
          complexityHotspots: Array(50).fill({
            file: 'extreme.ts',
            cyclomaticComplexity: 200,
            cognitiveComplexity: 300,
            lineCount: 5000,
            functionName: 'extremeFunction'
          }),
          codeSmells: Array(100).fill({
            file: 'smelly.ts',
            type: 'god-class',
            severity: 'critical' as const,
            line: 1,
            description: 'Critical smell',
            suggestion: 'Rewrite'
          })
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(extremeDebtAnalysis);
      expect(analysis.totalScore).toBe(100);
    });

    it('should produce consistent scores for identical analyses', () => {
      const analysis1 = analyzer.createTechnicalDebtAnalysis(baseAnalysis);
      const analysis2 = analyzer.createTechnicalDebtAnalysis(baseAnalysis);
      const analysis3 = analyzer.createTechnicalDebtAnalysis(baseAnalysis);

      expect(analysis1.totalScore).toBe(analysis2.totalScore);
      expect(analysis2.totalScore).toBe(analysis3.totalScore);
    });
  });

  describe('Acceptance Criteria 2: Metrics Object Population', () => {
    it('should populate all required metrics fields accurately', () => {
      const metricsTestAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 65, uncoveredFiles: ['file1.ts'] },
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
          ],
          duplicatedCode: [
            {
              pattern: 'validation pattern',
              locations: ['a.ts', 'b.ts', 'c.ts'],
              similarity: 0.9
            }
          ],
          codeSmells: [
            {
              file: 'smelly.ts',
              type: 'god-class',
              severity: 'high',
              line: 1,
              description: 'High complexity class',
              suggestion: 'Break apart'
            }
          ]
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(metricsTestAnalysis);

      expect(analysis.metrics).toBeDefined();
      expect(analysis.metrics).toHaveProperty('codeComplexity');
      expect(analysis.metrics).toHaveProperty('testCoverage');
      expect(analysis.metrics).toHaveProperty('duplicatedLinesPercent');
      expect(analysis.metrics).toHaveProperty('maintainabilityIndex');
    });

    it('should calculate codeComplexity as aggregate average', () => {
      const complexityAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          complexityHotspots: [
            {
              file: 'file1.ts',
              cyclomaticComplexity: 20,
              cognitiveComplexity: 25,
              lineCount: 300,
              functionName: 'func1'
            },
            {
              file: 'file2.ts',
              cyclomaticComplexity: 40,
              cognitiveComplexity: 45,
              lineCount: 600,
              functionName: 'func2'
            },
            {
              file: 'file3.ts',
              cyclomaticComplexity: 60,
              cognitiveComplexity: 70,
              lineCount: 900,
              functionName: 'func3'
            }
          ]
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(complexityAnalysis);
      const expectedAverage = (20 + 40 + 60) / 3; // 40

      expect(analysis.metrics?.codeComplexity).toBe(expectedAverage);
    });

    it('should calculate testCoverage directly from analysis', () => {
      const coverageAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 42.5, uncoveredFiles: ['file1.ts', 'file2.ts'] }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(coverageAnalysis);
      expect(analysis.metrics?.testCoverage).toBe(42.5);
    });

    it('should calculate duplicatedLinesPercent based on pattern analysis', () => {
      const duplicationAnalysis = {
        ...baseAnalysis,
        codebaseSize: {
          files: 100,
          lines: 1000, // Known total for calculation
          languages: { typescript: 1000 }
        },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          duplicatedCode: [
            {
              pattern: 'pattern1',
              locations: ['a.ts', 'b.ts'], // 2 locations
              similarity: 0.8
            },
            {
              pattern: 'pattern2',
              locations: ['c.ts', 'd.ts', 'e.ts'], // 3 locations
              similarity: 0.9
            }
          ]
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(duplicationAnalysis);

      // Formula: Σ (locations.length × similarity × 50) / totalLines × 100
      // Pattern 1: 2 × 0.8 × 50 = 80
      // Pattern 2: 3 × 0.9 × 50 = 135
      // Total duplicated: 215 lines
      // Percentage: (215 / 1000) × 100 = 21.5%
      const expectedPercentage = ((2 * 0.8 * 50) + (3 * 0.9 * 50)) / 1000 * 100;

      expect(analysis.metrics?.duplicatedLinesPercent).toBeCloseTo(expectedPercentage, 1);
    });

    it('should calculate maintainabilityIndex as composite metric', () => {
      const maintainabilityAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 80, uncoveredFiles: [] }, // Good coverage
        codeQuality: {
          ...baseAnalysis.codeQuality,
          complexityHotspots: [
            {
              file: 'simple.ts',
              cyclomaticComplexity: 10, // Low complexity
              cognitiveComplexity: 12,
              lineCount: 200,
              functionName: 'simpleFunction'
            }
          ],
          duplicatedCode: [], // No duplication
          codeSmells: [] // No smells
        },
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: [] // No security issues
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(maintainabilityAnalysis);

      // Should be high for maintainable code
      expect(analysis.metrics?.maintainabilityIndex).toBeGreaterThan(70);
      expect(analysis.metrics?.maintainabilityIndex).toBeLessThanOrEqual(100);
    });

    it('should handle missing data gracefully in metrics calculation', () => {
      const incompleteAnalysis = {
        ...baseAnalysis,
        testCoverage: null,
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        }
      } as any;

      const analysis = analyzer.createTechnicalDebtAnalysis(incompleteAnalysis);

      expect(analysis.metrics).toBeDefined();
      expect(analysis.metrics?.testCoverage).toBe(0); // Default for missing coverage
      expect(analysis.metrics?.codeComplexity).toBe(0); // Default for no hotspots
      expect(analysis.metrics?.duplicatedLinesPercent).toBe(0); // Default for no duplicates
      expect(analysis.metrics?.maintainabilityIndex).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Acceptance Criteria 3: Valid TechnicalDebtAnalysis Schema', () => {
    it('should output valid TechnicalDebtAnalysis schema for typical analysis', () => {
      const typicalAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 60, uncoveredFiles: ['file1.ts', 'file2.ts'] },
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: [
            {
              name: 'security-issue',
              cveId: 'CVE-2023-12345',
              severity: 'high' as const,
              affectedVersions: '<2.0.0',
              description: 'Security vulnerability'
            }
          ],
          outdatedPackages: [
            {
              name: 'old-package',
              currentVersion: '1.0.0',
              latestVersion: '2.0.0',
              updateType: 'major' as const
            }
          ]
        },
        codeQuality: {
          lintIssues: 25,
          duplicatedCode: [
            {
              pattern: 'common utility',
              locations: ['util1.ts', 'util2.ts'],
              similarity: 0.85
            }
          ],
          complexityHotspots: [
            {
              file: 'complex.ts',
              cyclomaticComplexity: 35,
              cognitiveComplexity: 42,
              lineCount: 500,
              functionName: 'complexFunction'
            }
          ],
          codeSmells: [
            {
              file: 'smelly.ts',
              type: 'long-method',
              severity: 'medium',
              line: 20,
              description: 'Method is too long',
              suggestion: 'Extract smaller methods'
            }
          ]
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(typicalAnalysis);

      // Should validate against schema without throwing
      expect(() => TechnicalDebtAnalysisSchema.parse(analysis)).not.toThrow();

      // Verify the parsed result is identical
      const validated = TechnicalDebtAnalysisSchema.parse(analysis);
      expect(validated).toEqual(analysis);
    });

    it('should output valid schema for minimal analysis', () => {
      const minimalAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(minimalAnalysis);

      expect(() => TechnicalDebtAnalysisSchema.parse(analysis)).not.toThrow();
      expect(analysis.totalScore).toBeGreaterThanOrEqual(0);
      expect(analysis.totalScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(analysis.categories)).toBe(true);
      expect(Array.isArray(analysis.hotspots)).toBe(true);
    });

    it('should output valid schema for complex analysis with all debt types', () => {
      const comprehensiveAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 30, uncoveredFiles: ['test1.ts', 'test2.ts', 'test3.ts'] },
        dependencies: {
          outdated: ['pkg1', 'pkg2'],
          security: ['vuln-pkg'],
          outdatedPackages: [
            {
              name: 'outdated-lib',
              currentVersion: '1.0.0',
              latestVersion: '3.0.0',
              updateType: 'major' as const
            }
          ],
          securityIssues: [
            {
              name: 'vulnerable-package',
              cveId: 'CVE-2023-11111',
              severity: 'critical' as const,
              affectedVersions: '<1.5.0',
              description: 'Critical security flaw'
            }
          ],
          deprecatedPackages: [
            {
              name: 'deprecated-lib',
              currentVersion: '2.0.0',
              reason: 'No longer maintained',
              replacement: 'modern-lib'
            }
          ]
        },
        codeQuality: {
          lintIssues: 150,
          duplicatedCode: [
            {
              pattern: 'validation logic',
              locations: ['user.ts', 'admin.ts', 'guest.ts'],
              similarity: 0.95
            },
            {
              pattern: 'error handling',
              locations: ['api.ts', 'service.ts'],
              similarity: 0.88
            }
          ],
          complexityHotspots: [
            {
              file: 'legacy.ts',
              cyclomaticComplexity: 65,
              cognitiveComplexity: 80,
              lineCount: 1200,
              functionName: 'legacyProcessor'
            },
            {
              file: 'parser.ts',
              cyclomaticComplexity: 45,
              cognitiveComplexity: 55,
              lineCount: 800,
              functionName: 'complexParser'
            }
          ],
          codeSmells: [
            {
              file: 'god-object.ts',
              type: 'god-class',
              severity: 'critical',
              line: 1,
              description: 'Class has too many responsibilities',
              suggestion: 'Break into smaller, focused classes'
            },
            {
              file: 'long-method.ts',
              type: 'long-method',
              severity: 'high',
              line: 45,
              description: 'Method is excessively long',
              suggestion: 'Extract smaller methods'
            }
          ]
        },
        documentation: {
          coveragePercentage: 45,
          undocumentedExports: ['export1', 'export2'],
          outdatedDocumentation: ['old-readme.md'],
          missingReadmeSections: ['installation', 'usage'],
          apiCompleteness: {
            documented: 45,
            total: 100,
            coveragePercentage: 45
          }
        } as EnhancedDocumentationAnalysis,
        performance: {
          bundleSize: 8192,
          slowTests: ['slow-test.spec.ts'],
          bottlenecks: ['performance-issue.ts']
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(comprehensiveAnalysis);

      expect(() => TechnicalDebtAnalysisSchema.parse(analysis)).not.toThrow();

      // Verify comprehensive analysis produces expected structure
      expect(analysis.categories.length).toBeGreaterThan(3); // Multiple debt categories
      expect(analysis.hotspots.length).toBeGreaterThan(0); // Should identify hotspots
      expect(analysis.totalScore).toBeGreaterThan(50); // Should have significant debt
      expect(analysis.metrics).toBeDefined();
      expect(analysis.trends).toBeDefined();
    });

    it('should ensure all schema fields meet their constraints', () => {
      const analysis = analyzer.createTechnicalDebtAnalysis(baseAnalysis);

      // totalScore constraints
      expect(analysis.totalScore).toBeGreaterThanOrEqual(0);
      expect(analysis.totalScore).toBeLessThanOrEqual(100);

      // categories constraints
      expect(Array.isArray(analysis.categories)).toBe(true);
      analysis.categories.forEach(category => {
        expect(category.count).toBeGreaterThanOrEqual(0);
        expect(['low', 'medium', 'high', 'critical']).toContain(category.severity);
        expect([
          'code-smell', 'duplication', 'complexity', 'outdated-dependency',
          'security-vulnerability', 'performance', 'maintainability',
          'testability', 'documentation', 'dead-code', 'technical-design', 'other'
        ]).toContain(category.category);
        expect(Array.isArray(category.examples)).toBe(true);
      });

      // hotspots constraints
      expect(Array.isArray(analysis.hotspots)).toBe(true);
      analysis.hotspots.forEach(hotspot => {
        expect(hotspot.score).toBeGreaterThanOrEqual(0);
        expect(hotspot.score).toBeLessThanOrEqual(100);
        expect(Array.isArray(hotspot.issues)).toBe(true);
        expect(typeof hotspot.path).toBe('string');
        if (hotspot.loc !== undefined) {
          expect(hotspot.loc).toBeGreaterThanOrEqual(0);
        }
      });

      // metrics constraints
      if (analysis.metrics) {
        if (analysis.metrics.testCoverage !== undefined) {
          expect(analysis.metrics.testCoverage).toBeGreaterThanOrEqual(0);
          expect(analysis.metrics.testCoverage).toBeLessThanOrEqual(100);
        }
        if (analysis.metrics.duplicatedLinesPercent !== undefined) {
          expect(analysis.metrics.duplicatedLinesPercent).toBeGreaterThanOrEqual(0);
          expect(analysis.metrics.duplicatedLinesPercent).toBeLessThanOrEqual(100);
        }
        if (analysis.metrics.maintainabilityIndex !== undefined) {
          expect(analysis.metrics.maintainabilityIndex).toBeGreaterThanOrEqual(0);
          expect(analysis.metrics.maintainabilityIndex).toBeLessThanOrEqual(100);
        }
        if (analysis.metrics.codeComplexity !== undefined) {
          expect(analysis.metrics.codeComplexity).toBeGreaterThanOrEqual(0);
        }
      }

      // trends constraints
      if (analysis.trends) {
        expect(typeof analysis.trends.improving).toBe('boolean');
        expect(typeof analysis.trends.changeRate).toBe('number');
      }
    });
  });

  describe('Integration Tests - All Acceptance Criteria Together', () => {
    it('should satisfy all acceptance criteria simultaneously', () => {
      const integrationTestAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 45, uncoveredFiles: ['file1.ts', 'file2.ts'] },
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
        },
        codeQuality: {
          lintIssues: 75,
          duplicatedCode: [
            {
              pattern: 'utility functions',
              locations: ['utils1.ts', 'utils2.ts', 'utils3.ts'],
              similarity: 0.92
            }
          ],
          complexityHotspots: [
            {
              file: 'complex.ts',
              cyclomaticComplexity: 55,
              cognitiveComplexity: 68,
              lineCount: 950,
              functionName: 'complexProcessor'
            }
          ],
          codeSmells: [
            {
              file: 'problematic.ts',
              type: 'god-class',
              severity: 'high',
              line: 1,
              description: 'Class with too many responsibilities',
              suggestion: 'Extract smaller classes'
            }
          ]
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(integrationTestAnalysis);

      // Acceptance Criteria 1: totalScore (0-100) based on weighted severities
      expect(analysis.totalScore).toBeGreaterThanOrEqual(0);
      expect(analysis.totalScore).toBeLessThanOrEqual(100);
      expect(typeof analysis.totalScore).toBe('number');
      expect(analysis.totalScore).toBeGreaterThan(30); // Should have significant debt

      // Acceptance Criteria 2: Populated metrics object
      expect(analysis.metrics).toBeDefined();
      expect(analysis.metrics).toHaveProperty('codeComplexity');
      expect(analysis.metrics).toHaveProperty('testCoverage');
      expect(analysis.metrics).toHaveProperty('duplicatedLinesPercent');
      expect(analysis.metrics).toHaveProperty('maintainabilityIndex');

      expect(analysis.metrics?.testCoverage).toBe(45);
      expect(analysis.metrics?.codeComplexity).toBe(55);
      expect(analysis.metrics?.duplicatedLinesPercent).toBeGreaterThan(0);
      expect(analysis.metrics?.maintainabilityIndex).toBeLessThan(80); // Should be lower due to issues

      // Acceptance Criteria 3: Valid TechnicalDebtAnalysis schema
      expect(() => TechnicalDebtAnalysisSchema.parse(analysis)).not.toThrow();

      const validated = TechnicalDebtAnalysisSchema.parse(analysis);
      expect(validated).toEqual(analysis);

      // Additional validation of structure
      expect(analysis.categories.length).toBeGreaterThan(0);
      expect(analysis.hotspots.length).toBeGreaterThan(0);
      expect(analysis.trends).toBeDefined();
    });

    it('should maintain consistency across multiple invocations', () => {
      const testAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 70, uncoveredFiles: ['file1.ts'] },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          lintIssues: 50,
          complexityHotspots: [
            {
              file: 'consistent.ts',
              cyclomaticComplexity: 25,
              cognitiveComplexity: 30,
              lineCount: 400,
              functionName: 'consistentFunction'
            }
          ]
        }
      };

      // Run analysis multiple times
      const results = Array.from({ length: 5 }, () =>
        analyzer.createTechnicalDebtAnalysis(testAnalysis)
      );

      // All results should be identical
      const firstResult = results[0];
      results.forEach((result, index) => {
        expect(result.totalScore).toBe(firstResult.totalScore);
        expect(result.categories).toEqual(firstResult.categories);
        expect(result.hotspots).toEqual(firstResult.hotspots);
        expect(result.metrics).toEqual(firstResult.metrics);
        expect(result.trends).toEqual(firstResult.trends);

        // All should validate against schema
        expect(() => TechnicalDebtAnalysisSchema.parse(result)).not.toThrow();
      });
    });
  });
});
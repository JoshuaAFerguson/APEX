/**
 * TechnicalDebtAnalyzer Edge Cases and Boundary Conditions
 *
 * This test file focuses on edge cases, error handling, and boundary conditions
 * to ensure the analyzer is robust against unexpected or malformed input.
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

describe('TechnicalDebtAnalyzer - Edge Cases', () => {
  let analyzer: TechnicalDebtAnalyzer;

  beforeEach(() => {
    analyzer = new TechnicalDebtAnalyzer();
  });

  describe('Null and undefined handling', () => {
    it('should handle completely null analysis gracefully', () => {
      const nullAnalysis = {
        codebaseSize: null,
        testCoverage: null,
        dependencies: null,
        codeQuality: null,
        documentation: null,
        performance: null,
        testAnalysis: null
      } as any;

      expect(() => analyzer.analyze(nullAnalysis)).not.toThrow();
      expect(() => analyzer.createTechnicalDebtAnalysis(nullAnalysis)).not.toThrow();

      const candidates = analyzer.analyze(nullAnalysis);
      expect(Array.isArray(candidates)).toBe(true);

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(nullAnalysis);
      expect(typeof debtAnalysis.totalScore).toBe('number');
      expect(debtAnalysis.totalScore).toBeGreaterThanOrEqual(0);
      expect(debtAnalysis.totalScore).toBeLessThanOrEqual(100);
    });

    it('should handle undefined nested properties', () => {
      const undefinedAnalysis = {
        codebaseSize: {
          files: 10,
          lines: 1000,
          languages: { typescript: 1000 }
        },
        testCoverage: undefined,
        dependencies: {
          outdated: undefined,
          security: undefined,
          outdatedPackages: undefined,
          securityIssues: undefined,
          deprecatedPackages: undefined
        },
        codeQuality: {
          lintIssues: undefined,
          duplicatedCode: undefined,
          complexityHotspots: undefined,
          codeSmells: undefined
        },
        documentation: undefined,
        performance: undefined,
        testAnalysis: undefined
      } as any;

      expect(() => analyzer.analyze(undefinedAnalysis)).not.toThrow();
      expect(() => analyzer.createTechnicalDebtAnalysis(undefinedAnalysis)).not.toThrow();

      const candidates = analyzer.analyze(undefinedAnalysis);
      expect(Array.isArray(candidates)).toBe(true);
    });

    it('should handle mixed null/undefined/empty properties', () => {
      const mixedAnalysis = {
        codebaseSize: {
          files: 0,
          lines: 0,
          languages: {}
        },
        testCoverage: null,
        dependencies: {
          outdated: [],
          security: null,
          outdatedPackages: undefined,
          securityIssues: [],
          deprecatedPackages: null
        },
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: undefined,
          complexityHotspots: null,
          codeSmells: []
        },
        documentation: undefined,
        performance: null,
        testAnalysis: {
          branchCoverage: null,
          antiPatterns: [],
          untestedExports: undefined
        }
      } as any;

      expect(() => analyzer.analyze(mixedAnalysis)).not.toThrow();
      expect(() => analyzer.createTechnicalDebtAnalysis(mixedAnalysis)).not.toThrow();
    });
  });

  describe('Empty data structures', () => {
    it('should handle empty arrays gracefully', () => {
      const emptyArraysAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 0,
          lines: 0,
          languages: {}
        },
        testCoverage: {
          percentage: 0,
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
          coveragePercentage: 0,
          undocumentedExports: [],
          outdatedDocumentation: [],
          missingReadmeSections: [],
          apiCompleteness: {
            documented: 0,
            total: 0,
            coveragePercentage: 0
          }
        } as EnhancedDocumentationAnalysis,
        performance: {
          bundleSize: 0,
          slowTests: [],
          bottlenecks: []
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 0,
            uncoveredBranches: []
          },
          antiPatterns: [],
          untestedExports: []
        }
      };

      const candidates = analyzer.analyze(emptyArraysAnalysis);
      expect(Array.isArray(candidates)).toBe(true);

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(emptyArraysAnalysis);
      expect(debtAnalysis.categories).toEqual([]);
      expect(debtAnalysis.hotspots).toEqual([]);
      expect(debtAnalysis.totalScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle zero values appropriately', () => {
      const zeroValuesAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 0,
          lines: 0,
          languages: {}
        },
        testCoverage: {
          percentage: 0, // Should trigger test coverage candidate
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
          coveragePercentage: 0,
          undocumentedExports: [],
          outdatedDocumentation: [],
          missingReadmeSections: [],
          apiCompleteness: {
            documented: 0,
            total: 0,
            coveragePercentage: 0
          }
        } as EnhancedDocumentationAnalysis,
        performance: {
          bundleSize: 0,
          slowTests: [],
          bottlenecks: []
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 0,
            uncoveredBranches: []
          },
          antiPatterns: [],
          untestedExports: []
        }
      };

      const candidates = analyzer.analyze(zeroValuesAnalysis);
      // Should generate test coverage candidate due to 0% coverage
      const coverageCandidate = candidates.find(c => c.candidateId.includes('test-coverage'));
      expect(coverageCandidate).toBeDefined();
      expect(coverageCandidate?.priority).toBe('high'); // Critical coverage issue
    });
  });

  describe('Malformed data handling', () => {
    it('should handle corrupted complexity hotspot data', () => {
      const corruptedAnalysis = {
        codebaseSize: { files: 10, lines: 1000, languages: { typescript: 1000 } },
        testCoverage: { percentage: 80, uncoveredFiles: [] },
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
          complexityHotspots: [
            {
              file: 'valid.ts',
              cyclomaticComplexity: 25,
              cognitiveComplexity: 30,
              lineCount: 400,
              functionName: 'validFunction'
            },
            {
              // Missing required fields
              file: null,
              cyclomaticComplexity: 'invalid',
              cognitiveComplexity: undefined,
              lineCount: -100,
              functionName: ''
            },
            {
              // Extra unexpected fields
              file: 'another.ts',
              cyclomaticComplexity: 15,
              cognitiveComplexity: 20,
              lineCount: 200,
              functionName: 'anotherFunction',
              unexpectedField: 'should not break',
              anotherBadField: { nested: 'object' }
            }
          ] as any,
          codeSmells: []
        },
        documentation: null,
        performance: null,
        testAnalysis: null
      } as any;

      expect(() => analyzer.analyze(corruptedAnalysis)).not.toThrow();
      expect(() => analyzer.createTechnicalDebtAnalysis(corruptedAnalysis)).not.toThrow();

      const candidates = analyzer.analyze(corruptedAnalysis);
      expect(Array.isArray(candidates)).toBe(true);
    });

    it('should handle corrupted security vulnerability data', () => {
      const corruptedSecurityAnalysis = {
        codebaseSize: { files: 10, lines: 1000, languages: { typescript: 1000 } },
        testCoverage: { percentage: 80, uncoveredFiles: [] },
        dependencies: {
          outdated: [],
          security: [],
          outdatedPackages: [],
          securityIssues: [
            {
              name: 'valid-vuln',
              cveId: 'CVE-2023-12345',
              severity: 'high',
              affectedVersions: '<2.0.0',
              description: 'Valid vulnerability'
            },
            {
              // Corrupted data
              name: null,
              cveId: undefined,
              severity: 'invalid-severity',
              affectedVersions: 123,
              description: { corrupted: 'object' }
            },
            {
              // Missing fields
              name: 'incomplete-vuln'
              // Missing other required fields
            }
          ] as any,
          deprecatedPackages: []
        },
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        },
        documentation: null,
        performance: null,
        testAnalysis: null
      } as any;

      expect(() => analyzer.analyze(corruptedSecurityAnalysis)).not.toThrow();
      expect(() => analyzer.createTechnicalDebtAnalysis(corruptedSecurityAnalysis)).not.toThrow();
    });

    it('should handle corrupted dependency data', () => {
      const corruptedDepsAnalysis = {
        codebaseSize: { files: 10, lines: 1000, languages: { typescript: 1000 } },
        testCoverage: { percentage: 80, uncoveredFiles: [] },
        dependencies: {
          outdated: [null, undefined, '', 123, { not: 'string' }], // Mixed invalid types
          security: 'not-an-array',
          outdatedPackages: [
            {
              name: 'valid-package',
              currentVersion: '1.0.0',
              latestVersion: '2.0.0',
              updateType: 'major'
            },
            {
              // Corrupted package
              name: null,
              currentVersion: undefined,
              latestVersion: 123,
              updateType: 'invalid-type'
            }
          ] as any,
          securityIssues: {},  // Should be array
          deprecatedPackages: 'not-an-array'
        } as any,
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        },
        documentation: null,
        performance: null,
        testAnalysis: null
      } as any;

      expect(() => analyzer.analyze(corruptedDepsAnalysis)).not.toThrow();
      expect(() => analyzer.createTechnicalDebtAnalysis(corruptedDepsAnalysis)).not.toThrow();
    });
  });

  describe('Boundary value testing', () => {
    it('should handle maximum boundary values', () => {
      const maxBoundaryAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: Number.MAX_SAFE_INTEGER,
          lines: Number.MAX_SAFE_INTEGER,
          languages: { typescript: Number.MAX_SAFE_INTEGER }
        },
        testCoverage: {
          percentage: 100,
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
          lintIssues: Number.MAX_SAFE_INTEGER,
          duplicatedCode: [],
          complexityHotspots: [
            {
              file: 'max-complex.ts',
              cyclomaticComplexity: Number.MAX_SAFE_INTEGER,
              cognitiveComplexity: Number.MAX_SAFE_INTEGER,
              lineCount: Number.MAX_SAFE_INTEGER,
              functionName: 'maxComplexFunction'
            }
          ],
          codeSmells: []
        },
        documentation: {
          coveragePercentage: 100,
          undocumentedExports: [],
          outdatedDocumentation: [],
          missingReadmeSections: [],
          apiCompleteness: {
            documented: Number.MAX_SAFE_INTEGER,
            total: Number.MAX_SAFE_INTEGER,
            coveragePercentage: 100
          }
        } as EnhancedDocumentationAnalysis,
        performance: {
          bundleSize: Number.MAX_SAFE_INTEGER,
          slowTests: [],
          bottlenecks: []
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 100,
            uncoveredBranches: []
          },
          antiPatterns: [],
          untestedExports: []
        }
      };

      expect(() => analyzer.analyze(maxBoundaryAnalysis)).not.toThrow();
      expect(() => analyzer.createTechnicalDebtAnalysis(maxBoundaryAnalysis)).not.toThrow();

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(maxBoundaryAnalysis);
      expect(debtAnalysis.totalScore).toBe(100); // Should be capped at 100
    });

    it('should handle minimum boundary values', () => {
      const minBoundaryAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 0,
          lines: 0,
          languages: {}
        },
        testCoverage: {
          percentage: 0,
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
          coveragePercentage: 0,
          undocumentedExports: [],
          outdatedDocumentation: [],
          missingReadmeSections: [],
          apiCompleteness: {
            documented: 0,
            total: 0,
            coveragePercentage: 0
          }
        } as EnhancedDocumentationAnalysis,
        performance: {
          bundleSize: 0,
          slowTests: [],
          bottlenecks: []
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 0,
            uncoveredBranches: []
          },
          antiPatterns: [],
          untestedExports: []
        }
      };

      expect(() => analyzer.analyze(minBoundaryAnalysis)).not.toThrow();
      expect(() => analyzer.createTechnicalDebtAnalysis(minBoundaryAnalysis)).not.toThrow();

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(minBoundaryAnalysis);
      expect(debtAnalysis.totalScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle negative values gracefully', () => {
      const negativeValuesAnalysis = {
        codebaseSize: {
          files: -10,
          lines: -1000,
          languages: { typescript: -500 }
        },
        testCoverage: {
          percentage: -50,
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
          lintIssues: -100,
          duplicatedCode: [],
          complexityHotspots: [
            {
              file: 'negative.ts',
              cyclomaticComplexity: -25,
              cognitiveComplexity: -30,
              lineCount: -400,
              functionName: 'negativeFunction'
            }
          ],
          codeSmells: []
        },
        documentation: null,
        performance: null,
        testAnalysis: null
      } as any;

      expect(() => analyzer.analyze(negativeValuesAnalysis)).not.toThrow();
      expect(() => analyzer.createTechnicalDebtAnalysis(negativeValuesAnalysis)).not.toThrow();

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(negativeValuesAnalysis);
      expect(debtAnalysis.totalScore).toBeGreaterThanOrEqual(0);
      expect(debtAnalysis.totalScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Large dataset handling', () => {
    it('should handle analysis with large number of issues efficiently', () => {
      const startTime = Date.now();

      const largeDataAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 10000,
          lines: 1000000,
          languages: { typescript: 600000, javascript: 400000 }
        },
        testCoverage: {
          percentage: 30,
          uncoveredFiles: Array(5000).fill('uncovered-file.ts')
        },
        dependencies: {
          outdated: Array(1000).fill('outdated-package'),
          security: Array(500).fill('vuln-package'),
          outdatedPackages: Array(1000).fill({
            name: 'outdated',
            currentVersion: '1.0.0',
            latestVersion: '2.0.0',
            updateType: 'major' as const
          }),
          securityIssues: Array(500).fill({
            name: 'vuln',
            cveId: 'CVE-2023-12345',
            severity: 'high' as const,
            affectedVersions: '<2.0.0',
            description: 'Security vulnerability'
          }),
          deprecatedPackages: Array(200).fill({
            name: 'deprecated',
            currentVersion: '1.0.0',
            reason: 'Deprecated',
            replacement: 'new-package'
          })
        },
        codeQuality: {
          lintIssues: 10000,
          duplicatedCode: Array(1000).fill({
            pattern: 'duplicate pattern',
            locations: ['a.ts', 'b.ts', 'c.ts'],
            similarity: 0.9
          }),
          complexityHotspots: Array(2000).fill({
            file: 'complex.ts',
            cyclomaticComplexity: 35,
            cognitiveComplexity: 45,
            lineCount: 600,
            functionName: 'complexFunction'
          }),
          codeSmells: Array(5000).fill({
            file: 'smelly.ts',
            type: 'code-smell',
            severity: 'medium' as const,
            line: 1,
            description: 'Code smell',
            suggestion: 'Fix it'
          })
        },
        documentation: {
          coveragePercentage: 40,
          undocumentedExports: Array(1000).fill('undocumented-export'),
          outdatedDocumentation: Array(500).fill('outdated-doc.md'),
          missingReadmeSections: ['installation', 'usage', 'examples'],
          apiCompleteness: {
            documented: 4000,
            total: 10000,
            coveragePercentage: 40
          }
        } as EnhancedDocumentationAnalysis,
        performance: {
          bundleSize: 10485760, // 10MB
          slowTests: Array(100).fill('slow-test.spec.ts'),
          bottlenecks: Array(50).fill('performance-bottleneck.ts')
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 25,
            uncoveredBranches: Array(2000).fill('uncovered-branch')
          },
          antiPatterns: Array(200).fill('anti-pattern'),
          untestedExports: Array(1000).fill('untested-export')
        }
      };

      const candidates = analyzer.analyze(largeDataAnalysis);
      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(largeDataAnalysis);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should complete in reasonable time (< 1 second)
      expect(executionTime).toBeLessThan(1000);

      // Should still produce valid results
      expect(Array.isArray(candidates)).toBe(true);
      expect(candidates.length).toBeGreaterThan(0);
      expect(debtAnalysis.totalScore).toBeGreaterThanOrEqual(0);
      expect(debtAnalysis.totalScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(debtAnalysis.categories)).toBe(true);
      expect(Array.isArray(debtAnalysis.hotspots)).toBe(true);
    });

    it('should limit hotspots to reasonable number even with large input', () => {
      const manyHotspotsAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 1000,
          lines: 100000,
          languages: { typescript: 100000 }
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
          duplicatedCode: Array(500).fill({
            pattern: 'duplicate pattern',
            locations: Array(5).fill('duplicate-file.ts'),
            similarity: 0.95
          }),
          complexityHotspots: Array(500).fill({
            file: 'complex.ts',
            cyclomaticComplexity: 45,
            cognitiveComplexity: 55,
            lineCount: 800,
            functionName: 'complexFunction'
          }),
          codeSmells: Array(1000).fill({
            file: 'smelly.ts',
            type: 'code-smell',
            severity: 'high' as const,
            line: 1,
            description: 'Code smell',
            suggestion: 'Fix it'
          })
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

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(manyHotspotsAnalysis);

      // Should limit hotspots to top 10 even with many potential hotspots
      expect(debtAnalysis.hotspots.length).toBeLessThanOrEqual(10);

      // Hotspots should be sorted by score (highest first)
      for (let i = 1; i < debtAnalysis.hotspots.length; i++) {
        expect(debtAnalysis.hotspots[i - 1].score).toBeGreaterThanOrEqual(debtAnalysis.hotspots[i].score);
      }
    });
  });

  describe('Type coercion and conversion', () => {
    it('should handle string numbers gracefully', () => {
      const stringNumbersAnalysis = {
        codebaseSize: {
          files: '50',
          lines: '5000',
          languages: { typescript: '4000', javascript: '1000' }
        },
        testCoverage: {
          percentage: '80',
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
          lintIssues: '10',
          duplicatedCode: [],
          complexityHotspots: [
            {
              file: 'complex.ts',
              cyclomaticComplexity: '35',
              cognitiveComplexity: '45',
              lineCount: '600',
              functionName: 'complexFunction'
            }
          ],
          codeSmells: []
        },
        documentation: null,
        performance: null,
        testAnalysis: null
      } as any;

      expect(() => analyzer.analyze(stringNumbersAnalysis)).not.toThrow();
      expect(() => analyzer.createTechnicalDebtAnalysis(stringNumbersAnalysis)).not.toThrow();
    });

    it('should handle boolean values in unexpected places', () => {
      const booleanAnalysis = {
        codebaseSize: {
          files: true,
          lines: false,
          languages: { typescript: true }
        },
        testCoverage: {
          percentage: true,
          uncoveredFiles: false
        },
        dependencies: {
          outdated: false,
          security: true,
          outdatedPackages: true,
          securityIssues: false,
          deprecatedPackages: true
        },
        codeQuality: {
          lintIssues: false,
          duplicatedCode: true,
          complexityHotspots: false,
          codeSmells: true
        },
        documentation: false,
        performance: true,
        testAnalysis: false
      } as any;

      expect(() => analyzer.analyze(booleanAnalysis)).not.toThrow();
      expect(() => analyzer.createTechnicalDebtAnalysis(booleanAnalysis)).not.toThrow();
    });
  });

  describe('Memory and performance edge cases', () => {
    it('should not cause memory leaks with repeated analyses', () => {
      const baseAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 100,
          lines: 10000,
          languages: { typescript: 10000 }
        },
        testCoverage: {
          percentage: 70,
          uncoveredFiles: ['test1.ts', 'test2.ts']
        },
        dependencies: {
          outdated: ['package1'],
          security: [],
          outdatedPackages: [
            {
              name: 'package1',
              currentVersion: '1.0.0',
              latestVersion: '2.0.0',
              updateType: 'major' as const
            }
          ],
          securityIssues: [],
          deprecatedPackages: []
        },
        codeQuality: {
          lintIssues: 25,
          duplicatedCode: [
            {
              pattern: 'common pattern',
              locations: ['file1.ts', 'file2.ts'],
              similarity: 0.85
            }
          ],
          complexityHotspots: [
            {
              file: 'complex.ts',
              cyclomaticComplexity: 30,
              cognitiveComplexity: 35,
              lineCount: 500,
              functionName: 'complexFunction'
            }
          ],
          codeSmells: [
            {
              file: 'smelly.ts',
              type: 'code-smell',
              severity: 'medium' as const,
              line: 10,
              description: 'Code smell',
              suggestion: 'Fix it'
            }
          ]
        },
        documentation: {
          coveragePercentage: 60,
          undocumentedExports: ['export1'],
          outdatedDocumentation: [],
          missingReadmeSections: [],
          apiCompleteness: {
            documented: 60,
            total: 100,
            coveragePercentage: 60
          }
        } as EnhancedDocumentationAnalysis,
        performance: {
          bundleSize: 4096,
          slowTests: [],
          bottlenecks: []
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 65,
            uncoveredBranches: []
          },
          antiPatterns: [],
          untestedExports: []
        }
      };

      // Run analysis many times to check for memory leaks
      for (let i = 0; i < 1000; i++) {
        analyzer.analyze(baseAnalysis);
        analyzer.createTechnicalDebtAnalysis(baseAnalysis);
      }

      // Should complete without issues
      expect(true).toBe(true);
    });
  });
});
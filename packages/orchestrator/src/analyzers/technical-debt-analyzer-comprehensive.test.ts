/**
 * Comprehensive TechnicalDebtAnalyzer Test Suite
 *
 * This test file provides additional coverage for edge cases, integration scenarios,
 * and validation that weren't covered in the existing test files.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TechnicalDebtAnalyzer } from './technical-debt-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type {
  ComplexityHotspot,
  CodeSmell,
  DuplicatePattern,
  EnhancedDocumentationAnalysis
} from '@apexcli/core';
import type {
  OutdatedDependency,
  SecurityVulnerability,
  DeprecatedPackage
} from '../idle-processor';

describe('TechnicalDebtAnalyzer - Comprehensive Testing', () => {
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

  describe('Real-world scenario testing', () => {
    it('should handle a legacy codebase with multiple debt types', () => {
      const legacyAnalysis: ProjectAnalysis = {
        ...baseAnalysis,
        testCoverage: {
          percentage: 25,
          uncoveredFiles: ['legacy.js', 'old-module.js', 'deprecated.js']
        },
        dependencies: {
          outdated: ['react', 'lodash', 'moment'],
          security: ['vulnerable-package'],
          outdatedPackages: [
            {
              name: 'react',
              currentVersion: '15.6.2',
              latestVersion: '18.2.0',
              updateType: 'major'
            },
            {
              name: 'lodash',
              currentVersion: '3.10.1',
              latestVersion: '4.17.21',
              updateType: 'major'
            }
          ],
          securityIssues: [
            {
              name: 'lodash',
              cveId: 'CVE-2021-23337',
              severity: 'critical',
              affectedVersions: '<4.17.21',
              description: 'Prototype pollution vulnerability'
            }
          ],
          deprecatedPackages: [
            {
              name: 'moment',
              currentVersion: '2.29.4',
              reason: 'Project is in maintenance mode',
              replacement: 'dayjs'
            }
          ]
        },
        codeQuality: {
          lintIssues: 45,
          duplicatedCode: [
            {
              pattern: 'exact-match utility pattern',
              locations: ['utils.js', 'helpers.js', 'common.js', 'shared.js', 'lib.js'],
              similarity: 0.98
            }
          ],
          complexityHotspots: [
            {
              file: 'legacy-processor.js',
              cyclomaticComplexity: 75,
              cognitiveComplexity: 88,
              lineCount: 1200,
              functionName: 'processLegacyData'
            }
          ],
          codeSmells: [
            {
              file: 'god-class.js',
              type: 'god-class',
              severity: 'critical',
              line: 1,
              description: 'Class with 50+ methods and responsibilities',
              suggestion: 'Break into smaller, focused classes'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(legacyAnalysis);

      expect(candidates.length).toBeGreaterThan(8); // Should generate many candidates

      // Should have candidates for all major debt categories
      const candidateIds = candidates.map(c => c.candidateId);
      expect(candidateIds).toContain('technical-debt-critical-complexity');
      expect(candidateIds).toContain('technical-debt-deprecated-dependencies');
      expect(candidateIds).toContain('technical-debt-major-version-updates');
      expect(candidateIds).toContain('technical-debt-test-coverage');
      expect(candidateIds).toContain('technical-debt-critical-code-smells');
      expect(candidateIds).toContain('technical-debt-code-duplication');

      // Verify priority assignment is appropriate for legacy codebase
      const criticalCandidates = candidates.filter(c => c.priority === 'critical' || c.priority === 'high');
      expect(criticalCandidates.length).toBeGreaterThan(0);
    });

    it('should handle a well-maintained modern codebase', () => {
      const modernAnalysis: ProjectAnalysis = {
        ...baseAnalysis,
        testCoverage: {
          percentage: 95,
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
          lintIssues: 2, // Very few issues
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        }
      };

      const candidates = analyzer.analyze(modernAnalysis);

      // Should generate few or no candidates for well-maintained codebase
      expect(candidates.length).toBeLessThan(3);

      // Any remaining candidates should be low priority
      const hasHighPriority = candidates.some(c =>
        c.priority === 'critical' || c.priority === 'high'
      );
      expect(hasHighPriority).toBe(false);
    });

    it('should handle microservice with focused concerns', () => {
      const microserviceAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 8,
          lines: 800,
          languages: { typescript: 800 }
        },
        testCoverage: {
          percentage: 88,
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
          lintIssues: 1,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        },
        documentation: baseAnalysis.documentation,
        performance: baseAnalysis.performance,
        testAnalysis: baseAnalysis.testAnalysis
      };

      const candidates = analyzer.analyze(microserviceAnalysis);

      // Small, focused service should have minimal technical debt
      expect(candidates.length).toBeLessThan(2);
    });
  });

  describe('TechnicalDebtAnalysis schema compliance', () => {
    it('should create analysis that validates against schema', async () => {
      const { TechnicalDebtAnalysisSchema } = await import('@apexcli/core');

      const complexAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          lintIssues: 10,
          duplicatedCode: [
            {
              pattern: 'similar-structure code block',
              locations: ['a.ts', 'b.ts', 'c.ts'],
              similarity: 0.85
            }
          ],
          complexityHotspots: [
            {
              file: 'complex.ts',
              cyclomaticComplexity: 35,
              cognitiveComplexity: 45,
              lineCount: 600,
              functionName: 'complexFunction'
            }
          ],
          codeSmells: [
            {
              file: 'smelly.ts',
              type: 'long-method',
              severity: 'medium' as const,
              line: 42,
              description: 'Method too long',
              suggestion: 'Break into smaller methods'
            }
          ]
        },
        testCoverage: {
          percentage: 65,
          uncoveredFiles: ['uncovered.ts']
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(complexAnalysis);

      // Should validate without throwing
      expect(() => TechnicalDebtAnalysisSchema.parse(analysis)).not.toThrow();

      const validated = TechnicalDebtAnalysisSchema.parse(analysis);
      expect(validated).toEqual(analysis);
    });

    it('should ensure all required schema fields are present', () => {
      const analysis = analyzer.createTechnicalDebtAnalysis(baseAnalysis);

      // Check top-level required fields
      expect(analysis).toHaveProperty('totalScore');
      expect(analysis).toHaveProperty('categories');
      expect(analysis).toHaveProperty('hotspots');
      expect(analysis).toHaveProperty('metrics');
      expect(analysis).toHaveProperty('trends');

      // Check score is within bounds
      expect(analysis.totalScore).toBeGreaterThanOrEqual(0);
      expect(analysis.totalScore).toBeLessThanOrEqual(100);

      // Check categories structure
      expect(Array.isArray(analysis.categories)).toBe(true);
      analysis.categories.forEach(category => {
        expect(category).toHaveProperty('category');
        expect(category).toHaveProperty('count');
        expect(category).toHaveProperty('severity');
        expect(category).toHaveProperty('examples');
        expect(category).toHaveProperty('estimatedEffort');
      });

      // Check hotspots structure
      expect(Array.isArray(analysis.hotspots)).toBe(true);
      analysis.hotspots.forEach(hotspot => {
        expect(hotspot).toHaveProperty('path');
        expect(hotspot).toHaveProperty('score');
        expect(hotspot).toHaveProperty('issues');
        expect(hotspot).toHaveProperty('loc');
      });

      // Check metrics structure
      expect(analysis.metrics).toHaveProperty('codeComplexity');
      expect(analysis.metrics).toHaveProperty('testCoverage');
      expect(analysis.metrics).toHaveProperty('duplicatedLinesPercent');
      expect(analysis.metrics).toHaveProperty('maintainabilityIndex');

      // Check trends structure
      expect(analysis.trends).toHaveProperty('improving');
      expect(analysis.trends).toHaveProperty('changeRate');
      expect(analysis.trends).toHaveProperty('timeframe');
    });
  });

  describe('Edge case validation', () => {
    it('should handle extreme debt scenarios gracefully', () => {
      const extremeAnalysis: ProjectAnalysis = {
        ...baseAnalysis,
        dependencies: {
          outdated: Array(200).fill('outdated-package'),
          security: Array(50).fill('vulnerable-package'),
          outdatedPackages: Array(100).fill({
            name: 'extreme-outdated',
            currentVersion: '0.1.0',
            latestVersion: '5.0.0',
            updateType: 'major'
          }),
          securityIssues: Array(25).fill({
            name: 'critical-vuln',
            cveId: 'CVE-2023-12345',
            severity: 'critical',
            affectedVersions: '<2.0.0',
            description: 'Critical security vulnerability'
          }),
          deprecatedPackages: Array(10).fill({
            name: 'deprecated',
            currentVersion: '1.0.0',
            reason: 'Deprecated',
            replacement: 'new-package'
          })
        },
        codeQuality: {
          lintIssues: 500,
          duplicatedCode: Array(20).fill({
            pattern: 'exact-match duplicate code',
            locations: Array(10).fill('duplicate-file.ts'),
            similarity: 1.0
          }),
          complexityHotspots: Array(50).fill({
            file: 'super-complex.ts',
            cyclomaticComplexity: 150,
            cognitiveComplexity: 200,
            lineCount: 5000,
            functionName: 'extremeFunction'
          }),
          codeSmells: Array(100).fill({
            file: 'smelly.ts',
            type: 'god-class',
            severity: 'critical',
            line: 1,
            description: 'Extreme code smell',
            suggestion: 'Complete rewrite needed'
          })
        },
        testCoverage: {
          percentage: 5,
          uncoveredFiles: Array(200).fill('uncovered.ts')
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(extremeAnalysis);

      // Score should be capped at 100
      expect(analysis.totalScore).toBe(100);

      // Should still produce valid structure
      expect(analysis.categories.length).toBeGreaterThan(0);
      expect(analysis.hotspots.length).toBeGreaterThan(0);

      // Metrics should be reasonable despite extreme input
      expect(analysis.metrics.maintainabilityIndex).toBeGreaterThanOrEqual(0);
      expect(analysis.metrics.testCoverage).toBe(5);
    });

    it('should handle completely empty analysis', () => {
      const emptyAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 0,
          lines: 0,
          languages: {}
        },
        testCoverage: null,
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
          branchCoverage: null,
          antiPatterns: [],
          untestedExports: []
        }
      };

      expect(() => analyzer.analyze(emptyAnalysis)).not.toThrow();
      expect(() => analyzer.createTechnicalDebtAnalysis(emptyAnalysis)).not.toThrow();

      const analysis = analyzer.createTechnicalDebtAnalysis(emptyAnalysis);
      expect(analysis.totalScore).toBeGreaterThanOrEqual(0);
      expect(analysis.categories).toEqual([]);
      expect(analysis.hotspots).toEqual([]);
    });
  });

  describe('Performance and scalability', () => {
    it('should handle analysis of large projects efficiently', () => {
      const startTime = Date.now();

      // Create analysis for a very large project
      const largeProjectAnalysis: ProjectAnalysis = {
        ...baseAnalysis,
        codebaseSize: {
          files: 5000,
          lines: 500000,
          languages: { typescript: 300000, javascript: 200000 }
        },
        codeQuality: {
          lintIssues: 1000,
          duplicatedCode: Array(100).fill({
            pattern: 'exact-match duplicate pattern',
            locations: Array(5).fill('file.ts'),
            similarity: 0.95
          }),
          complexityHotspots: Array(200).fill({
            file: 'complex.ts',
            cyclomaticComplexity: 25,
            cognitiveComplexity: 30,
            lineCount: 300,
            functionName: 'function'
          }),
          codeSmells: Array(300).fill({
            file: 'smell.ts',
            type: 'code-smell',
            severity: 'medium',
            line: 1,
            description: 'Code smell',
            suggestion: 'Fix it'
          })
        }
      };

      const candidates = analyzer.analyze(largeProjectAnalysis);
      const analysis = analyzer.createTechnicalDebtAnalysis(largeProjectAnalysis);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (less than 500ms)
      expect(duration).toBeLessThan(500);

      // Should still produce valid results
      expect(candidates.length).toBeGreaterThan(0);
      expect(analysis.totalScore).toBeGreaterThan(0);
      expect(analysis.categories.length).toBeGreaterThan(0);
    });
  });

  describe('Integration with existing RefactoringAnalyzer', () => {
    it('should integrate properly with RefactoringAnalyzer complexity data', () => {
      const refactoringIntegratedAnalysis: ProjectAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: [],
          complexityHotspots: [
            {
              file: 'refactoring-target.ts',
              cyclomaticComplexity: 45,
              cognitiveComplexity: 55,
              lineCount: 800,
              functionName: 'needsRefactoring'
            }
          ],
          codeSmells: []
        }
      };

      const candidates = analyzer.analyze(refactoringIntegratedAnalysis);
      const complexityCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-high-complexity'
      );

      expect(complexityCandidate).toBeDefined();
      expect(complexityCandidate?.workflow).toBe('refactoring');
      expect(complexityCandidate?.description).toContain('high complexity');
    });
  });

  describe('Severity scoring validation', () => {
    it('should assign appropriate severity scores across debt categories', () => {
      const mixedSeverityAnalysis: ProjectAnalysis = {
        ...baseAnalysis,
        dependencies: {
          outdated: ['minor-update'],
          security: [],
          outdatedPackages: [
            {
              name: 'minor-update',
              currentVersion: '1.0.0',
              latestVersion: '1.1.0',
              updateType: 'minor'
            }
          ],
          securityIssues: [
            {
              name: 'critical-security',
              cveId: 'CVE-2023-67890',
              severity: 'critical',
              affectedVersions: '<1.5.0',
              description: 'Critical vulnerability'
            }
          ],
          deprecatedPackages: []
        },
        codeQuality: {
          lintIssues: 5, // Low number
          duplicatedCode: [],
          complexityHotspots: [
            {
              file: 'medium-complexity.ts',
              cyclomaticComplexity: 35,
              cognitiveComplexity: 42,
              lineCount: 400,
              functionName: 'mediumFunction'
            }
          ],
          codeSmells: [
            {
              file: 'low-smell.ts',
              type: 'naming',
              severity: 'low',
              line: 10,
              description: 'Poor variable naming',
              suggestion: 'Use descriptive names'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(mixedSeverityAnalysis);

      // Verify security issues get highest priority
      const securityCandidate = candidates.find(c =>
        c.description.toLowerCase().includes('security')
      );
      if (securityCandidate) {
        expect(['critical', 'high']).toContain(securityCandidate.priority);
      }

      // Verify complexity gets medium priority
      const complexityCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-high-complexity'
      );
      if (complexityCandidate) {
        expect(['medium', 'normal']).toContain(complexityCandidate.priority);
      }

      // Verify low-severity issues get low priority
      const todoCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-todo-comments'
      );
      if (todoCandidate) {
        expect(todoCandidate.priority).toBe('low');
      }
    });
  });

  describe('Remediation suggestions validation', () => {
    it('should provide appropriate remediation suggestions for all debt types', () => {
      const comprehensiveAnalysis: ProjectAnalysis = {
        ...baseAnalysis,
        dependencies: {
          outdated: ['package1'],
          security: [],
          outdatedPackages: [
            {
              name: 'package1',
              currentVersion: '1.0.0',
              latestVersion: '2.0.0',
              updateType: 'major'
            }
          ],
          securityIssues: [],
          deprecatedPackages: [
            {
              name: 'deprecated-lib',
              currentVersion: '1.0.0',
              reason: 'No longer maintained',
              replacement: 'modern-lib'
            }
          ]
        },
        codeQuality: {
          lintIssues: 10,
          duplicatedCode: [
            {
              pattern: 'exact-match code block',
              locations: ['a.ts', 'b.ts', 'c.ts'],
              similarity: 1.0
            }
          ],
          complexityHotspots: [
            {
              file: 'complex.ts',
              cyclomaticComplexity: 55,
              cognitiveComplexity: 65,
              lineCount: 1000,
              functionName: 'complexFunction'
            }
          ],
          codeSmells: []
        },
        testCoverage: {
          percentage: 45,
          uncoveredFiles: ['test1.ts', 'test2.ts']
        }
      };

      const candidates = analyzer.analyze(comprehensiveAnalysis);

      // Every candidate should have remediation suggestions
      candidates.forEach(candidate => {
        expect(candidate.remediationSuggestions).toBeDefined();
        expect(Array.isArray(candidate.remediationSuggestions)).toBe(true);
        expect(candidate.remediationSuggestions!.length).toBeGreaterThan(0);

        // Check structure of remediation suggestions
        candidate.remediationSuggestions!.forEach(suggestion => {
          expect(suggestion).toHaveProperty('type');
          expect(suggestion).toHaveProperty('description');
          expect(suggestion).toHaveProperty('priority');
          expect(suggestion).toHaveProperty('expectedOutcome');
        });
      });

      // Verify specific remediation types are used appropriately
      const deprecatedCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-deprecated-dependencies'
      );
      if (deprecatedCandidate) {
        const hasPackageReplacement = deprecatedCandidate.remediationSuggestions!.some(s =>
          s.type === 'package_replacement'
        );
        expect(hasPackageReplacement).toBe(true);
      }

      const outdatedCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-outdated-dependencies'
      );
      if (outdatedCandidate) {
        const hasNpmUpdate = outdatedCandidate.remediationSuggestions!.some(s =>
          s.type === 'npm_update'
        );
        expect(hasNpmUpdate).toBe(true);
      }

      const testingCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-test-coverage'
      );
      if (testingCandidate) {
        const hasTesting = testingCandidate.remediationSuggestions!.some(s =>
          s.type === 'testing'
        );
        expect(hasTesting).toBe(true);
      }
    });
  });

  describe('Error recovery and robustness', () => {
    it('should handle corrupted analysis data gracefully', () => {
      const corruptedAnalysis = {
        ...baseAnalysis,
        // Intentionally corrupt some data
        codeQuality: {
          lintIssues: null as any,
          duplicatedCode: 'not-an-array' as any,
          complexityHotspots: [{ invalid: 'data' }] as any,
          codeSmells: undefined as any
        },
        dependencies: {
          outdated: null as any,
          security: undefined as any,
          outdatedPackages: 'corrupted' as any,
          securityIssues: { not: 'array' } as any,
          deprecatedPackages: [{ malformed: true }] as any
        }
      };

      // Should not throw despite corrupted data
      expect(() => analyzer.analyze(corruptedAnalysis)).not.toThrow();
      expect(() => analyzer.createTechnicalDebtAnalysis(corruptedAnalysis)).not.toThrow();

      const candidates = analyzer.analyze(corruptedAnalysis);
      expect(Array.isArray(candidates)).toBe(true);

      const analysis = analyzer.createTechnicalDebtAnalysis(corruptedAnalysis);
      expect(typeof analysis.totalScore).toBe('number');
    });

    it('should handle missing nested properties', () => {
      const incompleteAnalysis = {
        codebaseSize: baseAnalysis.codebaseSize,
        // Missing most properties
        testCoverage: undefined,
        dependencies: {
          outdated: [],
          security: []
          // Missing other dependency fields
        },
        codeQuality: {
          lintIssues: 0
          // Missing other code quality fields
        }
      } as any;

      expect(() => analyzer.analyze(incompleteAnalysis)).not.toThrow();
      expect(() => analyzer.createTechnicalDebtAnalysis(incompleteAnalysis)).not.toThrow();
    });
  });
});
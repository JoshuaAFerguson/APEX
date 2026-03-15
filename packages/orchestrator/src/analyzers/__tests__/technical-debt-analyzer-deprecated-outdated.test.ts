/**
 * Technical Debt Analyzer - Deprecated and Outdated Dependencies Tests
 *
 * Comprehensive tests for deprecated code and outdated dependency detection functionality.
 * Tests the implementation of deprecated packages and outdated dependencies processing
 * from ProjectAnalysis.dependencies, mapping to TechnicalDebtAnalysis categories
 * including the 'outdated-dependency' category and hotspots creation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TechnicalDebtAnalyzer } from '../technical-debt-analyzer';
import type { ProjectAnalysis } from '../../idle-processor';
import type { DeprecatedPackage, OutdatedDependency, SecurityVulnerability } from '../../idle-processor';
import type { TechnicalDebtAnalysis } from '@apexcli/core';

describe('TechnicalDebtAnalyzer - Deprecated and Outdated Dependencies', () => {
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
        },
        outdatedDocs: []
      },
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

  describe('analyzeDeprecatedPackages', () => {
    it('should detect deprecated packages and create appropriate task candidates', () => {
      const analysisWithDeprecated: ProjectAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          deprecatedPackages: [
            {
              name: 'moment',
              currentVersion: '2.29.4',
              reason: 'Project is in maintenance mode. Consider using dayjs or date-fns instead.',
              replacement: 'dayjs'
            },
            {
              name: 'request',
              currentVersion: '2.88.2',
              reason: 'Deprecated. Use axios, node-fetch, or built-in fetch instead.',
              replacement: 'axios'
            },
            {
              name: 'gulp-util',
              currentVersion: '3.0.8',
              reason: 'Deprecated. Use individual utilities instead.',
              replacement: null
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithDeprecated);
      const deprecatedCandidate = candidates.find(c => c.candidateId === 'technical-debt-deprecated-dependencies');

      expect(deprecatedCandidate).toBeDefined();
      expect(deprecatedCandidate?.title).toBe('Replace Deprecated Packages');
      expect(deprecatedCandidate?.description).toContain('3 deprecated packages');
      expect(deprecatedCandidate?.priority).toBe('normal');
      expect(deprecatedCandidate?.estimatedEffort).toBe('high');
      expect(deprecatedCandidate?.suggestedWorkflow).toBe('maintenance');
      expect(deprecatedCandidate?.rationale).toContain('Deprecated packages lack security updates');

      // Verify remediation suggestions
      expect(deprecatedCandidate?.remediationSuggestions).toHaveLength(3);

      const momentSuggestion = deprecatedCandidate?.remediationSuggestions?.find(s => s.description.includes('moment'));
      expect(momentSuggestion).toBeDefined();
      expect(momentSuggestion?.type).toBe('package_replacement');
      expect(momentSuggestion?.description).toContain('Replace moment with dayjs');
      expect(momentSuggestion?.priority).toBe('medium');
      expect(momentSuggestion?.link).toBe('https://www.npmjs.com/package/dayjs');

      const requestSuggestion = deprecatedCandidate?.remediationSuggestions?.find(s => s.description.includes('request'));
      expect(requestSuggestion).toBeDefined();
      expect(requestSuggestion?.description).toContain('Replace request with axios');

      const gulpUtilSuggestion = deprecatedCandidate?.remediationSuggestions?.find(s => s.description.includes('gulp-util'));
      expect(gulpUtilSuggestion).toBeDefined();
      expect(gulpUtilSuggestion?.description).toContain('Replace gulp-util with modern alternative');
    });

    it('should assign higher priority for many deprecated packages', () => {
      const analysisWithManyDeprecated: ProjectAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          deprecatedPackages: Array(8).fill({
            name: 'deprecated-package',
            currentVersion: '1.0.0',
            reason: 'Package is deprecated',
            replacement: 'new-package'
          }).map((pkg, index) => ({
            ...pkg,
            name: `deprecated-package-${index}`
          }))
        }
      };

      const candidates = analyzer.analyze(analysisWithManyDeprecated);
      const deprecatedCandidate = candidates.find(c => c.candidateId === 'technical-debt-deprecated-dependencies');

      expect(deprecatedCandidate).toBeDefined();
      expect(deprecatedCandidate?.priority).toBe('high');
      expect(deprecatedCandidate?.description).toContain('8 deprecated packages');
    });

    it('should handle deprecated packages without replacement', () => {
      const analysisWithNoReplacement: ProjectAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          deprecatedPackages: [
            {
              name: 'legacy-package',
              currentVersion: '1.0.0',
              reason: 'No longer maintained',
              replacement: null
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithNoReplacement);
      const deprecatedCandidate = candidates.find(c => c.candidateId === 'technical-debt-deprecated-dependencies');

      expect(deprecatedCandidate).toBeDefined();
      const suggestion = deprecatedCandidate?.remediationSuggestions?.[0];
      expect(suggestion?.description).toContain('Replace legacy-package with modern alternative');
      expect(suggestion?.link).toBeUndefined();
    });

    it('should not create candidates when no deprecated packages exist', () => {
      const candidates = analyzer.analyze(baseAnalysis);
      const deprecatedCandidate = candidates.find(c => c.candidateId === 'technical-debt-deprecated-dependencies');

      expect(deprecatedCandidate).toBeUndefined();
    });

    it('should handle empty deprecatedPackages array', () => {
      const analysisWithEmptyDeprecated: ProjectAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          deprecatedPackages: []
        }
      };

      const candidates = analyzer.analyze(analysisWithEmptyDeprecated);
      const deprecatedCandidate = candidates.find(c => c.candidateId === 'technical-debt-deprecated-dependencies');

      expect(deprecatedCandidate).toBeUndefined();
    });
  });

  describe('analyzeOutdatedDependencies', () => {
    it('should detect major version updates and create high-effort candidates', () => {
      const analysisWithMajorUpdates: ProjectAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          outdatedPackages: [
            {
              name: 'react',
              currentVersion: '16.14.0',
              latestVersion: '18.2.0',
              updateType: 'major'
            },
            {
              name: 'typescript',
              currentVersion: '4.9.5',
              latestVersion: '5.3.3',
              updateType: 'major'
            },
            {
              name: '@types/node',
              currentVersion: '18.19.0',
              latestVersion: '20.10.0',
              updateType: 'major'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithMajorUpdates);
      const majorCandidate = candidates.find(c => c.candidateId === 'technical-debt-major-version-updates');

      expect(majorCandidate).toBeDefined();
      expect(majorCandidate?.title).toBe('Plan Major Dependency Updates');
      expect(majorCandidate?.description).toContain('3 dependencies with major version updates');
      expect(majorCandidate?.priority).toBe('normal');
      expect(majorCandidate?.estimatedEffort).toBe('high');
      expect(majorCandidate?.suggestedWorkflow).toBe('maintenance');
      expect(majorCandidate?.rationale).toContain('Major updates provide new features and security fixes');

      // Verify remediation suggestions for major updates
      expect(majorCandidate?.remediationSuggestions).toHaveLength(2);

      const migrationSuggestion = majorCandidate?.remediationSuggestions?.find(s => s.type === 'migration_guide');
      expect(migrationSuggestion).toBeDefined();
      expect(migrationSuggestion?.description).toContain('Review breaking changes and migration guides');
      expect(migrationSuggestion?.priority).toBe('high');

      const testingSuggestion = majorCandidate?.remediationSuggestions?.find(s => s.type === 'testing');
      expect(testingSuggestion).toBeDefined();
      expect(testingSuggestion?.description).toContain('Thoroughly test after major updates');
      expect(testingSuggestion?.priority).toBe('high');
    });

    it('should detect minor and patch updates and create low-effort candidates', () => {
      const analysisWithMinorUpdates: ProjectAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          outdatedPackages: [
            {
              name: 'lodash',
              currentVersion: '4.17.20',
              latestVersion: '4.17.21',
              updateType: 'patch'
            },
            {
              name: 'axios',
              currentVersion: '1.4.0',
              latestVersion: '1.6.2',
              updateType: 'minor'
            },
            {
              name: 'express',
              currentVersion: '4.18.2',
              latestVersion: '4.18.3',
              updateType: 'patch'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithMinorUpdates);
      const minorCandidate = candidates.find(c => c.candidateId === 'technical-debt-outdated-dependencies');

      expect(minorCandidate).toBeDefined();
      expect(minorCandidate?.title).toBe('Update Minor Dependencies');
      expect(minorCandidate?.description).toContain('3 dependencies with minor/patch updates');
      expect(minorCandidate?.priority).toBe('low');
      expect(minorCandidate?.estimatedEffort).toBe('low');
      expect(minorCandidate?.suggestedWorkflow).toBe('maintenance');

      // Verify remediation suggestions for minor/patch updates
      expect(minorCandidate?.remediationSuggestions).toHaveLength(1);

      const updateSuggestion = minorCandidate?.remediationSuggestions?.[0];
      expect(updateSuggestion?.type).toBe('npm_update');
      expect(updateSuggestion?.description).toBe('Update to latest minor/patch versions');
      expect(updateSuggestion?.priority).toBe('low');
      expect(updateSuggestion?.command).toBe('npm update');
    });

    it('should create separate candidates for major and minor updates', () => {
      const analysisWithMixedUpdates: ProjectAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          outdatedPackages: [
            // Major updates
            {
              name: 'react',
              currentVersion: '17.0.2',
              latestVersion: '18.2.0',
              updateType: 'major'
            },
            {
              name: 'vue',
              currentVersion: '2.7.14',
              latestVersion: '3.3.8',
              updateType: 'major'
            },
            // Minor/patch updates
            {
              name: 'lodash',
              currentVersion: '4.17.20',
              latestVersion: '4.17.21',
              updateType: 'patch'
            },
            {
              name: 'axios',
              currentVersion: '1.4.0',
              latestVersion: '1.6.0',
              updateType: 'minor'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithMixedUpdates);

      const majorCandidate = candidates.find(c => c.candidateId === 'technical-debt-major-version-updates');
      const minorCandidate = candidates.find(c => c.candidateId === 'technical-debt-outdated-dependencies');

      expect(majorCandidate).toBeDefined();
      expect(majorCandidate?.description).toContain('2 dependencies with major version updates');

      expect(minorCandidate).toBeDefined();
      expect(minorCandidate?.description).toContain('2 dependencies with minor/patch updates');
    });

    it('should not create candidates when no outdated packages exist', () => {
      const candidates = analyzer.analyze(baseAnalysis);
      const majorCandidate = candidates.find(c => c.candidateId === 'technical-debt-major-version-updates');
      const minorCandidate = candidates.find(c => c.candidateId === 'technical-debt-outdated-dependencies');

      expect(majorCandidate).toBeUndefined();
      expect(minorCandidate).toBeUndefined();
    });

    it('should handle mixed update types correctly', () => {
      const analysisWithMixedTypes: ProjectAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          outdatedPackages: [
            {
              name: 'package-major',
              currentVersion: '1.0.0',
              latestVersion: '2.0.0',
              updateType: 'major'
            },
            {
              name: 'package-minor',
              currentVersion: '1.0.0',
              latestVersion: '1.1.0',
              updateType: 'minor'
            },
            {
              name: 'package-patch',
              currentVersion: '1.0.0',
              latestVersion: '1.0.1',
              updateType: 'patch'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithMixedTypes);

      const majorCandidate = candidates.find(c => c.candidateId === 'technical-debt-major-version-updates');
      expect(majorCandidate?.description).toContain('1 dependencies with major version updates');

      const minorCandidate = candidates.find(c => c.candidateId === 'technical-debt-outdated-dependencies');
      expect(minorCandidate?.description).toContain('2 dependencies with minor/patch updates');
    });
  });

  describe('analyzeOutdatedDocumentation', () => {
    it('should detect outdated documentation from documentation analysis', () => {
      const analysisWithOutdatedDocs: ProjectAnalysis = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: [
            {
              file: 'README.md',
              type: 'version-mismatch',
              description: 'Documentation references API v1.0, but current version is v2.0',
              line: 25,
              severity: 'high',
              suggestion: 'Update API version references to v2.0'
            },
            {
              file: 'docs/api.md',
              type: 'deprecated-api',
              description: 'References deprecated authenticate() method',
              line: 105,
              severity: 'medium',
              suggestion: 'Replace with new login() method'
            },
            {
              file: 'docs/examples.md',
              type: 'stale-reference',
              description: 'Example uses old package name @company/old-sdk',
              severity: 'low',
              suggestion: 'Update to new package name @company/new-sdk'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithOutdatedDocs);

      // Should create two candidates: critical and non-critical outdated docs
      const criticalCandidate = candidates.find(c => c.candidateId === 'technical-debt-critical-outdated-docs');
      const regularCandidate = candidates.find(c => c.candidateId === 'technical-debt-outdated-documentation');

      expect(criticalCandidate).toBeDefined();
      expect(criticalCandidate?.priority).toBe('critical');
      expect(criticalCandidate?.description).toContain('1 critical outdated documentation issues');

      expect(regularCandidate).toBeDefined();
      expect(regularCandidate?.priority).toBe('normal');
      expect(regularCandidate?.description).toContain('2 outdated documentation issues (1 medium, 1 low severity)');
    });
  });

  describe('TechnicalDebtAnalysis integration', () => {
    it('should include outdated-dependency category in debt analysis', () => {
      const analysisWithOutdatedDeps: ProjectAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          outdatedPackages: [
            {
              name: 'react',
              currentVersion: '16.0.0',
              latestVersion: '18.2.0',
              updateType: 'major'
            },
            {
              name: 'lodash',
              currentVersion: '4.17.20',
              latestVersion: '4.17.21',
              updateType: 'patch'
            }
          ],
          deprecatedPackages: [
            {
              name: 'moment',
              currentVersion: '2.29.4',
              reason: 'In maintenance mode',
              replacement: 'dayjs'
            }
          ]
        }
      };

      const technicalDebtAnalysis = analyzer.createTechnicalDebtAnalysis(analysisWithOutdatedDeps);

      // Should have outdated-dependency category
      const outdatedCategory = technicalDebtAnalysis.categories.find(c => c.category === 'outdated-dependency');
      expect(outdatedCategory).toBeDefined();
      expect(outdatedCategory?.count).toBe(2); // 2 outdated packages
      expect(outdatedCategory?.severity).toBe('medium'); // 1 major update = medium severity
      expect(outdatedCategory?.examples).toContain('react: 16.0.0 → 18.2.0');
      expect(outdatedCategory?.examples).toContain('lodash: 4.17.20 → 4.17.21');
      expect(outdatedCategory?.estimatedEffort).toBe('1 day'); // 1 major update
    });

    it('should calculate total debt score including outdated dependencies', () => {
      const analysisWithOutdatedDeps: ProjectAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          outdatedPackages: [
            {
              name: 'package1',
              currentVersion: '1.0.0',
              latestVersion: '2.0.0',
              updateType: 'major'
            },
            {
              name: 'package2',
              currentVersion: '1.0.0',
              latestVersion: '3.0.0',
              updateType: 'major'
            }
          ]
        }
      };

      const technicalDebtAnalysis = analyzer.createTechnicalDebtAnalysis(analysisWithOutdatedDeps);

      // Should contribute to total score through outdated-dependency category weight (0.08)
      expect(technicalDebtAnalysis.totalScore).toBeGreaterThan(0);
      expect(technicalDebtAnalysis.totalScore).toBeLessThan(100);
    });

    it('should assign higher severity for many major updates', () => {
      const analysisWithManyMajorUpdates: ProjectAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          outdatedPackages: Array(8).fill(null).map((_, index) => ({
            name: `package-${index}`,
            currentVersion: '1.0.0',
            latestVersion: '2.0.0',
            updateType: 'major' as const
          }))
        }
      };

      const technicalDebtAnalysis = analyzer.createTechnicalDebtAnalysis(analysisWithManyMajorUpdates);
      const outdatedCategory = technicalDebtAnalysis.categories.find(c => c.category === 'outdated-dependency');

      expect(outdatedCategory).toBeDefined();
      expect(outdatedCategory?.severity).toBe('high'); // > 5 major updates
      expect(outdatedCategory?.estimatedEffort).toBe('2-3 days');
    });

    it('should create hotspots for files with deprecated dependencies when metadata available', () => {
      // Note: This would require additional metadata in the analysis about which files use which dependencies
      // For now, we test that the analyzer handles the case gracefully
      const analysisWithDeprecated: ProjectAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          deprecatedPackages: [
            {
              name: 'moment',
              currentVersion: '2.29.4',
              reason: 'In maintenance mode',
              replacement: 'dayjs'
            }
          ]
        }
      };

      const technicalDebtAnalysis = analyzer.createTechnicalDebtAnalysis(analysisWithDeprecated);

      // Should not crash and should process successfully
      expect(technicalDebtAnalysis.hotspots).toBeDefined();
      expect(Array.isArray(technicalDebtAnalysis.hotspots)).toBe(true);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle null/undefined deprecatedPackages gracefully', () => {
      const analysisWithNullDeprecated: ProjectAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          deprecatedPackages: undefined as any
        }
      };

      expect(() => analyzer.analyze(analysisWithNullDeprecated)).not.toThrow();
      const candidates = analyzer.analyze(analysisWithNullDeprecated);
      const deprecatedCandidate = candidates.find(c => c.candidateId === 'technical-debt-deprecated-dependencies');
      expect(deprecatedCandidate).toBeUndefined();
    });

    it('should handle null/undefined outdatedPackages gracefully', () => {
      const analysisWithNullOutdated: ProjectAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          outdatedPackages: undefined as any
        }
      };

      expect(() => analyzer.analyze(analysisWithNullOutdated)).not.toThrow();
      const candidates = analyzer.analyze(analysisWithNullOutdated);
      const majorCandidate = candidates.find(c => c.candidateId === 'technical-debt-major-version-updates');
      const minorCandidate = candidates.find(c => c.candidateId === 'technical-debt-outdated-dependencies');

      expect(majorCandidate).toBeUndefined();
      expect(minorCandidate).toBeUndefined();
    });

    it('should handle missing updateType in outdated packages', () => {
      const analysisWithMissingUpdateType: ProjectAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          outdatedPackages: [
            {
              name: 'package-without-type',
              currentVersion: '1.0.0',
              latestVersion: '1.1.0',
              updateType: undefined as any
            }
          ]
        }
      };

      expect(() => analyzer.analyze(analysisWithMissingUpdateType)).not.toThrow();
      const candidates = analyzer.analyze(analysisWithMissingUpdateType);

      // Should handle gracefully - package without updateType should not be categorized
      const majorCandidate = candidates.find(c => c.candidateId === 'technical-debt-major-version-updates');
      const minorCandidate = candidates.find(c => c.candidateId === 'technical-debt-outdated-dependencies');

      expect(majorCandidate).toBeUndefined();
      expect(minorCandidate).toBeUndefined();
    });

    it('should handle deprecated packages with missing replacement gracefully', () => {
      const analysisWithMissingReplacement: ProjectAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          deprecatedPackages: [
            {
              name: 'abandoned-package',
              currentVersion: '1.0.0',
              reason: 'No longer maintained',
              replacement: undefined as any
            }
          ]
        }
      };

      expect(() => analyzer.analyze(analysisWithMissingReplacement)).not.toThrow();
      const candidates = analyzer.analyze(analysisWithMissingReplacement);
      const deprecatedCandidate = candidates.find(c => c.candidateId === 'technical-debt-deprecated-dependencies');

      expect(deprecatedCandidate).toBeDefined();
      const suggestion = deprecatedCandidate?.remediationSuggestions?.[0];
      expect(suggestion?.description).toContain('modern alternative');
    });

    it('should handle entirely missing dependencies object', () => {
      const analysisWithoutDependencies: ProjectAnalysis = {
        ...baseAnalysis,
        dependencies: undefined as any
      };

      expect(() => analyzer.analyze(analysisWithoutDependencies)).not.toThrow();
      expect(() => analyzer.createTechnicalDebtAnalysis(analysisWithoutDependencies)).not.toThrow();
    });
  });

  describe('Scoring and prioritization', () => {
    it('should assign correct scores based on number and severity of issues', () => {
      const analysisWithDeprecatedAndOutdated: ProjectAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          deprecatedPackages: [
            {
              name: 'moment',
              currentVersion: '2.29.4',
              reason: 'Maintenance mode',
              replacement: 'dayjs'
            }
          ],
          outdatedPackages: [
            {
              name: 'react',
              currentVersion: '16.0.0',
              latestVersion: '18.2.0',
              updateType: 'major'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithDeprecatedAndOutdated);

      const deprecatedCandidate = candidates.find(c => c.candidateId === 'technical-debt-deprecated-dependencies');
      const majorCandidate = candidates.find(c => c.candidateId === 'technical-debt-major-version-updates');

      expect(deprecatedCandidate?.score).toBeGreaterThan(0);
      expect(majorCandidate?.score).toBeGreaterThan(0);

      // Deprecated packages should generally have higher score than major updates
      expect(deprecatedCandidate?.score).toBeGreaterThan(majorCandidate?.score);
    });

    it('should respect the defined score calculations', () => {
      const analysisWithManyDeprecated: ProjectAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          deprecatedPackages: Array(10).fill({
            name: 'deprecated-pkg',
            currentVersion: '1.0.0',
            reason: 'Deprecated',
            replacement: 'new-pkg'
          }).map((pkg, i) => ({ ...pkg, name: `deprecated-pkg-${i}` }))
        }
      };

      const candidates = analyzer.analyze(analysisWithManyDeprecated);
      const deprecatedCandidate = candidates.find(c => c.candidateId === 'technical-debt-deprecated-dependencies');

      expect(deprecatedCandidate).toBeDefined();
      // Score should be 0.7 + (10 * 0.02) = 0.9
      expect(deprecatedCandidate?.score).toBeCloseTo(0.9, 1);
    });
  });
});
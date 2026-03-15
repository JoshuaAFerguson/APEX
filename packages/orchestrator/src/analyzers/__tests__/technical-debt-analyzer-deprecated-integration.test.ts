/**
 * Technical Debt Analyzer - Deprecated Code Integration Tests
 *
 * Integration tests verifying the complete deprecated code and outdated dependency
 * detection pipeline meets the acceptance criteria:
 * - Processes outdatedPackages and deprecatedPackages from ProjectAnalysis.dependencies
 * - Processes outdatedDocs from documentation analysis
 * - Maps to TechnicalDebtAnalysis categories with 'outdated-dependency' category
 * - Creates hotspots appropriately
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TechnicalDebtAnalyzer } from '../technical-debt-analyzer';
import type { ProjectAnalysis } from '../../idle-processor';
import type { DeprecatedPackage, OutdatedDependency } from '../../idle-processor';

describe('TechnicalDebtAnalyzer - Deprecated Code Integration', () => {
  let analyzer: TechnicalDebtAnalyzer;
  let comprehensiveAnalysis: ProjectAnalysis;

  beforeEach(() => {
    analyzer = new TechnicalDebtAnalyzer();

    // Comprehensive analysis with all deprecated/outdated scenarios
    comprehensiveAnalysis = {
      codebaseSize: {
        files: 200,
        lines: 25000,
        languages: { typescript: 20000, javascript: 5000 }
      },
      testCoverage: {
        percentage: 75,
        uncoveredFiles: ['legacy/old-utils.ts']
      },
      dependencies: {
        outdated: [],
        security: [],
        // Deprecated packages from package analysis
        deprecatedPackages: [
          {
            name: 'moment',
            currentVersion: '2.29.4',
            reason: 'Project is in maintenance mode. No new features will be added.',
            replacement: 'dayjs'
          },
          {
            name: 'request',
            currentVersion: '2.88.2',
            reason: 'Deprecated. Use axios, node-fetch, or built-in fetch.',
            replacement: 'axios'
          },
          {
            name: 'gulp-util',
            currentVersion: '3.0.8',
            reason: 'Deprecated. Use individual utility functions instead.',
            replacement: null
          }
        ],
        // Outdated packages from dependency analysis
        outdatedPackages: [
          // Major version updates
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
            latestVersion: '1.6.2',
            updateType: 'minor'
          }
        ],
        securityIssues: []
      },
      codeQuality: {
        lintIssues: 0,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: {
        coveragePercentage: 85,
        undocumentedExports: [],
        outdatedDocumentation: [],
        missingReadmeSections: [],
        apiCompleteness: {
          documented: 85,
          total: 100,
          coveragePercentage: 85
        },
        // Outdated docs including stale TODO/FIXME/HACK comments
        outdatedDocs: [
          // Stale-reference comments (deprecated code markers)
          {
            file: 'src/utils/date-helpers.ts',
            type: 'stale-reference',
            description: 'TODO: Replace moment.js with dayjs for better performance',
            line: 15,
            severity: 'high'
          },
          {
            file: 'src/api/legacy-client.ts',
            type: 'stale-reference',
            description: 'FIXME: request library is deprecated, causes security vulnerabilities',
            line: 45,
            severity: 'high'
          },
          {
            file: 'src/components/DatePicker.tsx',
            type: 'stale-reference',
            description: 'HACK: Workaround for moment timezone issues, replace when migrating',
            line: 78,
            severity: 'medium'
          },
          // Regular outdated documentation
          {
            file: 'README.md',
            type: 'version-mismatch',
            description: 'Documentation references React 16.x, but project uses React 18.x',
            line: 25,
            severity: 'medium'
          }
        ]
      },
      performance: {
        bundleSize: 4096,
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

  describe('Complete Deprecated/Outdated Detection Pipeline', () => {
    it('should process all deprecated/outdated scenarios and create appropriate task candidates', () => {
      const candidates = analyzer.analyze(comprehensiveAnalysis);

      // Should create task candidates for all detected deprecated/outdated issues
      const candidateIds = candidates.map(c => c.candidateId);

      // From deprecated packages
      expect(candidateIds).toContain('technical-debt-deprecated-dependencies');

      // From outdated packages - should split major and minor
      expect(candidateIds).toContain('technical-debt-major-version-updates');
      expect(candidateIds).toContain('technical-debt-outdated-dependencies');

      // From stale TODO/FIXME/HACK comments
      expect(candidateIds).toContain('technical-debt-stale-comments');

      // From general outdated documentation
      expect(candidateIds).toContain('technical-debt-outdated-documentation');

      // Verify we have all expected candidates (at least 5)
      expect(candidates.length).toBeGreaterThanOrEqual(4);
    });

    it('should create comprehensive TechnicalDebtAnalysis with outdated-dependency category', () => {
      const technicalDebtAnalysis = analyzer.createTechnicalDebtAnalysis(comprehensiveAnalysis);

      // Verify structure
      expect(technicalDebtAnalysis).toHaveProperty('totalScore');
      expect(technicalDebtAnalysis).toHaveProperty('categories');
      expect(technicalDebtAnalysis).toHaveProperty('hotspots');
      expect(technicalDebtAnalysis).toHaveProperty('metrics');
      expect(technicalDebtAnalysis).toHaveProperty('trends');

      // Should include outdated-dependency category
      const outdatedCategory = technicalDebtAnalysis.categories.find(c => c.category === 'outdated-dependency');
      expect(outdatedCategory).toBeDefined();
      expect(outdatedCategory?.count).toBe(4); // 4 outdated packages total
      expect(outdatedCategory?.severity).toBe('medium'); // 2 major updates = medium severity
      expect(outdatedCategory?.examples).toContain('react: 16.14.0 → 18.2.0');
      expect(outdatedCategory?.examples).toContain('typescript: 4.9.5 → 5.3.3');
      expect(outdatedCategory?.estimatedEffort).toBe('1 day'); // 2 major updates

      // Should also include documentation category for outdated docs
      const docCategory = technicalDebtAnalysis.categories.find(c => c.category === 'documentation');
      expect(docCategory).toBeDefined();
      expect(docCategory?.count).toBe(4); // 4 outdated docs total
    });

    it('should calculate appropriate total debt score including all deprecated/outdated issues', () => {
      const technicalDebtAnalysis = analyzer.createTechnicalDebtAnalysis(comprehensiveAnalysis);

      // Should have significant debt score due to multiple issues
      expect(technicalDebtAnalysis.totalScore).toBeGreaterThan(10);
      expect(technicalDebtAnalysis.totalScore).toBeLessThan(100);

      // Verify contribution from outdated-dependency category (weight: 0.08)
      // and documentation category (weight: 0.05)
      expect(technicalDebtAnalysis.totalScore).toBeGreaterThan(0);
    });

    it('should create hotspots for files with deprecated code patterns', () => {
      const technicalDebtAnalysis = analyzer.createTechnicalDebtAnalysis(comprehensiveAnalysis);

      // Should create documentation hotspots for files with multiple stale references
      const dateHelpersHotspot = technicalDebtAnalysis.hotspots.find(h => h.path === 'src/utils/date-helpers.ts');
      const apiClientHotspot = technicalDebtAnalysis.hotspots.find(h => h.path === 'src/api/legacy-client.ts');
      const datePickerHotspot = technicalDebtAnalysis.hotspots.find(h => h.path === 'src/components/DatePicker.tsx');

      // At least one of these should be a hotspot with significant score
      const relevantHotspots = [dateHelpersHotspot, apiClientHotspot, datePickerHotspot].filter(Boolean);
      expect(relevantHotspots.length).toBeGreaterThan(0);

      if (relevantHotspots.length > 0) {
        const hotspot = relevantHotspots[0];
        expect(hotspot.score).toBeGreaterThan(15);
        expect(hotspot.issues.length).toBeGreaterThan(0);
      }
    });

    it('should prioritize deprecated packages correctly relative to other debt types', () => {
      const candidates = analyzer.analyze(comprehensiveAnalysis);

      const deprecatedCandidate = candidates.find(c => c.candidateId === 'technical-debt-deprecated-dependencies');
      const majorUpdateCandidate = candidates.find(c => c.candidateId === 'technical-debt-major-version-updates');
      const minorUpdateCandidate = candidates.find(c => c.candidateId === 'technical-debt-outdated-dependencies');
      const staleCommentsCandidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      // Verify priority hierarchy
      expect(deprecatedCandidate?.priority).toBe('normal'); // 3 deprecated packages
      expect(majorUpdateCandidate?.priority).toBe('normal'); // Major updates
      expect(minorUpdateCandidate?.priority).toBe('low'); // Minor/patch updates
      expect(staleCommentsCandidate?.priority).toBe('high'); // High severity stale comments

      // Verify score hierarchy (deprecated > major > minor)
      if (deprecatedCandidate && majorUpdateCandidate && minorUpdateCandidate) {
        expect(deprecatedCandidate.score).toBeGreaterThan(majorUpdateCandidate.score);
        expect(majorUpdateCandidate.score).toBeGreaterThan(minorUpdateCandidate.score);
      }
    });

    it('should provide comprehensive remediation suggestions for all deprecated/outdated issues', () => {
      const candidates = analyzer.analyze(comprehensiveAnalysis);

      candidates.forEach(candidate => {
        // All candidates should have remediation suggestions
        expect(candidate.remediationSuggestions).toBeDefined();
        expect(Array.isArray(candidate.remediationSuggestions)).toBe(true);

        if (candidate.candidateId.includes('deprecated') || candidate.candidateId.includes('outdated') || candidate.candidateId.includes('stale')) {
          expect(candidate.remediationSuggestions.length).toBeGreaterThan(0);

          // Verify remediation suggestion structure
          candidate.remediationSuggestions.forEach(suggestion => {
            expect(suggestion).toHaveProperty('type');
            expect(suggestion).toHaveProperty('description');
            expect(suggestion).toHaveProperty('priority');
            expect(suggestion).toHaveProperty('expectedOutcome');

            // Verify valid remediation types
            const validTypes = ['npm_update', 'yarn_upgrade', 'migration_guide', 'package_replacement', 'manual_review', 'testing', 'documentation_update', 'version_sync', 'command'];
            expect(validTypes).toContain(suggestion.type);

            // Verify valid priorities
            const validPriorities = ['critical', 'high', 'medium', 'low'];
            expect(validPriorities).toContain(suggestion.priority);
          });
        }
      });
    });
  });

  describe('Acceptance Criteria Validation', () => {
    it('AC1: Should process outdatedPackages and deprecatedPackages from ProjectAnalysis.dependencies', () => {
      const analysis = { ...comprehensiveAnalysis };

      // Verify analyzer processes both arrays
      const candidates = analyzer.analyze(analysis);

      const deprecatedCandidate = candidates.find(c => c.candidateId === 'technical-debt-deprecated-dependencies');
      expect(deprecatedCandidate).toBeDefined();
      expect(deprecatedCandidate?.description).toContain('3 deprecated packages');

      const majorCandidate = candidates.find(c => c.candidateId === 'technical-debt-major-version-updates');
      expect(majorCandidate).toBeDefined();
      expect(majorCandidate?.description).toContain('2 dependencies with major version updates');

      const minorCandidate = candidates.find(c => c.candidateId === 'technical-debt-outdated-dependencies');
      expect(minorCandidate).toBeDefined();
      expect(minorCandidate?.description).toContain('2 dependencies with minor/patch updates');
    });

    it('AC2: Should process outdatedDocs from documentation analysis', () => {
      const analysis = { ...comprehensiveAnalysis };

      const candidates = analyzer.analyze(analysis);

      // Should process stale-reference type docs (TODO/FIXME/HACK comments)
      const staleCandidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');
      expect(staleCandidate).toBeDefined();
      expect(staleCandidate?.description).toContain('3 stale comments');

      // Should also process regular outdated docs
      const outdatedDocsCandidate = candidates.find(c => c.candidateId === 'technical-debt-outdated-documentation');
      expect(outdatedDocsCandidate).toBeDefined();
      expect(outdatedDocsCandidate?.description).toContain('outdated documentation issues');
    });

    it('AC3: Should map to TechnicalDebtAnalysis categories with outdated-dependency category', () => {
      const technicalDebtAnalysis = analyzer.createTechnicalDebtAnalysis(comprehensiveAnalysis);

      // Should include outdated-dependency category
      const outdatedCategory = technicalDebtAnalysis.categories.find(c => c.category === 'outdated-dependency');
      expect(outdatedCategory).toBeDefined();
      expect(outdatedCategory?.category).toBe('outdated-dependency');
      expect(outdatedCategory?.count).toBeGreaterThan(0);
      expect(outdatedCategory?.severity).toMatch(/^(low|medium|high|critical)$/);
      expect(Array.isArray(outdatedCategory?.examples)).toBe(true);
      expect(typeof outdatedCategory?.estimatedEffort).toBe('string');
    });

    it('AC4: Should create hotspots appropriately', () => {
      const technicalDebtAnalysis = analyzer.createTechnicalDebtAnalysis(comprehensiveAnalysis);

      // Should create hotspots array
      expect(Array.isArray(technicalDebtAnalysis.hotspots)).toBe(true);

      // Should create hotspots for files with documentation issues
      const documentationHotspots = technicalDebtAnalysis.hotspots.filter(h =>
        h.path.includes('src/utils/date-helpers.ts') ||
        h.path.includes('src/api/legacy-client.ts') ||
        h.path.includes('src/components/DatePicker.tsx')
      );

      expect(documentationHotspots.length).toBeGreaterThan(0);

      documentationHotspots.forEach(hotspot => {
        expect(hotspot).toHaveProperty('path');
        expect(hotspot).toHaveProperty('score');
        expect(hotspot).toHaveProperty('issues');
        expect(Array.isArray(hotspot.issues)).toBe(true);
        expect(typeof hotspot.score).toBe('number');
        expect(hotspot.score).toBeGreaterThan(0);
      });
    });
  });

  describe('Edge Cases in Integration', () => {
    it('should handle mixed presence of deprecated/outdated issues gracefully', () => {
      const partialAnalysis: ProjectAnalysis = {
        ...comprehensiveAnalysis,
        dependencies: {
          ...comprehensiveAnalysis.dependencies,
          deprecatedPackages: [], // No deprecated packages
          outdatedPackages: [
            {
              name: 'react',
              currentVersion: '17.0.0',
              latestVersion: '18.2.0',
              updateType: 'major'
            }
          ]
        },
        documentation: {
          ...comprehensiveAnalysis.documentation,
          outdatedDocs: [] // No outdated docs
        }
      };

      expect(() => analyzer.analyze(partialAnalysis)).not.toThrow();
      expect(() => analyzer.createTechnicalDebtAnalysis(partialAnalysis)).not.toThrow();

      const candidates = analyzer.analyze(partialAnalysis);
      const technicalDebtAnalysis = analyzer.createTechnicalDebtAnalysis(partialAnalysis);

      // Should still create appropriate candidates and analysis
      const majorCandidate = candidates.find(c => c.candidateId === 'technical-debt-major-version-updates');
      expect(majorCandidate).toBeDefined();

      const outdatedCategory = technicalDebtAnalysis.categories.find(c => c.category === 'outdated-dependency');
      expect(outdatedCategory).toBeDefined();
      expect(outdatedCategory?.count).toBe(1);
    });

    it('should handle completely missing deprecated/outdated data gracefully', () => {
      const emptyAnalysis: ProjectAnalysis = {
        ...comprehensiveAnalysis,
        dependencies: {
          ...comprehensiveAnalysis.dependencies,
          deprecatedPackages: [],
          outdatedPackages: []
        },
        documentation: {
          ...comprehensiveAnalysis.documentation,
          outdatedDocs: []
        }
      };

      expect(() => analyzer.analyze(emptyAnalysis)).not.toThrow();
      expect(() => analyzer.createTechnicalDebtAnalysis(emptyAnalysis)).not.toThrow();

      const candidates = analyzer.analyze(emptyAnalysis);
      const technicalDebtAnalysis = analyzer.createTechnicalDebtAnalysis(emptyAnalysis);

      // Should not create deprecated/outdated related candidates
      const deprecatedCandidates = candidates.filter(c =>
        c.candidateId.includes('deprecated') ||
        c.candidateId.includes('outdated') ||
        c.candidateId.includes('stale')
      );
      expect(deprecatedCandidates.length).toBe(0);

      // Should not include outdated-dependency category
      const outdatedCategory = technicalDebtAnalysis.categories.find(c => c.category === 'outdated-dependency');
      expect(outdatedCategory).toBeUndefined();
    });
  });
});
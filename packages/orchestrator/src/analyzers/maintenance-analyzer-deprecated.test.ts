/**
 * Tests for MaintenanceAnalyzer Deprecated Package Detection Features
 *
 * Tests the deprecated package detection functionality including:
 * - Task generation for deprecated packages
 * - Replacement suggestion handling
 * - Priority adjustment based on replacement availability
 * - Description and rationale generation
 */

import { MaintenanceAnalyzer } from './maintenance-analyzer';
import type { ProjectAnalysis, DeprecatedPackage } from '../idle-processor';

describe('MaintenanceAnalyzer - Deprecated Package Detection', () => {
  let analyzer: MaintenanceAnalyzer;

  beforeEach(() => {
    analyzer = new MaintenanceAnalyzer();
  });

  // Helper function to create minimal ProjectAnalysis with deprecated packages
  function createAnalysisWithDeprecatedPackages(deprecatedPackages: DeprecatedPackage[] = []): ProjectAnalysis {
    return {
      codebaseSize: {
        files: 100,
        lines: 10000,
        languages: { typescript: 8000, javascript: 2000 }
      },
      testCoverage: undefined,
      dependencies: {
        outdated: [],
        security: [],
        deprecatedPackages
      },
      codeQuality: {
        lintIssues: 0,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: {
        coverage: 50,
        missingDocs: [],
        outdatedSections: [],
        apiCompleteness: {
          percentage: 75,
          details: {
            totalEndpoints: 20,
            documentedEndpoints: 15,
            undocumentedItems: [],
            wellDocumentedExamples: [],
            commonIssues: []
          }
        }
      },
      performance: {
        bundleSize: undefined,
        slowTests: [],
        bottlenecks: []
      }
    };
  }

  // Helper function to create deprecated package object
  function createDeprecatedPackage(overrides: Partial<DeprecatedPackage> = {}): DeprecatedPackage {
    return {
      name: 'test-deprecated-package',
      currentVersion: '1.0.0',
      replacement: '@modern/replacement-package',
      reason: 'Package has been superseded by a better alternative',
      ...overrides
    };
  }

  describe('Basic Deprecated Package Detection', () => {
    it('should generate task for deprecated package with replacement', () => {
      const deprecatedPkg = createDeprecatedPackage({
        name: 'request',
        currentVersion: '2.88.2',
        replacement: 'axios',
        reason: 'Request library is deprecated. Use axios or native fetch instead.'
      });

      const analysis = createAnalysisWithDeprecatedPackages([deprecatedPkg]);
      const candidates = analyzer.analyze(analysis);

      const deprecatedTask = candidates.find(c => c.candidateId === 'deprecated-pkg-request');

      expect(deprecatedTask).toBeDefined();
      expect(deprecatedTask?.title).toBe('Replace Deprecated Package: request → axios');
      expect(deprecatedTask?.priority).toBe('normal');
      expect(deprecatedTask?.score).toBe(0.6);
      expect(deprecatedTask?.effort).toBe('medium');
      expect(deprecatedTask?.workflow).toBe('maintenance');
      expect(deprecatedTask?.description).toContain('Package request@2.88.2 is deprecated');
      expect(deprecatedTask?.description).toContain('Reason: Request library is deprecated');
      expect(deprecatedTask?.description).toContain('Recommended replacement: axios');
    });

    it('should generate higher priority task for deprecated package without replacement', () => {
      const deprecatedPkg = createDeprecatedPackage({
        name: 'legacy-package',
        currentVersion: '3.2.1',
        replacement: null,
        reason: 'No longer maintained, no direct replacement available'
      });

      const analysis = createAnalysisWithDeprecatedPackages([deprecatedPkg]);
      const candidates = analyzer.analyze(analysis);

      const deprecatedTask = candidates.find(c => c.candidateId === 'deprecated-pkg-legacy-package');

      expect(deprecatedTask).toBeDefined();
      expect(deprecatedTask?.title).toBe('Replace Deprecated Package: legacy-package');
      expect(deprecatedTask?.priority).toBe('high');
      expect(deprecatedTask?.score).toBe(0.8);
      expect(deprecatedTask?.description).toContain('No direct replacement available - manual migration required');
      expect(deprecatedTask?.rationale).toContain('requiring urgent attention to find alternative solutions');
    });

    it('should handle deprecated package without reason', () => {
      const deprecatedPkg = createDeprecatedPackage({
        name: 'old-lib',
        currentVersion: '1.5.0',
        replacement: 'new-lib',
        reason: ''
      });

      const analysis = createAnalysisWithDeprecatedPackages([deprecatedPkg]);
      const candidates = analyzer.analyze(analysis);

      const deprecatedTask = candidates.find(c => c.candidateId === 'deprecated-pkg-old-lib');

      expect(deprecatedTask).toBeDefined();
      expect(deprecatedTask?.description).toContain('Package old-lib@1.5.0 is deprecated');
      expect(deprecatedTask?.description).toContain('Recommended replacement: new-lib');
      expect(deprecatedTask?.description).not.toContain('Reason:');
    });
  });

  describe('Package Name Handling', () => {
    it('should handle scoped package names correctly', () => {
      const deprecatedPkg = createDeprecatedPackage({
        name: '@company/legacy-package',
        currentVersion: '2.0.0',
        replacement: '@company/modern-package',
        reason: 'Migrated to new architecture'
      });

      const analysis = createAnalysisWithDeprecatedPackages([deprecatedPkg]);
      const candidates = analyzer.analyze(analysis);

      const deprecatedTask = candidates.find(c => c.candidateId === 'deprecated-pkg--company-legacy-package');

      expect(deprecatedTask).toBeDefined();
      expect(deprecatedTask?.title).toBe('Replace Deprecated Package: @company/legacy-package → @company/modern-package');
      expect(deprecatedTask?.description).toContain('@company/legacy-package@2.0.0');
      expect(deprecatedTask?.description).toContain('@company/modern-package');
    });

    it('should create URL-safe candidate IDs for complex package names', () => {
      const deprecatedPkg = createDeprecatedPackage({
        name: '@scope/package-with-dashes_and_dots.js',
        currentVersion: '1.0.0',
        replacement: '@scope/new-package',
        reason: 'Replaced with improved version'
      });

      const analysis = createAnalysisWithDeprecatedPackages([deprecatedPkg]);
      const candidates = analyzer.analyze(analysis);

      const deprecatedTask = candidates.find(c => c.candidateId.startsWith('deprecated-pkg-'));

      expect(deprecatedTask).toBeDefined();
      expect(deprecatedTask?.candidateId).toBe('deprecated-pkg--scope-package-with-dashes-and-dots-js');
      expect(deprecatedTask?.candidateId).not.toContain('/');
      expect(deprecatedTask?.candidateId).not.toContain('.');
      expect(deprecatedTask?.candidateId).not.toContain('_');
    });
  });

  describe('Multiple Deprecated Packages', () => {
    it('should generate separate tasks for each deprecated package', () => {
      const deprecatedPackages = [
        createDeprecatedPackage({
          name: 'request',
          replacement: 'axios'
        }),
        createDeprecatedPackage({
          name: 'moment',
          replacement: 'date-fns'
        }),
        createDeprecatedPackage({
          name: 'gulp-util',
          replacement: null
        })
      ];

      const analysis = createAnalysisWithDeprecatedPackages(deprecatedPackages);
      const candidates = analyzer.analyze(analysis);

      const deprecatedTasks = candidates.filter(c => c.candidateId.startsWith('deprecated-pkg-'));

      expect(deprecatedTasks).toHaveLength(3);

      const requestTask = candidates.find(c => c.candidateId === 'deprecated-pkg-request');
      const momentTask = candidates.find(c => c.candidateId === 'deprecated-pkg-moment');
      const gulpUtilTask = candidates.find(c => c.candidateId === 'deprecated-pkg-gulp-util');

      expect(requestTask?.priority).toBe('normal');
      expect(momentTask?.priority).toBe('normal');
      expect(gulpUtilTask?.priority).toBe('high'); // No replacement
    });

    it('should sort deprecated package tasks by priority and score', () => {
      const deprecatedPackages = [
        createDeprecatedPackage({ name: 'with-replacement', replacement: 'new-package' }),
        createDeprecatedPackage({ name: 'without-replacement', replacement: null }),
        createDeprecatedPackage({ name: 'another-with-replacement', replacement: 'another-new-package' })
      ];

      const analysis = createAnalysisWithDeprecatedPackages(deprecatedPackages);
      const candidates = analyzer.analyze(analysis);

      const deprecatedTasks = candidates.filter(c => c.candidateId.startsWith('deprecated-pkg-'));
      const sortedByScore = [...deprecatedTasks].sort((a, b) => b.score - a.score);

      // Task without replacement should have highest score (0.8)
      expect(sortedByScore[0].candidateId).toBe('deprecated-pkg-without-replacement');
      expect(sortedByScore[0].score).toBe(0.8);
      expect(sortedByScore[0].priority).toBe('high');

      // Tasks with replacement should have lower score (0.6)
      expect(sortedByScore[1].score).toBe(0.6);
      expect(sortedByScore[2].score).toBe(0.6);
      expect(sortedByScore[1].priority).toBe('normal');
      expect(sortedByScore[2].priority).toBe('normal');
    });
  });

  describe('Integration with Other Maintenance Tasks', () => {
    it('should work alongside security vulnerabilities and outdated dependencies', () => {
      const analysis: ProjectAnalysis = {
        ...createAnalysisWithDeprecatedPackages([
          createDeprecatedPackage({ name: 'deprecated-pkg', replacement: 'new-pkg' })
        ]),
        dependencies: {
          outdated: ['old-package@1.0.0'],
          security: ['vulnerable-package@2.0.0 (CVE-2023-12345)'],
          deprecatedPackages: [
            createDeprecatedPackage({ name: 'deprecated-pkg', replacement: 'new-pkg' })
          ]
        }
      };

      const candidates = analyzer.analyze(analysis);

      const securityTasks = candidates.filter(c => c.candidateId.includes('security'));
      const outdatedTasks = candidates.filter(c => c.candidateId.includes('outdated'));
      const deprecatedTasks = candidates.filter(c => c.candidateId.startsWith('deprecated-pkg-'));

      expect(securityTasks).toHaveLength(1);
      expect(outdatedTasks).toHaveLength(1);
      expect(deprecatedTasks).toHaveLength(1);

      // Verify priority ordering: security > outdated > deprecated (with replacement)
      const sortedByScore = [...candidates].sort((a, b) => b.score - a.score);
      expect(sortedByScore[0].candidateId).toContain('security');  // Score: 1.0
      expect(sortedByScore[1].candidateId).toContain('outdated');  // Score: 0.5
      expect(sortedByScore[2].candidateId).toBe('deprecated-pkg-deprecated-pkg');  // Score: 0.6
    });

    it('should prioritize deprecated packages without replacement over outdated dependencies', () => {
      const analysis: ProjectAnalysis = {
        ...createAnalysisWithDeprecatedPackages([
          createDeprecatedPackage({ name: 'urgent-deprecated', replacement: null })
        ]),
        dependencies: {
          outdated: ['old-package@1.0.0'],
          security: [],
          deprecatedPackages: [
            createDeprecatedPackage({ name: 'urgent-deprecated', replacement: null })
          ]
        }
      };

      const candidates = analyzer.analyze(analysis);

      const sortedByScore = [...candidates].sort((a, b) => b.score - a.score);

      // Deprecated without replacement (0.8) should be higher than outdated (0.5)
      expect(sortedByScore[0].candidateId).toBe('deprecated-pkg-urgent-deprecated');
      expect(sortedByScore[0].score).toBe(0.8);
      expect(sortedByScore[1].candidateId).toBe('outdated-deps');
      expect(sortedByScore[1].score).toBe(0.5);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty deprecated packages array', () => {
      const analysis = createAnalysisWithDeprecatedPackages([]);
      const candidates = analyzer.analyze(analysis);

      const deprecatedTasks = candidates.filter(c => c.candidateId.startsWith('deprecated-pkg-'));
      expect(deprecatedTasks).toHaveLength(0);
    });

    it('should handle undefined deprecated packages', () => {
      const analysis = createAnalysisWithDeprecatedPackages();
      delete (analysis.dependencies as any).deprecatedPackages;

      expect(() => {
        const candidates = analyzer.analyze(analysis);
        const deprecatedTasks = candidates.filter(c => c.candidateId.startsWith('deprecated-pkg-'));
        expect(deprecatedTasks).toHaveLength(0);
      }).not.toThrow();
    });

    it('should handle deprecated package with empty name', () => {
      const deprecatedPkg = createDeprecatedPackage({
        name: '',
        replacement: 'some-replacement'
      });

      const analysis = createAnalysisWithDeprecatedPackages([deprecatedPkg]);
      const candidates = analyzer.analyze(analysis);

      // Should still create a task, even with empty name
      const deprecatedTask = candidates.find(c => c.candidateId === 'deprecated-pkg-');
      expect(deprecatedTask).toBeDefined();
      expect(deprecatedTask?.title).toContain(' → some-replacement');
    });

    it('should handle deprecated package with very long names and descriptions', () => {
      const longName = 'very-long-package-name-that-goes-on-and-on-and-on'.repeat(3);
      const longReason = 'This is a very long deprecation reason that explains in great detail why this package has been deprecated and what users should do instead. '.repeat(10);

      const deprecatedPkg = createDeprecatedPackage({
        name: longName,
        replacement: 'short-replacement',
        reason: longReason
      });

      const analysis = createAnalysisWithDeprecatedPackages([deprecatedPkg]);
      const candidates = analyzer.analyze(analysis);

      const deprecatedTask = candidates.find(c => c.candidateId.includes('deprecated-pkg-'));
      expect(deprecatedTask).toBeDefined();
      expect(deprecatedTask?.description).toContain(longReason);
      expect(deprecatedTask?.title.length).toBeGreaterThan(100);
    });
  });

  describe('Description and Rationale Generation', () => {
    it('should build comprehensive descriptions for packages with all information', () => {
      const deprecatedPkg = createDeprecatedPackage({
        name: 'comprehensive-package',
        currentVersion: '2.1.5',
        replacement: 'modern-alternative',
        reason: 'Package architecture is outdated and no longer maintained'
      });

      const analysis = createAnalysisWithDeprecatedPackages([deprecatedPkg]);
      const candidates = analyzer.analyze(analysis);

      const task = candidates.find(c => c.candidateId === 'deprecated-pkg-comprehensive-package');

      expect(task?.description).toContain('Package comprehensive-package@2.1.5 is deprecated');
      expect(task?.description).toContain('Reason: Package architecture is outdated and no longer maintained');
      expect(task?.description).toContain('Recommended replacement: modern-alternative');
    });

    it('should generate appropriate rationales for packages with replacements', () => {
      const deprecatedPkg = createDeprecatedPackage({
        name: 'old-package',
        replacement: 'new-package'
      });

      const analysis = createAnalysisWithDeprecatedPackages([deprecatedPkg]);
      const candidates = analyzer.analyze(analysis);

      const task = candidates.find(c => c.candidateId === 'deprecated-pkg-old-package');

      expect(task?.rationale).toContain('Migration to new-package ensures continued support');
      expect(task?.rationale).toContain('stop receiving security updates and bug fixes');
    });

    it('should generate urgent rationales for packages without replacements', () => {
      const deprecatedPkg = createDeprecatedPackage({
        name: 'orphaned-package',
        replacement: null
      });

      const analysis = createAnalysisWithDeprecatedPackages([deprecatedPkg]);
      const candidates = analyzer.analyze(analysis);

      const task = candidates.find(c => c.candidateId === 'deprecated-pkg-orphaned-package');

      expect(task?.rationale).toContain('requiring urgent attention');
      expect(task?.rationale).toContain('find alternative solutions');
    });
  });
});
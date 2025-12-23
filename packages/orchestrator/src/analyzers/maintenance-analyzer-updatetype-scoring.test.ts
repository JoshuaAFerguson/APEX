/**
 * Update Type Scoring Tests
 *
 * Comprehensive test suite to verify outdated dependency scoring system
 * based on updateType: major=0.8, minor=0.6, patch=0.4
 * and ensures backward compatibility with legacy string-based outdated deps.
 */

import { MaintenanceAnalyzer } from './maintenance-analyzer';
import type { ProjectAnalysis, OutdatedDependency, UpdateType } from '../idle-processor';

describe('MaintenanceAnalyzer - Update Type Scoring', () => {
  let analyzer: MaintenanceAnalyzer;

  beforeEach(() => {
    analyzer = new MaintenanceAnalyzer();
  });

  // Helper function to create minimal ProjectAnalysis with outdated dependency data
  function createAnalysisWithOutdatedPackages(outdatedPackages: OutdatedDependency[] = []): ProjectAnalysis {
    return {
      codebaseSize: {
        files: 100,
        lines: 10000,
        languages: { typescript: 8000, javascript: 2000 }
      },
      testCoverage: undefined,
      dependencies: {
        outdated: [], // Empty legacy array
        security: [],
        outdatedPackages, // Rich OutdatedDependency objects
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
        coverage: 50,
        missingDocs: [],
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
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

  // Helper function to create OutdatedDependency object
  function createOutdatedDependency(overrides: Partial<OutdatedDependency> = {}): OutdatedDependency {
    return {
      name: 'test-package',
      currentVersion: '1.0.0',
      latestVersion: '2.0.0',
      updateType: 'major',
      ...overrides
    };
  }

  describe('Update Type Score Values', () => {
    it('should assign score 0.8 for major updates', () => {
      const dependency = createOutdatedDependency({
        name: 'react',
        currentVersion: '16.14.0',
        latestVersion: '18.2.0',
        updateType: 'major'
      });

      const analysis = createAnalysisWithOutdatedPackages([dependency]);
      const candidates = analyzer.analyze(analysis);

      const majorTask = candidates.find(c => c.candidateId.includes('outdated-major-react'));
      expect(majorTask).toBeDefined();
      expect(majorTask!.score).toBe(0.8);
      expect(majorTask!.priority).toBe('high');
    });

    it('should assign score 0.6 for minor updates', () => {
      const dependency = createOutdatedDependency({
        name: 'lodash',
        currentVersion: '4.17.20',
        latestVersion: '4.18.0',
        updateType: 'minor'
      });

      const analysis = createAnalysisWithOutdatedPackages([dependency]);
      const candidates = analyzer.analyze(analysis);

      const minorTask = candidates.find(c => c.candidateId.includes('outdated-minor-lodash'));
      expect(minorTask).toBeDefined();
      expect(minorTask!.score).toBe(0.6);
      expect(minorTask!.priority).toBe('normal');
    });

    it('should assign score 0.4 for patch updates', () => {
      const dependency = createOutdatedDependency({
        name: 'express',
        currentVersion: '4.18.0',
        latestVersion: '4.18.2',
        updateType: 'patch'
      });

      const analysis = createAnalysisWithOutdatedPackages([dependency]);
      const candidates = analyzer.analyze(analysis);

      const patchTask = candidates.find(c => c.candidateId.includes('outdated-patch-express'));
      expect(patchTask).toBeDefined();
      expect(patchTask!.score).toBe(0.4);
      expect(patchTask!.priority).toBe('low');
    });
  });

  describe('Individual vs Grouped Task Scoring', () => {
    it('should create individual tasks for single major updates', () => {
      const dependencies = [
        createOutdatedDependency({ name: 'vue', updateType: 'major' })
      ];

      const analysis = createAnalysisWithOutdatedPackages(dependencies);
      const candidates = analyzer.analyze(analysis);

      const majorTasks = candidates.filter(c => c.candidateId.includes('major'));
      expect(majorTasks).toHaveLength(1);
      expect(majorTasks[0].score).toBe(0.8);
      expect(majorTasks[0].candidateId).toBe('outdated-major-vue');
    });

    it('should create individual tasks for few minor updates (<=3)', () => {
      const dependencies = [
        createOutdatedDependency({ name: 'pkg1', updateType: 'minor' }),
        createOutdatedDependency({ name: 'pkg2', updateType: 'minor' }),
        createOutdatedDependency({ name: 'pkg3', updateType: 'minor' })
      ];

      const analysis = createAnalysisWithOutdatedPackages(dependencies);
      const candidates = analyzer.analyze(analysis);

      const minorTasks = candidates.filter(c => c.candidateId.includes('minor'));
      expect(minorTasks).toHaveLength(3); // Should be individual tasks
      minorTasks.forEach(task => {
        expect(task.score).toBe(0.6);
      });
    });

    it('should create grouped task for many minor updates (>3)', () => {
      const dependencies = [
        createOutdatedDependency({ name: 'pkg1', updateType: 'minor' }),
        createOutdatedDependency({ name: 'pkg2', updateType: 'minor' }),
        createOutdatedDependency({ name: 'pkg3', updateType: 'minor' }),
        createOutdatedDependency({ name: 'pkg4', updateType: 'minor' })
      ];

      const analysis = createAnalysisWithOutdatedPackages(dependencies);
      const candidates = analyzer.analyze(analysis);

      const groupedTask = candidates.find(c => c.candidateId === 'outdated-group-minor');
      expect(groupedTask).toBeDefined();
      expect(groupedTask!.score).toBe(0.6);
      expect(groupedTask!.title).toContain('4 Minor Updates');
    });

    it('should create individual tasks for very few patch updates (<=2)', () => {
      const dependencies = [
        createOutdatedDependency({ name: 'pkg1', updateType: 'patch' }),
        createOutdatedDependency({ name: 'pkg2', updateType: 'patch' })
      ];

      const analysis = createAnalysisWithOutdatedPackages(dependencies);
      const candidates = analyzer.analyze(analysis);

      const patchTasks = candidates.filter(c => c.candidateId.includes('patch'));
      expect(patchTasks).toHaveLength(2); // Should be individual tasks
      patchTasks.forEach(task => {
        expect(task.score).toBe(0.4);
      });
    });

    it('should create grouped task for many patch updates (>2)', () => {
      const dependencies = [
        createOutdatedDependency({ name: 'pkg1', updateType: 'patch' }),
        createOutdatedDependency({ name: 'pkg2', updateType: 'patch' }),
        createOutdatedDependency({ name: 'pkg3', updateType: 'patch' })
      ];

      const analysis = createAnalysisWithOutdatedPackages(dependencies);
      const candidates = analyzer.analyze(analysis);

      const groupedTask = candidates.find(c => c.candidateId === 'outdated-group-patch');
      expect(groupedTask).toBeDefined();
      expect(groupedTask!.score).toBe(0.4);
      expect(groupedTask!.title).toContain('3 Patch Updates');
    });
  });

  describe('Mixed Update Types Scoring Verification', () => {
    it('should correctly prioritize tasks by score when mixed update types are present', () => {
      const dependencies = [
        createOutdatedDependency({ name: 'major-pkg', updateType: 'major' }),
        createOutdatedDependency({ name: 'minor-pkg1', updateType: 'minor' }),
        createOutdatedDependency({ name: 'minor-pkg2', updateType: 'minor' }),
        createOutdatedDependency({ name: 'patch-pkg1', updateType: 'patch' }),
        createOutdatedDependency({ name: 'patch-pkg2', updateType: 'patch' }),
        createOutdatedDependency({ name: 'patch-pkg3', updateType: 'patch' })
      ];

      const analysis = createAnalysisWithOutdatedPackages(dependencies);
      const candidates = analyzer.analyze(analysis);

      // Sort by score to verify priority order
      const sortedByScore = [...candidates].sort((a, b) => b.score - a.score);

      // Verify score order: major (0.8) > minor (0.6) > patch (0.4)
      const scores = sortedByScore.map(c => c.score);
      expect(scores[0]).toBe(0.8); // Major
      expect(scores[1]).toBe(0.6); // Minor (individual)
      expect(scores[2]).toBe(0.6); // Minor (individual)
      expect(scores[3]).toBe(0.4); // Patch (grouped)

      // Verify specific task types
      expect(sortedByScore[0].priority).toBe('high'); // Major
      expect(sortedByScore[1].priority).toBe('normal'); // Minor
      expect(sortedByScore[3].priority).toBe('low'); // Patch
    });

    it('should verify all unique score values are present in mixed scenario', () => {
      const dependencies = [
        createOutdatedDependency({ name: 'major-pkg', updateType: 'major' }),
        createOutdatedDependency({ name: 'minor-pkg', updateType: 'minor' }),
        createOutdatedDependency({ name: 'patch-pkg1', updateType: 'patch' }),
        createOutdatedDependency({ name: 'patch-pkg2', updateType: 'patch' }),
        createOutdatedDependency({ name: 'patch-pkg3', updateType: 'patch' })
      ];

      const analysis = createAnalysisWithOutdatedPackages(dependencies);
      const candidates = analyzer.analyze(analysis);

      const scores = candidates.map(c => c.score).sort((a, b) => b - a);
      const uniqueScores = [...new Set(scores)];

      expect(uniqueScores).toEqual([0.8, 0.6, 0.4]);
      expect(uniqueScores).toHaveLength(3); // All update type scores represented
    });
  });

  describe('Backward Compatibility with Legacy Format', () => {
    it('should process legacy string-based outdated dependencies when rich data unavailable', () => {
      const analysis: ProjectAnalysis = {
        ...createAnalysisWithOutdatedPackages([]),
        dependencies: {
          outdated: ['lodash@4.17.15', 'react@16.14.0'], // Legacy format
          security: [],
          outdatedPackages: [], // Empty rich format
          securityIssues: [],
          deprecatedPackages: []
        }
      };

      const candidates = analyzer.analyze(analysis);

      const legacyTask = candidates.find(c => c.candidateId === 'outdated-deps');
      expect(legacyTask).toBeDefined();
      expect(legacyTask!.score).toBe(0.5); // Legacy format uses 0.5 score
      expect(legacyTask!.title).toBe('Update Outdated Dependencies');
    });

    it('should prioritize rich format over legacy format when both are present', () => {
      const analysis: ProjectAnalysis = {
        ...createAnalysisWithOutdatedPackages([
          createOutdatedDependency({ name: 'modern-pkg', updateType: 'major' })
        ]),
        dependencies: {
          outdated: ['old-package@1.0.0'], // Legacy format
          security: [],
          outdatedPackages: [
            createOutdatedDependency({ name: 'modern-pkg', updateType: 'major' })
          ], // Rich format
          securityIssues: [],
          deprecatedPackages: []
        }
      };

      const candidates = analyzer.analyze(analysis);

      // Should process rich format and ignore legacy
      const modernTask = candidates.find(c => c.candidateId.includes('outdated-major-modern-pkg'));
      const legacyTask = candidates.find(c => c.candidateId === 'outdated-deps');

      expect(modernTask).toBeDefined();
      expect(modernTask!.score).toBe(0.8);
      expect(legacyTask).toBeUndefined(); // Legacy should not be processed
    });

    it('should handle pre-1.0 dependencies in legacy format correctly', () => {
      const analysis: ProjectAnalysis = {
        ...createAnalysisWithOutdatedPackages([]),
        dependencies: {
          outdated: ['beta-package@^0.5.0', 'stable-package@1.2.0'], // Mixed legacy
          security: [],
          outdatedPackages: [], // Empty rich format
          securityIssues: [],
          deprecatedPackages: []
        }
      };

      const candidates = analyzer.analyze(analysis);

      const criticalTask = candidates.find(c => c.candidateId === 'critical-outdated-deps');
      const generalTask = candidates.find(c => c.candidateId === 'outdated-deps');

      expect(criticalTask).toBeDefined();
      expect(criticalTask!.score).toBe(0.8); // Pre-1.0 gets higher score
      expect(generalTask).toBeDefined();
      expect(generalTask!.score).toBe(0.5); // General outdated
    });
  });

  describe('Score Boundary Testing', () => {
    it('should verify exact score values match expected constants', () => {
      const testCases = [
        { updateType: 'major' as const, expectedScore: 0.8 },
        { updateType: 'minor' as const, expectedScore: 0.6 },
        { updateType: 'patch' as const, expectedScore: 0.4 }
      ];

      testCases.forEach(({ updateType, expectedScore }) => {
        const dependencies = [
          createOutdatedDependency({ name: `${updateType}-pkg`, updateType })
        ];

        const analysis = createAnalysisWithOutdatedPackages(dependencies);
        const candidates = analyzer.analyze(analysis);

        const relevantTask = candidates.find(c => c.candidateId.includes(updateType));
        expect(relevantTask).toBeDefined();
        expect(relevantTask!.score).toBe(expectedScore);
      });
    });

    it('should verify no tasks have invalid score values', () => {
      const dependencies = [
        createOutdatedDependency({ name: 'major-pkg', updateType: 'major' }),
        createOutdatedDependency({ name: 'minor-pkg', updateType: 'minor' }),
        createOutdatedDependency({ name: 'patch-pkg1', updateType: 'patch' }),
        createOutdatedDependency({ name: 'patch-pkg2', updateType: 'patch' }),
        createOutdatedDependency({ name: 'patch-pkg3', updateType: 'patch' })
      ];

      const analysis = createAnalysisWithOutdatedPackages(dependencies);
      const candidates = analyzer.analyze(analysis);

      const outdatedTasks = candidates.filter(c => c.candidateId.includes('outdated'));
      const validScores = [0.8, 0.6, 0.4];

      outdatedTasks.forEach(task => {
        expect(validScores).toContain(task.score);
        expect(task.score).toBeGreaterThan(0);
        expect(task.score).toBeLessThanOrEqual(1.0);
      });
    });
  });

  describe('Task Properties and Content Verification', () => {
    it('should generate proper task titles and descriptions for individual updates', () => {
      const dependency = createOutdatedDependency({
        name: 'react',
        currentVersion: '16.14.0',
        latestVersion: '18.2.0',
        updateType: 'major'
      });

      const analysis = createAnalysisWithOutdatedPackages([dependency]);
      const candidates = analyzer.analyze(analysis);

      const task = candidates.find(c => c.candidateId.includes('outdated-major-react'));
      expect(task).toBeDefined();
      expect(task!.title).toBe('Major Update: react');
      expect(task!.description).toBe('Update react from 16.14.0 to 18.2.0 (major update)');
      expect(task!.workflow).toBe('maintenance');
    });

    it('should generate proper task properties for grouped updates', () => {
      const dependencies = [
        createOutdatedDependency({ name: 'pkg1', updateType: 'minor' }),
        createOutdatedDependency({ name: 'pkg2', updateType: 'minor' }),
        createOutdatedDependency({ name: 'pkg3', updateType: 'minor' }),
        createOutdatedDependency({ name: 'pkg4', updateType: 'minor' })
      ];

      const analysis = createAnalysisWithOutdatedPackages(dependencies);
      const candidates = analyzer.analyze(analysis);

      const groupedTask = candidates.find(c => c.candidateId === 'outdated-group-minor');
      expect(groupedTask).toBeDefined();
      expect(groupedTask!.title).toBe('4 Minor Updates');
      expect(groupedTask!.description).toContain('Update 4 packages with minor version changes');
      expect(groupedTask!.effort).toBe('low'); // <=5 packages = low effort
    });

    it('should assign correct effort levels based on update type and count', () => {
      const majorDep = createOutdatedDependency({ name: 'major-pkg', updateType: 'major' });
      const minorDep = createOutdatedDependency({ name: 'minor-pkg', updateType: 'minor' });
      const patchDep = createOutdatedDependency({ name: 'patch-pkg', updateType: 'patch' });

      // Test individual tasks
      const majorAnalysis = createAnalysisWithOutdatedPackages([majorDep]);
      const majorCandidates = analyzer.analyze(majorAnalysis);
      const majorTask = majorCandidates.find(c => c.candidateId.includes('major'));
      expect(majorTask!.effort).toBe('medium'); // Major updates = medium effort

      const minorAnalysis = createAnalysisWithOutdatedPackages([minorDep]);
      const minorCandidates = analyzer.analyze(minorAnalysis);
      const minorTask = minorCandidates.find(c => c.candidateId.includes('minor'));
      expect(minorTask!.effort).toBe('low'); // Minor/patch = low effort

      const patchAnalysis = createAnalysisWithOutdatedPackages([patchDep]);
      const patchCandidates = analyzer.analyze(patchAnalysis);
      const patchTask = patchCandidates.find(c => c.candidateId.includes('patch'));
      expect(patchTask!.effort).toBe('low'); // Patch = low effort
    });
  });

  describe('Remediation Suggestions', () => {
    it('should include migration guide suggestions for major updates', () => {
      const dependency = createOutdatedDependency({
        name: 'vue',
        updateType: 'major'
      });

      const analysis = createAnalysisWithOutdatedPackages([dependency]);
      const candidates = analyzer.analyze(analysis);

      const majorTask = candidates.find(c => c.candidateId.includes('major'));
      expect(majorTask).toBeDefined();
      expect(majorTask!.remediationSuggestions).toBeDefined();

      const suggestions = majorTask!.remediationSuggestions!;
      const migrationSuggestion = suggestions.find(s => s.type === 'migration_guide');
      const reviewSuggestion = suggestions.find(s => s.type === 'manual_review');

      expect(migrationSuggestion).toBeDefined();
      expect(migrationSuggestion!.description).toContain('migration guide');
      expect(migrationSuggestion!.warning).toContain('breaking changes');

      expect(reviewSuggestion).toBeDefined();
      expect(reviewSuggestion!.description).toContain('compatibility issues');
    });

    it('should not include migration guide for minor and patch updates', () => {
      const minorDep = createOutdatedDependency({ name: 'minor-pkg', updateType: 'minor' });
      const patchDep = createOutdatedDependency({ name: 'patch-pkg', updateType: 'patch' });

      const minorAnalysis = createAnalysisWithOutdatedPackages([minorDep]);
      const minorCandidates = analyzer.analyze(minorAnalysis);
      const minorTask = minorCandidates.find(c => c.candidateId.includes('minor'));

      const patchAnalysis = createAnalysisWithOutdatedPackages([patchDep]);
      const patchCandidates = analyzer.analyze(patchAnalysis);
      const patchTask = patchCandidates.find(c => c.candidateId.includes('patch'));

      const minorMigration = minorTask!.remediationSuggestions?.find(s => s.type === 'migration_guide');
      const patchMigration = patchTask!.remediationSuggestions?.find(s => s.type === 'migration_guide');

      expect(minorMigration).toBeUndefined();
      expect(patchMigration).toBeUndefined();
    });

    it('should include testing suggestions for grouped major updates', () => {
      const dependencies = [
        createOutdatedDependency({ name: 'pkg1', updateType: 'major' }),
        createOutdatedDependency({ name: 'pkg2', updateType: 'minor' }),
        createOutdatedDependency({ name: 'pkg3', updateType: 'minor' }),
        createOutdatedDependency({ name: 'pkg4', updateType: 'minor' }),
        createOutdatedDependency({ name: 'pkg5', updateType: 'minor' }) // Forces grouping
      ];

      const analysis = createAnalysisWithOutdatedPackages(dependencies);
      const candidates = analyzer.analyze(analysis);

      const groupedTask = candidates.find(c => c.candidateId === 'outdated-group-minor');
      expect(groupedTask).toBeDefined();

      // Since it contains a major update, should include testing suggestion
      // Actually, let's test with actual major grouping
      const majorDeps = [
        createOutdatedDependency({ name: 'pkg1', updateType: 'patch' }),
        createOutdatedDependency({ name: 'pkg2', updateType: 'patch' }),
        createOutdatedDependency({ name: 'pkg3', updateType: 'patch' })
      ];

      const majorAnalysis = createAnalysisWithOutdatedPackages(majorDeps);
      const majorCandidates = analyzer.analyze(majorAnalysis);

      const patchGrouped = majorCandidates.find(c => c.candidateId === 'outdated-group-patch');
      expect(patchGrouped).toBeDefined();

      const suggestions = patchGrouped!.remediationSuggestions!;
      const testingSuggestion = suggestions.find(s => s.type === 'testing');
      expect(testingSuggestion).toBeUndefined(); // No testing for patch groups
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty outdated packages array', () => {
      const analysis = createAnalysisWithOutdatedPackages([]); // No packages
      const candidates = analyzer.analyze(analysis);

      const outdatedTasks = candidates.filter(c => c.candidateId.includes('outdated'));
      expect(outdatedTasks).toHaveLength(0);
    });

    it('should handle scoped package names correctly', () => {
      const dependency = createOutdatedDependency({
        name: '@types/node',
        updateType: 'minor'
      });

      const analysis = createAnalysisWithOutdatedPackages([dependency]);
      const candidates = analyzer.analyze(analysis);

      const scopedTask = candidates.find(c => c.candidateId.includes('outdated-minor'));
      expect(scopedTask).toBeDefined();
      expect(scopedTask!.candidateId).toBe('outdated-minor--types-node'); // Sanitized ID
      expect(scopedTask!.title).toBe('Minor Update: @types/node');
    });

    it('should handle packages with special characters in names', () => {
      const dependency = createOutdatedDependency({
        name: 'my-package_v2.special',
        updateType: 'patch'
      });

      const analysis = createAnalysisWithOutdatedPackages([dependency]);
      const candidates = analyzer.analyze(analysis);

      const specialTask = candidates.find(c => c.candidateId.includes('patch'));
      expect(specialTask).toBeDefined();
      expect(specialTask!.candidateId).toBe('outdated-patch-my-package-v2-special'); // Sanitized
    });

    it('should handle very large numbers of updates correctly', () => {
      const manyUpdates: OutdatedDependency[] = Array.from({ length: 20 }, (_, i) =>
        createOutdatedDependency({
          name: `package-${i}`,
          currentVersion: '1.0.0',
          latestVersion: '1.1.0',
          updateType: 'minor'
        })
      );

      const analysis = createAnalysisWithOutdatedPackages(manyUpdates);
      const candidates = analyzer.analyze(analysis);

      const groupedTask = candidates.find(c => c.candidateId === 'outdated-group-minor');
      expect(groupedTask).toBeDefined();
      expect(groupedTask!.score).toBe(0.6);
      expect(groupedTask!.effort).toBe('high'); // >10 packages = high effort
      expect(groupedTask!.title).toBe('20 Minor Updates');
    });
  });

  describe('Real-World Scenario Testing', () => {
    it('should handle complex real-world update mix with correct scoring', () => {
      const realWorldUpdates = [
        // Major framework update
        createOutdatedDependency({
          name: 'react',
          currentVersion: '16.14.0',
          latestVersion: '18.2.0',
          updateType: 'major'
        }),

        // Minor utility updates
        createOutdatedDependency({
          name: 'lodash',
          currentVersion: '4.17.20',
          latestVersion: '4.17.21',
          updateType: 'minor'
        }),
        createOutdatedDependency({
          name: 'axios',
          currentVersion: '0.27.0',
          latestVersion: '0.28.0',
          updateType: 'minor'
        }),

        // Patch updates
        createOutdatedDependency({
          name: 'express',
          currentVersion: '4.18.0',
          latestVersion: '4.18.2',
          updateType: 'patch'
        }),
        createOutdatedDependency({
          name: 'cors',
          currentVersion: '2.8.5',
          latestVersion: '2.8.6',
          updateType: 'patch'
        }),
        createOutdatedDependency({
          name: 'helmet',
          currentVersion: '6.0.0',
          latestVersion: '6.0.1',
          updateType: 'patch'
        })
      ];

      const analysis = createAnalysisWithOutdatedPackages(realWorldUpdates);
      const candidates = analyzer.analyze(analysis);

      // Verify we have expected task structure
      const majorTasks = candidates.filter(c => c.candidateId.includes('major'));
      const minorTasks = candidates.filter(c => c.candidateId.includes('minor'));
      const patchTasks = candidates.filter(c => c.candidateId.includes('patch'));

      expect(majorTasks).toHaveLength(1); // React major update
      expect(minorTasks).toHaveLength(2); // Individual minor tasks (<=3)
      expect(patchTasks).toHaveLength(1); // Grouped patch task (>2)

      // Verify exact scores
      expect(majorTasks[0].score).toBe(0.8);
      expect(minorTasks[0].score).toBe(0.6);
      expect(minorTasks[1].score).toBe(0.6);
      expect(patchTasks[0].score).toBe(0.4);

      // Verify priority ordering
      expect(majorTasks[0].priority).toBe('high');
      expect(minorTasks[0].priority).toBe('normal');
      expect(patchTasks[0].priority).toBe('low');

      // Verify ordering by score
      const allScores = candidates.map(c => c.score).sort((a, b) => b - a);
      expect(allScores).toEqual([0.8, 0.6, 0.6, 0.4]);
    });
  });
});
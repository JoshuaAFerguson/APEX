/**
 * Additional edge case tests for update type scoring
 *
 * These tests cover specific edge cases that might not be covered
 * in the comprehensive test suite.
 */

import { MaintenanceAnalyzer } from './maintenance-analyzer';
import type { ProjectAnalysis, OutdatedDependency } from '../idle-processor';

describe('MaintenanceAnalyzer - Update Type Edge Cases', () => {
  let analyzer: MaintenanceAnalyzer;

  beforeEach(() => {
    analyzer = new MaintenanceAnalyzer();
  });

  // Helper function to create minimal ProjectAnalysis
  function createAnalysis(outdatedPackages: OutdatedDependency[] = []): ProjectAnalysis {
    return {
      codebaseSize: { files: 1, lines: 100, languages: { typescript: 100 } },
      dependencies: {
        outdated: [],
        security: [],
        outdatedPackages,
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
        coverage: 100,
        missingDocs: [],
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 100,
          details: {
            totalEndpoints: 0,
            documentedEndpoints: 0,
            undocumentedItems: [],
            wellDocumentedExamples: [],
            commonIssues: []
          }
        }
      },
      performance: {
        slowTests: [],
        bottlenecks: []
      }
    };
  }

  describe('Score Precision and Consistency', () => {
    it('should maintain exact score values across multiple invocations', () => {
      const dependencies = [
        {
          name: 'test-major',
          currentVersion: '1.0.0',
          latestVersion: '2.0.0',
          updateType: 'major' as const
        },
        {
          name: 'test-minor',
          currentVersion: '1.0.0',
          latestVersion: '1.1.0',
          updateType: 'minor' as const
        },
        {
          name: 'test-patch',
          currentVersion: '1.0.0',
          latestVersion: '1.0.1',
          updateType: 'patch' as const
        }
      ];

      const analysis = createAnalysis(dependencies);

      // Run the analyzer multiple times to ensure consistency
      const results1 = analyzer.analyze(analysis);
      const results2 = analyzer.analyze(analysis);
      const results3 = analyzer.analyze(analysis);

      const getScores = (results: any[]) =>
        results.filter(r => r.candidateId.includes('outdated'))
               .map(r => r.score)
               .sort((a, b) => b - a);

      expect(getScores(results1)).toEqual(getScores(results2));
      expect(getScores(results2)).toEqual(getScores(results3));
      expect(getScores(results1)).toEqual([0.8, 0.6, 0.4]);
    });

    it('should assign scores independent of package order', () => {
      const dependenciesOrder1 = [
        { name: 'pkg-major', currentVersion: '1.0.0', latestVersion: '2.0.0', updateType: 'major' as const },
        { name: 'pkg-minor', currentVersion: '1.0.0', latestVersion: '1.1.0', updateType: 'minor' as const },
        { name: 'pkg-patch', currentVersion: '1.0.0', latestVersion: '1.0.1', updateType: 'patch' as const }
      ];

      const dependenciesOrder2 = [
        { name: 'pkg-patch', currentVersion: '1.0.0', latestVersion: '1.0.1', updateType: 'patch' as const },
        { name: 'pkg-major', currentVersion: '1.0.0', latestVersion: '2.0.0', updateType: 'major' as const },
        { name: 'pkg-minor', currentVersion: '1.0.0', latestVersion: '1.1.0', updateType: 'minor' as const }
      ];

      const results1 = analyzer.analyze(createAnalysis(dependenciesOrder1));
      const results2 = analyzer.analyze(createAnalysis(dependenciesOrder2));

      const scores1 = results1.map(r => ({ id: r.candidateId, score: r.score }))
                             .filter(r => r.id.includes('outdated'))
                             .sort((a, b) => a.id.localeCompare(b.id));

      const scores2 = results2.map(r => ({ id: r.candidateId, score: r.score }))
                             .filter(r => r.id.includes('outdated'))
                             .sort((a, b) => a.id.localeCompare(b.id));

      expect(scores1).toEqual(scores2);
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle undefined/null outdatedPackages gracefully', () => {
      const analysis = createAnalysis();
      // Explicitly set to undefined to test edge case
      analysis.dependencies.outdatedPackages = undefined;

      const candidates = analyzer.analyze(analysis);
      const outdatedTasks = candidates.filter(c => c.candidateId.includes('outdated'));

      expect(outdatedTasks).toHaveLength(0);
    });

    it('should handle very large version numbers correctly', () => {
      const dependency = {
        name: 'large-version-pkg',
        currentVersion: '999.999.999',
        latestVersion: '1000.0.0',
        updateType: 'major' as const
      };

      const analysis = createAnalysis([dependency]);
      const candidates = analyzer.analyze(analysis);

      const task = candidates.find(c => c.candidateId.includes('major'));
      expect(task).toBeDefined();
      expect(task!.score).toBe(0.8);
      expect(task!.description).toContain('999.999.999');
      expect(task!.description).toContain('1000.0.0');
    });

    it('should handle pre-release version identifiers', () => {
      const dependency = {
        name: 'prerelease-pkg',
        currentVersion: '1.0.0-alpha.1',
        latestVersion: '1.0.0-beta.3',
        updateType: 'patch' as const
      };

      const analysis = createAnalysis([dependency]);
      const candidates = analyzer.analyze(analysis);

      const task = candidates.find(c => c.candidateId.includes('patch'));
      expect(task).toBeDefined();
      expect(task!.score).toBe(0.4);
      expect(task!.description).toContain('alpha.1');
      expect(task!.description).toContain('beta.3');
    });
  });

  describe('Remediation Suggestions Completeness', () => {
    it('should provide comprehensive remediation suggestions for all update types', () => {
      const dependencies = [
        { name: 'major-pkg', currentVersion: '1.0.0', latestVersion: '2.0.0', updateType: 'major' as const },
        { name: 'minor-pkg', currentVersion: '1.0.0', latestVersion: '1.1.0', updateType: 'minor' as const },
        { name: 'patch-pkg', currentVersion: '1.0.0', latestVersion: '1.0.1', updateType: 'patch' as const }
      ];

      const analysis = createAnalysis(dependencies);
      const candidates = analyzer.analyze(analysis);

      candidates.forEach(candidate => {
        expect(candidate.remediationSuggestions).toBeDefined();
        expect(candidate.remediationSuggestions!.length).toBeGreaterThan(0);

        // Should have at least npm_update suggestion
        const npmUpdate = candidate.remediationSuggestions!.find(s => s.type === 'npm_update');
        expect(npmUpdate).toBeDefined();
        expect(npmUpdate!.command).toMatch(/npm update/);
      });
    });

    it('should include migration warnings only for major updates', () => {
      const majorDep = { name: 'major-pkg', currentVersion: '1.0.0', latestVersion: '2.0.0', updateType: 'major' as const };
      const minorDep = { name: 'minor-pkg', currentVersion: '1.0.0', latestVersion: '1.1.0', updateType: 'minor' as const };

      const majorResult = analyzer.analyze(createAnalysis([majorDep]));
      const minorResult = analyzer.analyze(createAnalysis([minorDep]));

      const majorTask = majorResult.find(c => c.candidateId.includes('major'));
      const minorTask = minorResult.find(c => c.candidateId.includes('minor'));

      const majorMigration = majorTask!.remediationSuggestions!.find(s => s.type === 'migration_guide');
      const minorMigration = minorTask!.remediationSuggestions!.find(s => s.type === 'migration_guide');

      expect(majorMigration).toBeDefined();
      expect(minorMigration).toBeUndefined();
    });
  });

  describe('Integration with Legacy Backward Compatibility', () => {
    it('should not create duplicate tasks when both formats are accidentally present', () => {
      const analysis = createAnalysis([
        { name: 'modern-pkg', currentVersion: '1.0.0', latestVersion: '2.0.0', updateType: 'major' as const }
      ]);

      // Accidentally include legacy format too
      analysis.dependencies.outdated = ['legacy-pkg@1.0.0'];

      const candidates = analyzer.analyze(analysis);

      // Should only process the rich format, not the legacy
      const modernTask = candidates.find(c => c.candidateId.includes('modern-pkg'));
      const legacyTask = candidates.find(c => c.candidateId === 'outdated-deps');

      expect(modernTask).toBeDefined();
      expect(legacyTask).toBeUndefined();
    });
  });

  describe('Performance and Scale', () => {
    it('should handle moderate number of mixed updates efficiently', () => {
      // Create a realistic mix of 15 packages
      const dependencies = [
        // 3 major updates
        { name: 'major-pkg-1', currentVersion: '1.0.0', latestVersion: '2.0.0', updateType: 'major' as const },
        { name: 'major-pkg-2', currentVersion: '2.0.0', latestVersion: '3.0.0', updateType: 'major' as const },
        { name: 'major-pkg-3', currentVersion: '3.0.0', latestVersion: '4.0.0', updateType: 'major' as const },

        // 6 minor updates (should be grouped)
        ...Array.from({ length: 6 }, (_, i) => ({
          name: `minor-pkg-${i + 1}`,
          currentVersion: '1.0.0',
          latestVersion: '1.1.0',
          updateType: 'minor' as const
        })),

        // 6 patch updates (should be grouped)
        ...Array.from({ length: 6 }, (_, i) => ({
          name: `patch-pkg-${i + 1}`,
          currentVersion: '1.0.0',
          latestVersion: '1.0.1',
          updateType: 'patch' as const
        }))
      ];

      const analysis = createAnalysis(dependencies);

      // Measure performance (should complete quickly)
      const startTime = Date.now();
      const candidates = analyzer.analyze(analysis);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete in < 100ms

      // Verify structure: 3 individual major + 1 grouped minor + 1 grouped patch = 5 tasks
      const majorTasks = candidates.filter(c => c.candidateId.includes('outdated-major'));
      const minorTasks = candidates.filter(c => c.candidateId.includes('outdated-group-minor'));
      const patchTasks = candidates.filter(c => c.candidateId.includes('outdated-group-patch'));

      expect(majorTasks).toHaveLength(3); // Individual major tasks
      expect(minorTasks).toHaveLength(1); // Grouped minor task
      expect(patchTasks).toHaveLength(1); // Grouped patch task

      // Verify scoring
      majorTasks.forEach(task => expect(task.score).toBe(0.8));
      expect(minorTasks[0].score).toBe(0.6);
      expect(patchTasks[0].score).toBe(0.4);
    });
  });
});
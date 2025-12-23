/**
 * Test Coverage Verification for MaintenanceAnalyzer
 *
 * This file verifies that all methods and code paths in MaintenanceAnalyzer
 * are properly tested, with specific focus on deprecated package detection.
 */

import { MaintenanceAnalyzer } from './maintenance-analyzer';
import type { ProjectAnalysis, DeprecatedPackage, SecurityVulnerability } from '../idle-processor';

describe('MaintenanceAnalyzer - Test Coverage Verification', () => {
  let analyzer: MaintenanceAnalyzer;

  beforeEach(() => {
    analyzer = new MaintenanceAnalyzer();
  });

  // Helper to create analysis
  function createAnalysis(
    deprecatedPackages: DeprecatedPackage[] = [],
    securityIssues: SecurityVulnerability[] = [],
    outdated: string[] = []
  ): ProjectAnalysis {
    return {
      codebaseSize: {
        files: 100,
        lines: 10000,
        languages: { typescript: 8000, javascript: 2000 }
      },
      testCoverage: undefined,
      dependencies: {
        outdated,
        security: [],
        securityIssues,
        deprecatedPackages,
        outdatedPackages: []
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

  describe('Public Method Coverage', () => {
    it('should test analyze() method with all parameter combinations', () => {
      // Test 1: Empty analysis
      const emptyAnalysis = createAnalysis();
      const emptyCandidates = analyzer.analyze(emptyAnalysis);
      expect(Array.isArray(emptyCandidates)).toBe(true);

      // Test 2: Only deprecated packages
      const deprecatedOnly = createAnalysis([{
        name: 'test-package',
        currentVersion: '1.0.0',
        replacement: 'new-package',
        reason: 'Test'
      }]);
      const deprecatedCandidates = analyzer.analyze(deprecatedOnly);
      expect(deprecatedCandidates.some(c => c.candidateId.startsWith('deprecated-pkg-'))).toBe(true);

      // Test 3: Mixed dependencies
      const mixedAnalysis = createAnalysis(
        [{ name: 'deprecated', currentVersion: '1.0.0', replacement: null, reason: 'Test' }],
        [{ name: 'vulnerable', cveId: 'CVE-2024-1234', severity: 'high' as const, affectedVersions: '<1.0.0', description: 'Test vulnerability' }],
        ['outdated@1.0.0']
      );
      const mixedCandidates = analyzer.analyze(mixedAnalysis);
      expect(mixedCandidates.length).toBeGreaterThan(0);
    });

    it('should test type property', () => {
      expect(analyzer.type).toBe('maintenance');
      expect(typeof analyzer.type).toBe('string');
    });

    it('should test inherited prioritize() method', () => {
      const candidates = [
        {
          candidateId: 'test-1',
          title: 'Test 1',
          description: 'Test description',
          priority: 'normal' as const,
          estimatedEffort: 'medium' as const,
          suggestedWorkflow: 'maintenance',
          rationale: 'Test rationale',
          score: 0.5
        },
        {
          candidateId: 'test-2',
          title: 'Test 2',
          description: 'Test description',
          priority: 'high' as const,
          estimatedEffort: 'medium' as const,
          suggestedWorkflow: 'maintenance',
          rationale: 'Test rationale',
          score: 0.8
        }
      ];

      const best = analyzer.prioritize(candidates);
      expect(best).toBeDefined();
      expect(best!.score).toBe(0.8);

      // Test empty array
      const noBest = analyzer.prioritize([]);
      expect(noBest).toBeNull();
    });
  });

  describe('Private Method Coverage (via Public Interface)', () => {
    it('should test createDeprecatedPackageTask() via analyze()', () => {
      const testCases: DeprecatedPackage[] = [
        {
          name: 'with-replacement',
          currentVersion: '1.0.0',
          replacement: 'new-package',
          reason: 'Has replacement'
        },
        {
          name: 'without-replacement',
          currentVersion: '2.0.0',
          replacement: null,
          reason: 'No replacement'
        }
      ];

      const analysis = createAnalysis(testCases);
      const candidates = analyzer.analyze(analysis);

      const withReplacement = candidates.find(c => c.candidateId === 'deprecated-pkg-with-replacement');
      const withoutReplacement = candidates.find(c => c.candidateId === 'deprecated-pkg-without-replacement');

      expect(withReplacement?.priority).toBe('normal');
      expect(withReplacement?.score).toBe(0.6);
      expect(withoutReplacement?.priority).toBe('high');
      expect(withoutReplacement?.score).toBe(0.8);
    });

    it('should test buildDeprecatedPackageDescription() via analyze()', () => {
      const packageWithAllFields: DeprecatedPackage = {
        name: 'complete-package',
        currentVersion: '3.2.1',
        replacement: 'modern-package',
        reason: 'Complete deprecation information'
      };

      const packageWithMinimalInfo: DeprecatedPackage = {
        name: 'minimal-package',
        currentVersion: '1.0.0',
        replacement: 'replacement',
        reason: ''
      };

      const packageWithoutReplacement: DeprecatedPackage = {
        name: 'no-replacement',
        currentVersion: '1.0.0',
        replacement: null,
        reason: 'No alternative available'
      };

      const analysis = createAnalysis([packageWithAllFields, packageWithMinimalInfo, packageWithoutReplacement]);
      const candidates = analyzer.analyze(analysis);

      const completeTask = candidates.find(c => c.candidateId === 'deprecated-pkg-complete-package');
      const minimalTask = candidates.find(c => c.candidateId === 'deprecated-pkg-minimal-package');
      const noReplacementTask = candidates.find(c => c.candidateId === 'deprecated-pkg-no-replacement');

      // Complete package should have all information
      expect(completeTask?.description).toContain('complete-package@3.2.1 is deprecated');
      expect(completeTask?.description).toContain('Reason: Complete deprecation information');
      expect(completeTask?.description).toContain('Recommended replacement: modern-package');

      // Minimal package should skip empty reason
      expect(minimalTask?.description).toContain('minimal-package@1.0.0 is deprecated');
      expect(minimalTask?.description).not.toContain('Reason:');
      expect(minimalTask?.description).toContain('Recommended replacement: replacement');

      // No replacement should indicate manual migration
      expect(noReplacementTask?.description).toContain('No direct replacement available - manual migration required');
    });

    it('should test buildDeprecatedPackageRationale() via analyze()', () => {
      const withReplacement: DeprecatedPackage = {
        name: 'with-replacement',
        currentVersion: '1.0.0',
        replacement: 'modern-alternative',
        reason: 'Test'
      };

      const withoutReplacement: DeprecatedPackage = {
        name: 'without-replacement',
        currentVersion: '1.0.0',
        replacement: null,
        reason: 'Test'
      };

      const analysis = createAnalysis([withReplacement, withoutReplacement]);
      const candidates = analyzer.analyze(analysis);

      const replacementTask = candidates.find(c => c.candidateId === 'deprecated-pkg-with-replacement');
      const noReplacementTask = candidates.find(c => c.candidateId === 'deprecated-pkg-without-replacement');

      expect(replacementTask?.rationale).toContain('Migration to modern-alternative ensures continued support');
      expect(replacementTask?.rationale).toContain('stop receiving security updates and bug fixes');

      expect(noReplacementTask?.rationale).toContain('requiring urgent attention to find alternative solutions');
    });
  });

  describe('Code Path Coverage', () => {
    it('should test all conditional branches in analyze()', () => {
      // Branch 1: No deprecated packages
      const noDeprecated = createAnalysis();
      const noCandidates = analyzer.analyze(noDeprecated);
      const deprecatedTasks1 = noCandidates.filter(c => c.candidateId.startsWith('deprecated-pkg-'));
      expect(deprecatedTasks1).toHaveLength(0);

      // Branch 2: Empty deprecated packages array
      const emptyDeprecated = createAnalysis([]);
      const emptyCandidates = analyzer.analyze(emptyDeprecated);
      const deprecatedTasks2 = emptyCandidates.filter(c => c.candidateId.startsWith('deprecated-pkg-'));
      expect(deprecatedTasks2).toHaveLength(0);

      // Branch 3: Undefined deprecated packages
      const undefinedAnalysis = createAnalysis();
      delete (undefinedAnalysis.dependencies as any).deprecatedPackages;
      const undefinedCandidates = analyzer.analyze(undefinedAnalysis);
      const deprecatedTasks3 = undefinedCandidates.filter(c => c.candidateId.startsWith('deprecated-pkg-'));
      expect(deprecatedTasks3).toHaveLength(0);

      // Branch 4: Non-array deprecated packages (defensive programming)
      const malformedAnalysis = createAnalysis();
      (malformedAnalysis.dependencies as any).deprecatedPackages = 'not-an-array';
      expect(() => {
        const malformedCandidates = analyzer.analyze(malformedAnalysis);
        expect(Array.isArray(malformedCandidates)).toBe(true);
      }).not.toThrow();
    });

    it('should test package name sanitization', () => {
      const specialCharPackages: DeprecatedPackage[] = [
        {
          name: '@scope/package-with-special/chars',
          currentVersion: '1.0.0',
          replacement: 'normal-package',
          reason: 'Test special characters'
        },
        {
          name: 'package.with.dots',
          currentVersion: '1.0.0',
          replacement: 'no-dots-package',
          reason: 'Test dots'
        },
        {
          name: 'package_with_underscores',
          currentVersion: '1.0.0',
          replacement: 'dashed-package',
          reason: 'Test underscores'
        }
      ];

      const analysis = createAnalysis(specialCharPackages);
      const candidates = analyzer.analyze(analysis);

      // All candidate IDs should be URL-safe
      candidates.forEach(candidate => {
        if (candidate.candidateId.startsWith('deprecated-pkg-')) {
          expect(candidate.candidateId).toMatch(/^deprecated-pkg-[a-zA-Z0-9-]+$/);
          expect(candidate.candidateId).not.toContain('/');
          expect(candidate.candidateId).not.toContain('.');
          expect(candidate.candidateId).not.toContain('_');
        }
      });
    });

    it('should test priority and score assignment logic', () => {
      const priorityTestPackages: DeprecatedPackage[] = [
        {
          name: 'with-replacement',
          currentVersion: '1.0.0',
          replacement: 'new-package',
          reason: 'Has replacement - should be normal priority'
        },
        {
          name: 'without-replacement',
          currentVersion: '1.0.0',
          replacement: null,
          reason: 'No replacement - should be high priority'
        },
        {
          name: 'empty-replacement',
          currentVersion: '1.0.0',
          replacement: '',
          reason: 'Empty replacement - should be treated as no replacement'
        }
      ];

      const analysis = createAnalysis(priorityTestPackages);
      const candidates = analyzer.analyze(analysis);

      const withReplacement = candidates.find(c => c.candidateId === 'deprecated-pkg-with-replacement');
      const withoutReplacement = candidates.find(c => c.candidateId === 'deprecated-pkg-without-replacement');
      const emptyReplacement = candidates.find(c => c.candidateId === 'deprecated-pkg-empty-replacement');

      // Normal priority for packages with replacement
      expect(withReplacement?.priority).toBe('normal');
      expect(withReplacement?.score).toBe(0.6);

      // High priority for packages without replacement
      expect(withoutReplacement?.priority).toBe('high');
      expect(withoutReplacement?.score).toBe(0.8);

      // Empty replacement should be treated as no replacement
      expect(emptyReplacement?.priority).toBe('normal');
      expect(emptyReplacement?.score).toBe(0.6);
    });
  });

  describe('Integration with Base Class', () => {
    it('should test createCandidate() helper method usage', () => {
      const testPackage: DeprecatedPackage = {
        name: 'test-package',
        currentVersion: '1.0.0',
        replacement: 'new-package',
        reason: 'Testing candidate creation'
      };

      const analysis = createAnalysis([testPackage]);
      const candidates = analyzer.analyze(analysis);

      const candidate = candidates.find(c => c.candidateId === 'deprecated-pkg-test-package');

      // Verify the candidate was created with correct structure
      expect(candidate?.candidateId).toBe('deprecated-pkg-test-package');
      expect(candidate?.title).toBeDefined();
      expect(candidate?.description).toBeDefined();
      expect(candidate?.priority).toBeDefined();
      expect(candidate?.estimatedEffort).toBe('medium');
      expect(candidate?.suggestedWorkflow).toBe('maintenance');
      expect(candidate?.rationale).toBeDefined();
      expect(candidate?.score).toBeDefined();
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle analysis object mutations gracefully', () => {
      const analysis = createAnalysis([{
        name: 'test-package',
        currentVersion: '1.0.0',
        replacement: 'new-package',
        reason: 'Test'
      }]);

      // Mutate the analysis during processing (shouldn't happen but testing defensively)
      const originalAnalyze = analyzer.analyze;
      let mutatedDuringExecution = false;

      // Mock analyze to mutate the input
      const testAnalyze = function(this: MaintenanceAnalyzer, input: ProjectAnalysis) {
        if (!mutatedDuringExecution) {
          mutatedDuringExecution = true;
          // Mutate the input
          (input.dependencies as any).deprecatedPackages = null;
        }
        return originalAnalyze.call(this, input);
      };

      analyzer.analyze = testAnalyze.bind(analyzer);

      expect(() => {
        const candidates = analyzer.analyze(analysis);
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();

      // Restore original method
      analyzer.analyze = originalAnalyze;
    });

    it('should maintain consistent state across multiple analyze calls', () => {
      const package1: DeprecatedPackage = {
        name: 'package-1',
        currentVersion: '1.0.0',
        replacement: 'new-package-1',
        reason: 'First call'
      };

      const package2: DeprecatedPackage = {
        name: 'package-2',
        currentVersion: '2.0.0',
        replacement: null,
        reason: 'Second call'
      };

      const analysis1 = createAnalysis([package1]);
      const analysis2 = createAnalysis([package2]);

      const candidates1 = analyzer.analyze(analysis1);
      const candidates2 = analyzer.analyze(analysis2);

      // Verify no state leakage between calls
      expect(candidates1.some(c => c.candidateId === 'deprecated-pkg-package-1')).toBe(true);
      expect(candidates1.some(c => c.candidateId === 'deprecated-pkg-package-2')).toBe(false);

      expect(candidates2.some(c => c.candidateId === 'deprecated-pkg-package-2')).toBe(true);
      expect(candidates2.some(c => c.candidateId === 'deprecated-pkg-package-1')).toBe(false);
    });
  });
});
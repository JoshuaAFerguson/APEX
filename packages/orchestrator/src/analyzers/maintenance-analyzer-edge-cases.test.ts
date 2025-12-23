/**
 * Edge Cases Tests for MaintenanceAnalyzer Deprecated Package Detection
 *
 * Tests various edge cases, boundary conditions, and error scenarios
 * to ensure robust handling of unexpected or malformed data.
 */

import { MaintenanceAnalyzer } from './maintenance-analyzer';
import type { ProjectAnalysis, DeprecatedPackage } from '../idle-processor';

describe('MaintenanceAnalyzer - Edge Cases', () => {
  let analyzer: MaintenanceAnalyzer;

  beforeEach(() => {
    analyzer = new MaintenanceAnalyzer();
  });

  // Helper function to create minimal ProjectAnalysis
  function createMinimalAnalysis(deprecatedPackages?: DeprecatedPackage[]): ProjectAnalysis {
    return {
      codebaseSize: {
        files: 1,
        lines: 100,
        languages: { typescript: 100 }
      },
      testCoverage: undefined,
      dependencies: {
        outdated: [],
        security: [],
        ...(deprecatedPackages !== undefined && { deprecatedPackages })
      },
      codeQuality: {
        lintIssues: 0,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: {
        coverage: 0,
        missingDocs: [],
        outdatedSections: [],
        apiCompleteness: {
          percentage: 0,
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
        bundleSize: undefined,
        slowTests: [],
        bottlenecks: []
      }
    };
  }

  describe('Malformed Package Data', () => {
    it('should handle packages with extremely long names', () => {
      const longName = 'a'.repeat(1000);
      const deprecatedPackage: DeprecatedPackage = {
        name: longName,
        currentVersion: '1.0.0',
        replacement: 'short-name',
        reason: 'Testing long names'
      };

      const analysis = createMinimalAnalysis([deprecatedPackage]);
      const candidates = analyzer.analyze(analysis);

      expect(candidates).toHaveLength(1);
      expect(candidates[0].title).toContain(longName);
      expect(candidates[0].candidateId).toContain('deprecated-pkg-');
    });

    it('should handle packages with special Unicode characters', () => {
      const unicodePackages: DeprecatedPackage[] = [
        {
          name: 'package-with-émojis-🚀',
          currentVersion: '1.0.0',
          replacement: 'normal-package',
          reason: 'Unicode characters in name'
        },
        {
          name: '测试包名',
          currentVersion: '2.0.0',
          replacement: null,
          reason: 'Chinese characters'
        },
        {
          name: 'пакет-тест',
          currentVersion: '3.0.0',
          replacement: 'english-package',
          reason: 'Cyrillic characters'
        }
      ];

      const analysis = createMinimalAnalysis(unicodePackages);

      expect(() => {
        const candidates = analyzer.analyze(analysis);
        expect(candidates).toHaveLength(3);

        candidates.forEach(candidate => {
          expect(candidate.title).toBeDefined();
          expect(candidate.description).toBeDefined();
          expect(candidate.candidateId).toBeDefined();
        });
      }).not.toThrow();
    });

    it('should handle packages with null/undefined properties', () => {
      // TypeScript would normally prevent this, but testing runtime resilience
      const malformedPackages = [
        {
          name: 'valid-name',
          currentVersion: '1.0.0',
          replacement: 'new-package',
          reason: null as any
        },
        {
          name: 'another-package',
          currentVersion: undefined as any,
          replacement: 'replacement',
          reason: 'reason'
        },
        {
          name: 'third-package',
          currentVersion: '1.0.0',
          replacement: undefined as any,
          reason: 'reason'
        }
      ];

      const analysis = createMinimalAnalysis(malformedPackages);

      expect(() => {
        const candidates = analyzer.analyze(analysis);
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });
  });

  describe('Boundary Value Testing', () => {
    it('should handle exactly one deprecated package', () => {
      const singlePackage: DeprecatedPackage = {
        name: 'single-package',
        currentVersion: '1.0.0',
        replacement: 'new-package',
        reason: 'Single package test'
      };

      const analysis = createMinimalAnalysis([singlePackage]);
      const candidates = analyzer.analyze(analysis);

      expect(candidates).toHaveLength(1);
      expect(candidates[0].candidateId).toBe('deprecated-pkg-single-package');
    });

    it('should handle empty deprecated packages array', () => {
      const analysis = createMinimalAnalysis([]);
      const candidates = analyzer.analyze(analysis);

      const deprecatedTasks = candidates.filter(c => c.candidateId.startsWith('deprecated-pkg-'));
      expect(deprecatedTasks).toHaveLength(0);
    });

    it('should handle missing deprecated packages property', () => {
      const analysis = createMinimalAnalysis();
      delete (analysis.dependencies as any).deprecatedPackages;

      const candidates = analyzer.analyze(analysis);
      const deprecatedTasks = candidates.filter(c => c.candidateId.startsWith('deprecated-pkg-'));
      expect(deprecatedTasks).toHaveLength(0);
    });

    it('should handle maximum realistic number of deprecated packages', () => {
      // Test with 1000 deprecated packages
      const manyPackages: DeprecatedPackage[] = Array.from({ length: 1000 }, (_, i) => ({
        name: `package-${i.toString().padStart(4, '0')}`,
        currentVersion: '1.0.0',
        replacement: i % 3 === 0 ? null : `replacement-${i}`,
        reason: `Deprecation reason for package ${i}`
      }));

      const analysis = createMinimalAnalysis(manyPackages);

      const startTime = Date.now();
      const candidates = analyzer.analyze(analysis);
      const endTime = Date.now();

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max

      const deprecatedTasks = candidates.filter(c => c.candidateId.startsWith('deprecated-pkg-'));
      expect(deprecatedTasks).toHaveLength(1000);
    });
  });

  describe('Version String Edge Cases', () => {
    it('should handle various version formats', () => {
      const versionVariants: DeprecatedPackage[] = [
        {
          name: 'semver-package',
          currentVersion: '1.2.3',
          replacement: 'new-package',
          reason: 'Standard semver'
        },
        {
          name: 'prerelease-package',
          currentVersion: '2.0.0-alpha.1',
          replacement: 'stable-package',
          reason: 'Prerelease version'
        },
        {
          name: 'build-metadata-package',
          currentVersion: '1.0.0+20210101',
          replacement: 'modern-package',
          reason: 'Build metadata'
        },
        {
          name: 'non-semver-package',
          currentVersion: 'latest',
          replacement: 'versioned-package',
          reason: 'Non-semver version'
        },
        {
          name: 'empty-version-package',
          currentVersion: '',
          replacement: 'versioned-replacement',
          reason: 'Empty version string'
        }
      ];

      const analysis = createMinimalAnalysis(versionVariants);
      const candidates = analyzer.analyze(analysis);

      expect(candidates).toHaveLength(5);

      candidates.forEach(candidate => {
        expect(candidate.description).toContain('@');
        expect(candidate.title).toBeDefined();
        expect(candidate.candidateId).toMatch(/^deprecated-pkg-/);
      });
    });
  });

  describe('Replacement Scenarios', () => {
    it('should handle replacement strings with special characters', () => {
      const specialReplacements: DeprecatedPackage[] = [
        {
          name: 'scoped-package',
          currentVersion: '1.0.0',
          replacement: '@company/new-package',
          reason: 'Scoped replacement'
        },
        {
          name: 'url-replacement',
          currentVersion: '1.0.0',
          replacement: 'https://github.com/user/repo',
          reason: 'URL as replacement'
        },
        {
          name: 'multiple-replacements',
          currentVersion: '1.0.0',
          replacement: 'package-a, package-b, or package-c',
          reason: 'Multiple replacement options'
        },
        {
          name: 'replacement-with-version',
          currentVersion: '1.0.0',
          replacement: 'new-package@^2.0.0',
          reason: 'Replacement with version constraint'
        }
      ];

      const analysis = createMinimalAnalysis(specialReplacements);
      const candidates = analyzer.analyze(analysis);

      expect(candidates).toHaveLength(4);

      candidates.forEach(candidate => {
        expect(candidate.priority).toBe('normal'); // All have replacements
        expect(candidate.score).toBe(0.6);
        expect(candidate.description).toContain('Recommended replacement:');
      });
    });

    it('should handle null replacement consistently', () => {
      const noReplacementPackage: DeprecatedPackage = {
        name: 'orphaned-package',
        currentVersion: '1.0.0',
        replacement: null,
        reason: 'No replacement available'
      };

      const analysis = createMinimalAnalysis([noReplacementPackage]);
      const candidates = analyzer.analyze(analysis);

      expect(candidates).toHaveLength(1);
      expect(candidates[0].priority).toBe('high');
      expect(candidates[0].score).toBe(0.8);
      expect(candidates[0].description).toContain('No direct replacement available');
      expect(candidates[0].title).not.toContain('→');
    });
  });

  describe('Reason String Handling', () => {
    it('should handle extremely long deprecation reasons', () => {
      const longReason = 'This package has been deprecated because ' + 'very long reason '.repeat(100);

      const packageWithLongReason: DeprecatedPackage = {
        name: 'long-reason-package',
        currentVersion: '1.0.0',
        replacement: 'concise-package',
        reason: longReason
      };

      const analysis = createMinimalAnalysis([packageWithLongReason]);
      const candidates = analyzer.analyze(analysis);

      expect(candidates).toHaveLength(1);
      expect(candidates[0].description).toContain(longReason);
      expect(candidates[0].description.length).toBeGreaterThan(1000);
    });

    it('should handle reasons with special formatting', () => {
      const formattedReasons: DeprecatedPackage[] = [
        {
          name: 'newlines-package',
          currentVersion: '1.0.0',
          replacement: 'clean-package',
          reason: 'Reason with\nmultiple\nlines'
        },
        {
          name: 'tabs-package',
          currentVersion: '1.0.0',
          replacement: 'formatted-package',
          reason: 'Reason\twith\ttabs'
        },
        {
          name: 'markup-package',
          currentVersion: '1.0.0',
          replacement: 'plain-package',
          reason: 'Reason with <HTML> & "quotes" and \'apostrophes\''
        }
      ];

      const analysis = createMinimalAnalysis(formattedReasons);
      const candidates = analyzer.analyze(analysis);

      expect(candidates).toHaveLength(3);

      candidates.forEach(candidate => {
        expect(candidate.description).toBeDefined();
        expect(typeof candidate.description).toBe('string');
      });
    });

    it('should handle empty and whitespace-only reasons', () => {
      const emptyReasonPackages: DeprecatedPackage[] = [
        {
          name: 'empty-reason',
          currentVersion: '1.0.0',
          replacement: 'new-package',
          reason: ''
        },
        {
          name: 'whitespace-reason',
          currentVersion: '1.0.0',
          replacement: 'another-package',
          reason: '   \t\n   '
        },
        {
          name: 'space-reason',
          currentVersion: '1.0.0',
          replacement: 'third-package',
          reason: ' '
        }
      ];

      const analysis = createMinimalAnalysis(emptyReasonPackages);
      const candidates = analyzer.analyze(analysis);

      expect(candidates).toHaveLength(3);

      candidates.forEach(candidate => {
        expect(candidate.description).toBeDefined();
        // Should not contain "Reason:" for empty reasons
        if (candidate.description.includes('Reason:')) {
          expect(candidate.description).toMatch(/Reason:\s*\S+/); // Should have content after "Reason:"
        }
      });
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle circular reference scenarios gracefully', () => {
      const pkg: DeprecatedPackage = {
        name: 'self-referencing',
        currentVersion: '1.0.0',
        replacement: 'self-referencing', // Points to itself
        reason: 'Testing circular reference'
      };

      const analysis = createMinimalAnalysis([pkg]);

      expect(() => {
        const candidates = analyzer.analyze(analysis);
        expect(candidates).toHaveLength(1);
        expect(candidates[0].title).toBe('Replace Deprecated Package: self-referencing → self-referencing');
      }).not.toThrow();
    });

    it('should handle packages with identical names but different data', () => {
      // This shouldn't happen in real scenarios, but testing robustness
      const duplicateNames: DeprecatedPackage[] = [
        {
          name: 'duplicate-name',
          currentVersion: '1.0.0',
          replacement: 'replacement-a',
          reason: 'First reason'
        },
        {
          name: 'duplicate-name',
          currentVersion: '2.0.0',
          replacement: 'replacement-b',
          reason: 'Second reason'
        }
      ];

      const analysis = createMinimalAnalysis(duplicateNames);
      const candidates = analyzer.analyze(analysis);

      expect(candidates).toHaveLength(2);

      // Both should have the same candidateId pattern (but this might cause issues)
      const candidateIds = candidates.map(c => c.candidateId);
      expect(candidateIds[0]).toBe('deprecated-pkg-duplicate-name');
      expect(candidateIds[1]).toBe('deprecated-pkg-duplicate-name');
    });
  });

  describe('Type Safety and Runtime Checks', () => {
    it('should handle analysis object with missing required properties', () => {
      const incompleteAnalysis = {
        codebaseSize: {
          files: 1,
          lines: 100,
          languages: { typescript: 100 }
        },
        dependencies: {
          deprecatedPackages: [{
            name: 'test-package',
            currentVersion: '1.0.0',
            replacement: 'new-package',
            reason: 'Test'
          }]
        }
        // Missing other required properties
      } as ProjectAnalysis;

      expect(() => {
        const candidates = analyzer.analyze(incompleteAnalysis);
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });

    it('should maintain type consistency across all generated candidates', () => {
      const testPackage: DeprecatedPackage = {
        name: 'type-test-package',
        currentVersion: '1.0.0',
        replacement: 'typed-package',
        reason: 'Type safety testing'
      };

      const analysis = createMinimalAnalysis([testPackage]);
      const candidates = analyzer.analyze(analysis);

      expect(candidates).toHaveLength(1);
      const candidate = candidates[0];

      // Verify all required properties exist and have correct types
      expect(typeof candidate.candidateId).toBe('string');
      expect(typeof candidate.title).toBe('string');
      expect(typeof candidate.description).toBe('string');
      expect(typeof candidate.priority).toBe('string');
      expect(['urgent', 'high', 'normal', 'low']).toContain(candidate.priority);
      expect(typeof candidate.estimatedEffort).toBe('string');
      expect(['low', 'medium', 'high']).toContain(candidate.estimatedEffort);
      expect(typeof candidate.suggestedWorkflow).toBe('string');
      expect(typeof candidate.rationale).toBe('string');
      expect(typeof candidate.score).toBe('number');
      expect(candidate.score).toBeGreaterThanOrEqual(0);
      expect(candidate.score).toBeLessThanOrEqual(1);
    });
  });
});
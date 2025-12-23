/**
 * Integration Tests for MaintenanceAnalyzer - Complete Feature Testing
 *
 * Tests the complete functionality of deprecated package detection,
 * including integration with security vulnerability handling and
 * real-world scenario testing.
 */

import { MaintenanceAnalyzer } from './maintenance-analyzer';
import { SecurityVulnerabilityParser } from '../utils/security-vulnerability-parser';
import type { ProjectAnalysis, DeprecatedPackage, SecurityVulnerability } from '../idle-processor';

describe('MaintenanceAnalyzer - Integration Tests', () => {
  let analyzer: MaintenanceAnalyzer;

  beforeEach(() => {
    analyzer = new MaintenanceAnalyzer();
  });

  // Helper function to create comprehensive ProjectAnalysis
  function createCompleteAnalysis(
    deprecatedPackages: DeprecatedPackage[] = [],
    securityIssues: SecurityVulnerability[] = [],
    outdated: string[] = []
  ): ProjectAnalysis {
    return {
      codebaseSize: {
        files: 150,
        lines: 15000,
        languages: { typescript: 10000, javascript: 3000, json: 2000 }
      },
      testCoverage: {
        percentage: 85,
        uncoveredFiles: ['src/legacy.js', 'src/deprecated-utils.ts']
      },
      dependencies: {
        outdated,
        security: outdated.length > 0 ? [`${outdated[0]} (security issue)`] : [],
        securityIssues,
        deprecatedPackages
      },
      codeQuality: {
        lintIssues: 5,
        duplicatedCode: ['src/utils/duplicate.ts'],
        complexityHotspots: ['src/complex-algorithm.ts'],
        codeSmells: ['Long parameter list in UserService.create()']
      },
      documentation: {
        coverage: 70,
        missingDocs: ['src/api/user.ts', 'src/api/auth.ts'],
        outdatedSections: ['Authentication guide'],
        apiCompleteness: {
          percentage: 80,
          details: {
            totalEndpoints: 25,
            documentedEndpoints: 20,
            undocumentedItems: ['POST /api/users/batch', 'DELETE /api/sessions'],
            wellDocumentedExamples: ['GET /api/users', 'POST /api/auth/login'],
            commonIssues: ['Missing response examples', 'Unclear error codes']
          }
        }
      },
      performance: {
        bundleSize: {
          total: 1024 * 500, // 500KB
          byCategory: { vendor: 1024 * 300, app: 1024 * 200 }
        },
        slowTests: ['UserIntegrationTest.testComplexWorkflow (5.2s)'],
        bottlenecks: ['Database query in UserService.findAll()']
      }
    };
  }

  describe('Real-world Scenario Testing', () => {
    it('should handle real package deprecation scenarios correctly', () => {
      const realDeprecatedPackages: DeprecatedPackage[] = [
        {
          name: 'request',
          currentVersion: '2.88.2',
          replacement: 'axios',
          reason: 'Request/Request has been deprecated, see https://github.com/request/request/issues/3142'
        },
        {
          name: 'moment',
          currentVersion: '2.29.4',
          replacement: 'date-fns',
          reason: 'Moment.js is now in maintenance mode. New features will not be added.'
        },
        {
          name: 'node-sass',
          currentVersion: '7.0.3',
          replacement: 'dart-sass',
          reason: 'LibSass and Node Sass are deprecated. Use Dart Sass instead.'
        },
        {
          name: 'gulp-util',
          currentVersion: '3.0.8',
          replacement: null,
          reason: 'gulp-util is deprecated and should not be used. Use individual modules instead.'
        }
      ];

      const analysis = createCompleteAnalysis(realDeprecatedPackages);
      const candidates = analyzer.analyze(analysis);

      const deprecatedTasks = candidates.filter(c => c.candidateId.startsWith('deprecated-pkg-'));

      expect(deprecatedTasks).toHaveLength(4);

      // Check specific packages
      const requestTask = candidates.find(c => c.candidateId === 'deprecated-pkg-request');
      const gulpUtilTask = candidates.find(c => c.candidateId === 'deprecated-pkg-gulp-util');

      expect(requestTask?.title).toBe('Replace Deprecated Package: request → axios');
      expect(requestTask?.priority).toBe('normal');
      expect(requestTask?.score).toBe(0.6);

      expect(gulpUtilTask?.title).toBe('Replace Deprecated Package: gulp-util');
      expect(gulpUtilTask?.priority).toBe('high');
      expect(gulpUtilTask?.score).toBe(0.8);
    });

    it('should correctly prioritize mixed maintenance tasks', () => {
      const deprecatedPackages: DeprecatedPackage[] = [
        {
          name: 'critical-legacy-lib',
          currentVersion: '1.0.0',
          replacement: null,
          reason: 'No longer maintained, security issues'
        }
      ];

      const securityIssues: SecurityVulnerability[] = [
        SecurityVulnerabilityParser.createVulnerability({
          name: 'lodash',
          cveId: 'CVE-2021-23337',
          severity: 'critical',
          description: 'Command injection vulnerability'
        })
      ];

      const outdatedDeps = ['old-package@1.0.0', 'another-old@2.0.0'];

      const analysis = createCompleteAnalysis(deprecatedPackages, securityIssues, outdatedDeps);
      const candidates = analyzer.analyze(analysis);

      // Sort by score to check prioritization
      const sortedCandidates = candidates.sort((a, b) => b.score - a.score);

      // Expected priority: Critical security (1.0) > Deprecated without replacement (0.8) > Outdated (0.5)
      expect(sortedCandidates[0].candidateId).toContain('CVE-2021-23337'); // Security
      expect(sortedCandidates[0].score).toBe(1.0);

      expect(sortedCandidates[1].candidateId).toBe('deprecated-pkg-critical-legacy-lib'); // Deprecated
      expect(sortedCandidates[1].score).toBe(0.8);

      expect(sortedCandidates[2].candidateId).toBe('outdated-deps'); // Outdated
      expect(sortedCandidates[2].score).toBe(0.5);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of deprecated packages efficiently', () => {
      const manyDeprecatedPackages: DeprecatedPackage[] = Array.from({ length: 50 }, (_, i) => ({
        name: `deprecated-lib-${i}`,
        currentVersion: '1.0.0',
        replacement: i % 2 === 0 ? `modern-lib-${i}` : null,
        reason: `Package ${i} is no longer maintained`
      }));

      const analysis = createCompleteAnalysis(manyDeprecatedPackages);

      const startTime = Date.now();
      const candidates = analyzer.analyze(analysis);
      const endTime = Date.now();

      // Should complete in reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);

      // Should generate one task per deprecated package
      const deprecatedTasks = candidates.filter(c => c.candidateId.startsWith('deprecated-pkg-'));
      expect(deprecatedTasks).toHaveLength(50);

      // Check score distribution
      const withReplacement = deprecatedTasks.filter(t => t.score === 0.6);
      const withoutReplacement = deprecatedTasks.filter(t => t.score === 0.8);

      expect(withReplacement).toHaveLength(25); // Even indices
      expect(withoutReplacement).toHaveLength(25); // Odd indices
    });

    it('should handle complex package names and characters correctly', () => {
      const complexPackages: DeprecatedPackage[] = [
        {
          name: '@company/legacy-package',
          currentVersion: '1.2.3-beta.4',
          replacement: '@company/modern-package',
          reason: 'Migrated to new architecture'
        },
        {
          name: 'package_with_underscores',
          currentVersion: '0.9.99',
          replacement: 'package-with-dashes',
          reason: 'Renamed for consistency'
        },
        {
          name: 'Package.With.Dots',
          currentVersion: '2.0.0-rc.1',
          replacement: null,
          reason: 'Project discontinued'
        }
      ];

      const analysis = createCompleteAnalysis(complexPackages);
      const candidates = analyzer.analyze(analysis);

      const deprecatedTasks = candidates.filter(c => c.candidateId.startsWith('deprecated-pkg-'));
      expect(deprecatedTasks).toHaveLength(3);

      // Check that candidate IDs are URL-safe
      deprecatedTasks.forEach(task => {
        expect(task.candidateId).not.toContain('/');
        expect(task.candidateId).not.toContain('.');
        expect(task.candidateId).not.toContain('_');
        expect(task.candidateId).toMatch(/^[a-zA-Z0-9-]+$/);
      });

      // Verify titles preserve original package names
      const scopedTask = deprecatedTasks.find(t => t.title.includes('@company/legacy-package'));
      expect(scopedTask?.title).toBe('Replace Deprecated Package: @company/legacy-package → @company/modern-package');
    });
  });

  describe('Edge Case Handling', () => {
    it('should gracefully handle malformed deprecated package data', () => {
      const malformedPackages: DeprecatedPackage[] = [
        {
          name: '',
          currentVersion: '1.0.0',
          replacement: 'valid-replacement',
          reason: 'Valid reason'
        },
        {
          name: 'valid-name',
          currentVersion: '',
          replacement: '',
          reason: ''
        }
      ];

      const analysis = createCompleteAnalysis(malformedPackages);

      expect(() => {
        const candidates = analyzer.analyze(analysis);
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });

    it('should handle null and undefined deprecated packages gracefully', () => {
      const analysisWithNull = createCompleteAnalysis();
      (analysisWithNull.dependencies as any).deprecatedPackages = null;

      const analysisWithUndefined = createCompleteAnalysis();
      delete (analysisWithUndefined.dependencies as any).deprecatedPackages;

      expect(() => {
        const candidates1 = analyzer.analyze(analysisWithNull);
        const candidates2 = analyzer.analyze(analysisWithUndefined);

        expect(Array.isArray(candidates1)).toBe(true);
        expect(Array.isArray(candidates2)).toBe(true);

        const deprecatedTasks1 = candidates1.filter(c => c.candidateId.startsWith('deprecated-pkg-'));
        const deprecatedTasks2 = candidates2.filter(c => c.candidateId.startsWith('deprecated-pkg-'));

        expect(deprecatedTasks1).toHaveLength(0);
        expect(deprecatedTasks2).toHaveLength(0);
      }).not.toThrow();
    });
  });

  describe('Task Content Validation', () => {
    it('should generate comprehensive descriptions and rationales', () => {
      const testPackage: DeprecatedPackage = {
        name: 'comprehensive-test-package',
        currentVersion: '3.2.1',
        replacement: 'modern-alternative',
        reason: 'Package has been superseded by a more maintainable and feature-rich alternative with better TypeScript support.'
      };

      const analysis = createCompleteAnalysis([testPackage]);
      const candidates = analyzer.analyze(analysis);

      const task = candidates.find(c => c.candidateId === 'deprecated-pkg-comprehensive-test-package');

      expect(task).toBeDefined();
      expect(task?.description).toContain('comprehensive-test-package@3.2.1 is deprecated');
      expect(task?.description).toContain('Package has been superseded');
      expect(task?.description).toContain('Recommended replacement: modern-alternative');

      expect(task?.rationale).toContain('Migration to modern-alternative ensures continued support');
      expect(task?.rationale).toContain('stop receiving security updates and bug fixes');
    });

    it('should handle packages without detailed reasons', () => {
      const minimalistPackage: DeprecatedPackage = {
        name: 'minimal-package',
        currentVersion: '1.0.0',
        replacement: 'new-package',
        reason: ''
      };

      const analysis = createCompleteAnalysis([minimalistPackage]);
      const candidates = analyzer.analyze(analysis);

      const task = candidates.find(c => c.candidateId === 'deprecated-pkg-minimal-package');

      expect(task?.description).toContain('minimal-package@1.0.0 is deprecated');
      expect(task?.description).not.toContain('Reason:');
      expect(task?.description).toContain('Recommended replacement: new-package');
    });

    it('should provide appropriate guidance for packages without replacements', () => {
      const orphanedPackage: DeprecatedPackage = {
        name: 'orphaned-package',
        currentVersion: '2.1.0',
        replacement: null,
        reason: 'Project discontinued due to lack of maintainers'
      };

      const analysis = createCompleteAnalysis([orphanedPackage]);
      const candidates = analyzer.analyze(analysis);

      const task = candidates.find(c => c.candidateId === 'deprecated-pkg-orphaned-package');

      expect(task?.description).toContain('No direct replacement available - manual migration required');
      expect(task?.rationale).toContain('requiring urgent attention to find alternative solutions');
      expect(task?.priority).toBe('high');
    });
  });

  describe('Integration with SecurityVulnerabilityParser', () => {
    it('should work correctly with parser utilities', () => {
      // Test that the analyzer integrates well with the security parser
      const vulnerability = SecurityVulnerabilityParser.createVulnerability({
        name: 'test-vulnerable-package',
        severity: 'high',
        cveId: 'CVE-2024-12345'
      });

      const deprecatedPackage: DeprecatedPackage = {
        name: 'deprecated-vulnerable-package',
        currentVersion: '1.0.0',
        replacement: 'secure-alternative',
        reason: 'Package has known security issues'
      };

      const analysis = createCompleteAnalysis([deprecatedPackage], [vulnerability]);
      const candidates = analyzer.analyze(analysis);

      const securityTask = candidates.find(c => c.candidateId.includes('CVE-2024-12345'));
      const deprecatedTask = candidates.find(c => c.candidateId === 'deprecated-pkg-deprecated-vulnerable-package');

      expect(securityTask).toBeDefined();
      expect(deprecatedTask).toBeDefined();

      // Security should have higher priority
      expect(securityTask!.score).toBeGreaterThan(deprecatedTask!.score);
    });
  });

  describe('Analyzer Type Verification', () => {
    it('should correctly identify as maintenance analyzer', () => {
      expect(analyzer.type).toBe('maintenance');
    });

    it('should generate candidates with correct maintenance workflow', () => {
      const testPackage: DeprecatedPackage = {
        name: 'test-package',
        currentVersion: '1.0.0',
        replacement: 'new-package',
        reason: 'Test deprecation'
      };

      const analysis = createCompleteAnalysis([testPackage]);
      const candidates = analyzer.analyze(analysis);

      const task = candidates.find(c => c.candidateId.startsWith('deprecated-pkg-'));
      expect(task?.suggestedWorkflow).toBe('maintenance');
    });
  });
});
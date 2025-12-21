import { describe, it, expect } from 'vitest';
import {
  OutdatedDependency,
  SecurityVulnerability,
  DeprecatedPackage,
  ProjectAnalysis,
  IdleProcessor,
} from './idle-processor';
import { createAnalysisWithRichDependencies } from './test-helpers';

describe('Dependency Types Integration', () => {
  describe('Integration with IdleProcessor', () => {
    it('should accept ProjectAnalysis with rich dependency types', () => {
      const analysis = createAnalysisWithRichDependencies();

      // This test verifies that the types compile correctly
      // and can be used together with the IdleProcessor
      expect(analysis.dependencies).toBeDefined();
      expect(analysis.dependencies.outdatedPackages).toBeDefined();
      expect(analysis.dependencies.securityIssues).toBeDefined();
      expect(analysis.dependencies.deprecatedPackages).toBeDefined();
    });

    it('should handle analysis with mixed dependency data', () => {
      const mixedAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 100,
          lines: 10000,
          languages: { typescript: 80, javascript: 20 }
        },
        testCoverage: {
          percentage: 85,
          uncoveredFiles: ['src/legacy.js']
        },
        dependencies: {
          outdated: ['legacy-package@1.0.0'],
          security: ['vuln-package@2.0.0'],
          outdatedPackages: [
            {
              name: 'react',
              currentVersion: '17.0.2',
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
          securityIssues: [
            {
              name: 'axios',
              cveId: 'CVE-2024-28849',
              severity: 'high',
              affectedVersions: '<1.6.8',
              description: 'Server-side request forgery vulnerability'
            }
          ],
          deprecatedPackages: [
            {
              name: 'request',
              currentVersion: '2.88.2',
              replacement: 'axios',
              reason: 'Package is deprecated, use axios instead'
            }
          ]
        },
        codeQuality: {
          lintIssues: 5,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        },
        documentation: {
          coverage: 70,
          missingDocs: ['src/utils.ts'],
          undocumentedExports: [],
          outdatedDocs: [],
          missingReadmeSections: [],
          apiCompleteness: {
            percentage: 70,
            details: {
              totalEndpoints: 20,
              documentedEndpoints: 14,
              undocumentedItems: [],
              wellDocumentedExamples: [],
              commonIssues: []
            }
          }
        },
        performance: {
          bundleSize: 512000,
          slowTests: ['integration/slow.test.ts'],
          bottlenecks: ['src/heavy-computation.ts']
        }
      };

      // Verify the structure is valid
      expect(mixedAnalysis.dependencies.outdatedPackages).toHaveLength(2);
      expect(mixedAnalysis.dependencies.securityIssues).toHaveLength(1);
      expect(mixedAnalysis.dependencies.deprecatedPackages).toHaveLength(1);

      // Verify specific values
      expect(mixedAnalysis.dependencies.outdatedPackages![0].name).toBe('react');
      expect(mixedAnalysis.dependencies.outdatedPackages![0].updateType).toBe('major');

      expect(mixedAnalysis.dependencies.securityIssues![0].severity).toBe('high');
      expect(mixedAnalysis.dependencies.securityIssues![0].cveId).toBe('CVE-2024-28849');

      expect(mixedAnalysis.dependencies.deprecatedPackages![0].replacement).toBe('axios');
      expect(mixedAnalysis.dependencies.deprecatedPackages![0].name).toBe('request');
    });

    it('should validate all UpdateType values', () => {
      const updateTypes = ['major', 'minor', 'patch'] as const;

      updateTypes.forEach(updateType => {
        const dependency: OutdatedDependency = {
          name: `test-${updateType}`,
          currentVersion: '1.0.0',
          latestVersion: updateType === 'major' ? '2.0.0' : updateType === 'minor' ? '1.1.0' : '1.0.1',
          updateType
        };

        expect(dependency.updateType).toBe(updateType);
        expect(['major', 'minor', 'patch']).toContain(dependency.updateType);
      });
    });

    it('should validate all VulnerabilitySeverity values', () => {
      const severities = ['critical', 'high', 'medium', 'low'] as const;

      severities.forEach(severity => {
        const vulnerability: SecurityVulnerability = {
          name: `test-${severity}`,
          cveId: `CVE-2024-${severity.toUpperCase()}`,
          severity,
          affectedVersions: '*',
          description: `Test vulnerability with ${severity} severity`
        };

        expect(vulnerability.severity).toBe(severity);
        expect(['critical', 'high', 'medium', 'low']).toContain(vulnerability.severity);
      });
    });

    it('should support real-world package names and versions', () => {
      const realWorldDependencies: OutdatedDependency[] = [
        {
          name: '@types/node',
          currentVersion: '18.15.13',
          latestVersion: '20.10.5',
          updateType: 'major'
        },
        {
          name: '@babel/core',
          currentVersion: '7.22.0',
          latestVersion: '7.23.6',
          updateType: 'minor'
        },
        {
          name: 'eslint',
          currentVersion: '8.56.0',
          latestVersion: '8.57.0',
          updateType: 'patch'
        }
      ];

      realWorldDependencies.forEach(dep => {
        expect(dep.name).toMatch(/^[@\w\/-]+$/);
        expect(dep.currentVersion).toMatch(/^\d+\.\d+\.\d+/);
        expect(dep.latestVersion).toMatch(/^\d+\.\d+\.\d+/);
        expect(['major', 'minor', 'patch']).toContain(dep.updateType);
      });
    });

    it('should support real-world security vulnerabilities', () => {
      const realWorldVulnerabilities: SecurityVulnerability[] = [
        {
          name: 'semver',
          cveId: 'CVE-2022-25883',
          severity: 'medium',
          affectedVersions: '<7.5.2',
          description: 'semver package vulnerable to Regular Expression Denial of Service'
        },
        {
          name: 'qs',
          cveId: 'CVE-2022-24999',
          severity: 'high',
          affectedVersions: '<6.7.3',
          description: 'qs vulnerable to Prototype Pollution'
        }
      ];

      realWorldVulnerabilities.forEach(vuln => {
        expect(vuln.cveId).toMatch(/^CVE-\d{4}-\d+$/);
        expect(vuln.severity).toMatch(/^(critical|high|medium|low)$/);
        expect(vuln.description).toBeTruthy();
        expect(vuln.affectedVersions).toBeTruthy();
      });
    });

    it('should support real-world deprecated packages', () => {
      const realWorldDeprecated: DeprecatedPackage[] = [
        {
          name: 'request',
          currentVersion: '2.88.2',
          replacement: 'axios',
          reason: 'Request has been deprecated, see https://github.com/request/request/issues/3142'
        },
        {
          name: 'babel-core',
          currentVersion: '6.26.3',
          replacement: null,
          reason: 'babel-core@6 is deprecated. Use @babel/core instead.'
        },
        {
          name: 'tslint',
          currentVersion: '6.1.3',
          replacement: 'eslint',
          reason: 'TSLint has been deprecated. Use ESLint with TypeScript support.'
        }
      ];

      realWorldDeprecated.forEach(dep => {
        expect(dep.name).toBeTruthy();
        expect(dep.currentVersion).toMatch(/^\d+\.\d+\.\d+/);
        expect(dep.reason).toBeTruthy();
        // replacement can be string or null
        expect(typeof dep.replacement === 'string' || dep.replacement === null).toBe(true);
      });
    });
  });

  describe('Type compatibility and inference', () => {
    it('should correctly infer types for dependency arrays', () => {
      const analysis = createAnalysisWithRichDependencies();

      // TypeScript should correctly infer these types
      const outdatedPackages = analysis.dependencies.outdatedPackages!;
      const securityIssues = analysis.dependencies.securityIssues!;
      const deprecatedPackages = analysis.dependencies.deprecatedPackages!;

      // These should all be arrays
      expect(Array.isArray(outdatedPackages)).toBe(true);
      expect(Array.isArray(securityIssues)).toBe(true);
      expect(Array.isArray(deprecatedPackages)).toBe(true);

      // Test array methods work correctly
      const majorUpdates = outdatedPackages.filter(dep => dep.updateType === 'major');
      const criticalVulns = securityIssues.filter(vuln => vuln.severity === 'critical');
      const replacementAvailable = deprecatedPackages.filter(dep => dep.replacement !== null);

      expect(Array.isArray(majorUpdates)).toBe(true);
      expect(Array.isArray(criticalVulns)).toBe(true);
      expect(Array.isArray(replacementAvailable)).toBe(true);
    });

    it('should handle optional dependency fields correctly', () => {
      const minimalDeps = {
        outdated: [],
        security: []
      };

      const richDeps = {
        outdated: [],
        security: [],
        outdatedPackages: [] as OutdatedDependency[],
        securityIssues: [] as SecurityVulnerability[],
        deprecatedPackages: [] as DeprecatedPackage[]
      };

      // Both should be valid dependency objects
      expect(minimalDeps.outdated).toEqual([]);
      expect(minimalDeps.security).toEqual([]);

      expect(richDeps.outdatedPackages).toEqual([]);
      expect(richDeps.securityIssues).toEqual([]);
      expect(richDeps.deprecatedPackages).toEqual([]);
    });
  });
});
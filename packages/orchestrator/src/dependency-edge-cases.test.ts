import { describe, it, expect } from 'vitest';
import {
  OutdatedDependency,
  SecurityVulnerability,
  DeprecatedPackage,
  UpdateType,
  VulnerabilitySeverity,
  ProjectAnalysis,
} from './idle-processor';

describe('Dependency Types Edge Cases', () => {
  describe('OutdatedDependency edge cases', () => {
    it('should handle identical versions (edge case)', () => {
      const dependency: OutdatedDependency = {
        name: 'stable-package',
        currentVersion: '1.0.0',
        latestVersion: '1.0.0',
        updateType: 'patch', // Even identical versions could be patch updates due to metadata changes
      };

      expect(dependency.name).toBe('stable-package');
      expect(dependency.currentVersion).toBe('1.0.0');
      expect(dependency.latestVersion).toBe('1.0.0');
      expect(dependency.updateType).toBe('patch');
    });

    it('should handle very long package names', () => {
      const dependency: OutdatedDependency = {
        name: '@very-long-organization-name/extremely-long-package-name-with-many-descriptive-words-and-hyphens',
        currentVersion: '1.0.0',
        latestVersion: '2.0.0',
        updateType: 'major',
      };

      expect(dependency.name).toBe('@very-long-organization-name/extremely-long-package-name-with-many-descriptive-words-and-hyphens');
      expect(dependency.updateType).toBe('major');
    });

    it('should handle complex version strings', () => {
      const dependency: OutdatedDependency = {
        name: 'complex-versions',
        currentVersion: '1.0.0-alpha.1+build.20231201',
        latestVersion: '1.0.0-beta.2+build.20240101',
        updateType: 'patch',
      };

      expect(dependency.currentVersion).toBe('1.0.0-alpha.1+build.20231201');
      expect(dependency.latestVersion).toBe('1.0.0-beta.2+build.20240101');
    });

    it('should handle edge case with zero versions', () => {
      const dependency: OutdatedDependency = {
        name: 'zero-version',
        currentVersion: '0.0.0',
        latestVersion: '0.0.1',
        updateType: 'patch',
      };

      expect(dependency.currentVersion).toBe('0.0.0');
      expect(dependency.latestVersion).toBe('0.0.1');
      expect(dependency.updateType).toBe('patch');
    });

    it('should handle large version numbers', () => {
      const dependency: OutdatedDependency = {
        name: 'high-version',
        currentVersion: '999.999.999',
        latestVersion: '1000.0.0',
        updateType: 'major',
      };

      expect(dependency.currentVersion).toBe('999.999.999');
      expect(dependency.latestVersion).toBe('1000.0.0');
      expect(dependency.updateType).toBe('major');
    });
  });

  describe('SecurityVulnerability edge cases', () => {
    it('should handle very long CVE IDs', () => {
      const vulnerability: SecurityVulnerability = {
        name: 'test-package',
        cveId: 'CVE-2024-12345678901234567890',
        severity: 'medium',
        affectedVersions: '*',
        description: 'All versions affected',
      };

      expect(vulnerability.cveId).toBe('CVE-2024-12345678901234567890');
      expect(vulnerability.affectedVersions).toBe('*');
    });

    it('should handle very detailed vulnerability descriptions', () => {
      const longDescription = 'This vulnerability affects all versions of the package and can lead to remote code execution when malicious input is provided through the configuration object. The issue occurs in the parsing logic where user input is not properly sanitized before being passed to the eval() function. Attackers can exploit this by crafting malicious configuration files that execute arbitrary JavaScript code in the Node.js context. This affects both server-side and client-side implementations of the package.';

      const vulnerability: SecurityVulnerability = {
        name: 'vulnerable-parser',
        cveId: 'CVE-2024-99999',
        severity: 'critical',
        affectedVersions: '*',
        description: longDescription,
      };

      expect(vulnerability.description).toBe(longDescription);
      expect(vulnerability.description.length).toBeGreaterThan(100);
    });

    it('should handle empty version ranges', () => {
      const vulnerability: SecurityVulnerability = {
        name: 'test-package',
        cveId: 'CVE-2024-00000',
        severity: 'low',
        affectedVersions: '',
        description: 'Unknown version range',
      };

      expect(vulnerability.affectedVersions).toBe('');
    });

    it('should handle special characters in package names', () => {
      const vulnerability: SecurityVulnerability = {
        name: '@org/package-with-underscores_and_dots.js',
        cveId: 'CVE-2024-11111',
        severity: 'high',
        affectedVersions: '>= 1.0.0',
        description: 'Package with special characters in name',
      };

      expect(vulnerability.name).toBe('@org/package-with-underscores_and_dots.js');
    });

    it('should handle non-standard CVE formats', () => {
      const vulnerability: SecurityVulnerability = {
        name: 'old-package',
        cveId: 'ADVISORY-2024-001',
        severity: 'medium',
        affectedVersions: '< 1.0.0',
        description: 'Non-CVE advisory identifier',
      };

      expect(vulnerability.cveId).toBe('ADVISORY-2024-001');
    });
  });

  describe('DeprecatedPackage edge cases', () => {
    it('should handle empty replacement string', () => {
      const deprecatedPkg: DeprecatedPackage = {
        name: 'empty-replacement',
        currentVersion: '1.0.0',
        replacement: '',
        reason: 'Package deprecated with empty replacement suggestion',
      };

      expect(deprecatedPkg.replacement).toBe('');
    });

    it('should handle very long deprecation reasons', () => {
      const longReason = 'This package has been deprecated due to multiple security vulnerabilities, lack of maintenance, incompatibility with modern Node.js versions, and the availability of better alternatives. The maintainers recommend migrating to newer solutions that provide better performance, security, and long-term support. Please review the migration guide available in the documentation.';

      const deprecatedPkg: DeprecatedPackage = {
        name: 'legacy-package',
        currentVersion: '1.0.0',
        replacement: 'modern-alternative',
        reason: longReason,
      };

      expect(deprecatedPkg.reason).toBe(longReason);
      expect(deprecatedPkg.reason.length).toBeGreaterThan(100);
    });

    it('should handle multiple replacement suggestions in reason', () => {
      const deprecatedPkg: DeprecatedPackage = {
        name: 'multi-replacement',
        currentVersion: '2.1.0',
        replacement: null,
        reason: 'Use axios for HTTP requests, fetch for simple requests, or node-fetch for Node.js compatibility',
      };

      expect(deprecatedPkg.replacement).toBeNull();
      expect(deprecatedPkg.reason).toContain('axios');
      expect(deprecatedPkg.reason).toContain('fetch');
      expect(deprecatedPkg.reason).toContain('node-fetch');
    });

    it('should handle packages with numbers in names', () => {
      const deprecatedPkg: DeprecatedPackage = {
        name: 'jquery2',
        currentVersion: '2.2.4',
        replacement: 'jquery',
        reason: 'jQuery 2.x is deprecated, use jQuery 3.x',
      };

      expect(deprecatedPkg.name).toBe('jquery2');
      expect(deprecatedPkg.replacement).toBe('jquery');
    });

    it('should handle pre-release current versions', () => {
      const deprecatedPkg: DeprecatedPackage = {
        name: 'beta-package',
        currentVersion: '1.0.0-beta.5',
        replacement: 'stable-package',
        reason: 'Beta version never reached stable',
      };

      expect(deprecatedPkg.currentVersion).toBe('1.0.0-beta.5');
    });
  });

  describe('ProjectAnalysis.dependencies complex scenarios', () => {
    it('should handle empty dependency arrays', () => {
      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 0, lines: 0, languages: {} },
        dependencies: {
          outdated: [],
          security: [],
          outdatedPackages: [],
          securityIssues: [],
          deprecatedPackages: [],
        },
        codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
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
              commonIssues: [],
            }
          }
        },
        performance: { slowTests: [], bottlenecks: [] },
      };

      expect(analysis.dependencies.outdatedPackages).toEqual([]);
      expect(analysis.dependencies.securityIssues).toEqual([]);
      expect(analysis.dependencies.deprecatedPackages).toEqual([]);
    });

    it('should handle large numbers of dependencies', () => {
      const manyOutdated: OutdatedDependency[] = [];
      for (let i = 0; i < 100; i++) {
        manyOutdated.push({
          name: `package-${i}`,
          currentVersion: '1.0.0',
          latestVersion: '2.0.0',
          updateType: 'major',
        });
      }

      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 1000, lines: 50000, languages: { ts: 800, js: 200 } },
        dependencies: {
          outdated: [],
          security: [],
          outdatedPackages: manyOutdated,
          securityIssues: [],
          deprecatedPackages: [],
        },
        codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
        documentation: {
          coverage: 80,
          missingDocs: [],
          undocumentedExports: [],
          outdatedDocs: [],
          missingReadmeSections: [],
          apiCompleteness: {
            percentage: 80,
            details: {
              totalEndpoints: 50,
              documentedEndpoints: 40,
              undocumentedItems: [],
              wellDocumentedExamples: [],
              commonIssues: [],
            }
          }
        },
        performance: { slowTests: [], bottlenecks: [] },
      };

      expect(analysis.dependencies.outdatedPackages).toHaveLength(100);
      expect(analysis.dependencies.outdatedPackages![0].name).toBe('package-0');
      expect(analysis.dependencies.outdatedPackages![99].name).toBe('package-99');
    });

    it('should handle duplicate package names across different categories', () => {
      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 50, lines: 5000, languages: { ts: 50 } },
        dependencies: {
          outdated: ['lodash@4.17.15'],
          security: ['lodash@4.17.15'],
          outdatedPackages: [
            {
              name: 'lodash',
              currentVersion: '4.17.15',
              latestVersion: '4.17.21',
              updateType: 'patch',
            }
          ],
          securityIssues: [
            {
              name: 'lodash',
              cveId: 'CVE-2021-23337',
              severity: 'critical',
              affectedVersions: '< 4.17.21',
              description: 'Command injection vulnerability',
            }
          ],
          deprecatedPackages: [
            {
              name: 'lodash',
              currentVersion: '4.17.15',
              replacement: 'lodash-es',
              reason: 'Use ES modules version instead',
            }
          ],
        },
        codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
        documentation: {
          coverage: 90,
          missingDocs: [],
          undocumentedExports: [],
          outdatedDocs: [],
          missingReadmeSections: [],
          apiCompleteness: {
            percentage: 90,
            details: {
              totalEndpoints: 20,
              documentedEndpoints: 18,
              undocumentedItems: [],
              wellDocumentedExamples: [],
              commonIssues: [],
            }
          }
        },
        performance: { slowTests: [], bottlenecks: [] },
      };

      // Same package can appear in multiple categories
      expect(analysis.dependencies.outdatedPackages![0].name).toBe('lodash');
      expect(analysis.dependencies.securityIssues![0].name).toBe('lodash');
      expect(analysis.dependencies.deprecatedPackages![0].name).toBe('lodash');
    });

    it('should handle missing optional fields gracefully', () => {
      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 10, lines: 1000, languages: { js: 10 } },
        dependencies: {
          outdated: ['some-package@1.0.0'],
          security: [],
          // Optional rich fields are undefined
        },
        codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
        documentation: {
          coverage: 70,
          missingDocs: [],
          undocumentedExports: [],
          outdatedDocs: [],
          missingReadmeSections: [],
          apiCompleteness: {
            percentage: 70,
            details: {
              totalEndpoints: 10,
              documentedEndpoints: 7,
              undocumentedItems: [],
              wellDocumentedExamples: [],
              commonIssues: [],
            }
          }
        },
        performance: { slowTests: [], bottlenecks: [] },
      };

      expect(analysis.dependencies.outdatedPackages).toBeUndefined();
      expect(analysis.dependencies.securityIssues).toBeUndefined();
      expect(analysis.dependencies.deprecatedPackages).toBeUndefined();
      expect(analysis.dependencies.outdated).toEqual(['some-package@1.0.0']);
    });
  });

  describe('Type validation edge cases', () => {
    it('should ensure UpdateType only accepts valid values', () => {
      const validTypes: UpdateType[] = ['major', 'minor', 'patch'];

      validTypes.forEach(type => {
        const dependency: OutdatedDependency = {
          name: 'test',
          currentVersion: '1.0.0',
          latestVersion: '2.0.0',
          updateType: type,
        };

        expect(['major', 'minor', 'patch']).toContain(dependency.updateType);
      });
    });

    it('should ensure VulnerabilitySeverity only accepts valid values', () => {
      const validSeverities: VulnerabilitySeverity[] = ['critical', 'high', 'medium', 'low'];

      validSeverities.forEach(severity => {
        const vulnerability: SecurityVulnerability = {
          name: 'test',
          cveId: 'CVE-2024-00001',
          severity: severity,
          affectedVersions: '*',
          description: 'Test vulnerability',
        };

        expect(['critical', 'high', 'medium', 'low']).toContain(vulnerability.severity);
      });
    });

    it('should handle null vs undefined for optional replacement', () => {
      // null replacement (explicitly no replacement)
      const nullReplacement: DeprecatedPackage = {
        name: 'package-null',
        currentVersion: '1.0.0',
        replacement: null,
        reason: 'No replacement available',
      };

      // undefined would not be allowed by TypeScript
      // const undefinedReplacement: DeprecatedPackage = {
      //   name: 'package-undefined',
      //   currentVersion: '1.0.0',
      //   replacement: undefined, // This would be a TypeScript error
      //   reason: 'No replacement available',
      // };

      expect(nullReplacement.replacement).toBeNull();
    });
  });
});
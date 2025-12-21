import { describe, it, expect } from 'vitest';
import {
  OutdatedDependency,
  SecurityVulnerability,
  DeprecatedPackage,
  UpdateType,
  VulnerabilitySeverity,
  ProjectAnalysis,
} from './idle-processor';
import { createAnalysisWithRichDependencies } from './test-helpers';

describe('Dependency Types', () => {
  describe('UpdateType', () => {
    it('should have correct update type values', () => {
      const updateTypes: UpdateType[] = ['major', 'minor', 'patch'];

      updateTypes.forEach(type => {
        expect(['major', 'minor', 'patch']).toContain(type);
      });
    });
  });

  describe('VulnerabilitySeverity', () => {
    it('should have correct severity levels', () => {
      const severityLevels: VulnerabilitySeverity[] = ['critical', 'high', 'medium', 'low'];

      severityLevels.forEach(severity => {
        expect(['critical', 'high', 'medium', 'low']).toContain(severity);
      });
    });
  });

  describe('OutdatedDependency', () => {
    it('should create valid OutdatedDependency with patch update', () => {
      const dependency: OutdatedDependency = {
        name: 'lodash',
        currentVersion: '4.17.20',
        latestVersion: '4.17.21',
        updateType: 'patch',
      };

      expect(dependency.name).toBe('lodash');
      expect(dependency.currentVersion).toBe('4.17.20');
      expect(dependency.latestVersion).toBe('4.17.21');
      expect(dependency.updateType).toBe('patch');
    });

    it('should create valid OutdatedDependency with minor update', () => {
      const dependency: OutdatedDependency = {
        name: 'react',
        currentVersion: '18.1.0',
        latestVersion: '18.2.0',
        updateType: 'minor',
      };

      expect(dependency.name).toBe('react');
      expect(dependency.currentVersion).toBe('18.1.0');
      expect(dependency.latestVersion).toBe('18.2.0');
      expect(dependency.updateType).toBe('minor');
    });

    it('should create valid OutdatedDependency with major update', () => {
      const dependency: OutdatedDependency = {
        name: 'vue',
        currentVersion: '2.6.14',
        latestVersion: '3.3.4',
        updateType: 'major',
      };

      expect(dependency.name).toBe('vue');
      expect(dependency.currentVersion).toBe('2.6.14');
      expect(dependency.latestVersion).toBe('3.3.4');
      expect(dependency.updateType).toBe('major');
    });

    it('should handle scoped packages', () => {
      const dependency: OutdatedDependency = {
        name: '@types/node',
        currentVersion: '18.0.0',
        latestVersion: '20.0.0',
        updateType: 'major',
      };

      expect(dependency.name).toBe('@types/node');
      expect(dependency.currentVersion).toBe('18.0.0');
      expect(dependency.latestVersion).toBe('20.0.0');
      expect(dependency.updateType).toBe('major');
    });

    it('should handle pre-release versions', () => {
      const dependency: OutdatedDependency = {
        name: 'next',
        currentVersion: '13.4.19',
        latestVersion: '14.0.0-canary.0',
        updateType: 'major',
      };

      expect(dependency.name).toBe('next');
      expect(dependency.currentVersion).toBe('13.4.19');
      expect(dependency.latestVersion).toBe('14.0.0-canary.0');
      expect(dependency.updateType).toBe('major');
    });
  });

  describe('SecurityVulnerability', () => {
    it('should create valid SecurityVulnerability with critical severity', () => {
      const vulnerability: SecurityVulnerability = {
        name: 'lodash',
        cveId: 'CVE-2021-23337',
        severity: 'critical',
        affectedVersions: '< 4.17.21',
        description: 'Command injection vulnerability in template function',
      };

      expect(vulnerability.name).toBe('lodash');
      expect(vulnerability.cveId).toBe('CVE-2021-23337');
      expect(vulnerability.severity).toBe('critical');
      expect(vulnerability.affectedVersions).toBe('< 4.17.21');
      expect(vulnerability.description).toBe('Command injection vulnerability in template function');
    });

    it('should create valid SecurityVulnerability with high severity', () => {
      const vulnerability: SecurityVulnerability = {
        name: 'axios',
        cveId: 'CVE-2023-45857',
        severity: 'high',
        affectedVersions: '>=0.8.1 <1.6.0',
        description: 'Cross-Site Request Forgery (CSRF) vulnerability',
      };

      expect(vulnerability.name).toBe('axios');
      expect(vulnerability.cveId).toBe('CVE-2023-45857');
      expect(vulnerability.severity).toBe('high');
      expect(vulnerability.affectedVersions).toBe('>=0.8.1 <1.6.0');
      expect(vulnerability.description).toBe('Cross-Site Request Forgery (CSRF) vulnerability');
    });

    it('should create valid SecurityVulnerability with medium severity', () => {
      const vulnerability: SecurityVulnerability = {
        name: 'semver',
        cveId: 'CVE-2022-25883',
        severity: 'medium',
        affectedVersions: '<7.5.2',
        description: 'Regular expression denial of service',
      };

      expect(vulnerability.name).toBe('semver');
      expect(vulnerability.cveId).toBe('CVE-2022-25883');
      expect(vulnerability.severity).toBe('medium');
      expect(vulnerability.affectedVersions).toBe('<7.5.2');
      expect(vulnerability.description).toBe('Regular expression denial of service');
    });

    it('should create valid SecurityVulnerability with low severity', () => {
      const vulnerability: SecurityVulnerability = {
        name: 'minimist',
        cveId: 'CVE-2021-44906',
        severity: 'low',
        affectedVersions: '<1.2.6',
        description: 'Prototype pollution vulnerability',
      };

      expect(vulnerability.name).toBe('minimist');
      expect(vulnerability.cveId).toBe('CVE-2021-44906');
      expect(vulnerability.severity).toBe('low');
      expect(vulnerability.affectedVersions).toBe('<1.2.6');
      expect(vulnerability.description).toBe('Prototype pollution vulnerability');
    });

    it('should handle complex version ranges', () => {
      const vulnerability: SecurityVulnerability = {
        name: 'express',
        cveId: 'CVE-2024-29041',
        severity: 'high',
        affectedVersions: '>=4.0.0 <4.19.2 || >=5.0.0-alpha.1 <5.0.0-beta.3',
        description: 'Open redirect vulnerability',
      };

      expect(vulnerability.name).toBe('express');
      expect(vulnerability.cveId).toBe('CVE-2024-29041');
      expect(vulnerability.severity).toBe('high');
      expect(vulnerability.affectedVersions).toBe('>=4.0.0 <4.19.2 || >=5.0.0-alpha.1 <5.0.0-beta.3');
      expect(vulnerability.description).toBe('Open redirect vulnerability');
    });

    it('should handle scoped packages with vulnerabilities', () => {
      const vulnerability: SecurityVulnerability = {
        name: '@babel/core',
        cveId: 'CVE-2023-45133',
        severity: 'medium',
        affectedVersions: '<7.23.2',
        description: 'Arbitrary code execution via malicious config',
      };

      expect(vulnerability.name).toBe('@babel/core');
      expect(vulnerability.cveId).toBe('CVE-2023-45133');
      expect(vulnerability.severity).toBe('medium');
      expect(vulnerability.affectedVersions).toBe('<7.23.2');
      expect(vulnerability.description).toBe('Arbitrary code execution via malicious config');
    });
  });

  describe('DeprecatedPackage', () => {
    it('should create valid DeprecatedPackage with replacement', () => {
      const deprecatedPkg: DeprecatedPackage = {
        name: 'request',
        currentVersion: '2.88.2',
        replacement: 'axios',
        reason: 'Package is deprecated and no longer maintained',
      };

      expect(deprecatedPkg.name).toBe('request');
      expect(deprecatedPkg.currentVersion).toBe('2.88.2');
      expect(deprecatedPkg.replacement).toBe('axios');
      expect(deprecatedPkg.reason).toBe('Package is deprecated and no longer maintained');
    });

    it('should create valid DeprecatedPackage without replacement (null)', () => {
      const deprecatedPkg: DeprecatedPackage = {
        name: 'left-pad',
        currentVersion: '1.3.0',
        replacement: null,
        reason: 'Functionality is now built into JavaScript String.padStart()',
      };

      expect(deprecatedPkg.name).toBe('left-pad');
      expect(deprecatedPkg.currentVersion).toBe('1.3.0');
      expect(deprecatedPkg.replacement).toBeNull();
      expect(deprecatedPkg.reason).toBe('Functionality is now built into JavaScript String.padStart()');
    });

    it('should handle scoped deprecated packages', () => {
      const deprecatedPkg: DeprecatedPackage = {
        name: '@types/jest',
        currentVersion: '26.0.24',
        replacement: '@jest/types',
        reason: 'Types moved to official Jest organization',
      };

      expect(deprecatedPkg.name).toBe('@types/jest');
      expect(deprecatedPkg.currentVersion).toBe('26.0.24');
      expect(deprecatedPkg.replacement).toBe('@jest/types');
      expect(deprecatedPkg.reason).toBe('Types moved to official Jest organization');
    });

    it('should handle complex replacement suggestions', () => {
      const deprecatedPkg: DeprecatedPackage = {
        name: 'node-sass',
        currentVersion: '6.0.1',
        replacement: 'sass',
        reason: 'LibSass is deprecated. Use Dart Sass implementation instead.',
      };

      expect(deprecatedPkg.name).toBe('node-sass');
      expect(deprecatedPkg.currentVersion).toBe('6.0.1');
      expect(deprecatedPkg.replacement).toBe('sass');
      expect(deprecatedPkg.reason).toBe('LibSass is deprecated. Use Dart Sass implementation instead.');
    });

    it('should handle packages with no direct replacement', () => {
      const deprecatedPkg: DeprecatedPackage = {
        name: 'babel-core',
        currentVersion: '6.26.3',
        replacement: null,
        reason: 'Babel 6 is no longer supported. Migrate to @babel/core for Babel 7+',
      };

      expect(deprecatedPkg.name).toBe('babel-core');
      expect(deprecatedPkg.currentVersion).toBe('6.26.3');
      expect(deprecatedPkg.replacement).toBeNull();
      expect(deprecatedPkg.reason).toBe('Babel 6 is no longer supported. Migrate to @babel/core for Babel 7+');
    });
  });

  describe('ProjectAnalysis.dependencies integration', () => {
    it('should integrate rich dependency types correctly', () => {
      const analysis = createAnalysisWithRichDependencies();

      // Verify the structure
      expect(analysis.dependencies).toBeDefined();
      expect(analysis.dependencies.outdated).toBeDefined();
      expect(analysis.dependencies.security).toBeDefined();
      expect(analysis.dependencies.outdatedPackages).toBeDefined();
      expect(analysis.dependencies.securityIssues).toBeDefined();
      expect(analysis.dependencies.deprecatedPackages).toBeDefined();
    });

    it('should support backward compatibility with legacy string arrays', () => {
      const analysis = createAnalysisWithRichDependencies();

      // Legacy arrays should still exist for backward compatibility
      expect(Array.isArray(analysis.dependencies.outdated)).toBe(true);
      expect(Array.isArray(analysis.dependencies.security)).toBe(true);

      // New rich arrays should also exist
      expect(Array.isArray(analysis.dependencies.outdatedPackages)).toBe(true);
      expect(Array.isArray(analysis.dependencies.securityIssues)).toBe(true);
      expect(Array.isArray(analysis.dependencies.deprecatedPackages)).toBe(true);
    });

    it('should validate OutdatedDependency array structure', () => {
      const analysis = createAnalysisWithRichDependencies();
      const outdatedPackages = analysis.dependencies.outdatedPackages!;

      expect(outdatedPackages).toHaveLength(2);

      // Test first package
      expect(outdatedPackages[0]).toEqual({
        name: 'lodash',
        currentVersion: '4.17.15',
        latestVersion: '4.17.21',
        updateType: 'patch',
      });

      // Test second package
      expect(outdatedPackages[1]).toEqual({
        name: 'react',
        currentVersion: '16.14.0',
        latestVersion: '18.2.0',
        updateType: 'major',
      });
    });

    it('should validate SecurityVulnerability array structure', () => {
      const analysis = createAnalysisWithRichDependencies();
      const securityIssues = analysis.dependencies.securityIssues!;

      expect(securityIssues).toHaveLength(2);

      // Test first vulnerability
      expect(securityIssues[0]).toEqual({
        name: 'vulnerable-pkg',
        cveId: 'CVE-2024-12345',
        severity: 'high',
        affectedVersions: '<2.0.0',
        description: 'Remote code execution vulnerability',
      });

      // Test second vulnerability
      expect(securityIssues[1]).toEqual({
        name: 'insecure-lib',
        cveId: 'CVE-2023-98765',
        severity: 'critical',
        affectedVersions: '<=1.5.0',
        description: 'Authentication bypass vulnerability',
      });
    });

    it('should validate DeprecatedPackage array structure', () => {
      const analysis = createAnalysisWithRichDependencies();
      const deprecatedPackages = analysis.dependencies.deprecatedPackages!;

      expect(deprecatedPackages).toHaveLength(2);

      // Test first deprecated package
      expect(deprecatedPackages[0]).toEqual({
        name: 'old-library',
        currentVersion: '1.2.3',
        replacement: 'new-library',
        reason: 'Unmaintained since 2022',
      });

      // Test second deprecated package
      expect(deprecatedPackages[1]).toEqual({
        name: 'legacy-utils',
        currentVersion: '2.1.0',
        replacement: null,
        reason: 'Functionality moved to native ES2022',
      });
    });

    it('should handle optional rich dependency fields', () => {
      const minimalAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 10, lines: 1000, languages: { ts: 10 } },
        dependencies: {
          outdated: [],
          security: [],
          // Rich fields are optional
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

      // Should work without rich dependency fields
      expect(minimalAnalysis.dependencies.outdated).toEqual([]);
      expect(minimalAnalysis.dependencies.security).toEqual([]);
      expect(minimalAnalysis.dependencies.outdatedPackages).toBeUndefined();
      expect(minimalAnalysis.dependencies.securityIssues).toBeUndefined();
      expect(minimalAnalysis.dependencies.deprecatedPackages).toBeUndefined();
    });

    it('should support mixed legacy and rich dependency data', () => {
      const mixedAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 15, lines: 2000, languages: { js: 10, ts: 5 } },
        dependencies: {
          outdated: ['old-package@1.0.0'],
          security: ['vuln-package@2.1.0'],
          outdatedPackages: [
            {
              name: 'modern-package',
              currentVersion: '2.1.0',
              latestVersion: '3.0.0',
              updateType: 'major',
            }
          ],
          securityIssues: [
            {
              name: 'new-vuln-package',
              cveId: 'CVE-2024-00001',
              severity: 'medium',
              affectedVersions: '<1.5.0',
              description: 'Data leak vulnerability',
            }
          ],
          deprecatedPackages: [
            {
              name: 'deprecated-util',
              currentVersion: '1.0.0',
              replacement: 'native-feature',
              reason: 'Replaced by built-in functionality',
            }
          ],
        },
        codeQuality: { lintIssues: 5, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
        documentation: {
          coverage: 80,
          missingDocs: [],
          undocumentedExports: [],
          outdatedDocs: [],
          missingReadmeSections: [],
          apiCompleteness: {
            percentage: 80,
            details: {
              totalEndpoints: 10,
              documentedEndpoints: 8,
              undocumentedItems: [],
              wellDocumentedExamples: [],
              commonIssues: [],
            }
          }
        },
        performance: { slowTests: [], bottlenecks: [] },
      };

      // Should support both legacy and rich data
      expect(mixedAnalysis.dependencies.outdated).toEqual(['old-package@1.0.0']);
      expect(mixedAnalysis.dependencies.security).toEqual(['vuln-package@2.1.0']);
      expect(mixedAnalysis.dependencies.outdatedPackages).toHaveLength(1);
      expect(mixedAnalysis.dependencies.securityIssues).toHaveLength(1);
      expect(mixedAnalysis.dependencies.deprecatedPackages).toHaveLength(1);
    });
  });
});
import { describe, it, expect } from 'vitest';
import {
  OutdatedDependency,
  SecurityVulnerability,
  DeprecatedPackage,
  UpdateType,
  VulnerabilitySeverity,
  ProjectAnalysis,
} from './idle-processor';

import {
  createMinimalAnalysis,
  createAnalysisWithIssues,
  createHealthyAnalysis,
  createAnalysisWithRichDependencies
} from './test-helpers';

describe('Final Dependency Types Validation', () => {
  describe('Acceptance Criteria Compliance', () => {
    it('should validate OutdatedDependency has all required fields with correct types', () => {
      const dependency: OutdatedDependency = {
        name: 'test-package',
        currentVersion: '1.0.0',
        latestVersion: '2.0.0',
        updateType: 'major'
      };

      // Validate all required fields exist and have correct types
      expect(typeof dependency.name).toBe('string');
      expect(typeof dependency.currentVersion).toBe('string');
      expect(typeof dependency.latestVersion).toBe('string');
      expect(['major', 'minor', 'patch']).toContain(dependency.updateType);

      // Ensure all required properties are present
      expect(dependency).toHaveProperty('name');
      expect(dependency).toHaveProperty('currentVersion');
      expect(dependency).toHaveProperty('latestVersion');
      expect(dependency).toHaveProperty('updateType');
    });

    it('should validate SecurityVulnerability has all required fields with correct types', () => {
      const vulnerability: SecurityVulnerability = {
        name: 'test-package',
        cveId: 'CVE-2024-00001',
        severity: 'high',
        affectedVersions: '*',
        description: 'Test vulnerability description'
      };

      // Validate all required fields exist and have correct types
      expect(typeof vulnerability.name).toBe('string');
      expect(typeof vulnerability.cveId).toBe('string');
      expect(['critical', 'high', 'medium', 'low']).toContain(vulnerability.severity);
      expect(typeof vulnerability.affectedVersions).toBe('string');
      expect(typeof vulnerability.description).toBe('string');

      // Ensure all required properties are present
      expect(vulnerability).toHaveProperty('name');
      expect(vulnerability).toHaveProperty('cveId');
      expect(vulnerability).toHaveProperty('severity');
      expect(vulnerability).toHaveProperty('affectedVersions');
      expect(vulnerability).toHaveProperty('description');
    });

    it('should validate DeprecatedPackage has all required fields with correct types', () => {
      // Test with string replacement
      const deprecatedWithReplacement: DeprecatedPackage = {
        name: 'old-package',
        currentVersion: '1.0.0',
        replacement: 'new-package',
        reason: 'Package is deprecated'
      };

      expect(typeof deprecatedWithReplacement.name).toBe('string');
      expect(typeof deprecatedWithReplacement.currentVersion).toBe('string');
      expect(typeof deprecatedWithReplacement.replacement).toBe('string');
      expect(typeof deprecatedWithReplacement.reason).toBe('string');

      // Test with null replacement
      const deprecatedWithoutReplacement: DeprecatedPackage = {
        name: 'legacy-package',
        currentVersion: '2.0.0',
        replacement: null,
        reason: 'No replacement available'
      };

      expect(deprecatedWithoutReplacement.replacement).toBeNull();

      // Ensure all required properties are present
      expect(deprecatedWithReplacement).toHaveProperty('name');
      expect(deprecatedWithReplacement).toHaveProperty('currentVersion');
      expect(deprecatedWithReplacement).toHaveProperty('replacement');
      expect(deprecatedWithReplacement).toHaveProperty('reason');
    });

    it('should validate ProjectAnalysis.dependencies includes all rich types', () => {
      const analysis = createAnalysisWithRichDependencies();

      // Validate structure
      expect(analysis.dependencies).toBeDefined();
      expect(analysis.dependencies).toHaveProperty('outdated');
      expect(analysis.dependencies).toHaveProperty('security');
      expect(analysis.dependencies).toHaveProperty('outdatedPackages');
      expect(analysis.dependencies).toHaveProperty('securityIssues');
      expect(analysis.dependencies).toHaveProperty('deprecatedPackages');

      // Validate types
      expect(Array.isArray(analysis.dependencies.outdated)).toBe(true);
      expect(Array.isArray(analysis.dependencies.security)).toBe(true);
      expect(Array.isArray(analysis.dependencies.outdatedPackages)).toBe(true);
      expect(Array.isArray(analysis.dependencies.securityIssues)).toBe(true);
      expect(Array.isArray(analysis.dependencies.deprecatedPackages)).toBe(true);

      // Validate content structure
      if (analysis.dependencies.outdatedPackages!.length > 0) {
        const outdated = analysis.dependencies.outdatedPackages![0];
        expect(outdated).toHaveProperty('name');
        expect(outdated).toHaveProperty('currentVersion');
        expect(outdated).toHaveProperty('latestVersion');
        expect(outdated).toHaveProperty('updateType');
      }

      if (analysis.dependencies.securityIssues!.length > 0) {
        const security = analysis.dependencies.securityIssues![0];
        expect(security).toHaveProperty('name');
        expect(security).toHaveProperty('cveId');
        expect(security).toHaveProperty('severity');
        expect(security).toHaveProperty('affectedVersions');
        expect(security).toHaveProperty('description');
      }

      if (analysis.dependencies.deprecatedPackages!.length > 0) {
        const deprecated = analysis.dependencies.deprecatedPackages![0];
        expect(deprecated).toHaveProperty('name');
        expect(deprecated).toHaveProperty('currentVersion');
        expect(deprecated).toHaveProperty('replacement');
        expect(deprecated).toHaveProperty('reason');
      }
    });

    it('should validate TypeScript compilation by exercising all types', () => {
      // Test all UpdateType values
      const updateTypes: UpdateType[] = ['major', 'minor', 'patch'];
      updateTypes.forEach(type => {
        const dep: OutdatedDependency = {
          name: 'test',
          currentVersion: '1.0.0',
          latestVersion: '2.0.0',
          updateType: type
        };
        expect(dep.updateType).toBe(type);
      });

      // Test all VulnerabilitySeverity values
      const severities: VulnerabilitySeverity[] = ['critical', 'high', 'medium', 'low'];
      severities.forEach(severity => {
        const vuln: SecurityVulnerability = {
          name: 'test',
          cveId: 'CVE-2024-00001',
          severity: severity,
          affectedVersions: '*',
          description: 'Test'
        };
        expect(vuln.severity).toBe(severity);
      });

      // Test replacement nullable field
      const deprecatedWithNull: DeprecatedPackage = {
        name: 'test',
        currentVersion: '1.0.0',
        replacement: null,
        reason: 'Test'
      };
      expect(deprecatedWithNull.replacement).toBeNull();

      const deprecatedWithString: DeprecatedPackage = {
        name: 'test',
        currentVersion: '1.0.0',
        replacement: 'replacement-package',
        reason: 'Test'
      };
      expect(deprecatedWithString.replacement).toBe('replacement-package');
    });
  });

  describe('Test Helper Functions Validation', () => {
    it('should validate all test helper functions work with new types', () => {
      // Test minimal analysis
      const minimal = createMinimalAnalysis();
      expect(minimal.dependencies).toBeDefined();
      expect(minimal.dependencies.outdated).toEqual([]);
      expect(minimal.dependencies.security).toEqual([]);

      // Test analysis with issues
      const withIssues = createAnalysisWithIssues('maintenance');
      expect(withIssues.dependencies).toBeDefined();

      // Test healthy analysis
      const healthy = createHealthyAnalysis();
      expect(healthy.dependencies).toBeDefined();

      // Test rich dependencies analysis
      const rich = createAnalysisWithRichDependencies();
      expect(rich.dependencies.outdatedPackages).toHaveLength(2);
      expect(rich.dependencies.securityIssues).toHaveLength(2);
      expect(rich.dependencies.deprecatedPackages).toHaveLength(2);
    });

    it('should validate rich dependencies helper provides correct data', () => {
      const analysis = createAnalysisWithRichDependencies();

      // Validate outdated packages
      expect(analysis.dependencies.outdatedPackages![0]).toEqual({
        name: 'lodash',
        currentVersion: '4.17.15',
        latestVersion: '4.17.21',
        updateType: 'patch'
      });

      expect(analysis.dependencies.outdatedPackages![1]).toEqual({
        name: 'react',
        currentVersion: '16.14.0',
        latestVersion: '18.2.0',
        updateType: 'major'
      });

      // Validate security issues
      expect(analysis.dependencies.securityIssues![0]).toEqual({
        name: 'vulnerable-pkg',
        cveId: 'CVE-2024-12345',
        severity: 'high',
        affectedVersions: '<2.0.0',
        description: 'Remote code execution vulnerability'
      });

      // Validate deprecated packages
      expect(analysis.dependencies.deprecatedPackages![0]).toEqual({
        name: 'old-library',
        currentVersion: '1.2.3',
        replacement: 'new-library',
        reason: 'Unmaintained since 2022'
      });

      expect(analysis.dependencies.deprecatedPackages![1].replacement).toBeNull();
    });
  });

  describe('Backward Compatibility Validation', () => {
    it('should maintain backward compatibility with existing code', () => {
      // Test that existing code expecting string arrays still works
      const analysis = createAnalysisWithRichDependencies();

      // Legacy arrays should be present and populated
      expect(analysis.dependencies.outdated).toEqual(['lodash@4.17.15']);
      expect(analysis.dependencies.security).toEqual(['vulnerable-pkg@1.0.0']);

      // Rich arrays should be present and populated
      expect(analysis.dependencies.outdatedPackages).toHaveLength(2);
      expect(analysis.dependencies.securityIssues).toHaveLength(2);
      expect(analysis.dependencies.deprecatedPackages).toHaveLength(2);
    });

    it('should handle minimal analysis without rich data', () => {
      const minimal: ProjectAnalysis = {
        codebaseSize: { files: 0, lines: 0, languages: {} },
        dependencies: {
          outdated: [],
          security: []
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
              commonIssues: []
            }
          }
        },
        performance: { slowTests: [], bottlenecks: [] }
      };

      // Should work without rich fields
      expect(minimal.dependencies.outdatedPackages).toBeUndefined();
      expect(minimal.dependencies.securityIssues).toBeUndefined();
      expect(minimal.dependencies.deprecatedPackages).toBeUndefined();
      expect(minimal.dependencies.outdated).toEqual([]);
      expect(minimal.dependencies.security).toEqual([]);
    });
  });
});
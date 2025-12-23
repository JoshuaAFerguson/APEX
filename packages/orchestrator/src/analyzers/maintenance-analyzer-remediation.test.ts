/**
 * Tests for MaintenanceAnalyzer Remediation Suggestions
 *
 * This file tests the new remediation functionality including:
 * - RemediationSuggestion generation for security vulnerabilities
 * - Actionable commands for dependency updates
 * - Migration guides for deprecated packages
 * - Security advisory links
 * - Package replacement suggestions
 */

import { MaintenanceAnalyzer } from './maintenance-analyzer';
import type { ProjectAnalysis, SecurityVulnerability, DeprecatedPackage } from '../idle-processor';

describe('MaintenanceAnalyzer - Remediation Suggestions', () => {
  let analyzer: MaintenanceAnalyzer;

  beforeEach(() => {
    analyzer = new MaintenanceAnalyzer();
  });

  // Helper function to create minimal ProjectAnalysis
  function createAnalysis(overrides: Partial<ProjectAnalysis> = {}): ProjectAnalysis {
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
        ...overrides.dependencies
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
      },
      ...overrides
    };
  }

  // Helper function to create vulnerability object
  function createVulnerability(overrides: Partial<SecurityVulnerability> = {}): SecurityVulnerability {
    return {
      name: 'test-package',
      cveId: 'CVE-2024-12345',
      severity: 'high',
      affectedVersions: '<1.0.0',
      description: 'Test security vulnerability',
      ...overrides
    };
  }

  // Helper function to create deprecated package object
  function createDeprecatedPackage(overrides: Partial<DeprecatedPackage> = {}): DeprecatedPackage {
    return {
      name: 'test-deprecated-package',
      currentVersion: '1.0.0',
      replacement: 'modern-replacement',
      reason: 'Package has been superseded',
      ...overrides
    };
  }

  describe('Security Vulnerability Remediation', () => {
    it('should generate npm update suggestion for individual vulnerability', () => {
      const vulnerability = createVulnerability({
        name: 'lodash',
        cveId: 'CVE-2021-23337',
        severity: 'high'
      });

      const analysis = createAnalysis({
        dependencies: { securityIssues: [vulnerability], outdated: [], security: [] }
      });

      const candidates = analyzer.analyze(analysis);
      const securityTask = candidates.find(c => c.candidateId.includes('CVE-2021-23337'));

      expect(securityTask).toBeDefined();
      expect(securityTask?.remediationSuggestions).toBeDefined();
      expect(securityTask?.remediationSuggestions).toHaveLength(3); // npm update, yarn upgrade, security advisory

      const npmUpdateSuggestion = securityTask?.remediationSuggestions?.find(s => s.type === 'npm_update');
      expect(npmUpdateSuggestion).toBeDefined();
      expect(npmUpdateSuggestion?.command).toBe('npm update lodash');
      expect(npmUpdateSuggestion?.description).toContain('Update lodash to the latest secure version');
      expect(npmUpdateSuggestion?.priority).toBe('high');
      expect(npmUpdateSuggestion?.expectedOutcome).toContain('lodash will be updated to resolve');
    });

    it('should generate security advisory link for real CVE', () => {
      const vulnerability = createVulnerability({
        name: 'axios',
        cveId: 'CVE-2023-45857',
        severity: 'medium'
      });

      const analysis = createAnalysis({
        dependencies: { securityIssues: [vulnerability], outdated: [], security: [] }
      });

      const candidates = analyzer.analyze(analysis);
      const securityTask = candidates.find(c => c.candidateId.includes('CVE-2023-45857'));

      const advisorySuggestion = securityTask?.remediationSuggestions?.find(s => s.type === 'security_advisory');
      expect(advisorySuggestion).toBeDefined();
      expect(advisorySuggestion?.link).toBe('https://nvd.nist.gov/vuln/detail/CVE-2023-45857');
      expect(advisorySuggestion?.description).toContain('Review official security advisory');
    });

    it('should not generate advisory link for non-CVE identifiers', () => {
      const vulnerability = createVulnerability({
        name: 'test-package',
        cveId: 'NO-CVE-CUSTOM-VULN',
        severity: 'high'
      });

      const analysis = createAnalysis({
        dependencies: { securityIssues: [vulnerability], outdated: [], security: [] }
      });

      const candidates = analyzer.analyze(analysis);
      const securityTask = candidates.find(c => c.candidateId.includes('NO-CVE-CUSTOM-VULN'));

      const advisorySuggestion = securityTask?.remediationSuggestions?.find(s => s.type === 'security_advisory');
      expect(advisorySuggestion).toBeUndefined();
    });

    it('should generate manual review suggestion for critical vulnerabilities', () => {
      const vulnerability = createVulnerability({
        name: 'critical-package',
        severity: 'critical'
      });

      const analysis = createAnalysis({
        dependencies: { securityIssues: [vulnerability], outdated: [], security: [] }
      });

      const candidates = analyzer.analyze(analysis);
      const securityTask = candidates.find(c => c.candidateId.includes('critical'));

      const manualReviewSuggestion = securityTask?.remediationSuggestions?.find(s => s.type === 'manual_review');
      expect(manualReviewSuggestion).toBeDefined();
      expect(manualReviewSuggestion?.description).toContain('Manually review code using critical-package');
      expect(manualReviewSuggestion?.priority).toBe('high');
      expect(manualReviewSuggestion?.warning).toContain('Critical vulnerabilities may require immediate mitigation');
    });

    it('should generate grouped remediation for multiple vulnerabilities', () => {
      const vulnerabilities = [
        createVulnerability({ name: 'package1', severity: 'high', cveId: 'CVE-2024-0001' }),
        createVulnerability({ name: 'package2', severity: 'high', cveId: 'CVE-2024-0002' }),
        createVulnerability({ name: 'package1', severity: 'high', cveId: 'CVE-2024-0003' }),
      ];

      const analysis = createAnalysis({
        dependencies: { securityIssues: vulnerabilities, outdated: [], security: [] }
      });

      const candidates = analyzer.analyze(analysis);
      const groupTask = candidates.find(c => c.candidateId === 'maintenance-security-group-high');

      expect(groupTask?.remediationSuggestions).toBeDefined();
      expect(groupTask?.remediationSuggestions).toHaveLength(3); // bulk update, npm audit fix, yarn audit

      const bulkUpdateSuggestion = groupTask?.remediationSuggestions?.find(s => s.type === 'npm_update');
      expect(bulkUpdateSuggestion?.command).toBe('npm update package1 package2');
      expect(bulkUpdateSuggestion?.expectedOutcome).toContain('All 3 security vulnerabilities will be resolved');

      const auditFixSuggestion = groupTask?.remediationSuggestions?.find(s => s.command === 'npm audit fix');
      expect(auditFixSuggestion).toBeDefined();
      expect(auditFixSuggestion?.type).toBe('command');
      expect(auditFixSuggestion?.warning).toContain('May update packages to breaking versions');
    });
  });

  describe('Legacy Security Format Remediation', () => {
    it('should generate npm audit fix for legacy security format', () => {
      const analysis = createAnalysis({
        dependencies: {
          security: ['vulnerable-package@1.0.0 (CVE-2023-12345)', 'another-vuln@2.0.0'],
          outdated: [],
        }
      });

      const candidates = analyzer.analyze(analysis);
      const legacyTask = candidates.find(c => c.candidateId === 'maintenance-security-deps-legacy');

      expect(legacyTask?.remediationSuggestions).toBeDefined();
      expect(legacyTask?.remediationSuggestions).toHaveLength(3); // npm audit fix, npm audit, yarn audit

      const auditFixSuggestion = legacyTask?.remediationSuggestions?.find(s => s.command === 'npm audit fix');
      expect(auditFixSuggestion).toBeDefined();
      expect(auditFixSuggestion?.priority).toBe('critical');
      expect(auditFixSuggestion?.warning).toContain('Test thoroughly after applying');

      const auditReviewSuggestion = legacyTask?.remediationSuggestions?.find(s => s.command === 'npm audit');
      expect(auditReviewSuggestion).toBeDefined();
      expect(auditReviewSuggestion?.description).toContain('Review detailed security audit report');
    });
  });

  describe('Outdated Dependencies Remediation', () => {
    it('should generate update commands for outdated dependencies', () => {
      const analysis = createAnalysis({
        dependencies: {
          outdated: ['package1@1.0.0', 'package2@2.0.0'],
          security: [],
        }
      });

      const candidates = analyzer.analyze(analysis);
      const outdatedTask = candidates.find(c => c.candidateId === 'maintenance-outdated-deps');

      expect(outdatedTask?.remediationSuggestions).toBeDefined();
      expect(outdatedTask?.remediationSuggestions).toHaveLength(3); // npm update, npm outdated, yarn upgrade

      const updateSuggestion = outdatedTask?.remediationSuggestions?.find(s => s.type === 'npm_update');
      expect(updateSuggestion?.command).toBe('npm update package1 package2');

      const checkSuggestion = outdatedTask?.remediationSuggestions?.find(s => s.command === 'npm outdated');
      expect(checkSuggestion).toBeDefined();
      expect(checkSuggestion?.description).toContain('Check which packages are outdated');
    });

    it('should include migration warnings for critical pre-1.0 dependencies', () => {
      const analysis = createAnalysis({
        dependencies: {
          outdated: ['package1@^0.9.0', 'package2@~0.5.0'],
          security: [],
        }
      });

      const candidates = analyzer.analyze(analysis);
      const criticalTask = candidates.find(c => c.candidateId === 'maintenance-critical-outdated-deps');

      expect(criticalTask?.remediationSuggestions).toBeDefined();

      const migrationSuggestion = criticalTask?.remediationSuggestions?.find(s => s.type === 'migration_guide');
      expect(migrationSuggestion).toBeDefined();
      expect(migrationSuggestion?.description).toContain('Review migration guides before updating pre-1.0');
      expect(migrationSuggestion?.warning).toContain('Pre-1.0 versions may introduce breaking changes');
      expect(migrationSuggestion?.priority).toBe('high');
    });
  });

  describe('Deprecated Package Remediation', () => {
    it('should generate replacement commands for deprecated packages with alternatives', () => {
      const deprecatedPkg = createDeprecatedPackage({
        name: 'request',
        replacement: 'axios',
        reason: 'Request library is deprecated'
      });

      const analysis = createAnalysis({
        dependencies: {
          deprecatedPackages: [deprecatedPkg],
          outdated: [],
          security: [],
        }
      });

      const candidates = analyzer.analyze(analysis);
      const deprecatedTask = candidates.find(c => c.candidateId === 'maintenance-deprecated-pkg-request');

      expect(deprecatedTask?.remediationSuggestions).toBeDefined();
      expect(deprecatedTask?.remediationSuggestions).toHaveLength(3); // replacement, migration guide, manual review

      const replacementSuggestion = deprecatedTask?.remediationSuggestions?.find(s => s.type === 'package_replacement');
      expect(replacementSuggestion?.command).toBe('npm uninstall request && npm install axios');
      expect(replacementSuggestion?.description).toContain('Replace request with axios');

      const migrationSuggestion = deprecatedTask?.remediationSuggestions?.find(s => s.type === 'migration_guide');
      expect(migrationSuggestion?.description).toContain('Review migration guide for transitioning from request to axios');
      expect(migrationSuggestion?.warning).toContain('API changes may require updates to existing code');

      const manualSuggestion = deprecatedTask?.remediationSuggestions?.find(s => s.type === 'manual_review');
      expect(manualSuggestion?.description).toContain('Update all imports and usage of request to use axios');
    });

    it('should generate research suggestions for deprecated packages without replacements', () => {
      const deprecatedPkg = createDeprecatedPackage({
        name: 'orphaned-package',
        replacement: null,
        reason: 'No longer maintained'
      });

      const analysis = createAnalysis({
        dependencies: {
          deprecatedPackages: [deprecatedPkg],
          outdated: [],
          security: [],
        }
      });

      const candidates = analyzer.analyze(analysis);
      const deprecatedTask = candidates.find(c => c.candidateId === 'maintenance-deprecated-pkg-orphaned-package');

      expect(deprecatedTask?.remediationSuggestions).toBeDefined();
      expect(deprecatedTask?.remediationSuggestions).toHaveLength(2); // manual review, documentation

      const researchSuggestion = deprecatedTask?.remediationSuggestions?.find(s => s.type === 'manual_review');
      expect(researchSuggestion?.description).toContain('Research alternative packages to replace orphaned-package');
      expect(researchSuggestion?.priority).toBe('critical');
      expect(researchSuggestion?.warning).toContain('No direct replacement available');

      const docSuggestion = deprecatedTask?.remediationSuggestions?.find(s => s.type === 'documentation');
      expect(docSuggestion?.description).toContain('Check orphaned-package documentation for recommended alternatives');
    });
  });

  describe('Remediation Suggestion Priorities', () => {
    it('should assign correct priorities based on vulnerability severity', () => {
      const critical = createVulnerability({ severity: 'critical', cveId: 'CVE-2024-0001' });
      const high = createVulnerability({ severity: 'high', cveId: 'CVE-2024-0002' });
      const medium = createVulnerability({ severity: 'medium', cveId: 'CVE-2024-0003' });
      const low = createVulnerability({ severity: 'low', cveId: 'CVE-2024-0004' });

      const analysis = createAnalysis({
        dependencies: { securityIssues: [critical, high, medium, low], outdated: [], security: [] }
      });

      const candidates = analyzer.analyze(analysis);

      const criticalTask = candidates.find(c => c.candidateId.includes('CVE-2024-0001'));
      const criticalUpdateSuggestion = criticalTask?.remediationSuggestions?.find(s => s.type === 'npm_update');
      expect(criticalUpdateSuggestion?.priority).toBe('critical');

      const highTask = candidates.find(c => c.candidateId.includes('CVE-2024-0002'));
      const highUpdateSuggestion = highTask?.remediationSuggestions?.find(s => s.type === 'npm_update');
      expect(highUpdateSuggestion?.priority).toBe('high');

      const mediumTask = candidates.find(c => c.candidateId.includes('CVE-2024-0003'));
      const mediumUpdateSuggestion = mediumTask?.remediationSuggestions?.find(s => s.type === 'npm_update');
      expect(mediumUpdateSuggestion?.priority).toBe('medium');

      const lowTask = candidates.find(c => c.candidateId.includes('CVE-2024-0004'));
      const lowUpdateSuggestion = lowTask?.remediationSuggestions?.find(s => s.type === 'npm_update');
      expect(lowUpdateSuggestion?.priority).toBe('low');
    });

    it('should handle edge cases gracefully', () => {
      // Empty package name edge case
      const emptyPackageVuln = createVulnerability({ name: '', severity: 'high' });

      const analysis = createAnalysis({
        dependencies: { securityIssues: [emptyPackageVuln], outdated: [], security: [] }
      });

      expect(() => {
        const candidates = analyzer.analyze(analysis);
        const task = candidates.find(c => c.candidateId.includes('CVE-2024-12345'));
        expect(task?.remediationSuggestions).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Command Generation', () => {
    it('should generate valid npm commands', () => {
      const vulnerability = createVulnerability({ name: '@scope/package', severity: 'high' });

      const analysis = createAnalysis({
        dependencies: { securityIssues: [vulnerability], outdated: [], security: [] }
      });

      const candidates = analyzer.analyze(analysis);
      const task = candidates.find(c => c.candidateId.includes('CVE-2024-12345'));

      const npmSuggestion = task?.remediationSuggestions?.find(s => s.type === 'npm_update');
      expect(npmSuggestion?.command).toBe('npm update @scope/package');

      const yarnSuggestion = task?.remediationSuggestions?.find(s => s.type === 'yarn_upgrade');
      expect(yarnSuggestion?.command).toBe('yarn upgrade @scope/package');
    });

    it('should handle special characters in package names', () => {
      const deprecatedPkg = createDeprecatedPackage({
        name: '@company/old-package_with.dots',
        replacement: '@company/new-package'
      });

      const analysis = createAnalysis({
        dependencies: {
          deprecatedPackages: [deprecatedPkg],
          outdated: [],
          security: [],
        }
      });

      const candidates = analyzer.analyze(analysis);
      const task = candidates.find(c => c.candidateId.includes('deprecated-pkg'));

      const replacementSuggestion = task?.remediationSuggestions?.find(s => s.type === 'package_replacement');
      expect(replacementSuggestion?.command).toBe('npm uninstall @company/old-package_with.dots && npm install @company/new-package');
    });
  });
});
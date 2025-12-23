/**
 * Comprehensive Validation Tests for MaintenanceAnalyzer Remediation Features
 *
 * This file validates that all remediation suggestions meet the acceptance criteria:
 * - Specific npm/yarn commands for updates
 * - Migration guides for major version bumps
 * - Security advisory links for vulnerabilities
 * - Replacement package installation commands for deprecated packages
 */

import { MaintenanceAnalyzer } from './maintenance-analyzer';
import type { ProjectAnalysis, SecurityVulnerability, DeprecatedPackage, RemediationSuggestion } from '../idle-processor';

describe('MaintenanceAnalyzer - Remediation Validation', () => {
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

  describe('Acceptance Criteria Validation - Specific npm/yarn commands', () => {
    it('should provide specific npm update commands for security vulnerabilities', () => {
      const vulnerability: SecurityVulnerability = {
        name: 'lodash',
        cveId: 'CVE-2021-23337',
        severity: 'high',
        affectedVersions: '<4.17.21',
        description: 'Command injection vulnerability'
      };

      const analysis = createAnalysis({
        dependencies: {
          securityIssues: [vulnerability],
          outdated: [],
          security: []
        }
      });

      const candidates = analyzer.analyze(analysis);
      const securityTask = candidates.find(c => c.candidateId.includes('CVE-2021-23337'));

      expect(securityTask).toBeDefined();
      expect(securityTask?.remediationSuggestions).toBeDefined();

      // Validate npm command
      const npmSuggestion = securityTask?.remediationSuggestions?.find(s => s.type === 'npm_update');
      expect(npmSuggestion).toBeDefined();
      expect(npmSuggestion?.command).toBe('npm update lodash');
      expect(npmSuggestion?.description).toContain('Update lodash to the latest secure version');

      // Validate yarn command
      const yarnSuggestion = securityTask?.remediationSuggestions?.find(s => s.type === 'yarn_upgrade');
      expect(yarnSuggestion).toBeDefined();
      expect(yarnSuggestion?.command).toBe('yarn upgrade lodash');
      expect(yarnSuggestion?.description).toContain('Use Yarn to upgrade lodash');
    });

    it('should provide specific npm update commands for outdated dependencies', () => {
      const analysis = createAnalysis({
        dependencies: {
          outdated: ['react@17.0.0', 'typescript@4.5.0'],
          security: [],
          securityIssues: []
        }
      });

      const candidates = analyzer.analyze(analysis);
      const outdatedTask = candidates.find(c => c.candidateId === 'maintenance-outdated-deps');

      expect(outdatedTask?.remediationSuggestions).toBeDefined();

      const updateSuggestion = outdatedTask?.remediationSuggestions?.find(s => s.type === 'npm_update');
      expect(updateSuggestion).toBeDefined();
      expect(updateSuggestion?.command).toBe('npm update react typescript');
      expect(updateSuggestion?.description).toContain('Update outdated dependencies');
    });

    it('should provide npm audit fix commands for legacy security format', () => {
      const analysis = createAnalysis({
        dependencies: {
          security: ['vulnerable-package@1.0.0 (CVE-2023-12345)'],
          outdated: [],
          securityIssues: []
        }
      });

      const candidates = analyzer.analyze(analysis);
      const legacyTask = candidates.find(c => c.candidateId === 'maintenance-security-deps-legacy');

      expect(legacyTask?.remediationSuggestions).toBeDefined();

      const auditFixSuggestion = legacyTask?.remediationSuggestions?.find(s => s.command === 'npm audit fix');
      expect(auditFixSuggestion).toBeDefined();
      expect(auditFixSuggestion?.type).toBe('command');
      expect(auditFixSuggestion?.description).toContain('automatically resolve security vulnerabilities');
    });
  });

  describe('Acceptance Criteria Validation - Migration guides', () => {
    it('should provide migration guide suggestions for pre-1.0 dependencies', () => {
      const analysis = createAnalysis({
        dependencies: {
          outdated: ['experimental-package@^0.9.0', 'beta-lib@~0.5.0'],
          security: [],
          securityIssues: []
        }
      });

      const candidates = analyzer.analyze(analysis);
      const criticalTask = candidates.find(c => c.candidateId === 'maintenance-critical-outdated-deps');

      expect(criticalTask?.remediationSuggestions).toBeDefined();

      const migrationSuggestion = criticalTask?.remediationSuggestions?.find(s => s.type === 'migration_guide');
      expect(migrationSuggestion).toBeDefined();
      expect(migrationSuggestion?.description).toContain('Review migration guides before updating pre-1.0');
      expect(migrationSuggestion?.priority).toBe('high');
      expect(migrationSuggestion?.warning).toContain('Pre-1.0 versions may introduce breaking changes');
      expect(migrationSuggestion?.expectedOutcome).toContain('Understanding of breaking changes and migration requirements');
    });

    it('should provide migration guides for deprecated package replacements', () => {
      const deprecatedPkg: DeprecatedPackage = {
        name: 'request',
        currentVersion: '2.88.2',
        replacement: 'axios',
        reason: 'Request library is deprecated'
      };

      const analysis = createAnalysis({
        dependencies: {
          deprecatedPackages: [deprecatedPkg],
          outdated: [],
          security: []
        }
      });

      const candidates = analyzer.analyze(analysis);
      const deprecatedTask = candidates.find(c => c.candidateId === 'maintenance-deprecated-pkg-request');

      expect(deprecatedTask?.remediationSuggestions).toBeDefined();

      const migrationSuggestion = deprecatedTask?.remediationSuggestions?.find(s => s.type === 'migration_guide');
      expect(migrationSuggestion).toBeDefined();
      expect(migrationSuggestion?.description).toContain('Review migration guide for transitioning from request to axios');
      expect(migrationSuggestion?.priority).toBe('high');
      expect(migrationSuggestion?.warning).toContain('API changes may require updates to existing code');
    });
  });

  describe('Acceptance Criteria Validation - Security advisory links', () => {
    it('should provide security advisory links for real CVE identifiers', () => {
      const vulnerability: SecurityVulnerability = {
        name: 'axios',
        cveId: 'CVE-2023-45857',
        severity: 'medium',
        affectedVersions: '<1.6.0',
        description: 'CSRF vulnerability'
      };

      const analysis = createAnalysis({
        dependencies: {
          securityIssues: [vulnerability],
          outdated: [],
          security: []
        }
      });

      const candidates = analyzer.analyze(analysis);
      const securityTask = candidates.find(c => c.candidateId.includes('CVE-2023-45857'));

      expect(securityTask?.remediationSuggestions).toBeDefined();

      const advisorySuggestion = securityTask?.remediationSuggestions?.find(s => s.type === 'security_advisory');
      expect(advisorySuggestion).toBeDefined();
      expect(advisorySuggestion?.link).toBe('https://nvd.nist.gov/vuln/detail/CVE-2023-45857');
      expect(advisorySuggestion?.description).toContain('Review official security advisory for CVE-2023-45857');
      expect(advisorySuggestion?.expectedOutcome).toContain('Better understanding of the vulnerability impact');
    });

    it('should not provide advisory links for non-CVE identifiers', () => {
      const vulnerability: SecurityVulnerability = {
        name: 'custom-lib',
        cveId: 'NO-CVE-CUSTOM-LIB-HIGH',
        severity: 'high',
        affectedVersions: '<2.0.0',
        description: 'Internal security issue'
      };

      const analysis = createAnalysis({
        dependencies: {
          securityIssues: [vulnerability],
          outdated: [],
          security: []
        }
      });

      const candidates = analyzer.analyze(analysis);
      const securityTask = candidates.find(c => c.candidateId.includes('NO-CVE-CUSTOM-LIB-HIGH'));

      expect(securityTask?.remediationSuggestions).toBeDefined();

      const advisorySuggestion = securityTask?.remediationSuggestions?.find(s => s.type === 'security_advisory');
      expect(advisorySuggestion).toBeUndefined();
    });

    it('should handle malformed CVE patterns correctly', () => {
      const vulnerability: SecurityVulnerability = {
        name: 'legacy-package',
        cveId: 'ADVISORY-2024-001',
        severity: 'medium',
        affectedVersions: '<1.0.0',
        description: 'Non-standard vulnerability identifier'
      };

      const analysis = createAnalysis({
        dependencies: {
          securityIssues: [vulnerability],
          outdated: [],
          security: []
        }
      });

      const candidates = analyzer.analyze(analysis);
      const securityTask = candidates.find(c => c.candidateId.includes('ADVISORY-2024-001'));

      expect(securityTask?.remediationSuggestions).toBeDefined();

      // Should not have advisory link for non-CVE format
      const advisorySuggestion = securityTask?.remediationSuggestions?.find(s => s.type === 'security_advisory');
      expect(advisorySuggestion).toBeUndefined();
    });
  });

  describe('Acceptance Criteria Validation - Package replacement commands', () => {
    it('should provide replacement commands for deprecated packages with alternatives', () => {
      const deprecatedPkg: DeprecatedPackage = {
        name: 'node-sass',
        currentVersion: '7.0.3',
        replacement: 'dart-sass',
        reason: 'LibSass is deprecated'
      };

      const analysis = createAnalysis({
        dependencies: {
          deprecatedPackages: [deprecatedPkg],
          outdated: [],
          security: []
        }
      });

      const candidates = analyzer.analyze(analysis);
      const deprecatedTask = candidates.find(c => c.candidateId === 'maintenance-deprecated-pkg-node-sass');

      expect(deprecatedTask?.remediationSuggestions).toBeDefined();

      const replacementSuggestion = deprecatedTask?.remediationSuggestions?.find(s => s.type === 'package_replacement');
      expect(replacementSuggestion).toBeDefined();
      expect(replacementSuggestion?.command).toBe('npm uninstall node-sass && npm install dart-sass');
      expect(replacementSuggestion?.description).toContain('Replace node-sass with dart-sass');
      expect(replacementSuggestion?.priority).toBe('high');
      expect(replacementSuggestion?.expectedOutcome).toContain('node-sass replaced with modern alternative dart-sass');
    });

    it('should handle scoped package replacements correctly', () => {
      const deprecatedPkg: DeprecatedPackage = {
        name: '@angular/http',
        currentVersion: '7.0.0',
        replacement: '@angular/common/http',
        reason: 'Deprecated in favor of HttpClientModule'
      };

      const analysis = createAnalysis({
        dependencies: {
          deprecatedPackages: [deprecatedPkg],
          outdated: [],
          security: []
        }
      });

      const candidates = analyzer.analyze(analysis);
      const deprecatedTask = candidates.find(c => c.candidateId.includes('deprecated-pkg'));

      expect(deprecatedTask?.remediationSuggestions).toBeDefined();

      const replacementSuggestion = deprecatedTask?.remediationSuggestions?.find(s => s.type === 'package_replacement');
      expect(replacementSuggestion).toBeDefined();
      expect(replacementSuggestion?.command).toBe('npm uninstall @angular/http && npm install @angular/common/http');
      expect(replacementSuggestion?.description).toContain('Replace @angular/http with @angular/common/http');
    });

    it('should provide research suggestions for packages without replacements', () => {
      const deprecatedPkg: DeprecatedPackage = {
        name: 'gulp-util',
        currentVersion: '3.0.8',
        replacement: null,
        reason: 'Deprecated with no direct replacement'
      };

      const analysis = createAnalysis({
        dependencies: {
          deprecatedPackages: [deprecatedPkg],
          outdated: [],
          security: []
        }
      });

      const candidates = analyzer.analyze(analysis);
      const deprecatedTask = candidates.find(c => c.candidateId === 'maintenance-deprecated-pkg-gulp-util');

      expect(deprecatedTask?.remediationSuggestions).toBeDefined();

      // Should have manual review suggestion for research
      const researchSuggestion = deprecatedTask?.remediationSuggestions?.find(s => s.type === 'manual_review');
      expect(researchSuggestion).toBeDefined();
      expect(researchSuggestion?.description).toContain('Research alternative packages to replace gulp-util');
      expect(researchSuggestion?.priority).toBe('critical');
      expect(researchSuggestion?.warning).toContain('No direct replacement available');

      // Should also have documentation suggestion
      const docSuggestion = deprecatedTask?.remediationSuggestions?.find(s => s.type === 'documentation');
      expect(docSuggestion).toBeDefined();
      expect(docSuggestion?.description).toContain('Check gulp-util documentation for recommended alternatives');
    });
  });

  describe('Remediation Suggestion Quality Validation', () => {
    it('should ensure all remediation suggestions have required fields', () => {
      const vulnerability: SecurityVulnerability = {
        name: 'test-package',
        cveId: 'CVE-2024-12345',
        severity: 'high',
        affectedVersions: '<1.0.0',
        description: 'Test vulnerability'
      };

      const analysis = createAnalysis({
        dependencies: {
          securityIssues: [vulnerability],
          outdated: [],
          security: []
        }
      });

      const candidates = analyzer.analyze(analysis);
      const task = candidates.find(c => c.candidateId.includes('CVE-2024-12345'));

      expect(task?.remediationSuggestions).toBeDefined();

      task?.remediationSuggestions?.forEach((suggestion: RemediationSuggestion) => {
        // All suggestions must have required fields
        expect(suggestion.type).toBeDefined();
        expect(suggestion.description).toBeDefined();
        expect(suggestion.priority).toBeDefined();
        expect(['critical', 'high', 'medium', 'low']).toContain(suggestion.priority);

        // Commands should be valid when present
        if (suggestion.command) {
          expect(suggestion.command).toMatch(/^(npm|yarn|git|npx)/);
        }

        // Links should be valid URLs when present
        if (suggestion.link) {
          expect(suggestion.link).toMatch(/^https?:\/\//);
        }

        // Expected outcomes should be descriptive
        if (suggestion.expectedOutcome) {
          expect(suggestion.expectedOutcome.length).toBeGreaterThan(10);
        }
      });
    });

    it('should ensure priority levels are appropriate for severity', () => {
      const vulnerabilities: SecurityVulnerability[] = [
        { name: 'critical-pkg', cveId: 'CVE-2024-0001', severity: 'critical', affectedVersions: '<1.0.0', description: 'Critical issue' },
        { name: 'high-pkg', cveId: 'CVE-2024-0002', severity: 'high', affectedVersions: '<1.0.0', description: 'High issue' },
        { name: 'medium-pkg', cveId: 'CVE-2024-0003', severity: 'medium', affectedVersions: '<1.0.0', description: 'Medium issue' },
        { name: 'low-pkg', cveId: 'CVE-2024-0004', severity: 'low', affectedVersions: '<1.0.0', description: 'Low issue' }
      ];

      const analysis = createAnalysis({
        dependencies: {
          securityIssues: vulnerabilities,
          outdated: [],
          security: []
        }
      });

      const candidates = analyzer.analyze(analysis);

      vulnerabilities.forEach((vuln, index) => {
        const task = candidates.find(c => c.candidateId.includes(vuln.cveId));
        expect(task?.remediationSuggestions).toBeDefined();

        const updateSuggestion = task?.remediationSuggestions?.find(s => s.type === 'npm_update');
        expect(updateSuggestion).toBeDefined();

        // Verify priority mapping
        const expectedPriority = vuln.severity === 'critical' ? 'critical' : vuln.severity;
        expect(updateSuggestion?.priority).toBe(expectedPriority);
      });
    });

    it('should validate command syntax for all package managers', () => {
      const testCases = [
        { name: 'simple-package', expectedNpm: 'npm update simple-package' },
        { name: '@scope/package', expectedNpm: 'npm update @scope/package' },
        { name: 'package-with-dashes', expectedNpm: 'npm update package-with-dashes' }
      ];

      testCases.forEach((testCase) => {
        const vulnerability: SecurityVulnerability = {
          name: testCase.name,
          cveId: 'CVE-2024-12345',
          severity: 'high',
          affectedVersions: '<1.0.0',
          description: 'Test vulnerability'
        };

        const analysis = createAnalysis({
          dependencies: {
            securityIssues: [vulnerability],
            outdated: [],
            security: []
          }
        });

        const candidates = analyzer.analyze(analysis);
        const task = candidates.find(c => c.candidateId.includes('CVE-2024-12345'));

        const npmSuggestion = task?.remediationSuggestions?.find(s => s.type === 'npm_update');
        expect(npmSuggestion?.command).toBe(testCase.expectedNpm);

        const yarnSuggestion = task?.remediationSuggestions?.find(s => s.type === 'yarn_upgrade');
        expect(yarnSuggestion?.command).toBe(testCase.expectedNpm.replace('npm update', 'yarn upgrade'));
      });
    });
  });

  describe('Complete Integration Test - All Acceptance Criteria', () => {
    it('should satisfy all acceptance criteria in a comprehensive scenario', () => {
      const analysis = createAnalysis({
        dependencies: {
          // Security issues requiring npm/yarn commands and advisory links
          securityIssues: [
            {
              name: 'lodash',
              cveId: 'CVE-2021-23337',
              severity: 'critical',
              affectedVersions: '<4.17.21',
              description: 'Command injection vulnerability'
            }
          ],
          // Outdated dependencies including pre-1.0 requiring migration guides
          outdated: ['react@17.0.0', 'experimental-lib@^0.9.0'],
          // Deprecated packages requiring replacement commands
          deprecatedPackages: [
            {
              name: 'request',
              currentVersion: '2.88.2',
              replacement: 'axios',
              reason: 'Request is deprecated'
            }
          ],
          security: []
        }
      });

      const candidates = analyzer.analyze(analysis);

      // Should have tasks for all categories
      const securityTasks = candidates.filter(c => c.candidateId.includes('security'));
      const outdatedTasks = candidates.filter(c => c.candidateId.includes('outdated'));
      const deprecatedTasks = candidates.filter(c => c.candidateId.includes('deprecated-pkg'));

      expect(securityTasks.length).toBeGreaterThan(0);
      expect(outdatedTasks.length).toBeGreaterThan(0);
      expect(deprecatedTasks.length).toBeGreaterThan(0);

      // Validate that all acceptance criteria are met
      let hasNpmCommands = false;
      let hasYarnCommands = false;
      let hasMigrationGuides = false;
      let hasSecurityAdvisoryLinks = false;
      let hasPackageReplacements = false;

      candidates.forEach(candidate => {
        candidate.remediationSuggestions?.forEach(suggestion => {
          if (suggestion.type === 'npm_update') hasNpmCommands = true;
          if (suggestion.type === 'yarn_upgrade') hasYarnCommands = true;
          if (suggestion.type === 'migration_guide') hasMigrationGuides = true;
          if (suggestion.type === 'security_advisory') hasSecurityAdvisoryLinks = true;
          if (suggestion.type === 'package_replacement') hasPackageReplacements = true;
        });
      });

      // All acceptance criteria must be satisfied
      expect(hasNpmCommands).toBe(true);
      expect(hasYarnCommands).toBe(true);
      expect(hasMigrationGuides).toBe(true);
      expect(hasSecurityAdvisoryLinks).toBe(true);
      expect(hasPackageReplacements).toBe(true);
    });
  });
});
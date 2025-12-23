/**
 * Integration Tests for Maintenance Analyzer Scoring and Prioritization Workflow
 *
 * This test suite provides comprehensive integration testing for the complete
 * scoring and prioritization workflow including mixed scenarios, edge cases,
 * and end-to-end analysis-to-task creation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MaintenanceAnalyzer } from './maintenance-analyzer';
import type {
  ProjectAnalysis,
  SecurityVulnerability,
  VulnerabilitySeverity,
  OutdatedDependency,
  DeprecatedPackage,
  UpdateType
} from '../idle-processor';
import type { TaskCandidate } from './index';

describe('MaintenanceAnalyzer - Scoring and Prioritization Integration', () => {
  let analyzer: MaintenanceAnalyzer;

  beforeEach(() => {
    analyzer = new MaintenanceAnalyzer();
  });

  // Helper to create comprehensive ProjectAnalysis with various maintenance issues
  function createMixedMaintenanceAnalysis(config: {
    securityIssues?: SecurityVulnerability[];
    outdatedPackages?: OutdatedDependency[];
    deprecatedPackages?: DeprecatedPackage[];
  } = {}): ProjectAnalysis {
    return {
      codebaseSize: {
        files: 150,
        lines: 15000,
        languages: { typescript: 10000, javascript: 3000, json: 2000 }
      },
      testCoverage: { percentage: 75 },
      dependencies: {
        outdated: [], // Legacy format
        security: [], // Legacy format
        securityIssues: config.securityIssues || [],
        outdatedPackages: config.outdatedPackages || [],
        deprecatedPackages: config.deprecatedPackages || []
      },
      codeQuality: {
        lintIssues: 5,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: {
        coverage: 60,
        missingDocs: [],
        outdatedSections: [],
        apiCompleteness: {
          percentage: 80,
          details: {
            totalEndpoints: 25,
            documentedEndpoints: 20,
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

  // Helper to create security vulnerability
  function createVulnerability(config: {
    name: string;
    cveId?: string;
    severity: VulnerabilitySeverity;
    description?: string;
    affectedVersions?: string;
  }): SecurityVulnerability {
    return {
      name: config.name,
      cveId: config.cveId || `CVE-2024-${Math.floor(Math.random() * 10000).toString().padStart(5, '0')}`,
      severity: config.severity,
      affectedVersions: config.affectedVersions || '<1.0.0',
      description: config.description || `Security vulnerability in ${config.name}`
    };
  }

  // Helper to create outdated dependency
  function createOutdatedDependency(config: {
    name: string;
    currentVersion: string;
    latestVersion: string;
    updateType: UpdateType;
  }): OutdatedDependency {
    return {
      name: config.name,
      currentVersion: config.currentVersion,
      latestVersion: config.latestVersion,
      updateType: config.updateType
    };
  }

  // Helper to create deprecated package
  function createDeprecatedPackage(config: {
    name: string;
    currentVersion: string;
    reason?: string;
    replacement?: string;
  }): DeprecatedPackage {
    return {
      name: config.name,
      currentVersion: config.currentVersion,
      reason: config.reason || 'Package is no longer maintained',
      replacement: config.replacement || null
    };
  }

  describe('Mixed Security/Outdated/Deprecated Scenarios', () => {
    it('should correctly prioritize mixed critical security vulnerabilities with outdated and deprecated packages', () => {
      const analysis = createMixedMaintenanceAnalysis({
        securityIssues: [
          createVulnerability({ name: 'axios', severity: 'critical', cveId: 'CVE-2024-28849' }),
          createVulnerability({ name: 'lodash', severity: 'high', cveId: 'CVE-2024-29182' }),
          createVulnerability({ name: 'express', severity: 'medium', cveId: 'CVE-2024-29084' }),
        ],
        outdatedPackages: [
          createOutdatedDependency({ name: 'react', currentVersion: '17.0.2', latestVersion: '18.3.0', updateType: 'major' }),
          createOutdatedDependency({ name: 'typescript', currentVersion: '4.9.5', latestVersion: '5.4.5', updateType: 'major' }),
          createOutdatedDependency({ name: 'jest', currentVersion: '28.1.3', latestVersion: '29.7.0', updateType: 'minor' }),
        ],
        deprecatedPackages: [
          createDeprecatedPackage({
            name: 'request',
            currentVersion: '2.88.2',
            reason: 'Package deprecated',
            replacement: 'axios'
          }),
          createDeprecatedPackage({
            name: 'node-sass',
            currentVersion: '7.0.3',
            reason: 'Package deprecated',
            replacement: 'sass'
          }),
        ]
      });

      const candidates = analyzer.analyze(analysis);

      // Should have tasks for: 1 critical security + 1 high security + 1 medium security group +
      // 2 major updates + 1 minor update + 2 deprecated packages = 8 total
      expect(candidates).toHaveLength(8);

      // Sort by score to verify prioritization
      const sortedCandidates = [...candidates].sort((a, b) => b.score - a.score);

      // Critical security vulnerability should be highest priority (score 1.0)
      expect(sortedCandidates[0].score).toBe(1.0);
      expect(sortedCandidates[0].priority).toBe('urgent');
      expect(sortedCandidates[0].title).toContain('Critical');
      expect(sortedCandidates[0].title).toContain('axios');

      // High security vulnerability should be second (score 0.9)
      expect(sortedCandidates[1].score).toBe(0.9);
      expect(sortedCandidates[1].priority).toBe('high');
      expect(sortedCandidates[1].title).toContain('High');
      expect(sortedCandidates[1].title).toContain('lodash');

      // Major outdated dependencies should have score 0.8 (high priority within outdated)
      const majorUpdates = sortedCandidates.filter(c => c.score === 0.8);
      expect(majorUpdates).toHaveLength(2);
      expect(majorUpdates.some(c => c.title.includes('react'))).toBe(true);
      expect(majorUpdates.some(c => c.title.includes('typescript'))).toBe(true);

      // Deprecated packages without replacement should have score 0.8, with replacement 0.6
      const deprecatedTasks = sortedCandidates.filter(c => c.title.includes('Deprecated'));
      expect(deprecatedTasks).toHaveLength(2);
      expect(deprecatedTasks.every(c => c.score === 0.6 || c.score === 0.8)).toBe(true);
    });

    it('should handle complex scenario with multiple vulnerabilities of same severity', () => {
      const analysis = createMixedMaintenanceAnalysis({
        securityIssues: [
          createVulnerability({ name: 'package-a', severity: 'high', cveId: 'CVE-2024-11111' }),
          createVulnerability({ name: 'package-b', severity: 'high', cveId: 'CVE-2024-22222' }),
          createVulnerability({ name: 'package-c', severity: 'high', cveId: 'CVE-2024-33333' }),
          createVulnerability({ name: 'package-d', severity: 'medium', cveId: 'CVE-2024-44444' }),
          createVulnerability({ name: 'package-e', severity: 'medium', cveId: 'CVE-2024-55555' }),
          createVulnerability({ name: 'package-f', severity: 'medium', cveId: 'CVE-2024-66666' }),
          createVulnerability({ name: 'package-g', severity: 'low', cveId: 'CVE-2024-77777' }),
        ],
        outdatedPackages: [
          createOutdatedDependency({ name: 'dep1', currentVersion: '1.0.0', latestVersion: '1.0.1', updateType: 'patch' }),
          createOutdatedDependency({ name: 'dep2', currentVersion: '1.0.0', latestVersion: '1.0.2', updateType: 'patch' }),
          createOutdatedDependency({ name: 'dep3', currentVersion: '1.0.0', latestVersion: '1.0.3', updateType: 'patch' }),
          createOutdatedDependency({ name: 'dep4', currentVersion: '1.0.0', latestVersion: '1.0.4', updateType: 'patch' }),
        ]
      });

      const candidates = analyzer.analyze(analysis);

      // Should group vulnerabilities: 1 grouped high task + 1 grouped medium + 1 grouped low + 1 grouped patch updates
      expect(candidates).toHaveLength(4);

      // Verify grouping behavior for multiple high severity vulnerabilities
      const highSecurityTask = candidates.find(c => c.title.includes('3 High Security'));
      expect(highSecurityTask).toBeDefined();
      expect(highSecurityTask!.score).toBe(0.9);
      expect(highSecurityTask!.priority).toBe('high');

      // Verify medium vulnerabilities are grouped
      const mediumSecurityTask = candidates.find(c => c.title.includes('3 Medium Security'));
      expect(mediumSecurityTask).toBeDefined();
      expect(mediumSecurityTask!.score).toBe(0.7);
      expect(mediumSecurityTask!.priority).toBe('normal');

      // Verify patch updates are grouped (more than 2)
      const patchUpdatesTask = candidates.find(c => c.title.includes('4 Patch'));
      expect(patchUpdatesTask).toBeDefined();
      expect(patchUpdatesTask!.score).toBe(0.4);
    });
  });

  describe('Correct Prioritization Order', () => {
    it('should maintain correct priority order across all maintenance task types', () => {
      const analysis = createMixedMaintenanceAnalysis({
        securityIssues: [
          createVulnerability({ name: 'critical-pkg', severity: 'critical' }),
          createVulnerability({ name: 'high-pkg', severity: 'high' }),
          createVulnerability({ name: 'medium-pkg', severity: 'medium' }),
          createVulnerability({ name: 'low-pkg', severity: 'low' }),
        ],
        outdatedPackages: [
          createOutdatedDependency({ name: 'major-dep', currentVersion: '1.0.0', latestVersion: '2.0.0', updateType: 'major' }),
          createOutdatedDependency({ name: 'minor-dep', currentVersion: '1.0.0', latestVersion: '1.1.0', updateType: 'minor' }),
          createOutdatedDependency({ name: 'patch-dep', currentVersion: '1.0.0', latestVersion: '1.0.1', updateType: 'patch' }),
        ],
        deprecatedPackages: [
          createDeprecatedPackage({ name: 'deprecated-no-replacement', currentVersion: '1.0.0' }),
          createDeprecatedPackage({ name: 'deprecated-with-replacement', currentVersion: '1.0.0', replacement: 'new-package' }),
        ]
      });

      const candidates = analyzer.analyze(analysis);

      // Sort by score (higher first) then by priority mapping
      const priorityOrder = ['urgent', 'high', 'normal', 'low'];
      const sortedCandidates = [...candidates].sort((a, b) => {
        // First sort by score
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        // Then by priority
        return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
      });

      const expectedOrder = [
        { score: 1.0, priority: 'urgent', type: 'critical-security' },
        { score: 0.9, priority: 'high', type: 'high-security' },
        { score: 0.8, priority: 'high', type: 'deprecated-no-replacement' },
        { score: 0.8, priority: 'high', type: 'major-outdated' },
        { score: 0.7, priority: 'normal', type: 'medium-security' },
        { score: 0.6, priority: 'normal', type: 'minor-outdated' },
        { score: 0.6, priority: 'normal', type: 'deprecated-with-replacement' },
        { score: 0.5, priority: 'low', type: 'low-security' },
        { score: 0.4, priority: 'low', type: 'patch-outdated' },
      ];

      for (let i = 0; i < expectedOrder.length; i++) {
        const candidate = sortedCandidates[i];
        const expected = expectedOrder[i];

        expect(candidate.score, `Index ${i}: Expected score ${expected.score} but got ${candidate.score} for ${candidate.title}`).toBe(expected.score);
        expect(candidate.priority, `Index ${i}: Expected priority ${expected.priority} but got ${candidate.priority} for ${candidate.title}`).toBe(expected.priority);
      }
    });

    it('should properly handle business priority scenarios from existing test patterns', () => {
      // Simulate a production incident scenario with multiple urgent issues
      const productionIncidentAnalysis = createMixedMaintenanceAnalysis({
        securityIssues: [
          createVulnerability({
            name: 'auth-library',
            severity: 'critical',
            cveId: 'CVE-2024-AUTH',
            description: 'Authentication bypass vulnerability'
          }),
          createVulnerability({
            name: 'session-manager',
            severity: 'high',
            cveId: 'CVE-2024-SESSION',
            description: 'Session fixation vulnerability'
          }),
        ],
        outdatedPackages: [
          createOutdatedDependency({
            name: 'security-lib',
            currentVersion: '1.0.0',
            latestVersion: '2.0.0',
            updateType: 'major'
          }),
        ]
      });

      const candidates = analyzer.analyze(productionIncidentAnalysis);
      const sortedByScore = [...candidates].sort((a, b) => b.score - a.score);

      // Critical security vulnerability should be first
      expect(sortedByScore[0].score).toBe(1.0);
      expect(sortedByScore[0].priority).toBe('urgent');
      expect(sortedByScore[0].title).toContain('Critical');
      expect(sortedByScore[0].title).toContain('auth-library');

      // High security should be second
      expect(sortedByScore[1].score).toBe(0.9);
      expect(sortedByScore[1].priority).toBe('high');
      expect(sortedByScore[1].title).toContain('High');

      // Major security-related update should be third
      expect(sortedByScore[2].score).toBe(0.8);
      expect(sortedByScore[2].priority).toBe('high');
      expect(sortedByScore[2].title).toContain('security-lib');
    });
  });

  describe('Edge Cases with Equal Scores', () => {
    it('should handle multiple critical vulnerabilities with consistent scoring', () => {
      const analysis = createMixedMaintenanceAnalysis({
        securityIssues: [
          createVulnerability({ name: 'critical-a', severity: 'critical', cveId: 'CVE-2024-A' }),
          createVulnerability({ name: 'critical-b', severity: 'critical', cveId: 'CVE-2024-B' }),
          createVulnerability({ name: 'critical-c', severity: 'critical', cveId: 'CVE-2024-C' }),
        ]
      });

      const candidates = analyzer.analyze(analysis);

      // All critical vulnerabilities should have equal score
      expect(candidates).toHaveLength(3);
      candidates.forEach(candidate => {
        expect(candidate.score).toBe(1.0);
        expect(candidate.priority).toBe('urgent');
        expect(candidate.title).toContain('Critical');
      });
    });

    it('should handle equal scores with different effort levels', () => {
      const analysis = createMixedMaintenanceAnalysis({
        securityIssues: [
          createVulnerability({ name: 'high-effort-critical', severity: 'critical' }),
        ],
        outdatedPackages: [
          createOutdatedDependency({ name: 'major-a', currentVersion: '1.0.0', latestVersion: '2.0.0', updateType: 'major' }),
          createOutdatedDependency({ name: 'major-b', currentVersion: '2.0.0', latestVersion: '3.0.0', updateType: 'major' }),
        ],
        deprecatedPackages: [
          createDeprecatedPackage({ name: 'deprecated-urgent', currentVersion: '1.0.0' }),
        ]
      });

      const candidates = analyzer.analyze(analysis);

      // Critical security should be highest despite potentially higher effort
      const criticalTask = candidates.find(c => c.title.includes('Critical'));
      expect(criticalTask!.score).toBe(1.0);
      expect(criticalTask!.estimatedEffort).toBe('high'); // Critical tasks get high effort estimation

      // Tasks with score 0.8 (major updates and deprecated without replacement)
      const scoreEightTasks = candidates.filter(c => c.score === 0.8);
      expect(scoreEightTasks).toHaveLength(3); // 2 major updates + 1 deprecated without replacement

      // Verify effort levels are appropriate
      const majorTasks = scoreEightTasks.filter(c => c.title.includes('Major Update'));
      expect(majorTasks).toHaveLength(2);
      majorTasks.forEach(task => {
        expect(task.estimatedEffort).toBe('medium'); // Major updates get medium effort
      });
    });

    it('should handle tie-breaking for grouped vs individual tasks with same priority', () => {
      const analysis = createMixedMaintenanceAnalysis({
        securityIssues: [
          // Exactly 2 high severity vulnerabilities - should get individual tasks
          createVulnerability({ name: 'high-individual-a', severity: 'high' }),
          createVulnerability({ name: 'high-individual-b', severity: 'high' }),
        ],
        outdatedPackages: [
          // Exactly 3 minor updates - should get individual tasks
          createOutdatedDependency({ name: 'minor-a', currentVersion: '1.0.0', latestVersion: '1.1.0', updateType: 'minor' }),
          createOutdatedDependency({ name: 'minor-b', currentVersion: '2.0.0', latestVersion: '2.1.0', updateType: 'minor' }),
          createOutdatedDependency({ name: 'minor-c', currentVersion: '3.0.0', latestVersion: '3.1.0', updateType: 'minor' }),
        ]
      });

      const candidates = analyzer.analyze(analysis);

      // Should have individual tasks: 2 high security + 3 minor updates = 5 total
      expect(candidates).toHaveLength(5);

      // All high security individual tasks should have equal score
      const highSecurityTasks = candidates.filter(c => c.title.includes('High Security') && !c.title.includes('3 High'));
      expect(highSecurityTasks).toHaveLength(2);
      highSecurityTasks.forEach(task => {
        expect(task.score).toBe(0.9);
        expect(task.priority).toBe('high');
      });

      // All minor update tasks should have equal score
      const minorTasks = candidates.filter(c => c.title.includes('Minor Update'));
      expect(minorTasks).toHaveLength(3);
      minorTasks.forEach(task => {
        expect(task.score).toBe(0.6);
        expect(task.priority).toBe('normal');
      });
    });
  });

  describe('End-to-End Analysis-to-Task Workflow', () => {
    it('should create complete tasks with all required fields and remediation suggestions', () => {
      const analysis = createMixedMaintenanceAnalysis({
        securityIssues: [
          createVulnerability({
            name: 'vulnerable-package',
            severity: 'critical',
            cveId: 'CVE-2024-12345',
            description: 'Remote code execution vulnerability',
            affectedVersions: '<2.1.4'
          }),
        ],
        outdatedPackages: [
          createOutdatedDependency({
            name: 'old-package',
            currentVersion: '1.5.2',
            latestVersion: '2.0.0',
            updateType: 'major'
          }),
        ],
        deprecatedPackages: [
          createDeprecatedPackage({
            name: 'legacy-package',
            currentVersion: '1.0.0',
            reason: 'No longer maintained',
            replacement: 'modern-package'
          }),
        ]
      });

      const candidates = analyzer.analyze(analysis);
      expect(candidates).toHaveLength(3);

      // Test critical security vulnerability task completeness
      const criticalTask = candidates.find(c => c.score === 1.0)!;
      expect(criticalTask).toBeDefined();

      // Verify all required fields are present
      expect(criticalTask.candidateId).toBe('maintenance-security-critical-CVE-2024-12345');
      expect(criticalTask.title).toBe('Fix Critical Security Vulnerability: CVE-2024-12345');
      expect(criticalTask.description).toContain('Critical vulnerability in vulnerable-package');
      expect(criticalTask.description).toContain('Remote code execution vulnerability');
      expect(criticalTask.priority).toBe('urgent');
      expect(criticalTask.estimatedEffort).toBe('high');
      expect(criticalTask.suggestedWorkflow).toBe('maintenance');
      expect(criticalTask.rationale).toContain('Critical vulnerabilities require immediate attention');

      // Verify remediation suggestions are complete
      expect(criticalTask.remediationSuggestions).toBeDefined();
      expect(criticalTask.remediationSuggestions!.length).toBeGreaterThan(0);

      const npmUpdateSuggestion = criticalTask.remediationSuggestions!.find(s => s.type === 'npm_update');
      expect(npmUpdateSuggestion).toBeDefined();
      expect(npmUpdateSuggestion!.command).toBe('npm update vulnerable-package');
      expect(npmUpdateSuggestion!.priority).toBe('critical');

      const securityAdvisory = criticalTask.remediationSuggestions!.find(s => s.type === 'security_advisory');
      expect(securityAdvisory).toBeDefined();
      expect(securityAdvisory!.link).toBe('https://nvd.nist.gov/vuln/detail/CVE-2024-12345');

      // Test major outdated dependency task
      const outdatedTask = candidates.find(c => c.title.includes('Major Update'))!;
      expect(outdatedTask).toBeDefined();
      expect(outdatedTask.candidateId).toBe('maintenance-outdated-major-old-package');
      expect(outdatedTask.title).toBe('Major Update: old-package');
      expect(outdatedTask.description).toBe('Update old-package from 1.5.2 to 2.0.0 (major update)');
      expect(outdatedTask.priority).toBe('high');
      expect(outdatedTask.score).toBe(0.8);

      // Check for migration guide suggestion for major updates
      const migrationGuide = outdatedTask.remediationSuggestions!.find(s => s.type === 'migration_guide');
      expect(migrationGuide).toBeDefined();
      expect(migrationGuide!.warning).toContain('Major version updates may introduce breaking changes');

      // Test deprecated package task
      const deprecatedTask = candidates.find(c => c.title.includes('Deprecated'))!;
      expect(deprecatedTask).toBeDefined();
      expect(deprecatedTask.candidateId).toBe('maintenance-deprecated-pkg-legacy-package');
      expect(deprecatedTask.title).toBe('Replace Deprecated Package: legacy-package → modern-package');
      expect(deprecatedTask.description).toContain('Package legacy-package@1.0.0 is deprecated');
      expect(deprecatedTask.description).toContain('Recommended replacement: modern-package');
      expect(deprecatedTask.priority).toBe('normal');
      expect(deprecatedTask.score).toBe(0.6);

      // Check for package replacement suggestion
      const packageReplacement = deprecatedTask.remediationSuggestions!.find(s => s.type === 'package_replacement');
      expect(packageReplacement).toBeDefined();
      expect(packageReplacement!.command).toBe('npm uninstall legacy-package && npm install modern-package');
    });

    it('should integrate with priority system from task store patterns', () => {
      // Create a realistic mixed scenario
      const analysis = createMixedMaintenanceAnalysis({
        securityIssues: [
          createVulnerability({ name: 'auth-bypass', severity: 'critical', cveId: 'CVE-2024-AUTH1' }),
          createVulnerability({ name: 'xss-vuln', severity: 'high', cveId: 'CVE-2024-XSS1' }),
          createVulnerability({ name: 'info-leak', severity: 'medium', cveId: 'CVE-2024-LEAK1' }),
        ],
        outdatedPackages: [
          createOutdatedDependency({ name: 'react', currentVersion: '17.0.2', latestVersion: '18.3.1', updateType: 'major' }),
          createOutdatedDependency({ name: 'lodash', currentVersion: '4.17.20', latestVersion: '4.17.21', updateType: 'patch' }),
        ],
        deprecatedPackages: [
          createDeprecatedPackage({ name: 'request', currentVersion: '2.88.2', replacement: 'axios' }),
        ]
      });

      const candidates = analyzer.analyze(analysis);
      expect(candidates).toHaveLength(6);

      // Use analyzer's prioritize method to select the top candidate
      const topCandidate = analyzer.prioritize(candidates);
      expect(topCandidate).toBeDefined();
      expect(topCandidate!.score).toBe(1.0);
      expect(topCandidate!.priority).toBe('urgent');
      expect(topCandidate!.title).toContain('Critical');
      expect(topCandidate!.title).toContain('auth-bypass');

      // Verify the candidates follow the expected business prioritization logic
      const sortedCandidates = [...candidates].sort((a, b) => b.score - a.score);

      // 1. Critical security (score 1.0)
      expect(sortedCandidates[0].title).toContain('Critical');
      expect(sortedCandidates[0].score).toBe(1.0);

      // 2. High security (score 0.9)
      expect(sortedCandidates[1].title).toContain('High');
      expect(sortedCandidates[1].score).toBe(0.9);

      // 3. Major outdated dependency (score 0.8)
      expect(sortedCandidates[2].title).toContain('Major Update');
      expect(sortedCandidates[2].score).toBe(0.8);

      // 4. Medium security (score 0.7)
      expect(sortedCandidates[3].title).toContain('Medium');
      expect(sortedCandidates[3].score).toBe(0.7);

      // 5. Deprecated package with replacement (score 0.6)
      expect(sortedCandidates[4].title).toContain('Deprecated');
      expect(sortedCandidates[4].score).toBe(0.6);

      // 6. Patch update (score 0.4)
      expect(sortedCandidates[5].title).toContain('Patch Update');
      expect(sortedCandidates[5].score).toBe(0.4);
    });

    it('should handle legacy format fallback gracefully', () => {
      // Test with legacy format (string arrays instead of rich objects)
      const legacyAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 50,
          lines: 5000,
          languages: { javascript: 5000 }
        },
        testCoverage: undefined,
        dependencies: {
          outdated: ['old-dep@1.0.0', 'another-old@^0.5.0'], // Legacy format
          security: ['vuln-package@1.2.3'], // Legacy format
          securityIssues: [], // Rich format (empty)
          outdatedPackages: [], // Rich format (empty)
          deprecatedPackages: []
        },
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        },
        documentation: {
          coverage: 30,
          missingDocs: [],
          outdatedSections: [],
          apiCompleteness: {
            percentage: 50,
            details: {
              totalEndpoints: 10,
              documentedEndpoints: 5,
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

      const candidates = analyzer.analyze(legacyAnalysis);

      // Should handle legacy format and create appropriate tasks
      expect(candidates.length).toBeGreaterThan(0);

      // Should have legacy security task
      const securityTask = candidates.find(c => c.candidateId.includes('security-deps-legacy'));
      expect(securityTask).toBeDefined();
      expect(securityTask!.score).toBe(1.0);
      expect(securityTask!.priority).toBe('urgent');

      // Should have legacy outdated dependencies task
      const outdatedTask = candidates.find(c => c.candidateId.includes('outdated-deps'));
      expect(outdatedTask).toBeDefined();
      expect(outdatedTask!.priority).toBe('normal');

      // Should handle pre-1.0 dependencies separately
      const criticalOutdatedTask = candidates.find(c => c.candidateId.includes('critical-outdated-deps'));
      expect(criticalOutdatedTask).toBeDefined();
      expect(criticalOutdatedTask!.priority).toBe('high');
      expect(criticalOutdatedTask!.score).toBe(0.8);
    });
  });

  describe('Remediation Suggestions Quality', () => {
    it('should provide comprehensive remediation suggestions for all task types', () => {
      const analysis = createMixedMaintenanceAnalysis({
        securityIssues: [
          createVulnerability({ name: 'critical-pkg', severity: 'critical', cveId: 'CVE-2024-REAL' }),
        ],
        outdatedPackages: [
          createOutdatedDependency({ name: 'major-pkg', currentVersion: '1.0.0', latestVersion: '2.0.0', updateType: 'major' }),
        ],
        deprecatedPackages: [
          createDeprecatedPackage({ name: 'deprecated-pkg', currentVersion: '1.0.0', replacement: 'new-pkg' }),
        ]
      });

      const candidates = analyzer.analyze(analysis);

      // Every candidate should have remediation suggestions
      candidates.forEach(candidate => {
        expect(candidate.remediationSuggestions).toBeDefined();
        expect(candidate.remediationSuggestions!.length).toBeGreaterThan(0);

        // Each suggestion should have required fields
        candidate.remediationSuggestions!.forEach(suggestion => {
          expect(suggestion.type).toBeDefined();
          expect(suggestion.description).toBeDefined();
          expect(suggestion.priority).toBeDefined();
          expect(['critical', 'high', 'medium', 'low']).toContain(suggestion.priority);

          // Command-based suggestions should have commands
          if (['npm_update', 'yarn_upgrade', 'command', 'package_replacement'].includes(suggestion.type)) {
            expect(suggestion.command).toBeDefined();
            expect(suggestion.command).not.toBe('');
          }

          // Security advisories should have links
          if (suggestion.type === 'security_advisory') {
            expect(suggestion.link).toBeDefined();
            expect(suggestion.link).toContain('https://');
          }
        });
      });

      // Critical security should have manual review suggestion
      const criticalTask = candidates.find(c => c.score === 1.0)!;
      const manualReview = criticalTask.remediationSuggestions!.find(s => s.type === 'manual_review');
      expect(manualReview).toBeDefined();
      expect(manualReview!.warning).toContain('Critical vulnerabilities may require immediate mitigation');

      // Major update should have migration guide and testing suggestions
      const majorTask = candidates.find(c => c.title.includes('Major Update'))!;
      const migrationGuide = majorTask.remediationSuggestions!.find(s => s.type === 'migration_guide');
      expect(migrationGuide).toBeDefined();
      expect(migrationGuide!.warning).toContain('breaking changes');
    });
  });
});
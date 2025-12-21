/**
 * Integration Tests for MaintenanceAnalyzer Security Vulnerability Features
 *
 * Tests the enhanced MaintenanceAnalyzer with CVE pattern matching,
 * severity categorization, and rich vulnerability data processing.
 */

import { MaintenanceAnalyzer } from './maintenance-analyzer';
import type { ProjectAnalysis, SecurityVulnerability } from '../idle-processor';

describe('MaintenanceAnalyzer - Security Vulnerabilities', () => {
  let analyzer: MaintenanceAnalyzer;

  beforeEach(() => {
    analyzer = new MaintenanceAnalyzer();
  });

  // Helper function to create minimal ProjectAnalysis with security data
  function createAnalysisWithVulnerabilities(securityIssues: SecurityVulnerability[] = []): ProjectAnalysis {
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
        securityIssues
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

  // Helper function to create vulnerability object
  function createVulnerability(overrides: Partial<SecurityVulnerability> = {}): SecurityVulnerability {
    return {
      name: 'test-package',
      cveId: 'CVE-2024-12345',
      severity: 'medium',
      affectedVersions: '<1.0.0',
      description: 'Test security vulnerability',
      ...overrides
    };
  }

  describe('Critical Vulnerability Handling', () => {
    it('should generate urgent task for critical vulnerability', () => {
      const vulnerability = createVulnerability({
        name: 'log4j',
        cveId: 'CVE-2021-44228',
        severity: 'critical',
        affectedVersions: '<2.15.0',
        description: 'Remote code execution vulnerability'
      });

      const analysis = createAnalysisWithVulnerabilities([vulnerability]);
      const candidates = analyzer.analyze(analysis);

      const criticalTask = candidates.find(c => c.candidateId.includes('CVE-2021-44228'));

      expect(criticalTask).toBeDefined();
      expect(criticalTask?.priority).toBe('urgent');
      expect(criticalTask?.score).toBe(1.0);
      expect(criticalTask?.title).toContain('Critical');
      expect(criticalTask?.title).toContain('CVE-2021-44228');
      expect(criticalTask?.description).toContain('log4j');
      expect(criticalTask?.description).toContain('Remote code execution');
      expect(criticalTask?.rationale).toContain('immediate attention');
      expect(criticalTask?.effort).toBe('high'); // Critical vulnerabilities require high effort
    });

    it('should generate individual tasks for multiple critical vulnerabilities', () => {
      const vulnerabilities = [
        createVulnerability({
          name: 'log4j',
          cveId: 'CVE-2021-44228',
          severity: 'critical'
        }),
        createVulnerability({
          name: 'spring-core',
          cveId: 'CVE-2022-22965',
          severity: 'critical'
        })
      ];

      const analysis = createAnalysisWithVulnerabilities(vulnerabilities);
      const candidates = analyzer.analyze(analysis);

      const criticalTasks = candidates.filter(c => c.priority === 'urgent');
      expect(criticalTasks).toHaveLength(2);

      expect(criticalTasks[0].candidateId).toContain('CVE-2021-44228');
      expect(criticalTasks[1].candidateId).toContain('CVE-2022-22965');
    });
  });

  describe('High Severity Vulnerability Handling', () => {
    it('should generate individual task for single high severity vulnerability', () => {
      const vulnerability = createVulnerability({
        name: 'axios',
        cveId: 'CVE-2021-3749',
        severity: 'high',
        description: 'Regular expression denial of service'
      });

      const analysis = createAnalysisWithVulnerabilities([vulnerability]);
      const candidates = analyzer.analyze(analysis);

      const highTask = candidates.find(c => c.priority === 'high');

      expect(highTask).toBeDefined();
      expect(highTask?.title).toContain('High');
      expect(highTask?.title).toContain('CVE-2021-3749');
      expect(highTask?.description).toContain('axios');
      expect(highTask?.score).toBe(0.9);
      expect(highTask?.effort).toBe('medium');
    });

    it('should generate individual tasks for two high severity vulnerabilities', () => {
      const vulnerabilities = [
        createVulnerability({
          name: 'axios',
          cveId: 'CVE-2021-3749',
          severity: 'high'
        }),
        createVulnerability({
          name: 'lodash',
          cveId: 'CVE-2021-23337',
          severity: 'high'
        })
      ];

      const analysis = createAnalysisWithVulnerabilities(vulnerabilities);
      const candidates = analyzer.analyze(analysis);

      const highTasks = candidates.filter(c => c.priority === 'high');
      expect(highTasks).toHaveLength(2);
    });

    it('should generate grouped task for many high severity vulnerabilities', () => {
      const vulnerabilities = [
        createVulnerability({ name: 'pkg1', cveId: 'CVE-2021-1111', severity: 'high' }),
        createVulnerability({ name: 'pkg2', cveId: 'CVE-2021-2222', severity: 'high' }),
        createVulnerability({ name: 'pkg3', cveId: 'CVE-2021-3333', severity: 'high' })
      ];

      const analysis = createAnalysisWithVulnerabilities(vulnerabilities);
      const candidates = analyzer.analyze(analysis);

      const highTasks = candidates.filter(c => c.priority === 'high');
      expect(highTasks).toHaveLength(1); // Grouped task

      const groupTask = highTasks[0];
      expect(groupTask.title).toContain('3');
      expect(groupTask.title).toContain('High');
      expect(groupTask.candidateId).toBe('security-group-high');
      expect(groupTask.description).toContain('CVE-2021-1111, CVE-2021-2222, CVE-2021-3333');
    });
  });

  describe('Medium and Low Severity Vulnerability Handling', () => {
    it('should generate grouped task for medium vulnerabilities', () => {
      const vulnerabilities = [
        createVulnerability({ name: 'pkg1', cveId: 'CVE-2023-1111', severity: 'medium' }),
        createVulnerability({ name: 'pkg2', cveId: 'CVE-2023-2222', severity: 'medium' })
      ];

      const analysis = createAnalysisWithVulnerabilities(vulnerabilities);
      const candidates = analyzer.analyze(analysis);

      const mediumTasks = candidates.filter(c => c.priority === 'normal');
      expect(mediumTasks).toHaveLength(1);

      const groupTask = mediumTasks[0];
      expect(groupTask.title).toContain('2');
      expect(groupTask.title).toContain('Medium');
      expect(groupTask.candidateId).toBe('security-group-medium');
      expect(groupTask.score).toBe(0.7);
      expect(groupTask.effort).toBe('medium');
    });

    it('should generate grouped task for low vulnerabilities', () => {
      const vulnerabilities = [
        createVulnerability({ name: 'pkg1', cveId: 'CVE-2023-1111', severity: 'low' }),
        createVulnerability({ name: 'pkg2', cveId: 'CVE-2023-2222', severity: 'low' }),
        createVulnerability({ name: 'pkg3', cveId: 'CVE-2023-3333', severity: 'low' })
      ];

      const analysis = createAnalysisWithVulnerabilities(vulnerabilities);
      const candidates = analyzer.analyze(analysis);

      const lowTasks = candidates.filter(c => c.priority === 'low');
      expect(lowTasks).toHaveLength(1);

      const groupTask = lowTasks[0];
      expect(groupTask.title).toContain('3');
      expect(groupTask.title).toContain('Low');
      expect(groupTask.candidateId).toBe('security-group-low');
      expect(groupTask.score).toBe(0.4);
    });
  });

  describe('Mixed Severity Scenarios', () => {
    it('should handle mixed severity levels correctly', () => {
      const vulnerabilities = [
        createVulnerability({ name: 'critical-pkg', cveId: 'CVE-2024-0001', severity: 'critical' }),
        createVulnerability({ name: 'high-pkg1', cveId: 'CVE-2024-0002', severity: 'high' }),
        createVulnerability({ name: 'high-pkg2', cveId: 'CVE-2024-0003', severity: 'high' }),
        createVulnerability({ name: 'medium-pkg1', cveId: 'CVE-2024-0004', severity: 'medium' }),
        createVulnerability({ name: 'medium-pkg2', cveId: 'CVE-2024-0005', severity: 'medium' }),
        createVulnerability({ name: 'low-pkg', cveId: 'CVE-2024-0006', severity: 'low' })
      ];

      const analysis = createAnalysisWithVulnerabilities(vulnerabilities);
      const candidates = analyzer.analyze(analysis);

      // Should have: 1 critical (urgent), 2 high (individual), 1 medium (grouped), 1 low (grouped)
      expect(candidates.filter(c => c.priority === 'urgent')).toHaveLength(1);
      expect(candidates.filter(c => c.priority === 'high')).toHaveLength(2);
      expect(candidates.filter(c => c.priority === 'normal')).toHaveLength(1);
      expect(candidates.filter(c => c.priority === 'low')).toHaveLength(1);

      // Verify ordering by score (critical should be first)
      const sortedByScore = [...candidates].sort((a, b) => b.score - a.score);
      expect(sortedByScore[0].priority).toBe('urgent');
      expect(sortedByScore[0].score).toBe(1.0);
    });
  });

  describe('CVE Identifier Handling', () => {
    it('should handle vulnerabilities without CVE identifiers', () => {
      const vulnerability = createVulnerability({
        name: 'unknown-package',
        cveId: 'NO-CVE-UNKNOWN-PACKAGE-HIGH',
        severity: 'high',
        description: 'Unidentified security issue'
      });

      const analysis = createAnalysisWithVulnerabilities([vulnerability]);
      const candidates = analyzer.analyze(analysis);

      const task = candidates.find(c => c.priority === 'high');
      expect(task).toBeDefined();
      expect(task?.title).toContain('NO-CVE-UNKNOWN-PACKAGE-HIGH');
      expect(task?.rationale).not.toContain('publicly disclosed');
    });

    it('should handle vulnerabilities with actual CVE identifiers', () => {
      const vulnerability = createVulnerability({
        name: 'lodash',
        cveId: 'CVE-2021-23337',
        severity: 'high',
        description: 'Command injection vulnerability'
      });

      const analysis = createAnalysisWithVulnerabilities([vulnerability]);
      const candidates = analyzer.analyze(analysis);

      const task = candidates.find(c => c.priority === 'high');
      expect(task).toBeDefined();
      expect(task?.rationale).toContain('publicly disclosed');
      expect(task?.rationale).toContain('CVE-2021-23337');
    });

    it('should create URL-safe candidate IDs', () => {
      const vulnerability = createVulnerability({
        name: 'test-package',
        cveId: 'CVE-2021-44228',
        severity: 'critical'
      });

      const analysis = createAnalysisWithVulnerabilities([vulnerability]);
      const candidates = analyzer.analyze(analysis);

      const task = candidates.find(c => c.priority === 'urgent');
      expect(task).toBeDefined();
      expect(task?.candidateId).toBe('security-critical-CVE-2021-44228');
      expect(task?.candidateId).not.toContain(' ');
      expect(task?.candidateId).not.toContain('/');
    });
  });

  describe('Legacy Format Fallback', () => {
    it('should fall back to legacy format when securityIssues empty', () => {
      const analysis: ProjectAnalysis = {
        ...createAnalysisWithVulnerabilities([]),
        dependencies: {
          outdated: [],
          security: ['lodash@4.17.15 (CVE-2021-23337)', 'axios@0.21.0 (CVE-2021-3749)'],
          securityIssues: [] // Empty rich format
        }
      };

      const candidates = analyzer.analyze(analysis);

      const securityTask = candidates.find(c => c.candidateId === 'security-deps-legacy');
      expect(securityTask).toBeDefined();
      expect(securityTask?.title).toBe('Fix Security Vulnerabilities');
      expect(securityTask?.priority).toBe('urgent');
      expect(securityTask?.description).toContain('lodash@4.17.15');
      expect(securityTask?.description).toContain('axios@0.21.0');
    });

    it('should use rich format when available', () => {
      const vulnerability = createVulnerability({
        name: 'lodash',
        cveId: 'CVE-2021-23337',
        severity: 'high'
      });

      const analysis: ProjectAnalysis = {
        ...createAnalysisWithVulnerabilities([vulnerability]),
        dependencies: {
          outdated: [],
          security: ['lodash@4.17.15 (CVE-2021-23337)'], // Legacy format present
          securityIssues: [vulnerability] // But rich format also available
        }
      };

      const candidates = analyzer.analyze(analysis);

      // Should use rich format, not legacy
      expect(candidates.find(c => c.candidateId === 'security-deps-legacy')).toBeUndefined();
      expect(candidates.find(c => c.candidateId.includes('CVE-2021-23337'))).toBeDefined();
    });
  });

  describe('Task Description and Rationale Generation', () => {
    it('should build detailed security descriptions', () => {
      const vulnerability = createVulnerability({
        name: 'node-forge',
        cveId: 'CVE-2022-24771',
        severity: 'high',
        affectedVersions: '<1.0.0',
        description: 'Improper Verification of Cryptographic Signature'
      });

      const analysis = createAnalysisWithVulnerabilities([vulnerability]);
      const candidates = analyzer.analyze(analysis);

      const task = candidates.find(c => c.priority === 'high');
      expect(task).toBeDefined();
      expect(task?.description).toContain('High vulnerability in node-forge@<1.0.0');
      expect(task?.description).toContain('Improper Verification of Cryptographic Signature');
      expect(task?.description).toContain('CVE: CVE-2022-24771');
    });

    it('should build appropriate rationales for different severities', () => {
      const vulnerabilities = [
        createVulnerability({ severity: 'critical', cveId: 'CVE-2024-0001' }),
        createVulnerability({ severity: 'high', cveId: 'CVE-2024-0002' }),
        createVulnerability({ severity: 'medium', cveId: 'CVE-2024-0003' }),
        createVulnerability({ severity: 'low', cveId: 'CVE-2024-0004' })
      ];

      const analysis = createAnalysisWithVulnerabilities(vulnerabilities);
      const candidates = analyzer.analyze(analysis);

      const criticalTask = candidates.find(c => c.priority === 'urgent');
      const highTask = candidates.find(c => c.priority === 'high');
      const mediumTask = candidates.find(c => c.priority === 'normal');
      const lowTask = candidates.find(c => c.priority === 'low');

      expect(criticalTask?.rationale).toContain('immediate attention');
      expect(highTask?.rationale).toContain('significant security risks');
      expect(mediumTask?.rationale).toContain('addressed promptly');
      expect(lowTask?.rationale).toContain('security posture');
    });

    it('should handle group rationales correctly', () => {
      const vulnerabilities = [
        createVulnerability({ name: 'pkg1', cveId: 'CVE-2024-0001', severity: 'high' }),
        createVulnerability({ name: 'pkg2', cveId: 'CVE-2024-0002', severity: 'high' }),
        createVulnerability({ name: 'pkg3', cveId: 'NO-CVE-PKG3-HIGH', severity: 'high' })
      ];

      const analysis = createAnalysisWithVulnerabilities(vulnerabilities);
      const candidates = analyzer.analyze(analysis);

      const groupTask = candidates.find(c => c.candidateId === 'security-group-high');
      expect(groupTask).toBeDefined();
      expect(groupTask?.rationale).toContain('2 have public CVE identifiers'); // Only 2 have real CVEs
      expect(groupTask?.rationale).toContain('actively exploited');
    });
  });

  describe('Effort Estimation', () => {
    it('should assign high effort to critical vulnerabilities', () => {
      const vulnerability = createVulnerability({ severity: 'critical' });
      const analysis = createAnalysisWithVulnerabilities([vulnerability]);
      const candidates = analyzer.analyze(analysis);

      const task = candidates.find(c => c.priority === 'urgent');
      expect(task?.effort).toBe('high');
    });

    it('should assign medium effort to non-critical individual vulnerabilities', () => {
      const vulnerability = createVulnerability({ severity: 'high' });
      const analysis = createAnalysisWithVulnerabilities([vulnerability]);
      const candidates = analyzer.analyze(analysis);

      const task = candidates.find(c => c.priority === 'high');
      expect(task?.effort).toBe('medium');
    });

    it('should assign high effort to large groups of vulnerabilities', () => {
      const vulnerabilities = Array.from({ length: 6 }, (_, i) =>
        createVulnerability({
          name: `pkg${i + 1}`,
          cveId: `CVE-2024-000${i + 1}`,
          severity: 'medium'
        })
      );

      const analysis = createAnalysisWithVulnerabilities(vulnerabilities);
      const candidates = analyzer.analyze(analysis);

      const groupTask = candidates.find(c => c.candidateId === 'security-group-medium');
      expect(groupTask?.effort).toBe('high'); // >5 vulnerabilities
    });
  });

  describe('Integration with Outdated Dependencies', () => {
    it('should prioritize security over outdated dependencies', () => {
      const analysis: ProjectAnalysis = {
        ...createAnalysisWithVulnerabilities([createVulnerability({ severity: 'critical' })]),
        dependencies: {
          outdated: ['old-package@1.0.0', 'another-old@2.0.0'],
          security: [],
          securityIssues: [createVulnerability({ severity: 'critical' })]
        }
      };

      const candidates = analyzer.analyze(analysis);

      // Security should come first (score 1.0), then outdated (score 0.5)
      const sortedByScore = [...candidates].sort((a, b) => b.score - a.score);
      expect(sortedByScore[0].candidateId).toContain('security');
      expect(sortedByScore[0].score).toBe(1.0);

      const outdatedTask = candidates.find(c => c.candidateId === 'outdated-deps');
      expect(outdatedTask).toBeDefined();
      expect(outdatedTask?.score).toBe(0.5);
    });

    it('should handle projects with no security issues', () => {
      const analysis: ProjectAnalysis = {
        ...createAnalysisWithVulnerabilities([]),
        dependencies: {
          outdated: ['old-package@1.0.0'],
          security: [],
          securityIssues: []
        }
      };

      const candidates = analyzer.analyze(analysis);

      const securityTasks = candidates.filter(c => c.candidateId.includes('security'));
      const outdatedTasks = candidates.filter(c => c.candidateId.includes('outdated'));

      expect(securityTasks).toHaveLength(0);
      expect(outdatedTasks).toHaveLength(1);
    });
  });
});
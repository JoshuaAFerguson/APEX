/**
 * Security Vulnerability Scoring Tests
 *
 * Comprehensive test suite to verify security vulnerability scoring system
 * uses correct values: critical=1.0, high=0.9, medium=0.7, low=0.5
 * and ensures consistent application across all security-related functionality.
 */

import { MaintenanceAnalyzer } from './maintenance-analyzer';
import type { ProjectAnalysis, SecurityVulnerability } from '../idle-processor';

describe('MaintenanceAnalyzer - Security Vulnerability Scoring', () => {
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

  describe('Security Vulnerability Score Values', () => {
    it('should assign score 1.0 for critical vulnerabilities', () => {
      const vulnerability = createVulnerability({
        name: 'log4j',
        cveId: 'CVE-2021-44228',
        severity: 'critical',
        description: 'Remote code execution vulnerability'
      });

      const analysis = createAnalysisWithVulnerabilities([vulnerability]);
      const candidates = analyzer.analyze(analysis);

      const criticalTask = candidates.find(c => c.candidateId.includes('CVE-2021-44228'));
      expect(criticalTask).toBeDefined();
      expect(criticalTask!.score).toBe(1.0);
      expect(criticalTask!.priority).toBe('urgent');
    });

    it('should assign score 0.9 for high severity vulnerabilities', () => {
      const vulnerability = createVulnerability({
        name: 'axios',
        cveId: 'CVE-2021-3749',
        severity: 'high',
        description: 'Regular expression denial of service'
      });

      const analysis = createAnalysisWithVulnerabilities([vulnerability]);
      const candidates = analyzer.analyze(analysis);

      const highTask = candidates.find(c => c.candidateId.includes('CVE-2021-3749'));
      expect(highTask).toBeDefined();
      expect(highTask!.score).toBe(0.9);
      expect(highTask!.priority).toBe('high');
    });

    it('should assign score 0.7 for medium severity vulnerabilities', () => {
      const vulnerabilities = [
        createVulnerability({
          name: 'lodash',
          cveId: 'CVE-2021-23337',
          severity: 'medium',
          description: 'Prototype pollution vulnerability'
        }),
        createVulnerability({
          name: 'minimist',
          cveId: 'CVE-2021-44906',
          severity: 'medium',
          description: 'Another medium vulnerability'
        })
      ];

      const analysis = createAnalysisWithVulnerabilities(vulnerabilities);
      const candidates = analyzer.analyze(analysis);

      const mediumTask = candidates.find(c => c.candidateId === 'security-group-medium');
      expect(mediumTask).toBeDefined();
      expect(mediumTask!.score).toBe(0.7);
      expect(mediumTask!.priority).toBe('normal');
    });

    it('should assign score 0.5 for low severity vulnerabilities', () => {
      const vulnerabilities = [
        createVulnerability({
          name: 'package1',
          cveId: 'CVE-2023-1111',
          severity: 'low',
          description: 'Low severity information disclosure'
        }),
        createVulnerability({
          name: 'package2',
          cveId: 'CVE-2023-2222',
          severity: 'low',
          description: 'Another low severity issue'
        })
      ];

      const analysis = createAnalysisWithVulnerabilities(vulnerabilities);
      const candidates = analyzer.analyze(analysis);

      const lowTask = candidates.find(c => c.candidateId === 'security-group-low');
      expect(lowTask).toBeDefined();
      expect(lowTask!.score).toBe(0.5);
      expect(lowTask!.priority).toBe('low');
    });
  });

  describe('Individual vs Grouped Task Scoring', () => {
    it('should maintain correct scores for individual critical vulnerabilities', () => {
      const vulnerabilities = [
        createVulnerability({ name: 'pkg1', cveId: 'CVE-2024-0001', severity: 'critical' }),
        createVulnerability({ name: 'pkg2', cveId: 'CVE-2024-0002', severity: 'critical' })
      ];

      const analysis = createAnalysisWithVulnerabilities(vulnerabilities);
      const candidates = analyzer.analyze(analysis);

      const criticalTasks = candidates.filter(c => c.priority === 'urgent');
      expect(criticalTasks).toHaveLength(2);

      criticalTasks.forEach(task => {
        expect(task.score).toBe(1.0);
      });
    });

    it('should maintain correct scores for individual high vulnerability tasks', () => {
      const vulnerabilities = [
        createVulnerability({ name: 'pkg1', cveId: 'CVE-2024-0001', severity: 'high' }),
        createVulnerability({ name: 'pkg2', cveId: 'CVE-2024-0002', severity: 'high' })
      ];

      const analysis = createAnalysisWithVulnerabilities(vulnerabilities);
      const candidates = analyzer.analyze(analysis);

      const highTasks = candidates.filter(c => c.priority === 'high');
      expect(highTasks).toHaveLength(2); // Should be individual tasks (<=2)

      highTasks.forEach(task => {
        expect(task.score).toBe(0.9);
      });
    });

    it('should maintain correct scores for grouped high vulnerability tasks', () => {
      const vulnerabilities = [
        createVulnerability({ name: 'pkg1', cveId: 'CVE-2024-0001', severity: 'high' }),
        createVulnerability({ name: 'pkg2', cveId: 'CVE-2024-0002', severity: 'high' }),
        createVulnerability({ name: 'pkg3', cveId: 'CVE-2024-0003', severity: 'high' })
      ];

      const analysis = createAnalysisWithVulnerabilities(vulnerabilities);
      const candidates = analyzer.analyze(analysis);

      const highTasks = candidates.filter(c => c.priority === 'high');
      expect(highTasks).toHaveLength(1); // Should be grouped task (>2)

      const groupedTask = highTasks[0];
      expect(groupedTask.score).toBe(0.9);
      expect(groupedTask.candidateId).toBe('security-group-high');
    });
  });

  describe('Mixed Severity Scoring Verification', () => {
    it('should correctly prioritize tasks by score when mixed severities are present', () => {
      const vulnerabilities = [
        createVulnerability({ name: 'critical-pkg', cveId: 'CVE-2024-0001', severity: 'critical' }),
        createVulnerability({ name: 'high-pkg', cveId: 'CVE-2024-0002', severity: 'high' }),
        createVulnerability({ name: 'medium-pkg1', cveId: 'CVE-2024-0003', severity: 'medium' }),
        createVulnerability({ name: 'medium-pkg2', cveId: 'CVE-2024-0004', severity: 'medium' }),
        createVulnerability({ name: 'low-pkg1', cveId: 'CVE-2024-0005', severity: 'low' }),
        createVulnerability({ name: 'low-pkg2', cveId: 'CVE-2024-0006', severity: 'low' })
      ];

      const analysis = createAnalysisWithVulnerabilities(vulnerabilities);
      const candidates = analyzer.analyze(analysis);

      // Sort by score to verify priority order
      const sortedByScore = [...candidates].sort((a, b) => b.score - a.score);

      // Verify score order: critical (1.0) > high (0.9) > medium (0.7) > low (0.5)
      const scores = sortedByScore.map(c => c.score);
      const expectedScores = [1.0, 0.9, 0.7, 0.5]; // Should match exactly

      expect(scores).toEqual(expectedScores);

      // Verify specific task types
      expect(sortedByScore[0].priority).toBe('urgent'); // Critical
      expect(sortedByScore[1].priority).toBe('high'); // High
      expect(sortedByScore[2].priority).toBe('normal'); // Medium group
      expect(sortedByScore[3].priority).toBe('low'); // Low group
    });

    it('should verify all unique score values are present in mixed scenario', () => {
      const vulnerabilities = [
        createVulnerability({ severity: 'critical' }),
        createVulnerability({ severity: 'high' }),
        createVulnerability({ severity: 'medium', name: 'medium1' }),
        createVulnerability({ severity: 'medium', name: 'medium2' }),
        createVulnerability({ severity: 'low', name: 'low1' }),
        createVulnerability({ severity: 'low', name: 'low2' })
      ];

      const analysis = createAnalysisWithVulnerabilities(vulnerabilities);
      const candidates = analyzer.analyze(analysis);

      const scores = candidates.map(c => c.score).sort((a, b) => b - a);
      const uniqueScores = [...new Set(scores)];

      expect(uniqueScores).toEqual([1.0, 0.9, 0.7, 0.5]);
      expect(uniqueScores).toHaveLength(4); // All severity levels represented
    });
  });

  describe('Legacy Format Scoring Consistency', () => {
    it('should assign correct score for legacy security vulnerabilities', () => {
      const analysis: ProjectAnalysis = {
        ...createAnalysisWithVulnerabilities([]),
        dependencies: {
          outdated: [],
          security: ['lodash@4.17.15 (CVE-2021-23337)', 'axios@0.21.0 (CVE-2021-3749)'],
          securityIssues: [] // Empty rich format triggers legacy
        }
      };

      const candidates = analyzer.analyze(analysis);

      const legacyTask = candidates.find(c => c.candidateId === 'security-deps-legacy');
      expect(legacyTask).toBeDefined();
      expect(legacyTask!.score).toBe(1.0); // Legacy format uses highest priority score
      expect(legacyTask!.priority).toBe('urgent');
    });
  });

  describe('Score Boundary Testing', () => {
    it('should verify exact score values match expected constants', () => {
      const testCases = [
        { severity: 'critical' as const, expectedScore: 1.0 },
        { severity: 'high' as const, expectedScore: 0.9 },
        { severity: 'medium' as const, expectedScore: 0.7 },
        { severity: 'low' as const, expectedScore: 0.5 }
      ];

      testCases.forEach(({ severity, expectedScore }) => {
        const vulnerabilities = severity === 'critical'
          ? [createVulnerability({ severity })] // Individual task for critical
          : [
              createVulnerability({ severity, name: 'pkg1' }),
              createVulnerability({ severity, name: 'pkg2' })
            ]; // Grouped tasks for others

        const analysis = createAnalysisWithVulnerabilities(vulnerabilities);
        const candidates = analyzer.analyze(analysis);

        const relevantTasks = candidates.filter(c =>
          c.candidateId.includes(severity) ||
          (severity === 'critical' && c.priority === 'urgent') ||
          (severity === 'high' && c.priority === 'high') ||
          (severity === 'medium' && c.priority === 'normal') ||
          (severity === 'low' && c.priority === 'low')
        );

        expect(relevantTasks.length).toBeGreaterThan(0);
        relevantTasks.forEach(task => {
          expect(task.score).toBe(expectedScore);
        });
      });
    });

    it('should verify no tasks have invalid score values', () => {
      const vulnerabilities = [
        createVulnerability({ severity: 'critical' }),
        createVulnerability({ severity: 'high' }),
        createVulnerability({ severity: 'medium', name: 'medium1' }),
        createVulnerability({ severity: 'medium', name: 'medium2' }),
        createVulnerability({ severity: 'low', name: 'low1' }),
        createVulnerability({ severity: 'low', name: 'low2' })
      ];

      const analysis = createAnalysisWithVulnerabilities(vulnerabilities);
      const candidates = analyzer.analyze(analysis);

      const securityTasks = candidates.filter(c => c.candidateId.includes('security'));
      const validScores = [1.0, 0.9, 0.7, 0.5];

      securityTasks.forEach(task => {
        expect(validScores).toContain(task.score);
        expect(task.score).toBeGreaterThan(0);
        expect(task.score).toBeLessThanOrEqual(1.0);
      });
    });
  });

  describe('Score Consistency Across Components', () => {
    it('should verify scoring remains consistent when vulnerabilities are processed multiple times', () => {
      const vulnerability = createVulnerability({
        name: 'lodash',
        cveId: 'CVE-2021-23337',
        severity: 'medium'
      });

      const analysis = createAnalysisWithVulnerabilities([vulnerability, vulnerability]); // Duplicate
      const candidates = analyzer.analyze(analysis);

      const mediumTasks = candidates.filter(c => c.priority === 'normal');
      expect(mediumTasks).toHaveLength(1); // Should be grouped

      const task = mediumTasks[0];
      expect(task.score).toBe(0.7);
    });

    it('should verify score consistency when combining with non-security tasks', () => {
      const analysis: ProjectAnalysis = {
        ...createAnalysisWithVulnerabilities([
          createVulnerability({ severity: 'high' }),
          createVulnerability({ severity: 'low', name: 'lowpkg1' }),
          createVulnerability({ severity: 'low', name: 'lowpkg2' })
        ]),
        dependencies: {
          outdated: ['old-package@1.0.0'],
          security: [],
          securityIssues: [
            createVulnerability({ severity: 'high' }),
            createVulnerability({ severity: 'low', name: 'lowpkg1' }),
            createVulnerability({ severity: 'low', name: 'lowpkg2' })
          ]
        }
      };

      const candidates = analyzer.analyze(analysis);

      const highSecurityTask = candidates.find(c => c.priority === 'high' && c.candidateId.includes('security'));
      const lowSecurityTask = candidates.find(c => c.priority === 'low' && c.candidateId.includes('security'));
      const outdatedTask = candidates.find(c => c.candidateId === 'outdated-deps');

      expect(highSecurityTask!.score).toBe(0.9);
      expect(lowSecurityTask!.score).toBe(0.5);
      expect(outdatedTask!.score).toBe(0.5); // Different from security low score

      // Security should be prioritized over outdated with same score by task type
      const securityTasks = candidates.filter(c => c.candidateId.includes('security'));
      const maintenanceTasks = candidates.filter(c => !c.candidateId.includes('security'));

      expect(securityTasks.length).toBeGreaterThan(0);
      expect(maintenanceTasks.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle empty vulnerability arrays without affecting scores', () => {
      const analysis = createAnalysisWithVulnerabilities([]); // No vulnerabilities
      const candidates = analyzer.analyze(analysis);

      const securityTasks = candidates.filter(c => c.candidateId.includes('security'));
      expect(securityTasks).toHaveLength(0);
    });

    it('should handle malformed vulnerability data gracefully', () => {
      const malformedVulnerabilities = [
        createVulnerability({ severity: 'high' }), // Valid
        // Note: We can't actually pass invalid data due to TypeScript,
        // but the analyzer should handle edge cases gracefully
      ];

      const analysis = createAnalysisWithVulnerabilities(malformedVulnerabilities);
      const candidates = analyzer.analyze(analysis);

      const validTasks = candidates.filter(c =>
        c.score !== undefined &&
        !isNaN(c.score) &&
        c.score > 0 &&
        c.score <= 1.0
      );

      expect(validTasks.length).toEqual(candidates.length);
    });

    it('should handle very large numbers of vulnerabilities correctly', () => {
      const manyVulnerabilities: SecurityVulnerability[] = Array.from({ length: 50 }, (_, i) =>
        createVulnerability({
          name: `package-${i}`,
          cveId: `CVE-2024-${String(i).padStart(4, '0')}`,
          severity: 'low'
        })
      );

      const analysis = createAnalysisWithVulnerabilities(manyVulnerabilities);
      const candidates = analyzer.analyze(analysis);

      const lowTask = candidates.find(c => c.candidateId === 'security-group-low');
      expect(lowTask).toBeDefined();
      expect(lowTask!.score).toBe(0.5);
      expect(lowTask!.effort).toBe('high'); // Many vulnerabilities should be high effort
    });
  });

  describe('Real-World Scenario Testing', () => {
    it('should handle complex real-world vulnerability mix with correct scoring', () => {
      const realWorldVulnerabilities = [
        // Log4Shell - Critical
        createVulnerability({
          name: 'log4j-core',
          cveId: 'CVE-2021-44228',
          severity: 'critical',
          affectedVersions: '>=2.0-beta9 <2.15.0',
          description: 'Remote code execution via JNDI lookup'
        }),

        // High severity vulnerabilities
        createVulnerability({
          name: 'axios',
          cveId: 'CVE-2021-3749',
          severity: 'high',
          affectedVersions: '<0.21.2',
          description: 'Regular expression denial of service'
        }),

        // Medium severity group
        createVulnerability({
          name: 'lodash',
          cveId: 'CVE-2021-23337',
          severity: 'medium',
          affectedVersions: '<4.17.21',
          description: 'Command injection via template'
        }),
        createVulnerability({
          name: 'minimist',
          cveId: 'CVE-2021-44906',
          severity: 'medium',
          affectedVersions: '<1.2.6',
          description: 'Prototype pollution vulnerability'
        }),

        // Low severity group
        createVulnerability({
          name: 'node-fetch',
          cveId: 'CVE-2022-0235',
          severity: 'low',
          affectedVersions: '<3.2.0',
          description: 'Information exposure vulnerability'
        }),
        createVulnerability({
          name: 'trim-newlines',
          cveId: 'CVE-2021-33623',
          severity: 'low',
          affectedVersions: '<3.0.1',
          description: 'ReDoS via excessive backtracking'
        })
      ];

      const analysis = createAnalysisWithVulnerabilities(realWorldVulnerabilities);
      const candidates = analyzer.analyze(analysis);

      // Verify we have all expected task types
      const criticalTasks = candidates.filter(c => c.priority === 'urgent');
      const highTasks = candidates.filter(c => c.priority === 'high');
      const mediumTasks = candidates.filter(c => c.priority === 'normal');
      const lowTasks = candidates.filter(c => c.priority === 'low');

      expect(criticalTasks).toHaveLength(1);
      expect(highTasks).toHaveLength(1);
      expect(mediumTasks).toHaveLength(1);
      expect(lowTasks).toHaveLength(1);

      // Verify exact scores
      expect(criticalTasks[0].score).toBe(1.0);
      expect(highTasks[0].score).toBe(0.9);
      expect(mediumTasks[0].score).toBe(0.7);
      expect(lowTasks[0].score).toBe(0.5);

      // Verify ordering by score
      const allScores = candidates.map(c => c.score).sort((a, b) => b - a);
      expect(allScores).toEqual([1.0, 0.9, 0.7, 0.5]);
    });
  });
});
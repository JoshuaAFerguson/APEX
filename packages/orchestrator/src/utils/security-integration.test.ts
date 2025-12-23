/**
 * Integration Tests for Security Vulnerability Detection Feature
 *
 * Tests the complete workflow from CVE pattern matching through severity
 * categorization to MaintenanceAnalyzer task generation.
 */

import { SecurityVulnerabilityParser } from './security-vulnerability-parser';
import { MaintenanceAnalyzer } from '../analyzers/maintenance-analyzer';
import type { ProjectAnalysis, SecurityVulnerability } from '../idle-processor';

describe('Security Vulnerability Detection Integration', () => {
  let analyzer: MaintenanceAnalyzer;

  beforeEach(() => {
    analyzer = new MaintenanceAnalyzer();
  });

  describe('End-to-End CVE Detection and Task Generation', () => {
    it('should detect CVEs, categorize severity, and create appropriate tasks', () => {
      // Simulate npm audit output with various CVE formats
      const npmAuditOutput = {
        vulnerabilities: {
          'lodash': {
            name: 'lodash',
            severity: 'high',
            via: [{
              title: 'Command Injection in lodash',
              url: 'https://github.com/advisories/GHSA-jf85-cpcp-j695',
              cvss: { score: 7.2 },
              severity: 'high',
              range: '<4.17.21'
            }],
            range: '<4.17.21'
          },
          'axios': {
            name: 'axios',
            severity: 'moderate',
            via: [{
              title: 'Regular expression denial of service',
              url: 'https://nvd.nist.gov/vuln/detail/CVE-2021-3749',
              cvss: { score: 5.4 },
              severity: 'moderate'
            }]
          }
        }
      };

      // Parse vulnerabilities
      const vulnerabilities = SecurityVulnerabilityParser.parseNpmAuditOutput(npmAuditOutput);

      expect(vulnerabilities).toHaveLength(2);
      expect(vulnerabilities[0].name).toBe('lodash');
      expect(vulnerabilities[0].severity).toBe('high');
      expect(vulnerabilities[1].name).toBe('axios');
      expect(vulnerabilities[1].cveId).toBe('CVE-2021-3749');
      expect(vulnerabilities[1].severity).toBe('medium');

      // Create analysis with parsed vulnerabilities
      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 100, lines: 10000, languages: { typescript: 10000 } },
        testCoverage: undefined,
        dependencies: {
          outdated: [],
          security: [],
          securityIssues: vulnerabilities
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

      // Generate tasks
      const candidates = analyzer.analyze(analysis);

      // Should have individual tasks for both high-severity vulnerabilities
      const highTasks = candidates.filter(c => c.priority === 'high');
      const mediumTasks = candidates.filter(c => c.priority === 'normal');

      expect(highTasks).toHaveLength(1); // lodash
      expect(mediumTasks).toHaveLength(1); // axios (grouped as medium)

      expect(highTasks[0].title).toContain('lodash');
      expect(mediumTasks[0].title).toContain('axios');
    });

    it('should handle mixed real-world CVE formats', () => {
      const testTexts = [
        'Found CVE-2021-44228 in log4j-core',
        'Security issues: CVE-2023-12345 and CVE-2024-000001 detected',
        'https://nvd.nist.gov/vuln/detail/CVE-2022-98765',
        'GHSA-cfm4-qjh2-4765 (not a CVE)',
        'cve-2021-23337 (lowercase)',
        'Mixed content with CVE-2020-1234 and some other text'
      ];

      const extractedCves = testTexts.flatMap(text =>
        SecurityVulnerabilityParser.extractCVEs(text)
      );

      const expectedCves = [
        'CVE-2021-44228',
        'CVE-2023-12345',
        'CVE-2024-000001',
        'CVE-2022-98765',
        'CVE-2021-23337',
        'CVE-2020-1234'
      ];

      expect(extractedCves).toEqual(expectedCves);

      // Verify each CVE is valid
      extractedCves.forEach(cve => {
        expect(SecurityVulnerabilityParser.isValidCVE(cve)).toBe(true);
      });
    });

    it('should properly categorize CVSS scores to severity levels', () => {
      const testScores = [
        { score: 10.0, expected: 'critical' },
        { score: 9.5, expected: 'critical' },
        { score: 9.0, expected: 'critical' },
        { score: 8.9, expected: 'high' },
        { score: 7.5, expected: 'high' },
        { score: 7.0, expected: 'high' },
        { score: 6.9, expected: 'medium' },
        { score: 5.0, expected: 'medium' },
        { score: 4.0, expected: 'medium' },
        { score: 3.9, expected: 'low' },
        { score: 2.0, expected: 'low' },
        { score: 0.1, expected: 'low' },
        { score: 0.0, expected: 'low' }
      ];

      testScores.forEach(({ score, expected }) => {
        const severity = SecurityVulnerabilityParser.severityFromCVSS(score);
        expect(severity).toBe(expected);
      });
    });

    it('should create urgency-based tasks for critical vulnerabilities', () => {
      const criticalVuln: SecurityVulnerability = {
        name: 'log4j-core',
        cveId: 'CVE-2021-44228',
        severity: 'critical',
        affectedVersions: '<2.15.0',
        description: 'Remote code execution via JNDI LDAP lookup'
      };

      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 50, lines: 5000, languages: { java: 5000 } },
        testCoverage: undefined,
        dependencies: {
          outdated: [],
          security: [],
          securityIssues: [criticalVuln]
        },
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        },
        documentation: {
          coverage: 70,
          missingDocs: [],
          outdatedSections: [],
          apiCompleteness: {
            percentage: 80,
            details: {
              totalEndpoints: 10,
              documentedEndpoints: 8,
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

      const candidates = analyzer.analyze(analysis);
      const urgentTask = candidates.find(c => c.priority === 'urgent');

      expect(urgentTask).toBeDefined();
      expect(urgentTask?.score).toBe(1.0);
      expect(urgentTask?.effort).toBe('high');
      expect(urgentTask?.title).toContain('Critical');
      expect(urgentTask?.title).toContain('CVE-2021-44228');
      expect(urgentTask?.description).toContain('Remote code execution');
      expect(urgentTask?.rationale).toContain('immediate attention');
    });

    it('should validate vulnerability objects thoroughly', () => {
      const validVuln: SecurityVulnerability = {
        name: 'test-package',
        cveId: 'CVE-2024-12345',
        severity: 'high',
        affectedVersions: '<1.0.0',
        description: 'Test vulnerability'
      };

      const invalidVulns = [
        { ...validVuln, name: '' }, // Empty name
        { ...validVuln, severity: 'invalid' as any }, // Invalid severity
        { ...validVuln, cveId: '', description: '', affectedVersions: '' }, // Empty required fields
        null,
        undefined,
        {}
      ];

      expect(SecurityVulnerabilityParser.isValidVulnerability(validVuln)).toBe(true);

      invalidVulns.forEach(vuln => {
        expect(SecurityVulnerabilityParser.isValidVulnerability(vuln as any)).toBe(false);
      });
    });
  });

  describe('CVSS Score Parsing Edge Cases', () => {
    it('should handle complex nested CVSS objects', () => {
      const complexObjects = [
        { cvss: { score: 9.8, vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' } },
        { cvssV3: { baseScore: 7.5, temporalScore: 6.8 } },
        { score: 5.0, cvss: { score: 8.0 } }, // Should use higher score
        { cvss_score: 6.5 },
        'CVSS: 9.0 (Critical)',
        'Base Score: 7.5',
        15.0, // Should cap at 10.0
        -1.0, // Should return null
        'invalid-score'
      ];

      const expectedResults = [9.8, 7.5, 8.0, 6.5, 9.0, 7.5, 10.0, null, null];

      complexObjects.forEach((obj, index) => {
        const result = SecurityVulnerabilityParser.parseCVSSScore(obj);
        expect(result).toBe(expectedResults[index]);
      });
    });

    it('should handle malformed npm audit data gracefully', () => {
      const malformedData = [
        {}, // Empty object
        { vulnerabilities: null },
        { vulnerabilities: {} }, // Empty vulnerabilities
        {
          vulnerabilities: {
            'broken-package': {
              name: 'broken-package',
              // Missing severity and via
            }
          }
        }
      ];

      malformedData.forEach(data => {
        expect(() => {
          const result = SecurityVulnerabilityParser.parseNpmAuditOutput(data);
          expect(Array.isArray(result)).toBe(true);
        }).not.toThrow();
      });
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should efficiently process large numbers of vulnerabilities', () => {
      // Create 100 test vulnerabilities
      const vulnerabilities: SecurityVulnerability[] = Array.from({ length: 100 }, (_, i) => ({
        name: `package-${i}`,
        cveId: `CVE-2024-${String(i).padStart(5, '0')}`,
        severity: (['critical', 'high', 'medium', 'low'] as const)[i % 4],
        affectedVersions: '<1.0.0',
        description: `Test vulnerability ${i}`
      }));

      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 1000, lines: 100000, languages: { typescript: 100000 } },
        testCoverage: undefined,
        dependencies: {
          outdated: [],
          security: [],
          securityIssues: vulnerabilities
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

      const startTime = Date.now();
      const candidates = analyzer.analyze(analysis);
      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second

      // Should create appropriate task structure
      const criticalCount = candidates.filter(c => c.priority === 'urgent').length;
      const highCount = candidates.filter(c => c.priority === 'high').length;
      const mediumCount = candidates.filter(c => c.priority === 'normal').length;
      const lowCount = candidates.filter(c => c.priority === 'low').length;

      // Based on our test data: 25 each of critical, high, medium, low
      expect(criticalCount).toBe(25); // Individual critical tasks
      expect(highCount).toBe(1); // Grouped high tasks (>2 high vulns)
      expect(mediumCount).toBe(1); // Grouped medium tasks
      expect(lowCount).toBe(1); // Grouped low tasks
    });
  });
});
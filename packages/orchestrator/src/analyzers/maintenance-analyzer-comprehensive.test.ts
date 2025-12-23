/**
 * Comprehensive Tests for MaintenanceAnalyzer Security Vulnerability Features
 *
 * This file supplements existing tests with additional edge cases, error scenarios,
 * and integration tests to ensure complete coverage of CVE pattern matching,
 * severity categorization, and CVSS score handling.
 */

import { MaintenanceAnalyzer } from './maintenance-analyzer';
import { SecurityVulnerabilityParser } from '../utils/security-vulnerability-parser';
import type { ProjectAnalysis, SecurityVulnerability, VulnerabilitySeverity } from '../idle-processor';

describe('MaintenanceAnalyzer - Comprehensive Security Tests', () => {
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

  describe('CVE Format Validation Edge Cases', () => {
    it('should handle various CVE formats correctly', () => {
      const testCases = [
        'CVE-2024-0001',     // Minimum valid sequence
        'CVE-2024-000001',   // Extended sequence with leading zeros
        'CVE-1999-9999',     // Old year format
        'CVE-2030-123456',   // Future year with long sequence
        'CVE-2024-99999999', // Very long sequence
      ];

      testCases.forEach(cveId => {
        expect(SecurityVulnerabilityParser.isValidCVE(cveId)).toBe(true);

        // Test that it can be parsed
        const parsed = SecurityVulnerabilityParser.parseCVE(cveId);
        expect(parsed).not.toBeNull();
        expect(parsed?.id).toBe(cveId);
      });
    });

    it('should reject invalid CVE formats', () => {
      const invalidCases = [
        'CVE-24-1234',       // Year too short
        'CVE-2024-123',      // Sequence too short
        'CVE-2024-ABC',      // Non-numeric sequence
        'CVE-ABCD-1234',     // Non-numeric year
        'INVALID-2024-1234', // Wrong prefix
        'CVE 2024 1234',     // Wrong separators
        'CVE-2024-',         // Missing sequence
        'CVE--1234',         // Missing year
        '',                  // Empty string
        'CVE-2024-1234-EXTRA', // Extra parts
      ];

      invalidCases.forEach(cveId => {
        expect(SecurityVulnerabilityParser.isValidCVE(cveId)).toBe(false);
      });
    });

    it('should extract CVEs from complex text scenarios', () => {
      const testTexts = [
        'Security alert: CVE-2021-44228 affects log4j versions',
        'Multiple issues: CVE-2021-44228, CVE-2023-12345, and CVE-2024-56789',
        'URL: https://nvd.nist.gov/vuln/detail/CVE-2021-44228',
        'Found vulnerability cve-2021-44228 in dependency',
        'Mixed case: Cve-2021-44228 and CVE-2023-ABCD (invalid)',
        'Text with CVE-2024-000001 embedded in sentence.',
        'JSON: {"cve": "CVE-2021-44228", "severity": "critical"}',
        'No vulnerabilities in this text',
        '',
      ];

      const expectedResults = [
        ['CVE-2021-44228'],
        ['CVE-2021-44228', 'CVE-2023-12345', 'CVE-2024-56789'],
        ['CVE-2021-44228'],
        ['CVE-2021-44228'],
        ['CVE-2021-44228'], // Only valid one
        ['CVE-2024-000001'],
        ['CVE-2021-44228'],
        [],
        [],
      ];

      testTexts.forEach((text, index) => {
        const result = SecurityVulnerabilityParser.extractCVEs(text);
        expect(result).toEqual(expectedResults[index]);
      });
    });
  });

  describe('CVSS Score Edge Cases and Complex Scenarios', () => {
    it('should handle various CVSS input formats', () => {
      const testCases = [
        { input: 9.8, expected: 9.8 },
        { input: '9.8', expected: 9.8 },
        { input: 'CVSS: 9.8', expected: 9.8 },
        { input: 'cvss: 7.5', expected: 7.5 },
        { input: 'CVSS Score: 5.4', expected: 5.4 },
        { input: { score: 8.1 }, expected: 8.1 },
        { input: { cvss: { score: 6.7 } }, expected: 6.7 },
        { input: { cvssV3: { baseScore: 9.1 } }, expected: 9.1 },
        { input: 'score: 4.2', expected: 4.2 },
        { input: '"score": 7.8', expected: 7.8 },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = SecurityVulnerabilityParser.parseCVSSScore(input);
        expect(result).toBe(expected);
      });
    });

    it('should handle boundary CVSS scores correctly', () => {
      const boundaries = [
        { score: 0.0, expectedSeverity: 'low' },
        { score: 0.1, expectedSeverity: 'low' },
        { score: 3.9, expectedSeverity: 'low' },
        { score: 4.0, expectedSeverity: 'medium' },
        { score: 6.9, expectedSeverity: 'medium' },
        { score: 7.0, expectedSeverity: 'high' },
        { score: 8.9, expectedSeverity: 'high' },
        { score: 9.0, expectedSeverity: 'critical' },
        { score: 10.0, expectedSeverity: 'critical' },
      ];

      boundaries.forEach(({ score, expectedSeverity }) => {
        const severity = SecurityVulnerabilityParser.severityFromCVSS(score);
        expect(severity).toBe(expectedSeverity);
      });
    });

    it('should handle invalid CVSS inputs gracefully', () => {
      const invalidInputs = [
        null, undefined, NaN, Infinity, -Infinity,
        'not a number', '', {}, [], 'CVSS: invalid',
        { invalidKey: 9.8 }, { cvss: 'invalid' }
      ];

      invalidInputs.forEach(input => {
        const result = SecurityVulnerabilityParser.parseCVSSScore(input);
        expect(result).toBe(null);
      });
    });

    it('should handle out-of-range CVSS scores', () => {
      const outOfRangeCases = [
        { input: -1.0, expected: null },
        { input: -5.5, expected: null },
        { input: 11.0, expected: 10.0 },
        { input: 15.8, expected: 10.0 },
        { input: 100.0, expected: 10.0 },
      ];

      outOfRangeCases.forEach(({ input, expected }) => {
        const result = SecurityVulnerabilityParser.parseCVSSScore(input);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Severity Label Parsing Edge Cases', () => {
    it('should handle various severity label formats', () => {
      const testCases = [
        { input: 'critical', expected: 'critical' },
        { input: 'CRITICAL', expected: 'critical' },
        { input: 'Critical', expected: 'critical' },
        { input: '  critical  ', expected: 'critical' },
        { input: '\tcritical\n', expected: 'critical' },
        { input: 'high', expected: 'high' },
        { input: 'medium', expected: 'medium' },
        { input: 'moderate', expected: 'medium' },
        { input: 'low', expected: 'low' },
        { input: 'info', expected: 'low' },
        { input: 'informational', expected: 'low' },
        { input: 'none', expected: 'low' },
        { input: 'unknown', expected: 'low' },
        { input: 'invalid-severity', expected: 'low' },
        { input: '', expected: 'low' },
        { input: null, expected: 'low' },
        { input: undefined, expected: 'low' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = SecurityVulnerabilityParser.parseSeverityLabel(input as any);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Complex Vulnerability Scenarios', () => {
    it('should handle vulnerability with special characters in package name', () => {
      const vulnerability = createVulnerability({
        name: '@scope/package-with-dashes_and_underscores.js',
        cveId: 'CVE-2024-12345',
        severity: 'high',
        description: 'Vulnerability in scoped package with special characters'
      });

      const analysis = createAnalysisWithVulnerabilities([vulnerability]);
      const candidates = analyzer.analyze(analysis);

      const task = candidates.find(c => c.priority === 'high');
      expect(task).toBeDefined();
      expect(task?.description).toContain('@scope/package-with-dashes_and_underscores.js');
      expect(task?.candidateId).toContain('CVE-2024-12345');
    });

    it('should handle vulnerability with very long description', () => {
      const longDescription = 'A very long vulnerability description that goes into extensive detail about the security issue, ' +
        'including technical details about the attack vector, potential impact, and mitigation strategies. '.repeat(10);

      const vulnerability = createVulnerability({
        name: 'vulnerable-package',
        cveId: 'CVE-2024-67890',
        severity: 'critical',
        description: longDescription
      });

      const analysis = createAnalysisWithVulnerabilities([vulnerability]);
      const candidates = analyzer.analyze(analysis);

      const task = candidates.find(c => c.priority === 'urgent');
      expect(task).toBeDefined();
      expect(task?.description).toContain(longDescription);
      expect(task?.description.length).toBeGreaterThan(1000);
    });

    it('should handle vulnerability with non-standard CVE format', () => {
      const vulnerability = createVulnerability({
        name: 'legacy-package',
        cveId: 'ADVISORY-2024-001-SPECIAL',
        severity: 'medium',
        description: 'Non-standard vulnerability identifier'
      });

      const analysis = createAnalysisWithVulnerabilities([vulnerability]);
      const candidates = analyzer.analyze(analysis);

      const task = candidates.find(c => c.candidateId.includes('ADVISORY-2024-001-SPECIAL'));
      expect(task).toBeDefined();
      expect(task?.title).toContain('ADVISORY-2024-001-SPECIAL');
      expect(task?.rationale).not.toContain('publicly disclosed'); // Should not treat as real CVE
    });
  });

  describe('Large Scale Vulnerability Management', () => {
    it('should handle very large number of vulnerabilities efficiently', () => {
      const vulnerabilities: SecurityVulnerability[] = [];
      const severities: VulnerabilitySeverity[] = ['critical', 'high', 'medium', 'low'];

      // Create 100 vulnerabilities with mixed severities
      for (let i = 0; i < 100; i++) {
        const severity = severities[i % severities.length];
        vulnerabilities.push(createVulnerability({
          name: `package-${i}`,
          cveId: `CVE-2024-${String(i).padStart(5, '0')}`,
          severity,
          description: `Vulnerability ${i} with ${severity} severity`
        }));
      }

      const analysis = createAnalysisWithVulnerabilities(vulnerabilities);
      const startTime = Date.now();
      const candidates = analyzer.analyze(analysis);
      const endTime = Date.now();

      // Performance check - should complete quickly
      expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second

      // Should group appropriately
      const criticalTasks = candidates.filter(c => c.priority === 'urgent');
      const highTasks = candidates.filter(c => c.priority === 'high');
      const mediumTasks = candidates.filter(c => c.priority === 'normal');
      const lowTasks = candidates.filter(c => c.priority === 'low');

      expect(criticalTasks.length).toBe(25); // 25 individual critical tasks
      expect(highTasks.length).toBe(1); // 25 high grouped into 1 task (>2)
      expect(mediumTasks.length).toBe(1); // 25 medium grouped into 1 task
      expect(lowTasks.length).toBe(1); // 25 low grouped into 1 task
    });

    it('should handle mixed vulnerability sources correctly', () => {
      const mixedVulnerabilities: SecurityVulnerability[] = [
        // Real CVEs
        createVulnerability({
          name: 'lodash',
          cveId: 'CVE-2021-23337',
          severity: 'high',
          description: 'Command injection in template'
        }),
        createVulnerability({
          name: 'axios',
          cveId: 'CVE-2023-45857',
          severity: 'medium',
          description: 'CSRF vulnerability'
        }),
        // Advisory IDs
        createVulnerability({
          name: 'node-forge',
          cveId: 'GHSA-cfm4-qjh2-4765',
          severity: 'high',
          description: 'GitHub Security Advisory'
        }),
        // No CVE
        createVulnerability({
          name: 'custom-lib',
          cveId: 'NO-CVE-CUSTOM-LIB-HIGH',
          severity: 'high',
          description: 'Internal security issue'
        }),
      ];

      const analysis = createAnalysisWithVulnerabilities(mixedVulnerabilities);
      const candidates = analyzer.analyze(analysis);

      expect(candidates).toHaveLength(1); // 3 high vulnerabilities grouped (>2)
      const groupTask = candidates[0];
      expect(groupTask.candidateId).toBe('security-group-high');
      expect(groupTask.description).toContain('CVE-2021-23337');
      expect(groupTask.description).toContain('GHSA-cfm4-qjh2-4765');
      expect(groupTask.description).toContain('NO-CVE-CUSTOM-LIB-HIGH');

      // Rationale should mention some have CVEs
      expect(groupTask.rationale).toContain('have public CVE identifiers');
    });
  });

  describe('SecurityVulnerabilityParser Integration', () => {
    it('should work correctly with SecurityVulnerabilityParser.createVulnerability', () => {
      const createdVuln = SecurityVulnerabilityParser.createVulnerability({
        name: 'test-package',
        severity: 'critical',
        description: 'Test vulnerability created by parser'
      });

      expect(SecurityVulnerabilityParser.isValidVulnerability(createdVuln)).toBe(true);

      const analysis = createAnalysisWithVulnerabilities([createdVuln]);
      const candidates = analyzer.analyze(analysis);

      const task = candidates.find(c => c.priority === 'urgent');
      expect(task).toBeDefined();
      expect(task?.effort).toBe('high'); // Critical should have high effort
    });

    it('should handle parser-generated fallback CVE IDs', () => {
      const vulnWithoutCVE = SecurityVulnerabilityParser.createVulnerability({
        name: 'unknown-package'
      });

      expect(vulnWithoutCVE.cveId).toBe('NO-CVE-UNKNOWN-PACKAGE');
      expect(vulnWithoutCVE.severity).toBe('low'); // Default severity

      const analysis = createAnalysisWithVulnerabilities([vulnWithoutCVE]);
      const candidates = analyzer.analyze(analysis);

      const task = candidates.find(c => c.candidateId.includes('NO-CVE-UNKNOWN-PACKAGE'));
      expect(task).toBeDefined();
      expect(task?.rationale).not.toContain('publicly disclosed');
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle malformed vulnerability data gracefully', () => {
      // These would normally be caught by TypeScript, but test runtime resilience
      const malformedVulns = [
        { ...createVulnerability(), name: '' } as SecurityVulnerability,
        { ...createVulnerability(), severity: 'invalid' as VulnerabilitySeverity },
        { ...createVulnerability(), cveId: '' },
      ];

      // Filter out invalid vulnerabilities before passing to analyzer
      const validVulns = malformedVulns.filter(v =>
        SecurityVulnerabilityParser.isValidVulnerability(v)
      );

      const analysis = createAnalysisWithVulnerabilities(validVulns);
      const candidates = analyzer.analyze(analysis);

      // Should handle gracefully without crashing
      expect(Array.isArray(candidates)).toBe(true);
    });

    it('should handle empty and null vulnerability arrays', () => {
      const testCases = [
        createAnalysisWithVulnerabilities([]),
        createAnalysisWithVulnerabilities(undefined as any),
        {
          ...createAnalysisWithVulnerabilities([]),
          dependencies: { ...createAnalysisWithVulnerabilities([]).dependencies, securityIssues: null as any }
        }
      ];

      testCases.forEach(analysis => {
        expect(() => {
          const candidates = analyzer.analyze(analysis);
          expect(Array.isArray(candidates)).toBe(true);
        }).not.toThrow();
      });
    });
  });

  describe('Priority and Scoring Validation', () => {
    it('should maintain correct score ordering across all severity levels', () => {
      const vulnerabilities = [
        createVulnerability({ severity: 'low', cveId: 'CVE-2024-0001' }),
        createVulnerability({ severity: 'medium', cveId: 'CVE-2024-0002' }),
        createVulnerability({ severity: 'high', cveId: 'CVE-2024-0003' }),
        createVulnerability({ severity: 'critical', cveId: 'CVE-2024-0004' }),
      ];

      const analysis = createAnalysisWithVulnerabilities(vulnerabilities);
      const candidates = analyzer.analyze(analysis);

      // Sort by score to verify ordering
      const sortedCandidates = candidates.sort((a, b) => b.score - a.score);

      expect(sortedCandidates[0].score).toBe(1.0);   // Critical
      expect(sortedCandidates[1].score).toBe(0.9);   // High
      expect(sortedCandidates[2].score).toBe(0.7);   // Medium (grouped)
      expect(sortedCandidates[3].score).toBe(0.5);   // Low (grouped)

      // Verify priorities
      expect(sortedCandidates[0].priority).toBe('urgent');
      expect(sortedCandidates[1].priority).toBe('high');
      expect(sortedCandidates[2].priority).toBe('normal');
      expect(sortedCandidates[3].priority).toBe('low');
    });

    it('should assign effort levels correctly based on severity and count', () => {
      const singleCritical = createVulnerability({ severity: 'critical' });
      const singleHigh = createVulnerability({ severity: 'high' });
      const manyMedium = Array.from({ length: 10 }, (_, i) =>
        createVulnerability({
          severity: 'medium',
          cveId: `CVE-2024-${String(i).padStart(4, '0')}`
        })
      );

      const analysis = createAnalysisWithVulnerabilities([singleCritical, singleHigh, ...manyMedium]);
      const candidates = analyzer.analyze(analysis);

      const criticalTask = candidates.find(c => c.priority === 'urgent');
      const highTask = candidates.find(c => c.priority === 'high');
      const mediumGroupTask = candidates.find(c => c.priority === 'normal');

      expect(criticalTask?.effort).toBe('high');   // Critical always high effort
      expect(highTask?.effort).toBe('medium');     // Individual high is medium effort
      expect(mediumGroupTask?.effort).toBe('high'); // >5 vulnerabilities is high effort
    });
  });
});
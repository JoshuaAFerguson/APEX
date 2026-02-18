import { describe, it, expect, beforeEach } from 'vitest';
import { SecretScanner, type SecretPattern } from './scanner';

describe('SecretScanner Severity Levels', () => {
  let scanner: SecretScanner;

  beforeEach(() => {
    scanner = new SecretScanner();
  });

  describe('severity level validation', () => {
    it('should only contain valid severity levels in all patterns', () => {
      const patterns = scanner.getPatterns();
      const validSeverities = ['critical', 'high', 'medium', 'low'];

      patterns.forEach(pattern => {
        expect(validSeverities).toContain(pattern.severity);
        expect(pattern.severity).toBeDefined();
      });
    });

    it('should have appropriate severity distribution', () => {
      const patterns = scanner.getPatterns();
      const severityCounts = patterns.reduce((acc, pattern) => {
        acc[pattern.severity] = (acc[pattern.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Ensure we have patterns across different severity levels
      expect(Object.keys(severityCounts)).toContain('high');
      expect(Object.keys(severityCounts)).toContain('medium');
      expect(Object.keys(severityCounts).length).toBeGreaterThanOrEqual(2);
    });

    it('should include severity in findings', () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'test-severity-pattern',
          regex: /TEST_SEVERITY_PATTERN_\w+/g,
          secretType: 'test-severity',
          confidence: 0.9,
          severity: 'critical',
          description: 'Test pattern for severity validation',
        }],
        includeBuiltInPatterns: false,
      });

      const content = 'value=TEST_SEVERITY_PATTERN_12345';
      const findings = testScanner.scan(content, 'test.txt');

      expect(findings).toHaveLength(1);
      expect(findings[0]).toHaveProperty('severity', 'critical');
    });
  });

  describe('pattern severity assignments', () => {
    it('should assign critical severity to private key patterns', () => {
      const patterns = scanner.getPatterns();
      const privateKeyPatterns = patterns.filter(p => p.name === 'private-key');

      expect(privateKeyPatterns.length).toBeGreaterThan(0);
      privateKeyPatterns.forEach(pattern => {
        expect(pattern.severity).toBe('critical');
      });
    });

    it('should assign high severity to AWS key patterns', () => {
      const patterns = scanner.getPatterns();
      const awsKeyPatterns = patterns.filter(p =>
        p.name === 'aws-access-key' || p.name === 'aws-secret-key'
      );

      expect(awsKeyPatterns.length).toBeGreaterThan(0);
      awsKeyPatterns.forEach(pattern => {
        expect(pattern.severity).toBe('high');
      });
    });

    it('should assign high severity to GitHub token patterns', () => {
      const patterns = scanner.getPatterns();
      const githubPatterns = patterns.filter(p =>
        p.name === 'github-token' || p.name === 'github-classic-token'
      );

      expect(githubPatterns.length).toBeGreaterThan(0);
      githubPatterns.forEach(pattern => {
        expect(pattern.severity).toBe('high');
      });
    });

    it('should assign high severity to password patterns', () => {
      const patterns = scanner.getPatterns();
      const passwordPatterns = patterns.filter(p => p.name === 'password-field');

      expect(passwordPatterns.length).toBeGreaterThan(0);
      passwordPatterns.forEach(pattern => {
        expect(pattern.severity).toBe('high');
      });
    });

    it('should assign high severity to database connection patterns', () => {
      const patterns = scanner.getPatterns();
      const dbPatterns = patterns.filter(p => p.name === 'database-url');

      expect(dbPatterns.length).toBeGreaterThan(0);
      dbPatterns.forEach(pattern => {
        expect(pattern.severity).toBe('high');
      });
    });

    it('should assign medium severity to API key patterns', () => {
      const patterns = scanner.getPatterns();
      const apiKeyPatterns = patterns.filter(p => p.name === 'generic-api-key');

      expect(apiKeyPatterns.length).toBeGreaterThan(0);
      apiKeyPatterns.forEach(pattern => {
        expect(pattern.severity).toBe('medium');
      });
    });

    it('should assign medium severity to JWT token patterns', () => {
      const patterns = scanner.getPatterns();
      const jwtPatterns = patterns.filter(p => p.name === 'jwt-token');

      expect(jwtPatterns.length).toBeGreaterThan(0);
      jwtPatterns.forEach(pattern => {
        expect(pattern.severity).toBe('medium');
      });
    });
  });

  describe('severity consistency', () => {
    it('should maintain severity when adding custom patterns', () => {
      const customPattern: SecretPattern = {
        name: 'custom-critical-pattern',
        regex: /CUSTOM_CRITICAL_\w+/g,
        secretType: 'custom-critical',
        confidence: 0.95,
        severity: 'critical',
        description: 'Custom critical pattern for testing',
      };

      scanner.addPattern(customPattern);
      const patterns = scanner.getPatterns();
      const addedPattern = patterns.find(p => p.name === 'custom-critical-pattern');

      expect(addedPattern).toBeDefined();
      expect(addedPattern?.severity).toBe('critical');
    });

    it('should preserve severity in scan results', () => {
      const testScanner = new SecretScanner({
        customPatterns: [
          {
            name: 'low-severity-test',
            regex: /LOW_SEVERITY_TEST_\w+/g,
            secretType: 'low-test',
            confidence: 0.5,
            severity: 'low',
            description: 'Low severity test pattern',
          },
          {
            name: 'high-severity-test',
            regex: /HIGH_SEVERITY_TEST_\w+/g,
            secretType: 'high-test',
            confidence: 0.9,
            severity: 'high',
            description: 'High severity test pattern',
          }
        ],
        includeBuiltInPatterns: false,
      });

      const content = `
        config1=LOW_SEVERITY_TEST_12345
        config2=HIGH_SEVERITY_TEST_67890
      `;
      const findings = testScanner.scan(content, 'test.txt');

      expect(findings).toHaveLength(2);

      const lowSeverityFinding = findings.find(f => f.secretType === 'low-test');
      const highSeverityFinding = findings.find(f => f.secretType === 'high-test');

      expect(lowSeverityFinding?.severity).toBe('low');
      expect(highSeverityFinding?.severity).toBe('high');
    });
  });

  describe('acceptance criteria validation', () => {
    it('should have all required pattern types with correct severities', () => {
      const patterns = scanner.getPatterns();
      const patternMap = new Map(patterns.map(p => [p.name, p]));

      // AWS keys (high)
      expect(patternMap.get('aws-access-key')?.severity).toBe('high');
      expect(patternMap.get('aws-secret-key')?.severity).toBe('high');

      // GitHub tokens (high)
      expect(patternMap.get('github-token')?.severity).toBe('high');
      expect(patternMap.get('github-classic-token')?.severity).toBe('high');

      // Generic API keys (medium)
      expect(patternMap.get('generic-api-key')?.severity).toBe('medium');

      // Passwords in config (high)
      expect(patternMap.get('password-field')?.severity).toBe('high');

      // Private keys (critical)
      expect(patternMap.get('private-key')?.severity).toBe('critical');

      // JWT tokens (medium)
      expect(patternMap.get('jwt-token')?.severity).toBe('medium');

      // Connection strings (high)
      expect(patternMap.get('database-url')?.severity).toBe('high');
    });

    it('should have well-tested patterns with appropriate confidence levels', () => {
      const patterns = scanner.getPatterns();

      patterns.forEach(pattern => {
        // All patterns should have reasonable confidence levels
        expect(pattern.confidence).toBeGreaterThan(0);
        expect(pattern.confidence).toBeLessThanOrEqual(1);

        // Critical severity patterns should have high confidence
        if (pattern.severity === 'critical') {
          expect(pattern.confidence).toBeGreaterThanOrEqual(0.9);
        }

        // High severity patterns should have decent confidence
        if (pattern.severity === 'high') {
          expect(pattern.confidence).toBeGreaterThanOrEqual(0.7);
        }
      });
    });
  });
});
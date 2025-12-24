import { TestingAntiPattern, TestAnalysis } from '../types';

describe('TestingAntiPattern Type', () => {
  describe('type validation', () => {
    test('should accept existing anti-pattern types', () => {
      const existingPatterns: TestingAntiPattern['type'][] = [
        'brittle-test',
        'test-pollution',
        'mystery-guest',
        'eager-test',
        'assertion-roulette',
        'slow-test',
        'flaky-test',
        'test-code-duplication'
      ];

      existingPatterns.forEach(type => {
        const antiPattern: TestingAntiPattern = {
          file: 'test/example.test.ts',
          line: 1,
          type,
          description: `Test for ${type}`,
          severity: 'medium'
        };

        expect(antiPattern.type).toBe(type);
      });
    });

    test('should accept new anti-pattern types', () => {
      const newPatterns: TestingAntiPattern['type'][] = [
        'no-assertion',
        'commented-out',
        'console-only',
        'empty-test',
        'hardcoded-timeout'
      ];

      newPatterns.forEach(type => {
        const antiPattern: TestingAntiPattern = {
          file: 'test/example.test.ts',
          line: 1,
          type,
          description: `Test for ${type}`,
          severity: 'medium'
        };

        expect(antiPattern.type).toBe(type);
      });
    });

    test('should accept all severity levels', () => {
      const severities: TestingAntiPattern['severity'][] = ['low', 'medium', 'high'];

      severities.forEach(severity => {
        const antiPattern: TestingAntiPattern = {
          file: 'test/example.test.ts',
          line: 1,
          type: 'no-assertion',
          description: 'Test with no assertions',
          severity
        };

        expect(antiPattern.severity).toBe(severity);
      });
    });
  });

  describe('complete TestingAntiPattern objects', () => {
    test('should create valid no-assertion anti-pattern', () => {
      const antiPattern: TestingAntiPattern = {
        file: 'src/components/Button.test.tsx',
        line: 45,
        type: 'no-assertion',
        description: 'Test function contains no assertions, making it ineffective',
        severity: 'high',
        suggestion: 'Add expect() assertions to verify the expected behavior'
      };

      expect(antiPattern.file).toBe('src/components/Button.test.tsx');
      expect(antiPattern.line).toBe(45);
      expect(antiPattern.type).toBe('no-assertion');
      expect(antiPattern.description).toContain('no assertions');
      expect(antiPattern.severity).toBe('high');
      expect(antiPattern.suggestion).toBeDefined();
    });

    test('should create valid commented-out anti-pattern', () => {
      const antiPattern: TestingAntiPattern = {
        file: 'src/utils/helper.test.ts',
        line: 12,
        type: 'commented-out',
        description: 'Test is commented out, reducing coverage and confidence',
        severity: 'medium',
        suggestion: 'Either fix and uncomment the test or remove it entirely'
      };

      expect(antiPattern.type).toBe('commented-out');
      expect(antiPattern.description).toContain('commented out');
      expect(antiPattern.severity).toBe('medium');
    });

    test('should create valid console-only anti-pattern', () => {
      const antiPattern: TestingAntiPattern = {
        file: 'src/api/auth.test.js',
        line: 78,
        type: 'console-only',
        description: 'Test only contains console.log statements without assertions',
        severity: 'high',
        suggestion: 'Replace console.log with proper assertions using expect()'
      };

      expect(antiPattern.type).toBe('console-only');
      expect(antiPattern.description).toContain('console.log');
      expect(antiPattern.severity).toBe('high');
    });

    test('should create valid empty-test anti-pattern', () => {
      const antiPattern: TestingAntiPattern = {
        file: 'src/models/User.test.ts',
        line: 23,
        type: 'empty-test',
        description: 'Test function is empty or contains only comments',
        severity: 'high',
        suggestion: 'Implement the test logic or remove the empty test'
      };

      expect(antiPattern.type).toBe('empty-test');
      expect(antiPattern.description).toContain('empty');
      expect(antiPattern.severity).toBe('high');
    });

    test('should create valid hardcoded-timeout anti-pattern', () => {
      const antiPattern: TestingAntiPattern = {
        file: 'src/integration/api.test.ts',
        line: 67,
        type: 'hardcoded-timeout',
        description: 'Test uses hardcoded timeouts that may cause flaky behavior',
        severity: 'medium',
        suggestion: 'Use dynamic timeouts or proper async/await patterns'
      };

      expect(antiPattern.type).toBe('hardcoded-timeout');
      expect(antiPattern.description).toContain('hardcoded timeout');
      expect(antiPattern.severity).toBe('medium');
    });
  });

  describe('optional suggestion field', () => {
    test('should work without suggestion field', () => {
      const antiPattern: TestingAntiPattern = {
        file: 'test/basic.test.ts',
        line: 1,
        type: 'flaky-test',
        description: 'Test fails intermittently',
        severity: 'high'
      };

      expect(antiPattern.suggestion).toBeUndefined();
      expect(antiPattern.type).toBe('flaky-test');
    });

    test('should work with suggestion field', () => {
      const antiPattern: TestingAntiPattern = {
        file: 'test/basic.test.ts',
        line: 1,
        type: 'slow-test',
        description: 'Test takes too long to execute',
        severity: 'medium',
        suggestion: 'Optimize test by mocking external dependencies'
      };

      expect(antiPattern.suggestion).toBe('Optimize test by mocking external dependencies');
      expect(antiPattern.type).toBe('slow-test');
    });
  });

  describe('integration with TestAnalysis', () => {
    test('should work within TestAnalysis structure', () => {
      const antiPatterns: TestingAntiPattern[] = [
        {
          file: 'src/components/Button.test.tsx',
          line: 45,
          type: 'no-assertion',
          description: 'Test function contains no assertions',
          severity: 'high'
        },
        {
          file: 'src/utils/helper.test.ts',
          line: 12,
          type: 'commented-out',
          description: 'Test is commented out',
          severity: 'medium'
        },
        {
          file: 'src/api/auth.test.js',
          line: 78,
          type: 'console-only',
          description: 'Test only contains console.log statements',
          severity: 'high'
        },
        {
          file: 'src/models/User.test.ts',
          line: 23,
          type: 'empty-test',
          description: 'Test function is empty',
          severity: 'high'
        },
        {
          file: 'src/integration/api.test.ts',
          line: 67,
          type: 'hardcoded-timeout',
          description: 'Test uses hardcoded timeouts',
          severity: 'medium'
        }
      ];

      const testAnalysis: TestAnalysis = {
        branchCoverage: {
          percentage: 75,
          uncoveredBranches: []
        },
        untestedExports: [],
        missingIntegrationTests: [],
        antiPatterns
      };

      expect(testAnalysis.antiPatterns).toHaveLength(5);
      expect(testAnalysis.antiPatterns.map(p => p.type)).toEqual([
        'no-assertion',
        'commented-out',
        'console-only',
        'empty-test',
        'hardcoded-timeout'
      ]);
    });
  });

  describe('type coverage', () => {
    test('should include all 13 expected anti-pattern types', () => {
      const allTypes: TestingAntiPattern['type'][] = [
        // Original types
        'brittle-test',
        'test-pollution',
        'mystery-guest',
        'eager-test',
        'assertion-roulette',
        'slow-test',
        'flaky-test',
        'test-code-duplication',
        // New types
        'no-assertion',
        'commented-out',
        'console-only',
        'empty-test',
        'hardcoded-timeout'
      ];

      // Test that we can create objects with each type
      allTypes.forEach(type => {
        const antiPattern: TestingAntiPattern = {
          file: `test/${type}.test.ts`,
          line: 1,
          type,
          description: `Example of ${type}`,
          severity: 'medium'
        };

        expect(antiPattern.type).toBe(type);
      });

      // Verify we have exactly 13 types
      expect(allTypes).toHaveLength(13);
    });
  });

  describe('real-world scenarios', () => {
    test('should handle realistic no-assertion test scenario', () => {
      const antiPattern: TestingAntiPattern = {
        file: 'src/components/LoginForm.test.tsx',
        line: 89,
        type: 'no-assertion',
        description: 'Test "should handle user login" renders component but contains no assertions to verify behavior',
        severity: 'high',
        suggestion: 'Add assertions to verify form submission, validation, or user feedback'
      };

      expect(antiPattern.type).toBe('no-assertion');
      expect(antiPattern.file).toMatch(/LoginForm\.test\.tsx$/);
      expect(antiPattern.line).toBe(89);
    });

    test('should handle realistic commented-out test scenario', () => {
      const antiPattern: TestingAntiPattern = {
        file: 'src/services/payment.test.ts',
        line: 156,
        type: 'commented-out',
        description: 'Test "should process refund" is commented out, likely due to flaky behavior or API changes',
        severity: 'medium',
        suggestion: 'Investigate why test was commented out and either fix or remove permanently'
      };

      expect(antiPattern.type).toBe('commented-out');
      expect(antiPattern.description).toContain('commented out');
    });

    test('should handle realistic console-only test scenario', () => {
      const antiPattern: TestingAntiPattern = {
        file: 'src/utils/logger.test.ts',
        line: 34,
        type: 'console-only',
        description: 'Test "should log error messages" only contains console.log without verifying logging behavior',
        severity: 'high',
        suggestion: 'Mock the logger and assert that expected methods are called with correct parameters'
      };

      expect(antiPattern.type).toBe('console-only');
      expect(antiPattern.suggestion).toContain('Mock');
    });

    test('should handle realistic empty-test scenario', () => {
      const antiPattern: TestingAntiPattern = {
        file: 'src/components/Dashboard.test.tsx',
        line: 203,
        type: 'empty-test',
        description: 'Test "should handle data refresh" contains only a TODO comment with no implementation',
        severity: 'high',
        suggestion: 'Implement test logic to verify data refresh functionality or remove placeholder test'
      };

      expect(antiPattern.type).toBe('empty-test');
      expect(antiPattern.description).toContain('TODO');
    });

    test('should handle realistic hardcoded-timeout scenario', () => {
      const antiPattern: TestingAntiPattern = {
        file: 'src/integration/database.test.ts',
        line: 445,
        type: 'hardcoded-timeout',
        description: 'Test uses setTimeout(5000) which may not be sufficient in slower CI environments',
        severity: 'medium',
        suggestion: 'Use waitFor() or increase timeout dynamically based on environment'
      };

      expect(antiPattern.type).toBe('hardcoded-timeout');
      expect(antiPattern.description).toContain('setTimeout');
      expect(antiPattern.suggestion).toContain('waitFor');
    });
  });
});
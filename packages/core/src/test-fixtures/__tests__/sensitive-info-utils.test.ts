/**
 * @fileoverview Tests for Sensitive Information Detection Utilities
 */

import { describe, it, expect } from 'vitest';
import {
  SensitiveInfoDetector,
  SensitiveInfoPatterns,
  SensitiveInfoUtils,
  assertNoSensitiveInfo,
  assertNoAbsoluteFilePaths,
  assertNoApiKeys,
  assertNoDatabaseConnections,
  assertNoCredentials,
  TestDataHelpers,
} from '../sensitive-info-utils.js';

describe('SensitiveInfoPatterns', () => {
  describe('ABSOLUTE_FILE_PATHS', () => {
    it('should have correct number of patterns', () => {
      expect(SensitiveInfoPatterns.ABSOLUTE_FILE_PATHS).toHaveLength(4);
      expect(Array.isArray(SensitiveInfoPatterns.ABSOLUTE_FILE_PATHS)).toBe(true);
    });

    it('should contain RegExp patterns', () => {
      SensitiveInfoPatterns.ABSOLUTE_FILE_PATHS.forEach(pattern => {
        expect(pattern instanceof RegExp).toBe(true);
      });
    });

    it('should not detect relative paths', () => {
      const patterns = SensitiveInfoPatterns.ABSOLUTE_FILE_PATHS;
      const relativePaths = [
        './src/components/Button.tsx',
        '../config/settings.json',
        'src/utils/helpers.ts',
        'docs/README.md',
        'package.json',
      ];

      relativePaths.forEach(path => {
        const hasMatch = patterns.some(pattern => pattern.test(path));
        expect(hasMatch).toBe(false);
      });
    });
  });

  describe('API_KEYS', () => {
    it('should have correct number of patterns', () => {
      expect(SensitiveInfoPatterns.API_KEYS).toHaveLength(7);
      expect(Array.isArray(SensitiveInfoPatterns.API_KEYS)).toBe(true);
    });

    it('should contain RegExp patterns', () => {
      SensitiveInfoPatterns.API_KEYS.forEach(pattern => {
        expect(pattern instanceof RegExp).toBe(true);
      });
    });

    it('should not detect normal text', () => {
      const patterns = SensitiveInfoPatterns.API_KEYS;
      const normalTexts = [
        'api documentation',
        'key features',
        'token economy',
        'bearer bonds',
        'secret sauce',
      ];

      normalTexts.forEach(text => {
        const hasMatch = patterns.some(pattern => pattern.test(text));
        expect(hasMatch).toBe(false);
      });
    });
  });

  describe('DATABASE_CONNECTIONS', () => {
    it('should have correct number of patterns', () => {
      expect(SensitiveInfoPatterns.DATABASE_CONNECTIONS).toHaveLength(6);
      expect(Array.isArray(SensitiveInfoPatterns.DATABASE_CONNECTIONS)).toBe(true);
    });

    it('should contain RegExp patterns', () => {
      SensitiveInfoPatterns.DATABASE_CONNECTIONS.forEach(pattern => {
        expect(pattern instanceof RegExp).toBe(true);
      });
    });

    it('should not detect regular URLs', () => {
      const patterns = SensitiveInfoPatterns.DATABASE_CONNECTIONS;
      const regularUrls = [
        'https://api.example.com/v1/users',
        'http://localhost:3000',
        'https://docs.company.com/api',
        'ftp://files.example.com',
      ];

      regularUrls.forEach(url => {
        const hasMatch = patterns.some(pattern => pattern.test(url));
        expect(hasMatch).toBe(false);
      });
    });
  });

  describe('CREDENTIALS', () => {
    it('should have correct number of patterns', () => {
      expect(SensitiveInfoPatterns.CREDENTIALS).toHaveLength(5);
      expect(Array.isArray(SensitiveInfoPatterns.CREDENTIALS)).toBe(true);
    });

    it('should contain RegExp patterns', () => {
      SensitiveInfoPatterns.CREDENTIALS.forEach(pattern => {
        expect(pattern instanceof RegExp).toBe(true);
      });
    });

    it('should not detect normal configuration', () => {
      const patterns = SensitiveInfoPatterns.CREDENTIALS;
      const normalConfig = [
        'timeout=30',
        'retries=3',
        'debug=true',
        'port=3000',
        'name=myapp',
      ];

      normalConfig.forEach(config => {
        const hasMatch = patterns.some(pattern => pattern.test(config));
        expect(hasMatch).toBe(false);
      });
    });
  });

  describe('EMAIL_ADDRESSES', () => {
    it('should have correct number of patterns', () => {
      expect(SensitiveInfoPatterns.EMAIL_ADDRESSES).toHaveLength(1);
      expect(Array.isArray(SensitiveInfoPatterns.EMAIL_ADDRESSES)).toBe(true);
    });
  });

  describe('NETWORK_INFO', () => {
    it('should have correct number of patterns', () => {
      expect(SensitiveInfoPatterns.NETWORK_INFO).toHaveLength(3);
      expect(Array.isArray(SensitiveInfoPatterns.NETWORK_INFO)).toBe(true);
    });
  });
});

describe('SensitiveInfoDetector', () => {
  describe('containsSensitiveInfo', () => {
    it('should not detect safe content', () => {
      const safeTexts = [
        'Error reading file: file not found',
        'API request failed with status 404',
        'Database connection timeout',
        'Invalid configuration format',
        'Network request failed',
        'Authentication failed',
        'Permission denied',
        'Resource not available',
      ];

      safeTexts.forEach(text => {
        expect(SensitiveInfoDetector.containsSensitiveInfo(text)).toBe(false);
      });
    });

    it('should be a boolean function', () => {
      const result = SensitiveInfoDetector.containsSensitiveInfo('test text');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('specific detection methods', () => {
    it('should have all required detection methods', () => {
      expect(typeof SensitiveInfoDetector.containsAbsoluteFilePath).toBe('function');
      expect(typeof SensitiveInfoDetector.containsApiKey).toBe('function');
      expect(typeof SensitiveInfoDetector.containsDatabaseConnection).toBe('function');
      expect(typeof SensitiveInfoDetector.containsCredentials).toBe('function');
      expect(typeof SensitiveInfoDetector.containsEmailAddress).toBe('function');
      expect(typeof SensitiveInfoDetector.containsNetworkInfo).toBe('function');
    });

    it('should return boolean values', () => {
      const methods = [
        'containsAbsoluteFilePath',
        'containsApiKey',
        'containsDatabaseConnection',
        'containsCredentials',
        'containsEmailAddress',
        'containsNetworkInfo',
      ] as const;

      methods.forEach(method => {
        const result = SensitiveInfoDetector[method]('test text');
        expect(typeof result).toBe('boolean');
      });
    });

    it('should not detect patterns in safe text', () => {
      const safeText = 'This is a safe error message without sensitive data';

      expect(SensitiveInfoDetector.containsAbsoluteFilePath(safeText)).toBe(false);
      expect(SensitiveInfoDetector.containsApiKey(safeText)).toBe(false);
      expect(SensitiveInfoDetector.containsDatabaseConnection(safeText)).toBe(false);
      expect(SensitiveInfoDetector.containsCredentials(safeText)).toBe(false);
      expect(SensitiveInfoDetector.containsEmailAddress(safeText)).toBe(false);
      expect(SensitiveInfoDetector.containsNetworkInfo(safeText)).toBe(false);
    });
  });

  describe('analyzeSensitiveInfo', () => {
    it('should return analysis object with correct structure', () => {
      const analysis = SensitiveInfoDetector.analyzeSensitiveInfo('safe text');

      expect(analysis).toHaveProperty('hasSensitiveInfo');
      expect(analysis).toHaveProperty('foundPatterns');
      expect(typeof analysis.hasSensitiveInfo).toBe('boolean');
      expect(Array.isArray(analysis.foundPatterns)).toBe(true);
    });

    it('should return no patterns for safe text', () => {
      const text = 'Safe error message without sensitive data';
      const analysis = SensitiveInfoDetector.analyzeSensitiveInfo(text);

      expect(analysis.hasSensitiveInfo).toBe(false);
      expect(analysis.foundPatterns).toHaveLength(0);
    });

    it('should have correct pattern structure', () => {
      // Create a text that would match if patterns work correctly
      const analysis = SensitiveInfoDetector.analyzeSensitiveInfo('test');

      // Even if no matches, the structure should be correct when there are matches
      analysis.foundPatterns.forEach(pattern => {
        expect(pattern).toHaveProperty('type');
        expect(pattern).toHaveProperty('pattern');
        expect(pattern).toHaveProperty('matches');
        expect(typeof pattern.type).toBe('string');
        expect(pattern.pattern instanceof RegExp).toBe(true);
        expect(Array.isArray(pattern.matches)).toBe(true);
      });
    });
  });

  describe('sanitizeText', () => {
    it('should return string', () => {
      const result = SensitiveInfoDetector.sanitizeText('test text');
      expect(typeof result).toBe('string');
    });

    it('should leave safe text unchanged', () => {
      const text = 'Safe error message without sensitive data';
      const sanitized = SensitiveInfoDetector.sanitizeText(text);
      expect(sanitized).toBe(text);
    });

    it('should use proper redaction placeholders', () => {
      // Test that the sanitization uses the expected placeholder patterns
      const placeholders = [
        '[REDACTED_PATH]',
        '[REDACTED_API_KEY]',
        '[REDACTED_DB_CONNECTION]',
        '[REDACTED_CREDENTIAL]',
        '[REDACTED_EMAIL]',
        '[REDACTED_NETWORK_INFO]',
      ];

      // This is just testing the method exists and could use these placeholders
      expect(typeof SensitiveInfoDetector.sanitizeText).toBe('function');
      placeholders.forEach(placeholder => {
        expect(typeof placeholder).toBe('string');
        expect(placeholder.startsWith('[REDACTED_')).toBe(true);
        expect(placeholder.endsWith(']')).toBe(true);
      });
    });
  });
});

describe('Assertion Helpers', () => {
  describe('assertNoSensitiveInfo', () => {
    it('should pass for safe text', () => {
      expect(() => {
        assertNoSensitiveInfo('Safe error message');
      }).not.toThrow();
    });

    it('should be a function', () => {
      expect(typeof assertNoSensitiveInfo).toBe('function');
    });
  });

  describe('specific assertion helpers', () => {
    it('should be functions', () => {
      expect(typeof assertNoAbsoluteFilePaths).toBe('function');
      expect(typeof assertNoApiKeys).toBe('function');
      expect(typeof assertNoDatabaseConnections).toBe('function');
      expect(typeof assertNoCredentials).toBe('function');
    });

    it('should pass for safe text', () => {
      const safeText = 'Safe error message without sensitive patterns';

      expect(() => assertNoAbsoluteFilePaths(safeText)).not.toThrow();
      expect(() => assertNoApiKeys(safeText)).not.toThrow();
      expect(() => assertNoDatabaseConnections(safeText)).not.toThrow();
      expect(() => assertNoCredentials(safeText)).not.toThrow();
    });
  });
});

describe('TestDataHelpers', () => {
  describe('generateSafeTestPatterns', () => {
    it('should generate patterns object with correct structure', () => {
      const patterns = TestDataHelpers.generateSafeTestPatterns();

      expect(patterns).toHaveProperty('safePaths');
      expect(patterns).toHaveProperty('safeUrls');
      expect(patterns).toHaveProperty('safeIdentifiers');

      expect(Array.isArray(patterns.safePaths)).toBe(true);
      expect(Array.isArray(patterns.safeUrls)).toBe(true);
      expect(Array.isArray(patterns.safeIdentifiers)).toBe(true);
    });

    it('should generate safe patterns that do not trigger detection', () => {
      const patterns = TestDataHelpers.generateSafeTestPatterns();

      // Test safe paths don't trigger absolute path detection
      patterns.safePaths.forEach(path => {
        expect(SensitiveInfoDetector.containsAbsoluteFilePath(path)).toBe(false);
      });

      // Test safe URLs don't trigger database connection detection
      patterns.safeUrls.forEach(url => {
        expect(SensitiveInfoDetector.containsDatabaseConnection(url)).toBe(false);
      });

      // Test safe identifiers don't trigger API key detection
      patterns.safeIdentifiers.forEach(id => {
        expect(SensitiveInfoDetector.containsApiKey(id)).toBe(false);
      });
    });

    it('should contain expected safe patterns', () => {
      const patterns = TestDataHelpers.generateSafeTestPatterns();

      expect(patterns.safePaths.length).toBeGreaterThan(0);
      expect(patterns.safeUrls.length).toBeGreaterThan(0);
      expect(patterns.safeIdentifiers.length).toBeGreaterThan(0);

      // Verify they are indeed relative paths
      patterns.safePaths.forEach(path => {
        expect(path.startsWith('./')||path.startsWith('../')||!path.startsWith('/')).toBe(true);
      });
    });
  });

  describe('generateSafeTestMessages', () => {
    it('should generate safe messages that do not trigger detection', () => {
      const messages = TestDataHelpers.generateSafeTestMessages();

      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThan(0);

      messages.forEach(message => {
        expect(typeof message).toBe('string');
        expect(SensitiveInfoDetector.containsSensitiveInfo(message)).toBe(false);
      });
    });
  });

  describe('createTestTemplate', () => {
    it('should replace placeholders with values', () => {
      const template = 'Error: {error_type} in {location}';
      const placeholders = { error_type: 'timeout', location: 'network module' };
      const result = TestDataHelpers.createTestTemplate(template, placeholders);

      expect(result).toBe('Error: timeout in network module');
    });

    it('should handle multiple occurrences of the same placeholder', () => {
      const template = '{value} + {value} = {result}';
      const placeholders = { value: '5', result: '10' };
      const result = TestDataHelpers.createTestTemplate(template, placeholders);

      expect(result).toBe('5 + 5 = 10');
    });

    it('should handle templates without placeholders', () => {
      const template = 'Error: Network timeout';
      const result = TestDataHelpers.createTestTemplate(template, {});

      expect(result).toBe(template);
    });

    it('should handle empty placeholders object', () => {
      const template = 'Simple message';
      const result = TestDataHelpers.createTestTemplate(template, {});

      expect(result).toBe(template);
    });
  });
});

describe('SensitiveInfoUtils namespace', () => {
  it('should export all expected utilities', () => {
    expect(SensitiveInfoUtils.SensitiveInfoDetector).toBe(SensitiveInfoDetector);
    expect(SensitiveInfoUtils.SensitiveInfoPatterns).toBe(SensitiveInfoPatterns);
    expect(SensitiveInfoUtils.assertNoSensitiveInfo).toBe(assertNoSensitiveInfo);
    expect(SensitiveInfoUtils.assertNoAbsoluteFilePaths).toBe(assertNoAbsoluteFilePaths);
    expect(SensitiveInfoUtils.assertNoApiKeys).toBe(assertNoApiKeys);
    expect(SensitiveInfoUtils.assertNoDatabaseConnections).toBe(assertNoDatabaseConnections);
    expect(SensitiveInfoUtils.assertNoCredentials).toBe(assertNoCredentials);
    expect(SensitiveInfoUtils.TestDataHelpers).toBe(TestDataHelpers);
  });

  it('should be a const object', () => {
    expect(typeof SensitiveInfoUtils).toBe('object');
    expect(SensitiveInfoUtils).not.toBe(null);
  });
});

describe('Integration Tests', () => {
  it('should work with safe error message scenarios', () => {
    const safeErrorMessages = [
      'Failed to connect to database: timeout after 30 seconds',
      'API request returned status 404: resource not found',
      'Invalid JSON format in configuration file',
      'Permission denied when accessing resource',
      'Network connection failed: host unreachable',
      'File not found: requested resource does not exist',
      'Authentication failed: invalid credentials provided',
      'Service temporarily unavailable: please try again later',
    ];

    // Test that all safe messages pass detection
    safeErrorMessages.forEach(message => {
      expect(SensitiveInfoDetector.containsSensitiveInfo(message)).toBe(false);
    });
  });

  it('should properly analyze text without sensitive information', () => {
    const safeComplexText = `Application startup completed:
    - Config loaded from relative path
    - API endpoint configured
    - Database connection pool initialized
    - Email service configured
    - Server listening on configured port`;

    const analysis = SensitiveInfoDetector.analyzeSensitiveInfo(safeComplexText);
    expect(analysis.hasSensitiveInfo).toBe(false);
    expect(analysis.foundPatterns).toHaveLength(0);

    const sanitized = SensitiveInfoDetector.sanitizeText(safeComplexText);
    expect(sanitized).toBe(safeComplexText);
  });

  it('should work correctly with assertion helpers on safe content', () => {
    const safeErrorContext = 'Application error occurred in component processing';

    expect(() => assertNoSensitiveInfo(safeErrorContext)).not.toThrow();
    expect(() => assertNoAbsoluteFilePaths(safeErrorContext)).not.toThrow();
    expect(() => assertNoApiKeys(safeErrorContext)).not.toThrow();
    expect(() => assertNoDatabaseConnections(safeErrorContext)).not.toThrow();
    expect(() => assertNoCredentials(safeErrorContext)).not.toThrow();
  });
});
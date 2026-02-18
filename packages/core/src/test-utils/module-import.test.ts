import { describe, it, expect } from 'vitest';
import * as SensitivePatterns from './sensitive-patterns';

describe('Module Import Test', () => {
  it('should export all required functions', () => {
    expect(typeof SensitivePatterns.containsSensitiveInfo).toBe('function');
    expect(typeof SensitivePatterns.containsFilePaths).toBe('function');
    expect(typeof SensitivePatterns.containsApiKeys).toBe('function');
    expect(typeof SensitivePatterns.containsDbConnectionStrings).toBe('function');
    expect(typeof SensitivePatterns.containsTokenPatterns).toBe('function');
    expect(typeof SensitivePatterns.detectSensitivePatterns).toBe('function');
  });

  it('should export SENSITIVE_PATTERNS constant', () => {
    expect(SensitivePatterns.SENSITIVE_PATTERNS).toBeDefined();
    expect(SensitivePatterns.SENSITIVE_PATTERNS.FILE_PATHS).toBeDefined();
    expect(SensitivePatterns.SENSITIVE_PATTERNS.API_KEYS).toBeDefined();
    expect(SensitivePatterns.SENSITIVE_PATTERNS.DB_CONNECTION_STRINGS).toBeDefined();
    expect(SensitivePatterns.SENSITIVE_PATTERNS.TOKEN_PATTERNS).toBeDefined();
  });

  it('should have working boolean helper functions', () => {
    const cleanText = 'This is a clean error message';

    expect(SensitivePatterns.containsSensitiveInfo(cleanText)).toBe(false);
    expect(SensitivePatterns.containsFilePaths(cleanText)).toBe(false);
    expect(SensitivePatterns.containsApiKeys(cleanText)).toBe(false);
    expect(SensitivePatterns.containsDbConnectionStrings(cleanText)).toBe(false);
    expect(SensitivePatterns.containsTokenPatterns(cleanText)).toBe(false);
  });

  it('should detect patterns correctly', () => {
    const result = SensitivePatterns.detectSensitivePatterns('Clean message');

    expect(result).toHaveProperty('filePaths');
    expect(result).toHaveProperty('apiKeys');
    expect(result).toHaveProperty('dbConnectionStrings');
    expect(result).toHaveProperty('tokens');

    expect(Array.isArray(result.filePaths)).toBe(true);
    expect(Array.isArray(result.apiKeys)).toBe(true);
    expect(Array.isArray(result.dbConnectionStrings)).toBe(true);
    expect(Array.isArray(result.tokens)).toBe(true);
  });
});
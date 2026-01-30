/**
 * @fileoverview Sensitive Information Detection Test Utilities
 *
 * This module provides utilities for detecting sensitive information patterns
 * in error messages, logs, and test outputs to ensure no sensitive data leaks
 * into error messages or debugging output.
 *
 * @example
 * ```typescript
 * import { SensitiveInfoDetector, assertNoSensitiveInfo } from '@apex/core/test-fixtures';
 *
 * // Check for sensitive info in error messages
 * const hasSensitiveInfo = SensitiveInfoDetector.containsSensitiveInfo(errorMessage);
 *
 * // Use in tests with assertions
 * assertNoSensitiveInfo(errorMessage, 'Error message should not contain sensitive info');
 *
 * // Check specific patterns
 * const hasApiKey = SensitiveInfoDetector.containsApiKey(message);
 * const hasFilePath = SensitiveInfoDetector.containsAbsoluteFilePath(message);
 * ```
 */

import { expect } from 'vitest';

// ============================================================================
// Regex Pattern Constants
// ============================================================================

/**
 * Collection of regex patterns for detecting sensitive information
 */
export const SensitiveInfoPatterns = {
  /**
   * Absolute file paths for different operating systems
   * Matches paths like: /Users/username/..., /home/username/..., C:\Users\..., etc.
   */
  ABSOLUTE_FILE_PATHS: [
    // Unix-like paths (Linux, macOS)
    /\/(?:Users|home|root)\/[^\/\s]+(?:\/[^\/\s]*)*[\/\w.-]*/g,
    // Windows paths
    /[A-Za-z]:\\(?:Users|Documents and Settings)\\[^\\\/\s]+(?:\\[^\\\/\s]*)*[\\\/\w.-]*/g,
    // Generic absolute paths with common sensitive directories
    /\/(?:etc|var|opt|usr\/local)\/[^\s]*/g,
    // Windows system paths
    /[A-Za-z]:\\(?:Windows|Program Files|ProgramData)\\[^\s]*/g,
  ],

  /**
   * API key and token patterns
   * Matches common API key formats used by various services
   */
  API_KEYS: [
    // OpenAI API keys (sk-...)
    /sk-[a-zA-Z0-9]{20,}/g,
    // Generic API key patterns
    /api[_-]?key\s*[=:]\s*['"]?[a-zA-Z0-9]{16,}['"]?/gi,
    // Bearer tokens
    /bearer\s+[a-zA-Z0-9._-]{20,}/gi,
    // AWS access keys
    /AKIA[0-9A-Z]{16}/g,
    // GitHub tokens
    /gh[pousr]_[A-Za-z0-9_]{36,}/g,
    // Generic tokens
    /[a-zA-Z0-9_-]*token[a-zA-Z0-9_-]*\s*[=:]\s*['"]?[a-zA-Z0-9._-]{20,}['"]?/gi,
    // JWT tokens (basic pattern)
    /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
  ],

  /**
   * Database connection string patterns
   * Matches common database URL formats
   */
  DATABASE_CONNECTIONS: [
    // MongoDB connection strings
    /mongodb:\/\/[^\/\s]*:[^\/\s]*@[^\s\/]+(?:\/[^\s]*)?/gi,
    // PostgreSQL connection strings
    /postgres(?:ql)?:\/\/[^\/\s]*:[^\/\s]*@[^\s\/]+(?:\/[^\s]*)?/gi,
    // MySQL connection strings
    /mysql:\/\/[^\/\s]*:[^\/\s]*@[^\s\/]+(?:\/[^\s]*)?/gi,
    // Redis connection strings
    /redis:\/\/[^\/\s]*:[^\/\s]*@[^\s\/]+(?:\/[^\s]*)?/gi,
    // SQLite file paths in connection strings
    /(?:sqlite|file):\/\/[^\s]*/gi,
    // Generic database URL with credentials
    /[a-z]+:\/\/[^\/\s]*:[^\/\s]*@[^\s]+/gi,
  ],

  /**
   * Generic secret and credential patterns
   */
  CREDENTIALS: [
    // Password fields
    /password\s*[=:]\s*['"]?[^\s'"]{8,}['"]?/gi,
    // Secret fields
    /secret\s*[=:]\s*['"]?[^\s'"]{8,}['"]?/gi,
    // Private keys (PEM format)
    /-----BEGIN[A-Z\s]*PRIVATE KEY-----[\s\S]*?-----END[A-Z\s]*PRIVATE KEY-----/g,
    // SSH keys
    /ssh-[a-z0-9]+\s+[A-Za-z0-9+\/]{100,}[=]{0,2}/g,
    // Environment variable assignments with secrets
    /(?:export\s+)?[A-Z_]+(?:SECRET|PASSWORD|TOKEN|KEY|PASS)\s*=\s*['"]?[^\s'"]{8,}['"]?/gi,
  ],

  /**
   * Email addresses (might be considered sensitive in some contexts)
   */
  EMAIL_ADDRESSES: [
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  ],

  /**
   * IP addresses and hostnames that might be sensitive
   */
  NETWORK_INFO: [
    // Private IP ranges
    /(?:10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)\d{1,3}\.\d{1,3}/g,
    // Localhost variations
    /(?:127\.0\.0\.1|localhost|0\.0\.0\.0)(?::\d+)?/g,
    // Internal domain patterns
    /[a-zA-Z0-9-]+\.(?:local|internal|corp|intranet|dev|test|staging)/gi,
  ],
} as const;

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Main sensitive information detector class
 */
export class SensitiveInfoDetector {
  /**
   * Checks if text contains any sensitive information patterns
   */
  static containsSensitiveInfo(text: string): boolean {
    return (
      this.containsAbsoluteFilePath(text) ||
      this.containsApiKey(text) ||
      this.containsDatabaseConnection(text) ||
      this.containsCredentials(text) ||
      this.containsEmailAddress(text) ||
      this.containsNetworkInfo(text)
    );
  }

  /**
   * Checks if text contains absolute file path patterns
   */
  static containsAbsoluteFilePath(text: string): boolean {
    return SensitiveInfoPatterns.ABSOLUTE_FILE_PATHS.some(pattern => pattern.test(text));
  }

  /**
   * Checks if text contains API key or token patterns
   */
  static containsApiKey(text: string): boolean {
    return SensitiveInfoPatterns.API_KEYS.some(pattern => pattern.test(text));
  }

  /**
   * Checks if text contains database connection string patterns
   */
  static containsDatabaseConnection(text: string): boolean {
    return SensitiveInfoPatterns.DATABASE_CONNECTIONS.some(pattern => pattern.test(text));
  }

  /**
   * Checks if text contains credential patterns
   */
  static containsCredentials(text: string): boolean {
    return SensitiveInfoPatterns.CREDENTIALS.some(pattern => pattern.test(text));
  }

  /**
   * Checks if text contains email address patterns
   */
  static containsEmailAddress(text: string): boolean {
    return SensitiveInfoPatterns.EMAIL_ADDRESSES.some(pattern => pattern.test(text));
  }

  /**
   * Checks if text contains sensitive network information
   */
  static containsNetworkInfo(text: string): boolean {
    return SensitiveInfoPatterns.NETWORK_INFO.some(pattern => pattern.test(text));
  }

  /**
   * Returns detailed information about what sensitive patterns were found
   */
  static analyzeSensitiveInfo(text: string): {
    hasSensitiveInfo: boolean;
    foundPatterns: Array<{
      type: string;
      pattern: RegExp;
      matches: string[];
    }>;
  } {
    const foundPatterns: Array<{
      type: string;
      pattern: RegExp;
      matches: string[];
    }> = [];

    // Check each pattern category
    const categories = [
      { type: 'absoluteFilePaths', patterns: SensitiveInfoPatterns.ABSOLUTE_FILE_PATHS },
      { type: 'apiKeys', patterns: SensitiveInfoPatterns.API_KEYS },
      { type: 'databaseConnections', patterns: SensitiveInfoPatterns.DATABASE_CONNECTIONS },
      { type: 'credentials', patterns: SensitiveInfoPatterns.CREDENTIALS },
      { type: 'emailAddresses', patterns: SensitiveInfoPatterns.EMAIL_ADDRESSES },
      { type: 'networkInfo', patterns: SensitiveInfoPatterns.NETWORK_INFO },
    ];

    for (const category of categories) {
      for (const pattern of category.patterns) {
        // Reset regex lastIndex to ensure clean matches
        pattern.lastIndex = 0;
        const matches = Array.from(text.matchAll(pattern)).map(match => match[0]);
        if (matches.length > 0) {
          foundPatterns.push({
            type: category.type,
            pattern,
            matches,
          });
        }
      }
    }

    return {
      hasSensitiveInfo: foundPatterns.length > 0,
      foundPatterns,
    };
  }

  /**
   * Sanitizes text by redacting sensitive information
   */
  static sanitizeText(text: string): string {
    let sanitized = text;

    // Replace patterns with redacted versions
    const replacements = [
      { patterns: SensitiveInfoPatterns.ABSOLUTE_FILE_PATHS, replacement: '[REDACTED_PATH]' },
      { patterns: SensitiveInfoPatterns.API_KEYS, replacement: '[REDACTED_API_KEY]' },
      { patterns: SensitiveInfoPatterns.DATABASE_CONNECTIONS, replacement: '[REDACTED_DB_CONNECTION]' },
      { patterns: SensitiveInfoPatterns.CREDENTIALS, replacement: '[REDACTED_CREDENTIAL]' },
      { patterns: SensitiveInfoPatterns.EMAIL_ADDRESSES, replacement: '[REDACTED_EMAIL]' },
      { patterns: SensitiveInfoPatterns.NETWORK_INFO, replacement: '[REDACTED_NETWORK_INFO]' },
    ];

    for (const { patterns, replacement } of replacements) {
      for (const pattern of patterns) {
        sanitized = sanitized.replace(pattern, replacement);
      }
    }

    return sanitized;
  }
}

// ============================================================================
// Vitest Assertion Helpers
// ============================================================================

/**
 * Vitest assertion helper to ensure text doesn't contain sensitive information
 */
export function assertNoSensitiveInfo(
  text: string,
  message: string = 'Text should not contain sensitive information'
): void {
  const analysis = SensitiveInfoDetector.analyzeSensitiveInfo(text);

  if (analysis.hasSensitiveInfo) {
    const details = analysis.foundPatterns.map(p =>
      `  - ${p.type}: ${p.matches.length} matches`
    ).join('\n');

    const errorMessage = `${message}\n\nFound sensitive information:\n${details}\n\nSanitized text:\n${SensitiveInfoDetector.sanitizeText(text)}`;

    expect.fail(errorMessage);
  }
}

/**
 * Vitest assertion helper for specific sensitive info types
 */
export function assertNoAbsoluteFilePaths(
  text: string,
  message: string = 'Text should not contain absolute file paths'
): void {
  expect(SensitiveInfoDetector.containsAbsoluteFilePath(text)).toBe(false);
}

export function assertNoApiKeys(
  text: string,
  message: string = 'Text should not contain API keys'
): void {
  expect(SensitiveInfoDetector.containsApiKey(text)).toBe(false);
}

export function assertNoDatabaseConnections(
  text: string,
  message: string = 'Text should not contain database connection strings'
): void {
  expect(SensitiveInfoDetector.containsDatabaseConnection(text)).toBe(false);
}

export function assertNoCredentials(
  text: string,
  message: string = 'Text should not contain credentials'
): void {
  expect(SensitiveInfoDetector.containsCredentials(text)).toBe(false);
}

// ============================================================================
// Test Data Helpers
// ============================================================================

/**
 * Helper functions for generating test data patterns (non-sensitive)
 */
export const TestDataHelpers = {
  /**
   * Generates placeholder patterns for testing regex accuracy
   */
  generateSafeTestPatterns(): {
    safePaths: string[];
    safeUrls: string[];
    safeIdentifiers: string[];
  } {
    return {
      safePaths: [
        './src/components/Button.tsx',
        '../config/settings.json',
        'src/utils/helpers.ts',
        'docs/README.md',
      ],
      safeUrls: [
        'https://api.example.com/v1/users',
        'http://localhost:3000/health',
        'https://docs.company.com/api',
      ],
      safeIdentifiers: [
        'user-id-12345',
        'session_abc123',
        'request-uuid-456',
        'component-key-789',
      ],
    };
  },

  /**
   * Creates test messages that should NOT trigger sensitive info detection
   */
  generateSafeTestMessages(): string[] {
    return [
      'Failed to read file: file not found',
      'API request failed with status 404',
      'Database connection timeout after 30s',
      'Invalid configuration format in config file',
      'Network request failed: connection refused',
      'Authentication failed: invalid credentials',
      'File processing error: permission denied',
    ];
  },

  /**
   * Creates template for testing with placeholder replacement
   */
  createTestTemplate(template: string, placeholders: Record<string, string>): string {
    let result = template;
    for (const [placeholder, value] of Object.entries(placeholders)) {
      result = result.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), value);
    }
    return result;
  },
};

// ============================================================================
// Namespace Export
// ============================================================================

/**
 * Main namespace export for sensitive information utilities
 */
export const SensitiveInfoUtils = {
  // Core detector
  SensitiveInfoDetector,

  // Patterns
  SensitiveInfoPatterns,

  // Assertion helpers
  assertNoSensitiveInfo,
  assertNoAbsoluteFilePaths,
  assertNoApiKeys,
  assertNoDatabaseConnections,
  assertNoCredentials,

  // Test data helpers
  TestDataHelpers,
} as const;
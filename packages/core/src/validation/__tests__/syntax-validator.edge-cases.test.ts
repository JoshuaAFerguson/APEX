/**
 * @fileoverview Edge case tests for SyntaxValidator infrastructure
 *
 * These tests verify the robustness of the validation infrastructure
 * when handling unusual inputs, error conditions, and boundary cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BaseSyntaxValidator,
  SyntaxValidationResult,
  SyntaxValidationOptions,
  SupportedLanguage,
  ValidationIssue,
  BaseSyntaxValidatorOptions,
} from '../syntax-validator.js';

// ============================================================================
// Edge Case Test Validators
// ============================================================================

/**
 * Validator that throws different types of errors for testing
 */
class ErrorThrowingValidator extends BaseSyntaxValidator {
  public errorToThrow: Error | null = null;

  constructor() {
    super({
      name: 'Error Throwing Validator',
      languages: ['javascript'],
      description: 'Validator for testing error conditions',
    });
  }

  protected async validateImpl(): Promise<SyntaxValidationResult> {
    if (this.errorToThrow) {
      throw this.errorToThrow;
    }
    return this.createSuccessResult('javascript');
  }
}

/**
 * Validator with extreme configurations for testing limits
 */
class ExtremeConfigValidator extends BaseSyntaxValidator {
  constructor(options: Partial<BaseSyntaxValidatorOptions> = {}) {
    super({
      name: 'Extreme Config Validator',
      languages: ['typescript'],
      description: 'Validator with extreme configurations',
      defaultOptions: {
        maxErrors: 0, // Unlimited
        maxWarnings: 0, // Unlimited
        includeInfo: true,
        includeHints: true,
      },
      ...options,
    });
  }

  protected async validateImpl(
    content: string,
    language: SupportedLanguage,
    options: SyntaxValidationOptions
  ): Promise<SyntaxValidationResult> {
    // Generate extreme amounts of issues for testing limits
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    // Create a large number of issues based on content length
    const lines = content.split('\n');
    for (let i = 0; i < lines.length && i < 10000; i++) {
      if (i % 2 === 0) {
        errors.push({
          code: `E${i}`,
          message: `Error ${i}: This is a synthetic error for testing`,
          severity: 'error',
          location: { line: i + 1, column: 1 },
        });
      } else {
        warnings.push({
          code: `W${i}`,
          message: `Warning ${i}: This is a synthetic warning for testing`,
          severity: i % 10 === 0 ? 'info' : i % 15 === 0 ? 'hint' : 'warning',
          location: { line: i + 1, column: 1 },
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      language,
    };
  }
}

/**
 * Validator that returns malformed results for testing resilience
 */
class MalformedResultValidator extends BaseSyntaxValidator {
  public resultToReturn: any = null;

  constructor() {
    super({
      name: 'Malformed Result Validator',
      languages: ['python'],
      description: 'Validator that returns malformed results',
    });
  }

  protected async validateImpl(): Promise<SyntaxValidationResult> {
    if (this.resultToReturn) {
      return this.resultToReturn;
    }
    return this.createSuccessResult('python');
  }
}

// ============================================================================
// Edge Case Tests
// ============================================================================

describe('SyntaxValidator Edge Case Tests', () => {
  let errorValidator: ErrorThrowingValidator;
  let extremeValidator: ExtremeConfigValidator;
  let malformedValidator: MalformedResultValidator;

  beforeEach(() => {
    errorValidator = new ErrorThrowingValidator();
    extremeValidator = new ExtremeConfigValidator();
    malformedValidator = new MalformedResultValidator();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor Edge Cases', () => {
    it('should handle empty language array', () => {
      expect(() => {
        new ExtremeConfigValidator({ languages: [] });
      }).toThrow('BaseSyntaxValidator requires at least one supported language');
    });

    it('should handle undefined languages', () => {
      expect(() => {
        new ExtremeConfigValidator({ languages: undefined as any });
      }).toThrow('BaseSyntaxValidator requires at least one supported language');
    });

    it('should handle very long validator names', () => {
      const longName = 'A'.repeat(1000);
      const validator = new ExtremeConfigValidator({ name: longName });
      expect(validator.name).toBe(longName);
    });

    it('should handle special characters in validator configuration', () => {
      const validator = new ExtremeConfigValidator({
        name: 'Test 🎉 Validator 中文 العربية',
        description: 'Special chars: !@#$%^&*()[]{}|\\:";\'<>?,./~`',
        version: '1.0.0-beta.1+build.123',
      });

      expect(validator.name).toContain('🎉');
      expect(validator.description).toContain('!@#$%^&*()');
    });
  });

  describe('Input Edge Cases', () => {
    it('should handle extremely long content', async () => {
      // 10MB of content
      const hugeContent = 'a'.repeat(10 * 1024 * 1024);
      const result = await extremeValidator.validateSyntax(hugeContent, 'typescript');

      expect(result).toBeDefined();
      expect(result.language).toBe('typescript');
    });

    it('should handle content with null bytes', async () => {
      const contentWithNulls = 'const x = "test\0null\0bytes";';
      const result = await extremeValidator.validateSyntax(contentWithNulls, 'typescript');

      expect(result).toBeDefined();
      expect(result.language).toBe('typescript');
    });

    it('should handle content with various line endings', async () => {
      const contentWithMixedLineEndings = 'line1\r\nline2\nline3\rline4';
      const result = await extremeValidator.validateSyntax(contentWithMixedLineEndings, 'typescript');

      expect(result).toBeDefined();
    });

    it('should handle binary content gracefully', async () => {
      // Create binary-like content
      const binaryContent = Array.from({ length: 1000 }, (_, i) =>
        String.fromCharCode(i % 256)
      ).join('');

      const result = await extremeValidator.validateSyntax(binaryContent, 'typescript');

      expect(result).toBeDefined();
      expect(result.language).toBe('typescript');
    });

    it('should handle deeply nested Unicode content', async () => {
      const unicodeContent = '🚀'.repeat(1000) + '中文'.repeat(500) + '🎉'.repeat(1000);
      const result = await extremeValidator.validateSyntax(unicodeContent, 'typescript');

      expect(result).toBeDefined();
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle standard Error objects', async () => {
      errorValidator.errorToThrow = new Error('Standard error message');

      const result = await errorValidator.validateSyntax('test', 'javascript');

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('validation-error');
      expect(result.errors[0].message).toContain('Standard error message');
      expect(result.metadata?.internalError).toBe(true);
      expect(result.metadata?.errorType).toBe('Error');
    });

    it('should handle TypeError objects', async () => {
      errorValidator.errorToThrow = new TypeError('Type error occurred');

      const result = await errorValidator.validateSyntax('test', 'javascript');

      expect(result.isValid).toBe(false);
      expect(result.metadata?.errorType).toBe('TypeError');
    });

    it('should handle RangeError objects', async () => {
      errorValidator.errorToThrow = new RangeError('Range error occurred');

      const result = await errorValidator.validateSyntax('test', 'javascript');

      expect(result.isValid).toBe(false);
      expect(result.metadata?.errorType).toBe('RangeError');
    });

    it('should handle non-Error objects thrown', async () => {
      errorValidator.errorToThrow = 'String error' as any;

      const result = await errorValidator.validateSyntax('test', 'javascript');

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('String error');
      expect(result.metadata?.errorType).toBe('Unknown');
    });

    it('should handle undefined thrown', async () => {
      errorValidator.errorToThrow = undefined as any;

      const result = await errorValidator.validateSyntax('test', 'javascript');

      expect(result.isValid).toBe(false);
      expect(result.metadata?.errorType).toBe('Unknown');
    });

    it('should handle null thrown', async () => {
      errorValidator.errorToThrow = null as any;

      const result = await errorValidator.validateSyntax('test', 'javascript');

      expect(result.isValid).toBe(false);
      expect(result.metadata?.errorType).toBe('Unknown');
    });

    it('should handle circular reference errors', async () => {
      const circularObject: any = { message: 'Circular error' };
      circularObject.self = circularObject;
      errorValidator.errorToThrow = circularObject;

      const result = await errorValidator.validateSyntax('test', 'javascript');

      expect(result.isValid).toBe(false);
      expect(result.metadata?.errorType).toBe('Unknown');
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle performance.now() returning unusual values', async () => {
      const originalNow = performance.now;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        // Mock performance.now to return very large number
        return 9007199254740991; // Number.MAX_SAFE_INTEGER
      });

      const result = await extremeValidator.validateSyntax('test', 'typescript');

      expect(result.duration).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);

      performance.now = originalNow;
    });

    it('should handle time going backwards', async () => {
      let callCount = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        return callCount++ === 0 ? 1000 : 500; // Time goes backwards
      });

      const result = await extremeValidator.validateSyntax('test', 'typescript');

      expect(result.duration).toBeDefined();
      // Should handle negative duration gracefully
    });
  });

  describe('Validation Option Edge Cases', () => {
    it('should handle negative maxErrors', async () => {
      const result = await extremeValidator.validateSyntax(
        'line1\nline2\nline3\nline4',
        'typescript',
        { maxErrors: -1 }
      );

      expect(result.errors).toBeDefined();
      // Should not crash with negative values
    });

    it('should handle extremely large maxErrors', async () => {
      const result = await extremeValidator.validateSyntax(
        'line1\nline2\nline3\nline4',
        'typescript',
        { maxErrors: Number.MAX_SAFE_INTEGER }
      );

      expect(result.errors).toBeDefined();
    });

    it('should handle fractional maxErrors', async () => {
      const result = await extremeValidator.validateSyntax(
        'line1\nline2\nline3\nline4',
        'typescript',
        { maxErrors: 2.5 }
      );

      expect(result.errors).toBeDefined();
      // Should handle non-integer values gracefully
    });

    it('should handle null/undefined options properties', async () => {
      const result = await extremeValidator.validateSyntax(
        'test',
        'typescript',
        {
          maxErrors: null as any,
          maxWarnings: undefined as any,
          filePath: null as any,
          rules: undefined as any,
        }
      );

      expect(result).toBeDefined();
    });

    it('should handle circular reference in options', async () => {
      const circularOptions: any = { maxErrors: 10 };
      circularOptions.circular = circularOptions;

      const result = await extremeValidator.validateSyntax(
        'test',
        'typescript',
        circularOptions
      );

      expect(result).toBeDefined();
    });
  });

  describe('Result Limit Edge Cases', () => {
    it('should handle zero limits correctly', async () => {
      const result = await extremeValidator.validateSyntax(
        'line1\nline2\nline3\nline4', // Will generate errors and warnings
        'typescript',
        {
          maxErrors: 0, // Unlimited
          maxWarnings: 0, // Unlimited
        }
      );

      // With unlimited settings, should return all errors/warnings
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle extremely large arrays of errors/warnings', async () => {
      // Generate content that will create many issues
      const manyLines = Array.from({ length: 5000 }, (_, i) => `line${i}`).join('\n');

      const result = await extremeValidator.validateSyntax(
        manyLines,
        'typescript',
        {
          maxErrors: 100,
          maxWarnings: 100,
        }
      );

      expect(result.errors.length).toBeLessThanOrEqual(100);
      expect(result.warnings.length).toBeLessThanOrEqual(100);
    });

    it('should handle result limiting with mixed severity levels', async () => {
      // This will generate info and hint level warnings
      const result = await extremeValidator.validateSyntax(
        Array.from({ length: 100 }, (_, i) => `line${i}`).join('\n'),
        'typescript',
        {
          maxWarnings: 10,
          includeInfo: false,
          includeHints: false,
        }
      );

      expect(result.warnings.length).toBeLessThanOrEqual(10);
      result.warnings.forEach(warning => {
        expect(warning.severity).not.toBe('info');
        expect(warning.severity).not.toBe('hint');
      });
    });
  });

  describe('Language Support Edge Cases', () => {
    it('should handle case-sensitive language checking', () => {
      expect(extremeValidator.supportsLanguage('TypeScript')).toBe(false);
      expect(extremeValidator.supportsLanguage('TYPESCRIPT')).toBe(false);
      expect(extremeValidator.supportsLanguage('typescript')).toBe(true);
    });

    it('should handle empty string language', () => {
      expect(extremeValidator.supportsLanguage('')).toBe(false);
    });

    it('should handle whitespace in language names', () => {
      expect(extremeValidator.supportsLanguage(' typescript ')).toBe(false);
      expect(extremeValidator.supportsLanguage('type script')).toBe(false);
    });

    it('should throw error for unsupported languages consistently', async () => {
      const unsupportedLanguages = ['cobol', 'fortran', 'brainfuck', 'unknown'];

      for (const lang of unsupportedLanguages) {
        await expect(
          extremeValidator.validateSyntax('test', lang as SupportedLanguage)
        ).rejects.toThrow(`Language '${lang}' is not supported`);
      }
    });
  });

  describe('Metadata Edge Cases', () => {
    it('should preserve existing metadata when adding validator metadata', async () => {
      malformedValidator.resultToReturn = {
        isValid: true,
        errors: [],
        warnings: [],
        language: 'python',
        metadata: {
          existingField: 'value',
          nested: { data: true },
          array: [1, 2, 3],
        },
      };

      const result = await malformedValidator.validateSyntax('test', 'python');

      expect(result.metadata?.existingField).toBe('value');
      expect(result.metadata?.nested).toEqual({ data: true });
      expect(result.metadata?.array).toEqual([1, 2, 3]);
      expect(result.metadata?.validator).toBe('Malformed Result Validator');
    });

    it('should handle null metadata in results', async () => {
      malformedValidator.resultToReturn = {
        isValid: true,
        errors: [],
        warnings: [],
        language: 'python',
        metadata: null,
      };

      const result = await malformedValidator.validateSyntax('test', 'python');

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.validator).toBe('Malformed Result Validator');
    });
  });

  describe('AbortSignal Edge Cases', () => {
    it('should handle already aborted signal immediately', async () => {
      const controller = new AbortController();
      controller.abort();

      const startTime = performance.now();
      const result = await extremeValidator.validateSyntax('test', 'typescript', {
        signal: controller.signal,
      });
      const endTime = performance.now();

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('validation-aborted');
      expect(endTime - startTime).toBeLessThan(50); // Should return very quickly
    });

    it('should handle signal without controller', async () => {
      const signal = { aborted: false } as AbortSignal;

      const result = await extremeValidator.validateSyntax('test', 'typescript', {
        signal,
      });

      expect(result.isValid).toBeDefined();
    });
  });
});
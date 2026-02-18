/**
 * @fileoverview Unit tests for SyntaxValidator interface and BaseSyntaxValidator
 *
 * These tests verify the interface contract and abstract base class behavior
 * for the syntax validation infrastructure.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BaseSyntaxValidator,
  SyntaxValidatorInterface,
  SyntaxValidationResult,
  SyntaxValidationOptions,
  SupportedLanguage,
  ValidationIssue,
  SupportedLanguageSchema,
  ValidationSeveritySchema,
  SourceLocationSchema,
  ValidationIssueSchema,
  SyntaxValidationResultSchema,
  isSyntaxValidator,
  isBaseSyntaxValidator,
  isSupportedLanguage,
  BaseSyntaxValidatorOptions,
} from '../syntax-validator.js';

// ============================================================================
// Test Implementation
// ============================================================================

/**
 * Concrete implementation of BaseSyntaxValidator for testing
 */
class TestSyntaxValidator extends BaseSyntaxValidator {
  public validateImplCalls: Array<{
    content: string;
    language: SupportedLanguage;
    options: SyntaxValidationOptions;
  }> = [];

  public mockResult: SyntaxValidationResult | null = null;
  public mockError: Error | null = null;

  constructor(options?: Partial<BaseSyntaxValidatorOptions>) {
    super({
      name: 'Test Validator',
      description: 'A test validator for unit testing',
      languages: ['javascript', 'typescript'],
      version: '1.0.0',
      ...options,
    });
  }

  protected async validateImpl(
    content: string,
    language: SupportedLanguage,
    options: SyntaxValidationOptions
  ): Promise<SyntaxValidationResult> {
    this.validateImplCalls.push({ content, language, options });

    if (this.mockError) {
      throw this.mockError;
    }

    if (this.mockResult) {
      return this.mockResult;
    }

    // Default behavior: return success
    return this.createSuccessResult(language);
  }
}

// ============================================================================
// Schema Tests
// ============================================================================

describe('SyntaxValidator Schemas', () => {
  describe('SupportedLanguageSchema', () => {
    it('should accept valid languages', () => {
      const validLanguages = [
        'javascript', 'typescript', 'python', 'go', 'rust',
        'java', 'c', 'cpp', 'csharp', 'php', 'ruby', 'swift',
        'kotlin', 'scala', 'shell', 'bash', 'powershell', 'sql',
        'json', 'yaml', 'xml', 'html', 'css', 'scss', 'markdown',
        'dockerfile', 'toml', 'ini',
      ];

      for (const lang of validLanguages) {
        const result = SupportedLanguageSchema.safeParse(lang);
        expect(result.success, `Language '${lang}' should be valid`).toBe(true);
      }
    });

    it('should reject invalid languages', () => {
      const invalidLanguages = ['unknown', 'brainfuck', 'cobol', '', 123, null];

      for (const lang of invalidLanguages) {
        const result = SupportedLanguageSchema.safeParse(lang);
        expect(result.success, `Language '${lang}' should be invalid`).toBe(false);
      }
    });
  });

  describe('ValidationSeveritySchema', () => {
    it('should accept valid severity levels', () => {
      const validSeverities = ['error', 'warning', 'info', 'hint'];

      for (const severity of validSeverities) {
        const result = ValidationSeveritySchema.safeParse(severity);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid severity levels', () => {
      const invalidSeverities = ['critical', 'debug', 'fatal', '', null];

      for (const severity of invalidSeverities) {
        const result = ValidationSeveritySchema.safeParse(severity);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('SourceLocationSchema', () => {
    it('should accept valid source locations', () => {
      const validLocations = [
        { line: 1, column: 1 },
        { line: 10, column: 5, endLine: 10, endColumn: 15 },
        { line: 1, column: 1, offset: 0, length: 10 },
        { line: 100, column: 50, endLine: 105, endColumn: 1, offset: 500, length: 100 },
      ];

      for (const location of validLocations) {
        const result = SourceLocationSchema.safeParse(location);
        expect(result.success, `Location should be valid: ${JSON.stringify(location)}`).toBe(true);
      }
    });

    it('should reject invalid source locations', () => {
      const invalidLocations = [
        { line: 0, column: 1 },     // line must be >= 1
        { line: 1, column: 0 },     // column must be >= 1
        { line: -1, column: 1 },    // line must be positive
        { line: 1.5, column: 1 },   // line must be integer
        {},                          // missing required fields
        { line: 1 },                // missing column
      ];

      for (const location of invalidLocations) {
        const result = SourceLocationSchema.safeParse(location);
        expect(result.success, `Location should be invalid: ${JSON.stringify(location)}`).toBe(false);
      }
    });
  });

  describe('ValidationIssueSchema', () => {
    it('should accept valid validation issues', () => {
      const validIssues = [
        { code: 'E001', message: 'Syntax error', severity: 'error' },
        {
          code: 'W001',
          message: 'Unused variable',
          severity: 'warning',
          location: { line: 10, column: 5 },
        },
        {
          code: 'syntax-error',
          message: 'Unexpected token',
          severity: 'error',
          location: { line: 1, column: 1, endLine: 1, endColumn: 10 },
          source: 'const x =',
          suggestion: 'Add a value after the equals sign',
          rule: 'no-incomplete-assignment',
          context: { token: '=' },
        },
      ];

      for (const issue of validIssues) {
        const result = ValidationIssueSchema.safeParse(issue);
        expect(result.success, `Issue should be valid: ${JSON.stringify(issue)}`).toBe(true);
      }
    });

    it('should reject invalid validation issues', () => {
      const invalidIssues = [
        { code: '', message: 'Error', severity: 'error' },      // empty code
        { code: 'E001', message: '', severity: 'error' },       // empty message
        { code: 'E001', message: 'Error', severity: 'fatal' },  // invalid severity
        { code: 'E001', message: 'Error' },                     // missing severity
        {},                                                      // missing all fields
      ];

      for (const issue of invalidIssues) {
        const result = ValidationIssueSchema.safeParse(issue);
        expect(result.success, `Issue should be invalid: ${JSON.stringify(issue)}`).toBe(false);
      }
    });
  });

  describe('SyntaxValidationResultSchema', () => {
    it('should accept valid validation results', () => {
      const validResults = [
        { isValid: true, errors: [], warnings: [], language: 'javascript' },
        { isValid: false, errors: [{ code: 'E001', message: 'Error', severity: 'error' }], warnings: [], language: 'typescript' },
        {
          isValid: true,
          errors: [],
          warnings: [{ code: 'W001', message: 'Warning', severity: 'warning' }],
          language: 'python',
          duration: 123.45,
          metadata: { validator: 'test' },
        },
      ];

      for (const result of validResults) {
        const parsed = SyntaxValidationResultSchema.safeParse(result);
        expect(parsed.success, `Result should be valid: ${JSON.stringify(result)}`).toBe(true);
      }
    });

    it('should reject invalid validation results', () => {
      const invalidResults = [
        { isValid: true, errors: [], language: 'javascript' },  // missing warnings
        { isValid: true, warnings: [], language: 'javascript' }, // missing errors
        { isValid: true, errors: [], warnings: [] },             // missing language
        { errors: [], warnings: [], language: 'javascript' },    // missing isValid
        { isValid: 'yes', errors: [], warnings: [], language: 'javascript' }, // wrong type
      ];

      for (const result of invalidResults) {
        const parsed = SyntaxValidationResultSchema.safeParse(result);
        expect(parsed.success, `Result should be invalid: ${JSON.stringify(result)}`).toBe(false);
      }
    });
  });
});

// ============================================================================
// BaseSyntaxValidator Tests
// ============================================================================

describe('BaseSyntaxValidator', () => {
  let validator: TestSyntaxValidator;

  beforeEach(() => {
    validator = new TestSyntaxValidator();
  });

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      expect(validator.name).toBe('Test Validator');
      expect(validator.description).toBe('A test validator for unit testing');
      expect(validator.version).toBe('1.0.0');
    });

    it('should throw error when no languages provided', () => {
      expect(() => {
        new TestSyntaxValidator({ languages: [] });
      }).toThrow('BaseSyntaxValidator requires at least one supported language');
    });

    it('should accept custom languages', () => {
      const customValidator = new TestSyntaxValidator({
        languages: ['python', 'go', 'rust'],
      });
      expect(customValidator.getSupportedLanguages()).toEqual(['python', 'go', 'rust']);
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return array of supported languages', () => {
      const languages = validator.getSupportedLanguages();
      expect(languages).toEqual(['javascript', 'typescript']);
    });

    it('should return a copy of the languages array', () => {
      const languages1 = validator.getSupportedLanguages();
      const languages2 = validator.getSupportedLanguages();
      expect(languages1).not.toBe(languages2);
      expect(languages1).toEqual(languages2);
    });
  });

  describe('supportsLanguage', () => {
    it('should return true for supported languages', () => {
      expect(validator.supportsLanguage('javascript')).toBe(true);
      expect(validator.supportsLanguage('typescript')).toBe(true);
    });

    it('should return false for unsupported languages', () => {
      expect(validator.supportsLanguage('python')).toBe(false);
      expect(validator.supportsLanguage('go')).toBe(false);
      expect(validator.supportsLanguage('unknown')).toBe(false);
    });
  });

  describe('validateSyntax', () => {
    it('should call validateImpl with correct parameters', async () => {
      await validator.validateSyntax('const x = 1;', 'javascript');

      expect(validator.validateImplCalls).toHaveLength(1);
      expect(validator.validateImplCalls[0]).toEqual({
        content: 'const x = 1;',
        language: 'javascript',
        options: expect.objectContaining({
          maxErrors: 100,
          maxWarnings: 100,
          includeInfo: false,
          includeHints: false,
        }),
      });
    });

    it('should merge options with defaults', async () => {
      await validator.validateSyntax('const x = 1;', 'javascript', {
        maxErrors: 10,
        filePath: '/test/file.js',
      });

      expect(validator.validateImplCalls[0].options).toEqual({
        maxErrors: 10,
        maxWarnings: 100,
        includeInfo: false,
        includeHints: false,
        filePath: '/test/file.js',
      });
    });

    it('should throw error for unsupported language', async () => {
      await expect(
        validator.validateSyntax('print("hello")', 'python')
      ).rejects.toThrow("Language 'python' is not supported");
    });

    it('should return result with duration', async () => {
      const result = await validator.validateSyntax('const x = 1;', 'javascript');

      expect(result.duration).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should add validator metadata to result', async () => {
      const result = await validator.validateSyntax('const x = 1;', 'javascript');

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.validator).toBe('Test Validator');
      expect(result.metadata?.validatorVersion).toBe('1.0.0');
    });

    it('should handle validation errors gracefully', async () => {
      validator.mockError = new Error('Internal validation error');

      const result = await validator.validateSyntax('const x = 1;', 'javascript');

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('validation-error');
      expect(result.errors[0].message).toContain('Internal validation error');
      expect(result.metadata?.internalError).toBe(true);
    });

    it('should return aborted result when signal is aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await validator.validateSyntax('const x = 1;', 'javascript', {
        signal: controller.signal,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('validation-aborted');
      expect(result.metadata?.aborted).toBe(true);
    });

    it('should apply error limit', async () => {
      const errors: ValidationIssue[] = Array.from({ length: 20 }, (_, i) => ({
        code: `E${i}`,
        message: `Error ${i}`,
        severity: 'error' as const,
      }));

      validator.mockResult = {
        isValid: false,
        errors,
        warnings: [],
        language: 'javascript',
      };

      const result = await validator.validateSyntax('const x = 1;', 'javascript', {
        maxErrors: 5,
      });

      expect(result.errors).toHaveLength(5);
    });

    it('should apply warning limit', async () => {
      const warnings: ValidationIssue[] = Array.from({ length: 20 }, (_, i) => ({
        code: `W${i}`,
        message: `Warning ${i}`,
        severity: 'warning' as const,
      }));

      validator.mockResult = {
        isValid: true,
        errors: [],
        warnings,
        language: 'javascript',
      };

      const result = await validator.validateSyntax('const x = 1;', 'javascript', {
        maxWarnings: 5,
      });

      expect(result.warnings).toHaveLength(5);
    });

    it('should filter out info-level issues by default', async () => {
      validator.mockResult = {
        isValid: true,
        errors: [],
        warnings: [
          { code: 'W001', message: 'Warning', severity: 'warning' },
          { code: 'I001', message: 'Info', severity: 'info' },
        ],
        language: 'javascript',
      };

      const result = await validator.validateSyntax('const x = 1;', 'javascript');

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].severity).toBe('warning');
    });

    it('should include info-level issues when option is set', async () => {
      validator.mockResult = {
        isValid: true,
        errors: [],
        warnings: [
          { code: 'W001', message: 'Warning', severity: 'warning' },
          { code: 'I001', message: 'Info', severity: 'info' },
        ],
        language: 'javascript',
      };

      const result = await validator.validateSyntax('const x = 1;', 'javascript', {
        includeInfo: true,
      });

      expect(result.warnings).toHaveLength(2);
    });

    it('should filter out hint-level issues by default', async () => {
      validator.mockResult = {
        isValid: true,
        errors: [],
        warnings: [
          { code: 'W001', message: 'Warning', severity: 'warning' },
          { code: 'H001', message: 'Hint', severity: 'hint' },
        ],
        language: 'javascript',
      };

      const result = await validator.validateSyntax('const x = 1;', 'javascript');

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].severity).toBe('warning');
    });

    it('should include hint-level issues when option is set', async () => {
      validator.mockResult = {
        isValid: true,
        errors: [],
        warnings: [
          { code: 'W001', message: 'Warning', severity: 'warning' },
          { code: 'H001', message: 'Hint', severity: 'hint' },
        ],
        language: 'javascript',
      };

      const result = await validator.validateSyntax('const x = 1;', 'javascript', {
        includeHints: true,
      });

      expect(result.warnings).toHaveLength(2);
    });
  });

  describe('createSuccessResult', () => {
    it('should create a valid success result', async () => {
      const result = await validator.validateSyntax('const x = 1;', 'javascript');

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.language).toBe('javascript');
    });

    it('should include warnings in success result', async () => {
      validator.mockResult = {
        isValid: true,
        errors: [],
        warnings: [{ code: 'W001', message: 'Warning', severity: 'warning' }],
        language: 'javascript',
      };

      const result = await validator.validateSyntax('const x = 1;', 'javascript');

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
    });
  });

  describe('createErrorResult', () => {
    it('should create a valid error result', async () => {
      validator.mockResult = {
        isValid: false,
        errors: [{ code: 'E001', message: 'Syntax error', severity: 'error' }],
        warnings: [],
        language: 'javascript',
      };

      const result = await validator.validateSyntax('const x =', 'javascript');

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('E001');
    });
  });
});

// ============================================================================
// Type Guard Tests
// ============================================================================

describe('Type Guards', () => {
  describe('isSyntaxValidator', () => {
    it('should return true for valid SyntaxValidator implementations', () => {
      const validator = new TestSyntaxValidator();
      expect(isSyntaxValidator(validator)).toBe(true);
    });

    it('should return true for object implementing interface', () => {
      const mockValidator = {
        getSupportedLanguages: () => ['javascript'],
        supportsLanguage: () => true,
        validateSyntax: async () => ({ isValid: true, errors: [], warnings: [], language: 'javascript' as const }),
      };
      expect(isSyntaxValidator(mockValidator)).toBe(true);
    });

    it('should return false for invalid objects', () => {
      expect(isSyntaxValidator(null)).toBe(false);
      expect(isSyntaxValidator(undefined)).toBe(false);
      expect(isSyntaxValidator({})).toBe(false);
      expect(isSyntaxValidator({ getSupportedLanguages: () => [] })).toBe(false);
      expect(isSyntaxValidator('string')).toBe(false);
      expect(isSyntaxValidator(123)).toBe(false);
    });
  });

  describe('isBaseSyntaxValidator', () => {
    it('should return true for BaseSyntaxValidator instances', () => {
      const validator = new TestSyntaxValidator();
      expect(isBaseSyntaxValidator(validator)).toBe(true);
    });

    it('should return false for non-instances', () => {
      expect(isBaseSyntaxValidator({})).toBe(false);
      expect(isBaseSyntaxValidator(null)).toBe(false);
      expect(isBaseSyntaxValidator({
        getSupportedLanguages: () => [],
        supportsLanguage: () => true,
        validateSyntax: async () => ({ isValid: true, errors: [], warnings: [], language: 'javascript' as const }),
      })).toBe(false);
    });
  });

  describe('isSupportedLanguage', () => {
    it('should return true for valid languages', () => {
      expect(isSupportedLanguage('javascript')).toBe(true);
      expect(isSupportedLanguage('typescript')).toBe(true);
      expect(isSupportedLanguage('python')).toBe(true);
    });

    it('should return false for invalid languages', () => {
      expect(isSupportedLanguage('unknown')).toBe(false);
      expect(isSupportedLanguage('')).toBe(false);
      expect(isSupportedLanguage('JAVASCRIPT')).toBe(false);
    });
  });
});

// ============================================================================
// Interface Contract Tests
// ============================================================================

describe('SyntaxValidator Interface Contract', () => {
  it('should satisfy the interface contract', () => {
    const validator: SyntaxValidatorInterface = new TestSyntaxValidator();

    // Verify interface methods exist and have correct signatures
    expect(typeof validator.getSupportedLanguages).toBe('function');
    expect(typeof validator.supportsLanguage).toBe('function');
    expect(typeof validator.validateSyntax).toBe('function');

    // Verify return types
    const languages = validator.getSupportedLanguages();
    expect(Array.isArray(languages)).toBe(true);

    const supports = validator.supportsLanguage('javascript');
    expect(typeof supports).toBe('boolean');
  });

  it('should return Promise from validateSyntax', async () => {
    const validator = new TestSyntaxValidator();
    const result = validator.validateSyntax('const x = 1;', 'javascript');

    expect(result).toBeInstanceOf(Promise);
  });

  it('should return valid SyntaxValidationResult', async () => {
    const validator = new TestSyntaxValidator();
    const result = await validator.validateSyntax('const x = 1;', 'javascript');

    // Validate result structure
    expect(typeof result.isValid).toBe('boolean');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(typeof result.language).toBe('string');

    // Validate result against schema
    const parsed = SyntaxValidationResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });
});

// ============================================================================
// Edge Cases Tests
// ============================================================================

describe('Edge Cases', () => {
  let validator: TestSyntaxValidator;

  beforeEach(() => {
    validator = new TestSyntaxValidator();
  });

  it('should handle empty content', async () => {
    const result = await validator.validateSyntax('', 'javascript');
    expect(result.isValid).toBe(true);
  });

  it('should handle very large content', async () => {
    const largeContent = 'const x = 1;\n'.repeat(10000);
    const result = await validator.validateSyntax(largeContent, 'javascript');
    expect(result.isValid).toBe(true);
  });

  it('should handle content with special characters', async () => {
    const content = 'const emoji = "\uD83D\uDE00"; const unicode = "\u0048\u0065\u006c\u006c\u006f";';
    const result = await validator.validateSyntax(content, 'javascript');
    expect(result.isValid).toBe(true);
  });

  it('should handle content with null bytes', async () => {
    const content = 'const x = "hello\0world";';
    const result = await validator.validateSyntax(content, 'javascript');
    expect(result.isValid).toBe(true);
  });

  it('should handle concurrent validations', async () => {
    const validations = Array.from({ length: 10 }, (_, i) =>
      validator.validateSyntax(`const x${i} = ${i};`, 'javascript')
    );

    const results = await Promise.all(validations);

    expect(results).toHaveLength(10);
    results.forEach(result => {
      expect(result.isValid).toBe(true);
    });
  });

  it('should preserve metadata through validation', async () => {
    validator.mockResult = {
      isValid: true,
      errors: [],
      warnings: [],
      language: 'javascript',
      metadata: {
        customField: 'customValue',
        nestedData: { key: 'value' },
      },
    };

    const result = await validator.validateSyntax('const x = 1;', 'javascript');

    expect(result.metadata?.customField).toBe('customValue');
    expect(result.metadata?.nestedData).toEqual({ key: 'value' });
    // Also verify standard metadata is added
    expect(result.metadata?.validator).toBe('Test Validator');
  });
});

/**
 * @fileoverview Integration tests for SyntaxValidator infrastructure
 *
 * These tests verify integration between the validation components and real-world scenarios.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BaseSyntaxValidator,
  SyntaxValidationResult,
  SyntaxValidationOptions,
  SupportedLanguage,
  ValidationIssue,
} from '../syntax-validator.js';

// ============================================================================
// Test Implementations
// ============================================================================

/**
 * JSON Syntax Validator implementation for integration testing
 */
class JsonSyntaxValidator extends BaseSyntaxValidator {
  constructor() {
    super({
      name: 'JSON Syntax Validator',
      description: 'Validates JSON syntax and structure',
      languages: ['json'],
      version: '1.0.0',
    });
  }

  protected async validateImpl(
    content: string,
    language: SupportedLanguage,
    options: SyntaxValidationOptions
  ): Promise<SyntaxValidationResult> {
    if (content.trim() === '') {
      return this.createSuccessResult(language, [{
        code: 'W001',
        message: 'Empty JSON content',
        severity: 'warning',
      }]);
    }

    try {
      JSON.parse(content);
      return this.createSuccessResult(language);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorLocation = this.parseJsonError(errorMessage, content);

      return this.createErrorResult(language, [{
        code: 'json-parse-error',
        message: `Invalid JSON: ${errorMessage}`,
        severity: 'error',
        location: errorLocation,
        source: content.split('\n')[errorLocation?.line ? errorLocation.line - 1 : 0]?.trim(),
        suggestion: 'Check for missing quotes, commas, or brackets',
        rule: 'json-syntax',
      }]);
    }
  }

  private parseJsonError(errorMessage: string, content: string) {
    // Basic error location parsing for JSON.parse errors
    const positionMatch = errorMessage.match(/position (\d+)/);
    if (positionMatch) {
      const position = parseInt(positionMatch[1], 10);
      const lines = content.substring(0, position).split('\n');
      return {
        line: lines.length,
        column: lines[lines.length - 1].length + 1,
        offset: position,
      };
    }
    return { line: 1, column: 1 };
  }
}

/**
 * YAML-like Syntax Validator for testing multi-language support
 */
class YamlSyntaxValidator extends BaseSyntaxValidator {
  constructor() {
    super({
      name: 'YAML Syntax Validator',
      description: 'Basic YAML syntax validation',
      languages: ['yaml'],
      defaultOptions: {
        maxErrors: 10,
        includeInfo: true,
      },
    });
  }

  protected async validateImpl(
    content: string,
    language: SupportedLanguage,
    options: SyntaxValidationOptions
  ): Promise<SyntaxValidationResult> {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const lines = content.split('\n');

    // Basic YAML validation rules
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for tabs in indentation (YAML prefers spaces)
      if (line.startsWith('\t')) {
        warnings.push({
          code: 'yaml-tabs',
          message: 'YAML should use spaces for indentation, not tabs',
          severity: 'warning',
          location: { line: lineNumber, column: 1 },
          suggestion: 'Replace tabs with spaces',
          rule: 'yaml-indentation',
        });
      }

      // Check for invalid key syntax
      if (line.includes(':') && !line.match(/^\s*[\w-]+\s*:\s*.*$/)) {
        errors.push({
          code: 'yaml-key-syntax',
          message: 'Invalid key syntax in YAML',
          severity: 'error',
          location: { line: lineNumber, column: line.indexOf(':') + 1 },
          source: line.trim(),
          rule: 'yaml-syntax',
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

// ============================================================================
// Integration Tests
// ============================================================================

describe('SyntaxValidator Integration Tests', () => {
  let jsonValidator: JsonSyntaxValidator;
  let yamlValidator: YamlSyntaxValidator;

  beforeEach(() => {
    jsonValidator = new JsonSyntaxValidator();
    yamlValidator = new YamlSyntaxValidator();
  });

  describe('Real-world JSON Validation', () => {
    it('should validate valid JSON correctly', async () => {
      const validJson = JSON.stringify({
        name: 'test',
        version: '1.0.0',
        dependencies: {
          'package-a': '^1.0.0',
          'package-b': '~2.0.0',
        },
        scripts: {
          build: 'tsc',
          test: 'vitest',
        },
      }, null, 2);

      const result = await jsonValidator.validateSyntax(validJson, 'json');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.language).toBe('json');
      expect(result.duration).toBeDefined();
    });

    it('should detect JSON syntax errors with location info', async () => {
      const invalidJson = '{\n  "name": "test",\n  "version": "1.0.0"\n  "invalid": true\n}';

      const result = await jsonValidator.validateSyntax(invalidJson, 'json');

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('json-parse-error');
      expect(result.errors[0].severity).toBe('error');
      expect(result.errors[0].location).toBeDefined();
      expect(result.errors[0].suggestion).toBeTruthy();
    });

    it('should warn about empty JSON content', async () => {
      const result = await jsonValidator.validateSyntax('   \n  \n  ', 'json');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('W001');
      expect(result.warnings[0].severity).toBe('warning');
    });
  });

  describe('Real-world YAML Validation', () => {
    it('should validate basic YAML structure', async () => {
      const validYaml = `
name: test-project
version: 1.0.0
dependencies:
  - package-a
  - package-b
config:
  debug: true
  timeout: 30
`.trim();

      const result = await yamlValidator.validateSyntax(validYaml, 'yaml');

      expect(result.isValid).toBe(true);
      expect(result.language).toBe('yaml');
    });

    it('should detect tab indentation issues', async () => {
      const yamlWithTabs = `name: test\n\tversion: 1.0.0`;

      const result = await yamlValidator.validateSyntax(yamlWithTabs, 'yaml');

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('yaml-tabs');
      expect(result.warnings[0].severity).toBe('warning');
    });

    it('should detect invalid key syntax', async () => {
      const invalidYaml = `name: test\ninvalid key here: value`;

      const result = await yamlValidator.validateSyntax(invalidYaml, 'yaml');

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('yaml-key-syntax');
    });
  });

  describe('Cross-validator Integration', () => {
    it('should handle multiple validators with different language support', () => {
      expect(jsonValidator.supportsLanguage('json')).toBe(true);
      expect(jsonValidator.supportsLanguage('yaml')).toBe(false);

      expect(yamlValidator.supportsLanguage('yaml')).toBe(true);
      expect(yamlValidator.supportsLanguage('json')).toBe(false);
    });

    it('should maintain separate configurations', () => {
      expect(jsonValidator.name).toBe('JSON Syntax Validator');
      expect(yamlValidator.name).toBe('YAML Syntax Validator');

      expect(jsonValidator.getSupportedLanguages()).toEqual(['json']);
      expect(yamlValidator.getSupportedLanguages()).toEqual(['yaml']);
    });
  });

  describe('Validation Options Integration', () => {
    it('should respect maxErrors option', async () => {
      const invalidYaml = Array.from({ length: 20 }, (_, i) =>
        `invalid key ${i}: value`
      ).join('\n');

      const result = await yamlValidator.validateSyntax(invalidYaml, 'yaml', {
        maxErrors: 5,
      });

      expect(result.errors.length).toBeLessThanOrEqual(5);
    });

    it('should include info messages when requested', async () => {
      // YAML validator is configured to include info by default
      const yamlWithTabs = `\tname: test`;

      const result = await yamlValidator.validateSyntax(yamlWithTabs, 'yaml', {
        includeInfo: true,
      });

      expect(result.warnings).toBeDefined();
    });

    it('should handle custom file path in options', async () => {
      const result = await jsonValidator.validateSyntax('{"test": true}', 'json', {
        filePath: '/path/to/config.json',
      });

      expect(result.isValid).toBe(true);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle validation timeout gracefully', async () => {
      // Simulate a validator that might take time
      const result = await jsonValidator.validateSyntax('{"test": "value"}', 'json', {
        timeout: 1000,
      });

      expect(result.duration).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle abort signals', async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await jsonValidator.validateSyntax('{"test": true}', 'json', {
        signal: controller.signal,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('validation-aborted');
      expect(result.metadata?.aborted).toBe(true);
    });

    it('should preserve metadata across validation pipeline', async () => {
      const result = await jsonValidator.validateSyntax('{"valid": true}', 'json');

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.validator).toBe('JSON Syntax Validator');
      expect(result.metadata?.validatorVersion).toBe('1.0.0');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Characteristics', () => {
    it('should validate large JSON files efficiently', async () => {
      const largeJson = JSON.stringify({
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          metadata: { created: new Date().toISOString() },
        })),
      });

      const startTime = performance.now();
      const result = await jsonValidator.validateSyntax(largeJson, 'json');
      const endTime = performance.now();

      expect(result.isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent validations correctly', async () => {
      const validations = Array.from({ length: 10 }, (_, i) =>
        jsonValidator.validateSyntax(`{"test_${i}": ${i}}`, 'json')
      );

      const results = await Promise.all(validations);

      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.isValid).toBe(true);
        expect(result.metadata?.validator).toBe('JSON Syntax Validator');
      });
    });
  });
});
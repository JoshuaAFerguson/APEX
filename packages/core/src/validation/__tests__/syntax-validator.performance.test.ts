/**
 * @fileoverview Performance tests for SyntaxValidator infrastructure
 *
 * These tests verify the performance characteristics and resource management
 * of the validation infrastructure under various load conditions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BaseSyntaxValidator,
  SyntaxValidationResult,
  SyntaxValidationOptions,
  SupportedLanguage,
} from '../syntax-validator.js';

// ============================================================================
// Mock Validators for Performance Testing
// ============================================================================

/**
 * Fast validator that simulates lightweight validation
 */
class FastMockValidator extends BaseSyntaxValidator {
  constructor() {
    super({
      name: 'Fast Mock Validator',
      languages: ['javascript'],
      description: 'Fast validation for performance testing',
    });
  }

  protected async validateImpl(
    content: string,
    language: SupportedLanguage,
    options: SyntaxValidationOptions
  ): Promise<SyntaxValidationResult> {
    // Simulate minimal processing time
    return this.createSuccessResult(language);
  }
}

/**
 * Slow validator that simulates heavy processing
 */
class SlowMockValidator extends BaseSyntaxValidator {
  constructor() {
    super({
      name: 'Slow Mock Validator',
      languages: ['typescript'],
      description: 'Slow validation for performance testing',
    });
  }

  protected async validateImpl(
    content: string,
    language: SupportedLanguage,
    options: SyntaxValidationOptions
  ): Promise<SyntaxValidationResult> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 10));
    return this.createSuccessResult(language);
  }
}

/**
 * Memory-intensive validator that creates large result objects
 */
class MemoryIntensiveValidator extends BaseSyntaxValidator {
  constructor() {
    super({
      name: 'Memory Intensive Validator',
      languages: ['python'],
      description: 'Memory-intensive validation for testing',
    });
  }

  protected async validateImpl(
    content: string,
    language: SupportedLanguage,
    options: SyntaxValidationOptions
  ): Promise<SyntaxValidationResult> {
    // Create many warnings to test memory usage
    const warnings = Array.from({ length: 100 }, (_, i) => ({
      code: `W${i.toString().padStart(3, '0')}`,
      message: `Warning ${i}: This is a test warning with some context`,
      severity: 'warning' as const,
      location: { line: i + 1, column: 1 },
      source: `line ${i + 1} content`,
      suggestion: `Fix suggestion for warning ${i}`,
      rule: `rule-${i}`,
      context: { warningNumber: i, additionalData: new Array(10).fill(`data-${i}`) },
    }));

    return this.createSuccessResult(language, warnings);
  }
}

// ============================================================================
// Performance Tests
// ============================================================================

describe('SyntaxValidator Performance Tests', () => {
  let fastValidator: FastMockValidator;
  let slowValidator: SlowMockValidator;
  let memoryValidator: MemoryIntensiveValidator;

  beforeEach(() => {
    fastValidator = new FastMockValidator();
    slowValidator = new SlowMockValidator();
    memoryValidator = new MemoryIntensiveValidator();
  });

  describe('Basic Performance Characteristics', () => {
    it('should complete fast validation under 10ms', async () => {
      const content = 'const x = 1;';
      const startTime = performance.now();

      const result = await fastValidator.validateSyntax(content, 'javascript');

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.isValid).toBe(true);
      expect(duration).toBeLessThan(10);
      expect(result.duration).toBeLessThan(10);
    });

    it('should measure validation time accurately', async () => {
      const result = await slowValidator.validateSyntax('const x = 1;', 'typescript');

      expect(result.duration).toBeDefined();
      expect(result.duration).toBeGreaterThan(10); // Should be at least 10ms due to setTimeout
      expect(result.duration).toBeLessThan(100); // But not too much overhead
    });

    it('should handle timing for failed validations', async () => {
      slowValidator = class extends SlowMockValidator {
        protected async validateImpl(): Promise<SyntaxValidationResult> {
          await new Promise(resolve => setTimeout(resolve, 15));
          throw new Error('Validation failed');
        }
      } as any;

      slowValidator = new (slowValidator as any)();

      const result = await slowValidator.validateSyntax('invalid code', 'typescript');

      expect(result.isValid).toBe(false);
      expect(result.duration).toBeGreaterThan(15);
      expect(result.metadata?.internalError).toBe(true);
    });
  });

  describe('Concurrent Validation Performance', () => {
    it('should handle multiple concurrent fast validations efficiently', async () => {
      const concurrency = 50;
      const content = 'const valid = true;';

      const startTime = performance.now();

      const promises = Array.from({ length: concurrency }, () =>
        fastValidator.validateSyntax(content, 'javascript')
      );

      const results = await Promise.all(promises);

      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      expect(results).toHaveLength(concurrency);
      expect(results.every(r => r.isValid)).toBe(true);
      expect(totalDuration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle mixed fast and slow validations', async () => {
      const fastPromises = Array.from({ length: 10 }, () =>
        fastValidator.validateSyntax('const x = 1;', 'javascript')
      );

      const slowPromises = Array.from({ length: 5 }, () =>
        slowValidator.validateSyntax('const x = 1;', 'typescript')
      );

      const startTime = performance.now();
      const results = await Promise.all([...fastPromises, ...slowPromises]);
      const endTime = performance.now();

      expect(results).toHaveLength(15);
      expect(results.every(r => r.isValid)).toBe(true);

      // Fast validations should complete quickly, slow ones add minimal overhead
      expect(endTime - startTime).toBeLessThan(200);
    });

    it('should maintain isolation between concurrent validations', async () => {
      const validator = new FastMockValidator();

      // Each validation should be independent
      const promises = [
        validator.validateSyntax('code1', 'javascript'),
        validator.validateSyntax('code2', 'javascript'),
        validator.validateSyntax('code3', 'javascript'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.isValid).toBe(true);
        expect(result.metadata?.validator).toBe('Fast Mock Validator');
      });
    });
  });

  describe('Memory Usage and Resource Management', () => {
    it('should handle large validation results efficiently', async () => {
      const result = await memoryValidator.validateSyntax('test content', 'python');

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(100);
      expect(result.duration).toBeLessThan(100); // Should still complete quickly

      // Verify the result structure is correct despite size
      expect(result.warnings[0]).toMatchObject({
        code: 'W000',
        message: expect.stringContaining('Warning 0'),
        severity: 'warning',
        location: { line: 1, column: 1 },
      });

      expect(result.warnings[99]).toMatchObject({
        code: 'W099',
        message: expect.stringContaining('Warning 99'),
        severity: 'warning',
        location: { line: 100, column: 1 },
      });
    });

    it('should apply result limits to control memory usage', async () => {
      const result = await memoryValidator.validateSyntax('test content', 'python', {
        maxWarnings: 10,
      });

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(10); // Limited from 100 to 10
      expect(result.warnings[0].code).toBe('W000');
      expect(result.warnings[9].code).toBe('W009');
    });

    it('should handle large content efficiently', async () => {
      // Create a large content string (1MB)
      const largeContent = 'const line = "This is a test line with some content";\n'.repeat(20000);

      const startTime = performance.now();
      const result = await fastValidator.validateSyntax(largeContent, 'javascript');
      const endTime = performance.now();

      expect(result.isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should handle 1MB within 1 second
      expect(result.duration).toBeLessThan(1000);
    });
  });

  describe('Abort Signal Performance', () => {
    it('should handle pre-aborted signals efficiently', async () => {
      const controller = new AbortController();
      controller.abort();

      const startTime = performance.now();
      const result = await fastValidator.validateSyntax('test', 'javascript', {
        signal: controller.signal,
      });
      const endTime = performance.now();

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('validation-aborted');
      expect(endTime - startTime).toBeLessThan(10); // Should abort quickly
    });

    it('should handle abort during validation', async () => {
      const controller = new AbortController();

      // Start validation and abort after a short delay
      const promise = slowValidator.validateSyntax('test', 'typescript', {
        signal: controller.signal,
      });

      setTimeout(() => controller.abort(), 5);

      const result = await promise;

      // The validation should still complete as our mock doesn't check abort signal
      // This tests that the infrastructure handles abort signals properly
      expect(result).toBeDefined();
    });
  });

  describe('Stress Testing', () => {
    it('should handle rapid successive validations', async () => {
      const iterations = 100;
      const results: SyntaxValidationResult[] = [];

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const result = await fastValidator.validateSyntax(`const x${i} = ${i};`, 'javascript');
        results.push(result);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      expect(results).toHaveLength(iterations);
      expect(results.every(r => r.isValid)).toBe(true);
      expect(avgTime).toBeLessThan(5); // Average under 5ms per validation
    });

    it('should maintain consistent performance across iterations', async () => {
      const iterations = 20;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const result = await fastValidator.validateSyntax('test content', 'javascript');
        expect(result.duration).toBeDefined();
        durations.push(result.duration!);
      }

      // Calculate variance to ensure consistent performance
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const variance = durations.reduce((acc, duration) => acc + Math.pow(duration - avg, 2), 0) / durations.length;
      const stdDev = Math.sqrt(variance);

      expect(avg).toBeLessThan(10); // Average should be fast
      expect(stdDev).toBeLessThan(5); // Standard deviation should be low (consistent)
    });
  });

  describe('Edge Case Performance', () => {
    it('should handle empty content efficiently', async () => {
      const startTime = performance.now();
      const result = await fastValidator.validateSyntax('', 'javascript');
      const endTime = performance.now();

      expect(result.isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(5);
      expect(result.duration).toBeLessThan(5);
    });

    it('should handle content with special characters efficiently', async () => {
      const specialContent = '🎉🚀✨ const emoji = "🌟"; // Unicode test 中文 العربية';

      const startTime = performance.now();
      const result = await fastValidator.validateSyntax(specialContent, 'javascript');
      const endTime = performance.now();

      expect(result.isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(10);
    });

    it('should handle deeply nested validation options', async () => {
      const complexOptions: SyntaxValidationOptions = {
        maxErrors: 100,
        maxWarnings: 100,
        includeInfo: true,
        includeHints: true,
        filePath: '/very/long/path/to/file/with/many/segments/test.js',
        rules: {
          rule1: { enabled: true, options: { nested: { deeply: { value: 42 } } } },
          rule2: { enabled: false },
          rule3: Array.from({ length: 100 }, (_, i) => `rule-${i}`),
        },
        timeout: 30000,
      };

      const startTime = performance.now();
      const result = await fastValidator.validateSyntax('test', 'javascript', complexOptions);
      const endTime = performance.now();

      expect(result.isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(20); // Should handle complex options efficiently
    });
  });
});
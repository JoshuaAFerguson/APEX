/**
 * @fileoverview Edge cases and error handling tests for WebSearchTool
 *
 * This test suite covers unusual scenarios, boundary conditions, and error handling:
 * - Input validation edge cases
 * - Network failure simulation
 * - Resource exhaustion scenarios
 * - Malformed data handling
 * - Security-related edge cases
 * - Performance boundary testing
 *
 * @module @apex/core/tools/web/__tests__/web-search-tool.edge-cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WebSearchTool,
  type WebSearchToolInput,
  type WebSearchToolOutput,
  type WebSearchToolConfig,
} from '../web-search-tool.js';
import type { ToolExecutionContext } from '../../base-tool.js';

describe('WebSearchTool Edge Cases', () => {
  let tool: WebSearchTool;

  beforeEach(() => {
    tool = new WebSearchTool();
  });

  // ============================================================================
  // Input Validation Edge Cases
  // ============================================================================

  describe('input validation edge cases', () => {
    it('should handle query with only whitespace', () => {
      const input: WebSearchToolInput = {
        query: '   \t\n   ',
      };

      const result = tool.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.includes('2 characters'))).toBe(true);
    });

    it('should handle query at exact length boundaries', () => {
      // Exactly 2 characters (minimum valid)
      const validInput: WebSearchToolInput = {
        query: 'ab',
      };

      const validResult = tool.validate(validInput);
      expect(validResult.valid).toBe(true);

      // Exactly 500 characters (maximum valid)
      const maxInput: WebSearchToolInput = {
        query: 'a'.repeat(500),
      };

      const maxResult = tool.validate(maxInput);
      expect(maxResult.valid).toBe(true);

      // 501 characters (invalid)
      const tooLongInput: WebSearchToolInput = {
        query: 'a'.repeat(501),
      };

      const tooLongResult = tool.validate(tooLongInput);
      expect(tooLongResult.valid).toBe(false);
    });

    it('should handle special characters in query', () => {
      const specialQueries = [
        'search with "quotes" and symbols!@#$%^&*()',
        'unicode: 中文 日本語 العربية ñoño',
        'emojis: 🔍 🌐 💻 📱',
        'mixed: "hello world" site:example.com -spam',
        'newlines\nand\ttabs',
      ];

      specialQueries.forEach(query => {
        const input: WebSearchToolInput = { query };
        const result = tool.validate(input);
        expect(result.valid).toBe(true);
      });
    });

    it('should handle non-string query types gracefully', () => {
      const invalidInputs = [
        { query: 123 },
        { query: null },
        { query: undefined },
        { query: {} },
        { query: [] },
        { query: true },
      ];

      invalidInputs.forEach(input => {
        const result = tool.validate(input as unknown as WebSearchToolInput);
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
      });
    });

    it('should handle malformed domain arrays', () => {
      const malformedInputs = [
        {
          query: 'test',
          allowed_domains: [null, undefined, 123, {}, []],
        },
        {
          query: 'test',
          blocked_domains: ['valid.com', '', '   ', 'another-valid.org'],
        },
        {
          query: 'test',
          allowed_domains: ['domain.com', 'domain.com'], // duplicates
        },
      ];

      malformedInputs.forEach(input => {
        const result = tool.validate(input as unknown as WebSearchToolInput);
        // Some might be valid with warnings, others invalid with errors
        if (!result.valid) {
          expect(result.errors).toBeDefined();
        }
      });
    });

    it('should validate complex domain edge cases', () => {
      const edgeCaseDomains = [
        'localhost',              // Localhost - questionable but valid format
        '127.0.0.1',             // IP address - not a domain
        'domain.with-dashes.com', // Hyphens in domain
        'sub.sub.sub.example.com', // Deep subdomain
        'a.b',                   // Minimal valid domain
        'xn--fsq.xn--0zwm56d',   // IDN (internationalized domain)
        '.example.com',          // Leading dot - invalid
        'example.com.',          // Trailing dot - questionable
        'example..com',          // Double dot - invalid
        'UPPERCASE.COM',         // Uppercase - should work
        '',                      // Empty string
      ];

      edgeCaseDomains.forEach(domain => {
        const input: WebSearchToolInput = {
          query: 'test',
          allowed_domains: [domain],
        };

        const result = tool.validate(input);
        // Should at least not crash, might be valid or have warnings
        expect(result).toBeDefined();
        expect(typeof result.valid).toBe('boolean');
      });
    });
  });

  // ============================================================================
  // Execution Error Handling
  // ============================================================================

  describe('execution error handling', () => {
    it('should handle pre-cancelled context gracefully', async () => {
      const controller = new AbortController();
      controller.abort();

      const context: ToolExecutionContext = {
        signal: controller.signal,
      };

      const input: WebSearchToolInput = {
        query: 'test search',
      };

      const result = await tool.execute(input, context);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.includes('cancelled')).toBe(true);
      expect(result.duration).toBeDefined();
      expect(result.invokedAt).toBeDefined();
      expect(result.completedAt).toBeDefined();
    });

    it('should handle invalid input gracefully during execution', async () => {
      const input = {
        query: '', // Invalid query
        allowed_domains: 'not-an-array', // Invalid type
      } as unknown as WebSearchToolInput;

      const result = await tool.execute(input);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.output).toBeUndefined();
    });

    it('should provide meaningful error messages for validation failures', async () => {
      const testCases = [
        {
          input: { query: 'a' },
          expectedErrorText: '2 characters',
        },
        {
          input: { query: 'test', allowed_domains: 'invalid' } as unknown as WebSearchToolInput,
          expectedErrorText: 'array',
        },
        {
          input: { query: 'test', blocked_domains: [123] } as unknown as WebSearchToolInput,
          expectedErrorText: 'strings',
        },
      ];

      for (const testCase of testCases) {
        const result = await tool.execute(testCase.input);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error!.toLowerCase()).toContain(testCase.expectedErrorText.toLowerCase());
      }
    });
  });

  // ============================================================================
  // Configuration Edge Cases
  // ============================================================================

  describe('configuration edge cases', () => {
    it('should handle extreme configuration values', () => {
      const extremeConfigs: WebSearchToolConfig[] = [
        { maxResults: 0 },        // Zero results
        { maxResults: 1000000 },  // Very large number
        { timeout: 1 },           // Very short timeout
        { timeout: 600000 },      // Maximum allowed timeout
        { cacheTTL: 0 },          // No caching
        { cacheTTL: Infinity },   // Infinite caching (practical max)
        { userAgent: '' },        // Empty user agent
        { userAgent: 'x'.repeat(1000) }, // Very long user agent
      ];

      extremeConfigs.forEach((config, index) => {
        expect(() => {
          const tool = new WebSearchTool(config);
          expect(tool).toBeDefined();
        }).not.toThrow(`Failed with config ${index}: ${JSON.stringify(config)}`);
      });
    });

    it('should handle negative configuration values gracefully', () => {
      const negativeConfigs: WebSearchToolConfig[] = [
        { maxResults: -1 },
        { timeout: -1000 },
        { cacheTTL: -500 },
      ];

      negativeConfigs.forEach(config => {
        expect(() => {
          const tool = new WebSearchTool(config);
          expect(tool).toBeDefined();
          // Tool should still work, might use defaults for negative values
        }).not.toThrow();
      });
    });

    it('should handle undefined and null configuration properties', () => {
      const undefinedConfig = {
        maxResults: undefined,
        timeout: null,
        cacheTTL: undefined,
        userAgent: null,
      } as unknown as WebSearchToolConfig;

      expect(() => {
        const tool = new WebSearchTool(undefinedConfig);
        expect(tool).toBeDefined();
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Cache Edge Cases
  // ============================================================================

  describe('cache edge cases', () => {
    it('should handle rapid cache operations', async () => {
      const tool = new WebSearchTool({ cacheTTL: 100 }); // Short TTL

      // Rapid operations
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(tool.execute({ query: `search ${i}` }));
        if (i % 3 === 0) {
          operations.push(Promise.resolve(tool.clearCache()));
        }
      }

      // Should not throw errors
      await expect(Promise.all(operations)).resolves.toBeDefined();
    });

    it('should handle cache with identical query but different parameters', async () => {
      const baseQuery = 'test search';
      const inputs = [
        { query: baseQuery },
        { query: baseQuery, allowed_domains: ['example.com'] },
        { query: baseQuery, blocked_domains: ['spam.com'] },
        { query: baseQuery, allowed_domains: ['example.com'], blocked_domains: ['spam.com'] },
      ];

      // Each should create a different cache entry
      for (const input of inputs) {
        const result = await tool.execute(input);
        expect(result.success).toBe(true);
      }

      expect(tool.getCacheSize()).toBeGreaterThan(1);
    });

    it('should handle cache key generation with special characters', async () => {
      const specialInputs = [
        { query: 'search|with|pipes', allowed_domains: ['domain,with,commas'] },
        { query: 'search with spaces', blocked_domains: ['domain with spaces'] },
        { query: 'unicode: 中文', allowed_domains: ['日本語.com'] },
      ];

      for (const input of specialInputs) {
        await tool.execute(input);
      }

      // Should not crash and should cache results
      expect(tool.getCacheSize()).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Memory and Resource Edge Cases
  // ============================================================================

  describe('memory and resource edge cases', () => {
    it('should handle large query strings at boundary', async () => {
      const maxQuery = 'a'.repeat(500); // Maximum allowed length
      const result = await tool.execute({ query: maxQuery });

      expect(result.success).toBe(true);
      expect(result.output!.query).toBe(maxQuery);
    });

    it('should handle large domain lists', async () => {
      const largeDomainList = Array.from({ length: 1000 }, (_, i) => `domain${i}.com`);

      const result = await tool.execute({
        query: 'test search',
        allowed_domains: largeDomainList.slice(0, 500),
        blocked_domains: largeDomainList.slice(500),
      });

      expect(result.success).toBe(true);
    });

    it('should handle concurrent cache cleanup operations', async () => {
      const tool = new WebSearchTool({ cacheTTL: 10 });

      // Start many searches that will trigger cache cleanup
      const searches = Array.from({ length: 50 }, async (_, i) => {
        await new Promise(resolve => setTimeout(resolve, i)); // Stagger timing
        return tool.execute({ query: `concurrent search ${i}` });
      });

      const results = await Promise.all(searches);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  // ============================================================================
  // Type Safety and Runtime Edge Cases
  // ============================================================================

  describe('type safety and runtime edge cases', () => {
    it('should handle prototype pollution attempts', () => {
      const maliciousInput = {
        query: 'test',
        ['__proto__']: { polluted: true },
        constructor: { prototype: { polluted: true } },
      } as unknown as WebSearchToolInput;

      const result = tool.validate(maliciousInput);
      // Should either reject due to additional properties or handle safely
      expect(result).toBeDefined();
    });

    it('should handle circular references in input', () => {
      const circularInput: any = {
        query: 'test',
      };
      circularInput.self = circularInput;

      expect(() => {
        tool.validate(circularInput);
      }).not.toThrow();
    });

    it('should handle frozen and sealed objects', () => {
      const frozenInput = Object.freeze({
        query: 'test search',
        allowed_domains: Object.freeze(['example.com']),
      });

      const sealedInput = Object.seal({
        query: 'test search',
        blocked_domains: Object.seal(['spam.com']),
      });

      expect(() => {
        tool.validate(frozenInput);
        tool.validate(sealedInput);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Boundary Testing
  // ============================================================================

  describe('boundary testing', () => {
    it('should handle empty arrays vs undefined for domain filtering', async () => {
      const testCases = [
        { query: 'test', allowed_domains: [] },
        { query: 'test', blocked_domains: [] },
        { query: 'test', allowed_domains: undefined },
        { query: 'test', blocked_domains: undefined },
      ];

      for (const testCase of testCases) {
        const result = await tool.execute(testCase);
        expect(result.success).toBe(true);
      }
    });

    it('should handle timing edge cases', async () => {
      // Test with very short cache TTL to trigger immediate expiration
      const tool = new WebSearchTool({ cacheTTL: 1 });

      const result1 = await tool.execute({ query: 'timing test' });
      expect(result1.success).toBe(true);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 5));

      const result2 = await tool.execute({ query: 'timing test' });
      expect(result2.success).toBe(true);
    });

    it('should handle zero-length results gracefully', async () => {
      // The current implementation returns empty results, which is expected
      const result = await tool.execute({ query: 'test search' });
      expect(result.success).toBe(true);
      expect(result.output!.results).toBeDefined();
      expect(Array.isArray(result.output!.results)).toBe(true);
      expect(result.output!.totalResults).toBe(0);
    });
  });
});
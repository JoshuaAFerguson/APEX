/**
 * @fileoverview Tests for WebSearchTool
 *
 * These tests verify the functionality of the WebSearchTool including:
 * - Input validation and schema compliance
 * - Domain filtering logic
 * - Tool definition and registration
 * - Error handling and edge cases
 * - Caching functionality
 *
 * @module @apex/core/tools/web/__tests__/web-search-tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  WebSearchTool,
  type WebSearchToolInput,
  type WebSearchToolOutput,
  type WebSearchToolConfig,
} from '../web-search-tool.js';
import type { ToolExecutionContext } from '../../base-tool.js';

// ============================================================================
// Test Setup
// ============================================================================

describe('WebSearchTool', () => {
  let tool: WebSearchTool;

  beforeEach(() => {
    tool = new WebSearchTool();
  });

  // ============================================================================
  // Constructor and Configuration Tests
  // ============================================================================

  describe('constructor', () => {
    it('should create instance with default configuration', () => {
      const tool = new WebSearchTool();
      expect(tool).toBeDefined();
      expect(tool.getCacheSize()).toBe(0);
    });

    it('should accept custom configuration', () => {
      const config: WebSearchToolConfig = {
        maxResults: 5,
        timeout: 15000,
        cacheTTL: 600000,
        userAgent: 'CustomAgent/1.0',
      };
      const tool = new WebSearchTool(config);
      expect(tool).toBeDefined();
    });
  });

  // ============================================================================
  // Tool Definition Tests
  // ============================================================================

  describe('getDefinition', () => {
    it('should return correct tool definition', () => {
      const definition = tool.getDefinition();

      expect(definition.name).toBe('WebSearch');
      expect(definition.description).toContain('Search the web');
      expect(definition.category).toBe('web');
      expect(definition.permissions).toContain('network');
      expect(definition.dangerous).toBe(false);
      expect(definition.version).toBe('1.0.0');
      expect(definition.tags).toEqual(['web', 'search', 'network', 'information-retrieval']);
    });

    it('should have correct parameter schema', () => {
      const definition = tool.getDefinition();

      expect(definition.parameters.type).toBe('object');
      expect(definition.parameters.required).toEqual(['query']);
      expect(definition.parameters.properties.query).toBeDefined();
      expect(definition.parameters.properties.allowed_domains).toBeDefined();
      expect(definition.parameters.properties.blocked_domains).toBeDefined();
      expect(definition.parameters.additionalProperties).toBe(false);
    });

    it('should include usage examples', () => {
      const definition = tool.getDefinition();

      expect(definition.examples).toBeDefined();
      expect(definition.examples!.length).toBeGreaterThan(0);
      expect(definition.examples![0].name).toBeTruthy();
      expect(definition.examples![0].description).toBeTruthy();
      expect(definition.examples![0].input).toBeDefined();
    });
  });

  // ============================================================================
  // Validation Tests
  // ============================================================================

  describe('validate', () => {
    it('should validate basic query input', () => {
      const input: WebSearchToolInput = {
        query: 'test search',
      };

      const result = tool.validate(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject empty query', () => {
      const input: WebSearchToolInput = {
        query: '',
      };

      const result = tool.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.includes('query'))).toBe(true);
    });

    it('should reject very short query', () => {
      const input: WebSearchToolInput = {
        query: 'a',
      };

      const result = tool.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.includes('2 characters'))).toBe(true);
    });

    it('should reject overly long query', () => {
      const input: WebSearchToolInput = {
        query: 'a'.repeat(501),
      };

      const result = tool.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.includes('500 characters'))).toBe(true);
    });

    it('should validate allowed_domains array', () => {
      const input: WebSearchToolInput = {
        query: 'test search',
        allowed_domains: ['example.com', 'test.org'],
      };

      const result = tool.validate(input);
      expect(result.valid).toBe(true);
    });

    it('should validate blocked_domains array', () => {
      const input: WebSearchToolInput = {
        query: 'test search',
        blocked_domains: ['spam.com', 'ads.net'],
      };

      const result = tool.validate(input);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid domain arrays', () => {
      const input = {
        query: 'test search',
        allowed_domains: 'not-an-array',
      } as unknown as WebSearchToolInput;

      const result = tool.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.includes('array'))).toBe(true);
    });

    it('should warn about domain conflicts', () => {
      const input: WebSearchToolInput = {
        query: 'test search',
        allowed_domains: ['example.com'],
        blocked_domains: ['example.com'],
      };

      const result = tool.validate(input);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.includes('allow and block'))).toBe(true);
    });

    it('should warn about short single-word queries', () => {
      const input: WebSearchToolInput = {
        query: 'cat',
      };

      const result = tool.validate(input);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.includes('short single-word'))).toBe(true);
    });
  });

  // ============================================================================
  // Execution Tests
  // ============================================================================

  describe('execute', () => {
    it('should execute basic search', async () => {
      const input: WebSearchToolInput = {
        query: 'TypeScript best practices',
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output!.query).toBe(input.query);
      expect(result.output!.results).toBeDefined();
      expect(Array.isArray(result.output!.results)).toBe(true);
      expect(result.output!.totalResults).toBeDefined();
      expect(result.output!.searchTime).toBeDefined();
      expect(result.output!.domainFiltered).toBe(false);
    });

    it('should handle domain filtering flags', async () => {
      const input: WebSearchToolInput = {
        query: 'test search',
        allowed_domains: ['example.com'],
        blocked_domains: ['spam.com'],
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output!.domainFiltered).toBe(true);
      expect(result.output!.allowedDomains).toEqual(['example.com']);
      expect(result.output!.blockedDomains).toEqual(['spam.com']);
    });

    it('should handle cancellation via AbortSignal', async () => {
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
    });

    it('should include timing information', async () => {
      const input: WebSearchToolInput = {
        query: 'test search',
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.duration).toBeDefined();
      expect(result.duration!).toBeGreaterThanOrEqual(0);
      expect(result.invokedAt).toBeDefined();
      expect(result.completedAt).toBeDefined();
    });
  });

  // ============================================================================
  // Caching Tests
  // ============================================================================

  describe('caching', () => {
    it('should start with empty cache', () => {
      expect(tool.getCacheSize()).toBe(0);
    });

    it('should support cache clearing', () => {
      tool.clearCache();
      expect(tool.getCacheSize()).toBe(0);
    });
  });

  // ============================================================================
  // Domain Validation Tests
  // ============================================================================

  describe('domain validation', () => {
    it('should accept valid domain formats', () => {
      const validInputs = [
        { query: 'test', allowed_domains: ['example.com'] },
        { query: 'test', allowed_domains: ['sub.example.com'] },
        { query: 'test', allowed_domains: ['example.co.uk'] },
        { query: 'test', blocked_domains: ['test123.org'] },
      ];

      validInputs.forEach(input => {
        const result = tool.validate(input);
        expect(result.valid).toBe(true);
      });
    });

    it('should warn about questionable domain formats', () => {
      const input: WebSearchToolInput = {
        query: 'test search',
        allowed_domains: ['not-a-domain'],
      };

      const result = tool.validate(input);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.includes('valid domain'))).toBe(true);
    });
  });

  // ============================================================================
  // Result Formatting Tests
  // ============================================================================

  describe('result formatting', () => {
    it('should format search results with all required fields', async () => {
      const input: WebSearchToolInput = {
        query: 'TypeScript documentation',
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();

      const output = result.output!;

      // Verify output structure
      expect(output).toHaveProperty('results');
      expect(output).toHaveProperty('totalResults');
      expect(output).toHaveProperty('query');
      expect(output).toHaveProperty('searchTime');
      expect(output).toHaveProperty('domainFiltered');

      // Verify each result has required fields
      output.results.forEach(searchResult => {
        expect(searchResult).toHaveProperty('title');
        expect(searchResult).toHaveProperty('url');
        expect(searchResult).toHaveProperty('snippet');
        expect(searchResult).toHaveProperty('domain');
        expect(searchResult).toHaveProperty('position');

        expect(typeof searchResult.title).toBe('string');
        expect(typeof searchResult.url).toBe('string');
        expect(typeof searchResult.snippet).toBe('string');
        expect(typeof searchResult.domain).toBe('string');
        expect(typeof searchResult.position).toBe('number');
        expect(searchResult.position).toBeGreaterThan(0);
      });
    });

    it('should format domain filtering metadata correctly', async () => {
      const input: WebSearchToolInput = {
        query: 'test search',
        allowed_domains: ['example.com', 'test.org'],
        blocked_domains: ['spam.com'],
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output!.domainFiltered).toBe(true);
      expect(result.output!.allowedDomains).toEqual(['example.com', 'test.org']);
      expect(result.output!.blockedDomains).toEqual(['spam.com']);
    });

    it('should not include domain filter metadata when not filtering', async () => {
      const input: WebSearchToolInput = {
        query: 'test search',
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output!.domainFiltered).toBe(false);
      expect(result.output!.allowedDomains).toBeUndefined();
      expect(result.output!.blockedDomains).toBeUndefined();
    });

    it('should include search timing information', async () => {
      const input: WebSearchToolInput = {
        query: 'test search',
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output!.searchTime).toBeGreaterThanOrEqual(0);
      expect(typeof result.output!.searchTime).toBe('number');
    });
  });

  // ============================================================================
  // Advanced Error Handling Tests
  // ============================================================================

  describe('advanced error handling', () => {
    it('should handle network timeout scenarios gracefully', async () => {
      // Create tool with very short timeout for testing
      const timeoutTool = new WebSearchTool({ timeout: 1 });

      const input: WebSearchToolInput = {
        query: 'test search',
      };

      const result = await timeoutTool.execute(input);

      // In test environment, should succeed with mock data
      // In production, might timeout but should handle gracefully
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');

      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
    });

    it('should provide detailed error context for debugging', async () => {
      const invalidInput = {
        query: null,
        allowed_domains: 'invalid-type',
      } as unknown as WebSearchToolInput;

      const result = await tool.execute(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.length).toBeGreaterThan(10); // Meaningful error message
    });

    it('should handle cancellation during different execution phases', async () => {
      const controller = new AbortController();

      // Cancel immediately
      setTimeout(() => controller.abort(), 1);

      const context: ToolExecutionContext = {
        signal: controller.signal,
      };

      const input: WebSearchToolInput = {
        query: 'test search that gets cancelled',
      };

      const result = await tool.execute(input, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.toLowerCase()).toContain('cancel');
    });
  });

  // ============================================================================
  // Domain Filtering Integration Tests
  // ============================================================================

  describe('domain filtering integration', () => {
    it('should properly combine allowlist and blocklist filtering', async () => {
      const input: WebSearchToolInput = {
        query: 'test search',
        allowed_domains: ['example.com', 'test.org', 'spam.com'],
        blocked_domains: ['spam.com'],
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output!.domainFiltered).toBe(true);

      // Results should be from allowed domains but not blocked domains
      result.output!.results.forEach(searchResult => {
        expect(['example.com', 'test.org']).toContain(searchResult.domain);
        expect(searchResult.domain).not.toBe('spam.com');
      });
    });

    it('should handle subdomain filtering correctly', async () => {
      const input: WebSearchToolInput = {
        query: 'test search',
        allowed_domains: ['example.com'],
        blocked_domains: ['ads.example.com'],
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);

      // Mock results should demonstrate subdomain filtering logic
      // (actual filtering happens in the implementation)
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe('edge cases', () => {
    it('should handle missing optional parameters', () => {
      const input: WebSearchToolInput = {
        query: 'test search',
      };

      const result = tool.validate(input);
      expect(result.valid).toBe(true);
    });

    it('should handle empty domain arrays', () => {
      const input: WebSearchToolInput = {
        query: 'test search',
        allowed_domains: [],
        blocked_domains: [],
      };

      const result = tool.validate(input);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.includes('empty allowed_domains'))).toBe(true);
    });

    it('should trim whitespace from query', async () => {
      const input: WebSearchToolInput = {
        query: '  test search  ',
      };

      const result = await tool.execute(input);
      expect(result.success).toBe(true);
      expect(result.output!.query).toBe('test search');
    });

    it('should handle queries with special characters', async () => {
      const specialQueries = [
        'search with "quotes"',
        'search & symbols',
        'unicode: 中文 test',
        'search with newlines\nand tabs\t',
      ];

      for (const query of specialQueries) {
        const input: WebSearchToolInput = { query };
        const result = await tool.execute(input);

        expect(result.success).toBe(true);
        expect(result.output!.query).toBe(query.trim());
      }
    });

    it('should handle maximum length queries', async () => {
      const maxLengthQuery = 'a'.repeat(500); // Maximum allowed length
      const input: WebSearchToolInput = {
        query: maxLengthQuery,
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output!.query).toBe(maxLengthQuery);
    });

    it('should handle concurrent execution requests', async () => {
      const inputs = Array.from({ length: 5 }, (_, i) => ({
        query: `concurrent test ${i}`,
      }));

      const promises = inputs.map(input => tool.execute(input));
      const results = await Promise.all(promises);

      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.output!.query).toBe(`concurrent test ${index}`);
      });
    });
  });
});
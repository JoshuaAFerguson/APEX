/**
 * @fileoverview Error Handling Tests for Marketplace Fixtures
 *
 * Tests error conditions, validation failures, and recovery scenarios
 * for marketplace types and fixtures.
 */

import { describe, expect, it } from 'vitest';
import {
  MCPMarketplaceEntrySchema,
  MCPMarketplaceSchema,
  MCPMarketplaceSourceSchema,
  MCPServerConfigSchema,
  MCPServerSchema,
} from '../../types.js';
import {
  baseFilesystemMarketplaceEntry,
  baseMarketplace,
  baseMarketplaceSource,
  createMarketplaceEntry,
  createServerConfig,
  createMarketplace,
  getVerifiedEntries,
  getEntriesByCapability,
} from '../marketplace.js';

describe('Marketplace Error Handling', () => {
  describe('Schema validation error scenarios', () => {
    it('should provide detailed error for missing required server config fields', () => {
      const invalidConfig = {
        // Missing name, type, command
        autoStart: false,
      };

      try {
        MCPServerConfigSchema.parse(invalidConfig);
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.issues).toBeDefined();
        expect(error.issues.some((issue: any) =>
          issue.path.includes('name') && issue.code === 'invalid_type'
        )).toBe(true);
        expect(error.issues.some((issue: any) =>
          issue.path.includes('command') && issue.code === 'invalid_type'
        )).toBe(true);
      }
    });

    it('should provide detailed error for invalid marketplace entry fields', () => {
      const invalidEntry = {
        name: '', // Empty string should fail
        description: 123, // Should be string
        version: null, // Should be string
        author: undefined, // Required field
        verified: 'yes', // Should be boolean
        serverConfig: 'invalid', // Should be object
      };

      try {
        MCPMarketplaceEntrySchema.parse(invalidEntry);
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.issues).toBeDefined();
        expect(error.issues.length).toBeGreaterThan(5);

        // Check specific validation errors
        const nameIssue = error.issues.find((issue: any) => issue.path[0] === 'name');
        expect(nameIssue?.code).toBe('too_small');

        const descIssue = error.issues.find((issue: any) => issue.path[0] === 'description');
        expect(descIssue?.code).toBe('invalid_type');

        const verifiedIssue = error.issues.find((issue: any) => issue.path[0] === 'verified');
        expect(verifiedIssue?.code).toBe('invalid_type');
      }
    });

    it('should handle nested validation errors in marketplace source', () => {
      const invalidSource = {
        url: 123, // Should be string
        enabled: 'true', // Should be boolean
        refreshIntervalMinutes: 'invalid', // Should be number
        allowUnverified: null, // Should be boolean
      };

      try {
        MCPMarketplaceSourceSchema.parse(invalidSource);
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.issues).toBeDefined();
        expect(error.issues.every((issue: any) => issue.code === 'invalid_type')).toBe(true);
      }
    });

    it('should validate URL format in marketplace source', () => {
      const invalidUrlFormats = [
        'not-a-url',
        'htp://invalid-protocol.com',
        '://missing-protocol.com',
        'https://',
        'file:/missing-path',
        'data:text/plain,not-a-catalog',
      ];

      for (const invalidUrl of invalidUrlFormats) {
        const sourceWithInvalidUrl = {
          url: invalidUrl,
          enabled: true,
          refreshIntervalMinutes: 60,
          allowUnverified: false,
        };

        expect(() => MCPMarketplaceSourceSchema.parse(sourceWithInvalidUrl)).toThrow();
      }
    });

    it('should validate semantic version format in server schema', () => {
      const invalidVersions = [
        'v1.0.0', // Should not have 'v' prefix
        '1.0', // Missing patch version
        '1.0.0.0', // Too many version parts
        '01.0.0', // Leading zeros
        '1.0.0-', // Invalid pre-release
        '1.0.0+', // Invalid build metadata
        'latest', // Non-semantic version
        '', // Empty string
      ];

      for (const invalidVersion of invalidVersions) {
        const serverWithInvalidVersion = {
          name: 'test-server',
          package: '@test/server',
          command: 'test',
          args: [],
          env: {},
          envVars: [],
          version: invalidVersion,
        };

        expect(() => MCPServerSchema.parse(serverWithInvalidVersion)).toThrow();
      }
    });
  });

  describe('Fixture creation error scenarios', () => {
    it('should handle invalid overrides in createMarketplaceEntry', () => {
      // Test with invalid server config override
      expect(() => {
        createMarketplaceEntry(baseFilesystemMarketplaceEntry, {
          serverConfig: {
            name: '', // Empty name should cause issues downstream
            type: 'invalid' as any, // Invalid type
            command: '', // Empty command
          },
        });
      }).not.toThrow(); // Function doesn't validate, but result should fail validation

      // The created entry should fail validation when parsed
      const invalidEntry = createMarketplaceEntry(baseFilesystemMarketplaceEntry, {
        serverConfig: {
          name: '',
          type: 'invalid' as any,
          command: '',
        },
      });

      expect(() => MCPMarketplaceEntrySchema.parse(invalidEntry)).toThrow();
    });

    it('should handle circular references in fixture creation', () => {
      const circularRef: any = { name: 'circular' };
      circularRef.self = circularRef;

      // Should not crash when trying to create entry with circular reference
      expect(() => {
        createMarketplaceEntry(baseFilesystemMarketplaceEntry, circularRef);
      }).not.toThrow();
    });

    it('should handle null and undefined overrides gracefully', () => {
      const entryWithNulls = createMarketplaceEntry(baseFilesystemMarketplaceEntry, {
        homepage: null as any,
        repository: undefined,
        capabilities: null as any,
      });

      // Should preserve original values or handle nulls appropriately
      expect(entryWithNulls.homepage).toBe(null);
      expect(entryWithNulls.repository).toBe(baseFilesystemMarketplaceEntry.repository);
      expect(entryWithNulls.capabilities).toBe(null);
    });

    it('should handle deep object mutations in createServerConfig', () => {
      const deepEnv = {
        NESTED: JSON.stringify({
          level1: {
            level2: {
              value: 'deep'
            }
          }
        })
      };

      const configWithDeepEnv = createServerConfig(baseFilesystemMarketplaceEntry.serverConfig, {
        env: deepEnv,
      });

      expect(configWithDeepEnv.env).toEqual(deepEnv);
      expect(() => MCPServerConfigSchema.parse(configWithDeepEnv)).not.toThrow();
    });
  });

  describe('Filtering function error scenarios', () => {
    it('should handle empty marketplace when filtering verified entries', () => {
      // Mock empty marketplace entries temporarily
      const originalValues = Object.values;
      Object.values = () => [];

      try {
        const verifiedEntries = getVerifiedEntries();
        expect(verifiedEntries).toEqual([]);
      } finally {
        Object.values = originalValues;
      }
    });

    it('should handle malformed entries in filtering functions', () => {
      // Test with entries missing expected fields
      const malformedEntries = [
        { verified: undefined, capabilities: ['tools'] },
        { verified: true, capabilities: null },
        { verified: 'yes' as any, capabilities: [] },
        { capabilities: undefined },
      ];

      // Mock the marketplace entries
      const originalValues = Object.values;
      Object.values = () => malformedEntries;

      try {
        // Should handle gracefully without throwing
        const verifiedEntries = getVerifiedEntries();
        expect(verifiedEntries).toBeInstanceOf(Array);

        const toolEntries = getEntriesByCapability('tools');
        expect(toolEntries).toBeInstanceOf(Array);
      } finally {
        Object.values = originalValues;
      }
    });

    it('should handle special characters in capability filtering', () => {
      const specialCapabilities = [
        'tools/advanced',
        'data-processing',
        'ai/ml',
        'web:scraping',
        'file@system',
        'memory+cache',
        'git#version-control',
        'networking%protocols',
      ];

      for (const capability of specialCapabilities) {
        // Should not throw even with special characters
        expect(() => getEntriesByCapability(capability)).not.toThrow();
      }
    });

    it('should handle case sensitivity in capability filtering', () => {
      const caseVariations = [
        'TOOLS',
        'Tools',
        'tools',
        'RESOURCES',
        'Resources',
        'resources',
      ];

      for (const capability of caseVariations) {
        const entries = getEntriesByCapability(capability);
        expect(entries).toBeInstanceOf(Array);
        // Current implementation is case-sensitive, so upper/mixed case should return empty
        if (capability.toLowerCase() !== capability) {
          expect(entries).toHaveLength(0);
        }
      }
    });
  });

  describe('Memory and performance error scenarios', () => {
    it('should handle large marketplace creation without memory issues', () => {
      const largeServerList = Array.from({ length: 10000 }, (_, i) => ({
        ...baseFilesystemMarketplaceEntry,
        name: `server-${i}`,
        description: `Generated server ${i} `.repeat(100), // Make it large
      }));

      const largeMarketplace = createMarketplace(baseMarketplace, {
        servers: largeServerList,
      });

      expect(largeMarketplace.servers).toHaveLength(10000);
      expect(largeMarketplace.servers[0].name).toBe('server-0');
      expect(largeMarketplace.servers[9999].name).toBe('server-9999');
    });

    it('should handle deeply nested configuration objects', () => {
      const deeplyNestedEnv: Record<string, string> = {};

      // Create very long environment variable names and values
      for (let i = 0; i < 100; i++) {
        const longKey = `VERY_LONG_ENVIRONMENT_VARIABLE_NAME_${i}_`.repeat(10);
        const longValue = `very-long-environment-variable-value-${i}-`.repeat(10);
        deeplyNestedEnv[longKey] = longValue;
      }

      const configWithDeepEnv = createServerConfig(baseFilesystemMarketplaceEntry.serverConfig, {
        env: deeplyNestedEnv,
      });

      expect(Object.keys(configWithDeepEnv.env!)).toHaveLength(100);
      expect(() => MCPServerConfigSchema.parse(configWithDeepEnv)).not.toThrow();
    });
  });

  describe('Concurrent access error scenarios', () => {
    it('should handle concurrent fixture creation', async () => {
      const concurrentOperations = Array.from({ length: 100 }, (_, i) =>
        Promise.resolve(createMarketplaceEntry(baseFilesystemMarketplaceEntry, {
          name: `concurrent-server-${i}`,
          verified: i % 2 === 0,
        }))
      );

      const results = await Promise.all(concurrentOperations);

      expect(results).toHaveLength(100);
      expect(results.every(entry => entry.name.startsWith('concurrent-server-'))).toBe(true);
      expect(results.filter(entry => entry.verified)).toHaveLength(50);
    });

    it('should handle concurrent filtering operations', async () => {
      const concurrentFilters = Array.from({ length: 50 }, () =>
        Promise.resolve(getVerifiedEntries())
      );

      const results = await Promise.all(concurrentFilters);

      expect(results).toHaveLength(50);
      expect(results.every(entries => Array.isArray(entries))).toBe(true);
      expect(results.every(entries => entries.length > 0)).toBe(true);

      // All results should be identical
      const firstResult = results[0];
      expect(results.every(result =>
        result.length === firstResult.length &&
        result.every((entry, i) => entry.name === firstResult[i].name)
      )).toBe(true);
    });
  });

  describe('Data integrity error scenarios', () => {
    it('should detect inconsistent marketplace data', () => {
      const inconsistentMarketplace = {
        ...baseMarketplace,
        servers: [
          {
            ...baseFilesystemMarketplaceEntry,
            version: '1.0.0',
            serverConfig: {
              ...baseFilesystemMarketplaceEntry.serverConfig,
              // Inconsistent: entry version doesn't match config expectations
            }
          }
        ]
      };

      // The schema should still validate since there's no cross-field validation
      expect(() => MCPMarketplaceSchema.parse(inconsistentMarketplace)).not.toThrow();
    });

    it('should handle malformed ISO date strings', () => {
      const malformedDates = [
        'not-a-date',
        '2023-13-01T00:00:00.000Z', // Invalid month
        '2023-01-32T00:00:00.000Z', // Invalid day
        '2023-01-01T25:00:00.000Z', // Invalid hour
        '2023-01-01T00:60:00.000Z', // Invalid minute
        '2023-01-01T00:00:60.000Z', // Invalid second
        '2023-01-01', // Missing time part
        'T00:00:00.000Z', // Missing date part
      ];

      for (const malformedDate of malformedDates) {
        const marketplaceWithBadDate = {
          ...baseMarketplace,
          lastUpdated: malformedDate,
        };

        expect(() => MCPMarketplaceSchema.parse(marketplaceWithBadDate)).toThrow();
      }
    });

    it('should handle environment variables with special values', () => {
      const specialEnvValues = {
        EMPTY_STRING: '',
        WHITESPACE_ONLY: '   ',
        SPECIAL_CHARS: '!@#$%^&*()_+-=[]{}|;:,.<>?',
        UNICODE: '你好世界🌍',
        VERY_LONG: 'a'.repeat(10000),
        JSON_STRING: JSON.stringify({ nested: { data: 'value' } }),
        URL_STRING: 'https://example.com/path?param=value&other=123',
        MULTILINE: 'line1\nline2\nline3',
        NULL_STRING: 'null',
        UNDEFINED_STRING: 'undefined',
        BOOLEAN_STRING: 'true',
        NUMBER_STRING: '42',
      };

      const configWithSpecialEnv = createServerConfig(baseFilesystemMarketplaceEntry.serverConfig, {
        env: specialEnvValues,
      });

      expect(() => MCPServerConfigSchema.parse(configWithSpecialEnv)).not.toThrow();
      expect(configWithSpecialEnv.env).toEqual(specialEnvValues);
    });
  });

  describe('Recovery and fallback scenarios', () => {
    it('should provide meaningful error messages for common mistakes', () => {
      const commonMistakes = [
        {
          name: 'Missing serverConfig in marketplace entry',
          data: {
            name: 'test-server',
            description: 'Test server',
            version: '1.0.0',
            author: 'Test',
            verified: true,
            // Missing serverConfig
          },
          expectedErrorPattern: /serverConfig/i,
        },
        {
          name: 'Wrong type for verified field',
          data: {
            name: 'test-server',
            description: 'Test server',
            version: '1.0.0',
            author: 'Test',
            verified: 'yes', // Should be boolean
            serverConfig: baseFilesystemMarketplaceEntry.serverConfig,
          },
          expectedErrorPattern: /boolean/i,
        },
        {
          name: 'Invalid refresh interval in source',
          data: {
            url: 'https://example.com/catalog.json',
            enabled: true,
            refreshIntervalMinutes: -5, // Should be positive
            allowUnverified: false,
          },
          expectedErrorPattern: /greater/i,
        },
      ];

      for (const mistake of commonMistakes) {
        try {
          if (mistake.name.includes('marketplace entry')) {
            MCPMarketplaceEntrySchema.parse(mistake.data);
          } else if (mistake.name.includes('source')) {
            MCPMarketplaceSourceSchema.parse(mistake.data);
          }
          expect.fail(`Should have thrown error for: ${mistake.name}`);
        } catch (error: any) {
          expect(error.message).toMatch(mistake.expectedErrorPattern);
        }
      }
    });
  });
});
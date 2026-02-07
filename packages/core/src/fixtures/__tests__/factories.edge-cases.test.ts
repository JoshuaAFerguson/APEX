/**
 * @fileoverview Edge Case Tests for Marketplace Factory Functions
 *
 * Tests boundary conditions, unusual inputs, and edge cases to ensure
 * factory functions are robust and handle unexpected scenarios gracefully.
 */

import { describe, expect, it } from 'vitest';
import {
  MCPServerConfigSchema,
  MCPServerSchema,
  MCPMarketplaceEntrySchema,
} from '../../types.js';
import {
  createMCPServer,
  createMCPServerConfig,
  createMCPMarketplaceEntry,
  type MCPServerFactoryOptions,
  type MCPServerConfigFactoryOptions,
  type MCPMarketplaceEntryFactoryOptions,
} from '../marketplace.js';

describe('Marketplace Factory Edge Cases', () => {
  describe('Empty and Minimal Inputs', () => {
    it('should handle empty override objects', () => {
      const server = createMCPServer({});
      const config = createMCPServerConfig({});
      const entry = createMCPMarketplaceEntry({});

      expect(MCPServerSchema.safeParse(server).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(config).success).toBe(true);
      expect(MCPMarketplaceEntrySchema.safeParse(entry).success).toBe(true);

      // Should still have default values
      expect(server.name).toMatch(/^test-server-\d+-[a-z0-9]+$/);
      expect(config.name).toMatch(/^test-config-\d+-[a-z0-9]+$/);
      expect(entry.name).toMatch(/^test-marketplace-entry-\d+-[a-z0-9]+$/);
    });

    it('should handle empty options objects', () => {
      const emptyOptions: MCPServerFactoryOptions = {};
      const emptyConfigOptions: MCPServerConfigFactoryOptions = {};
      const emptyEntryOptions: MCPMarketplaceEntryFactoryOptions = {};

      const server = createMCPServer({}, emptyOptions);
      const config = createMCPServerConfig({}, emptyConfigOptions);
      const entry = createMCPMarketplaceEntry({}, emptyEntryOptions);

      expect(MCPServerSchema.safeParse(server).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(config).success).toBe(true);
      expect(MCPMarketplaceEntrySchema.safeParse(entry).success).toBe(true);

      // Should use default option values
      expect(server.env).toEqual({});
      expect(server.envVars).toEqual([]);
      expect(config.type).toBe('stdio');
      expect(entry.verified).toBe(false);
    });

    it('should handle null and undefined property values', () => {
      const server = createMCPServer({
        name: 'test-server',
        package: '@test/server',
        description: undefined,
        homepage: null as any,
        env: undefined,
        envVars: null as any,
      });

      const config = createMCPServerConfig({
        name: 'test-config',
        env: undefined,
        url: null as any,
        envVars: undefined,
      });

      const entry = createMCPMarketplaceEntry({
        name: 'Test Entry',
        description: 'Test description',
        author: undefined,
        homepage: null as any,
        repository: undefined,
        capabilities: null as any,
      });

      expect(MCPServerSchema.safeParse(server).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(config).success).toBe(true);
      expect(MCPMarketplaceEntrySchema.safeParse(entry).success).toBe(true);

      // Verify null/undefined values are handled appropriately
      expect(server.env).toEqual({});
      expect(server.envVars).toEqual([]);
      expect(config.env).toBeUndefined();
      expect(entry.capabilities).toEqual(['tools']); // Default fallback
    });
  });

  describe('Extreme String Values', () => {
    it('should handle very long strings', () => {
      const longString = 'a'.repeat(1000);
      const veryLongString = 'b'.repeat(10000);

      const server = createMCPServer({
        name: `server-${longString}`,
        package: `@test/${longString}`,
        description: veryLongString,
      });

      const config = createMCPServerConfig({
        name: `config-${longString}`,
      });

      const entry = createMCPMarketplaceEntry({
        name: `Entry ${longString}`,
        description: veryLongString,
      });

      expect(MCPServerSchema.safeParse(server).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(config).success).toBe(true);
      expect(MCPMarketplaceEntrySchema.safeParse(entry).success).toBe(true);

      expect(server.name).toContain(longString);
      expect(server.description).toBe(veryLongString);
    });

    it('should handle empty strings where allowed', () => {
      // Test with empty strings for optional fields
      const server = createMCPServer({
        name: 'test-server',
        package: '@test/server',
        description: '',
        homepage: '',
      });

      const entry = createMCPMarketplaceEntry({
        name: 'Test Entry',
        description: 'Test description',
        author: '',
        homepage: '',
        repository: '',
      });

      expect(MCPServerSchema.safeParse(server).success).toBe(true);
      expect(MCPMarketplaceEntrySchema.safeParse(entry).success).toBe(true);

      expect(server.description).toBe('');
      expect(entry.author).toBe('');
    });

    it('should handle special characters and Unicode', () => {
      const unicodeString = 'Test 🚀 Server Ñoño 中文 العربية';
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

      const server = createMCPServer({
        name: `${unicodeString}-${specialChars}`,
        package: '@test/unicode-server',
        description: `Description with ${unicodeString} and ${specialChars}`,
      });

      const config = createMCPServerConfig({
        name: `config-${unicodeString}`,
      });

      const entry = createMCPMarketplaceEntry({
        name: unicodeString,
        description: `Entry with ${specialChars}`,
      });

      expect(MCPServerSchema.safeParse(server).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(config).success).toBe(true);
      expect(MCPMarketplaceEntrySchema.safeParse(entry).success).toBe(true);

      expect(server.name).toContain(unicodeString);
      expect(entry.name).toBe(unicodeString);
    });
  });

  describe('Array and Object Edge Cases', () => {
    it('should handle empty arrays', () => {
      const server = createMCPServer({
        args: [],
        envVars: [],
      });

      const config = createMCPServerConfig({
        args: [],
        envVars: [],
      });

      const entry = createMCPMarketplaceEntry({
        capabilities: [],
      });

      expect(MCPServerSchema.safeParse(server).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(config).success).toBe(true);
      expect(MCPMarketplaceEntrySchema.safeParse(entry).success).toBe(true);

      expect(server.args).toEqual([]);
      expect(server.envVars).toEqual([]);
      expect(entry.capabilities).toEqual([]);
    });

    it('should handle very large arrays', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => `arg-${i}`);
      const largeEnvVars = Array.from({ length: 100 }, (_, i) => ({
        name: `VAR_${i}`,
        description: `Variable ${i}`,
        required: i % 2 === 0,
      }));

      const server = createMCPServer({
        args: largeArray,
        envVars: largeEnvVars,
      });

      const config = createMCPServerConfig({
        args: largeArray,
        envVars: largeEnvVars,
      });

      expect(MCPServerSchema.safeParse(server).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(config).success).toBe(true);

      expect(server.args).toHaveLength(1000);
      expect(server.envVars).toHaveLength(100);
      expect(config.args).toHaveLength(1000);
    });

    it('should handle empty objects', () => {
      const server = createMCPServer({
        env: {},
      });

      const config = createMCPServerConfig({
        env: {},
      });

      expect(MCPServerSchema.safeParse(server).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(config).success).toBe(true);

      expect(server.env).toEqual({});
      expect(config.env).toEqual({});
    });

    it('should handle objects with many properties', () => {
      const largeEnv: Record<string, string> = {};
      for (let i = 0; i < 1000; i++) {
        largeEnv[`ENV_VAR_${i}`] = `value-${i}`;
      }

      const server = createMCPServer({
        env: largeEnv,
      });

      const config = createMCPServerConfig({
        env: largeEnv,
      });

      expect(MCPServerSchema.safeParse(server).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(config).success).toBe(true);

      expect(Object.keys(server.env)).toHaveLength(1000);
      expect(Object.keys(config.env)).toHaveLength(1000);
      expect(server.env.ENV_VAR_999).toBe('value-999');
    });
  });

  describe('Boundary Value Testing', () => {
    it('should handle minimum valid string lengths', () => {
      const server = createMCPServer({
        name: 'a', // Minimum length
        package: 'b', // Minimum length
      });

      const config = createMCPServerConfig({
        name: 'c', // Minimum length
      });

      const entry = createMCPMarketplaceEntry({
        name: 'd', // Minimum length
        description: 'e', // Minimum length
        version: 'f', // Minimum length
      });

      expect(MCPServerSchema.safeParse(server).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(config).success).toBe(true);
      expect(MCPMarketplaceEntrySchema.safeParse(entry).success).toBe(true);
    });

    it('should handle all possible enum values', () => {
      const connectionTypes: Array<'stdio' | 'http' | 'sse' | 'sdk'> = ['stdio', 'http', 'sse', 'sdk'];

      connectionTypes.forEach(type => {
        const config = createMCPServerConfig({ type });
        expect(MCPServerConfigSchema.safeParse(config).success).toBe(true);
        expect(config.type).toBe(type);
      });
    });

    it('should handle boundary cases for boolean options', () => {
      // Test all boolean combinations for options
      const booleanOptions = [true, false];

      booleanOptions.forEach(includeEnv => {
        booleanOptions.forEach(includeEnvVars => {
          const server = createMCPServer({}, { includeEnv, includeEnvVars });
          expect(MCPServerSchema.safeParse(server).success).toBe(true);

          if (includeEnv) {
            expect(server.env).toEqual({ NODE_ENV: 'test' });
          } else {
            expect(server.env).toEqual({});
          }
        });
      });

      booleanOptions.forEach(autoStart => {
        booleanOptions.forEach(includeEnv => {
          const config = createMCPServerConfig({}, { autoStart, includeEnv });
          expect(MCPServerConfigSchema.safeParse(config).success).toBe(true);
          expect(config.autoStart).toBe(autoStart);
        });
      });

      booleanOptions.forEach(verified => {
        booleanOptions.forEach(includeCapabilities => {
          const entry = createMCPMarketplaceEntry({}, { verified, includeCapabilities });
          expect(MCPMarketplaceEntrySchema.safeParse(entry).success).toBe(true);
          expect(entry.verified).toBe(verified);
        });
      });
    });
  });

  describe('Complex Nested Structures', () => {
    it('should handle deeply nested serverConfig overrides', () => {
      const complexConfig = {
        name: 'complex-config',
        type: 'http' as const,
        url: 'https://example.com/mcp',
        autoStart: true,
        env: {
          NODE_ENV: 'production',
          API_URL: 'https://api.example.com',
          COMPLEX_JSON: JSON.stringify({
            nested: {
              deep: {
                value: 'test',
                array: [1, 2, 3],
                bool: true,
              },
            },
          }),
        },
        envVars: [
          {
            name: 'COMPLEX_VAR',
            description: 'A complex environment variable',
            required: true,
            defaultValue: 'default',
          },
        ],
      };

      const entry = createMCPMarketplaceEntry({
        name: 'Complex Entry',
        description: 'Entry with complex server config',
        serverConfig: complexConfig,
      });

      expect(MCPMarketplaceEntrySchema.safeParse(entry).success).toBe(true);

      expect(entry.serverConfig.type).toBe('http');
      expect(entry.serverConfig.env.COMPLEX_JSON).toBeDefined();
      expect(entry.serverConfig.envVars).toHaveLength(1);
      expect(entry.serverConfig.envVars[0].required).toBe(true);

      // Verify JSON can be parsed back
      const parsedJson = JSON.parse(entry.serverConfig.env.COMPLEX_JSON);
      expect(parsedJson.nested.deep.value).toBe('test');
    });

    it('should handle circular-like references in configurations', () => {
      const baseConfig = createMCPServerConfig({
        name: 'base-config',
        type: 'stdio',
      });

      // Create entry that references the base config
      const entry = createMCPMarketplaceEntry({
        name: 'Referenced Entry',
        description: 'Entry that references base config',
        serverConfig: {
          ...baseConfig,
          name: 'derived-config',
          env: {
            BASE_CONFIG_NAME: baseConfig.name,
            SELF_REFERENCE: 'derived-config',
          },
        },
      });

      expect(MCPMarketplaceEntrySchema.safeParse(entry).success).toBe(true);

      expect(entry.serverConfig.name).toBe('derived-config');
      expect(entry.serverConfig.env.BASE_CONFIG_NAME).toBe('base-config');
      expect(entry.serverConfig.env.SELF_REFERENCE).toBe('derived-config');
    });
  });

  describe('Unique ID Generation Edge Cases', () => {
    it('should generate unique IDs even with rapid calls', async () => {
      const concurrentCalls = 100;
      const promises: Promise<any>[] = [];

      // Create many items concurrently
      for (let i = 0; i < concurrentCalls; i++) {
        promises.push(
          Promise.resolve().then(() => ({
            server: createMCPServer(),
            config: createMCPServerConfig(),
            entry: createMCPMarketplaceEntry(),
          }))
        );
      }

      const results = await Promise.all(promises);

      // Extract all generated names
      const serverNames = results.map(r => r.server.name);
      const configNames = results.map(r => r.config.name);
      const entryNames = results.map(r => r.entry.name);

      // Verify uniqueness
      expect(new Set(serverNames).size).toBe(concurrentCalls);
      expect(new Set(configNames).size).toBe(concurrentCalls);
      expect(new Set(entryNames).size).toBe(concurrentCalls);

      // Verify all are valid
      results.forEach(({ server, config, entry }) => {
        expect(MCPServerSchema.safeParse(server).success).toBe(true);
        expect(MCPServerConfigSchema.safeParse(config).success).toBe(true);
        expect(MCPMarketplaceEntrySchema.safeParse(entry).success).toBe(true);
      });
    });

    it('should handle ID generation across different factory types', () => {
      // Create items of different types to ensure ID generation doesn't conflict
      const mixed = [];

      for (let i = 0; i < 10; i++) {
        mixed.push(
          createMCPServer({ name: `mixed-server-${i}` }),
          createMCPServerConfig({ name: `mixed-config-${i}` }),
          createMCPMarketplaceEntry({ name: `Mixed Entry ${i}` })
        );
      }

      // All should be valid and unique
      expect(mixed).toHaveLength(30); // 10 * 3 types

      // Check that there's no unexpected collision in generated content
      const allNames = mixed.map((item: any) => item.name);
      expect(new Set(allNames).size).toBe(30);
    });
  });

  describe('Type Coercion and Validation Edge Cases', () => {
    it('should handle type coercion properly', () => {
      // Test values that might be coerced
      const server = createMCPServer({
        name: 'test-server',
        package: '@test/server',
        version: '1.0', // Should remain a string
        args: ['arg1', 'arg2'], // Should remain array
      });

      const config = createMCPServerConfig({
        name: 'test-config',
        autoStart: false, // Should remain boolean
        type: 'stdio', // Should remain string enum
      });

      expect(MCPServerSchema.safeParse(server).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(config).success).toBe(true);

      expect(typeof server.version).toBe('string');
      expect(Array.isArray(server.args)).toBe(true);
      expect(typeof config.autoStart).toBe('boolean');
      expect(config.type).toBe('stdio');
    });

    it('should handle edge cases with environment variables', () => {
      const edgeCaseEnvVars = [
        {
          name: 'EMPTY_DESC',
          description: '',
          required: false,
        },
        {
          name: 'NO_DEFAULT',
          description: 'Variable without default',
          required: true,
          // No defaultValue property
        },
        {
          name: 'WITH_DEFAULT',
          description: 'Variable with default',
          required: false,
          defaultValue: '',
        },
      ];

      const server = createMCPServer({
        envVars: edgeCaseEnvVars,
      });

      expect(MCPServerSchema.safeParse(server).success).toBe(true);
      expect(server.envVars).toHaveLength(3);

      // Verify each edge case
      expect(server.envVars[0].description).toBe('');
      expect(server.envVars[1].defaultValue).toBeUndefined();
      expect(server.envVars[2].defaultValue).toBe('');
    });
  });
});
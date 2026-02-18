/**
 * @fileoverview Error Handling Tests for Marketplace Factory Functions
 *
 * Tests error conditions, invalid inputs, and graceful failure scenarios
 * to ensure factory functions handle errors appropriately and provide
 * meaningful feedback.
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

describe('Marketplace Factory Error Handling', () => {
  describe('Schema Validation Failures', () => {
    it('should create invalid objects that fail schema validation for required fields', () => {
      // Test creating objects that should fail validation when empty required fields are provided

      // MCPServer with empty required fields
      const invalidServer = createMCPServer({
        name: '', // Empty string should fail validation
        package: '', // Empty string should fail validation
      });

      const serverValidation = MCPServerSchema.safeParse(invalidServer);
      expect(serverValidation.success).toBe(false);
      if (!serverValidation.success) {
        expect(serverValidation.error.issues).toHaveLength(2); // name and package errors
        expect(serverValidation.error.issues.some(issue =>
          issue.path.includes('name') && issue.message.includes('at least 1 character')
        )).toBe(true);
        expect(serverValidation.error.issues.some(issue =>
          issue.path.includes('package') && issue.message.includes('at least 1 character')
        )).toBe(true);
      }

      // MCPServerConfig with empty required fields
      const invalidConfig = createMCPServerConfig({
        name: '', // Empty string should fail validation
      });

      const configValidation = MCPServerConfigSchema.safeParse(invalidConfig);
      expect(configValidation.success).toBe(false);
      if (!configValidation.success) {
        expect(configValidation.error.issues.some(issue =>
          issue.path.includes('name')
        )).toBe(true);
      }

      // MCPMarketplaceEntry with empty required fields
      const invalidEntry = createMCPMarketplaceEntry({
        name: '', // Empty string should fail validation
        description: '', // Empty string should fail validation
        version: '', // Empty string should fail validation
      });

      const entryValidation = MCPMarketplaceEntrySchema.safeParse(invalidEntry);
      expect(entryValidation.success).toBe(false);
      if (!entryValidation.success) {
        expect(entryValidation.error.issues.length).toBeGreaterThan(0);
        expect(entryValidation.error.issues.some(issue =>
          issue.path.includes('name') || issue.path.includes('description') || issue.path.includes('version')
        )).toBe(true);
      }
    });

    it('should handle invalid enum values in server config', () => {
      // TypeScript will prevent this at compile time, but we can test runtime behavior
      const configWithInvalidType = createMCPServerConfig({
        type: 'invalid-type' as any,
      });

      const validation = MCPServerConfigSchema.safeParse(configWithInvalidType);
      expect(validation.success).toBe(false);
      if (!validation.success) {
        expect(validation.error.issues.some(issue =>
          issue.path.includes('type') && issue.code === 'invalid_enum_value'
        )).toBe(true);
      }
    });

    it('should handle invalid environment variable structures', () => {
      const serverWithInvalidEnvVars = createMCPServer({
        envVars: [
          {
            name: '', // Empty name should fail
            description: 'Test var',
            required: true,
          },
          {
            // Missing name field
            description: 'Test var 2',
            required: false,
          } as any,
          {
            name: 'VALID_VAR',
            // Invalid type for required field
            required: 'yes' as any,
          },
        ],
      });

      const validation = MCPServerSchema.safeParse(serverWithInvalidEnvVars);
      expect(validation.success).toBe(false);
      if (!validation.success) {
        expect(validation.error.issues.length).toBeGreaterThan(0);
        // Should have issues with the invalid envVars
        expect(validation.error.issues.some(issue =>
          issue.path.some(p => p === 'envVars')
        )).toBe(true);
      }
    });

    it('should handle invalid nested serverConfig in marketplace entry', () => {
      const entryWithInvalidConfig = createMCPMarketplaceEntry({
        name: 'Test Entry',
        description: 'Test description',
        version: '1.0.0',
        serverConfig: {
          name: '', // Empty name should fail
          type: 'invalid-type' as any, // Invalid enum
          command: '', // Empty command might be invalid
        } as any,
      });

      const validation = MCPMarketplaceEntrySchema.safeParse(entryWithInvalidConfig);
      expect(validation.success).toBe(false);
      if (!validation.success) {
        expect(validation.error.issues.some(issue =>
          issue.path.some(p => p === 'serverConfig')
        )).toBe(true);
      }
    });
  });

  describe('Type Safety and Runtime Errors', () => {
    it('should handle malformed input gracefully', () => {
      // Test with malformed objects that might cause runtime errors

      // Function object as override (should be handled gracefully)
      const serverWithFunction = createMCPServer({
        name: 'test-server',
        package: '@test/server',
        env: {
          NORMAL_VAR: 'value',
          FUNCTION_VAR: (() => 'test') as any, // Function instead of string
        },
      });

      // Should create object but validation should fail
      expect(serverWithFunction.env.FUNCTION_VAR).toEqual(expect.any(Function));

      const validation = MCPServerSchema.safeParse(serverWithFunction);
      expect(validation.success).toBe(false);
    });

    it('should handle circular references in overrides', () => {
      const circularObj: any = {
        name: 'circular-server',
        package: '@test/circular',
      };
      circularObj.self = circularObj; // Create circular reference

      // Should not throw but may create unexpected structure
      expect(() => {
        const server = createMCPServer(circularObj);
        expect(server.name).toBe('circular-server');
        // Circular reference should be preserved in the created object
        expect((server as any).self).toBeDefined();
      }).not.toThrow();
    });

    it('should handle very deeply nested objects', () => {
      // Create deeply nested override object
      let deepObj: any = {};
      let current = deepObj;
      for (let i = 0; i < 100; i++) {
        current.nested = { level: i };
        current = current.nested;
      }

      const server = createMCPServer({
        name: 'deep-nested-server',
        package: '@test/deep',
        ...deepObj, // Spread the deeply nested object
      });

      expect(server.name).toBe('deep-nested-server');
      expect((server as any).nested).toBeDefined();
      expect((server as any).nested.level).toBe(0);
    });
  });

  describe('Factory Option Errors', () => {
    it('should handle invalid factory options gracefully', () => {
      // Invalid options should not crash the factory functions
      const invalidServerOptions: MCPServerFactoryOptions = {
        includeEnv: 'yes' as any, // Should be boolean
        includeEnvVars: null as any, // Should be boolean
      };

      const invalidConfigOptions: MCPServerConfigFactoryOptions = {
        type: 'invalid-connection-type' as any,
        autoStart: 'true' as any, // Should be boolean
        includeEnv: 123 as any, // Should be boolean
      };

      const invalidEntryOptions: MCPMarketplaceEntryFactoryOptions = {
        verified: 'yes' as any, // Should be boolean
        includeCapabilities: 'false' as any, // Should be boolean
      };

      // These should not throw errors, but behavior is undefined
      expect(() => {
        createMCPServer({}, invalidServerOptions);
      }).not.toThrow();

      expect(() => {
        createMCPServerConfig({}, invalidConfigOptions);
      }).not.toThrow();

      expect(() => {
        createMCPMarketplaceEntry({}, invalidEntryOptions);
      }).not.toThrow();
    });

    it('should handle null and undefined options', () => {
      // Null/undefined options should use defaults
      expect(() => {
        createMCPServer({}, null as any);
      }).not.toThrow();

      expect(() => {
        createMCPServerConfig({}, undefined);
      }).not.toThrow();

      expect(() => {
        createMCPMarketplaceEntry({}, {} as any);
      }).not.toThrow();
    });
  });

  describe('Memory and Resource Errors', () => {
    it('should handle extremely large inputs without crashing', () => {
      const largeString = 'x'.repeat(1000000); // 1MB string
      const largeArray = Array(100000).fill('item'); // 100k items
      const largeEnv: Record<string, string> = {};
      for (let i = 0; i < 10000; i++) {
        largeEnv[`VAR_${i}`] = `value_${i}`;
      }

      expect(() => {
        const server = createMCPServer({
          name: largeString,
          description: largeString,
          args: largeArray,
          env: largeEnv,
        });
        expect(server.name).toBe(largeString);
        expect(server.args).toHaveLength(100000);
        expect(Object.keys(server.env)).toHaveLength(10000);
      }).not.toThrow();
    });

    it('should handle creation under memory pressure', () => {
      // Simulate memory pressure by creating many large objects
      const memoryPressure: any[] = [];

      try {
        // Create some memory pressure
        for (let i = 0; i < 1000; i++) {
          memoryPressure.push(Array(1000).fill(`memory-pressure-${i}`));
        }

        // Factory functions should still work under pressure
        const server = createMCPServer({
          name: 'pressure-test-server',
          package: '@test/pressure',
        });

        const config = createMCPServerConfig({
          name: 'pressure-test-config',
        });

        const entry = createMCPMarketplaceEntry({
          name: 'Pressure Test Entry',
          description: 'Entry created under memory pressure',
        });

        expect(server.name).toBe('pressure-test-server');
        expect(config.name).toBe('pressure-test-config');
        expect(entry.name).toBe('Pressure Test Entry');

      } finally {
        // Clean up memory pressure
        memoryPressure.length = 0;
      }
    });
  });

  describe('Validation Error Messages', () => {
    it('should provide detailed error information for debugging', () => {
      const invalidServer = createMCPServer({
        name: '', // Invalid
        package: '', // Invalid
        version: '', // Invalid
        envVars: [
          { name: '', required: 'invalid' as any }, // Multiple invalid fields
        ],
      });

      const validation = MCPServerSchema.safeParse(invalidServer);
      expect(validation.success).toBe(false);

      if (!validation.success) {
        const error = validation.error;

        // Should have clear error messages
        expect(error.issues.length).toBeGreaterThan(0);

        // Each error should have a clear path and message
        error.issues.forEach(issue => {
          expect(issue.path).toBeDefined();
          expect(issue.message).toBeDefined();
          expect(issue.message.length).toBeGreaterThan(0);
          expect(issue.code).toBeDefined();
        });

        // Should be able to format errors for display
        const formattedErrors = error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
          value: issue.received,
        }));

        expect(formattedErrors.length).toBeGreaterThan(0);
        formattedErrors.forEach(err => {
          expect(err.field).toBeDefined();
          expect(err.message).toBeDefined();
        });
      }
    });

    it('should handle nested validation errors clearly', () => {
      const entryWithNestedErrors = createMCPMarketplaceEntry({
        name: 'Test Entry',
        description: 'Test',
        version: '1.0.0',
        serverConfig: {
          name: '', // Invalid
          type: 'invalid-type' as any, // Invalid
          args: [null as any, undefined as any], // Invalid array items
          envVars: [
            { name: '', required: 'yes' as any }, // Invalid structure
          ],
        } as any,
      });

      const validation = MCPMarketplaceEntrySchema.safeParse(entryWithNestedErrors);
      expect(validation.success).toBe(false);

      if (!validation.success) {
        const error = validation.error;

        // Should identify nested paths correctly
        const hasNestedErrors = error.issues.some(issue =>
          issue.path.some(p => p === 'serverConfig')
        );
        expect(hasNestedErrors).toBe(true);

        // Should provide clear paths to nested errors
        const nestedErrorPaths = error.issues
          .filter(issue => issue.path.includes('serverConfig'))
          .map(issue => issue.path.join('.'));

        expect(nestedErrorPaths.length).toBeGreaterThan(0);
        nestedErrorPaths.forEach(path => {
          expect(path).toContain('serverConfig');
        });
      }
    });
  });

  describe('Recovery and Resilience', () => {
    it('should maintain functionality after error conditions', () => {
      // Create some invalid objects first
      try {
        createMCPServer({ name: '', package: '' });
      } catch (error) {
        // Ignore any errors
      }

      try {
        createMCPServerConfig({ name: '' });
      } catch (error) {
        // Ignore any errors
      }

      // Factory should still work normally afterwards
      const validServer = createMCPServer({
        name: 'recovery-server',
        package: '@test/recovery',
      });

      const validConfig = createMCPServerConfig({
        name: 'recovery-config',
      });

      const validEntry = createMCPMarketplaceEntry({
        name: 'Recovery Entry',
        description: 'Entry created after error conditions',
      });

      expect(MCPServerSchema.safeParse(validServer).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(validConfig).success).toBe(true);
      expect(MCPMarketplaceEntrySchema.safeParse(validEntry).success).toBe(true);
    });

    it('should handle mixed valid and invalid batches', () => {
      const mixedBatch = [];

      // Create a mix of valid and invalid items
      for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) {
          // Valid items
          mixedBatch.push({
            server: createMCPServer({ name: `valid-server-${i}` }),
            config: createMCPServerConfig({ name: `valid-config-${i}` }),
            entry: createMCPMarketplaceEntry({ name: `Valid Entry ${i}` }),
            valid: true,
          });
        } else {
          // Invalid items
          mixedBatch.push({
            server: createMCPServer({ name: '', package: '' }),
            config: createMCPServerConfig({ name: '' }),
            entry: createMCPMarketplaceEntry({ name: '', description: '', version: '' }),
            valid: false,
          });
        }
      }

      // Validate each and count valid/invalid
      let validCount = 0;
      let invalidCount = 0;

      for (const item of mixedBatch) {
        const serverValid = MCPServerSchema.safeParse(item.server).success;
        const configValid = MCPServerConfigSchema.safeParse(item.config).success;
        const entryValid = MCPMarketplaceEntrySchema.safeParse(item.entry).success;

        if (serverValid && configValid && entryValid) {
          validCount++;
          expect(item.valid).toBe(true);
        } else {
          invalidCount++;
          expect(item.valid).toBe(false);
        }
      }

      expect(validCount).toBe(5);
      expect(invalidCount).toBe(5);
    });
  });

  describe('Edge Case Error Scenarios', () => {
    it('should handle prototype pollution attempts', () => {
      const maliciousOverrides = {
        name: 'test-server',
        package: '@test/server',
        '__proto__': { polluted: true },
        'constructor': { polluted: true },
        'prototype': { polluted: true },
      };

      // Should not pollute prototypes
      const server = createMCPServer(maliciousOverrides as any);

      expect(server.name).toBe('test-server');
      expect((server as any).__proto__).not.toHaveProperty('polluted');
      expect((Object.prototype as any).polluted).toBeUndefined();
    });

    it('should handle symbol properties gracefully', () => {
      const symbolKey = Symbol('test-symbol');
      const overrides = {
        name: 'symbol-test-server',
        package: '@test/symbol',
        [symbolKey]: 'symbol-value',
      };

      expect(() => {
        const server = createMCPServer(overrides);
        expect(server.name).toBe('symbol-test-server');
        expect((server as any)[symbolKey]).toBe('symbol-value');
      }).not.toThrow();
    });

    it('should handle non-enumerable properties', () => {
      const overrides = {
        name: 'non-enum-server',
        package: '@test/non-enum',
      };

      // Add non-enumerable property
      Object.defineProperty(overrides, 'hiddenProperty', {
        value: 'hidden-value',
        enumerable: false,
        writable: true,
        configurable: true,
      });

      expect(() => {
        const server = createMCPServer(overrides);
        expect(server.name).toBe('non-enum-server');
        // Non-enumerable property should not be copied by spread operator
        expect((server as any).hiddenProperty).toBeUndefined();
      }).not.toThrow();
    });
  });
});
/**
 * @fileoverview Stress and performance tests for MCPConfigValidator
 *
 * Tests the validator's behavior under high load and edge performance scenarios
 * to ensure it scales appropriately with large configurations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execSync } from 'child_process';
import { access } from 'fs/promises';
import {
  MCPConfigValidator,
  type MCPValidationOptions,
} from '../mcp-config-validator.js';

// Mock external dependencies
vi.mock('child_process');
vi.mock('fs/promises');

const mockExecSync = vi.mocked(execSync);
const mockAccess = vi.mocked(access);

describe('MCPConfigValidator Stress Tests', () => {
  let validator: MCPConfigValidator;

  beforeEach(() => {
    validator = new MCPConfigValidator();
    vi.clearAllMocks();

    // Mock successful external calls for performance tests
    mockExecSync.mockReturnValue(Buffer.from('/usr/bin/node'));
    mockAccess.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Large Configuration Handling', () => {
    it('should handle very large number of servers efficiently', async () => {
      const serverCount = 1000;
      const servers: Record<string, any> = {};

      for (let i = 0; i < serverCount; i++) {
        servers[`server-${i}`] = {
          name: `Server ${i}`,
          command: 'node',
          args: [`server-${i}.js`, '--port', `${3000 + i}`],
          envVars: [
            {
              name: `SERVER_${i}_PORT`,
              required: false,
              defaultValue: `${3000 + i}`,
              description: `Port for server ${i}`,
            },
            {
              name: `SERVER_${i}_DEBUG`,
              required: false,
              defaultValue: 'false',
              description: `Debug mode for server ${i}`,
            },
          ],
          enabled: i % 2 === 0, // Alternate enabled/disabled
          autoStart: i % 3 === 0, // Some with autoStart
          capabilities: [`server-${i}`, 'stdio', 'filesystem'],
          connection: {
            timeout: 5000 + (i % 100), // Vary timeouts
            maxRetries: 3 + (i % 5),
            retryDelay: 1000,
            maxConcurrentConnections: 1 + (i % 10),
          },
        };
      }

      const config = {
        enabled: true,
        servers,
        connection: {
          timeout: 30000,
          maxRetries: 5,
          retryDelay: 2000,
          maxConcurrentConnections: 100,
        },
      };

      const startTime = Date.now();
      const result = await validator.validate(config);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (less than 5 seconds for 1000 servers)
      expect(duration).toBeLessThan(5000);

      // Should validate successfully
      expect(result.isValid).toBe(true);
      expect(result.errorCount).toBe(0);

      // Should have processed all servers
      expect(Object.keys(config.servers)).toHaveLength(serverCount);

      console.log(`Validated ${serverCount} servers in ${duration}ms`);
    }, 10000); // 10 second timeout

    it('should handle servers with many environment variables', async () => {
      const envVarCount = 500;
      const envVars = [];

      for (let i = 0; i < envVarCount; i++) {
        envVars.push({
          name: `ENV_VAR_${i}`,
          required: i % 10 === 0, // Every 10th is required
          defaultValue: i % 10 === 0 ? undefined : `default-value-${i}`,
          description: `Environment variable ${i}`,
          sensitive: i % 20 === 0, // Every 20th is sensitive
        });

        // Set some environment variables to exist
        if (i % 10 === 0 && i % 3 === 0) {
          process.env[`ENV_VAR_${i}`] = `value-${i}`;
        }
      }

      const config = {
        enabled: true,
        servers: {
          'env-heavy-server': {
            name: 'Environment Variable Heavy Server',
            command: 'node',
            args: ['env-server.js'],
            envVars,
            enabled: true,
            autoStart: true,
          },
        },
      };

      const startTime = Date.now();
      const result = await validator.validate(config);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (less than 2 seconds for 500 env vars)
      expect(duration).toBeLessThan(2000);

      // May have some missing required env vars, but should not crash
      expect(result).toBeDefined();
      expect(result.issues).toBeDefined();

      console.log(`Validated ${envVarCount} env vars in ${duration}ms`);

      // Clean up
      for (let i = 0; i < envVarCount; i++) {
        delete process.env[`ENV_VAR_${i}`];
      }
    }, 5000); // 5 second timeout

    it('should handle deeply nested configuration structures', async () => {
      const config = {
        enabled: true,
        servers: {
          'nested-server': {
            name: 'Deeply Nested Configuration Server',
            command: 'node',
            args: Array(100).fill(0).map((_, i) => `arg-${i}`),
            env: Object.fromEntries(
              Array(100).fill(0).map((_, i) => [`ENV_${i}`, `value-${i}`])
            ),
            envVars: Array(100).fill(0).map((_, i) => ({
              name: `NESTED_VAR_${i}`,
              required: false,
              defaultValue: `nested-default-${i}`,
              description: `Nested environment variable ${i}`,
            })),
            capabilities: Array(50).fill(0).map((_, i) => `capability-${i}`),
            headers: Object.fromEntries(
              Array(50).fill(0).map((_, i) => [`Header-${i}`, `header-value-${i}`])
            ),
            connection: {
              timeout: 30000,
              maxRetries: 10,
              retryDelay: 2000,
              maxConcurrentConnections: 20,
              poolSize: 5,
            },
            enabled: true,
            autoStart: true,
          },
        },
        marketplace: {
          enabled: true,
          url: 'https://marketplace.test.com',
          refreshIntervalMinutes: 60,
          allowUnverified: false,
          sources: Array(20).fill(0).map((_, i) => `source-${i}`),
        },
        connection: {
          timeout: 45000,
          maxRetries: 8,
          retryDelay: 3000,
          maxConcurrentConnections: 50,
          poolSize: 10,
        },
      };

      const startTime = Date.now();
      const result = await validator.validate(config);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000);
      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);

      console.log(`Validated deeply nested config in ${duration}ms`);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should handle repeated validations without memory leaks', async () => {
      const config = {
        enabled: true,
        servers: {
          'test-server': {
            name: 'Memory Test Server',
            command: 'node',
            args: ['test.js'],
            envVars: [
              {
                name: 'TEST_VAR',
                required: false,
                defaultValue: 'test-value',
              },
            ],
          },
        },
      };

      const iterations = 1000;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const result = await validator.validate(config);
        expect(result.isValid).toBe(true);

        // Occasionally check that we're making progress
        if (i % 100 === 0) {
          console.log(`Completed ${i + 1}/${iterations} validations`);
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(10); // Less than 10ms per validation on average

      console.log(`${iterations} validations completed in ${duration}ms (${avgTime.toFixed(2)}ms avg)`);
    }, 15000); // 15 second timeout
  });

  describe('Concurrent Validation', () => {
    it('should handle multiple concurrent validations safely', async () => {
      const configs = Array(50).fill(0).map((_, i) => ({
        enabled: true,
        servers: {
          [`concurrent-server-${i}`]: {
            name: `Concurrent Server ${i}`,
            command: 'node',
            args: [`server-${i}.js`],
            envVars: [
              {
                name: `CONCURRENT_VAR_${i}`,
                required: false,
                defaultValue: `concurrent-value-${i}`,
              },
            ],
            enabled: true,
            autoStart: i % 2 === 0,
          },
        },
      }));

      const startTime = Date.now();

      // Run all validations concurrently
      const promises = configs.map((config, index) =>
        validator.validate(config).then(result => ({
          index,
          result,
        }))
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All validations should succeed
      results.forEach(({ index, result }) => {
        expect(result.isValid).toBe(true);
        expect(result.errorCount).toBe(0);
      });

      // Should complete in reasonable time
      expect(duration).toBeLessThan(3000);

      console.log(`${configs.length} concurrent validations completed in ${duration}ms`);
    });
  });

  describe('Edge Performance Cases', () => {
    it('should handle configuration with extremely long strings efficiently', async () => {
      const longString = 'x'.repeat(10000); // 10KB string

      const config = {
        enabled: true,
        servers: {
          'long-string-server': {
            name: longString,
            command: 'node',
            args: [longString],
            envVars: [
              {
                name: 'LONG_VAR',
                required: false,
                defaultValue: longString,
                description: longString,
              },
            ],
          },
        },
      };

      const startTime = Date.now();
      const result = await validator.validate(config);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500);
      expect(result).toBeDefined();

      console.log(`Validated config with long strings in ${duration}ms`);
    });

    it('should handle validation with disabled options efficiently', async () => {
      const validator = new MCPConfigValidator({
        checkEnvironmentVars: false,
        checkCommandExistence: false,
        validateConnectionConfig: false,
      });

      const serverCount = 2000;
      const servers: Record<string, any> = {};

      for (let i = 0; i < serverCount; i++) {
        servers[`fast-server-${i}`] = {
          name: `Fast Server ${i}`,
          command: `command-${i}`,
          args: [`arg1-${i}`, `arg2-${i}`],
          envVars: [
            { name: `VAR_${i}`, required: true },
            { name: `VAR2_${i}`, required: false, defaultValue: `default-${i}` },
          ],
          connection: {
            timeout: 1, // Would normally cause warnings
            maxConcurrentConnections: 1000, // Would normally cause warnings
          },
        };
      }

      const config = { enabled: true, servers };

      const startTime = Date.now();
      const result = await validator.validate(config);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should be much faster with checks disabled
      expect(duration).toBeLessThan(1000);
      expect(result.isValid).toBe(true); // No validation errors since checks are disabled

      console.log(`Validated ${serverCount} servers with disabled checks in ${duration}ms`);
    }, 5000);
  });
});
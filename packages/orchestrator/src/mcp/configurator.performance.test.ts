/**
 * MCPConfigurator Performance Tests
 *
 * Performance, stress, and load testing for the MCPConfigurator class
 * to ensure it handles large-scale scenarios efficiently.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import { MCPConfigurator, type MCPServerTemplate } from './configurator.js';
import type { ApexConfig, MCPServerConfig } from '@apexcli/core';

// Mock fs module
vi.mock('fs/promises');

describe('MCPConfigurator - Performance Tests', () => {
  let configurator: MCPConfigurator;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    const mockConfig: ApexConfig = {
      project: { name: 'performance-test' },
      mcp: { enabled: true, servers: {} },
    } as ApexConfig;

    configurator = new MCPConfigurator({
      projectPath: testProjectPath,
      config: mockConfig,
    });

    vi.clearAllMocks();
  });

  // =========================================================================
  // Configuration Generation Performance
  // =========================================================================

  describe('Configuration Generation Performance', () => {
    it('should generate configurations efficiently with large number of servers', () => {
      // Add 1000 servers
      const serverCount = 1000;
      for (let i = 0; i < serverCount; i++) {
        configurator.addServer(`server-${i}`, {
          name: `server-${i}`,
          type: 'stdio',
          command: 'npx',
          args: [`package-${i}`],
          env: {
            [`VAR_${i}`]: `value-${i}`,
            [`SHARED_VAR`]: 'shared-value',
          },
        });
      }

      // Measure Claude Desktop config generation
      const claudeStart = performance.now();
      const claudeConfig = configurator.generateConfig('claude-desktop');
      const claudeEnd = performance.now();

      // Measure APEX config generation
      const apexStart = performance.now();
      const apexConfig = configurator.generateConfig('apex');
      const apexEnd = performance.now();

      // Performance assertions
      expect(claudeEnd - claudeStart).toBeLessThan(1000); // Less than 1 second
      expect(apexEnd - apexStart).toBeLessThan(500); // Less than 0.5 seconds

      // Correctness assertions
      expect(Object.keys(claudeConfig.mcpServers)).toHaveLength(serverCount);
      expect(Object.keys((apexConfig as any).servers)).toHaveLength(serverCount);
    });

    it('should handle configuration generation with complex environment variables efficiently', () => {
      const serverCount = 500;
      const envVarsPerServer = 20;

      for (let i = 0; i < serverCount; i++) {
        const envVars = [];
        for (let j = 0; j < envVarsPerServer; j++) {
          envVars.push({
            name: `ENV_VAR_${i}_${j}`,
            description: `Environment variable ${j} for server ${i}`,
            required: j % 2 === 0,
            sensitive: j % 3 === 0,
            pattern: j % 4 === 0 ? '^[A-Z_]+$' : undefined,
            defaultValue: j % 5 === 0 ? `default-${i}-${j}` : undefined,
          });
        }

        configurator.addServer(`complex-server-${i}`, {
          name: `complex-server-${i}`,
          type: 'stdio',
          command: 'npx',
          envVars,
        });
      }

      const start = performance.now();
      const config = configurator.generateConfig('claude-desktop');
      const end = performance.now();

      // Should complete within reasonable time even with complex env vars
      expect(end - start).toBeLessThan(2000); // Less than 2 seconds
      expect(Object.keys(config.mcpServers)).toHaveLength(serverCount);
    });

    it('should handle filtered server generation efficiently', () => {
      // Add 2000 servers
      const totalServers = 2000;
      const selectedServers = [];

      for (let i = 0; i < totalServers; i++) {
        const serverId = `server-${i}`;
        configurator.addServer(serverId, {
          name: serverId,
          type: i % 10 === 0 ? 'http' : 'stdio', // 10% HTTP servers
          command: i % 10 !== 0 ? 'npx' : undefined,
          url: i % 10 === 0 ? `https://server-${i}.example.com` : undefined,
        });

        // Select every 10th server
        if (i % 10 === 0) {
          selectedServers.push(serverId);
        }
      }

      const start = performance.now();
      const filteredConfig = configurator.generateConfig('claude-desktop', selectedServers);
      const end = performance.now();

      // Should be fast even when filtering from large set
      expect(end - start).toBeLessThan(500);
      expect(Object.keys(filteredConfig.mcpServers)).toHaveLength(selectedServers.filter(id => {
        // Only stdio servers should be included for Claude Desktop
        const serverIndex = parseInt(id.split('-')[1]);
        return serverIndex % 10 !== 0; // HTTP servers are filtered out
      }).length);
    });
  });

  // =========================================================================
  // Template Management Performance
  // =========================================================================

  describe('Template Management Performance', () => {
    it('should handle large numbers of custom templates efficiently', () => {
      const templateCount = 1000;
      const categoriesPerTemplate = 5;

      // Register many templates
      const registrationStart = performance.now();
      for (let i = 0; i < templateCount; i++) {
        const capabilities = [];
        for (let j = 0; j < categoriesPerTemplate; j++) {
          capabilities.push(`capability-${(i + j) % 20}`); // 20 different capabilities
        }

        configurator.registerTemplate({
          id: `template-${i}`,
          name: `Template ${i}`,
          description: `Template description ${i}`,
          package: `package-${i}`,
          config: {
            name: `template-${i}`,
            type: 'stdio',
            command: 'npx',
            args: [`package-${i}`],
          },
          envVars: [],
          capabilities,
          verified: i % 3 === 0, // 1/3 verified
        });
      }
      const registrationEnd = performance.now();

      // Test template retrieval performance
      const retrievalStart = performance.now();
      const allTemplates = configurator.getServerTemplates();
      const retrievalEnd = performance.now();

      // Test filtered retrieval performance
      const filterStart = performance.now();
      const filteredTemplates = configurator.getServerTemplates('capability-0');
      const filterEnd = performance.now();

      // Performance assertions
      expect(registrationEnd - registrationStart).toBeLessThan(2000);
      expect(retrievalEnd - retrievalStart).toBeLessThan(100);
      expect(filterEnd - filterStart).toBeLessThan(200);

      // Correctness assertions
      expect(allTemplates.length).toBeGreaterThanOrEqual(templateCount);
      expect(filteredTemplates.length).toBeGreaterThan(0);
    });

    it('should generate from templates efficiently at scale', () => {
      // Register templates with complex configurations
      const templateCount = 100;
      for (let i = 0; i < templateCount; i++) {
        configurator.registerTemplate({
          id: `perf-template-${i}`,
          name: `Performance Template ${i}`,
          description: `Performance test template ${i}`,
          package: `perf-package-${i}`,
          config: {
            name: `perf-template-${i}`,
            type: 'stdio',
            command: 'node',
            args: [
              '{{PROJECT_PATH}}/scripts/server.js',
              '--config={{PROJECT_PATH}}/config.json',
              `--instance=${i}`,
            ],
          },
          envVars: Array.from({ length: 10 }, (_, j) => ({
            name: `TEMPLATE_${i}_VAR_${j}`,
            description: `Template ${i} variable ${j}`,
            required: j % 3 === 0,
          })),
          capabilities: [`category-${i % 10}`],
          verified: true,
        });
      }

      // Generate configurations from all templates
      const start = performance.now();
      const configs = [];
      for (let i = 0; i < templateCount; i++) {
        const config = configurator.generateFromTemplate(`perf-template-${i}`, {
          autoStart: i % 2 === 0,
        });
        configs.push(config);
      }
      const end = performance.now();

      // Should complete efficiently
      expect(end - start).toBeLessThan(1000);
      expect(configs).toHaveLength(templateCount);

      // Verify placeholder substitution worked
      expect(configs[0].args?.[0]).toBe(`${testProjectPath}/scripts/server.js`);
      expect(configs[0].args?.[1]).toBe(`${testProjectPath}/config.json`);
    });
  });

  // =========================================================================
  // Environment Variable Detection Performance
  // =========================================================================

  describe('Environment Variable Detection Performance', () => {
    it('should handle environment variable detection efficiently for many servers', async () => {
      const serverCount = 100;
      const envVarsPerServer = 20;

      // Add servers with many environment variables
      for (let i = 0; i < serverCount; i++) {
        const envVars = [];
        for (let j = 0; j < envVarsPerServer; j++) {
          envVars.push({
            name: `SERVER_${i}_VAR_${j}`,
            description: `Variable ${j} for server ${i}`,
            required: j % 2 === 0,
            sensitive: j % 3 === 0,
            pattern: j % 4 === 0 ? '^[A-Z0-9_]+$' : undefined,
          });
        }

        configurator.addServer(`env-server-${i}`, {
          name: `env-server-${i}`,
          type: 'stdio',
          command: 'npx',
          envVars,
        });
      }

      // Detect environment variables for all servers
      const start = performance.now();
      const results = await configurator.detectAllEnvironmentVariables();
      const end = performance.now();

      // Performance assertion
      expect(end - start).toBeLessThan(5000); // Less than 5 seconds

      // Correctness assertions
      expect(results.size).toBe(serverCount);
      for (const result of results.values()) {
        expect(result.variables).toHaveLength(envVarsPerServer);
      }
    });

    it('should handle environment variable validation efficiently', async () => {
      const serverCount = 50;

      // Add servers that will require environment validation
      for (let i = 0; i < serverCount; i++) {
        configurator.addServer(`validation-server-${i}`, {
          name: `validation-server-${i}`,
          type: 'stdio',
          command: 'npx',
          envVars: [
            {
              name: `REQUIRED_VAR_${i}`,
              description: `Required variable for server ${i}`,
              required: true,
            },
            {
              name: `OPTIONAL_VAR_${i}`,
              description: `Optional variable for server ${i}`,
              required: false,
            },
          ],
        });
      }

      // Validate environment variables for all servers
      const start = performance.now();
      const validationPromises = [];
      for (let i = 0; i < serverCount; i++) {
        validationPromises.push(
          configurator.validateEnvironmentVariables(`validation-server-${i}`)
        );
      }
      const results = await Promise.all(validationPromises);
      const end = performance.now();

      // Performance assertion
      expect(end - start).toBeLessThan(3000); // Less than 3 seconds

      // Correctness assertions
      expect(results).toHaveLength(serverCount);
      results.forEach((result, i) => {
        expect(result.valid).toBe(false); // Should be invalid due to missing required vars
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  // =========================================================================
  // File Operations Performance
  // =========================================================================

  describe('File Operations Performance', () => {
    it('should handle bulk configuration exports efficiently', async () => {
      const serverCount = 500;

      // Add many servers
      for (let i = 0; i < serverCount; i++) {
        configurator.addServer(`bulk-server-${i}`, {
          name: `bulk-server-${i}`,
          type: 'stdio',
          command: 'npx',
          args: [`package-${i}`],
          env: { [`VAR_${i}`]: `value-${i}` },
        });
      }

      // Mock file operations
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // Test multiple export operations
      const start = performance.now();
      await Promise.all([
        configurator.exportConfig('claude-desktop'),
        configurator.exportConfig('apex'),
        configurator.exportConfig('json'),
      ]);
      const end = performance.now();

      // Should complete efficiently even with large configurations
      expect(end - start).toBeLessThan(2000);

      // Verify all exports were called
      expect(fs.writeFile).toHaveBeenCalledTimes(3);
    });

    it('should handle large configuration imports efficiently', async () => {
      // Create large Claude Desktop configuration
      const serverCount = 1000;
      const largeConfig = {
        mcpServers: {} as Record<string, any>,
      };

      for (let i = 0; i < serverCount; i++) {
        largeConfig.mcpServers[`imported-server-${i}`] = {
          command: 'npx',
          args: [`package-${i}`, `--instance=${i}`],
          env: {
            [`SERVER_ID`]: `${i}`,
            [`SERVER_NAME`]: `imported-server-${i}`,
            [`CONFIG_PATH`]: `/config/server-${i}.json`,
          },
        };
      }

      // Test import performance
      const start = performance.now();
      const imported = await configurator.importConfig(largeConfig, 'claude-desktop');
      const end = performance.now();

      // Performance assertion
      expect(end - start).toBeLessThan(3000); // Less than 3 seconds

      // Correctness assertions
      expect(Object.keys(imported.servers || {})).toHaveLength(serverCount);
      expect(imported.servers?.[`imported-server-0`]).toBeDefined();
      expect(imported.servers?.[`imported-server-${serverCount - 1}`]).toBeDefined();
    });
  });

  // =========================================================================
  // Memory and Resource Usage Tests
  // =========================================================================

  describe('Memory and Resource Usage', () => {
    it('should maintain reasonable memory usage with large configurations', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create large configuration
      const serverCount = 5000;
      for (let i = 0; i < serverCount; i++) {
        configurator.addServer(`memory-test-${i}`, {
          name: `memory-test-${i}`,
          type: 'stdio',
          command: 'npx',
          args: [`package-${i}`],
          env: Object.fromEntries(
            Array.from({ length: 10 }, (_, j) => [`VAR_${j}`, `value-${i}-${j}`])
          ),
        });
      }

      const afterAddingMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = afterAddingMemory - initialMemory;

      // Generate configuration multiple times
      for (let i = 0; i < 10; i++) {
        configurator.generateConfig('claude-desktop');
        configurator.generateConfig('apex');
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const finalIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 100MB for this test)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);

      // Memory shouldn't grow significantly with repeated operations
      expect(finalIncrease).toBeLessThan(memoryIncrease * 1.5);
    });

    it('should cleanup resources properly', () => {
      const initialListeners = configurator.listenerCount('config:generated');

      // Add many event listeners
      const listeners = [];
      for (let i = 0; i < 100; i++) {
        const listener = vi.fn();
        listeners.push(listener);
        configurator.on('config:generated', listener);
      }

      const peakListeners = configurator.listenerCount('config:generated');
      expect(peakListeners).toBe(initialListeners + 100);

      // Remove all listeners
      for (const listener of listeners) {
        configurator.removeListener('config:generated', listener);
      }

      const finalListeners = configurator.listenerCount('config:generated');
      expect(finalListeners).toBe(initialListeners);
    });
  });

  // =========================================================================
  // Concurrent Operations Tests
  // =========================================================================

  describe('Concurrent Operations', () => {
    it('should handle concurrent server additions safely', () => {
      const promises = [];
      const concurrentOps = 100;

      // Perform concurrent server additions
      for (let i = 0; i < concurrentOps; i++) {
        const promise = new Promise<void>((resolve) => {
          setTimeout(() => {
            configurator.addServer(`concurrent-${i}`, {
              name: `concurrent-${i}`,
              type: 'stdio',
              command: 'npx',
            });
            resolve();
          }, Math.random() * 10); // Random delay up to 10ms
        });
        promises.push(promise);
      }

      return Promise.all(promises).then(() => {
        const config = configurator.getConfig();
        expect(Object.keys(config.servers || {})).toHaveLength(concurrentOps);
      });
    });

    it('should handle concurrent configuration generations efficiently', () => {
      // Add some servers first
      for (let i = 0; i < 50; i++) {
        configurator.addServer(`base-server-${i}`, {
          name: `base-server-${i}`,
          type: 'stdio',
          command: 'npx',
        });
      }

      // Perform concurrent configuration generations
      const start = performance.now();
      const promises = Array.from({ length: 20 }, (_, i) =>
        Promise.resolve(configurator.generateConfig(i % 2 === 0 ? 'claude-desktop' : 'apex'))
      );

      return Promise.all(promises).then((results) => {
        const end = performance.now();

        // Should complete efficiently even with concurrent access
        expect(end - start).toBeLessThan(1000);

        // All results should be valid
        expect(results).toHaveLength(20);
        results.forEach((result, i) => {
          if (i % 2 === 0) {
            expect(result).toHaveProperty('mcpServers');
          } else {
            expect(result).toHaveProperty('servers');
          }
        });
      });
    });
  });
});
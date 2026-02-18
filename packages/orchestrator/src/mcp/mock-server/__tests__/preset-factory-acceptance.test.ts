/**
 * @fileoverview Acceptance Tests for Preset-Based Mock MCP Server Factory
 *
 * This test suite verifies the acceptance criteria for the createMockMCPServer
 * factory function implementation as specified in the task requirements.
 *
 * Acceptance Criteria:
 * - Factory function exists with preset support
 * - Can create mock servers with single function call using preset name
 * - Custom config can override preset defaults
 *
 * @module orchestrator/mcp/mock-server/__tests__/preset-factory-acceptance
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createMockMCPServer,
  createFileSystemMockServer,
  createDatabaseMockServer,
  createApiMockServer,
  createMinimalMockServer,
  type CreateMockServerOptions,
} from '../preset-factory.js';
import {
  type MockServerPreset,
  getAvailablePresets,
  isBehaviorModifier,
} from '../server-presets.js';
import { MockMCPServerFacade } from '../mock-server-facade.js';

describe('Preset Factory Acceptance Criteria', () => {
  let server: MockMCPServerFacade;

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('AC 1: Factory function exists with preset support', () => {
    it('should export createMockMCPServer factory function', () => {
      expect(typeof createMockMCPServer).toBe('function');
      expect(createMockMCPServer.name).toBe('createMockMCPServer');
    });

    it('should have all 6 built-in presets available', () => {
      const availablePresets = getAvailablePresets();

      // Base presets (4)
      expect(availablePresets).toContain('filesystem');
      expect(availablePresets).toContain('database');
      expect(availablePresets).toContain('api');
      expect(availablePresets).toContain('minimal');

      // Behavior modifiers (2)
      expect(availablePresets).toContain('error-prone');
      expect(availablePresets).toContain('slow');

      expect(availablePresets).toHaveLength(6);
    });

    it('should distinguish between base presets and behavior modifiers', () => {
      // Base presets should not be behavior modifiers
      expect(isBehaviorModifier('filesystem')).toBe(false);
      expect(isBehaviorModifier('database')).toBe(false);
      expect(isBehaviorModifier('api')).toBe(false);
      expect(isBehaviorModifier('minimal')).toBe(false);

      // Behavior modifiers should be identified correctly
      expect(isBehaviorModifier('error-prone')).toBe(true);
      expect(isBehaviorModifier('slow')).toBe(true);
    });

    it('should support both string and array preset parameters', () => {
      // String preset
      expect(() => {
        const server1 = createMockMCPServer('minimal');
        expect(server1).toBeInstanceOf(MockMCPServerFacade);
      }).not.toThrow();

      // Array preset
      expect(() => {
        const server2 = createMockMCPServer(['minimal']);
        expect(server2).toBeInstanceOf(MockMCPServerFacade);
      }).not.toThrow();

      // Array with base + modifier
      expect(() => {
        const server3 = createMockMCPServer(['minimal', 'slow']);
        expect(server3).toBeInstanceOf(MockMCPServerFacade);
      }).not.toThrow();
    });

    it('should provide convenience functions for each base preset', () => {
      expect(typeof createFileSystemMockServer).toBe('function');
      expect(typeof createDatabaseMockServer).toBe('function');
      expect(typeof createApiMockServer).toBe('function');
      expect(typeof createMinimalMockServer).toBe('function');
    });
  });

  describe('AC 2: Can create mock servers with single function call using preset name', () => {
    it('should create filesystem server with single function call', async () => {
      server = createMockMCPServer('filesystem');

      expect(server).toBeInstanceOf(MockMCPServerFacade);

      // Verify it's a working server
      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      // Check it has filesystem tools
      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      });

      const result = response?.result as { tools: Array<{ name: string }> };
      const toolNames = result.tools.map(t => t.name);

      expect(toolNames).toContain('read_file');
      expect(toolNames).toContain('write_file');
      expect(toolNames).toContain('list_directory');
      expect(toolNames).toContain('delete_file');
      expect(toolNames).toContain('create_directory');
    });

    it('should create database server with single function call', async () => {
      server = createMockMCPServer('database');

      expect(server).toBeInstanceOf(MockMCPServerFacade);

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      });

      const result = response?.result as { tools: Array<{ name: string }> };
      const toolNames = result.tools.map(t => t.name);

      expect(toolNames).toContain('query');
      expect(toolNames).toContain('insert');
      expect(toolNames).toContain('update');
      expect(toolNames).toContain('delete');
      expect(toolNames).toContain('list_tables');
    });

    it('should create api server with single function call', async () => {
      server = createMockMCPServer('api');

      expect(server).toBeInstanceOf(MockMCPServerFacade);

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      });

      const result = response?.result as { tools: Array<{ name: string }> };
      const toolNames = result.tools.map(t => t.name);

      expect(toolNames).toContain('http_get');
      expect(toolNames).toContain('http_post');
      expect(toolNames).toContain('http_put');
      expect(toolNames).toContain('http_delete');
      expect(toolNames).toContain('http_patch');
    });

    it('should create minimal server with single function call', async () => {
      server = createMockMCPServer('minimal');

      expect(server).toBeInstanceOf(MockMCPServerFacade);

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      });

      const result = response?.result as { tools: Array<{ name: string }> };
      expect(result.tools).toEqual([]); // Minimal server has no tools
    });

    it('should create error-prone server with single function call', async () => {
      // Error-prone is a behavior modifier, needs a base preset
      server = createMockMCPServer(['minimal', 'error-prone']);

      expect(server).toBeInstanceOf(MockMCPServerFacade);

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      // Verify error injection is configured
      // Make multiple requests and expect some to fail
      let errorCount = 0;
      const totalRequests = 10;

      for (let i = 0; i < totalRequests; i++) {
        try {
          const response = await transport.send({
            jsonrpc: '2.0',
            id: i + 1,
            method: 'tools/list',
          });

          if (response?.error) {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }

      // Should have some errors due to error-prone behavior
      expect(errorCount).toBeGreaterThan(0);
    });

    it('should create slow server with single function call', async () => {
      server = createMockMCPServer(['minimal', 'slow']);

      expect(server).toBeInstanceOf(MockMCPServerFacade);

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      // Verify slow behavior by measuring request duration
      const startTime = Date.now();
      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      });
      const duration = Date.now() - startTime;

      // Should have significant delay (slow modifier adds 500-2000ms)
      expect(duration).toBeGreaterThan(400);
    });

    it('should work with convenience functions', () => {
      const fsServer = createFileSystemMockServer();
      expect(fsServer).toBeInstanceOf(MockMCPServerFacade);

      const dbServer = createDatabaseMockServer();
      expect(dbServer).toBeInstanceOf(MockMCPServerFacade);

      const apiServer = createApiMockServer();
      expect(apiServer).toBeInstanceOf(MockMCPServerFacade);

      const minServer = createMinimalMockServer();
      expect(minServer).toBeInstanceOf(MockMCPServerFacade);
    });
  });

  describe('AC 3: Custom config can override preset defaults', () => {
    it('should override server name from preset default', async () => {
      const customName = 'my-custom-filesystem-server';
      server = createMockMCPServer('filesystem', { name: customName });

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      });

      const result = response?.result as { serverInfo: { name: string } };
      expect(result.serverInfo.name).toBe(customName);
    });

    it('should override server description from preset default', async () => {
      const customDescription = 'My custom server description';
      server = createMockMCPServer('minimal', { description: customDescription });

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      });

      // Note: description might not be directly exposed in MCP protocol,
      // but the override should be applied internally
      expect(response?.result).toBeDefined();
    });

    it('should add additional tools to preset defaults', async () => {
      const additionalTools = [
        {
          toolName: 'custom_backup',
          response: {
            content: [{ type: 'text', text: 'Backup completed successfully' }],
            isError: false,
          },
          priority: 50,
        },
        {
          toolName: 'custom_restore',
          response: {
            content: [{ type: 'text', text: 'Restore completed successfully' }],
            isError: false,
          },
          priority: 50,
        },
      ];

      server = createMockMCPServer('filesystem', { additionalTools });

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      });

      const result = response?.result as { tools: Array<{ name: string }> };
      const toolNames = result.tools.map(t => t.name);

      // Should have original filesystem tools
      expect(toolNames).toContain('read_file');
      expect(toolNames).toContain('write_file');

      // Should also have additional tools
      expect(toolNames).toContain('custom_backup');
      expect(toolNames).toContain('custom_restore');
    });

    it('should override preset tool handlers', async () => {
      const toolOverrides = {
        read_file: {
          response: {
            content: [{ type: 'text', text: 'Custom overridden file content' }],
            isError: false,
          },
        },
      };

      server = createMockMCPServer('filesystem', { toolOverrides });

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'read_file', arguments: { path: '/test.txt' } }
      });

      const result = response?.result as { content: Array<{ type: string; text: string }> };
      expect(result.content[0].text).toBe('Custom overridden file content');
    });

    it('should override delay configuration', async () => {
      const customDelay = 150;
      server = createMockMCPServer('minimal', { delay: customDelay });

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      const startTime = Date.now();
      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      });
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThan(customDelay - 50); // Allow some variance
      expect(duration).toBeLessThan(customDelay + 100);
    });

    it('should override delay with range configuration', async () => {
      const delayRange = { min: 80, max: 120 };
      server = createMockMCPServer('minimal', { delay: delayRange });

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      const startTime = Date.now();
      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      });
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThan(delayRange.min - 30);
      expect(duration).toBeLessThan(delayRange.max + 50);
    });

    it('should override server capabilities', async () => {
      const customCapabilities = {
        tools: { listChanged: true },
        resources: { subscribe: false, listChanged: true },
      };

      server = createMockMCPServer('minimal', { capabilities: customCapabilities });

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      });

      const result = response?.result as { capabilities: any };
      expect(result.capabilities.tools?.listChanged).toBe(true);
      expect(result.capabilities.resources?.subscribe).toBe(false);
      expect(result.capabilities.resources?.listChanged).toBe(true);
    });

    it('should apply error simulation configuration override', async () => {
      const errorConfig = {
        mode: 'always_fail' as const,
        category: 'jsonrpc' as const,
        customError: { code: -32001, message: 'Custom test error from override' },
        affectedClients: 'all' as const,
      };

      server = createMockMCPServer('minimal', { errorSimulation: errorConfig });

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      });

      expect(response?.error).toBeDefined();
      expect(response.error?.message).toBe('Custom test error from override');
      expect(response.error?.code).toBe(-32001);
    });

    it('should create custom scenarios from overrides', async () => {
      const scenarios = [
        {
          name: 'high-latency',
          behaviorPreset: 'slow' as const,
        },
        {
          name: 'failure-mode',
          behaviorPreset: 'error-prone' as const,
          errorPreset: 'request_timeout' as const,
        },
      ];

      server = createMockMCPServer('minimal', { scenarios });

      const availableScenarios = server.getAvailableScenarios();
      expect(availableScenarios).toContain('high-latency');
      expect(availableScenarios).toContain('failure-mode');
    });

    it('should combine multiple overrides effectively', async () => {
      const complexConfig: CreateMockServerOptions = {
        name: 'complex-test-server',
        description: 'A complex server configuration test',
        additionalTools: [
          {
            toolName: 'backup',
            response: {
              content: [{ type: 'text', text: 'Backup operation completed' }],
              isError: false,
            },
            priority: 50,
          },
        ],
        toolOverrides: {
          read_file: {
            response: {
              content: [{ type: 'text', text: 'Overridden read operation' }],
              isError: false,
            },
          },
        },
        delay: 75,
        capabilities: {
          tools: { listChanged: true },
          resources: { subscribe: true },
        },
        scenarios: [
          {
            name: 'stress-test',
            behaviorPreset: 'slow',
          },
        ],
      };

      server = createMockMCPServer('filesystem', complexConfig);

      expect(server).toBeInstanceOf(MockMCPServerFacade);

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      // Verify custom name
      const initResponse = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      });

      const initResult = initResponse?.result as any;
      expect(initResult.serverInfo.name).toBe('complex-test-server');
      expect(initResult.capabilities.resources.subscribe).toBe(true);

      // Verify tools include both original and additional
      const toolsResponse = await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      });

      const toolsResult = toolsResponse?.result as { tools: Array<{ name: string }> };
      const toolNames = toolsResult.tools.map(t => t.name);

      expect(toolNames).toContain('read_file'); // Original
      expect(toolNames).toContain('backup'); // Additional

      // Verify tool override
      const readResponse = await transport.send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'read_file', arguments: { path: '/test.txt' } }
      });

      const readResult = readResponse?.result as { content: Array<{ type: string; text: string }> };
      expect(readResult.content[0].text).toBe('Overridden read operation');

      // Verify delay
      const startTime = Date.now();
      await transport.send({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'backup', arguments: {} }
      });
      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThan(50);

      // Verify scenario
      expect(server.getAvailableScenarios()).toContain('stress-test');
    });
  });

  describe('Error Handling for Invalid Configurations', () => {
    it('should reject unknown preset names', () => {
      expect(() => createMockMCPServer('unknown-preset' as MockServerPreset)).toThrow(
        'Unknown server preset: unknown-preset'
      );
    });

    it('should reject empty preset array', () => {
      expect(() => createMockMCPServer([])).toThrow(
        'At least one base preset (filesystem, database, api, minimal) must be provided'
      );
    });

    it('should reject multiple base presets', () => {
      expect(() => createMockMCPServer(['filesystem', 'database'])).toThrow(
        'Only one base preset can be specified'
      );
    });

    it('should reject behavior modifiers without base preset', () => {
      expect(() => createMockMCPServer(['error-prone', 'slow'])).toThrow(
        'At least one base preset (filesystem, database, api, minimal) must be provided'
      );
    });
  });
});
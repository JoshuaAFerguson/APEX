/**
 * @fileoverview Tests for Preset-Based Mock MCP Server Factory
 *
 * Comprehensive test suite for the createMockMCPServer() factory function
 * and related preset functionality.
 *
 * Tests ADR-080: Preset-Based Mock MCP Server Factory implementation
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
  getServerPreset,
  getAvailablePresets,
  isValidPreset,
  isBehaviorModifier,
  getBasePresets,
} from '../server-presets.js';
import { MockMCPServerFacade } from '../mock-server-facade.js';
import type { MockToolHandler } from '@apexcli/core';

describe('createMockMCPServer', () => {
  let server: MockMCPServerFacade;

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('basic preset usage', () => {
    it('creates filesystem server from preset', async () => {
      server = createMockMCPServer('filesystem');

      expect(server).toBeInstanceOf(MockMCPServerFacade);
      expect(server.getTransport()).toBeDefined();

      // Start server and check tools
      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      // Send a tools/list request
      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      });

      expect(response?.result).toBeDefined();
      const result = response.result as { tools: Array<{ name: string }> };
      const toolNames = result.tools.map(t => t.name);

      expect(toolNames).toContain('read_file');
      expect(toolNames).toContain('write_file');
      expect(toolNames).toContain('list_directory');
      expect(toolNames).toContain('delete_file');
      expect(toolNames).toContain('create_directory');
    });

    it('creates database server from preset', async () => {
      server = createMockMCPServer('database');

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

    it('creates api server from preset', async () => {
      server = createMockMCPServer('api');

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

    it('creates minimal server from preset', async () => {
      server = createMockMCPServer('minimal');

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      });

      const result = response?.result as { tools: Array<{ name: string }> };
      expect(result.tools).toEqual([]);
    });

    it('handles tool calls correctly for each preset', async () => {
      // Test filesystem tool call
      server = createMockMCPServer('filesystem');
      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      const readFileResponse = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'read_file',
          arguments: { path: '/test.txt' }
        }
      });

      expect(readFileResponse?.result).toBeDefined();
      const result = readFileResponse.result as { content: Array<{ type: string; text: string }> };
      expect(result.content[0].text).toContain('Mock file content');

      await server.stop();
    });
  });

  describe('behavior modifiers', () => {
    it('applies slow modifier to base preset', async () => {
      server = createMockMCPServer(['filesystem', 'slow']);

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

      // Should have significant delay (slow modifier adds 500-2000ms)
      expect(duration).toBeGreaterThan(400);
    });

    it('applies error-prone modifier to base preset', async () => {
      server = createMockMCPServer(['database', 'error-prone']);

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      // Make multiple requests and expect some errors
      const responses = [];
      for (let i = 0; i < 10; i++) {
        try {
          const response = await transport.send({
            jsonrpc: '2.0',
            id: i + 1,
            method: 'tools/call',
            params: { name: 'query', arguments: { sql: 'SELECT * FROM users' } }
          });
          responses.push(response);
        } catch (error) {
          responses.push({ error });
        }
      }

      // With 30% error rate, we should see some errors in 10 requests
      const errorCount = responses.filter(r => 'error' in r || r?.error).length;
      expect(errorCount).toBeGreaterThan(0);
    });

    it('combines multiple behavior modifiers', async () => {
      server = createMockMCPServer(['api', 'slow', 'error-prone']);

      expect(server).toBeInstanceOf(MockMCPServerFacade);
      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      // Should have both slow behavior and error injection
      const startTime = Date.now();
      try {
        await transport.send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'http_get', arguments: { url: 'https://api.example.com' } }
        });
      } catch (error) {
        // May error due to error-prone modifier
      }
      const duration = Date.now() - startTime;

      // Should still have delay even if error occurred
      expect(duration).toBeGreaterThan(100);
    });
  });

  describe('override options', () => {
    it('allows custom server name', async () => {
      server = createMockMCPServer('filesystem', { name: 'my-custom-fs-server' });

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

      expect(response?.result).toBeDefined();
      const result = response.result as { serverInfo: { name: string } };
      expect(result.serverInfo.name).toBe('my-custom-fs-server');
    });

    it('adds additional tools to preset', async () => {
      const additionalTools: MockToolHandler[] = [
        {
          toolName: 'custom_tool',
          response: {
            content: [{ type: 'text', text: 'Custom tool response' }],
            isError: false,
          },
          priority: 50,
        },
      ];

      server = createMockMCPServer('minimal', { additionalTools });

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
      expect(toolNames).toContain('custom_tool');
    });

    it('overrides preset tool handlers', async () => {
      const toolOverrides = {
        read_file: {
          response: {
            content: [{ type: 'text', text: 'Overridden file content' }],
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
      expect(result.content[0].text).toBe('Overridden file content');
    });

    it('applies custom delay configuration', async () => {
      server = createMockMCPServer('minimal', { delay: 200 });

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

      expect(duration).toBeGreaterThan(150);
    });

    it('applies custom delay range', async () => {
      server = createMockMCPServer('minimal', { delay: { min: 100, max: 300 } });

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

      expect(duration).toBeGreaterThan(50);
      expect(duration).toBeLessThan(400);
    });

    it('applies error simulation configuration', async () => {
      server = createMockMCPServer('filesystem', {
        errorSimulation: {
          mode: 'always_fail',
          category: 'jsonrpc',
          customError: { code: -32001, message: 'Custom test error' },
          affectedClients: 'all',
        }
      });

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'read_file', arguments: { path: '/test.txt' } }
      });

      expect(response?.error).toBeDefined();
      expect(response.error?.message).toBe('Custom test error');
      expect(response.error?.code).toBe(-32001);
    });

    it('applies error preset', async () => {
      server = createMockMCPServer('api', { errorPreset: 'request_timeout' });

      expect(server.getErrorMode()).toBeDefined();
      expect(server.getErrorMode()?.preset).toBe('request_timeout');
    });

    it('overrides server capabilities', async () => {
      server = createMockMCPServer('minimal', {
        capabilities: {
          tools: { listChanged: true },
          resources: { subscribe: false },
        }
      });

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
    });

    it('creates scenarios from options', async () => {
      server = createMockMCPServer('filesystem', {
        scenarios: [
          {
            name: 'slow-mode',
            behaviorPreset: 'slow',
          },
          {
            name: 'error-mode',
            behaviorPreset: 'error-prone',
            errorPreset: 'request_timeout',
          },
        ]
      });

      expect(server.getAvailableScenarios()).toContain('slow-mode');
      expect(server.getAvailableScenarios()).toContain('error-mode');
    });
  });

  describe('error handling', () => {
    it('throws error for unknown preset', () => {
      expect(() => createMockMCPServer('unknown' as MockServerPreset)).toThrow(
        'Unknown server preset: unknown'
      );
    });

    it('throws error when no base preset provided', () => {
      expect(() => createMockMCPServer(['error-prone', 'slow'])).toThrow(
        'At least one base preset (filesystem, database, api, minimal) must be provided'
      );
    });

    it('throws error when multiple base presets provided', () => {
      expect(() => createMockMCPServer(['filesystem', 'database'])).toThrow(
        'Only one base preset can be specified'
      );
    });
  });

  describe('convenience functions', () => {
    it('createFileSystemMockServer works correctly', async () => {
      server = createFileSystemMockServer({ name: 'test-fs' });

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
      expect(toolNames).toContain('read_file');
    });

    it('createDatabaseMockServer works correctly', async () => {
      server = createDatabaseMockServer({ name: 'test-db' });

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
    });

    it('createApiMockServer works correctly', async () => {
      server = createApiMockServer({ name: 'test-api' });

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
    });

    it('createMinimalMockServer works correctly', async () => {
      server = createMinimalMockServer({ name: 'test-minimal' });

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      });

      const result = response?.result as { tools: Array<{ name: string }> };
      expect(result.tools).toEqual([]);
    });
  });
});

describe('server preset utilities', () => {
  it('getServerPreset returns correct preset', () => {
    const preset = getServerPreset('filesystem');
    expect(preset.name).toBe('filesystem-server');
    expect(preset.description).toContain('file system');
    expect(preset.toolHandlers.length).toBeGreaterThan(0);
  });

  it('getServerPreset throws for unknown preset', () => {
    expect(() => getServerPreset('unknown' as MockServerPreset)).toThrow(
      'Unknown server preset: unknown'
    );
  });

  it('getAvailablePresets returns all presets', () => {
    const presets = getAvailablePresets();
    expect(presets).toContain('filesystem');
    expect(presets).toContain('database');
    expect(presets).toContain('api');
    expect(presets).toContain('minimal');
    expect(presets).toContain('error-prone');
    expect(presets).toContain('slow');
  });

  it('isValidPreset works correctly', () => {
    expect(isValidPreset('filesystem')).toBe(true);
    expect(isValidPreset('database')).toBe(true);
    expect(isValidPreset('unknown')).toBe(false);
  });

  it('isBehaviorModifier identifies modifiers correctly', () => {
    expect(isBehaviorModifier('error-prone')).toBe(true);
    expect(isBehaviorModifier('slow')).toBe(true);
    expect(isBehaviorModifier('filesystem')).toBe(false);
    expect(isBehaviorModifier('database')).toBe(false);
  });

  it('getBasePresets excludes behavior modifiers', () => {
    const basePresets = getBasePresets();
    expect(basePresets).toContain('filesystem');
    expect(basePresets).toContain('database');
    expect(basePresets).toContain('api');
    expect(basePresets).toContain('minimal');
    expect(basePresets).not.toContain('error-prone');
    expect(basePresets).not.toContain('slow');
  });
});

describe('integration tests', () => {
  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  it('server responds to tool calls correctly', async () => {
    server = createMockMCPServer('database');
    await server.start();
    const transport = server.getTransport();
    await transport.connect();

    // Initialize the connection
    await transport.send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    });

    // Call a database tool
    const response = await transport.send({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'query',
        arguments: { sql: 'SELECT * FROM users' }
      }
    });

    expect(response?.result).toBeDefined();
    const result = response.result as { content: Array<{ type: string; text: string }> };
    expect(result.content[0].text).toContain('rows');

    // Verify the call was recorded
    server.assertToolCalled('query', 1);
    server.assertMethodCalled('tools/call', 1);
  });

  it('error-prone server injects errors', async () => {
    server = createMockMCPServer(['api', 'error-prone']);
    await server.start();
    const transport = server.getTransport();
    await transport.connect();

    await transport.send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    });

    // Make multiple requests and track errors
    let errorCount = 0;
    const totalRequests = 10;

    for (let i = 0; i < totalRequests; i++) {
      try {
        const response = await transport.send({
          jsonrpc: '2.0',
          id: i + 2,
          method: 'tools/call',
          params: { name: 'http_get', arguments: { url: 'https://api.example.com' } }
        });

        if (response?.error) {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
      }
    }

    // With 30% error injection, we expect some errors
    expect(errorCount).toBeGreaterThan(0);
    expect(errorCount).toBeLessThan(totalRequests); // Should not be all errors
  });

  it('slow server has expected latency', async () => {
    server = createMockMCPServer(['minimal', 'slow']);
    await server.start();
    const transport = server.getTransport();
    await transport.connect();

    await transport.send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    });

    const startTime = Date.now();
    await transport.send({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
    });
    const duration = Date.now() - startTime;

    // Slow modifier adds 500-2000ms delay
    expect(duration).toBeGreaterThan(400);
  });

  it('complex configuration with multiple features works', async () => {
    server = createMockMCPServer(['filesystem', 'slow'], {
      name: 'complex-test-server',
      additionalTools: [
        {
          toolName: 'backup',
          response: {
            content: [{ type: 'text', text: 'Backup completed' }],
            isError: false,
          },
          priority: 50,
        },
      ],
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true },
      },
      scenarios: [
        {
          name: 'error-scenario',
          behaviorPreset: 'error-prone',
        },
      ],
    });

    await server.start();
    const transport = server.getTransport();
    await transport.connect();

    // Initialize
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

    // Check tools include both filesystem and additional tools
    const toolsResponse = await transport.send({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
    });

    const toolsResult = toolsResponse?.result as { tools: Array<{ name: string }> };
    const toolNames = toolsResult.tools.map(t => t.name);
    expect(toolNames).toContain('read_file');
    expect(toolNames).toContain('backup');

    // Check that slow behavior is applied
    const startTime = Date.now();
    await transport.send({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'backup', arguments: {} }
    });
    const duration = Date.now() - startTime;
    expect(duration).toBeGreaterThan(400);

    // Check scenarios are available
    expect(server.getAvailableScenarios()).toContain('error-scenario');
  });
});
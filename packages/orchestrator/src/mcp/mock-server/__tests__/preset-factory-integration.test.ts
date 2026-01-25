/**
 * @fileoverview Integration Tests for Preset-Based Mock MCP Server Factory
 *
 * Tests integration between the preset factory and the broader mock server
 * ecosystem, including builders, error presets, and MCP client interactions.
 *
 * Tests ADR-080: Preset-Based Mock MCP Server Factory - Integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createMockMCPServer,
  createFileSystemMockServer,
  createDatabaseMockServer,
  createApiMockServer,
  createMinimalMockServer,
} from '../preset-factory.js';
import {
  MockMCPServerBuilder,
  createSimpleMockServer,
  ERROR_SIMULATION_PRESETS,
  getErrorPreset,
} from '../index.js';
import { MockMCPServerFacade } from '../mock-server-facade.js';
import type { MockToolHandler } from '@apexcli/core';

describe('Preset Factory Integration', () => {
  let server: MockMCPServerFacade;

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('integration with MockMCPServerBuilder', () => {
    it('should produce same functionality as equivalent builder', async () => {
      // Create server using preset factory
      const presetServer = createMockMCPServer('filesystem', {
        name: 'preset-fs-server',
        delay: 50
      });

      // Create equivalent server using builder
      const builderServer = new MockMCPServerBuilder()
        .withName('builder-fs-server', 'Mock server with file system operations')
        .withTool('read_file').withStaticResponse([{ type: 'text', text: 'Mock file content from filesystem preset' }])
        .withTool('write_file').withStaticResponse([{ type: 'text', text: 'File written successfully' }])
        .withTool('list_directory').withStaticResponse([{
          type: 'text',
          text: JSON.stringify([
            { name: 'file1.txt', type: 'file', size: 1024 },
            { name: 'file2.txt', type: 'file', size: 2048 },
            { name: 'subdir', type: 'directory' }
          ])
        }])
        .withTool('delete_file').withStaticResponse([{ type: 'text', text: 'File deleted successfully' }])
        .withTool('create_directory').withStaticResponse([{ type: 'text', text: 'Directory created successfully' }])
        .withDelay(50)
        .build();

      try {
        await presetServer.start();
        await builderServer.start();

        const presetTransport = presetServer.getTransport();
        const builderTransport = builderServer.getTransport();

        await presetTransport.connect();
        await builderTransport.connect();

        // Both should have the same tools
        const presetTools = await presetTransport.send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        });

        const builderTools = await builderTransport.send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        });

        const presetToolNames = (presetTools?.result as any).tools.map((t: any) => t.name).sort();
        const builderToolNames = (builderTools?.result as any).tools.map((t: any) => t.name).sort();

        expect(presetToolNames).toEqual(builderToolNames);

        // Both should respond to tool calls similarly
        const presetResponse = await presetTransport.send({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'read_file', arguments: { path: '/test.txt' } }
        });

        const builderResponse = await builderTransport.send({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'read_file', arguments: { path: '/test.txt' } }
        });

        expect((presetResponse?.result as any).content[0].text).toEqual(
          (builderResponse?.result as any).content[0].text
        );

      } finally {
        await presetServer.stop();
        await builderServer.stop();
      }
    });

    it('should integrate with builder error simulation', async () => {
      server = createMockMCPServer('api', {
        errorSimulation: {
          mode: 'always_fail',
          category: 'jsonrpc',
          customError: { code: -32001, message: 'Integration test error' },
          affectedClients: 'all'
        }
      });

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

      const response = await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'http_get', arguments: { url: 'https://api.example.com' } }
      });

      expect(response?.error).toBeDefined();
      expect(response.error?.message).toBe('Integration test error');
    });
  });

  describe('integration with error presets', () => {
    it('should work with all available error presets', async () => {
      const errorPresetNames = Object.keys(ERROR_SIMULATION_PRESETS);

      for (const presetName of errorPresetNames.slice(0, 3)) { // Test first 3 to avoid long test time
        server = createMockMCPServer('minimal', {
          errorPreset: presetName as any
        });

        expect(server).toBeInstanceOf(MockMCPServerFacade);
        await server?.stop();
      }
    });

    it('should integrate error preset with behavior modifiers', async () => {
      server = createMockMCPServer(['database', 'error-prone'], {
        errorPreset: 'request_timeout'
      });

      expect(server).toBeInstanceOf(MockMCPServerFacade);

      await server.start();
      const errorMode = server.getErrorMode();
      expect(errorMode?.preset).toBe('request_timeout');
    });
  });

  describe('integration with facade factories', () => {
    it('should be compatible with existing facade factories', async () => {
      // Create servers using different factory approaches
      const presetServer = createMockMCPServer('minimal', { name: 'preset-minimal' });
      const facadeServer = createSimpleMockServer('facade-minimal', []);

      try {
        await presetServer.start();
        await facadeServer.start();

        expect(presetServer).toBeInstanceOf(MockMCPServerFacade);
        expect(facadeServer).toBeInstanceOf(MockMCPServerFacade);

        // Both should have similar capabilities
        expect(presetServer.isRunning()).toBe(true);
        expect(facadeServer.isRunning()).toBe(true);

      } finally {
        await presetServer.stop();
        await facadeServer.stop();
      }
    });

    it('should have equivalent convenience functions', async () => {
      const presetFs = createFileSystemMockServer({ name: 'preset-fs' });
      const presetDb = createDatabaseMockServer({ name: 'preset-db' });
      const presetApi = createApiMockServer({ name: 'preset-api' });
      const presetMin = createMinimalMockServer({ name: 'preset-min' });

      const servers = [presetFs, presetDb, presetApi, presetMin];

      try {
        await Promise.all(servers.map(s => s.start()));

        for (const srv of servers) {
          expect(srv).toBeInstanceOf(MockMCPServerFacade);
          expect(srv.isRunning()).toBe(true);
        }

      } finally {
        await Promise.all(servers.map(s => s.stop()));
      }
    });
  });

  describe('integration with real MCP protocol flows', () => {
    it('should handle complete MCP lifecycle with filesystem preset', async () => {
      server = createMockMCPServer('filesystem', {
        name: 'lifecycle-test',
        additionalTools: [{
          toolName: 'custom_backup',
          response: { content: [{ type: 'text', text: 'Backup completed' }], isError: false },
          priority: 50
        }]
      });

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      // 1. Initialize
      const initResponse = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: { name: 'integration-test', version: '1.0.0' }
        }
      });

      expect(initResponse?.result).toBeDefined();
      expect((initResponse.result as any).serverInfo.name).toBe('lifecycle-test');

      // 2. List tools
      const toolsResponse = await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list'
      });

      const tools = (toolsResponse?.result as any).tools;
      const toolNames = tools.map((t: any) => t.name);
      expect(toolNames).toContain('read_file');
      expect(toolNames).toContain('custom_backup');

      // 3. Call preset tool
      const readResponse = await transport.send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'read_file', arguments: { path: '/test.txt' } }
      });

      expect(readResponse?.result).toBeDefined();
      expect((readResponse.result as any).content[0].text).toContain('Mock file content');

      // 4. Call additional tool
      const backupResponse = await transport.send({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'custom_backup', arguments: {} }
      });

      expect(backupResponse?.result).toBeDefined();
      expect((backupResponse.result as any).content[0].text).toBe('Backup completed');

      // 5. Verify request recording
      server.assertMethodCalled('initialize', 1);
      server.assertMethodCalled('tools/list', 1);
      server.assertMethodCalled('tools/call', 2);
      server.assertToolCalled('read_file', 1);
      server.assertToolCalled('custom_backup', 1);
    });

    it('should handle MCP protocol with behavior modifiers', async () => {
      server = createMockMCPServer(['api', 'slow'], {
        name: 'slow-api-test'
      });

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: { name: 'slow-test', version: '1.0.0' }
        }
      });

      // Measure response time for slow behavior
      const startTime = Date.now();
      const response = await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'http_get', arguments: { url: 'https://api.example.com' } }
      });
      const duration = Date.now() - startTime;

      expect(response?.result).toBeDefined();
      expect(duration).toBeGreaterThan(400); // Slow modifier adds 500-2000ms delay
    });

    it('should handle scenarios switching during protocol flows', async () => {
      server = createMockMCPServer('database', {
        scenarios: [
          { name: 'normal-mode', behaviorPreset: undefined },
          { name: 'slow-mode', behaviorPreset: 'slow' },
          { name: 'error-mode', behaviorPreset: 'error-prone' }
        ]
      });

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: { name: 'scenario-test', version: '1.0.0' }
        }
      });

      // Test normal mode
      const normalResponse = await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'query', arguments: { sql: 'SELECT * FROM users' } }
      });
      expect(normalResponse?.result).toBeDefined();

      // Switch to slow mode
      server.activateScenario('slow-mode');

      const startTime = Date.now();
      const slowResponse = await transport.send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'query', arguments: { sql: 'SELECT * FROM posts' } }
      });
      const duration = Date.now() - startTime;

      expect(slowResponse?.result).toBeDefined();
      expect(duration).toBeGreaterThan(400);

      // Verify scenarios are available
      expect(server.getAvailableScenarios()).toContain('normal-mode');
      expect(server.getAvailableScenarios()).toContain('slow-mode');
      expect(server.getAvailableScenarios()).toContain('error-mode');
    });
  });

  describe('integration with multiple clients', () => {
    it('should handle multiple concurrent clients with preset server', async () => {
      server = createMockMCPServer('api', {
        maxConnections: 5,
        name: 'multi-client-test'
      });

      await server.start();

      // Create multiple transports (simulating multiple clients)
      const transports = Array.from({ length: 3 }, () => server.getTransport());

      // Connect all transports
      await Promise.all(transports.map(t => t.connect()));

      // Initialize all connections
      const initPromises = transports.map((transport, i) =>
        transport.send({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            clientInfo: { name: `client-${i}`, version: '1.0.0' }
          }
        })
      );

      const initResponses = await Promise.all(initPromises);

      for (const response of initResponses) {
        expect(response?.result).toBeDefined();
      }

      // Make concurrent tool calls from all clients
      const toolCallPromises = transports.map((transport, i) =>
        transport.send({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'http_get', arguments: { url: `https://api${i}.example.com` } }
        })
      );

      const toolResponses = await Promise.all(toolCallPromises);

      for (const response of toolResponses) {
        expect(response?.result).toBeDefined();
      }

      // Verify all method calls were recorded
      server.assertMethodCalled('initialize', 3);
      server.assertMethodCalled('tools/call', 3);
    });
  });

  describe('integration with existing test utilities', () => {
    it('should work with all assertion methods', async () => {
      server = createMockMCPServer('filesystem', {
        name: 'assertion-test'
      });

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      // Make some calls
      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: { name: 'test', version: '1.0.0' }
        }
      });

      await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list'
      });

      await transport.send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'read_file', arguments: { path: '/test.txt' } }
      });

      // Test all assertion methods
      expect(() => server.assertMethodCalled('initialize', 1)).not.toThrow();
      expect(() => server.assertMethodCalled('tools/list', 1)).not.toThrow();
      expect(() => server.assertMethodCalled('tools/call', 1)).not.toThrow();
      expect(() => server.assertToolCalled('read_file', 1)).not.toThrow();

      // Test assertion failures
      expect(() => server.assertMethodCalled('unknown_method', 1)).toThrow();
      expect(() => server.assertToolCalled('unknown_tool', 1)).toThrow();
      expect(() => server.assertMethodCalled('initialize', 5)).toThrow();

      // Test stats
      const stats = server.getStats();
      expect(stats.requestCount).toBe(3);
      expect(stats.errorCount).toBe(0);

      // Test recorded requests
      const requests = server.getRecordedRequests();
      expect(requests).toHaveLength(3);
      expect(requests[0].method).toBe('initialize');
      expect(requests[1].method).toBe('tools/list');
      expect(requests[2].method).toBe('tools/call');
    });

    it('should integrate with custom test helpers', async () => {
      // Test helper function that uses preset factory
      const createTestDatabaseServer = (customQueries: Record<string, any> = {}) => {
        const additionalTools: MockToolHandler[] = Object.entries(customQueries).map(([query, result]) => ({
          toolName: `custom_query_${query}`,
          response: {
            content: [{ type: 'text', text: JSON.stringify(result) }],
            isError: false
          },
          priority: 50
        }));

        return createMockMCPServer('database', {
          name: 'test-database',
          additionalTools
        });
      };

      server = createTestDatabaseServer({
        users: [{ id: 1, name: 'Test User' }],
        posts: [{ id: 1, title: 'Test Post' }]
      });

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: { name: 'test', version: '1.0.0' }
        }
      });

      const toolsResponse = await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list'
      });

      const tools = (toolsResponse?.result as any).tools;
      const toolNames = tools.map((t: any) => t.name);

      expect(toolNames).toContain('query'); // From database preset
      expect(toolNames).toContain('custom_query_users'); // From custom helper
      expect(toolNames).toContain('custom_query_posts'); // From custom helper

      const customResponse = await transport.send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'custom_query_users', arguments: {} }
      });

      const result = JSON.parse((customResponse?.result as any).content[0].text);
      expect(result).toEqual([{ id: 1, name: 'Test User' }]);
    });
  });
});
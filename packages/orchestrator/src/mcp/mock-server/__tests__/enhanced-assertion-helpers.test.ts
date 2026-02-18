/**
 * @fileoverview Enhanced Assertion Helpers Test Suite
 *
 * Comprehensive tests for the four new assertion helpers added to MockMCPServerFacade:
 * - assertToolCalledWith()
 * - assertCallOrder()
 * - assertResponseContains()
 * - assertNoUnhandledCalls()
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MockMCPServerFacade,
  createSimpleMockServer,
  type MockToolHandler,
} from '../index.js';
import { MockAssertionError } from '../types.js';

describe('Enhanced Assertion Helpers', () => {
  let server: MockMCPServerFacade;

  beforeEach(async () => {
    // Create a server with multiple tool handlers for comprehensive testing
    const toolHandlers: MockToolHandler[] = [
      {
        toolName: 'read_file',
        response: {
          content: [{ type: 'text', text: 'Hello World' }],
          isError: false,
        },
      },
      {
        toolName: 'write_file',
        response: {
          content: [{ type: 'text', text: 'File written successfully' }],
          isError: false,
        },
      },
      {
        toolName: 'list_files',
        response: {
          content: [{ type: 'text', text: JSON.stringify(['file1.txt', 'file2.txt']) }],
          isError: false,
        },
      },
    ];

    server = createSimpleMockServer('enhanced-assertions-test', toolHandlers);
    await server.start();

    const transport = server.getTransport();
    await transport.connect();

    // Initialize the connection to set up basic state
    await transport.send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
    });
  });

  afterEach(async () => {
    if (server?.isStarted()) {
      await server.stop();
    }
  });

  describe('assertToolCalledWith()', () => {
    it('should pass when tool was called with exact parameters', async () => {
      // Arrange & Act
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'read_file',
          arguments: { path: '/test/file.txt', encoding: 'utf8' },
        },
      });

      // Assert
      expect(() => {
        server.assertToolCalledWith('read_file', {
          path: '/test/file.txt',
          encoding: 'utf8',
        });
      }).not.toThrow();
    });

    it('should pass when tool was called with partial parameters (subset)', async () => {
      // Arrange & Act
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'read_file',
          arguments: { path: '/test/file.txt', encoding: 'utf8', mode: 'readonly' },
        },
      });

      // Assert - should pass with partial match
      expect(() => {
        server.assertToolCalledWith('read_file', { path: '/test/file.txt' });
      }).not.toThrow();
    });

    it('should pass when tool was called specific number of times with parameters', async () => {
      // Arrange & Act
      for (let i = 0; i < 3; i++) {
        await server.getTransport().send({
          jsonrpc: '2.0',
          id: 2 + i,
          method: 'tools/call',
          params: {
            name: 'read_file',
            arguments: { path: '/test/file.txt' },
          },
        });
      }

      // Assert
      expect(() => {
        server.assertToolCalledWith('read_file', { path: '/test/file.txt' }, 3);
      }).not.toThrow();
    });

    it('should fail when tool was not called with expected parameters', () => {
      // Assert
      expect(() => {
        server.assertToolCalledWith('read_file', { path: '/nonexistent.txt' });
      }).toThrow(MockAssertionError);

      expect(() => {
        server.assertToolCalledWith('read_file', { path: '/nonexistent.txt' });
      }).toThrow(/never called with those parameters/);
    });

    it('should fail when tool was called wrong number of times', async () => {
      // Arrange & Act
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'read_file',
          arguments: { path: '/test/file.txt' },
        },
      });

      // Assert
      expect(() => {
        server.assertToolCalledWith('read_file', { path: '/test/file.txt' }, 3);
      }).toThrow(MockAssertionError);

      expect(() => {
        server.assertToolCalledWith('read_file', { path: '/test/file.txt' }, 3);
      }).toThrow(/called 3 times.*but was called 1 times/);
    });

    it('should handle empty parameters correctly', async () => {
      // Arrange & Act
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'list_files',
          arguments: {},
        },
      });

      // Assert
      expect(() => {
        server.assertToolCalledWith('list_files', {});
      }).not.toThrow();
    });
  });

  describe('assertCallOrder()', () => {
    beforeEach(async () => {
      // Set up a sequence of calls for testing
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      });

      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'read_file', arguments: { path: '/test.txt' } },
      });

      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'write_file', arguments: { path: '/output.txt' } },
      });
    });

    it('should pass for correct subsequence in contains mode', () => {
      // Assert
      expect(() => {
        server.assertCallOrder(['initialize', 'tools/list', 'tools/call'], 'contains');
      }).not.toThrow();

      expect(() => {
        server.assertCallOrder(['tools/list', 'tools/call']); // default contains mode
      }).not.toThrow();
    });

    it('should pass for exact sequence in strict mode', () => {
      // Assert - expect exact order
      expect(() => {
        server.assertCallOrder(['initialize', 'tools/list', 'tools/call', 'tools/call'], 'strict');
      }).not.toThrow();
    });

    it('should fail when subsequence is not found in contains mode', () => {
      // Assert
      expect(() => {
        server.assertCallOrder(['tools/call', 'initialize'], 'contains');
      }).toThrow(MockAssertionError);

      expect(() => {
        server.assertCallOrder(['tools/call', 'initialize'], 'contains');
      }).toThrow(/sequence.*was not found in actual call order/);
    });

    it('should fail when exact sequence is wrong in strict mode', () => {
      // Assert
      expect(() => {
        server.assertCallOrder(['initialize', 'tools/call', 'tools/list'], 'strict');
      }).toThrow(MockAssertionError);

      expect(() => {
        server.assertCallOrder(['initialize', 'tools/call', 'tools/list'], 'strict');
      }).toThrow(/Expected call 2 to be 'tools\/call', but was 'tools\/list'/);
    });

    it('should fail when call count is wrong in strict mode', () => {
      // Assert
      expect(() => {
        server.assertCallOrder(['initialize', 'tools/list'], 'strict');
      }).toThrow(MockAssertionError);

      expect(() => {
        server.assertCallOrder(['initialize', 'tools/list'], 'strict');
      }).toThrow(/Expected exactly 2 calls.*but got 4 calls/);
    });
  });

  describe('assertResponseContains()', () => {
    beforeEach(async () => {
      // Make some calls to generate responses
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      });

      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'read_file', arguments: { path: '/test.txt' } },
      });
    });

    it('should pass when response contains expected content', () => {
      // Assert
      expect(() => {
        server.assertResponseContains('tools/list', { tools: expect.any(Array) });
      }).not.toThrow();

      expect(() => {
        server.assertResponseContains('tools/call', {
          content: expect.arrayContaining([
            expect.objectContaining({ type: 'text' })
          ])
        });
      }).not.toThrow();
    });

    it('should work with custom matcher functions', () => {
      // Assert
      expect(() => {
        server.assertResponseContains('initialize', (response: any) =>
          response && response.protocolVersion === '2024-11-05'
        );
      }).not.toThrow();
    });

    it('should support matchCount options', async () => {
      // Add another tools/call
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'read_file', arguments: { path: '/test2.txt' } },
      });

      // Assert - all tools/call responses should contain content
      expect(() => {
        server.assertResponseContains('tools/call',
          { content: expect.any(Array) },
          { matchCount: 'all' }
        );
      }).not.toThrow();

      // Assert - exact count
      expect(() => {
        server.assertResponseContains('tools/call',
          { content: expect.any(Array) },
          { matchCount: 2 }
        );
      }).not.toThrow();
    });

    it('should fail when no responses contain expected content', () => {
      // Assert
      expect(() => {
        server.assertResponseContains('tools/list', { nonexistent: 'value' });
      }).toThrow(MockAssertionError);

      expect(() => {
        server.assertResponseContains('tools/list', { nonexistent: 'value' });
      }).toThrow(/Expected 1 responses.*to contain.*but only 0 matched/);
    });

    it('should fail when method has no calls', () => {
      // Assert
      expect(() => {
        server.assertResponseContains('nonexistent/method', { anything: true });
      }).toThrow(MockAssertionError);

      expect(() => {
        server.assertResponseContains('nonexistent/method', { anything: true });
      }).toThrow(/No calls found for method 'nonexistent\/method'/);
    });

    it('should support searching in error responses', async () => {
      // Create a server with error injection to test error response checking
      const errorServer = createSimpleMockServer('error-test', []);
      errorServer.setErrorInjection({
        enabled: true,
        probability: 1.0,
        errorCode: -32602,
        errorMessage: 'Invalid params',
        methods: ['tools/call'],
      });

      await errorServer.start();
      const errorTransport = errorServer.getTransport();
      await errorTransport.connect();

      await errorTransport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'nonexistent' },
      });

      // Assert error content
      expect(() => {
        errorServer.assertResponseContains('tools/call',
          { code: -32602 },
          { searchIn: 'error' }
        );
      }).not.toThrow();

      await errorServer.stop();
    });
  });

  describe('assertNoUnhandledCalls()', () => {
    beforeEach(async () => {
      // Make some expected calls
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      });

      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'read_file', arguments: {} },
      });
    });

    it('should pass when only expected methods were called in strict mode', () => {
      // Assert
      expect(() => {
        server.assertNoUnhandledCalls(['initialize', 'tools/list', 'tools/call'], { mode: 'strict' });
      }).not.toThrow();
    });

    it('should pass when ignoring specified methods', async () => {
      // Add a ping call that should be ignored
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 4,
        method: 'ping',
        params: {},
      });

      // Assert
      expect(() => {
        server.assertNoUnhandledCalls(['initialize', 'tools/list', 'tools/call'], {
          mode: 'strict',
          ignore: ['ping']
        });
      }).not.toThrow();
    });

    it('should pass when tracking mode with valid occurrence counts', () => {
      // Assert
      expect(() => {
        server.assertNoUnhandledCalls(['tools/call'], {
          mode: 'track',
          maxOccurrences: { 'tools/call': 5, 'tools/list': 2 }
        });
      }).not.toThrow();
    });

    it('should fail when unexpected methods were called in strict mode', async () => {
      // Add an unexpected call
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 4,
        method: 'unexpected/method',
        params: {},
      });

      // Assert
      expect(() => {
        server.assertNoUnhandledCalls(['initialize', 'tools/list', 'tools/call'], { mode: 'strict' });
      }).toThrow(MockAssertionError);

      expect(() => {
        server.assertNoUnhandledCalls(['initialize', 'tools/list', 'tools/call'], { mode: 'strict' });
      }).toThrow(/Unexpected method calls found.*'unexpected\/method'/);
    });

    it('should fail when occurrence limits are exceeded in track mode', async () => {
      // Add multiple calls to exceed limit
      for (let i = 0; i < 3; i++) {
        await server.getTransport().send({
          jsonrpc: '2.0',
          id: 10 + i,
          method: 'tools/call',
          params: { name: 'read_file', arguments: {} },
        });
      }

      // Assert - should now have 4 tools/call total, exceeding limit of 2
      expect(() => {
        server.assertNoUnhandledCalls(['tools/call'], {
          mode: 'track',
          maxOccurrences: { 'tools/call': 2 }
        });
      }).toThrow(MockAssertionError);

      expect(() => {
        server.assertNoUnhandledCalls(['tools/call'], {
          mode: 'track',
          maxOccurrences: { 'tools/call': 2 }
        });
      }).toThrow(/Method call limits exceeded.*'tools\/call' called 4 times \(max: 2\)/);
    });
  });

  describe('Integration Tests', () => {
    it('should work together for comprehensive test validation', async () => {
      // Arrange - simulate a realistic workflow
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      });

      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'read_file',
          arguments: { path: '/config.json', encoding: 'utf8' },
        },
      });

      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'write_file',
          arguments: { path: '/output.json', content: '{"result": "success"}' },
        },
      });

      // Assert using all enhanced assertion helpers
      expect(() => {
        // Check specific tool calls with parameters
        server.assertToolCalledWith('read_file', { path: '/config.json' });
        server.assertToolCalledWith('write_file', { path: '/output.json' });

        // Check call order
        server.assertCallOrder(['initialize', 'tools/list', 'tools/call'], 'contains');

        // Check response content
        server.assertResponseContains('tools/list', { tools: expect.any(Array) });
        server.assertResponseContains('tools/call', { content: expect.any(Array) });

        // Ensure no unexpected calls
        server.assertNoUnhandledCalls(['initialize', 'tools/list', 'tools/call'], { mode: 'strict' });
      }).not.toThrow();
    });

    it('should provide clear error messages when assertions fail', async () => {
      // Arrange
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'read_file', arguments: { path: '/test.txt' } },
      });

      // Act & Assert - verify error messages are helpful
      try {
        server.assertToolCalledWith('read_file', { path: '/wrong.txt' }, 1);
        expect.fail('Should have thrown MockAssertionError');
      } catch (error) {
        expect(error).toBeInstanceOf(MockAssertionError);
        expect(error.message).toContain('never called with those parameters');
        expect(error.message).toContain('/wrong.txt');
      }

      try {
        server.assertCallOrder(['tools/call', 'initialize'], 'contains');
        expect.fail('Should have thrown MockAssertionError');
      } catch (error) {
        expect(error).toBeInstanceOf(MockAssertionError);
        expect(error.message).toContain('sequence');
        expect(error.message).toContain('was not found');
      }

      try {
        server.assertResponseContains('tools/call', { nonexistent: true });
        expect.fail('Should have thrown MockAssertionError');
      } catch (error) {
        expect(error).toBeInstanceOf(MockAssertionError);
        expect(error.message).toContain('but only 0 matched');
      }

      try {
        server.assertNoUnhandledCalls(['initialize'], { mode: 'strict' });
        expect.fail('Should have thrown MockAssertionError');
      } catch (error) {
        expect(error).toBeInstanceOf(MockAssertionError);
        expect(error.message).toContain('Unexpected method calls found');
        expect(error.message).toContain('tools/call');
      }
    });
  });
});
/**
 * @fileoverview Enhanced Assertion Helpers Edge Cases Test Suite
 *
 * Additional comprehensive edge case tests for the enhanced assertion helpers:
 * - assertToolCalledWith()
 * - assertCallOrder()
 * - assertResponseContains()
 * - assertNoUnhandledCalls()
 *
 * This file focuses on edge cases, error conditions, and boundary testing
 * that complement the primary test suite.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MockMCPServerFacade,
  createSimpleMockServer,
  type MockToolHandler,
} from '../index.js';
import { MockAssertionError } from '../types.js';

describe('Enhanced Assertion Helpers - Edge Cases', () => {
  let server: MockMCPServerFacade;

  beforeEach(async () => {
    const toolHandlers: MockToolHandler[] = [
      {
        toolName: 'read_file',
        response: {
          content: [{ type: 'text', text: 'File content' }],
          isError: false,
        },
      },
      {
        toolName: 'complex_tool',
        response: {
          content: [{ type: 'text', text: 'Complex result' }],
          metadata: { processed: true, count: 42 },
          isError: false,
        },
      },
    ];

    server = createSimpleMockServer('edge-cases-test', toolHandlers);
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

  describe('assertToolCalledWith() Edge Cases', () => {
    it('should handle complex nested parameter structures', async () => {
      // Arrange & Act - call tool with complex nested parameters
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'complex_tool',
          arguments: {
            config: {
              database: { host: 'localhost', port: 5432 },
              options: { timeout: 30000, retries: 3 },
            },
            filters: ['active', 'verified'],
            metadata: { source: 'api', version: '1.2.0' },
          },
        },
      });

      // Assert - should match partial nested structure
      expect(() => {
        server.assertToolCalledWith('complex_tool', {
          config: { database: { host: 'localhost' } },
        });
      }).not.toThrow();

      // Assert - should match array elements
      expect(() => {
        server.assertToolCalledWith('complex_tool', {
          filters: ['active', 'verified'],
        });
      }).not.toThrow();

      // Assert - should handle deep nesting
      expect(() => {
        server.assertToolCalledWith('complex_tool', {
          metadata: { source: 'api' },
        });
      }).not.toThrow();
    });

    it('should handle null and undefined parameter values', async () => {
      // Arrange & Act
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'complex_tool',
          arguments: {
            nullValue: null,
            undefinedValue: undefined,
            emptyString: '',
            zeroNumber: 0,
            falseBoolean: false,
          },
        },
      });

      // Assert - should handle null values
      expect(() => {
        server.assertToolCalledWith('complex_tool', {
          nullValue: null,
        });
      }).not.toThrow();

      // Assert - should handle falsy values
      expect(() => {
        server.assertToolCalledWith('complex_tool', {
          emptyString: '',
          zeroNumber: 0,
          falseBoolean: false,
        });
      }).not.toThrow();
    });

    it('should fail with descriptive error when array matching fails', async () => {
      // Arrange & Act
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'complex_tool',
          arguments: {
            tags: ['important', 'urgent'],
          },
        },
      });

      // Assert - should fail with wrong array content
      expect(() => {
        server.assertToolCalledWith('complex_tool', {
          tags: ['normal', 'low-priority'],
        });
      }).toThrow(MockAssertionError);
    });

    it('should handle tools called with no arguments', async () => {
      // Arrange & Act
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'complex_tool',
          // No arguments field
        },
      });

      // Assert - should handle missing arguments
      expect(() => {
        server.assertToolCalledWith('complex_tool', {});
      }).not.toThrow();
    });

    it('should handle exact count assertions with edge cases', async () => {
      // Arrange & Act - call tool zero times (only initialize was called)

      // Assert - should fail for tool never called
      expect(() => {
        server.assertToolCalledWith('read_file', {}, 1);
      }).toThrow(MockAssertionError);

      // Assert - should pass for zero times when checking exact count
      expect(() => {
        server.assertToolCalledWith('read_file', {}, 0);
      }).not.toThrow();
    });
  });

  describe('assertCallOrder() Edge Cases', () => {
    it('should handle empty call sequences', () => {
      // Create a fresh server with no calls except initialize
      expect(() => {
        server.assertCallOrder([], 'strict');
      }).toThrow(MockAssertionError);

      expect(() => {
        server.assertCallOrder(['initialize'], 'strict');
      }).not.toThrow();
    });

    it('should handle duplicate methods in sequence', async () => {
      // Arrange & Act - make duplicate calls
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'read_file', arguments: {} },
      });

      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'read_file', arguments: {} },
      });

      // Assert - should handle repeated methods in strict mode
      expect(() => {
        server.assertCallOrder(['initialize', 'tools/call', 'tools/call'], 'strict');
      }).not.toThrow();

      // Assert - should handle repeated methods in contains mode
      expect(() => {
        server.assertCallOrder(['tools/call', 'tools/call'], 'contains');
      }).not.toThrow();
    });

    it('should handle very long call sequences', async () => {
      // Arrange & Act - make many calls
      const expectedSequence = ['initialize'];
      for (let i = 0; i < 50; i++) {
        await server.getTransport().send({
          jsonrpc: '2.0',
          id: i + 2,
          method: 'tools/call',
          params: { name: 'read_file', arguments: { index: i } },
        });
        expectedSequence.push('tools/call');
      }

      // Assert - should handle long sequences
      expect(() => {
        server.assertCallOrder(expectedSequence, 'strict');
      }).not.toThrow();
    });

    it('should provide detailed error for complex sequence mismatches', async () => {
      // Arrange & Act
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

      // Assert - should provide clear error for wrong position
      expect(() => {
        server.assertCallOrder(['initialize', 'tools/call', 'tools/list'], 'strict');
      }).toThrow(/Expected call 2 to be 'tools\/call', but was 'tools\/list'/);
    });
  });

  describe('assertResponseContains() Edge Cases', () => {
    beforeEach(async () => {
      // Set up responses for testing
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'complex_tool', arguments: {} },
      });
    });

    it('should handle complex nested response structures', () => {
      expect(() => {
        server.assertResponseContains('tools/call', {
          content: expect.arrayContaining([
            expect.objectContaining({ type: 'text' })
          ])
        });
      }).not.toThrow();

      expect(() => {
        server.assertResponseContains('tools/call', {
          metadata: expect.objectContaining({
            processed: true,
            count: expect.any(Number),
          })
        });
      }).not.toThrow();
    });

    it('should handle matcher functions with complex logic', () => {
      expect(() => {
        server.assertResponseContains('tools/call', (response: any) => {
          const result = response?.result || response;
          return (
            Array.isArray(result.content) &&
            result.content.some((item: any) => item.type === 'text') &&
            result.metadata?.count > 0
          );
        });
      }).not.toThrow();
    });

    it('should handle responses with both result and error content', () => {
      // The normal response should only have result content
      expect(() => {
        server.assertResponseContains('tools/call',
          { content: expect.any(Array) },
          { searchIn: 'result' }
        );
      }).not.toThrow();

      // Should handle 'both' search mode gracefully
      expect(() => {
        server.assertResponseContains('tools/call',
          { content: expect.any(Array) },
          { searchIn: 'both' }
        );
      }).not.toThrow();
    });

    it('should handle numeric matchCount edge cases', () => {
      // matchCount of 0 should always fail
      expect(() => {
        server.assertResponseContains('tools/call',
          { content: expect.any(Array) },
          { matchCount: 0 }
        );
      }).toThrow(MockAssertionError);

      // matchCount higher than available should fail
      expect(() => {
        server.assertResponseContains('tools/call',
          { content: expect.any(Array) },
          { matchCount: 5 }
        );
      }).toThrow(MockAssertionError);
    });
  });

  describe('assertNoUnhandledCalls() Edge Cases', () => {
    it('should handle empty expected methods list', async () => {
      // Arrange & Act - make a call
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'read_file', arguments: {} },
      });

      // Assert - empty expected list should fail in strict mode
      expect(() => {
        server.assertNoUnhandledCalls([], { mode: 'strict' });
      }).toThrow(MockAssertionError);
    });

    it('should handle overlapping ignore and expected lists', async () => {
      // Arrange & Act
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'ping',
        params: {},
      });

      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'read_file', arguments: {} },
      });

      // Assert - method in both expected and ignore should work
      expect(() => {
        server.assertNoUnhandledCalls(['initialize', 'ping'], {
          mode: 'strict',
          ignore: ['ping', 'tools/call'], // ignore overrides expected
        });
      }).not.toThrow();
    });

    it('should handle maxOccurrences with zero limits', () => {
      // Assert - zero limits should fail if method was called
      expect(() => {
        server.assertNoUnhandledCalls([], {
          mode: 'track',
          maxOccurrences: { 'initialize': 0 }, // initialize was definitely called
        });
      }).toThrow(MockAssertionError);
    });

    it('should handle large occurrence limits', async () => {
      // Arrange & Act - make moderate number of calls
      for (let i = 0; i < 10; i++) {
        await server.getTransport().send({
          jsonrpc: '2.0',
          id: i + 2,
          method: 'ping',
          params: {},
        });
      }

      // Assert - high limits should pass
      expect(() => {
        server.assertNoUnhandledCalls([], {
          mode: 'track',
          maxOccurrences: { 'ping': 1000 },
        });
      }).not.toThrow();

      // Assert - low limits should fail
      expect(() => {
        server.assertNoUnhandledCalls([], {
          mode: 'track',
          maxOccurrences: { 'ping': 5 },
        });
      }).toThrow(/Method call limits exceeded.*'ping' called 10 times \(max: 5\)/);
    });

    it('should handle methods not in maxOccurrences map', async () => {
      // Arrange & Act
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'read_file', arguments: {} },
      });

      // Assert - methods not in maxOccurrences should be ignored
      expect(() => {
        server.assertNoUnhandledCalls([], {
          mode: 'track',
          maxOccurrences: { 'some/other/method': 0 },
        });
      }).not.toThrow();
    });
  });

  describe('Integration Edge Cases', () => {
    it('should handle assertion errors with proper type checking', async () => {
      // Arrange & Act
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'read_file', arguments: { path: '/test.txt' } },
      });

      // Assert - verify MockAssertionError properties
      try {
        server.assertToolCalledWith('read_file', { path: '/wrong.txt' });
        expect.fail('Should have thrown MockAssertionError');
      } catch (error) {
        expect(error).toBeInstanceOf(MockAssertionError);
        expect(error.name).toBe('MockAssertionError');
        expect(error.expected).toBeDefined();
        expect(error.actual).toBeDefined();
        expect(typeof error.message).toBe('string');
      }
    });

    it('should handle concurrent assertions without interference', async () => {
      // Arrange & Act - make several calls
      await Promise.all([
        server.getTransport().send({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'read_file', arguments: { path: '/file1.txt' } },
        }),
        server.getTransport().send({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: { name: 'complex_tool', arguments: { mode: 'fast' } },
        }),
      ]);

      // Assert - multiple assertions should all work independently
      expect(() => {
        server.assertToolCalledWith('read_file', { path: '/file1.txt' });
        server.assertToolCalledWith('complex_tool', { mode: 'fast' });
        server.assertCallOrder(['initialize'], 'contains');
        server.assertResponseContains('tools/call', { content: expect.any(Array) });
        server.assertNoUnhandledCalls(
          ['initialize', 'tools/call'],
          { mode: 'strict' }
        );
      }).not.toThrow();
    });

    it('should maintain state consistency across multiple assertion calls', async () => {
      // Arrange & Act
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'read_file', arguments: { path: '/consistent.txt' } },
      });

      // Assert - repeated assertions should have consistent results
      const runAssertion = () => {
        server.assertToolCalledWith('read_file', { path: '/consistent.txt' }, 1);
      };

      // Should pass multiple times consistently
      expect(runAssertion).not.toThrow();
      expect(runAssertion).not.toThrow();
      expect(runAssertion).not.toThrow();

      // Add another call and verify count increases
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'read_file', arguments: { path: '/consistent.txt' } },
      });

      // Now should fail with count of 1, but pass with count of 2
      expect(() => {
        server.assertToolCalledWith('read_file', { path: '/consistent.txt' }, 1);
      }).toThrow();

      expect(() => {
        server.assertToolCalledWith('read_file', { path: '/consistent.txt' }, 2);
      }).not.toThrow();
    });
  });
});
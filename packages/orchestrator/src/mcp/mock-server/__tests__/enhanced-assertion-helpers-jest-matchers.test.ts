/**
 * @fileoverview Enhanced Assertion Helpers Jest Matchers Integration Test Suite
 *
 * Tests focusing on Jest/Vitest matcher integration with the enhanced assertion helpers.
 * Ensures proper support for expect.any(), expect.stringContaining(), etc.
 *
 * This complements the main test suite with focus on:
 * - Jest/Vitest matcher compatibility
 * - Complex object matching scenarios
 * - Custom matcher behavior
 * - Deep equality checking edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MockMCPServerFacade,
  createSimpleMockServer,
  type MockToolHandler,
} from '../index.js';
import { MockAssertionError } from '../types.js';

// Mock asymmetric matchers for testing matcher compatibility
const createAsymmetricMatcher = (matchFn: (actual: unknown) => boolean, description: string) => ({
  asymmetricMatch: matchFn,
  toString: () => description,
});

describe('Enhanced Assertion Helpers - Jest Matchers Integration', () => {
  let server: MockMCPServerFacade;

  beforeEach(async () => {
    const toolHandlers: MockToolHandler[] = [
      {
        toolName: 'data_processor',
        response: {
          content: [{
            type: 'text',
            text: 'Processing complete: 42 items processed in 1.5 seconds'
          }],
          stats: {
            itemsProcessed: 42,
            duration: 1500,
            timestamp: '2024-01-15T10:30:00Z',
            success: true
          },
          metadata: {
            version: '2.1.0',
            algorithm: 'fast-sort',
            checksum: 'abc123def456'
          },
          isError: false,
        },
      },
      {
        toolName: 'file_manager',
        response: {
          content: [{
            type: 'text',
            text: JSON.stringify({
              files: ['document.pdf', 'image.png', 'data.json'],
              totalSize: 2048576,
              lastModified: '2024-01-15T09:15:30Z'
            })
          }],
          isError: false,
        },
      },
    ];

    server = createSimpleMockServer('jest-matchers-test', toolHandlers);
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
        clientInfo: { name: 'matcher-test-client', version: '1.0.0' },
      },
    });
  });

  afterEach(async () => {
    if (server?.isStarted()) {
      await server.stop();
    }
  });

  describe('assertToolCalledWith() Jest Matchers', () => {
    it('should work with expect.any() matchers', async () => {
      // Arrange & Act
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'data_processor',
          arguments: {
            input: 'test-data.csv',
            config: {
              threads: 4,
              memory: 1024,
              timeout: 30000,
            },
            options: ['verbose', 'validate'],
          },
        },
      });

      // Assert - using various expect.any() matchers
      expect(() => {
        server.assertToolCalledWith('data_processor', {
          input: expect.any(String),
          config: {
            threads: expect.any(Number),
            memory: expect.any(Number),
          },
          options: expect.any(Array),
        });
      }).not.toThrow();
    });

    it('should work with expect.stringContaining() and related string matchers', async () => {
      // Arrange & Act
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'file_manager',
          arguments: {
            operation: 'list-files',
            directory: '/home/user/documents',
            pattern: '*.{pdf,doc,txt}',
            options: {
              recursive: true,
              includeHidden: false,
            },
          },
        },
      });

      // Assert - using string matchers
      expect(() => {
        server.assertToolCalledWith('file_manager', {
          operation: expect.stringContaining('list'),
          directory: expect.stringMatching(/^\/home\/user/),
          pattern: expect.stringContaining('pdf'),
        });
      }).not.toThrow();
    });

    it('should work with expect.arrayContaining() and object matchers', async () => {
      // Arrange & Act
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'data_processor',
          arguments: {
            filters: ['active', 'verified', 'premium'],
            sortBy: [
              { field: 'name', order: 'asc' },
              { field: 'date', order: 'desc' },
            ],
            metadata: {
              source: 'database',
              version: '1.0',
              cacheable: true,
            },
          },
        },
      });

      // Assert - using array and object matchers
      expect(() => {
        server.assertToolCalledWith('data_processor', {
          filters: expect.arrayContaining(['active', 'verified']),
          sortBy: expect.arrayContaining([
            expect.objectContaining({ field: 'name' }),
          ]),
          metadata: expect.objectContaining({
            source: expect.stringContaining('data'),
            cacheable: expect.any(Boolean),
          }),
        });
      }).not.toThrow();
    });

    it('should work with custom asymmetric matchers', async () => {
      // Arrange & Act
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'data_processor',
          arguments: {
            threshold: 0.85,
            count: 100,
            tags: ['important', 'urgent', 'review'],
          },
        },
      });

      // Custom matchers
      const isValidThreshold = createAsymmetricMatcher(
        (actual) => typeof actual === 'number' && actual >= 0 && actual <= 1,
        'validThreshold'
      );

      const hasMinItems = createAsymmetricMatcher(
        (actual) => Array.isArray(actual) && actual.length >= 2,
        'hasMinItems'
      );

      // Assert - using custom matchers
      expect(() => {
        server.assertToolCalledWith('data_processor', {
          threshold: isValidThreshold,
          count: expect.any(Number),
          tags: hasMinItems,
        });
      }).not.toThrow();
    });

    it('should handle nested Jest matcher combinations', async () => {
      // Arrange & Act
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'file_manager',
          arguments: {
            operations: [
              { type: 'read', file: 'config.json', options: { encoding: 'utf8' } },
              { type: 'write', file: 'output.txt', content: 'Hello World' },
            ],
            settings: {
              backup: true,
              compress: false,
              metadata: {
                created: '2024-01-15',
                author: 'test-user',
              },
            },
          },
        },
      });

      // Assert - deeply nested matchers
      expect(() => {
        server.assertToolCalledWith('file_manager', {
          operations: expect.arrayContaining([
            expect.objectContaining({
              type: expect.stringMatching(/^(read|write|delete)$/),
              file: expect.stringContaining('.json'),
              options: expect.objectContaining({
                encoding: expect.any(String),
              }),
            }),
          ]),
          settings: expect.objectContaining({
            backup: expect.any(Boolean),
            metadata: expect.objectContaining({
              created: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
              author: expect.stringContaining('test'),
            }),
          }),
        });
      }).not.toThrow();
    });
  });

  describe('assertResponseContains() Jest Matchers', () => {
    beforeEach(async () => {
      // Make some calls to generate responses
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'data_processor', arguments: { input: 'test.csv' } },
      });

      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'file_manager', arguments: { operation: 'list' } },
      });
    });

    it('should work with Jest matchers for response content', () => {
      expect(() => {
        server.assertResponseContains('tools/call', {
          content: expect.arrayContaining([
            expect.objectContaining({
              type: 'text',
              text: expect.stringContaining('Processing complete'),
            }),
          ]),
        });
      }).not.toThrow();
    });

    it('should work with complex nested response matchers', () => {
      expect(() => {
        server.assertResponseContains('tools/call', {
          stats: expect.objectContaining({
            itemsProcessed: expect.any(Number),
            duration: expect.any(Number),
            timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
            success: expect.any(Boolean),
          }),
          metadata: expect.objectContaining({
            version: expect.stringMatching(/^\d+\.\d+\.\d+$/),
            algorithm: expect.stringContaining('sort'),
            checksum: expect.stringMatching(/^[a-f0-9]+$/),
          }),
        });
      }).not.toThrow();
    });

    it('should work with custom matcher functions and Jest matchers combined', () => {
      expect(() => {
        server.assertResponseContains('tools/call', (response: any) => {
          const result = response?.result || response;

          // Use Jest matchers within custom function
          try {
            expect(result).toEqual(expect.objectContaining({
              content: expect.any(Array),
              stats: expect.objectContaining({
                itemsProcessed: expect.any(Number),
              }),
            }));
            return true;
          } catch {
            return false;
          }
        });
      }).not.toThrow();
    });

    it('should handle multiple responses with different matcher requirements', async () => {
      // Add more calls with different responses
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'data_processor', arguments: { mode: 'batch' } },
      });

      // Assert - all responses should match the pattern
      expect(() => {
        server.assertResponseContains('tools/call',
          {
            content: expect.arrayContaining([
              expect.objectContaining({ type: 'text' }),
            ]),
            stats: expect.objectContaining({
              itemsProcessed: expect.any(Number),
            }),
          },
          { matchCount: 'all' }
        );
      }).not.toThrow();
    });
  });

  describe('Jest Matcher Error Cases', () => {
    it('should provide clear errors when Jest matchers fail', async () => {
      // Arrange & Act
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'data_processor',
          arguments: {
            count: 'invalid-number', // Wrong type
            settings: { timeout: 5000 },
          },
        },
      });

      // Assert - should fail with descriptive error
      expect(() => {
        server.assertToolCalledWith('data_processor', {
          count: expect.any(Number), // This should fail
          settings: expect.objectContaining({
            timeout: expect.any(Number),
          }),
        });
      }).toThrow(MockAssertionError);
    });

    it('should handle asymmetric matcher failures properly', async () => {
      // Arrange & Act
      await server.getTransport().send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'data_processor',
          arguments: { threshold: 1.5 }, // Invalid threshold > 1
        },
      });

      const isValidThreshold = createAsymmetricMatcher(
        (actual) => typeof actual === 'number' && actual >= 0 && actual <= 1,
        'validThreshold(0-1)'
      );

      // Assert - should fail with custom matcher
      expect(() => {
        server.assertToolCalledWith('data_processor', {
          threshold: isValidThreshold,
        });
      }).toThrow(MockAssertionError);
    });
  });

  describe('Performance with Complex Matchers', () => {
    it('should handle many calls with complex Jest matchers efficiently', async () => {
      const startTime = Date.now();

      // Make many calls
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          server.getTransport().send({
            jsonrpc: '2.0',
            id: i + 10,
            method: 'tools/call',
            params: {
              name: 'data_processor',
              arguments: {
                batch: i,
                config: { threads: i % 4 + 1, memory: (i + 1) * 256 },
                tags: [`batch-${i}`, 'automated'],
              },
            },
          })
        );
      }

      await Promise.all(promises);

      // Assert with complex matchers - should complete reasonably quickly
      expect(() => {
        server.assertToolCalledWith('data_processor', {
          batch: expect.any(Number),
          config: expect.objectContaining({
            threads: expect.any(Number),
            memory: expect.any(Number),
          }),
          tags: expect.arrayContaining([
            expect.stringMatching(/^batch-\d+$/),
          ]),
        });
      }).not.toThrow();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);
    });

    it('should handle complex response matching efficiently', () => {
      const startTime = Date.now();

      expect(() => {
        server.assertResponseContains('tools/call',
          {
            content: expect.arrayContaining([
              expect.objectContaining({
                type: expect.stringMatching(/^text$/),
                text: expect.stringContaining('Processing'),
              }),
            ]),
            stats: expect.objectContaining({
              itemsProcessed: expect.any(Number),
              duration: expect.any(Number),
              timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
              success: expect.any(Boolean),
            }),
            metadata: expect.objectContaining({
              version: expect.stringMatching(/^\d+\.\d+\.\d+$/),
              algorithm: expect.any(String),
              checksum: expect.stringMatching(/^[a-z0-9]+$/),
            }),
          },
          { matchCount: 'all' }
        );
      }).not.toThrow();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Complex matching should still be fast (less than 1 second)
      expect(duration).toBeLessThan(1000);
    });
  });
});
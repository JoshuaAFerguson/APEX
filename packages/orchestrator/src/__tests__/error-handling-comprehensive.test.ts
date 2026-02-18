/**
 * Comprehensive Error Handling Tests
 *
 * This test suite provides detailed coverage of:
 * 1. Malformed schema handling and recovery
 * 2. Connection failure scenarios and resilience
 * 3. Timeout handling and resource cleanup
 * 4. Edge case error conditions
 * 5. Error propagation and event emission
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { z } from 'zod';
import type {
  MCPConnection,
  MCPConnectionState,
  MCPToolSchema,
  MCPTool,
} from '@apexcli/core';
import {
  MCPToolRegistry,
  type MCPConnectionManager,
  type MCPToolRegistryEvents,
} from '../mcp-tool-registry.js';
import { MCPClient, type MCPToolDefinition } from '../mcp/client.js';
import { SchemaTranslator, type JSONSchemaProperty } from '../schema-translator.js';

// ============================================================================
// Error Test Utilities
// ============================================================================

/**
 * Factory for creating various types of malformed schemas
 */
const MalformedSchemaFactory = {
  /**
   * Schema with invalid type values
   */
  invalidTypes: (): MCPToolDefinition => ({
    name: 'invalid-types-tool',
    description: 'Tool with invalid type declarations',
    inputSchema: {
      type: 'object',
      properties: {
        badType: {
          type: 'nonexistent-type' as any,
          description: 'Property with invalid type'
        },
        numericType: {
          type: 42 as any,
          description: 'Type should be string, not number'
        },
        arrayType: {
          type: ['invalid', 'array', 'syntax'] as any,
          description: 'Invalid array syntax'
        }
      },
      required: ['badType']
    } as MCPToolSchema,
  }),

  /**
   * Schema with invalid constraint values
   */
  invalidConstraints: (): MCPToolDefinition => ({
    name: 'invalid-constraints-tool',
    description: 'Tool with invalid constraints',
    inputSchema: {
      type: 'object',
      properties: {
        badMinLength: {
          type: 'string',
          minLength: 'not-a-number' as any,
          maxLength: -5 as any
        },
        badPattern: {
          type: 'string',
          pattern: 123 as any
        },
        badMinimum: {
          type: 'number',
          minimum: 'not-a-number' as any,
          maximum: null as any
        },
        badEnum: {
          type: 'string',
          enum: 'not-an-array' as any
        }
      },
      required: 'not-an-array' as any
    } as MCPToolSchema,
  }),

  /**
   * Schema with circular references
   */
  circularReferences: (): MCPToolDefinition => ({
    name: 'circular-refs-tool',
    description: 'Tool with circular schema references',
    inputSchema: {
      type: 'object',
      properties: {
        recursive: {
          $ref: '#' as any
        },
        nested: {
          type: 'object',
          properties: {
            parent: {
              $ref: '#' as any
            }
          }
        }
      }
    } as MCPToolSchema,
  }),

  /**
   * Schema with deeply nested invalid structures
   */
  deeplyNested: (): MCPToolDefinition => ({
    name: 'deeply-nested-tool',
    description: 'Tool with deeply nested invalid structures',
    inputSchema: {
      type: 'object',
      properties: {
        level1: {
          type: 'object',
          properties: {
            level2: {
              type: 'object',
              properties: {
                level3: {
                  type: 'object',
                  properties: {
                    level4: {
                      type: 'object',
                      properties: {
                        badProperty: {
                          type: 'invalid' as any,
                          properties: 'not-an-object' as any,
                          items: {
                            type: 'also-invalid' as any,
                            required: 123 as any
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } as MCPToolSchema,
  }),

  /**
   * Schema with null/undefined values
   */
  nullUndefinedValues: (): MCPToolDefinition => ({
    name: 'null-undefined-tool',
    description: 'Tool with null/undefined schema values',
    inputSchema: {
      type: 'object',
      properties: {
        nullProperty: null as any,
        undefinedProperty: undefined as any,
        emptyObject: {},
        invalidNested: {
          type: 'object',
          properties: null as any,
          required: undefined as any
        }
      },
      required: null as any
    } as MCPToolSchema,
  }),

  /**
   * Schema with invalid regex patterns
   */
  invalidRegex: (): MCPToolDefinition => ({
    name: 'invalid-regex-tool',
    description: 'Tool with invalid regex patterns',
    inputSchema: {
      type: 'object',
      properties: {
        invalidPattern1: {
          type: 'string',
          pattern: '[unclosed-bracket'
        },
        invalidPattern2: {
          type: 'string',
          pattern: '(?invalid-group)'
        },
        invalidPattern3: {
          type: 'string',
          pattern: '*invalid-quantifier'
        }
      }
    } as MCPToolSchema,
  }),

  /**
   * Schema with missing required fields
   */
  missingFields: (): MCPToolDefinition => ({
    name: 'missing-fields-tool',
    description: 'Tool with missing required schema fields',
    inputSchema: {
      // Missing 'type' field
      properties: {
        someProperty: {
          // Missing 'type' field
          description: 'Property without type'
        }
      }
    } as any,
  }),

  /**
   * Completely malformed schema
   */
  completelyMalformed: (): MCPToolDefinition => ({
    name: 'completely-malformed-tool',
    description: 'Tool with completely malformed schema',
    inputSchema: 'this-is-not-a-schema' as any,
  }),
};

/**
 * Factory for creating error-prone mock clients
 */
const ErrorClientFactory = {
  /**
   * Client that always throws on listTools
   */
  alwaysFailsListTools: (error: Error): MCPClient => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockRejectedValue(error),
    callTool: vi.fn().mockImplementation((name: string) =>
      Promise.resolve({ result: `Called ${name}` })
    ),
    ping: vi.fn().mockResolvedValue(undefined),
  } as any),

  /**
   * Client that times out on all operations
   */
  alwaysTimeouts: (timeoutMs: number = 10000): MCPClient => ({
    connect: vi.fn().mockImplementation(() =>
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), timeoutMs)
      )
    ),
    disconnect: vi.fn().mockImplementation(() =>
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Disconnect timeout')), timeoutMs)
      )
    ),
    listTools: vi.fn().mockImplementation(() =>
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('List tools timeout')), timeoutMs)
      )
    ),
    callTool: vi.fn().mockImplementation(() =>
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Call tool timeout')), timeoutMs)
      )
    ),
    ping: vi.fn().mockImplementation(() =>
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Ping timeout')), timeoutMs)
      )
    ),
  } as any),

  /**
   * Client that randomly fails operations
   */
  randomlyFails: (failureRate: number = 0.5): MCPClient => {
    const shouldFail = () => Math.random() < failureRate;

    return {
      connect: vi.fn().mockImplementation(() =>
        shouldFail() ? Promise.reject(new Error('Random connect failure')) : Promise.resolve()
      ),
      disconnect: vi.fn().mockImplementation(() =>
        shouldFail() ? Promise.reject(new Error('Random disconnect failure')) : Promise.resolve()
      ),
      listTools: vi.fn().mockImplementation(() =>
        shouldFail() ?
          Promise.reject(new Error('Random list tools failure')) :
          Promise.resolve([])
      ),
      callTool: vi.fn().mockImplementation((name: string) =>
        shouldFail() ?
          Promise.reject(new Error('Random call tool failure')) :
          Promise.resolve({ result: `Called ${name}` })
      ),
      ping: vi.fn().mockImplementation(() =>
        shouldFail() ? Promise.reject(new Error('Random ping failure')) : Promise.resolve()
      ),
    } as any;
  },

  /**
   * Client that returns malformed data
   */
  returnsMalformedData: (): MCPClient => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockImplementation(() =>
      Promise.resolve([
        null, // Invalid tool
        undefined, // Invalid tool
        'not-an-object', // Invalid tool
        { name: 123 }, // Invalid tool name type
        { description: null }, // Missing name
        {
          name: 'valid-name',
          // Missing inputSchema
        },
        {
          name: 'another-valid-name',
          inputSchema: 'not-a-schema-object'
        }
      ] as any)
    ),
    callTool: vi.fn().mockImplementation(() =>
      Promise.resolve('not-an-object-response' as any)
    ),
    ping: vi.fn().mockResolvedValue(undefined),
  } as any),

  /**
   * Client that throws different error types
   */
  throwsVariousErrors: (): MCPClient => {
    const errors = [
      new Error('Generic error'),
      new TypeError('Type error'),
      new ReferenceError('Reference error'),
      new SyntaxError('Syntax error'),
      new RangeError('Range error'),
      { message: 'Not an Error object' } as any,
      'String error' as any,
      null as any,
      undefined as any,
    ];

    let callCount = 0;

    return {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      listTools: vi.fn().mockImplementation(() => {
        const error = errors[callCount % errors.length];
        callCount++;
        return Promise.reject(error);
      }),
      callTool: vi.fn().mockImplementation((name: string) =>
        Promise.resolve({ result: `Called ${name}` })
      ),
      ping: vi.fn().mockResolvedValue(undefined),
    } as any;
  },
};

/**
 * Mock connection factory with error scenarios
 */
const createErrorConnection = (
  serverId: string,
  state: MCPConnectionState = 'connected',
  errorScenario?: string
): MCPConnection => {
  const baseConnection: MCPConnection = {
    serverId,
    serverName: `Error Server ${serverId}`,
    state,
    config: {
      name: serverId,
      command: 'mock-command',
      args: [],
      env: {},
    },
    connectedAt: state === 'connected' ? new Date() : undefined,
    lastActivityAt: state === 'connected' ? new Date() : undefined,
    reconnectAttempts: errorScenario === 'many-reconnects' ? 5 : 0,
    health: {
      healthy: state === 'connected',
      lastCheckAt: new Date(),
      consecutiveFailures: state === 'connected' ? 0 : 3,
      latencyMs: state === 'connected' ? 50 : undefined,
      avgLatencyMs: state === 'connected' ? 45 : undefined,
    },
  };

  if (errorScenario === 'corrupted-data') {
    (baseConnection as any).invalidField = 'should not exist';
    baseConnection.reconnectAttempts = 'not-a-number' as any;
  }

  return baseConnection;
};

/**
 * Event capture for error events
 */
class ErrorEventCapture {
  private events: Array<{ type: string; data: any; timestamp: Date }> = [];

  constructor(registry: MCPToolRegistry) {
    registry.on('error', (data) => {
      this.events.push({
        type: 'error',
        data: { ...data },
        timestamp: new Date(),
      });
    });
  }

  getErrors(): Array<{ type: string; data: any; timestamp: Date }> {
    return [...this.events];
  }

  getErrorsByOperation(operation: string): Array<{ type: string; data: any; timestamp: Date }> {
    return this.events.filter(e => e.data.operation === operation);
  }

  clear(): void {
    this.events = [];
  }
}

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error Handling - Comprehensive Coverage', () => {
  let registry: MCPToolRegistry;
  let translator: SchemaTranslator;
  let errorCapture: ErrorEventCapture;

  beforeEach(() => {
    translator = new SchemaTranslator();
    registry = new MCPToolRegistry({
      schemaTranslator: translator,
      operationTimeoutMs: 1000, // Short timeout for testing
      autoRefresh: false,
    });
    errorCapture = new ErrorEventCapture(registry);
  });

  afterEach(() => {
    registry.shutdown();
    vi.clearAllMocks();
  });

  describe('Malformed Schema Handling', () => {
    test('should handle invalid type declarations', async () => {
      const malformedTool = MalformedSchemaFactory.invalidTypes();

      // Should not throw during translation
      expect(() => {
        translator.translateTool({
          name: malformedTool.name,
          description: malformedTool.description!,
          serverId: 'test-server',
          inputSchema: malformedTool.inputSchema,
        });
      }).not.toThrow();

      const result = translator.translateTool({
        name: malformedTool.name,
        description: malformedTool.description!,
        serverId: 'test-server',
        inputSchema: malformedTool.inputSchema,
      });

      expect(result.name).toBe('invalid-types-tool');
      expect(result.parameters).toBeDefined();

      // Should create fallback schema for invalid types
      expect(result.parameters.parse({})).toBeDefined();
    });

    test('should handle invalid constraint values gracefully', async () => {
      const malformedTool = MalformedSchemaFactory.invalidConstraints();

      const result = translator.translateTool({
        name: malformedTool.name,
        description: malformedTool.description!,
        serverId: 'test-server',
        inputSchema: malformedTool.inputSchema,
      });

      expect(result.name).toBe('invalid-constraints-tool');
      expect(result.parameters).toBeDefined();

      // Should handle malformed constraints without crashing
      expect(() => result.parameters.parse({})).not.toThrow();
    });

    test('should handle circular references in schemas', async () => {
      const circularTool = MalformedSchemaFactory.circularReferences();

      expect(() => {
        translator.translateTool({
          name: circularTool.name,
          description: circularTool.description!,
          serverId: 'test-server',
          inputSchema: circularTool.inputSchema,
        });
      }).not.toThrow();
    });

    test('should handle deeply nested malformed structures', async () => {
      const deepTool = MalformedSchemaFactory.deeplyNested();

      const result = translator.translateTool({
        name: deepTool.name,
        description: deepTool.description!,
        serverId: 'test-server',
        inputSchema: deepTool.inputSchema,
      });

      expect(result.name).toBe('deeply-nested-tool');
      expect(result.parameters).toBeDefined();

      // Should be able to parse even with malformed nested structure
      expect(() => result.parameters.parse({ level1: {} })).not.toThrow();
    });

    test('should handle null and undefined schema values', async () => {
      const nullTool = MalformedSchemaFactory.nullUndefinedValues();

      const result = translator.translateTool({
        name: nullTool.name,
        description: nullTool.description!,
        serverId: 'test-server',
        inputSchema: nullTool.inputSchema,
      });

      expect(result.name).toBe('null-undefined-tool');
      expect(result.parameters).toBeDefined();

      // Should create usable schema despite null/undefined values
      expect(result.parameters.parse({})).toBeDefined();
    });

    test('should handle invalid regex patterns', async () => {
      const regexTool = MalformedSchemaFactory.invalidRegex();

      const result = translator.translateTool({
        name: regexTool.name,
        description: regexTool.description!,
        serverId: 'test-server',
        inputSchema: regexTool.inputSchema,
      });

      expect(result.name).toBe('invalid-regex-tool');
      expect(result.parameters).toBeDefined();

      // Should handle invalid regex without throwing
      expect(() => result.parameters.parse({
        invalidPattern1: 'test',
        invalidPattern2: 'test',
        invalidPattern3: 'test'
      })).not.toThrow();
    });

    test('should handle missing schema fields', async () => {
      const missingFieldsTool = MalformedSchemaFactory.missingFields();

      const result = translator.translateTool({
        name: missingFieldsTool.name,
        description: missingFieldsTool.description!,
        serverId: 'test-server',
        inputSchema: missingFieldsTool.inputSchema,
      });

      expect(result.name).toBe('missing-fields-tool');
      expect(result.parameters).toBeDefined();

      // Should create fallback schema for missing fields
      expect(result.parameters.parse({})).toBeDefined();
    });

    test('should handle completely malformed schemas', async () => {
      const malformedTool = MalformedSchemaFactory.completelyMalformed();

      expect(() => {
        translator.translateTool({
          name: malformedTool.name,
          description: malformedTool.description!,
          serverId: 'test-server',
          inputSchema: malformedTool.inputSchema,
        });
      }).not.toThrow();

      const result = translator.translateTool({
        name: malformedTool.name,
        description: malformedTool.description!,
        serverId: 'test-server',
        inputSchema: malformedTool.inputSchema,
      });

      expect(result.name).toBe('completely-malformed-tool');
      expect(result.parameters).toBeDefined();
    });

    test('should handle schema translation with all options', async () => {
      const malformedTool = MalformedSchemaFactory.invalidTypes();

      // Test with different translator options
      const translators = [
        new SchemaTranslator({ preserveDefaults: true }),
        new SchemaTranslator({ allowAdditionalProperties: true }),
        new SchemaTranslator({ allOptional: true }),
        new SchemaTranslator({
          preserveDefaults: true,
          allowAdditionalProperties: true,
          allOptional: true
        }),
      ];

      for (const translator of translators) {
        expect(() => {
          translator.translateTool({
            name: malformedTool.name,
            description: malformedTool.description!,
            serverId: 'test-server',
            inputSchema: malformedTool.inputSchema,
          });
        }).not.toThrow();
      }
    });
  });

  describe('Connection Failure Scenarios', () => {
    test('should handle client that always fails listTools', async () => {
      const connection = createErrorConnection('fail-server', 'connected');
      const failingClient = ErrorClientFactory.alwaysFailsListTools(new Error('List tools failed'));
      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(failingClient),
      };

      registry.setConnectionManager(mockConnMgr);
      await registry.addConnection(connection);

      errorCapture.clear();
      await registry.refreshAllTools();

      // Should handle error gracefully
      expect(registry.getAllTools()).toHaveLength(0);

      const errors = errorCapture.getErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].data.operation).toBe('refreshConnectionTools');
      expect(errors[0].data.error).toContain('List tools failed');
    });

    test('should handle timeout scenarios', async () => {
      const connection = createErrorConnection('timeout-server', 'connected');
      const timeoutClient = ErrorClientFactory.alwaysTimeouts(5000); // Longer than registry timeout
      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(timeoutClient),
      };

      registry.setConnectionManager(mockConnMgr);
      await registry.addConnection(connection);

      errorCapture.clear();
      await registry.refreshAllTools();

      // Should timeout and emit error
      const errors = errorCapture.getErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].data.error).toContain('timeout');
    });

    test('should handle randomly failing operations', async () => {
      const connection = createErrorConnection('random-server', 'connected');
      const randomClient = ErrorClientFactory.randomlyFails(0.8); // High failure rate
      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(randomClient),
      };

      registry.setConnectionManager(mockConnMgr);
      await registry.addConnection(connection);

      errorCapture.clear();

      // Try multiple times, some should fail
      let totalErrors = 0;
      for (let i = 0; i < 10; i++) {
        await registry.refreshAllTools();
        totalErrors += errorCapture.getErrors().length;
        errorCapture.clear();
      }

      // Should have encountered some failures
      expect(totalErrors).toBeGreaterThan(0);
    });

    test('should handle clients returning malformed data', async () => {
      const connection = createErrorConnection('malformed-server', 'connected');
      const malformedClient = ErrorClientFactory.returnsMalformedData();
      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(malformedClient),
      };

      registry.setConnectionManager(mockConnMgr);
      await registry.addConnection(connection);

      await registry.refreshAllTools();

      // Should handle malformed data gracefully
      // May register some valid tools, but shouldn't crash
      expect(() => registry.getAllTools()).not.toThrow();
      expect(() => registry.getStats()).not.toThrow();
    });

    test('should handle various error types', async () => {
      const connection = createErrorConnection('error-types-server', 'connected');
      const errorClient = ErrorClientFactory.throwsVariousErrors();
      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(errorClient),
      };

      registry.setConnectionManager(mockConnMgr);
      await registry.addConnection(connection);

      errorCapture.clear();

      // Try multiple operations to encounter different error types
      for (let i = 0; i < 5; i++) {
        await registry.refreshAllTools();
      }

      const errors = errorCapture.getErrors();
      expect(errors.length).toBeGreaterThan(0);

      // Should handle all error types gracefully
      errors.forEach(error => {
        expect(error.data.operation).toBe('refreshConnectionTools');
        expect(error.data.connectionId).toBe('error-types-server');
        expect(error.data.error).toBeDefined();
      });
    });
  });

  describe('Registry Error Recovery', () => {
    test('should recover from transient schema translation errors', async () => {
      const connection = createErrorConnection('recovery-server', 'connected');

      // Create a translator that fails initially but recovers
      let failCount = 0;
      const recoveringTranslator = {
        translateTool: vi.fn().mockImplementation((tool: MCPTool) => {
          failCount++;
          if (failCount <= 2) {
            throw new Error('Temporary translation error');
          }
          return translator.translateTool(tool);
        }),
      } as any;

      const recoveryRegistry = new MCPToolRegistry({
        schemaTranslator: recoveringTranslator,
        operationTimeoutMs: 1000,
        autoRefresh: false,
      });

      const recoveringClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        listTools: vi.fn().mockResolvedValue([{
          name: 'recovery-tool',
          description: 'Tool for recovery test',
          inputSchema: { type: 'object', properties: {} }
        }]),
        callTool: vi.fn().mockImplementation((name: string) =>
          Promise.resolve({ result: `Called ${name}` })
        ),
        ping: vi.fn().mockResolvedValue(undefined),
      } as any;

      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(recoveringClient),
      };

      recoveryRegistry.setConnectionManager(mockConnMgr);
      await recoveryRegistry.addConnection(connection);

      // First attempts should fail
      await recoveryRegistry.refreshAllTools();
      expect(recoveryRegistry.hasTool('recovery-tool')).toBe(false);

      await recoveryRegistry.refreshAllTools();
      expect(recoveryRegistry.hasTool('recovery-tool')).toBe(false);

      // Third attempt should succeed
      await recoveryRegistry.refreshAllTools();
      expect(recoveryRegistry.hasTool('recovery-tool')).toBe(true);

      recoveryRegistry.shutdown();
    });

    test('should handle registry corruption and cleanup', async () => {
      const connection = createErrorConnection('corrupt-server', 'connected', 'corrupted-data');
      const tools = [{
        name: 'corrupt-tool',
        description: 'Tool from corrupt server',
        inputSchema: { type: 'object', properties: {} }
      }];

      const mockClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        listTools: vi.fn().mockResolvedValue(tools),
        callTool: vi.fn().mockResolvedValue({ result: 'Called tool' }),
        ping: vi.fn().mockResolvedValue(undefined),
      } as any;

      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(mockClient),
      };

      registry.setConnectionManager(mockConnMgr);
      await registry.addConnection(connection);
      await registry.refreshAllTools();

      // Should handle corrupted data gracefully
      expect(registry.hasTool('corrupt-tool')).toBe(true);

      // Clear should clean up corruption
      registry.clear();
      expect(registry.getAllTools()).toHaveLength(0);
      expect(registry.getStats().totalTools).toBe(0);
    });

    test('should handle memory leaks during errors', async () => {
      const connection = createErrorConnection('memory-server', 'connected');
      const leakyClient = ErrorClientFactory.alwaysFailsListTools(new Error('Memory test error'));
      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(leakyClient),
      };

      registry.setConnectionManager(mockConnMgr);
      await registry.addConnection(connection);

      // Perform many failing operations
      for (let i = 0; i < 100; i++) {
        await registry.refreshAllTools();
      }

      // Registry should remain stable
      expect(registry.getAllTools()).toHaveLength(0);
      expect(registry.getStats().totalTools).toBe(0);

      // Should be able to add new connections
      await registry.removeConnection('memory-server', 'cleanup');
      expect(() => registry.addConnection(connection)).not.toThrow();
    });
  });

  describe('Edge Case Error Conditions', () => {
    test('should handle null/undefined connection manager', async () => {
      const connection = createErrorConnection('null-manager-server', 'connected');

      // Don't set connection manager
      await registry.addConnection(connection);
      await registry.refreshAllTools();

      // Should handle gracefully without crashing
      expect(registry.getAllTools()).toHaveLength(0);
      expect(() => registry.getStats()).not.toThrow();
    });

    test('should handle connection manager that throws errors', async () => {
      const connection = createErrorConnection('throwing-manager-server', 'connected');
      const throwingConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockImplementation(() => {
          throw new Error('Connection manager error');
        }),
        getConnection: vi.fn().mockImplementation(() => {
          throw new Error('Get connection error');
        }),
        getClient: vi.fn().mockImplementation(() => {
          throw new Error('Get client error');
        }),
      };

      registry.setConnectionManager(throwingConnMgr);
      await registry.addConnection(connection);

      // Should handle connection manager errors
      await registry.refreshAllTools();

      expect(registry.getAllTools()).toHaveLength(0);
    });

    test('should handle concurrent error operations', async () => {
      const connections = Array.from({ length: 10 }, (_, i) =>
        createErrorConnection(`concurrent-error-${i}`, 'connected')
      );

      const clients = new Map(connections.map(conn => [
        conn.serverId,
        ErrorClientFactory.alwaysFailsListTools(new Error(`Error for ${conn.serverId}`))
      ]));

      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue(connections),
        getConnection: vi.fn().mockImplementation((id: string) =>
          connections.find(c => c.serverId === id)
        ),
        getClient: vi.fn().mockImplementation((id: string) => clients.get(id)),
      };

      registry.setConnectionManager(mockConnMgr);

      // Add all connections
      const addPromises = connections.map(conn => registry.addConnection(conn));
      await Promise.all(addPromises);

      errorCapture.clear();

      // Trigger errors concurrently
      await registry.refreshAllTools();

      // Should handle all concurrent errors
      const errors = errorCapture.getErrors();
      expect(errors.length).toBeGreaterThan(0);

      // Registry should remain stable
      expect(() => registry.getStats()).not.toThrow();
      expect(registry.getAllTools()).toHaveLength(0);
    });

    test('should handle event listener errors during error handling', async () => {
      const connection = createErrorConnection('listener-error-server', 'connected');
      const errorClient = ErrorClientFactory.alwaysFailsListTools(new Error('Primary error'));

      // Add error-throwing listener
      registry.on('error', () => {
        throw new Error('Listener error');
      });

      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(errorClient),
      };

      registry.setConnectionManager(mockConnMgr);
      await registry.addConnection(connection);

      // Should handle listener errors without affecting operation
      await expect(registry.refreshAllTools()).resolves.not.toThrow();

      expect(registry.getAllTools()).toHaveLength(0);
    });

    test('should handle resource exhaustion scenarios', async () => {
      // Create many connections with timeout clients
      const connections = Array.from({ length: 50 }, (_, i) =>
        createErrorConnection(`resource-${i}`, 'connected')
      );

      const clients = new Map(connections.map(conn => [
        conn.serverId,
        ErrorClientFactory.alwaysTimeouts(2000) // Long timeout
      ]));

      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue(connections),
        getConnection: vi.fn().mockImplementation((id: string) =>
          connections.find(c => c.serverId === id)
        ),
        getClient: vi.fn().mockImplementation((id: string) => clients.get(id)),
      };

      registry.setConnectionManager(mockConnMgr);

      // Add all connections
      for (const conn of connections) {
        await registry.addConnection(conn);
      }

      // This will create many concurrent timeouts
      await registry.refreshAllTools();

      // Should handle resource exhaustion gracefully
      expect(() => registry.getStats()).not.toThrow();
      expect(registry.getAllTools()).toHaveLength(0);
    });
  });

  describe('Error Event Verification', () => {
    test('should emit detailed error events', async () => {
      const connection = createErrorConnection('event-server', 'connected');
      const errorClient = ErrorClientFactory.alwaysFailsListTools(new Error('Detailed error test'));
      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(errorClient),
      };

      registry.setConnectionManager(mockConnMgr);
      await registry.addConnection(connection);

      errorCapture.clear();
      await registry.refreshAllTools();

      const errors = errorCapture.getErrors();
      expect(errors.length).toBeGreaterThan(0);

      const error = errors[0];
      expect(error.data).toHaveProperty('operation');
      expect(error.data).toHaveProperty('connectionId');
      expect(error.data).toHaveProperty('error');
      expect(error.data).toHaveProperty('timestamp');

      expect(error.data.operation).toBe('refreshConnectionTools');
      expect(error.data.connectionId).toBe('event-server');
      expect(error.data.error).toContain('Detailed error test');
    });

    test('should maintain error event chronological order', async () => {
      const connection = createErrorConnection('chrono-server', 'connected');
      const errorClient = ErrorClientFactory.alwaysFailsListTools(new Error('Chronological test'));
      const mockConnMgr: MCPConnectionManager = {
        listConnections: vi.fn().mockReturnValue([connection]),
        getConnection: vi.fn().mockReturnValue(connection),
        getClient: vi.fn().mockReturnValue(errorClient),
      };

      registry.setConnectionManager(mockConnMgr);
      await registry.addConnection(connection);

      errorCapture.clear();

      // Generate multiple errors with delays
      for (let i = 0; i < 5; i++) {
        await registry.refreshAllTools();
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const errors = errorCapture.getErrors();
      expect(errors.length).toBeGreaterThan(0);

      // Verify chronological order
      for (let i = 1; i < errors.length; i++) {
        expect(errors[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          errors[i - 1].timestamp.getTime()
        );
      }
    });
  });
});
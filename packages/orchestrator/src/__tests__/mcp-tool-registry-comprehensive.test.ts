/**
 * Comprehensive Unit Tests for MCP Tool Registry and Schema Translation
 *
 * This test suite provides comprehensive coverage for:
 * 1. Schema translation for various MCP tool types
 * 2. Registry add/remove/update operations
 * 3. Connection lifecycle management
 * 4. Error handling for malformed schemas and failed connections
 *
 * These tests complement existing test suites to ensure complete coverage
 * of all acceptance criteria for the unit testing requirements.
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
  type MCPToolRegistryEntry,
  type MCPToolRegistryEvents,
} from '../mcp-tool-registry.js';
import { MCPClient, type MCPToolDefinition } from '../mcp/client.js';
import { SchemaTranslator, type JSONSchemaProperty, type ClaudeSDKTool } from '../schema-translator.js';

// ============================================================================
// Test Fixtures and Utilities
// ============================================================================

/**
 * Creates MCP tool definitions with various schema types for testing
 */
const TestToolFactory = {
  // Basic types
  stringTool: (): MCPToolDefinition => ({
    name: 'string-tool',
    description: 'Tool with string parameter',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Message parameter',
          minLength: 1,
          maxLength: 100,
          pattern: '^[a-zA-Z0-9 ]+$'
        }
      },
      required: ['message']
    } as MCPToolSchema,
  }),

  numberTool: (): MCPToolDefinition => ({
    name: 'number-tool',
    description: 'Tool with number parameter',
    inputSchema: {
      type: 'object',
      properties: {
        value: {
          type: 'number',
          description: 'Numeric value',
          minimum: 0,
          maximum: 1000,
          multipleOf: 0.5
        }
      },
      required: ['value']
    } as MCPToolSchema,
  }),

  integerTool: (): MCPToolDefinition => ({
    name: 'integer-tool',
    description: 'Tool with integer parameter',
    inputSchema: {
      type: 'object',
      properties: {
        count: {
          type: 'integer',
          description: 'Integer count',
          exclusiveMinimum: 0,
          exclusiveMaximum: 100
        }
      },
      required: ['count']
    } as MCPToolSchema,
  }),

  booleanTool: (): MCPToolDefinition => ({
    name: 'boolean-tool',
    description: 'Tool with boolean parameter',
    inputSchema: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          description: 'Enable flag'
        }
      },
      required: ['enabled']
    } as MCPToolSchema,
  }),

  arrayTool: (): MCPToolDefinition => ({
    name: 'array-tool',
    description: 'Tool with array parameter',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Array of items',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              priority: { type: 'integer', minimum: 1, maximum: 10 }
            },
            required: ['id', 'name']
          },
          minItems: 1,
          maxItems: 20
        }
      },
      required: ['items']
    } as MCPToolSchema,
  }),

  enumTool: (): MCPToolDefinition => ({
    name: 'enum-tool',
    description: 'Tool with enum parameter',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Status value',
          enum: ['pending', 'processing', 'completed', 'failed']
        },
        priority: {
          type: 'integer',
          enum: [1, 2, 3, 4, 5]
        }
      },
      required: ['status']
    } as MCPToolSchema,
  }),

  unionTool: (): MCPToolDefinition => ({
    name: 'union-tool',
    description: 'Tool with union types',
    inputSchema: {
      type: 'object',
      properties: {
        value: {
          oneOf: [
            { type: 'string', format: 'email' },
            { type: 'string', format: 'url' },
            { type: 'number', minimum: 0 }
          ]
        },
        config: {
          anyOf: [
            { type: 'string' },
            {
              type: 'object',
              properties: {
                mode: { type: 'string' },
                timeout: { type: 'number' }
              }
            }
          ]
        }
      },
      required: ['value']
    } as MCPToolSchema,
  }),

  intersectionTool: (): MCPToolDefinition => ({
    name: 'intersection-tool',
    description: 'Tool with intersection types',
    inputSchema: {
      type: 'object',
      properties: {
        config: {
          allOf: [
            {
              type: 'object',
              properties: {
                name: { type: 'string', minLength: 1 }
              },
              required: ['name']
            },
            {
              type: 'object',
              properties: {
                timeout: { type: 'number', minimum: 0 }
              }
            },
            {
              type: 'object',
              properties: {
                retries: { type: 'integer', minimum: 0, maximum: 10 }
              }
            }
          ]
        }
      },
      required: ['config']
    } as MCPToolSchema,
  }),

  nullableTool: (): MCPToolDefinition => ({
    name: 'nullable-tool',
    description: 'Tool with nullable parameters',
    inputSchema: {
      type: 'object',
      properties: {
        optionalString: {
          type: ['string', 'null'],
          description: 'Optional string that can be null'
        },
        optionalNumber: {
          type: ['number', 'null'],
          minimum: 0
        },
        mixedUnion: {
          type: ['string', 'number', 'boolean', 'null']
        }
      },
      required: []
    } as MCPToolSchema,
  }),

  formatTool: (): MCPToolDefinition => ({
    name: 'format-tool',
    description: 'Tool with format validations',
    inputSchema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          format: 'email'
        },
        url: {
          type: 'string',
          format: 'url'
        },
        uuid: {
          type: 'string',
          format: 'uuid'
        },
        datetime: {
          type: 'string',
          format: 'date-time'
        },
        ipv4: {
          type: 'string',
          format: 'ipv4'
        }
      },
      required: ['email']
    } as MCPToolSchema,
  }),

  constTool: (): MCPToolDefinition => ({
    name: 'const-tool',
    description: 'Tool with const values',
    inputSchema: {
      type: 'object',
      properties: {
        version: {
          const: 'v1.0.0'
        },
        type: {
          const: 'data-processing'
        }
      },
      required: ['version', 'type']
    } as MCPToolSchema,
  }),

  defaultValueTool: (): MCPToolDefinition => ({
    name: 'default-value-tool',
    description: 'Tool with default values',
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          default: 'standard',
          enum: ['standard', 'advanced', 'expert']
        },
        timeout: {
          type: 'number',
          default: 30000,
          minimum: 1000
        },
        enabled: {
          type: 'boolean',
          default: true
        }
      },
      required: []
    } as MCPToolSchema,
  }),

  malformedTool: (): MCPToolDefinition => ({
    name: 'malformed-tool',
    description: 'Tool with malformed schema',
    inputSchema: {
      type: 'object',
      properties: {
        bad_property: {
          type: 'unknown-type' as any,
          properties: 'not-an-object' as any,
          required: 'not-an-array' as any,
          items: 'not-valid' as any,
          minimum: 'not-a-number' as any,
          pattern: 123 as any
        }
      },
      required: ['bad_property']
    } as MCPToolSchema,
  }),

  emptyTool: (): MCPToolDefinition => ({
    name: 'empty-tool',
    description: 'Tool with empty schema',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    } as MCPToolSchema,
  }),

  additionalPropertiesTool: (): MCPToolDefinition => ({
    name: 'additional-properties-tool',
    description: 'Tool with additional properties',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' }
      },
      additionalProperties: {
        type: 'string'
      },
      required: ['name']
    } as MCPToolSchema,
  })
};

/**
 * Mock connection factory with realistic properties
 */
const createMockConnection = (
  serverId: string,
  state: MCPConnectionState = 'connected',
  options: Partial<MCPConnection> = {}
): MCPConnection => ({
  serverId,
  serverName: `Mock Server ${serverId}`,
  state,
  config: {
    name: serverId,
    command: 'mock-command',
    args: ['--server-id', serverId],
    env: { NODE_ENV: 'test' },
  },
  connectedAt: state === 'connected' ? new Date() : undefined,
  lastActivityAt: state === 'connected' ? new Date() : undefined,
  reconnectAttempts: 0,
  health: {
    healthy: state === 'connected',
    lastCheckAt: new Date(),
    consecutiveFailures: state === 'connected' ? 0 : 1,
    latencyMs: state === 'connected' ? 50 : undefined,
    avgLatencyMs: state === 'connected' ? 45 : undefined,
  },
  ...options,
});

/**
 * Mock MCP client with configurable behavior
 */
const createMockClient = (
  tools: MCPToolDefinition[] = [],
  options: {
    listToolsDelay?: number;
    listToolsError?: Error;
    callToolDelay?: number;
    callToolError?: Error;
  } = {}
): MCPClient => {
  const client = {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockImplementation(() => {
      if (options.listToolsError) {
        return Promise.reject(options.listToolsError);
      }
      if (options.listToolsDelay) {
        return new Promise(resolve =>
          setTimeout(() => resolve(tools), options.listToolsDelay)
        );
      }
      return Promise.resolve(tools);
    }),
    callTool: vi.fn().mockImplementation((name: string, args: Record<string, unknown>) => {
      if (options.callToolError) {
        return Promise.reject(options.callToolError);
      }
      if (options.callToolDelay) {
        return new Promise(resolve =>
          setTimeout(() => resolve({ result: `Called ${name}` }), options.callToolDelay)
        );
      }
      return Promise.resolve({ result: `Called ${name} with ${JSON.stringify(args)}` });
    }),
    ping: vi.fn().mockResolvedValue(undefined),
  } as any;

  return client;
};

/**
 * Mock connection manager with configurable connections and clients
 */
const createMockConnectionManager = (
  connections: MCPConnection[] = [],
  clients: Map<string, MCPClient> = new Map(),
  options: {
    getConnectionError?: Error;
    getClientError?: Error;
  } = {}
): MCPConnectionManager => ({
  listConnections: vi.fn().mockReturnValue(connections),
  getConnection: vi.fn().mockImplementation((id: string) => {
    if (options.getConnectionError) {
      throw options.getConnectionError;
    }
    return connections.find(conn => conn.serverId === id);
  }),
  getClient: vi.fn().mockImplementation((id: string) => {
    if (options.getClientError) {
      throw options.getClientError;
    }
    return clients.get(id);
  }),
});

/**
 * Event capture utility for testing
 */
class EventCapture {
  private events: Array<{ type: string; data: any; timestamp: Date }> = [];
  private registry: MCPToolRegistry;

  constructor(registry: MCPToolRegistry) {
    this.registry = registry;
    this.setupListeners();
  }

  private setupListeners(): void {
    const eventTypes: (keyof MCPToolRegistryEvents)[] = [
      'tool:registered',
      'tool:unregistered',
      'connection:added',
      'connection:removed',
      'registry:refreshed',
      'error'
    ];

    eventTypes.forEach(eventType => {
      this.registry.on(eventType, (data) => {
        this.events.push({
          type: eventType,
          data: { ...data },
          timestamp: new Date(),
        });
      });
    });
  }

  getEvents(): Array<{ type: string; data: any; timestamp: Date }> {
    return [...this.events];
  }

  getEventsByType(type: string): Array<{ type: string; data: any; timestamp: Date }> {
    return this.events.filter(e => e.type === type);
  }

  clear(): void {
    this.events = [];
  }
}

// ============================================================================
// Schema Translation Comprehensive Tests
// ============================================================================

describe('Schema Translation - Comprehensive Coverage', () => {
  let translator: SchemaTranslator;

  beforeEach(() => {
    translator = new SchemaTranslator();
  });

  describe('All JSON Schema Types', () => {
    test('should translate string type with all constraints', () => {
      const stringTool = TestToolFactory.stringTool();
      const result = translator.translateTool({
        name: stringTool.name,
        description: stringTool.description!,
        serverId: 'test-server',
        inputSchema: stringTool.inputSchema,
      });

      expect(result.name).toBe('string-tool');
      expect(result.description).toBe('Tool with string parameter');

      // Test validation
      const validData = { message: 'Hello World' };
      expect(result.parameters.parse(validData)).toEqual(validData);

      // Test constraints
      expect(() => result.parameters.parse({ message: '' })).toThrow(); // minLength
      expect(() => result.parameters.parse({ message: 'a'.repeat(101) })).toThrow(); // maxLength
      expect(() => result.parameters.parse({ message: 'hello@#$%' })).toThrow(); // pattern
    });

    test('should translate number type with all constraints', () => {
      const numberTool = TestToolFactory.numberTool();
      const result = translator.translateTool({
        name: numberTool.name,
        description: numberTool.description!,
        serverId: 'test-server',
        inputSchema: numberTool.inputSchema,
      });

      // Test valid values
      expect(result.parameters.parse({ value: 0 })).toEqual({ value: 0 });
      expect(result.parameters.parse({ value: 500.5 })).toEqual({ value: 500.5 });
      expect(result.parameters.parse({ value: 1000 })).toEqual({ value: 1000 });

      // Test constraints
      expect(() => result.parameters.parse({ value: -1 })).toThrow(); // minimum
      expect(() => result.parameters.parse({ value: 1001 })).toThrow(); // maximum
      expect(() => result.parameters.parse({ value: 10.3 })).toThrow(); // multipleOf
    });

    test('should translate integer type with exclusive constraints', () => {
      const integerTool = TestToolFactory.integerTool();
      const result = translator.translateTool({
        name: integerTool.name,
        description: integerTool.description!,
        serverId: 'test-server',
        inputSchema: integerTool.inputSchema,
      });

      // Test valid values
      expect(result.parameters.parse({ count: 1 })).toEqual({ count: 1 });
      expect(result.parameters.parse({ count: 99 })).toEqual({ count: 99 });

      // Test exclusive constraints
      expect(() => result.parameters.parse({ count: 0 })).toThrow(); // exclusiveMinimum
      expect(() => result.parameters.parse({ count: 100 })).toThrow(); // exclusiveMaximum
      expect(() => result.parameters.parse({ count: 50.5 })).toThrow(); // not integer
    });

    test('should translate array type with complex items', () => {
      const arrayTool = TestToolFactory.arrayTool();
      const result = translator.translateTool({
        name: arrayTool.name,
        description: arrayTool.description!,
        serverId: 'test-server',
        inputSchema: arrayTool.inputSchema,
      });

      const validData = {
        items: [
          { id: '1', name: 'Item 1', priority: 5 },
          { id: '2', name: 'Item 2' } // priority is optional
        ]
      };
      expect(result.parameters.parse(validData)).toEqual(validData);

      // Test constraints
      expect(() => result.parameters.parse({ items: [] })).toThrow(); // minItems
      expect(() => result.parameters.parse({
        items: Array.from({ length: 21 }, (_, i) => ({ id: `${i}`, name: `Item ${i}` }))
      })).toThrow(); // maxItems

      // Test item validation
      expect(() => result.parameters.parse({
        items: [{ name: 'Missing ID' }]
      })).toThrow(); // missing required field
      expect(() => result.parameters.parse({
        items: [{ id: '1', name: 'Item 1', priority: 11 }]
      })).toThrow(); // priority out of range
    });

    test('should translate enum types correctly', () => {
      const enumTool = TestToolFactory.enumTool();
      const result = translator.translateTool({
        name: enumTool.name,
        description: enumTool.description!,
        serverId: 'test-server',
        inputSchema: enumTool.inputSchema,
      });

      // Test valid enum values
      expect(result.parameters.parse({ status: 'pending' })).toEqual({ status: 'pending' });
      expect(result.parameters.parse({ status: 'completed', priority: 3 })).toEqual({
        status: 'completed',
        priority: 3
      });

      // Test invalid enum values
      expect(() => result.parameters.parse({ status: 'invalid' })).toThrow();
      expect(() => result.parameters.parse({ status: 'pending', priority: 6 })).toThrow();
    });

    test('should translate union types (oneOf)', () => {
      const unionTool = TestToolFactory.unionTool();
      const result = translator.translateTool({
        name: unionTool.name,
        description: unionTool.description!,
        serverId: 'test-server',
        inputSchema: unionTool.inputSchema,
      });

      // Test different union branches
      expect(result.parameters.parse({ value: 'test@example.com' })).toEqual({ value: 'test@example.com' });
      expect(result.parameters.parse({ value: 'https://example.com' })).toEqual({ value: 'https://example.com' });
      expect(result.parameters.parse({ value: 42 })).toEqual({ value: 42 });

      // Test config anyOf
      expect(result.parameters.parse({ value: 42, config: 'simple' })).toEqual({ value: 42, config: 'simple' });
      expect(result.parameters.parse({
        value: 42,
        config: { mode: 'advanced', timeout: 5000 }
      })).toEqual({ value: 42, config: { mode: 'advanced', timeout: 5000 } });

      // Test invalid values
      expect(() => result.parameters.parse({ value: 'not-an-email-or-url' })).toThrow();
      expect(() => result.parameters.parse({ value: -1 })).toThrow();
    });

    test('should translate intersection types (allOf)', () => {
      const intersectionTool = TestToolFactory.intersectionTool();
      const result = translator.translateTool({
        name: intersectionTool.name,
        description: intersectionTool.description!,
        serverId: 'test-server',
        inputSchema: intersectionTool.inputSchema,
      });

      // Test valid intersection
      const validConfig = {
        config: {
          name: 'test-config',
          timeout: 1000,
          retries: 3
        }
      };
      expect(result.parameters.parse(validConfig)).toEqual(validConfig);

      // Test missing required from first schema
      expect(() => result.parameters.parse({
        config: { timeout: 1000, retries: 3 }
      })).toThrow();

      // Test violating constraint from one schema
      expect(() => result.parameters.parse({
        config: { name: '', timeout: 1000 } // empty name violates minLength
      })).toThrow();
    });

    test('should translate nullable types', () => {
      const nullableTool = TestToolFactory.nullableTool();
      const result = translator.translateTool({
        name: nullableTool.name,
        description: nullableTool.description!,
        serverId: 'test-server',
        inputSchema: nullableTool.inputSchema,
      });

      // Test null values
      expect(result.parameters.parse({ optionalString: null })).toEqual({ optionalString: null });
      expect(result.parameters.parse({ optionalNumber: null })).toEqual({ optionalNumber: null });
      expect(result.parameters.parse({ mixedUnion: null })).toEqual({ mixedUnion: null });

      // Test non-null values
      expect(result.parameters.parse({ optionalString: 'hello' })).toEqual({ optionalString: 'hello' });
      expect(result.parameters.parse({ optionalNumber: 42 })).toEqual({ optionalNumber: 42 });
      expect(result.parameters.parse({ mixedUnion: 'string' })).toEqual({ mixedUnion: 'string' });
      expect(result.parameters.parse({ mixedUnion: true })).toEqual({ mixedUnion: true });

      // Test invalid types
      expect(() => result.parameters.parse({ optionalNumber: -1 })).toThrow(); // violates minimum
    });

    test('should translate format constraints', () => {
      const formatTool = TestToolFactory.formatTool();
      const result = translator.translateTool({
        name: formatTool.name,
        description: formatTool.description!,
        serverId: 'test-server',
        inputSchema: formatTool.inputSchema,
      });

      // Test valid formats
      expect(result.parameters.parse({ email: 'test@example.com' })).toEqual({ email: 'test@example.com' });
      expect(result.parameters.parse({
        email: 'test@example.com',
        url: 'https://example.com',
        uuid: '123e4567-e89b-12d3-a456-426614174000',
        datetime: '2023-12-25T12:00:00Z',
        ipv4: '192.168.1.1'
      })).toEqual({
        email: 'test@example.com',
        url: 'https://example.com',
        uuid: '123e4567-e89b-12d3-a456-426614174000',
        datetime: '2023-12-25T12:00:00Z',
        ipv4: '192.168.1.1'
      });

      // Test invalid formats
      expect(() => result.parameters.parse({ email: 'not-an-email' })).toThrow();
      expect(() => result.parameters.parse({ email: 'test@example.com', url: 'not-a-url' })).toThrow();
    });

    test('should translate const values', () => {
      const constTool = TestToolFactory.constTool();
      const result = translator.translateTool({
        name: constTool.name,
        description: constTool.description!,
        serverId: 'test-server',
        inputSchema: constTool.inputSchema,
      });

      // Test valid const values
      expect(result.parameters.parse({
        version: 'v1.0.0',
        type: 'data-processing'
      })).toEqual({
        version: 'v1.0.0',
        type: 'data-processing'
      });

      // Test invalid const values
      expect(() => result.parameters.parse({
        version: 'v2.0.0',
        type: 'data-processing'
      })).toThrow();
      expect(() => result.parameters.parse({
        version: 'v1.0.0',
        type: 'other-type'
      })).toThrow();
    });
  });

  describe('Schema Translator Options', () => {
    test('should handle preserveDefaults option', () => {
      const translatorWithDefaults = new SchemaTranslator({ preserveDefaults: true });
      const defaultTool = TestToolFactory.defaultValueTool();

      const result = translatorWithDefaults.translateTool({
        name: defaultTool.name,
        description: defaultTool.description!,
        serverId: 'test-server',
        inputSchema: defaultTool.inputSchema,
      });

      // Test default values are applied
      expect(result.parameters.parse({})).toEqual({
        mode: 'standard',
        timeout: 30000,
        enabled: true
      });

      // Test overriding defaults
      expect(result.parameters.parse({ mode: 'expert' })).toEqual({
        mode: 'expert',
        timeout: 30000,
        enabled: true
      });
    });

    test('should handle allowAdditionalProperties option', () => {
      const translatorWithAdditional = new SchemaTranslator({ allowAdditionalProperties: true });
      const additionalTool = TestToolFactory.additionalPropertiesTool();

      const result = translatorWithAdditional.translateTool({
        name: additionalTool.name,
        description: additionalTool.description!,
        serverId: 'test-server',
        inputSchema: additionalTool.inputSchema,
      });

      // Test additional properties are allowed
      expect(result.parameters.parse({
        name: 'test',
        extra: 'allowed',
        another: 'also-allowed'
      })).toEqual({
        name: 'test',
        extra: 'allowed',
        another: 'also-allowed'
      });
    });

    test('should handle allOptional option', () => {
      const translatorAllOptional = new SchemaTranslator({ allOptional: true });
      const stringTool = TestToolFactory.stringTool();

      const result = translatorAllOptional.translateTool({
        name: stringTool.name,
        description: stringTool.description!,
        serverId: 'test-server',
        inputSchema: stringTool.inputSchema,
      });

      // Test required fields become optional
      expect(result.parameters.parse({})).toEqual({});
    });

    test('should handle custom type handlers', () => {
      const customHandlers = new Map();
      customHandlers.set('custom', (schema: JSONSchemaProperty) => {
        return z.string().transform(val => val.toUpperCase());
      });

      const customTranslator = new SchemaTranslator({ customTypeHandlers: customHandlers });

      const customProperty: JSONSchemaProperty = {
        type: 'custom' as any
      };

      const result = customTranslator.translateProperty(customProperty, false);
      expect(result.parse('hello')).toBe('HELLO');
    });
  });

  describe('Error Handling in Schema Translation', () => {
    test('should handle malformed schemas gracefully', () => {
      const malformedTool = TestToolFactory.malformedTool();

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

      expect(result.name).toBe('malformed-tool');
      expect(result.parameters).toBeDefined();
    });

    test('should handle empty schemas', () => {
      const emptyTool = TestToolFactory.emptyTool();

      const result = translator.translateTool({
        name: emptyTool.name,
        description: emptyTool.description!,
        serverId: 'test-server',
        inputSchema: emptyTool.inputSchema,
      });

      expect(result.name).toBe('empty-tool');
      expect(result.parameters.parse({})).toEqual({});
    });

    test('should handle missing inputSchema', () => {
      const toolWithoutSchema: MCPTool = {
        name: 'no-schema-tool',
        description: 'Tool without input schema',
        serverId: 'test-server',
        inputSchema: {} as MCPToolSchema, // Empty schema
      };

      const result = translator.translateTool(toolWithoutSchema);

      expect(result.name).toBe('no-schema-tool');
      expect(result.parameters.parse({})).toEqual({});
    });

    test('should handle invalid regex patterns', () => {
      const property: JSONSchemaProperty = {
        type: 'string',
        pattern: '[invalid regex(' // Invalid regex
      };

      // Should not throw during translation
      expect(() => {
        translator.translateProperty(property, false);
      }).not.toThrow();
    });
  });
});

// ============================================================================
// Registry Operations Comprehensive Tests
// ============================================================================

describe('Registry Operations - Comprehensive Coverage', () => {
  let registry: MCPToolRegistry;
  let eventCapture: EventCapture;

  beforeEach(() => {
    registry = new MCPToolRegistry({
      operationTimeoutMs: 5000,
      autoRefresh: false,
    });
    eventCapture = new EventCapture(registry);
  });

  afterEach(() => {
    registry.shutdown();
    vi.clearAllMocks();
  });

  describe('Tool Registration Operations', () => {
    test('should handle batch tool registration', async () => {
      const connection = createMockConnection('batch-server');
      const tools = [
        TestToolFactory.stringTool(),
        TestToolFactory.numberTool(),
        TestToolFactory.booleanTool(),
        TestToolFactory.arrayTool(),
        TestToolFactory.enumTool(),
      ];

      const mockClient = createMockClient(tools);
      const mockConnMgr = createMockConnectionManager([connection], new Map([['batch-server', mockClient]]));

      registry.setConnectionManager(mockConnMgr);
      await registry.addConnection(connection);
      await registry.refreshAllTools();

      // Verify all tools registered
      expect(registry.getAllTools()).toHaveLength(5);
      tools.forEach(tool => {
        expect(registry.hasTool(tool.name)).toBe(true);
        expect(registry.isToolAvailable(tool.name)).toBe(true);
      });

      // Verify events
      const registrationEvents = eventCapture.getEventsByType('tool:registered');
      expect(registrationEvents).toHaveLength(5);
    });

    test('should handle tool updates when refreshing', async () => {
      const connection = createMockConnection('update-server');
      const initialTools = [TestToolFactory.stringTool()];
      const updatedTools = [
        {
          ...TestToolFactory.stringTool(),
          description: 'Updated string tool description'
        },
        TestToolFactory.numberTool()
      ];

      const mockClient = createMockClient(initialTools);
      const mockConnMgr = createMockConnectionManager([connection], new Map([['update-server', mockClient]]));

      registry.setConnectionManager(mockConnMgr);
      await registry.addConnection(connection);
      await registry.refreshAllTools();

      expect(registry.getAllTools()).toHaveLength(1);
      const initialTool = registry.getTool('string-tool');
      expect(initialTool?.mcpTool.description).toBe('Tool with string parameter');

      // Update mock client to return updated tools
      mockClient.listTools.mockResolvedValue(updatedTools);
      await registry.refreshAllTools();

      expect(registry.getAllTools()).toHaveLength(2);
      const updatedTool = registry.getTool('string-tool');
      expect(updatedTool?.mcpTool.description).toBe('Updated string tool description');
      expect(registry.hasTool('number-tool')).toBe(true);
    });

    test('should handle tool removal when server stops providing them', async () => {
      const connection = createMockConnection('removal-server');
      const initialTools = [TestToolFactory.stringTool(), TestToolFactory.numberTool()];
      const reducedTools = [TestToolFactory.stringTool()];

      const mockClient = createMockClient(initialTools);
      const mockConnMgr = createMockConnectionManager([connection], new Map([['removal-server', mockClient]]));

      registry.setConnectionManager(mockConnMgr);
      await registry.addConnection(connection);
      await registry.refreshAllTools();

      expect(registry.getAllTools()).toHaveLength(2);

      // Update mock client to return fewer tools
      mockClient.listTools.mockResolvedValue(reducedTools);
      eventCapture.clear();
      await registry.refreshAllTools();

      expect(registry.getAllTools()).toHaveLength(1);
      expect(registry.hasTool('string-tool')).toBe(true);
      expect(registry.hasTool('number-tool')).toBe(false);

      // Verify unregistration event
      const unregistrationEvents = eventCapture.getEventsByType('tool:unregistered');
      expect(unregistrationEvents).toHaveLength(1);
      expect(unregistrationEvents[0].data.toolName).toBe('number-tool');
    });

    test('should handle duplicate tool names across servers', async () => {
      const connection1 = createMockConnection('server1');
      const connection2 = createMockConnection('server2');

      const tool1 = { ...TestToolFactory.stringTool(), description: 'Tool from server 1' };
      const tool2 = { ...TestToolFactory.stringTool(), description: 'Tool from server 2' };

      const client1 = createMockClient([tool1]);
      const client2 = createMockClient([tool2]);
      const mockConnMgr = createMockConnectionManager(
        [connection1, connection2],
        new Map([['server1', client1], ['server2', client2]])
      );

      registry.setConnectionManager(mockConnMgr);

      await registry.addConnection(connection1);
      await registry.refreshAllTools();

      const firstTool = registry.getTool('string-tool');
      expect(firstTool?.mcpTool.description).toBe('Tool from server 1');

      await registry.addConnection(connection2);
      await registry.refreshAllTools();

      // Later tool should override earlier one
      const overriddenTool = registry.getTool('string-tool');
      expect(overriddenTool?.mcpTool.description).toBe('Tool from server 2');
      expect(overriddenTool?.connectionId).toBe('server2');
    });
  });

  describe('Connection Lifecycle Management', () => {
    test('should handle connection state transitions correctly', async () => {
      const connection = createMockConnection('lifecycle-server', 'disconnected');
      const tools = [TestToolFactory.stringTool()];
      const mockClient = createMockClient(tools);
      const mockConnMgr = createMockConnectionManager([connection], new Map([['lifecycle-server', mockClient]]));

      registry.setConnectionManager(mockConnMgr);

      // Add disconnected connection
      await registry.addConnection(connection);
      expect(registry.getAllTools()).toHaveLength(0);

      // Transition to connecting
      registry.updateConnectionState('lifecycle-server', 'connecting');
      expect(registry.isToolAvailable('string-tool')).toBe(false);

      // Transition to connected and refresh tools
      connection.state = 'connected';
      registry.updateConnectionState('lifecycle-server', 'connected');
      await registry.refreshAllTools();
      expect(registry.isToolAvailable('string-tool')).toBe(true);

      // Transition to disconnected
      registry.updateConnectionState('lifecycle-server', 'disconnected');
      expect(registry.isToolAvailable('string-tool')).toBe(false);

      // Transition to error
      registry.updateConnectionState('lifecycle-server', 'error');
      expect(registry.isToolAvailable('string-tool')).toBe(false);
    });

    test('should handle connection removal and cleanup', async () => {
      const connection1 = createMockConnection('cleanup-server1');
      const connection2 = createMockConnection('cleanup-server2');

      const tools1 = [TestToolFactory.stringTool()];
      const tools2 = [TestToolFactory.numberTool()];

      const client1 = createMockClient(tools1);
      const client2 = createMockClient(tools2);
      const mockConnMgr = createMockConnectionManager(
        [connection1, connection2],
        new Map([['cleanup-server1', client1], ['cleanup-server2', client2]])
      );

      registry.setConnectionManager(mockConnMgr);

      await registry.addConnection(connection1);
      await registry.addConnection(connection2);
      await registry.refreshAllTools();

      expect(registry.getAllTools()).toHaveLength(2);

      // Remove one connection
      eventCapture.clear();
      await registry.removeConnection('cleanup-server1', 'Manual removal test');

      expect(registry.getAllTools()).toHaveLength(1);
      expect(registry.hasTool('string-tool')).toBe(false);
      expect(registry.hasTool('number-tool')).toBe(true);

      // Verify removal events
      const removalEvents = eventCapture.getEventsByType('connection:removed');
      expect(removalEvents).toHaveLength(1);
      expect(removalEvents[0].data.connectionId).toBe('cleanup-server1');
      expect(removalEvents[0].data.reason).toBe('Manual removal test');

      const unregistrationEvents = eventCapture.getEventsByType('tool:unregistered');
      expect(unregistrationEvents).toHaveLength(1);
      expect(unregistrationEvents[0].data.toolName).toBe('string-tool');
    });

    test('should handle concurrent connection operations', async () => {
      const connections = Array.from({ length: 10 }, (_, i) =>
        createMockConnection(`concurrent-server${i}`)
      );
      const clients = new Map(connections.map((conn, i) => [
        conn.serverId,
        createMockClient([{ ...TestToolFactory.stringTool(), name: `tool-${i}` }])
      ]));

      const mockConnMgr = createMockConnectionManager(connections, clients);
      registry.setConnectionManager(mockConnMgr);

      // Add all connections concurrently
      const addPromises = connections.map(conn => registry.addConnection(conn));
      await Promise.all(addPromises);

      // Refresh all concurrently
      await registry.refreshAllTools();

      expect(registry.getAllTools()).toHaveLength(10);

      // Remove all concurrently
      const removePromises = connections.map(conn =>
        registry.removeConnection(conn.serverId, 'Concurrent cleanup')
      );
      await Promise.all(removePromises);

      expect(registry.getAllTools()).toHaveLength(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle client listTools failures', async () => {
      const connection = createMockConnection('error-server');
      const mockClient = createMockClient([], {
        listToolsError: new Error('Failed to list tools')
      });
      const mockConnMgr = createMockConnectionManager([connection], new Map([['error-server', mockClient]]));

      registry.setConnectionManager(mockConnMgr);

      await registry.addConnection(connection);
      await registry.refreshAllTools();

      // Should handle error gracefully
      expect(registry.getAllTools()).toHaveLength(0);

      // Verify error event
      const errorEvents = eventCapture.getEventsByType('error');
      expect(errorEvents.length).toBeGreaterThan(0);
      expect(errorEvents[0].data.operation).toBe('refreshConnectionTools');
      expect(errorEvents[0].data.connectionId).toBe('error-server');
    });

    test('should handle timeout during tool refresh', async () => {
      const connection = createMockConnection('timeout-server');
      const tools = [TestToolFactory.stringTool()];
      const mockClient = createMockClient(tools, { listToolsDelay: 10000 }); // Long delay
      const mockConnMgr = createMockConnectionManager([connection], new Map([['timeout-server', mockClient]]));

      // Create registry with short timeout
      const timeoutRegistry = new MCPToolRegistry({
        operationTimeoutMs: 100, // Very short timeout
        autoRefresh: false,
      });
      const timeoutEventCapture = new EventCapture(timeoutRegistry);

      timeoutRegistry.setConnectionManager(mockConnMgr);

      await timeoutRegistry.addConnection(connection);
      await timeoutRegistry.refreshAllTools();

      // Should timeout and emit error
      const errorEvents = timeoutEventCapture.getEventsByType('error');
      expect(errorEvents.length).toBeGreaterThan(0);
      expect(errorEvents[0].data.error).toContain('timeout');

      timeoutRegistry.shutdown();
    });

    test('should handle connection manager errors', async () => {
      const connection = createMockConnection('conn-error-server');
      const mockConnMgr = createMockConnectionManager([], new Map(), {
        getClientError: new Error('Failed to get client')
      });

      registry.setConnectionManager(mockConnMgr);

      await registry.addConnection(connection);
      await registry.refreshAllTools();

      // Should handle connection manager errors
      expect(registry.getAllTools()).toHaveLength(0);
    });

    test('should recover from transient errors', async () => {
      const connection = createMockConnection('recovery-server');
      let callCount = 0;

      const unreliableClient = createMockClient([], {
        listToolsError: undefined // Will be set dynamically
      });

      // Override listTools to fail first two times, then succeed
      unreliableClient.listTools.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('Transient error'));
        }
        return Promise.resolve([TestToolFactory.stringTool()]);
      });

      const mockConnMgr = createMockConnectionManager([connection], new Map([['recovery-server', unreliableClient]]));
      registry.setConnectionManager(mockConnMgr);

      await registry.addConnection(connection);

      // First attempt should fail
      await registry.refreshAllTools();
      expect(registry.getAllTools()).toHaveLength(0);

      // Second attempt should fail
      await registry.refreshAllTools();
      expect(registry.getAllTools()).toHaveLength(0);

      // Third attempt should succeed
      await registry.refreshAllTools();
      expect(registry.getAllTools()).toHaveLength(1);
      expect(registry.hasTool('string-tool')).toBe(true);
    });
  });

  describe('Registry Statistics and Querying', () => {
    test('should provide accurate statistics', async () => {
      const connections = [
        createMockConnection('stats-server1', 'connected'),
        createMockConnection('stats-server2', 'connected'),
        createMockConnection('stats-server3', 'disconnected'),
      ];

      const clients = new Map([
        ['stats-server1', createMockClient([TestToolFactory.stringTool(), TestToolFactory.numberTool()])],
        ['stats-server2', createMockClient([TestToolFactory.booleanTool()])],
        ['stats-server3', createMockClient([TestToolFactory.enumTool()])],
      ]);

      const mockConnMgr = createMockConnectionManager(connections, clients);
      registry.setConnectionManager(mockConnMgr);

      for (const conn of connections) {
        await registry.addConnection(conn);
      }
      await registry.refreshAllTools();

      const stats = registry.getStats();
      expect(stats.totalTools).toBe(3); // Only from connected servers
      expect(stats.availableTools).toBe(3);
      expect(stats.activeConnections).toBe(2); // Connected servers only
      expect(stats.toolsByConnection['stats-server1']).toBe(2);
      expect(stats.toolsByConnection['stats-server2']).toBe(1);
      expect(stats.toolsByConnection['stats-server3']).toBe(0);
    });

    test('should handle complex querying scenarios', async () => {
      const connection1 = createMockConnection('query-server1', 'connected');
      const connection2 = createMockConnection('query-server2', 'disconnected');

      const client1 = createMockClient([TestToolFactory.stringTool(), TestToolFactory.numberTool()]);
      const client2 = createMockClient([TestToolFactory.booleanTool()]);
      const mockConnMgr = createMockConnectionManager(
        [connection1, connection2],
        new Map([['query-server1', client1], ['query-server2', client2]])
      );

      registry.setConnectionManager(mockConnMgr);

      await registry.addConnection(connection1);
      await registry.addConnection(connection2);
      await registry.refreshAllTools();

      // Test different query methods
      expect(registry.getAllTools()).toHaveLength(2);
      expect(registry.getAvailableTools()).toHaveLength(2);
      expect(registry.getToolsByConnection('query-server1')).toHaveLength(2);
      expect(registry.getToolsByConnection('query-server2')).toHaveLength(0);

      // Test tool existence checks
      expect(registry.hasTool('string-tool')).toBe(true);
      expect(registry.hasTool('nonexistent-tool')).toBe(false);
      expect(registry.isToolAvailable('string-tool')).toBe(true);
      expect(registry.isToolAvailable('boolean-tool')).toBe(false);

      // Test tool retrieval
      const stringTool = registry.getTool('string-tool');
      expect(stringTool).toBeDefined();
      expect(stringTool!.connectionId).toBe('query-server1');
      expect(stringTool!.available).toBe(true);
    });
  });

  describe('Auto-Refresh Functionality', () => {
    test('should handle auto-refresh lifecycle', async () => {
      const autoRegistry = new MCPToolRegistry({
        autoRefresh: true,
        autoRefreshInterval: 100,
        operationTimeoutMs: 5000,
      });

      expect((autoRegistry as any).autoRefreshTimer).toBeDefined();

      // Test interval change
      autoRegistry.setAutoRefreshInterval(200);
      expect((autoRegistry as any).autoRefreshInterval).toBe(200);

      // Test stopping
      autoRegistry.stopAutoRefresh();
      expect((autoRegistry as any).autoRefreshTimer).toBeUndefined();

      // Test restarting
      autoRegistry.startAutoRefresh();
      expect((autoRegistry as any).autoRefreshTimer).toBeDefined();

      autoRegistry.shutdown();
    });

    test('should handle auto-refresh with connection changes', async () => {
      const autoRegistry = new MCPToolRegistry({
        autoRefresh: true,
        autoRefreshInterval: 50, // Fast for testing
        operationTimeoutMs: 1000,
      });

      const connection = createMockConnection('auto-server', 'connected');
      const tools = [TestToolFactory.stringTool()];
      const mockClient = createMockClient(tools);
      const mockConnMgr = createMockConnectionManager([connection], new Map([['auto-server', mockClient]]));

      autoRegistry.setConnectionManager(mockConnMgr);
      await autoRegistry.addConnection(connection);

      // Wait for auto-refresh to discover tools
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(autoRegistry.hasTool('string-tool')).toBe(true);

      autoRegistry.shutdown();
    });
  });
});

// ============================================================================
// Integration and Performance Tests
// ============================================================================

describe('Integration and Performance', () => {
  let registry: MCPToolRegistry;

  beforeEach(() => {
    registry = new MCPToolRegistry({
      operationTimeoutMs: 10000,
      autoRefresh: false,
    });
  });

  afterEach(() => {
    registry.shutdown();
    vi.clearAllMocks();
  });

  describe('Performance Tests', () => {
    test('should handle large numbers of tools efficiently', async () => {
      const connection = createMockConnection('perf-server');

      // Create 1000 tools with complex schemas
      const tools = Array.from({ length: 1000 }, (_, i) => ({
        name: `perf-tool-${i}`,
        description: `Performance test tool ${i}`,
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', pattern: `^tool-${i}-` },
            config: {
              type: 'object',
              properties: {
                mode: { type: 'string', enum: ['fast', 'thorough'] },
                params: {
                  type: 'array',
                  items: { type: 'number' },
                  minItems: i % 5,
                  maxItems: 10
                }
              },
              required: ['mode']
            }
          },
          required: ['id', 'config']
        } as MCPToolSchema,
      }));

      const mockClient = createMockClient(tools);
      const mockConnMgr = createMockConnectionManager([connection], new Map([['perf-server', mockClient]]));

      registry.setConnectionManager(mockConnMgr);

      const startTime = Date.now();
      await registry.addConnection(connection);
      await registry.refreshAllTools();
      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max

      // Verify all tools registered
      expect(registry.getAllTools()).toHaveLength(1000);

      const stats = registry.getStats();
      expect(stats.totalTools).toBe(1000);
      expect(stats.availableTools).toBe(1000);
    }, 10000); // 10 second timeout for this test

    test('should handle rapid operations efficiently', async () => {
      const connection = createMockConnection('rapid-server');
      const tools = Array.from({ length: 10 }, (_, i) => ({
        ...TestToolFactory.stringTool(),
        name: `rapid-tool-${i}`
      }));

      const mockClient = createMockClient(tools);
      const mockConnMgr = createMockConnectionManager([connection], new Map([['rapid-server', mockClient]]));

      registry.setConnectionManager(mockConnMgr);

      const startTime = Date.now();

      // Perform many rapid operations
      for (let i = 0; i < 10; i++) {
        await registry.addConnection(connection);
        await registry.refreshAllTools();
        await registry.removeConnection('rapid-server', `iteration ${i}`);
      }

      const endTime = Date.now();

      // Should complete all operations within reasonable time
      expect(endTime - startTime).toBeLessThan(2000); // 2 seconds max
    });

    test('should maintain memory efficiency with repeated operations', async () => {
      const connection = createMockConnection('memory-server');
      const tools = [TestToolFactory.stringTool()];
      const mockClient = createMockClient(tools);
      const mockConnMgr = createMockConnectionManager([connection], new Map([['memory-server', mockClient]]));

      registry.setConnectionManager(mockConnMgr);

      // Track registry state
      let maxTools = 0;

      // Perform many add/remove cycles
      for (let i = 0; i < 100; i++) {
        await registry.addConnection(connection);
        await registry.refreshAllTools();

        const currentCount = registry.getAllTools().length;
        maxTools = Math.max(maxTools, currentCount);

        await registry.removeConnection('memory-server', `cycle ${i}`);
      }

      // Should not accumulate tools
      expect(registry.getAllTools()).toHaveLength(0);
      expect(maxTools).toBeLessThanOrEqual(1);
    });
  });

  describe('Complex Integration Scenarios', () => {
    test('should handle mixed connection states and tool types', async () => {
      const connections = [
        createMockConnection('mixed1', 'connected'),
        createMockConnection('mixed2', 'disconnected'),
        createMockConnection('mixed3', 'error'),
        createMockConnection('mixed4', 'connecting'),
      ];

      const toolSets = [
        [TestToolFactory.stringTool(), TestToolFactory.numberTool()],
        [TestToolFactory.booleanTool()], // Won't be available due to disconnected state
        [TestToolFactory.enumTool()],    // Won't be available due to error state
        [TestToolFactory.arrayTool()],   // Won't be available due to connecting state
      ];

      const clients = new Map(connections.map((conn, i) => [
        conn.serverId,
        createMockClient(toolSets[i] as MCPToolDefinition[])
      ]));

      const mockConnMgr = createMockConnectionManager(connections, clients);
      registry.setConnectionManager(mockConnMgr);

      // Add all connections
      for (const conn of connections) {
        await registry.addConnection(conn);
      }
      await registry.refreshAllTools();

      // Only tools from connected server should be available
      expect(registry.getAllTools()).toHaveLength(2);
      expect(registry.isToolAvailable('string-tool')).toBe(true);
      expect(registry.isToolAvailable('number-tool')).toBe(true);
      expect(registry.isToolAvailable('boolean-tool')).toBe(false);
      expect(registry.isToolAvailable('enum-tool')).toBe(false);
      expect(registry.isToolAvailable('array-tool')).toBe(false);

      // Change connection states
      registry.updateConnectionState('mixed2', 'connected');
      registry.updateConnectionState('mixed3', 'connected');

      // Refresh and check availability
      await registry.refreshAllTools();
      expect(registry.getAllTools()).toHaveLength(4);
      expect(registry.isToolAvailable('boolean-tool')).toBe(true);
      expect(registry.isToolAvailable('enum-tool')).toBe(true);
    });

    test('should handle schema validation integration', async () => {
      const connection = createMockConnection('validation-server');
      const tools = [
        TestToolFactory.stringTool(),
        TestToolFactory.formatTool(),
        TestToolFactory.unionTool(),
      ];

      const mockClient = createMockClient(tools);
      const mockConnMgr = createMockConnectionManager([connection], new Map([['validation-server', mockClient]]));

      registry.setConnectionManager(mockConnMgr);
      await registry.addConnection(connection);
      await registry.refreshAllTools();

      // Test that all translated schemas work correctly
      const stringTool = registry.getTool('string-tool')!;
      expect(stringTool.claudeTool.parameters.parse({ message: 'Hello123' })).toEqual({ message: 'Hello123' });

      const formatTool = registry.getTool('format-tool')!;
      expect(formatTool.claudeTool.parameters.parse({ email: 'test@example.com' })).toEqual({ email: 'test@example.com' });

      const unionTool = registry.getTool('union-tool')!;
      expect(unionTool.claudeTool.parameters.parse({ value: 'test@example.com' })).toEqual({ value: 'test@example.com' });
      expect(unionTool.claudeTool.parameters.parse({ value: 42 })).toEqual({ value: 42 });
    });
  });
});
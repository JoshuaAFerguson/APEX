/**
 * Test Suite for SchemaTranslator
 *
 * Tests MCP JSON Schema to Claude Agent SDK Zod schema conversion
 * Covers all JSON Schema types, constraints, and edge cases
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { SchemaTranslator, type JSONSchemaProperty, type ClaudeSDKTool } from '../schema-translator.js';
import type { MCPTool, MCPToolSchema } from '@apexcli/core';

describe('SchemaTranslator', () => {
  let translator: SchemaTranslator;

  beforeEach(() => {
    translator = new SchemaTranslator();
  });

  // ==========================================================================
  // Basic Type Translation Tests
  // ==========================================================================

  describe('Basic Type Translation', () => {
    test('should translate string type', () => {
      const property: JSONSchemaProperty = { type: 'string' };
      const result = translator.translateProperty(property, false);

      expect(result).toBeInstanceOf(z.ZodString);
      expect(result.parse('hello')).toBe('hello');
    });

    test('should translate number type', () => {
      const property: JSONSchemaProperty = { type: 'number' };
      const result = translator.translateProperty(property, false);

      expect(result).toBeInstanceOf(z.ZodNumber);
      expect(result.parse(42)).toBe(42);
      expect(result.parse(3.14)).toBe(3.14);
    });

    test('should translate integer type', () => {
      const property: JSONSchemaProperty = { type: 'integer' };
      const result = translator.translateProperty(property, false);

      expect(result.parse(42)).toBe(42);
      expect(() => result.parse(3.14)).toThrow();
    });

    test('should translate boolean type', () => {
      const property: JSONSchemaProperty = { type: 'boolean' };
      const result = translator.translateProperty(property, false);

      expect(result).toBeInstanceOf(z.ZodBoolean);
      expect(result.parse(true)).toBe(true);
      expect(result.parse(false)).toBe(false);
    });

    test('should translate null type', () => {
      const property: JSONSchemaProperty = { type: 'null' };
      const result = translator.translateProperty(property, false);

      expect(result).toBeInstanceOf(z.ZodNull);
      expect(result.parse(null)).toBe(null);
    });

    test('should translate array type', () => {
      const property: JSONSchemaProperty = {
        type: 'array',
        items: { type: 'string' }
      };
      const result = translator.translateProperty(property, false);

      expect(result).toBeInstanceOf(z.ZodArray);
      expect(result.parse(['hello', 'world'])).toEqual(['hello', 'world']);
    });

    test('should translate object type', () => {
      const property: JSONSchemaProperty = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' }
        },
        required: ['name']
      };
      const result = translator.translateProperty(property, false);

      expect(result).toBeInstanceOf(z.ZodObject);
      expect(result.parse({ name: 'John', age: 30 })).toEqual({ name: 'John', age: 30 });
      expect(result.parse({ name: 'John' })).toEqual({ name: 'John' });
    });
  });

  // ==========================================================================
  // String Constraints Tests
  // ==========================================================================

  describe('String Constraints', () => {
    test('should handle string length constraints', () => {
      const property: JSONSchemaProperty = {
        type: 'string',
        minLength: 3,
        maxLength: 10
      };
      const result = translator.translateProperty(property, false);

      expect(result.parse('hello')).toBe('hello');
      expect(() => result.parse('hi')).toThrow(); // too short
      expect(() => result.parse('this is too long')).toThrow(); // too long
    });

    test('should handle string pattern constraint', () => {
      const property: JSONSchemaProperty = {
        type: 'string',
        pattern: '^[a-z]+$'
      };
      const result = translator.translateProperty(property, false);

      expect(result.parse('hello')).toBe('hello');
      expect(() => result.parse('Hello')).toThrow(); // uppercase not allowed
      expect(() => result.parse('hello123')).toThrow(); // numbers not allowed
    });

    test('should handle string format constraints', () => {
      const emailProperty: JSONSchemaProperty = {
        type: 'string',
        format: 'email'
      };
      const emailResult = translator.translateProperty(emailProperty, false);

      expect(emailResult.parse('test@example.com')).toBe('test@example.com');
      expect(() => emailResult.parse('invalid-email')).toThrow();

      const urlProperty: JSONSchemaProperty = {
        type: 'string',
        format: 'url'
      };
      const urlResult = translator.translateProperty(urlProperty, false);

      expect(urlResult.parse('https://example.com')).toBe('https://example.com');
      expect(() => urlResult.parse('not-a-url')).toThrow();
    });
  });

  // ==========================================================================
  // Number Constraints Tests
  // ==========================================================================

  describe('Number Constraints', () => {
    test('should handle number range constraints', () => {
      const property: JSONSchemaProperty = {
        type: 'number',
        minimum: 0,
        maximum: 100
      };
      const result = translator.translateProperty(property, false);

      expect(result.parse(50)).toBe(50);
      expect(result.parse(0)).toBe(0);
      expect(result.parse(100)).toBe(100);
      expect(() => result.parse(-1)).toThrow(); // below minimum
      expect(() => result.parse(101)).toThrow(); // above maximum
    });

    test('should handle exclusive range constraints', () => {
      const property: JSONSchemaProperty = {
        type: 'number',
        exclusiveMinimum: 0,
        exclusiveMaximum: 100
      };
      const result = translator.translateProperty(property, false);

      expect(result.parse(50)).toBe(50);
      expect(() => result.parse(0)).toThrow(); // not > 0
      expect(() => result.parse(100)).toThrow(); // not < 100
    });

    test('should handle multipleOf constraint', () => {
      const property: JSONSchemaProperty = {
        type: 'number',
        multipleOf: 5
      };
      const result = translator.translateProperty(property, false);

      expect(result.parse(10)).toBe(10);
      expect(result.parse(15)).toBe(15);
      expect(() => result.parse(7)).toThrow(); // not multiple of 5
    });
  });

  // ==========================================================================
  // Array Constraints Tests
  // ==========================================================================

  describe('Array Constraints', () => {
    test('should handle array length constraints', () => {
      const property: JSONSchemaProperty = {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
        maxItems: 4
      };
      const result = translator.translateProperty(property, false);

      expect(result.parse(['a', 'b'])).toEqual(['a', 'b']);
      expect(result.parse(['a', 'b', 'c', 'd'])).toEqual(['a', 'b', 'c', 'd']);
      expect(() => result.parse(['a'])).toThrow(); // too few items
      expect(() => result.parse(['a', 'b', 'c', 'd', 'e'])).toThrow(); // too many items
    });

    test('should handle array without items schema', () => {
      const property: JSONSchemaProperty = {
        type: 'array'
      };
      const result = translator.translateProperty(property, false);

      expect(result.parse([1, 'string', true])).toEqual([1, 'string', true]);
    });
  });

  // ==========================================================================
  // Enum Tests
  // ==========================================================================

  describe('Enum Handling', () => {
    test('should handle string enum', () => {
      const property: JSONSchemaProperty = {
        type: 'string',
        enum: ['red', 'green', 'blue']
      };
      const result = translator.translateProperty(property, false);

      expect(result.parse('red')).toBe('red');
      expect(result.parse('green')).toBe('green');
      expect(() => result.parse('yellow')).toThrow();
    });

    test('should handle mixed type enum', () => {
      const property: JSONSchemaProperty = {
        enum: ['active', 1, true, null]
      };
      const result = translator.translateProperty(property, false);

      expect(result.parse('active')).toBe('active');
      expect(result.parse(1)).toBe(1);
      expect(result.parse(true)).toBe(true);
      expect(result.parse(null)).toBe(null);
      expect(() => result.parse('inactive')).toThrow();
    });

    test('should handle empty enum', () => {
      const property: JSONSchemaProperty = {
        enum: []
      };
      const result = translator.translateProperty(property, false);

      expect(result).toBeInstanceOf(z.ZodNever);
      expect(() => result.parse('anything')).toThrow();
    });
  });

  // ==========================================================================
  // Const Tests
  // ==========================================================================

  describe('Const Handling', () => {
    test('should handle const value', () => {
      const property: JSONSchemaProperty = {
        const: 'fixed-value'
      };
      const result = translator.translateProperty(property, false);

      expect(result.parse('fixed-value')).toBe('fixed-value');
      expect(() => result.parse('other-value')).toThrow();
    });

    test('should prioritize const over type and enum', () => {
      const property: JSONSchemaProperty = {
        type: 'string',
        enum: ['red', 'green', 'blue'],
        const: 'fixed-value'
      };
      const result = translator.translateProperty(property, false);

      expect(result.parse('fixed-value')).toBe('fixed-value');
      expect(() => result.parse('red')).toThrow(); // enum is ignored when const is present
    });
  });

  // ==========================================================================
  // Nullable Type Tests
  // ==========================================================================

  describe('Nullable Types', () => {
    test('should handle nullable string', () => {
      const property: JSONSchemaProperty = {
        type: ['string', 'null']
      };
      const result = translator.translateProperty(property, false);

      expect(result.parse('hello')).toBe('hello');
      expect(result.parse(null)).toBe(null);
      expect(() => result.parse(42)).toThrow();
    });

    test('should handle union of multiple types with null', () => {
      const property: JSONSchemaProperty = {
        type: ['string', 'number', 'null']
      };
      const result = translator.translateProperty(property, false);

      expect(result.parse('hello')).toBe('hello');
      expect(result.parse(42)).toBe(42);
      expect(result.parse(null)).toBe(null);
      expect(() => result.parse(true)).toThrow();
    });
  });

  // ==========================================================================
  // Union/Intersection Tests
  // ==========================================================================

  describe('Union and Intersection Types', () => {
    test('should handle oneOf (union)', () => {
      const property: JSONSchemaProperty = {
        oneOf: [
          { type: 'string' },
          { type: 'number' }
        ]
      };
      const result = translator.translateProperty(property, false);

      expect(result.parse('hello')).toBe('hello');
      expect(result.parse(42)).toBe(42);
      expect(() => result.parse(true)).toThrow();
    });

    test('should handle anyOf (union)', () => {
      const property: JSONSchemaProperty = {
        anyOf: [
          { type: 'string', minLength: 5 },
          { type: 'number', minimum: 10 }
        ]
      };
      const result = translator.translateProperty(property, false);

      expect(result.parse('hello')).toBe('hello');
      expect(result.parse(15)).toBe(15);
    });

    test('should handle allOf (intersection)', () => {
      const property: JSONSchemaProperty = {
        allOf: [
          { type: 'string', minLength: 3 },
          { type: 'string', maxLength: 10 }
        ]
      };
      const result = translator.translateProperty(property, false);

      expect(result.parse('hello')).toBe('hello');
      expect(() => result.parse('hi')).toThrow(); // too short
      expect(() => result.parse('this is too long')).toThrow(); // too long
    });
  });

  // ==========================================================================
  // Default Values Tests
  // ==========================================================================

  describe('Default Values', () => {
    test('should preserve default values when enabled', () => {
      const translator = new SchemaTranslator({ preserveDefaults: true });
      const property: JSONSchemaProperty = {
        type: 'string',
        default: 'default-value'
      };
      const result = translator.translateProperty(property, false);

      expect(result.parse(undefined)).toBe('default-value');
      expect(result.parse('custom')).toBe('custom');
    });

    test('should ignore default values when disabled', () => {
      const translator = new SchemaTranslator({ preserveDefaults: false });
      const property: JSONSchemaProperty = {
        type: 'string',
        default: 'default-value'
      };
      const result = translator.translateProperty(property, false);

      expect(() => result.parse(undefined)).toThrow();
    });
  });

  // ==========================================================================
  // Schema Translation Tests
  // ==========================================================================

  describe('Input Schema Translation', () => {
    test('should translate complete input schema', () => {
      const schema: MCPToolSchema = {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'User name',
            minLength: 1
          },
          age: {
            type: 'integer',
            description: 'User age',
            minimum: 0,
            maximum: 150
          },
          email: {
            type: 'string',
            format: 'email'
          },
          tags: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['name', 'email']
      };

      const result = translator.translateInputSchema(schema);

      const validData = {
        name: 'John',
        age: 30,
        email: 'john@example.com',
        tags: ['developer', 'typescript']
      };

      expect(result.parse(validData)).toEqual(validData);

      // Required field missing
      expect(() => result.parse({ age: 30 })).toThrow();

      // Optional field can be omitted
      const minimalData = { name: 'John', email: 'john@example.com' };
      expect(result.parse(minimalData)).toEqual(minimalData);
    });

    test('should handle additionalProperties', () => {
      const translator = new SchemaTranslator({ allowAdditionalProperties: true });
      const schema: MCPToolSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        required: ['name']
      };

      const result = translator.translateInputSchema(schema);

      const dataWithExtra = {
        name: 'John',
        extra: 'allowed'
      };

      expect(result.parse(dataWithExtra)).toEqual(dataWithExtra);
    });

    test('should handle allOptional option', () => {
      const translator = new SchemaTranslator({ allOptional: true });
      const schema: MCPToolSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        required: ['name']
      };

      const result = translator.translateInputSchema(schema);

      // Even required fields become optional
      expect(result.parse({})).toEqual({});
    });
  });

  // ==========================================================================
  // Tool Translation Tests
  // ==========================================================================

  describe('Tool Translation', () => {
    test('should translate complete MCP tool', () => {
      const mcpTool: MCPTool = {
        name: 'test-tool',
        description: 'A test tool',
        serverId: 'test-server',
        serverName: 'Test Server',
        version: '1.0.0',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Message to process'
            }
          },
          required: ['message']
        },
        capabilities: {
          streaming: false
        }
      };

      const result = translator.translateTool(mcpTool);

      expect(result.name).toBe('test-tool');
      expect(result.description).toBe('A test tool');
      expect(result.metadata.serverId).toBe('test-server');
      expect(result.metadata.serverName).toBe('Test Server');
      expect(result.metadata.version).toBe('1.0.0');
      expect(result.metadata.capabilities).toEqual({ streaming: false });

      // Test parameter validation
      expect(result.parameters.parse({ message: 'hello' })).toEqual({ message: 'hello' });
      expect(() => result.parameters.parse({})).toThrow(); // missing required field
    });

    test('should handle tool without description', () => {
      const mcpTool: MCPTool = {
        name: 'test-tool',
        serverId: 'test-server',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      };

      const result = translator.translateTool(mcpTool);

      expect(result.description).toBe('MCP tool from test-server');
    });
  });

  // ==========================================================================
  // Custom Type Handlers Tests
  // ==========================================================================

  describe('Custom Type Handlers', () => {
    test('should use custom type handlers', () => {
      const customHandlers = new Map();
      customHandlers.set('custom-type', (schema: JSONSchemaProperty) => {
        return z.string().transform(val => val.toUpperCase());
      });

      const translator = new SchemaTranslator({ customTypeHandlers: customHandlers });

      const property: JSONSchemaProperty = {
        type: 'custom-type' as any
      };

      const result = translator.translateProperty(property, false);
      expect(result.parse('hello')).toBe('HELLO');
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    test('should handle empty schema', () => {
      const schema: MCPToolSchema = {
        type: 'object',
        properties: {},
        required: []
      };

      const result = translator.translateInputSchema(schema);
      expect(result.parse({})).toEqual({});
    });

    test('should handle invalid regex patterns gracefully', () => {
      const property: JSONSchemaProperty = {
        type: 'string',
        pattern: '[invalid regex'
      };

      // Should not throw during creation
      expect(() => {
        translator.translateProperty(property, false);
      }).not.toThrow();
    });

    test('should handle unknown type', () => {
      const property: JSONSchemaProperty = {
        type: 'unknown-type' as any
      };

      const result = translator.translateProperty(property, false);
      expect(result).toBeInstanceOf(z.ZodUnknown);
    });

    test('should handle nested objects with required fields', () => {
      const property: JSONSchemaProperty = {
        type: 'object',
        properties: {
          address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' }
            },
            required: ['city']
          }
        }
      };

      const result = translator.translateProperty(property, false);

      expect(result.parse({ address: { city: 'New York' } })).toEqual({
        address: { city: 'New York' }
      });

      expect(() => result.parse({ address: { street: 'Main St' } })).toThrow(); // missing required city
    });

    test('should handle deeply nested objects', () => {
      const property: JSONSchemaProperty = {
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
                      value: { type: 'string' }
                    },
                    required: ['value']
                  }
                },
                required: ['level3']
              }
            },
            required: ['level2']
          }
        },
        required: ['level1']
      };

      const result = translator.translateProperty(property, false);

      const validData = {
        level1: {
          level2: {
            level3: {
              value: 'deep-value'
            }
          }
        }
      };

      expect(result.parse(validData)).toEqual(validData);
    });

    test('should handle arrays of complex objects', () => {
      const property: JSONSchemaProperty = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            metadata: {
              type: 'object',
              properties: {
                tags: {
                  type: 'array',
                  items: { type: 'string' }
                }
              }
            }
          },
          required: ['id']
        }
      };

      const result = translator.translateProperty(property, false);

      const validData = [
        {
          id: '1',
          metadata: {
            tags: ['tag1', 'tag2']
          }
        },
        {
          id: '2'
        }
      ];

      expect(result.parse(validData)).toEqual(validData);
    });

    test('should handle schema with no properties object', () => {
      const schema: MCPToolSchema = {
        type: 'object'
        // No properties field
      };

      const result = translator.translateInputSchema(schema);
      expect(result.parse({})).toEqual({});
    });

    test('should handle complex enum edge cases', () => {
      const property: JSONSchemaProperty = {
        enum: [0, '', false, null, { complex: 'object' }, [1, 2, 3]]
      };

      const result = translator.translateProperty(property, false);

      expect(result.parse(0)).toBe(0);
      expect(result.parse('')).toBe('');
      expect(result.parse(false)).toBe(false);
      expect(result.parse(null)).toBe(null);
      expect(result.parse({ complex: 'object' })).toEqual({ complex: 'object' });
      expect(result.parse([1, 2, 3])).toEqual([1, 2, 3]);
      expect(() => result.parse(1)).toThrow();
      expect(() => result.parse('not-empty')).toThrow();
      expect(() => result.parse(true)).toThrow();
    });

    test('should handle very large numbers', () => {
      const property: JSONSchemaProperty = {
        type: 'number',
        minimum: Number.MIN_SAFE_INTEGER,
        maximum: Number.MAX_SAFE_INTEGER
      };

      const result = translator.translateProperty(property, false);

      expect(result.parse(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
      expect(result.parse(Number.MIN_SAFE_INTEGER)).toBe(Number.MIN_SAFE_INTEGER);
    });

    test('should handle array with no item schema', () => {
      const property: JSONSchemaProperty = {
        type: 'array'
        // No items specified
      };

      const result = translator.translateProperty(property, false);

      expect(result.parse([1, 'string', true, { any: 'object' }])).toEqual([1, 'string', true, { any: 'object' }]);
      expect(result.parse([])).toEqual([]);
    });

    test('should handle object with empty properties', () => {
      const property: JSONSchemaProperty = {
        type: 'object',
        properties: {}
      };

      const result = translator.translateProperty(property, false);

      expect(result.parse({})).toEqual({});
    });
  });

  // ==========================================================================
  // Integration and Performance Tests
  // ==========================================================================

  describe('Integration with Zod', () => {
    test('should produce chainable Zod schemas', () => {
      const property: JSONSchemaProperty = {
        type: 'string',
        format: 'email'
      };

      const result = translator.translateProperty(property, false);

      // Should be able to chain additional Zod methods
      const chainedSchema = result.refine(
        (email) => email.endsWith('@company.com'),
        { message: 'Email must be from company domain' }
      );

      expect(chainedSchema.parse('user@company.com')).toBe('user@company.com');
      expect(() => chainedSchema.parse('user@other.com')).toThrow();
    });

    test('should work with Zod safeParse', () => {
      const property: JSONSchemaProperty = {
        type: 'integer',
        minimum: 1,
        maximum: 10
      };

      const result = translator.translateProperty(property, false);

      expect(result.safeParse(5).success).toBe(true);
      expect(result.safeParse(5).data).toBe(5);
      expect(result.safeParse(0).success).toBe(false);
      expect(result.safeParse('not-a-number').success).toBe(false);
    });

    test('should handle transform operations', () => {
      const customHandlers = new Map();
      customHandlers.set('trimmed-string', () => {
        return z.string().transform(val => val.trim());
      });

      const translator = new SchemaTranslator({ customTypeHandlers: customHandlers });

      const property: JSONSchemaProperty = {
        type: 'trimmed-string' as any
      };

      const result = translator.translateProperty(property, false);
      expect(result.parse('  hello world  ')).toBe('hello world');
    });
  });

  describe('Performance Tests', () => {
    test('should handle large schemas efficiently', () => {
      // Create a schema with many properties
      const properties: Record<string, JSONSchemaProperty> = {};
      const required: string[] = [];

      for (let i = 0; i < 100; i++) {
        properties[`field${i}`] = {
          type: i % 4 === 0 ? 'string' : i % 4 === 1 ? 'number' : i % 4 === 2 ? 'boolean' : 'array',
          ...(i % 4 === 3 && { items: { type: 'string' } })
        };
        if (i % 10 === 0) {
          required.push(`field${i}`);
        }
      }

      const schema: MCPToolSchema = {
        type: 'object',
        properties,
        required
      };

      const startTime = Date.now();
      const result = translator.translateInputSchema(schema);
      const endTime = Date.now();

      // Should complete translation in reasonable time (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000);

      // Should still work correctly
      const testData: Record<string, any> = {};
      required.forEach(field => {
        testData[field] = field.includes('0') ? 'test' : 42;
      });

      expect(() => result.parse(testData)).not.toThrow();
    });

    test('should handle deep nesting efficiently', () => {
      let currentProperty: JSONSchemaProperty = {
        type: 'string'
      };

      // Create deeply nested object (20 levels deep)
      for (let i = 0; i < 20; i++) {
        currentProperty = {
          type: 'object',
          properties: {
            [`level${i}`]: currentProperty
          },
          required: [`level${i}`]
        };
      }

      const startTime = Date.now();
      const result = translator.translateProperty(currentProperty, false);
      const endTime = Date.now();

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(500);

      // Should still validate correctly
      let testData: any = 'value';
      for (let i = 19; i >= 0; i--) {
        testData = { [`level${i}`]: testData };
      }

      expect(result.parse(testData)).toEqual(testData);
    });
  });
});
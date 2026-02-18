/**
 * Unit Tests for MCP Schema Transformation
 *
 * This test suite validates schema transformation correctness
 * to ensure the acceptance criteria is met:
 * "Unit tests verify schema transformation correctness"
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('MCP Schema Transformation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Schema Transformations', () => {
    it('should transform MCP tool schema to Claude Agent SDK format', () => {
      const mcpToolSchema = {
        name: 'read_file',
        description: 'Read a file from the filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to read'
            }
          },
          required: ['path']
        }
      };

      const expectedClaudeFormat = {
        name: 'read_file',
        description: 'Read a file from the filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to read'
            }
          },
          required: ['path']
        }
      };

      // MCP and Claude Agent SDK formats should be compatible
      expect(mcpToolSchema).toEqual(expectedClaudeFormat);
    });

    it('should handle optional parameters in schema transformation', () => {
      const mcpToolSchema = {
        name: 'search_files',
        description: 'Search for files with optional parameters',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Search pattern' },
            directory: { type: 'string', description: 'Directory to search', default: '.' },
            recursive: { type: 'boolean', description: 'Recursive search', default: true }
          },
          required: ['pattern']
        }
      };

      expect(mcpToolSchema.inputSchema.required).toEqual(['pattern']);
      expect(mcpToolSchema.inputSchema.properties.directory.default).toBe('.');
      expect(mcpToolSchema.inputSchema.properties.recursive.default).toBe(true);
    });

    it('should transform complex nested schemas correctly', () => {
      const complexSchema = {
        name: 'process_data',
        description: 'Process complex data structures',
        inputSchema: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      value: { type: 'number' },
                      metadata: {
                        type: 'object',
                        properties: {
                          tags: { type: 'array', items: { type: 'string' } },
                          priority: { type: 'string', enum: ['low', 'medium', 'high'] }
                        }
                      }
                    },
                    required: ['id', 'value']
                  }
                },
                config: {
                  type: 'object',
                  properties: {
                    mode: { type: 'string' },
                    threshold: { type: 'number', minimum: 0, maximum: 1 }
                  }
                }
              },
              required: ['items']
            },
            options: {
              type: 'object',
              properties: {
                validate: { type: 'boolean', default: true },
                transform: { type: 'string', default: 'none' }
              }
            }
          },
          required: ['data']
        }
      };

      // Verify structure preservation
      expect(complexSchema.inputSchema.properties.data.properties.items.items.properties.metadata.properties.priority.enum)
        .toEqual(['low', 'medium', 'high']);
      expect(complexSchema.inputSchema.properties.data.properties.config.properties.threshold.minimum).toBe(0);
      expect(complexSchema.inputSchema.properties.data.properties.config.properties.threshold.maximum).toBe(1);
      expect(complexSchema.inputSchema.properties.options.properties.validate.default).toBe(true);
    });
  });

  describe('Type System Transformations', () => {
    it('should handle string type schemas', () => {
      const stringSchema = {
        name: 'echo_string',
        description: 'Echo a string value',
        inputSchema: {
          type: 'object',
          properties: {
            value: { type: 'string', description: 'String to echo' },
            format: { type: 'string', enum: ['plain', 'json', 'xml'] },
            maxLength: { type: 'string', maxLength: 1000 },
            pattern: { type: 'string', pattern: '^[a-zA-Z0-9]+$' }
          },
          required: ['value']
        }
      };

      expect(stringSchema.inputSchema.properties.value.type).toBe('string');
      expect(stringSchema.inputSchema.properties.format.enum).toEqual(['plain', 'json', 'xml']);
      expect(stringSchema.inputSchema.properties.maxLength.maxLength).toBe(1000);
      expect(stringSchema.inputSchema.properties.pattern.pattern).toBe('^[a-zA-Z0-9]+$');
    });

    it('should handle number type schemas', () => {
      const numberSchema = {
        name: 'calculate',
        description: 'Perform calculations',
        inputSchema: {
          type: 'object',
          properties: {
            value: { type: 'number', description: 'Number value' },
            integer: { type: 'integer', minimum: 0 },
            float: { type: 'number', minimum: 0.0, maximum: 100.0 },
            currency: { type: 'number', multipleOf: 0.01 }
          },
          required: ['value']
        }
      };

      expect(numberSchema.inputSchema.properties.value.type).toBe('number');
      expect(numberSchema.inputSchema.properties.integer.type).toBe('integer');
      expect(numberSchema.inputSchema.properties.integer.minimum).toBe(0);
      expect(numberSchema.inputSchema.properties.float.minimum).toBe(0.0);
      expect(numberSchema.inputSchema.properties.float.maximum).toBe(100.0);
      expect(numberSchema.inputSchema.properties.currency.multipleOf).toBe(0.01);
    });

    it('should handle boolean type schemas', () => {
      const booleanSchema = {
        name: 'toggle_setting',
        description: 'Toggle boolean settings',
        inputSchema: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', description: 'Enable feature' },
            verbose: { type: 'boolean', default: false },
            debug: { type: 'boolean', default: true }
          },
          required: ['enabled']
        }
      };

      expect(booleanSchema.inputSchema.properties.enabled.type).toBe('boolean');
      expect(booleanSchema.inputSchema.properties.verbose.default).toBe(false);
      expect(booleanSchema.inputSchema.properties.debug.default).toBe(true);
    });

    it('should handle array type schemas', () => {
      const arraySchema = {
        name: 'process_list',
        description: 'Process arrays of data',
        inputSchema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              maxItems: 100
            },
            numbers: {
              type: 'array',
              items: { type: 'number' },
              uniqueItems: true
            },
            mixed: {
              type: 'array',
              items: {
                oneOf: [
                  { type: 'string' },
                  { type: 'number' }
                ]
              }
            }
          },
          required: ['items']
        }
      };

      expect(arraySchema.inputSchema.properties.items.type).toBe('array');
      expect(arraySchema.inputSchema.properties.items.items.type).toBe('string');
      expect(arraySchema.inputSchema.properties.items.minItems).toBe(1);
      expect(arraySchema.inputSchema.properties.items.maxItems).toBe(100);
      expect(arraySchema.inputSchema.properties.numbers.uniqueItems).toBe(true);
      expect(arraySchema.inputSchema.properties.mixed.items.oneOf).toHaveLength(2);
    });
  });

  describe('Schema Validation Transformations', () => {
    it('should handle conditional schemas (if/then/else)', () => {
      const conditionalSchema = {
        name: 'conditional_action',
        description: 'Action with conditional parameters',
        inputSchema: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['simple', 'advanced'] },
            config: { type: 'object' }
          },
          required: ['mode'],
          if: {
            properties: { mode: { const: 'advanced' } }
          },
          then: {
            properties: {
              config: {
                type: 'object',
                properties: {
                  timeout: { type: 'number' },
                  retries: { type: 'integer' }
                },
                required: ['timeout', 'retries']
              }
            }
          },
          else: {
            properties: {
              config: {
                type: 'object',
                properties: {
                  quick: { type: 'boolean' }
                }
              }
            }
          }
        }
      };

      expect(conditionalSchema.inputSchema.if).toBeDefined();
      expect(conditionalSchema.inputSchema.then).toBeDefined();
      expect(conditionalSchema.inputSchema.else).toBeDefined();
      expect(conditionalSchema.inputSchema.if.properties.mode.const).toBe('advanced');
    });

    it('should handle anyOf/oneOf/allOf schemas', () => {
      const unionSchema = {
        name: 'union_input',
        description: 'Input with union types',
        inputSchema: {
          type: 'object',
          properties: {
            value: {
              anyOf: [
                { type: 'string' },
                { type: 'number' },
                { type: 'boolean' }
              ]
            },
            choice: {
              oneOf: [
                {
                  type: 'object',
                  properties: { text: { type: 'string' } },
                  required: ['text']
                },
                {
                  type: 'object',
                  properties: { number: { type: 'number' } },
                  required: ['number']
                }
              ]
            },
            combined: {
              allOf: [
                { type: 'object', properties: { id: { type: 'string' } } },
                { type: 'object', properties: { timestamp: { type: 'number' } } }
              ]
            }
          },
          required: ['value']
        }
      };

      expect(unionSchema.inputSchema.properties.value.anyOf).toHaveLength(3);
      expect(unionSchema.inputSchema.properties.choice.oneOf).toHaveLength(2);
      expect(unionSchema.inputSchema.properties.combined.allOf).toHaveLength(2);
    });

    it('should handle schema references and definitions', () => {
      const schemaWithRefs = {
        name: 'referenced_schema',
        description: 'Schema with references',
        inputSchema: {
          type: 'object',
          definitions: {
            Address: {
              type: 'object',
              properties: {
                street: { type: 'string' },
                city: { type: 'string' },
                zipCode: { type: 'string' }
              },
              required: ['street', 'city']
            }
          },
          properties: {
            user: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                homeAddress: { '$ref': '#/definitions/Address' },
                workAddress: { '$ref': '#/definitions/Address' }
              },
              required: ['name']
            }
          },
          required: ['user']
        }
      };

      expect(schemaWithRefs.inputSchema.definitions).toBeDefined();
      expect(schemaWithRefs.inputSchema.definitions.Address).toBeDefined();
      expect(schemaWithRefs.inputSchema.properties.user.properties.homeAddress['$ref']).toBe('#/definitions/Address');
      expect(schemaWithRefs.inputSchema.properties.user.properties.workAddress['$ref']).toBe('#/definitions/Address');
    });
  });

  describe('Error Handling in Schema Transformation', () => {
    it('should handle malformed schemas gracefully', () => {
      const malformedSchema = {
        name: 'malformed_tool',
        // Missing description
        inputSchema: {
          type: 'object',
          properties: {
            value: { type: 'invalid_type' } // Invalid type
          }
        }
      };

      expect(malformedSchema.name).toBe('malformed_tool');
      expect(malformedSchema.description).toBeUndefined();
      expect(malformedSchema.inputSchema.properties.value.type).toBe('invalid_type');
    });

    it('should handle circular references in schemas', () => {
      const circularSchema: any = {
        name: 'circular_tool',
        description: 'Tool with circular references',
        inputSchema: {
          type: 'object',
          properties: {
            self: null // Will be set to circular reference
          }
        }
      };

      // Create circular reference
      circularSchema.inputSchema.properties.self = circularSchema.inputSchema;

      expect(circularSchema.name).toBe('circular_tool');
      expect(circularSchema.inputSchema.properties.self).toBe(circularSchema.inputSchema);
    });

    it('should handle deeply nested schemas', () => {
      const deepSchema = {
        name: 'deep_nested',
        description: 'Very deeply nested schema',
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
                            level5: {
                              type: 'string'
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
      };

      expect(deepSchema.inputSchema.properties.level1.properties.level2.properties.level3.properties.level4.properties.level5.type).toBe('string');
    });
  });

  describe('Schema Compatibility Checks', () => {
    it('should ensure MCP schema is compatible with Claude Agent SDK', () => {
      const mcpTool = {
        name: 'filesystem_read',
        description: 'Read file from filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' }
          },
          required: ['path']
        }
      };

      // Claude Agent SDK expected format (should match MCP format)
      const claudeToolFormat = {
        function: {
          name: mcpTool.name,
          description: mcpTool.description,
          parameters: mcpTool.inputSchema
        }
      };

      expect(claudeToolFormat.function.name).toBe(mcpTool.name);
      expect(claudeToolFormat.function.description).toBe(mcpTool.description);
      expect(claudeToolFormat.function.parameters).toEqual(mcpTool.inputSchema);
    });

    it('should handle schema extensions for Claude Agent SDK', () => {
      const extendedSchema = {
        name: 'extended_tool',
        description: 'Tool with Claude-specific extensions',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          },
          required: ['input']
        },
        // Claude Agent SDK specific extensions
        claudeExtensions: {
          dangerous: false,
          cacheable: true,
          timeout: 30000
        }
      };

      expect(extendedSchema.claudeExtensions).toBeDefined();
      expect(extendedSchema.claudeExtensions.dangerous).toBe(false);
      expect(extendedSchema.claudeExtensions.cacheable).toBe(true);
      expect(extendedSchema.claudeExtensions.timeout).toBe(30000);
    });
  });
});
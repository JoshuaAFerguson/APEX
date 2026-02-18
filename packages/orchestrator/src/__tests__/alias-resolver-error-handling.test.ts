/**
 * AliasResolver Error Handling Tests
 *
 * Comprehensive tests for error handling in alias resolution
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AliasResolver, AliasResolutionError } from '../alias-resolver';
import { ToolAlias } from '@apexcli/core';

describe('AliasResolver Error Handling', () => {
  let resolver: AliasResolver;
  let sampleAliases: ToolAlias[];

  beforeEach(() => {
    sampleAliases = [
      {
        name: 'valid-alias',
        description: 'A valid test alias',
        tool: 'TestTool',
        parameters: {
          param1: '{{value1}}',
          param2: '{{value2}}'
        },
        enabled: true,
        aliasParameters: [
          {
            name: 'value1',
            description: 'First parameter',
            type: 'string',
            required: true
          },
          {
            name: 'value2',
            description: 'Second parameter',
            type: 'string',
            required: false,
            default: 'default_value'
          }
        ]
      },
      {
        name: 'strict-types',
        description: 'Alias with strict type checking',
        tool: 'StrictTool',
        parameters: {
          str_param: '{{strValue}}',
          num_param: '{{numValue}}',
          bool_param: '{{boolValue}}'
        },
        enabled: true,
        aliasParameters: [
          {
            name: 'strValue',
            description: 'String value',
            type: 'string',
            required: true
          },
          {
            name: 'numValue',
            description: 'Number value',
            type: 'number',
            required: true
          },
          {
            name: 'boolValue',
            description: 'Boolean value',
            type: 'boolean',
            required: false,
            default: true
          }
        ]
      }
    ];

    resolver = new AliasResolver(sampleAliases);
  });

  describe('Missing Alias Errors', () => {
    it('should throw error for unknown alias', () => {
      expect(() => {
        resolver.resolve('unknown-alias', {});
      }).toThrow(AliasResolutionError);
    });

    it('should include available aliases in error message', () => {
      try {
        resolver.resolve('unknown-alias', {});
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AliasResolutionError);
        expect(error.message).toContain('Available aliases: valid-alias, strict-types');
        expect((error as AliasResolutionError).aliasName).toBe('unknown-alias');
      }
    });

    it('should handle empty alias list gracefully', () => {
      const emptyResolver = new AliasResolver([]);

      expect(() => {
        emptyResolver.resolve('any-alias', {});
      }).toThrow(AliasResolutionError);

      try {
        emptyResolver.resolve('any-alias', {});
      } catch (error) {
        expect(error.message).toContain('Available aliases:');
      }
    });
  });

  describe('Missing Required Parameters', () => {
    it('should throw error for missing required parameters', () => {
      expect(() => {
        resolver.resolve('valid-alias', {
          // Missing required 'value1' parameter
          value2: 'optional_value'
        });
      }).toThrow(AliasResolutionError);
    });

    it('should list all missing required parameters', () => {
      try {
        resolver.resolve('strict-types', {
          // Missing all required parameters
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AliasResolutionError);
        expect(error.message).toContain('Missing required parameters: strValue, numValue');
        expect((error as AliasResolutionError).missingParams).toEqual(['strValue', 'numValue']);
      }
    });

    it('should include parameter descriptions in error message', () => {
      try {
        resolver.resolve('valid-alias', {});
      } catch (error) {
        expect(error.message).toContain('Required parameters: value1');
        expect(error.message).toContain('Optional parameters: value2');
      }
    });
  });

  describe('Invalid Parameter Types', () => {
    it('should validate string parameters', () => {
      expect(() => {
        resolver.resolve('strict-types', {
          strValue: 123, // Should be string
          numValue: 456
        });
      }).toThrow(AliasResolutionError);
    });

    it('should validate number parameters', () => {
      expect(() => {
        resolver.resolve('strict-types', {
          strValue: 'valid_string',
          numValue: 'not_a_number' // Should be number
        });
      }).toThrow(AliasResolutionError);
    });

    it('should validate boolean parameters', () => {
      expect(() => {
        resolver.resolve('strict-types', {
          strValue: 'valid_string',
          numValue: 123,
          boolValue: 'not_a_boolean' // Should be boolean
        });
      }).toThrow(AliasResolutionError);
    });

    it('should include type validation details in error message', () => {
      try {
        resolver.resolve('strict-types', {
          strValue: 123,
          numValue: 'invalid'
        });
      } catch (error) {
        expect(error.message).toContain('strValue (expected string, got number)');
        expect(error.message).toContain('numValue (expected number, got string)');
      }
    });
  });

  describe('Extra Parameters', () => {
    it('should reject extra parameters not defined in alias', () => {
      expect(() => {
        resolver.resolve('valid-alias', {
          value1: 'required_value',
          value2: 'optional_value',
          extra_param: 'not_allowed' // Not defined in alias
        });
      }).toThrow(AliasResolutionError);
    });

    it('should list all extra parameters in error message', () => {
      try {
        resolver.resolve('valid-alias', {
          value1: 'required_value',
          extra1: 'not_allowed',
          extra2: 'also_not_allowed'
        });
      } catch (error) {
        expect(error.message).toContain('Unknown parameters: extra1, extra2');
      }
    });

    it('should handle combined validation errors', () => {
      try {
        resolver.resolve('strict-types', {
          // Missing strValue (required)
          numValue: 'not_a_number', // Wrong type
          extraParam: 'not_allowed' // Extra parameter
        });
      } catch (error) {
        expect(error.message).toContain('Missing required parameters: strValue');
        expect(error.message).toContain('Unknown parameters: extraParam');
        expect(error.message).toContain('numValue (expected number, got string)');
      }
    });
  });

  describe('Edge Cases and Malformed Input', () => {
    it('should handle null parameters', () => {
      expect(() => {
        resolver.resolve('valid-alias', null as any);
      }).toThrow(AliasResolutionError);
    });

    it('should handle undefined parameters', () => {
      expect(() => {
        resolver.resolve('valid-alias', undefined as any);
      }).toThrow(AliasResolutionError);
    });

    it('should handle empty string alias name', () => {
      expect(() => {
        resolver.resolve('', {});
      }).toThrow(AliasResolutionError);
    });

    it('should handle whitespace-only alias name', () => {
      expect(() => {
        resolver.resolve('   ', {});
      }).toThrow(AliasResolutionError);
    });

    it('should handle special characters in parameters', () => {
      const result = resolver.resolve('valid-alias', {
        value1: 'value with spaces and "quotes"',
        value2: 'value with \n newlines \t tabs'
      });

      expect(result.parameters.param1).toBe('value with spaces and "quotes"');
      expect(result.parameters.param2).toBe('value with \n newlines \t tabs');
    });

    it('should handle unicode characters in parameters', () => {
      const result = resolver.resolve('valid-alias', {
        value1: '日本語 中文 العربية 🚀'
      });

      expect(result.parameters.param1).toBe('日本語 中文 العربية 🚀');
    });
  });

  describe('Complex Parameter Structures', () => {
    it('should handle nested object substitution', () => {
      const complexAlias: ToolAlias = {
        name: 'complex',
        description: 'Complex alias with nested structures',
        tool: 'ComplexTool',
        parameters: {
          config: {
            nested: {
              value: '{{nestedValue}}',
              flag: true
            },
            array: ['{{item1}}', 'static', '{{item2}}']
          }
        },
        enabled: true,
        aliasParameters: [
          { name: 'nestedValue', description: 'Nested value', type: 'string', required: true },
          { name: 'item1', description: 'First item', type: 'string', required: true },
          { name: 'item2', description: 'Second item', type: 'string', required: false, default: 'default_item' }
        ]
      };

      const complexResolver = new AliasResolver([complexAlias]);

      const result = complexResolver.resolve('complex', {
        nestedValue: 'test_nested',
        item1: 'first_item'
      });

      expect(result.parameters).toEqual({
        config: {
          nested: {
            value: 'test_nested',
            flag: true
          },
          array: ['first_item', 'static', 'default_item']
        }
      });
    });

    it('should handle circular references gracefully', () => {
      const circularParams = {
        value1: 'test'
      };
      // Create circular reference
      (circularParams as any).circular = circularParams;

      // Should not crash on circular references
      expect(() => {
        resolver.resolve('valid-alias', circularParams);
      }).not.toThrow();
    });

    it('should handle very deep nesting', () => {
      const deepAlias: ToolAlias = {
        name: 'deep',
        description: 'Deep nested alias',
        tool: 'DeepTool',
        parameters: {
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: '{{deepValue}}'
                }
              }
            }
          }
        },
        enabled: true,
        aliasParameters: [
          { name: 'deepValue', description: 'Deep value', type: 'string', required: true }
        ]
      };

      const deepResolver = new AliasResolver([deepAlias]);

      const result = deepResolver.resolve('deep', {
        deepValue: 'deep_test_value'
      });

      expect(result.parameters.level1.level2.level3.level4.level5).toBe('deep_test_value');
    });
  });

  describe('Error Object Properties', () => {
    it('should create AliasResolutionError with correct properties', () => {
      try {
        resolver.resolve('unknown-alias', {});
      } catch (error) {
        expect(error).toBeInstanceOf(AliasResolutionError);
        expect(error.name).toBe('AliasResolutionError');
        expect((error as AliasResolutionError).aliasName).toBe('unknown-alias');
        expect(error.message).toBeTruthy();
      }
    });

    it('should include missing parameters in error object', () => {
      try {
        resolver.resolve('strict-types', {});
      } catch (error) {
        const aliasError = error as AliasResolutionError;
        expect(aliasError.missingParams).toEqual(['strValue', 'numValue']);
      }
    });

    it('should handle errors without missing parameters', () => {
      try {
        resolver.resolve('nonexistent', {});
      } catch (error) {
        const aliasError = error as AliasResolutionError;
        expect(aliasError.missingParams).toBeUndefined();
      }
    });
  });

  describe('Parameter Default Values Edge Cases', () => {
    it('should handle null as default value', () => {
      const nullDefaultAlias: ToolAlias = {
        name: 'null-default',
        description: 'Alias with null default',
        tool: 'NullTool',
        parameters: {
          param: '{{value}}'
        },
        enabled: true,
        aliasParameters: [
          { name: 'value', description: 'Value', type: 'string', required: false, default: null as any }
        ]
      };

      const nullResolver = new AliasResolver([nullDefaultAlias]);

      const result = nullResolver.resolve('null-default', {});

      expect(result.parameters.param).toBe(null);
    });

    it('should handle undefined default value as missing required parameter', () => {
      const undefinedDefaultAlias: ToolAlias = {
        name: 'undefined-default',
        description: 'Alias with undefined default',
        tool: 'UndefinedTool',
        parameters: {
          param: '{{value}}'
        },
        enabled: true,
        aliasParameters: [
          { name: 'value', description: 'Value', type: 'string', required: true, default: undefined }
        ]
      };

      const undefinedResolver = new AliasResolver([undefinedDefaultAlias]);

      expect(() => {
        undefinedResolver.resolve('undefined-default', {});
      }).toThrow(AliasResolutionError);
    });

    it('should handle empty string as valid default value', () => {
      const emptyDefaultAlias: ToolAlias = {
        name: 'empty-default',
        description: 'Alias with empty string default',
        tool: 'EmptyTool',
        parameters: {
          param: '{{value}}'
        },
        enabled: true,
        aliasParameters: [
          { name: 'value', description: 'Value', type: 'string', required: false, default: '' }
        ]
      };

      const emptyResolver = new AliasResolver([emptyDefaultAlias]);

      const result = emptyResolver.resolve('empty-default', {});

      expect(result.parameters.param).toBe('');
    });

    it('should handle zero as valid number default', () => {
      const zeroDefaultAlias: ToolAlias = {
        name: 'zero-default',
        description: 'Alias with zero default',
        tool: 'ZeroTool',
        parameters: {
          param: '{{value}}'
        },
        enabled: true,
        aliasParameters: [
          { name: 'value', description: 'Value', type: 'number', required: false, default: 0 }
        ]
      };

      const zeroResolver = new AliasResolver([zeroDefaultAlias]);

      const result = zeroResolver.resolve('zero-default', {});

      expect(result.parameters.param).toBe('0'); // String conversion in substitution
    });

    it('should handle false as valid boolean default', () => {
      const falseDefaultAlias: ToolAlias = {
        name: 'false-default',
        description: 'Alias with false default',
        tool: 'FalseTool',
        parameters: {
          param: '{{value}}'
        },
        enabled: true,
        aliasParameters: [
          { name: 'value', description: 'Value', type: 'boolean', required: false, default: false }
        ]
      };

      const falseResolver = new AliasResolver([falseDefaultAlias]);

      const result = falseResolver.resolve('false-default', {});

      expect(result.parameters.param).toBe('false'); // String conversion in substitution
    });
  });
});
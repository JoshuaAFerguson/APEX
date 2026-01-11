/**
 * AliasResolver Tests
 *
 * Comprehensive tests for the tool alias resolver functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AliasResolver, AliasResolutionError } from '../alias-resolver';
import { ToolAlias } from '@apexcli/core';

describe('AliasResolver', () => {
  let resolver: AliasResolver;
  let sampleAliases: ToolAlias[];

  beforeEach(() => {
    sampleAliases = [
      {
        name: 'search-files',
        description: 'Search for files with pattern',
        tool: 'grep',
        parameters: {
          pattern: '{{pattern}}',
          path: '{{path}}',
          output_mode: 'files_with_matches'
        },
        enabled: true,
        aliasParameters: [
          {
            name: 'pattern',
            description: 'Search pattern',
            type: 'string',
            required: true
          },
          {
            name: 'path',
            description: 'Search path',
            type: 'string',
            required: false,
            default: '.'
          }
        ]
      },
      {
        name: 'read-file',
        description: 'Read a specific file',
        tool: 'read',
        parameters: {
          file_path: '{{filePath}}'
        },
        enabled: true,
        aliasParameters: [
          {
            name: 'filePath',
            description: 'Path to file',
            type: 'string',
            required: true
          }
        ]
      },
      {
        name: 'run-command',
        description: 'Run shell command with timeout',
        tool: 'bash',
        parameters: {
          command: '{{command}}',
          timeout: '{{timeout}}',
          description: 'Running: {{command}}'
        },
        enabled: true,
        aliasParameters: [
          {
            name: 'command',
            description: 'Command to run',
            type: 'string',
            required: true
          },
          {
            name: 'timeout',
            description: 'Timeout in milliseconds',
            type: 'number',
            required: false,
            default: 30000
          }
        ]
      },
      {
        name: 'disabled-alias',
        description: 'A disabled alias',
        tool: 'bash',
        parameters: {
          command: 'echo disabled'
        },
        enabled: false,
        aliasParameters: []
      },
      {
        name: 'no-params-alias',
        description: 'Alias with no parameters',
        tool: 'bash',
        parameters: {
          command: 'echo hello'
        },
        enabled: true,
        aliasParameters: []
      }
    ];

    resolver = new AliasResolver(sampleAliases);
  });

  describe('constructor and basic methods', () => {
    it('should initialize with aliases', () => {
      expect(resolver.getAvailableAliases()).toEqual([
        'search-files',
        'read-file',
        'run-command',
        'disabled-alias',
        'no-params-alias'
      ]);
    });

    it('should check if alias exists', () => {
      expect(resolver.hasAlias('search-files')).toBe(true);
      expect(resolver.hasAlias('nonexistent')).toBe(false);
    });

    it('should get alias definition', () => {
      const alias = resolver.getAlias('search-files');
      expect(alias).toBeDefined();
      expect(alias?.name).toBe('search-files');
      expect(alias?.tool).toBe('grep');
    });

    it('should return undefined for nonexistent alias', () => {
      const alias = resolver.getAlias('nonexistent');
      expect(alias).toBeUndefined();
    });

    it('should update aliases with setAliases', () => {
      const newAliases: ToolAlias[] = [
        {
          name: 'new-alias',
          description: 'New alias',
          tool: 'bash',
          parameters: { command: 'echo new' },
          enabled: true,
          aliasParameters: []
        }
      ];

      resolver.setAliases(newAliases);
      expect(resolver.getAvailableAliases()).toEqual(['new-alias']);
      expect(resolver.hasAlias('search-files')).toBe(false);
    });
  });

  describe('successful resolution', () => {
    it('should resolve alias with all required parameters', () => {
      const result = resolver.resolve('search-files', {
        pattern: 'function',
        path: 'src/'
      });

      expect(result).toEqual({
        aliasName: 'search-files',
        tool: 'grep',
        parameters: {
          pattern: 'function',
          path: 'src/',
          output_mode: 'files_with_matches'
        },
        alias: sampleAliases[0]
      });
    });

    it('should resolve alias with default parameters', () => {
      const result = resolver.resolve('search-files', {
        pattern: 'function'
      });

      expect(result).toEqual({
        aliasName: 'search-files',
        tool: 'grep',
        parameters: {
          pattern: 'function',
          path: '.',  // default value
          output_mode: 'files_with_matches'
        },
        alias: sampleAliases[0]
      });
    });

    it('should resolve alias with no parameters defined', () => {
      const result = resolver.resolve('no-params-alias');

      expect(result).toEqual({
        aliasName: 'no-params-alias',
        tool: 'bash',
        parameters: {
          command: 'echo hello'
        },
        alias: sampleAliases[4]
      });
    });

    it('should handle number parameter types', () => {
      const result = resolver.resolve('run-command', {
        command: 'ls -la',
        timeout: 5000
      });

      expect(result).toEqual({
        aliasName: 'run-command',
        tool: 'bash',
        parameters: {
          command: 'ls -la',
          timeout: 5000,
          description: 'Running: ls -la'
        },
        alias: sampleAliases[2]
      });
    });

    it('should convert non-string values to strings in substitution', () => {
      const result = resolver.resolve('run-command', {
        command: 'sleep',
        timeout: 1000
      });

      expect(result.parameters.timeout).toBe(1000);
      expect(result.parameters.description).toBe('Running: sleep');
    });
  });

  describe('parameter validation', () => {
    it('should throw error for unknown alias', () => {
      expect(() => {
        resolver.resolve('unknown-alias');
      }).toThrow(AliasResolutionError);

      try {
        resolver.resolve('unknown-alias');
      } catch (error) {
        expect(error).toBeInstanceOf(AliasResolutionError);
        expect((error as AliasResolutionError).aliasName).toBe('unknown-alias');
        expect((error as AliasResolutionError).message).toContain('Unknown alias \'unknown-alias\'');
        expect((error as AliasResolutionError).message).toContain('Available aliases:');
      }
    });

    it('should throw error for missing required parameters', () => {
      expect(() => {
        resolver.resolve('search-files');
      }).toThrow(AliasResolutionError);

      try {
        resolver.resolve('search-files');
      } catch (error) {
        expect(error).toBeInstanceOf(AliasResolutionError);
        expect((error as AliasResolutionError).aliasName).toBe('search-files');
        expect((error as AliasResolutionError).missingParams).toEqual(['pattern']);
        expect((error as AliasResolutionError).message).toContain('Missing required parameters: pattern');
      }
    });

    it('should throw error for extra unknown parameters', () => {
      expect(() => {
        resolver.resolve('read-file', {
          filePath: '/path/to/file',
          unknown: 'parameter'
        });
      }).toThrow(AliasResolutionError);

      try {
        resolver.resolve('read-file', {
          filePath: '/path/to/file',
          unknown: 'parameter'
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AliasResolutionError);
        expect((error as AliasResolutionError).message).toContain('Unknown parameters: unknown');
      }
    });

    it('should throw error for wrong parameter types', () => {
      expect(() => {
        resolver.resolve('run-command', {
          command: 'ls',
          timeout: 'not-a-number'  // Should be number
        });
      }).toThrow(AliasResolutionError);

      try {
        resolver.resolve('run-command', {
          command: 'ls',
          timeout: 'not-a-number'
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AliasResolutionError);
        expect((error as AliasResolutionError).message).toContain('expected number, got string');
      }
    });

    it('should include helpful error information', () => {
      try {
        resolver.resolve('search-files');
      } catch (error) {
        expect((error as AliasResolutionError).message).toContain('Required parameters: pattern');
        expect((error as AliasResolutionError).message).toContain('Optional parameters: path');
      }
    });
  });

  describe('parameter substitution', () => {
    it('should substitute simple string parameters', () => {
      const result = resolver.resolve('read-file', {
        filePath: '/home/user/file.txt'
      });

      expect(result.parameters.file_path).toBe('/home/user/file.txt');
    });

    it('should substitute parameters in complex strings', () => {
      const result = resolver.resolve('run-command', {
        command: 'grep pattern file.txt'
      });

      expect(result.parameters.description).toBe('Running: grep pattern file.txt');
    });

    it('should leave unreplaced placeholders', () => {
      // Create alias with parameter that won't be provided
      const aliasWithExtra: ToolAlias = {
        name: 'test-unreplaced',
        description: 'Test unreplaced parameters',
        tool: 'bash',
        parameters: {
          command: 'echo {{provided}} {{notProvided}}'
        },
        enabled: true,
        aliasParameters: [
          {
            name: 'provided',
            description: 'Provided param',
            type: 'string',
            required: true
          }
        ]
      };

      const testResolver = new AliasResolver([aliasWithExtra]);
      const result = testResolver.resolve('test-unreplaced', {
        provided: 'hello'
      });

      expect(result.parameters.command).toBe('echo hello {{notProvided}}');
    });

    it('should handle nested object substitution', () => {
      const aliasWithNested: ToolAlias = {
        name: 'test-nested',
        description: 'Test nested parameters',
        tool: 'custom',
        parameters: {
          config: {
            name: '{{name}}',
            settings: {
              timeout: '{{timeout}}',
              enabled: true
            }
          }
        },
        enabled: true,
        aliasParameters: [
          {
            name: 'name',
            description: 'Name parameter',
            type: 'string',
            required: true
          },
          {
            name: 'timeout',
            description: 'Timeout parameter',
            type: 'string',
            required: true
          }
        ]
      };

      const testResolver = new AliasResolver([aliasWithNested]);
      const result = testResolver.resolve('test-nested', {
        name: 'test',
        timeout: '5000'
      });

      expect(result.parameters.config.name).toBe('test');
      expect(result.parameters.config.settings.timeout).toBe('5000');
      expect(result.parameters.config.settings.enabled).toBe(true);
    });

    it('should handle array substitution', () => {
      const aliasWithArray: ToolAlias = {
        name: 'test-array',
        description: 'Test array parameters',
        tool: 'custom',
        parameters: {
          items: ['{{item1}}', '{{item2}}', 'static']
        },
        enabled: true,
        aliasParameters: [
          {
            name: 'item1',
            description: 'First item',
            type: 'string',
            required: true
          },
          {
            name: 'item2',
            description: 'Second item',
            type: 'string',
            required: true
          }
        ]
      };

      const testResolver = new AliasResolver([aliasWithArray]);
      const result = testResolver.resolve('test-array', {
        item1: 'first',
        item2: 'second'
      });

      expect(result.parameters.items).toEqual(['first', 'second', 'static']);
    });
  });

  describe('edge cases', () => {
    it('should handle empty parameters gracefully', () => {
      const result = resolver.resolve('no-params-alias', {});
      expect(result.tool).toBe('bash');
      expect(result.parameters.command).toBe('echo hello');
    });

    it('should handle boolean and number parameters', () => {
      const booleanAlias: ToolAlias = {
        name: 'test-boolean',
        description: 'Test boolean parameters',
        tool: 'bash',
        parameters: {
          flag: '{{flag}}',
          count: '{{count}}'
        },
        enabled: true,
        aliasParameters: [
          {
            name: 'flag',
            description: 'Boolean flag',
            type: 'boolean',
            required: true
          },
          {
            name: 'count',
            description: 'Number count',
            type: 'number',
            required: true
          }
        ]
      };

      const testResolver = new AliasResolver([booleanAlias]);
      const result = testResolver.resolve('test-boolean', {
        flag: true,
        count: 42
      });

      expect(result.parameters.flag).toBe('true');
      expect(result.parameters.count).toBe('42');
    });

    it('should handle disabled aliases', () => {
      // Disabled aliases should still resolve if called directly
      const result = resolver.resolve('disabled-alias');
      expect(result.tool).toBe('bash');
      expect(result.parameters.command).toBe('echo disabled');
    });

    it('should handle aliases with no aliasParameters defined', () => {
      const noParamDef: ToolAlias = {
        name: 'no-param-def',
        description: 'No parameter definitions',
        tool: 'bash',
        parameters: {
          command: 'echo {{anything}}'
        },
        enabled: true
        // No aliasParameters defined
      };

      const testResolver = new AliasResolver([noParamDef]);

      // Should allow any parameters when no definitions exist
      const result = testResolver.resolve('no-param-def', {
        anything: 'test',
        extra: 'allowed'
      });

      expect(result.parameters.command).toBe('echo test');
    });
  });

  describe('parameter merging with defaults', () => {
    it('should use default values for optional parameters', () => {
      const result = resolver.resolve('search-files', {
        pattern: 'test'
      });

      expect(result.parameters.path).toBe('.');  // default value
    });

    it('should override default values with provided parameters', () => {
      const result = resolver.resolve('search-files', {
        pattern: 'test',
        path: '/custom/path'
      });

      expect(result.parameters.path).toBe('/custom/path');
    });

    it('should handle multiple default values', () => {
      const result = resolver.resolve('run-command', {
        command: 'ls'
      });

      expect(result.parameters.timeout).toBe(30000);  // default value
    });
  });

  describe('parameter validation edge cases', () => {
    it('should handle required parameters with default values', () => {
      const aliasWithRequiredDefault: ToolAlias = {
        name: 'test-required-default',
        description: 'Required param with default',
        tool: 'bash',
        parameters: {
          value: '{{value}}'
        },
        enabled: true,
        aliasParameters: [
          {
            name: 'value',
            description: 'Value with default',
            type: 'string',
            required: true,
            default: 'default'
          }
        ]
      };

      const testResolver = new AliasResolver([aliasWithRequiredDefault]);

      // Should not throw error because default value is provided
      const result = testResolver.resolve('test-required-default');
      expect(result.parameters.value).toBe('default');
    });

    it('should handle multiple validation errors at once', () => {
      expect(() => {
        resolver.resolve('run-command', {
          unknownParam: 'test',
          timeout: 'invalid'  // Wrong type
          // Missing required 'command' parameter
        });
      }).toThrow(AliasResolutionError);

      try {
        resolver.resolve('run-command', {
          unknownParam: 'test',
          timeout: 'invalid'
        });
      } catch (error) {
        const e = error as AliasResolutionError;
        expect(e.message).toContain('Missing required parameters: command');
        expect(e.message).toContain('Unknown parameters: unknownParam');
        expect(e.missingParams).toEqual(['command']);
      }
    });

    it('should handle null and undefined parameter values', () => {
      const nullTestAlias: ToolAlias = {
        name: 'null-test',
        description: 'Test null/undefined values',
        tool: 'bash',
        parameters: {
          command: 'echo {{value}}'
        },
        enabled: true,
        aliasParameters: [
          {
            name: 'value',
            description: 'Value param',
            type: 'string',
            required: true
          }
        ]
      };

      const testResolver = new AliasResolver([nullTestAlias]);

      // Should convert null/undefined to strings
      let result = testResolver.resolve('null-test', { value: null });
      expect(result.parameters.command).toBe('echo null');

      result = testResolver.resolve('null-test', { value: undefined });
      expect(result.parameters.command).toBe('echo undefined');
    });

    it('should handle complex parameter names in templates', () => {
      const complexAlias: ToolAlias = {
        name: 'complex-params',
        description: 'Test complex parameter names',
        tool: 'bash',
        parameters: {
          command: 'echo {{param1}} and {{param2}} but not {{nonexistent}}'
        },
        enabled: true,
        aliasParameters: [
          {
            name: 'param1',
            description: 'First param',
            type: 'string',
            required: true
          },
          {
            name: 'param2',
            description: 'Second param',
            type: 'string',
            required: true
          }
        ]
      };

      const testResolver = new AliasResolver([complexAlias]);
      const result = testResolver.resolve('complex-params', {
        param1: 'hello',
        param2: 'world'
      });

      expect(result.parameters.command).toBe('echo hello and world but not {{nonexistent}}');
    });

    it('should handle empty alias list gracefully', () => {
      const emptyResolver = new AliasResolver([]);
      expect(emptyResolver.getAvailableAliases()).toEqual([]);
      expect(emptyResolver.hasAlias('anything')).toBe(false);

      expect(() => {
        emptyResolver.resolve('anything');
      }).toThrow(AliasResolutionError);
    });

    it('should handle very deep nested object substitution', () => {
      const deepAlias: ToolAlias = {
        name: 'deep-nested',
        description: 'Test deeply nested objects',
        tool: 'custom',
        parameters: {
          config: {
            level1: {
              level2: {
                level3: {
                  value: '{{deepValue}}',
                  array: [
                    {
                      nested: '{{arrayValue}}'
                    }
                  ]
                }
              }
            }
          }
        },
        enabled: true,
        aliasParameters: [
          {
            name: 'deepValue',
            description: 'Deep value',
            type: 'string',
            required: true
          },
          {
            name: 'arrayValue',
            description: 'Array value',
            type: 'string',
            required: true
          }
        ]
      };

      const testResolver = new AliasResolver([deepAlias]);
      const result = testResolver.resolve('deep-nested', {
        deepValue: 'deep',
        arrayValue: 'array'
      });

      expect(result.parameters.config.level1.level2.level3.value).toBe('deep');
      expect(result.parameters.config.level1.level2.level3.array[0].nested).toBe('array');
    });
  });

  describe('AliasResolutionError', () => {
    it('should have correct error properties', () => {
      const error = new AliasResolutionError('test message', 'test-alias', ['param1', 'param2']);

      expect(error.name).toBe('AliasResolutionError');
      expect(error.message).toBe('test message');
      expect(error.aliasName).toBe('test-alias');
      expect(error.missingParams).toEqual(['param1', 'param2']);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AliasResolutionError);
    });

    it('should work with minimal properties', () => {
      const error = new AliasResolutionError('simple message');

      expect(error.name).toBe('AliasResolutionError');
      expect(error.message).toBe('simple message');
      expect(error.aliasName).toBeUndefined();
      expect(error.missingParams).toBeUndefined();
    });
  });
});
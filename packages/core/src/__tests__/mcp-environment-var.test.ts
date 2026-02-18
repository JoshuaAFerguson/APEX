import { describe, it, expect } from 'vitest';
import {
  MCPEnvironmentVarSchema,
  MCPEnvironmentVar,
} from '../types.js';

/**
 * Comprehensive test suite for MCPEnvironmentVar schema
 * Tests validation, edge cases, and TypeScript type inference for MCP environment variables
 *
 * MCPEnvironmentVar provides structured metadata for environment variables used by MCP servers,
 * including descriptions, sensitivity flags, and required/optional status.
 */
describe('MCPEnvironmentVar Schema Tests', () => {
  describe('Valid configurations', () => {
    it('should accept minimal required configuration with name only', () => {
      const minimalVar = {
        name: 'API_KEY',
      };

      const result = MCPEnvironmentVarSchema.parse(minimalVar);

      expect(result.name).toBe('API_KEY');
      expect(result.description).toBeUndefined();
      expect(result.required).toBeUndefined();
      expect(result.sensitive).toBeUndefined();
      expect(result.defaultValue).toBeUndefined();
      expect(result.source).toBeUndefined();
    });

    it('should accept complete configuration with all fields', () => {
      const fullVar = {
        name: 'OPENAI_API_KEY',
        description: 'OpenAI API key for accessing GPT models',
        required: true,
        sensitive: true,
        defaultValue: 'sk-default-key',
        source: 'config' as const,
      };

      const result = MCPEnvironmentVarSchema.parse(fullVar);

      expect(result.name).toBe('OPENAI_API_KEY');
      expect(result.description).toBe('OpenAI API key for accessing GPT models');
      expect(result.required).toBe(true);
      expect(result.sensitive).toBe(true);
      expect(result.defaultValue).toBe('sk-default-key');
      expect(result.source).toBe('config');
    });

    it('should handle various environment variable name patterns', () => {
      const namePatterns = [
        'SIMPLE_VAR',
        'NODE_ENV',
        'API_URL',
        'DATABASE_CONNECTION_STRING',
        'MCP_SERVER_PORT',
        'LOG_LEVEL',
        'DEBUG',
        'PATH',
        'HOME',
        'USER',
        'WORKSPACE_DIR',
        'CONFIG_FILE_PATH',
      ];

      namePatterns.forEach(name => {
        const envVar = { name };
        expect(() => MCPEnvironmentVarSchema.parse(envVar)).not.toThrow();
        const result = MCPEnvironmentVarSchema.parse(envVar);
        expect(result.name).toBe(name);
      });
    });

    it('should handle various description formats', () => {
      const descriptions = [
        'Simple description',
        'A very long description with lots of details about what this environment variable does and how it affects the system behavior',
        'Description with special characters !@#$%^&*()',
        'Description with Unicode characters: тест 서버 测试 🚀',
        'Description with\nmultiline\ncontent',
        '',
      ];

      descriptions.forEach(description => {
        const envVar = {
          name: 'TEST_VAR',
          description,
        };
        expect(() => MCPEnvironmentVarSchema.parse(envVar)).not.toThrow();
        const result = MCPEnvironmentVarSchema.parse(envVar);
        expect(result.description).toBe(description);
      });
    });

    it('should handle boolean flag combinations', () => {
      const flagCombinations = [
        { required: true, sensitive: true },
        { required: true, sensitive: false },
        { required: false, sensitive: true },
        { required: false, sensitive: false },
        { required: true },
        { sensitive: true },
        {},
      ];

      flagCombinations.forEach(flags => {
        const envVar = {
          name: 'FLAG_TEST_VAR',
          ...flags,
        };
        expect(() => MCPEnvironmentVarSchema.parse(envVar)).not.toThrow();
        const result = MCPEnvironmentVarSchema.parse(envVar);
        expect(result.required).toBe(flags.required);
        expect(result.sensitive).toBe(flags.sensitive);
      });
    });

    it('should handle various default value types', () => {
      const defaultValues = [
        'string-value',
        '',
        '123',
        'true',
        'false',
        'null',
        'undefined',
        '/path/to/file',
        'https://api.example.com',
        'production',
        'development',
        'info',
        'debug',
      ];

      defaultValues.forEach(defaultValue => {
        const envVar = {
          name: 'DEFAULT_TEST_VAR',
          defaultValue,
        };
        expect(() => MCPEnvironmentVarSchema.parse(envVar)).not.toThrow();
        const result = MCPEnvironmentVarSchema.parse(envVar);
        expect(result.defaultValue).toBe(defaultValue);
      });
    });

    it('should handle all valid source enum values', () => {
      const validSources = ['config', 'env', 'user', 'default'];

      validSources.forEach(source => {
        const envVar = {
          name: 'SOURCE_TEST_VAR',
          source,
        };
        expect(() => MCPEnvironmentVarSchema.parse(envVar)).not.toThrow();
        const result = MCPEnvironmentVarSchema.parse(envVar);
        expect(result.source).toBe(source);
      });
    });

    it('should handle various partial configurations', () => {
      const partialConfigs = [
        {
          name: 'PARTIAL_1',
          description: 'Only with description',
        },
        {
          name: 'PARTIAL_2',
          required: true,
        },
        {
          name: 'PARTIAL_3',
          sensitive: true,
        },
        {
          name: 'PARTIAL_4',
          defaultValue: 'default',
        },
        {
          name: 'PARTIAL_5',
          source: 'env' as const,
        },
        {
          name: 'PARTIAL_6',
          description: 'With description and required flag',
          required: true,
        },
        {
          name: 'PARTIAL_7',
          required: false,
          sensitive: true,
          defaultValue: 'secret-default',
        },
      ];

      partialConfigs.forEach(config => {
        expect(() => MCPEnvironmentVarSchema.parse(config)).not.toThrow();
        const result = MCPEnvironmentVarSchema.parse(config);
        expect(result.name).toBe(config.name);

        // Verify specified values are preserved
        Object.entries(config).forEach(([key, value]) => {
          if (key !== 'name') {
            expect(result[key as keyof MCPEnvironmentVar]).toBe(value);
          }
        });
      });
    });
  });

  describe('Validation errors', () => {
    it('should reject empty or invalid name', () => {
      const invalidNames = [
        '',
        '   ',
        '\t',
        '\n',
        null,
        undefined,
        123,
        {},
        [],
        true,
        false,
      ];

      invalidNames.forEach(name => {
        const envVar = { name };
        expect(() => MCPEnvironmentVarSchema.parse(envVar)).toThrow();
      });
    });

    it('should reject invalid source values', () => {
      const invalidSources = [
        'invalid',
        'system',
        'file',
        'database',
        'network',
        '',
        123,
        {},
        [],
        null,
        undefined,
        true,
        false,
      ];

      invalidSources.forEach(source => {
        const envVar = {
          name: 'TEST_VAR',
          source,
        };
        expect(() => MCPEnvironmentVarSchema.parse(envVar)).toThrow();
      });
    });

    it('should reject invalid boolean values', () => {
      const invalidBooleans = [
        'true',
        'false',
        1,
        0,
        'yes',
        'no',
        {},
        [],
        null,
        undefined,
      ];

      invalidBooleans.forEach(invalidBoolean => {
        // Test required field
        const requiredVar = {
          name: 'TEST_VAR',
          required: invalidBoolean,
        };
        expect(() => MCPEnvironmentVarSchema.parse(requiredVar)).toThrow();

        // Test sensitive field
        const sensitiveVar = {
          name: 'TEST_VAR',
          sensitive: invalidBoolean,
        };
        expect(() => MCPEnvironmentVarSchema.parse(sensitiveVar)).toThrow();
      });
    });

    it('should reject non-string description values', () => {
      const invalidDescriptions = [
        123,
        true,
        {},
        [],
        null,
        undefined,
      ];

      invalidDescriptions.forEach(description => {
        const envVar = {
          name: 'TEST_VAR',
          description,
        };
        expect(() => MCPEnvironmentVarSchema.parse(envVar)).toThrow();
      });
    });

    it('should reject non-string defaultValue values', () => {
      const invalidDefaultValues = [
        123,
        true,
        {},
        [],
        null,
        undefined,
      ];

      invalidDefaultValues.forEach(defaultValue => {
        const envVar = {
          name: 'TEST_VAR',
          defaultValue,
        };
        expect(() => MCPEnvironmentVarSchema.parse(envVar)).toThrow();
      });
    });

    it('should reject missing required name field', () => {
      const incompleteVars = [
        {},
        { description: 'Missing name' },
        { required: true },
        { sensitive: true },
        { defaultValue: 'test' },
        { source: 'config' },
      ];

      incompleteVars.forEach(envVar => {
        expect(() => MCPEnvironmentVarSchema.parse(envVar)).toThrow();
      });
    });
  });

  describe('TypeScript type inference', () => {
    it('should provide correct TypeScript types', () => {
      const envVar = MCPEnvironmentVarSchema.parse({
        name: 'TYPE_TEST_VAR',
        description: 'Test variable for TypeScript types',
        required: true,
        sensitive: false,
        defaultValue: 'test-default',
        source: 'config',
      });

      // Type assertions to ensure TypeScript compilation
      const name: string = envVar.name;
      const description: string | undefined = envVar.description;
      const required: boolean | undefined = envVar.required;
      const sensitive: boolean | undefined = envVar.sensitive;
      const defaultValue: string | undefined = envVar.defaultValue;
      const source: 'config' | 'env' | 'user' | 'default' | undefined = envVar.source;

      expect(typeof name).toBe('string');
      expect(typeof description).toBe('string');
      expect(typeof required).toBe('boolean');
      expect(typeof sensitive).toBe('boolean');
      expect(typeof defaultValue).toBe('string');
      expect(typeof source).toBe('string');

      expect(name).toBe('TYPE_TEST_VAR');
      expect(description).toBe('Test variable for TypeScript types');
      expect(required).toBe(true);
      expect(sensitive).toBe(false);
      expect(defaultValue).toBe('test-default');
      expect(source).toBe('config');
    });

    it('should handle optional fields correctly in TypeScript', () => {
      const envVar: MCPEnvironmentVar = {
        name: 'OPTIONAL_FIELDS_TEST',
      };

      expect(envVar.name).toBe('OPTIONAL_FIELDS_TEST');
      expect(envVar.description).toBeUndefined();
      expect(envVar.required).toBeUndefined();
      expect(envVar.sensitive).toBeUndefined();
      expect(envVar.defaultValue).toBeUndefined();
      expect(envVar.source).toBeUndefined();
    });
  });

  describe('Real-world use cases', () => {
    it('should handle common API key configuration', () => {
      const apiKeyVar = {
        name: 'OPENAI_API_KEY',
        description: 'OpenAI API key for GPT model access',
        required: true,
        sensitive: true,
        source: 'user' as const,
      };

      const result = MCPEnvironmentVarSchema.parse(apiKeyVar);

      expect(result.name).toBe('OPENAI_API_KEY');
      expect(result.description).toBe('OpenAI API key for GPT model access');
      expect(result.required).toBe(true);
      expect(result.sensitive).toBe(true);
      expect(result.source).toBe('user');
    });

    it('should handle database connection configuration', () => {
      const dbVar = {
        name: 'DATABASE_URL',
        description: 'PostgreSQL database connection string',
        required: true,
        sensitive: true,
        defaultValue: 'postgresql://localhost:5432/mydb',
        source: 'config' as const,
      };

      const result = MCPEnvironmentVarSchema.parse(dbVar);

      expect(result.name).toBe('DATABASE_URL');
      expect(result.description).toBe('PostgreSQL database connection string');
      expect(result.required).toBe(true);
      expect(result.sensitive).toBe(true);
      expect(result.defaultValue).toBe('postgresql://localhost:5432/mydb');
      expect(result.source).toBe('config');
    });

    it('should handle application mode configuration', () => {
      const modeVar = {
        name: 'NODE_ENV',
        description: 'Node.js application environment mode',
        required: false,
        sensitive: false,
        defaultValue: 'development',
        source: 'env' as const,
      };

      const result = MCPEnvironmentVarSchema.parse(modeVar);

      expect(result.name).toBe('NODE_ENV');
      expect(result.description).toBe('Node.js application environment mode');
      expect(result.required).toBe(false);
      expect(result.sensitive).toBe(false);
      expect(result.defaultValue).toBe('development');
      expect(result.source).toBe('env');
    });

    it('should handle logging level configuration', () => {
      const logVar = {
        name: 'LOG_LEVEL',
        description: 'Application logging verbosity level',
        required: false,
        sensitive: false,
        defaultValue: 'info',
        source: 'default' as const,
      };

      const result = MCPEnvironmentVarSchema.parse(logVar);

      expect(result.name).toBe('LOG_LEVEL');
      expect(result.description).toBe('Application logging verbosity level');
      expect(result.required).toBe(false);
      expect(result.sensitive).toBe(false);
      expect(result.defaultValue).toBe('info');
      expect(result.source).toBe('default');
    });

    it('should handle port configuration', () => {
      const portVar = {
        name: 'PORT',
        description: 'HTTP server port number',
        required: false,
        sensitive: false,
        defaultValue: '3000',
        source: 'env' as const,
      };

      const result = MCPEnvironmentVarSchema.parse(portVar);

      expect(result.name).toBe('PORT');
      expect(result.description).toBe('HTTP server port number');
      expect(result.required).toBe(false);
      expect(result.sensitive).toBe(false);
      expect(result.defaultValue).toBe('3000');
      expect(result.source).toBe('env');
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle very long environment variable names', () => {
      const longName = 'VERY_LONG_ENVIRONMENT_VARIABLE_NAME_THAT_EXCEEDS_NORMAL_LENGTH_'.repeat(5);

      const envVar = {
        name: longName,
        description: 'Testing very long variable names',
      };

      const result = MCPEnvironmentVarSchema.parse(envVar);
      expect(result.name).toBe(longName);
    });

    it('should handle very long descriptions', () => {
      const longDescription = 'This is a very long description that describes the purpose and usage of this environment variable in great detail. '.repeat(10);

      const envVar = {
        name: 'LONG_DESC_VAR',
        description: longDescription,
      };

      const result = MCPEnvironmentVarSchema.parse(envVar);
      expect(result.description).toBe(longDescription);
    });

    it('should handle special characters in names', () => {
      const specialNames = [
        'VAR_WITH_NUMBERS_123',
        'VAR_WITH_UNDERSCORE_',
        '_STARTING_WITH_UNDERSCORE',
        'VAR123_456_789',
        'X',
        'A_B_C_D_E_F_G_H_I_J_K_L_M_N_O_P_Q_R_S_T_U_V_W_X_Y_Z',
      ];

      specialNames.forEach(name => {
        const envVar = { name };
        expect(() => MCPEnvironmentVarSchema.parse(envVar)).not.toThrow();
        const result = MCPEnvironmentVarSchema.parse(envVar);
        expect(result.name).toBe(name);
      });
    });

    it('should handle Unicode characters in descriptions', () => {
      const unicodeDescriptions = [
        'Description with emoji 🚀🔧⚡',
        'Описание на русском языке',
        '中文描述',
        '한국어 설명',
        'Description with mixed characters: тест 中文 🌟',
      ];

      unicodeDescriptions.forEach(description => {
        const envVar = {
          name: 'UNICODE_TEST',
          description,
        };
        expect(() => MCPEnvironmentVarSchema.parse(envVar)).not.toThrow();
        const result = MCPEnvironmentVarSchema.parse(envVar);
        expect(result.description).toBe(description);
      });
    });

    it('should handle empty string default values', () => {
      const envVar = {
        name: 'EMPTY_DEFAULT_VAR',
        defaultValue: '',
      };

      const result = MCPEnvironmentVarSchema.parse(envVar);
      expect(result.defaultValue).toBe('');
    });

    it('should handle whitespace-only descriptions', () => {
      const whitespaceDescriptions = [
        ' ',
        '   ',
        '\t',
        '\n',
        '\r\n',
        '  \t  \n  ',
      ];

      whitespaceDescriptions.forEach(description => {
        const envVar = {
          name: 'WHITESPACE_TEST',
          description,
        };
        expect(() => MCPEnvironmentVarSchema.parse(envVar)).not.toThrow();
        const result = MCPEnvironmentVarSchema.parse(envVar);
        expect(result.description).toBe(description);
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should work in array configurations for MCP servers', () => {
      const envVars = [
        {
          name: 'API_KEY',
          description: 'Primary API key',
          required: true,
          sensitive: true,
        },
        {
          name: 'API_URL',
          description: 'API endpoint URL',
          required: true,
          sensitive: false,
          defaultValue: 'https://api.example.com',
        },
        {
          name: 'TIMEOUT_MS',
          description: 'Request timeout in milliseconds',
          required: false,
          sensitive: false,
          defaultValue: '30000',
          source: 'config' as const,
        },
      ];

      envVars.forEach(envVar => {
        expect(() => MCPEnvironmentVarSchema.parse(envVar)).not.toThrow();
        const result = MCPEnvironmentVarSchema.parse(envVar);
        expect(result.name).toBe(envVar.name);
        expect(result.description).toBe(envVar.description);
        expect(result.required).toBe(envVar.required);
        expect(result.sensitive).toBe(envVar.sensitive);
      });
    });

    it('should maintain data integrity through multiple parsing cycles', () => {
      const originalVar = {
        name: 'CYCLE_TEST_VAR',
        description: 'Testing parsing cycles',
        required: true,
        sensitive: false,
        defaultValue: 'cycle-test',
        source: 'user' as const,
      };

      // Parse multiple times to ensure consistency
      let currentVar = originalVar;
      for (let i = 0; i < 5; i++) {
        const parsed = MCPEnvironmentVarSchema.parse(currentVar);
        expect(parsed).toEqual(originalVar);
        currentVar = parsed;
      }
    });

    it('should support deep object comparison', () => {
      const var1 = MCPEnvironmentVarSchema.parse({
        name: 'COMPARISON_VAR',
        description: 'For comparison test',
        required: true,
        sensitive: false,
        defaultValue: 'test',
        source: 'config',
      });

      const var2 = MCPEnvironmentVarSchema.parse({
        name: 'COMPARISON_VAR',
        description: 'For comparison test',
        required: true,
        sensitive: false,
        defaultValue: 'test',
        source: 'config',
      });

      expect(var1).toEqual(var2);
    });
  });
});
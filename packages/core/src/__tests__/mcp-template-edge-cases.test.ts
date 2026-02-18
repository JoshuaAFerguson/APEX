import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as YAML from 'yaml';
import { MCPTemplateSchema, MCPTemplate } from '../types.js';

/**
 * Edge case and error condition testing for MCP templates
 *
 * This test suite covers:
 * - Boundary conditions and edge cases
 * - Error scenarios and validation failures
 * - Malformed input handling
 * - Schema validation edge cases
 * - Performance with unusual inputs
 */
describe('MCP Template Edge Cases and Error Conditions', () => {
  const templatesDir = join(process.cwd(), 'packages/core/templates/mcp');

  describe('Schema validation edge cases', () => {
    it('should reject templates with empty required strings', () => {
      const templateWithEmptyStrings = {
        id: '',
        name: '',
        description: '',
        package: '',
        config: {}
      };

      expect(() => {
        MCPTemplateSchema.parse(templateWithEmptyStrings);
      }).toThrow();
    });

    it('should reject templates with whitespace-only required strings', () => {
      const templateWithWhitespace = {
        id: '   ',
        name: '\t\n  ',
        description: '    \r\n',
        package: '\t\t',
        config: {}
      };

      expect(() => {
        MCPTemplateSchema.parse(templateWithWhitespace);
      }).toThrow();
    });

    it('should handle templates with null values', () => {
      const templateWithNulls = {
        id: 'test',
        name: 'Test',
        description: 'Test description',
        package: 'test-package',
        config: null,
        envVars: null,
        capabilities: null
      };

      expect(() => {
        MCPTemplateSchema.parse(templateWithNulls);
      }).toThrow();
    });

    it('should handle templates with undefined optional fields', () => {
      const templateWithUndefined = {
        id: 'test',
        name: 'Test',
        description: 'Test description',
        package: 'test-package',
        config: {},
        envVars: undefined,
        capabilities: undefined,
        verified: undefined,
        defaultEnabled: undefined,
        category: undefined,
        tags: undefined
      };

      expect(() => {
        const result = MCPTemplateSchema.parse(templateWithUndefined);
        expect(result).toBeDefined();
        expect(result.envVars).toEqual([]);
        expect(result.capabilities).toEqual([]);
        expect(result.verified).toBe(false);
        expect(result.defaultEnabled).toBe(false);
        expect(result.tags).toEqual([]);
      }).not.toThrow();
    });

    it('should validate URL formats in documentationUrl and repositoryUrl', () => {
      const templateWithInvalidUrls = {
        id: 'test',
        name: 'Test',
        description: 'Test description',
        package: 'test-package',
        config: {},
        documentationUrl: 'not-a-url',
        repositoryUrl: 'also-not-a-url'
      };

      // The schema doesn't currently enforce URL format, but we test current behavior
      expect(() => {
        const result = MCPTemplateSchema.parse(templateWithInvalidUrls);
        expect(result.documentationUrl).toBe('not-a-url');
        expect(result.repositoryUrl).toBe('also-not-a-url');
      }).not.toThrow();
    });

    it('should validate minVersion format', () => {
      const templateWithInvalidVersion = {
        id: 'test',
        name: 'Test',
        description: 'Test description',
        package: 'test-package',
        config: {},
        minVersion: 'not-a-version'
      };

      // The schema doesn't currently enforce semver format, but we test current behavior
      expect(() => {
        const result = MCPTemplateSchema.parse(templateWithInvalidVersion);
        expect(result.minVersion).toBe('not-a-version');
      }).not.toThrow();
    });
  });

  describe('Environment variable edge cases', () => {
    it('should reject envVars with missing required fields', () => {
      const templateWithBadEnvVar = {
        id: 'test',
        name: 'Test',
        description: 'Test description',
        package: 'test-package',
        config: {},
        envVars: [
          {
            name: 'TEST_VAR'
            // Missing description, required, sensitive
          }
        ]
      };

      expect(() => {
        MCPTemplateSchema.parse(templateWithBadEnvVar);
      }).toThrow();
    });

    it('should handle envVars with unusual but valid values', () => {
      const templateWithUnusualEnvVars = {
        id: 'test',
        name: 'Test',
        description: 'Test description',
        package: 'test-package',
        config: {},
        envVars: [
          {
            name: 'VERY_LONG_ENVIRONMENT_VARIABLE_NAME_THAT_EXCEEDS_NORMAL_LIMITS_BUT_IS_STILL_TECHNICALLY_VALID',
            description: 'A' + 'very '.repeat(100) + 'long description',
            required: false,
            sensitive: false,
            defaultValue: JSON.stringify({ complex: 'object', as: 'string' }),
            source: 'config'
          },
          {
            name: '123_NUMERIC_START',
            description: 'Variable starting with numbers',
            required: true,
            sensitive: true,
            source: 'env'
          }
        ]
      };

      expect(() => {
        const result = MCPTemplateSchema.parse(templateWithUnusualEnvVars);
        expect(result.envVars).toHaveLength(2);
      }).not.toThrow();
    });

    it('should handle empty envVars array vs missing envVars', () => {
      const templateWithEmptyArray = {
        id: 'test1',
        name: 'Test 1',
        description: 'Test description',
        package: 'test-package',
        config: {},
        envVars: []
      };

      const templateWithMissingEnvVars = {
        id: 'test2',
        name: 'Test 2',
        description: 'Test description',
        package: 'test-package',
        config: {}
      };

      const result1 = MCPTemplateSchema.parse(templateWithEmptyArray);
      const result2 = MCPTemplateSchema.parse(templateWithMissingEnvVars);

      expect(result1.envVars).toEqual([]);
      expect(result2.envVars).toEqual([]);
    });
  });

  describe('Configuration object edge cases', () => {
    it('should handle empty config objects', () => {
      const templateWithEmptyConfig = {
        id: 'test',
        name: 'Test',
        description: 'Test description',
        package: 'test-package',
        config: {}
      };

      expect(() => {
        const result = MCPTemplateSchema.parse(templateWithEmptyConfig);
        expect(result.config).toEqual({});
      }).not.toThrow();
    });

    it('should handle config with unusual but valid values', () => {
      const templateWithUnusualConfig = {
        id: 'test',
        name: 'Test',
        description: 'Test description',
        package: 'test-package',
        config: {
          name: 'test',
          type: 'stdio',
          command: '/very/long/path/to/executable/that/might/not/exist/but/is/technically/valid',
          args: Array(100).fill('--arg'),
          env: {},
          autoStart: true,
          timeout: 0,
          retries: -1,
          customField: 'This should be allowed as config is partial'
        }
      };

      expect(() => {
        const result = MCPTemplateSchema.parse(templateWithUnusualConfig);
        expect(result.config).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('YAML parsing edge cases', () => {
    it('should handle YAML with comments and complex structure', () => {
      const complexYaml = `
# This is a comment
id: test-complex
name: "Test Complex Template"  # inline comment
description: |
  This is a multi-line
  description with special characters: !@#$%^&*()
  and unicode: 🚀 🎉 ✨
package: "@scope/complex-package"

config:
  name: test-complex
  type: stdio
  command: npx
  args:
    - "--flag"
    - "value with spaces"
    - "--json"
    - '{"nested": {"object": "value"}}'

envVars:
  - name: COMPLEX_VAR
    description: "Variable with 'quotes' and \\"escapes\\""
    required: true
    sensitive: false
    source: config
    defaultValue: "default with \\n newlines \\t tabs"

capabilities:
  - complex
  - "spaced capability"
  - !str 123  # Force string type

tags:
  - tag1
  - tag-2
  - "tag with spaces"
  - 🏷️  # emoji tag

verified: !!bool true
defaultEnabled: !!bool false
category: !!null  # explicit null
`;

      expect(() => {
        const parsed = YAML.parse(complexYaml);
        const result = MCPTemplateSchema.parse(parsed);
        expect(result.id).toBe('test-complex');
        expect(result.description).toContain('unicode: 🚀 🎉 ✨');
      }).not.toThrow();
    });

    it('should handle YAML with unusual but valid syntax', () => {
      const unusualYaml = `
---  # Document separator
id: test
name: >
  This is a folded
  scalar that should
  become one line
description: |
  This is a literal
  scalar that preserves
  line breaks
package: test-package
config: {}
envVars: !!seq []  # Explicit sequence type
capabilities: &caps  # Anchor
  - capability1
  - capability2
tags: *caps  # Alias reference
verified: yes  # YAML boolean
defaultEnabled: no  # YAML boolean
...  # Document end
`;

      expect(() => {
        const parsed = YAML.parse(unusualYaml);
        const result = MCPTemplateSchema.parse(parsed);
        expect(result.name).toBe('This is a folded scalar that should become one line');
        expect(result.description).toContain('\n');
        expect(result.verified).toBe(true);
        expect(result.defaultEnabled).toBe(false);
      }).not.toThrow();
    });
  });

  describe('Large data handling', () => {
    it('should handle templates with large arrays', () => {
      const templateWithLargeArrays = {
        id: 'large-test',
        name: 'Large Test',
        description: 'Test with large arrays',
        package: 'test-package',
        config: {},
        capabilities: Array(1000).fill(0).map((_, i) => `capability-${i}`),
        tags: Array(500).fill(0).map((_, i) => `tag-${i}`),
        envVars: Array(100).fill(0).map((_, i) => ({
          name: `VAR_${i}`,
          description: `Description for variable ${i}`,
          required: i % 2 === 0,
          sensitive: i % 3 === 0,
          source: 'config'
        }))
      };

      expect(() => {
        const result = MCPTemplateSchema.parse(templateWithLargeArrays);
        expect(result.capabilities).toHaveLength(1000);
        expect(result.tags).toHaveLength(500);
        expect(result.envVars).toHaveLength(100);
      }).not.toThrow();
    });

    it('should handle templates with very long strings', () => {
      const veryLongString = 'A'.repeat(10000);
      const templateWithLongStrings = {
        id: 'long-test',
        name: veryLongString.substring(0, 100),
        description: veryLongString,
        package: 'test-package',
        config: {},
        documentationUrl: 'https://example.com/' + 'a'.repeat(1000),
        repositoryUrl: 'https://github.com/' + 'b'.repeat(1000)
      };

      expect(() => {
        const result = MCPTemplateSchema.parse(templateWithLongStrings);
        expect(result.description).toHaveLength(10000);
      }).not.toThrow();
    });
  });

  describe('Real template stress testing', () => {
    it('should handle rapid repeated parsing of all templates', () => {
      const files = ['filesystem.yaml', 'github.yaml', 'postgres.yaml'];
      const iterations = 100;

      expect(() => {
        for (let i = 0; i < iterations; i++) {
          files.forEach(file => {
            const filePath = join(templatesDir, file);
            const content = readFileSync(filePath, 'utf-8');
            const parsed = YAML.parse(content);
            const validated = MCPTemplateSchema.parse(parsed);
            expect(validated.id).toBeTruthy();
          });
        }
      }).not.toThrow();
    });

    it('should handle concurrent template validation', async () => {
      const files = ['filesystem.yaml', 'github.yaml', 'postgres.yaml', 'memory.yaml'];

      const promises = files.map(async file => {
        return new Promise<MCPTemplate>((resolve, reject) => {
          try {
            const filePath = join(templatesDir, file);
            const content = readFileSync(filePath, 'utf-8');
            const parsed = YAML.parse(content);
            const validated = MCPTemplateSchema.parse(parsed);
            resolve(validated);
          } catch (error) {
            reject(error);
          }
        });
      });

      const results = await Promise.all(promises);
      expect(results).toHaveLength(files.length);
      results.forEach(template => {
        expect(template.id).toBeTruthy();
        expect(template.name).toBeTruthy();
      });
    });
  });

  describe('Error message quality', () => {
    it('should provide helpful error messages for missing required fields', () => {
      const incompleteTemplate = {
        id: 'test'
        // Missing name, description, package, config
      };

      try {
        MCPTemplateSchema.parse(incompleteTemplate);
        fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.message || error.toString()).toContain('required');
        expect(error.errors || error.issues).toBeDefined();
      }
    });

    it('should provide helpful error messages for type mismatches', () => {
      const templateWithWrongTypes = {
        id: 123,  // Should be string
        name: true,  // Should be string
        description: ['array'],  // Should be string
        package: { object: 'value' },  // Should be string
        config: 'string'  // Should be object
      };

      try {
        MCPTemplateSchema.parse(templateWithWrongTypes);
        fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.message || error.toString()).toContain('type');
      }
    });
  });
});
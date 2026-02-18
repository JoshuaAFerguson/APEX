import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { z } from 'zod';
import {
  ToolDefinitionSchema,
  ToolParametersSchemaSchema,
  ToolParameterSchema,
  ToolExampleSchema,
  AgentToolSchema,
  ToolAliasSchema,
  type ToolDefinition,
  type ToolParameter,
  type ToolAlias,
} from '../types.js';
import { loadToolAliases } from '../config.js';

describe('Tool Loading and Schema Validation', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-test-'));
    const apexDir = path.join(testDir, '.apex');
    const toolsDir = path.join(apexDir, 'tools');
    await fs.mkdir(apexDir, { recursive: true });
    await fs.mkdir(toolsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Loading Valid Tool Definitions', () => {
    it('should load a minimal valid tool definition from YAML', async () => {
      const toolPath = path.join(testDir, '.apex', 'tools', 'valid-tool.yaml');
      await fs.writeFile(toolPath, `
name: ValidTool
tool: Read
description: A valid tool for testing
`);

      const aliases = await loadToolAliases(testDir);
      expect(aliases['ValidTool']).toBeDefined();
      expect(aliases['ValidTool'].name).toBe('ValidTool');
      expect(aliases['ValidTool'].description).toBe('A valid tool for testing');
      expect(aliases['ValidTool'].tool).toBe('Read');
    });

    it('should load a complete tool definition with all optional fields from YAML', async () => {
      const toolPath = path.join(testDir, '.apex', 'tools', 'complete-tool.yaml');
      await fs.writeFile(toolPath, `
name: CompleteTool
tool: Bash
description: A complete tool with all fields
timeout: 30000
requireConfirmation: true
enabled: true
tags:
  - testing
  - automation
defaults:
  timeout: 5000
  workingDir: /tmp
parameters:
  command:
    description: Command to execute
    default: echo "hello"
parameterTemplates:
  quick_grep: "grep -r {{pattern}} {{path}}"
`);

      const aliases = await loadToolAliases(testDir);
      const tool = aliases['CompleteTool'];

      expect(tool).toBeDefined();
      expect(tool.name).toBe('CompleteTool');
      expect(tool.description).toBe('A complete tool with all fields');
      expect(tool.tool).toBe('Bash');
      expect(tool.timeout).toBe(30000);
      expect(tool.requireConfirmation).toBe(true);
      expect(tool.enabled).toBe(true);
      expect(tool.tags).toEqual(['testing', 'automation']);
      expect(tool.defaults).toEqual({ timeout: 5000, workingDir: '/tmp' });
      expect(tool.parameters).toBeDefined();
      expect(tool.parameterTemplates).toEqual({ quick_grep: "grep -r {{pattern}} {{path}}" });
    });

    it('should load multiple tool definitions from different files', async () => {
      // First tool
      await fs.writeFile(path.join(testDir, '.apex', 'tools', 'tool1.yaml'), `
name: Tool1
tool: Read
description: First tool
`);

      // Second tool
      await fs.writeFile(path.join(testDir, '.apex', 'tools', 'tool2.yml'), `
name: Tool2
tool: Write
description: Second tool
`);

      const aliases = await loadToolAliases(testDir);

      expect(Object.keys(aliases)).toHaveLength(2);
      expect(aliases['Tool1']).toBeDefined();
      expect(aliases['Tool2']).toBeDefined();
      expect(aliases['Tool1'].tool).toBe('Read');
      expect(aliases['Tool2'].tool).toBe('Write');
    });

    it('should handle tools with different base tool types', async () => {
      const tools = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebFetch', 'WebSearch'];

      for (let i = 0; i < tools.length; i++) {
        const tool = tools[i];
        await fs.writeFile(path.join(testDir, '.apex', 'tools', `alias-${tool.toLowerCase()}.yaml`), `
name: Alias${i + 1}
tool: ${tool}
description: Tool alias for ${tool}
`);
      }

      const aliases = await loadToolAliases(testDir);

      expect(Object.keys(aliases)).toHaveLength(tools.length);
      tools.forEach((tool, i) => {
        const aliasName = `Alias${i + 1}`;
        expect(aliases[aliasName].tool).toBe(tool);
      });
    });
  });

  describe('Rejecting Invalid Tool Schemas', () => {
    it('should reject tool definition with missing required fields', async () => {
      const toolPath = path.join(testDir, '.apex', 'tools', 'invalid-tool.yaml');

      // Missing required 'name' field
      await fs.writeFile(toolPath, `
tool: Read
description: A tool missing name
`);

      await expect(loadToolAliases(testDir)).rejects.toThrow();
    });

    it('should reject tool definition with empty name', async () => {
      const toolPath = path.join(testDir, '.apex', 'tools', 'empty-name.yaml');
      await fs.writeFile(toolPath, `
name: ""
tool: Read
description: A tool with empty name
`);

      await expect(loadToolAliases(testDir)).rejects.toThrow();
    });

    it('should reject tool definition with empty description', async () => {
      const toolPath = path.join(testDir, '.apex', 'tools', 'empty-desc.yaml');
      await fs.writeFile(toolPath, `
name: TestTool
tool: Read
description: ""
`);

      await expect(loadToolAliases(testDir)).rejects.toThrow();
    });

    it('should reject tool definition with invalid tool reference', async () => {
      const toolPath = path.join(testDir, '.apex', 'tools', 'invalid-tool-ref.yaml');
      await fs.writeFile(toolPath, `
name: TestTool
tool: InvalidToolName
description: A tool with invalid tool reference
`);

      await expect(loadToolAliases(testDir)).rejects.toThrow();
    });

    it('should reject tool definition with negative timeout', async () => {
      const toolPath = path.join(testDir, '.apex', 'tools', 'negative-timeout.yaml');
      await fs.writeFile(toolPath, `
name: TestTool
tool: Read
description: A tool with negative timeout
timeout: -1000
`);

      await expect(loadToolAliases(testDir)).rejects.toThrow();
    });

    it('should reject tool definition with invalid data types', async () => {
      const toolPath = path.join(testDir, '.apex', 'tools', 'invalid-types.yaml');
      await fs.writeFile(toolPath, `
name: TestTool
tool: Read
description: A tool with invalid types
requireConfirmation: "not-a-boolean"
enabled: "also-not-a-boolean"
timeout: "not-a-number"
`);

      await expect(loadToolAliases(testDir)).rejects.toThrow();
    });
  });

  describe('Validating Tool Input/Output Schemas with Zod', () => {
    it('should validate ToolDefinitionSchema with valid data', () => {
      const validDefinition: ToolDefinition = {
        name: 'ValidTool',
        description: 'A valid tool definition',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'Input parameter' }
          },
          required: ['input']
        },
        category: 'custom'
      };

      const result = ToolDefinitionSchema.parse(validDefinition);
      expect(result.name).toBe('ValidTool');
      expect(result.dangerous).toBe(false); // default value
      expect(result.enabled).toBe(true); // default value
    });

    it('should validate ToolParametersSchemaSchema with complex nested objects', () => {
      const complexSchema = {
        type: 'object' as const,
        properties: {
          config: {
            type: 'object' as const,
            properties: {
              mode: { type: 'string' as const, enum: ['fast', 'slow'] },
              settings: {
                type: 'object' as const,
                properties: {
                  timeout: { type: 'number' as const, minimum: 0 },
                  retries: { type: 'integer' as const, minimum: 1, maximum: 10 }
                }
              }
            }
          },
          data: {
            type: 'array' as const,
            items: {
              type: 'object' as const,
              properties: {
                id: { type: 'integer' as const },
                value: { type: 'string' as const }
              }
            }
          }
        },
        required: ['config']
      };

      const result = ToolParametersSchemaSchema.parse(complexSchema);
      expect(result.type).toBe('object');
      expect(result.properties!.config.properties!.settings.properties!.timeout.minimum).toBe(0);
      expect(result.required).toContain('config');
    });

    it('should validate ToolExampleSchema with input and output', () => {
      const validExample = {
        name: 'Test Example',
        description: 'An example usage',
        input: {
          config: { mode: 'fast' },
          data: [{ id: 1, value: 'test' }]
        },
        output: {
          success: true,
          processed: 1,
          results: ['processed data']
        }
      };

      const result = ToolExampleSchema.parse(validExample);
      expect(result.name).toBe('Test Example');
      expect(result.input.config.mode).toBe('fast');
      expect(result.output.success).toBe(true);
    });

    it('should validate AgentToolSchema with all supported tools', () => {
      const supportedTools = [
        'Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit',
        'Bash', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'TodoWrite'
      ];

      supportedTools.forEach(tool => {
        const result = AgentToolSchema.parse(tool);
        expect(result).toBe(tool);
      });
    });

    it('should reject invalid agent tool names', () => {
      const invalidTools = ['InvalidTool', 'CustomTool', 'SomethingElse'];

      invalidTools.forEach(tool => {
        expect(() => AgentToolSchema.parse(tool)).toThrow();
      });
    });
  });

  describe('Handling Missing Required Fields', () => {
    it('should identify missing name field in ToolAlias', () => {
      expect(() => ToolAliasSchema.parse({
        tool: 'Read',
        description: 'Missing name'
      })).toThrow(/name/i);
    });

    it('should identify missing description field in ToolAlias', () => {
      expect(() => ToolAliasSchema.parse({
        name: 'TestTool',
        tool: 'Read'
      })).toThrow(/description/i);
    });

    it('should identify missing tool field in ToolAlias', () => {
      expect(() => ToolAliasSchema.parse({
        name: 'TestTool',
        description: 'Missing tool reference'
      })).toThrow(/tool/i);
    });

    it('should identify missing parameters field in ToolDefinition', () => {
      expect(() => ToolDefinitionSchema.parse({
        name: 'TestTool',
        description: 'Missing parameters',
        category: 'custom'
      })).toThrow(/parameters/i);
    });

    it('should provide clear error messages for multiple missing fields', () => {
      try {
        ToolAliasSchema.parse({
          // Missing all required fields: name, tool, and description
        });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        if (error instanceof z.ZodError) {
          const issues = error.issues;
          expect(issues.length).toBeGreaterThan(1);

          const missingFields = issues.map(issue => issue.path[0]);
          expect(missingFields).toContain('name');
          expect(missingFields).toContain('tool');
          expect(missingFields).toContain('description');
        } else {
          throw error;
        }
      }
    });
  });

  describe('Handling Malformed YAML/JSON', () => {
    it('should handle malformed YAML syntax', async () => {
      const toolPath = path.join(testDir, '.apex', 'tools', 'malformed.yaml');
      await fs.writeFile(toolPath, `
name: TestTool
tool: Bash
description: "Unclosed quote
`);

      await expect(loadToolAliases(testDir)).rejects.toThrow();
    });

    it('should handle invalid YAML indentation', async () => {
      const toolPath = path.join(testDir, '.apex', 'tools', 'bad-indent.yaml');
      await fs.writeFile(toolPath, `
name: TestTool
tool: Bash
description: Tool with bad indentation
  timeout: 5000  # Wrong indentation level
`);

      await expect(loadToolAliases(testDir)).rejects.toThrow();
    });

    it('should handle YAML with invalid characters', async () => {
      const toolPath = path.join(testDir, '.apex', 'tools', 'invalid-chars.yaml');
      await fs.writeFile(toolPath, `
name: TestTool\0
tool: Bash
description: Tool with null character
`);

      await expect(loadToolAliases(testDir)).rejects.toThrow();
    });

    it('should handle empty YAML files', async () => {
      const toolPath = path.join(testDir, '.apex', 'tools', 'empty.yaml');
      await fs.writeFile(toolPath, '');

      await expect(loadToolAliases(testDir)).rejects.toThrow();
    });

    it('should handle YAML files with only comments', async () => {
      const toolPath = path.join(testDir, '.apex', 'tools', 'only-comments.yaml');
      await fs.writeFile(toolPath, `
# This is just a comment
# No actual content
`);

      await expect(loadToolAliases(testDir)).rejects.toThrow();
    });

    it('should handle YAML with unsupported data types', async () => {
      const toolPath = path.join(testDir, '.apex', 'tools', 'unsupported-types.yaml');
      await fs.writeFile(toolPath, `
name: TestTool
tool: Bash
description: Tool with unsupported types
someDate: 2023-01-01  # Date type might not be expected
someReference: &ref "reference"
useReference: *ref
`);

      // This should load successfully since YAML parsing might handle these,
      // but schema validation should catch any issues
      const aliases = await loadToolAliases(testDir);
      expect(aliases['TestTool']).toBeDefined();
    });

    it('should skip non-YAML files in tools directory', async () => {
      // Create a non-YAML file
      await fs.writeFile(path.join(testDir, '.apex', 'tools', 'not-a-tool.txt'), 'This is not YAML');

      // Create a valid YAML file
      await fs.writeFile(path.join(testDir, '.apex', 'tools', 'valid-tool.yaml'), `
name: ValidTool
tool: Bash
description: A valid tool
`);

      const aliases = await loadToolAliases(testDir);
      expect(Object.keys(aliases)).toHaveLength(1);
      expect(aliases['ValidTool']).toBeDefined();
    });

    it('should handle corrupted file data', async () => {
      const toolPath = path.join(testDir, '.apex', 'tools', 'corrupted.yaml');
      // Write binary data that's not valid text
      await fs.writeFile(toolPath, Buffer.from([0x00, 0xFF, 0x00, 0xFF]));

      await expect(loadToolAliases(testDir)).rejects.toThrow();
    });

    it('should handle extremely large YAML files gracefully', async () => {
      const toolPath = path.join(testDir, '.apex', 'tools', 'large.yaml');

      // Create a large but valid YAML structure
      const largeContent = `
name: LargeTool
tool: Bash
description: ${'A'.repeat(10000)}
env:`;

      // Add many environment variables
      let envVars = '';
      for (let i = 0; i < 1000; i++) {
        envVars += `\n  VAR_${i}: value_${i}`;
      }

      await fs.writeFile(toolPath, largeContent + envVars);

      // This should succeed but we might want to add size limits in the future
      const aliases = await loadToolAliases(testDir);
      expect(aliases['LargeTool']).toBeDefined();
      expect(aliases['LargeTool'].description.length).toBe(10000);
    });
  });

  describe('Schema Validation Edge Cases', () => {
    it('should validate tool definitions with optional fields set to undefined', () => {
      const definitionWithUndefined = {
        name: 'TestTool',
        description: 'A test tool',
        parameters: {
          type: 'object' as const,
          properties: {}
        },
        category: 'custom' as const,
        dangerous: undefined,
        permissions: undefined,
        examples: undefined
      };

      // Should parse successfully and apply defaults
      const result = ToolDefinitionSchema.parse(definitionWithUndefined);
      expect(result.dangerous).toBe(false);
      expect(result.permissions).toEqual([]);
    });

    it('should handle tools with very long but valid names', () => {
      const longName = 'A'.repeat(64); // Maximum allowed length
      const definition = {
        name: longName,
        description: 'Tool with maximum name length',
        parameters: {
          type: 'object' as const,
          properties: {}
        },
        category: 'custom' as const
      };

      const result = ToolDefinitionSchema.parse(definition);
      expect(result.name).toBe(longName);
    });

    it('should reject tools with names exceeding maximum length', () => {
      const tooLongName = 'A'.repeat(65); // One character over limit
      const definition = {
        name: tooLongName,
        description: 'Tool with name too long',
        parameters: {
          type: 'object' as const,
          properties: {}
        },
        category: 'custom' as const
      };

      expect(() => ToolDefinitionSchema.parse(definition)).toThrow();
    });

    it('should validate version strings with semantic versioning', () => {
      const validVersions = ['1.0.0', '2.1.3', '0.0.1', '10.20.30'];

      validVersions.forEach(version => {
        const definition = {
          name: 'TestTool',
          description: 'Tool with version',
          parameters: {
            type: 'object' as const,
            properties: {}
          },
          category: 'custom' as const,
          version
        };

        const result = ToolDefinitionSchema.parse(definition);
        expect(result.version).toBe(version);
      });
    });

    it('should reject invalid version formats', () => {
      const invalidVersions = ['v1.0.0', '1.0', 'latest', '1.0.0-beta', 'invalid'];

      invalidVersions.forEach(version => {
        const definition = {
          name: 'TestTool',
          description: 'Tool with invalid version',
          parameters: {
            type: 'object' as const,
            properties: {}
          },
          category: 'custom' as const,
          version
        };

        expect(() => ToolDefinitionSchema.parse(definition)).toThrow();
      });
    });
  });

  describe('Tool Loading Edge Cases', () => {
    it('should handle directory without .apex folder', async () => {
      const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-empty-'));
      try {
        const aliases = await loadToolAliases(emptyDir);
        expect(aliases).toEqual({});
      } finally {
        await fs.rm(emptyDir, { recursive: true, force: true });
      }
    });

    it('should handle empty tools directory', async () => {
      const aliases = await loadToolAliases(testDir);
      expect(aliases).toEqual({});
    });

    it('should handle permission-denied file access', async () => {
      const restrictedDir = path.join(testDir, '.apex', 'tools', 'restricted');
      await fs.mkdir(restrictedDir, { recursive: true });

      const toolPath = path.join(restrictedDir, 'restricted-tool.yaml');
      await fs.writeFile(toolPath, `
name: RestrictedTool
tool: Read
description: A tool in a restricted directory
`);

      // Try to change permissions (this may not work on all systems)
      try {
        await fs.chmod(restrictedDir, 0o000);

        // Should either succeed or throw an error, but not hang
        const startTime = Date.now();
        try {
          await loadToolAliases(testDir);
        } catch (error) {
          // Expected if permissions are properly restricted
        }
        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeLessThan(5000); // Should not hang

      } finally {
        // Restore permissions for cleanup
        await fs.chmod(restrictedDir, 0o755);
      }
    });

    it('should validate tool alias with all valid AgentTool types', async () => {
      const validTools = ['Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Bash', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'TodoWrite'];

      for (let i = 0; i < validTools.length; i++) {
        const tool = validTools[i];
        const toolPath = path.join(testDir, '.apex', 'tools', `valid-${tool.toLowerCase()}.yaml`);
        await fs.writeFile(toolPath, `
name: Valid${tool}Alias
tool: ${tool}
description: Valid alias for ${tool} tool
`);
      }

      const aliases = await loadToolAliases(testDir);
      expect(Object.keys(aliases)).toHaveLength(validTools.length);

      validTools.forEach(tool => {
        const aliasName = `Valid${tool}Alias`;
        expect(aliases[aliasName]).toBeDefined();
        expect(aliases[aliasName].tool).toBe(tool);
      });
    });

    it('should handle concurrent file operations gracefully', async () => {
      // Create multiple tool files simultaneously
      const createPromises = [];
      for (let i = 0; i < 10; i++) {
        const promise = fs.writeFile(path.join(testDir, '.apex', 'tools', `concurrent-${i}.yaml`), `
name: ConcurrentTool${i}
tool: Read
description: Concurrent tool ${i}
`);
        createPromises.push(promise);
      }

      await Promise.all(createPromises);

      // Load aliases should handle all files correctly
      const aliases = await loadToolAliases(testDir);
      expect(Object.keys(aliases)).toHaveLength(10);

      for (let i = 0; i < 10; i++) {
        expect(aliases[`ConcurrentTool${i}`]).toBeDefined();
      }
    });
  });

  describe('Schema Validation Performance', () => {
    it('should validate large numbers of tool aliases efficiently', async () => {
      const startTime = Date.now();

      // Create 100 tool aliases
      for (let i = 0; i < 100; i++) {
        const toolPath = path.join(testDir, '.apex', 'tools', `perf-tool-${i}.yaml`);
        await fs.writeFile(toolPath, `
name: PerfTool${i}
tool: Read
description: Performance test tool ${i}
timeout: ${1000 + i}
enabled: ${i % 2 === 0}
tags:
  - performance
  - test${i % 10}
`);
      }

      const aliases = await loadToolAliases(testDir);
      const elapsed = Date.now() - startTime;

      expect(Object.keys(aliases)).toHaveLength(100);
      expect(elapsed).toBeLessThan(10000); // Should complete within 10 seconds

      // Verify some random tools are correctly parsed
      expect(aliases['PerfTool0'].enabled).toBe(true);
      expect(aliases['PerfTool1'].enabled).toBe(false);
      expect(aliases['PerfTool50'].timeout).toBe(1050);
    });
  });
});
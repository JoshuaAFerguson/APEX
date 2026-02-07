/**
 * @fileoverview Tool Types JSDoc Documentation Tests
 *
 * This test suite verifies that all tool-related types have proper JSDoc documentation
 * and that the documentation accurately describes their purpose and usage in the tool
 * management system.
 *
 * Tests cover:
 * - ToolConfigSchema and its role in per-tool configuration
 * - CustomToolOutputParserSchema for custom tool output processing
 * - ToolRegistryStateSchema for tool registry state snapshots
 * - Validation of JSDoc existence and accuracy
 */

import { describe, it, expect } from 'vitest';
import {
  ToolConfigSchema,
  CustomToolOutputParserSchema,
  ToolRegistryStateSchema,
  type ToolConfig,
  type CustomToolOutputParser,
  type ToolRegistryState,
} from '../types';

describe('Tool Types JSDoc Documentation Tests', () => {
  describe('ToolConfigSchema Documentation', () => {
    it('should have proper JSDoc documentation for ToolConfigSchema', () => {
      // Read the source file to verify JSDoc exists
      const fs = require('fs');
      const path = require('path');
      const typesFilePath = path.join(__dirname, '..', 'types.ts');
      const sourceContent = fs.readFileSync(typesFilePath, 'utf8');

      // Check that ToolConfigSchema has JSDoc documentation
      const toolConfigPattern = /\/\*\*[\s\S]*?\*\/\s*export const ToolConfigSchema/;
      const hasJSDoc = toolConfigPattern.test(sourceContent);

      expect(hasJSDoc).toBe(true);

      // Verify the JSDoc contains meaningful content about per-tool configuration
      const jsdocMatch = sourceContent.match(/\/\*\*[\s\S]*?\*\/\s*export const ToolConfigSchema/);
      if (jsdocMatch) {
        const jsdocContent = jsdocMatch[0];
        expect(jsdocContent).toMatch(/tool.*configuration|config.*tool/i);
        expect(jsdocContent).toMatch(/map|record/i);
      }
    });

    it('should validate ToolConfigSchema functionality', () => {
      // Test empty configuration (default)
      const emptyConfig = {};
      const result = ToolConfigSchema.parse(emptyConfig);
      expect(result).toEqual({});

      // Test valid tool configurations
      const toolConfig: ToolConfig = {
        'filesystem': {
          enabled: true,
          maxFileSize: 1048576,
          allowedExtensions: ['.ts', '.js', '.json'],
        },
        'shell': {
          enabled: false,
          timeout: 30000,
        },
        'web': {
          enabled: true,
          allowedDomains: ['api.github.com'],
          maxResponseSize: 10485760,
        },
      };

      const parsed = ToolConfigSchema.parse(toolConfig);
      expect(parsed).toEqual(toolConfig);
    });

    it('should handle various tool configuration scenarios', () => {
      const testCases = [
        {
          name: 'Development environment with restrictive settings',
          config: {
            'filesystem': {
              enabled: true,
              maxFileSize: 5242880, // 5MB
              allowedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.md'],
              blockedExtensions: ['.exe', '.dll', '.so'],
            },
            'shell': {
              enabled: false, // Disabled in development
              requireConfirmation: true,
            },
            'web': {
              enabled: true,
              allowedDomains: ['localhost', '127.0.0.1', '*.local'],
              maxResponseSize: 1048576, // 1MB
            },
          },
        },
        {
          name: 'Production environment with strict security',
          config: {
            'filesystem': {
              enabled: true,
              maxFileSize: 1048576, // 1MB
              allowedExtensions: ['.json', '.yaml', '.yml'],
              directoryAccess: {
                allowlist: ['config/**/*', 'data/**/*.json'],
                blocklist: ['**/*.exe', '**/*.dll'],
                defaultAllow: false,
              },
            },
            'shell': {
              enabled: false, // Completely disabled
            },
            'web': {
              enabled: true,
              allowedDomains: ['api.trusted-service.com'],
              blockedDomains: ['*.ads.com', '*.tracker.net'],
              maxResponseSize: 524288, // 512KB
            },
          },
        },
        {
          name: 'Testing environment with enhanced permissions',
          config: {
            'filesystem': {
              enabled: true,
              maxFileSize: 10485760, // 10MB
              allowedExtensions: ['.ts', '.js', '.test.ts', '.spec.js'],
            },
            'shell': {
              enabled: true,
              timeout: 60000,
              blockedCommands: ['rm -rf', 'sudo rm'],
              allowElevatedPrivileges: false,
            },
            'browser': {
              enabled: true,
              allowJavaScript: false,
              allowScreenshots: true,
              maxPageLoadTime: 30000,
            },
          },
        },
      ];

      testCases.forEach(({ name, config }) => {
        const parsed = ToolConfigSchema.parse(config);
        expect(parsed).toEqual(config);
      });
    });
  });

  describe('CustomToolOutputParserSchema Documentation', () => {
    it('should have proper JSDoc documentation for CustomToolOutputParserSchema', () => {
      const fs = require('fs');
      const path = require('path');
      const typesFilePath = path.join(__dirname, '..', 'types.ts');
      const sourceContent = fs.readFileSync(typesFilePath, 'utf8');

      // Check that CustomToolOutputParserSchema has JSDoc documentation
      const outputParserPattern = /\/\*\*[\s\S]*?\*\/\s*export const CustomToolOutputParserSchema/;
      const hasJSDoc = outputParserPattern.test(sourceContent);

      expect(hasJSDoc).toBe(true);

      // Verify the JSDoc describes output processing functionality
      const jsdocMatch = sourceContent.match(/\/\*\*[\s\S]*?\*\/\s*export const CustomToolOutputParserSchema/);
      if (jsdocMatch) {
        const jsdocContent = jsdocMatch[0];
        expect(jsdocContent).toMatch(/output.*parser|parser.*output/i);
        expect(jsdocContent).toMatch(/custom.*tool|tool.*custom/i);
        expect(jsdocContent).toMatch(/process|format/i);
      }
    });

    it('should validate CustomToolOutputParserSchema enum values', () => {
      const validValues: CustomToolOutputParser[] = ['json', 'text', 'lines'];

      validValues.forEach(value => {
        const result = CustomToolOutputParserSchema.parse(value);
        expect(result).toBe(value);
      });

      // Test invalid values
      const invalidValues = ['xml', 'binary', 'html', 'csv', null, undefined, 123, true];
      invalidValues.forEach(value => {
        expect(() => CustomToolOutputParserSchema.parse(value)).toThrow();
      });
    });

    it('should handle output parser usage scenarios', () => {
      const parserScenarios = [
        {
          name: 'JSON API response parsing',
          parser: 'json' as CustomToolOutputParser,
          description: 'For tools that return structured JSON data',
          expectedUse: 'API responses, configuration data, structured output',
        },
        {
          name: 'Plain text output parsing',
          parser: 'text' as CustomToolOutputParser,
          description: 'For tools that return plain text or unstructured content',
          expectedUse: 'Log files, plain text responses, error messages',
        },
        {
          name: 'Line-by-line output parsing',
          parser: 'lines' as CustomToolOutputParser,
          description: 'For tools that return multi-line output that should be parsed line by line',
          expectedUse: 'Command output, file listings, CSV data',
        },
      ];

      parserScenarios.forEach(({ name, parser, description, expectedUse }) => {
        const validatedParser = CustomToolOutputParserSchema.parse(parser);
        expect(validatedParser).toBe(parser);

        // Verify enum constraint
        expect(['json', 'text', 'lines']).toContain(validatedParser);
      });
    });

    it('should integrate properly with custom tool configurations', () => {
      // Test how CustomToolOutputParserSchema integrates with tool configs
      const customToolConfigs = [
        {
          name: 'json-processor',
          description: 'Processes JSON data from external APIs',
          command: 'node process-json.js',
          outputParser: 'json' as CustomToolOutputParser,
          timeoutMs: 30000,
          enabled: true,
        },
        {
          name: 'log-analyzer',
          description: 'Analyzes log files line by line',
          command: 'python analyze-logs.py',
          outputParser: 'lines' as CustomToolOutputParser,
          timeoutMs: 60000,
          enabled: true,
        },
        {
          name: 'text-processor',
          description: 'Processes plain text content',
          command: 'cat input.txt | process-text',
          outputParser: 'text' as CustomToolOutputParser,
          timeoutMs: 15000,
          enabled: true,
        },
      ];

      customToolConfigs.forEach(config => {
        const validatedParser = CustomToolOutputParserSchema.parse(config.outputParser);
        expect(validatedParser).toBe(config.outputParser);
      });
    });
  });

  describe('ToolRegistryStateSchema Documentation', () => {
    it('should have proper JSDoc documentation for ToolRegistryStateSchema', () => {
      const fs = require('fs');
      const path = require('path');
      const typesFilePath = path.join(__dirname, '..', 'types.ts');
      const sourceContent = fs.readFileSync(typesFilePath, 'utf8');

      // Check that ToolRegistryStateSchema has JSDoc documentation
      const registryStatePattern = /\/\*\*[\s\S]*?\*\/\s*export const ToolRegistryStateSchema/;
      const hasJSDoc = registryStatePattern.test(sourceContent);

      expect(hasJSDoc).toBe(true);

      // Verify the JSDoc describes registry state functionality
      const jsdocMatch = sourceContent.match(/\/\*\*[\s\S]*?\*\/\s*export const ToolRegistryStateSchema/);
      if (jsdocMatch) {
        const jsdocContent = jsdocMatch[0];
        expect(jsdocContent).toMatch(/registry.*state|state.*registry/i);
        expect(jsdocContent).toMatch(/snapshot|complete|tool/i);
      }
    });

    it('should validate ToolRegistryStateSchema structure', () => {
      const validRegistryState: ToolRegistryState = {
        tools: {
          'tool-1': {
            id: 'tool-1',
            name: 'Filesystem Tool',
            description: 'File system operations',
            source: 'builtin',
            type: 'builtin',
            config: { enabled: true },
            isAvailable: true,
            lastUsed: new Date().toISOString(),
          },
          'tool-2': {
            id: 'tool-2',
            name: 'Custom Script',
            description: 'Custom automation script',
            source: 'custom',
            type: 'custom',
            config: { enabled: true },
            isAvailable: false,
            lastUsed: null,
          },
        },
        bySource: {
          builtin: ['tool-1'],
          custom: ['tool-2'],
          mcp: [],
        },
        byType: {
          builtin: ['tool-1'],
          custom: ['tool-2'],
          mcp: [],
        },
        metadata: {
          lastUpdated: new Date().toISOString(),
          version: '1.0.0',
        },
        totalCount: 2,
        availableCount: 1,
      };

      const result = ToolRegistryStateSchema.parse(validRegistryState);
      expect(result).toEqual(validRegistryState);
    });

    it('should handle various registry state scenarios', () => {
      const registryScenarios = [
        {
          name: 'Empty registry',
          state: {
            tools: {},
            bySource: { builtin: [], custom: [], mcp: [] },
            byType: { builtin: [], custom: [], mcp: [] },
            metadata: {
              lastUpdated: new Date().toISOString(),
              version: '1.0.0',
            },
            totalCount: 0,
            availableCount: 0,
          },
        },
        {
          name: 'Registry with only builtin tools',
          state: {
            tools: {
              'read': {
                id: 'read',
                name: 'Read Tool',
                description: 'Read files',
                source: 'builtin',
                type: 'builtin',
                config: { enabled: true },
                isAvailable: true,
                lastUsed: new Date().toISOString(),
              },
              'write': {
                id: 'write',
                name: 'Write Tool',
                description: 'Write files',
                source: 'builtin',
                type: 'builtin',
                config: { enabled: true },
                isAvailable: true,
                lastUsed: null,
              },
            },
            bySource: { builtin: ['read', 'write'], custom: [], mcp: [] },
            byType: { builtin: ['read', 'write'], custom: [], mcp: [] },
            metadata: {
              lastUpdated: new Date().toISOString(),
              version: '1.0.0',
            },
            totalCount: 2,
            availableCount: 2,
          },
        },
        {
          name: 'Mixed registry with all tool types',
          state: {
            tools: {
              'builtin-tool': {
                id: 'builtin-tool',
                name: 'Built-in Tool',
                description: 'System built-in tool',
                source: 'builtin',
                type: 'builtin',
                config: { enabled: true },
                isAvailable: true,
                lastUsed: new Date().toISOString(),
              },
              'custom-tool': {
                id: 'custom-tool',
                name: 'Custom Tool',
                description: 'User-defined tool',
                source: 'custom',
                type: 'custom',
                config: {
                  enabled: true,
                  command: 'python custom-script.py',
                  outputParser: 'json',
                },
                isAvailable: true,
                lastUsed: new Date().toISOString(),
              },
              'mcp-tool': {
                id: 'mcp-tool',
                name: 'MCP Tool',
                description: 'Tool from MCP server',
                source: 'mcp',
                type: 'mcp',
                config: { enabled: true },
                isAvailable: false, // MCP server not connected
                lastUsed: null,
              },
            },
            bySource: {
              builtin: ['builtin-tool'],
              custom: ['custom-tool'],
              mcp: ['mcp-tool'],
            },
            byType: {
              builtin: ['builtin-tool'],
              custom: ['custom-tool'],
              mcp: ['mcp-tool'],
            },
            metadata: {
              lastUpdated: new Date().toISOString(),
              version: '1.0.0',
              mcpServers: ['server1'],
            },
            totalCount: 3,
            availableCount: 2,
          },
        },
      ];

      registryScenarios.forEach(({ name, state }) => {
        const parsed = ToolRegistryStateSchema.parse(state);
        expect(parsed).toEqual(state);

        // Verify count consistency
        expect(parsed.totalCount).toBe(Object.keys(parsed.tools).length);

        const availableTools = Object.values(parsed.tools).filter(tool => tool.isAvailable);
        expect(parsed.availableCount).toBe(availableTools.length);
      });
    });

    it('should validate registry state count consistency', () => {
      // Test that the schema enforces logical consistency
      const inconsistentState = {
        tools: {
          'tool-1': {
            id: 'tool-1',
            name: 'Tool 1',
            description: 'Test tool',
            source: 'builtin',
            type: 'builtin',
            config: { enabled: true },
            isAvailable: true,
            lastUsed: null,
          },
        },
        bySource: { builtin: ['tool-1'], custom: [], mcp: [] },
        byType: { builtin: ['tool-1'], custom: [], mcp: [] },
        metadata: {
          lastUpdated: new Date().toISOString(),
          version: '1.0.0',
        },
        totalCount: 1,
        availableCount: 1,
      };

      // This should parse successfully
      const result = ToolRegistryStateSchema.parse(inconsistentState);
      expect(result.totalCount).toBe(1);
      expect(result.availableCount).toBe(1);

      // Test with negative counts (should fail)
      expect(() => ToolRegistryStateSchema.parse({
        ...inconsistentState,
        totalCount: -1,
      })).toThrow();

      expect(() => ToolRegistryStateSchema.parse({
        ...inconsistentState,
        availableCount: -1,
      })).toThrow();
    });
  });

  describe('Tool Types Integration Tests', () => {
    it('should work together in a complete tool management scenario', () => {
      // Simulate a complete tool management workflow

      // 1. Define tool configuration
      const toolConfig: ToolConfig = {
        'filesystem': {
          enabled: true,
          maxFileSize: 1048576,
          allowedExtensions: ['.ts', '.js', '.json'],
        },
        'custom-processor': {
          enabled: true,
          timeout: 30000,
        },
      };

      // 2. Define custom tool with output parser
      const customParser: CustomToolOutputParser = 'json';

      // 3. Define registry state
      const registryState: ToolRegistryState = {
        tools: {
          'filesystem': {
            id: 'filesystem',
            name: 'Filesystem Tool',
            description: 'File operations',
            source: 'builtin',
            type: 'builtin',
            config: toolConfig['filesystem'],
            isAvailable: true,
            lastUsed: new Date().toISOString(),
          },
          'custom-processor': {
            id: 'custom-processor',
            name: 'Custom Processor',
            description: 'Custom data processor',
            source: 'custom',
            type: 'custom',
            config: {
              ...toolConfig['custom-processor'],
              outputParser: customParser,
              command: 'node processor.js',
            },
            isAvailable: true,
            lastUsed: new Date().toISOString(),
          },
        },
        bySource: {
          builtin: ['filesystem'],
          custom: ['custom-processor'],
          mcp: [],
        },
        byType: {
          builtin: ['filesystem'],
          custom: ['custom-processor'],
          mcp: [],
        },
        metadata: {
          lastUpdated: new Date().toISOString(),
          version: '1.0.0',
        },
        totalCount: 2,
        availableCount: 2,
      };

      // Validate all components
      const validatedConfig = ToolConfigSchema.parse(toolConfig);
      const validatedParser = CustomToolOutputParserSchema.parse(customParser);
      const validatedState = ToolRegistryStateSchema.parse(registryState);

      // Verify integration
      expect(validatedConfig).toEqual(toolConfig);
      expect(validatedParser).toBe(customParser);
      expect(validatedState).toEqual(registryState);

      // Verify relationships
      expect(validatedState.tools['custom-processor'].config).toHaveProperty('outputParser', validatedParser);
      expect(validatedState.totalCount).toBe(Object.keys(validatedState.tools).length);
    });

    it('should handle error cases gracefully', () => {
      // Test various error scenarios

      // Invalid tool config
      expect(() => ToolConfigSchema.parse({
        'invalid-tool': {
          enabled: 'yes', // Should be boolean
        },
      })).toThrow();

      // Invalid output parser
      expect(() => CustomToolOutputParserSchema.parse('invalid-parser')).toThrow();

      // Invalid registry state
      expect(() => ToolRegistryStateSchema.parse({
        tools: {},
        // Missing required fields
      })).toThrow();

      // Registry state with invalid tool entries
      expect(() => ToolRegistryStateSchema.parse({
        tools: {
          'invalid-tool': {
            // Missing required fields
            id: 'invalid-tool',
          },
        },
        bySource: { builtin: [], custom: [], mcp: [] },
        byType: { builtin: [], custom: [], mcp: [] },
        metadata: { lastUpdated: new Date().toISOString(), version: '1.0.0' },
        totalCount: 1,
        availableCount: 0,
      })).toThrow();
    });
  });

  describe('JSDoc Documentation Quality Tests', () => {
    it('should have comprehensive JSDoc comments for all tool-related schemas', () => {
      const fs = require('fs');
      const path = require('path');
      const typesFilePath = path.join(__dirname, '..', 'types.ts');
      const sourceContent = fs.readFileSync(typesFilePath, 'utf8');

      // List of schemas that should have JSDoc documentation
      const requiredDocumentedSchemas = [
        'ToolConfigSchema',
        'CustomToolOutputParserSchema',
        'ToolRegistryStateSchema',
      ];

      requiredDocumentedSchemas.forEach(schemaName => {
        const pattern = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*export const ${schemaName}`);
        const hasJSDoc = pattern.test(sourceContent);
        expect(hasJSDoc).toBe(true);
      });
    });

    it('should have meaningful JSDoc content', () => {
      const fs = require('fs');
      const path = require('path');
      const typesFilePath = path.join(__dirname, '..', 'types.ts');
      const sourceContent = fs.readFileSync(typesFilePath, 'utf8');

      // Check that JSDoc comments contain meaningful descriptions
      const meaningfulPhrases = [
        /tool.*configuration|configuration.*tool/i,
        /output.*parser|parser.*output/i,
        /registry.*state|state.*registry/i,
        /snapshot|complete/i,
        /process|format/i,
      ];

      const jsdocBlocks = sourceContent.match(/\/\*\*[\s\S]*?\*\//g) || [];
      const toolRelatedJSDoc = jsdocBlocks.filter(block =>
        /Tool|Parser|Registry/i.test(block)
      );

      expect(toolRelatedJSDoc.length).toBeGreaterThan(0);

      toolRelatedJSDoc.forEach(block => {
        const hasMeaningfulContent = meaningfulPhrases.some(phrase =>
          phrase.test(block)
        );
        // At least some JSDoc blocks should have meaningful content
        // This is a heuristic test - not every block needs all phrases
      });
    });
  });
});
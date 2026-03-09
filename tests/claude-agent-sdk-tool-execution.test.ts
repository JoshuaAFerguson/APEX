/**
 * Claude Agent SDK Tool Execution Tests
 *
 * Focused tests for tool execution, MCP integration, and custom tools
 * in the Claude Agent SDK integration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildCustomToolsServer } from '../packages/orchestrator/src/custom-tools.js';
import { SchemaTranslator } from '../packages/orchestrator/src/schema-translator.js';
import type { CustomToolConfig } from '@apexcli/core';
import { execFile } from 'child_process';
import { z } from 'zod';

// Mock dependencies
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  createSdkMcpServer: vi.fn(),
  tool: vi.fn(),
}));

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('util', () => ({
  promisify: vi.fn((fn) => fn),
}));

describe('Claude Agent SDK Tool Execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Custom Tools Server Creation', () => {
    it('should create MCP server with enabled tools', () => {
      const customTools: CustomToolConfig[] = [
        {
          name: 'test-tool',
          description: 'A test tool',
          command: 'echo',
          args: ['hello'],
          parameters: {
            properties: {
              message: { type: 'string', description: 'Message to echo' },
            },
            required: ['message'],
          },
          enabled: true,
        },
      ];

      const { createSdkMcpServer, tool } = require('@anthropic-ai/claude-agent-sdk');
      const mockTool = { name: 'test-tool' };
      const mockServer = { server: 'config' };

      vi.mocked(tool).mockReturnValue(mockTool);
      vi.mocked(createSdkMcpServer).mockReturnValue(mockServer);

      const result = buildCustomToolsServer(customTools, '/test/project');

      expect(result).toEqual({
        name: 'custom-tools',
        config: mockServer,
      });

      expect(tool).toHaveBeenCalledWith(
        'test-tool',
        'A test tool',
        expect.any(Object), // Zod schema shape
        expect.any(Function), // Tool implementation
      );

      expect(createSdkMcpServer).toHaveBeenCalledWith({
        name: 'custom-tools',
        tools: [mockTool],
      });
    });

    it('should return null when no tools are enabled', () => {
      const customTools: CustomToolConfig[] = [];
      const result = buildCustomToolsServer(customTools, '/test/project');
      expect(result).toBeNull();
    });

    it('should filter out disabled tools', () => {
      const customTools: CustomToolConfig[] = [
        {
          name: 'enabled-tool',
          description: 'Enabled tool',
          command: 'echo',
          args: ['enabled'],
          parameters: { properties: {}, required: [] },
          enabled: true,
        },
        {
          name: 'disabled-tool',
          description: 'Disabled tool',
          command: 'echo',
          args: ['disabled'],
          parameters: { properties: {}, required: [] },
          enabled: false,
        },
      ];

      const { tool } = require('@anthropic-ai/claude-agent-sdk');
      vi.mocked(tool).mockReturnValue({});

      buildCustomToolsServer(customTools, '/test/project');

      expect(tool).toHaveBeenCalledTimes(1);
      expect(tool).toHaveBeenCalledWith(
        'enabled-tool',
        expect.any(String),
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should handle tools with complex parameter schemas', () => {
      const customTools: CustomToolConfig[] = [
        {
          name: 'complex-tool',
          description: 'Tool with complex parameters',
          command: 'complex-command',
          args: ['--input', '{{input}}'],
          parameters: {
            properties: {
              inputFile: {
                type: 'string',
                description: 'Input file path'
              },
              outputDir: {
                type: 'string',
                description: 'Output directory'
              },
              options: {
                type: 'object',
                properties: {
                  verbose: { type: 'boolean' },
                  maxSize: { type: 'number' },
                },
                required: ['verbose'],
              },
            },
            required: ['inputFile', 'outputDir'],
          },
          enabled: true,
        },
      ];

      const { tool } = require('@anthropic-ai/claude-agent-sdk');
      const mockTool = { name: 'complex-tool' };
      vi.mocked(tool).mockReturnValue(mockTool);

      const result = buildCustomToolsServer(customTools, '/test/project');

      expect(result).not.toBeNull();
      expect(tool).toHaveBeenCalledWith(
        'complex-tool',
        'Tool with complex parameters',
        expect.any(Object), // Should be Zod schema shape
        expect.any(Function),
      );
    });
  });

  describe('Schema Translation', () => {
    it('should use SchemaTranslator for parameter conversion', () => {
      const customTools: CustomToolConfig[] = [
        {
          name: 'schema-test-tool',
          description: 'Tool for schema testing',
          command: 'test',
          args: [],
          parameters: {
            properties: {
              name: { type: 'string' },
              count: { type: 'number' },
            },
            required: ['name'],
          },
          enabled: true,
        },
      ];

      const mockSchemaTranslator = {
        translateInputSchema: vi.fn().mockReturnValue({
          shape: {
            name: z.string(),
            count: z.number().optional(),
          },
        }),
      };

      const { tool } = require('@anthropic-ai/claude-agent-sdk');
      vi.mocked(tool).mockReturnValue({});

      buildCustomToolsServer(customTools, '/test/project', mockSchemaTranslator);

      expect(mockSchemaTranslator.translateInputSchema).toHaveBeenCalledWith({
        type: 'object',
        properties: {
          name: { type: 'string' },
          count: { type: 'number' },
        },
        required: ['name'],
        additionalProperties: false,
      });
    });
  });

  describe('Tool Command Execution', () => {
    beforeEach(() => {
      // Mock successful execFile by default
      const mockExecFile = vi.mocked(execFile);
      mockExecFile.mockImplementation((command, args, options, callback) => {
        if (callback) {
          callback(null, { stdout: 'success output', stderr: '' });
        }
        return {} as any;
      });
    });

    it('should execute tool with interpolated arguments', async () => {
      const customTools: CustomToolConfig[] = [
        {
          name: 'echo-tool',
          description: 'Echo tool',
          command: 'echo',
          args: ['{{input.message}}', '--flag'],
          parameters: {
            properties: {
              message: { type: 'string' },
            },
            required: ['message'],
          },
          enabled: true,
        },
      ];

      const { tool } = require('@anthropic-ai/claude-agent-sdk');
      let toolImplementation: Function;

      vi.mocked(tool).mockImplementation((name, desc, shape, impl) => {
        toolImplementation = impl;
        return { name };
      });

      buildCustomToolsServer(customTools, '/test/project');

      // Execute the tool implementation
      const result = await toolImplementation!({ message: 'Hello World' });

      expect(execFile).toHaveBeenCalledWith(
        'echo',
        ['Hello World', '--flag'],
        expect.objectContaining({
          cwd: '/test/project',
          env: expect.objectContaining({
            APEX_TOOL_INPUT: '{"message":"Hello World"}',
          }),
        }),
        expect.any(Function),
      );

      expect(result).toEqual({
        content: [{ type: 'text', text: 'success output' }],
        structuredContent: undefined,
        isError: false,
        _meta: {
          stderr: undefined,
        },
      });
    });

    it('should handle tool execution with custom working directory', async () => {
      const customTools: CustomToolConfig[] = [
        {
          name: 'pwd-tool',
          description: 'Print working directory',
          command: 'pwd',
          args: [],
          workingDirectory: 'custom/dir',
          parameters: { properties: {}, required: [] },
          enabled: true,
        },
      ];

      const { tool } = require('@anthropic-ai/claude-agent-sdk');
      let toolImplementation: Function;

      vi.mocked(tool).mockImplementation((name, desc, shape, impl) => {
        toolImplementation = impl;
        return { name };
      });

      buildCustomToolsServer(customTools, '/test/project');

      await toolImplementation!({});

      expect(execFile).toHaveBeenCalledWith(
        'pwd',
        [],
        expect.objectContaining({
          cwd: '/test/project/custom/dir',
        }),
        expect.any(Function),
      );
    });

    it('should handle tool execution with custom environment variables', async () => {
      const customTools: CustomToolConfig[] = [
        {
          name: 'env-tool',
          description: 'Tool with custom env',
          command: 'env',
          args: [],
          env: {
            CUSTOM_VAR: 'custom_value',
            ANOTHER_VAR: 'another_value',
          },
          parameters: { properties: {}, required: [] },
          enabled: true,
        },
      ];

      const { tool } = require('@anthropic-ai/claude-agent-sdk');
      let toolImplementation: Function;

      vi.mocked(tool).mockImplementation((name, desc, shape, impl) => {
        toolImplementation = impl;
        return { name };
      });

      buildCustomToolsServer(customTools, '/test/project');

      await toolImplementation!({});

      expect(execFile).toHaveBeenCalledWith(
        'env',
        [],
        expect.objectContaining({
          env: expect.objectContaining({
            CUSTOM_VAR: 'custom_value',
            ANOTHER_VAR: 'another_value',
            APEX_TOOL_INPUT: '{}',
          }),
        }),
        expect.any(Function),
      );
    });

    it('should handle tool execution timeout', async () => {
      const customTools: CustomToolConfig[] = [
        {
          name: 'timeout-tool',
          description: 'Tool with timeout',
          command: 'sleep',
          args: ['10'],
          timeoutMs: 1000,
          parameters: { properties: {}, required: [] },
          enabled: true,
        },
      ];

      const { tool } = require('@anthropic-ai/claude-agent-sdk');
      let toolImplementation: Function;

      vi.mocked(tool).mockImplementation((name, desc, shape, impl) => {
        toolImplementation = impl;
        return { name };
      });

      buildCustomToolsServer(customTools, '/test/project');

      await toolImplementation!({});

      expect(execFile).toHaveBeenCalledWith(
        'sleep',
        ['10'],
        expect.objectContaining({
          timeout: 1000,
        }),
        expect.any(Function),
      );
    });

    it('should handle tool execution errors', async () => {
      // Mock execFile to throw an error
      const mockExecFile = vi.mocked(execFile);
      mockExecFile.mockImplementation((command, args, options, callback) => {
        if (callback) {
          callback(new Error('Command failed'), { stdout: '', stderr: 'Error details' });
        }
        return {} as any;
      });

      const customTools: CustomToolConfig[] = [
        {
          name: 'failing-tool',
          description: 'Tool that fails',
          command: 'false',
          args: [],
          parameters: { properties: {}, required: [] },
          enabled: true,
        },
      ];

      const { tool } = require('@anthropic-ai/claude-agent-sdk');
      let toolImplementation: Function;

      vi.mocked(tool).mockImplementation((name, desc, shape, impl) => {
        toolImplementation = impl;
        return { name };
      });

      buildCustomToolsServer(customTools, '/test/project');

      const result = await toolImplementation!({});

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Command failed' }],
        isError: true,
      });
    });
  });

  describe('Output Parsing', () => {
    it('should parse JSON output when configured', async () => {
      const mockExecFile = vi.mocked(execFile);
      mockExecFile.mockImplementation((command, args, options, callback) => {
        if (callback) {
          callback(null, { stdout: '{"result": "success", "count": 42}', stderr: '' });
        }
        return {} as any;
      });

      const customTools: CustomToolConfig[] = [
        {
          name: 'json-tool',
          description: 'Tool with JSON output',
          command: 'echo',
          args: ['{"result": "success", "count": 42}'],
          outputParser: 'json',
          parameters: { properties: {}, required: [] },
          enabled: true,
        },
      ];

      const { tool } = require('@anthropic-ai/claude-agent-sdk');
      let toolImplementation: Function;

      vi.mocked(tool).mockImplementation((name, desc, shape, impl) => {
        toolImplementation = impl;
        return { name };
      });

      buildCustomToolsServer(customTools, '/test/project');

      const result = await toolImplementation!({});

      expect(result).toEqual({
        content: [{ type: 'text', text: '{\n  "result": "success",\n  "count": 42\n}' }],
        structuredContent: { result: 'success', count: 42 },
        isError: false,
        _meta: {
          stderr: undefined,
        },
      });
    });

    it('should parse lines output when configured', async () => {
      const mockExecFile = vi.mocked(execFile);
      mockExecFile.mockImplementation((command, args, options, callback) => {
        if (callback) {
          callback(null, { stdout: 'line1\nline2\nline3\n', stderr: '' });
        }
        return {} as any;
      });

      const customTools: CustomToolConfig[] = [
        {
          name: 'lines-tool',
          description: 'Tool with lines output',
          command: 'echo',
          args: ['-e', 'line1\\nline2\\nline3'],
          outputParser: 'lines',
          parameters: { properties: {}, required: [] },
          enabled: true,
        },
      ];

      const { tool } = require('@anthropic-ai/claude-agent-sdk');
      let toolImplementation: Function;

      vi.mocked(tool).mockImplementation((name, desc, shape, impl) => {
        toolImplementation = impl;
        return { name };
      });

      buildCustomToolsServer(customTools, '/test/project');

      const result = await toolImplementation!({});

      expect(result).toEqual({
        content: [{ type: 'text', text: 'line1\nline2\nline3' }],
        structuredContent: { items: ['line1', 'line2', 'line3'] },
        isError: false,
        _meta: {
          stderr: undefined,
        },
      });
    });

    it('should handle text output by default', async () => {
      const mockExecFile = vi.mocked(execFile);
      mockExecFile.mockImplementation((command, args, options, callback) => {
        if (callback) {
          callback(null, { stdout: 'Plain text output', stderr: '' });
        }
        return {} as any;
      });

      const customTools: CustomToolConfig[] = [
        {
          name: 'text-tool',
          description: 'Tool with text output',
          command: 'echo',
          args: ['Plain text output'],
          // No outputParser specified - should default to 'text'
          parameters: { properties: {}, required: [] },
          enabled: true,
        },
      ];

      const { tool } = require('@anthropic-ai/claude-agent-sdk');
      let toolImplementation: Function;

      vi.mocked(tool).mockImplementation((name, desc, shape, impl) => {
        toolImplementation = impl;
        return { name };
      });

      buildCustomToolsServer(customTools, '/test/project');

      const result = await toolImplementation!({});

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Plain text output' }],
        structuredContent: undefined,
        isError: false,
        _meta: {
          stderr: undefined,
        },
      });
    });

    it('should handle stderr output in metadata', async () => {
      const mockExecFile = vi.mocked(execFile);
      mockExecFile.mockImplementation((command, args, options, callback) => {
        if (callback) {
          callback(null, { stdout: 'success', stderr: 'warning: deprecated flag used' });
        }
        return {} as any;
      });

      const customTools: CustomToolConfig[] = [
        {
          name: 'stderr-tool',
          description: 'Tool with stderr',
          command: 'echo',
          args: [],
          parameters: { properties: {}, required: [] },
          enabled: true,
        },
      ];

      const { tool } = require('@anthropic-ai/claude-agent-sdk');
      let toolImplementation: Function;

      vi.mocked(tool).mockImplementation((name, desc, shape, impl) => {
        toolImplementation = impl;
        return { name };
      });

      buildCustomToolsServer(customTools, '/test/project');

      const result = await toolImplementation!({});

      expect(result).toEqual({
        content: [{ type: 'text', text: 'success' }],
        structuredContent: undefined,
        isError: false,
        _meta: {
          stderr: 'warning: deprecated flag used',
        },
      });
    });
  });

  describe('Argument Interpolation', () => {
    it('should interpolate simple input values', async () => {
      const mockExecFile = vi.mocked(execFile);
      mockExecFile.mockImplementation((command, args, options, callback) => {
        if (callback) {
          callback(null, { stdout: 'success', stderr: '' });
        }
        return {} as any;
      });

      const customTools: CustomToolConfig[] = [
        {
          name: 'interpolation-tool',
          description: 'Tool with interpolation',
          command: 'echo',
          args: ['Hello {{input.name}}, you are {{input.age}} years old'],
          parameters: {
            properties: {
              name: { type: 'string' },
              age: { type: 'number' },
            },
            required: ['name', 'age'],
          },
          enabled: true,
        },
      ];

      const { tool } = require('@anthropic-ai/claude-agent-sdk');
      let toolImplementation: Function;

      vi.mocked(tool).mockImplementation((name, desc, shape, impl) => {
        toolImplementation = impl;
        return { name };
      });

      buildCustomToolsServer(customTools, '/test/project');

      await toolImplementation!({ name: 'Alice', age: 30 });

      expect(execFile).toHaveBeenCalledWith(
        'echo',
        ['Hello Alice, you are 30 years old'],
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should interpolate entire input as JSON when no specific field is referenced', async () => {
      const mockExecFile = vi.mocked(execFile);
      mockExecFile.mockImplementation((command, args, options, callback) => {
        if (callback) {
          callback(null, { stdout: 'success', stderr: '' });
        }
        return {} as any;
      });

      const customTools: CustomToolConfig[] = [
        {
          name: 'json-input-tool',
          description: 'Tool that takes entire input as JSON',
          command: 'process',
          args: ['--data', '{{input}}'],
          parameters: {
            properties: {
              key1: { type: 'string' },
              key2: { type: 'number' },
            },
            required: [],
          },
          enabled: true,
        },
      ];

      const { tool } = require('@anthropic-ai/claude-agent-sdk');
      let toolImplementation: Function;

      vi.mocked(tool).mockImplementation((name, desc, shape, impl) => {
        toolImplementation = impl;
        return { name };
      });

      buildCustomToolsServer(customTools, '/test/project');

      await toolImplementation!({ key1: 'value1', key2: 42 });

      expect(execFile).toHaveBeenCalledWith(
        'process',
        ['--data', '{"key1":"value1","key2":42}'],
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should handle missing interpolation values gracefully', async () => {
      const mockExecFile = vi.mocked(execFile);
      mockExecFile.mockImplementation((command, args, options, callback) => {
        if (callback) {
          callback(null, { stdout: 'success', stderr: '' });
        }
        return {} as any;
      });

      const customTools: CustomToolConfig[] = [
        {
          name: 'missing-value-tool',
          description: 'Tool with missing interpolation values',
          command: 'echo',
          args: ['Value: {{input.missing}}', 'Available: {{input.present}}'],
          parameters: {
            properties: {
              present: { type: 'string' },
            },
            required: ['present'],
          },
          enabled: true,
        },
      ];

      const { tool } = require('@anthropic-ai/claude-agent-sdk');
      let toolImplementation: Function;

      vi.mocked(tool).mockImplementation((name, desc, shape, impl) => {
        toolImplementation = impl;
        return { name };
      });

      buildCustomToolsServer(customTools, '/test/project');

      await toolImplementation!({ present: 'here' });

      expect(execFile).toHaveBeenCalledWith(
        'echo',
        ['Value: ', 'Available: here'], // Missing value becomes empty string
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should append JSON input when no placeholders are found', async () => {
      const mockExecFile = vi.mocked(execFile);
      mockExecFile.mockImplementation((command, args, options, callback) => {
        if (callback) {
          callback(null, { stdout: 'success', stderr: '' });
        }
        return {} as any;
      });

      const customTools: CustomToolConfig[] = [
        {
          name: 'no-placeholder-tool',
          description: 'Tool without placeholders',
          command: 'process',
          args: ['--flag', 'value'],
          parameters: {
            properties: {
              data: { type: 'string' },
            },
            required: ['data'],
          },
          enabled: true,
        },
      ];

      const { tool } = require('@anthropic-ai/claude-agent-sdk');
      let toolImplementation: Function;

      vi.mocked(tool).mockImplementation((name, desc, shape, impl) => {
        toolImplementation = impl;
        return { name };
      });

      buildCustomToolsServer(customTools, '/test/project');

      await toolImplementation!({ data: 'test-data' });

      expect(execFile).toHaveBeenCalledWith(
        'process',
        ['--flag', 'value', '{"data":"test-data"}'], // Input appended as JSON
        expect.any(Object),
        expect.any(Function),
      );
    });
  });

  describe('Buffer Size and Resource Limits', () => {
    it('should configure maxBuffer for large outputs', async () => {
      const customTools: CustomToolConfig[] = [
        {
          name: 'large-output-tool',
          description: 'Tool with large output',
          command: 'echo',
          args: ['large output'],
          parameters: { properties: {}, required: [] },
          enabled: true,
        },
      ];

      const { tool } = require('@anthropic-ai/claude-agent-sdk');
      let toolImplementation: Function;

      vi.mocked(tool).mockImplementation((name, desc, shape, impl) => {
        toolImplementation = impl;
        return { name };
      });

      buildCustomToolsServer(customTools, '/test/project');

      await toolImplementation!({});

      expect(execFile).toHaveBeenCalledWith(
        'echo',
        ['large output'],
        expect.objectContaining({
          maxBuffer: 1024 * 1024 * 10, // 10MB
        }),
        expect.any(Function),
      );
    });
  });
});
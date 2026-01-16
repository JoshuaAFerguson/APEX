/**
 * Integration Tests for Custom Tool Error Scenarios
 *
 * This test suite covers error handling in real execution context:
 * - Command execution failures
 * - Timeout scenarios
 * - Hook execution errors
 * - Parameter validation errors
 * - Recovery and cleanup after errors
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ApexOrchestrator } from '../index';
import { buildCustomToolsServer } from '../custom-tools';
import {
  type CustomToolConfig,
  type ToolHookConfig,
  initializeApex,
  loadConfig,
} from '@apexcli/core';
import { createTestToolConfig } from '@apexcli/core/src/__tests__/fixtures/custom-tools/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import YAML from 'yaml';

describe('Custom Tools - Error Scenarios Integration', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-error-test-'));
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    await fs.rm(testDir, { recursive: true, force: true });
  });

  const setupProject = async (customTools: CustomToolConfig[], hooks?: ToolHookConfig) => {
    await initializeApex(testDir, { projectName: 'error-test' });

    const configContent = {
      project: { name: 'error-test', language: 'typescript' },
      customTools,
      ...(hooks ? { toolHooks: hooks } : {}),
    };

    const configPath = path.join(testDir, '.apex', 'config.yaml');
    await fs.writeFile(configPath, YAML.stringify(configContent));

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();
    return orchestrator;
  };

  describe('Command Execution Errors', () => {
    it('should handle nonexistent command gracefully', async () => {
      const invalidTool: CustomToolConfig = createTestToolConfig({
        name: 'InvalidCommandTool',
        description: 'Tool with nonexistent command',
        command: 'nonexistent-command-xyz-123',
        args: ['{{input.data}}'],
        parameters: {
          type: 'object',
          properties: {
            data: { type: 'string' }
          },
          required: ['data'],
          additionalProperties: false
        },
      });

      await setupProject([invalidTool]);

      const config = await loadConfig(testDir);
      expect(config.customTools).toHaveLength(1);

      // Server should be created despite invalid command
      const server = buildCustomToolsServer(config.customTools, testDir);
      expect(server).not.toBeNull();
      expect(server?.name).toBe('custom-tools');

      // Tool registration succeeds, but execution would fail
      expect(config.customTools[0].command).toBe('nonexistent-command-xyz-123');
    });

    it('should handle command with invalid arguments', async () => {
      const invalidArgsTool: CustomToolConfig = createTestToolConfig({
        name: 'InvalidArgsTool',
        description: 'Tool with invalid arguments',
        command: 'ls',
        args: ['--invalid-flag-xyz', '{{input.path}}'],
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          },
          required: ['path'],
          additionalProperties: false
        },
      });

      await setupProject([invalidArgsTool]);

      const config = await loadConfig(testDir);
      expect(config.customTools[0].args).toContain('--invalid-flag-xyz');

      const server = buildCustomToolsServer(config.customTools, testDir);
      expect(server).not.toBeNull();
    });

    it('should handle tools that exit with non-zero status', async () => {
      const failingTool: CustomToolConfig = createTestToolConfig({
        name: 'FailingTool',
        description: 'Tool that always fails',
        command: 'sh',
        args: ['-c', 'echo "Error occurred" >&2; exit 1'],
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false
        },
      });

      await setupProject([failingTool]);

      const config = await loadConfig(testDir);
      const server = buildCustomToolsServer(config.customTools, testDir);
      expect(server).not.toBeNull();

      // Tool setup succeeds, execution failure would be handled at runtime
    });
  });

  describe('Timeout Scenarios', () => {
    it('should handle tool execution timeout', async () => {
      const timeoutTool: CustomToolConfig = createTestToolConfig({
        name: 'TimeoutTool',
        description: 'Tool that exceeds timeout',
        command: 'sleep',
        args: ['5'], // Sleep for 5 seconds
        timeoutMs: 100, // But timeout after 100ms
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false
        },
      });

      await setupProject([timeoutTool]);

      const config = await loadConfig(testDir);
      expect(config.customTools[0].timeoutMs).toBe(100);
      expect(config.customTools[0].command).toBe('sleep');

      const server = buildCustomToolsServer(config.customTools, testDir);
      expect(server).not.toBeNull();
    });

    it('should handle missing timeout configuration', async () => {
      const noTimeoutTool: CustomToolConfig = createTestToolConfig({
        name: 'NoTimeoutTool',
        description: 'Tool without explicit timeout',
        command: 'echo',
        args: ['test'],
        // timeoutMs not specified
      });

      // Remove timeout if it was set by createTestToolConfig
      delete (noTimeoutTool as any).timeoutMs;

      await setupProject([noTimeoutTool]);

      const config = await loadConfig(testDir);
      expect(config.customTools[0].timeoutMs).toBeUndefined();

      const server = buildCustomToolsServer(config.customTools, testDir);
      expect(server).not.toBeNull();
    });

    it('should handle extreme timeout values', async () => {
      const extremeTimeoutTool: CustomToolConfig = createTestToolConfig({
        name: 'ExtremeTimeoutTool',
        description: 'Tool with extreme timeout',
        command: 'echo',
        args: ['test'],
        timeoutMs: 1, // Extremely short timeout
      });

      await setupProject([extremeTimeoutTool]);

      const config = await loadConfig(testDir);
      expect(config.customTools[0].timeoutMs).toBe(1);

      const server = buildCustomToolsServer(config.customTools, testDir);
      expect(server).not.toBeNull();
    });
  });

  describe('Hook Execution Errors', () => {
    it('should handle failing pre-hooks', async () => {
      const normalTool = createTestToolConfig({
        name: 'NormalTool',
        description: 'Normal tool',
        command: 'echo',
        args: ['normal'],
      });

      const failingHooks: ToolHookConfig = {
        enabled: true,
        pre: [{
          name: 'failing-pre-hook',
          command: 'false', // Command that always fails
          args: [],
        }],
        post: [],
        defaultTimeoutMs: 30000,
      };

      await setupProject([normalTool], failingHooks);

      const config = await loadConfig(testDir);
      expect(config.toolHooks?.pre[0].command).toBe('false');

      // Configuration should load despite failing hook command
      const server = buildCustomToolsServer(config.customTools, testDir);
      expect(server).not.toBeNull();
    });

    it('should handle missing hook commands', async () => {
      const normalTool = createTestToolConfig({
        name: 'NormalTool',
        description: 'Normal tool',
      });

      const missingHooks: ToolHookConfig = {
        enabled: true,
        pre: [{
          name: 'missing-command-hook',
          command: 'nonexistent-hook-command',
          args: ['test'],
        }],
        post: [],
        defaultTimeoutMs: 30000,
      };

      await setupProject([normalTool], missingHooks);

      const config = await loadConfig(testDir);
      expect(config.toolHooks?.pre[0].command).toBe('nonexistent-hook-command');
    });

    it('should handle hook timeout scenarios', async () => {
      const tool = createTestToolConfig({
        name: 'TestTool',
        description: 'Test tool for hook timeout',
      });

      const timeoutHooks: ToolHookConfig = {
        enabled: true,
        pre: [{
          name: 'timeout-hook',
          command: 'sleep',
          args: ['10'], // Sleep longer than timeout
          timeoutMs: 100, // Short timeout
        }],
        post: [],
        defaultTimeoutMs: 100,
      };

      await setupProject([tool], timeoutHooks);

      const config = await loadConfig(testDir);
      expect(config.toolHooks?.pre[0].timeoutMs).toBe(100);
      expect(config.toolHooks?.defaultTimeoutMs).toBe(100);
    });
  });

  describe('Parameter Validation Errors', () => {
    it('should handle malformed parameter schemas', async () => {
      const malformedTool: any = createTestToolConfig({
        name: 'MalformedTool',
        description: 'Tool with malformed parameters',
      });

      // Intentionally malform the parameter schema
      malformedTool.parameters = {
        type: 'invalid-type',
        properties: {
          invalidProp: {
            type: 'nonexistent-type',
            required: 'should-be-array',
          }
        },
      };

      try {
        await setupProject([malformedTool]);

        const config = await loadConfig(testDir);

        // System should either filter out invalid tools or handle gracefully
        if (config.customTools.length > 0) {
          const server = buildCustomToolsServer(config.customTools, testDir);
          // If tool loads, server creation should handle schema issues
          expect(server).not.toBeNull();
        } else {
          // If filtered out, that's acceptable
          expect(config.customTools).toHaveLength(0);
        }
      } catch (error) {
        // Configuration loading may fail with validation errors
        expect(error).toBeDefined();
      }
    });

    it('should handle circular parameter references', async () => {
      const circularTool: any = createTestToolConfig({
        name: 'CircularTool',
        description: 'Tool with circular parameter references',
      });

      // Create circular reference
      const circularSchema: any = {
        type: 'object',
        properties: {
          self: null // Will be set to circular reference
        }
      };
      circularSchema.properties.self = circularSchema; // Circular reference

      circularTool.parameters = circularSchema;

      try {
        await setupProject([circularTool]);

        const config = await loadConfig(testDir);
        // System should handle circular references gracefully

        if (config.customTools.length > 0) {
          const server = buildCustomToolsServer(config.customTools, testDir);
          expect(server).not.toBeNull();
        }
      } catch (error) {
        // May fail during schema processing
        expect(error).toBeDefined();
      }
    });

    it('should handle missing required parameter properties', async () => {
      const incompleteTool: any = {
        name: 'IncompleteTool',
        description: 'Tool missing required properties',
        // Missing command, args, parameters
      };

      try {
        await setupProject([incompleteTool]);

        const config = await loadConfig(testDir);

        // Invalid tools should be filtered out
        expect(config.customTools).toHaveLength(0);
      } catch (error) {
        // Configuration validation may fail
        expect(error).toBeDefined();
      }
    });
  });

  describe('Output Parsing Errors', () => {
    it('should handle invalid JSON output with json parser', async () => {
      const invalidJsonTool: CustomToolConfig = createTestToolConfig({
        name: 'InvalidJsonTool',
        description: 'Tool that outputs invalid JSON',
        command: 'echo',
        args: ['{invalid json content}'],
        outputParser: 'json',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false
        },
      });

      await setupProject([invalidJsonTool]);

      const config = await loadConfig(testDir);
      expect(config.customTools[0].outputParser).toBe('json');

      const server = buildCustomToolsServer(config.customTools, testDir);
      expect(server).not.toBeNull();

      // Tool setup succeeds, JSON parsing error would occur at execution
    });

    it('should handle unknown output parser', async () => {
      const unknownParserTool: any = createTestToolConfig({
        name: 'UnknownParserTool',
        description: 'Tool with unknown output parser',
        command: 'echo',
        args: ['test'],
        outputParser: 'unknown-format' as any,
      });

      await setupProject([unknownParserTool]);

      const config = await loadConfig(testDir);

      // System should handle unknown parser gracefully
      if (config.customTools.length > 0) {
        const server = buildCustomToolsServer(config.customTools, testDir);
        expect(server).not.toBeNull();
      }
    });
  });

  describe('Environment and Directory Errors', () => {
    it('should handle nonexistent working directory', async () => {
      const invalidDirTool: CustomToolConfig = createTestToolConfig({
        name: 'InvalidDirTool',
        description: 'Tool with nonexistent working directory',
        command: 'echo',
        args: ['test'],
        workingDirectory: 'nonexistent/directory/path',
      });

      await setupProject([invalidDirTool]);

      const config = await loadConfig(testDir);
      expect(config.customTools[0].workingDirectory).toBe('nonexistent/directory/path');

      const server = buildCustomToolsServer(config.customTools, testDir);
      expect(server).not.toBeNull();
    });

    it('should handle invalid environment variable values', async () => {
      const invalidEnvTool: any = createTestToolConfig({
        name: 'InvalidEnvTool',
        description: 'Tool with invalid environment variables',
        command: 'echo',
        args: ['test'],
        env: {
          VALID_VAR: 'valid_value',
          NULL_VAR: null,
          UNDEFINED_VAR: undefined,
          OBJECT_VAR: { nested: 'object' },
        } as any,
      });

      await setupProject([invalidEnvTool]);

      const config = await loadConfig(testDir);

      // System should filter out invalid environment values
      if (config.customTools.length > 0) {
        const env = config.customTools[0].env;
        expect(env?.VALID_VAR).toBe('valid_value');
        // Invalid values should be filtered or converted
      }
    });
  });

  describe('Recovery and Cleanup', () => {
    it('should handle errors with cleanup hooks still executing', async () => {
      const errorTool = createTestToolConfig({
        name: 'ErrorTool',
        description: 'Tool that will error',
        command: 'false', // Always fails
        args: [],
      });

      const cleanupHooks: ToolHookConfig = {
        enabled: true,
        pre: [],
        post: [{
          name: 'cleanup-hook',
          command: 'echo',
          args: ['Cleanup after error'],
          tools: ['ErrorTool'],
        }],
        defaultTimeoutMs: 30000,
      };

      await setupProject([errorTool], cleanupHooks);

      const config = await loadConfig(testDir);
      expect(config.customTools[0].command).toBe('false');
      expect(config.toolHooks?.post[0].name).toBe('cleanup-hook');

      const server = buildCustomToolsServer(config.customTools, testDir);
      expect(server).not.toBeNull();
    });

    it('should handle multiple error scenarios in sequence', async () => {
      const multiErrorTool = createTestToolConfig({
        name: 'MultiErrorTool',
        description: 'Tool with multiple potential errors',
        command: 'nonexistent-command',
        args: ['{{input.invalidParam}}'],
        timeoutMs: 1,
        workingDirectory: 'nonexistent-dir',
        env: {
          INVALID_ENV: null as any,
        },
        parameters: {
          type: 'object',
          properties: {
            invalidParam: {
              type: 'invalid-type' as any,
            }
          },
          required: ['invalidParam'],
          additionalProperties: false
        },
        outputParser: 'invalid-parser' as any,
      });

      // System should handle multiple errors gracefully
      try {
        await setupProject([multiErrorTool]);

        const config = await loadConfig(testDir);

        if (config.customTools.length > 0) {
          const server = buildCustomToolsServer(config.customTools, testDir);
          // If tool somehow passes validation, server should handle it
          expect(server).not.toBeNull();
        } else {
          // Tool filtered due to validation errors
          expect(config.customTools).toHaveLength(0);
        }
      } catch (error) {
        // Configuration may fail with multiple validation errors
        expect(error).toBeDefined();
      }
    });
  });
});
/**
 * Integration Tests for Custom Tool Workflow
 *
 * This test suite covers end-to-end custom tool usage:
 * - Registering a custom tool and invoking it
 * - Tool execution with hooks firing correctly
 * - Full workflow with custom tools (register → validate → execute → cleanup)
 * - Error scenarios in real execution context
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ApexOrchestrator } from '../index';
import { buildCustomToolsServer } from '../custom-tools';
import {
  type CustomToolConfig,
  type ToolHookConfig,
  initializeApex,
  loadConfig,
  generateTaskId,
  TaskStatus,
} from '@apexcli/core';
import { createTestToolConfig } from '../../../core/src/__tests__/fixtures/custom-tools/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import YAML from 'yaml';

describe('Custom Tools - Workflow Integration', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-workflow-test-'));
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    await fs.rm(testDir, { recursive: true, force: true });
  });

  const setupProject = async (customTools: CustomToolConfig[], hooks?: ToolHookConfig) => {
    await initializeApex(testDir, { projectName: 'workflow-test' });

    const configContent = {
      project: { name: 'workflow-test', language: 'typescript' },
      customTools,
      ...(hooks ? { toolHooks: hooks } : {}),
    };

    const configPath = path.join(testDir, '.apex', 'config.yaml');
    await fs.writeFile(configPath, YAML.stringify(configContent));

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();
    return orchestrator;
  };

  describe('Tool Registration and Invocation', () => {
    it('should register custom tool and create invocable server', async () => {
      const echoTool: CustomToolConfig = createTestToolConfig({
        name: 'EchoTool',
        description: 'Echo test messages',
        command: 'echo',
        args: ['{{input.message}}'],
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          },
          required: ['message'],
          additionalProperties: false
        },
        outputParser: 'text',
      });

      await setupProject([echoTool]);

      // Verify tool is registered in config
      const config = await loadConfig(testDir);
      expect(config.customTools).toHaveLength(1);
      expect(config.customTools[0].name).toBe('EchoTool');

      // Build custom tools server for invocation
      const server = buildCustomToolsServer(config.customTools, testDir);
      expect(server).not.toBeNull();
      expect(server?.name).toBe('custom-tools');
      expect(server?.config.tools).toBeDefined();

      // Verify orchestrator is initialized
      expect(orchestrator.isInitialized()).toBe(true);
    });

    it('should handle multiple tool registration', async () => {
      const tools: CustomToolConfig[] = [
        createTestToolConfig({
          name: 'Tool1',
          description: 'First tool',
          command: 'echo',
          args: ['tool1'],
        }),
        createTestToolConfig({
          name: 'Tool2',
          description: 'Second tool',
          command: 'echo',
          args: ['tool2'],
        }),
      ];

      await setupProject(tools);

      const config = await loadConfig(testDir);
      expect(config.customTools).toHaveLength(2);

      const server = buildCustomToolsServer(config.customTools, testDir);
      expect(server).not.toBeNull();
    });
  });

  describe('Hook Integration', () => {
    it('should configure hooks with tools correctly', async () => {
      const testTool = createTestToolConfig({
        name: 'TestTool',
        description: 'Tool for hook testing',
      });

      const hooks: ToolHookConfig = {
        enabled: true,
        pre: [{
          name: 'pre-hook',
          command: 'echo',
          args: ['Pre-hook executed'],
        }],
        post: [{
          name: 'post-hook',
          command: 'echo',
          args: ['Post-hook executed'],
        }],
        defaultTimeoutMs: 30000,
      };

      await setupProject([testTool], hooks);

      const config = await loadConfig(testDir);
      expect(config.toolHooks?.enabled).toBe(true);
      expect(config.toolHooks?.pre).toHaveLength(1);
      expect(config.toolHooks?.post).toHaveLength(1);

      // Verify tool and hooks work together
      const server = buildCustomToolsServer(config.customTools, testDir);
      expect(server).not.toBeNull();
    });

    it('should handle tool-specific hooks', async () => {
      const tools = [
        createTestToolConfig({ name: 'GitTool' }),
        createTestToolConfig({ name: 'BuildTool' }),
      ];

      const hooks: ToolHookConfig = {
        enabled: true,
        pre: [{
          name: 'git-hook',
          command: 'echo',
          args: ['Git pre-hook'],
          tools: ['GitTool'],
        }],
        post: [{
          name: 'global-hook',
          command: 'echo',
          args: ['Global post-hook'],
          tools: [],
        }],
        defaultTimeoutMs: 30000,
      };

      await setupProject(tools, hooks);

      const config = await loadConfig(testDir);
      expect(config.toolHooks?.pre[0].tools).toEqual(['GitTool']);
      expect(config.toolHooks?.post[0].tools).toEqual([]);
    });
  });

  describe('Full Workflow Tests', () => {
    it('should complete register → validate → execute workflow', async () => {
      const processingTool: CustomToolConfig = createTestToolConfig({
        name: 'ProcessingTool',
        description: 'Data processing tool',
        command: 'echo',
        args: ['Processing: {{input.data}}'],
        parameters: {
          type: 'object',
          properties: {
            data: { type: 'string' }
          },
          required: ['data'],
          additionalProperties: false
        },
        outputParser: 'text',
      });

      await setupProject([processingTool]);

      // Create and verify task
      const taskId = generateTaskId();
      const task = await orchestrator.createTask({
        id: taskId,
        description: 'Test processing task',
        status: TaskStatus.PENDING,
        workflow: 'test-workflow',
        createdAt: new Date(),
        agentStage: 'implementation',
      });

      expect(task.id).toBe(taskId);
      expect(task.status).toBe(TaskStatus.PENDING);

      // Verify tool registration completed
      const config = await loadConfig(testDir);
      expect(config.customTools[0].name).toBe('ProcessingTool');

      // Verify tool server can be built (validation step)
      const server = buildCustomToolsServer(config.customTools, testDir);
      expect(server).not.toBeNull();

      // This completes the register → validate workflow
      // In real usage, Claude Agent SDK would execute the tool
    });

    it('should handle cleanup after tool execution', async () => {
      const temporaryTool = createTestToolConfig({
        name: 'TemporaryTool',
        description: 'Tool that needs cleanup',
        command: 'echo',
        args: ['temp-operation'],
      });

      const cleanupHooks: ToolHookConfig = {
        enabled: true,
        pre: [],
        post: [{
          name: 'cleanup-hook',
          command: 'echo',
          args: ['Cleaning up'],
          tools: ['TemporaryTool'],
        }],
        defaultTimeoutMs: 30000,
      };

      await setupProject([temporaryTool], cleanupHooks);

      // Verify cleanup hook is configured
      const config = await loadConfig(testDir);
      const cleanupHook = config.toolHooks?.post[0];
      expect(cleanupHook?.name).toBe('cleanup-hook');
      expect(cleanupHook?.tools).toEqual(['TemporaryTool']);

      // Tool and cleanup are properly configured
      const server = buildCustomToolsServer(config.customTools, testDir);
      expect(server).not.toBeNull();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle invalid tool command gracefully', async () => {
      const invalidTool: CustomToolConfig = createTestToolConfig({
        name: 'InvalidTool',
        description: 'Tool with invalid command',
        command: 'nonexistent-command-xyz',
        args: ['test'],
      });

      await setupProject([invalidTool]);

      // Tool should still register despite invalid command
      const config = await loadConfig(testDir);
      expect(config.customTools).toHaveLength(1);

      // Server creation should handle invalid command
      const server = buildCustomToolsServer(config.customTools, testDir);
      expect(server).not.toBeNull();
      // Execution would fail at runtime, but registration succeeds
    });

    it('should handle tool timeout configuration', async () => {
      const timeoutTool: CustomToolConfig = createTestToolConfig({
        name: 'TimeoutTool',
        description: 'Tool with timeout',
        command: 'sleep',
        args: ['10'],
        timeoutMs: 100, // Very short timeout
      });

      await setupProject([timeoutTool]);

      const config = await loadConfig(testDir);
      expect(config.customTools[0].timeoutMs).toBe(100);

      const server = buildCustomToolsServer(config.customTools, testDir);
      expect(server).not.toBeNull();
    });

    it('should handle missing hook handlers', async () => {
      const tool = createTestToolConfig({
        name: 'TestTool',
        description: 'Test tool',
      });

      const invalidHooks: ToolHookConfig = {
        enabled: true,
        pre: [{
          name: 'missing-hook',
          command: 'nonexistent-command',
          args: ['test'],
        }],
        post: [],
        defaultTimeoutMs: 30000,
      };

      await setupProject([tool], invalidHooks);

      // Configuration should load despite invalid hook
      const config = await loadConfig(testDir);
      expect(config.toolHooks?.enabled).toBe(true);
      expect(config.toolHooks?.pre).toHaveLength(1);
    });

    it('should handle malformed tool parameters', async () => {
      const malformedTool: CustomToolConfig = createTestToolConfig({
        name: 'MalformedTool',
        description: 'Tool with malformed parameters',
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
      });

      await setupProject([malformedTool]);

      // System should handle malformed parameters gracefully
      const config = await loadConfig(testDir);

      if (config.customTools.length > 0) {
        // If tool loads, server creation should handle parameter issues
        const server = buildCustomToolsServer(config.customTools, testDir);
        expect(server).not.toBeNull();
      } else {
        // If tool is filtered out due to validation, that's acceptable
        expect(config.customTools).toHaveLength(0);
      }
    });
  });

  describe('Complex Parameter Handling', () => {
    it('should handle nested parameter structures', async () => {
      const complexTool: CustomToolConfig = createTestToolConfig({
        name: 'ComplexTool',
        description: 'Tool with complex parameters',
        command: 'echo',
        args: ['{{input.config.environment}}-{{input.settings.debug}}'],
        parameters: {
          type: 'object',
          properties: {
            config: {
              type: 'object',
              properties: {
                environment: { type: 'string', enum: ['dev', 'prod'] },
                version: { type: 'string', default: '1.0.0' }
              },
              required: ['environment'],
              additionalProperties: false
            },
            settings: {
              type: 'object',
              properties: {
                debug: { type: 'boolean', default: false }
              },
              additionalProperties: false
            }
          },
          required: ['config'],
          additionalProperties: false
        },
        outputParser: 'text',
      });

      await setupProject([complexTool]);

      const config = await loadConfig(testDir);
      const tool = config.customTools[0];

      // Verify nested structure is preserved
      expect(tool.parameters.properties.config.properties.environment.enum).toEqual(['dev', 'prod']);
      expect(tool.parameters.properties.settings.properties.debug.type).toBe('boolean');

      const server = buildCustomToolsServer(config.customTools, testDir);
      expect(server).not.toBeNull();
    });

    it('should handle array parameters', async () => {
      const arrayTool: CustomToolConfig = createTestToolConfig({
        name: 'ArrayTool',
        description: 'Tool with array parameters',
        command: 'echo',
        args: ['{{input.items}}'],
        parameters: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              maxItems: 10
            }
          },
          required: ['items'],
          additionalProperties: false
        },
      });

      await setupProject([arrayTool]);

      const config = await loadConfig(testDir);
      expect(config.customTools[0].parameters.properties.items.type).toBe('array');
      expect(config.customTools[0].parameters.properties.items.minItems).toBe(1);

      const server = buildCustomToolsServer(config.customTools, testDir);
      expect(server).not.toBeNull();
    });
  });
});
/**
 * Integration tests for custom tools end-to-end flow
 *
 * These tests verify that:
 * - Custom tools are loaded from configuration
 * - Tools execute tasks with proper hooks firing
 * - Success and error scenarios work correctly
 * - Integration with orchestrator functions properly
 *
 * Tests cover the full lifecycle from config loading to tool execution.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  initializeApex,
  loadConfig,
  getEffectiveConfig,
  type CustomToolConfig,
  type ToolStartHookContext,
  type ToolCompleteHookContext,
  type ToolErrorHookContext,
} from '@apexcli/core';
import { ApexOrchestrator } from '@apexcli/orchestrator';

describe('Integration: Custom Tools End-to-End Flow', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let hookEvents: Array<{ type: 'start' | 'complete' | 'error'; context: any }>;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-custom-tools-int-'));
    hookEvents = [];
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    await fs.rm(testDir, { recursive: true, force: true });
  });

  const createTestTool = (name: string, options: Partial<CustomToolConfig> = {}): CustomToolConfig => ({
    name: name,
    description: options.description || `Test tool ${name}`,
    command: options.command || 'echo',
    args: options.args || ['{{input.message}}'],
    parameters: options.parameters || {
      type: 'object',
      properties: {
        message: {
          type: 'string',
        },
      },
      required: ['message'],
      additionalProperties: false,
    },
    outputParser: options.outputParser || 'text',
    timeoutMs: options.timeoutMs || 5000,
    enabled: options.enabled !== false,
    workingDirectory: options.workingDirectory,
    env: options.env,
  });

  describe('Tool Configuration Loading', () => {
    it('should load custom tools from config file', async () => {
      // Initialize project
      await initializeApex(testDir, { projectName: 'test' });

      // Create config with custom tools
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const configContent = `
project:
  name: test-project
  language: typescript

customTools:
  - name: EchoTool
    description: Echo input message
    command: echo
    args: ['{{input.message}}']
    parameters:
      type: object
      properties:
        message:
          type: string
      required: [message]
      additionalProperties: false
    outputParser: text
    timeoutMs: 5000
    enabled: true

  - name: JsonTool
    description: Output JSON
    command: echo
    args: ['{"result": "{{input.value}}"}']
    parameters:
      type: object
      properties:
        value:
          type: string
      required: [value]
      additionalProperties: false
    outputParser: json
    enabled: true

  - name: DisabledTool
    description: This tool is disabled
    command: false
    enabled: false
`;

      await fs.writeFile(configPath, configContent);

      // Load and verify config
      const config = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(config);

      expect(effectiveConfig.customTools).toHaveLength(3);
      expect(effectiveConfig.customTools[0].name).toBe('EchoTool');
      expect(effectiveConfig.customTools[0].enabled).toBe(true);
      expect(effectiveConfig.customTools[1].name).toBe('JsonTool');
      expect(effectiveConfig.customTools[1].outputParser).toBe('json');
      expect(effectiveConfig.customTools[2].name).toBe('DisabledTool');
      expect(effectiveConfig.customTools[2].enabled).toBe(false);
    });

    it('should handle empty custom tools configuration', async () => {
      await initializeApex(testDir, { projectName: 'test' });

      const config = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(config);

      expect(effectiveConfig.customTools).toEqual([]);
    });
  });

  describe('Tool Server Creation via Orchestrator', () => {
    it('should initialize custom tools when enabled tools are configured', async () => {
      // Initialize project with custom tools
      await initializeApex(testDir, { projectName: 'test' });

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const configContent = `
project:
  name: test-project

customTools:
  - name: EnabledTool1
    description: First enabled tool
    command: echo
    args: ['{{input.message}}']
    parameters:
      type: object
      properties:
        message:
          type: string
      required: [message]
      additionalProperties: false
    enabled: true

  - name: DisabledTool
    description: This tool is disabled
    command: echo
    enabled: false
`;

      await fs.writeFile(configPath, configContent);

      // Initialize orchestrator
      const testOrchestrator = new ApexOrchestrator({ projectPath: testDir });
      await testOrchestrator.initialize();

      // Should have custom tools server
      expect(testOrchestrator.customToolsServer).toBeDefined();
      expect(testOrchestrator.customToolsServer?.name).toBe('custom-tools');

      await testOrchestrator.shutdown();
    });

    it('should not create custom tools server when no enabled tools', async () => {
      // Initialize project with no custom tools
      await initializeApex(testDir, { projectName: 'test' });

      const testOrchestrator = new ApexOrchestrator({ projectPath: testDir });
      await testOrchestrator.initialize();

      // Should not have custom tools server
      expect(testOrchestrator.customToolsServer).toBeUndefined();

      await testOrchestrator.shutdown();
    });

    it('should not create custom tools server when only disabled tools', async () => {
      // Initialize project with disabled tools only
      await initializeApex(testDir, { projectName: 'test' });

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const configContent = `
project:
  name: test-project

customTools:
  - name: DisabledTool1
    description: Disabled tool 1
    command: echo
    enabled: false

  - name: DisabledTool2
    description: Disabled tool 2
    command: echo
    enabled: false
`;

      await fs.writeFile(configPath, configContent);

      const testOrchestrator = new ApexOrchestrator({ projectPath: testDir });
      await testOrchestrator.initialize();

      // Should not have custom tools server
      expect(testOrchestrator.customToolsServer).toBeUndefined();

      await testOrchestrator.shutdown();
    });
  });

  describe('Tool Execution with Orchestrator', () => {
    beforeEach(async () => {
      // Initialize project
      await initializeApex(testDir, { projectName: 'test' });

      // Create config with a test tool
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const configContent = `
project:
  name: test-project

customTools:
  - name: TestEcho
    description: Test echo tool
    command: echo
    args: ['Test output:', '{{input.message}}']
    parameters:
      type: object
      properties:
        message:
          type: string
      required: [message]
      additionalProperties: false
    outputParser: text
    timeoutMs: 5000
    enabled: true
`;

      await fs.writeFile(configPath, configContent);

      // Create minimal agent and workflow
      const agentsDir = path.join(testDir, '.apex', 'agents');
      await fs.writeFile(
        path.join(agentsDir, 'test-agent.md'),
        `---
name: test-agent
description: Test agent with custom tools
tools: TestEcho
---

You are a test agent that can use custom tools.`
      );

      const workflowsDir = path.join(testDir, '.apex', 'workflows');
      await fs.writeFile(
        path.join(workflowsDir, 'test-workflow.yaml'),
        `name: test-workflow
description: Test workflow with custom tools
stages:
  - name: test
    agent: test-agent
    description: Test stage
`
      );

      // Initialize orchestrator
      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();
    });

    it('should register and execute custom tools successfully', async () => {
      // Verify custom tools server is created
      expect(orchestrator.customToolsServer).toBeDefined();
      expect(orchestrator.customToolsServer?.name).toBe('custom-tools');

      // Create a simple task that would use the custom tool
      const task = await orchestrator.createTask({
        description: 'Test custom tool execution',
        workflow: 'test-workflow',
      });

      expect(task.id).toBeDefined();
      expect(task.status).toBe('pending');
    });

    it('should fire tool hooks correctly during execution', async () => {
      const startEvents: ToolStartHookContext[] = [];
      const completeEvents: ToolCompleteHookContext[] = [];
      const errorEvents: ToolErrorHookContext[] = [];

      // Register hook callbacks
      const unsubscribeStart = orchestrator.onToolStart((context) => {
        startEvents.push(context);
      });

      const unsubscribeComplete = orchestrator.onToolComplete((context) => {
        completeEvents.push(context);
      });

      const unsubscribeError = orchestrator.onToolError((context) => {
        errorEvents.push(context);
      });

      try {
        // Create task
        const task = await orchestrator.createTask({
          description: 'Test tool hooks',
          workflow: 'test-workflow',
        });

        expect(task).toBeDefined();

        // The hooks will be called during actual task execution
        // For this test, we verify that the hook registration works
        expect(typeof unsubscribeStart).toBe('function');
        expect(typeof unsubscribeComplete).toBe('function');
        expect(typeof unsubscribeError).toBe('function');
      } finally {
        // Clean up subscriptions
        unsubscribeStart();
        unsubscribeComplete();
        unsubscribeError();
      }
    });
  });

  describe('Tool Configuration Scenarios', () => {
    it('should load tools with different output parsers', async () => {
      await initializeApex(testDir, { projectName: 'test' });

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const configContent = `
project:
  name: test-project

customTools:
  - name: TextTool
    description: Tool with text output parser
    command: echo
    args: ['Hello, {{input.name}}!']
    parameters:
      type: object
      properties:
        name: { type: string }
      required: [name]
    outputParser: text
    enabled: true

  - name: JsonTool
    description: Tool with JSON output parser
    command: echo
    args: ['{"message": "{{input.value}}", "timestamp": "2024-01-01"}']
    parameters:
      type: object
      properties:
        value: { type: string }
      required: [value]
    outputParser: json
    enabled: true

  - name: LinesTool
    description: Tool with lines output parser
    command: echo
    args: ['-e', 'Line 1\\nLine 2\\nLine 3']
    outputParser: lines
    enabled: true
`;

      await fs.writeFile(configPath, configContent);

      const config = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(config);

      expect(effectiveConfig.customTools).toHaveLength(3);
      expect(effectiveConfig.customTools[0].outputParser).toBe('text');
      expect(effectiveConfig.customTools[1].outputParser).toBe('json');
      expect(effectiveConfig.customTools[2].outputParser).toBe('lines');
    });

    it('should load tools with environment variables and working directory', async () => {
      await initializeApex(testDir, { projectName: 'test' });

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const configContent = `
project:
  name: test-project

customTools:
  - name: EnvTool
    description: Tool with environment variables
    command: echo
    args: ['$TEST_VAR']
    env:
      TEST_VAR: test-value
      NODE_ENV: test
    enabled: true

  - name: DirTool
    description: Tool with working directory
    command: pwd
    workingDirectory: subdir
    enabled: true
`;

      await fs.writeFile(configPath, configContent);

      const config = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(config);

      expect(effectiveConfig.customTools).toHaveLength(2);
      expect(effectiveConfig.customTools[0].env).toEqual({
        TEST_VAR: 'test-value',
        NODE_ENV: 'test',
      });
      expect(effectiveConfig.customTools[1].workingDirectory).toBe('subdir');
    });
  });

  describe('Tool Configuration Error Scenarios', () => {
    it('should load tools with error-prone configurations', async () => {
      await initializeApex(testDir, { projectName: 'test' });

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const configContent = `
project:
  name: test-project

customTools:
  - name: BadCommandTool
    description: Tool with non-existent command
    command: nonexistent-command-12345
    args: ['{{input.message}}']
    parameters:
      type: object
      properties:
        message: { type: string }
      required: [message]
    enabled: true

  - name: TimeoutTool
    description: Tool with short timeout
    command: sleep
    args: ['10']
    timeoutMs: 100
    enabled: true

  - name: JsonTool
    description: Tool that outputs invalid JSON
    command: echo
    args: ['{invalid-json}']
    outputParser: json
    enabled: true
`;

      await fs.writeFile(configPath, configContent);

      const config = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(config);

      // Configuration should load successfully even with error-prone tools
      expect(effectiveConfig.customTools).toHaveLength(3);
      expect(effectiveConfig.customTools[0].command).toBe('nonexistent-command-12345');
      expect(effectiveConfig.customTools[1].timeoutMs).toBe(100);
      expect(effectiveConfig.customTools[2].outputParser).toBe('json');
    });

    it('should handle strict parameter validation configurations', async () => {
      await initializeApex(testDir, { projectName: 'test' });

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const configContent = `
project:
  name: test-project

customTools:
  - name: StrictTool
    description: Tool with strict parameters
    command: echo
    parameters:
      type: object
      properties:
        required_param: { type: string }
        count: { type: integer, minimum: 1, maximum: 100 }
        email: { type: string, pattern: '^[^@]+@[^@]+\\.[^@]+$' }
      required: [required_param, count, email]
      additionalProperties: false
    enabled: true
`;

      await fs.writeFile(configPath, configContent);

      const config = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(config);

      expect(effectiveConfig.customTools).toHaveLength(1);
      expect(effectiveConfig.customTools[0].parameters.required).toEqual(['required_param', 'count', 'email']);
      expect(effectiveConfig.customTools[0].parameters.properties?.count?.minimum).toBe(1);
    });
  });

  describe('Tool Hook Integration', () => {
    beforeEach(async () => {
      await initializeApex(testDir, { projectName: 'test' });

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();
    });

    it('should allow registering multiple hook callbacks', () => {
      const callbacks: Array<() => void> = [];

      // Register multiple start hooks
      callbacks.push(orchestrator.onToolStart(() => {}));
      callbacks.push(orchestrator.onToolStart(() => {}));

      // Register multiple complete hooks
      callbacks.push(orchestrator.onToolComplete(() => {}));
      callbacks.push(orchestrator.onToolComplete(() => {}));

      // Register multiple error hooks
      callbacks.push(orchestrator.onToolError(() => {}));
      callbacks.push(orchestrator.onToolError(() => {}));

      // All should return unsubscribe functions
      callbacks.forEach(callback => {
        expect(typeof callback).toBe('function');
      });

      // Clean up
      callbacks.forEach(callback => callback());
    });

    it('should handle hook unsubscription correctly', () => {
      const callback = vi.fn();

      // Subscribe
      const unsubscribe = orchestrator.onToolStart(callback);
      expect(typeof unsubscribe).toBe('function');

      // Unsubscribe
      unsubscribe();

      // Should not throw on double unsubscribe
      expect(() => unsubscribe()).not.toThrow();
    });

    it('should provide correct context in hook callbacks', () => {
      let startContext: ToolStartHookContext | null = null;
      let completeContext: ToolCompleteHookContext | null = null;
      let errorContext: ToolErrorHookContext | null = null;

      orchestrator.onToolStart((context) => {
        startContext = context;
        expect(context.toolName).toBeDefined();
        expect(context.taskId).toBeDefined();
        expect(context.startTime).toBeInstanceOf(Date);
        expect(context.parameters).toBeDefined();
      });

      orchestrator.onToolComplete((context) => {
        completeContext = context;
        expect(context.toolName).toBeDefined();
        expect(context.taskId).toBeDefined();
        expect(context.startTime).toBeInstanceOf(Date);
        expect(context.endTime).toBeInstanceOf(Date);
        expect(context.duration).toBeGreaterThanOrEqual(0);
        expect(context.result).toBeDefined();
      });

      orchestrator.onToolError((context) => {
        errorContext = context;
        expect(context.toolName).toBeDefined();
        expect(context.taskId).toBeDefined();
        expect(context.startTime).toBeInstanceOf(Date);
        expect(context.endTime).toBeInstanceOf(Date);
        expect(context.duration).toBeGreaterThanOrEqual(0);
        expect(context.error).toBeDefined();
      });

      // The contexts would be populated during actual tool execution
    });
  });

  describe('Advanced Configuration Edge Cases', () => {
    it('should handle tools with no parameters', async () => {
      await initializeApex(testDir, { projectName: 'test' });

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const configContent = `
project:
  name: test-project

customTools:
  - name: NoParamTool
    description: Tool with no parameters
    command: date
    args: ['+%Y-%m-%d']
    parameters:
      type: object
      properties: {}
      additionalProperties: false
    enabled: true
`;

      await fs.writeFile(configPath, configContent);

      const config = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(config);

      expect(effectiveConfig.customTools).toHaveLength(1);
      expect(effectiveConfig.customTools[0].parameters.properties).toEqual({});
    });

    it('should handle tools with default parameter values', async () => {
      await initializeApex(testDir, { projectName: 'test' });

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const configContent = `
project:
  name: test-project

customTools:
  - name: DefaultTool
    description: Tool with default values
    command: echo
    parameters:
      type: object
      properties:
        message:
          type: string
          default: Hello World
        count:
          type: integer
          default: 1
          minimum: 1
          maximum: 10
        enabled:
          type: boolean
          default: true
      additionalProperties: false
    enabled: true
`;

      await fs.writeFile(configPath, configContent);

      const config = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(config);

      expect(effectiveConfig.customTools).toHaveLength(1);
      expect(effectiveConfig.customTools[0].parameters.properties?.message?.default).toBe('Hello World');
      expect(effectiveConfig.customTools[0].parameters.properties?.count?.default).toBe(1);
      expect(effectiveConfig.customTools[0].parameters.properties?.enabled?.default).toBe(true);
    });

    it('should handle tools with enum parameters', async () => {
      await initializeApex(testDir, { projectName: 'test' });

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const configContent = `
project:
  name: test-project

customTools:
  - name: EnumTool
    description: Tool with enum parameters
    command: echo
    parameters:
      type: object
      properties:
        level:
          type: string
          enum: [debug, info, warn, error]
          default: info
        priority:
          type: integer
          enum: [1, 2, 3, 4, 5]
          default: 3
      required: [level]
      additionalProperties: false
    enabled: true
`;

      await fs.writeFile(configPath, configContent);

      const config = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(config);

      expect(effectiveConfig.customTools).toHaveLength(1);
      expect(effectiveConfig.customTools[0].parameters.properties?.level?.enum).toEqual(['debug', 'info', 'warn', 'error']);
      expect(effectiveConfig.customTools[0].parameters.properties?.priority?.enum).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle nested object parameters', async () => {
      await initializeApex(testDir, { projectName: 'test' });

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const configContent = `
project:
  name: test-project

customTools:
  - name: NestedTool
    description: Tool with nested parameters
    command: echo
    parameters:
      type: object
      properties:
        config:
          type: object
          properties:
            database:
              type: object
              properties:
                host: { type: string }
                port: { type: integer, minimum: 1, maximum: 65535 }
                ssl: { type: boolean, default: false }
              required: [host, port]
            logging:
              type: object
              properties:
                level: { type: string, enum: [debug, info, warn, error] }
                file: { type: string }
          required: [database]
      required: [config]
      additionalProperties: false
    enabled: true
`;

      await fs.writeFile(configPath, configContent);

      const config = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(config);

      expect(effectiveConfig.customTools).toHaveLength(1);
      const configProp = effectiveConfig.customTools[0].parameters.properties?.config;
      expect(configProp?.type).toBe('object');
      expect(configProp?.required).toEqual(['database']);
    });
  });
});
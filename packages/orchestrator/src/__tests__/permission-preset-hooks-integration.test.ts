import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../index';
import type { Task, PermissionPreset } from '@apexcli/core';

/**
 * Integration tests for permission preset functionality in the complete orchestrator workflow
 *
 * These tests verify that:
 * 1. Permission presets are properly initialized in the orchestrator
 * 2. PreToolUse hooks correctly check permissions and emit events
 * 3. The complete workflow from task creation to tool execution works with permission presets
 * 4. Events are properly emitted during permission checking
 */
describe('Permission Preset Hooks Integration (Full Workflow)', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let capturedEvents: Array<{ event: string; data: any }>;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-permission-integration-test-'));

    // Create project structure
    await fs.mkdir(path.join(tempDir, '.apex'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });

    // Create a basic config file
    const config = {
      autonomy: 'review-all' as const,
      agents: {},
      workflows: {},
      limits: {
        maxTokens: 100000,
        maxCost: 10,
      },
    };
    await fs.writeFile(
      path.join(tempDir, '.apex', 'config.yaml'),
      `autonomy: review-all\nworkflows: {}\nagents: {}\nlimits:\n  maxTokens: 100000\n  maxCost: 10`
    );

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator({ projectPath: tempDir });
    await orchestrator.initialize();

    // Capture events
    capturedEvents = [];
    orchestrator.on('permission:granted', (data) => {
      capturedEvents.push({ event: 'permission:granted', data });
    });
    orchestrator.on('permission:denied', (data) => {
      capturedEvents.push({ event: 'permission:denied', data });
    });
    orchestrator.on('permission:request', (data) => {
      capturedEvents.push({ event: 'permission:request', data });
    });
  });

  afterEach(async () => {
    await orchestrator.cleanup();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Orchestrator Permission Preset Initialization', () => {
    it('should initialize with permission preset manager', async () => {
      // Verify that the permission preset manager is available
      expect(orchestrator.getPermissionPresetManager()).toBeDefined();
      expect(orchestrator.getPermissionPresetManager()?.getCurrentPreset()).toBe('review-all');
    });

    it('should allow changing permission presets', async () => {
      const permissionManager = orchestrator.getPermissionPresetManager();
      expect(permissionManager).toBeDefined();

      await permissionManager!.applyPreset('autonomous');
      expect(permissionManager!.getCurrentPreset()).toBe('autonomous');

      await permissionManager!.applyPreset('read-only');
      expect(permissionManager!.getCurrentPreset()).toBe('read-only');
    });
  });

  describe('End-to-End Permission Checking', () => {
    it('should grant permissions for autonomous preset', async () => {
      const permissionManager = orchestrator.getPermissionPresetManager();
      await permissionManager!.applyPreset('autonomous');

      // Create a task that will use tools
      const task = await orchestrator.createTask({
        description: 'Test autonomous permission checking',
        workflow: 'feature',
      });

      // Mock the Claude SDK query to trigger tool usage
      const mockQuery = vi.fn().mockResolvedValue({
        content: [],
        usage: { inputTokens: 10, outputTokens: 20 },
      });

      // Simulate tool usage by directly calling the hooks
      const context = {
        taskId: task.id,
        store: orchestrator.getStore(),
        permissionPresetManager: orchestrator.getPermissionPresetManager(),
        eventEmitter: orchestrator,
      };

      const { createHooks } = await import('../hooks');
      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      // Test multiple tool types
      const toolTests = [
        { tool: 'Read', input: { file_path: '/src/app.ts' } },
        { tool: 'Write', input: { file_path: '/src/new.ts', content: 'test' } },
        { tool: 'Bash', input: { command: 'npm test' } },
        { tool: 'WebFetch', input: { url: 'https://api.example.com' } },
      ];

      for (const { tool, input } of toolTests) {
        const hookInput = {
          tool_name: tool,
          tool_input: input,
        };

        const result = await checkPermissionCallback?.(hookInput, `tool-${tool}`, { signal: new AbortController().signal });

        // Should allow all tools
        expect(result).toEqual({});
      }

      // Should have granted permissions for all tools
      expect(capturedEvents.filter(e => e.event === 'permission:granted')).toHaveLength(4);
      expect(capturedEvents.filter(e => e.event === 'permission:denied')).toHaveLength(0);
      expect(capturedEvents.filter(e => e.event === 'permission:request')).toHaveLength(0);
    });

    it('should deny non-read tools for read-only preset', async () => {
      const permissionManager = orchestrator.getPermissionPresetManager();
      await permissionManager!.applyPreset('read-only');

      const task = await orchestrator.createTask({
        description: 'Test read-only permission checking',
        workflow: 'feature',
      });

      const context = {
        taskId: task.id,
        store: orchestrator.getStore(),
        permissionPresetManager: orchestrator.getPermissionPresetManager(),
        eventEmitter: orchestrator,
      };

      const { createHooks } = await import('../hooks');
      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      // Test read-only tools (should be allowed)
      const readOnlyTools = [
        { tool: 'Read', input: { file_path: '/src/app.ts' } },
        { tool: 'Grep', input: { pattern: 'test' } },
        { tool: 'Glob', input: { pattern: '*.ts' } },
        { tool: 'WebFetch', input: { url: 'https://api.example.com' } },
      ];

      for (const { tool, input } of readOnlyTools) {
        const hookInput = {
          tool_name: tool,
          tool_input: input,
        };

        const result = await checkPermissionCallback?.(hookInput, `tool-${tool}`, { signal: new AbortController().signal });
        expect(result).toEqual({});
      }

      // Test write tools (should be denied)
      const writeTools = [
        { tool: 'Write', input: { file_path: '/src/new.ts', content: 'test' } },
        { tool: 'Edit', input: { file_path: '/src/app.ts', old_string: 'old', new_string: 'new' } },
        { tool: 'Bash', input: { command: 'npm install' } },
      ];

      for (const { tool, input } of writeTools) {
        const hookInput = {
          tool_name: tool,
          tool_input: input,
        };

        const result = await checkPermissionCallback?.(hookInput, `tool-${tool}`, { signal: new AbortController().signal });
        expect(result?.hookSpecificOutput?.permissionDecision).toBe('deny');
      }

      // Verify events
      const grantedEvents = capturedEvents.filter(e => e.event === 'permission:granted');
      const deniedEvents = capturedEvents.filter(e => e.event === 'permission:denied');

      expect(grantedEvents).toHaveLength(4); // Read-only tools
      expect(deniedEvents).toHaveLength(3); // Write tools
    });

    it('should request confirmation for review-all preset', async () => {
      // Default preset is 'review-all', so no need to change
      const task = await orchestrator.createTask({
        description: 'Test review-all permission checking',
        workflow: 'feature',
      });

      const context = {
        taskId: task.id,
        store: orchestrator.getStore(),
        permissionPresetManager: orchestrator.getPermissionPresetManager(),
        eventEmitter: orchestrator,
      };

      const { createHooks } = await import('../hooks');
      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      const tools = [
        { tool: 'Read', input: { file_path: '/src/app.ts' } },
        { tool: 'Write', input: { file_path: '/src/new.ts', content: 'test' } },
        { tool: 'Bash', input: { command: 'npm test' } },
      ];

      for (const { tool, input } of tools) {
        const hookInput = {
          tool_name: tool,
          tool_input: input,
        };

        const result = await checkPermissionCallback?.(hookInput, `tool-${tool}`, { signal: new AbortController().signal });

        // All tools should require confirmation (denied until confirmed)
        expect(result?.hookSpecificOutput?.permissionDecision).toBe('deny');
        expect(result?.hookSpecificOutput?.permissionDecisionReason).toContain('requires user confirmation');
      }

      // All tools should generate permission:request events
      const requestEvents = capturedEvents.filter(e => e.event === 'permission:request');
      expect(requestEvents).toHaveLength(3);

      // Verify event structure
      requestEvents.forEach((event, index) => {
        expect(event.data).toMatchObject({
          taskId: task.id,
          toolName: tools[index].tool,
          timestamp: expect.any(Date),
          reason: expect.stringContaining('requires user confirmation'),
          agentName: 'orchestrator',
        });
      });
    });
  });

  describe('Event Emission Details', () => {
    it('should emit detailed permission:granted events', async () => {
      const permissionManager = orchestrator.getPermissionPresetManager();
      await permissionManager!.applyPreset('autonomous');

      const task = await orchestrator.createTask({
        description: 'Test permission granted event details',
        workflow: 'feature',
      });

      const context = {
        taskId: task.id,
        store: orchestrator.getStore(),
        permissionPresetManager: orchestrator.getPermissionPresetManager(),
        eventEmitter: orchestrator,
      };

      const { createHooks } = await import('../hooks');
      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      const hookInput = {
        tool_name: 'Write',
        tool_input: { file_path: '/src/test.ts', content: 'test content' },
      };

      await checkPermissionCallback?.(hookInput, 'tool-1', { signal: new AbortController().signal });

      const grantedEvents = capturedEvents.filter(e => e.event === 'permission:granted');
      expect(grantedEvents).toHaveLength(1);

      const event = grantedEvents[0];
      expect(event.data).toMatchObject({
        taskId: task.id,
        toolName: 'Write',
        scope: '/src/test.ts',
        timestamp: expect.any(Date),
        level: 'allow-always',
        grantedBy: 'permission-preset:autonomous',
        grantReason: 'Tool Write is automatically allowed by permission preset',
      });
    });

    it('should emit detailed permission:denied events', async () => {
      const permissionManager = orchestrator.getPermissionPresetManager();
      await permissionManager!.applyPreset('read-only');

      const task = await orchestrator.createTask({
        description: 'Test permission denied event details',
        workflow: 'feature',
      });

      const context = {
        taskId: task.id,
        store: orchestrator.getStore(),
        permissionPresetManager: orchestrator.getPermissionPresetManager(),
        eventEmitter: orchestrator,
      };

      const { createHooks } = await import('../hooks');
      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      const hookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'rm file.txt' },
      };

      await checkPermissionCallback?.(hookInput, 'tool-1', { signal: new AbortController().signal });

      const deniedEvents = capturedEvents.filter(e => e.event === 'permission:denied');
      expect(deniedEvents).toHaveLength(1);

      const event = deniedEvents[0];
      expect(event.data).toMatchObject({
        taskId: task.id,
        toolName: 'Bash',
        scope: 'rm file.txt',
        timestamp: expect.any(Date),
        denialReason: 'Tool Bash is not allowed by current permission preset: read-only',
        deniedBy: 'permission-preset:read-only',
      });
    });

    it('should emit detailed permission:request events', async () => {
      // Using default 'review-all' preset
      const task = await orchestrator.createTask({
        description: 'Test permission request event details',
        workflow: 'feature',
      });

      const context = {
        taskId: task.id,
        store: orchestrator.getStore(),
        permissionPresetManager: orchestrator.getPermissionPresetManager(),
        eventEmitter: orchestrator,
      };

      const { createHooks } = await import('../hooks');
      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      const hookInput = {
        tool_name: 'Write',
        tool_input: { file_path: '/src/important.ts', content: 'important code' },
      };

      await checkPermissionCallback?.(hookInput, 'tool-1', { signal: new AbortController().signal });

      const requestEvents = capturedEvents.filter(e => e.event === 'permission:request');
      expect(requestEvents).toHaveLength(1);

      const event = requestEvents[0];
      expect(event.data).toMatchObject({
        taskId: task.id,
        toolName: 'Write',
        scope: '/src/important.ts',
        timestamp: expect.any(Date),
        reason: 'Tool Write requires user confirmation under current permission preset: review-all',
        agentName: 'orchestrator',
      });
    });
  });

  describe('Error Handling in Integration', () => {
    it('should handle permission store initialization errors gracefully', async () => {
      // This test verifies that if permission store fails to initialize,
      // the orchestrator still functions and falls back to allowing tools

      // Close the current orchestrator
      await orchestrator.cleanup();

      // Create a new temp directory with invalid permissions structure
      const invalidTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-invalid-permissions-test-'));

      try {
        // Create an invalid .apex directory structure that could cause permission store issues
        await fs.mkdir(path.join(invalidTempDir, '.apex'), { recursive: true });

        // Create config
        await fs.writeFile(
          path.join(invalidTempDir, '.apex', 'config.yaml'),
          `autonomy: review-all\nworkflows: {}\nagents: {}\nlimits:\n  maxTokens: 100000\n  maxCost: 10`
        );

        // Initialize new orchestrator
        const invalidOrchestrator = new ApexOrchestrator({ projectPath: invalidTempDir });
        await invalidOrchestrator.initialize();

        // Even with potential permission store issues, orchestrator should work
        const task = await invalidOrchestrator.createTask({
          description: 'Test error handling',
          workflow: 'feature',
        });

        expect(task).toBeDefined();
        expect(task.id).toBeTruthy();

        await invalidOrchestrator.cleanup();
      } finally {
        await fs.rm(invalidTempDir, { recursive: true, force: true });
      }
    });
  });

  describe('Preset Switching During Task Execution', () => {
    it('should apply new preset permissions immediately', async () => {
      const permissionManager = orchestrator.getPermissionPresetManager();

      // Start with autonomous preset
      await permissionManager!.applyPreset('autonomous');

      const task = await orchestrator.createTask({
        description: 'Test preset switching',
        workflow: 'feature',
      });

      const context = {
        taskId: task.id,
        store: orchestrator.getStore(),
        permissionPresetManager: orchestrator.getPermissionPresetManager(),
        eventEmitter: orchestrator,
      };

      const { createHooks } = await import('../hooks');
      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      const writeInput = {
        tool_name: 'Write',
        tool_input: { file_path: '/src/test.ts', content: 'test' },
      };

      // Should be allowed with autonomous preset
      let result = await checkPermissionCallback?.(writeInput, 'tool-1', { signal: new AbortController().signal });
      expect(result).toEqual({});

      // Switch to read-only preset
      await permissionManager!.applyPreset('read-only');

      // Same tool should now be denied
      result = await checkPermissionCallback?.(writeInput, 'tool-2', { signal: new AbortController().signal });
      expect(result?.hookSpecificOutput?.permissionDecision).toBe('deny');

      // Verify events
      const grantedEvents = capturedEvents.filter(e => e.event === 'permission:granted');
      const deniedEvents = capturedEvents.filter(e => e.event === 'permission:denied');

      expect(grantedEvents).toHaveLength(1); // From autonomous preset
      expect(deniedEvents).toHaveLength(1); // From read-only preset
    });
  });
});
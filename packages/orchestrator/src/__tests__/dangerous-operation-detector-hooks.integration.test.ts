/**
 * @fileoverview Integration tests for DangerousOperationDetector with Claude Agent SDK hooks system
 * Tests the actual hook integration, event emission, and blocking behavior
 */

import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';
import { createHooks, type HookContext } from '../hooks';
import type { TaskStore } from '../store';
import type { HookInput, HookJSONOutput } from '@anthropic-ai/claude-agent-sdk';

// Mock TaskStore
class MockTaskStore implements Partial<TaskStore> {
  public logs: Array<{ taskId: string; log: any }> = [];
  public commands: Array<{ taskId: string; command: string }> = [];

  async addLog(taskId: string, log: any) {
    this.logs.push({ taskId, log });
  }

  async logCommand(taskId: string, command: string) {
    this.commands.push({ taskId, command });
  }

  reset() {
    this.logs = [];
    this.commands = [];
  }
}

// Mock EventEmitter
class MockEventEmitter {
  public events: Array<{ event: string; data: any }> = [];

  emit(event: string, data: any) {
    this.events.push({ event, data });
  }

  reset() {
    this.events = [];
  }

  getEvents(eventType?: string) {
    return eventType ? this.events.filter(e => e.event === eventType) : this.events;
  }
}

describe('DangerousOperationDetector Hooks Integration', () => {
  let mockStore: MockTaskStore;
  let mockEventEmitter: MockEventEmitter;
  let context: HookContext;
  let taskId: string;

  beforeEach(() => {
    mockStore = new MockTaskStore();
    mockEventEmitter = new MockEventEmitter();
    taskId = 'test-task-123';

    context = {
      taskId,
      store: mockStore as TaskStore,
      eventEmitter: mockEventEmitter,
    };
  });

  describe('Critical Operations - Should Block with Events', () => {
    it('should block rm -rf / and emit dangerous:detected and dangerous:blocked events', async () => {
      const hooks = createHooks(context);
      const preToolUseHooks = hooks.PreToolUse!;

      // Find the dangerous operation detector hook (first in the list)
      const dangerousOpHook = preToolUseHooks[0];

      const dangerousInput: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'rm -rf /' }
      };

      const result = await dangerousOpHook.hooks[0](dangerousInput, undefined, { signal: new AbortController().signal });

      // Should block the operation
      expect(result).toEqual({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: expect.stringContaining('Blocked dangerous operation:')
        }
      });

      // Should emit dangerous:detected event
      const detectedEvents = mockEventEmitter.getEvents('dangerous:detected');
      expect(detectedEvents).toHaveLength(1);
      expect(detectedEvents[0].data).toMatchObject({
        taskId,
        tool: 'Bash',
        operationType: 'system-command',
        riskLevel: 'critical',
        description: expect.stringContaining('filesystem root'),
        metadata: {
          operation: expect.stringContaining('rm -rf /'),
          command: 'rm -rf /',
          pattern: expect.any(String)
        }
      });

      // Should emit dangerous:blocked event
      const blockedEvents = mockEventEmitter.getEvents('dangerous:blocked');
      expect(blockedEvents).toHaveLength(1);
      expect(blockedEvents[0].data).toMatchObject({
        taskId,
        tool: 'Bash',
        operationType: 'system-command',
        blockReason: expect.stringContaining('filesystem root'),
        blockedBy: 'DangerousOperationDetector'
      });

      // Should log the detection
      expect(mockStore.logs).toHaveLength(1);
      expect(mockStore.logs[0].log.level).toBe('error');
      expect(mockStore.logs[0].log.message).toContain('Dangerous operation detected');
    });

    it('should block fork bomb and emit appropriate events', async () => {
      const hooks = createHooks(context);
      const dangerousOpHook = hooks.PreToolUse![0];

      const forkBombInput: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: ':(){:|:&};:' }
      };

      const result = await dangerousOpHook.hooks[0](forkBombInput, undefined, { signal: new AbortController().signal });

      // Should block
      expect(result.hookSpecificOutput?.permissionDecision).toBe('deny');

      // Check events
      const detectedEvents = mockEventEmitter.getEvents('dangerous:detected');
      expect(detectedEvents[0].data.riskLevel).toBe('critical');
      expect(detectedEvents[0].data.description).toContain('Fork bomb');

      const blockedEvents = mockEventEmitter.getEvents('dangerous:blocked');
      expect(blockedEvents).toHaveLength(1);
    });

    it('should block writes to /etc/passwd with critical severity', async () => {
      const hooks = createHooks(context);
      const dangerousOpHook = hooks.PreToolUse![0];

      const criticalFileInput: HookInput = {
        tool_name: 'Write',
        tool_input: {
          file_path: '/etc/passwd',
          content: 'root:x:0:0:root:/root:/bin/bash'
        }
      };

      const result = await dangerousOpHook.hooks[0](criticalFileInput, undefined, { signal: new AbortController().signal });

      // Should block
      expect(result.hookSpecificOutput?.permissionDecision).toBe('deny');

      // Should emit events with file-deletion operation type
      const detectedEvents = mockEventEmitter.getEvents('dangerous:detected');
      expect(detectedEvents[0].data).toMatchObject({
        tool: 'Write',
        operationType: 'file-deletion',
        riskLevel: 'critical'
      });
    });

    it('should block file:// protocol access', async () => {
      const hooks = createHooks(context);
      const dangerousOpHook = hooks.PreToolUse![0];

      const fileProtocolInput: HookInput = {
        tool_name: 'WebFetch',
        tool_input: { url: 'file:///etc/passwd' }
      };

      const result = await dangerousOpHook.hooks[0](fileProtocolInput, undefined, { signal: new AbortController().signal });

      // Should block
      expect(result.hookSpecificOutput?.permissionDecision).toBe('deny');

      // Should emit network-request operation type
      const detectedEvents = mockEventEmitter.getEvents('dangerous:detected');
      expect(detectedEvents[0].data.operationType).toBe('network-request');
      expect(detectedEvents[0].data.riskLevel).toBe('critical');
    });
  });

  describe('High-Risk Operations Requiring Confirmation', () => {
    it('should block .env file writes and emit events', async () => {
      const hooks = createHooks(context);
      const dangerousOpHook = hooks.PreToolUse![0];

      const envFileInput: HookInput = {
        tool_name: 'Edit',
        tool_input: {
          file_path: '.env.production',
          old_string: 'OLD_KEY=old',
          new_string: 'NEW_KEY=new'
        }
      };

      const result = await dangerousOpHook.hooks[0](envFileInput, undefined, { signal: new AbortController().signal });

      // Should block because requiresConfirmation is true
      expect(result.hookSpecificOutput?.permissionDecision).toBe('deny');

      const detectedEvents = mockEventEmitter.getEvents('dangerous:detected');
      expect(detectedEvents[0].data).toMatchObject({
        tool: 'Edit',
        operationType: 'file-deletion',
        riskLevel: 'high'
      });

      const blockedEvents = mockEventEmitter.getEvents('dangerous:blocked');
      expect(blockedEvents).toHaveLength(1);
    });

    it('should block localhost access', async () => {
      const hooks = createHooks(context);
      const dangerousOpHook = hooks.PreToolUse![0];

      const localhostInput: HookInput = {
        tool_name: 'WebFetch',
        tool_input: { url: 'http://localhost:8080/admin' }
      };

      const result = await dangerousOpHook.hooks[0](localhostInput, undefined, { signal: new AbortController().signal });

      expect(result.hookSpecificOutput?.permissionDecision).toBe('deny');

      const detectedEvents = mockEventEmitter.getEvents('dangerous:detected');
      expect(detectedEvents[0].data.riskLevel).toBe('high');
      expect(detectedEvents[0].data.description).toContain('localhost');
    });
  });

  describe('Medium-Risk Operations - Detect but Allow', () => {
    it('should detect but allow sudo commands', async () => {
      const hooks = createHooks(context);
      const dangerousOpHook = hooks.PreToolUse![0];

      const sudoInput: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'sudo apt install package' }
      };

      const result = await dangerousOpHook.hooks[0](sudoInput, undefined, { signal: new AbortController().signal });

      // Should NOT block (medium risk, no confirmation required)
      expect(result.hookSpecificOutput?.permissionDecision).not.toBe('deny');
      expect(result).toEqual({});

      // Should still emit dangerous:detected event
      const detectedEvents = mockEventEmitter.getEvents('dangerous:detected');
      expect(detectedEvents[0].data).toMatchObject({
        riskLevel: 'medium',
        tool: 'Bash',
        operationType: 'privilege-escalation'
      });

      // Should NOT emit dangerous:blocked event
      const blockedEvents = mockEventEmitter.getEvents('dangerous:blocked');
      expect(blockedEvents).toHaveLength(0);

      // Should log as warning (not error)
      expect(mockStore.logs[0].log.level).toBe('warn');
    });

    it('should detect but allow git push -f', async () => {
      const hooks = createHooks(context);
      const dangerousOpHook = hooks.PreToolUse![0];

      const gitPushInput: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'git push -f origin main' }
      };

      const result = await dangerousOpHook.hooks[0](gitPushInput, undefined, { signal: new AbortController().signal });

      // Should not block
      expect(result).toEqual({});

      const detectedEvents = mockEventEmitter.getEvents('dangerous:detected');
      expect(detectedEvents[0].data.riskLevel).toBe('medium');
    });

    it('should detect sensitive content but still require confirmation', async () => {
      const hooks = createHooks(context);
      const dangerousOpHook = hooks.PreToolUse![0];

      const sensitiveContentInput: HookInput = {
        tool_name: 'Write',
        tool_input: {
          file_path: 'config.js',
          content: 'const API_KEY = "sk-1234567890abcdef1234567890abcdef";'
        }
      };

      const result = await dangerousOpHook.hooks[0](sensitiveContentInput, undefined, { signal: new AbortController().signal });

      // Should block because sensitive content requires confirmation
      expect(result.hookSpecificOutput?.permissionDecision).toBe('deny');

      const detectedEvents = mockEventEmitter.getEvents('dangerous:detected');
      expect(detectedEvents[0].data).toMatchObject({
        riskLevel: 'medium',
        tool: 'Write',
        operationType: 'data-modification'
      });
    });
  });

  describe('Safe Operations - No Detection', () => {
    it('should allow safe bash commands without events', async () => {
      const hooks = createHooks(context);
      const dangerousOpHook = hooks.PreToolUse![0];

      const safeInput: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'ls -la' }
      };

      const result = await dangerousOpHook.hooks[0](safeInput, undefined, { signal: new AbortController().signal });

      expect(result).toEqual({});
      expect(mockEventEmitter.getEvents('dangerous:detected')).toHaveLength(0);
      expect(mockEventEmitter.getEvents('dangerous:blocked')).toHaveLength(0);
      expect(mockStore.logs).toHaveLength(0);
    });

    it('should allow safe file operations', async () => {
      const hooks = createHooks(context);
      const dangerousOpHook = hooks.PreToolUse![0];

      const safeFileInput: HookInput = {
        tool_name: 'Write',
        tool_input: {
          file_path: 'src/index.js',
          content: 'console.log("Hello, world!");'
        }
      };

      const result = await dangerousOpHook.hooks[0](safeFileInput, undefined, { signal: new AbortController().signal });

      expect(result).toEqual({});
      expect(mockEventEmitter.getEvents()).toHaveLength(0);
    });

    it('should allow safe web requests', async () => {
      const hooks = createHooks(context);
      const dangerousOpHook = hooks.PreToolUse![0];

      const safeWebInput: HookInput = {
        tool_name: 'WebFetch',
        tool_input: { url: 'https://api.github.com/repos/owner/repo' }
      };

      const result = await dangerousOpHook.hooks[0](safeWebInput, undefined, { signal: new AbortController().signal });

      expect(result).toEqual({});
      expect(mockEventEmitter.getEvents()).toHaveLength(0);
    });
  });

  describe('Unknown Tools - No Detection', () => {
    it('should not detect dangerous operations for unknown tools', async () => {
      const hooks = createHooks(context);
      const dangerousOpHook = hooks.PreToolUse![0];

      const unknownToolInput: HookInput = {
        tool_name: 'UnknownTool',
        tool_input: { someParam: 'dangerous value' }
      };

      const result = await dangerousOpHook.hooks[0](unknownToolInput, undefined, { signal: new AbortController().signal });

      expect(result).toEqual({});
      expect(mockEventEmitter.getEvents()).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed input gracefully', async () => {
      const hooks = createHooks(context);
      const dangerousOpHook = hooks.PreToolUse![0];

      const malformedInput: HookInput = {
        tool_name: 'Bash',
        tool_input: null as any
      };

      const result = await dangerousOpHook.hooks[0](malformedInput, undefined, { signal: new AbortController().signal });

      expect(result).toEqual({});
      expect(mockEventEmitter.getEvents()).toHaveLength(0);
    });

    it('should handle missing tool_input gracefully', async () => {
      const hooks = createHooks(context);
      const dangerousOpHook = hooks.PreToolUse![0];

      const missingInputData: HookInput = {
        tool_name: 'Bash',
        tool_input: {}
      };

      const result = await dangerousOpHook.hooks[0](missingInputData, undefined, { signal: new AbortController().signal });

      expect(result).toEqual({});
      expect(mockEventEmitter.getEvents()).toHaveLength(0);
    });
  });

  describe('Event Data Structure Validation', () => {
    it('should emit properly structured dangerous:detected events', async () => {
      const hooks = createHooks(context);
      const dangerousOpHook = hooks.PreToolUse![0];

      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'rm -rf /' }
      };

      await dangerousOpHook.hooks[0](input, undefined, { signal: new AbortController().signal });

      const detectedEvents = mockEventEmitter.getEvents('dangerous:detected');
      expect(detectedEvents[0].data).toMatchObject({
        taskId: expect.any(String),
        timestamp: expect.any(Date),
        tool: expect.any(String),
        operationType: expect.stringMatching(/^(file-deletion|system-command|network-request|privilege-escalation|data-modification)$/),
        riskLevel: expect.stringMatching(/^(low|medium|high|critical)$/),
        description: expect.any(String),
        metadata: expect.objectContaining({
          operation: expect.any(String)
        })
      });
    });

    it('should emit properly structured dangerous:blocked events', async () => {
      const hooks = createHooks(context);
      const dangerousOpHook = hooks.PreToolUse![0];

      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'mkfs.ext4 /dev/sda1' }
      };

      await dangerousOpHook.hooks[0](input, undefined, { signal: new AbortController().signal });

      const blockedEvents = mockEventEmitter.getEvents('dangerous:blocked');
      expect(blockedEvents[0].data).toMatchObject({
        taskId: expect.any(String),
        timestamp: expect.any(Date),
        tool: expect.any(String),
        operationType: expect.stringMatching(/^(file-deletion|system-command|network-request|privilege-escalation|data-modification)$/),
        blockReason: expect.any(String),
        blockedBy: 'DangerousOperationDetector'
      });
    });
  });

  describe('Operation Type Mapping', () => {
    it('should correctly map Bash operations to system-command for high/critical', async () => {
      const hooks = createHooks(context);
      const dangerousOpHook = hooks.PreToolUse![0];

      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'rm -rf /' }
      };

      await dangerousOpHook.hooks[0](input, undefined, { signal: new AbortController().signal });

      const events = mockEventEmitter.getEvents('dangerous:detected');
      expect(events[0].data.operationType).toBe('system-command');
    });

    it('should map Bash medium risk to privilege-escalation', async () => {
      const hooks = createHooks(context);
      const dangerousOpHook = hooks.PreToolUse![0];

      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'sudo ls' }
      };

      await dangerousOpHook.hooks[0](input, undefined, { signal: new AbortController().signal });

      const events = mockEventEmitter.getEvents('dangerous:detected');
      expect(events[0].data.operationType).toBe('privilege-escalation');
    });

    it('should map file operations to correct operation types', async () => {
      const hooks = createHooks(context);
      const dangerousOpHook = hooks.PreToolUse![0];

      // High severity file operation should map to file-deletion
      const criticalInput: HookInput = {
        tool_name: 'Write',
        tool_input: { file_path: '/etc/shadow', content: 'test' }
      };

      await dangerousOpHook.hooks[0](criticalInput, undefined, { signal: new AbortController().signal });

      const events = mockEventEmitter.getEvents('dangerous:detected');
      expect(events[0].data.operationType).toBe('file-deletion');
    });

    it('should map WebFetch to network-request', async () => {
      const hooks = createHooks(context);
      const dangerousOpHook = hooks.PreToolUse![0];

      const input: HookInput = {
        tool_name: 'WebFetch',
        tool_input: { url: 'file:///etc/passwd' }
      };

      await dangerousOpHook.hooks[0](input, undefined, { signal: new AbortController().signal });

      const events = mockEventEmitter.getEvents('dangerous:detected');
      expect(events[0].data.operationType).toBe('network-request');
    });
  });
});
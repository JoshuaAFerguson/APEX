import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createHooks, HookContext } from './hooks';
import { TaskStore } from './store';
import type { Task } from '@apexcli/core';
import type { HookInput } from '@anthropic-ai/claude-agent-sdk';

describe('WebFetch Hooks Edge Cases', () => {
  let testDir: string;
  let store: TaskStore;
  let taskId: string;
  let context: HookContext;

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_webfetch_edge`,
    description: 'Test task for WebFetch hooks edge cases',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    projectPath: testDir,
    branchName: 'apex/webfetch-edge-test',
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
    logs: [],
    artifacts: [],
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-webfetch-hooks-edge-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    store = new TaskStore(testDir);
    await store.initialize();

    const task = createTestTask();
    taskId = task.id;
    await store.createTask(task);

    context = { taskId, store };
  });

  afterEach(async () => {
    store.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('auditWebFetchRequest edge cases', () => {
    it('should handle WebFetch with malformed input structure', async () => {
      const hooks = createHooks(context);
      const webFetchMatcher = hooks.PreToolUse?.find(m => m.matcher === 'WebFetch');
      const auditHook = webFetchMatcher?.hooks[0];

      // Test with malformed tool_input
      const input: HookInput = {
        tool_name: 'WebFetch',
        tool_input: 'invalid-input-format', // Should be object
      };

      const result = await auditHook?.(input, 'tool-1', { signal: new AbortController().signal });
      expect(result).toEqual({});

      // Verify it didn't crash and logged something
      const task = await store.getTask(taskId);
      expect(task).not.toBeNull();
    });

    it('should handle WebFetch with missing url in input', async () => {
      const hooks = createHooks(context);
      const webFetchMatcher = hooks.PreToolUse?.find(m => m.matcher === 'WebFetch');
      const auditHook = webFetchMatcher?.hooks[0];

      const input: HookInput = {
        tool_name: 'WebFetch',
        tool_input: {
          method: 'GET',
          // No URL provided
        },
      };

      const result = await auditHook?.(input, 'tool-1', { signal: new AbortController().signal });
      expect(result).toEqual({});

      // Should have logged the request with empty URL
      const task = await store.getTask(taskId);
      const infoLogs = task?.logs.filter(l => l.level === 'info');
      expect(infoLogs?.some(l => l.message.includes('WebFetch request'))).toBe(true);
    });

    it('should handle WebFetch with null tool_input', async () => {
      const hooks = createHooks(context);
      const webFetchMatcher = hooks.PreToolUse?.find(m => m.matcher === 'WebFetch');
      const auditHook = webFetchMatcher?.hooks[0];

      const input: HookInput = {
        tool_name: 'WebFetch',
        tool_input: null,
      };

      const result = await auditHook?.(input, 'tool-1', { signal: new AbortController().signal });
      expect(result).toEqual({});

      // Should not crash
      const task = await store.getTask(taskId);
      expect(task).not.toBeNull();
    });

    it('should handle WebFetch with undefined method gracefully', async () => {
      const hooks = createHooks(context);
      const webFetchMatcher = hooks.PreToolUse?.find(m => m.matcher === 'WebFetch');
      const auditHook = webFetchMatcher?.hooks[0];

      const input: HookInput = {
        tool_name: 'WebFetch',
        tool_input: {
          url: 'https://example.com',
          method: undefined,
        },
      };

      const result = await auditHook?.(input, 'tool-1', { signal: new AbortController().signal });
      expect(result).toEqual({});

      // Should log with GET as default method
      const task = await store.getTask(taskId);
      const infoLogs = task?.logs.filter(l => l.level === 'info');
      expect(infoLogs?.some(l => l.message.includes('GET https://example.com'))).toBe(true);
    });

    it('should handle WebFetch with empty object tool_input', async () => {
      const hooks = createHooks(context);
      const webFetchMatcher = hooks.PreToolUse?.find(m => m.matcher === 'WebFetch');
      const auditHook = webFetchMatcher?.hooks[0];

      const input: HookInput = {
        tool_name: 'WebFetch',
        tool_input: {},
      };

      const result = await auditHook?.(input, 'tool-1', { signal: new AbortController().signal });
      expect(result).toEqual({});

      // Should log empty URL and default GET method
      const task = await store.getTask(taskId);
      const infoLogs = task?.logs.filter(l => l.level === 'info');
      expect(infoLogs?.some(l => l.message.includes('WebFetch request: GET'))).toBe(true);
    });
  });

  describe('validateNetworkPermissions edge cases', () => {
    it('should handle invalid URL constructor scenarios', async () => {
      const hooks = createHooks(context);
      const webFetchMatcher = hooks.PreToolUse?.find(m => m.matcher === 'WebFetch');
      const permissionHook = webFetchMatcher?.hooks[1];

      const invalidUrls = [
        '',
        'just-a-string',
        'http://',
        'https://',
        'ftp:invalid',
        'http://[invalid-ipv6',
        'https://.',
      ];

      for (const url of invalidUrls) {
        const input: HookInput = {
          tool_name: 'WebFetch',
          tool_input: { url },
        };

        const result = await permissionHook?.(input, 'tool-1', { signal: new AbortController().signal });

        expect(result).toHaveProperty('hookSpecificOutput');
        expect(result?.hookSpecificOutput?.permissionDecision).toBe('deny');
        expect(result?.hookSpecificOutput?.permissionDecisionReason).toContain('Invalid URL format');
      }
    });

    it('should handle URL with unusual but valid formats', async () => {
      const hooks = createHooks(context);
      const webFetchMatcher = hooks.PreToolUse?.find(m => m.matcher === 'WebFetch');
      const permissionHook = webFetchMatcher?.hooks[1];

      // Valid but unusual URLs that should be allowed
      const validUrls = [
        'https://example.com:8080',
        'https://sub.domain.example.com',
        'https://example.com/path?query=value&other=123',
        'https://example.com/path#fragment',
        'https://api-v2.service.co.uk',
      ];

      for (const url of validUrls) {
        const input: HookInput = {
          tool_name: 'WebFetch',
          tool_input: { url },
        };

        const result = await permissionHook?.(input, 'tool-1', { signal: new AbortController().signal });
        expect(result).toEqual({});
      }
    });

    it('should handle edge case IP addresses', async () => {
      const hooks = createHooks(context);
      const webFetchMatcher = hooks.PreToolUse?.find(m => m.matcher === 'WebFetch');
      const permissionHook = webFetchMatcher?.hooks[1];

      const restrictedIps = [
        'http://127.0.0.1:8080',
        'https://192.168.0.1',
        'http://10.1.1.1',
        'https://172.16.1.1',
        'http://169.254.1.1',
      ];

      for (const url of restrictedIps) {
        const input: HookInput = {
          tool_name: 'WebFetch',
          tool_input: { url },
        };

        const result = await permissionHook?.(input, 'tool-1', { signal: new AbortController().signal });

        expect(result).toHaveProperty('hookSpecificOutput');
        expect(result?.hookSpecificOutput?.permissionDecision).toBe('deny');
      }
    });

    it('should handle case sensitivity in restricted patterns', async () => {
      const hooks = createHooks(context);
      const webFetchMatcher = hooks.PreToolUse?.find(m => m.matcher === 'WebFetch');
      const permissionHook = webFetchMatcher?.hooks[1];

      const caseVariations = [
        'http://LOCALHOST',
        'https://LocalHost:3000',
        'http://internal.LOCAL',
        'https://server.local/path',
      ];

      for (const url of caseVariations) {
        const input: HookInput = {
          tool_name: 'WebFetch',
          tool_input: { url },
        };

        const result = await permissionHook?.(input, 'tool-1', { signal: new AbortController().signal });

        expect(result).toHaveProperty('hookSpecificOutput');
        expect(result?.hookSpecificOutput?.permissionDecision).toBe('deny');
      }
    });

    it('should handle protocols with different casing', async () => {
      const hooks = createHooks(context);
      const webFetchMatcher = hooks.PreToolUse?.find(m => m.matcher === 'WebFetch');
      const permissionHook = webFetchMatcher?.hooks[1];

      const protocolVariations = [
        'HTTP://example.com',
        'HTTPS://example.com',
        'File:///etc/passwd',
        'FTP://server.com',
      ];

      for (const url of protocolVariations) {
        const input: HookInput = {
          tool_name: 'WebFetch',
          tool_input: { url },
        };

        const result = await permissionHook?.(input, 'tool-1', { signal: new AbortController().signal });

        if (url.toLowerCase().startsWith('http')) {
          // HTTP/HTTPS should be allowed
          expect(result).toEqual({});
        } else {
          // Other protocols should be blocked
          expect(result?.hookSpecificOutput?.permissionDecision).toBe('deny');
        }
      }
    });

    it('should handle sensitive URL patterns with different cases', async () => {
      const hooks = createHooks(context);
      const webFetchMatcher = hooks.PreToolUse?.find(m => m.matcher === 'WebFetch');
      const permissionHook = webFetchMatcher?.hooks[1];

      const sensitiveUrls = [
        'https://api.example.com/PASSWORD/reset',
        'https://service.com/Secret-endpoint',
        'https://auth.provider.com/TOKEN/refresh',
        'https://api.service.com/Api-Key/generate',
        'https://example.com/CREDENTIALS/list',
      ];

      for (const url of sensitiveUrls) {
        const input: HookInput = {
          tool_name: 'WebFetch',
          tool_input: { url },
        };

        const result = await permissionHook?.(input, 'tool-1', { signal: new AbortController().signal });

        // Should allow but log warning
        expect(result).toEqual({});

        const task = await store.getTask(taskId);
        const warnLogs = task?.logs.filter(l => l.level === 'warn');
        expect(warnLogs?.some(l => l.message.includes('potentially sensitive endpoint'))).toBe(true);
      }
    });
  });

  describe('onToolUse callback edge cases', () => {
    it('should handle onToolUse callback that throws exception', async () => {
      const onToolUse = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });

      const contextWithCallback: HookContext = { taskId, store, onToolUse };
      const hooks = createHooks(contextWithCallback);

      const webFetchMatcher = hooks.PreToolUse?.find(m => m.matcher === 'WebFetch');
      const auditHook = webFetchMatcher?.hooks[0];

      const input: HookInput = {
        tool_name: 'WebFetch',
        tool_input: { url: 'https://example.com' },
      };

      // Should not fail even if callback throws
      const result = await auditHook?.(input, 'tool-1', { signal: new AbortController().signal });
      expect(result).toEqual({});
      expect(onToolUse).toHaveBeenCalled();
    });

    it('should handle onToolUse callback with async operations', async () => {
      let callbackCompleted = false;
      const onToolUse = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        callbackCompleted = true;
      });

      const contextWithCallback: HookContext = { taskId, store, onToolUse };
      const hooks = createHooks(contextWithCallback);

      const webFetchMatcher = hooks.PreToolUse?.find(m => m.matcher === 'WebFetch');
      const auditHook = webFetchMatcher?.hooks[0];

      const input: HookInput = {
        tool_name: 'WebFetch',
        tool_input: { url: 'https://example.com' },
      };

      const result = await auditHook?.(input, 'tool-1', { signal: new AbortController().signal });
      expect(result).toEqual({});
      expect(onToolUse).toHaveBeenCalledWith('WebFetch', {
        url: 'https://example.com',
        method: 'GET'
      });
    });

    it('should pass correct parameters to onToolUse callback', async () => {
      const onToolUse = vi.fn();
      const contextWithCallback: HookContext = { taskId, store, onToolUse };
      const hooks = createHooks(contextWithCallback);

      const webFetchMatcher = hooks.PreToolUse?.find(m => m.matcher === 'WebFetch');
      const auditHook = webFetchMatcher?.hooks[0];

      const testCases = [
        {
          input: { url: 'https://api.github.com', method: 'POST' },
          expected: { url: 'https://api.github.com', method: 'POST' }
        },
        {
          input: { url: 'https://example.com' },
          expected: { url: 'https://example.com', method: 'GET' }
        },
        {
          input: { url: 'https://service.com', method: 'PUT', headers: { 'Content-Type': 'application/json' } },
          expected: { url: 'https://service.com', method: 'PUT' }
        },
      ];

      for (const testCase of testCases) {
        onToolUse.mockClear();

        const input: HookInput = {
          tool_name: 'WebFetch',
          tool_input: testCase.input,
        };

        await auditHook?.(input, 'tool-1', { signal: new AbortController().signal });
        expect(onToolUse).toHaveBeenCalledWith('WebFetch', testCase.expected);
      }
    });
  });

  describe('Hook timeout and performance', () => {
    it('should complete hooks within reasonable time', async () => {
      const hooks = createHooks(context);
      const webFetchMatcher = hooks.PreToolUse?.find(m => m.matcher === 'WebFetch');

      expect(webFetchMatcher?.timeout).toBe(5); // 5 second timeout

      const input: HookInput = {
        tool_name: 'WebFetch',
        tool_input: { url: 'https://example.com' },
      };

      const startTime = Date.now();

      // Execute both audit and permission hooks
      for (const hook of webFetchMatcher?.hooks || []) {
        await hook(input, 'tool-1', { signal: new AbortController().signal });
      }

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should complete well under the timeout
      expect(executionTime).toBeLessThan(1000); // 1 second should be plenty
    });

    it('should handle AbortSignal properly', async () => {
      const hooks = createHooks(context);
      const webFetchMatcher = hooks.PreToolUse?.find(m => m.matcher === 'WebFetch');
      const auditHook = webFetchMatcher?.hooks[0];

      const input: HookInput = {
        tool_name: 'WebFetch',
        tool_input: { url: 'https://example.com' },
      };

      const controller = new AbortController();

      // Signal should be passed through but not affect the hook
      const result = await auditHook?.(input, 'tool-1', { signal: controller.signal });
      expect(result).toEqual({});

      // Test with already aborted signal
      const abortedController = new AbortController();
      abortedController.abort();

      const result2 = await auditHook?.(input, 'tool-1', { signal: abortedController.signal });
      expect(result2).toEqual({});
    });
  });
});
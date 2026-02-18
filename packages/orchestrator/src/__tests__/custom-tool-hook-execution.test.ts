/**
 * Comprehensive tests for custom tool hook execution order and lifecycle
 *
 * This test suite covers:
 * - Hook registration and execution order
 * - Pre-hook and post-hook lifecycle
 * - Hook cancellation and error handling
 * - Hook context data flow
 * - Multiple hook execution sequencing
 * - Hook timeout handling
 * - Custom tool integration with hooks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HookManager } from '../hook-manager';
import { TaskStore } from '../store';
import {
  type ToolHookConfig,
  type ToolHookDefinition,
  type PreHookContext,
  type PostHookContext,
  type PreHookResult,
  type PostHookResult,
  PreHookAction,
} from '@apexcli/core';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

describe('Custom Tool Hook Execution', () => {
  let hookManager: HookManager;
  let store: TaskStore;
  let tempDir: string;
  let hooksDir: string;
  let executionOrder: string[];

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-hook-test-'));
    hooksDir = path.join(tempDir, 'hooks');
    await fs.mkdir(hooksDir, { recursive: true });

    // Create .apex/tmp directory for hook context files
    const apexTmpDir = path.join(tempDir, '.apex', 'tmp');
    await fs.mkdir(apexTmpDir, { recursive: true });

    store = new TaskStore(path.join(tempDir, 'test.db'));
    await store.initialize();
    executionOrder = [];
  });

  afterEach(async () => {
    if (store) {
      await store.close();
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const createTestHookScript = async (
    name: string,
    action: 'continue' | 'cancel' | 'modify' = 'continue',
    options: {
      modifiedArgs?: Record<string, any>;
      failOnError?: boolean;
      timeout?: number;
      logMessage?: string;
    } = {}
  ): Promise<string> => {
    const scriptPath = path.join(hooksDir, `${name}.js`);

    let script = `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Read context from the file passed as argument
const contextFile = process.argv[2];
const contextData = JSON.parse(fs.readFileSync(contextFile, 'utf-8'));

// Log execution for testing
console.error('Hook ${name} executed with tool:', contextData.toolName);

`;

    if (options.logMessage) {
      script += `console.error('${options.logMessage}');\n`;
    }

    if (action === 'cancel') {
      script += `
const result = {
  action: 'cancel',
  reason: 'Hook ${name} cancelled execution',
  cancelResult: { success: false, error: 'Cancelled by hook' }
};
console.log(JSON.stringify(result));
`;
    } else if (action === 'modify' && options.modifiedArgs) {
      script += `
const result = {
  action: 'modify',
  modifiedArguments: ${JSON.stringify(options.modifiedArgs)},
  metadata: { modifiedBy: '${name}' }
};
console.log(JSON.stringify(result));
`;
    } else {
      script += `
const result = {
  action: 'continue',
  metadata: { processedBy: '${name}' }
};
console.log(JSON.stringify(result));
`;
    }

    script += `
process.exit(0);
`;

    await fs.writeFile(scriptPath, script);
    await fs.chmod(scriptPath, '755');

    return scriptPath;
  };

  const createFailingHookScript = async (name: string): Promise<string> => {
    const scriptPath = path.join(hooksDir, `${name}.js`);

    const script = `#!/usr/bin/env node
console.error('Hook ${name} failed intentionally');
process.exit(1);
`;

    await fs.writeFile(scriptPath, script);
    await fs.chmod(scriptPath, '755');

    return scriptPath;
  };

  describe('Hook Registration', () => {
    it('should register pre-hooks and post-hooks correctly', async () => {
      const preHookPath = await createTestHookScript('pre-hook-test');
      const postHookPath = await createTestHookScript('post-hook-test');

      const preHooks: ToolHookDefinition[] = [
        {
          name: 'log-start',
          type: 'pre',
          handlerPath: preHookPath,
          tools: [],
        },
      ];

      const postHooks: ToolHookDefinition[] = [
        {
          name: 'log-complete',
          type: 'post',
          handlerPath: postHookPath,
          tools: [],
        },
      ];

      const toolHookConfig: ToolHookConfig = {
        enabled: true,
        pre: preHooks,
        post: postHooks,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(tempDir, store, [], toolHookConfig);
      expect(hookManager).toBeDefined();
      expect(hookManager.getToolHookConfig().pre).toHaveLength(1);
      expect(hookManager.getToolHookConfig().post).toHaveLength(1);
    });

    it('should handle empty hook configurations', () => {
      const emptyConfig: ToolHookConfig = {
        enabled: true,
        pre: [],
        post: [],
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(tempDir, store, [], emptyConfig);
      expect(hookManager).toBeDefined();
      expect(hookManager.getToolHookConfig().pre).toHaveLength(0);
      expect(hookManager.getToolHookConfig().post).toHaveLength(0);
    });

    it('should handle disabled hook configuration', () => {
      const disabledConfig: ToolHookConfig = {
        enabled: false,
        pre: [
          {
            name: 'disabled-hook',
            type: 'pre',
            handlerPath: '/path/to/handler.js',
            tools: []
          }
        ],
        post: [],
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(tempDir, store, [], disabledConfig);
      expect(hookManager).toBeDefined();
      expect(hookManager.getToolHookConfig().enabled).toBe(false);
    });
  });

  describe('Pre-Hook Execution Order', () => {
    it('should execute pre-hooks in defined order', async () => {
      const firstHookPath = await createTestHookScript('first-hook', 'continue', {
        logMessage: 'First hook executed'
      });
      const secondHookPath = await createTestHookScript('second-hook', 'continue', {
        logMessage: 'Second hook executed'
      });
      const thirdHookPath = await createTestHookScript('third-hook', 'continue', {
        logMessage: 'Third hook executed'
      });

      const preHooks: ToolHookDefinition[] = [
        {
          name: 'first-hook',
          type: 'pre',
          handlerPath: firstHookPath,
          tools: [],
        },
        {
          name: 'second-hook',
          type: 'pre',
          handlerPath: secondHookPath,
          tools: [],
        },
        {
          name: 'third-hook',
          type: 'pre',
          handlerPath: thirdHookPath,
          tools: [],
        },
      ];

      const toolHookConfig: ToolHookConfig = {
        enabled: true,
        pre: preHooks,
        post: [],
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(tempDir, store, [], toolHookConfig);

      const hookExecutionEvents: Array<{ type: string; name: string }> = [];

      hookManager.on('hook:pre:start', (event) => {
        hookExecutionEvents.push({ type: 'start', name: event.hookName });
      });

      hookManager.on('hook:pre:complete', (event) => {
        hookExecutionEvents.push({ type: 'complete', name: event.hookName });
      });

      const context: PreHookContext = {
        toolName: 'TestTool',
        arguments: { test: 'value' },
        timestamp: new Date(),
        invocationId: 'test-call-1',
      };

      const result = await hookManager.executePreHooks(context);

      expect(result.success).toBe(true);
      expect(hookExecutionEvents).toEqual([
        { type: 'start', name: 'first-hook' },
        { type: 'complete', name: 'first-hook' },
        { type: 'start', name: 'second-hook' },
        { type: 'complete', name: 'second-hook' },
        { type: 'start', name: 'third-hook' },
        { type: 'complete', name: 'third-hook' },
      ]);
    });

    it('should stop execution if pre-hook cancels', async () => {
      const firstHookPath = await createTestHookScript('first-hook', 'continue');
      const cancelHookPath = await createTestHookScript('cancel-hook', 'cancel');
      const thirdHookPath = await createTestHookScript('third-hook', 'continue');

      const preHooksWithCancel: ToolHookDefinition[] = [
        {
          name: 'first-hook',
          type: 'pre',
          handlerPath: firstHookPath,
          tools: [],
        },
        {
          name: 'cancel-hook',
          type: 'pre',
          handlerPath: cancelHookPath,
          tools: [],
        },
        {
          name: 'third-hook',
          type: 'pre',
          handlerPath: thirdHookPath,
          tools: [],
        },
      ];

      const cancelToolHookConfig: ToolHookConfig = {
        enabled: true,
        pre: preHooksWithCancel,
        post: [],
        defaultTimeoutMs: 30000,
      };

      const cancelHookManager = new HookManager(tempDir, store, [], cancelToolHookConfig);

      const hookEvents: string[] = [];
      cancelHookManager.on('hook:pre:start', (event) => {
        hookEvents.push(`start:${event.hookName}`);
      });

      cancelHookManager.on('hook:pre:complete', (event) => {
        hookEvents.push(`complete:${event.hookName}:${event.success}`);
      });

      const context: PreHookContext = {
        toolName: 'TestTool',
        arguments: { test: 'value' },
        timestamp: new Date(),
        invocationId: 'test-call-1',
      };

      const result = await cancelHookManager.executePreHooks(context);

      expect(result.success).toBe(true);  // The hook manager returns success with cancellation
      expect(result.cancelled).toBe(true);

      // Should execute first hook and cancel hook, but not third hook
      expect(hookEvents).toContain('start:first-hook');
      expect(hookEvents).toContain('complete:first-hook:true');
      expect(hookEvents).toContain('start:cancel-hook');
      expect(hookEvents).toContain('complete:cancel-hook:true');
      expect(hookEvents).not.toContain('start:third-hook');
    });

    it('should handle hook timeout scenarios', async () => {
      const timeoutHookPath = await createTestHookScript('timeout-hook');

      // Modify the script to sleep longer than the timeout
      const longSleepScript = `#!/usr/bin/env node
const fs = require('fs');

// Sleep for 2 seconds (longer than timeout)
setTimeout(() => {
  console.log(JSON.stringify({ action: 'continue' }));
  process.exit(0);
}, 2000);
`;

      await fs.writeFile(timeoutHookPath, longSleepScript);
      await fs.chmod(timeoutHookPath, '755');

      const timeoutHooks: ToolHookDefinition[] = [
        {
          name: 'timeout-hook',
          type: 'pre',
          handlerPath: timeoutHookPath,
          timeoutMs: 100, // Timeout after 100ms
          tools: [],
        },
      ];

      const timeoutConfig: ToolHookConfig = {
        enabled: true,
        pre: timeoutHooks,
        post: [],
        defaultTimeoutMs: 100,
      };

      const timeoutHookManager = new HookManager(tempDir, store, [], timeoutConfig);

      const context: PreHookContext = {
        toolName: 'TestTool',
        arguments: {},
        timestamp: new Date(),
        invocationId: 'test-call-1',
      };

      const start = Date.now();
      const result = await timeoutHookManager.executePreHooks(context);
      const duration = Date.now() - start;

      expect(result.success).toBe(false);
      expect(duration).toBeLessThan(1000); // Should timeout quickly, not wait 2 seconds
    });
  });

  describe('Post-Hook Execution Order', () => {
    it('should execute post-hooks in defined order', async () => {
      const cleanupFirstPath = await createTestHookScript('cleanup-first');
      const cleanupSecondPath = await createTestHookScript('cleanup-second');
      const finalizePath = await createTestHookScript('finalize');

      const postHooks: ToolHookDefinition[] = [
        {
          name: 'cleanup-first',
          type: 'post',
          handlerPath: cleanupFirstPath,
          tools: [],
        },
        {
          name: 'cleanup-second',
          type: 'post',
          handlerPath: cleanupSecondPath,
          tools: [],
        },
        {
          name: 'finalize',
          type: 'post',
          handlerPath: finalizePath,
          tools: [],
        },
      ];

      const toolHookConfig: ToolHookConfig = {
        enabled: true,
        pre: [],
        post: postHooks,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(tempDir, store, [], toolHookConfig);

      const hookEvents: string[] = [];

      hookManager.on('hook:post:start', (event) => {
        hookEvents.push(`start:${event.hookName}`);
      });

      hookManager.on('hook:post:complete', (event) => {
        hookEvents.push(`complete:${event.hookName}`);
      });

      const context: PostHookContext = {
        toolName: 'TestTool',
        arguments: { test: 'value' },
        result: {
          success: true,
          output: 'tool result',
        },
        timestamp: new Date(),
        invocationId: 'test-call-1',
      };

      const result = await hookManager.executePostHooks(context);

      expect(result.success).toBe(true);
      expect(hookEvents).toEqual([
        'start:cleanup-first',
        'complete:cleanup-first',
        'start:cleanup-second',
        'complete:cleanup-second',
        'start:finalize',
        'complete:finalize',
      ]);
    });

    it('should continue post-hook execution even if one fails', async () => {
      const successHookPath = await createTestHookScript('success-hook');
      const failingHookPath = await createFailingHookScript('failing-hook');
      const finalHookPath = await createTestHookScript('final-hook');

      const postHooksWithFailure: ToolHookDefinition[] = [
        {
          name: 'success-hook',
          type: 'post',
          handlerPath: successHookPath,
          tools: [],
        },
        {
          name: 'failing-hook',
          type: 'post',
          handlerPath: failingHookPath,
          tools: [],
          failOnError: false, // Ensure it doesn't stop execution
        },
        {
          name: 'final-hook',
          type: 'post',
          handlerPath: finalHookPath,
          tools: [],
        },
      ];

      const failureConfig: ToolHookConfig = {
        enabled: true,
        pre: [],
        post: postHooksWithFailure,
        defaultTimeoutMs: 30000,
      };

      const failureHookManager = new HookManager(tempDir, store, [], failureConfig);

      const hookEvents: Array<{ name: string; success: boolean }> = [];
      failureHookManager.on('hook:post:complete', (event) => {
        hookEvents.push({ name: event.hookName, success: event.success });
      });

      const context: PostHookContext = {
        toolName: 'TestTool',
        arguments: {},
        result: {
          success: true,
          output: 'test result',
        },
        timestamp: new Date(),
        invocationId: 'test-call-1',
      };

      const result = await failureHookManager.executePostHooks(context);

      // Post-hooks should continue executing even if one fails
      expect(hookEvents).toHaveLength(3);
      expect(hookEvents[0]).toEqual({ name: 'success-hook', success: true });
      expect(hookEvents[1]).toEqual({ name: 'failing-hook', success: false });
      expect(hookEvents[2]).toEqual({ name: 'final-hook', success: true });
    });
  });

  describe('Hook Context and Data Flow', () => {
    it('should pass context data to hook scripts', async () => {
      const contextHookPath = await createTestHookScript('context-hook');

      // Create a custom script that validates context data
      const contextValidationScript = `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const contextFile = process.argv[2];
const contextData = JSON.parse(fs.readFileSync(contextFile, 'utf-8'));

// Validate context contains expected data
const expectedTool = 'CustomTool';
const expectedCallId = 'call-123';

if (contextData.toolName !== expectedTool) {
  console.error('Wrong tool name:', contextData.toolName);
  process.exit(1);
}

if (contextData.invocationId !== expectedCallId) {
  console.error('Wrong call ID:', contextData.invocationId);
  process.exit(1);
}

if (!contextData.arguments || contextData.arguments.message !== 'test message') {
  console.error('Wrong arguments:', contextData.arguments);
  process.exit(1);
}

const result = {
  action: 'continue',
  metadata: { validatedContext: true }
};
console.log(JSON.stringify(result));
process.exit(0);
`;

      await fs.writeFile(contextHookPath, contextValidationScript);
      await fs.chmod(contextHookPath, '755');

      const contextHooks: ToolHookDefinition[] = [
        {
          name: 'context-hook',
          type: 'pre',
          handlerPath: contextHookPath,
          tools: [],
        },
      ];

      const toolHookConfig: ToolHookConfig = {
        enabled: true,
        pre: contextHooks,
        post: [],
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(tempDir, store, [], toolHookConfig);

      const context: PreHookContext = {
        toolName: 'CustomTool',
        arguments: { message: 'test message', count: 42 },
        timestamp: new Date(),
        invocationId: 'call-123',
      };

      const result = await hookManager.executePreHooks(context);

      expect(result.success).toBe(true);
    });

    it('should handle complex nested context data', async () => {
      const nestedHookPath = await createTestHookScript('nested-hook');

      const nestedValidationScript = `#!/usr/bin/env node
const fs = require('fs');

const contextFile = process.argv[2];
const contextData = JSON.parse(fs.readFileSync(contextFile, 'utf-8'));

// Validate nested structure
if (!contextData.arguments.config ||
    !contextData.arguments.config.database ||
    contextData.arguments.config.database.host !== 'localhost') {
  console.error('Invalid nested config');
  process.exit(1);
}

console.log(JSON.stringify({ action: 'continue' }));
`;

      await fs.writeFile(nestedHookPath, nestedValidationScript);
      await fs.chmod(nestedHookPath, '755');

      const toolHookConfig: ToolHookConfig = {
        enabled: true,
        pre: [{
          name: 'nested-hook',
          type: 'pre',
          handlerPath: nestedHookPath,
          tools: [],
        }],
        post: [],
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(tempDir, store, [], toolHookConfig);

      const context: PreHookContext = {
        toolName: 'NestedTool',
        arguments: {
          config: {
            database: { host: 'localhost', port: 5432 }
          },
          options: ['verbose', 'debug']
        },
        timestamp: new Date(),
        invocationId: 'complex-call',
      };

      const result = await hookManager.executePreHooks(context);
      expect(result.success).toBe(true);
    });
  });

  describe('Hook Event Emissions', () => {
    it('should emit hook lifecycle events', async () => {
      const preHookPath = await createTestHookScript('event-hook-pre');
      const postHookPath = await createTestHookScript('event-hook-post');

      const eventHooks: ToolHookDefinition[] = [
        {
          name: 'event-hook',
          type: 'pre',
          handlerPath: preHookPath,
          tools: [],
        },
      ];

      const postEventHooks: ToolHookDefinition[] = [
        {
          name: 'event-hook',
          type: 'post',
          handlerPath: postHookPath,
          tools: [],
        },
      ];

      const toolHookConfig: ToolHookConfig = {
        enabled: true,
        pre: eventHooks,
        post: postEventHooks,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(tempDir, store, [], toolHookConfig);

      const events: Array<{ type: string; phase: string; name: string }> = [];

      hookManager.on('hook:pre:start', (event) => {
        events.push({ type: 'start', phase: 'pre', name: event.hookName });
      });

      hookManager.on('hook:pre:complete', (event) => {
        events.push({ type: 'complete', phase: 'pre', name: event.hookName });
      });

      hookManager.on('hook:post:start', (event) => {
        events.push({ type: 'start', phase: 'post', name: event.hookName });
      });

      hookManager.on('hook:post:complete', (event) => {
        events.push({ type: 'complete', phase: 'post', name: event.hookName });
      });

      const preContext: PreHookContext = {
        toolName: 'EventTool',
        arguments: {},
        timestamp: new Date(),
        invocationId: 'event-call',
      };

      const postContext: PostHookContext = {
        toolName: 'EventTool',
        arguments: {},
        result: {
          success: true,
          output: 'test result',
        },
        timestamp: new Date(),
        invocationId: 'event-call',
      };

      await hookManager.executePreHooks(preContext);
      await hookManager.executePostHooks(postContext);

      expect(events).toHaveLength(4);
      expect(events[0]).toEqual({ type: 'start', phase: 'pre', name: 'event-hook' });
      expect(events[1]).toEqual({ type: 'complete', phase: 'pre', name: 'event-hook' });
      expect(events[2]).toEqual({ type: 'start', phase: 'post', name: 'event-hook' });
      expect(events[3]).toEqual({ type: 'complete', phase: 'post', name: 'event-hook' });
    });

    it('should include timing information in completion events', async () => {
      const timingHookPath = await createTestHookScript('timing-hook');

      const toolHookConfig: ToolHookConfig = {
        enabled: true,
        pre: [{
          name: 'timing-hook',
          type: 'pre',
          handlerPath: timingHookPath,
          tools: [],
        }],
        post: [],
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(tempDir, store, [], toolHookConfig);

      const completionEvents: Array<{ duration: number; timestamp: Date }> = [];

      hookManager.on('hook:pre:complete', (event) => {
        completionEvents.push({
          duration: event.duration,
          timestamp: event.timestamp
        });
      });

      const context: PreHookContext = {
        toolName: 'TimingTool',
        arguments: {},
        timestamp: new Date(),
        invocationId: 'timing-call',
      };

      await hookManager.executePreHooks(context);

      expect(completionEvents).toHaveLength(1);
      expect(completionEvents[0].duration).toBeGreaterThanOrEqual(0);
      expect(completionEvents[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling', () => {
    it('should handle hook execution errors gracefully', async () => {
      const errorHookPath = await createFailingHookScript('error-hook');

      const errorConfig: ToolHookConfig = {
        enabled: true,
        pre: [{
          name: 'error-hook',
          type: 'pre',
          handlerPath: errorHookPath,
          tools: [],
        }],
        post: [],
        defaultTimeoutMs: 30000,
      };

      const errorHookManager = new HookManager(tempDir, store, [], errorConfig);

      const errorEvents: Array<{ name: string; error?: string }> = [];
      errorHookManager.on('hook:pre:complete', (event) => {
        errorEvents.push({
          name: event.hookName,
          error: event.error
        });
      });

      const context: PreHookContext = {
        toolName: 'ErrorTool',
        arguments: {},
        timestamp: new Date(),
        invocationId: 'error-call',
      };

      const result = await errorHookManager.executePreHooks(context);

      expect(result.success).toBe(false);
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].error).toBeDefined();
    });

    it('should handle missing hook handlers', async () => {
      const missingPath = path.join(hooksDir, 'nonexistent-handler.js');

      const missingConfig: ToolHookConfig = {
        enabled: true,
        pre: [{
          name: 'missing-handler',
          type: 'pre',
          handlerPath: missingPath,
          tools: [],
        }],
        post: [],
        defaultTimeoutMs: 30000,
      };

      const missingHookManager = new HookManager(tempDir, store, [], missingConfig);

      const context: PreHookContext = {
        toolName: 'MissingTool',
        arguments: {},
        timestamp: new Date(),
        invocationId: 'missing-call',
      };

      const result = await missingHookManager.executePreHooks(context);
      expect(result.success).toBe(false);
    });
  });

  describe('Tool-specific Hook Filtering', () => {
    it('should only execute hooks for specified tools', async () => {
      const bashHookPath = await createTestHookScript('bash-hook');
      const gitHookPath = await createTestHookScript('git-hook');
      const globalHookPath = await createTestHookScript('global-hook');

      const toolSpecificConfig: ToolHookConfig = {
        enabled: true,
        pre: [
          {
            name: 'bash-only-hook',
            type: 'pre',
            handlerPath: bashHookPath,
            tools: ['bash'],
          },
          {
            name: 'git-only-hook',
            type: 'pre',
            handlerPath: gitHookPath,
            tools: ['git'],
          },
          {
            name: 'global-hook',
            type: 'pre',
            handlerPath: globalHookPath,
            tools: [], // Empty tools means applies to all
          },
        ],
        post: [],
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(tempDir, store, [], toolSpecificConfig);

      const bashEvents: string[] = [];
      const gitEvents: string[] = [];

      hookManager.on('hook:pre:start', (event) => {
        if (event.toolName === 'bash') {
          bashEvents.push(event.hookName);
        } else if (event.toolName === 'git') {
          gitEvents.push(event.hookName);
        }
      });

      // Test bash tool - should trigger bash-only and global hooks
      const bashContext: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'ls' },
        timestamp: new Date(),
        invocationId: 'bash-call',
      };

      await hookManager.executePreHooks(bashContext);

      // Test git tool - should trigger git-only and global hooks
      const gitContext: PreHookContext = {
        toolName: 'git',
        arguments: { command: 'status' },
        timestamp: new Date(),
        invocationId: 'git-call',
      };

      await hookManager.executePreHooks(gitContext);

      // Bash should have triggered bash-only and global hooks
      expect(bashEvents).toContain('bash-only-hook');
      expect(bashEvents).toContain('global-hook');
      expect(bashEvents).not.toContain('git-only-hook');

      // Git should have triggered git-only and global hooks
      expect(gitEvents).toContain('git-only-hook');
      expect(gitEvents).toContain('global-hook');
      expect(gitEvents).not.toContain('bash-only-hook');
    });
  });
});
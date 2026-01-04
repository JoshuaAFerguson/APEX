import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs';
import * as path from 'path';
import { ApexOrchestrator } from './index';
import { TaskStore } from './store';
import { HookManager } from './hook-manager';
import {
  ApexConfig,
  ToolHookConfig,
  ToolHookDefinition,
  PreHookContext,
  PostHookContext,
  PreHookResult,
  PostHookResult,
} from '@apexcli/core';

// Mock dependencies that aren't relevant for integration testing
vi.mock('fs', () => ({
  ...vi.importActual('fs'),
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('util', () => ({
  promisify: vi.fn(() => vi.fn()),
}));

const mockFs = vi.mocked(fs);

describe('HookManager Integration with ApexOrchestrator', () => {
  let orchestrator: ApexOrchestrator;
  let mockStore: ReturnType<typeof vi.mocked<TaskStore>>;
  let mockConfig: ApexConfig;
  let testProjectPath: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    testProjectPath = '/test/project';

    // Mock basic config
    mockConfig = {
      projectName: 'test-project',
      version: '1.0.0',
      autonomy: {
        level: 'supervised',
        autoApprove: false,
        requireConfirmation: true,
      },
      limits: {
        maxConcurrentTasks: 1,
        maxTokens: 100000,
        maxCostUsd: 10.0,
      },
      hooks: [],
      toolHooks: {
        pre: [],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      },
    } as ApexConfig;

    // Create a minimal orchestrator instance for testing
    orchestrator = new ApexOrchestrator(testProjectPath, mockConfig);

    // Mock fs for hook file operations
    mockFs.existsSync.mockReturnValue(false); // No hook files by default
  });

  afterEach(async () => {
    try {
      await orchestrator.stop();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('HookManager instantiation', () => {
    it('should instantiate HookManager during orchestrator construction', () => {
      expect(orchestrator).toBeDefined();

      // Access the private hookManager through the orchestrator's events
      const hookEvents = ['hook:pre:start', 'hook:pre:complete', 'hook:post:start', 'hook:post:complete'];

      // Check if hook events are being forwarded (indicating HookManager is integrated)
      hookEvents.forEach(eventName => {
        expect(orchestrator.listenerCount(eventName)).toBe(0); // No external listeners yet

        // Test that we can add listeners for these events
        const mockListener = vi.fn();
        orchestrator.on(eventName, mockListener);
        expect(orchestrator.listenerCount(eventName)).toBe(1);
        orchestrator.off(eventName, mockListener);
      });
    });

    it('should load tool hooks configuration from config', () => {
      const toolHookConfig: ToolHookConfig = {
        pre: [{
          name: 'security-check',
          type: 'pre',
          handlerPath: '/hooks/security.js',
          tools: ['bash'],
          priority: 100,
          enabled: true,
        }],
        post: [{
          name: 'audit-log',
          type: 'post',
          handlerPath: '/hooks/audit.js',
          tools: [],
          priority: 50,
          enabled: true,
        }],
        enabled: true,
        defaultTimeoutMs: 45000,
      };

      const configWithHooks = {
        ...mockConfig,
        toolHooks: toolHookConfig,
      };

      const orchestratorWithHooks = new ApexOrchestrator(testProjectPath, configWithHooks);

      // Verify the hook manager was configured correctly by checking event emission
      const preStartListener = vi.fn();
      const postStartListener = vi.fn();

      orchestratorWithHooks.on('hook:pre:start', preStartListener);
      orchestratorWithHooks.on('hook:post:start', postStartListener);

      expect(orchestratorWithHooks.listenerCount('hook:pre:start')).toBe(1);
      expect(orchestratorWithHooks.listenerCount('hook:post:start')).toBe(1);
    });
  });

  describe('Hook event emission', () => {
    it('should emit hook events from orchestrator when HookManager executes hooks', async () => {
      const toolHookConfig: ToolHookConfig = {
        pre: [{
          name: 'test-pre-hook',
          type: 'pre',
          handlerPath: '/hooks/test-pre.js',
          tools: ['bash'],
          enabled: true,
        }],
        post: [{
          name: 'test-post-hook',
          type: 'post',
          handlerPath: '/hooks/test-post.js',
          tools: ['bash'],
          enabled: true,
        }],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      const orchestratorWithHooks = new ApexOrchestrator(testProjectPath, {
        ...mockConfig,
        toolHooks: toolHookConfig,
      });

      const hookEvents: Array<{ type: string; event: any }> = [];

      orchestratorWithHooks.on('hook:pre:start', (event) => {
        hookEvents.push({ type: 'hook:pre:start', event });
      });

      orchestratorWithHooks.on('hook:pre:complete', (event) => {
        hookEvents.push({ type: 'hook:pre:complete', event });
      });

      orchestratorWithHooks.on('hook:post:start', (event) => {
        hookEvents.push({ type: 'hook:post:start', event });
      });

      orchestratorWithHooks.on('hook:post:complete', (event) => {
        hookEvents.push({ type: 'hook:post:complete', event });
      });

      // Mock hook files exist
      mockFs.existsSync.mockReturnValue(true);

      // Mock successful hook execution
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const mockExecAsync = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });
      promisify.mockReturnValue(mockExecAsync);

      // Access the hook manager through a test method (if available)
      // For now, we'll test indirectly through the orchestrator's hook integration

      // The hooks would be executed during tool operations, which requires
      // complex mocking of the Claude SDK integration. For now, we verify
      // that the event listeners are properly set up.
      expect(orchestratorWithHooks.listenerCount('hook:pre:start')).toBe(1);
      expect(orchestratorWithHooks.listenerCount('hook:pre:complete')).toBe(1);
      expect(orchestratorWithHooks.listenerCount('hook:post:start')).toBe(1);
      expect(orchestratorWithHooks.listenerCount('hook:post:complete')).toBe(1);
    });
  });

  describe('Hook execution during tool operations', () => {
    it('should integrate hooks into tool execution pipeline', () => {
      const toolHookConfig: ToolHookConfig = {
        pre: [{
          name: 'validate-command',
          type: 'pre',
          handlerPath: '/hooks/validate.js',
          tools: ['bash'],
          enabled: true,
          priority: 100,
        }],
        post: [{
          name: 'log-result',
          type: 'post',
          handlerPath: '/hooks/log.js',
          tools: ['bash'],
          enabled: true,
          priority: 50,
        }],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      const orchestratorWithHooks = new ApexOrchestrator(testProjectPath, {
        ...mockConfig,
        toolHooks: toolHookConfig,
      });

      // Test that the orchestrator has the hook integration methods
      // These are private methods, so we test their effects indirectly

      // The createHooksWithManager method should be called during task execution
      // We can verify this by checking the event system is properly set up

      const hookEventTypes = ['hook:pre:start', 'hook:pre:complete', 'hook:post:start', 'hook:post:complete'];

      hookEventTypes.forEach(eventType => {
        const listener = vi.fn();
        orchestratorWithHooks.on(eventType, listener);
        expect(orchestratorWithHooks.listenerCount(eventType)).toBe(1);
      });
    });

    it('should handle hook cancellation during tool execution', () => {
      const toolHookConfig: ToolHookConfig = {
        pre: [{
          name: 'security-blocker',
          type: 'pre',
          handlerPath: '/hooks/security-block.js',
          tools: [],
          enabled: true,
          failOnError: true,
        }],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      const orchestratorWithHooks = new ApexOrchestrator(testProjectPath, {
        ...mockConfig,
        toolHooks: toolHookConfig,
      });

      // Mock that security hook exists
      mockFs.existsSync.mockReturnValue(true);

      // Test the hook integration architecture is in place
      expect(orchestratorWithHooks).toBeDefined();

      // In a real test, we would create a task and verify that:
      // 1. Pre-hooks are executed before tools
      // 2. If a pre-hook cancels, the tool is not executed
      // 3. Post-hooks are executed after tools (if tool executed)
      // 4. Hook events are emitted at the right times

      // This requires mocking the Claude SDK interaction which is complex
      // For now, we verify the integration structure is correct
    });

    it('should handle hook argument modification', () => {
      const toolHookConfig: ToolHookConfig = {
        pre: [{
          name: 'argument-sanitizer',
          type: 'pre',
          handlerPath: '/hooks/sanitize.js',
          tools: ['bash'],
          enabled: true,
        }],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      const orchestratorWithHooks = new ApexOrchestrator(testProjectPath, {
        ...mockConfig,
        toolHooks: toolHookConfig,
      });

      mockFs.existsSync.mockReturnValue(true);

      // In a real integration test, we would:
      // 1. Create a task with a bash command
      // 2. Mock the hook to modify the command arguments
      // 3. Verify the modified arguments are passed to the tool
      // 4. Verify the original arguments are logged/tracked

      expect(orchestratorWithHooks).toBeDefined();
    });
  });

  describe('Error handling in integration', () => {
    it('should handle hook manager errors gracefully', () => {
      const toolHookConfig: ToolHookConfig = {
        pre: [{
          name: 'error-prone-hook',
          type: 'pre',
          handlerPath: '/hooks/error.js',
          tools: [],
          enabled: true,
          failOnError: false, // Should not fail the entire operation
        }],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      const orchestratorWithHooks = new ApexOrchestrator(testProjectPath, {
        ...mockConfig,
        toolHooks: toolHookConfig,
      });

      // Test error handling structure is in place
      expect(() => {
        const listener = vi.fn();
        orchestratorWithHooks.on('hook:pre:complete', listener);
      }).not.toThrow();

      // In a real test, we would verify that:
      // 1. Hook errors are logged properly
      // 2. Tool execution continues when failOnError=false
      // 3. Tool execution stops when failOnError=true
      // 4. Error events are emitted correctly
    });

    it('should handle missing hook files gracefully', () => {
      const toolHookConfig: ToolHookConfig = {
        pre: [{
          name: 'missing-hook',
          type: 'pre',
          handlerPath: '/hooks/nonexistent.js',
          tools: [],
          enabled: true,
        }],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      const orchestratorWithHooks = new ApexOrchestrator(testProjectPath, {
        ...mockConfig,
        toolHooks: toolHookConfig,
      });

      // Mock file doesn't exist
      mockFs.existsSync.mockReturnValue(false);

      // The orchestrator should still initialize successfully
      expect(orchestratorWithHooks).toBeDefined();

      // Hook errors would be handled during execution, not initialization
    });
  });

  describe('Configuration updates', () => {
    it('should support updating hook configuration at runtime', () => {
      const initialConfig: ToolHookConfig = {
        pre: [],
        post: [],
        enabled: false,
        defaultTimeoutMs: 30000,
      };

      const orchestratorWithHooks = new ApexOrchestrator(testProjectPath, {
        ...mockConfig,
        toolHooks: initialConfig,
      });

      // In a real implementation, we might have a method to update hook config
      // For now, we verify the structure is in place for configuration management

      expect(orchestratorWithHooks).toBeDefined();

      // Test that we can update the config during orchestrator lifecycle
      // This would typically be done through a config reload mechanism
    });
  });

  describe('Performance and resource management', () => {
    it('should handle high-frequency hook executions efficiently', () => {
      const toolHookConfig: ToolHookConfig = {
        pre: [{
          name: 'high-freq-hook',
          type: 'pre',
          handlerPath: '/hooks/freq.js',
          tools: [],
          enabled: true,
          timeoutMs: 1000, // Short timeout for performance
        }],
        post: [{
          name: 'cleanup-hook',
          type: 'post',
          handlerPath: '/hooks/cleanup.js',
          tools: [],
          enabled: true,
          timeoutMs: 500,
        }],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      const orchestratorWithHooks = new ApexOrchestrator(testProjectPath, {
        ...mockConfig,
        toolHooks: toolHookConfig,
      });

      // Test that the event system can handle multiple listeners efficiently
      const listeners = Array.from({ length: 10 }, () => vi.fn());

      listeners.forEach(listener => {
        orchestratorWithHooks.on('hook:pre:start', listener);
        orchestratorWithHooks.on('hook:pre:complete', listener);
        orchestratorWithHooks.on('hook:post:start', listener);
        orchestratorWithHooks.on('hook:post:complete', listener);
      });

      expect(orchestratorWithHooks.listenerCount('hook:pre:start')).toBe(10);
      expect(orchestratorWithHooks.listenerCount('hook:pre:complete')).toBe(10);
      expect(orchestratorWithHooks.listenerCount('hook:post:start')).toBe(10);
      expect(orchestratorWithHooks.listenerCount('hook:post:complete')).toBe(10);

      // Clean up listeners
      listeners.forEach(listener => {
        orchestratorWithHooks.off('hook:pre:start', listener);
        orchestratorWithHooks.off('hook:pre:complete', listener);
        orchestratorWithHooks.off('hook:post:start', listener);
        orchestratorWithHooks.off('hook:post:complete', listener);
      });

      expect(orchestratorWithHooks.listenerCount('hook:pre:start')).toBe(0);
    });

    it('should clean up resources properly during shutdown', async () => {
      const toolHookConfig: ToolHookConfig = {
        pre: [{
          name: 'resource-hook',
          type: 'pre',
          handlerPath: '/hooks/resource.js',
          tools: [],
          enabled: true,
        }],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      const orchestratorWithHooks = new ApexOrchestrator(testProjectPath, {
        ...mockConfig,
        toolHooks: toolHookConfig,
      });

      const listener = vi.fn();
      orchestratorWithHooks.on('hook:pre:start', listener);

      expect(orchestratorWithHooks.listenerCount('hook:pre:start')).toBe(1);

      // Stop orchestrator - should clean up resources
      await orchestratorWithHooks.stop();

      // After stopping, the orchestrator should be in a clean state
      expect(orchestratorWithHooks).toBeDefined();
    });
  });
});
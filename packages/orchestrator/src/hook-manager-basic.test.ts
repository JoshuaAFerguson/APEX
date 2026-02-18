import { describe, it, expect } from 'vitest';
import { HookManager } from './hook-manager';
import { ToolHookConfig } from '@apexcli/core';

// Basic test to verify the class can be instantiated and basic functionality works
describe('HookManager Basic Functionality', () => {
  it('should instantiate with default configuration', () => {
    const mockStore = {
      addLog: () => Promise.resolve(),
    } as any;

    const hookManager = new HookManager('/test/project', mockStore);

    expect(hookManager).toBeDefined();
    expect(hookManager.getToolHookConfig()).toEqual({
      pre: [],
      post: [],
      enabled: true,
      defaultTimeoutMs: 30000,
    });
  });

  it('should instantiate with custom configuration', () => {
    const mockStore = {
      addLog: () => Promise.resolve(),
    } as any;

    const customConfig: ToolHookConfig = {
      pre: [{
        name: 'test-hook',
        type: 'pre',
        handlerPath: '/hooks/test.js',
        tools: ['bash'],
        enabled: true,
      }],
      post: [],
      enabled: false,
      defaultTimeoutMs: 60000,
    };

    const hookManager = new HookManager('/test/project', mockStore, [], customConfig);

    expect(hookManager.getToolHookConfig()).toEqual(customConfig);
  });

  it('should update configuration correctly', () => {
    const mockStore = {
      addLog: () => Promise.resolve(),
    } as any;

    const hookManager = new HookManager('/test/project', mockStore);

    const newConfig: ToolHookConfig = {
      pre: [{
        name: 'new-hook',
        type: 'pre',
        handlerPath: '/hooks/new.js',
        tools: [],
        enabled: true,
      }],
      post: [],
      enabled: true,
      defaultTimeoutMs: 45000,
    };

    hookManager.updateConfig([], newConfig);

    expect(hookManager.getToolHookConfig()).toEqual(newConfig);
  });

  it('should return disabled status when tool hooks disabled', async () => {
    const mockStore = {
      addLog: () => Promise.resolve(),
    } as any;

    const disabledConfig: ToolHookConfig = {
      pre: [{
        name: 'test-hook',
        type: 'pre',
        handlerPath: '/hooks/test.js',
        tools: [],
        enabled: true,
      }],
      post: [],
      enabled: false, // Disabled
      defaultTimeoutMs: 30000,
    };

    const hookManager = new HookManager('/test/project', mockStore, [], disabledConfig);

    const context = {
      toolName: 'bash',
      arguments: { command: 'test' },
      taskId: 'task-123',
      invocationId: 'inv-456',
      timestamp: new Date(),
    };

    const result = await hookManager.executePreHooks(context);
    expect(result).toEqual({ success: true });

    const postResult = await hookManager.executePostHooks({
      ...context,
      result: { success: true, output: 'test', duration: 1000 },
    });
    expect(postResult).toEqual({ success: true });
  });

  it('should be an EventEmitter', () => {
    const mockStore = {
      addLog: () => Promise.resolve(),
    } as any;

    const hookManager = new HookManager('/test/project', mockStore);

    // Should have EventEmitter methods
    expect(typeof hookManager.on).toBe('function');
    expect(typeof hookManager.off).toBe('function');
    expect(typeof hookManager.emit).toBe('function');

    // Test basic event emission
    let eventCaptured = false;
    hookManager.on('test-event' as any, () => {
      eventCaptured = true;
    });

    hookManager.emit('test-event' as any);
    expect(eventCaptured).toBe(true);
  });

  it('should return deep copies of configuration to prevent mutation', () => {
    const mockStore = {
      addLog: () => Promise.resolve(),
    } as any;

    const originalConfig: ToolHookConfig = {
      pre: [{
        name: 'test-hook',
        type: 'pre',
        handlerPath: '/hooks/test.js',
        tools: ['bash'],
        enabled: true,
      }],
      post: [],
      enabled: true,
      defaultTimeoutMs: 30000,
    };

    const hookManager = new HookManager('/test/project', mockStore, [], originalConfig);

    const config1 = hookManager.getToolHookConfig();
    const config2 = hookManager.getToolHookConfig();

    // Modify one copy
    config1.enabled = false;
    config1.pre.push({
      name: 'new-hook',
      type: 'pre',
      handlerPath: '/hooks/new.js',
      tools: [],
      enabled: true,
    });

    // Other copy should be unaffected
    expect(config2.enabled).toBe(true);
    expect(config2.pre).toHaveLength(1);
    expect(config2.pre[0].name).toBe('test-hook');

    // Original configuration should be unaffected
    const config3 = hookManager.getToolHookConfig();
    expect(config3.enabled).toBe(true);
    expect(config3.pre).toHaveLength(1);
  });
});
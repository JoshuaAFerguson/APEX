/**
 * Integration test to verify ContainerExecutionProxy is properly exported and functional
 */

import { describe, it, expect } from 'vitest';

describe('ContainerExecutionProxy Integration', () => {
  it('should be exportable from main package index', async () => {
    // Test importing the ContainerExecutionProxy from the package
    const { ContainerExecutionProxy, createContainerExecutionProxy } = await import('./index');

    expect(ContainerExecutionProxy).toBeDefined();
    expect(createContainerExecutionProxy).toBeDefined();
    expect(typeof ContainerExecutionProxy).toBe('function');
    expect(typeof createContainerExecutionProxy).toBe('function');
  });

  it('should be properly typed with all exported interfaces', async () => {
    const {
      ContainerExecutionProxy,
      createContainerExecutionProxy,
      type ExecutionContext,
      type CommandExecutionOptions,
      type CommandExecutionResult,
    } = await import('./index');

    // Create a mock container manager
    const mockContainerManager = {
      execCommand: async () => ({
        success: true,
        stdout: '',
        stderr: '',
        exitCode: 0,
      }),
    } as any;

    // Verify the factory function works
    const proxy = createContainerExecutionProxy(mockContainerManager);
    expect(proxy).toBeInstanceOf(ContainerExecutionProxy);

    // Verify basic functionality with correct typing
    const context: ExecutionContext = {
      taskId: 'test-task',
      isContainerWorkspace: false,
    };

    const options: CommandExecutionOptions = {
      timeout: 5000,
    };

    const result: CommandExecutionResult = await proxy.execute('echo test', context, options);
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('mode');
    expect(result.mode).toBe('local');
  });
});
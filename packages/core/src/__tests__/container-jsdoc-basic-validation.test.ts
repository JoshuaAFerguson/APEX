/**
 * Basic JSDoc Documentation Tests
 *
 * Simple validation tests to ensure JSDoc examples work correctly
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContainerManager } from '../container-manager';
import { ContainerRuntime } from '../container-runtime';
import { ContainerHealthMonitor } from '../container-health-monitor';

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn()
}));

describe('Container JSDoc Basic Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate ContainerManager can be instantiated as documented', () => {
    // Example from JSDoc: Create with defaults
    const manager1 = new ContainerManager();
    expect(manager1).toBeInstanceOf(ContainerManager);

    // Example from JSDoc: Create with custom runtime and naming
    const customRuntime = new ContainerRuntime();
    const manager2 = new ContainerManager(customRuntime, {
      prefix: 'myapp',
      includeTimestamp: true
    });
    expect(manager2).toBeInstanceOf(ContainerManager);
  });

  it('should validate ContainerRuntime can be instantiated as documented', () => {
    const runtime = new ContainerRuntime();
    expect(runtime).toBeInstanceOf(ContainerRuntime);
  });

  it('should validate ContainerHealthMonitor can be instantiated as documented', () => {
    const manager = new ContainerManager();
    const monitor = new ContainerHealthMonitor(manager, {
      interval: 60000,
      maxFailures: 5,
      timeout: 10000,
      containerPrefix: 'app'
    });
    expect(monitor).toBeInstanceOf(ContainerHealthMonitor);
  });

  it('should validate generateContainerName works as documented', () => {
    const manager = new ContainerManager();

    // Example from JSDoc: Generate with default config
    const name = manager.generateContainerName('task-123');
    expect(name).toMatch(/^apex-/);
    expect(name).toContain('task_123');

    // Example from JSDoc: Generate with custom config
    const customName = manager.generateContainerName('task-123', {
      prefix: 'myapp',
      includeTimestamp: true,
      separator: '_'
    });
    expect(customName).toMatch(/^myapp_/);
    expect(customName).toContain('task_123');
  });

  it('should validate health monitor methods work as documented', () => {
    const manager = new ContainerManager();
    const monitor = new ContainerHealthMonitor(manager, { autoStart: false });

    // Example from JSDoc: Check if monitoring is active
    expect(monitor.isActive()).toBe(false);

    // Example from JSDoc: Get health status map
    const healthStatus = monitor.getHealthStatus();
    expect(healthStatus).toBeInstanceOf(Map);

    // Example from JSDoc: Get monitoring stats
    const stats = monitor.getStats();
    expect(stats).toHaveProperty('isMonitoring');
    expect(stats).toHaveProperty('totalContainers');
    expect(stats).toHaveProperty('healthyContainers');
    expect(stats).toHaveProperty('unhealthyContainers');
  });

  it('should validate runtime cache management as documented', () => {
    const runtime = new ContainerRuntime();

    // Example from JSDoc: Clear cache to force fresh detection
    runtime.clearCache();

    // Should not throw
    expect(() => runtime.clearCache()).not.toThrow();
  });

  it('should validate container naming with special characters is sanitized', () => {
    const manager = new ContainerManager();

    // Test with special characters (should be sanitized)
    const taskId = 'task@#$%^&*()';
    const name = manager.generateContainerName(taskId);

    // Should contain only valid characters
    expect(name).toMatch(/^[a-zA-Z0-9_.-]+$/);
    expect(name).toMatch(/^apex-/);
  });
});
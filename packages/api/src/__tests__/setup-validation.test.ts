/**
 * Simple validation test to verify the test infrastructure setup compiles and works
 */

import { describe, it, expect } from 'vitest';
import { TestDataGenerators, TestSetup } from './setup.js';

describe('Test Infrastructure Validation', () => {
  it('should generate mock task data', () => {
    const task = TestDataGenerators.createMockTask({
      description: 'Validation test task',
      status: 'pending',
    });

    expect(task.description).toBe('Validation test task');
    expect(task.status).toBe('pending');
    expect(task.id).toMatch(/^test-task-/);
    expect(task.createdAt).toBeDefined();
    expect(task.updatedAt).toBeDefined();
  });

  it('should generate mock health metrics', () => {
    const metrics = TestDataGenerators.createMockHealthMetrics({
      uptime: 7200000,
      taskCounts: { processed: 50, succeeded: 45, failed: 3, active: 2 },
    });

    expect(metrics.uptime).toBe(7200000);
    expect(metrics.taskCounts.processed).toBe(50);
    expect(metrics.taskCounts.succeeded).toBe(45);
    expect(metrics.taskCounts.failed).toBe(3);
    expect(metrics.taskCounts.active).toBe(2);
    expect(metrics.memoryUsage).toBeDefined();
    expect(metrics.memoryUsage.heapUsed).toBeGreaterThan(0);
    expect(metrics.lastHealthCheck).toBeDefined();
  });

  it('should create healthy daemon state', () => {
    const metrics = TestDataGenerators.createMockHealthMetrics();
    const daemonState = TestDataGenerators.createHealthyDaemonState(54321, metrics);

    expect(daemonState.pid).toBe(54321);
    expect(daemonState.running).toBe(true);
    expect(daemonState.health).toBeDefined();
    expect(daemonState.health.uptime).toBe(metrics.uptime);
    expect(typeof daemonState.health.lastHealthCheck).toBe('string');
    expect(daemonState.timestamp).toBeDefined();
    expect(daemonState.startedAt).toBeDefined();
  });

  it('should have waitFor utility function', async () => {
    let condition = false;

    // Set condition to true after a short delay
    setTimeout(() => {
      condition = true;
    }, 100);

    // Wait for condition to become true
    await TestSetup.waitFor(() => condition, 1000, 50);

    expect(condition).toBe(true);
  });

  it('should handle waitFor timeout', async () => {
    let errorThrown = false;

    try {
      // Wait for a condition that never becomes true
      await TestSetup.waitFor(() => false, 200, 50);
    } catch (error) {
      errorThrown = true;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Condition not met within');
    }

    expect(errorThrown).toBe(true);
  });
});
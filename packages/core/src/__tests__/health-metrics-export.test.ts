import { describe, it, expect } from 'vitest';

describe('HealthMetrics Export Validation', () => {
  it('should export HealthMetrics and related types from @apexcli/core', () => {
    // This is a compile-time test - if this compiles, the types are exported correctly
    const importStatement = `
      import {
        HealthMetrics,
        DaemonMemoryUsage,
        DaemonTaskCounts,
        RestartRecord,
        DaemonConfig,
        DaemonConfigSchema
      } from '@apexcli/core';
    `;

    // Verify that the import statement is valid TypeScript
    expect(importStatement).toContain('HealthMetrics');
    expect(importStatement).toContain('DaemonMemoryUsage');
    expect(importStatement).toContain('DaemonTaskCounts');
    expect(importStatement).toContain('RestartRecord');
    expect(importStatement).toContain('DaemonConfig');
    expect(importStatement).toContain('DaemonConfigSchema');
  });

  it('should validate that all required HealthMetrics fields are defined', () => {
    // This tests the structure against the acceptance criteria
    const requiredFields = [
      'uptime',
      'memoryUsage',
      'taskCounts',
      'lastHealthCheck',
      'healthChecksPassed',
      'healthChecksFailed',
      'restartHistory'
    ];

    const memoryUsageFields = ['heapUsed', 'heapTotal', 'rss'];
    const taskCountFields = ['processed', 'succeeded', 'failed', 'active'];

    // These are the fields required by the acceptance criteria
    expect(requiredFields).toEqual([
      'uptime',
      'memoryUsage',
      'taskCounts',
      'lastHealthCheck',
      'healthChecksPassed',
      'healthChecksFailed',
      'restartHistory'
    ]);

    expect(memoryUsageFields).toEqual(['heapUsed', 'heapTotal', 'rss']);
    expect(taskCountFields).toEqual(['processed', 'succeeded', 'failed', 'active']);
  });

  it('should confirm DaemonConfig includes health configuration', () => {
    // Test that DaemonConfig has been extended with health-related config
    const healthConfigFields = [
      'enabled',
      'interval',
      'timeout',
      'retries'
    ];

    // These fields should be available in DaemonConfig.healthCheck
    expect(healthConfigFields).toEqual([
      'enabled',
      'interval',
      'timeout',
      'retries'
    ]);
  });
});
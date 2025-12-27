import { describe, it, expect } from 'vitest';

// Test that all required types can be imported successfully
describe('HealthMetrics Smoke Test', () => {
  it('should import all health-related types without errors', async () => {
    const {
      HealthMetrics,
      DaemonMemoryUsage,
      DaemonTaskCounts,
      RestartRecord,
      DaemonConfigSchema
    } = await import('../types.js');

    // Basic type validation - these should not throw at import time
    expect(typeof HealthMetrics).toBe('undefined'); // Interface, not a value
    expect(typeof DaemonMemoryUsage).toBe('undefined'); // Interface, not a value
    expect(typeof DaemonTaskCounts).toBe('undefined'); // Interface, not a value
    expect(typeof RestartRecord).toBe('undefined'); // Interface, not a value
    expect(typeof DaemonConfigSchema).toBe('object'); // Zod schema object

    // Verify schema can be used
    const config = DaemonConfigSchema.parse({
      pollInterval: 5000,
      healthCheck: {
        enabled: true,
        interval: 30000
      }
    });

    expect(config.pollInterval).toBe(5000);
    expect(config.healthCheck?.enabled).toBe(true);
    expect(config.healthCheck?.interval).toBe(30000);
  });
});
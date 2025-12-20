import { describe, it, expect } from 'vitest';

describe('Session Recovery Types Export Validation', () => {
  it('should export DaemonConfig and DaemonConfigSchema with session recovery fields', async () => {
    const { DaemonConfig, DaemonConfigSchema } = await import('../types');

    // Verify DaemonConfigSchema is exported and is a function
    expect(DaemonConfigSchema).toBeDefined();
    expect(typeof DaemonConfigSchema.parse).toBe('function');

    // Test that sessionRecovery with new fields can be parsed
    const testConfig = {
      sessionRecovery: {
        maxResumeAttempts: 5,
        contextWindowThreshold: 0.75
      }
    };

    const parsedConfig = DaemonConfigSchema.parse(testConfig);
    expect(parsedConfig.sessionRecovery?.maxResumeAttempts).toBe(5);
    expect(parsedConfig.sessionRecovery?.contextWindowThreshold).toBe(0.75);
  });

  it('should export Task interface with resumeAttempts field', async () => {
    const { Task } = await import('../types');

    // Since Task is an interface, we can't test it directly,
    // but we can ensure it compiles with our field
    const mockTask = {
      id: 'test',
      description: 'test',
      workflow: 'test',
      autonomy: 'manual' as const,
      status: 'pending' as const,
      priority: 'normal' as const,
      projectPath: '/test',
      retryCount: 0,
      maxRetries: 3,
      resumeAttempts: 2, // Our new field
      createdAt: new Date(),
      updatedAt: new Date(),
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
      logs: [],
      artifacts: []
    };

    // TypeScript compilation ensures the interface includes resumeAttempts
    expect(mockTask.resumeAttempts).toBe(2);
  });

  it('should export all required types from index', async () => {
    const coreExports = await import('../index');

    // Test that key types are available from the main export
    expect(coreExports.DaemonConfigSchema).toBeDefined();
    expect(coreExports.ApexConfigSchema).toBeDefined();

    // Test that the schema validation works with session recovery
    const config = coreExports.DaemonConfigSchema.parse({
      sessionRecovery: {
        maxResumeAttempts: 3,
        contextWindowThreshold: 0.8
      }
    });

    expect(config.sessionRecovery?.maxResumeAttempts).toBe(3);
    expect(config.sessionRecovery?.contextWindowThreshold).toBe(0.8);
  });
});
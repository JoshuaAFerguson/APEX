import { describe, it, expect } from 'vitest';

describe('Guardrail Types Exports', () => {
  it('should export all required guardrail schemas and types', async () => {
    const module = await import('../types');

    // Check GuardrailConfigSchema exports
    expect(module.GuardrailConfigSchema).toBeDefined();
    expect(typeof module.GuardrailConfigSchema.parse).toBe('function');

    // Check EnforcementModeSchema exports
    expect(module.EnforcementModeSchema).toBeDefined();
    expect(typeof module.EnforcementModeSchema.parse).toBe('function');

    // Check SecretDetectionSchema exports
    expect(module.SecretDetectionSchema).toBeDefined();
    expect(typeof module.SecretDetectionSchema.parse).toBe('function');

    // Check that types are available (TypeScript compilation test)
    const testGuardrailConfig: module.GuardrailConfig = {
      enabled: true,
      enforcement: 'warn'
    };

    const testEnforcementMode: module.EnforcementMode = 'audit';

    const testSecretDetection: module.SecretDetection = {
      id: 'test-detection',
      patternName: 'test-pattern',
      secretType: 'test-type',
      severity: 'high',
      maskedMatch: 'REDACTED',
      detectedAt: new Date()
    };

    expect(testGuardrailConfig).toBeDefined();
    expect(testEnforcementMode).toBe('audit');
    expect(testSecretDetection.id).toBe('test-detection');
  });

  it('should parse minimal GuardrailConfig correctly', async () => {
    const module = await import('../types');

    const minimalConfig = {};
    const result = module.GuardrailConfigSchema.parse(minimalConfig);

    expect(result.enabled).toBe(true);
    expect(result.enforcement).toBe('warn');
  });

  it('should parse all EnforcementMode values correctly', async () => {
    const module = await import('../types');

    const validModes = ['warn', 'block', 'audit'];

    for (const mode of validModes) {
      expect(() => module.EnforcementModeSchema.parse(mode)).not.toThrow();
      expect(module.EnforcementModeSchema.parse(mode)).toBe(mode);
    }
  });

  it('should parse SecretDetection correctly', async () => {
    const module = await import('../types');

    const detection = {
      id: 'export-test',
      patternName: 'Test Pattern',
      secretType: 'test_type',
      severity: 'medium',
      maskedMatch: 'REDACTED',
      detectedAt: new Date()
    };

    expect(() => module.SecretDetectionSchema.parse(detection)).not.toThrow();

    const result = module.SecretDetectionSchema.parse(detection);
    expect(result.id).toBe('export-test');
    expect(result.severity).toBe('medium');
    expect(result.acknowledged).toBe(false); // default value
  });
});
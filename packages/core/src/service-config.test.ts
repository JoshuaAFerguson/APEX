import { describe, it, expect } from 'vitest';
import { ServiceConfigSchema, DaemonConfigSchema, type ServiceConfig } from './types';

describe('ServiceConfigSchema', () => {
  it('should validate valid service config with enableOnBoot true', () => {
    const validConfig = {
      enableOnBoot: true
    };

    const result = ServiceConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.enableOnBoot).toBe(true);
    }
  });

  it('should validate valid service config with enableOnBoot false', () => {
    const validConfig = {
      enableOnBoot: false
    };

    const result = ServiceConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.enableOnBoot).toBe(false);
    }
  });

  it('should use default value false when enableOnBoot is not provided', () => {
    const configWithoutEnableOnBoot = {};

    const result = ServiceConfigSchema.safeParse(configWithoutEnableOnBoot);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.enableOnBoot).toBe(false);
    }
  });

  it('should use default value false when enableOnBoot is undefined', () => {
    const configWithUndefined = {
      enableOnBoot: undefined
    };

    const result = ServiceConfigSchema.safeParse(configWithUndefined);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.enableOnBoot).toBe(false);
    }
  });

  it('should reject invalid enableOnBoot value (string)', () => {
    const invalidConfig = {
      enableOnBoot: "true"
    };

    const result = ServiceConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0].path).toContain('enableOnBoot');
      expect(result.error.issues[0].code).toBe('invalid_type');
    }
  });

  it('should reject invalid enableOnBoot value (number)', () => {
    const invalidConfig = {
      enableOnBoot: 1
    };

    const result = ServiceConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  it('should reject invalid enableOnBoot value (null)', () => {
    const invalidConfig = {
      enableOnBoot: null
    };

    const result = ServiceConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  it('should handle extra properties gracefully', () => {
    const configWithExtra = {
      enableOnBoot: true,
      extraProperty: "should be ignored"
    };

    const result = ServiceConfigSchema.safeParse(configWithExtra);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.enableOnBoot).toBe(true);
      // Zod should strip extra properties
      expect('extraProperty' in result.data).toBe(false);
    }
  });

  it('should handle empty object', () => {
    const emptyConfig = {};

    const result = ServiceConfigSchema.safeParse(emptyConfig);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.enableOnBoot).toBe(false);
    }
  });
});

describe('DaemonConfigSchema with ServiceConfig integration', () => {
  it('should validate daemon config with service config', () => {
    const daemonConfig = {
      pollInterval: 3000,
      autoStart: true,
      logLevel: 'info' as const,
      installAsService: true,
      serviceName: 'my-apex-service',
      service: {
        enableOnBoot: true
      }
    };

    const result = DaemonConfigSchema.safeParse(daemonConfig);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.service?.enableOnBoot).toBe(true);
      expect(result.data.serviceName).toBe('my-apex-service');
      expect(result.data.installAsService).toBe(true);
    }
  });

  it('should use default service config when not provided', () => {
    const daemonConfig = {
      pollInterval: 5000,
      autoStart: false
    };

    const result = DaemonConfigSchema.safeParse(daemonConfig);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.service).toBeUndefined();
    }
  });

  it('should validate daemon config with empty service config', () => {
    const daemonConfig = {
      service: {}
    };

    const result = DaemonConfigSchema.safeParse(daemonConfig);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.service?.enableOnBoot).toBe(false);
    }
  });

  it('should reject daemon config with invalid service config', () => {
    const daemonConfig = {
      service: {
        enableOnBoot: "invalid"
      }
    };

    const result = DaemonConfigSchema.safeParse(daemonConfig);
    expect(result.success).toBe(false);
  });

  it('should apply all default values correctly', () => {
    const minimalConfig = {};

    const result = DaemonConfigSchema.safeParse(minimalConfig);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.pollInterval).toBe(5000);
      expect(result.data.autoStart).toBe(false);
      expect(result.data.logLevel).toBe('info');
      expect(result.data.installAsService).toBe(false);
      expect(result.data.serviceName).toBe('apex-daemon');
      expect(result.data.service).toBeUndefined();
    }
  });
});

describe('ServiceConfig Type', () => {
  it('should have correct TypeScript type', () => {
    // This test ensures the type is exported and usable
    const config: ServiceConfig = {
      enableOnBoot: true
    };

    expect(config.enableOnBoot).toBe(true);
  });

  it('should allow partial ServiceConfig objects', () => {
    const partialConfig: Partial<ServiceConfig> = {};
    expect(partialConfig).toBeDefined();

    const fullConfig: ServiceConfig = {
      enableOnBoot: false
    };
    expect(fullConfig.enableOnBoot).toBe(false);
  });

  it('should infer correct type from schema', () => {
    const configFromSchema = ServiceConfigSchema.parse({ enableOnBoot: true });

    // TypeScript should infer this as ServiceConfig
    const typedConfig: ServiceConfig = configFromSchema;
    expect(typedConfig.enableOnBoot).toBe(true);
  });
});
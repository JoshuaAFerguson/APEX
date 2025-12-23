import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as yaml from 'yaml';
import { loadConfig, getEffectiveConfig } from '../config';
import {
  ServiceConfigSchema,
  DaemonConfigSchema,
  type ServiceConfig,
  type DaemonConfig,
  type Config
} from '../types';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    access: vi.fn(),
  },
}));

vi.mock('yaml', () => ({
  parse: vi.fn(),
}));

const mockFs = vi.mocked(fs);
const mockYaml = vi.mocked(yaml);

describe.skip('Service Configuration Loading and Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('loadConfig with service configuration', () => {
    it('should load config with valid service configuration', async () => {
      const configYaml = `
project:
  name: "test-project"
daemon:
  pollInterval: 3000
  service:
    enableOnBoot: true
`;

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(configYaml);
      mockYaml.parse.mockReturnValue({
        project: { name: "test-project" },
        daemon: {
          pollInterval: 3000,
          service: { enableOnBoot: true }
        }
      });

      const result = await loadConfig('/test/project');

      expect(result.daemon?.service?.enableOnBoot).toBe(true);
      expect(result.daemon?.pollInterval).toBe(3000);
    });

    it('should load config without service configuration and use defaults', async () => {
      const configYaml = `
project:
  name: "test-project"
daemon:
  pollInterval: 4000
`;

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(configYaml);
      mockYaml.parse.mockReturnValue({
        project: { name: "test-project" },
        daemon: { pollInterval: 4000 }
      });

      const result = await loadConfig('/test/project');

      expect(result.daemon?.pollInterval).toBe(4000);
      expect(result.daemon?.service).toBeUndefined();
    });

    it('should handle config with empty service section', async () => {
      const configYaml = `
project:
  name: "test-project"
daemon:
  service: {}
`;

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(configYaml);
      mockYaml.parse.mockReturnValue({
        project: { name: "test-project" },
        daemon: { service: {} }
      });

      const result = await loadConfig('/test/project');

      expect(result.daemon?.service).toBeDefined();
      // Empty service object should be valid
    });

    it('should reject config with invalid service configuration', async () => {
      const configYaml = `
project:
  name: "test-project"
daemon:
  service:
    enableOnBoot: "invalid"
`;

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(configYaml);
      mockYaml.parse.mockReturnValue({
        project: { name: "test-project" },
        daemon: {
          service: { enableOnBoot: "invalid" }
        }
      });

      await expect(loadConfig('/test/project')).rejects.toThrow();
    });

    it('should handle missing config file gracefully', async () => {
      mockFs.access.mockRejectedValue({ code: 'ENOENT' });

      // Should return empty config when file doesn't exist
      const result = await loadConfig('/test/project');
      expect(result).toEqual({});
    });
  });

  describe('getEffectiveConfig with service configuration', () => {
    it('should apply service config defaults correctly', () => {
      const inputConfig: Config = {
        daemon: {
          pollInterval: 2000,
          service: {
            enableOnBoot: true
          }
        }
      };

      const effective = getEffectiveConfig(inputConfig);

      expect(effective.daemon?.service?.enableOnBoot).toBe(true);
      expect(effective.daemon?.pollInterval).toBe(2000);
      expect(effective.daemon?.autoStart).toBe(false); // Default
      expect(effective.daemon?.logLevel).toBe('info'); // Default
    });

    it('should handle missing service section with daemon defaults', () => {
      const inputConfig: Config = {
        daemon: {
          pollInterval: 3000
        }
      };

      const effective = getEffectiveConfig(inputConfig);

      expect(effective.daemon?.pollInterval).toBe(3000);
      expect(effective.daemon?.service).toBeUndefined();
      expect(effective.daemon?.autoStart).toBe(false);
      expect(effective.daemon?.installAsService).toBe(false);
    });

    it('should handle completely missing daemon config', () => {
      const inputConfig: Config = {
        project: {
          name: 'test'
        }
      };

      const effective = getEffectiveConfig(inputConfig);

      expect(effective.daemon).toBeUndefined();
    });

    it('should preserve all service config properties', () => {
      const inputConfig: Config = {
        daemon: {
          pollInterval: 1000,
          autoStart: true,
          logLevel: 'debug',
          installAsService: true,
          serviceName: 'custom-apex',
          service: {
            enableOnBoot: true
          }
        }
      };

      const effective = getEffectiveConfig(inputConfig);

      expect(effective.daemon?.service?.enableOnBoot).toBe(true);
      expect(effective.daemon?.installAsService).toBe(true);
      expect(effective.daemon?.serviceName).toBe('custom-apex');
      expect(effective.daemon?.logLevel).toBe('debug');
    });
  });

  describe('ServiceConfig schema validation edge cases', () => {
    it('should validate ServiceConfig with only enableOnBoot', () => {
      const config = { enableOnBoot: true };
      const result = ServiceConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enableOnBoot).toBe(true);
      }
    });

    it('should validate empty ServiceConfig with defaults', () => {
      const config = {};
      const result = ServiceConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enableOnBoot).toBe(false);
      }
    });

    it('should reject ServiceConfig with wrong type', () => {
      const config = { enableOnBoot: 42 };
      const result = ServiceConfigSchema.safeParse(config);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('enableOnBoot');
      }
    });

    it('should handle null enableOnBoot', () => {
      const config = { enableOnBoot: null };
      const result = ServiceConfigSchema.safeParse(config);

      expect(result.success).toBe(false);
    });

    it('should strip unknown properties', () => {
      const config = {
        enableOnBoot: true,
        unknownProperty: 'should be removed',
        anotherUnknown: 123
      };
      const result = ServiceConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enableOnBoot).toBe(true);
        expect('unknownProperty' in result.data).toBe(false);
        expect('anotherUnknown' in result.data).toBe(false);
      }
    });
  });

  describe('DaemonConfig with ServiceConfig integration validation', () => {
    it('should validate complete daemon config with service', () => {
      const daemonConfig = {
        pollInterval: 2000,
        autoStart: true,
        logLevel: 'warn',
        installAsService: true,
        serviceName: 'test-service',
        service: {
          enableOnBoot: true
        },
        healthCheck: {
          enabled: true,
          interval: 60000,
          timeout: 10000,
          retries: 5
        }
      };

      const result = DaemonConfigSchema.safeParse(daemonConfig);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.service?.enableOnBoot).toBe(true);
        expect(result.data.installAsService).toBe(true);
        expect(result.data.serviceName).toBe('test-service');
        expect(result.data.healthCheck?.enabled).toBe(true);
      }
    });

    it('should validate daemon config with nested service defaults', () => {
      const daemonConfig = {
        service: {}
      };

      const result = DaemonConfigSchema.safeParse(daemonConfig);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.service?.enableOnBoot).toBe(false);
        expect(result.data.pollInterval).toBe(5000); // Default
        expect(result.data.autoStart).toBe(false); // Default
      }
    });

    it('should reject daemon config with invalid nested service', () => {
      const daemonConfig = {
        pollInterval: 1000,
        service: {
          enableOnBoot: "not a boolean"
        }
      };

      const result = DaemonConfigSchema.safeParse(daemonConfig);

      expect(result.success).toBe(false);
      if (!result.success) {
        const enableOnBootError = result.error.issues.find(
          issue => issue.path.includes('enableOnBoot')
        );
        expect(enableOnBootError).toBeDefined();
      }
    });

    it('should handle daemon config with installAsService and service config', () => {
      const daemonConfig = {
        installAsService: true,
        service: {
          enableOnBoot: true
        }
      };

      const result = DaemonConfigSchema.safeParse(daemonConfig);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.installAsService).toBe(true);
        expect(result.data.service?.enableOnBoot).toBe(true);
        // These should work together logically
      }
    });
  });

  describe('Real-world config scenarios', () => {
    it('should handle production-like config with all service options', async () => {
      const productionConfig = `
project:
  name: "my-production-app"
  description: "Production APEX setup"

agents:
  - name: "production-agent"
    description: "High-performance agent"

daemon:
  pollInterval: 1000
  autoStart: true
  logLevel: "info"
  installAsService: true
  serviceName: "apex-production"
  service:
    enableOnBoot: true
  healthCheck:
    enabled: true
    interval: 30000
    timeout: 5000
    retries: 3

limits:
  maxConcurrentTasks: 10
  maxTokensPerTask: 100000
`;

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(productionConfig);
      mockYaml.parse.mockReturnValue({
        project: {
          name: "my-production-app",
          description: "Production APEX setup"
        },
        agents: [{
          name: "production-agent",
          description: "High-performance agent"
        }],
        daemon: {
          pollInterval: 1000,
          autoStart: true,
          logLevel: "info",
          installAsService: true,
          serviceName: "apex-production",
          service: {
            enableOnBoot: true
          },
          healthCheck: {
            enabled: true,
            interval: 30000,
            timeout: 5000,
            retries: 3
          }
        },
        limits: {
          maxConcurrentTasks: 10,
          maxTokensPerTask: 100000
        }
      });

      const config = await loadConfig('/production/project');
      const effective = getEffectiveConfig(config);

      expect(effective.daemon?.service?.enableOnBoot).toBe(true);
      expect(effective.daemon?.installAsService).toBe(true);
      expect(effective.daemon?.serviceName).toBe('apex-production');
      expect(effective.daemon?.autoStart).toBe(true);
      expect(effective.daemon?.pollInterval).toBe(1000);
    });

    it('should handle minimal config with service defaults', async () => {
      const minimalConfig = `
project:
  name: "minimal-setup"
`;

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(minimalConfig);
      mockYaml.parse.mockReturnValue({
        project: { name: "minimal-setup" }
      });

      const config = await loadConfig('/minimal/project');
      const effective = getEffectiveConfig(config);

      // Should have reasonable defaults
      expect(effective.project?.name).toBe('minimal-setup');
      expect(effective.daemon).toBeUndefined(); // No daemon config specified
    });

    it('should handle config with service section but no enableOnBoot', async () => {
      const configWithServiceSection = `
project:
  name: "partial-service-config"
daemon:
  installAsService: true
  serviceName: "partial-apex"
  service: {}
`;

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(configWithServiceSection);
      mockYaml.parse.mockReturnValue({
        project: { name: "partial-service-config" },
        daemon: {
          installAsService: true,
          serviceName: "partial-apex",
          service: {}
        }
      });

      const config = await loadConfig('/partial/project');
      const effective = getEffectiveConfig(config);

      expect(effective.daemon?.installAsService).toBe(true);
      expect(effective.daemon?.serviceName).toBe('partial-apex');
      expect(effective.daemon?.service?.enableOnBoot).toBe(false); // Default from schema
    });
  });

  describe('Error scenarios and edge cases', () => {
    it('should handle corrupted YAML gracefully', async () => {
      const corruptedYaml = `
project:
  name: "test"
daemon:
  service:
    enableOnBoot: [invalid, yaml, structure
`;

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(corruptedYaml);
      mockYaml.parse.mockImplementation(() => {
        throw new Error('Invalid YAML');
      });

      await expect(loadConfig('/corrupted/project')).rejects.toThrow('Invalid YAML');
    });

    it('should handle file read errors', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

      await expect(loadConfig('/denied/project')).rejects.toThrow('Permission denied');
    });

    it('should validate type safety at runtime', () => {
      // This tests that our schemas properly validate at runtime
      const invalidServiceConfig = {
        enableOnBoot: "yes" // String instead of boolean
      };

      expect(() => {
        ServiceConfigSchema.parse(invalidServiceConfig);
      }).toThrow();
    });

    it('should handle deeply nested invalid config', async () => {
      const configWithDeepInvalid = `
project:
  name: "test"
daemon:
  healthCheck:
    enabled: true
  service:
    enableOnBoot: 123456
    extraField: "should be stripped"
`;

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(configWithDeepInvalid);
      mockYaml.parse.mockReturnValue({
        project: { name: "test" },
        daemon: {
          healthCheck: { enabled: true },
          service: {
            enableOnBoot: 123456,
            extraField: "should be stripped"
          }
        }
      });

      await expect(loadConfig('/invalid/project')).rejects.toThrow();
    });
  });
});
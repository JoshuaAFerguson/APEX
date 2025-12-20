import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  ApexConfigSchema,
  DaemonConfigSchema,
  type ApexConfig,
  type DaemonConfig
} from '../types';
import {
  loadConfig,
  saveConfig,
  getEffectiveConfig,
  initializeApex
} from '../config';

describe('Daemon Configuration Integration', () => {
  describe('DaemonConfigSchema with real-world scenarios', () => {
    it('should handle typical development daemon configuration', () => {
      const devConfig: DaemonConfig = {
        pollInterval: 1000,
        autoStart: true,
        logLevel: 'debug'
      };

      const parsed = DaemonConfigSchema.parse(devConfig);
      expect(parsed).toEqual(devConfig);
    });

    it('should handle production daemon configuration', () => {
      const prodConfig: DaemonConfig = {
        pollInterval: 30000,
        autoStart: false,
        logLevel: 'error'
      };

      const parsed = DaemonConfigSchema.parse(prodConfig);
      expect(parsed).toEqual(prodConfig);
    });

    it('should handle CI/CD daemon configuration', () => {
      const ciConfig: DaemonConfig = {
        pollInterval: 10000,
        autoStart: false,
        logLevel: 'warn'
      };

      const parsed = DaemonConfigSchema.parse(ciConfig);
      expect(parsed).toEqual(ciConfig);
    });

    it('should handle minimal daemon configuration', () => {
      const minimalConfig: DaemonConfig = {};

      const parsed = DaemonConfigSchema.parse(minimalConfig);
      expect(parsed).toEqual({
        pollInterval: 5000,
        autoStart: false,
        logLevel: 'info'
      });
    });

    it('should reject configuration with mixed valid/invalid values', () => {
      expect(() => {
        DaemonConfigSchema.parse({
          pollInterval: 5000,
          autoStart: true,
          logLevel: 'invalid-level' // Invalid
        });
      }).toThrow();

      expect(() => {
        DaemonConfigSchema.parse({
          pollInterval: 'not-a-number', // Invalid
          autoStart: true,
          logLevel: 'info'
        });
      }).toThrow();
    });
  });

  describe('ApexConfigSchema with daemon integration', () => {
    it('should integrate daemon config with full APEX configuration', () => {
      const fullConfig = ApexConfigSchema.parse({
        version: '1.0',
        project: {
          name: 'daemon-integration-test',
          language: 'typescript',
          framework: 'nextjs'
        },
        autonomy: {
          default: 'review-before-merge'
        },
        git: {
          branchPrefix: 'feature/',
          commitFormat: 'conventional'
        },
        limits: {
          maxTokensPerTask: 200000,
          maxCostPerTask: 15.0
        },
        daemon: {
          pollInterval: 8000,
          autoStart: true,
          logLevel: 'warn'
        }
      });

      expect(fullConfig.daemon).toEqual({
        pollInterval: 8000,
        autoStart: true,
        logLevel: 'warn'
      });
      expect(fullConfig.project.name).toBe('daemon-integration-test');
      expect(fullConfig.autonomy?.default).toBe('review-before-merge');
    });

    it('should work with daemon as the only optional config', () => {
      const config = ApexConfigSchema.parse({
        project: { name: 'daemon-only' },
        daemon: {
          pollInterval: 2500,
          logLevel: 'debug'
        }
      });

      expect(config.daemon).toEqual({
        pollInterval: 2500,
        autoStart: false,
        logLevel: 'debug'
      });
    });

    it('should handle complex nested configuration with daemon', () => {
      const complexConfig = ApexConfigSchema.parse({
        version: '2.0',
        project: {
          name: 'complex-project',
          language: 'typescript',
          framework: 'react',
          testCommand: 'jest',
          lintCommand: 'eslint src/',
          buildCommand: 'webpack'
        },
        autonomy: {
          default: 'full',
          overrides: {
            production: 'review-before-merge'
          }
        },
        agents: {
          enabled: ['planner', 'developer', 'tester'],
          disabled: ['devops']
        },
        models: {
          planning: 'opus',
          implementation: 'sonnet',
          review: 'haiku'
        },
        git: {
          branchPrefix: 'apex/',
          commitFormat: 'conventional',
          autoPush: true,
          defaultBranch: 'main'
        },
        limits: {
          maxTokensPerTask: 1000000,
          maxCostPerTask: 50.0,
          dailyBudget: 200.0,
          maxTurns: 150,
          maxConcurrentTasks: 5
        },
        api: {
          url: 'http://localhost:3000',
          port: 3000,
          autoStart: true
        },
        ui: {
          previewMode: true,
          previewConfidence: 0.85,
          autoExecuteHighConfidence: true,
          previewTimeout: 8000
        },
        daemon: {
          pollInterval: 7500,
          autoStart: true,
          logLevel: 'info'
        }
      });

      // Verify all sections are correctly parsed
      expect(complexConfig.project.name).toBe('complex-project');
      expect(complexConfig.agents?.enabled).toContain('tester');
      expect(complexConfig.daemon?.pollInterval).toBe(7500);
      expect(complexConfig.daemon?.autoStart).toBe(true);
      expect(complexConfig.daemon?.logLevel).toBe('info');
      expect(complexConfig.ui?.previewConfidence).toBe(0.85);
    });
  });

  describe('File persistence integration', () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-daemon-integration-'));
      await fs.mkdir(path.join(testDir, '.apex'));
    });

    afterEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    it('should persist and load daemon configuration correctly', async () => {
      const originalConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'persistence-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        daemon: {
          pollInterval: 15000,
          autoStart: true,
          logLevel: 'debug'
        }
      };

      await saveConfig(testDir, originalConfig);
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.daemon).toEqual({
        pollInterval: 15000,
        autoStart: true,
        logLevel: 'debug'
      });
    });

    it('should handle YAML serialization/deserialization of daemon config', async () => {
      const configWithAllDaemonFields: ApexConfig = {
        version: '1.0',
        project: {
          name: 'yaml-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        daemon: {
          pollInterval: 0, // Edge case: zero value
          autoStart: false,
          logLevel: 'error'
        }
      };

      await saveConfig(testDir, configWithAllDaemonFields);
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.daemon?.pollInterval).toBe(0);
      expect(loadedConfig.daemon?.autoStart).toBe(false);
      expect(loadedConfig.daemon?.logLevel).toBe('error');
    });

    it('should handle partial daemon config in YAML', async () => {
      const configWithPartialDaemon: ApexConfig = {
        version: '1.0',
        project: {
          name: 'partial-yaml-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        daemon: {
          logLevel: 'warn'
          // Only logLevel specified, others should get defaults
        }
      };

      await saveConfig(testDir, configWithPartialDaemon);
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.daemon?.pollInterval).toBe(5000);
      expect(loadedConfig.daemon?.autoStart).toBe(false);
      expect(loadedConfig.daemon?.logLevel).toBe('warn');
    });

    it('should handle missing daemon section in file', async () => {
      const configWithoutDaemon: ApexConfig = {
        version: '1.0',
        project: {
          name: 'no-daemon-yaml-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        }
      };

      await saveConfig(testDir, configWithoutDaemon);
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.daemon).toBeUndefined();
    });

    it('should validate daemon config during file loading', async () => {
      // Manually write invalid YAML config
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const invalidYaml = `
version: '1.0'
project:
  name: invalid-daemon-test
daemon:
  pollInterval: 5000
  autoStart: true
  logLevel: invalid-level  # Invalid enum value
`;

      await fs.writeFile(configPath, invalidYaml);

      await expect(loadConfig(testDir)).rejects.toThrow();
    });
  });

  describe('getEffectiveConfig with daemon integration', () => {
    it('should provide daemon defaults when not specified', () => {
      const configWithoutDaemon: ApexConfig = {
        version: '1.0',
        project: {
          name: 'effective-config-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        }
      };

      const effectiveConfig = getEffectiveConfig(configWithoutDaemon);

      expect(effectiveConfig.daemon).toEqual({
        pollInterval: 5000,
        autoStart: false,
        logLevel: 'info'
      });
    });

    it('should preserve explicit daemon configuration', () => {
      const configWithDaemon: ApexConfig = {
        version: '1.0',
        project: {
          name: 'explicit-daemon-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        daemon: {
          pollInterval: 20000,
          autoStart: true,
          logLevel: 'debug'
        }
      };

      const effectiveConfig = getEffectiveConfig(configWithDaemon);

      expect(effectiveConfig.daemon).toEqual({
        pollInterval: 20000,
        autoStart: true,
        logLevel: 'debug'
      });
    });

    it('should handle mixed explicit and default daemon values', () => {
      const configWithPartialDaemon: ApexConfig = {
        version: '1.0',
        project: {
          name: 'mixed-daemon-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        daemon: {
          pollInterval: 12000,
          // autoStart and logLevel should get defaults
        }
      };

      const effectiveConfig = getEffectiveConfig(configWithPartialDaemon);

      expect(effectiveConfig.daemon).toEqual({
        pollInterval: 12000,
        autoStart: false,
        logLevel: 'info'
      });
    });

    it('should integrate daemon with all other effective config sections', () => {
      const minimalConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'integration-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        daemon: {
          autoStart: true
        }
      };

      const effectiveConfig = getEffectiveConfig(minimalConfig);

      // Check daemon defaults are applied
      expect(effectiveConfig.daemon.pollInterval).toBe(5000);
      expect(effectiveConfig.daemon.autoStart).toBe(true);
      expect(effectiveConfig.daemon.logLevel).toBe('info');

      // Check other defaults are still applied
      expect(effectiveConfig.autonomy.default).toBe('review-before-merge');
      expect(effectiveConfig.git.branchPrefix).toBe('apex/');
      expect(effectiveConfig.limits.maxTokensPerTask).toBe(500000);
      expect(effectiveConfig.api.port).toBe(3000);
    });
  });

  describe('Initialization with daemon configuration', () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-daemon-init-'));
    });

    afterEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    it('should initialize project without explicit daemon config but provide defaults', async () => {
      await initializeApex(testDir, {
        projectName: 'daemon-init-test',
        language: 'typescript'
      });

      const config = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(config);

      // initializeApex doesn't set daemon config explicitly
      expect(config.daemon).toBeUndefined();

      // But getEffectiveConfig should provide defaults
      expect(effectiveConfig.daemon).toEqual({
        pollInterval: 5000,
        autoStart: false,
        logLevel: 'info'
      });
    });

    it('should maintain daemon configuration after initialization', async () => {
      await initializeApex(testDir, {
        projectName: 'daemon-maintain-test'
      });

      // Load and modify config to add daemon settings
      const config = await loadConfig(testDir);
      const updatedConfig: ApexConfig = {
        ...config,
        daemon: {
          pollInterval: 3000,
          autoStart: true,
          logLevel: 'debug'
        }
      };

      await saveConfig(testDir, updatedConfig);
      const reloadedConfig = await loadConfig(testDir);

      expect(reloadedConfig.daemon).toEqual({
        pollInterval: 3000,
        autoStart: true,
        logLevel: 'debug'
      });
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle empty daemon object', () => {
      const config = ApexConfigSchema.parse({
        project: { name: 'empty-daemon' },
        daemon: {}
      });

      expect(config.daemon).toEqual({
        pollInterval: 5000,
        autoStart: false,
        logLevel: 'info'
      });
    });

    it('should handle null pollInterval correctly', () => {
      expect(() => {
        DaemonConfigSchema.parse({ pollInterval: null });
      }).toThrow();
    });

    it('should handle undefined values correctly', () => {
      const config = DaemonConfigSchema.parse({
        pollInterval: undefined,
        autoStart: undefined,
        logLevel: undefined
      });

      expect(config).toEqual({
        pollInterval: 5000,
        autoStart: false,
        logLevel: 'info'
      });
    });

    it('should preserve boolean false values', () => {
      const config = DaemonConfigSchema.parse({
        autoStart: false
      });

      expect(config.autoStart).toBe(false);
    });

    it('should preserve zero pollInterval', () => {
      const config = DaemonConfigSchema.parse({
        pollInterval: 0
      });

      expect(config.pollInterval).toBe(0);
    });
  });
});
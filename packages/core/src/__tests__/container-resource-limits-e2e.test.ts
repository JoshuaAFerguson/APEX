import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import {
  initializeApex,
  loadConfig,
  saveConfig,
  getEffectiveConfig,
} from '../config';
import { ApexConfig } from '../types';

describe('Container Resource Limits End-to-End Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-e2e-test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Full workflow: init -> load -> effective config', () => {
    it('should work end-to-end for container resource limits', async () => {
      // Step 1: Initialize APEX with container resource limits
      await initializeApex(testDir, {
        projectName: 'e2e-test-project',
        language: 'typescript',
        framework: 'react',
      });

      // Step 2: Verify the YAML file was created correctly
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const yamlContent = await fs.readFile(configPath, 'utf-8');
      const parsedYaml = yaml.parse(yamlContent);

      expect(parsedYaml.workspace.container.resourceLimits).toEqual({
        cpu: 1,
        memory: '512m',
      });

      // Step 3: Load config and verify structure
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.workspace?.container?.resourceLimits?.cpu).toBe(1);
      expect(loadedConfig.workspace?.container?.resourceLimits?.memory).toBe('512m');
      expect(loadedConfig.workspace?.container?.networkMode).toBe('bridge');
      expect(loadedConfig.workspace?.container?.autoRemove).toBe(true);

      // Step 4: Get effective config and verify defaults are preserved
      const effectiveConfig = getEffectiveConfig(loadedConfig);

      expect(effectiveConfig.workspace.container.resourceLimits?.cpu).toBe(1);
      expect(effectiveConfig.workspace.container.resourceLimits?.memory).toBe('512m');
      expect(effectiveConfig.workspace.container.networkMode).toBe('bridge');
      expect(effectiveConfig.workspace.container.autoRemove).toBe(true);

      // Step 5: Verify other default settings are also preserved
      expect(effectiveConfig.workspace.defaultStrategy).toBe('none');
      expect(effectiveConfig.workspace.cleanupOnComplete).toBe(true);
      expect(effectiveConfig.project.name).toBe('e2e-test-project');
      expect(effectiveConfig.project.language).toBe('typescript');
      expect(effectiveConfig.project.framework).toBe('react');
    });

    it('should handle custom resource limits configuration', async () => {
      // Step 1: Initialize with defaults
      await initializeApex(testDir, {
        projectName: 'custom-limits-test',
      });

      // Step 2: Load and modify config
      const config = await loadConfig(testDir);
      const customConfig: ApexConfig = {
        ...config,
        workspace: {
          ...config.workspace,
          container: {
            ...config.workspace?.container,
            resourceLimits: {
              cpu: 4,
              memory: '2g',
              cpuShares: 2048,
              pidsLimit: 200,
            },
          },
        },
      };

      // Step 3: Save modified config
      await saveConfig(testDir, customConfig);

      // Step 4: Load and verify custom values
      const reloadedConfig = await loadConfig(testDir);
      expect(reloadedConfig.workspace?.container?.resourceLimits?.cpu).toBe(4);
      expect(reloadedConfig.workspace?.container?.resourceLimits?.memory).toBe('2g');
      expect(reloadedConfig.workspace?.container?.resourceLimits?.cpuShares).toBe(2048);
      expect(reloadedConfig.workspace?.container?.resourceLimits?.pidsLimit).toBe(200);

      // Step 5: Verify effective config preserves custom values
      const effectiveConfig = getEffectiveConfig(reloadedConfig);
      expect(effectiveConfig.workspace.container.resourceLimits?.cpu).toBe(4);
      expect(effectiveConfig.workspace.container.resourceLimits?.memory).toBe('2g');
      expect(effectiveConfig.workspace.container.resourceLimits?.cpuShares).toBe(2048);
      expect(effectiveConfig.workspace.container.resourceLimits?.pidsLimit).toBe(200);
    });

    it('should maintain resource limits through config reload cycles', async () => {
      // Initialize with defaults
      await initializeApex(testDir, { projectName: 'reload-test' });

      // Load, modify, and save multiple times
      for (let i = 1; i <= 3; i++) {
        const config = await loadConfig(testDir);

        // Verify defaults are still there
        expect(config.workspace?.container?.resourceLimits?.cpu).toBe(1);
        expect(config.workspace?.container?.resourceLimits?.memory).toBe('512m');

        // Add some modification to test persistence
        const modifiedConfig: ApexConfig = {
          ...config,
          project: {
            ...config.project,
            description: `Test iteration ${i}`,
          },
        };

        await saveConfig(testDir, modifiedConfig);

        const reloadedConfig = await loadConfig(testDir);
        expect(reloadedConfig.project.description).toBe(`Test iteration ${i}`);
        expect(reloadedConfig.workspace?.container?.resourceLimits?.cpu).toBe(1);
        expect(reloadedConfig.workspace?.container?.resourceLimits?.memory).toBe('512m');
      }
    });
  });

  describe('Real-world usage scenarios', () => {
    it('should handle development environment setup', async () => {
      await initializeApex(testDir, {
        projectName: 'dev-env-project',
        language: 'javascript',
        framework: 'express',
      });

      const config = await loadConfig(testDir);

      // Development typically needs more resources than defaults, but defaults should be sensible
      expect(config.workspace?.container?.resourceLimits?.cpu).toBe(1); // Good starting point
      expect(config.workspace?.container?.resourceLimits?.memory).toBe('512m'); // Reasonable for development

      // Should be able to upgrade to development-friendly settings
      const devConfig: ApexConfig = {
        ...config,
        workspace: {
          ...config.workspace,
          container: {
            ...config.workspace?.container,
            resourceLimits: {
              cpu: 2,
              memory: '2g',
            },
          },
        },
      };

      await saveConfig(testDir, devConfig);
      const effectiveConfig = getEffectiveConfig(await loadConfig(testDir));

      expect(effectiveConfig.workspace.container.resourceLimits?.cpu).toBe(2);
      expect(effectiveConfig.workspace.container.resourceLimits?.memory).toBe('2g');
    });

    it('should handle production environment setup', async () => {
      await initializeApex(testDir, {
        projectName: 'prod-env-project',
        language: 'typescript',
      });

      const config = await loadConfig(testDir);

      // Production typically needs constrained resources, defaults should allow this
      const prodConfig: ApexConfig = {
        ...config,
        workspace: {
          ...config.workspace,
          container: {
            ...config.workspace?.container,
            resourceLimits: {
              cpu: 0.5,
              memory: '256m',
              pidsLimit: 50,
            },
            networkMode: 'none', // Isolated
          },
        },
      };

      await saveConfig(testDir, prodConfig);
      const effectiveConfig = getEffectiveConfig(await loadConfig(testDir));

      expect(effectiveConfig.workspace.container.resourceLimits?.cpu).toBe(0.5);
      expect(effectiveConfig.workspace.container.resourceLimits?.memory).toBe('256m');
      expect(effectiveConfig.workspace.container.resourceLimits?.pidsLimit).toBe(50);
      expect(effectiveConfig.workspace.container.networkMode).toBe('none');
    });

    it('should handle CI/CD environment setup', async () => {
      await initializeApex(testDir, {
        projectName: 'ci-cd-project',
        language: 'python',
      });

      const config = await loadConfig(testDir);

      // CI/CD might need more resources for builds and tests
      const ciConfig: ApexConfig = {
        ...config,
        workspace: {
          ...config.workspace,
          container: {
            ...config.workspace?.container,
            resourceLimits: {
              cpu: 8,
              memory: '4g',
              pidsLimit: 1000,
            },
          },
        },
      };

      await saveConfig(testDir, ciConfig);
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.workspace?.container?.resourceLimits?.cpu).toBe(8);
      expect(loadedConfig.workspace?.container?.resourceLimits?.memory).toBe('4g');
      expect(loadedConfig.workspace?.container?.resourceLimits?.pidsLimit).toBe(1000);
    });
  });

  describe('Error resilience and edge cases', () => {
    it('should handle missing workspace section gracefully', async () => {
      // Create config without workspace section
      const minimalConfig = {
        project: {
          name: 'minimal-test',
        },
      };

      await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, yaml.stringify(minimalConfig), 'utf-8');

      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);

      // Should get reasonable defaults from getEffectiveConfig
      expect(effectiveConfig.workspace.defaultStrategy).toBe('none');
      expect(effectiveConfig.workspace.container.networkMode).toBe('bridge');
      expect(effectiveConfig.workspace.container.autoRemove).toBe(true);
      // ResourceLimits should be undefined since not set in original config
      expect(effectiveConfig.workspace.container.resourceLimits).toBeUndefined();
    });

    it('should handle partial container configuration', async () => {
      const partialConfig = {
        project: {
          name: 'partial-test',
        },
        workspace: {
          container: {
            resourceLimits: {
              cpu: 2, // Only CPU, no memory
            },
          },
        },
      };

      await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, yaml.stringify(partialConfig), 'utf-8');

      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);

      expect(effectiveConfig.workspace.container.resourceLimits?.cpu).toBe(2);
      expect(effectiveConfig.workspace.container.resourceLimits?.memory).toBeUndefined();
      expect(effectiveConfig.workspace.container.networkMode).toBe('bridge'); // Gets default
      expect(effectiveConfig.workspace.container.autoRemove).toBe(true); // Gets default
    });

    it('should preserve exactly what was initialized by initializeApex', async () => {
      await initializeApex(testDir, {
        projectName: 'preservation-test',
      });

      // Read the raw YAML to ensure it's exactly what we expect
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const yamlContent = await fs.readFile(configPath, 'utf-8');
      const parsedYaml = yaml.parse(yamlContent);

      // Verify exact structure matches what initializeApex creates
      expect(parsedYaml.workspace.container.resourceLimits.cpu).toBe(1);
      expect(parsedYaml.workspace.container.resourceLimits.memory).toBe('512m');
      expect(parsedYaml.workspace.container.networkMode).toBe('bridge');
      expect(parsedYaml.workspace.container.autoRemove).toBe(true);

      // Verify no unexpected fields are added
      expect(Object.keys(parsedYaml.workspace.container.resourceLimits)).toEqual(['cpu', 'memory']);

      // Load through our functions and verify consistency
      const loadedConfig = await loadConfig(testDir);
      expect(loadedConfig.workspace?.container?.resourceLimits).toEqual({
        cpu: 1,
        memory: '512m',
      });
    });
  });
});
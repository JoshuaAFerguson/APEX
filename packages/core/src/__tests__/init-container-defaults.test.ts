import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  initializeApex,
  loadConfig,
} from '../config';
import { ApexConfigSchema, ResourceLimitsSchema } from '../types';

describe('initializeApex container resource limits', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-init-container-test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Default resource limits creation', () => {
    it('should create config with default container resource limits', async () => {
      await initializeApex(testDir, {
        projectName: 'test-project',
        language: 'typescript',
      });

      const config = await loadConfig(testDir);

      // Verify workspace.container.resourceLimits exists with expected defaults
      expect(config.workspace?.container?.resourceLimits).toBeDefined();
      expect(config.workspace?.container?.resourceLimits?.cpu).toBe(1);
      expect(config.workspace?.container?.resourceLimits?.memory).toBe('512m');
    });

    it('should include all workspace container defaults during initialization', async () => {
      await initializeApex(testDir, {
        projectName: 'container-defaults-test',
      });

      const config = await loadConfig(testDir);

      // Verify full workspace.container structure
      expect(config.workspace).toBeDefined();
      expect(config.workspace?.container).toBeDefined();
      expect(config.workspace?.container?.networkMode).toBe('bridge');
      expect(config.workspace?.container?.autoRemove).toBe(true);
      expect(config.workspace?.container?.resourceLimits).toEqual({
        cpu: 1,
        memory: '512m',
      });
    });

    it('should validate resource limits schema compliance', async () => {
      await initializeApex(testDir, {
        projectName: 'schema-validation-test',
      });

      const config = await loadConfig(testDir);
      const resourceLimits = config.workspace?.container?.resourceLimits;

      // Ensure the created resource limits are valid according to schema
      expect(() => ResourceLimitsSchema.parse(resourceLimits)).not.toThrow();

      // Verify CPU is within valid range (0.1-64)
      expect(resourceLimits?.cpu).toBeGreaterThanOrEqual(0.1);
      expect(resourceLimits?.cpu).toBeLessThanOrEqual(64);

      // Verify memory format matches regex pattern
      expect(resourceLimits?.memory).toMatch(/^\d+[kmgKMG]?$/);
    });

    it('should use ApexConfigSchema.parse() to apply all defaults correctly', async () => {
      await initializeApex(testDir, {
        projectName: 'defaults-test',
        language: 'javascript',
        framework: 'react',
      });

      const config = await loadConfig(testDir);

      // Verify the config was created using schema defaults
      expect(config.version).toBe('1.0');
      expect(config.project.name).toBe('defaults-test');
      expect(config.project.language).toBe('javascript');
      expect(config.project.framework).toBe('react');

      // Verify other defaults are applied
      expect(config.autonomy?.default).toBe('review-before-merge');
      expect(config.agents?.enabled).toContain('tester');
      expect(config.models?.planning).toBe('opus');
      expect(config.git?.branchPrefix).toBe('apex/');
      expect(config.limits?.maxTokensPerTask).toBe(500000);

      // Verify workspace defaults including container resource limits
      expect(config.workspace?.defaultStrategy).toBe('none');
      expect(config.workspace?.cleanupOnComplete).toBe(true);
      expect(config.workspace?.container?.resourceLimits?.cpu).toBe(1);
      expect(config.workspace?.container?.resourceLimits?.memory).toBe('512m');
    });
  });

  describe('Resource limits validation', () => {
    it('should create sensible CPU limit default', async () => {
      await initializeApex(testDir, {
        projectName: 'cpu-test',
      });

      const config = await loadConfig(testDir);
      const cpu = config.workspace?.container?.resourceLimits?.cpu;

      expect(cpu).toBe(1);
      expect(typeof cpu).toBe('number');
      expect(cpu).toBeGreaterThan(0);
      expect(cpu).toBeLessThanOrEqual(64); // Max allowed by schema
    });

    it('should create sensible memory limit default', async () => {
      await initializeApex(testDir, {
        projectName: 'memory-test',
      });

      const config = await loadConfig(testDir);
      const memory = config.workspace?.container?.resourceLimits?.memory;

      expect(memory).toBe('512m');
      expect(typeof memory).toBe('string');
      expect(memory).toMatch(/^\d+[kmgKMG]?$/); // Matches schema regex
    });

    it('should not include optional resource limit fields by default', async () => {
      await initializeApex(testDir, {
        projectName: 'optional-fields-test',
      });

      const config = await loadConfig(testDir);
      const resourceLimits = config.workspace?.container?.resourceLimits;

      // Only cpu and memory should be set, other optional fields undefined
      expect(resourceLimits?.cpu).toBeDefined();
      expect(resourceLimits?.memory).toBeDefined();
      expect(resourceLimits?.memoryReservation).toBeUndefined();
      expect(resourceLimits?.memorySwap).toBeUndefined();
      expect(resourceLimits?.cpuShares).toBeUndefined();
      expect(resourceLimits?.pidsLimit).toBeUndefined();
    });
  });

  describe('Config file structure validation', () => {
    it('should create valid YAML config file with resource limits', async () => {
      await initializeApex(testDir, {
        projectName: 'yaml-structure-test',
      });

      // Read the raw YAML file to verify structure
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const yamlContent = await fs.readFile(configPath, 'utf-8');

      // Verify the YAML contains workspace.container.resourceLimits section
      expect(yamlContent).toContain('workspace:');
      expect(yamlContent).toContain('container:');
      expect(yamlContent).toContain('resourceLimits:');
      expect(yamlContent).toContain('cpu: 1');
      expect(yamlContent).toContain('memory: 512m');
      expect(yamlContent).toContain('networkMode: bridge');
      expect(yamlContent).toContain('autoRemove: true');
    });

    it('should create config that validates against ApexConfigSchema', async () => {
      await initializeApex(testDir, {
        projectName: 'schema-compliance-test',
      });

      const config = await loadConfig(testDir);

      // Ensure the entire config validates against the schema
      expect(() => ApexConfigSchema.parse(config)).not.toThrow();
    });
  });

  describe('Integration with existing workspace settings', () => {
    it('should include resource limits alongside other workspace container settings', async () => {
      await initializeApex(testDir, {
        projectName: 'integration-test',
      });

      const config = await loadConfig(testDir);
      const containerConfig = config.workspace?.container;

      // Verify all container settings are present
      expect(containerConfig?.networkMode).toBe('bridge');
      expect(containerConfig?.autoRemove).toBe(true);
      expect(containerConfig?.resourceLimits).toEqual({
        cpu: 1,
        memory: '512m',
      });

      // Verify workspace-level settings
      expect(config.workspace?.defaultStrategy).toBe('none');
      expect(config.workspace?.cleanupOnComplete).toBe(true);
    });

    it('should maintain consistent structure with container configuration schema', async () => {
      await initializeApex(testDir, {
        projectName: 'structure-test',
      });

      const config = await loadConfig(testDir);
      const containerConfig = config.workspace?.container;

      // Verify the structure matches expected container defaults schema
      expect(containerConfig).toHaveProperty('networkMode');
      expect(containerConfig).toHaveProperty('autoRemove');
      expect(containerConfig).toHaveProperty('resourceLimits');

      // Resource limits should have the expected structure
      expect(containerConfig?.resourceLimits).toHaveProperty('cpu');
      expect(containerConfig?.resourceLimits).toHaveProperty('memory');

      // Should not have optional properties unless explicitly set
      expect(containerConfig?.resourceLimits).not.toHaveProperty('memoryReservation');
      expect(containerConfig?.resourceLimits).not.toHaveProperty('memorySwap');
      expect(containerConfig?.resourceLimits).not.toHaveProperty('cpuShares');
      expect(containerConfig?.resourceLimits).not.toHaveProperty('pidsLimit');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle different project configurations consistently', async () => {
      const testCases = [
        { projectName: 'test-minimal' },
        { projectName: 'test-with-lang', language: 'python' },
        { projectName: 'test-full', language: 'typescript', framework: 'nextjs' },
      ];

      for (const testCase of testCases) {
        const subDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-edge-case-'));

        try {
          await initializeApex(subDir, testCase);
          const config = await loadConfig(subDir);

          // All should have the same resource limits defaults
          expect(config.workspace?.container?.resourceLimits?.cpu).toBe(1);
          expect(config.workspace?.container?.resourceLimits?.memory).toBe('512m');
        } finally {
          await fs.rm(subDir, { recursive: true, force: true });
        }
      }
    });

    it('should handle project name with special characters', async () => {
      const specialNames = ['test-project', 'test_project', 'test.project', 'test123'];

      for (const projectName of specialNames) {
        const subDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-special-chars-'));

        try {
          await initializeApex(subDir, { projectName });
          const config = await loadConfig(subDir);

          expect(config.project.name).toBe(projectName);
          expect(config.workspace?.container?.resourceLimits?.cpu).toBe(1);
          expect(config.workspace?.container?.resourceLimits?.memory).toBe('512m');
        } finally {
          await fs.rm(subDir, { recursive: true, force: true });
        }
      }
    });
  });

  describe('Backward compatibility', () => {
    it('should not break existing config loading with new resource limits', async () => {
      // Create a config without resource limits (simulating old version)
      const oldStyleConfig = {
        version: '1.0',
        project: {
          name: 'legacy-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          defaultStrategy: 'none',
          cleanupOnComplete: true,
          container: {
            networkMode: 'bridge',
            autoRemove: true,
            // No resourceLimits field
          },
        },
      };

      // Manually create the directory structure and config
      await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
      const configPath = path.join(testDir, '.apex', 'config.yaml');

      // Save the old-style config
      const yaml = await import('yaml');
      await fs.writeFile(configPath, yaml.stringify(oldStyleConfig), 'utf-8');

      // Loading should work without errors
      const loadedConfig = await loadConfig(testDir);
      expect(loadedConfig.project.name).toBe('legacy-test');
      expect(loadedConfig.workspace?.container?.networkMode).toBe('bridge');

      // Resource limits should be undefined (not added retroactively)
      expect(loadedConfig.workspace?.container?.resourceLimits).toBeUndefined();
    });
  });
});
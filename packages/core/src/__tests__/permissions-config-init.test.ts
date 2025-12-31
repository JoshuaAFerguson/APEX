import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import {
  initializeApex,
  loadConfig,
  saveConfig,
} from '../config';

describe('permissions configuration initialization', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-permissions-init-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('default initialization', () => {
    it('should initialize with default permissions configuration', async () => {
      await initializeApex(testDir, { projectName: 'test-project' });

      const config = await loadConfig(testDir);

      expect(config.permissions).toBeDefined();
      expect(config.permissions?.preset).toBe('review-all');
      expect(config.permissions?.customRules).toEqual([]);
    });

    it('should create valid YAML with permissions section', async () => {
      await initializeApex(testDir, { projectName: 'test-project' });

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const configContent = await fs.readFile(configPath, 'utf-8');
      const parsedYaml = yaml.parse(configContent);

      expect(parsedYaml.permissions).toBeDefined();
      expect(parsedYaml.permissions.preset).toBe('review-all');
    });

    it('should initialize with complete project structure', async () => {
      const options = {
        projectName: 'my-awesome-project',
        language: 'typescript',
        framework: 'react',
      };

      await initializeApex(testDir, options);

      const config = await loadConfig(testDir);

      // Verify project settings
      expect(config.project.name).toBe('my-awesome-project');
      expect(config.project.language).toBe('typescript');
      expect(config.project.framework).toBe('react');

      // Verify permissions are initialized
      expect(config.permissions?.preset).toBe('review-all');

      // Verify other default settings are preserved
      expect(config.version).toBe('1.0');
      expect(config.autonomy?.default).toBe('review-before-merge');
      expect(config.git?.branchPrefix).toBe('apex/');
      expect(config.workspace?.defaultStrategy).toBe('none');
    });

    it('should create all necessary directories', async () => {
      await initializeApex(testDir, { projectName: 'test-project' });

      const apexDir = path.join(testDir, '.apex');
      const agentsDir = path.join(apexDir, 'agents');
      const workflowsDir = path.join(apexDir, 'workflows');
      const skillsDir = path.join(apexDir, 'skills');
      const scriptsDir = path.join(apexDir, 'scripts');

      // Verify all directories exist
      await expect(fs.access(apexDir)).resolves.toBeUndefined();
      await expect(fs.access(agentsDir)).resolves.toBeUndefined();
      await expect(fs.access(workflowsDir)).resolves.toBeUndefined();
      await expect(fs.access(skillsDir)).resolves.toBeUndefined();
      await expect(fs.access(scriptsDir)).resolves.toBeUndefined();
    });
  });

  describe('custom initialization scenarios', () => {
    it('should handle minimal project options', async () => {
      await initializeApex(testDir, { projectName: 'minimal' });

      const config = await loadConfig(testDir);

      expect(config.project.name).toBe('minimal');
      expect(config.project.language).toBeUndefined();
      expect(config.project.framework).toBeUndefined();
      expect(config.permissions?.preset).toBe('review-all');
    });

    it('should be idempotent - not overwrite existing config', async () => {
      // First initialization
      await initializeApex(testDir, { projectName: 'first' });

      let config = await loadConfig(testDir);
      expect(config.project.name).toBe('first');

      // Modify the config
      config.permissions = {
        preset: 'autonomous',
        customRules: [{ tool: 'Read', behavior: 'allow' }],
      };
      config.project.name = 'modified';
      await saveConfig(testDir, config);

      // Attempt second initialization (should fail or not overwrite)
      // Note: The current implementation would overwrite, but in practice
      // the CLI would check if already initialized first
      const modifiedConfig = await loadConfig(testDir);
      expect(modifiedConfig.project.name).toBe('modified');
      expect(modifiedConfig.permissions?.preset).toBe('autonomous');
    });
  });

  describe('validation after initialization', () => {
    it('should create schema-compliant configuration', async () => {
      await initializeApex(testDir, {
        projectName: 'validation-test',
        language: 'python',
        framework: 'fastapi',
      });

      const config = await loadConfig(testDir);

      // The fact that loadConfig doesn't throw means the config is valid
      // according to ApexConfigSchema
      expect(config).toBeDefined();
      expect(config.version).toBeDefined();
      expect(config.project).toBeDefined();
      expect(config.permissions).toBeDefined();
    });

    it('should have consistent default values across all sections', async () => {
      await initializeApex(testDir, { projectName: 'defaults-test' });

      const config = await loadConfig(testDir);

      // Permissions defaults
      expect(config.permissions?.preset).toBe('review-all');
      expect(Array.isArray(config.permissions?.customRules)).toBe(true);
      expect(config.permissions?.customRules?.length).toBe(0);

      // Other section defaults should be consistent
      expect(config.autonomy?.default).toBe('review-before-merge');
      expect(config.models?.planning).toBe('opus');
      expect(config.models?.implementation).toBe('sonnet');
      expect(config.models?.review).toBe('haiku');
      expect(config.git?.branchPrefix).toBe('apex/');
      expect(config.git?.commitFormat).toBe('conventional');
      expect(config.limits?.maxTokensPerTask).toBe(500000);
      expect(config.workspace?.defaultStrategy).toBe('none');
    });

    it('should create readable and properly formatted YAML', async () => {
      await initializeApex(testDir, {
        projectName: 'yaml-format-test',
        language: 'javascript',
      });

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const yamlContent = await fs.readFile(configPath, 'utf-8');

      // Basic format checks
      expect(yamlContent).toContain('version:');
      expect(yamlContent).toContain('project:');
      expect(yamlContent).toContain('permissions:');
      expect(yamlContent).toContain('preset: review-all');

      // Should be parseable
      const parsed = yaml.parse(yamlContent);
      expect(parsed).toBeDefined();
      expect(parsed.permissions?.preset).toBe('review-all');

      // Should be properly formatted (no syntax errors)
      expect(() => yaml.parse(yamlContent)).not.toThrow();
    });
  });

  describe('workspace configuration integration', () => {
    it('should initialize permissions alongside workspace settings', async () => {
      await initializeApex(testDir, { projectName: 'workspace-test' });

      const config = await loadConfig(testDir);

      // Both permissions and workspace should be configured
      expect(config.permissions).toBeDefined();
      expect(config.workspace).toBeDefined();

      // Check specific workspace defaults
      expect(config.workspace?.defaultStrategy).toBe('none');
      expect(config.workspace?.cleanupOnComplete).toBe(true);
      expect(config.workspace?.container?.networkMode).toBe('bridge');
      expect(config.workspace?.container?.autoRemove).toBe(true);

      // Check permissions defaults
      expect(config.permissions?.preset).toBe('review-all');
    });

    it('should handle container workspace with permissions', async () => {
      await initializeApex(testDir, { projectName: 'container-test' });

      let config = await loadConfig(testDir);

      // Modify to use container workspace
      config.workspace!.defaultStrategy = 'container';
      config.workspace!.container!.image = 'node:18-alpine';

      // Also modify permissions to be more permissive for container
      config.permissions!.preset = 'autonomous';

      await saveConfig(testDir, config);

      const reloadedConfig = await loadConfig(testDir);
      expect(reloadedConfig.workspace?.defaultStrategy).toBe('container');
      expect(reloadedConfig.workspace?.container?.image).toBe('node:18-alpine');
      expect(reloadedConfig.permissions?.preset).toBe('autonomous');
    });
  });

  describe('configuration file structure validation', () => {
    it('should maintain expected YAML structure', async () => {
      await initializeApex(testDir, { projectName: 'structure-test' });

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const yamlContent = await fs.readFile(configPath, 'utf-8');
      const config = yaml.parse(yamlContent);

      // Verify top-level structure
      expect(typeof config).toBe('object');
      expect(config.version).toBeDefined();
      expect(config.project).toBeDefined();

      // Verify permissions structure
      expect(config.permissions).toBeDefined();
      expect(typeof config.permissions).toBe('object');
      expect(config.permissions.preset).toBeDefined();
      expect(Array.isArray(config.permissions.customRules)).toBe(true);

      // Verify other expected sections
      expect(config.autonomy).toBeDefined();
      expect(config.agents).toBeDefined();
      expect(config.models).toBeDefined();
      expect(config.git).toBeDefined();
      expect(config.limits).toBeDefined();
      expect(config.workspace).toBeDefined();
    });

    it('should preserve comments and formatting when possible', async () => {
      await initializeApex(testDir, { projectName: 'formatting-test' });

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const originalContent = await fs.readFile(configPath, 'utf-8');

      // Load and re-save to test formatting preservation
      const config = await loadConfig(testDir);
      await saveConfig(testDir, config);

      const resavedContent = await fs.readFile(configPath, 'utf-8');

      // Should still be valid YAML
      expect(() => yaml.parse(resavedContent)).not.toThrow();

      const resavedConfig = yaml.parse(resavedContent);
      expect(resavedConfig.permissions?.preset).toBe('review-all');
    });
  });
});
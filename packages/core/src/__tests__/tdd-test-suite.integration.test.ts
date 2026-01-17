import { describe, it, expect } from 'vitest';
import { TDDModeConfigSchema, WorkflowDefinitionSchema, AgentDefinitionSchema } from '../types';
import { initializeApex, loadConfig, getEffectiveConfig } from '../config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('TDD Integration Test Suite', () => {
  describe('Schema and Type Validation', () => {
    it('should import and validate TDD types correctly', () => {
      expect(TDDModeConfigSchema).toBeDefined();
      expect(WorkflowDefinitionSchema).toBeDefined();
      expect(AgentDefinitionSchema).toBeDefined();
    });

    it('should validate minimal TDD configuration', () => {
      const config = {};
      const result = TDDModeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('Configuration Integration', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-integration-'));
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should initialize APEX with TDD configuration', async () => {
      await initializeApex(tempDir, { projectName: 'test-project' });
      const config = await loadConfig(tempDir);

      expect(config).toBeDefined();
      expect(config.tdd).toBeDefined();
      expect(config.tdd.enabled).toBe(false);
      expect(config.tdd.testCommand).toBe('npm test');
    });

    it('should apply effective configuration defaults for TDD', async () => {
      await initializeApex(tempDir, { projectName: 'test-project' });
      const config = await loadConfig(tempDir);
      const effectiveConfig = getEffectiveConfig(config);

      expect(effectiveConfig.tdd).toEqual({
        enabled: false,
        testCommand: 'npm test',
        watchMode: false,
        maxIterations: 5,
        regressionGuard: true,
      });
    });
  });

  describe('Template File Validation', () => {
    it('should have TDD workflow template file', async () => {
      const templatePath = path.join(__dirname, '../../templates/workflows/tdd.yaml');

      // File should exist and be readable
      const stats = await fs.stat(templatePath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);

      // Content should be valid
      const content = await fs.readFile(templatePath, 'utf-8');
      expect(content.length).toBeGreaterThan(100);
      expect(content).toContain('tdd');
      expect(content).toContain('stages:');
    });

    it('should have TDD agent template files', async () => {
      const agentFiles = [
        'tdd-tester.md',
        'tdd-developer.md'
      ];

      for (const agentFile of agentFiles) {
        const templatePath = path.join(__dirname, '../../templates/agents', agentFile);

        // File should exist and be readable
        const stats = await fs.stat(templatePath);
        expect(stats.isFile()).toBe(true);
        expect(stats.size).toBeGreaterThan(0);

        // Content should be valid markdown with frontmatter
        const content = await fs.readFile(templatePath, 'utf-8');
        expect(content).toMatch(/^---\n[\s\S]*?\n---\n/);
        expect(content).toContain('name:');
        expect(content).toContain('description:');
        expect(content).toContain('tools:');
        expect(content).toContain('model:');
      }
    });
  });

  describe('End-to-End TDD Workflow', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-e2e-'));
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should complete full TDD configuration setup', async () => {
      // Initialize project
      await initializeApex(tempDir, {
        projectName: 'e2e-test',
        language: 'typescript',
        framework: 'react'
      });

      // Load and verify configuration
      const config = await loadConfig(tempDir);
      expect(config.project.name).toBe('e2e-test');
      expect(config.project.language).toBe('typescript');
      expect(config.project.framework).toBe('react');
      expect(config.tdd).toBeDefined();

      // Verify effective configuration
      const effectiveConfig = getEffectiveConfig(config);
      expect(effectiveConfig.tdd.enabled).toBe(false);
      expect(effectiveConfig.tdd.testCommand).toBe('npm test');
      expect(effectiveConfig.tdd.maxIterations).toBe(5);
      expect(effectiveConfig.tdd.regressionGuard).toBe(true);
    });

    it('should handle custom TDD configuration', async () => {
      await initializeApex(tempDir, { projectName: 'custom-test' });

      // Update configuration with custom TDD settings
      const configPath = path.join(tempDir, '.apex', 'config.yaml');
      let configContent = await fs.readFile(configPath, 'utf-8');

      configContent = configContent.replace(
        /tdd:\s*\n(?:  [^\n]*\n)*/,
        `tdd:
  enabled: true
  testCommand: "yarn test"
  watchMode: true
  maxIterations: 10
  regressionGuard: false
`
      );

      await fs.writeFile(configPath, configContent);

      // Reload and verify
      const updatedConfig = await loadConfig(tempDir);
      expect(updatedConfig.tdd.enabled).toBe(true);
      expect(updatedConfig.tdd.testCommand).toBe('yarn test');
      expect(updatedConfig.tdd.watchMode).toBe(true);
      expect(updatedConfig.tdd.maxIterations).toBe(10);
      expect(updatedConfig.tdd.regressionGuard).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-error-'));
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should handle invalid TDD configuration gracefully', async () => {
      await initializeApex(tempDir, { projectName: 'error-test' });

      const configPath = path.join(tempDir, '.apex', 'config.yaml');
      let configContent = await fs.readFile(configPath, 'utf-8');

      // Add invalid TDD configuration
      configContent += '\ntdd:\n  enabled: "invalid_boolean"\n  maxIterations: -5\n';
      await fs.writeFile(configPath, configContent);

      // Should throw validation error
      await expect(loadConfig(tempDir)).rejects.toThrow();
    });

    it('should handle missing project configuration', async () => {
      // Should throw appropriate error for uninitialized project
      await expect(loadConfig(tempDir)).rejects.toThrow(/not initialized/i);
    });

    it('should validate TDD configuration against schema', () => {
      const invalidConfigs = [
        { enabled: 'true' }, // string instead of boolean
        { maxIterations: 0 }, // below minimum
        { testCommand: 123 }, // number instead of string
        { watchMode: 'false' }, // string instead of boolean
      ];

      for (const config of invalidConfigs) {
        const result = TDDModeConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('Performance and Reliability', () => {
    it('should validate TDD schema efficiently', () => {
      const config = {
        enabled: true,
        testCommand: 'npm test',
        watchMode: false,
        maxIterations: 5,
        regressionGuard: true,
      };

      // Run validation multiple times to ensure consistency
      for (let i = 0; i < 100; i++) {
        const result = TDDModeConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      }
    });

    it('should handle large configuration files', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-perf-'));

      try {
        await initializeApex(tempDir, { projectName: 'perf-test' });

        // Add large comment to config to simulate large file
        const configPath = path.join(tempDir, '.apex', 'config.yaml');
        let configContent = await fs.readFile(configPath, 'utf-8');

        const largeComment = '# ' + 'A'.repeat(1000) + '\n';
        configContent = largeComment + configContent;

        await fs.writeFile(configPath, configContent);

        // Should still load quickly
        const startTime = Date.now();
        const config = await loadConfig(tempDir);
        const duration = Date.now() - startTime;

        expect(config).toBeDefined();
        expect(config.tdd).toBeDefined();
        expect(duration).toBeLessThan(1000); // Should load in under 1 second
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
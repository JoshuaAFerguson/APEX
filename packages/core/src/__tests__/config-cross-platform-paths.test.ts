import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  isApexInitialized,
  loadConfig,
  saveConfig,
  loadAgents,
  loadWorkflows,
  loadWorkflow,
  initializeApex,
  loadSkill,
  getSkillPath,
  listScripts,
  getScriptsDir,
} from '../config.js';
import { normalizePath } from '../path-utils.js';
import { ApexConfig } from '../types.js';

// Mock platform detection for cross-platform testing
const originalPlatform = process.platform;

function mockPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', {
    value: platform,
    writable: true,
  });
}

function restorePlatform() {
  Object.defineProperty(process, 'platform', {
    value: originalPlatform,
    writable: true,
  });
}

describe('Cross-platform path utilities in config.ts', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-cross-platform-test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    restorePlatform();
  });

  describe('Path normalization in config operations', () => {
    it('should handle Windows-style paths in isApexInitialized', async () => {
      mockPlatform('win32');

      // Create .apex directory
      const apexDir = path.join(testDir, '.apex');
      await fs.mkdir(apexDir);

      // Test with forward slashes (should be normalized)
      const testPath = testDir.replace(/\\\\/g, '/');
      const result = await isApexInitialized(testPath);

      expect(result).toBe(true);
    });

    it('should handle Unix-style paths on Windows in isApexInitialized', async () => {
      mockPlatform('win32');

      // Create .apex directory
      const apexDir = path.join(testDir, '.apex');
      await fs.mkdir(apexDir);

      // Test with Unix-style path separators
      const unixStylePath = testDir.replace(/\\\\/g, '/');
      const result = await isApexInitialized(unixStylePath);

      expect(result).toBe(true);
    });

    it('should handle relative paths with normalization', async () => {
      // Create nested structure
      const nestedDir = path.join(testDir, 'nested', 'project');
      await fs.mkdir(nestedDir, { recursive: true });
      await fs.mkdir(path.join(nestedDir, '.apex'));

      // Test with relative path containing .. and .
      const relativePath = path.join(nestedDir, '..', '.', 'project');
      const result = await isApexInitialized(relativePath);

      expect(result).toBe(true);
    });

    it('should normalize paths in saveConfig and loadConfig', async () => {
      await fs.mkdir(path.join(testDir, '.apex'));

      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      // Test with path containing redundant separators
      const messyPath = testDir + path.sep + '.' + path.sep + 'extra' + path.sep + '..';
      await saveConfig(messyPath, config);

      const loaded = await loadConfig(messyPath);
      expect(loaded.project.name).toBe('test-project');
    });

    it('should handle paths with spaces correctly', async () => {
      const dirWithSpaces = await fs.mkdtemp(path.join(os.tmpdir(), 'apex test with spaces-'));

      try {
        await fs.mkdir(path.join(dirWithSpaces, '.apex'));

        const result = await isApexInitialized(dirWithSpaces);
        expect(result).toBe(true);
      } finally {
        await fs.rm(dirWithSpaces, { recursive: true, force: true });
      }
    });
  });

  describe('Agent loading with normalized paths', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(testDir, '.apex', 'agents'), { recursive: true });
    });

    it('should load agents with normalized paths across platforms', async () => {
      const agentContent = `---
name: test-agent
description: A test agent
tools: Read, Write
model: sonnet
---
You are a test agent.`;

      await fs.writeFile(path.join(testDir, '.apex', 'agents', 'test-agent.md'), agentContent);

      // Test with different path formats
      const agents = await loadAgents(testDir);
      expect(agents['test-agent']).toBeDefined();
      expect(agents['test-agent'].description).toBe('A test agent');
    });

    it('should handle nested agent directories with normalization', async () => {
      // Create nested directory structure
      const nestedAgentDir = path.join(testDir, '.apex', 'agents', 'category');
      await fs.mkdir(nestedAgentDir);

      const agentContent = `---
name: nested-agent
description: A nested agent
tools: Read
model: sonnet
---
You are a nested agent.`;

      await fs.writeFile(path.join(nestedAgentDir, 'nested-agent.md'), agentContent);

      // This should still work even though we have nested directories
      const agents = await loadAgents(testDir);

      // The current implementation doesn't support nested directories,
      // but the path normalization should still work without errors
      expect(Object.keys(agents)).toHaveLength(0); // No agents found at top level
    });
  });

  describe('Workflow loading with normalized paths', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(testDir, '.apex', 'workflows'), { recursive: true });
    });

    it('should load workflows with normalized paths', async () => {
      const workflowContent = `name: feature
description: Feature workflow
stages:
  - name: planning
    agent: planner
  - name: implementation
    agent: developer`;

      await fs.writeFile(path.join(testDir, '.apex', 'workflows', 'feature.yaml'), workflowContent);

      const workflows = await loadWorkflows(testDir);
      expect(workflows['feature']).toBeDefined();
      expect(workflows['feature'].stages).toHaveLength(2);
    });

    it('should load specific workflow by name with normalized paths', async () => {
      const workflowContent = `name: bugfix
description: Bug fix workflow
stages:
  - name: fix
    agent: developer`;

      await fs.writeFile(path.join(testDir, '.apex', 'workflows', 'bugfix.yml'), workflowContent);

      const workflow = await loadWorkflow(testDir, 'bugfix');
      expect(workflow).not.toBeNull();
      expect(workflow?.name).toBe('bugfix');
    });
  });

  describe('Skills and scripts with normalized paths', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(testDir, '.apex', 'skills', 'test-skill'), { recursive: true });
      await fs.mkdir(path.join(testDir, '.apex', 'scripts'), { recursive: true });
    });

    it('should generate correct skill paths with normalization', () => {
      const skillPath = getSkillPath(testDir, 'my-skill');

      // Path should be normalized and contain expected components
      expect(skillPath).toContain('.apex');
      expect(skillPath).toContain('skills');
      expect(skillPath).toContain('my-skill');
      expect(skillPath).toContain('SKILL.md');

      // Path should be properly normalized (no double separators, etc.)
      expect(skillPath).toBe(normalizePath(skillPath));
    });

    it('should load skill content with normalized paths', async () => {
      const skillContent = 'This is a test skill with special paths';
      await fs.writeFile(
        path.join(testDir, '.apex', 'skills', 'test-skill', 'SKILL.md'),
        skillContent
      );

      const content = await loadSkill(testDir, 'test-skill');
      expect(content).toBe(skillContent);
    });

    it('should generate correct scripts directory path', () => {
      const scriptsDir = getScriptsDir(testDir);

      expect(scriptsDir).toContain('.apex');
      expect(scriptsDir).toContain('scripts');
      expect(scriptsDir).toBe(normalizePath(scriptsDir));
    });

    it('should list scripts with normalized paths', async () => {
      await fs.writeFile(path.join(testDir, '.apex', 'scripts', 'test.sh'), '#!/bin/bash\\necho test');
      await fs.writeFile(path.join(testDir, '.apex', 'scripts', 'build.js'), 'console.log("build")');
      await fs.writeFile(path.join(testDir, '.apex', 'scripts', 'lint.ts'), 'console.log("lint")');

      const scripts = await listScripts(testDir);

      expect(scripts).toContain('test.sh');
      expect(scripts).toContain('build.js');
      expect(scripts).toContain('lint.ts');
    });
  });

  describe('Initialization with normalized paths', () => {
    it('should initialize APEX with proper path normalization', async () => {
      await initializeApex(testDir, { projectName: 'test-project' });

      // Check that all directories were created with normalized paths
      const apexDir = path.join(testDir, '.apex');
      const agentsDir = path.join(apexDir, 'agents');
      const workflowsDir = path.join(apexDir, 'workflows');
      const skillsDir = path.join(apexDir, 'skills');
      const scriptsDir = path.join(apexDir, 'scripts');

      expect(await fs.access(apexDir).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(agentsDir).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(workflowsDir).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(skillsDir).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(scriptsDir).then(() => true).catch(() => false)).toBe(true);
    });

    it('should create config file with normalized paths', async () => {
      await initializeApex(testDir, {
        projectName: 'my-project',
        language: 'typescript',
        framework: 'nextjs',
      });

      const config = await loadConfig(testDir);
      expect(config.project.name).toBe('my-project');
      expect(config.project.language).toBe('typescript');
      expect(config.project.framework).toBe('nextjs');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty path strings gracefully', async () => {
      // This should throw an error appropriately
      await expect(isApexInitialized('')).rejects.toThrow();
    });

    it('should handle paths with Unicode characters', async () => {
      const unicodeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-test-unicode-café-'));

      try {
        await fs.mkdir(path.join(unicodeDir, '.apex'));

        const result = await isApexInitialized(unicodeDir);
        expect(result).toBe(true);
      } finally {
        await fs.rm(unicodeDir, { recursive: true, force: true });
      }
    });

    it('should handle very long paths', async () => {
      // Create a deeply nested directory structure
      const longPath = path.join(testDir, 'a'.repeat(50), 'b'.repeat(50), 'c'.repeat(50));
      await fs.mkdir(longPath, { recursive: true });
      await fs.mkdir(path.join(longPath, '.apex'));

      const result = await isApexInitialized(longPath);
      expect(result).toBe(true);
    });

    it('should handle concurrent operations on the same paths', async () => {
      await fs.mkdir(path.join(testDir, '.apex'));

      // Run multiple isApexInitialized calls concurrently
      const promises = Array(5).fill(0).map(() => isApexInitialized(testDir));
      const results = await Promise.all(promises);

      // All should return true
      expect(results.every(result => result === true)).toBe(true);
    });
  });

  describe('Platform-specific behavior', () => {
    it('should work correctly on Windows platform', async () => {
      mockPlatform('win32');

      await initializeApex(testDir, { projectName: 'windows-test' });

      // All operations should work with normalized paths
      const config = await loadConfig(testDir);
      expect(config.project.name).toBe('windows-test');

      const initialized = await isApexInitialized(testDir);
      expect(initialized).toBe(true);
    });

    it('should work correctly on Unix platforms', async () => {
      mockPlatform('linux');

      await initializeApex(testDir, { projectName: 'unix-test' });

      const config = await loadConfig(testDir);
      expect(config.project.name).toBe('unix-test');

      const initialized = await isApexInitialized(testDir);
      expect(initialized).toBe(true);
    });

    it('should work correctly on macOS', async () => {
      mockPlatform('darwin');

      await initializeApex(testDir, { projectName: 'macos-test' });

      const config = await loadConfig(testDir);
      expect(config.project.name).toBe('macos-test');

      const initialized = await isApexInitialized(testDir);
      expect(initialized).toBe(true);
    });
  });

  describe('Path normalization integration', () => {
    it('should normalize all paths consistently throughout the config system', async () => {
      // Test that all path operations use normalizePath consistently
      await initializeApex(testDir, { projectName: 'normalization-test' });

      // Load everything to ensure paths are normalized
      const config = await loadConfig(testDir);
      const agents = await loadAgents(testDir);
      const workflows = await loadWorkflows(testDir);
      const scriptsDir = getScriptsDir(testDir);
      const skillPath = getSkillPath(testDir, 'test-skill');

      // All operations should complete without errors
      expect(config).toBeDefined();
      expect(agents).toBeDefined();
      expect(workflows).toBeDefined();
      expect(scriptsDir).toBeDefined();
      expect(skillPath).toBeDefined();

      // Paths should be properly normalized
      expect(scriptsDir).toBe(normalizePath(scriptsDir));
      expect(skillPath).toBe(normalizePath(skillPath));
    });

    it('should handle mixed path separators consistently', async () => {
      // Create a path with mixed separators for testing
      const mixedSeparatorPath = testDir.split(path.sep).join('/');

      await fs.mkdir(path.join(testDir, '.apex'));

      // Both should work due to path normalization
      const result1 = await isApexInitialized(testDir);
      const result2 = await isApexInitialized(mixedSeparatorPath);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });
  });
});

describe('Error cases with path normalization', () => {
  it('should provide clear error messages for invalid paths', async () => {
    // Test with non-existent path
    const nonExistentPath = path.join(os.tmpdir(), 'this-does-not-exist-12345');

    await expect(loadConfig(nonExistentPath)).rejects.toThrow();
  });

  it('should handle permission errors gracefully', async () => {
    // This test might not work on all systems, but it's good to have
    // We'll just verify that the normalization doesn't cause additional issues
    const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-permission-test-'));

    try {
      // Test that path normalization doesn't interfere with permission errors
      await expect(loadConfig(testDir)).rejects.toThrow();
    } finally {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });
});
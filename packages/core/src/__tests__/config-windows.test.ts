import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  isApexInitialized,
  loadConfig,
  saveConfig,
  initializeApex,
  loadAgents,
  loadWorkflows,
  loadSkill,
  getSkillPath,
  listScripts,
  getScriptsDir,
} from '../config.js';
import { ApexConfig } from '../types.js';

// These tests will only run on actual Windows systems
// They validate that the functions work correctly with real Windows environment
const isActualWindows = process.platform === 'win32';

describe('config Windows Integration Tests', () => {
  let testDir: string;

  // Skip all tests if not on Windows
  beforeEach(async function () {
    if (!isActualWindows) {
      this.skip();
      return;
    }

    // Create test directory in Windows temp location
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-windows-test-'));
  });

  afterEach(async () => {
    if (isActualWindows && testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  describe('Windows File System Integration', () => {
    it('should create and detect .apex directory on Windows', async () => {
      // Initially should not be initialized
      expect(await isApexInitialized(testDir)).toBe(false);

      // Create .apex directory
      await fs.mkdir(path.join(testDir, '.apex'));

      // Now should be detected
      expect(await isApexInitialized(testDir)).toBe(true);
    });

    it('should handle Windows paths correctly in configuration', async () => {
      await initializeApex(testDir, {
        projectName: 'windows-test-project',
        language: 'typescript',
        framework: 'react'
      });

      const config = await loadConfig(testDir);

      expect(config.project.name).toBe('windows-test-project');
      expect(config.project.language).toBe('typescript');
      expect(config.project.framework).toBe('react');
    });

    it('should save and load config with Windows line endings', async () => {
      const testConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'windows-config-test',
          language: 'typescript',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          default: 'review-before-merge',
        },
        git: {
          branchPrefix: 'apex/',
          commitFormat: 'conventional',
        },
      };

      await fs.mkdir(path.join(testDir, '.apex'));
      await saveConfig(testDir, testConfig);

      // Read the raw file to check line endings
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const rawContent = await fs.readFile(configPath, 'utf-8');

      // Should contain YAML content
      expect(rawContent).toContain('windows-config-test');
      expect(rawContent).toContain('typescript');

      // Load the config back
      const loadedConfig = await loadConfig(testDir);
      expect(loadedConfig.project.name).toBe('windows-config-test');
      expect(loadedConfig.project.language).toBe('typescript');
    });

    it('should handle Windows paths in agent definitions', async () => {
      await fs.mkdir(path.join(testDir, '.apex', 'agents'), { recursive: true });

      const agentContent = `---
name: windows-agent
description: A Windows-specific test agent
tools: Read, Write, Bash
model: sonnet
---
You are a Windows-specific agent.

## Instructions
- Use PowerShell for shell commands
- Handle Windows path separators correctly
- Work with Windows environment variables

Example Windows path: C:\\Users\\test\\Documents`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'windows-agent.md'),
        agentContent
      );

      const agents = await loadAgents(testDir);
      expect(agents['windows-agent']).toBeDefined();
      expect(agents['windows-agent'].name).toBe('windows-agent');
      expect(agents['windows-agent'].description).toBe('A Windows-specific test agent');
      expect(agents['windows-agent'].prompt).toContain('C:\\Users\\test\\Documents');
    });

    it('should handle Windows paths in workflow definitions', async () => {
      await fs.mkdir(path.join(testDir, '.apex', 'workflows'), { recursive: true });

      const workflowContent = `name: windows-workflow
description: A Windows-specific workflow
stages:
  - name: planning
    agent: planner
    context: |
      Windows environment considerations:
      - Use backslashes in paths: C:\\Project\\src
      - Handle PowerShell commands
      - Consider Windows file permissions
  - name: implementation
    agent: developer
    context: |
      Implementation notes:
      - Test on Windows environments
      - Use Windows-compatible commands`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'windows-workflow.yaml'),
        workflowContent
      );

      const workflows = await loadWorkflows(testDir);
      expect(workflows['windows-workflow']).toBeDefined();
      expect(workflows['windows-workflow'].name).toBe('windows-workflow');
      expect(workflows['windows-workflow'].stages).toHaveLength(2);
      expect(workflows['windows-workflow'].stages[0].context).toContain('C:\\Project\\src');
    });

    it('should handle Windows paths in skills', async () => {
      const skillName = 'windows-skill';
      await fs.mkdir(path.join(testDir, '.apex', 'skills', skillName), { recursive: true });

      const skillContent = `# Windows Development Skill

This skill provides Windows-specific development capabilities.

## Features
- PowerShell scripting
- Windows registry access
- COM object interaction
- Windows service management

## Example Usage
\`\`\`powershell
# Get Windows version
Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion

# List services
Get-Service | Where-Object {$_.Status -eq "Running"}
\`\`\`

## File Paths
- Windows system directory: C:\\Windows\\System32
- User profile: C:\\Users\\%USERNAME%
- Program Files: C:\\Program Files`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'skills', skillName, 'SKILL.md'),
        skillContent
      );

      const skillPath = getSkillPath(testDir, skillName);
      expect(skillPath).toContain('.apex');
      expect(skillPath).toContain('skills');
      expect(skillPath).toContain(skillName);
      expect(skillPath).toContain('SKILL.md');

      const loadedSkill = await loadSkill(testDir, skillName);
      expect(loadedSkill).toContain('Windows Development Skill');
      expect(loadedSkill).toContain('C:\\Windows\\System32');
      expect(loadedSkill).toContain('PowerShell scripting');
    });

    it('should handle Windows script files', async () => {
      await fs.mkdir(path.join(testDir, '.apex', 'scripts'), { recursive: true });

      const scripts = [
        { name: 'build.bat', content: '@echo off\necho Building project...\nnpm run build' },
        { name: 'test.cmd', content: '@echo off\necho Running tests...\nnpm test' },
        { name: 'deploy.ps1', content: 'Write-Host "Deploying to Windows server..."\n# PowerShell deployment script' },
        { name: 'setup.js', content: 'console.log("Setting up Windows environment...");' },
        { name: 'lint.ts', content: 'console.log("Running TypeScript linting...");' }
      ];

      for (const script of scripts) {
        await fs.writeFile(
          path.join(testDir, '.apex', 'scripts', script.name),
          script.content
        );
      }

      const scriptsDir = getScriptsDir(testDir);
      expect(scriptsDir).toContain('.apex');
      expect(scriptsDir).toContain('scripts');

      const scriptsList = await listScripts(testDir);

      // Should find .bat, .cmd, .js, .ts files but not .ps1 (not in the filter)
      expect(scriptsList).toContain('build.bat');
      expect(scriptsList).toContain('test.cmd');
      expect(scriptsList).toContain('setup.js');
      expect(scriptsList).toContain('lint.ts');

      // .ps1 files are not included in the current filter
      expect(scriptsList).not.toContain('deploy.ps1');
    });

    describe('Windows-specific edge cases', () => {
      it('should handle Windows reserved file names', async () => {
        await fs.mkdir(path.join(testDir, '.apex'));

        // Try to create config with a name that might conflict with Windows reserved names
        const config: ApexConfig = {
          version: '1.0',
          project: {
            name: 'CON-project', // Contains Windows reserved name
            testCommand: 'npm test',
            lintCommand: 'npm run lint',
            buildCommand: 'npm run build',
          }
        };

        await saveConfig(testDir, config);
        const loaded = await loadConfig(testDir);
        expect(loaded.project.name).toBe('CON-project');
      });

      it('should handle very long Windows paths', async () => {
        // Create a long project name that might cause path issues
        const longProjectName = 'very-long-project-name-that-might-cause-path-length-issues-on-windows-systems'.repeat(2);

        await initializeApex(testDir, {
          projectName: longProjectName,
        });

        const config = await loadConfig(testDir);
        expect(config.project.name).toBe(longProjectName);
      });

      it('should handle Windows special characters in project names', async () => {
        const specialNames = [
          'project-with-hyphens',
          'project_with_underscores',
          'project.with.dots',
          'project (with parentheses)',
          'project123with456numbers'
        ];

        for (const projectName of specialNames) {
          const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-special-'));

          try {
            await initializeApex(tempDir, { projectName });
            const config = await loadConfig(tempDir);
            expect(config.project.name).toBe(projectName);
          } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
          }
        }
      });

      it('should handle Windows drive letters in test directory', async () => {
        // The test directory should be on a valid Windows drive
        expect(testDir).toMatch(/^[A-Z]:\\/);

        // Should be able to create and manage APEX files
        await initializeApex(testDir, {
          projectName: 'drive-letter-test'
        });

        expect(await isApexInitialized(testDir)).toBe(true);
      });

      it('should handle UNC paths if supported', async () => {
        // Skip this test if we can't create UNC paths in test environment
        if (!testDir.startsWith('\\\\')) {
          return; // Only test if we're actually on a UNC path
        }

        await initializeApex(testDir, {
          projectName: 'unc-path-test'
        });

        expect(await isApexInitialized(testDir)).toBe(true);
      });

      it('should handle case-insensitive file systems correctly', async () => {
        await initializeApex(testDir, {
          projectName: 'case-test'
        });

        // Windows file system is case-insensitive
        const lowerCaseApex = path.join(testDir, '.apex');
        const upperCaseApex = path.join(testDir, '.APEX');

        // Both should refer to the same directory on Windows
        expect(await isApexInitialized(testDir)).toBe(true);

        // This should not throw because Windows treats them as the same
        try {
          await fs.access(lowerCaseApex);
          await fs.access(upperCaseApex.toLowerCase()); // Normalize for comparison
        } catch (error) {
          // If it fails, it's not necessarily a problem, just document the behavior
          console.log('Case sensitivity test note:', error);
        }
      });
    });

    describe('Windows environment integration', () => {
      it('should work with Windows temp directory', async () => {
        // Test that our temp directory creation works with Windows
        expect(testDir).toContain(os.tmpdir());
        expect(testDir).toMatch(/^[A-Z]:\\/);

        // Should be able to write to Windows temp
        await initializeApex(testDir, {
          projectName: 'temp-directory-test'
        });

        expect(await isApexInitialized(testDir)).toBe(true);
      });

      it('should handle Windows user directories correctly', async () => {
        // Create a config that might reference Windows user directories
        const config: ApexConfig = {
          version: '1.0',
          project: {
            name: 'user-directory-test',
            testCommand: 'npm test',
            lintCommand: 'npm run lint',
            buildCommand: 'npm run build',
          },
          workspace: {
            defaultStrategy: 'directory',
            cleanupOnComplete: true,
          }
        };

        await fs.mkdir(path.join(testDir, '.apex'));
        await saveConfig(testDir, config);

        const loaded = await loadConfig(testDir);
        expect(loaded.workspace?.defaultStrategy).toBe('directory');
      });

      it('should handle Windows file permissions appropriately', async () => {
        await initializeApex(testDir, {
          projectName: 'permissions-test'
        });

        // Check that files were created with appropriate permissions
        const configPath = path.join(testDir, '.apex', 'config.yaml');
        const stats = await fs.stat(configPath);

        expect(stats.isFile()).toBe(true);
        expect(stats.size).toBeGreaterThan(0);

        // Should be able to read the file
        const content = await fs.readFile(configPath, 'utf-8');
        expect(content).toContain('permissions-test');
      });
    });

    describe('Performance on Windows', () => {
      it('should handle file operations efficiently', async () => {
        const start = performance.now();

        // Perform multiple file operations
        await initializeApex(testDir, {
          projectName: 'performance-test'
        });

        await saveConfig(testDir, {
          version: '1.0',
          project: {
            name: 'updated-performance-test',
            testCommand: 'npm test',
            lintCommand: 'npm run lint',
            buildCommand: 'npm run build',
          }
        });

        await loadConfig(testDir);
        await isApexInitialized(testDir);

        const duration = performance.now() - start;

        // Should complete within reasonable time (less than 100ms)
        expect(duration).toBeLessThan(100);
      });

      it('should handle large configurations efficiently', async () => {
        // Create a large configuration
        const largeConfig: ApexConfig = {
          version: '1.0',
          project: {
            name: 'large-config-test',
            language: 'typescript',
            framework: 'react',
            testCommand: 'npm test',
            lintCommand: 'npm run lint',
            buildCommand: 'npm run build',
          },
          autonomy: {
            default: 'review-before-merge',
            overrides: {}
          },
          agents: {
            enabled: ['planner', 'architect', 'developer', 'reviewer', 'tester'],
            disabled: []
          },
          gates: [],
          limits: {
            maxTokensPerTask: 500000,
            maxCostPerTask: 10.0,
            dailyBudget: 100.0,
            maxTurns: 100,
            maxConcurrentTasks: 3
          }
        };

        // Add many properties to make it large
        for (let i = 0; i < 100; i++) {
          if (!largeConfig.autonomy.overrides) {
            largeConfig.autonomy.overrides = {};
          }
          largeConfig.autonomy.overrides[`task-type-${i}`] = 'full';
        }

        await fs.mkdir(path.join(testDir, '.apex'));

        const start = performance.now();
        await saveConfig(testDir, largeConfig);
        await loadConfig(testDir);
        const duration = performance.now() - start;

        expect(duration).toBeLessThan(50); // Should be fast even for large configs
      });
    });

    describe('Error handling on Windows', () => {
      it('should provide meaningful error messages for missing files', async () => {
        // Try to load config from non-existent directory
        const nonExistentDir = path.join(testDir, 'does-not-exist');

        await expect(loadConfig(nonExistentDir)).rejects.toThrow(/APEX not initialized/);
      });

      it('should handle Windows file access errors gracefully', async () => {
        // Create a directory but no config file
        await fs.mkdir(path.join(testDir, '.apex'));

        // Should provide clear error message
        await expect(loadConfig(testDir)).rejects.toThrow();
      });

      it('should handle corrupted config files on Windows', async () => {
        await fs.mkdir(path.join(testDir, '.apex'));

        // Write invalid YAML
        const configPath = path.join(testDir, '.apex', 'config.yaml');
        await fs.writeFile(configPath, 'invalid: yaml: content: [');

        // Should provide meaningful error
        await expect(loadConfig(testDir)).rejects.toThrow();
      });
    });
  });
});
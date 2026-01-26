import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  isApexInitialized,
  parseAgentMarkdown,
  getSkillPath,
  loadSkill,
  getScriptsDir,
  listScripts,
  getMCPServers,
  isMCPEnabled,
  initializeApex,
  loadConfig,
} from '../config';
import { ApexConfig } from '../types';

describe('JSDoc Examples Verification', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-jsdoc-examples-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Basic Function Examples', () => {
    it('should verify isApexInitialized example', async () => {
      // From JSDoc: Check if APEX is initialized
      const notInitialized = await isApexInitialized(testDir);
      expect(notInitialized).toBe(false);

      // Create .apex directory
      await fs.mkdir(path.join(testDir, '.apex'));
      const isInitialized = await isApexInitialized(testDir);
      expect(isInitialized).toBe(true);
    });

    it('should verify parseAgentMarkdown example', () => {
      // Exact example from JSDoc
      const markdown = `---
name: developer
description: Writes production code
tools: Read,Write,Bash
model: sonnet
---
You are a senior developer...`;

      const agent = parseAgentMarkdown(markdown);
      expect(agent).not.toBeNull();
      expect(agent!.name).toBe('developer');
      expect(agent!.description).toBe('Writes production code');
      expect(agent!.tools).toEqual(['Read', 'Write', 'Bash']);
      expect(agent!.model).toBe('sonnet');
      expect(agent!.prompt).toBe('You are a senior developer...');
    });

    it('should verify skill path example', async () => {
      // From JSDoc: getSkillPath example
      const skillPath = getSkillPath(testDir, 'typescript-testing');
      expect(skillPath).toContain('.apex');
      expect(skillPath).toContain('skills');
      expect(skillPath).toContain('typescript-testing');
      expect(skillPath).toContain('SKILL.md');

      // Test loadSkill return null for missing skill
      const missingSkill = await loadSkill(testDir, 'typescript-testing');
      expect(missingSkill).toBeNull();

      // Create and load skill
      const skillDir = path.join(testDir, '.apex', 'skills', 'typescript-testing');
      await fs.mkdir(skillDir, { recursive: true });
      const skillContent = 'TypeScript testing best practices...';
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillContent);

      const loadedSkill = await loadSkill(testDir, 'typescript-testing');
      expect(loadedSkill).toBe(skillContent);
    });

    it('should verify scripts directory example', async () => {
      // From JSDoc: scripts directory and listing
      const scriptsDir = getScriptsDir(testDir);
      expect(scriptsDir).toContain('.apex');
      expect(scriptsDir).toContain('scripts');

      // Should return empty array when no scripts directory
      const noScripts = await listScripts(testDir);
      expect(noScripts).toEqual([]);

      // Create scripts directory and files
      await fs.mkdir(scriptsDir, { recursive: true });
      await fs.writeFile(path.join(scriptsDir, 'test.sh'), '#!/bin/bash\\necho test');
      await fs.writeFile(path.join(scriptsDir, 'build.js'), 'console.log("build")');
      await fs.writeFile(path.join(scriptsDir, 'lint.ts'), 'console.log("lint")');
      await fs.writeFile(path.join(scriptsDir, 'readme.md'), 'Documentation'); // Should be ignored

      const scripts = await listScripts(testDir);
      expect(scripts).toContain('test.sh');
      expect(scripts).toContain('build.js');
      expect(scripts).toContain('lint.ts');
      expect(scripts).not.toContain('readme.md');
    });

    it('should verify MCP functions examples', () => {
      // From JSDoc: MCP configuration examples
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        mcp: {
          enabled: true,
          servers: {
            'test-server': {
              name: 'test-server',
              command: 'node',
              args: ['server.js'],
            },
          },
          connection: {
            maxRetries: 3,
            retryDelayMs: 1000,
          },
        },
      };

      // Test getMCPServers
      const servers = getMCPServers(config);
      expect(servers['test-server']).toBeDefined();
      expect(servers['test-server'].command).toBe('node');
      expect(servers['test-server'].args).toEqual(['server.js']);

      // Test isMCPEnabled
      expect(isMCPEnabled(config)).toBe(true);

      // Test default behavior
      const configWithoutMcp: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
      };
      expect(isMCPEnabled(configWithoutMcp)).toBe(true); // Default is true
      expect(getMCPServers(configWithoutMcp)).toEqual({});
    });

    it('should verify initialization example', async () => {
      // From JSDoc: initializeApex example
      await initializeApex(testDir, {
        projectName: 'my-awesome-project',
        language: 'typescript',
        framework: 'react',
      });

      // Verify initialization worked
      const config = await loadConfig(testDir);
      expect(config.project.name).toBe('my-awesome-project');
      expect(config.project.language).toBe('typescript');
      expect(config.project.framework).toBe('react');

      // Verify directories were created
      const apexDir = path.join(testDir, '.apex');
      const agentsDir = path.join(apexDir, 'agents');
      const workflowsDir = path.join(apexDir, 'workflows');
      const skillsDir = path.join(apexDir, 'skills');
      const scriptsDir = path.join(apexDir, 'scripts');
      const toolsDir = path.join(apexDir, 'tools');

      for (const dir of [apexDir, agentsDir, workflowsDir, skillsDir, scriptsDir, toolsDir]) {
        await expect(fs.access(dir)).resolves.not.toThrow();
      }
    });
  });

  describe('Error Conditions from JSDoc', () => {
    it('should handle documented error conditions', async () => {
      // isApexInitialized should not throw but return false
      const badPath = '/non/existent/path/12345';
      const result = await isApexInitialized(badPath);
      expect(result).toBe(false);

      // parseAgentMarkdown should return null for invalid content
      const invalidMarkdown = 'This is not agent markdown';
      const invalidAgent = parseAgentMarkdown(invalidMarkdown);
      expect(invalidAgent).toBeNull();

      // loadSkill should return null for missing skills
      const missingSkill = await loadSkill(testDir, 'missing-skill');
      expect(missingSkill).toBeNull();

      // loadConfig should throw when APEX not initialized
      await expect(loadConfig(testDir)).rejects.toThrow(
        expect.stringContaining('not initialized')
      );
    });
  });

  describe('JSDoc Example Patterns', () => {
    it('should demonstrate typical usage patterns from JSDoc', async () => {
      // Initialize project
      await initializeApex(testDir, { projectName: 'jsdoc-demo' });

      // Load config as shown in examples
      const config = await loadConfig(testDir);
      expect(config.project.name).toBe('jsdoc-demo');

      // Check initialization status as shown in examples
      const isInit = await isApexInitialized(testDir);
      expect(isInit).toBe(true);

      // Skill path operations as shown in examples
      const skillPath = getSkillPath(testDir, 'example-skill');
      expect(skillPath).toBeDefined();

      // Scripts operations as shown in examples
      const scriptsDir = getScriptsDir(testDir);
      const scripts = await listScripts(testDir);
      expect(scriptsDir).toBeDefined();
      expect(Array.isArray(scripts)).toBe(true);

      // MCP operations as shown in examples
      const mcpEnabled = isMCPEnabled(config);
      const mcpServers = getMCPServers(config);
      expect(typeof mcpEnabled).toBe('boolean');
      expect(typeof mcpServers).toBe('object');
    });
  });
});
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  isApexInitialized,
  validateContainerWorkspaceConfig,
  loadConfig,
  saveConfig,
  loadAgents,
  parseAgentMarkdown,
  loadWorkflows,
  loadWorkflow,
  loadToolAliases,
  getMergedAliases,
  getSkillPath,
  loadSkill,
  getScriptsDir,
  listScripts,
  getMCPServers,
  getMCPConfig,
  isMCPEnabled,
  initializeApex,
  getEffectiveConfig,
} from '../config';
import { ApexConfig } from '../types';
import { containerRuntime } from '../container-runtime';

describe('JSDoc Documentation Tests for config.ts functions', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-jsdoc-test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('isApexInitialized', () => {
    it('should return true if APEX is initialized as documented', async () => {
      // Create .apex directory as per JSDoc example
      const apexDir = path.join(testDir, '.apex');
      await fs.mkdir(apexDir);

      const isInitialized = await isApexInitialized(testDir);
      expect(isInitialized).toBe(true);
    });

    it('should return false if APEX is not initialized as documented', async () => {
      const isInitialized = await isApexInitialized(testDir);
      expect(isInitialized).toBe(false);
    });

    it('should not throw but return false if directory access fails', async () => {
      // Test the documented behavior: "Does not throw - returns false if directory access fails"
      const nonExistentPath = '/completely/non/existent/path/12345';
      const result = await isApexInitialized(nonExistentPath);
      expect(result).toBe(false);
    });
  });

  describe('validateContainerWorkspaceConfig', () => {
    it('should validate container workspace configuration as documented', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        workspace: {
          defaultStrategy: 'container',
          container: {
            image: 'node:20-alpine',
          },
        },
      };

      // Mock container runtime to be available as per JSDoc example
      vi.spyOn(containerRuntime, 'detectRuntimes').mockResolvedValue([
        { type: 'docker', available: true, version: '20.10.0' },
      ]);

      const validation = await validateContainerWorkspaceConfig(config);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      // Should have no warnings since image is specified
      expect(validation.warnings).toHaveLength(0);
    });

    it('should detect missing runtime as documented', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        workspace: {
          defaultStrategy: 'container',
        },
      };

      // Mock no available runtimes as per JSDoc error example
      vi.spyOn(containerRuntime, 'detectRuntimes').mockResolvedValue([
        { type: 'docker', available: false, version: null },
      ]);

      const validation = await validateContainerWorkspaceConfig(config);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0].type).toBe('missing_runtime');
      expect(validation.errors[0].message).toContain('container runtime');
    });

    it('should warn about missing image as documented', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        workspace: {
          defaultStrategy: 'container',
          // No image specified - should trigger warning per JSDoc
        },
      };

      vi.spyOn(containerRuntime, 'detectRuntimes').mockResolvedValue([
        { type: 'docker', available: true, version: '20.10.0' },
      ]);

      const validation = await validateContainerWorkspaceConfig(config);

      expect(validation.valid).toBe(true);
      expect(validation.warnings).toHaveLength(1);
      expect(validation.warnings[0].type).toBe('no_image_specified');
      expect(validation.warnings[0].message).toContain('no default container image');
    });

    it('should handle runtime detection errors as documented', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        workspace: {
          defaultStrategy: 'container',
        },
      };

      // Mock runtime detection failure as per JSDoc
      vi.spyOn(containerRuntime, 'detectRuntimes').mockRejectedValue(
        new Error('Container runtime detection failed')
      );

      const validation = await validateContainerWorkspaceConfig(config);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0].type).toBe('runtime_not_functional');
      expect(validation.errors[0].message).toContain('Failed to detect container runtime');
    });

    it('should return valid for non-container workspace as documented', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        // No workspace configuration - should be valid per JSDoc
      };

      const validation = await validateContainerWorkspaceConfig(config);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.warnings).toHaveLength(0);
    });
  });

  describe('loadConfig', () => {
    it('should load and validate APEX configuration as documented', async () => {
      // Setup as per JSDoc example
      await initializeApex(testDir, { projectName: 'test-project' });

      const config = await loadConfig(testDir);
      expect(config.project.name).toBe('test-project');
      expect(config.version).toBeDefined();
    });

    it('should throw error when APEX is not initialized as documented', async () => {
      await expect(loadConfig(testDir)).rejects.toThrow(
        expect.stringContaining('not initialized')
      );
    });

    it('should load tool hooks from .apex/hooks.yaml as documented', async () => {
      await initializeApex(testDir, { projectName: 'test-project' });

      // Create hooks.yaml as mentioned in JSDoc
      const hooksPath = path.join(testDir, '.apex', 'hooks.yaml');
      const hooksContent = `
pre:
  - name: test-pre-hook
    command: echo "pre-hook"
post:
  - name: test-post-hook
    command: echo "post-hook"
enabled: true
defaultTimeoutMs: 30000
`;
      await fs.writeFile(hooksPath, hooksContent);

      const config = await loadConfig(testDir);
      expect(config.toolHooks?.enabled).toBe(true);
      expect(config.toolHooks?.pre).toHaveLength(1);
      expect(config.toolHooks?.post).toHaveLength(1);
    });

    it('should merge tool aliases as documented', async () => {
      await initializeApex(testDir, { projectName: 'test-project' });

      // Create tool alias file as mentioned in JSDoc
      const toolsDir = path.join(testDir, '.apex', 'tools');
      await fs.mkdir(toolsDir, { recursive: true });

      const aliasContent = `
name: test-alias
command: echo "test command"
description: A test alias
`;
      await fs.writeFile(path.join(toolsDir, 'test-alias.yaml'), aliasContent);

      const config = await loadConfig(testDir);
      expect(config.aliases).toBeDefined();
      const testAlias = config.aliases?.find(a => a.name === 'test-alias');
      expect(testAlias).toBeDefined();
      expect(testAlias?.command).toBe('echo "test command"');
    });
  });

  describe('saveConfig', () => {
    it('should save configuration to YAML as documented', async () => {
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

      await saveConfig(testDir, config);

      // Verify the file was saved correctly
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const savedContent = await fs.readFile(configPath, 'utf-8');
      expect(savedContent).toContain('name: test-project');
      expect(savedContent).toContain('version: "1.0"');
    });

    it('should follow JSDoc example pattern', async () => {
      // Following the JSDoc example pattern
      await initializeApex(testDir, { projectName: 'test-project' });
      const config = await loadConfig(testDir);

      config.project.name = 'Updated Project Name';
      await saveConfig(testDir, config);

      const reloadedConfig = await loadConfig(testDir);
      expect(reloadedConfig.project.name).toBe('Updated Project Name');
    });
  });

  describe('loadAgents', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(testDir, '.apex', 'agents'), { recursive: true });
    });

    it('should load all agent definitions as documented', async () => {
      const agentContent = `---
name: test-agent
description: A test agent for documentation
tools: Read,Write,Bash
model: sonnet
---
You are a test agent for JSDoc testing.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'test-agent.md'),
        agentContent
      );

      const agents = await loadAgents(testDir);
      expect(Object.keys(agents)).toContain('test-agent');

      const testAgent = agents['test-agent'];
      expect(testAgent.name).toBe('test-agent');
      expect(testAgent.description).toBe('A test agent for documentation');
      expect(testAgent.tools).toEqual(['Read', 'Write', 'Bash']);
      expect(testAgent.model).toBe('sonnet');
    });

    it('should ignore ENOENT errors as documented', async () => {
      // Test that function doesn't throw when directory doesn't exist
      const result = await loadAgents(testDir);
      expect(result).toEqual({});
    });

    it('should follow JSDoc example pattern', async () => {
      const agentContent1 = `---
name: developer
description: Writes production code
tools: Read,Write,Bash
model: sonnet
---
You are a senior developer.`;

      const agentContent2 = `---
name: reviewer
description: Reviews code quality
tools: Read
model: haiku
---
You are a code reviewer.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'developer.md'),
        agentContent1
      );
      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'reviewer.md'),
        agentContent2
      );

      const agents = await loadAgents(testDir);

      // Following JSDoc example pattern
      Object.keys(agents).forEach(agentName => {
        const agent = agents[agentName];
        expect(agent.name).toBe(agentName);
        expect(agent.description).toBeDefined();
      });

      expect(Object.keys(agents)).toHaveLength(2);
      expect(agents['developer']).toBeDefined();
      expect(agents['reviewer']).toBeDefined();
    });
  });

  describe('parseAgentMarkdown', () => {
    it('should parse agent markdown as documented', async () => {
      // Using exact example from JSDoc
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

    it('should return null for invalid content as documented', async () => {
      const invalidMarkdown = 'This is just regular markdown without frontmatter';
      const result = parseAgentMarkdown(invalidMarkdown);
      expect(result).toBeNull();
    });

    it('should parse comma-separated tools as documented', async () => {
      const markdown = `---
name: test-agent
description: Test agent
tools: "Read, Write, Bash, Edit"
model: sonnet
---
Test prompt`;

      const agent = parseAgentMarkdown(markdown);
      expect(agent!.tools).toEqual(['Read', 'Write', 'Bash', 'Edit']);
    });

    it('should parse comma-separated skills as documented', async () => {
      const markdown = `---
name: test-agent
description: Test agent
tools: Read
skills: "skill1, skill2, skill3"
model: sonnet
---
Test prompt`;

      const agent = parseAgentMarkdown(markdown);
      expect(agent!.skills).toEqual(['skill1', 'skill2', 'skill3']);
    });
  });

  describe('loadWorkflows', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(testDir, '.apex', 'workflows'), { recursive: true });
    });

    it('should load all workflow definitions as documented', async () => {
      const workflowContent = `name: test-workflow
description: A test workflow
stages:
  - name: planning
    agent: planner
  - name: implementation
    agent: developer`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'test-workflow.yaml'),
        workflowContent
      );

      const workflows = await loadWorkflows(testDir);
      expect(workflows['test-workflow']).toBeDefined();
      expect(workflows['test-workflow'].stages).toHaveLength(2);
    });

    it('should follow JSDoc example pattern', async () => {
      const workflowContent1 = `name: feature
description: Feature development workflow
stages:
  - name: planning
    agent: planner
  - name: implementation
    agent: developer`;

      const workflowContent2 = `name: bugfix
description: Bug fix workflow
stages:
  - name: analysis
    agent: analyst
  - name: fix
    agent: developer`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'feature.yaml'),
        workflowContent1
      );
      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'bugfix.yml'),
        workflowContent2
      );

      const workflows = await loadWorkflows(testDir);

      // Following JSDoc example
      Object.keys(workflows).forEach(workflowName => {
        const workflow = workflows[workflowName];
        expect(workflow.name).toBe(workflowName);
        expect(workflow.stages.length).toBeGreaterThan(0);
      });
    });

    it('should ignore ENOENT errors as documented', async () => {
      const result = await loadWorkflows(testDir);
      expect(result).toEqual({});
    });
  });

  describe('loadWorkflow', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(testDir, '.apex', 'workflows'), { recursive: true });
    });

    it('should load specific workflow by name as documented', async () => {
      const workflowContent = `name: feature-development
description: Feature development workflow
stages:
  - name: planning
    agent: planner`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'feature-development.yaml'),
        workflowContent
      );

      // Following JSDoc example
      const workflow = await loadWorkflow(testDir, 'feature-development');
      expect(workflow).not.toBeNull();
      expect(workflow!.name).toBe('feature-development');
      expect(workflow!.stages).toHaveLength(1);
    });

    it('should return null if workflow not found as documented', async () => {
      const workflow = await loadWorkflow(testDir, 'non-existent-workflow');
      expect(workflow).toBeNull();
    });
  });

  describe('loadToolAliases', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(testDir, '.apex', 'tools'), { recursive: true });
    });

    it('should load all tool aliases as documented', async () => {
      const aliasContent = `name: git-status
command: git status --porcelain
description: Show git status in porcelain format`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'git-status.yaml'),
        aliasContent
      );

      const aliases = await loadToolAliases(testDir);
      expect(aliases['git-status']).toBeDefined();
      expect(aliases['git-status'].command).toBe('git status --porcelain');
    });

    it('should follow JSDoc example pattern', async () => {
      const aliasContent1 = `name: test-alias
command: npm test
description: Run tests`;

      const aliasContent2 = `name: build-alias
command: npm run build
description: Build project`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'test.yaml'),
        aliasContent1
      );
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'build.yml'),
        aliasContent2
      );

      const aliases = await loadToolAliases(testDir);

      // Following JSDoc example
      Object.keys(aliases).forEach(aliasName => {
        const alias = aliases[aliasName];
        expect(alias.name).toBe(aliasName);
        expect(alias.command).toBeDefined();
      });
    });

    it('should ignore ENOENT errors as documented', async () => {
      const result = await loadToolAliases(testDir);
      expect(result).toEqual({});
    });
  });

  describe('getMergedAliases', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(testDir, '.apex', 'tools'), { recursive: true });
    });

    it('should merge aliases with file-based taking precedence as documented', async () => {
      // Config aliases
      const configAliases = [
        {
          name: 'test-cmd',
          command: 'config-command',
          description: 'From config',
        },
        {
          name: 'unique-config',
          command: 'config-only',
          description: 'Config only',
        },
      ];

      // File-based alias that conflicts
      const fileAliasContent = `name: test-cmd
command: file-command
description: From file (should override)`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'test-cmd.yaml'),
        fileAliasContent
      );

      const mergedAliases = await getMergedAliases(testDir, configAliases);

      // File-based should take precedence per JSDoc
      expect(mergedAliases['test-cmd'].command).toBe('file-command');
      expect(mergedAliases['test-cmd'].description).toBe('From file (should override)');

      // Config-only alias should still exist
      expect(mergedAliases['unique-config'].command).toBe('config-only');
    });

    it('should follow JSDoc example pattern', async () => {
      const configAliases = [
        { name: 'lint', command: 'eslint .', description: 'Lint code' },
      ];

      const mergedAliases = await getMergedAliases(testDir, configAliases);

      // Following JSDoc example
      Object.values(mergedAliases).forEach(alias => {
        expect(alias.name).toBeDefined();
        expect(alias.command).toBeDefined();
      });
    });
  });

  describe('getSkillPath and loadSkill', () => {
    it('should construct skill path correctly as documented', () => {
      // Following JSDoc example
      const skillPath = getSkillPath(testDir, 'typescript-testing');
      expect(skillPath).toContain('.apex');
      expect(skillPath).toContain('skills');
      expect(skillPath).toContain('typescript-testing');
      expect(skillPath).toContain('SKILL.md');
    });

    it('should load skill content as documented', async () => {
      const skillName = 'typescript-testing';
      const skillDir = path.join(testDir, '.apex', 'skills', skillName);
      await fs.mkdir(skillDir, { recursive: true });

      const skillContent = 'This is a TypeScript testing skill with best practices...';
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillContent);

      const content = await loadSkill(testDir, skillName);
      expect(content).toBe(skillContent);
    });

    it('should return null for non-existent skill as documented', async () => {
      const content = await loadSkill(testDir, 'non-existent-skill');
      expect(content).toBeNull();
    });

    it('should follow JSDoc example pattern', async () => {
      const skillName = 'test-skill';
      const skillDir = path.join(testDir, '.apex', 'skills', skillName);
      await fs.mkdir(skillDir, { recursive: true });

      const skillContent = 'Test skill content...';
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillContent);

      // Following JSDoc example
      const skillPath = getSkillPath(testDir, skillName);
      const content = await loadSkill(testDir, skillName);

      if (content) {
        expect(content.length).toBeGreaterThan(0);
        expect(skillPath).toContain(skillName);
      }
    });
  });

  describe('getScriptsDir and listScripts', () => {
    it('should construct scripts directory path correctly as documented', () => {
      const scriptsDir = getScriptsDir(testDir);
      expect(scriptsDir).toContain('.apex');
      expect(scriptsDir).toContain('scripts');
    });

    it('should list available scripts as documented', async () => {
      const scriptsDir = getScriptsDir(testDir);
      await fs.mkdir(scriptsDir, { recursive: true });

      // Create scripts as mentioned in JSDoc
      await fs.writeFile(path.join(scriptsDir, 'test.sh'), '#!/bin/bash\necho "test"');
      await fs.writeFile(path.join(scriptsDir, 'build.js'), 'console.log("build")');
      await fs.writeFile(path.join(scriptsDir, 'lint.ts'), 'console.log("lint")');
      await fs.writeFile(path.join(scriptsDir, 'readme.md'), 'Not a script'); // Should be ignored

      const scripts = await listScripts(testDir);
      expect(scripts).toContain('test.sh');
      expect(scripts).toContain('build.js');
      expect(scripts).toContain('lint.ts');
      expect(scripts).not.toContain('readme.md');
    });

    it('should return empty array when no scripts directory as documented', async () => {
      const scripts = await listScripts(testDir);
      expect(scripts).toEqual([]);
    });

    it('should follow JSDoc example pattern', async () => {
      const scriptsDir = getScriptsDir(testDir);
      await fs.mkdir(scriptsDir, { recursive: true });

      await fs.writeFile(path.join(scriptsDir, 'example.sh'), '#!/bin/bash');

      const scripts = await listScripts(testDir);
      if (scripts.length > 0) {
        scripts.forEach(script => {
          expect(typeof script).toBe('string');
          expect(script.endsWith('.sh') || script.endsWith('.js') || script.endsWith('.ts')).toBe(true);
        });
      }
    });
  });

  describe('MCP Functions', () => {
    let sampleConfig: ApexConfig;

    beforeEach(() => {
      sampleConfig = {
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
    });

    describe('getMCPServers', () => {
      it('should extract server configurations as documented', () => {
        const servers = getMCPServers(sampleConfig);

        // Following JSDoc example
        expect(Object.keys(servers)).toContain('test-server');
        expect(servers['test-server'].name).toBe('test-server');
        expect(servers['test-server'].command).toBe('node');
        expect(servers['test-server'].args).toEqual(['server.js']);
      });

      it('should handle array format servers as documented', () => {
        const configWithArray = {
          ...sampleConfig,
          mcp: {
            enabled: true,
            servers: [
              { name: 'server1', command: 'cmd1' },
              { name: 'server2', command: 'cmd2' },
            ],
          },
        };

        const servers = getMCPServers(configWithArray);
        expect(servers['server1']).toBeDefined();
        expect(servers['server2']).toBeDefined();
      });

      it('should return empty object when no servers as documented', () => {
        const configWithoutMcp = {
          version: '1.0',
          project: { name: 'test' },
        } as ApexConfig;

        const servers = getMCPServers(configWithoutMcp);
        expect(servers).toEqual({});
      });
    });

    describe('getMCPConfig', () => {
      it('should extract MCP configuration with defaults as documented', () => {
        const mcpConfig = getMCPConfig(sampleConfig);

        expect(mcpConfig.enabled).toBe(true);
        expect(mcpConfig.servers).toBeDefined();
        expect(mcpConfig.connection?.maxRetries).toBe(3);
      });

      it('should apply defaults when config is missing as documented', () => {
        const configWithoutMcp = {
          version: '1.0',
          project: { name: 'test' },
        } as ApexConfig;

        const mcpConfig = getMCPConfig(configWithoutMcp);
        expect(mcpConfig.enabled).toBe(true); // Default per JSDoc
        expect(mcpConfig.servers).toEqual({});
      });
    });

    describe('isMCPEnabled', () => {
      it('should check if MCP is enabled as documented', () => {
        expect(isMCPEnabled(sampleConfig)).toBe(true);
      });

      it('should default to true when not configured as documented', () => {
        const configWithoutMcp = {
          version: '1.0',
          project: { name: 'test' },
        } as ApexConfig;

        // Default is true per JSDoc
        expect(isMCPEnabled(configWithoutMcp)).toBe(true);
      });

      it('should follow JSDoc example pattern', () => {
        // Following JSDoc example
        if (isMCPEnabled(sampleConfig)) {
          const servers = getMCPServers(sampleConfig);
          expect(Object.keys(servers).length).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });

  describe('initializeApex', () => {
    it('should initialize APEX with all directories as documented', async () => {
      await initializeApex(testDir, {
        projectName: 'my-awesome-project',
        language: 'typescript',
        framework: 'react',
      });

      // Check all directories mentioned in JSDoc are created
      const apexDir = path.join(testDir, '.apex');
      const agentsDir = path.join(apexDir, 'agents');
      const workflowsDir = path.join(apexDir, 'workflows');
      const skillsDir = path.join(apexDir, 'skills');
      const scriptsDir = path.join(apexDir, 'scripts');
      const toolsDir = path.join(apexDir, 'tools');

      for (const dir of [apexDir, agentsDir, workflowsDir, skillsDir, scriptsDir, toolsDir]) {
        await expect(fs.access(dir)).resolves.not.toThrow();
      }

      // Follow JSDoc example
      const config = await loadConfig(testDir);
      expect(config.project.name).toBe('my-awesome-project');
      expect(config.project.language).toBe('typescript');
      expect(config.project.framework).toBe('react');
    });
  });

  describe('getEffectiveConfig', () => {
    it('should merge config with comprehensive defaults as documented', () => {
      const baseConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
      };

      const effectiveConfig = getEffectiveConfig(baseConfig);

      // Following JSDoc example - all fields should have values
      expect(effectiveConfig.limits?.maxCostPerTask).toBeDefined();
      expect(effectiveConfig.policy?.enforcement).toBeDefined();
      expect(effectiveConfig.mcp?.enabled).toBeDefined();

      // Verify comprehensive defaults are applied
      expect(effectiveConfig.autonomy?.level).toBe('review-before-commit');
      expect(effectiveConfig.models?.implementation).toBe('sonnet');
      expect(effectiveConfig.workspace?.defaultStrategy).toBe('none');
    });

    it('should preserve existing values while adding defaults', () => {
      const baseConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        limits: { maxCostPerTask: 5.0 },
        policy: { enforcement: 'strict' },
      };

      const effectiveConfig = getEffectiveConfig(baseConfig);

      // Existing values should be preserved
      expect(effectiveConfig.limits?.maxCostPerTask).toBe(5.0);
      expect(effectiveConfig.policy?.enforcement).toBe('strict');

      // But missing values should get defaults
      expect(effectiveConfig.limits?.dailyBudget).toBeDefined();
      expect(effectiveConfig.policy?.enabled).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle all documented error conditions appropriately', async () => {
      // Test various error conditions mentioned in JSDoc comments

      // isApexInitialized with bad path
      const badResult = await isApexInitialized('');
      expect(badResult).toBe(false);

      // loadConfig with uninitialized directory
      await expect(loadConfig(testDir)).rejects.toThrow();

      // parseAgentMarkdown with invalid content
      const invalidAgent = parseAgentMarkdown('invalid markdown');
      expect(invalidAgent).toBeNull();

      // loadSkill with non-existent skill
      const missingSkill = await loadSkill(testDir, 'missing-skill');
      expect(missingSkill).toBeNull();
    });

    it('should handle concurrent operations safely', async () => {
      await initializeApex(testDir, { projectName: 'concurrent-test' });

      // Multiple concurrent operations should work as documented
      const promises = [
        isApexInitialized(testDir),
        loadAgents(testDir),
        loadWorkflows(testDir),
        listScripts(testDir),
      ];

      const results = await Promise.all(promises);
      expect(results[0]).toBe(true); // isApexInitialized
      expect(typeof results[1]).toBe('object'); // loadAgents
      expect(typeof results[2]).toBe('object'); // loadWorkflows
      expect(Array.isArray(results[3])).toBe(true); // listScripts
    });
  });

  describe('JSDoc Examples Integration', () => {
    it('should work with all JSDoc examples combined', async () => {
      // Initialize project
      await initializeApex(testDir, {
        projectName: 'jsdoc-integration-test',
        language: 'typescript',
        framework: 'react',
      });

      // Create agent as per JSDoc examples
      const agentContent = `---
name: developer
description: Writes production code
tools: Read,Write,Bash
model: sonnet
---
You are a senior developer...`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'developer.md'),
        agentContent
      );

      // Create workflow as per JSDoc examples
      const workflowContent = `name: feature-development
description: Feature development workflow
stages:
  - name: planning
    agent: planner
  - name: implementation
    agent: developer`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'feature-development.yaml'),
        workflowContent
      );

      // Test all functions work together
      const config = await loadConfig(testDir);
      const agents = await loadAgents(testDir);
      const workflows = await loadWorkflows(testDir);
      const workflow = await loadWorkflow(testDir, 'feature-development');

      expect(config.project.name).toBe('jsdoc-integration-test');
      expect(agents['developer']).toBeDefined();
      expect(workflows['feature-development']).toBeDefined();
      expect(workflow).not.toBeNull();
      expect(workflow!.name).toBe('feature-development');
    });
  });
});
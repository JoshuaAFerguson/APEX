import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  isApexInitialized,
  loadConfig,
  saveConfig,
  parseAgentMarkdown,
  getEffectiveConfig,
  loadAgents,
  loadWorkflows,
  loadWorkflow,
  initializeApex,
  loadSkill,
  getSkillPath,
  listScripts,
  getScriptsDir,
} from './config';
import { ApexConfig } from './types';

describe('parseAgentMarkdown', () => {
  it('should parse agent markdown with frontmatter', () => {
    const markdown = `---
name: test-agent
description: A test agent
model: opus
tools: Read, Write
---
You are a test agent.

## Instructions
Do your best.`;

    const agent = parseAgentMarkdown(markdown);
    expect(agent).not.toBeNull();
    expect(agent?.name).toBe('test-agent');
    expect(agent?.description).toBe('A test agent');
    expect(agent?.model).toBe('opus');
    expect(agent?.tools).toEqual(['Read', 'Write']);
    expect(agent?.prompt).toContain('You are a test agent');
  });

  it('should return null for invalid markdown', () => {
    const markdown = 'No frontmatter here';
    expect(parseAgentMarkdown(markdown)).toBeNull();
  });

  it('should handle array tools in frontmatter', () => {
    const markdown = `---
name: agent
description: desc
tools:
  - Read
  - Write
---
Prompt`;

    const agent = parseAgentMarkdown(markdown);
    expect(agent?.tools).toEqual(['Read', 'Write']);
  });
});

describe('getEffectiveConfig', () => {
  it('should merge defaults with partial config', () => {
    const config: ApexConfig = {
      version: '1.0',
      project: {
        name: 'test',
        testCommand: 'npm test',
        lintCommand: 'npm run lint',
        buildCommand: 'npm run build',
      },
    };

    const effective = getEffectiveConfig(config);
    expect(effective.autonomy.default).toBe('review-before-merge');
    expect(effective.git.branchPrefix).toBe('apex/');
    expect(effective.limits.maxTokensPerTask).toBe(500000);
    expect(effective.api.port).toBe(3000);
  });

  it('should preserve explicit config values', () => {
    const config: ApexConfig = {
      version: '1.0',
      project: {
        name: 'test',
        testCommand: 'npm test',
        lintCommand: 'npm run lint',
        buildCommand: 'npm run build',
      },
      autonomy: {
        default: 'full',
      },
      limits: {
        maxCostPerTask: 5.0,
      },
    };

    const effective = getEffectiveConfig(config);
    expect(effective.autonomy.default).toBe('full');
    expect(effective.limits.maxCostPerTask).toBe(5.0);
  });

  it('should apply UI config defaults', () => {
    const config: ApexConfig = {
      version: '1.0',
      project: {
        name: 'test',
        testCommand: 'npm test',
        lintCommand: 'npm run lint',
        buildCommand: 'npm run build',
      },
    };

    const effective = getEffectiveConfig(config);
    expect(effective.ui.previewMode).toBe(true);
    expect(effective.ui.previewConfidence).toBe(0.7);
    expect(effective.ui.autoExecuteHighConfidence).toBe(false);
    expect(effective.ui.previewTimeout).toBe(5000);
  });

  it('should preserve explicit UI config values', () => {
    const config: ApexConfig = {
      version: '1.0',
      project: {
        name: 'test',
        testCommand: 'npm test',
        lintCommand: 'npm run lint',
        buildCommand: 'npm run build',
      },
      ui: {
        previewMode: false,
        previewConfidence: 0.9,
        autoExecuteHighConfidence: true,
        previewTimeout: 7500,
      },
    };

    const effective = getEffectiveConfig(config);
    expect(effective.ui.previewMode).toBe(false);
    expect(effective.ui.previewConfidence).toBe(0.9);
    expect(effective.ui.autoExecuteHighConfidence).toBe(true);
    expect(effective.ui.previewTimeout).toBe(7500);
  });
});

describe('isApexInitialized', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should return false for uninitialized directory', async () => {
    const result = await isApexInitialized(testDir);
    expect(result).toBe(false);
  });

  it('should return true for initialized directory', async () => {
    await fs.mkdir(path.join(testDir, '.apex'));
    const result = await isApexInitialized(testDir);
    expect(result).toBe(true);
  });
});

describe('loadConfig and saveConfig', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-test-'));
    await fs.mkdir(path.join(testDir, '.apex'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should save and load config', async () => {
    const config: ApexConfig = {
      version: '1.0',
      project: {
        name: 'test-project',
        language: 'typescript',
        testCommand: 'npm test',
        lintCommand: 'npm run lint',
        buildCommand: 'npm run build',
      },
      autonomy: {
        default: 'full',
      },
    };

    await saveConfig(testDir, config);
    const loaded = await loadConfig(testDir);

    expect(loaded.project.name).toBe('test-project');
    expect(loaded.project.language).toBe('typescript');
    expect(loaded.autonomy?.default).toBe('full');
  });

  it('should throw error for missing config', async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-empty-'));
    await fs.mkdir(path.join(emptyDir, '.apex'));

    await expect(loadConfig(emptyDir)).rejects.toThrow();

    await fs.rm(emptyDir, { recursive: true, force: true });
  });
});

describe('loadAgents', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-agents-test-'));
    await fs.mkdir(path.join(testDir, '.apex', 'agents'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should load agents from markdown files', async () => {
    const agentContent = `---
name: test-agent
description: A test agent
tools: Read, Write
model: sonnet
---
You are a test agent.`;

    await fs.writeFile(path.join(testDir, '.apex', 'agents', 'test-agent.md'), agentContent);

    const agents = await loadAgents(testDir);
    expect(agents['test-agent']).toBeDefined();
    expect(agents['test-agent'].description).toBe('A test agent');
    expect(agents['test-agent'].tools).toEqual(['Read', 'Write']);
  });

  it('should skip non-markdown files', async () => {
    await fs.writeFile(path.join(testDir, '.apex', 'agents', 'readme.txt'), 'Not an agent');

    const agents = await loadAgents(testDir);
    expect(Object.keys(agents)).toHaveLength(0);
  });

  it('should return empty object if agents directory does not exist', async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-no-agents-'));
    await fs.mkdir(path.join(emptyDir, '.apex'), { recursive: true });

    const agents = await loadAgents(emptyDir);
    expect(Object.keys(agents)).toHaveLength(0);

    await fs.rm(emptyDir, { recursive: true, force: true });
  });

  it('should handle multiple agents', async () => {
    const agent1 = `---
name: planner
description: Plans tasks
model: opus
---
Plan things.`;

    const agent2 = `---
name: developer
description: Writes code
model: sonnet
---
Write code.`;

    await fs.writeFile(path.join(testDir, '.apex', 'agents', 'planner.md'), agent1);
    await fs.writeFile(path.join(testDir, '.apex', 'agents', 'developer.md'), agent2);

    const agents = await loadAgents(testDir);
    expect(Object.keys(agents)).toHaveLength(2);
    expect(agents['planner']).toBeDefined();
    expect(agents['developer']).toBeDefined();
  });
});

describe('loadWorkflows', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-workflows-test-'));
    await fs.mkdir(path.join(testDir, '.apex', 'workflows'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should load workflows from yaml files', async () => {
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

  it('should load .yml files as well', async () => {
    const workflowContent = `name: bugfix
description: Bug fix workflow
stages:
  - name: fix
    agent: developer`;

    await fs.writeFile(path.join(testDir, '.apex', 'workflows', 'bugfix.yml'), workflowContent);

    const workflows = await loadWorkflows(testDir);
    expect(workflows['bugfix']).toBeDefined();
  });

  it('should skip non-yaml files', async () => {
    await fs.writeFile(path.join(testDir, '.apex', 'workflows', 'readme.txt'), 'Not a workflow');

    const workflows = await loadWorkflows(testDir);
    expect(Object.keys(workflows)).toHaveLength(0);
  });

  it('should return empty object if workflows directory does not exist', async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-no-workflows-'));
    await fs.mkdir(path.join(emptyDir, '.apex'), { recursive: true });

    const workflows = await loadWorkflows(emptyDir);
    expect(Object.keys(workflows)).toHaveLength(0);

    await fs.rm(emptyDir, { recursive: true, force: true });
  });
});

describe('loadWorkflow', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-workflow-test-'));
    await fs.mkdir(path.join(testDir, '.apex', 'workflows'), { recursive: true });

    const workflowContent = `name: feature
description: Feature workflow
stages:
  - name: planning
    agent: planner`;

    await fs.writeFile(path.join(testDir, '.apex', 'workflows', 'feature.yaml'), workflowContent);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should load a specific workflow by name', async () => {
    const workflow = await loadWorkflow(testDir, 'feature');
    expect(workflow).not.toBeNull();
    expect(workflow?.name).toBe('feature');
  });

  it('should return null for non-existent workflow', async () => {
    const workflow = await loadWorkflow(testDir, 'nonexistent');
    expect(workflow).toBeNull();
  });
});

describe('initializeApex', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-init-test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should create .apex directory structure', async () => {
    await initializeApex(testDir, { projectName: 'test-project' });

    const apexDir = path.join(testDir, '.apex');
    expect(await fs.access(apexDir).then(() => true).catch(() => false)).toBe(true);
    expect(await fs.access(path.join(apexDir, 'agents')).then(() => true).catch(() => false)).toBe(true);
    expect(await fs.access(path.join(apexDir, 'workflows')).then(() => true).catch(() => false)).toBe(true);
    expect(await fs.access(path.join(apexDir, 'skills')).then(() => true).catch(() => false)).toBe(true);
    expect(await fs.access(path.join(apexDir, 'scripts')).then(() => true).catch(() => false)).toBe(true);
  });

  it('should create config with project name', async () => {
    await initializeApex(testDir, { projectName: 'my-project' });

    const config = await loadConfig(testDir);
    expect(config.project.name).toBe('my-project');
  });

  it('should include language and framework if provided', async () => {
    await initializeApex(testDir, {
      projectName: 'my-project',
      language: 'typescript',
      framework: 'nextjs',
    });

    const config = await loadConfig(testDir);
    expect(config.project.language).toBe('typescript');
    expect(config.project.framework).toBe('nextjs');
  });
});

describe('Skills and Scripts', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-skills-test-'));
    await fs.mkdir(path.join(testDir, '.apex', 'skills', 'test-skill'), { recursive: true });
    await fs.mkdir(path.join(testDir, '.apex', 'scripts'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('getSkillPath should return correct path', () => {
    const skillPath = getSkillPath(testDir, 'my-skill');
    expect(skillPath).toContain('.apex');
    expect(skillPath).toContain('skills');
    expect(skillPath).toContain('my-skill');
    expect(skillPath).toContain('SKILL.md');
  });

  it('loadSkill should return skill content', async () => {
    await fs.writeFile(
      path.join(testDir, '.apex', 'skills', 'test-skill', 'SKILL.md'),
      'This is a test skill'
    );

    const content = await loadSkill(testDir, 'test-skill');
    expect(content).toBe('This is a test skill');
  });

  it('loadSkill should return null for non-existent skill', async () => {
    const content = await loadSkill(testDir, 'nonexistent');
    expect(content).toBeNull();
  });

  it('getScriptsDir should return correct path', () => {
    const scriptsDir = getScriptsDir(testDir);
    expect(scriptsDir).toContain('.apex');
    expect(scriptsDir).toContain('scripts');
  });

  it('listScripts should return script files', async () => {
    await fs.writeFile(path.join(testDir, '.apex', 'scripts', 'test.sh'), '#!/bin/bash\necho test');
    await fs.writeFile(path.join(testDir, '.apex', 'scripts', 'build.js'), 'console.log("build")');
    await fs.writeFile(path.join(testDir, '.apex', 'scripts', 'lint.ts'), 'console.log("lint")');
    await fs.writeFile(path.join(testDir, '.apex', 'scripts', 'readme.txt'), 'Not a script');

    const scripts = await listScripts(testDir);
    expect(scripts).toContain('test.sh');
    expect(scripts).toContain('build.js');
    expect(scripts).toContain('lint.ts');
    expect(scripts).not.toContain('readme.txt');
  });

  it('listScripts should return empty array if scripts directory does not exist', async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-no-scripts-'));

    const scripts = await listScripts(emptyDir);
    expect(scripts).toEqual([]);

    await fs.rm(emptyDir, { recursive: true, force: true });
  });
});

describe('parseAgentMarkdown additional cases', () => {
  it('should handle skills in frontmatter as comma-separated string', () => {
    const markdown = `---
name: agent
description: desc
skills: debugging, testing
---
Prompt`;

    const agent = parseAgentMarkdown(markdown);
    expect(agent?.skills).toEqual(['debugging', 'testing']);
  });

  it('should handle skills in frontmatter as array', () => {
    const markdown = `---
name: agent
description: desc
skills:
  - debugging
  - testing
---
Prompt`;

    const agent = parseAgentMarkdown(markdown);
    expect(agent?.skills).toEqual(['debugging', 'testing']);
  });
});

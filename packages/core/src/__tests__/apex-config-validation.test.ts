import * as fs from 'fs/promises';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  validateApexConfiguration,
  validateApexDirectoryStructure,
  validateApexConfigFile,
  validateAgentDefinitions,
  validateWorkflowDefinitions,
  createApexConfigValidationCheck,
} from '../config-validation.js';
import { createDoctorCheckResult } from '../doctor-utils.js';

describe('APEX Config Validation', () => {
  const testProjectPath = '/tmp/apex-test-project';
  const apexDir = path.join(testProjectPath, '.apex');

  beforeEach(async () => {
    // Clean up any existing test directory
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch {
      // Ignore errors if directory doesn't exist
    }

    // Create test project directory
    await fs.mkdir(testProjectPath, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('validateApexDirectoryStructure', () => {
    it('should fail when .apex directory does not exist', async () => {
      const result = await validateApexDirectoryStructure(testProjectPath);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('missing_apex_directory');
      expect(result.errors[0].message).toContain('.apex directory does not exist');
    });

    it('should pass when .apex directory exists', async () => {
      await fs.mkdir(apexDir, { recursive: true });

      const result = await validateApexDirectoryStructure(testProjectPath);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.details?.apexDirExists).toBe(true);
    });

    it('should report existing subdirectories', async () => {
      await fs.mkdir(apexDir, { recursive: true });
      await fs.mkdir(path.join(apexDir, 'agents'), { recursive: true });
      await fs.mkdir(path.join(apexDir, 'workflows'), { recursive: true });

      const result = await validateApexDirectoryStructure(testProjectPath);

      expect(result.valid).toBe(true);
      expect(result.details?.existingDirectories).toContain('agents');
      expect(result.details?.existingDirectories).toContain('workflows');
    });
  });

  describe('validateApexConfigFile', () => {
    beforeEach(async () => {
      await fs.mkdir(apexDir, { recursive: true });
    });

    it('should fail when config.yaml does not exist', async () => {
      const result = await validateApexConfigFile(testProjectPath);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('missing_config_file');
    });

    it('should fail when config.yaml has invalid YAML', async () => {
      const configPath = path.join(apexDir, 'config.yaml');
      await fs.writeFile(configPath, 'invalid: yaml: content: [');

      const result = await validateApexConfigFile(testProjectPath);

      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('invalid_yaml');
    });

    it('should pass with valid minimal config', async () => {
      const configPath = path.join(apexDir, 'config.yaml');
      const validConfig = `
version: "1.0"
project:
  name: "test-project"
autonomy:
  level: "review-before-commit"
agents:
  enabled: ["planner"]
models:
  planning: "opus"
  implementation: "sonnet"
  review: "haiku"
git:
  branchPrefix: "apex/"
  commitFormat: "conventional"
limits:
  maxTokensPerTask: 500000
  maxCostPerTask: 10.0
  dailyBudget: 100.0
  maxTurns: 100
  maxConcurrentTasks: 3
`.trim();

      await fs.writeFile(configPath, validConfig);

      const result = await validateApexConfigFile(testProjectPath);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.details?.yamlValid).toBe(true);
      expect(result.details?.schemaValid).toBe(true);
      expect(result.details?.configSummary?.projectName).toBe('test-project');
    });
  });

  describe('validateAgentDefinitions', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(apexDir, 'agents'), { recursive: true });
    });

    it('should warn when agents directory does not exist', async () => {
      await fs.rm(path.join(apexDir, 'agents'), { recursive: true, force: true });

      const result = await validateAgentDefinitions(testProjectPath);

      expect(result.valid).toBe(true); // Not an error, just a warning
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('missing_agents_directory');
    });

    it('should warn when no .md files exist', async () => {
      const result = await validateAgentDefinitions(testProjectPath);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('no_agent_files');
    });

    it('should validate a proper agent file', async () => {
      const agentContent = `---
name: test-agent
description: A test agent
tools: Read,Write,Edit
model: sonnet
---

You are a test agent that helps with testing.
`;

      const agentPath = path.join(apexDir, 'agents', 'test-agent.md');
      await fs.writeFile(agentPath, agentContent);

      const result = await validateAgentDefinitions(testProjectPath);

      expect(result.valid).toBe(true);
      expect(result.details?.validAgents).toContain('test-agent');
      expect(result.details?.totalFiles).toBe(1);
    });

    it('should fail for agent with missing prompt', async () => {
      const agentContent = `---
name: bad-agent
description: A bad agent
tools: Read,Write
model: sonnet
---

`;

      const agentPath = path.join(apexDir, 'agents', 'bad-agent.md');
      await fs.writeFile(agentPath, agentContent);

      const result = await validateAgentDefinitions(testProjectPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'missing_agent_prompt')).toBe(true);
      expect(result.details?.invalidAgents).toContain('bad-agent.md');
    });
  });

  describe('validateWorkflowDefinitions', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(apexDir, 'workflows'), { recursive: true });
    });

    it('should warn when workflows directory does not exist', async () => {
      await fs.rm(path.join(apexDir, 'workflows'), { recursive: true, force: true });

      const result = await validateWorkflowDefinitions(testProjectPath);

      expect(result.valid).toBe(true); // Not an error, just a warning
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('missing_workflows_directory');
    });

    it('should validate a proper workflow file', async () => {
      const workflowContent = `
name: test-workflow
description: A test workflow
stages:
  - name: planning
    agent: planner
    description: Plan the task
  - name: implementation
    agent: developer
    description: Implement the plan
`;

      const workflowPath = path.join(apexDir, 'workflows', 'test-workflow.yaml');
      await fs.writeFile(workflowPath, workflowContent.trim());

      const result = await validateWorkflowDefinitions(testProjectPath);

      expect(result.valid).toBe(true);
      expect(result.details?.validWorkflows).toContain('test-workflow');
      expect(result.details?.totalFiles).toBe(1);
    });

    it('should fail for workflow with no stages', async () => {
      const workflowContent = `
name: empty-workflow
description: A workflow with no stages
stages: []
`;

      const workflowPath = path.join(apexDir, 'workflows', 'empty-workflow.yaml');
      await fs.writeFile(workflowPath, workflowContent.trim());

      const result = await validateWorkflowDefinitions(testProjectPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'no_workflow_stages')).toBe(true);
      expect(result.details?.invalidWorkflows).toContain('empty-workflow.yaml');
    });
  });

  describe('validateApexConfiguration', () => {
    it('should fail when APEX is not initialized', async () => {
      const result = await validateApexConfiguration(testProjectPath);

      expect(result.valid).toBe(false);
      expect(result.summary.criticalIssues).toContain('APEX not initialized');
      expect(result.directory.errors[0].type).toBe('not_initialized');
    });

    it('should provide comprehensive validation for initialized project', async () => {
      // Set up minimal valid APEX project
      await fs.mkdir(apexDir, { recursive: true });
      await fs.mkdir(path.join(apexDir, 'agents'), { recursive: true });
      await fs.mkdir(path.join(apexDir, 'workflows'), { recursive: true });

      // Create valid config
      const configContent = `
version: "1.0"
project:
  name: "test-project"
autonomy:
  level: "review-before-commit"
agents:
  enabled: ["planner"]
models:
  planning: "opus"
  implementation: "sonnet"
  review: "haiku"
git:
  branchPrefix: "apex/"
  commitFormat: "conventional"
limits:
  maxTokensPerTask: 500000
  maxCostPerTask: 10.0
  dailyBudget: 100.0
  maxTurns: 100
  maxConcurrentTasks: 3
`.trim();
      await fs.writeFile(path.join(apexDir, 'config.yaml'), configContent);

      const result = await validateApexConfiguration(testProjectPath);

      expect(result.valid).toBe(true);
      expect(result.directory.valid).toBe(true);
      expect(result.config.valid).toBe(true);
      expect(result.summary.totalErrors).toBe(0);
    });
  });

  describe('createApexConfigValidationCheck', () => {
    it('should create proper DoctorCheckResult for valid config', () => {
      const mockValidationResult = {
        valid: true,
        directory: { valid: true, errors: [], warnings: [] },
        config: { valid: true, errors: [], warnings: [] },
        agents: { valid: true, errors: [], warnings: [], details: { validAgents: ['planner'], totalFiles: 1 } },
        workflows: { valid: true, errors: [], warnings: [], details: { validWorkflows: ['feature'], totalFiles: 1 } },
        summary: {
          totalErrors: 0,
          totalWarnings: 2,
          criticalIssues: []
        }
      };

      const result = createApexConfigValidationCheck(testProjectPath, mockValidationResult);

      expect(result.id).toBe('apex-config-validation');
      expect(result.name).toBe('APEX Configuration Validation');
      expect(result.category).toBe('config');
      expect(result.status).toBe('pass');
      expect(result.severity).toBe('info');
      expect(result.message).toContain('APEX configuration is valid and complete');
      expect(result.details?.validation).toBe(mockValidationResult);
    });

    it('should create proper DoctorCheckResult for invalid config', () => {
      const mockValidationResult = {
        valid: false,
        directory: { valid: false, errors: [{ type: 'missing_apex_directory', message: 'Missing directory' }], warnings: [] },
        config: { valid: false, errors: [], warnings: [] },
        agents: { valid: false, errors: [], warnings: [] },
        workflows: { valid: false, errors: [], warnings: [] },
        summary: {
          totalErrors: 3,
          totalWarnings: 1,
          criticalIssues: ['Directory structure issues', 'Configuration file issues']
        }
      };

      const result = createApexConfigValidationCheck(testProjectPath, mockValidationResult);

      expect(result.status).toBe('fail');
      expect(result.severity).toBe('error');
      expect(result.message).toContain('APEX configuration has 3 error(s)');
      expect(result.suggestion).toContain('Address critical issues');
    });
  });
});
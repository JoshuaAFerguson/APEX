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

describe('Doctor Config Validation - Comprehensive Tests', () => {
  const testProjectPath = '/tmp/apex-doctor-test-project';
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

  describe('Edge Cases and Error Handling', () => {
    it('should handle non-existent project directory gracefully', async () => {
      const nonExistentPath = '/tmp/apex-non-existent-project-123456';

      const result = await validateApexConfiguration(nonExistentPath);

      expect(result.valid).toBe(false);
      expect(result.summary.criticalIssues).toContain('APEX not initialized');
    });

    it('should handle directory structure with invalid permissions', async () => {
      await fs.mkdir(apexDir, { recursive: true });

      // Create a file where directory should be
      const invalidDirPath = path.join(apexDir, 'agents');
      await fs.writeFile(invalidDirPath, 'This should be a directory');

      const result = await validateApexDirectoryStructure(testProjectPath);

      expect(result.valid).toBe(true); // Still valid but with warnings
      expect(result.warnings.some(w => w.type === 'invalid_subdirectory')).toBe(true);
    });

    it('should handle config file with complex YAML errors', async () => {
      await fs.mkdir(apexDir, { recursive: true });

      const invalidYamlConfigs = [
        '{ invalid: yaml content [',
        'key: "unclosed string',
        'tabs:\n\t- mixed with spaces\n    - indentation',
        'duplicate:\n  key: value1\n  key: value2',
        'version: "1.0"\nproject:\n  name: test\n  language: [invalid list structure'
      ];

      for (const [index, invalidYaml] of invalidYamlConfigs.entries()) {
        const configPath = path.join(apexDir, 'config.yaml');
        await fs.writeFile(configPath, invalidYaml);

        const result = await validateApexConfigFile(testProjectPath);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.type === 'invalid_yaml')).toBe(true);
      }
    });

    it('should validate config with missing required fields', async () => {
      await fs.mkdir(apexDir, { recursive: true });

      const incompleteConfigs = [
        // Missing project section
        `version: "1.0"
autonomy:
  level: "review-before-commit"`,

        // Missing autonomy section
        `version: "1.0"
project:
  name: "test-project"`,

        // Missing agents section
        `version: "1.0"
project:
  name: "test-project"
autonomy:
  level: "review-before-commit"`
      ];

      for (const config of incompleteConfigs) {
        const configPath = path.join(apexDir, 'config.yaml');
        await fs.writeFile(configPath, config);

        const result = await validateApexConfigFile(testProjectPath);

        // Should fail schema validation due to missing required fields
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.type === 'schema_validation_error')).toBe(true);
      }
    });

    it('should validate config with semantic warnings', async () => {
      await fs.mkdir(apexDir, { recursive: true });

      const configWithWarnings = `
version: "1.0"
project:
  name: ""
  language: ""
autonomy:
  level: "review-before-commit"
  limits:
    maxCostPerTask: 0.01
agents:
  enabled: []
models:
  planning: "opus"
  implementation: "opus"
  review: "opus"
git:
  branchPrefix: "apex/"
  commitFormat: "conventional"
limits:
  maxTokensPerTask: 500000
  maxCostPerTask: 10.0
  dailyBudget: 100.0
  maxTurns: 100
  maxConcurrentTasks: 3
`;

      const configPath = path.join(apexDir, 'config.yaml');
      await fs.writeFile(configPath, configWithWarnings.trim());

      const result = await validateApexConfigFile(testProjectPath);

      expect(result.valid).toBe(true); // Schema valid but has semantic warnings
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.type === 'missing_project_name')).toBe(true);
      expect(result.warnings.some(w => w.type === 'low_cost_limit')).toBe(true);
      expect(result.warnings.some(w => w.type === 'no_agents_enabled')).toBe(true);
      expect(result.warnings.some(w => w.type === 'same_model_all_stages')).toBe(true);
    });
  });

  describe('Agent Definitions Edge Cases', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(apexDir, 'agents'), { recursive: true });
    });

    it('should handle agent files with invalid frontmatter', async () => {
      const invalidAgentConfigs = [
        // No frontmatter at all
        'This is just plain markdown with no YAML frontmatter',

        // Invalid YAML in frontmatter
        `---
name: test-agent
description: "unclosed string
tools: [invalid yaml
---
Agent instructions here`,

        // Missing required fields
        `---
description: "Missing name field"
tools: ["Read", "Write"]
---
Agent instructions here`,

        // Empty frontmatter
        `---
---
Empty frontmatter agent`
      ];

      for (const [index, invalidConfig] of invalidAgentConfigs.entries()) {
        const agentPath = path.join(apexDir, 'agents', `invalid-agent-${index}.md`);
        await fs.writeFile(agentPath, invalidConfig);
      }

      const result = await validateAgentDefinitions(testProjectPath);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.details?.invalidAgents?.length).toBe(invalidAgentConfigs.length);
    });

    it('should validate agents with missing optional fields', async () => {
      const agentWithWarnings = `---
name: minimal-agent
# Missing description, tools, model
---

Basic agent with minimal configuration.
`;

      const agentPath = path.join(apexDir, 'agents', 'minimal-agent.md');
      await fs.writeFile(agentPath, agentWithWarnings);

      const result = await validateAgentDefinitions(testProjectPath);

      expect(result.valid).toBe(true); // Valid but with warnings
      expect(result.warnings.some(w => w.type === 'missing_agent_description')).toBe(true);
      expect(result.warnings.some(w => w.type === 'no_agent_tools')).toBe(true);
    });

    it('should handle complex valid agent configuration', async () => {
      const complexAgent = `---
name: full-featured-agent
description: A comprehensive agent with all features
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
model: sonnet
temperature: 0.7
maxTokens: 4000
contextWindow: 200000
capabilities:
  - code-generation
  - debugging
  - testing
  - documentation
specializations:
  - typescript
  - python
  - golang
---

# Full Featured Agent

This agent is designed to handle complex development tasks with expertise in multiple programming languages.

## Capabilities

- **Code Generation**: Write clean, maintainable code
- **Debugging**: Identify and fix issues
- **Testing**: Create comprehensive test suites
- **Documentation**: Generate clear, useful documentation

## Tools Usage

This agent uses all available tools:
- \`Read\` for examining existing code
- \`Write\` for creating new files
- \`Edit\` for modifying existing files
- \`Bash\` for running commands
- \`Glob\` for file searching
- \`Grep\` for content searching

## Best Practices

1. Always read existing code before making changes
2. Write tests for new functionality
3. Document all public interfaces
4. Follow project coding standards
`;

      const agentPath = path.join(apexDir, 'agents', 'full-featured-agent.md');
      await fs.writeFile(agentPath, complexAgent);

      const result = await validateAgentDefinitions(testProjectPath);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.warnings.length).toBe(0);
      expect(result.details?.validAgents).toContain('full-featured-agent');
    });
  });

  describe('Workflow Definitions Edge Cases', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(apexDir, 'workflows'), { recursive: true });
    });

    it('should handle invalid workflow YAML structures', async () => {
      const invalidWorkflows = [
        // Invalid YAML syntax
        `name: broken-workflow
description: This workflow has syntax errors
stages: [
  - name: stage1
    agent: planner
    description: "unclosed string
]`,

        // Missing required fields
        `description: "Workflow without name"
stages:
  - name: stage1
    agent: planner`,

        // Duplicate stage names
        `name: duplicate-stages
description: Workflow with duplicate stage names
stages:
  - name: planning
    agent: planner
    description: First planning stage
  - name: planning
    agent: developer
    description: Duplicate planning stage`,

        // Empty stages array
        `name: empty-workflow
description: Workflow with no stages
stages: []`
      ];

      for (const [index, invalidWorkflow] of invalidWorkflows.entries()) {
        const workflowPath = path.join(apexDir, 'workflows', `invalid-workflow-${index}.yaml`);
        await fs.writeFile(workflowPath, invalidWorkflow);
      }

      const result = await validateWorkflowDefinitions(testProjectPath);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate complex workflow with warnings', async () => {
      const workflowWithWarnings = `
name: comprehensive-workflow
description: A complex workflow with various stage configurations
stages:
  - name: analysis
    description: Analyze requirements and constraints
    # Missing agent - should generate warning

  - name: planning
    agent: planner
    description: Create detailed implementation plan
    inputs:
      - requirements
      - constraints
    outputs:
      - implementation-plan
      - architecture-diagram

  - name: implementation
    agent: developer
    description: Implement the planned solution
    inputs:
      - implementation-plan
      - architecture-diagram
    outputs:
      - source-code
      - unit-tests
    dependencies:
      - planning

  - name: testing
    agent: tester
    description: Comprehensive testing of implementation
    inputs:
      - source-code
      - unit-tests
    outputs:
      - test-report
      - coverage-report
    dependencies:
      - implementation

  - name: review
    agent: reviewer
    description: Code review and quality assurance
    inputs:
      - source-code
      - test-report
    outputs:
      - review-comments
      - approval-status
    dependencies:
      - testing

  - name: deployment
    agent: devops
    description: Deploy to production environment
    inputs:
      - source-code
      - approval-status
    outputs:
      - deployment-status
      - monitoring-setup
    dependencies:
      - review
`;

      const workflowPath = path.join(apexDir, 'workflows', 'comprehensive-workflow.yaml');
      await fs.writeFile(workflowPath, workflowWithWarnings.trim());

      const result = await validateWorkflowDefinitions(testProjectPath);

      expect(result.valid).toBe(true); // Valid but with warnings
      expect(result.warnings.some(w => w.type === 'stage_no_agent')).toBe(true);
      expect(result.details?.validWorkflows).toContain('comprehensive-workflow');
    });

    it('should handle both .yaml and .yml extensions', async () => {
      const yamlWorkflow = `
name: yaml-workflow
description: Workflow with .yaml extension
stages:
  - name: stage1
    agent: planner
    description: First stage
`;

      const ymlWorkflow = `
name: yml-workflow
description: Workflow with .yml extension
stages:
  - name: stage1
    agent: developer
    description: First stage
`;

      await fs.writeFile(path.join(apexDir, 'workflows', 'test.yaml'), yamlWorkflow.trim());
      await fs.writeFile(path.join(apexDir, 'workflows', 'test.yml'), ymlWorkflow.trim());

      const result = await validateWorkflowDefinitions(testProjectPath);

      expect(result.valid).toBe(true);
      expect(result.details?.totalFiles).toBe(2);
      expect(result.details?.validWorkflows).toContain('yaml-workflow');
      expect(result.details?.validWorkflows).toContain('yml-workflow');
    });
  });

  describe('Integration Scenarios', () => {
    it('should provide comprehensive validation for real-world project structure', async () => {
      // Create a realistic APEX project structure
      await fs.mkdir(apexDir, { recursive: true });
      await fs.mkdir(path.join(apexDir, 'agents'), { recursive: true });
      await fs.mkdir(path.join(apexDir, 'workflows'), { recursive: true });
      await fs.mkdir(path.join(apexDir, 'skills'), { recursive: true });
      await fs.mkdir(path.join(apexDir, 'scripts'), { recursive: true });

      // Create realistic config
      const realisticConfig = `
version: "1.0"
project:
  name: "modern-web-app"
  language: "typescript"
  framework: "nextjs"
  packageManager: "npm"

autonomy:
  level: "review-before-commit"

agents:
  enabled:
    - planner
    - architect
    - developer
    - tester
    - reviewer

models:
  planning: "opus"
  implementation: "sonnet"
  review: "haiku"

git:
  branchPrefix: "apex/"
  commitFormat: "conventional"
  autoCommit: true
  requirePullRequest: true

limits:
  maxTokensPerTask: 500000
  maxCostPerTask: 25.0
  dailyBudget: 200.0
  maxTurns: 50
  maxConcurrentTasks: 2

features:
  codeGeneration: true
  testing: true
  documentation: true
  deployment: false
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), realisticConfig.trim());

      // Create realistic agents
      const plannerAgent = `---
name: planner
description: Strategic planning and task breakdown specialist
tools: ["Read", "Glob", "Grep", "WebSearch"]
model: opus
specializations: ["architecture", "requirements-analysis", "project-management"]
---

# Planner Agent

You are an expert software architect and project manager specializing in breaking down complex requirements into manageable tasks.

## Responsibilities

- Analyze project requirements and constraints
- Create comprehensive implementation plans
- Identify potential risks and mitigation strategies
- Define clear acceptance criteria for each task
`;

      await fs.writeFile(path.join(apexDir, 'agents', 'planner.md'), plannerAgent);

      const developerAgent = `---
name: developer
description: Full-stack development specialist
tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"]
model: sonnet
specializations: ["typescript", "react", "nodejs", "testing"]
---

# Developer Agent

You are an experienced full-stack developer with expertise in modern web technologies.

## Responsibilities

- Implement features according to specifications
- Write clean, maintainable, and well-tested code
- Follow established coding standards and best practices
- Integrate with existing codebases seamlessly
`;

      await fs.writeFile(path.join(apexDir, 'agents', 'developer.md'), developerAgent);

      // Create realistic workflow
      const featureWorkflow = `
name: feature-development
description: Complete feature development lifecycle
trigger: manual

stages:
  - name: planning
    agent: planner
    description: Analyze requirements and create implementation plan
    outputs: ["implementation-plan", "task-breakdown"]

  - name: architecture
    agent: architect
    description: Design system architecture and interfaces
    inputs: ["implementation-plan"]
    outputs: ["architecture-design", "api-specification"]
    dependencies: ["planning"]

  - name: implementation
    agent: developer
    description: Implement the feature according to plan
    inputs: ["implementation-plan", "architecture-design"]
    outputs: ["source-code", "unit-tests"]
    dependencies: ["architecture"]

  - name: testing
    agent: tester
    description: Comprehensive testing and quality assurance
    inputs: ["source-code", "unit-tests"]
    outputs: ["test-results", "coverage-report"]
    dependencies: ["implementation"]

  - name: review
    agent: reviewer
    description: Code review and final quality check
    inputs: ["source-code", "test-results"]
    outputs: ["review-feedback", "approval"]
    dependencies: ["testing"]
`;

      await fs.writeFile(path.join(apexDir, 'workflows', 'feature-development.yaml'), featureWorkflow.trim());

      // Run comprehensive validation
      const result = await validateApexConfiguration(testProjectPath);

      expect(result.valid).toBe(true);
      expect(result.directory.valid).toBe(true);
      expect(result.config.valid).toBe(true);
      expect(result.agents.valid).toBe(true);
      expect(result.workflows.valid).toBe(true);

      expect(result.summary.totalErrors).toBe(0);
      expect(result.summary.criticalIssues.length).toBe(0);

      // Verify details
      expect(result.directory.details?.existingDirectories).toContain('agents');
      expect(result.directory.details?.existingDirectories).toContain('workflows');
      expect(result.agents.details?.validAgents).toContain('planner');
      expect(result.agents.details?.validAgents).toContain('developer');
      expect(result.workflows.details?.validWorkflows).toContain('feature-development');
    });

    it('should handle mixed valid/invalid configuration gracefully', async () => {
      // Create partially broken project
      await fs.mkdir(apexDir, { recursive: true });
      await fs.mkdir(path.join(apexDir, 'agents'), { recursive: true });
      await fs.mkdir(path.join(apexDir, 'workflows'), { recursive: true });

      // Valid config
      const validConfig = `
version: "1.0"
project:
  name: "mixed-project"
  language: "javascript"
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
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), validConfig.trim());

      // Mix of valid and invalid agents
      const validAgent = `---
name: good-agent
description: This agent is properly configured
tools: ["Read", "Write"]
---
Good agent instructions.`;

      const invalidAgent = `---
name: bad-agent
# Missing required fields and malformed YAML
tools: [invalid yaml structure
---`;

      await fs.writeFile(path.join(apexDir, 'agents', 'good-agent.md'), validAgent);
      await fs.writeFile(path.join(apexDir, 'agents', 'bad-agent.md'), invalidAgent);

      // Mix of valid and invalid workflows
      const validWorkflow = `
name: good-workflow
description: Properly configured workflow
stages:
  - name: stage1
    agent: good-agent
    description: Valid stage
`;

      const invalidWorkflow = `
name: bad-workflow
description: Broken workflow
stages: [
  - name: stage1
    agent: bad-agent
    description: "unclosed string
]`;

      await fs.writeFile(path.join(apexDir, 'workflows', 'good-workflow.yaml'), validWorkflow.trim());
      await fs.writeFile(path.join(apexDir, 'workflows', 'bad-workflow.yaml'), invalidWorkflow);

      const result = await validateApexConfiguration(testProjectPath);

      expect(result.valid).toBe(false); // Overall invalid due to errors
      expect(result.directory.valid).toBe(true); // Directory structure is fine
      expect(result.config.valid).toBe(true); // Config is fine
      expect(result.agents.valid).toBe(false); // Agents have errors
      expect(result.workflows.valid).toBe(false); // Workflows have errors

      expect(result.summary.totalErrors).toBeGreaterThan(0);
      expect(result.summary.criticalIssues).toContain('Agent definition issues');
      expect(result.summary.criticalIssues).toContain('Workflow definition issues');
    });
  });

  describe('createApexConfigValidationCheck Integration', () => {
    it('should create comprehensive doctor check result with detailed information', async () => {
      // Set up a project with warnings but no errors
      await fs.mkdir(apexDir, { recursive: true });
      await fs.mkdir(path.join(apexDir, 'agents'), { recursive: true });

      const configWithWarnings = `
version: "1.0"
project:
  name: "test-project"
  language: "typescript"
autonomy:
  level: "review-before-commit"
  limits:
    maxCostPerTask: 0.05
agents:
  enabled: []
models:
  planning: "opus"
  implementation: "opus"
  review: "opus"
git:
  branchPrefix: "apex/"
  commitFormat: "conventional"
limits:
  maxTokensPerTask: 500000
  maxCostPerTask: 10.0
  dailyBudget: 100.0
  maxTurns: 100
  maxConcurrentTasks: 3
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configWithWarnings.trim());

      const validationResult = await validateApexConfiguration(testProjectPath);
      const doctorCheck = createApexConfigValidationCheck(testProjectPath, validationResult);

      expect(doctorCheck.id).toBe('apex-config-validation');
      expect(doctorCheck.name).toBe('APEX Configuration Validation');
      expect(doctorCheck.category).toBe('config');
      expect(doctorCheck.status).toBe('pass');
      expect(doctorCheck.severity).toBe('info');

      expect(doctorCheck.message).toContain('APEX configuration is valid and complete');
      expect(doctorCheck.details?.validation).toBeDefined();
      expect(doctorCheck.details?.summary).toBeDefined();
      expect(typeof doctorCheck.durationMs).toBe('number');
    });

    it('should handle critical failure scenarios in doctor check', async () => {
      const mockCriticalFailure = {
        valid: false,
        directory: {
          valid: false,
          errors: [{ type: 'missing_apex_directory', message: 'Missing .apex directory' }],
          warnings: []
        },
        config: {
          valid: false,
          errors: [{ type: 'missing_config_file', message: 'Missing config.yaml' }],
          warnings: []
        },
        agents: {
          valid: false,
          errors: [{ type: 'agent_parse_error', message: 'Failed to parse agents' }],
          warnings: []
        },
        workflows: {
          valid: false,
          errors: [{ type: 'workflow_schema_error', message: 'Invalid workflow schema' }],
          warnings: []
        },
        summary: {
          totalErrors: 4,
          totalWarnings: 0,
          criticalIssues: ['Directory structure issues', 'Configuration file issues', 'Agent definition issues', 'Workflow definition issues']
        }
      };

      const doctorCheck = createApexConfigValidationCheck(testProjectPath, mockCriticalFailure);

      expect(doctorCheck.status).toBe('fail');
      expect(doctorCheck.severity).toBe('error');
      expect(doctorCheck.message).toContain('APEX configuration has 4 error(s)');
      expect(doctorCheck.suggestion).toContain('Address critical issues');
      expect(doctorCheck.details?.summary.criticalIssues.length).toBe(4);
    });
  });
});
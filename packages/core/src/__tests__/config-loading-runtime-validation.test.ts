/**
 * Runtime Configuration Loading Validation Tests
 *
 * These tests verify that Zod schemas are properly integrated into the
 * configuration loading pipeline and that runtime validation works as expected.
 *
 * Test Coverage:
 * - Configuration file loading with Zod validation
 * - Agent definition parsing with schema validation
 * - Workflow definition loading with runtime checks
 * - MCP configuration validation
 * - Error handling and recovery
 * - Performance characteristics of validation
 *
 * @author QA Engineer - Testing Stage
 * @date 2026-03-01
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';
import { ZodError } from 'zod';

// Import the actual config loading functions and validation functions
import {
  loadConfig,
  loadAgents,
  loadWorkflows,
  parseAgentMarkdown,
} from '../config.js';
import {
  validateApexConfiguration,
  validateMCPConfiguration,
} from '../config-validation.js';
import { MCPConfigValidator } from '../validation/mcp-config-validator.js';

describe('Configuration Loading Runtime Validation', () => {
  const testProjectPath = '/tmp/apex-runtime-validation-test';
  const apexDir = path.join(testProjectPath, '.apex');

  beforeEach(async () => {
    // Clean up any existing test directory
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch {
      // Ignore errors if directory doesn't exist
    }

    // Create test project structure
    await fs.mkdir(testProjectPath, { recursive: true });
    await fs.mkdir(apexDir, { recursive: true });
    await fs.mkdir(path.join(apexDir, 'agents'), { recursive: true });
    await fs.mkdir(path.join(apexDir, 'workflows'), { recursive: true });
    await fs.mkdir(path.join(apexDir, 'tools'), { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('loadConfig Runtime Validation', () => {
    it('should successfully load and validate valid configuration', async () => {
      const validConfig = {
        version: '1.0',
        project: {
          name: 'runtime-test-project',
          description: 'Runtime validation test project',
          version: '1.0.0'
        },
        autonomy: {
          level: 'review-before-commit'
        },
        models: {
          planning: 'opus',
          implementation: 'sonnet',
          review: 'haiku',
          default: 'sonnet'
        },
        limits: {
          maxTokensPerTask: 500000,
          maxCostPerTask: 10.0,
          dailyBudget: 100.0
        },
        tools: {
          filesystem: {
            enabled: true,
            requireConfirmation: false,
            maxFileSize: 1048576,
            allowedExtensions: ['.ts', '.js', '.json', '.md']
          },
          shell: {
            enabled: true,
            requireConfirmation: true,
            blockedCommands: ['rm -rf /', 'sudo rm'],
            allowElevatedPrivileges: false
          }
        }
      };

      const configPath = path.join(apexDir, 'config.yaml');
      await fs.writeFile(configPath, yaml.stringify(validConfig));

      // This should NOT throw because validation passes
      const loadedConfig = await loadConfig(testProjectPath);

      expect(loadedConfig).toBeDefined();
      expect(loadedConfig.project.name).toBe('runtime-test-project');
      expect(loadedConfig.autonomy?.level).toBe('review-before-commit');
      expect(loadedConfig.models?.planning).toBe('opus');
      expect(loadedConfig.tools?.filesystem?.maxFileSize).toBe(1048576);
    });

    it('should throw ZodError for invalid configuration', async () => {
      const invalidConfig = {
        project: {
          name: 123, // Invalid type - should be string
          version: null // Invalid type
        },
        autonomy: {
          level: 'invalid-autonomy-level' // Invalid enum value
        },
        models: {
          planning: 'gpt-4', // Invalid model name
          implementation: 'claude-3' // Invalid model name
        },
        limits: {
          maxTokensPerTask: -500, // Invalid negative value
          maxConcurrentTasks: 0 // Invalid zero value
        }
      };

      const configPath = path.join(apexDir, 'config.yaml');
      await fs.writeFile(configPath, yaml.stringify(invalidConfig));

      // Should throw ZodError due to validation failures
      await expect(loadConfig(testProjectPath)).rejects.toThrow(ZodError);
    });

    it('should handle malformed YAML gracefully', async () => {
      const malformedYaml = `
project:
  name: "unterminated string
  description: valid description
autonomy:
  level: review-before-commit
  [invalid: yaml: structure
models:
  planning: opus
`;

      const configPath = path.join(apexDir, 'config.yaml');
      await fs.writeFile(configPath, malformedYaml);

      // Should throw an error (YAML parsing error, not Zod error)
      await expect(loadConfig(testProjectPath)).rejects.toThrow();
    });

    it('should handle missing configuration file', async () => {
      // No config file created - should throw error
      await expect(loadConfig(testProjectPath)).rejects.toThrow();
    });

    it('should apply default values from schema', async () => {
      const minimalConfig = {
        project: { name: 'minimal-project' }
      };

      const configPath = path.join(apexDir, 'config.yaml');
      await fs.writeFile(configPath, yaml.stringify(minimalConfig));

      const loadedConfig = await loadConfig(testProjectPath);

      // Should have default version from schema
      expect(loadedConfig.version).toBe('1.0');
      expect(loadedConfig.project.name).toBe('minimal-project');
    });

    it('should validate complex nested configuration structures', async () => {
      const complexConfig = {
        project: { name: 'complex-project' },
        mcp: {
          enabled: true,
          servers: [
            {
              name: 'database-server',
              command: 'python',
              args: ['-m', 'mcp_server_postgresql'],
              env: { DB_HOST: 'localhost', DB_PORT: '5432' },
              cwd: '/opt/mcp-servers',
              timeout: 60000
            },
            {
              name: 'filesystem-server',
              command: 'npx',
              args: ['@modelcontextprotocol/server-filesystem', './'],
              env: { NODE_ENV: 'production' }
            }
          ],
          globalEnv: { PYTHONPATH: '/opt/mcp-servers' }
        },
        tools: {
          browser: {
            enabled: true,
            engine: 'chromium',
            backend: 'playwright',
            headless: true,
            viewport: { width: 1920, height: 1080 },
            allowedDomains: ['localhost', 'test.example.com'],
            timeout: 30000
          }
        }
      };

      const configPath = path.join(apexDir, 'config.yaml');
      await fs.writeFile(configPath, yaml.stringify(complexConfig));

      const loadedConfig = await loadConfig(testProjectPath);

      expect(loadedConfig.mcp?.enabled).toBe(true);
      expect(loadedConfig.mcp?.servers).toHaveLength(2);
      expect(loadedConfig.mcp?.servers?.[0].name).toBe('database-server');
      expect(loadedConfig.tools?.browser?.engine).toBe('chromium');
    });
  });

  describe('loadAgents Runtime Validation', () => {
    it('should load and validate valid agent definitions', async () => {
      const agentContent = `---
name: runtime-test-agent
description: Agent for runtime validation testing
tools: Read,Write,Edit,Bash,Grep
model: sonnet
skills:
  - typescript
  - testing
  - debugging
prompt_version: 1.0
---

# Runtime Test Agent

You are a skilled software development agent specialized in runtime validation testing.

## Your Role

- Validate configurations and schemas
- Test runtime behavior
- Ensure proper error handling
- Verify type safety

## Guidelines

- Always validate inputs before processing
- Handle errors gracefully
- Provide clear feedback on validation failures
- Use proper TypeScript types
`;

      const agentPath = path.join(apexDir, 'agents', 'runtime-test-agent.md');
      await fs.writeFile(agentPath, agentContent);

      const agents = await loadAgents(testProjectPath);
      const agentEntries = Object.values(agents);

      expect(agentEntries).toHaveLength(1);
      const agent = agentEntries[0];
      expect(agent.name).toBe('runtime-test-agent');
      expect(agent.description).toBe('Agent for runtime validation testing');
      expect(agent.model).toBe('sonnet');
      expect(agent.skills).toContain('typescript');
      expect(agent.prompt).toContain('runtime validation testing');
    });

    it('should reject agent with invalid model', async () => {
      const invalidAgentContent = `---
name: invalid-model-agent
description: Agent with invalid model
tools: Read,Write
model: gpt-4
---

This agent has an invalid model specification.
`;

      const agentPath = path.join(apexDir, 'agents', 'invalid-model-agent.md');
      await fs.writeFile(agentPath, invalidAgentContent);

      await expect(loadAgents(testProjectPath)).rejects.toThrow(ZodError);
    });

    it('should reject agent with missing required fields', async () => {
      const incompleteAgentContent = `---
name: incomplete-agent
# Missing description and model
---

This agent is missing required fields.
`;

      const agentPath = path.join(apexDir, 'agents', 'incomplete-agent.md');
      await fs.writeFile(agentPath, incompleteAgentContent);

      await expect(loadAgents(testProjectPath)).rejects.toThrow(ZodError);
    });

    it('should reject agent with empty prompt', async () => {
      const emptyPromptAgentContent = `---
name: empty-prompt-agent
description: Agent with empty prompt
model: sonnet
---

`;

      const agentPath = path.join(apexDir, 'agents', 'empty-prompt-agent.md');
      await fs.writeFile(agentPath, emptyPromptAgentContent);

      await expect(loadAgents(testProjectPath)).rejects.toThrow(ZodError);
    });

    it('should handle multiple agent files with validation', async () => {
      const agents = [
        {
          filename: 'planner.md',
          content: `---
name: planner
description: Strategic planning agent
model: opus
tools: Read,Glob,Grep
---

You are a strategic planning agent.`
        },
        {
          filename: 'developer.md',
          content: `---
name: developer
description: Implementation agent
model: sonnet
tools: Read,Write,Edit,Bash,MultiEdit
---

You are a development agent.`
        },
        {
          filename: 'tester.md',
          content: `---
name: tester
description: Quality assurance agent
model: haiku
tools: Read,Bash,Grep
---

You are a testing agent.`
        }
      ];

      // Write all agent files
      for (const agent of agents) {
        const agentPath = path.join(apexDir, 'agents', agent.filename);
        await fs.writeFile(agentPath, agent.content);
      }

      const loadedAgents = await loadAgents(testProjectPath);
      const agentEntries = Object.values(loadedAgents);

      expect(agentEntries).toHaveLength(3);

      const agentNames = agentEntries.map(a => a.name);
      expect(agentNames).toContain('planner');
      expect(agentNames).toContain('developer');
      expect(agentNames).toContain('tester');

      // Verify each agent has valid structure
      agentEntries.forEach(agent => {
        expect(agent.name).toBeDefined();
        expect(agent.description).toBeDefined();
        expect(agent.model).toBeDefined();
        expect(agent.prompt).toBeDefined();
        expect(agent.prompt.length).toBeGreaterThan(0);
      });
    });
  });

  describe('loadWorkflows Runtime Validation', () => {
    it('should load and validate valid workflow definitions', async () => {
      const workflowContent = {
        name: 'runtime-validation-workflow',
        description: 'Workflow for testing runtime validation',
        stages: [
          {
            name: 'analysis',
            agent: 'planner',
            description: 'Analyze the validation requirements'
          },
          {
            name: 'implementation',
            agent: 'developer',
            description: 'Implement validation tests'
          },
          {
            name: 'testing',
            agent: 'tester',
            description: 'Execute validation tests'
          },
          {
            name: 'review',
            agent: 'reviewer',
            description: 'Review validation results'
          }
        ],
        approvalGates: ['after-analysis', 'before-testing']
      };

      const workflowPath = path.join(apexDir, 'workflows', 'runtime-validation.yaml');
      await fs.writeFile(workflowPath, yaml.stringify(workflowContent));

      const workflows = await loadWorkflows(testProjectPath);
      const workflowEntries = Object.values(workflows);

      expect(workflowEntries).toHaveLength(1);
      const workflow = workflowEntries[0];
      expect(workflow.name).toBe('runtime-validation-workflow');
      expect(workflow.stages).toHaveLength(4);
      expect(workflow.approvalGates).toContain('after-analysis');
    });

    it('should reject workflow with empty stages array', async () => {
      const emptyWorkflow = {
        name: 'empty-stages-workflow',
        description: 'Workflow with no stages',
        stages: []
      };

      const workflowPath = path.join(apexDir, 'workflows', 'empty-workflow.yaml');
      await fs.writeFile(workflowPath, yaml.stringify(emptyWorkflow));

      await expect(loadWorkflows(testProjectPath)).rejects.toThrow(ZodError);
    });

    it('should reject workflow stage with missing required fields', async () => {
      const invalidWorkflow = {
        name: 'invalid-stage-workflow',
        description: 'Workflow with invalid stage',
        stages: [
          {
            // Missing 'name' field
            agent: 'developer',
            description: 'Invalid stage definition'
          }
        ]
      };

      const workflowPath = path.join(apexDir, 'workflows', 'invalid-workflow.yaml');
      await fs.writeFile(workflowPath, yaml.stringify(invalidWorkflow));

      await expect(loadWorkflows(testProjectPath)).rejects.toThrow(ZodError);
    });

    it('should handle multiple workflow files', async () => {
      const workflows = [
        {
          name: 'quick-fix',
          description: 'Quick bug fix workflow',
          stages: [
            { name: 'diagnosis', agent: 'developer', description: 'Identify issue' },
            { name: 'fix', agent: 'developer', description: 'Implement fix' },
            { name: 'verify', agent: 'tester', description: 'Verify fix' }
          ]
        },
        {
          name: 'feature-development',
          description: 'Complete feature development',
          stages: [
            { name: 'planning', agent: 'planner', description: 'Plan feature' },
            { name: 'implementation', agent: 'developer', description: 'Build feature' },
            { name: 'testing', agent: 'tester', description: 'Test feature' },
            { name: 'review', agent: 'reviewer', description: 'Review feature' }
          ]
        }
      ];

      // Write workflow files
      for (let i = 0; i < workflows.length; i++) {
        const filename = `workflow-${i + 1}.yaml`;
        const workflowPath = path.join(apexDir, 'workflows', filename);
        await fs.writeFile(workflowPath, yaml.stringify(workflows[i]));
      }

      const loadedWorkflows = await loadWorkflows(testProjectPath);
      const workflowEntries = Object.values(loadedWorkflows);

      expect(workflowEntries).toHaveLength(2);

      const workflowNames = workflowEntries.map(w => w.name);
      expect(workflowNames).toContain('quick-fix');
      expect(workflowNames).toContain('feature-development');
    });
  });

  describe('MCP Configuration Validation', () => {
    it('should validate MCP configuration through MCPConfigValidator', async () => {
      const validator = new MCPConfigValidator();

      const validMCPConfig = {
        enabled: true,
        servers: [
          {
            name: 'filesystem',
            command: 'npx',
            args: ['@modelcontextprotocol/server-filesystem', './'],
            env: { NODE_ENV: 'production' }
          },
          {
            name: 'database',
            command: 'python',
            args: ['-m', 'mcp_server_postgresql'],
            env: { DB_HOST: 'localhost', DB_PORT: '5432' },
            timeout: 30000
          }
        ],
        globalEnv: { PYTHONPATH: '/opt/mcp-servers' }
      };

      const result = await validator.validate(validMCPConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.parsedConfig).toBeDefined();
      expect(result.parsedConfig?.servers).toHaveLength(2);
    });

    it('should reject invalid MCP configuration', async () => {
      const validator = new MCPConfigValidator();

      const invalidMCPConfig = {
        enabled: 'yes', // Should be boolean
        servers: [
          {
            // Missing required 'name' field
            command: 'invalid-command',
            args: ['arg1', 'arg2']
          },
          {
            name: 'valid-server',
            command: 'node',
            args: null, // Should be array
            timeout: -1 // Should be positive
          }
        ]
      };

      const result = await validator.validate(invalidMCPConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.parsedConfig).toBeNull();
    });
  });

  describe('Performance and Memory Usage', () => {
    it('should handle large configurations efficiently', async () => {
      const largeConfig = {
        project: { name: 'large-config-project' },
        mcp: {
          enabled: true,
          servers: Array.from({ length: 100 }, (_, i) => ({
            name: `server-${i}`,
            command: 'node',
            args: [`script-${i}.js`],
            env: { SERVER_ID: i.toString(), NODE_ENV: 'production' },
            timeout: 30000
          }))
        },
        tools: {
          filesystem: {
            enabled: true,
            allowedExtensions: Array.from({ length: 50 }, (_, i) => `.ext${i}`),
            blockedExtensions: Array.from({ length: 20 }, (_, i) => `.blocked${i}`)
          }
        }
      };

      const configPath = path.join(apexDir, 'config.yaml');
      await fs.writeFile(configPath, yaml.stringify(largeConfig));

      const startTime = Date.now();
      const loadedConfig = await loadConfig(testProjectPath);
      const endTime = Date.now();

      // Should complete within reasonable time (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000);

      // Verify the large configuration was loaded correctly
      expect(loadedConfig.mcp?.servers).toHaveLength(100);
      expect(loadedConfig.tools?.filesystem?.allowedExtensions).toHaveLength(50);
    });

    it('should validate complex nested structures without excessive memory usage', async () => {
      const complexConfig = {
        project: { name: 'memory-test-project' },
        workflows: Array.from({ length: 10 }, (_, i) => ({
          name: `workflow-${i}`,
          description: `Test workflow ${i}`,
          stages: Array.from({ length: 5 }, (_, j) => ({
            name: `stage-${j}`,
            agent: `agent-${j}`,
            description: `Stage ${j} of workflow ${i}`
          }))
        }))
      };

      // Monitor memory usage
      const memBefore = process.memoryUsage();

      const configPath = path.join(apexDir, 'config.yaml');
      await fs.writeFile(configPath, yaml.stringify(complexConfig));

      await loadConfig(testProjectPath);

      const memAfter = process.memoryUsage();

      // Memory usage should not increase dramatically (< 50MB)
      const memIncreaseBytes = memAfter.heapUsed - memBefore.heapUsed;
      const memIncreaseMB = memIncreaseBytes / (1024 * 1024);

      expect(memIncreaseMB).toBeLessThan(50);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should provide meaningful error messages for configuration validation failures', async () => {
      const configWithMultipleErrors = {
        project: {
          name: '', // Empty string error
          version: 123 // Type error
        },
        autonomy: {
          level: 'non-existent-level' // Enum error
        },
        models: {
          planning: 'gpt-4', // Invalid model error
          implementation: null // Type error
        },
        limits: {
          maxTokensPerTask: -100, // Range error
          maxConcurrentTasks: 'five' // Type error
        }
      };

      const configPath = path.join(apexDir, 'config.yaml');
      await fs.writeFile(configPath, yaml.stringify(configWithMultipleErrors));

      try {
        await loadConfig(testProjectPath);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError);
        const zodError = error as ZodError;

        // Should have multiple specific errors
        expect(zodError.issues.length).toBeGreaterThan(4);

        // Check for specific error types
        const projectNameError = zodError.issues.find(issue =>
          issue.path.includes('name') && issue.code === 'too_small'
        );
        expect(projectNameError).toBeDefined();

        const autonomyLevelError = zodError.issues.find(issue =>
          issue.path.includes('level') && issue.code === 'invalid_enum_value'
        );
        expect(autonomyLevelError).toBeDefined();
      }
    });

    it('should handle partial file corruption gracefully', async () => {
      // Create a valid config first
      const validConfig = {
        project: { name: 'corruption-test' },
        models: { planning: 'opus' }
      };

      const configPath = path.join(apexDir, 'config.yaml');
      await fs.writeFile(configPath, yaml.stringify(validConfig));

      // Verify it loads correctly
      const initialLoad = await loadConfig(testProjectPath);
      expect(initialLoad.project.name).toBe('corruption-test');

      // Now corrupt the file
      const corruptedYaml = `
project:
  name: corruption-test
models:
  planning: opus
  [invalid: yaml: syntax
`;

      await fs.writeFile(configPath, corruptedYaml);

      // Should throw appropriate error (not crash)
      await expect(loadConfig(testProjectPath)).rejects.toThrow();
    });
  });
});
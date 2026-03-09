/**
 * Unit tests for APEX Workflow YAML Parser
 *
 * Tests the loadWorkflows function, YAML parsing, and schema validation
 * Coverage includes:
 * - Basic YAML parsing functionality
 * - Error handling for malformed YAML
 * - File system error handling
 * - Schema validation
 * - Edge cases and boundary conditions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { loadWorkflows } from '@apexcli/core';
import type { WorkflowDefinition } from '@apexcli/core';

describe('Workflow YAML Parser Unit Tests', () => {
  let testDir: string;
  let workflowsDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-parser-test-'));
    workflowsDir = path.join(testDir, '.apex', 'workflows');
    await fs.mkdir(workflowsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('Basic YAML Parsing', () => {
    it('should parse a simple workflow YAML file', async () => {
      const workflowContent = `name: simple-workflow
description: A simple test workflow
stages:
  - name: test-stage
    agent: test-agent
    description: Test stage`;

      await fs.writeFile(path.join(workflowsDir, 'simple.yaml'), workflowContent);

      const workflows = await loadWorkflows(testDir);

      expect(workflows).toBeDefined();
      expect(workflows['simple-workflow']).toBeDefined();
      expect(workflows['simple-workflow'].name).toBe('simple-workflow');
      expect(workflows['simple-workflow'].description).toBe('A simple test workflow');
      expect(workflows['simple-workflow'].stages).toHaveLength(1);
      expect(workflows['simple-workflow'].stages[0].name).toBe('test-stage');
      expect(workflows['simple-workflow'].stages[0].agent).toBe('test-agent');
    });

    it('should parse complex workflow with all optional fields', async () => {
      const workflowContent = `name: complex-workflow
description: A complex workflow with all features
trigger:
  - manual
  - apex:feature
stages:
  - name: stage1
    agent: agent1
    description: First stage
    dependsOn: []
    parallel: false
    inputs: ["input1", "input2"]
    outputs: ["output1", "output2"]
    condition: "true"
    actions: ["action1", "action2"]
    gate: null
    maxRetries: 3
  - name: stage2
    agent: agent2
    description: Second stage
    dependsOn: ["stage1"]
    parallel: true
    maxRetries: 1
gates:
  - id: test-gate
    name: Test Gate
    description: Test approval gate
    trigger: "stage:stage1:completed"
    required: true
isolation:
  mode: shared
  workspace: /tmp/test`;

      await fs.writeFile(path.join(workflowsDir, 'complex.yml'), workflowContent);

      const workflows = await loadWorkflows(testDir);

      expect(workflows['complex-workflow']).toBeDefined();
      const workflow = workflows['complex-workflow'];

      expect(workflow.trigger).toEqual(['manual', 'apex:feature']);
      expect(workflow.stages).toHaveLength(2);
      expect(workflow.stages[0].inputs).toEqual(['input1', 'input2']);
      expect(workflow.stages[0].outputs).toEqual(['output1', 'output2']);
      expect(workflow.stages[0].actions).toEqual(['action1', 'action2']);
      expect(workflow.stages[0].maxRetries).toBe(3);
      expect(workflow.stages[1].dependsOn).toEqual(['stage1']);
      expect(workflow.stages[1].parallel).toBe(true);
      expect(workflow.gates).toBeDefined();
      expect(workflow.gates![0].id).toBe('test-gate');
      expect(workflow.isolation).toBeDefined();
      expect(workflow.isolation!.mode).toBe('shared');
    });

    it('should handle multiple workflow files', async () => {
      const workflow1 = `name: workflow1
description: First workflow
stages:
  - name: stage1
    agent: agent1`;

      const workflow2 = `name: workflow2
description: Second workflow
stages:
  - name: stage1
    agent: agent1
  - name: stage2
    agent: agent2`;

      await fs.writeFile(path.join(workflowsDir, 'workflow1.yaml'), workflow1);
      await fs.writeFile(path.join(workflowsDir, 'workflow2.yml'), workflow2);

      const workflows = await loadWorkflows(testDir);

      expect(Object.keys(workflows)).toHaveLength(2);
      expect(workflows['workflow1']).toBeDefined();
      expect(workflows['workflow2']).toBeDefined();
      expect(workflows['workflow1'].stages).toHaveLength(1);
      expect(workflows['workflow2'].stages).toHaveLength(2);
    });
  });

  describe('File System Handling', () => {
    it('should return empty object when workflows directory does not exist', async () => {
      const emptyTestDir = await fs.mkdtemp(path.join(os.tmpdir(), 'empty-test-'));

      const workflows = await loadWorkflows(emptyTestDir);

      expect(workflows).toEqual({});

      await fs.rm(emptyTestDir, { recursive: true, force: true });
    });

    it('should ignore non-YAML files in workflows directory', async () => {
      const workflowContent = `name: valid-workflow
description: Valid workflow
stages:
  - name: stage1
    agent: agent1`;

      await fs.writeFile(path.join(workflowsDir, 'valid.yaml'), workflowContent);
      await fs.writeFile(path.join(workflowsDir, 'README.md'), '# README');
      await fs.writeFile(path.join(workflowsDir, 'config.json'), '{}');
      await fs.writeFile(path.join(workflowsDir, 'script.js'), 'console.log("test")');

      const workflows = await loadWorkflows(testDir);

      expect(Object.keys(workflows)).toHaveLength(1);
      expect(workflows['valid-workflow']).toBeDefined();
    });

    it('should handle file read permissions error', async () => {
      if (process.platform === 'win32') {
        // Skip this test on Windows due to permission handling differences
        return;
      }

      const workflowContent = `name: restricted-workflow
description: Restricted workflow
stages:
  - name: stage1
    agent: agent1`;

      const restrictedFile = path.join(workflowsDir, 'restricted.yaml');
      await fs.writeFile(restrictedFile, workflowContent);
      await fs.chmod(restrictedFile, 0o000); // Remove all permissions

      await expect(loadWorkflows(testDir)).rejects.toThrow();

      // Restore permissions for cleanup
      await fs.chmod(restrictedFile, 0o644);
    });
  });

  describe('YAML Parsing Errors', () => {
    it('should throw error for invalid YAML syntax', async () => {
      const invalidYaml = `name: invalid-workflow
description: Invalid workflow
stages:
  - name: stage1
    agent: agent1
    invalid_indentation`;

      await fs.writeFile(path.join(workflowsDir, 'invalid.yaml'), invalidYaml);

      await expect(loadWorkflows(testDir)).rejects.toThrow();
    });

    it('should throw error for YAML with tabs', async () => {
      const yamlWithTabs = `name: workflow-with-tabs
description: Workflow with tabs
stages:
\t- name: stage1
\t  agent: agent1`;

      await fs.writeFile(path.join(workflowsDir, 'tabs.yaml'), yamlWithTabs);

      await expect(loadWorkflows(testDir)).rejects.toThrow();
    });

    it('should handle empty YAML files', async () => {
      await fs.writeFile(path.join(workflowsDir, 'empty.yaml'), '');

      await expect(loadWorkflows(testDir)).rejects.toThrow();
    });

    it('should handle YAML with only comments', async () => {
      const commentOnlyYaml = `# This is just a comment
# No actual content`;

      await fs.writeFile(path.join(workflowsDir, 'comments.yaml'), commentOnlyYaml);

      await expect(loadWorkflows(testDir)).rejects.toThrow();
    });
  });

  describe('Schema Validation', () => {
    it('should reject workflow without required name field', async () => {
      const invalidWorkflow = `description: Workflow without name
stages:
  - name: stage1
    agent: agent1`;

      await fs.writeFile(path.join(workflowsDir, 'no-name.yaml'), invalidWorkflow);

      await expect(loadWorkflows(testDir)).rejects.toThrow();
    });

    it('should reject workflow without required description field', async () => {
      const invalidWorkflow = `name: no-description-workflow
stages:
  - name: stage1
    agent: agent1`;

      await fs.writeFile(path.join(workflowsDir, 'no-description.yaml'), invalidWorkflow);

      await expect(loadWorkflows(testDir)).rejects.toThrow();
    });

    it('should reject workflow without stages', async () => {
      const invalidWorkflow = `name: no-stages-workflow
description: Workflow without stages`;

      await fs.writeFile(path.join(workflowsDir, 'no-stages.yaml'), invalidWorkflow);

      await expect(loadWorkflows(testDir)).rejects.toThrow();
    });

    it('should allow workflow with empty stages array', async () => {
      const validWorkflow = `name: empty-stages-workflow
description: Workflow with empty stages
stages: []`;

      await fs.writeFile(path.join(workflowsDir, 'empty-stages.yaml'), validWorkflow);

      const workflows = await loadWorkflows(testDir);
      expect(workflows['empty-stages-workflow']).toBeDefined();
      expect(workflows['empty-stages-workflow'].stages).toHaveLength(0);
    });

    it('should reject stage without required name', async () => {
      const invalidWorkflow = `name: invalid-stage-workflow
description: Workflow with invalid stage
stages:
  - agent: agent1
    description: Stage without name`;

      await fs.writeFile(path.join(workflowsDir, 'invalid-stage.yaml'), invalidWorkflow);

      await expect(loadWorkflows(testDir)).rejects.toThrow();
    });

    it('should reject stage without required agent', async () => {
      const invalidWorkflow = `name: invalid-stage-workflow
description: Workflow with invalid stage
stages:
  - name: stage1
    description: Stage without agent`;

      await fs.writeFile(path.join(workflowsDir, 'invalid-stage.yaml'), invalidWorkflow);

      await expect(loadWorkflows(testDir)).rejects.toThrow();
    });

    it('should apply default values for optional fields', async () => {
      const workflowContent = `name: default-values-workflow
description: Workflow to test default values
stages:
  - name: stage1
    agent: agent1`;

      await fs.writeFile(path.join(workflowsDir, 'defaults.yaml'), workflowContent);

      const workflows = await loadWorkflows(testDir);
      const stage = workflows['default-values-workflow'].stages[0];

      expect(stage.parallel).toBe(false);
      expect(stage.maxRetries).toBe(2);
    });

    it('should validate trigger array format', async () => {
      const invalidWorkflow = `name: invalid-trigger-workflow
description: Workflow with invalid trigger format
trigger: "not-an-array"
stages:
  - name: stage1
    agent: agent1`;

      await fs.writeFile(path.join(workflowsDir, 'invalid-trigger.yaml'), invalidWorkflow);

      await expect(loadWorkflows(testDir)).rejects.toThrow();
    });

    it('should validate dependsOn array format', async () => {
      const invalidWorkflow = `name: invalid-depends-workflow
description: Workflow with invalid dependsOn format
stages:
  - name: stage1
    agent: agent1
    dependsOn: "not-an-array"`;

      await fs.writeFile(path.join(workflowsDir, 'invalid-depends.yaml'), invalidWorkflow);

      await expect(loadWorkflows(testDir)).rejects.toThrow();
    });

    it('should validate maxRetries is a number', async () => {
      const invalidWorkflow = `name: invalid-retries-workflow
description: Workflow with invalid maxRetries format
stages:
  - name: stage1
    agent: agent1
    maxRetries: "not-a-number"`;

      await fs.writeFile(path.join(workflowsDir, 'invalid-retries.yaml'), invalidWorkflow);

      await expect(loadWorkflows(testDir)).rejects.toThrow();
    });

    it('should validate parallel is a boolean', async () => {
      const invalidWorkflow = `name: invalid-parallel-workflow
description: Workflow with invalid parallel format
stages:
  - name: stage1
    agent: agent1
    parallel: "not-a-boolean"`;

      await fs.writeFile(path.join(workflowsDir, 'invalid-parallel.yaml'), invalidWorkflow);

      await expect(loadWorkflows(testDir)).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle workflow names with special characters', async () => {
      const workflowContent = `name: "workflow-with-special_chars.test"
description: Workflow with special characters in name
stages:
  - name: stage1
    agent: agent1`;

      await fs.writeFile(path.join(workflowsDir, 'special.yaml'), workflowContent);

      const workflows = await loadWorkflows(testDir);

      expect(workflows['workflow-with-special_chars.test']).toBeDefined();
    });

    it('should handle very long workflow descriptions', async () => {
      const longDescription = 'A'.repeat(1000);
      const workflowContent = `name: long-description-workflow
description: ${longDescription}
stages:
  - name: stage1
    agent: agent1`;

      await fs.writeFile(path.join(workflowsDir, 'long-desc.yaml'), workflowContent);

      const workflows = await loadWorkflows(testDir);

      expect(workflows['long-description-workflow'].description).toBe(longDescription);
    });

    it('should handle Unicode characters in YAML', async () => {
      const workflowContent = `name: unicode-workflow
description: "Workflow with Unicode: 你好世界 🌍 café"
stages:
  - name: "stage-with-émojis-🚀"
    agent: "agent-ñ"
    description: "Stage with Unicode: тест"`;

      await fs.writeFile(path.join(workflowsDir, 'unicode.yaml'), workflowContent);

      const workflows = await loadWorkflows(testDir);

      expect(workflows['unicode-workflow']).toBeDefined();
      expect(workflows['unicode-workflow'].description).toBe('Workflow with Unicode: 你好世界 🌍 café');
      expect(workflows['unicode-workflow'].stages[0].name).toBe('stage-with-émojis-🚀');
    });

    it('should handle workflow with maximum allowed stages', async () => {
      const stages = [];
      for (let i = 1; i <= 50; i++) {
        stages.push(`  - name: stage${i}
    agent: agent${i}
    description: Stage number ${i}`);
      }

      const workflowContent = `name: many-stages-workflow
description: Workflow with many stages
stages:
${stages.join('\n')}`;

      await fs.writeFile(path.join(workflowsDir, 'many-stages.yaml'), workflowContent);

      const workflows = await loadWorkflows(testDir);

      expect(workflows['many-stages-workflow'].stages).toHaveLength(50);
    });

    it('should handle nested directory structures gracefully', async () => {
      // Create a subdirectory in workflows
      const subDir = path.join(workflowsDir, 'subdir');
      await fs.mkdir(subDir);

      const workflowContent = `name: main-workflow
description: Main workflow
stages:
  - name: stage1
    agent: agent1`;

      await fs.writeFile(path.join(workflowsDir, 'main.yaml'), workflowContent);
      await fs.writeFile(path.join(subDir, 'sub.yaml'), workflowContent.replace('main-workflow', 'sub-workflow'));

      const workflows = await loadWorkflows(testDir);

      // Should only load files from the root workflows directory
      expect(Object.keys(workflows)).toHaveLength(1);
      expect(workflows['main-workflow']).toBeDefined();
      expect(workflows['sub-workflow']).toBeUndefined();
    });
  });

  describe('Performance and Memory', () => {
    it('should handle loading many workflow files efficiently', async () => {
      const startTime = Date.now();

      // Create 100 small workflow files
      const promises = [];
      for (let i = 1; i <= 100; i++) {
        const workflowContent = `name: workflow-${i}
description: Workflow number ${i}
stages:
  - name: stage1
    agent: agent1`;

        promises.push(fs.writeFile(path.join(workflowsDir, `workflow-${i}.yaml`), workflowContent));
      }
      await Promise.all(promises);

      const workflows = await loadWorkflows(testDir);
      const endTime = Date.now();

      expect(Object.keys(workflows)).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in less than 5 seconds
    });

    it('should handle large workflow files without memory issues', async () => {
      // Create a workflow with many stages
      const stages = [];
      for (let i = 1; i <= 1000; i++) {
        stages.push(`  - name: stage-${i}
    agent: agent-${i}
    description: "Stage ${i} with some description text that is reasonably long"`);
      }

      const workflowContent = `name: large-workflow
description: Large workflow with many stages for performance testing
stages:
${stages.join('\n')}`;

      await fs.writeFile(path.join(workflowsDir, 'large.yaml'), workflowContent);

      const workflows = await loadWorkflows(testDir);

      expect(workflows['large-workflow']).toBeDefined();
      expect(workflows['large-workflow'].stages).toHaveLength(1000);
    });
  });
});
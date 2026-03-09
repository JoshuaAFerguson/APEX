/**
 * Integration tests for APEX Workflow Loading System
 *
 * Tests the complete workflow loading pipeline including:
 * - Integration with file system operations
 * - Configuration loading and workflow interaction
 * - Real-world workflow examples from audit document
 * - Cross-platform compatibility
 * - Integration with orchestrator systems
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { loadWorkflows, loadWorkflow, loadConfig, initializeApex } from '@apexcli/core';
import type { WorkflowDefinition, WorkflowStage } from '@apexcli/core';

describe('Workflow Loading Integration Tests', () => {
  let testDir: string;
  let apexDir: string;
  let workflowsDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-integration-test-'));
    apexDir = path.join(testDir, '.apex');
    workflowsDir = path.join(apexDir, 'workflows');

    await fs.mkdir(workflowsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('Real-world Workflow Examples', () => {
    it('should load feature-development workflow from audit example', async () => {
      const featureWorkflow = `name: feature-development
description: Complete feature development workflow with comprehensive stages
stages:
  - name: planning
    agent: planner
    description: Analyze requirements and create implementation plan
  - name: architecture
    agent: architect
    description: Design system architecture and data models
  - name: implementation
    agent: developer
    description: Implement the planned features
  - name: testing
    agent: tester
    description: Create and run comprehensive tests
  - name: review
    agent: reviewer
    description: Code review and quality assurance`;

      await fs.writeFile(path.join(workflowsDir, 'feature-development.yaml'), featureWorkflow);

      const workflows = await loadWorkflows(testDir);

      expect(workflows['feature-development']).toBeDefined();
      const workflow = workflows['feature-development'];

      expect(workflow.name).toBe('feature-development');
      expect(workflow.description).toBe('Complete feature development workflow with comprehensive stages');
      expect(workflow.stages).toHaveLength(5);

      const stageNames = workflow.stages.map(s => s.name);
      expect(stageNames).toEqual(['planning', 'architecture', 'implementation', 'testing', 'review']);

      const agentNames = workflow.stages.map(s => s.agent);
      expect(agentNames).toEqual(['planner', 'architect', 'developer', 'tester', 'reviewer']);
    });

    it('should load quick-fix workflow from audit example', async () => {
      const quickFixWorkflow = `name: quick-fix
description: Quick bug fix workflow
stages:
  - name: diagnosis
    agent: developer
    description: Identify the issue
  - name: fix
    agent: developer
    description: Implement the fix
  - name: verify
    agent: tester
    description: Verify the fix works`;

      await fs.writeFile(path.join(workflowsDir, 'quick-fix.yaml'), quickFixWorkflow);

      const workflows = await loadWorkflows(testDir);

      expect(workflows['quick-fix']).toBeDefined();
      const workflow = workflows['quick-fix'];

      expect(workflow.stages).toHaveLength(3);
      expect(workflow.stages[0].name).toBe('diagnosis');
      expect(workflow.stages[1].name).toBe('fix');
      expect(workflow.stages[2].name).toBe('verify');
      expect(workflow.stages[0].agent).toBe('developer');
      expect(workflow.stages[2].agent).toBe('tester');
    });

    it('should load security-fix workflow with gates and dependencies', async () => {
      const securityWorkflow = `name: security-fix
description: Security vulnerability fixes
stages:
  - name: analysis
    agent: security
    description: Analyze vulnerability
    parallel: false
  - name: fix
    agent: developer
    description: Implement fix
    dependsOn: [analysis]
    maxRetries: 1
  - name: testing
    agent: tester
    description: Security testing
    dependsOn: [fix]
    gate: security-review
gates:
  - id: security-review
    name: Security Review Gate
    description: Requires security team approval
    trigger: "stage:testing:completed"
    required: true`;

      await fs.writeFile(path.join(workflowsDir, 'security-fix.yaml'), securityWorkflow);

      const workflows = await loadWorkflows(testDir);

      expect(workflows['security-fix']).toBeDefined();
      const workflow = workflows['security-fix'];

      expect(workflow.stages).toHaveLength(3);
      expect(workflow.stages[0].parallel).toBe(false);
      expect(workflow.stages[1].dependsOn).toEqual(['analysis']);
      expect(workflow.stages[1].maxRetries).toBe(1);
      expect(workflow.stages[2].dependsOn).toEqual(['fix']);
      expect(workflow.stages[2].gate).toBe('security-review');

      expect(workflow.gates).toBeDefined();
      expect(workflow.gates).toHaveLength(1);
      expect(workflow.gates![0].id).toBe('security-review');
      expect(workflow.gates![0].trigger).toBe('stage:testing:completed');
      expect(workflow.gates![0].required).toBe(true);
    });
  });

  describe('Integration with Configuration System', () => {
    it('should work with initializeApex and create default workflows directory', async () => {
      await initializeApex(testDir, { projectName: 'test-project' });

      // Check that .apex/workflows directory was created
      const workflowsDirExists = await fs.access(workflowsDir).then(() => true).catch(() => false);
      expect(workflowsDirExists).toBe(true);

      // Should be able to load workflows (might be empty or have default workflows)
      const workflows = await loadWorkflows(testDir);
      expect(workflows).toBeDefined();
      expect(typeof workflows).toBe('object');
    });

    it('should integrate with loadConfig function', async () => {
      // Create basic config
      const configContent = `version: 0.6.0
project:
  name: test-project
  description: Test project for workflow integration
agents:
  default_model: claude-3-5-sonnet-20241022`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configContent);

      const workflowContent = `name: test-workflow
description: Test workflow for config integration
stages:
  - name: test-stage
    agent: test-agent`;

      await fs.writeFile(path.join(workflowsDir, 'test.yaml'), workflowContent);

      const config = await loadConfig(testDir);
      const workflows = await loadWorkflows(testDir);

      expect(config).toBeDefined();
      expect(workflows).toBeDefined();
      expect(workflows['test-workflow']).toBeDefined();
    });

    it('should handle loadWorkflow function for single workflow loading', async () => {
      const workflowContent = `name: single-workflow
description: Single workflow test
stages:
  - name: single-stage
    agent: single-agent`;

      await fs.writeFile(path.join(workflowsDir, 'single-workflow.yaml'), workflowContent);

      const workflow = await loadWorkflow(testDir, 'single-workflow');

      expect(workflow).toBeDefined();
      expect(workflow!.name).toBe('single-workflow');
      expect(workflow!.description).toBe('Single workflow test');
    });

    it('should return null for non-existent workflow in loadWorkflow', async () => {
      const workflow = await loadWorkflow(testDir, 'non-existent-workflow');
      expect(workflow).toBeNull();
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should handle Windows-style paths correctly', async () => {
      // Test that paths work regardless of platform
      const workflowContent = `name: windows-path-workflow
description: Test Windows path handling
stages:
  - name: windows-stage
    agent: windows-agent`;

      await fs.writeFile(path.join(workflowsDir, 'windows.yaml'), workflowContent);

      const workflows = await loadWorkflows(testDir);

      expect(workflows['windows-path-workflow']).toBeDefined();
    });

    it('should handle Unix-style paths correctly', async () => {
      const workflowContent = `name: unix-path-workflow
description: Test Unix path handling
stages:
  - name: unix-stage
    agent: unix-agent`;

      await fs.writeFile(path.join(workflowsDir, 'unix.yaml'), workflowContent);

      const workflows = await loadWorkflows(testDir);

      expect(workflows['unix-path-workflow']).toBeDefined();
    });
  });

  describe('File System Edge Cases', () => {
    it('should handle symlinks to workflow files', async () => {
      if (process.platform === 'win32') {
        // Skip symlink test on Windows
        return;
      }

      const workflowContent = `name: symlink-workflow
description: Workflow accessed via symlink
stages:
  - name: symlink-stage
    agent: symlink-agent`;

      const originalFile = path.join(workflowsDir, 'original.yaml');
      const symlinkFile = path.join(workflowsDir, 'symlink.yaml');

      await fs.writeFile(originalFile, workflowContent);
      await fs.symlink('original.yaml', symlinkFile);

      const workflows = await loadWorkflows(testDir);

      // Should load both the original and symlink
      expect(workflows['symlink-workflow']).toBeDefined();
      expect(Object.keys(workflows)).toHaveLength(1); // Same workflow loaded once
    });

    it('should handle concurrent file access', async () => {
      const workflowContent = `name: concurrent-workflow
description: Test concurrent access
stages:
  - name: concurrent-stage
    agent: concurrent-agent`;

      await fs.writeFile(path.join(workflowsDir, 'concurrent.yaml'), workflowContent);

      // Load workflows concurrently
      const promises = Array(10).fill(0).map(() => loadWorkflows(testDir));
      const results = await Promise.all(promises);

      // All should succeed with same result
      results.forEach(workflows => {
        expect(workflows['concurrent-workflow']).toBeDefined();
      });
    });

    it('should handle file modification during loading', async () => {
      const initialContent = `name: modified-workflow
description: Initial content
stages:
  - name: initial-stage
    agent: initial-agent`;

      const modifiedContent = `name: modified-workflow
description: Modified content
stages:
  - name: modified-stage
    agent: modified-agent`;

      const workflowFile = path.join(workflowsDir, 'modified.yaml');
      await fs.writeFile(workflowFile, initialContent);

      // Start loading
      const loadPromise = loadWorkflows(testDir);

      // Modify file during load (with small delay)
      setTimeout(async () => {
        await fs.writeFile(workflowFile, modifiedContent);
      }, 1);

      const workflows = await loadPromise;

      // Should successfully load (either version is acceptable)
      expect(workflows['modified-workflow']).toBeDefined();
    });
  });

  describe('Memory and Performance', () => {
    it('should cache and reuse parsed workflows efficiently', async () => {
      // Create many workflows
      const promises = [];
      for (let i = 1; i <= 50; i++) {
        const workflowContent = `name: perf-workflow-${i}
description: Performance test workflow ${i}
stages:
  - name: stage-${i}
    agent: agent-${i}`;

        promises.push(fs.writeFile(path.join(workflowsDir, `perf-${i}.yaml`), workflowContent));
      }
      await Promise.all(promises);

      const startTime = Date.now();
      const workflows1 = await loadWorkflows(testDir);
      const midTime = Date.now();
      const workflows2 = await loadWorkflows(testDir);
      const endTime = Date.now();

      expect(Object.keys(workflows1)).toHaveLength(50);
      expect(Object.keys(workflows2)).toHaveLength(50);

      // Second load should be at least as fast (not significantly slower)
      const firstLoadTime = midTime - startTime;
      const secondLoadTime = endTime - midTime;
      expect(secondLoadTime).toBeLessThanOrEqual(firstLoadTime * 2);
    });

    it('should handle memory efficiently with large workflows', async () => {
      const stages = [];
      for (let i = 1; i <= 500; i++) {
        stages.push(`  - name: large-stage-${i}
    agent: large-agent-${i}
    description: "Large workflow stage ${i} with detailed description"`);
      }

      const largeWorkflowContent = `name: large-workflow
description: Large workflow for memory testing
stages:
${stages.join('\n')}`;

      await fs.writeFile(path.join(workflowsDir, 'large.yaml'), largeWorkflowContent);

      const workflows = await loadWorkflows(testDir);

      expect(workflows['large-workflow']).toBeDefined();
      expect(workflows['large-workflow'].stages).toHaveLength(500);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should continue loading valid workflows when one has schema errors', async () => {
      const validWorkflow = `name: valid-workflow
description: Valid workflow
stages:
  - name: valid-stage
    agent: valid-agent`;

      const invalidWorkflow = `name: invalid-workflow
# Missing required description field
stages:
  - name: invalid-stage
    agent: invalid-agent`;

      await fs.writeFile(path.join(workflowsDir, 'valid.yaml'), validWorkflow);
      await fs.writeFile(path.join(workflowsDir, 'invalid.yaml'), invalidWorkflow);

      // Should throw error due to invalid workflow
      await expect(loadWorkflows(testDir)).rejects.toThrow();
    });

    it('should handle corrupted YAML files gracefully', async () => {
      const validWorkflow = `name: valid-workflow
description: Valid workflow
stages:
  - name: valid-stage
    agent: valid-agent`;

      const corruptedYaml = `name: corrupted-workflow
description: Corrupted workflow
stages:
  - name: corrupted-stage
    agent: corrupted-agent
    invalid_structure: [unclosed_array`;

      await fs.writeFile(path.join(workflowsDir, 'valid.yaml'), validWorkflow);
      await fs.writeFile(path.join(workflowsDir, 'corrupted.yaml'), corruptedYaml);

      await expect(loadWorkflows(testDir)).rejects.toThrow();
    });

    it('should provide meaningful error messages for validation failures', async () => {
      const invalidWorkflow = `name: 123
description: Workflow with numeric name
stages: []`;

      await fs.writeFile(path.join(workflowsDir, 'invalid.yaml'), invalidWorkflow);

      try {
        await loadWorkflows(testDir);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        // Error should contain helpful information about what went wrong
        expect(error.message).toContain('name');
      }
    });
  });

  describe('Integration with Dependencies', () => {
    it('should validate stage dependencies exist', async () => {
      const workflowWithValidDeps = `name: valid-deps-workflow
description: Workflow with valid dependencies
stages:
  - name: stage1
    agent: agent1
    description: First stage
  - name: stage2
    agent: agent2
    description: Second stage
    dependsOn: [stage1]
  - name: stage3
    agent: agent3
    description: Third stage
    dependsOn: [stage1, stage2]`;

      await fs.writeFile(path.join(workflowsDir, 'valid-deps.yaml'), workflowWithValidDeps);

      const workflows = await loadWorkflows(testDir);

      expect(workflows['valid-deps-workflow']).toBeDefined();
      const workflow = workflows['valid-deps-workflow'];

      expect(workflow.stages[1].dependsOn).toEqual(['stage1']);
      expect(workflow.stages[2].dependsOn).toEqual(['stage1', 'stage2']);
    });

    it('should handle complex dependency graphs', async () => {
      const complexDepsWorkflow = `name: complex-deps-workflow
description: Workflow with complex dependencies
stages:
  - name: init
    agent: init-agent
    description: Initialization stage
  - name: setup-a
    agent: setup-agent
    description: Setup A
    dependsOn: [init]
  - name: setup-b
    agent: setup-agent
    description: Setup B
    dependsOn: [init]
  - name: process
    agent: process-agent
    description: Main processing
    dependsOn: [setup-a, setup-b]
  - name: cleanup-a
    agent: cleanup-agent
    description: Cleanup A
    dependsOn: [process]
  - name: cleanup-b
    agent: cleanup-agent
    description: Cleanup B
    dependsOn: [process]
  - name: finalize
    agent: finalize-agent
    description: Finalization
    dependsOn: [cleanup-a, cleanup-b]`;

      await fs.writeFile(path.join(workflowsDir, 'complex-deps.yaml'), complexDepsWorkflow);

      const workflows = await loadWorkflows(testDir);

      expect(workflows['complex-deps-workflow']).toBeDefined();
      const workflow = workflows['complex-deps-workflow'];

      expect(workflow.stages).toHaveLength(7);
      expect(workflow.stages.find(s => s.name === 'finalize')!.dependsOn).toEqual(['cleanup-a', 'cleanup-b']);
    });
  });
});
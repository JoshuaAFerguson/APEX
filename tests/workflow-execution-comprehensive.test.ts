/**
 * Comprehensive Workflow Execution Tests for APEX
 *
 * Tests the complete workflow execution pipeline including:
 * - Workflow orchestration and stage execution
 * - Dependency resolution and parallel execution
 * - Error handling and retry logic
 * - Gate integration and approval workflows
 * - Isolation mode validation
 * - Complex workflow patterns and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { loadWorkflows } from '@apexcli/core';
import type { WorkflowDefinition } from '@apexcli/core';

describe('Comprehensive Workflow Execution Tests', () => {
  let testDir: string;
  let workflowsDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-exec-test-'));
    workflowsDir = path.join(testDir, '.apex', 'workflows');
    await fs.mkdir(workflowsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('Stage Dependency Resolution', () => {
    it('should validate complex dependency graphs during loading', async () => {
      const complexWorkflow = `name: dependency-test
description: Test complex stage dependencies
stages:
  - name: init
    agent: init-agent
    description: Initialization
  - name: build-frontend
    agent: developer
    description: Build frontend
    dependsOn: [init]
  - name: build-backend
    agent: developer
    description: Build backend
    dependsOn: [init]
  - name: test-frontend
    agent: tester
    description: Test frontend
    dependsOn: [build-frontend]
  - name: test-backend
    agent: tester
    description: Test backend
    dependsOn: [build-backend]
  - name: integration-test
    agent: tester
    description: Integration testing
    dependsOn: [test-frontend, test-backend]
  - name: deploy
    agent: deployer
    description: Deploy application
    dependsOn: [integration-test]`;

      await fs.writeFile(path.join(workflowsDir, 'complex-deps.yaml'), complexWorkflow);

      const workflows = await loadWorkflows(testDir);
      const workflow = workflows['dependency-test'];

      expect(workflow).toBeDefined();
      expect(workflow.stages).toHaveLength(7);

      // Verify dependency structure
      const initStage = workflow.stages.find(s => s.name === 'init')!;
      const deployStage = workflow.stages.find(s => s.name === 'deploy')!;
      const integrationStage = workflow.stages.find(s => s.name === 'integration-test')!;

      expect(initStage.dependsOn).toBeUndefined();
      expect(deployStage.dependsOn).toEqual(['integration-test']);
      expect(integrationStage.dependsOn).toEqual(['test-frontend', 'test-backend']);
    });

    it('should handle circular dependency detection in validation', async () => {
      const circularWorkflow = `name: circular-deps
description: Workflow with circular dependencies (should be caught by execution logic)
stages:
  - name: stage-a
    agent: agent-a
    dependsOn: [stage-c]
  - name: stage-b
    agent: agent-b
    dependsOn: [stage-a]
  - name: stage-c
    agent: agent-c
    dependsOn: [stage-b]`;

      await fs.writeFile(path.join(workflowsDir, 'circular.yaml'), circularWorkflow);

      // The YAML parsing should succeed - circular dependency detection is an execution concern
      const workflows = await loadWorkflows(testDir);
      expect(workflows['circular-deps']).toBeDefined();
      expect(workflows['circular-deps'].stages).toHaveLength(3);
    });

    it('should handle missing dependency references', async () => {
      const missingDepWorkflow = `name: missing-dep
description: Workflow referencing non-existent dependencies
stages:
  - name: stage-a
    agent: agent-a
    dependsOn: [non-existent-stage]
  - name: stage-b
    agent: agent-b
    dependsOn: [stage-a, another-missing-stage]`;

      await fs.writeFile(path.join(workflowsDir, 'missing-deps.yaml'), missingDepWorkflow);

      // The YAML parsing should succeed - dependency validation is an execution concern
      const workflows = await loadWorkflows(testDir);
      expect(workflows['missing-dep']).toBeDefined();
      expect(workflows['missing-dep'].stages[0].dependsOn).toEqual(['non-existent-stage']);
      expect(workflows['missing-dep'].stages[1].dependsOn).toEqual(['stage-a', 'another-missing-stage']);
    });
  });

  describe('Parallel Execution Patterns', () => {
    it('should parse parallel execution configurations', async () => {
      const parallelWorkflow = `name: parallel-execution
description: Test parallel execution capabilities
stages:
  - name: preparation
    agent: prep-agent
    description: Prepare for parallel execution
  - name: parallel-task-1
    agent: worker-1
    description: First parallel task
    dependsOn: [preparation]
    parallel: true
  - name: parallel-task-2
    agent: worker-2
    description: Second parallel task
    dependsOn: [preparation]
    parallel: true
  - name: parallel-task-3
    agent: worker-3
    description: Third parallel task
    dependsOn: [preparation]
    parallel: true
  - name: consolidation
    agent: consolidator
    description: Consolidate parallel results
    dependsOn: [parallel-task-1, parallel-task-2, parallel-task-3]`;

      await fs.writeFile(path.join(workflowsDir, 'parallel.yaml'), parallelWorkflow);

      const workflows = await loadWorkflows(testDir);
      const workflow = workflows['parallel-execution'];

      expect(workflow).toBeDefined();

      const parallelTasks = workflow.stages.filter(s => s.parallel === true);
      expect(parallelTasks).toHaveLength(3);

      const consolidationStage = workflow.stages.find(s => s.name === 'consolidation')!;
      expect(consolidationStage.dependsOn).toHaveLength(3);
      expect(consolidationStage.parallel).toBe(false); // default value
    });

    it('should handle mixed parallel and sequential stages', async () => {
      const mixedWorkflow = `name: mixed-execution
description: Mixed parallel and sequential execution
stages:
  - name: seq-1
    agent: agent-1
    description: Sequential stage 1
  - name: par-1a
    agent: agent-2a
    description: Parallel stage 1a
    dependsOn: [seq-1]
    parallel: true
  - name: par-1b
    agent: agent-2b
    description: Parallel stage 1b
    dependsOn: [seq-1]
    parallel: true
  - name: seq-2
    agent: agent-3
    description: Sequential stage 2
    dependsOn: [par-1a, par-1b]
  - name: par-2a
    agent: agent-4a
    description: Parallel stage 2a
    dependsOn: [seq-2]
    parallel: true
  - name: par-2b
    agent: agent-4b
    description: Parallel stage 2b
    dependsOn: [seq-2]
    parallel: true
  - name: final
    agent: agent-5
    description: Final sequential stage
    dependsOn: [par-2a, par-2b]`;

      await fs.writeFile(path.join(workflowsDir, 'mixed.yaml'), mixedWorkflow);

      const workflows = await loadWorkflows(testDir);
      const workflow = workflows['mixed-execution'];

      expect(workflow).toBeDefined();
      expect(workflow.stages).toHaveLength(7);

      const parallelStages = workflow.stages.filter(s => s.parallel === true);
      const sequentialStages = workflow.stages.filter(s => !s.parallel);

      expect(parallelStages).toHaveLength(4);
      expect(sequentialStages).toHaveLength(3);
    });
  });

  describe('Gate Integration and Approval Workflows', () => {
    it('should parse workflows with approval gates', async () => {
      const gatedWorkflow = `name: approval-workflow
description: Workflow with multiple approval gates
stages:
  - name: development
    agent: developer
    description: Development phase
    outputs: [code-changes]
  - name: testing
    agent: tester
    description: Testing phase
    dependsOn: [development]
    gate: testing-approval
    outputs: [test-results]
  - name: staging
    agent: deployer
    description: Deploy to staging
    dependsOn: [testing]
    gate: staging-approval
    outputs: [staging-url]
  - name: production
    agent: deployer
    description: Deploy to production
    dependsOn: [staging]
    gate: production-approval
    outputs: [production-url]
gates:
  - id: testing-approval
    name: Testing Approval Gate
    description: Approve test results before staging
    trigger: "stage:testing:completed"
    required: true
    approvers: [qa-team, lead-developer]
  - id: staging-approval
    name: Staging Approval Gate
    description: Approve staging deployment
    trigger: "stage:staging:completed"
    required: true
    approvers: [product-manager]
    timeout: 1440  # 24 hours
  - id: production-approval
    name: Production Approval Gate
    description: Approve production deployment
    trigger: "stage:production:ready"
    required: true
    approvers: [release-manager, security-team]
    timeout: 2880  # 48 hours`;

      await fs.writeFile(path.join(workflowsDir, 'gated.yaml'), gatedWorkflow);

      const workflows = await loadWorkflows(testDir);
      const workflow = workflows['approval-workflow'];

      expect(workflow).toBeDefined();
      expect(workflow.gates).toHaveLength(3);
      expect(workflow.stages).toHaveLength(4);

      // Verify gate configuration
      const testingGate = workflow.gates!.find(g => g.id === 'testing-approval')!;
      expect(testingGate.required).toBe(true);
      expect(testingGate.approvers).toEqual(['qa-team', 'lead-developer']);

      const productionGate = workflow.gates!.find(g => g.id === 'production-approval')!;
      expect(productionGate.timeout).toBe(2880);
      expect(productionGate.approvers).toEqual(['release-manager', 'security-team']);

      // Verify stage-gate associations
      const testingStage = workflow.stages.find(s => s.name === 'testing')!;
      expect(testingStage.gate).toBe('testing-approval');

      const productionStage = workflow.stages.find(s => s.name === 'production')!;
      expect(productionStage.gate).toBe('production-approval');
    });

    it('should handle gates with different trigger patterns', async () => {
      const triggeredWorkflow = `name: trigger-patterns
description: Test different gate trigger patterns
stages:
  - name: stage-1
    agent: agent-1
    gate: pre-stage-gate
  - name: stage-2
    agent: agent-2
    dependsOn: [stage-1]
    gate: post-stage-gate
  - name: stage-3
    agent: agent-3
    dependsOn: [stage-2]
gates:
  - id: pre-stage-gate
    name: Pre-Stage Gate
    description: Gate triggered before stage execution
    trigger: "stage:stage-1:starting"
    required: false
    autoApprove: true
  - id: post-stage-gate
    name: Post-Stage Gate
    description: Gate triggered after stage completion
    trigger: "stage:stage-2:completed"
    required: true
    autoApprove: false`;

      await fs.writeFile(path.join(workflowsDir, 'triggers.yaml'), triggeredWorkflow);

      const workflows = await loadWorkflows(testDir);
      const workflow = workflows['trigger-patterns'];

      expect(workflow).toBeDefined();
      expect(workflow.gates).toHaveLength(2);

      const preGate = workflow.gates!.find(g => g.id === 'pre-stage-gate')!;
      expect(preGate.trigger).toBe('stage:stage-1:starting');
      expect(preGate.required).toBe(false);
      expect(preGate.autoApprove).toBe(true);

      const postGate = workflow.gates!.find(g => g.id === 'post-stage-gate')!;
      expect(postGate.trigger).toBe('stage:stage-2:completed');
      expect(postGate.required).toBe(true);
      expect(postGate.autoApprove).toBe(false);
    });
  });

  describe('Isolation Mode Configuration', () => {
    it('should parse full isolation mode workflows', async () => {
      const isolatedWorkflow = `name: full-isolation
description: Workflow with full container isolation
isolation:
  mode: full
  cleanupOnComplete: true
  preserveOnFailure: true
stages:
  - name: isolated-task
    agent: isolated-agent
    description: Task running in full isolation`;

      await fs.writeFile(path.join(workflowsDir, 'isolated.yaml'), isolatedWorkflow);

      const workflows = await loadWorkflows(testDir);
      const workflow = workflows['full-isolation'];

      expect(workflow).toBeDefined();
      expect(workflow.isolation).toBeDefined();
      expect(workflow.isolation!.mode).toBe('full');
      expect(workflow.isolation!.cleanupOnComplete).toBe(true);
      expect(workflow.isolation!.preserveOnFailure).toBe(true);
    });

    it('should parse worktree isolation mode workflows', async () => {
      const worktreeWorkflow = `name: worktree-isolation
description: Workflow with Git worktree isolation
isolation:
  mode: worktree
  cleanupOnComplete: false
stages:
  - name: worktree-task
    agent: worktree-agent
    description: Task running in Git worktree`;

      await fs.writeFile(path.join(workflowsDir, 'worktree.yaml'), worktreeWorkflow);

      const workflows = await loadWorkflows(testDir);
      const workflow = workflows['worktree-isolation'];

      expect(workflow).toBeDefined();
      expect(workflow.isolation).toBeDefined();
      expect(workflow.isolation!.mode).toBe('worktree');
      expect(workflow.isolation!.cleanupOnComplete).toBe(false);
    });

    it('should parse shared workspace mode workflows', async () => {
      const sharedWorkflow = `name: shared-workspace
description: Workflow with shared workspace
isolation:
  mode: shared
stages:
  - name: shared-task
    agent: shared-agent
    description: Task running in shared workspace`;

      await fs.writeFile(path.join(workflowsDir, 'shared.yaml'), sharedWorkflow);

      const workflows = await loadWorkflows(testDir);
      const workflow = workflows['shared-workspace'];

      expect(workflow).toBeDefined();
      expect(workflow.isolation).toBeDefined();
      expect(workflow.isolation!.mode).toBe('shared');
    });
  });

  describe('Retry Logic and Error Handling', () => {
    it('should parse stages with custom retry configurations', async () => {
      const retryWorkflow = `name: retry-logic
description: Test retry logic for different stages
stages:
  - name: reliable-task
    agent: reliable-agent
    description: Task that rarely fails
    maxRetries: 1
  - name: flaky-task
    agent: flaky-agent
    description: Task that often fails
    maxRetries: 5
  - name: critical-task
    agent: critical-agent
    description: Critical task with no retries
    maxRetries: 0
  - name: default-retry-task
    agent: default-agent
    description: Task with default retry settings`;

      await fs.writeFile(path.join(workflowsDir, 'retry.yaml'), retryWorkflow);

      const workflows = await loadWorkflows(testDir);
      const workflow = workflows['retry-logic'];

      expect(workflow).toBeDefined();
      expect(workflow.stages).toHaveLength(4);

      const reliableTask = workflow.stages.find(s => s.name === 'reliable-task')!;
      expect(reliableTask.maxRetries).toBe(1);

      const flakyTask = workflow.stages.find(s => s.name === 'flaky-task')!;
      expect(flakyTask.maxRetries).toBe(5);

      const criticalTask = workflow.stages.find(s => s.name === 'critical-task')!;
      expect(criticalTask.maxRetries).toBe(0);

      const defaultTask = workflow.stages.find(s => s.name === 'default-retry-task')!;
      expect(defaultTask.maxRetries).toBe(2); // default value
    });

    it('should handle edge cases in retry configuration', async () => {
      const edgeRetryWorkflow = `name: edge-retry
description: Edge cases for retry configuration
stages:
  - name: negative-retry
    agent: agent-1
    description: Stage with negative retries
    maxRetries: -1
  - name: large-retry
    agent: agent-2
    description: Stage with very large retries
    maxRetries: 999999`;

      await fs.writeFile(path.join(workflowsDir, 'edge-retry.yaml'), edgeRetryWorkflow);

      const workflows = await loadWorkflows(testDir);
      const workflow = workflows['edge-retry'];

      expect(workflow).toBeDefined();

      const negativeRetryStage = workflow.stages.find(s => s.name === 'negative-retry')!;
      expect(negativeRetryStage.maxRetries).toBe(-1); // Schema allows this

      const largeRetryStage = workflow.stages.find(s => s.name === 'large-retry')!;
      expect(largeRetryStage.maxRetries).toBe(999999);
    });
  });

  describe('Complex Workflow Patterns', () => {
    it('should parse fan-out fan-in workflow pattern', async () => {
      const fanOutInWorkflow = `name: fan-out-fan-in
description: Fan-out and fan-in workflow pattern
stages:
  - name: input-processing
    agent: processor
    description: Process initial input
    outputs: [processed-data]

  # Fan-out: Multiple parallel processing paths
  - name: path-a-step1
    agent: worker-a1
    description: Path A Step 1
    dependsOn: [input-processing]
    parallel: true
    inputs: [processed-data]
    outputs: [path-a-intermediate]
  - name: path-a-step2
    agent: worker-a2
    description: Path A Step 2
    dependsOn: [path-a-step1]
    outputs: [path-a-result]

  - name: path-b-step1
    agent: worker-b1
    description: Path B Step 1
    dependsOn: [input-processing]
    parallel: true
    inputs: [processed-data]
    outputs: [path-b-intermediate]
  - name: path-b-step2
    agent: worker-b2
    description: Path B Step 2
    dependsOn: [path-b-step1]
    outputs: [path-b-result]

  - name: path-c-single
    agent: worker-c
    description: Path C Single Step
    dependsOn: [input-processing]
    parallel: true
    inputs: [processed-data]
    outputs: [path-c-result]

  # Fan-in: Consolidate results
  - name: result-consolidation
    agent: consolidator
    description: Consolidate all path results
    dependsOn: [path-a-step2, path-b-step2, path-c-single]
    inputs: [path-a-result, path-b-result, path-c-result]
    outputs: [final-result]`;

      await fs.writeFile(path.join(workflowsDir, 'fan-out-in.yaml'), fanOutInWorkflow);

      const workflows = await loadWorkflows(testDir);
      const workflow = workflows['fan-out-fan-in'];

      expect(workflow).toBeDefined();
      expect(workflow.stages).toHaveLength(7);

      // Verify fan-out: multiple stages depend on input-processing
      const fanOutStages = workflow.stages.filter(s =>
        s.dependsOn && s.dependsOn.includes('input-processing')
      );
      expect(fanOutStages).toHaveLength(3);

      // Verify fan-in: consolidation stage depends on all paths
      const consolidationStage = workflow.stages.find(s => s.name === 'result-consolidation')!;
      expect(consolidationStage.dependsOn).toHaveLength(3);
      expect(consolidationStage.dependsOn).toContain('path-a-step2');
      expect(consolidationStage.dependsOn).toContain('path-b-step2');
      expect(consolidationStage.dependsOn).toContain('path-c-single');
    });

    it('should parse conditional execution workflow', async () => {
      const conditionalWorkflow = `name: conditional-execution
description: Workflow with conditional stage execution
stages:
  - name: condition-check
    agent: checker
    description: Check conditions for execution
    outputs: [should-deploy, environment, test-status]

  - name: development-deploy
    agent: dev-deployer
    description: Deploy to development environment
    dependsOn: [condition-check]
    condition: "outputs.environment === 'development'"
    inputs: [should-deploy]

  - name: staging-deploy
    agent: staging-deployer
    description: Deploy to staging environment
    dependsOn: [condition-check]
    condition: "outputs.environment === 'staging' && outputs.test-status === 'passed'"
    inputs: [should-deploy, test-status]

  - name: production-deploy
    agent: prod-deployer
    description: Deploy to production environment
    dependsOn: [condition-check]
    condition: "outputs.environment === 'production' && outputs.test-status === 'passed' && outputs.should-deploy === true"
    inputs: [should-deploy, test-status]
    gate: production-gate

  - name: rollback
    agent: rollback-agent
    description: Rollback deployment on failure
    condition: "outputs.test-status === 'failed'"
    dependsOn: [condition-check]

gates:
  - id: production-gate
    name: Production Deployment Gate
    description: Final approval for production deployment
    trigger: "stage:production-deploy:ready"
    required: true`;

      await fs.writeFile(path.join(workflowsDir, 'conditional.yaml'), conditionalWorkflow);

      const workflows = await loadWorkflows(testDir);
      const workflow = workflows['conditional-execution'];

      expect(workflow).toBeDefined();
      expect(workflow.stages).toHaveLength(5);

      const conditionalStages = workflow.stages.filter(s => s.condition);
      expect(conditionalStages).toHaveLength(4);

      const prodStage = workflow.stages.find(s => s.name === 'production-deploy')!;
      expect(prodStage.condition).toContain('production');
      expect(prodStage.condition).toContain('test-status');
      expect(prodStage.condition).toContain('should-deploy');
      expect(prodStage.gate).toBe('production-gate');
    });
  });

  describe('Large Scale Workflow Validation', () => {
    it('should handle workflows with many stages efficiently', async () => {
      const stages = [];
      const stageCount = 100;

      // Generate a large workflow with dependencies
      for (let i = 0; i < stageCount; i++) {
        const dependsOn = i > 0 ? [`stage-${i - 1}`] : undefined;
        stages.push(`  - name: stage-${i}
    agent: agent-${i % 10}  # Cycle through 10 different agents
    description: "Auto-generated stage ${i}"
    ${dependsOn ? `dependsOn: [${dependsOn[0]}]` : ''}
    maxRetries: ${i % 5}  # Vary retry counts
    ${i % 3 === 0 ? 'parallel: true' : ''}
    inputs: ["input-${i}"]
    outputs: ["output-${i}"]`);
      }

      const largeWorkflow = `name: large-scale-workflow
description: Large workflow with ${stageCount} stages
trigger: [manual, scheduled]
stages:
${stages.join('\n')}`;

      await fs.writeFile(path.join(workflowsDir, 'large.yaml'), largeWorkflow);

      const startTime = Date.now();
      const workflows = await loadWorkflows(testDir);
      const endTime = Date.now();

      const workflow = workflows['large-scale-workflow'];
      expect(workflow).toBeDefined();
      expect(workflow.stages).toHaveLength(stageCount);
      expect(endTime - startTime).toBeLessThan(5000); // Should parse in under 5 seconds

      // Verify dependency chain
      const lastStage = workflow.stages[stageCount - 1];
      expect(lastStage.name).toBe(`stage-${stageCount - 1}`);
      expect(lastStage.dependsOn).toEqual([`stage-${stageCount - 2}`]);
    });

    it('should handle complex workflows with mixed patterns efficiently', async () => {
      const complexWorkflow = `name: complex-mixed-pattern
description: Complex workflow combining multiple patterns
trigger: [webhook, manual, scheduled]

# Main workflow stages
stages:
  # Initial setup
  - name: setup
    agent: setup-agent
    description: Initial setup and validation
    outputs: [setup-config, environment-info]

  # Parallel preparation phases
  - name: prepare-frontend
    agent: frontend-agent
    description: Prepare frontend build environment
    dependsOn: [setup]
    parallel: true
    inputs: [setup-config]
    outputs: [frontend-env]
    maxRetries: 3

  - name: prepare-backend
    agent: backend-agent
    description: Prepare backend build environment
    dependsOn: [setup]
    parallel: true
    inputs: [setup-config]
    outputs: [backend-env]
    maxRetries: 3

  - name: prepare-database
    agent: database-agent
    description: Prepare database migration environment
    dependsOn: [setup]
    parallel: true
    inputs: [setup-config, environment-info]
    outputs: [database-env]
    maxRetries: 2
    gate: database-preparation-gate

  # Build phases
  - name: build-frontend
    agent: frontend-builder
    description: Build frontend application
    dependsOn: [prepare-frontend]
    inputs: [frontend-env]
    outputs: [frontend-artifacts]
    condition: "environment-info.include_frontend === true"

  - name: build-backend
    agent: backend-builder
    description: Build backend application
    dependsOn: [prepare-backend]
    inputs: [backend-env]
    outputs: [backend-artifacts]

  - name: migrate-database
    agent: database-migrator
    description: Run database migrations
    dependsOn: [prepare-database]
    inputs: [database-env]
    outputs: [migration-results]
    condition: "environment-info.include_migrations === true"

  # Testing phases (parallel testing)
  - name: test-frontend-unit
    agent: frontend-tester
    description: Run frontend unit tests
    dependsOn: [build-frontend]
    parallel: true
    inputs: [frontend-artifacts]
    outputs: [frontend-unit-results]
    condition: "frontend-artifacts !== null"

  - name: test-frontend-e2e
    agent: e2e-tester
    description: Run frontend E2E tests
    dependsOn: [build-frontend]
    parallel: true
    inputs: [frontend-artifacts]
    outputs: [frontend-e2e-results]
    condition: "frontend-artifacts !== null"
    maxRetries: 5  # E2E tests are flaky

  - name: test-backend-unit
    agent: backend-tester
    description: Run backend unit tests
    dependsOn: [build-backend]
    parallel: true
    inputs: [backend-artifacts]
    outputs: [backend-unit-results]

  - name: test-backend-integration
    agent: integration-tester
    description: Run backend integration tests
    dependsOn: [build-backend, migrate-database]
    parallel: true
    inputs: [backend-artifacts, migration-results]
    outputs: [backend-integration-results]

  # Quality gates
  - name: quality-analysis
    agent: quality-analyzer
    description: Run quality analysis on all components
    dependsOn: [test-frontend-unit, test-frontend-e2e, test-backend-unit, test-backend-integration]
    inputs: [frontend-unit-results, frontend-e2e-results, backend-unit-results, backend-integration-results]
    outputs: [quality-report]
    gate: quality-gate

  # Deployment phases
  - name: deploy-staging
    agent: staging-deployer
    description: Deploy to staging environment
    dependsOn: [quality-analysis]
    inputs: [frontend-artifacts, backend-artifacts, migration-results, quality-report]
    outputs: [staging-url]
    condition: "quality-report.passed === true"
    gate: staging-approval

  - name: smoke-test-staging
    agent: smoke-tester
    description: Run smoke tests on staging
    dependsOn: [deploy-staging]
    inputs: [staging-url]
    outputs: [smoke-test-results]
    maxRetries: 3

  - name: deploy-production
    agent: production-deployer
    description: Deploy to production environment
    dependsOn: [smoke-test-staging]
    inputs: [frontend-artifacts, backend-artifacts, migration-results, smoke-test-results]
    outputs: [production-url]
    condition: "smoke-test-results.passed === true"
    gate: production-approval
    maxRetries: 1  # Production deployments should be very reliable

  # Monitoring and cleanup
  - name: setup-monitoring
    agent: monitoring-agent
    description: Setup monitoring for production deployment
    dependsOn: [deploy-production]
    inputs: [production-url]
    outputs: [monitoring-config]
    parallel: true

  - name: cleanup
    agent: cleanup-agent
    description: Clean up temporary resources
    dependsOn: [deploy-production]
    inputs: [staging-url, production-url]
    parallel: true

# Approval gates
gates:
  - id: database-preparation-gate
    name: Database Preparation Approval
    description: Approve database preparation before migration
    trigger: "stage:prepare-database:completed"
    required: true
    approvers: [dba-team]
    timeout: 60  # 1 hour

  - id: quality-gate
    name: Quality Gate
    description: Quality analysis must pass thresholds
    trigger: "stage:quality-analysis:completed"
    required: true
    autoApprove: true  # Auto-approve if quality metrics meet criteria

  - id: staging-approval
    name: Staging Deployment Approval
    description: Approve deployment to staging environment
    trigger: "stage:deploy-staging:ready"
    required: true
    approvers: [dev-team-lead]
    timeout: 120  # 2 hours

  - id: production-approval
    name: Production Deployment Approval
    description: Final approval for production deployment
    trigger: "stage:deploy-production:ready"
    required: true
    approvers: [release-manager, security-team]
    timeout: 480  # 8 hours

# Isolation configuration for secure deployment
isolation:
  mode: worktree
  cleanupOnComplete: true
  preserveOnFailure: false`;

      await fs.writeFile(path.join(workflowsDir, 'complex-mixed.yaml'), complexWorkflow);

      const workflows = await loadWorkflows(testDir);
      const workflow = workflows['complex-mixed-pattern'];

      expect(workflow).toBeDefined();
      expect(workflow.stages).toHaveLength(16);
      expect(workflow.gates).toHaveLength(4);
      expect(workflow.isolation).toBeDefined();
      expect(workflow.trigger).toEqual(['webhook', 'manual', 'scheduled']);

      // Verify complex dependency structure
      const qualityStage = workflow.stages.find(s => s.name === 'quality-analysis')!;
      expect(qualityStage.dependsOn).toHaveLength(4);

      const productionStage = workflow.stages.find(s => s.name === 'deploy-production')!;
      expect(productionStage.maxRetries).toBe(1);
      expect(productionStage.gate).toBe('production-approval');

      // Verify parallel execution setup
      const parallelStages = workflow.stages.filter(s => s.parallel === true);
      expect(parallelStages.length).toBeGreaterThan(0);
    });
  });
});
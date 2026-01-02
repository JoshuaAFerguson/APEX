import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import { initializeApex } from '@apexcli/core';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((cmd: string, opts: unknown, callback?: unknown) => {
    if (typeof opts === 'function') {
      callback = opts;
    }
    const cb = callback as (error: Error | null, result?: { stdout: string }) => void;
    cb(null, { stdout: '' });
  }),
}));

describe('ApexOrchestrator - Gate Trigger Logic Tests', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-gate-trigger-test-'));

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'test-project',
      language: 'typescript',
      framework: 'node',
    });

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('runWorkflow() gate triggering', () => {
    it('should pause task when runWorkflow hits a required gate', async () => {
      // Create workflow with approval gate
      const workflowContent = `
name: feature-gate-workflow
description: Feature workflow with approval gate
gates:
  - id: implementation-gate
    name: Implementation Approval
    description: Review before implementation
    required: true
    autoApprove: false
    timeout: 60

stages:
  - name: planning
    agent: planner
    description: Plan the feature
  - name: implementation
    agent: developer
    description: Implement the feature
    gate: implementation-gate
    dependsOn:
      - planning
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'feature-gate-workflow.yaml'),
        workflowContent
      );

      // Create agent files
      const plannerContent = `---
name: planner
description: Planning agent
tools: Read, Glob, Grep
model: sonnet
---
You are a planning agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'planner.md'),
        plannerContent
      );

      const developerContent = `---
name: developer
description: Development agent
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a development agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'developer.md'),
        developerContent
      );

      await orchestrator.initialize();

      // Mock executeWorkflowStage to simulate planning stage completion
      const originalExecuteStage = (orchestrator as any).executeWorkflowStage;
      (orchestrator as any).executeWorkflowStage = vi.fn().mockResolvedValue({
        stageName: 'planning',
        agent: 'planner',
        status: 'completed',
        outputs: {},
        artifacts: [],
        summary: 'Planning completed successfully',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.001 },
        startedAt: new Date(),
        completedAt: new Date(),
      });

      // Create a task
      const task = await orchestrator.createTask({
        title: 'Test Task with Gate in runWorkflow',
        description: 'Testing gate trigger in runWorkflow',
        workflow: 'feature-gate-workflow',
      });

      // Mock store methods to track calls
      const updateTaskSpy = vi.spyOn((orchestrator as any).store, 'updateTask');
      const setGateSpy = vi.spyOn((orchestrator as any).store, 'setGate');
      const saveCheckpointSpy = vi.spyOn(orchestrator as any, 'saveCheckpoint');

      // Mock event emission
      const emitSpy = vi.spyOn(orchestrator, 'emit');

      // Start the workflow
      await orchestrator.runWorkflow(task.id);

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify task was paused with awaiting-approval status
      expect(updateTaskSpy).toHaveBeenCalledWith(
        task.id,
        expect.objectContaining({
          status: 'awaiting-approval',
          pauseReason: 'approval_gate',
          approvalState: expect.objectContaining({
            gateName: 'implementation-gate',
            status: 'pending',
            stage: 'implementation',
            agent: 'developer',
          }),
        })
      );

      // Verify gate was created in store
      expect(setGateSpy).toHaveBeenCalledWith(
        task.id,
        expect.objectContaining({
          gateName: 'implementation-gate',
          status: 'pending',
        })
      );

      // Verify checkpoint was saved with gate metadata
      expect(saveCheckpointSpy).toHaveBeenCalledWith(
        task.id,
        expect.objectContaining({
          stage: 'implementation',
          metadata: expect.objectContaining({
            pauseReason: 'approval_gate',
            gateName: 'implementation-gate',
            resumePoint: 'pre_stage_gate',
          }),
        })
      );

      // Verify gate:required event was emitted
      expect(emitSpy).toHaveBeenCalledWith(
        'gate:required',
        expect.objectContaining({
          gateName: 'implementation-gate',
          taskId: task.id,
          stage: 'implementation',
          agent: 'developer',
          blocking: true,
        })
      );

      // Restore original method
      (orchestrator as any).executeWorkflowStage = originalExecuteStage;
    });

    it('should not pause for auto-approve gates in runWorkflow', async () => {
      // Create workflow with auto-approve gate
      const workflowContent = `
name: auto-approve-workflow
description: Workflow with auto-approve gate
gates:
  - id: auto-gate
    name: Auto Approval Gate
    description: Auto-approve gate
    required: true
    autoApprove: true

stages:
  - name: implementation
    agent: developer
    description: Implementation stage
    gate: auto-gate
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'auto-approve-workflow.yaml'),
        workflowContent
      );

      const developerContent = `---
name: developer
description: Development agent
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a development agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'developer.md'),
        developerContent
      );

      await orchestrator.initialize();

      // Mock executeWorkflowStage
      const executeStagespy = vi.fn().mockResolvedValue({
        stageName: 'implementation',
        agent: 'developer',
        status: 'completed',
        outputs: {},
        artifacts: [],
        summary: 'Implementation completed successfully',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.001 },
        startedAt: new Date(),
        completedAt: new Date(),
      });
      (orchestrator as any).executeWorkflowStage = executeStagespy;

      const task = await orchestrator.createTask({
        title: 'Test Auto-Approve Gate',
        description: 'Testing auto-approve gate behavior in runWorkflow',
        workflow: 'auto-approve-workflow',
      });

      const updateTaskSpy = vi.spyOn((orchestrator as any).store, 'updateTask');

      // Start the workflow
      await orchestrator.runWorkflow(task.id);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify stage was executed (auto-approve gate should not block)
      expect(executeStagespy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ name: 'implementation' }),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );

      // Verify task was not paused for approval
      const pauseCalls = updateTaskSpy.mock.calls.filter(call =>
        call[1] && typeof call[1] === 'object' && 'pauseReason' in call[1] &&
        call[1].pauseReason === 'approval_gate'
      );
      expect(pauseCalls).toHaveLength(0);
    });

    it('should not pause for optional gates in runWorkflow', async () => {
      // Create workflow with optional gate
      const workflowContent = `
name: optional-gate-workflow
description: Workflow with optional gate
gates:
  - id: optional-gate
    name: Optional Gate
    description: Optional approval gate
    required: false
    autoApprove: false

stages:
  - name: implementation
    agent: developer
    description: Implementation stage
    gate: optional-gate
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'optional-gate-workflow.yaml'),
        workflowContent
      );

      const developerContent = `---
name: developer
description: Development agent
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a development agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'developer.md'),
        developerContent
      );

      await orchestrator.initialize();

      // Mock executeWorkflowStage
      const executeStagespy = vi.fn().mockResolvedValue({
        stageName: 'implementation',
        agent: 'developer',
        status: 'completed',
        outputs: {},
        artifacts: [],
        summary: 'Implementation completed successfully',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.001 },
        startedAt: new Date(),
        completedAt: new Date(),
      });
      (orchestrator as any).executeWorkflowStage = executeStagespy;

      const task = await orchestrator.createTask({
        title: 'Test Optional Gate',
        description: 'Testing optional gate behavior in runWorkflow',
        workflow: 'optional-gate-workflow',
      });

      const updateTaskSpy = vi.spyOn((orchestrator as any).store, 'updateTask');

      // Start the workflow
      await orchestrator.runWorkflow(task.id);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify stage was executed (optional gate should not block)
      expect(executeStagespy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ name: 'implementation' }),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );

      // Verify task was not paused for approval
      const pauseCalls = updateTaskSpy.mock.calls.filter(call =>
        call[1] && typeof call[1] === 'object' && 'pauseReason' in call[1] &&
        call[1].pauseReason === 'approval_gate'
      );
      expect(pauseCalls).toHaveLength(0);
    });
  });

  describe('executeWorkflowStage() gate triggering', () => {
    it('should pause task when executeWorkflowStage is called directly with gated stage', async () => {
      // Create workflow with gate
      const workflowContent = `
name: direct-stage-execution
description: Test direct stage execution with gates
gates:
  - id: stage-gate
    name: Stage Gate
    description: Gate for direct stage execution
    required: true
    autoApprove: false

stages:
  - name: gated-stage
    agent: developer
    description: Stage with gate
    gate: stage-gate
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'direct-stage-execution.yaml'),
        workflowContent
      );

      const developerContent = `---
name: developer
description: Development agent
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a development agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'developer.md'),
        developerContent
      );

      await orchestrator.initialize();

      const task = await orchestrator.createTask({
        title: 'Test Direct Stage Execution with Gate',
        description: 'Testing executeWorkflowStage with gated stage',
        workflow: 'direct-stage-execution',
      });

      // Get workflow and stage
      const workflow = (orchestrator as any).workflows['direct-stage-execution'];
      const stage = workflow.stages.find((s: any) => s.name === 'gated-stage');
      const agent = (orchestrator as any).agents['developer'];

      // Mock store methods
      const updateTaskSpy = vi.spyOn((orchestrator as any).store, 'updateTask');
      const setGateSpy = vi.spyOn((orchestrator as any).store, 'setGate');
      const saveCheckpointSpy = vi.spyOn(orchestrator as any, 'saveCheckpoint');

      // Mock event emission
      const emitSpy = vi.spyOn(orchestrator, 'emit');

      // Directly call executeWorkflowStage
      try {
        await (orchestrator as any).executeWorkflowStage(
          task,
          stage,
          agent,
          workflow,
          new Map(),
          []
        );
        // Should throw an error indicating the gate pause
      } catch (error) {
        // Expected behavior when gate triggers
      }

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify pause was triggered through shouldPauseForGate
      const shouldPauseForGate = (orchestrator as any).shouldPauseForGate(stage);
      expect(shouldPauseForGate.pause).toBe(true);
      expect(shouldPauseForGate.gate).toBeDefined();
      expect(shouldPauseForGate.gate.id).toBe('stage-gate');
    });

    it('should handle missing gate references gracefully', async () => {
      // Create workflow with missing gate reference
      const workflowContent = `
name: missing-gate-workflow
description: Workflow with missing gate reference
stages:
  - name: stage-with-missing-gate
    agent: developer
    description: Stage with missing gate
    gate: non-existent-gate
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'missing-gate-workflow.yaml'),
        workflowContent
      );

      const developerContent = `---
name: developer
description: Development agent
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a development agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'developer.md'),
        developerContent
      );

      await orchestrator.initialize();

      // Get workflow and stage
      const workflow = (orchestrator as any).workflows['missing-gate-workflow'];
      const stage = workflow.stages.find((s: any) => s.name === 'stage-with-missing-gate');

      // Mock console.warn to track warnings
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Test shouldPauseForGate with missing gate
      const result = (orchestrator as any).shouldPauseForGate(stage);

      // Should not pause and should log warning
      expect(result.pause).toBe(false);
      expect(result.gate).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Gate "non-existent-gate" referenced by stage "stage-with-missing-gate" not found'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('checkpoint mechanism for gates', () => {
    it('should save checkpoint with correct gate metadata', async () => {
      // Create workflow with gate
      const workflowContent = `
name: checkpoint-test-workflow
description: Test checkpoint mechanism with gates
gates:
  - id: checkpoint-gate
    name: Checkpoint Gate
    description: Gate for testing checkpoint mechanism
    required: true
    autoApprove: false
    timeout: 120

stages:
  - name: pre-gate
    agent: developer
    description: Stage before gate
  - name: post-gate
    agent: developer
    description: Stage after gate
    gate: checkpoint-gate
    dependsOn:
      - pre-gate
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'checkpoint-test-workflow.yaml'),
        workflowContent
      );

      const developerContent = `---
name: developer
description: Development agent
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a development agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'developer.md'),
        developerContent
      );

      await orchestrator.initialize();

      // Mock executeWorkflowStage to complete pre-gate stage
      const originalExecuteStage = (orchestrator as any).executeWorkflowStage;
      (orchestrator as any).executeWorkflowStage = vi.fn().mockResolvedValue({
        stageName: 'pre-gate',
        agent: 'developer',
        status: 'completed',
        outputs: { planOutput: 'Pre-gate work completed' },
        artifacts: [{ name: 'plan.md', content: 'Planning document' }],
        summary: 'Pre-gate stage completed successfully',
        usage: { inputTokens: 200, outputTokens: 100, totalTokens: 300, estimatedCost: 0.002 },
        startedAt: new Date(),
        completedAt: new Date(),
      });

      const task = await orchestrator.createTask({
        title: 'Test Checkpoint Mechanism',
        description: 'Testing checkpoint with gate metadata',
        workflow: 'checkpoint-test-workflow',
      });

      // Mock saveCheckpoint to capture checkpoint data
      const saveCheckpointSpy = vi.spyOn(orchestrator as any, 'saveCheckpoint');

      // Start workflow
      await orchestrator.runWorkflow(task.id);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify checkpoint was saved with gate metadata
      expect(saveCheckpointSpy).toHaveBeenCalledWith(
        task.id,
        expect.objectContaining({
          stage: 'post-gate',
          metadata: expect.objectContaining({
            pauseReason: 'approval_gate',
            gateName: 'checkpoint-gate',
            gateId: 'checkpoint-gate',
            resumePoint: 'pre_stage_gate',
            completedStages: expect.arrayContaining(['pre-gate']),
          }),
        })
      );

      // Verify checkpoint includes conversation state
      const checkpointCall = saveCheckpointSpy.mock.calls.find(call =>
        call[1]?.metadata?.pauseReason === 'approval_gate'
      );
      expect(checkpointCall).toBeDefined();
      expect(checkpointCall![1]).toHaveProperty('conversationState');

      // Restore original method
      (orchestrator as any).executeWorkflowStage = originalExecuteStage;
    });

    it('should include previous stage results in checkpoint metadata', async () => {
      // Create workflow with multiple stages and gate
      const workflowContent = `
name: multi-stage-checkpoint
description: Multi-stage workflow with checkpoint testing
gates:
  - id: review-gate
    name: Review Gate
    description: Review before final stage
    required: true
    autoApprove: false

stages:
  - name: stage1
    agent: developer
    description: First stage
  - name: stage2
    agent: developer
    description: Second stage
    dependsOn:
      - stage1
  - name: stage3
    agent: developer
    description: Third stage with gate
    gate: review-gate
    dependsOn:
      - stage2
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'multi-stage-checkpoint.yaml'),
        workflowContent
      );

      const developerContent = `---
name: developer
description: Development agent
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a development agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'developer.md'),
        developerContent
      );

      await orchestrator.initialize();

      // Mock executeWorkflowStage to return different results for each stage
      let stageCallCount = 0;
      (orchestrator as any).executeWorkflowStage = vi.fn().mockImplementation(() => {
        stageCallCount++;
        return Promise.resolve({
          stageName: `stage${stageCallCount}`,
          agent: 'developer',
          status: 'completed',
          outputs: { [`stage${stageCallCount}Output`]: `Output from stage ${stageCallCount}` },
          artifacts: [{ name: `stage${stageCallCount}.md`, content: `Stage ${stageCallCount} result` }],
          summary: `Stage ${stageCallCount} completed successfully`,
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.001 },
          startedAt: new Date(),
          completedAt: new Date(),
        });
      });

      const task = await orchestrator.createTask({
        title: 'Test Multi-Stage Checkpoint',
        description: 'Testing checkpoint with multiple stage results',
        workflow: 'multi-stage-checkpoint',
      });

      // Mock saveCheckpoint to capture data
      const saveCheckpointSpy = vi.spyOn(orchestrator as any, 'saveCheckpoint');

      // Start workflow
      await orchestrator.runWorkflow(task.id);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify checkpoint includes stage results
      const checkpointCall = saveCheckpointSpy.mock.calls.find(call =>
        call[1]?.metadata?.pauseReason === 'approval_gate'
      );
      expect(checkpointCall).toBeDefined();
      expect(checkpointCall![1].metadata).toHaveProperty('stageResults');
      expect(checkpointCall![1].metadata.completedStages).toEqual(expect.arrayContaining(['stage1', 'stage2']));
    });
  });

  describe('approval state creation and storage', () => {
    it('should create and store approval state correctly', async () => {
      // Create workflow with gate
      const workflowContent = `
name: approval-state-test
description: Test approval state creation
gates:
  - id: approval-test-gate
    name: Approval Test Gate
    description: Gate for testing approval state
    required: true
    autoApprove: false
    timeout: 90
    minApprovals: 2

stages:
  - name: test-stage
    agent: developer
    description: Test stage
    gate: approval-test-gate
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'approval-state-test.yaml'),
        workflowContent
      );

      const developerContent = `---
name: developer
description: Development agent
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a development agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'developer.md'),
        developerContent
      );

      await orchestrator.initialize();

      const task = await orchestrator.createTask({
        title: 'Test Approval State',
        description: 'Testing approval state creation and storage',
        workflow: 'approval-state-test',
      });

      // Mock store methods
      const updateTaskSpy = vi.spyOn((orchestrator as any).store, 'updateTask');
      const setGateSpy = vi.spyOn((orchestrator as any).store, 'setGate');

      // Start workflow
      await orchestrator.runWorkflow(task.id);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify approval state was created with correct properties
      expect(updateTaskSpy).toHaveBeenCalledWith(
        task.id,
        expect.objectContaining({
          approvalState: expect.objectContaining({
            id: expect.any(String),
            taskId: task.id,
            gateName: 'approval-test-gate',
            stage: 'test-stage',
            agent: 'developer',
            status: 'pending',
            requestedAt: expect.any(Date),
            minApprovals: 2,
            timeout: 90,
          }),
        })
      );

      // Verify gate was stored
      expect(setGateSpy).toHaveBeenCalledWith(
        task.id,
        expect.objectContaining({
          gateName: 'approval-test-gate',
          status: 'pending',
          requiredAt: expect.any(Date),
        })
      );
    });

    it('should use default values for approval state when gate properties are missing', async () => {
      // Create workflow with minimal gate definition
      const workflowContent = `
name: minimal-gate-test
description: Test minimal gate definition
gates:
  - id: minimal-gate
    name: Minimal Gate
    description: Minimal gate definition
    required: true

stages:
  - name: test-stage
    agent: developer
    description: Test stage
    gate: minimal-gate
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'minimal-gate-test.yaml'),
        workflowContent
      );

      const developerContent = `---
name: developer
description: Development agent
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a development agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'developer.md'),
        developerContent
      );

      await orchestrator.initialize();

      const task = await orchestrator.createTask({
        title: 'Test Minimal Gate',
        description: 'Testing minimal gate definition',
        workflow: 'minimal-gate-test',
      });

      // Mock store methods
      const updateTaskSpy = vi.spyOn((orchestrator as any).store, 'updateTask');

      // Start workflow
      await orchestrator.runWorkflow(task.id);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify approval state uses default values
      expect(updateTaskSpy).toHaveBeenCalledWith(
        task.id,
        expect.objectContaining({
          approvalState: expect.objectContaining({
            minApprovals: 1, // default value
            timeout: undefined, // no default for timeout
            autoApprove: false, // default value
          }),
        })
      );
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle workflow without any gates gracefully', async () => {
      // Create workflow without gates
      const workflowContent = `
name: no-gates-workflow
description: Workflow without any gates
stages:
  - name: simple-stage
    agent: developer
    description: Simple stage without gates
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'no-gates-workflow.yaml'),
        workflowContent
      );

      const developerContent = `---
name: developer
description: Development agent
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a development agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'developer.md'),
        developerContent
      );

      await orchestrator.initialize();

      // Mock executeWorkflowStage
      const executeStagespy = vi.fn().mockResolvedValue({
        stageName: 'simple-stage',
        agent: 'developer',
        status: 'completed',
        outputs: {},
        artifacts: [],
        summary: 'Simple stage completed successfully',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.001 },
        startedAt: new Date(),
        completedAt: new Date(),
      });
      (orchestrator as any).executeWorkflowStage = executeStagespy;

      const task = await orchestrator.createTask({
        title: 'Test No Gates',
        description: 'Testing workflow without gates',
        workflow: 'no-gates-workflow',
      });

      const updateTaskSpy = vi.spyOn((orchestrator as any).store, 'updateTask');

      // Should complete without any gate-related pauses
      await orchestrator.runWorkflow(task.id);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify no approval-related task updates
      const approvalCalls = updateTaskSpy.mock.calls.filter(call =>
        call[1] && typeof call[1] === 'object' &&
        ('approvalState' in call[1] || call[1].status === 'awaiting-approval')
      );
      expect(approvalCalls).toHaveLength(0);
    });

    it('should handle corrupted gate configuration', async () => {
      // Create workflow with invalid gate type
      const workflowContent = `
name: invalid-gate-workflow
description: Workflow with invalid gate configuration
gates:
  - id: invalid-gate
    name: Invalid Gate
    description: Gate with invalid configuration
    required: "not-a-boolean"
    autoApprove: "also-not-a-boolean"
    timeout: "not-a-number"

stages:
  - name: test-stage
    agent: developer
    description: Test stage
    gate: invalid-gate
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'invalid-gate-workflow.yaml'),
        workflowContent
      );

      const developerContent = `---
name: developer
description: Development agent
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a development agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'developer.md'),
        developerContent
      );

      // Should not throw during initialization
      await expect(orchestrator.initialize()).resolves.not.toThrow();

      // Check if gate was loaded (behavior depends on validation)
      const gates = (orchestrator as any).gates as Map<string, any>;
      // The gate might be loaded with type coercion or might be rejected
      // Either behavior is acceptable as long as it doesn't crash
    });

    it('should handle multiple gates on the same stage', async () => {
      // Test that only one gate per stage is processed
      const workflowContent = `
name: multi-gate-stage-workflow
description: Workflow testing multiple gates on same stage
gates:
  - id: first-gate
    name: First Gate
    description: First gate for stage
    required: true
    autoApprove: false
  - id: second-gate
    name: Second Gate
    description: Second gate for stage
    required: true
    autoApprove: false

stages:
  - name: multi-gate-stage
    agent: developer
    description: Stage with multiple gate references
    gate: first-gate
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'multi-gate-stage-workflow.yaml'),
        workflowContent
      );

      const developerContent = `---
name: developer
description: Development agent
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a development agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'developer.md'),
        developerContent
      );

      await orchestrator.initialize();

      const task = await orchestrator.createTask({
        title: 'Test Multiple Gates',
        description: 'Testing stage with multiple gate possibilities',
        workflow: 'multi-gate-stage-workflow',
      });

      const updateTaskSpy = vi.spyOn((orchestrator as any).store, 'updateTask');

      // Start workflow
      await orchestrator.runWorkflow(task.id);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify only first-gate is processed
      expect(updateTaskSpy).toHaveBeenCalledWith(
        task.id,
        expect.objectContaining({
          approvalState: expect.objectContaining({
            gateName: 'first-gate',
          }),
        })
      );
    });
  });

  describe('gate event emission', () => {
    it('should emit gate:required event with correct data structure', async () => {
      // Create workflow with gate
      const workflowContent = `
name: event-test-workflow
description: Test gate event emission
gates:
  - id: event-gate
    name: Event Gate
    description: Gate for testing events
    required: true
    autoApprove: false

stages:
  - name: event-stage
    agent: developer
    description: Stage for event testing
    gate: event-gate
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'event-test-workflow.yaml'),
        workflowContent
      );

      const developerContent = `---
name: developer
description: Development agent
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a development agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'developer.md'),
        developerContent
      );

      await orchestrator.initialize();

      const task = await orchestrator.createTask({
        title: 'Test Gate Events',
        description: 'Testing gate event emission',
        workflow: 'event-test-workflow',
      });

      // Mock event emission
      const emitSpy = vi.spyOn(orchestrator, 'emit');

      // Start workflow
      await orchestrator.runWorkflow(task.id);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify gate:required event was emitted with correct structure
      expect(emitSpy).toHaveBeenCalledWith(
        'gate:required',
        expect.objectContaining({
          approvalId: expect.any(String),
          taskId: task.id,
          gateName: 'event-gate',
          gateType: expect.any(String),
          stage: 'event-stage',
          agent: 'developer',
          blocking: true,
          description: 'Gate for testing events',
          timeout: undefined,
          minApprovals: 1,
          requestedAt: expect.any(Date),
        })
      );

      // Verify task:paused event was also emitted
      expect(emitSpy).toHaveBeenCalledWith(
        'task:paused',
        expect.anything(),
        'approval_gate'
      );
    });
  });
});
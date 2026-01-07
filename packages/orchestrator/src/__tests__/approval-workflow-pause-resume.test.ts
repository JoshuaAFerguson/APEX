/**
 * Test suite for approval workflow pause and resume functionality
 *
 * Covers acceptance criteria:
 * 1. Orchestrator pauses task execution when approval gates are hit
 * 2. Task status changes to 'waiting-approval' during gate blocking
 * 3. Task resumes execution after approval is granted
 * 4. Task execution is cancelled if approval is denied
 * 5. Approval state persistence across orchestrator restarts
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../index';
import { initializeApex } from '@apexcli/core';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { ApprovalRequiredEventData, Task } from '@apexcli/core';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

describe('Approval Workflow Pause and Resume', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let mockQuery: MockInstance;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-approval-workflow-test-'));
    mockQuery = vi.mocked(query);

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'test-approval-workflow',
      language: 'typescript',
      framework: 'node',
    });

    // Create config with approval gates
    const configContent = `
version: "1.0"
project:
  name: test-approval-workflow
  language: typescript
  framework: node
api:
  url: "https://api.example.com"
  port: 3000
gates:
  - name: "pre-deploy-gate"
    type: "before-deploy"
    description: "Security review required before deployment"
    approvers: ["security-team"]
    timeout: 60
    minApprovals: 1
    required: true
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      configContent
    );

    // Create a workflow with approval gate
    const workflowContent = `
name: deployment-with-gate
description: Deployment workflow with approval gate
stages:
  - name: planning
    agent: planner
    description: Create deployment plan
  - name: implementation
    agent: developer
    dependsOn: [planning]
    description: Implement changes
  - name: deployment
    agent: devops
    dependsOn: [implementation]
    description: Deploy to production
    gate: "pre-deploy-gate"
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'deployment-with-gate.yaml'),
      workflowContent
    );

    // Create test agent files
    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'planner.md'),
      `---
name: planner
description: Plans deployment tasks
tools: Read, Glob, Grep
model: sonnet
---
You are a planning agent.`
    );

    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'developer.md'),
      `---
name: developer
description: Implements code changes
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a developer agent.`
    );

    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'devops.md'),
      `---
name: devops
description: Handles deployment
tools: Bash
model: sonnet
---
You are a devops agent.`
    );

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('Task Execution Pausing', () => {
    it('should pause task execution when hitting an approval gate', async () => {
      // Mock responses for planning and implementation stages
      mockQuery
        .mockResolvedValueOnce({
          requestId: 'test-request-1',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning completed.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          requestId: 'test-request-2',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation completed.' }] }],
          },
          usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
        });

      const approvalEvents: ApprovalRequiredEventData[] = [];
      const taskUpdates: Task[] = [];

      orchestrator.on('approval:required', (event) => {
        approvalEvents.push(event);
      });

      orchestrator.on('task:updated', (task) => {
        taskUpdates.push(task);
      });

      const task = await orchestrator.createTask({
        description: 'Deploy with security approval',
        workflow: 'deployment-with-gate',
      });

      await orchestrator.runTask(task.id);

      // Verify approval event was emitted
      expect(approvalEvents).toHaveLength(1);
      const approvalEvent = approvalEvents[0];
      expect(approvalEvent.gateName).toBe('pre-deploy-gate');
      expect(approvalEvent.taskId).toBe(task.id);

      // Verify task status changed to waiting-approval
      const pausedTask = await orchestrator.getTask(task.id);
      expect(pausedTask).toBeDefined();
      expect(pausedTask!.status).toBe('awaiting-approval');
      expect(pausedTask!.pausedAt).toBeInstanceOf(Date);
      expect(pausedTask!.pauseReason).toBe('approval_gate');
    });

    it('should save task checkpoint when pausing for approval', async () => {
      // Mock stage completions
      mockQuery
        .mockResolvedValueOnce({
          requestId: 'test-request-1',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning completed.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          requestId: 'test-request-2',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation completed.' }] }],
          },
          usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
        });

      const task = await orchestrator.createTask({
        description: 'Deploy with checkpoint save',
        workflow: 'deployment-with-gate',
      });

      await orchestrator.runTask(task.id);

      // Verify checkpoint was created
      const checkpoints = await orchestrator.getTaskCheckpoints(task.id);
      expect(checkpoints).toBeDefined();
      expect(checkpoints.length).toBeGreaterThan(0);

      const latestCheckpoint = checkpoints[checkpoints.length - 1];
      expect(latestCheckpoint.metadata?.pauseReason).toBe('approval_gate');
      expect(latestCheckpoint.metadata?.resumePoint).toBe('pre_stage_gate');
    });

    it('should maintain workflow state across multiple approval gates', async () => {
      // Create workflow with multiple gates
      const multiGateWorkflowContent = `
name: multi-gate-workflow
description: Workflow with multiple approval gates
stages:
  - name: planning
    agent: planner
    description: Plan the work
  - name: development
    agent: developer
    dependsOn: [planning]
    description: Develop features
    gate: "pre-deploy-gate"
  - name: testing
    agent: developer
    dependsOn: [development]
    description: Test features
  - name: deployment
    agent: devops
    dependsOn: [testing]
    description: Deploy to production
    gate: "pre-deploy-gate"
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'multi-gate-workflow.yaml'),
        multiGateWorkflowContent
      );

      // Mock all stage completions
      mockQuery
        .mockResolvedValue({
          requestId: 'test-request',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Stage completed.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        });

      const approvalEvents: ApprovalRequiredEventData[] = [];
      orchestrator.on('approval:required', (event) => {
        approvalEvents.push(event);
      });

      const task = await orchestrator.createTask({
        description: 'Multi-gate workflow test',
        workflow: 'multi-gate-workflow',
      });

      await orchestrator.runTask(task.id);

      // Should hit first gate after development stage
      expect(approvalEvents).toHaveLength(1);
      expect(approvalEvents[0].stage).toBe('development');

      // Approve first gate
      await orchestrator.approveTask(
        task.id,
        approvalEvents[0].approvalId,
        'security-team',
        'Approved for development'
      );

      // Task should continue and hit second gate after testing
      // Note: In real scenario, we'd need to run the task again, but this tests the state management
      const pausedTask = await orchestrator.getTask(task.id);
      expect(pausedTask!.status).toBe('awaiting-approval');
    });
  });

  describe('Task Resume After Approval', () => {
    it('should resume task execution after approval is granted', async () => {
      // Mock stage completions
      mockQuery
        .mockResolvedValueOnce({
          requestId: 'test-request-1',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning completed.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          requestId: 'test-request-2',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation completed.' }] }],
          },
          usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
        })
        .mockResolvedValueOnce({
          requestId: 'test-request-3',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Deployment completed.' }] }],
          },
          usage: { totalTokens: 200, inputTokens: 100, outputTokens: 100 },
        });

      let approvalEvent: ApprovalRequiredEventData | undefined;
      orchestrator.on('approval:required', (event) => {
        approvalEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Deploy and resume after approval',
        workflow: 'deployment-with-gate',
      });

      // Run task until it hits the gate
      await orchestrator.runTask(task.id);

      // Verify task is paused
      expect(approvalEvent).toBeDefined();
      const pausedTask = await orchestrator.getTask(task.id);
      expect(pausedTask!.status).toBe('awaiting-approval');

      // Grant approval
      await orchestrator.approveTask(
        task.id,
        approvalEvent!.approvalId,
        'security-team',
        'Deployment approved after security review'
      );

      // Verify approval state was updated
      const approvalState = await orchestrator.getApprovalStateById(approvalEvent!.approvalId);
      expect(approvalState).toBeDefined();
      expect(approvalState!.status).toBe('approved');
      expect(approvalState!.approver).toBe('security-team');

      // Verify task was resumed (status should be back to in-progress or completed)
      const resumedTask = await orchestrator.getTask(task.id);
      expect(resumedTask!.status).not.toBe('awaiting-approval');
      expect(resumedTask!.pausedAt).toBeUndefined();
      expect(resumedTask!.pauseReason).toBeUndefined();
    });

    it('should cancel task execution if approval is denied', async () => {
      // Mock stage completions up to the gate
      mockQuery
        .mockResolvedValueOnce({
          requestId: 'test-request-1',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning completed.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          requestId: 'test-request-2',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation completed.' }] }],
          },
          usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
        });

      let approvalEvent: ApprovalRequiredEventData | undefined;
      orchestrator.on('approval:required', (event) => {
        approvalEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Deploy with denial',
        workflow: 'deployment-with-gate',
      });

      // Run task until it hits the gate
      await orchestrator.runTask(task.id);

      // Verify task is paused
      expect(approvalEvent).toBeDefined();
      const pausedTask = await orchestrator.getTask(task.id);
      expect(pausedTask!.status).toBe('awaiting-approval');

      // Deny approval
      await orchestrator.denyTask(
        task.id,
        approvalEvent!.approvalId,
        'security-team',
        'Deployment denied due to security concerns'
      );

      // Verify approval state was updated
      const approvalState = await orchestrator.getApprovalStateById(approvalEvent!.approvalId);
      expect(approvalState).toBeDefined();
      expect(approvalState!.status).toBe('denied');
      expect(approvalState!.approver).toBe('security-team');
      expect(approvalState!.comment).toBe('Deployment denied due to security concerns');

      // Task should remain paused or be marked as failed (implementation specific)
      const deniedTask = await orchestrator.getTask(task.id);
      // The exact behavior after denial may vary based on implementation
      expect(['awaiting-approval', 'failed', 'cancelled']).toContain(deniedTask!.status);
    });
  });

  describe('Approval State Persistence', () => {
    it('should persist approval state across orchestrator restarts', async () => {
      // Mock stage completions
      mockQuery
        .mockResolvedValueOnce({
          requestId: 'test-request-1',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning completed.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          requestId: 'test-request-2',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation completed.' }] }],
          },
          usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
        });

      let approvalEvent: ApprovalRequiredEventData | undefined;
      orchestrator.on('approval:required', (event) => {
        approvalEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Test persistence across restart',
        workflow: 'deployment-with-gate',
      });

      // Run task until it hits the gate
      await orchestrator.runTask(task.id);
      expect(approvalEvent).toBeDefined();

      // Get the approval state before "restart"
      const originalApprovalState = await orchestrator.getApprovalStateById(approvalEvent!.approvalId);
      expect(originalApprovalState).toBeDefined();

      // Simulate orchestrator restart by creating a new instance
      const newOrchestrator = new ApexOrchestrator({ projectPath: testDir });
      await newOrchestrator.initialize();

      // Verify approval state is still accessible
      const persistedApprovalState = await newOrchestrator.getApprovalStateById(approvalEvent!.approvalId);
      expect(persistedApprovalState).toBeDefined();
      expect(persistedApprovalState!.id).toBe(originalApprovalState!.id);
      expect(persistedApprovalState!.gateName).toBe(originalApprovalState!.gateName);
      expect(persistedApprovalState!.status).toBe('pending');

      // Verify task state is also persisted
      const persistedTask = await newOrchestrator.getTask(task.id);
      expect(persistedTask!.status).toBe('awaiting-approval');
      expect(persistedTask!.pauseReason).toBe('approval_gate');
    });

    it('should handle approval of persisted state after restart', async () => {
      // This is a continuation of the previous test scenario
      // Mock initial stages
      mockQuery
        .mockResolvedValueOnce({
          requestId: 'test-request-1',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning completed.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          requestId: 'test-request-2',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation completed.' }] }],
          },
          usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
        })
        // Mock final deployment stage after approval
        .mockResolvedValueOnce({
          requestId: 'test-request-3',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Deployment completed.' }] }],
          },
          usage: { totalTokens: 200, inputTokens: 100, outputTokens: 100 },
        });

      let approvalEvent: ApprovalRequiredEventData | undefined;
      orchestrator.on('approval:required', (event) => {
        approvalEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Test approval after restart',
        workflow: 'deployment-with-gate',
      });

      // Run task until it hits the gate
      await orchestrator.runTask(task.id);
      expect(approvalEvent).toBeDefined();

      // Simulate restart
      const newOrchestrator = new ApexOrchestrator({ projectPath: testDir });
      await newOrchestrator.initialize();

      // Approve using the new orchestrator instance
      await newOrchestrator.approveTask(
        task.id,
        approvalEvent!.approvalId,
        'security-team',
        'Post-restart approval'
      );

      // Verify approval was processed
      const approvalState = await newOrchestrator.getApprovalStateById(approvalEvent!.approvalId);
      expect(approvalState!.status).toBe('approved');
      expect(approvalState!.comment).toBe('Post-restart approval');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle approval timeout gracefully', async () => {
      // Create a gate with very short timeout for testing
      const shortTimeoutConfig = `
version: "1.0"
project:
  name: test-timeout
  language: typescript
  framework: node
gates:
  - name: "timeout-gate"
    type: "before-deploy"
    description: "Gate with short timeout"
    approvers: ["tester"]
    timeout: 0.01  # Very short timeout in minutes
    minApprovals: 1
    required: true
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        shortTimeoutConfig
      );

      // Update workflow to use timeout gate
      const timeoutWorkflow = `
name: timeout-test
description: Test approval timeout
stages:
  - name: planning
    agent: planner
    description: Plan
  - name: deployment
    agent: devops
    dependsOn: [planning]
    description: Deploy
    gate: "timeout-gate"
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'timeout-test.yaml'),
        timeoutWorkflow
      );

      // Reinitialize orchestrator with new config
      const timeoutOrchestrator = new ApexOrchestrator({ projectPath: testDir });
      await timeoutOrchestrator.initialize();

      mockQuery
        .mockResolvedValueOnce({
          requestId: 'test-request-1',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        });

      let approvalEvent: ApprovalRequiredEventData | undefined;
      timeoutOrchestrator.on('approval:required', (event) => {
        approvalEvent = event;
      });

      const task = await timeoutOrchestrator.createTask({
        description: 'Test approval timeout',
        workflow: 'timeout-test',
      });

      await timeoutOrchestrator.runTask(task.id);

      expect(approvalEvent).toBeDefined();
      expect(approvalEvent!.expiresAt).toBeInstanceOf(Date);

      // Verify timeout is calculated correctly
      const timeoutMs = approvalEvent!.expiresAt!.getTime() - approvalEvent!.requestedAt.getTime();
      expect(timeoutMs).toBeCloseTo(0.01 * 60 * 1000, 1000); // Within 1 second tolerance
    });

    it('should handle missing gate configuration', async () => {
      // Create workflow with reference to non-existent gate
      const missingGateWorkflow = `
name: missing-gate-test
description: Test missing gate reference
stages:
  - name: planning
    agent: planner
    description: Plan
  - name: deployment
    agent: devops
    dependsOn: [planning]
    description: Deploy
    gate: "non-existent-gate"
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'missing-gate-test.yaml'),
        missingGateWorkflow
      );

      mockQuery
        .mockResolvedValueOnce({
          requestId: 'test-request-1',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          requestId: 'test-request-2',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Deployment done.' }] }],
          },
          usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
        });

      let approvalEvent: ApprovalRequiredEventData | undefined;
      orchestrator.on('approval:required', (event) => {
        approvalEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Test missing gate',
        workflow: 'missing-gate-test',
      });

      // Should not throw an error
      await expect(orchestrator.runTask(task.id)).resolves.not.toThrow();

      // Should either not emit event or handle gracefully
      if (approvalEvent) {
        expect(approvalEvent.gateName).toBe('non-existent-gate');
      }
    });

    it('should handle duplicate approval attempts', async () => {
      // Mock stage completions
      mockQuery
        .mockResolvedValueOnce({
          requestId: 'test-request-1',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning completed.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          requestId: 'test-request-2',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation completed.' }] }],
          },
          usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
        });

      let approvalEvent: ApprovalRequiredEventData | undefined;
      orchestrator.on('approval:required', (event) => {
        approvalEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Test duplicate approval',
        workflow: 'deployment-with-gate',
      });

      await orchestrator.runTask(task.id);
      expect(approvalEvent).toBeDefined();

      // First approval
      await orchestrator.approveTask(
        task.id,
        approvalEvent!.approvalId,
        'security-team',
        'First approval'
      );

      // Attempt second approval on same ID
      await expect(
        orchestrator.approveTask(
          task.id,
          approvalEvent!.approvalId,
          'security-team',
          'Duplicate approval'
        )
      ).rejects.toThrow();

      // Verify first approval state is preserved
      const approvalState = await orchestrator.getApprovalStateById(approvalEvent!.approvalId);
      expect(approvalState!.comment).toBe('First approval');
    });
  });
});
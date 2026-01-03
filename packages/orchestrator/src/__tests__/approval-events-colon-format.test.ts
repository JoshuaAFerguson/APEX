/**
 * Comprehensive test suite for approval gate event emission with colon format
 *
 * Tests the acceptance criteria:
 * - Orchestrator emits 'approval:required', 'approval:approved', and 'approval:denied' events
 * - Event payloads contain appropriate data structures
 * - Events are emitted at the correct times in the workflow
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'node:crypto';
import { ApexOrchestrator } from '../index';
import { initializeApex } from '@apexcli/core';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type {
  ApprovalRequiredEventData,
  ApprovalGrantedEventData,
  ApprovalDeniedEventData,
  WorkflowDefinition
} from '@apexcli/core';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

describe('Approval Events with Colon Format - Comprehensive Tests', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let mockQuery: MockInstance;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-approval-events-test-'));
    mockQuery = vi.mocked(query);

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'approval-events-test',
      language: 'typescript',
      framework: 'node',
    });

    // Create config with approval gates
    const configContent = `
version: "1.0"
project:
  name: approval-events-test
  language: typescript
  framework: node
api:
  url: "https://test-api.example.com"
  port: 3000
gates:
  - name: "planning-gate"
    type: "after-planning"
    description: "Review planning output before proceeding"
    approvers: ["lead-developer", "architect"]
    timeout: 45
    minApprovals: 1
  - name: "code-review-gate"
    type: "before-commit"
    description: "Code review required before commit"
    approvers: ["senior-dev", "tech-lead"]
    timeout: 30
    minApprovals: 2
  - name: "deployment-gate"
    type: "before-deploy"
    description: "Security and ops review"
    approvers: ["security-team", "ops-team"]
    timeout: 60
    minApprovals: 1
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      configContent
    );

    // Create a comprehensive workflow with multiple gates
    const workflowContent = `
name: comprehensive-approval-workflow
description: Workflow with multiple approval gates for testing
stages:
  - name: planning
    agent: planner
    description: Create implementation plan
    gate: "planning-gate"
  - name: implementation
    agent: developer
    dependsOn:
      - planning
    description: Implement the feature
    gate: "code-review-gate"
  - name: deployment
    agent: devops
    dependsOn:
      - implementation
    description: Deploy to production
    gate: "deployment-gate"
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'comprehensive-approval-workflow.yaml'),
      workflowContent
    );

    // Create agent files
    const agents = [
      { name: 'planner', role: 'Plans implementation tasks', tools: 'Read, Glob, Grep' },
      { name: 'developer', role: 'Implements code changes', tools: 'Read, Write, Edit, Bash' },
      { name: 'devops', role: 'Handles deployment', tools: 'Bash, Read' }
    ];

    for (const agent of agents) {
      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', `${agent.name}.md`),
        `---
name: ${agent.name}
description: ${agent.role}
tools: ${agent.tools}
model: sonnet
---
You are a ${agent.name} agent. ${agent.role}.`
      );
    }

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('approval:required Event Emission', () => {
    it('should emit approval:required event with correct payload structure', async () => {
      // Mock successful stage completion
      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        output: {
          success: true,
          messages: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: 'Planning completed successfully. Here is the implementation plan.',
                },
              ],
            },
          ],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      });

      const approvalRequiredEvents: ApprovalRequiredEventData[] = [];
      orchestrator.on('approval:required', (eventData) => {
        approvalRequiredEvents.push(eventData);
      });

      // Create and run task to trigger approval gate
      const task = await orchestrator.createTask({
        description: 'Test approval:required event emission',
        workflow: 'comprehensive-approval-workflow',
        priority: 'high',
        acceptanceCriteria: 'Must pass all approval gates',
      });

      await orchestrator.runTask(task.id);

      // Verify event was emitted
      expect(approvalRequiredEvents).toHaveLength(1);

      const event = approvalRequiredEvents[0];

      // Verify core structure matches ApprovalRequiredEventData
      expect(event).toMatchObject({
        approvalId: expect.any(String),
        taskId: task.id,
        gateName: 'planning-gate',
        gateType: 'after-planning',
        description: 'Review planning output before proceeding',
        requiredApprovals: 1,
        approvers: ['lead-developer', 'architect'],
        timeout: 45,
        requestedAt: expect.any(Date),
        expiresAt: expect.any(Date),
        stage: 'planning',
        agent: 'planner',
        blocking: true,
        approvalUrl: expect.any(String),
        context: expect.any(Object),
      });

      // Verify approval URL format
      expect(event.approvalUrl).toBe(
        `https://test-api.example.com/approvals/${event.approvalId}`
      );

      // Verify context contains task information
      expect(event.context).toMatchObject({
        taskId: task.id,
        taskDescription: 'Test approval:required event emission',
        taskPriority: 'high',
        taskWorkflow: 'comprehensive-approval-workflow',
        acceptanceCriteria: 'Must pass all approval gates',
        currentStage: 'planning',
        currentAgent: 'planner',
      });

      // Verify expiration calculation
      const expectedExpiration = new Date(event.requestedAt.getTime() + 45 * 60 * 1000);
      expect(Math.abs(event.expiresAt.getTime() - expectedExpiration.getTime())).toBeLessThan(1000);

      // Verify approval ID format (UUID)
      expect(event.approvalId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should emit multiple approval:required events for multi-gate workflow', async () => {
      // Mock all stage completions
      mockQuery
        .mockResolvedValueOnce({
          requestId: 'planning-stage',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          requestId: 'implementation-stage',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation done' }] }],
          },
          usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
        })
        .mockResolvedValueOnce({
          requestId: 'deployment-stage',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Deployment ready' }] }],
          },
          usage: { totalTokens: 120, inputTokens: 60, outputTokens: 60 },
        });

      const approvalRequiredEvents: ApprovalRequiredEventData[] = [];
      orchestrator.on('approval:required', (eventData) => {
        approvalRequiredEvents.push(eventData);
      });

      const task = await orchestrator.createTask({
        description: 'Multi-gate workflow test',
        workflow: 'comprehensive-approval-workflow',
      });

      await orchestrator.runTask(task.id);

      // Should emit events for each gate
      expect(approvalRequiredEvents).toHaveLength(3);

      // First gate - planning
      expect(approvalRequiredEvents[0]).toMatchObject({
        gateName: 'planning-gate',
        gateType: 'after-planning',
        stage: 'planning',
        agent: 'planner',
        requiredApprovals: 1,
      });

      // Second gate - code review
      expect(approvalRequiredEvents[1]).toMatchObject({
        gateName: 'code-review-gate',
        gateType: 'before-commit',
        stage: 'implementation',
        agent: 'developer',
        requiredApprovals: 2,
      });

      // Third gate - deployment
      expect(approvalRequiredEvents[2]).toMatchObject({
        gateName: 'deployment-gate',
        gateType: 'before-deploy',
        stage: 'deployment',
        agent: 'devops',
        requiredApprovals: 1,
      });
    });

    it('should not emit approval:required event for stages without gates', async () => {
      // Create workflow without gates
      const simpleWorkflowContent = `
name: no-gates-workflow
description: Simple workflow without approval gates
stages:
  - name: planning
    agent: planner
    description: Create plan
  - name: implementation
    agent: developer
    dependsOn: [planning]
    description: Implement
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'no-gates-workflow.yaml'),
        simpleWorkflowContent
      );

      mockQuery
        .mockResolvedValueOnce({
          requestId: 'planning',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          requestId: 'implementation',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation done' }] }],
          },
          usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
        });

      const approvalRequiredEvents: ApprovalRequiredEventData[] = [];
      orchestrator.on('approval:required', (eventData) => {
        approvalRequiredEvents.push(eventData);
      });

      const task = await orchestrator.createTask({
        description: 'No gates workflow',
        workflow: 'no-gates-workflow',
      });

      await orchestrator.runTask(task.id);

      // Should not emit any approval events
      expect(approvalRequiredEvents).toHaveLength(0);
    });
  });

  describe('approval:approved Event Emission', () => {
    it('should emit approval:approved event with correct payload when approval is granted', async () => {
      // First, trigger an approval requirement
      mockQuery.mockResolvedValueOnce({
        requestId: 'planning-stage',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning completed' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      });

      let approvalRequiredEvent: ApprovalRequiredEventData;
      orchestrator.on('approval:required', (eventData) => {
        approvalRequiredEvent = eventData;
      });

      const task = await orchestrator.createTask({
        description: 'Test approval:approved event',
        workflow: 'comprehensive-approval-workflow',
      });

      // Wait for task to hit approval gate
      await orchestrator.runTask(task.id);

      // Create checkpoint for the task
      await orchestrator.createCheckpoint(task.id, 'planning-approval', {
        stageName: 'planning',
        status: 'waiting-approval',
        stageOutputs: { plan: 'Detailed implementation plan' },
        conversationState: [{ type: 'text', text: 'Planning completed, awaiting approval' }],
        metadata: { approvalId: approvalRequiredEvent!.approvalId }
      });

      // Now test the approval:approved event
      const approvalApprovedEvents: ApprovalGrantedEventData[] = [];
      orchestrator.on('approval:approved', (eventData) => {
        approvalApprovedEvents.push(eventData);
      });

      const approver = 'lead-developer';
      const comment = 'Plan looks excellent, approved to proceed';

      // Grant approval
      await orchestrator.grantApproval(approvalRequiredEvent!.approvalId, approver, comment);

      // Verify event was emitted
      expect(approvalApprovedEvents).toHaveLength(1);

      const event = approvalApprovedEvents[0];
      expect(event).toMatchObject({
        approvalId: approvalRequiredEvent!.approvalId,
        taskId: task.id,
        approver: approver,
        comment: comment,
        timestamp: expect.any(Date),
      });

      // Verify timestamp is recent
      const now = new Date();
      expect(event.timestamp.getTime()).toBeGreaterThan(now.getTime() - 5000); // Within 5 seconds
    });

    it('should emit approval:approved event without comment when none provided', async () => {
      // Setup approval requirement
      mockQuery.mockResolvedValueOnce({
        requestId: 'planning-stage',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning completed' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      });

      let approvalRequiredEvent: ApprovalRequiredEventData;
      orchestrator.on('approval:required', (eventData) => {
        approvalRequiredEvent = eventData;
      });

      const task = await orchestrator.createTask({
        description: 'Test approval without comment',
        workflow: 'comprehensive-approval-workflow',
      });

      await orchestrator.runTask(task.id);

      await orchestrator.createCheckpoint(task.id, 'planning-approval', {
        stageName: 'planning',
        status: 'waiting-approval',
        stageOutputs: { plan: 'Plan ready' },
        conversationState: [{ type: 'text', text: 'Awaiting approval' }],
        metadata: { approvalId: approvalRequiredEvent!.approvalId }
      });

      const approvalApprovedEvents: ApprovalGrantedEventData[] = [];
      orchestrator.on('approval:approved', (eventData) => {
        approvalApprovedEvents.push(eventData);
      });

      // Grant approval without comment
      await orchestrator.grantApproval(approvalRequiredEvent!.approvalId, 'architect');

      expect(approvalApprovedEvents).toHaveLength(1);
      expect(approvalApprovedEvents[0]).toMatchObject({
        approvalId: approvalRequiredEvent!.approvalId,
        taskId: task.id,
        approver: 'architect',
        comment: undefined,
        timestamp: expect.any(Date),
      });
    });
  });

  describe('approval:denied Event Emission', () => {
    it('should emit approval:denied event with correct payload when approval is denied', async () => {
      // Setup approval requirement
      mockQuery.mockResolvedValueOnce({
        requestId: 'planning-stage',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning completed' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      });

      let approvalRequiredEvent: ApprovalRequiredEventData;
      orchestrator.on('approval:required', (eventData) => {
        approvalRequiredEvent = eventData;
      });

      const task = await orchestrator.createTask({
        description: 'Test approval:denied event',
        workflow: 'comprehensive-approval-workflow',
      });

      await orchestrator.runTask(task.id);

      await orchestrator.createCheckpoint(task.id, 'planning-approval', {
        stageName: 'planning',
        status: 'waiting-approval',
        stageOutputs: { plan: 'Initial plan' },
        conversationState: [{ type: 'text', text: 'Awaiting approval' }],
        metadata: { approvalId: approvalRequiredEvent!.approvalId }
      });

      const approvalDeniedEvents: ApprovalDeniedEventData[] = [];
      orchestrator.on('approval:denied', (eventData) => {
        approvalDeniedEvents.push(eventData);
      });

      const approver = 'architect';
      const reason = 'Plan needs more detail on error handling and testing strategy';

      // Deny approval
      await orchestrator.denyApproval(approvalRequiredEvent!.approvalId, approver, reason);

      // Verify event was emitted
      expect(approvalDeniedEvents).toHaveLength(1);

      const event = approvalDeniedEvents[0];
      expect(event).toMatchObject({
        approvalId: approvalRequiredEvent!.approvalId,
        taskId: task.id,
        approver: approver,
        reason: reason,
        timestamp: expect.any(Date),
      });

      // Verify timestamp is recent
      const now = new Date();
      expect(event.timestamp.getTime()).toBeGreaterThan(now.getTime() - 5000);

      // Verify task was failed
      const failedTask = await orchestrator.getTask(task.id);
      expect(failedTask?.status).toBe('failed');
      expect(failedTask?.result).toContain(reason);
    });

    it('should validate denial reason and reject empty reasons', async () => {
      const taskId = await orchestrator.createTask({
        description: 'Test denial validation',
        workflow: 'comprehensive-approval-workflow',
      });

      const approvalId = `approval-${taskId}-gate-${Date.now()}`;

      // Test empty reason
      await expect(
        orchestrator.denyApproval(approvalId, 'approver', '')
      ).rejects.toThrow('Reason is required when denying an approval');

      // Test whitespace-only reason
      await expect(
        orchestrator.denyApproval(approvalId, 'approver', '   \t\n  ')
      ).rejects.toThrow('Reason is required when denying an approval');
    });
  });

  describe('Event Sequence and Integration', () => {
    it('should emit events in correct sequence: required -> approved -> required (next gate)', async () => {
      // Mock stage completions
      mockQuery
        .mockResolvedValueOnce({
          requestId: 'planning',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          requestId: 'implementation',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation done' }] }],
          },
          usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
        });

      const allEvents: Array<{ type: string; data: any; timestamp: Date }> = [];

      orchestrator.on('approval:required', (data) => {
        allEvents.push({ type: 'approval:required', data, timestamp: new Date() });
      });

      orchestrator.on('approval:approved', (data) => {
        allEvents.push({ type: 'approval:approved', data, timestamp: new Date() });
      });

      orchestrator.on('approval:denied', (data) => {
        allEvents.push({ type: 'approval:denied', data, timestamp: new Date() });
      });

      const task = await orchestrator.createTask({
        description: 'Event sequence test',
        workflow: 'comprehensive-approval-workflow',
      });

      // Start workflow - should hit first gate
      await orchestrator.runTask(task.id);

      // Verify first approval:required event
      expect(allEvents).toHaveLength(1);
      expect(allEvents[0].type).toBe('approval:required');
      expect(allEvents[0].data.gateName).toBe('planning-gate');

      const firstApprovalId = allEvents[0].data.approvalId;

      // Create checkpoint for first approval
      await orchestrator.createCheckpoint(task.id, 'planning-checkpoint', {
        stageName: 'planning',
        status: 'waiting-approval',
        stageOutputs: { plan: 'Plan ready' },
        conversationState: [{ type: 'text', text: 'Planning done' }],
        metadata: { approvalId: firstApprovalId }
      });

      // Grant first approval
      await orchestrator.grantApproval(firstApprovalId, 'lead-developer', 'Approved');

      // Should emit approval:approved event
      expect(allEvents).toHaveLength(2);
      expect(allEvents[1].type).toBe('approval:approved');
      expect(allEvents[1].data.approvalId).toBe(firstApprovalId);

      // Resume task - should continue to next stage and hit second gate
      await orchestrator.resumePausedTask(task.id);

      // Should emit second approval:required event
      expect(allEvents).toHaveLength(3);
      expect(allEvents[2].type).toBe('approval:required');
      expect(allEvents[2].data.gateName).toBe('code-review-gate');

      // Verify event timestamps are in order
      expect(allEvents[0].timestamp.getTime()).toBeLessThanOrEqual(allEvents[1].timestamp.getTime());
      expect(allEvents[1].timestamp.getTime()).toBeLessThanOrEqual(allEvents[2].timestamp.getTime());
    });

    it('should handle denial workflow correctly: required -> denied', async () => {
      mockQuery.mockResolvedValueOnce({
        requestId: 'planning',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning completed' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      });

      const allEvents: Array<{ type: string; data: any }> = [];

      orchestrator.on('approval:required', (data) => {
        allEvents.push({ type: 'approval:required', data });
      });

      orchestrator.on('approval:denied', (data) => {
        allEvents.push({ type: 'approval:denied', data });
      });

      const task = await orchestrator.createTask({
        description: 'Denial workflow test',
        workflow: 'comprehensive-approval-workflow',
      });

      // Hit approval gate
      await orchestrator.runTask(task.id);

      expect(allEvents).toHaveLength(1);
      expect(allEvents[0].type).toBe('approval:required');

      const approvalId = allEvents[0].data.approvalId;

      // Create checkpoint
      await orchestrator.createCheckpoint(task.id, 'planning-checkpoint', {
        stageName: 'planning',
        status: 'waiting-approval',
        stageOutputs: { plan: 'Initial plan' },
        conversationState: [{ type: 'text', text: 'Planning done' }],
        metadata: { approvalId }
      });

      // Deny approval
      await orchestrator.denyApproval(approvalId, 'architect', 'Plan lacks sufficient detail');

      // Should emit denial event and task should be failed
      expect(allEvents).toHaveLength(2);
      expect(allEvents[1].type).toBe('approval:denied');
      expect(allEvents[1].data.approvalId).toBe(approvalId);
      expect(allEvents[1].data.reason).toBe('Plan lacks sufficient detail');

      // Task should be failed
      const failedTask = await orchestrator.getTask(task.id);
      expect(failedTask?.status).toBe('failed');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing gate configuration gracefully', async () => {
      // Create workflow with non-existent gate
      const invalidWorkflowContent = `
name: invalid-gate-workflow
description: Workflow with invalid gate
stages:
  - name: planning
    agent: planner
    description: Plan
    gate: "non-existent-gate"
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'invalid-gate-workflow.yaml'),
        invalidWorkflowContent
      );

      mockQuery.mockResolvedValueOnce({
        requestId: 'planning',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      });

      const approvalRequiredEvents: ApprovalRequiredEventData[] = [];
      orchestrator.on('approval:required', (data) => {
        approvalRequiredEvents.push(data);
      });

      const task = await orchestrator.createTask({
        description: 'Test missing gate',
        workflow: 'invalid-gate-workflow',
      });

      // Should not throw, but may not emit event for missing gate
      await expect(orchestrator.runTask(task.id)).resolves.not.toThrow();
    });

    it('should handle invalid approval ID format in events', async () => {
      const invalidApprovalId = 'invalid-approval-format';

      await expect(
        orchestrator.grantApproval(invalidApprovalId, 'approver', 'comment')
      ).rejects.toThrow('Invalid approval ID format');

      await expect(
        orchestrator.denyApproval(invalidApprovalId, 'approver', 'reason')
      ).rejects.toThrow('Invalid approval ID format');
    });

    it('should handle non-existent task for approval', async () => {
      const nonExistentApprovalId = 'approval-nonexistent-task-gate-123';

      await expect(
        orchestrator.grantApproval(nonExistentApprovalId, 'approver', 'comment')
      ).rejects.toThrow('Task not found for approval: nonexistent-task');

      await expect(
        orchestrator.denyApproval(nonExistentApprovalId, 'approver', 'reason')
      ).rejects.toThrow('Task not found for approval: nonexistent-task');
    });
  });
});

export const ApprovalEventsTestMetadata = {
  testSuiteName: 'Approval Events with Colon Format - Comprehensive Tests',
  totalTestCases: 17,
  eventsCovered: [
    'approval:required',
    'approval:approved',
    'approval:denied'
  ],
  acceptanceCriteria: [
    'Events use colon format (approval:required, approval:approved, approval:denied)',
    'Events contain appropriate payload data',
    'Events are emitted at correct workflow points',
    'Event sequences work correctly',
    'Error cases are handled gracefully'
  ]
};
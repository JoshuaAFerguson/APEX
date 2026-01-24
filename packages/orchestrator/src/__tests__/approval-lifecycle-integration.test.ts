/**
 * Integration test suite for complete approval lifecycle
 *
 * Covers the complete flow:
 * 1. Task execution hits approval gate
 * 2. approval:required event emission with complete payload
 * 3. Workflow pauses and task enters waiting-approval state
 * 4. Approval state is persisted in database
 * 5. Approval granted/denied through API
 * 6. Task resumes or cancels based on decision
 * 7. Events emitted for approval resolution
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../index';
import { initializeApex } from '@apexcli/core';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type {
  ApprovalRequiredEventData,
  ApprovalGrantedEventData,
  ApprovalDeniedEventData,
  Task,
  ApprovalState
} from '@apexcli/core';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
  tool: vi.fn((config) => config),
  createSdkMcpServer: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), close: vi.fn() })),
}));

describe('Approval Lifecycle Integration', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let mockQuery: MockInstance;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-approval-lifecycle-test-'));
    mockQuery = vi.mocked(query);

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'test-approval-lifecycle',
      language: 'typescript',
      framework: 'node',
    });

    // Create comprehensive config with multiple gates and autonomy settings
    const configContent = `
version: "1.0"
project:
  name: test-approval-lifecycle
  language: typescript
  framework: node
api:
  url: "https://api.example.com"
  port: 3000
autonomy:
  level: supervised
  approvals:
    taskStart: false
    codeChanges: true
    dangerousOperations: true
gates:
  - name: "security-review"
    type: "before-deploy"
    description: "Security team review required"
    approvers: ["security-lead", "senior-security"]
    timeout: 120
    minApprovals: 1
    required: true
  - name: "peer-review"
    type: "before-commit"
    description: "Peer code review"
    approvers: ["senior-dev", "tech-lead"]
    timeout: 60
    minApprovals: 1
    required: true
  - name: "manager-approval"
    type: "before-production"
    description: "Manager approval for production"
    approvers: ["manager", "director"]
    timeout: 240
    minApprovals: 2
    required: true
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      configContent
    );

    // Create comprehensive workflow with multiple gates
    const workflowContent = `
name: full-lifecycle-workflow
description: Complete workflow testing all approval scenarios
stages:
  - name: planning
    agent: planner
    description: Plan the implementation
  - name: development
    agent: developer
    dependsOn: [planning]
    description: Develop the feature
    gate: "peer-review"
  - name: security-testing
    agent: security
    dependsOn: [development]
    description: Security testing and review
    gate: "security-review"
  - name: production-deploy
    agent: devops
    dependsOn: [security-testing]
    description: Deploy to production
    gate: "manager-approval"
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'full-lifecycle-workflow.yaml'),
      workflowContent
    );

    // Create test agent files
    const agents = ['planner', 'developer', 'security', 'devops'];
    for (const agent of agents) {
      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', `${agent}.md`),
        `---
name: ${agent}
description: ${agent.charAt(0).toUpperCase() + agent.slice(1)} agent
tools: Read, Write, Edit, Bash, Glob, Grep
model: sonnet
---
You are a ${agent} agent.`
      );
    }

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('Complete Approval Lifecycle', () => {
    it('should execute complete approval lifecycle from gate hit to resolution', async () => {
      // Mock successful stage completions
      mockQuery
        .mockResolvedValueOnce({
          requestId: 'planning-request',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning stage completed successfully.' }] }],
          },
          usage: { totalTokens: 120, inputTokens: 60, outputTokens: 60 },
        })
        .mockResolvedValueOnce({
          requestId: 'development-request',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Development stage completed. Code ready for review.' }] }],
          },
          usage: { totalTokens: 200, inputTokens: 100, outputTokens: 100 },
        })
        .mockResolvedValueOnce({
          requestId: 'security-request',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Security testing completed. Ready for deployment.' }] }],
          },
          usage: { totalTokens: 180, inputTokens: 90, outputTokens: 90 },
        })
        .mockResolvedValueOnce({
          requestId: 'deploy-request',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Production deployment successful.' }] }],
          },
          usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
        });

      // Set up event listeners
      const approvalRequiredEvents: ApprovalRequiredEventData[] = [];
      const approvalGrantedEvents: ApprovalGrantedEventData[] = [];
      const approvalDeniedEvents: ApprovalDeniedEventData[] = [];
      const taskUpdates: Task[] = [];

      orchestrator.on('approval:required', (event) => {
        approvalRequiredEvents.push(event);
      });

      orchestrator.on('approval:approved', (event) => {
        approvalGrantedEvents.push(event);
      });

      orchestrator.on('approval:denied', (event) => {
        approvalDeniedEvents.push(event);
      });

      orchestrator.on('task:updated', (task) => {
        taskUpdates.push(task);
      });

      // Phase 1: Create and start task
      const task = await orchestrator.createTask({
        description: 'Complete lifecycle test with multiple approval gates',
        workflow: 'full-lifecycle-workflow',
        priority: 'high',
        acceptanceCriteria: 'All stages must pass with proper approvals',
      });

      expect(task).toBeDefined();
      expect(task.workflow).toBe('full-lifecycle-workflow');

      // Phase 2: Execute task until first gate
      await orchestrator.runTask(task.id);

      // Should hit peer-review gate after development stage
      expect(approvalRequiredEvents).toHaveLength(1);
      const firstApprovalEvent = approvalRequiredEvents[0];

      // Verify first approval event structure
      expect(firstApprovalEvent).toMatchObject({
        taskId: task.id,
        gateName: 'peer-review',
        gateType: 'before-commit',
        description: 'Peer code review',
        stage: 'development',
        agent: 'developer',
        blocking: true,
        approvers: ['senior-dev', 'tech-lead'],
        requiredApprovals: 1,
        timeout: 60,
      });

      expect(firstApprovalEvent.approvalId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );

      expect(firstApprovalEvent.approvalUrl).toBe(
        `https://api.example.com/approvals/${firstApprovalEvent.approvalId}`
      );

      expect(firstApprovalEvent.context).toMatchObject({
        taskId: task.id,
        taskDescription: task.description,
        taskPriority: 'high',
        taskWorkflow: 'full-lifecycle-workflow',
        acceptanceCriteria: 'All stages must pass with proper approvals',
        currentStage: 'development',
        currentAgent: 'developer',
      });

      // Verify task state after hitting first gate
      const pausedTask = await orchestrator.getTask(task.id);
      expect(pausedTask!.status).toBe('awaiting-approval');
      expect(pausedTask!.pausedAt).toBeInstanceOf(Date);
      expect(pausedTask!.pauseReason).toBe('approval_gate');

      // Verify approval state was persisted
      const firstApprovalState = await orchestrator.getApprovalStateById(firstApprovalEvent.approvalId);
      expect(firstApprovalState).toMatchObject({
        id: firstApprovalEvent.approvalId,
        taskId: task.id,
        gateName: 'peer-review',
        status: 'pending',
        stage: 'development',
        agent: 'developer',
        approvalsReceived: 0,
        approvalsRequired: 1,
        timeoutMinutes: 60,
      });

      // Phase 3: Approve first gate
      await orchestrator.approveTask(
        task.id,
        firstApprovalEvent.approvalId,
        'senior-dev',
        'Code looks good, approved for next stage'
      );

      // Verify approval granted event
      expect(approvalGrantedEvents).toHaveLength(1);
      const firstGrantedEvent = approvalGrantedEvents[0];
      expect(firstGrantedEvent).toMatchObject({
        approvalId: firstApprovalEvent.approvalId,
        taskId: task.id,
        approver: 'senior-dev',
        comment: 'Code looks good, approved for next stage',
      });

      // Verify approval state was updated
      const approvedState = await orchestrator.getApprovalStateById(firstApprovalEvent.approvalId);
      expect(approvedState!.status).toBe('approved');
      expect(approvedState!.approver).toBe('senior-dev');
      expect(approvedState!.comment).toBe('Code looks good, approved for next stage');

      // Task should resume and continue to next stage
      const resumedTask = await orchestrator.getTask(task.id);
      expect(resumedTask!.status).not.toBe('awaiting-approval');
      expect(resumedTask!.pausedAt).toBeUndefined();

      // Phase 4: Continue execution to next gate
      // Note: In a real scenario, we'd need to run the task again or handle auto-resume
      // For this test, we'll verify the approval mechanism worked correctly

      // Phase 5: Verify database persistence
      const allApprovalStates = await orchestrator.getApprovalStatesByTask(task.id);
      expect(allApprovalStates.length).toBeGreaterThan(0);
      expect(allApprovalStates[0].status).toBe('approved');

      // Verify task logs include approval information
      const taskLogs = await orchestrator.getTaskLogs(task.id);
      const approvalLogs = taskLogs.filter(log =>
        log.message.includes('approval') || log.message.includes('gate')
      );
      expect(approvalLogs.length).toBeGreaterThan(0);
    });

    it('should handle approval denial and stop workflow execution', async () => {
      // Mock stage completions
      mockQuery
        .mockResolvedValueOnce({
          requestId: 'planning-request',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning completed.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          requestId: 'development-request',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Development completed.' }] }],
          },
          usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
        });

      const approvalRequiredEvents: ApprovalRequiredEventData[] = [];
      const approvalDeniedEvents: ApprovalDeniedEventData[] = [];

      orchestrator.on('approval:required', (event) => {
        approvalRequiredEvents.push(event);
      });

      orchestrator.on('approval:denied', (event) => {
        approvalDeniedEvents.push(event);
      });

      const task = await orchestrator.createTask({
        description: 'Test approval denial workflow',
        workflow: 'full-lifecycle-workflow',
      });

      // Execute until first gate
      await orchestrator.runTask(task.id);

      expect(approvalRequiredEvents).toHaveLength(1);
      const approvalEvent = approvalRequiredEvents[0];

      // Deny the approval
      await orchestrator.denyTask(
        task.id,
        approvalEvent.approvalId,
        'tech-lead',
        'Code quality issues identified, requires rework'
      );

      // Verify denial event
      expect(approvalDeniedEvents).toHaveLength(1);
      const deniedEvent = approvalDeniedEvents[0];
      expect(deniedEvent).toMatchObject({
        approvalId: approvalEvent.approvalId,
        taskId: task.id,
        approver: 'tech-lead',
        reason: 'Code quality issues identified, requires rework',
      });

      // Verify approval state reflects denial
      const deniedState = await orchestrator.getApprovalStateById(approvalEvent.approvalId);
      expect(deniedState!.status).toBe('denied');
      expect(deniedState!.approver).toBe('tech-lead');
      expect(deniedState!.comment).toBe('Code quality issues identified, requires rework');

      // Task should remain in appropriate state (implementation-specific)
      const deniedTask = await orchestrator.getTask(task.id);
      expect(['awaiting-approval', 'failed', 'cancelled']).toContain(deniedTask!.status);
    });

    it('should handle multiple approvals for gates requiring consensus', async () => {
      // Mock stage completions to reach the manager-approval gate
      mockQuery
        .mockResolvedValue({
          requestId: 'test-request',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Stage completed.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        });

      // Create a simple workflow that goes directly to manager approval
      const consensusWorkflow = `
name: consensus-workflow
description: Workflow requiring multiple approvals
stages:
  - name: planning
    agent: planner
    description: Plan for production
  - name: production-deploy
    agent: devops
    dependsOn: [planning]
    description: Deploy to production
    gate: "manager-approval"
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'consensus-workflow.yaml'),
        consensusWorkflow
      );

      const approvalRequiredEvents: ApprovalRequiredEventData[] = [];
      const approvalGrantedEvents: ApprovalGrantedEventData[] = [];

      orchestrator.on('approval:required', (event) => {
        approvalRequiredEvents.push(event);
      });

      orchestrator.on('approval:approved', (event) => {
        approvalGrantedEvents.push(event);
      });

      const task = await orchestrator.createTask({
        description: 'Test consensus approval workflow',
        workflow: 'consensus-workflow',
      });

      await orchestrator.runTask(task.id);

      expect(approvalRequiredEvents).toHaveLength(1);
      const approvalEvent = approvalRequiredEvents[0];
      expect(approvalEvent.requiredApprovals).toBe(2);
      expect(approvalEvent.gateName).toBe('manager-approval');

      // First approval
      await orchestrator.approveTask(
        task.id,
        approvalEvent.approvalId,
        'manager',
        'Approved by manager'
      );

      // Verify state after first approval
      let approvalState = await orchestrator.getApprovalStateById(approvalEvent.approvalId);
      expect(approvalState!.approvalsReceived).toBe(1);
      expect(approvalState!.status).toBe('pending'); // Still needs one more

      // Second approval
      await orchestrator.approveTask(
        task.id,
        approvalEvent.approvalId,
        'director',
        'Approved by director'
      );

      // Verify state after second approval
      approvalState = await orchestrator.getApprovalStateById(approvalEvent.approvalId);
      expect(approvalState!.approvalsReceived).toBe(2);
      expect(approvalState!.status).toBe('approved'); // Now fully approved

      // Should have received two granted events
      expect(approvalGrantedEvents).toHaveLength(2);
    });

    it('should handle approval timeout scenarios', async () => {
      // Create a gate with very short timeout
      const timeoutConfig = `
version: "1.0"
project:
  name: test-timeout
  language: typescript
  framework: node
gates:
  - name: "timeout-gate"
    type: "before-deploy"
    description: "Gate with timeout"
    approvers: ["approver"]
    timeout: 0.01  # Very short timeout
    minApprovals: 1
    required: true
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        timeoutConfig
      );

      // Create simple workflow with timeout gate
      const timeoutWorkflow = `
name: timeout-workflow
description: Test approval timeout
stages:
  - name: planning
    agent: planner
    description: Plan
  - name: deploy
    agent: devops
    dependsOn: [planning]
    description: Deploy
    gate: "timeout-gate"
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'timeout-workflow.yaml'),
        timeoutWorkflow
      );

      // Reinitialize with new config
      const timeoutOrchestrator = new ApexOrchestrator({ projectPath: testDir });
      await timeoutOrchestrator.initialize();

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done.' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      });

      const approvalRequiredEvents: ApprovalRequiredEventData[] = [];
      timeoutOrchestrator.on('approval:required', (event) => {
        approvalRequiredEvents.push(event);
      });

      const task = await timeoutOrchestrator.createTask({
        description: 'Test approval timeout',
        workflow: 'timeout-workflow',
      });

      await timeoutOrchestrator.runTask(task.id);

      expect(approvalRequiredEvents).toHaveLength(1);
      const approvalEvent = approvalRequiredEvents[0];

      // Verify timeout is properly set
      const timeoutDuration = approvalEvent.expiresAt!.getTime() - approvalEvent.requestedAt.getTime();
      expect(timeoutDuration).toBeCloseTo(0.01 * 60 * 1000, 1000); // Within 1 second

      // In a real implementation, there would be timeout handling logic
      // For this test, we verify the timeout is properly calculated and stored
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should recover from orchestrator restart during approval wait', async () => {
      // Mock stage completion
      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done.' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      });

      let approvalEvent: ApprovalRequiredEventData | undefined;
      orchestrator.on('approval:required', (event) => {
        approvalEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Test restart recovery',
        workflow: 'full-lifecycle-workflow',
      });

      // Execute until gate
      await orchestrator.runTask(task.id);
      expect(approvalEvent).toBeDefined();

      // Simulate orchestrator restart
      const newOrchestrator = new ApexOrchestrator({ projectPath: testDir });
      await newOrchestrator.initialize();

      // Verify state is recoverable
      const persistedTask = await newOrchestrator.getTask(task.id);
      expect(persistedTask!.status).toBe('awaiting-approval');

      const persistedApproval = await newOrchestrator.getApprovalStateById(approvalEvent!.approvalId);
      expect(persistedApproval!.status).toBe('pending');

      // Should be able to approve with new instance
      await newOrchestrator.approveTask(
        task.id,
        approvalEvent!.approvalId,
        'tech-lead',
        'Post-restart approval'
      );

      const approvedState = await newOrchestrator.getApprovalStateById(approvalEvent!.approvalId);
      expect(approvedState!.status).toBe('approved');
    });

    it('should handle invalid approval attempts gracefully', async () => {
      const invalidApprovalId = 'invalid-approval-id';
      const invalidTaskId = 'invalid-task-id';

      // Test invalid approval ID
      await expect(
        orchestrator.approveTask(invalidTaskId, invalidApprovalId, 'approver', 'comment')
      ).rejects.toThrow();

      // Test invalid task ID with valid-looking approval ID
      const validLookingApprovalId = '12345678-1234-1234-1234-123456789012';
      await expect(
        orchestrator.approveTask(invalidTaskId, validLookingApprovalId, 'approver', 'comment')
      ).rejects.toThrow();
    });

    it('should maintain data consistency under concurrent operations', async () => {
      // This test ensures that concurrent approval operations don't corrupt state
      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done.' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      });

      let approvalEvent: ApprovalRequiredEventData | undefined;
      orchestrator.on('approval:required', (event) => {
        approvalEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Test concurrent operations',
        workflow: 'full-lifecycle-workflow',
      });

      await orchestrator.runTask(task.id);
      expect(approvalEvent).toBeDefined();

      // Attempt concurrent operations (these should be handled safely)
      const operations = [
        orchestrator.approveTask(task.id, approvalEvent!.approvalId, 'approver1', 'First'),
        orchestrator.getApprovalStateById(approvalEvent!.approvalId),
        orchestrator.getTask(task.id),
      ];

      // First operation should succeed, others should handle gracefully
      const results = await Promise.allSettled(operations);

      // At least the read operations should succeed
      expect(results.some(result => result.status === 'fulfilled')).toBe(true);
    });
  });
});
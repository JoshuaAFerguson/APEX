/**
 * Integration test for task pause and resume at approval gate
 *
 * This test verifies the complete workflow of:
 * 1. Creating a task with an approval gate
 * 2. Verifying task pauses at the gate with 'awaiting-approval' status
 * 3. Sending approval via API endpoint
 * 4. Verifying task resumes and completes successfully
 *
 * Covers the acceptance criteria:
 * - Test creates task with approval gate
 * - Verifies task pauses at gate
 * - Sends approval via API
 * - Verifies task resumes and completes
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import fetch from 'node-fetch';

import {
  initializeApex,
  isApexInitialized,
} from '@apexcli/core';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { createServer } from '@apexcli/api';
import { query } from '@anthropic-ai/claude-agent-sdk';

// Mock the claude-agent-sdk to avoid actual API calls
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

// Mock child_process to avoid actual command execution
vi.mock('child_process', () => ({
  exec: vi.fn((cmd: string, opts: unknown, callback?: unknown) => {
    if (typeof opts === 'function') {
      callback = opts;
    }
    const cb = callback as (error: Error | null, result?: { stdout: string }) => void;
    cb(null, { stdout: 'Mock command execution' });
  }),
}));

const mockQuery = query as unknown as ReturnType<typeof vi.fn>;

describe('Integration: Task Pause and Resume at Approval Gate', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let apiServer: any;
  let serverUrl: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-approval-integration-'));

    // Initialize project
    await initializeApex(testDir, {
      projectName: 'approval-integration-test',
      language: 'typescript',
      framework: 'nextjs',
    });

    // Verify initialization
    expect(await isApexInitialized(testDir)).toBe(true);

    // Create agents required for the workflow
    const agentsDir = path.join(testDir, '.apex', 'agents');

    await fs.writeFile(
      path.join(agentsDir, 'planner.md'),
      `---
name: planner
description: Plans feature development
tools: Read, Write, Edit
model: sonnet
---

You are a planner agent that creates implementation plans.`
    );

    await fs.writeFile(
      path.join(agentsDir, 'developer.md'),
      `---
name: developer
description: Implements features based on plans
tools: Read, Write, Edit, Bash
model: sonnet
---

You are a developer agent that implements features.`
    );

    // Create a workflow with an approval gate
    const workflowsDir = path.join(testDir, '.apex', 'workflows');
    await fs.writeFile(
      path.join(workflowsDir, 'feature-with-approval.yaml'),
      `name: feature-with-approval
description: Feature development workflow with approval gate

gates:
  - id: implementation-approval
    name: Implementation Review
    description: Review implementation before proceeding
    required: true
    minApprovals: 1
    timeout: 60
    approvers:
      - tech-lead
      - senior-dev

stages:
  - name: planning
    agent: planner
    description: Plan the feature implementation

  - name: implementation
    agent: developer
    description: Implement the feature
    gate: implementation-approval
`
    );

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator({
      projectPath: testDir,
      apiUrl: 'http://localhost:3001' // Use a different port than default
    });
    await orchestrator.initialize();

    // Start API server
    apiServer = await createApexAPIServer({
      port: 3001,
      orchestrator,
      projectPath: testDir,
    });

    serverUrl = 'http://localhost:3001';

    // Wait a bit for server to fully start
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    // Clean up
    if (apiServer?.server) {
      await new Promise<void>((resolve) => {
        apiServer.server.close(() => {
          resolve();
        });
      });
    }
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('should pause task at approval gate, accept approval via API, and resume to completion', async () => {
    // Mock Claude SDK responses for different stages
    mockQuery
      .mockResolvedValueOnce({
        // Planning stage response
        content: [
          { type: 'text', text: 'Planning completed. Ready for implementation.' }
        ]
      })
      .mockResolvedValueOnce({
        // Implementation stage response (after approval)
        content: [
          { type: 'text', text: 'Feature implemented successfully.' }
        ]
      });

    let taskId: string;
    let approvalId: string;
    const events: Array<{ event: string; data: any }> = [];

    // Track relevant events
    const eventHandler = (event: string) => (data: any) => {
      events.push({ event, data });
    };

    orchestrator.on('task:created', eventHandler('task:created'));
    orchestrator.on('task:stage-changed', eventHandler('task:stage-changed'));
    orchestrator.on('task:paused', eventHandler('task:paused'));
    orchestrator.on('approval:required', eventHandler('approval:required'));
    orchestrator.on('approval:approved', eventHandler('approval:approved'));
    orchestrator.on('task:resumed', eventHandler('task:resumed'));
    orchestrator.on('task:completed', eventHandler('task:completed'));

    // Step 1: Create task with approval gate
    const task = await orchestrator.createTask({
      description: 'Implement new feature with approval gate',
      workflow: 'feature-with-approval',
      priority: 'normal',
      autonomy: 'full'
    });

    taskId = task.id;
    expect(taskId).toBeDefined();
    expect(task.status).toBe('pending');

    // Step 2: Start task execution (should pause at approval gate)
    await orchestrator.runWorkflow(taskId);

    // Wait a bit for workflow to execute and hit the gate
    await new Promise(resolve => setTimeout(resolve, 200));

    // Step 3: Verify task is paused at approval gate
    const pausedTask = await orchestrator.getTask(taskId);
    expect(pausedTask).toBeDefined();
    expect(pausedTask!.status).toBe('awaiting-approval');
    expect(pausedTask!.pauseReason).toBe('approval_gate');
    expect(pausedTask!.approvalState).toBeDefined();
    expect(pausedTask!.approvalState!.gateName).toBe('implementation-approval');
    expect(pausedTask!.approvalState!.status).toBe('pending');

    // Extract approval ID for API call
    approvalId = pausedTask!.approvalState!.approvalId!;
    expect(approvalId).toBeDefined();
    expect(typeof approvalId).toBe('string');
    expect(approvalId.length).toBeGreaterThan(0);

    // Verify approval:required event was emitted
    const approvalRequiredEvents = events.filter(e => e.event === 'approval:required');
    expect(approvalRequiredEvents).toHaveLength(1);
    expect(approvalRequiredEvents[0].data.approvalId).toBe(approvalId);
    expect(approvalRequiredEvents[0].data.taskId).toBe(taskId);
    expect(approvalRequiredEvents[0].data.gateName).toBe('implementation-approval');

    // Step 4: Send approval via API endpoint
    const approvalResponse = await fetch(`${serverUrl}/api/approvals/${approvalId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        approver: 'tech-lead',
        comment: 'Implementation looks good, approved for deployment'
      })
    });

    expect(approvalResponse.ok).toBe(true);
    const approvalResult = await approvalResponse.json();
    expect(approvalResult.success).toBe(true);
    expect(approvalResult.message).toContain('granted successfully');
    expect(approvalResult.willProceed).toBe(true);

    // Wait for approval to be processed and task to resume
    await new Promise(resolve => setTimeout(resolve, 300));

    // Step 5: Verify task resumed and completed
    const completedTask = await orchestrator.getTask(taskId);
    expect(completedTask).toBeDefined();

    // Task should be either completed or in-progress (depending on how fast it completes)
    expect(['completed', 'in-progress'].includes(completedTask!.status)).toBe(true);

    // If not completed yet, wait a bit more
    if (completedTask!.status === 'in-progress') {
      await new Promise(resolve => setTimeout(resolve, 500));
      const finalTask = await orchestrator.getTask(taskId);
      expect(finalTask!.status).toBe('completed');
    }

    // Verify approval:approved event was emitted
    const approvalApprovedEvents = events.filter(e => e.event === 'approval:approved');
    expect(approvalApprovedEvents).toHaveLength(1);
    expect(approvalApprovedEvents[0].data.approvalId).toBe(approvalId);
    expect(approvalApprovedEvents[0].data.approver).toBe('tech-lead');
    expect(approvalApprovedEvents[0].data.comment).toBe('Implementation looks good, approved for deployment');

    // Verify task creation and completion events
    const taskCreatedEvents = events.filter(e => e.event === 'task:created');
    expect(taskCreatedEvents).toHaveLength(1);

    // Check that approval state is cleared after completion
    const finalTask = await orchestrator.getTask(taskId);
    expect(finalTask!.approvalState).toBeNull();

    // Verify logs contain approval information
    expect(finalTask!.logs).toBeDefined();
    const approvalLogs = finalTask!.logs.filter(log =>
      log.message.includes('approval') || log.message.includes('resumed')
    );
    expect(approvalLogs.length).toBeGreaterThan(0);

    console.log('Test completed successfully:');
    console.log(`- Task ${taskId} created with approval gate`);
    console.log(`- Task paused at approval gate: ${pausedTask!.approvalState!.gateName}`);
    console.log(`- Approval ${approvalId} granted via API`);
    console.log(`- Task resumed and completed with status: ${finalTask!.status}`);
  });

  it('should handle approval denial via API and fail the task', async () => {
    // Mock Claude SDK response for planning stage only
    mockQuery.mockResolvedValueOnce({
      content: [
        { type: 'text', text: 'Planning completed. Awaiting approval for implementation.' }
      ]
    });

    let taskId: string;
    let approvalId: string;
    const events: Array<{ event: string; data: any }> = [];

    // Track relevant events
    const eventHandler = (event: string) => (data: any) => {
      events.push({ event, data });
    };

    orchestrator.on('task:created', eventHandler('task:created'));
    orchestrator.on('approval:required', eventHandler('approval:required'));
    orchestrator.on('approval:denied', eventHandler('approval:denied'));
    orchestrator.on('task:failed', eventHandler('task:failed'));

    // Create and start task
    const task = await orchestrator.createTask({
      description: 'Feature that will be denied at approval gate',
      workflow: 'feature-with-approval',
    });

    taskId = task.id;
    await orchestrator.runWorkflow(taskId);

    // Wait for approval gate
    await new Promise(resolve => setTimeout(resolve, 200));

    const pausedTask = await orchestrator.getTask(taskId);
    expect(pausedTask!.status).toBe('awaiting-approval');
    approvalId = pausedTask!.approvalState!.approvalId!;

    // Deny the approval via API
    const denialResponse = await fetch(`${serverUrl}/api/approvals/${approvalId}/deny`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        approver: 'senior-dev',
        reason: 'Implementation needs more work before approval'
      })
    });

    expect(denialResponse.ok).toBe(true);
    const denialResult = await denialResponse.json();
    expect(denialResult.success).toBe(true);
    expect(denialResult.message).toContain('denied successfully');
    expect(denialResult.willProceed).toBe(false);

    // Wait for denial to be processed
    await new Promise(resolve => setTimeout(resolve, 300));

    // Verify task failed
    const failedTask = await orchestrator.getTask(taskId);
    expect(failedTask!.status).toBe('failed');

    // Verify approval:denied event was emitted
    const approvalDeniedEvents = events.filter(e => e.event === 'approval:denied');
    expect(approvalDeniedEvents).toHaveLength(1);
    expect(approvalDeniedEvents[0].data.approvalId).toBe(approvalId);
    expect(approvalDeniedEvents[0].data.approver).toBe('senior-dev');
    expect(approvalDeniedEvents[0].data.reason).toBe('Implementation needs more work before approval');

    console.log('Approval denial test completed:');
    console.log(`- Task ${taskId} denied at approval gate`);
    console.log(`- Task failed with status: ${failedTask!.status}`);
  });

  it('should list pending approvals via API', async () => {
    // Mock Claude SDK responses for both tasks (planning stage only)
    mockQuery
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Feature 1 planning completed.' }]
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Feature 2 planning completed.' }]
      });

    // Create multiple tasks that will pause at approval gates
    const task1 = await orchestrator.createTask({
      description: 'Feature 1 with approval gate',
      workflow: 'feature-with-approval',
    });

    const task2 = await orchestrator.createTask({
      description: 'Feature 2 with approval gate',
      workflow: 'feature-with-approval',
    });

    // Start both workflows
    await Promise.all([
      orchestrator.runWorkflow(task1.id),
      orchestrator.runWorkflow(task2.id)
    ]);

    // Wait for both to hit approval gates
    await new Promise(resolve => setTimeout(resolve, 300));

    // List pending approvals via API
    const response = await fetch(`${serverUrl}/api/approvals/pending`);
    expect(response.ok).toBe(true);

    const result = await response.json();
    expect(result.approvals).toBeDefined();
    expect(result.approvals.length).toBe(2);
    expect(result.message).toContain('2 pending approval(s) found');

    // Verify each approval has required fields
    result.approvals.forEach((approval: any) => {
      expect(approval.id).toBeDefined();
      expect(approval.taskId).toBeDefined();
      expect(approval.gateName).toBe('implementation-approval');
      expect(approval.status).toBe('pending');
    });

    console.log('Pending approvals test completed:');
    console.log(`- Found ${result.approvals.length} pending approvals`);
  });
});
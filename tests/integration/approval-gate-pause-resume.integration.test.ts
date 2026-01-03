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

    // Start API server (it will create its own orchestrator)
    apiServer = await createServer({
      projectPath: testDir,
    });

    await apiServer.listen({ port: 3001, host: '0.0.0.0' });
    serverUrl = 'http://localhost:3001';

    // Wait a bit for server to fully start
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    // Clean up
    if (apiServer) {
      await apiServer.close();
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

    // Step 1: Create task with approval gate via API
    const createResponse = await fetch(`${serverUrl}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: 'Implement new feature with approval gate',
        workflow: 'feature-with-approval',
        priority: 'normal',
        autonomy: 'full'
      })
    });

    expect(createResponse.ok).toBe(true);
    const createResult = await createResponse.json();
    taskId = createResult.task.id;
    expect(taskId).toBeDefined();
    expect(createResult.task.status).toBe('pending');

    // Step 2: Start task execution (should pause at approval gate)
    const startResponse = await fetch(`${serverUrl}/api/tasks/${taskId}/start`, {
      method: 'POST',
    });

    expect(startResponse.ok).toBe(true);

    // Wait a bit for workflow to execute and hit the gate
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 3: Verify task is paused at approval gate
    const taskResponse = await fetch(`${serverUrl}/api/tasks/${taskId}`);
    expect(taskResponse.ok).toBe(true);
    const pausedTask = await taskResponse.json();
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
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 5: Verify task resumed and completed
    const completedTaskResponse = await fetch(`${serverUrl}/api/tasks/${taskId}`);
    expect(completedTaskResponse.ok).toBe(true);
    const completedTask = await completedTaskResponse.json();
    expect(completedTask).toBeDefined();

    // Task should be either completed or in-progress (depending on how fast it completes)
    expect(['completed', 'in-progress'].includes(completedTask!.status)).toBe(true);

    // If not completed yet, wait a bit more
    if (completedTask!.status === 'in-progress') {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const finalTaskResponse = await fetch(`${serverUrl}/api/tasks/${taskId}`);
      expect(finalTaskResponse.ok).toBe(true);
      const finalTask = await finalTaskResponse.json();
      expect(finalTask!.status).toBe('completed');
    }

    // Get final task state to verify approval state is cleared
    const finalTaskResponse = await fetch(`${serverUrl}/api/tasks/${taskId}`);
    expect(finalTaskResponse.ok).toBe(true);
    const finalTask = await finalTaskResponse.json();

    // Check that approval state is cleared after completion
    expect(finalTask!.approvalState).toBeNull();

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

    // Create task via API
    const createResponse = await fetch(`${serverUrl}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: 'Feature that will be denied at approval gate',
        workflow: 'feature-with-approval',
      })
    });

    expect(createResponse.ok).toBe(true);
    const createResult = await createResponse.json();
    taskId = createResult.task.id;

    // Start task via API
    const startResponse = await fetch(`${serverUrl}/api/tasks/${taskId}/start`, {
      method: 'POST',
    });

    expect(startResponse.ok).toBe(true);

    // Wait for approval gate
    await new Promise(resolve => setTimeout(resolve, 1000));

    const taskResponse = await fetch(`${serverUrl}/api/tasks/${taskId}`);
    expect(taskResponse.ok).toBe(true);
    const pausedTask = await taskResponse.json();
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
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify task failed
    const failedTaskResponse = await fetch(`${serverUrl}/api/tasks/${taskId}`);
    expect(failedTaskResponse.ok).toBe(true);
    const failedTask = await failedTaskResponse.json();
    expect(failedTask!.status).toBe('failed');

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
    const createResponse1 = await fetch(`${serverUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Feature 1 with approval gate',
        workflow: 'feature-with-approval',
      })
    });

    const createResponse2 = await fetch(`${serverUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Feature 2 with approval gate',
        workflow: 'feature-with-approval',
      })
    });

    expect(createResponse1.ok).toBe(true);
    expect(createResponse2.ok).toBe(true);

    const task1 = await createResponse1.json();
    const task2 = await createResponse2.json();

    // Start both workflows
    await Promise.all([
      fetch(`${serverUrl}/api/tasks/${task1.task.id}/start`, { method: 'POST' }),
      fetch(`${serverUrl}/api/tasks/${task2.task.id}/start`, { method: 'POST' })
    ]);

    // Wait for both to hit approval gates
    await new Promise(resolve => setTimeout(resolve, 1500));

    // List pending approvals via API
    const response = await fetch(`${serverUrl}/api/approvals`);
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
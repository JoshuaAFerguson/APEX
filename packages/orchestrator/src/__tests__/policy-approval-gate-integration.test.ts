/**
 * @fileoverview Integration tests for policy approval gate handling in orchestrator
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { ApexOrchestrator } from '../index.js';

async function createTestProject(): Promise<string> {
  const testDir = path.join(tmpdir(), `apex-policy-approval-${randomUUID()}`);
  const apexDir = path.join(testDir, '.apex');
  await fs.mkdir(apexDir, { recursive: true });

  await fs.writeFile(
    path.join(apexDir, 'config.yaml'),
    `
version: "1.0"
project:
  name: policy-approval-test
policy:
  enabled: true
  approvalRules:
    enabled: true
    rules:
      - id: modify-approval
        name: Modify approval
        conditions:
          - type: operation
            operations: ["modify"]
        urgency: high
        timeoutMinutes: 10
        approvers: ["security"]
        minApprovals: 2
        timeoutAction: reject
permissions:
  autonomy: autonomous
`
  );

  return testDir;
}

describe('Policy approval gates (tool-level)', () => {
  let projectPath: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    projectPath = await createTestProject();
    orchestrator = new ApexOrchestrator({ projectPath });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    await fs.rm(projectPath, { recursive: true, force: true });
  });

  it('creates an approval state and pauses the task when policy approval is required', async () => {
    const task = await orchestrator.createTask({
      description: 'Test policy approval requirement',
      workflow: 'feature',
    });

    const approvalReq = (orchestrator as any).policyEnforcer.checkApprovalRequired(task, 'modify', {
      filePaths: ['src/secret.ts'],
      operation: 'modify',
    });

    expect(approvalReq.required).toBe(true);

    await (orchestrator as any).requestPolicyApproval(task, approvalReq, {
      action: 'modify',
      toolName: 'Edit',
      stageName: 'implementation',
      workflowName: 'feature',
      filePaths: ['src/secret.ts'],
      agentName: 'developer',
    });

    const approvals = await orchestrator.getPendingApprovals();
    expect(approvals.length).toBe(1);
    expect(approvals[0]?.gateName).toMatch(/^policy-/);
    expect(approvals[0]?.approvalsRequired).toBe(2);

    const updatedTask = await orchestrator.store.getTask(task.id);
    expect(updatedTask?.status).toBe('awaiting-approval');
  });
});

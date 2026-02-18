/**
 * Basic test for approval:request event emission
 *
 * Simple test to verify the ApexOrchestrator emits 'approval:request' events
 * with correct ApprovalRequest payload structure.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../index';
import { initializeApex } from '@apexcli/core';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { ApprovalRequest } from '@apexcli/core';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
  tool: vi.fn((config) => config),
  createSdkMcpServer: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), close: vi.fn() })),
}));

describe('Basic Approval Request Event Tests', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let mockQuery: MockInstance;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-basic-approval-test-'));
    mockQuery = vi.mocked(query);

    // Initialize APEX
    await initializeApex(testDir, {
      projectName: 'test-basic-approval',
      language: 'typescript',
      framework: 'node',
    });

    // Simple config with one gate
    const configContent = `
version: "1.0"
project:
  name: test-basic-approval
  language: typescript
  framework: node
gates:
  - name: "test-gate"
    type: "before-commit"
    description: "Basic test gate"
    approvers: ["reviewer"]
    timeout: 30
    minApprovals: 1
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      configContent
    );

    // Simple workflow with one gate
    const workflowContent = `
name: basic-workflow
description: Basic workflow with approval gate
stages:
  - name: planning
    agent: planner
    description: Plan the work
  - name: implementation
    agent: developer
    dependsOn: [planning]
    description: Do the work
    gate: "test-gate"
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'basic-workflow.yaml'),
      workflowContent
    );

    // Simple agent files
    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'planner.md'),
      `---
name: planner
description: Planning agent
tools: Read
model: sonnet
---
You are a planner.`
    );

    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'developer.md'),
      `---
name: developer
description: Development agent
tools: Write, Edit
model: sonnet
---
You are a developer.`
    );

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('Event Handler Registration', () => {
    it('should allow registration of approval:request event handler', () => {
      const handler = vi.fn();

      expect(() => {
        orchestrator.on('approval:request', handler);
      }).not.toThrow();

      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');

      // Clean up
      orchestrator.off('approval:request', handler);
    });

    it('should allow deregistration of approval:request event handler', () => {
      const handler = vi.fn();

      orchestrator.on('approval:request', handler);

      expect(() => {
        orchestrator.off('approval:request', handler);
      }).not.toThrow();
    });
  });

  describe('Basic Event Emission', () => {
    it('should emit approval:request event when hitting an approval gate', async () => {
      // Set up mocks
      mockQuery
        .mockResolvedValueOnce({
          requestId: 'test-req-1',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning complete.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          requestId: 'test-req-2',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation complete.' }] }],
          },
          usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
        });

      const approvalRequests: ApprovalRequest[] = [];
      orchestrator.on('approval:request', (request) => {
        approvalRequests.push(request);
      });

      const task = await orchestrator.createTask({
        description: 'Basic test task',
        workflow: 'basic-workflow',
      });

      await orchestrator.runTask(task.id);

      // Verify event was emitted
      expect(approvalRequests).toHaveLength(1);

      const request = approvalRequests[0];
      expect(request).toBeDefined();
      expect(request.taskId).toBe(task.id);
      expect(request.requestId).toBeDefined();
      expect(request.gateName).toBe('test-gate');
      expect(request.gateType).toBe('before-commit');
    });

    it('should emit approval:request with valid ApprovalRequest structure', async () => {
      // Set up mocks
      mockQuery
        .mockResolvedValueOnce({
          requestId: 'test-req-1',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning complete.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          requestId: 'test-req-2',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation complete.' }] }],
          },
          usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
        });

      let emittedRequest: ApprovalRequest | undefined;
      orchestrator.on('approval:request', (request) => {
        emittedRequest = request;
      });

      const task = await orchestrator.createTask({
        description: 'Test ApprovalRequest structure',
        workflow: 'basic-workflow',
      });

      await orchestrator.runTask(task.id);

      expect(emittedRequest).toBeDefined();

      // Check required fields
      expect(emittedRequest!.requestId).toBeTruthy();
      expect(typeof emittedRequest!.requestId).toBe('string');

      expect(emittedRequest!.taskId).toBe(task.id);
      expect(typeof emittedRequest!.taskId).toBe('string');

      expect(emittedRequest!.description).toBeTruthy();
      expect(typeof emittedRequest!.description).toBe('string');

      expect(emittedRequest!.reason).toBeTruthy();
      expect(typeof emittedRequest!.reason).toBe('string');

      expect(emittedRequest!.gateName).toBe('test-gate');
      expect(emittedRequest!.gateType).toBe('before-commit');

      expect(emittedRequest!.requestedAt).toBeInstanceOf(Date);

      // Legacy field should match requestId
      expect(emittedRequest!.id).toBe(emittedRequest!.requestId);

      // Check gate configuration fields
      expect(emittedRequest!.approvers).toEqual(['reviewer']);
      expect(emittedRequest!.minApprovals).toBe(1);
      expect(emittedRequest!.timeoutMinutes).toBe(30);

      // Context should be defined
      expect(emittedRequest!.context).toBeDefined();
      expect(emittedRequest!.context!.taskId).toBe(task.id);
    });

    it('should validate emitted request against ApprovalRequestSchema', async () => {
      const { ApprovalRequestSchema } = await import('@apexcli/core');

      // Set up mocks
      mockQuery
        .mockResolvedValueOnce({
          requestId: 'test-req-1',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning complete.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          requestId: 'test-req-2',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation complete.' }] }],
          },
          usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
        });

      let emittedRequest: ApprovalRequest | undefined;
      orchestrator.on('approval:request', (request) => {
        emittedRequest = request;
      });

      const task = await orchestrator.createTask({
        description: 'Test schema validation',
        workflow: 'basic-workflow',
      });

      await orchestrator.runTask(task.id);

      expect(emittedRequest).toBeDefined();

      // Validate against Zod schema
      expect(() => ApprovalRequestSchema.parse(emittedRequest)).not.toThrow();

      const parsed = ApprovalRequestSchema.parse(emittedRequest);
      expect(parsed).toEqual(emittedRequest);
    });

    it('should not emit approval:request for workflows without gates', async () => {
      // Create workflow without gates
      const noGateWorkflowContent = `
name: no-gate-workflow
description: Workflow without approval gates
stages:
  - name: planning
    agent: planner
    description: Plan the work
  - name: implementation
    agent: developer
    dependsOn: [planning]
    description: Do the work
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'no-gate-workflow.yaml'),
        noGateWorkflowContent
      );

      // Set up mocks
      mockQuery
        .mockResolvedValueOnce({
          requestId: 'test-req-1',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning complete.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          requestId: 'test-req-2',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation complete.' }] }],
          },
          usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
        });

      const approvalRequests: ApprovalRequest[] = [];
      orchestrator.on('approval:request', (request) => {
        approvalRequests.push(request);
      });

      const task = await orchestrator.createTask({
        description: 'Task without gates',
        workflow: 'no-gate-workflow',
      });

      await orchestrator.runTask(task.id);

      // Should not emit any approval requests
      expect(approvalRequests).toHaveLength(0);
    });
  });
});
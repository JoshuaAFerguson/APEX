/**
 * Test suite for approval URL generation bug fix
 *
 * This test identifies a bug where approval URLs are not generated correctly
 * because the implementation uses this.options.apiUrl instead of this.apiUrl
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../index';
import { initializeApex } from '@apexcli/core';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { ApprovalRequiredEventData } from '@apexcli/core';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
  tool: vi.fn((config) => config),
  createSdkMcpServer: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), close: vi.fn() })),
}));

describe('Approval URL Generation Bug', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let mockQuery: MockInstance;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-url-bug-test-'));
    mockQuery = vi.mocked(query);

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'test-url-bug',
      language: 'typescript',
      framework: 'node',
    });

    // Create config WITHOUT api.url (should use default)
    const configContent = `
version: "1.0"
project:
  name: test-url-bug
  language: typescript
  framework: node
gates:
  - name: "test-gate"
    type: "before-commit"
    description: "Test gate for URL bug"
    approvers: ["reviewer"]
    timeout: 30
    minApprovals: 1
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      configContent
    );

    // Create workflow with gate
    const workflowContent = `
name: test-url-workflow
description: Test workflow for URL bug
stages:
  - name: planning
    agent: planner
    description: Plan
  - name: implementation
    agent: developer
    dependsOn: [planning]
    description: Implement
    gate: "test-gate"
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'test-url-workflow.yaml'),
      workflowContent
    );

    // Create test agent files
    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'planner.md'),
      `---
name: planner
description: Plans implementation tasks
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
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('should generate approval URL using default apiUrl when no explicit apiUrl provided', async () => {
    // Create orchestrator without explicit apiUrl - should use default
    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();

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
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation done.' }] }],
        },
        usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
      });

    let emittedEvent: ApprovalRequiredEventData | undefined;
    orchestrator.on('approval-required', (event) => {
      emittedEvent = event;
    });

    const task = await orchestrator.createTask({
      description: 'Test default URL generation',
      workflow: 'test-url-workflow',
    });

    await orchestrator.runTask(task.id);

    expect(emittedEvent).toBeDefined();
    expect(emittedEvent!.approvalUrl).toBeDefined();
    expect(emittedEvent!.approvalUrl).toBe(
      `http://localhost:3000/approvals/${emittedEvent!.approvalId}`
    );
  });

  it('should generate approval URL using explicit apiUrl when provided', async () => {
    // Create orchestrator with explicit apiUrl
    orchestrator = new ApexOrchestrator({
      projectPath: testDir,
      apiUrl: 'https://custom.example.com:8080'
    });
    await orchestrator.initialize();

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
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation done.' }] }],
        },
        usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
      });

    let emittedEvent: ApprovalRequiredEventData | undefined;
    orchestrator.on('approval-required', (event) => {
      emittedEvent = event;
    });

    const task = await orchestrator.createTask({
      description: 'Test explicit URL generation',
      workflow: 'test-url-workflow',
    });

    await orchestrator.runTask(task.id);

    expect(emittedEvent).toBeDefined();
    expect(emittedEvent!.approvalUrl).toBeDefined();
    expect(emittedEvent!.approvalUrl).toBe(
      `https://custom.example.com:8080/approvals/${emittedEvent!.approvalId}`
    );
  });

  it('should handle URL path construction with trailing slash correctly', async () => {
    // Create orchestrator with trailing slash in apiUrl
    orchestrator = new ApexOrchestrator({
      projectPath: testDir,
      apiUrl: 'https://example.com/'
    });
    await orchestrator.initialize();

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
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation done.' }] }],
        },
        usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
      });

    let emittedEvent: ApprovalRequiredEventData | undefined;
    orchestrator.on('approval-required', (event) => {
      emittedEvent = event;
    });

    const task = await orchestrator.createTask({
      description: 'Test trailing slash URL generation',
      workflow: 'test-url-workflow',
    });

    await orchestrator.runTask(task.id);

    expect(emittedEvent).toBeDefined();
    expect(emittedEvent!.approvalUrl).toBeDefined();
    // Should not have double slashes
    expect(emittedEvent!.approvalUrl).toBe(
      `https://example.com/approvals/${emittedEvent!.approvalId}`
    );
    expect(emittedEvent!.approvalUrl).not.toMatch(/\/\//g); // No double slashes
  });
});
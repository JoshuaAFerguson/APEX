/**
 * Integration tests for the full APEX workflow
 *
 * These tests verify that all packages work together correctly:
 * - Core types and config
 * - Orchestrator task management
 * - CLI initialization
 *
 * Note: API server tests are in a separate file to avoid mock conflicts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  initializeApex,
  isApexInitialized,
  loadConfig,
  loadAgents,
  loadWorkflows,
  getEffectiveConfig,
} from '@apexcli/core';
import { ApexOrchestrator, TaskStore } from '@apexcli/orchestrator';

describe('Integration: Full Workflow', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-integration-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Project Initialization', () => {
    it('should initialize a new project with all required files', async () => {
      // Initialize project
      await initializeApex(testDir, {
        projectName: 'test-project',
        language: 'typescript',
        framework: 'nextjs',
      });

      // Verify initialization
      expect(await isApexInitialized(testDir)).toBe(true);

      // Verify directory structure
      const apexDir = path.join(testDir, '.apex');
      const configFile = path.join(apexDir, 'config.yaml');
      const agentsDir = path.join(apexDir, 'agents');
      const workflowsDir = path.join(apexDir, 'workflows');
      const scriptsDir = path.join(apexDir, 'scripts');

      expect(await fs.stat(apexDir).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.stat(configFile).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.stat(agentsDir).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.stat(workflowsDir).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.stat(scriptsDir).then(() => true).catch(() => false)).toBe(true);
    });

    it('should load config after initialization', async () => {
      await initializeApex(testDir, {
        projectName: 'my-app',
        language: 'python',
      });

      const config = await loadConfig(testDir);
      expect(config.project?.name).toBe('my-app');
      expect(config.project?.language).toBe('python');
    });

    it('should return effective config with defaults', async () => {
      await initializeApex(testDir, { projectName: 'test' });
      const config = await loadConfig(testDir);
      const effective = getEffectiveConfig(config);

      // Should have all default values
      expect(effective.autonomy.default).toBeDefined();
      expect(effective.models.planning).toBeDefined();
      expect(effective.models.implementation).toBeDefined();
      expect(effective.limits.maxTokensPerTask).toBeGreaterThan(0);
      expect(effective.limits.maxCostPerTask).toBeGreaterThan(0);
    });
  });

  describe('Agent Loading', () => {
    it('should load default agents after initialization', async () => {
      await initializeApex(testDir, { projectName: 'test' });

      // Create sample agents
      const agentsDir = path.join(testDir, '.apex', 'agents');
      await fs.writeFile(
        path.join(agentsDir, 'developer.md'),
        `---
name: developer
description: Writes code
tools: Read, Write, Edit
model: sonnet
---

You are a developer.`
      );

      const agents = await loadAgents(testDir);
      expect(agents.developer).toBeDefined();
      expect(agents.developer.name).toBe('developer');
      expect(agents.developer.description).toBe('Writes code');
    });

    it('should parse agent frontmatter correctly', async () => {
      await initializeApex(testDir, { projectName: 'test' });

      const agentsDir = path.join(testDir, '.apex', 'agents');
      await fs.writeFile(
        path.join(agentsDir, 'tester.md'),
        `---
name: tester
description: Tests code
tools:
  - Read
  - Bash
  - Grep
model: haiku
---

You are a tester agent.`
      );

      const agents = await loadAgents(testDir);
      expect(agents.tester.tools).toEqual(['Read', 'Bash', 'Grep']);
      expect(agents.tester.model).toBe('haiku');
    });
  });

  describe('Workflow Loading', () => {
    it('should load workflows after initialization', async () => {
      await initializeApex(testDir, { projectName: 'test' });

      // Create sample workflow
      const workflowsDir = path.join(testDir, '.apex', 'workflows');
      await fs.writeFile(
        path.join(workflowsDir, 'feature.yaml'),
        `name: feature
description: Feature workflow
stages:
  - name: planning
    agent: planner
    description: Plan the feature
  - name: implementation
    agent: developer
    description: Implement the feature
`
      );

      const workflows = await loadWorkflows(testDir);
      expect(workflows.feature).toBeDefined();
      expect(workflows.feature.stages).toHaveLength(2);
      expect(workflows.feature.stages[0].name).toBe('planning');
    });
  });
});

describe('Integration: Task Store', () => {
  let testDir: string;
  let store: TaskStore;

  const createTestTask = (overrides: Partial<{
    id: string;
    description: string;
    workflow: string;
    projectPath: string;
  }> = {}) => ({
    id: overrides.id || `task_${Date.now()}_test`,
    description: overrides.description || 'Test task',
    workflow: overrides.workflow || 'feature',
    autonomy: 'full' as const,
    status: 'pending' as const,
    priority: 'normal' as const,
    projectPath: overrides.projectPath || testDir,
    branchName: 'test-branch',
    retryCount: 0,
    maxRetries: 3,
    dependsOn: [],
    blockedBy: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
    logs: [],
    artifacts: [],
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-store-int-'));
    await initializeApex(testDir, { projectName: 'test' });
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    store.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should persist tasks across store instances', async () => {
    // Create task
    const taskData = createTestTask({ description: 'Test persistence' });
    await store.createTask(taskData);

    // Close and reopen store
    store.close();
    store = new TaskStore(testDir);
    await store.initialize();

    // Should find the task
    const found = await store.getTask(taskData.id);
    expect(found).toBeDefined();
    expect(found?.description).toBe('Test persistence');
  });

  it('should track task status changes', async () => {
    const taskData = createTestTask({ description: 'Status tracking test' });
    await store.createTask(taskData);

    expect(taskData.status).toBe('pending');

    await store.updateTask(taskData.id, { status: 'queued' });
    let updated = await store.getTask(taskData.id);
    expect(updated?.status).toBe('queued');

    await store.updateTask(taskData.id, { status: 'in-progress' });
    updated = await store.getTask(taskData.id);
    expect(updated?.status).toBe('in-progress');

    await store.updateTask(taskData.id, { status: 'completed' });
    updated = await store.getTask(taskData.id);
    expect(updated?.status).toBe('completed');
  });

  it('should track usage across updates', async () => {
    const taskData = createTestTask({ description: 'Usage tracking' });
    await store.createTask(taskData);

    // Update usage incrementally
    await store.updateTask(taskData.id, {
      usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500, estimatedCost: 0.015 },
    });

    let updated = await store.getTask(taskData.id);
    expect(updated?.usage.totalTokens).toBe(1500);

    // Another update
    await store.updateTask(taskData.id, {
      usage: { inputTokens: 2000, outputTokens: 1000, totalTokens: 3000, estimatedCost: 0.03 },
    });

    updated = await store.getTask(taskData.id);
    expect(updated?.usage.totalTokens).toBe(3000);
    expect(updated?.usage.estimatedCost).toBe(0.03);
  });
});

describe('Integration: Orchestrator with Store', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-orch-int-'));
    await initializeApex(testDir, { projectName: 'test' });

    // Create required agents
    const agentsDir = path.join(testDir, '.apex', 'agents');
    await fs.writeFile(
      path.join(agentsDir, 'developer.md'),
      `---
name: developer
description: Writes code
---
You are a developer.`
    );

    // Create workflow
    const workflowsDir = path.join(testDir, '.apex', 'workflows');
    await fs.writeFile(
      path.join(workflowsDir, 'feature.yaml'),
      `name: feature
description: Feature workflow
stages:
  - name: implementation
    agent: developer
    description: Implement
`
    );

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should create tasks that persist', async () => {
    const task = await orchestrator.createTask({
      description: 'Integration test task',
      workflow: 'feature',
    });

    expect(task.id).toBeDefined();
    expect(task.status).toBe('pending');

    // Should be retrievable
    const found = await orchestrator.getTask(task.id);
    expect(found).toBeDefined();
    expect(found?.description).toBe('Integration test task');
  });

  it('should list tasks with filters', async () => {
    await orchestrator.createTask({ description: 'Task 1', workflow: 'feature' });
    await orchestrator.createTask({ description: 'Task 2', workflow: 'feature' });
    await orchestrator.createTask({ description: 'Task 3', workflow: 'feature' });

    const allTasks = await orchestrator.listTasks();
    expect(allTasks.length).toBe(3);

    const limitedTasks = await orchestrator.listTasks({ limit: 2 });
    expect(limitedTasks.length).toBe(2);
  });

  it('should update task status', async () => {
    const task = await orchestrator.createTask({
      description: 'Status update test',
      workflow: 'feature',
    });

    await orchestrator.updateTaskStatus(task.id, 'in-progress');
    const updated = await orchestrator.getTask(task.id);
    expect(updated?.status).toBe('in-progress');
  });

  it('should emit events on task operations', async () => {
    const events: string[] = [];

    orchestrator.on('task:created', () => events.push('created'));

    await orchestrator.createTask({
      description: 'Event test',
      workflow: 'feature',
    });

    expect(events).toContain('created');
  });
});

// Note: Task dependencies, checkpoints, and concurrent execution tests
// are fully covered in packages/orchestrator/src/store.test.ts and index.test.ts.
// Those tests run without the API mock interference.
//
// The tests below focus on higher-level integration scenarios that don't
// conflict with the API mock (which replaces TaskStore methods).

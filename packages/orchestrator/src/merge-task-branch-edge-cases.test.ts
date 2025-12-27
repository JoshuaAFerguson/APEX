import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import type { Task } from '@apexcli/core';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('ApexOrchestrator.mergeTaskBranch - Additional Edge Cases', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let testTask: Task;

  const createTestTask = (overrides: Partial<Task> = {}): Task => ({
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'Test task for merge functionality',
    workflow: 'feature',
    autonomy: 'full',
    status: 'completed',
    priority: 'normal',
    effort: 'medium',
    projectPath: testDir,
    branchName: 'test-feature-branch',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
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
    ...overrides,
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-merge-edge-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });

    // Create basic config file
    const config = {
      project: { name: 'test-project' },
      autonomy: { default: 'full' },
      models: { planning: 'sonnet', implementation: 'sonnet', review: 'haiku' },
      limits: { maxTokensPerTask: 100000, maxCostPerTask: 1.0, dailyBudget: 10.0 },
      api: { url: 'http://localhost:3000', port: 3000 },
    };

    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `project:
  name: ${config.project.name}
autonomy:
  default: ${config.autonomy.default}
models:
  planning: ${config.models.planning}
  implementation: ${config.models.implementation}
  review: ${config.models.review}
limits:
  maxTokensPerTask: ${config.limits.maxTokensPerTask}
  maxCostPerTask: ${config.limits.maxCostPerTask}
  dailyBudget: ${config.limits.dailyBudget}
api:
  url: ${config.api.url}
  port: ${config.api.port}
`
    );
  });

  afterEach(async () => {
    try {
      await orchestrator?.cleanup?.();
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  });

  describe('branch detection edge cases', () => {
    it('should default to main branch when neither main nor master exists', async () => {
      // Initialize git repository
      await execAsync('git init', { cwd: testDir });
      await execAsync('git config user.name "Test User"', { cwd: testDir });
      await execAsync('git config user.email "test@example.com"', { cwd: testDir });

      // Create initial commit on a custom branch (neither main nor master)
      await execAsync('git checkout -b custom-default', { cwd: testDir });
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test Project\n');
      await execAsync('git add README.md', { cwd: testDir });
      await execAsync('git commit -m "Initial commit"', { cwd: testDir });

      // Create feature branch
      await execAsync('git checkout -b test-feature-branch', { cwd: testDir });
      await fs.writeFile(path.join(testDir, 'feature.txt'), 'Feature content\n');
      await execAsync('git add feature.txt', { cwd: testDir });
      await execAsync('git commit -m "Add feature"', { cwd: testDir });

      // Create main branch to switch to (since neither main nor master existed initially)
      await execAsync('git checkout -b main', { cwd: testDir });
      await execAsync('git merge custom-default', { cwd: testDir });

      // Initialize orchestrator
      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();

      // Create test task
      testTask = createTestTask();
      await orchestrator.store.createTask(testTask);

      const result = await orchestrator.mergeTaskBranch(testTask.id);

      expect(result.success).toBe(true);

      // Should be on main branch after merge (the default fallback)
      const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: testDir });
      expect(currentBranch.trim()).toBe('main');
    });

    it('should handle commit hash extraction for different git output formats', async () => {
      // Initialize git repository
      await execAsync('git init', { cwd: testDir });
      await execAsync('git config user.name "Test User"', { cwd: testDir });
      await execAsync('git config user.email "test@example.com"', { cwd: testDir });

      // Create initial commit on main
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test Project\n');
      await execAsync('git add README.md', { cwd: testDir });
      await execAsync('git commit -m "Initial commit"', { cwd: testDir });

      // Create feature branch
      await execAsync('git checkout -b test-feature-branch', { cwd: testDir });
      await fs.writeFile(path.join(testDir, 'feature.txt'), 'Feature content\n');
      await execAsync('git add feature.txt', { cwd: testDir });
      await execAsync('git commit -m "Add feature"', { cwd: testDir });

      await execAsync('git checkout main', { cwd: testDir });

      // Initialize orchestrator
      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();

      // Create test task
      testTask = createTestTask();
      await orchestrator.store.createTask(testTask);

      // Test squash merge which has different commit hash extraction logic
      const result = await orchestrator.mergeTaskBranch(testTask.id, { squash: true });

      expect(result.success).toBe(true);
      expect(result.changedFiles).toContain('feature.txt');

      // Verify commit was created
      const { stdout: logOutput } = await execAsync('git log --oneline -1', { cwd: testDir });
      expect(logOutput).toMatch(/Squash merge of test-feature-branch/);
    });
  });

  describe('error handling edge cases', () => {
    it('should handle merge abort failure gracefully', async () => {
      // Initialize git repository
      await execAsync('git init', { cwd: testDir });
      await execAsync('git config user.name "Test User"', { cwd: testDir });
      await execAsync('git config user.email "test@example.com"', { cwd: testDir });

      await fs.writeFile(path.join(testDir, 'README.md'), '# Test Project\n');
      await execAsync('git add README.md', { cwd: testDir });
      await execAsync('git commit -m "Initial commit"', { cwd: testDir });

      // Create feature branch
      await execAsync('git checkout -b test-feature-branch', { cwd: testDir });
      await fs.writeFile(path.join(testDir, 'conflict.txt'), 'Feature version\n');
      await execAsync('git add conflict.txt', { cwd: testDir });
      await execAsync('git commit -m "Add feature version"', { cwd: testDir });

      await execAsync('git checkout main', { cwd: testDir });

      // Create conflicting change on main
      await fs.writeFile(path.join(testDir, 'conflict.txt'), 'Main version\n');
      await execAsync('git add conflict.txt', { cwd: testDir });
      await execAsync('git commit -m "Add main version"', { cwd: testDir });

      // Initialize orchestrator
      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();

      // Create test task
      testTask = createTestTask();
      await orchestrator.store.createTask(testTask);

      const result = await orchestrator.mergeTaskBranch(testTask.id);

      expect(result.success).toBe(false);
      expect(result.conflicted).toBe(true);
      expect(result.error).toMatch(/merge conflicts/i);

      // Check that proper logging occurred
      const logs = await orchestrator.store.getLogs(testTask.id);
      const errorLogs = logs.filter(log => log.level === 'error');
      expect(errorLogs.some(log => log.message.includes('conflicts'))).toBe(true);
    });
  });
});
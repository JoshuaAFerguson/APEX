/**
 * Simple Browser Permission-Granted Integration Test
 *
 * Basic test to verify the test infrastructure and API usage before
 * implementing the full test suite.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { TaskStore } from '@apexcli/orchestrator';
import {
  BrowserTool,
  type BrowserParams,
  type BrowserResult,
} from '../../packages/orchestrator/src/tools/browser-tool';
import { PermissionManager } from '../../packages/orchestrator/src/permission-manager';
import { PermissionStore } from '../../packages/orchestrator/src/permission-store';
import { createTestTask } from '../../packages/orchestrator/src/__tests__/v050-integration/test-utils';

import type { Task } from '@apexcli/core';

describe('Browser Permission-Granted Simple Test', () => {
  let testDir: string;
  let taskStore: TaskStore;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let browserTool: BrowserTool;
  let testTask: Task;

  beforeEach(async () => {
    // Create test environment
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-browser-permission-test-'));

    // Initialize stores and managers
    taskStore = new TaskStore(testDir);
    await taskStore.initialize();

    permissionStore = new PermissionStore();
    permissionManager = new PermissionManager(permissionStore);

    // Create test task
    testTask = createTestTask(testDir);
    await taskStore.addTask(testTask);

    // Create browser tool
    browserTool = new BrowserTool({
      permissionManager,
      backend: 'playwright',
      engine: 'chromium',
      headless: true,
    });
  });

  afterEach(async () => {
    await browserTool?.cleanup();
    await taskStore?.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should create browser tool instance', () => {
    expect(browserTool).toBeDefined();
    expect(browserTool.execute).toBeInstanceOf(Function);
  });

  it('should navigate with permission granted', async () => {
    // Grant navigation permission
    await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');

    const params: BrowserParams = {
      operation: 'navigate',
      params: { url: 'data:text/html,<h1>Test</h1>' }
    };

    const result: BrowserResult = await browserTool.execute(params);

    expect(result.success).toBe(true);
    expect(result.operation).toBe('navigate');
  });
});
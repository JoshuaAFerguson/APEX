/**
 * Quick validation test to verify listTrashedTasks and emptyTrash implementation
 */
import { describe, it, expect, vi } from 'vitest';
import type { ApexOrchestrator } from '../index.js';

describe('Implementation Validation', () => {
  it('should have listTrashedTasks method defined', () => {
    // This test ensures the method exists and has the right signature
    const { ApexOrchestrator } = require('../index.js');
    const orchestrator = new ApexOrchestrator({
      projectPath: '/test',
      apiKey: 'test-key'
    });

    expect(typeof orchestrator.listTrashedTasks).toBe('function');
    expect(orchestrator.listTrashedTasks.constructor.name).toBe('AsyncFunction');
  });

  it('should have emptyTrash method defined', () => {
    // This test ensures the method exists and has the right signature
    const { ApexOrchestrator } = require('../index.js');
    const orchestrator = new ApexOrchestrator({
      projectPath: '/test',
      apiKey: 'test-key'
    });

    expect(typeof orchestrator.emptyTrash).toBe('function');
    expect(orchestrator.emptyTrash.constructor.name).toBe('AsyncFunction');
  });

  it('should verify method return types are correctly defined', () => {
    // TypeScript compilation check - these should not cause errors
    const dummyOrchestrator = {} as ApexOrchestrator;

    // These should be typed correctly
    const trashedTasksPromise: Promise<import('@apexcli/core').Task[]> = dummyOrchestrator.listTrashedTasks();
    const emptyTrashPromise: Promise<number> = dummyOrchestrator.emptyTrash();

    expect(trashedTasksPromise).toBeDefined();
    expect(emptyTrashPromise).toBeDefined();
  });
});
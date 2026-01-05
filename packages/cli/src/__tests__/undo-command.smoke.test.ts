/**
 * Undo Command Smoke Tests
 * Basic tests to verify the command structure and basic functionality
 */

import { describe, it, expect } from 'vitest';
import { commands } from '../index.js';

describe('Undo Command Smoke Tests', () => {
  it('should have undo command defined in commands array', () => {
    const undoCommand = commands.find(cmd => cmd.name === 'undo');

    expect(undoCommand).toBeDefined();
    expect(undoCommand!.name).toBe('undo');
    expect(undoCommand!.aliases).toContain('u');
    expect(undoCommand!.description).toContain('Undo');
    expect(undoCommand!.usage).toContain('--task-id');
    expect(undoCommand!.usage).toContain('--count');
    expect(typeof undoCommand!.handler).toBe('function');
  });

  it('should have handleUndoCommand function available', async () => {
    const undoCommand = commands.find(cmd => cmd.name === 'undo');
    expect(undoCommand!.handler).toBeInstanceOf(Function);

    // Test that the handler function can be called without throwing
    const mockContext = {
      orchestrator: null,
      cwd: '/tmp',
      initialized: false,
      config: null,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };

    // This should show "APEX not initialized" message without throwing
    await expect(undoCommand!.handler(mockContext, ['--help'])).resolves.not.toThrow();
  });

  it('should have correct command structure', () => {
    const undoCommand = commands.find(cmd => cmd.name === 'undo');

    // Verify all required command properties exist
    expect(undoCommand).toHaveProperty('name');
    expect(undoCommand).toHaveProperty('aliases');
    expect(undoCommand).toHaveProperty('description');
    expect(undoCommand).toHaveProperty('usage');
    expect(undoCommand).toHaveProperty('handler');

    // Verify property types
    expect(typeof undoCommand!.name).toBe('string');
    expect(Array.isArray(undoCommand!.aliases)).toBe(true);
    expect(typeof undoCommand!.description).toBe('string');
    expect(typeof undoCommand!.usage).toBe('string');
    expect(typeof undoCommand!.handler).toBe('function');
  });

  it('should have proper alias configuration', () => {
    const undoCommand = commands.find(cmd => cmd.name === 'undo');

    expect(undoCommand!.aliases).toEqual(['u']);
  });

  it('should have proper description', () => {
    const undoCommand = commands.find(cmd => cmd.name === 'undo');

    expect(undoCommand!.description).toBe('Undo the last tool action(s) for a task');
  });

  it('should have proper usage string', () => {
    const undoCommand = commands.find(cmd => cmd.name === 'undo');

    expect(undoCommand!.usage).toBe('/undo [--task-id <taskId>] [--count <number>]');
  });
});
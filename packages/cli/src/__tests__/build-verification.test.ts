/**
 * Build Verification Tests
 * Ensures that the undo command implementation is syntactically correct
 * and doesn't break the build
 */

import { describe, it, expect } from 'vitest';

describe('Build Verification', () => {
  it('should be able to import commands without errors', async () => {
    // This test will fail if there are syntax errors in index.ts
    const { commands } = await import('../index.js');

    expect(commands).toBeDefined();
    expect(Array.isArray(commands)).toBe(true);
    expect(commands.length).toBeGreaterThan(0);
  });

  it('should have undo command properly registered', async () => {
    const { commands } = await import('../index.js');

    const undoCommand = commands.find(cmd => cmd.name === 'undo');
    expect(undoCommand).toBeDefined();
    expect(undoCommand!.handler).toBeInstanceOf(Function);
  });

  it('should not break existing command structure', async () => {
    const { commands } = await import('../index.js');

    // Verify that other important commands still exist
    const initCommand = commands.find(cmd => cmd.name === 'init');
    const statusCommand = commands.find(cmd => cmd.name === 'status');
    const diffCommand = commands.find(cmd => cmd.name === 'diff');

    expect(initCommand).toBeDefined();
    expect(statusCommand).toBeDefined();
    expect(diffCommand).toBeDefined();
  });

  it('should have all commands with required properties', async () => {
    const { commands } = await import('../index.js');

    for (const command of commands) {
      expect(command).toHaveProperty('name');
      expect(command).toHaveProperty('aliases');
      expect(command).toHaveProperty('description');
      expect(command).toHaveProperty('usage');
      expect(command).toHaveProperty('handler');

      expect(typeof command.name).toBe('string');
      expect(Array.isArray(command.aliases)).toBe(true);
      expect(typeof command.description).toBe('string');
      expect(typeof command.usage).toBe('string');
      expect(typeof command.handler).toBe('function');
    }
  });
});
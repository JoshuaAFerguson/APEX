/**
 * Diff Command Smoke Test
 * Simple smoke test to verify the diff command exists and can be called
 */

import { describe, it, expect } from 'vitest';
import { commands } from '../index.js';

describe('Diff Command Smoke Test', () => {
  it('should have a diff command in the commands array', () => {
    const diffCommand = commands.find(cmd => cmd.name === 'diff');
    expect(diffCommand).toBeDefined();
    expect(diffCommand?.name).toBe('diff');
    expect(diffCommand?.aliases).toContain('d');
    expect(diffCommand?.description).toContain('Show code changes made by a task');
    expect(typeof diffCommand?.handler).toBe('function');
  });

  it('should have correct usage information', () => {
    const diffCommand = commands.find(cmd => cmd.name === 'diff');
    expect(diffCommand?.usage).toContain('<task_id>');
    expect(diffCommand?.usage).toContain('--stat');
    expect(diffCommand?.usage).toContain('--file');
    expect(diffCommand?.usage).toContain('--staged');
  });
});
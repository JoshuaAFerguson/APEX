/**
 * @fileoverview Basic instantiation test for BashTool
 * This test verifies that the BashTool can be constructed without errors
 */

import { describe, it, expect } from 'vitest';
import { BashTool } from '../bash-tool.js';

describe('BashTool Instantiation', () => {
  it('should instantiate without errors', () => {
    expect(() => new BashTool()).not.toThrow();
  });

  it('should have correct metadata after instantiation', () => {
    const tool = new BashTool();

    expect(tool.name).toBe('Bash');
    expect(tool.category).toBe('shell');
    expect(tool.enabled).toBe(true);

    const definition = tool.getDefinition();
    expect(definition.name).toBe('Bash');
    expect(definition.category).toBe('shell');
    expect(definition.dangerous).toBe(true);
    expect(definition.permissions).toContain('execute');
    expect(definition.parameters.type).toBe('object');
    expect(definition.parameters.required).toContain('command');
  });

  it('should export types correctly', () => {
    // This test ensures TypeScript compilation is working
    const tool = new BashTool();
    const definition = tool.getDefinition();

    // These assignments should not cause TypeScript errors
    const _category: 'shell' = definition.category;
    const _dangerous: boolean = definition.dangerous;
    const _permissions: string[] = definition.permissions;

    expect(_category).toBe('shell');
    expect(_dangerous).toBe(true);
    expect(_permissions).toContain('execute');
  });
});
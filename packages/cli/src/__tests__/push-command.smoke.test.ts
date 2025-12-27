/**
 * Smoke tests for the push command
 * Quick verification that the command is properly integrated into the CLI
 */

import { describe, it, expect } from 'vitest';
import { commands } from '../index.js';

describe('Push Command Smoke Tests', () => {
  it('should be registered in commands array', () => {
    const pushCommand = commands.find(cmd => cmd.name === 'push');
    expect(pushCommand).toBeDefined();
  });

  it('should have all required properties', () => {
    const pushCommand = commands.find(cmd => cmd.name === 'push');

    expect(pushCommand?.name).toBe('push');
    expect(pushCommand?.aliases).toEqual(['p']);
    expect(pushCommand?.description).toContain('Push');
    expect(pushCommand?.description).toContain('branch');
    expect(pushCommand?.description).toContain('remote');
    expect(pushCommand?.usage).toContain('/push');
    expect(pushCommand?.usage).toContain('<task_id>');
    expect(pushCommand?.handler).toBeTypeOf('function');
  });

  it('should have unique alias that does not conflict with other commands', () => {
    const allAliases = commands.flatMap(cmd => cmd.aliases);
    const aliasCount = allAliases.filter(alias => alias === 'p').length;

    expect(aliasCount).toBe(1);
  });

  it('should have handler function with correct signature', () => {
    const pushCommand = commands.find(cmd => cmd.name === 'push');
    expect(pushCommand?.handler).toBeTypeOf('function');
    expect(pushCommand?.handler.length).toBe(2); // (context, args)
  });

  it('should be positioned appropriately in commands list', () => {
    const pushIndex = commands.findIndex(cmd => cmd.name === 'push');
    const prIndex = commands.findIndex(cmd => cmd.name === 'pr');

    expect(pushIndex).toBeGreaterThan(-1);
    expect(prIndex).toBeGreaterThan(-1);

    // Push should be positioned after pr command (related git operations)
    expect(pushIndex).toBeGreaterThan(prIndex);
  });

  it('should have consistent naming and formatting with other commands', () => {
    const pushCommand = commands.find(cmd => cmd.name === 'push');

    // Check naming conventions
    expect(pushCommand?.name).toMatch(/^[a-z]+$/); // lowercase only
    expect(pushCommand?.description).toMatch(/^[A-Z]/); // Starts with capital
    expect(pushCommand?.usage).toMatch(/^\/[a-z]/); // Starts with slash + lowercase
  });

  describe('Command metadata validation', () => {
    it('should have appropriate description length', () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      expect(pushCommand?.description.length).toBeGreaterThan(10);
      expect(pushCommand?.description.length).toBeLessThan(100);
    });

    it('should have clear and concise usage pattern', () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      expect(pushCommand?.usage).toMatch(/^\/push\s+<[^>]+>$/);
    });

    it('should have aliases as string array', () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      expect(Array.isArray(pushCommand?.aliases)).toBe(true);
      expect(pushCommand?.aliases.every(alias => typeof alias === 'string')).toBe(true);
    });
  });

  describe('Integration with command discovery', () => {
    it('should be discoverable by name', () => {
      const foundByName = commands.filter(cmd => cmd.name === 'push');
      expect(foundByName).toHaveLength(1);
    });

    it('should be discoverable by alias', () => {
      const foundByAlias = commands.filter(cmd => cmd.aliases.includes('p'));
      expect(foundByAlias).toHaveLength(1);
      expect(foundByAlias[0]?.name).toBe('push');
    });

    it('should maintain consistent command structure with others', () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      const requiredProperties = ['name', 'aliases', 'description', 'usage', 'handler'];

      requiredProperties.forEach(prop => {
        expect(pushCommand).toHaveProperty(prop);
        expect(pushCommand?.[prop as keyof typeof pushCommand]).toBeDefined();
      });
    });
  });
});
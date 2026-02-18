import { describe, it, expect } from 'vitest';

describe('Test Validation', () => {
  it('should validate basic test setup', () => {
    expect(typeof describe).toBe('function');
    expect(typeof it).toBe('function');
    expect(typeof expect).toBe('function');
  });

  it('should validate imports work', () => {
    // Import validation - if this compiles, our imports in other test files should work too
    const modules = {
      vitest: require('vitest'),
      fs: require('fs'),
      path: require('path'),
      os: require('os'),
      crypto: require('crypto'),
    };

    expect(modules.vitest).toBeDefined();
    expect(modules.fs).toBeDefined();
    expect(modules.path).toBeDefined();
    expect(modules.os).toBeDefined();
    expect(modules.crypto).toBeDefined();
  });
});

/**
 * Verification test to ensure all import paths work correctly for the test utilities
 */

import { describe, it, expect } from 'vitest';

describe('Test Utils Import Verification', () => {
  it('should import from test-utils directory', async () => {
    const { createTestDatabase, cleanupTestDatabase } = await import('../test-utils/db');

    expect(createTestDatabase).toBeDefined();
    expect(cleanupTestDatabase).toBeDefined();
    expect(typeof createTestDatabase).toBe('function');
    expect(typeof cleanupTestDatabase).toBe('function');
  });

  it('should import from test-utils index', async () => {
    const utils = await import('../test-utils/index');

    expect(utils.createTestDatabase).toBeDefined();
    expect(utils.cleanupTestDatabase).toBeDefined();
    expect(utils.createMockTask).toBeDefined(); // From main test-utils file
  });

  it('should import from main test-utils file (backward compatibility)', async () => {
    const utils = await import('../test-utils');

    expect(utils.createTestDatabase).toBeDefined();
    expect(utils.cleanupTestDatabase).toBeDefined();
    expect(utils.createMockTask).toBeDefined();
  });

  it('should import all specific database utilities', async () => {
    const { createTestDatabase, cleanupTestDatabase, TestDatabaseContext } = await import('../test-utils/db');

    // Verify functions exist
    expect(createTestDatabase).toBeDefined();
    expect(cleanupTestDatabase).toBeDefined();

    // Verify types exist (TypeScript will catch this at compile time)
    // This test primarily ensures the import doesn't fail
    expect(typeof createTestDatabase).toBe('function');
    expect(typeof cleanupTestDatabase).toBe('function');
  });
});
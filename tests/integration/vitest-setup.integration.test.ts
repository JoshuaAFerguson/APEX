/**
 * @fileoverview Basic integration test to verify Vitest configuration
 *
 * This test validates that the integration testing infrastructure is working correctly:
 * - Vitest is properly configured
 * - Test environment is set up correctly
 * - Global test helpers are available
 * - Temporary directory management works
 *
 * This serves as a smoke test for the integration testing setup.
 */

import { describe, it, expect } from 'vitest';

describe('Integration Test Infrastructure', () => {
  it('should have vitest properly configured', () => {
    // Basic test to ensure vitest is working
    expect(1 + 1).toBe(2);
  });

  it('should have test environment set correctly', () => {
    expect(process.env.APEX_TEST_MODE).toBe('integration');
    expect(process.env.NODE_ENV).toBe('test');
  });

  it('should have global test helpers available', () => {
    // Verify global helpers are set up
    expect(globalThis.apexTestHelpers).toBeDefined();
    expect(globalThis.apexTestHelpers.createTempDir).toBeTypeOf('function');
    expect(globalThis.apexTestHelpers.cleanupAll).toBeTypeOf('function');
    expect(globalThis.apexTestHelpers.waitFor).toBeTypeOf('function');
    expect(globalThis.apexTestHelpers.createTestId).toBeTypeOf('function');
  });

  it('should create and manage temporary directories', async () => {
    const tempDir = await globalThis.apexTestHelpers.createTempDir('test-');
    expect(tempDir).toBeTruthy();
    expect(tempDir.includes('test-')).toBe(true);

    // Verify temp directory exists
    const { stat } = await import('fs/promises');
    const dirStats = await stat(tempDir);
    expect(dirStats.isDirectory()).toBe(true);
  });

  it('should create unique test IDs', () => {
    const id1 = globalThis.apexTestHelpers.createTestId();
    const id2 = globalThis.apexTestHelpers.createTestId();

    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });
});
/**
 * @fileoverview E2E Infrastructure Validation Test
 *
 * This minimal test validates that the E2E infrastructure can be imported
 * and basic functions work. It serves as a smoke test for the utilities.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  createTestEnvironment,
  cleanupTestEnvironment,
  runCLI,
  seedTestData,
  DEFAULT_SEED_DATA,
  SEED_SCENARIOS,
  quickStart,
  type TestEnvironment
} from './index';

describe('E2E Infrastructure - Basic Validation', () => {
  let testEnvironments: TestEnvironment[] = [];

  afterEach(async () => {
    for (const env of testEnvironments) {
      try {
        await env.cleanup();
      } catch {
        // Ignore cleanup errors
      }
    }
    testEnvironments = [];
    await cleanupTestEnvironment();
  });

  it('should import all required utilities', () => {
    expect(createTestEnvironment).toBeTypeOf('function');
    expect(cleanupTestEnvironment).toBeTypeOf('function');
    expect(runCLI).toBeTypeOf('function');
    expect(seedTestData).toBeTypeOf('function');
    expect(quickStart).toBeTypeOf('function');

    expect(DEFAULT_SEED_DATA).toBeDefined();
    expect(SEED_SCENARIOS).toBeDefined();
    expect(SEED_SCENARIOS.minimal).toBeDefined();
    expect(SEED_SCENARIOS.full).toBeDefined();
    expect(SEED_SCENARIOS.mcp).toBeDefined();
    expect(SEED_SCENARIOS.git).toBeDefined();
  });

  it('should create a basic test environment', async () => {
    const env = await createTestEnvironment();
    testEnvironments.push(env);

    expect(env).toBeDefined();
    expect(env.path).toBeDefined();
    expect(env.cleanup).toBeTypeOf('function');
    expect(env.hasGit).toBe(false);
    expect(env.hasApexProject).toBe(false);
  });

  it('should execute a CLI command', async () => {
    const env = await createTestEnvironment();
    testEnvironments.push(env);

    const result = await runCLI('--version', env.path);

    expect(result).toBeDefined();
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('stdout');
    expect(result).toHaveProperty('stderr');
    expect(result).toHaveProperty('exitCode');
  });

  it('should seed basic test data', async () => {
    const env = await createTestEnvironment({ initApexProject: true });
    testEnvironments.push(env);

    await seedTestData(env, SEED_SCENARIOS.minimal);

    expect(true).toBe(true); // Should not throw
  });

  it('should use quick start helper', async () => {
    const env = await quickStart('minimal');
    testEnvironments.push(env);

    expect(env.hasGit).toBe(true);
    expect(env.hasApexProject).toBe(true);
  });
});
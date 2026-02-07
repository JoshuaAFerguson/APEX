/**
 * @fileoverview TestContext Module Exports
 *
 * This module provides the TestContext factory for unique test isolation.
 * TestContext generates unique identifiers per test, provides isolated namespaces
 * for test data, and manages test-scoped resources with automatic cleanup.
 *
 * @example Basic Usage
 * ```typescript
 * import { createTestContext, type TestContext } from '@apex/core/test-fixtures';
 *
 * describe('My Feature', () => {
 *   let ctx: TestContext;
 *
 *   beforeEach(() => {
 *     ctx = createTestContext();
 *   });
 *
 *   afterEach(async () => {
 *     await ctx.cleanup();
 *   });
 *
 *   it('should create unique task IDs', () => {
 *     const taskId = ctx.uniqueTaskId();
 *     expect(taskId).toMatch(/^task_test_\d+_/);
 *   });
 * });
 * ```
 *
 * @example Hook-Based Usage
 * ```typescript
 * import { useTestContext } from '@apex/core/test-fixtures';
 *
 * describe('My Feature', () => {
 *   const { context: ctx, setup, teardown } = useTestContext();
 *
 *   beforeEach(setup);
 *   afterEach(teardown);
 *
 *   it('should have fresh context per test', () => {
 *     ctx.setData('key', 'value');
 *     expect(ctx.getData('key')).toBe('value');
 *   });
 * });
 * ```
 *
 * @example With Temp Directory
 * ```typescript
 * import { createIntegrationTestContext } from '@apex/core/test-fixtures';
 *
 * describe('Integration Tests', () => {
 *   let ctx: TestContext;
 *
 *   beforeEach(async () => {
 *     ctx = createIntegrationTestContext();
 *     await ctx.createTempDir();
 *   });
 *
 *   afterEach(() => ctx.cleanup());
 *
 *   it('should write test files', async () => {
 *     const filePath = await ctx.writeFile('config.json', '{}');
 *     expect(filePath).toContain(ctx.testId);
 *   });
 * });
 * ```
 */

// Type exports
export type {
  TestContext,
  TestContextOptions,
  TestContextFactory,
  TestContextIdGenerators,
  TestContextNamespace,
  TestContextDataStore,
  TestContextLifecycle,
  TestContextDirectories,
  UseTestContextResult,
} from './types.js';

// Factory function exports
export {
  createTestContext,
  useTestContext,
  createIntegrationTestContext,
  createUnitTestContext,
} from './test-context.js';

// Advanced isolation utilities
export {
  // Isolated execution patterns
  createIsolatedExecution,
  withIsolatedContext,
  // State tracking
  createStateTracker,
  type StateSnapshot,
  // Mock registry
  createMockRegistry,
  type MockRegistryEntry,
  // Parallel test helpers
  createResourceLock,
  withLock,
  type ResourceLock,
  // Environment isolation
  withEnvironment,
  withEnvironmentSync,
  // Test data factories
  createTestDataFactory,
  // Cleanup orchestration
  createCleanupOrchestrator,
} from './isolation-utils.js';

/**
 * Test Isolation Utilities
 *
 * Comprehensive test isolation system for parallel-safe, reproducible tests.
 * Provides unique contexts, state cleanup, and resource management.
 *
 * @module tests/test-utils/isolation
 * @see ADR-052 for architecture decisions
 *
 * ## Quick Start
 *
 * ```typescript
 * import { createIsolatedTest, withIsolation } from '../test-utils';
 *
 * // Option 1: Manual lifecycle management
 * describe('Feature', () => {
 *   let ctx: IsolatedTestContext;
 *
 *   beforeEach(async () => {
 *     ctx = await createIsolatedTest({ prefix: 'feature' });
 *   });
 *
 *   afterEach(async () => {
 *     await ctx.teardown();
 *   });
 *
 *   it('should work', async () => {
 *     const file = await ctx.files.createTempFile('test.txt');
 *     // Automatically cleaned up
 *   });
 * });
 *
 * // Option 2: Using withIsolation wrapper
 * it('should work', async () => {
 *   await withIsolation(async (ctx) => {
 *     await ctx.files.createTempFile('test.txt');
 *     // Automatically cleaned up even on error
 *   });
 * });
 *
 * // Option 3: Using factory pattern
 * describe('Feature', () => {
 *   const { setup, teardown, getContext } = createTestContextFactory();
 *
 *   beforeEach(setup);
 *   afterEach(teardown);
 *
 *   it('should work', () => {
 *     const ctx = getContext();
 *     // Use ctx
 *   });
 * });
 * ```
 *
 * ## Isolation Layers
 *
 * Each test context provides these isolation utilities:
 *
 * - **files**: Temporary file/directory management with cleanup
 * - **env**: Environment variable snapshot/restore
 * - **mocks**: Vitest mock/spy tracking and restoration
 * - **timers**: setTimeout/setInterval tracking and cleanup
 * - **processes**: Child process tracking and termination
 *
 * ## Parallel Test Support
 *
 * Tests using this isolation system can run in parallel because:
 *
 * 1. Each test gets a unique ID and temp directory
 * 2. Environment changes are isolated and restored
 * 3. All resources are tracked and cleaned up
 * 4. No shared mutable state between tests
 *
 * @example Parallel-Safe Database Test
 * ```typescript
 * it('should use isolated database', async () => {
 *   await withIsolation(async (ctx) => {
 *     // ctx.dbPath is unique to this test
 *     const db = new Database(ctx.dbPath);
 *     await db.init();
 *
 *     // Database operations...
 *
 *     db.close();
 *   }, { withDatabase: true });
 * });
 * ```
 */

// Export types
export type {
  IsolatedTestContext,
  IsolationOptions,
  CleanupFn,
  CleanupRegistration,
  CleanupResult,
  FileSystemIsolation,
  EnvironmentIsolation,
  MockIsolation,
  TimerIsolation,
  ProcessIsolation,
  WithIsolationOptions,
  CreateIsolatedTestFn,
  WithIsolationFn,
} from './types';

export { CleanupPriority } from './types';

// Export context utilities
export {
  createIsolatedTest,
  withIsolation,
  createTestContextFactory,
  generateTestId,
  IsolatedTestContextImpl,
} from './context';

// Export individual isolation utilities for advanced use cases
export {
  FileSystemIsolationImpl,
  createFileSystemIsolation,
} from './file-system';

export {
  EnvironmentIsolationImpl,
  createEnvironmentIsolation,
} from './environment';

export {
  MockIsolationImpl,
  createMockIsolation,
} from './mocks';

export {
  TimerIsolationImpl,
  createTimerIsolation,
} from './timers';

export {
  ProcessIsolationImpl,
  createProcessIsolation,
} from './processes';

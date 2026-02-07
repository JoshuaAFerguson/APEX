/**
 * Environment Variable Isolation Utilities
 *
 * Provides isolated environment variable management for tests.
 * Captures original values before modification and restores them during cleanup.
 *
 * @module tests/test-utils/isolation/environment
 * @see ADR-052 for architecture decisions
 *
 * @example
 * ```typescript
 * const env = new EnvironmentIsolationImpl();
 *
 * // Set environment variables - originals are captured
 * env.setEnv('API_KEY', 'test-key');
 * env.setEnv('DEBUG', 'true');
 *
 * // Delete an environment variable
 * env.deleteEnv('SOME_VAR');
 *
 * // Restore all to original values
 * env.restore();
 * ```
 */

import type { EnvironmentIsolation } from './types';

/**
 * Implementation of EnvironmentIsolation.
 *
 * Manages environment variables with:
 * - Automatic capture of original values before modification
 * - Support for setting and deleting variables
 * - Full restoration to original state
 * - Tracking of all modifications for debugging
 */
export class EnvironmentIsolationImpl implements EnvironmentIsolation {
  /**
   * Map of original environment variable values.
   * Key is the variable name, value is the original value (undefined if not set).
   */
  private originalValues: Map<string, string | undefined> = new Map();

  /**
   * Set of keys that were modified (for getModified).
   */
  private modifiedKeys: Set<string> = new Set();

  /**
   * Whether restoration has been performed.
   */
  private isRestored = false;

  /**
   * Set an environment variable.
   *
   * The original value is captured before modification, allowing restoration.
   * If called multiple times for the same key, only the first original value is preserved.
   *
   * @param key - Environment variable name
   * @param value - Value to set
   *
   * @example
   * ```typescript
   * env.setEnv('NODE_ENV', 'test');
   * env.setEnv('DEBUG', 'true');
   *
   * // Now process.env.NODE_ENV === 'test'
   * // Now process.env.DEBUG === 'true'
   * ```
   */
  setEnv(key: string, value: string): void {
    this.ensureNotRestored();

    // Capture original value only on first modification
    if (!this.originalValues.has(key)) {
      this.originalValues.set(key, process.env[key]);
    }

    process.env[key] = value;
    this.modifiedKeys.add(key);
  }

  /**
   * Delete an environment variable.
   *
   * The original value is captured before deletion, allowing restoration.
   *
   * @param key - Environment variable name
   *
   * @example
   * ```typescript
   * env.deleteEnv('SOME_SECRET');
   *
   * // Now process.env.SOME_SECRET === undefined
   * ```
   */
  deleteEnv(key: string): void {
    this.ensureNotRestored();

    // Capture original value only on first modification
    if (!this.originalValues.has(key)) {
      this.originalValues.set(key, process.env[key]);
    }

    delete process.env[key];
    this.modifiedKeys.add(key);
  }

  /**
   * Get current snapshot of modified environment variables.
   *
   * Returns a record of all variables that have been modified through this
   * instance, with their current values.
   *
   * @returns Record of modified variable names to their current values
   *
   * @example
   * ```typescript
   * env.setEnv('A', '1');
   * env.setEnv('B', '2');
   * env.deleteEnv('C');
   *
   * const modified = env.getModified();
   * // { A: '1', B: '2', C: undefined }
   * ```
   */
  getModified(): Record<string, string | undefined> {
    const result: Record<string, string | undefined> = {};

    for (const key of this.modifiedKeys) {
      result[key] = process.env[key];
    }

    return result;
  }

  /**
   * Restore all environment variables to their original values.
   *
   * - Variables that existed before are restored to their original values
   * - Variables that didn't exist before are deleted
   * - Can only be called once
   *
   * @example
   * ```typescript
   * // Before: NODE_ENV='development', DEBUG undefined
   * env.setEnv('NODE_ENV', 'test');
   * env.setEnv('DEBUG', 'true');
   *
   * // Now: NODE_ENV='test', DEBUG='true'
   *
   * env.restore();
   *
   * // After: NODE_ENV='development', DEBUG undefined
   * ```
   */
  restore(): void {
    if (this.isRestored) {
      return;
    }

    for (const [key, originalValue] of this.originalValues) {
      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
    }

    this.originalValues.clear();
    this.modifiedKeys.clear();
    this.isRestored = true;
  }

  /**
   * Get the count of modified variables.
   *
   * @returns Number of variables that have been modified
   */
  getModifiedCount(): number {
    return this.modifiedKeys.size;
  }

  /**
   * Check if a specific variable has been modified.
   *
   * @param key - Environment variable name
   * @returns True if the variable has been modified through this instance
   */
  hasModified(key: string): boolean {
    return this.modifiedKeys.has(key);
  }

  /**
   * Ensure restoration hasn't been performed.
   * @throws Error if restoration has already been performed
   */
  private ensureNotRestored(): void {
    if (this.isRestored) {
      throw new Error('EnvironmentIsolation has already been restored');
    }
  }
}

/**
 * Create a new environment isolation instance.
 *
 * @returns New EnvironmentIsolation instance
 *
 * @example
 * ```typescript
 * const env = createEnvironmentIsolation();
 * env.setEnv('TEST_VAR', 'value');
 * // ...
 * env.restore();
 * ```
 */
export function createEnvironmentIsolation(): EnvironmentIsolation {
  return new EnvironmentIsolationImpl();
}

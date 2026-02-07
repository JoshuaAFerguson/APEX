/**
 * Browser Permissions Test Setup
 *
 * Global setup and configuration for browser permission integration tests.
 * Provides common utilities and ensures consistent test environment.
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Global test state
declare global {
  var __BROWSER_PERMISSION_TEST_STATE__: {
    testStartTime: number;
    temporaryDirectories: string[];
    eventEmitters: EventEmitter[];
    activeResources: any[];
  };
}

// Initialize global test state
globalThis.__BROWSER_PERMISSION_TEST_STATE__ = {
  testStartTime: 0,
  temporaryDirectories: [],
  eventEmitters: [],
  activeResources: [],
};

/**
 * Global setup - runs once before all tests
 */
beforeAll(async () => {
  console.log('🚀 Starting Browser Permission Integration Tests');

  globalThis.__BROWSER_PERMISSION_TEST_STATE__.testStartTime = Date.now();

  // Verify required dependencies are available
  try {
    await import('playwright');
    console.log('✅ Playwright available');
  } catch (error) {
    console.warn('⚠️  Playwright not available, some tests may use mocks');
  }

  try {
    await import('puppeteer');
    console.log('✅ Puppeteer available');
  } catch (error) {
    console.warn('⚠️  Puppeteer not available, tests will use Playwright only');
  }

  // Create base temporary directory for all tests
  const baseTestDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-browser-permissions-'));
  globalThis.__BROWSER_PERMISSION_TEST_STATE__.temporaryDirectories.push(baseTestDir);

  console.log(`📁 Test directory: ${baseTestDir}`);
});

/**
 * Global teardown - runs once after all tests
 */
afterAll(async () => {
  const testDuration = Date.now() - globalThis.__BROWSER_PERMISSION_TEST_STATE__.testStartTime;
  console.log(`✅ Browser Permission Tests completed in ${testDuration}ms`);

  // Clean up all temporary directories
  for (const dir of globalThis.__BROWSER_PERMISSION_TEST_STATE__.temporaryDirectories) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      console.log(`🗑️  Cleaned up: ${dir}`);
    } catch (error) {
      console.warn(`⚠️  Failed to clean up ${dir}:`, error);
    }
  }

  // Clean up any remaining resources
  for (const resource of globalThis.__BROWSER_PERMISSION_TEST_STATE__.activeResources) {
    try {
      if (resource.cleanup && typeof resource.cleanup === 'function') {
        await resource.cleanup();
      }
      if (resource.close && typeof resource.close === 'function') {
        await resource.close();
      }
      if (resource.destroy && typeof resource.destroy === 'function') {
        await resource.destroy();
      }
    } catch (error) {
      console.warn('⚠️  Error cleaning up resource:', error);
    }
  }

  // Remove all event listeners
  for (const emitter of globalThis.__BROWSER_PERMISSION_TEST_STATE__.eventEmitters) {
    try {
      emitter.removeAllListeners();
    } catch (error) {
      console.warn('⚠️  Error removing event listeners:', error);
    }
  }

  console.log('🧹 Cleanup completed');
});

/**
 * Per-test setup - runs before each test
 */
beforeEach(async () => {
  // Reset console methods to avoid interference
  const originalMethods = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  // Restore after each test
  return () => {
    Object.assign(console, originalMethods);
  };
});

/**
 * Per-test teardown - runs after each test
 */
afterEach(async () => {
  // Clean up any resources created during the test
  const state = globalThis.__BROWSER_PERMISSION_TEST_STATE__;

  // Remove event emitters that might have been created during test
  state.eventEmitters = state.eventEmitters.filter(emitter => {
    try {
      emitter.removeAllListeners();
      return false; // Remove from array
    } catch {
      return true; // Keep if cleanup failed
    }
  });

  // Force garbage collection if available (Node.js with --expose-gc)
  if (global.gc) {
    global.gc();
  }
});

/**
 * Utility function to register a temporary directory for cleanup
 */
export function registerTempDirectory(dir: string): void {
  globalThis.__BROWSER_PERMISSION_TEST_STATE__.temporaryDirectories.push(dir);
}

/**
 * Utility function to register an event emitter for cleanup
 */
export function registerEventEmitter(emitter: EventEmitter): void {
  globalThis.__BROWSER_PERMISSION_TEST_STATE__.eventEmitters.push(emitter);
}

/**
 * Utility function to register a resource for cleanup
 */
export function registerResource(resource: any): void {
  globalThis.__BROWSER_PERMISSION_TEST_STATE__.activeResources.push(resource);
}

/**
 * Utility function to create a test-scoped temporary directory
 */
export async function createTestTempDir(prefix: string = 'test-'): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `apex-${prefix}`));
  registerTempDirectory(tempDir);
  return tempDir;
}

/**
 * Utility function to wait for a condition with timeout
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Utility function to create a promise that resolves after a delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Utility to check if a specific browser backend is available
 */
export async function isBrowserAvailable(backend: 'playwright' | 'puppeteer'): Promise<boolean> {
  try {
    if (backend === 'playwright') {
      await import('playwright');
      return true;
    } else if (backend === 'puppeteer') {
      await import('puppeteer');
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Test environment information
 */
export const testEnvironment = {
  isCI: !!process.env.CI,
  nodeVersion: process.version,
  platform: process.platform,
  arch: process.arch,
  testType: 'browser-permissions',
} as const;

// Log test environment info
console.log('📋 Test Environment:', {
  nodeVersion: testEnvironment.nodeVersion,
  platform: testEnvironment.platform,
  isCI: testEnvironment.isCI,
});

// Export test state for access in tests
export const testState = globalThis.__BROWSER_PERMISSION_TEST_STATE__;
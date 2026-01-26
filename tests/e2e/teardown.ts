/**
 * @fileoverview Global teardown for APEX E2E tests
 *
 * This teardown file ensures complete cleanup of global resources that
 * may persist beyond individual test suites. It complements the setup.ts
 * afterAll hooks by providing a final cleanup layer.
 *
 * Responsibilities:
 * 1. Force cleanup of any remaining temporary directories
 * 2. Kill orphaned processes that might have been spawned during tests
 * 3. Clean up any global mock states
 * 4. Verify no test resources are leaked
 * 5. Reset global environment variables
 *
 * This runs AFTER all test files have completed, providing a final
 * safety net for resource cleanup.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

/**
 * Global teardown function
 * This runs once after all test files have completed
 */
export default async function globalTeardown(): Promise<void> {
  console.log('🧹 Running global E2E teardown...');

  try {
    // 1. Clean up any remaining APEX-related temp directories
    await cleanupOrphanedTempDirs();

    // 2. Kill any orphaned processes that might be lingering
    await killOrphanedProcesses();

    // 3. Clean up global mock states and restore environment
    cleanupGlobalState();

    // 4. Verify no SQLite databases are still locked
    await verifyDatabaseCleanup();

    console.log('✅ Global E2E teardown completed successfully');
  } catch (error) {
    console.error('❌ Global E2E teardown encountered errors:', error);
    // Don't throw - we want tests to complete even if cleanup has issues
  }
}

/**
 * Clean up orphaned temporary directories that may have been created
 * by tests but not properly cleaned up
 */
async function cleanupOrphanedTempDirs(): Promise<void> {
  try {
    const tempDir = os.tmpdir();
    const entries = await fs.readdir(tempDir, { withFileTypes: true });

    const apexTempDirs = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .filter(name =>
        name.startsWith('apex-e2e-') ||
        name.startsWith('apex-e2e-repo-') ||
        name.startsWith('apex-e2e-bare-')
      );

    for (const dirName of apexTempDirs) {
      const dirPath = path.join(tempDir, dirName);
      try {
        await fs.rm(dirPath, { recursive: true, force: true });
        console.log(`🗑️  Cleaned up orphaned temp directory: ${dirName}`);
      } catch {
        // Ignore errors - directory may already be deleted or in use
      }
    }
  } catch (error) {
    console.warn('Warning: Could not clean up orphaned temp directories:', error);
  }
}

/**
 * Kill any orphaned Node.js processes that might have been spawned during E2E tests
 */
async function killOrphanedProcesses(): Promise<void> {
  try {
    // Only run on Unix-like systems
    if (process.platform === 'win32') {
      return;
    }

    // Look for orphaned apex processes (CLI instances that might be hanging)
    const command = "ps aux | grep -E 'apex|node.*packages/cli' | grep -v grep | awk '{print $2}'";
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim();

    if (result) {
      const pids = result.split('\n').filter(pid => pid && !isNaN(Number(pid)));
      for (const pid of pids) {
        try {
          // Only kill if it's not the current process or parent
          if (Number(pid) !== process.pid && Number(pid) !== process.ppid) {
            process.kill(Number(pid), 'SIGTERM');
            console.log(`🔪 Killed orphaned process: ${pid}`);
          }
        } catch {
          // Process may already be dead or not accessible
        }
      }
    }
  } catch {
    // Ignore errors - this is best-effort cleanup
  }
}

/**
 * Clean up global state and restore environment variables
 */
function cleanupGlobalState(): void {
  try {
    // Reset test-specific environment variables
    delete process.env.APEX_TEST_MODE;
    delete process.env.NO_COLOR;

    // Clear any global variables that might have been set
    if ('apexE2EHelpers' in globalThis) {
      // The helpers object may have cleanup methods we should call
      try {
        (globalThis as any).apexE2EHelpers?.cleanupAll?.();
      } catch {
        // Ignore cleanup errors
      }
    }

    console.log('🔄 Global state cleaned up');
  } catch (error) {
    console.warn('Warning: Could not clean up global state:', error);
  }
}

/**
 * Verify that no SQLite databases are still locked from E2E tests
 */
async function verifyDatabaseCleanup(): Promise<void> {
  try {
    const tempDir = os.tmpdir();
    const entries = await fs.readdir(tempDir, { withFileTypes: true });

    // Look for any .db files in temp directories
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('apex-e2e-')) {
        const dirPath = path.join(tempDir, entry.name);
        try {
          const dirEntries = await fs.readdir(dirPath);
          const dbFiles = dirEntries.filter(file => file.endsWith('.db'));

          if (dbFiles.length > 0) {
            console.log(`📋 Found database files in ${entry.name}: ${dbFiles.join(', ')}`);
            // Don't delete - let the directory cleanup handle this
          }
        } catch {
          // Directory may not be accessible
        }
      }
    }
  } catch (error) {
    console.warn('Warning: Could not verify database cleanup:', error);
  }
}
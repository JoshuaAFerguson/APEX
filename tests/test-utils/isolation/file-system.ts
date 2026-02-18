/**
 * File System Isolation Utilities
 *
 * Provides isolated file system operations for tests with automatic cleanup.
 * All created files and directories are tracked and removed during teardown.
 *
 * @module tests/test-utils/isolation/file-system
 * @see ADR-052 for architecture decisions
 *
 * @example
 * ```typescript
 * const files = new FileSystemIsolationImpl('/tmp/test-abc123');
 *
 * // Create temporary files - automatically tracked
 * const configPath = await files.createTempFile('config.json', '{}');
 * const dataDir = await files.createTempDir('data');
 *
 * // Track external paths for cleanup
 * files.trackPath('/some/external/file');
 *
 * // Cleanup removes all tracked paths
 * await files.cleanup();
 * ```
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { FileSystemIsolation } from './types';

/**
 * Implementation of FileSystemIsolation.
 *
 * Manages temporary files and directories with:
 * - Automatic tracking of all created paths
 * - Nested directory creation
 * - Error-tolerant cleanup (paths that don't exist are silently skipped)
 * - Cleanup ordering (files before directories)
 */
export class FileSystemIsolationImpl implements FileSystemIsolation {
  /** Set of tracked paths for cleanup */
  private trackedPaths: Set<string> = new Set();

  /** Whether cleanup has been performed */
  private isCleanedUp = false;

  /**
   * Create a new FileSystemIsolation instance.
   *
   * @param baseTempDir - Base directory for all temporary files
   *
   * @example
   * ```typescript
   * const files = new FileSystemIsolationImpl('/tmp/test-123');
   * ```
   */
  constructor(public readonly baseTempDir: string) {
    // Track the base directory for final cleanup
    this.trackedPaths.add(baseTempDir);
  }

  /**
   * Create a temporary subdirectory within the base temp directory.
   *
   * @param prefix - Optional prefix for the directory name (default: 'dir')
   * @returns Promise resolving to the full path of the created directory
   *
   * @example
   * ```typescript
   * const dataDir = await files.createTempDir('data');
   * // Returns: /tmp/test-123/data-1707302400000-abc
   * ```
   */
  async createTempDir(prefix = 'dir'): Promise<string> {
    this.ensureNotCleanedUp();

    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const dirPath = path.join(this.baseTempDir, `${prefix}-${uniqueId}`);

    await fs.mkdir(dirPath, { recursive: true });
    this.trackedPaths.add(dirPath);

    return dirPath;
  }

  /**
   * Create a temporary file with optional content.
   *
   * The file is created within the base temp directory. Subdirectories
   * in the name are automatically created.
   *
   * @param name - File name (can include subdirectory path, e.g., 'subdir/file.txt')
   * @param content - Optional file content (default: empty string)
   * @returns Promise resolving to the full path of the created file
   *
   * @example
   * ```typescript
   * // Simple file
   * const path1 = await files.createTempFile('config.json', '{"key": "value"}');
   *
   * // Nested path (subdirectory created automatically)
   * const path2 = await files.createTempFile('data/users.json', '[]');
   * ```
   */
  async createTempFile(name: string, content = ''): Promise<string> {
    this.ensureNotCleanedUp();

    const filePath = path.join(this.baseTempDir, name);
    const dirPath = path.dirname(filePath);

    // Create parent directories if needed
    await fs.mkdir(dirPath, { recursive: true });

    // Write file content
    await fs.writeFile(filePath, content, 'utf8');
    this.trackedPaths.add(filePath);

    // Track parent directories for cleanup (except base)
    let currentDir = dirPath;
    while (currentDir !== this.baseTempDir && currentDir.startsWith(this.baseTempDir)) {
      this.trackedPaths.add(currentDir);
      currentDir = path.dirname(currentDir);
    }

    return filePath;
  }

  /**
   * Track an external path for cleanup.
   *
   * Use this to track paths created outside of this utility
   * that should be cleaned up during teardown.
   *
   * @param filePath - Path to track (file or directory)
   *
   * @example
   * ```typescript
   * // Track a file created by external code
   * files.trackPath('/tmp/external-file.txt');
   * ```
   */
  trackPath(filePath: string): void {
    this.ensureNotCleanedUp();
    this.trackedPaths.add(filePath);
  }

  /**
   * Get all tracked paths.
   *
   * @returns Array of all tracked paths
   *
   * @example
   * ```typescript
   * const paths = files.getTrackedPaths();
   * console.log(`Tracking ${paths.length} paths for cleanup`);
   * ```
   */
  getTrackedPaths(): string[] {
    return Array.from(this.trackedPaths);
  }

  /**
   * Clean up all tracked paths.
   *
   * Removes all tracked files and directories in safe order:
   * 1. Sort paths by depth (deepest first)
   * 2. Remove files before directories
   * 3. Silently skip paths that don't exist
   *
   * @example
   * ```typescript
   * await files.cleanup();
   * // All tracked paths are now removed
   * ```
   */
  async cleanup(): Promise<void> {
    if (this.isCleanedUp) {
      return;
    }

    const errors: Error[] = [];

    // Sort paths by depth (deepest first) to handle nested structures
    const sortedPaths = Array.from(this.trackedPaths).sort((a, b) => {
      const depthA = a.split(path.sep).length;
      const depthB = b.split(path.sep).length;
      return depthB - depthA;
    });

    for (const trackedPath of sortedPaths) {
      try {
        const stats = await fs.stat(trackedPath).catch(() => null);
        if (!stats) {
          // Path doesn't exist, skip
          continue;
        }

        if (stats.isDirectory()) {
          await fs.rm(trackedPath, { recursive: true, force: true });
        } else {
          await fs.unlink(trackedPath);
        }
      } catch (error) {
        // Collect errors but continue cleanup
        if (error instanceof Error && (error as NodeJS.ErrnoException).code !== 'ENOENT') {
          errors.push(new Error(`Failed to cleanup ${trackedPath}: ${error.message}`));
        }
      }
    }

    this.trackedPaths.clear();
    this.isCleanedUp = true;

    if (errors.length > 0) {
      const combinedMessage = errors.map(e => e.message).join('; ');
      console.warn(`FileSystemIsolation cleanup warnings: ${combinedMessage}`);
    }
  }

  /**
   * Ensure cleanup hasn't been performed.
   * @throws Error if cleanup has already been performed
   */
  private ensureNotCleanedUp(): void {
    if (this.isCleanedUp) {
      throw new Error('FileSystemIsolation has already been cleaned up');
    }
  }
}

/**
 * Create a new file system isolation instance with a unique temp directory.
 *
 * @param prefix - Prefix for the temp directory (default: 'test')
 * @param tempBase - Base temp directory (default: os.tmpdir())
 * @returns Promise resolving to FileSystemIsolation instance
 *
 * @example
 * ```typescript
 * const files = await createFileSystemIsolation('my-test');
 * const configPath = await files.createTempFile('config.json', '{}');
 * // ...
 * await files.cleanup();
 * ```
 */
export async function createFileSystemIsolation(
  prefix = 'test',
  tempBase?: string
): Promise<FileSystemIsolation> {
  const base = tempBase || os.tmpdir();
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const tempDir = path.join(base, `${prefix}-${uniqueId}`);

  await fs.mkdir(tempDir, { recursive: true });

  return new FileSystemIsolationImpl(tempDir);
}

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Creates a temporary directory for testing
 * @returns The path to the temporary directory
 */
export function createTempDirectory(): string {
  // For simplicity, return a synchronous temp path - will be created in beforeEach
  return '';
}

/**
 * Creates a temporary directory asynchronously
 * @param prefix Optional prefix for the temp directory name
 * @returns Promise resolving to the path of the temporary directory
 */
export async function createTempDirectoryAsync(prefix = 'apex-test-'): Promise<string> {
  const testDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
  return testDir;
}

/**
 * Removes a temporary directory and all its contents
 * @param dirPath Path to the directory to remove
 */
export async function removeTempDirectory(dirPath: string): Promise<void> {
  if (dirPath && dirPath !== '/' && dirPath.includes('tmp')) {
    await fs.rm(dirPath, { recursive: true, force: true });
  }
}

/**
 * Helper to remove a temporary directory synchronously (placeholder)
 * @param dirPath Path to the directory to remove
 */
export function removeTempDirectorySync(dirPath: string): void {
  // This will be handled by the async version in afterEach
}
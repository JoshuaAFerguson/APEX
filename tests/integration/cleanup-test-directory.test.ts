import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { findApexTestDirectories, removeDirectory } from '../../scripts/cleanup-test-directory.mjs';

describe('Cleanup Test Directory Utility', () => {
  const testBaseDir = 'test-cleanup-temp';

  beforeEach(async () => {
    // Clean up any existing test directory
    try {
      await fs.rm(testBaseDir, { recursive: true, force: true });
    } catch {
      // Directory doesn't exist, that's fine
    }
  });

  afterEach(async () => {
    // Clean up test directory after each test
    try {
      await fs.rm(testBaseDir, { recursive: true, force: true });
    } catch {
      // Directory doesn't exist, that's fine
    }
  });

  describe('findApexTestDirectories', () => {
    it('should find .apex-test directories', async () => {
      // Create test structure
      const apexTestDir = path.join(testBaseDir, '.apex-test');
      await fs.mkdir(apexTestDir, { recursive: true });
      await fs.writeFile(path.join(apexTestDir, 'test.txt'), 'test content');

      const result = await findApexTestDirectories(testBaseDir);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(path.resolve(apexTestDir));
    });

    it('should find nested .apex-test directories', async () => {
      // Create nested test structure
      const nestedDir = path.join(testBaseDir, 'subdir', '.apex-test');
      await fs.mkdir(nestedDir, { recursive: true });
      await fs.writeFile(path.join(nestedDir, 'test.txt'), 'test content');

      const result = await findApexTestDirectories(testBaseDir);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(path.resolve(nestedDir));
    });

    it('should find multiple .apex-test directories', async () => {
      // Create multiple test directories
      const dir1 = path.join(testBaseDir, 'dir1', '.apex-test');
      const dir2 = path.join(testBaseDir, 'dir2', '.apex-test');

      await fs.mkdir(dir1, { recursive: true });
      await fs.mkdir(dir2, { recursive: true });

      const result = await findApexTestDirectories(testBaseDir);

      expect(result).toHaveLength(2);
      expect(result).toContain(path.resolve(dir1));
      expect(result).toContain(path.resolve(dir2));
    });

    it('should return empty array when no .apex-test directories exist', async () => {
      // Create test directory without .apex-test
      await fs.mkdir(testBaseDir, { recursive: true });
      await fs.writeFile(path.join(testBaseDir, 'regular-file.txt'), 'content');

      const result = await findApexTestDirectories(testBaseDir);

      expect(result).toHaveLength(0);
    });

    it('should handle non-existent directory gracefully', async () => {
      const result = await findApexTestDirectories('non-existent-directory');

      expect(result).toHaveLength(0);
    });
  });

  describe('removeDirectory', () => {
    it('should remove existing directory', async () => {
      // Create test directory
      const testDir = path.join(testBaseDir, '.apex-test');
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(path.join(testDir, 'test.txt'), 'test content');

      // Verify directory exists
      await expect(fs.stat(testDir)).resolves.toBeDefined();

      // Remove directory
      await removeDirectory(testDir);

      // Verify directory is gone
      await expect(fs.stat(testDir)).rejects.toThrow();
    });

    it('should handle non-existent directory gracefully', async () => {
      const nonExistentDir = path.join(testBaseDir, 'non-existent');

      // Should not throw an error
      await expect(removeDirectory(nonExistentDir)).resolves.toBeUndefined();
    });

    it('should remove directory with nested content', async () => {
      // Create nested test structure
      const testDir = path.join(testBaseDir, '.apex-test');
      const nestedDir = path.join(testDir, 'nested', 'deep');

      await fs.mkdir(nestedDir, { recursive: true });
      await fs.writeFile(path.join(nestedDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');

      // Remove directory
      await removeDirectory(testDir);

      // Verify entire structure is gone
      await expect(fs.stat(testDir)).rejects.toThrow();
    });
  });

  describe('Cross-platform compatibility', () => {
    it('should handle paths with different separators', async () => {
      const testDir = path.join(testBaseDir, '.apex-test');
      await fs.mkdir(testDir, { recursive: true });

      // Test with both normalized and non-normalized paths
      const normalizedPath = path.resolve(testDir);

      await removeDirectory(normalizedPath);
      await expect(fs.stat(testDir)).rejects.toThrow();
    });
  });
});
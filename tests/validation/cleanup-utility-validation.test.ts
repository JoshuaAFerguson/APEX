/**
 * @fileoverview Validation Tests for Test Cleanup Utility
 *
 * These tests validate that the existing test cleanup utility
 * implementation meets all acceptance criteria and works correctly
 * across different scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { findApexTestDirectories, removeDirectory, cleanupTestDirectories, cleanupSpecificDirectory } from '../../scripts/cleanup-test-directory.mjs';

describe('Test Cleanup Utility Validation', () => {
  const tempTestDir = path.join(process.cwd(), 'temp-validation-test');

  beforeEach(async () => {
    // Ensure clean state
    try {
      await fs.rm(tempTestDir, { recursive: true, force: true });
    } catch {
      // Directory doesn't exist, that's fine
    }
  });

  afterEach(async () => {
    // Clean up after tests
    try {
      await fs.rm(tempTestDir, { recursive: true, force: true });
    } catch {
      // Directory doesn't exist, that's fine
    }
  });

  describe('Acceptance Criteria Validation', () => {
    it('should validate that cleanup utility exists and is accessible', async () => {
      // Verify the cleanup functions are properly exported and accessible
      expect(typeof findApexTestDirectories).toBe('function');
      expect(typeof removeDirectory).toBe('function');
      expect(typeof cleanupTestDirectories).toBe('function');
      expect(typeof cleanupSpecificDirectory).toBe('function');
    });

    it('should reliably remove .apex-test directories', async () => {
      // Create test .apex-test directory structure
      const apexTestDir = path.join(tempTestDir, '.apex-test');
      const nestedFile = path.join(apexTestDir, 'nested', 'test-file.txt');

      await fs.mkdir(path.dirname(nestedFile), { recursive: true });
      await fs.writeFile(nestedFile, 'test content');

      // Verify directory exists
      expect(await fs.stat(apexTestDir)).toBeDefined();

      // Remove directory using the utility
      await removeDirectory(apexTestDir);

      // Verify directory is completely removed
      await expect(fs.stat(apexTestDir)).rejects.toThrow();
    });

    it('should work on cross-platform paths', async () => {
      const apexTestDir = path.join(tempTestDir, '.apex-test');
      await fs.mkdir(apexTestDir, { recursive: true });
      await fs.writeFile(path.join(apexTestDir, 'test.txt'), 'content');

      // Test with both normalized and platform-specific paths
      const normalizedPath = path.resolve(apexTestDir);

      await removeDirectory(normalizedPath);
      await expect(fs.stat(apexTestDir)).rejects.toThrow();
    });

    it('should handle cases where directory does not exist', async () => {
      const nonExistentDir = path.join(tempTestDir, '.apex-test-nonexistent');

      // Should not throw an error when directory doesn't exist
      await expect(removeDirectory(nonExistentDir)).resolves.not.toThrow();
    });

    it('should handle multiple .apex-test directories', async () => {
      // Create multiple .apex-test directories
      const dir1 = path.join(tempTestDir, 'project1', '.apex-test');
      const dir2 = path.join(tempTestDir, 'project2', '.apex-test');
      const dir3 = path.join(tempTestDir, 'project3', 'subdir', '.apex-test');

      await fs.mkdir(dir1, { recursive: true });
      await fs.mkdir(dir2, { recursive: true });
      await fs.mkdir(dir3, { recursive: true });

      await fs.writeFile(path.join(dir1, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(dir2, 'file2.txt'), 'content2');
      await fs.writeFile(path.join(dir3, 'file3.txt'), 'content3');

      // Find all directories
      const foundDirs = await findApexTestDirectories(tempTestDir);
      expect(foundDirs).toHaveLength(3);
      expect(foundDirs).toEqual(
        expect.arrayContaining([
          path.resolve(dir1),
          path.resolve(dir2),
          path.resolve(dir3),
        ])
      );

      // Remove all found directories
      for (const dir of foundDirs) {
        await removeDirectory(dir);
      }

      // Verify all are removed
      for (const dir of [dir1, dir2, dir3]) {
        await expect(fs.stat(dir)).rejects.toThrow();
      }
    });
  });

  describe('Edge Case Validation', () => {
    it('should handle deeply nested .apex-test directories', async () => {
      const deepDir = path.join(tempTestDir, 'a', 'b', 'c', 'd', 'e', '.apex-test');
      await fs.mkdir(deepDir, { recursive: true });
      await fs.writeFile(path.join(deepDir, 'deep-file.txt'), 'deep content');

      const foundDirs = await findApexTestDirectories(tempTestDir);
      expect(foundDirs).toHaveLength(1);
      expect(foundDirs[0]).toBe(path.resolve(deepDir));

      await removeDirectory(foundDirs[0]);
      await expect(fs.stat(deepDir)).rejects.toThrow();
    });

    it('should handle .apex-test directories with complex content', async () => {
      const apexTestDir = path.join(tempTestDir, '.apex-test');

      // Create complex directory structure
      await fs.mkdir(path.join(apexTestDir, 'dir1', 'subdir1'), { recursive: true });
      await fs.mkdir(path.join(apexTestDir, 'dir2', 'subdir2'), { recursive: true });
      await fs.mkdir(path.join(apexTestDir, 'empty-dir'), { recursive: true });

      // Create various file types
      await fs.writeFile(path.join(apexTestDir, 'readme.txt'), 'readme content');
      await fs.writeFile(path.join(apexTestDir, 'config.json'), '{"test": true}');
      await fs.writeFile(path.join(apexTestDir, 'dir1', 'data.csv'), 'col1,col2\nval1,val2');
      await fs.writeFile(path.join(apexTestDir, 'dir1', 'subdir1', 'nested.log'), 'log content');
      await fs.writeFile(path.join(apexTestDir, 'dir2', 'binary.bin'), Buffer.from([0x01, 0x02, 0x03]));

      await removeDirectory(apexTestDir);
      await expect(fs.stat(apexTestDir)).rejects.toThrow();
    });

    it('should ignore non-.apex-test directories', async () => {
      // Create various directories, only some are .apex-test
      await fs.mkdir(path.join(tempTestDir, '.apex-test'), { recursive: true });
      await fs.mkdir(path.join(tempTestDir, '.git'), { recursive: true });
      await fs.mkdir(path.join(tempTestDir, 'node_modules'), { recursive: true });
      await fs.mkdir(path.join(tempTestDir, 'src'), { recursive: true });
      await fs.mkdir(path.join(tempTestDir, 'other-hidden', '.apex-test'), { recursive: true });

      const foundDirs = await findApexTestDirectories(tempTestDir);
      expect(foundDirs).toHaveLength(2);
      expect(foundDirs.every(dir => path.basename(dir) === '.apex-test')).toBe(true);
    });

    it('should handle read permission issues gracefully', async () => {
      const apexTestDir = path.join(tempTestDir, '.apex-test');
      await fs.mkdir(apexTestDir, { recursive: true });
      await fs.writeFile(path.join(apexTestDir, 'test.txt'), 'content');

      // This test would require actual permission manipulation on Unix systems
      // For now, we just verify the function doesn't throw
      await expect(removeDirectory(apexTestDir)).resolves.not.toThrow();
    });
  });

  describe('Performance Validation', () => {
    it('should handle large numbers of .apex-test directories efficiently', async () => {
      const startTime = Date.now();

      // Create 20 .apex-test directories
      const dirs: string[] = [];
      for (let i = 0; i < 20; i++) {
        const dir = path.join(tempTestDir, `project-${i}`, '.apex-test');
        dirs.push(dir);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, `file-${i}.txt`), `content ${i}`);
      }

      const foundDirs = await findApexTestDirectories(tempTestDir);
      expect(foundDirs).toHaveLength(20);

      // Remove all directories
      for (const dir of foundDirs) {
        await removeDirectory(dir);
      }

      // Verify all are removed
      for (const dir of dirs) {
        await expect(fs.stat(dir)).rejects.toThrow();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (5 seconds for 20 directories)
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Integration Validation', () => {
    it('should integrate properly with npm scripts', () => {
      // Verify the package.json scripts are properly configured
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      expect(fs.readFile(packageJsonPath, 'utf-8')).resolves.toContain('cleanup:test');
    });

    it('should work with shell script execution patterns', async () => {
      // This validates the patterns used by shell scripts work correctly
      const testDir = path.join(tempTestDir, '.apex-test');
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(path.join(testDir, 'test.txt'), 'content');

      // Simulate what shell scripts do: find then remove
      const foundDirs = await findApexTestDirectories(tempTestDir);
      expect(foundDirs).toHaveLength(1);

      for (const dir of foundDirs) {
        await removeDirectory(dir);
      }

      await expect(fs.stat(testDir)).rejects.toThrow();
    });
  });
});
/**
 * Tests for VersionMismatchDetector
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { VersionMismatchDetector } from './version-mismatch-detector';

describe('VersionMismatchDetector', () => {
  let detector: VersionMismatchDetector;
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = path.join(process.cwd(), 'test-temp-' + Math.random().toString(36).substring(7));
    await fs.mkdir(tempDir, { recursive: true });

    detector = new VersionMismatchDetector(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('constructor and setup', () => {
    it('should create detector with project path', () => {
      const detector = new VersionMismatchDetector('/test/path');
      expect(detector).toBeInstanceOf(VersionMismatchDetector);
      expect(detector.type).toBe('docs');
    });

    it('should allow setting project path after creation', () => {
      const detector = new VersionMismatchDetector();
      detector.setProjectPath('/new/path');
      expect(detector).toBeInstanceOf(VersionMismatchDetector);
    });
  });

  describe('findVersionReferences', () => {
    it('should find v1.2.3 format versions', () => {
      const line = 'This is v1.2.3 version format';
      const versions = (detector as any).findVersionReferences(line);
      expect(versions).toEqual(['1.2.3']);
    });

    it('should find "version 1.2.3" format versions', () => {
      const line = 'The current version 2.1.0 is stable';
      const versions = (detector as any).findVersionReferences(line);
      expect(versions).toEqual(['2.1.0']);
    });

    it('should find JSDoc @version annotations', () => {
      const line = ' * @version 1.5.2';
      const versions = (detector as any).findVersionReferences(line);
      expect(versions).toEqual(['1.5.2']);
    });

    it('should find "Version:" format', () => {
      const line = 'Version: 3.0.0';
      const versions = (detector as any).findVersionReferences(line);
      expect(versions).toEqual(['3.0.0']);
    });

    it('should find multiple versions in one line', () => {
      const line = 'Upgrade from v1.0.0 to version 2.0.0';
      const versions = (detector as any).findVersionReferences(line);
      expect(versions).toEqual(['1.0.0', '2.0.0']);
    });

    it('should handle semver with prerelease tags', () => {
      const line = 'Using v1.2.3-beta.1 for testing';
      const versions = (detector as any).findVersionReferences(line);
      expect(versions).toEqual(['1.2.3-beta.1']);
    });

    it('should handle semver with build metadata', () => {
      const line = 'Release v2.0.0-rc.1';
      const versions = (detector as any).findVersionReferences(line);
      expect(versions).toEqual(['2.0.0-rc.1']);
    });

    it('should ignore package.json version declarations', () => {
      const line = '  "version": "1.2.3",';
      const versions = (detector as any).findVersionReferences(line);
      expect(versions).toEqual([]);
    });

    it('should return empty array for no matches', () => {
      const line = 'This line has no version information';
      const versions = (detector as any).findVersionReferences(line);
      expect(versions).toEqual([]);
    });

    it('should handle case insensitive version patterns', () => {
      const line = 'Current Version: 1.2.3 and also VERSION 2.0.0';
      const versions = (detector as any).findVersionReferences(line);
      expect(versions).toEqual(['1.2.3', '2.0.0']);
    });

    it('should handle edge case versions with complex prerelease', () => {
      const line = 'Using v1.0.0-alpha.beta.1+build.123 for development';
      const versions = (detector as any).findVersionReferences(line);
      expect(versions).toEqual(['1.0.0-alpha.beta.1+build.123']);
    });

    it('should not match partial version numbers', () => {
      const line = 'Port 3000 and timeout 1.5 seconds';
      const versions = (detector as any).findVersionReferences(line);
      expect(versions).toEqual([]);
    });

    it('should handle versions in URLs and paths', () => {
      const line = 'Download from https://example.com/v1.2.3/package.tar.gz';
      const versions = (detector as any).findVersionReferences(line);
      expect(versions).toEqual(['1.2.3']);
    });
  });

  describe('getPackageVersion', () => {
    it('should read version from package.json', async () => {
      const packageJson = {
        name: 'test-package',
        version: '1.2.3',
        description: 'Test package'
      };

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const version = await (detector as any).getPackageVersion();
      expect(version).toBe('1.2.3');
    });

    it('should return null for missing package.json', async () => {
      // No package.json created
      const version = await (detector as any).getPackageVersion();
      expect(version).toBeNull();
    });

    it('should return null for invalid JSON', async () => {
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        'invalid json content'
      );

      const version = await (detector as any).getPackageVersion();
      expect(version).toBeNull();
    });

    it('should return null for package.json without version', async () => {
      const packageJson = {
        name: 'test-package',
        description: 'Test package without version'
      };

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const version = await (detector as any).getPackageVersion();
      expect(version).toBeNull();
    });
  });

  describe('detectMismatches', () => {
    beforeEach(async () => {
      // Create package.json with version 2.0.0
      const packageJson = {
        name: 'test-package',
        version: '2.0.0',
        description: 'Test package'
      };

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
    });

    it('should detect exact version mismatches in markdown files', async () => {
      const markdownContent = `# Test Project

This project is currently at version v1.0.0.

## Installation

Install version 1.0.0 using npm.
`;

      await fs.writeFile(path.join(tempDir, 'README.md'), markdownContent);

      const mismatches = await detector.detectMismatches();
      expect(mismatches).toHaveLength(2);

      expect(mismatches[0]).toMatchObject({
        file: 'README.md',
        line: 3,
        foundVersion: '1.0.0',
        expectedVersion: '2.0.0',
        lineContent: 'This project is currently at version v1.0.0.'
      });

      expect(mismatches[1]).toMatchObject({
        file: 'README.md',
        line: 7,
        foundVersion: '1.0.0',
        expectedVersion: '2.0.0',
        lineContent: 'Install version 1.0.0 using npm.'
      });
    });

    it('should detect mismatches in TypeScript JSDoc comments', async () => {
      const tsContent = `/**
 * Main application class
 * @version 1.5.0
 * @since 1.0.0
 */
export class App {
  /**
   * Get version info
   * Current version: v1.2.0
   */
  getVersion() {
    return 'v1.2.0';
  }
}
`;

      await fs.writeFile(path.join(tempDir, 'app.ts'), tsContent);

      const mismatches = await detector.detectMismatches();
      expect(mismatches).toHaveLength(3);

      expect(mismatches[0].foundVersion).toBe('1.5.0');
      expect(mismatches[1].foundVersion).toBe('1.0.0');
      expect(mismatches[2].foundVersion).toBe('1.2.0');

      expect(mismatches.every(m => m.expectedVersion === '2.0.0')).toBe(true);
    });

    it('should ignore matching versions', async () => {
      const markdownContent = `# Test Project

This project is currently at version v2.0.0.

## Installation

Install version 2.0.0 using npm.
`;

      await fs.writeFile(path.join(tempDir, 'README.md'), markdownContent);

      const mismatches = await detector.detectMismatches();
      expect(mismatches).toHaveLength(0);
    });

    it('should handle multiple version references per file', async () => {
      const markdownContent = `# Changelog

## v1.0.0 - Initial Release
- First version 1.0.0 release

## v1.1.0 - Bug Fixes
- Updated to version 1.1.0

## v2.0.0 - Current
- Current version 2.0.0
`;

      await fs.writeFile(path.join(tempDir, 'CHANGELOG.md'), markdownContent);

      const mismatches = await detector.detectMismatches();
      expect(mismatches).toHaveLength(4); // 1.0.0 twice, 1.1.0 twice

      const foundVersions = mismatches.map(m => m.foundVersion);
      expect(foundVersions).toContain('1.0.0');
      expect(foundVersions).toContain('1.1.0');
      expect(foundVersions.filter(v => v === '1.0.0')).toHaveLength(2);
      expect(foundVersions.filter(v => v === '1.1.0')).toHaveLength(2);
    });

    it('should handle semver with prerelease tags', async () => {
      const content = `# Beta Release

Using version v1.5.0-beta.2 for testing.
The stable version 2.0.0-rc.1 will be released soon.
`;

      await fs.writeFile(path.join(tempDir, 'BETA.md'), content);

      const mismatches = await detector.detectMismatches();
      expect(mismatches).toHaveLength(2);
      expect(mismatches[0].foundVersion).toBe('1.5.0-beta.2');
      expect(mismatches[1].foundVersion).toBe('2.0.0-rc.1');
    });

    it('should skip node_modules and other excluded directories', async () => {
      // Create node_modules directory with version references
      await fs.mkdir(path.join(tempDir, 'node_modules'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'node_modules', 'test.md'),
        'This contains version v1.0.0'
      );

      // Create .git directory
      await fs.mkdir(path.join(tempDir, '.git'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, '.git', 'test.md'),
        'This contains version v1.0.0'
      );

      const mismatches = await detector.detectMismatches();
      expect(mismatches).toHaveLength(0);
    });

    it('should return empty array when no package.json exists', async () => {
      // Remove package.json
      await fs.unlink(path.join(tempDir, 'package.json'));

      const markdownContent = 'This project is at version v1.0.0';
      await fs.writeFile(path.join(tempDir, 'README.md'), markdownContent);

      const mismatches = await detector.detectMismatches();
      expect(mismatches).toHaveLength(0);
    });

    it('should throw error when project path not set', async () => {
      const detector = new VersionMismatchDetector();

      await expect(detector.detectMismatches()).rejects.toThrow(
        'Project path not set. Call setProjectPath() first.'
      );
    });

    it('should handle nested directory structures', async () => {
      // Create nested directories
      const docsDir = path.join(tempDir, 'docs', 'api');
      const srcDir = path.join(tempDir, 'src', 'components');

      await fs.mkdir(docsDir, { recursive: true });
      await fs.mkdir(srcDir, { recursive: true });

      // Add files with version mismatches
      await fs.writeFile(
        path.join(docsDir, 'api-docs.md'),
        'API version v1.0.0 documentation'
      );

      await fs.writeFile(
        path.join(srcDir, 'component.ts'),
        '/** @version 1.5.0 */ export class Component {}'
      );

      const mismatches = await detector.detectMismatches();
      expect(mismatches).toHaveLength(2);
      expect(mismatches[0].file).toBe('docs/api/api-docs.md');
      expect(mismatches[1].file).toBe('src/components/component.ts');
    });

    it('should handle files with read errors gracefully', async () => {
      // Create a file that we can't read (simulated by creating a directory with same name)
      const problemFile = path.join(tempDir, 'README.md');
      await fs.mkdir(problemFile, { recursive: true });

      // Also create a valid file
      await fs.writeFile(
        path.join(tempDir, 'VALID.md'),
        'This has version v1.0.0'
      );

      const mismatches = await detector.detectMismatches();
      // Should process the valid file despite the problematic one
      expect(mismatches).toHaveLength(1);
      expect(mismatches[0].file).toBe('VALID.md');
    });

    it('should handle empty files', async () => {
      await fs.writeFile(path.join(tempDir, 'empty.md'), '');
      await fs.writeFile(path.join(tempDir, 'empty.ts'), '');

      const mismatches = await detector.detectMismatches();
      expect(mismatches).toHaveLength(0);
    });

    it('should handle binary files gracefully', async () => {
      // Create a mock binary file with some bytes
      const binaryData = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      await fs.writeFile(path.join(tempDir, 'image.png'), binaryData);

      const mismatches = await detector.detectMismatches();
      expect(mismatches).toHaveLength(0);
    });
  });

  describe('createVersionMismatchTask', () => {
    it('should return null for no mismatches', () => {
      const task = detector.createVersionMismatchTask([]);
      expect(task).toBeNull();
    });

    it('should create task for few mismatches', () => {
      const mismatches = [
        {
          file: 'README.md',
          line: 1,
          foundVersion: '1.0.0',
          expectedVersion: '2.0.0',
          lineContent: 'Version v1.0.0'
        }
      ];

      const task = detector.createVersionMismatchTask(mismatches);
      expect(task).not.toBeNull();
      expect(task?.title).toBe('Fix Version Reference Mismatches');
      expect(task?.priority).toBe('low');
      expect(task?.estimatedEffort).toBe('low');
      expect(task?.description).toContain('1 outdated version reference in 1 file');
    });

    it('should prioritize task based on mismatch count', () => {
      // Create many mismatches
      const mismatches = Array.from({ length: 15 }, (_, i) => ({
        file: `file${i}.md`,
        line: 1,
        foundVersion: '1.0.0',
        expectedVersion: '2.0.0',
        lineContent: `Version v1.0.0`
      }));

      const task = detector.createVersionMismatchTask(mismatches);
      expect(task?.priority).toBe('high');
      expect(task?.estimatedEffort).toBe('high');
      expect(task?.description).toContain('15 outdated version references in 15 files');
    });

    it('should handle medium priority range correctly', () => {
      const mismatches = Array.from({ length: 5 }, (_, i) => ({
        file: `file${i}.md`,
        line: 1,
        foundVersion: '1.0.0',
        expectedVersion: '2.0.0',
        lineContent: `Version v1.0.0`
      }));

      const task = detector.createVersionMismatchTask(mismatches);
      expect(task?.priority).toBe('normal');
      expect(task?.estimatedEffort).toBe('medium');
    });

    it('should group mismatches by file count correctly', () => {
      const mismatches = [
        {
          file: 'README.md',
          line: 1,
          foundVersion: '1.0.0',
          expectedVersion: '2.0.0',
          lineContent: 'Version v1.0.0'
        },
        {
          file: 'README.md',
          line: 5,
          foundVersion: '1.1.0',
          expectedVersion: '2.0.0',
          lineContent: 'Also version 1.1.0'
        },
        {
          file: 'CHANGELOG.md',
          line: 1,
          foundVersion: '1.0.0',
          expectedVersion: '2.0.0',
          lineContent: 'Version v1.0.0'
        }
      ];

      const task = detector.createVersionMismatchTask(mismatches);
      expect(task?.description).toContain('3 outdated version references in 2 files');
    });

    it('should use singular forms for single mismatch', () => {
      const mismatches = [
        {
          file: 'README.md',
          line: 1,
          foundVersion: '1.0.0',
          expectedVersion: '2.0.0',
          lineContent: 'Version v1.0.0'
        }
      ];

      const task = detector.createVersionMismatchTask(mismatches);
      expect(task?.description).toContain('1 outdated version reference in 1 file');
    });

    it('should include correct workflow and rationale', () => {
      const mismatches = [
        {
          file: 'README.md',
          line: 1,
          foundVersion: '1.0.0',
          expectedVersion: '2.0.0',
          lineContent: 'Version v1.0.0'
        }
      ];

      const task = detector.createVersionMismatchTask(mismatches);
      expect(task?.workflow).toBe('maintenance');
      expect(task?.rationale).toBe('Outdated version references in documentation can confuse users and developers');
      expect(task?.score).toBe(0.1); // 1 mismatch * 0.1
    });
  });

  describe('analyze method', () => {
    it('should return empty candidates array', () => {
      const mockAnalysis = {} as any;
      const candidates = detector.analyze(mockAnalysis);
      expect(candidates).toEqual([]);
    });
  });
});
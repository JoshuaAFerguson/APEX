/**
 * @fileoverview Unit tests for path validation and traversal detection
 */

import { describe, it, expect } from 'vitest';
import {
  detectPathTraversal,
  extractPathsFromCommand,
  checkPathEscapesBase,
  validateWorkingDirectory,
  normalizePath,
  pathsEqual,
  getRelativePathIfWithin,
  type PathTraversalResult
} from '../path-validator.js';

describe('Path Validator', () => {
  describe('detectPathTraversal', () => {
    it('should detect basic traversal patterns', () => {
      const traversalCommands = [
        'cat ../../../etc/passwd',
        'ls ../../',
        'cp file ../../target/',
        'rm -rf ../important/',
        'cd ..',
      ];

      traversalCommands.forEach(command => {
        const result = detectPathTraversal(command);
        expect(result.detected).toBe(true);
        expect(result.suspiciousPaths.length).toBeGreaterThan(0);
      });
    });

    it('should detect suspicious absolute paths', () => {
      const suspiciousCommands = [
        'cat /etc/passwd',
        'ls /root/',
        'cp file ~/.ssh/',
        'rm /proc/something',
        'access /sys/devices/',
      ];

      suspiciousCommands.forEach(command => {
        const result = detectPathTraversal(command);
        expect(result.detected).toBe(true);
        expect(result.suspiciousPaths.length).toBeGreaterThan(0);
      });
    });

    it('should not flag safe relative paths', () => {
      const safeCommands = [
        'cat file.txt',
        'ls ./subdir/',
        'cp file1 file2',
        'mkdir new_folder',
        'cd subdir',
      ];

      safeCommands.forEach(command => {
        const result = detectPathTraversal(command);
        expect(result.detected).toBe(false);
      });
    });

    it('should detect encoded traversal attempts', () => {
      const encodedCommands = [
        'cat file%2F..%2F..%2Fetc%2Fpasswd',
        'ls dir..%2Fother/',
      ];

      encodedCommands.forEach(command => {
        const result = detectPathTraversal(command);
        expect(result.detected).toBe(true);
      });
    });

    it('should check base directory escape when provided', () => {
      const result = detectPathTraversal('cat ../../file.txt', '/project/src');
      expect(result.detected).toBe(true);
      expect(result.matchedPatterns).toContain('path_escape_base_directory');
    });
  });

  describe('extractPathsFromCommand', () => {
    it('should extract quoted paths', () => {
      const command = 'cp "file with spaces.txt" \'/target/path\'';
      const paths = extractPathsFromCommand(command);

      expect(paths).toContain('file with spaces.txt');
      expect(paths).toContain('/target/path');
    });

    it('should extract unquoted paths', () => {
      const command = 'ls /usr/bin ~/documents ./local';
      const paths = extractPathsFromCommand(command);

      expect(paths).toContain('/usr/bin');
      expect(paths).toContain('~/documents');
      expect(paths).toContain('./local');
    });

    it('should extract paths from file operations', () => {
      const command = 'mv source.txt destination.txt';
      const paths = extractPathsFromCommand(command);

      expect(paths).toContain('destination.txt');
    });

    it('should handle complex commands with multiple paths', () => {
      const command = 'find /home -name "*.txt" -exec cp {} /backup/ \\;';
      const paths = extractPathsFromCommand(command);

      expect(paths).toContain('/home');
      expect(paths).toContain('*.txt');
      expect(paths).toContain('/backup/');
    });

    it('should deduplicate extracted paths', () => {
      const command = 'cp /same/path /same/path';
      const paths = extractPathsFromCommand(command);

      expect(paths.filter(p => p === '/same/path')).toHaveLength(1);
    });
  });

  describe('checkPathEscapesBase', () => {
    it('should detect when relative paths escape base directory', () => {
      expect(checkPathEscapesBase('../../../etc', '/project/src')).toBe(true);
      expect(checkPathEscapesBase('../../..', '/project')).toBe(true);
    });

    it('should allow paths within base directory', () => {
      expect(checkPathEscapesBase('./subdir/file.txt', '/project')).toBe(false);
      expect(checkPathEscapesBase('file.txt', '/project')).toBe(false);
      expect(checkPathEscapesBase('subdir/', '/project')).toBe(false);
    });

    it('should handle absolute paths correctly', () => {
      expect(checkPathEscapesBase('/project/file.txt', '/project')).toBe(false);
      expect(checkPathEscapesBase('/etc/passwd', '/project')).toBe(true);
      expect(checkPathEscapesBase('/project/sub/file.txt', '/project')).toBe(false);
    });

    it('should handle edge cases with base directory itself', () => {
      expect(checkPathEscapesBase('/project', '/project')).toBe(false);
      expect(checkPathEscapesBase('.', '/project')).toBe(false);
    });

    it('should handle invalid paths gracefully', () => {
      expect(checkPathEscapesBase('\x00invalid', '/project')).toBe(true);
    });
  });

  describe('validateWorkingDirectory', () => {
    it('should allow any directory when no base is set', () => {
      const result = validateWorkingDirectory('/any/directory');
      expect(result.allowed).toBe(true);
    });

    it('should validate working directory within base', () => {
      const result = validateWorkingDirectory('/project/src', '/project');
      expect(result.allowed).toBe(true);
    });

    it('should block working directory outside base', () => {
      const result = validateWorkingDirectory('/etc', '/project');
      expect(result.allowed).toBe(false);
      expect(result.blockedReason).toContain('outside the allowed sandbox');
      expect(result.violationType).toBe('directory_escape');
    });

    it('should allow working directory in allowed paths', () => {
      const result = validateWorkingDirectory('/var/log', '/project', ['/var/log', '/tmp']);
      expect(result.allowed).toBe(true);
    });

    it('should use current directory when working directory is undefined', () => {
      const currentDir = process.cwd();
      const result = validateWorkingDirectory(undefined, currentDir);
      expect(result.allowed).toBe(true);
    });

    it('should handle path resolution errors', () => {
      const result = validateWorkingDirectory('\x00invalid', '/project');
      expect(result.allowed).toBe(false);
      expect(result.blockedReason).toContain('Unable to validate');
    });

    it('should handle base directory exactly', () => {
      const result = validateWorkingDirectory('/project', '/project');
      expect(result.allowed).toBe(true);
    });
  });

  describe('utility functions', () => {
    describe('normalizePath', () => {
      it('should normalize different path formats', () => {
        expect(normalizePath('path\\to\\file')).toBe('path/to/file');
        expect(normalizePath('path/to/../file')).toBe('path/file');
        expect(normalizePath('./path/./file')).toBe('path/file');
      });
    });

    describe('pathsEqual', () => {
      it('should detect equal paths with different formats', () => {
        expect(pathsEqual('/path/to/file', '/path/to/file')).toBe(true);
        expect(pathsEqual('/path/to/../to/file', '/path/to/file')).toBe(true);
        expect(pathsEqual('./file', 'file')).toBe(true);
      });

      it('should detect different paths', () => {
        expect(pathsEqual('/path/to/file1', '/path/to/file2')).toBe(false);
        expect(pathsEqual('/path1', '/path2')).toBe(false);
      });

      it('should handle invalid paths', () => {
        expect(pathsEqual('\x00invalid', '/valid/path')).toBe(false);
      });
    });

    describe('getRelativePathIfWithin', () => {
      it('should return relative path when target is within base', () => {
        expect(getRelativePathIfWithin('/project', '/project/src/file.txt')).toBe('src/file.txt');
        expect(getRelativePathIfWithin('/project', '/project')).toBe('.');
        expect(getRelativePathIfWithin('/project', '/project/file.txt')).toBe('file.txt');
      });

      it('should return null when target is outside base', () => {
        expect(getRelativePathIfWithin('/project', '/etc/passwd')).toBe(null);
        expect(getRelativePathIfWithin('/project', '/other/path')).toBe(null);
      });

      it('should handle invalid paths', () => {
        expect(getRelativePathIfWithin('\x00invalid', '/path')).toBe(null);
      });
    });
  });

  describe('edge cases and security', () => {
    it('should handle commands with no paths', () => {
      const result = detectPathTraversal('echo hello world');
      expect(result.detected).toBe(false);
      expect(result.suspiciousPaths).toHaveLength(0);
    });

    it('should handle commands with path-like strings that are not paths', () => {
      const result = detectPathTraversal('echo "this looks like a ../path but is not"');
      expect(result.detected).toBe(true); // Should still detect the pattern in the string
    });

    it('should handle very long commands', () => {
      const longCommand = 'ls ' + '../'.repeat(1000) + 'file.txt';
      const result = detectPathTraversal(longCommand);
      expect(result.detected).toBe(true);
    });

    it('should handle commands with mixed quotes and escapes', () => {
      const complexCommand = 'cp "file1" \'../file2\' ./file3 \\../file4';
      const result = detectPathTraversal(complexCommand);
      expect(result.detected).toBe(true);
      expect(result.suspiciousPaths.some(p => p.includes('..'))).toBe(true);
    });

    it('should handle Windows-style paths', () => {
      const windowsCommand = 'copy file.txt C:\\..\\important.txt';
      const result = detectPathTraversal(windowsCommand);
      expect(result.detected).toBe(true);
    });

    it('should detect traversal in complex file operations', () => {
      const complexCommands = [
        'find . -name "*.txt" -exec cp {} ../../backup/ \\;',
        'tar -czf ../../backup.tar.gz .',
        'rsync -av . ../../../backup/',
      ];

      complexCommands.forEach(command => {
        const result = detectPathTraversal(command);
        expect(result.detected).toBe(true);
      });
    });
  });
});
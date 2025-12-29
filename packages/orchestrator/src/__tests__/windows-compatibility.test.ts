/**
 * Tests for Windows-specific compatibility issues
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { platform, arch } from 'os';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { spawn, ChildProcess } from 'child_process';

describe('Windows Platform Compatibility', () => {
  describe('Environment Detection', () => {
    it('should correctly detect when running on Windows', () => {
      const currentPlatform = platform();
      const currentArch = arch();

      // Should handle Windows platform detection
      if (currentPlatform === 'win32') {
        expect(['x64', 'ia32', 'arm64']).toContain(currentArch);
      }

      // Test platform detection logic that might be used in the app
      const isWindows = currentPlatform === 'win32';
      expect(typeof isWindows).toBe('boolean');
    });

    it('should handle Windows path separators correctly', () => {
      const testPath = join('packages', 'orchestrator', 'src');

      // On Windows, join should use backslashes
      if (platform() === 'win32') {
        expect(testPath).toContain('\\');
      } else {
        expect(testPath).toContain('/');
      }

      // resolve should work on both platforms
      const absolutePath = resolve(testPath);
      expect(absolutePath).toBeTruthy();
      expect(absolutePath.length).toBeGreaterThan(testPath.length);
    });
  });

  describe('File System Operations', () => {
    it('should handle Windows file paths in configuration loading', () => {
      // Test that our path handling works on Windows
      const configPath = join(process.cwd(), '.apex', 'config.yaml');
      const packageJsonPath = join(process.cwd(), 'package.json');

      // These should work regardless of platform
      expect(existsSync(packageJsonPath)).toBe(true);

      // Path normalization should handle Windows paths
      const normalizedPath = resolve(packageJsonPath);
      expect(normalizedPath).toBeTruthy();
    });

    it('should handle Windows line endings in file operations', () => {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const content = readFileSync(packageJsonPath, 'utf-8');

      // Should handle both CRLF and LF line endings
      const hasWindowsLineEndings = content.includes('\r\n');
      const hasUnixLineEndings = content.includes('\n');

      expect(hasUnixLineEndings || hasWindowsLineEndings).toBe(true);

      // JSON parsing should work regardless of line endings
      const parsed = JSON.parse(content);
      expect(parsed.name).toBe('apex');
    });
  });

  describe('SQLite Database Compatibility', () => {
    it('should handle SQLite database paths on Windows', () => {
      // Test SQLite path handling for Windows
      const dbPath = join(process.cwd(), '.apex', 'apex.db');
      const normalizedDbPath = resolve(dbPath);

      expect(normalizedDbPath).toBeTruthy();

      // Should not contain invalid Windows path characters
      const invalidChars = ['<', '>', ':', '"', '|', '?', '*'];
      const pathWithoutDrive = normalizedDbPath.replace(/^[A-Z]:/i, '');

      invalidChars.forEach(char => {
        expect(pathWithoutDrive).not.toContain(char);
      });
    });

    it('should handle SQLite native compilation requirements', () => {
      // Verify that better-sqlite3 package exists and can be imported
      const sqlitePackagePath = join(process.cwd(), 'node_modules', 'better-sqlite3', 'package.json');

      if (existsSync(sqlitePackagePath)) {
        const packageInfo = JSON.parse(readFileSync(sqlitePackagePath, 'utf-8'));
        expect(packageInfo.name).toBe('better-sqlite3');
        expect(packageInfo.gypfile).toBe(true); // Native compilation required
      }
    });
  });

  describe('Child Process Handling', () => {
    it('should handle Windows command execution', () => {
      // Test that child process spawning works on Windows
      const isWindows = platform() === 'win32';

      if (isWindows) {
        // On Windows, should be able to run cmd commands
        expect(() => {
          const child = spawn('cmd', ['/c', 'echo', 'test'], { stdio: 'pipe' });
          child.kill();
        }).not.toThrow();
      } else {
        // On Unix, should be able to run shell commands
        expect(() => {
          const child = spawn('echo', ['test'], { stdio: 'pipe' });
          child.kill();
        }).not.toThrow();
      }
    });

    it('should handle npm commands consistently across platforms', () => {
      // npm commands should work the same way on both platforms
      const isWindows = platform() === 'win32';
      const npmCommand = isWindows ? 'npm.cmd' : 'npm';

      expect(() => {
        const child = spawn(npmCommand, ['--version'], { stdio: 'pipe' });
        child.kill();
      }).not.toThrow();
    });
  });

  describe('Environment Variables', () => {
    it('should handle Windows environment variable differences', () => {
      // Test environment variable handling
      const nodeEnv = process.env.NODE_ENV;
      const path = process.env.PATH || process.env.Path; // Windows uses 'Path'

      expect(typeof nodeEnv === 'string' || nodeEnv === undefined).toBe(true);
      expect(typeof path).toBe('string');

      // On Windows, PATH might be case-insensitive
      if (platform() === 'win32') {
        const pathExists = process.env.PATH || process.env.Path || process.env.path;
        expect(pathExists).toBeTruthy();
      }
    });

    it('should handle Windows home directory detection', () => {
      const homeDir = process.env.HOME || process.env.USERPROFILE;
      expect(homeDir).toBeTruthy();

      if (platform() === 'win32') {
        // On Windows, should prefer USERPROFILE
        expect(process.env.USERPROFILE).toBeTruthy();
      } else {
        // On Unix, should prefer HOME
        expect(process.env.HOME).toBeTruthy();
      }
    });
  });

  describe('Package Dependencies', () => {
    it('should have Windows-compatible dependencies in package.json files', () => {
      const rootPackageJson = join(process.cwd(), 'package.json');
      const orchestratorPackageJson = join(process.cwd(), 'packages', 'orchestrator', 'package.json');

      [rootPackageJson, orchestratorPackageJson].forEach(packagePath => {
        if (existsSync(packagePath)) {
          const packageInfo = JSON.parse(readFileSync(packagePath, 'utf-8'));

          // Check for known Windows-problematic packages
          const allDeps = {
            ...packageInfo.dependencies,
            ...packageInfo.devDependencies,
            ...packageInfo.peerDependencies
          };

          // better-sqlite3 should be present (it's Windows-compatible when properly compiled)
          if (packagePath.includes('orchestrator')) {
            expect(allDeps['better-sqlite3']).toBeDefined();
          }

          // Should not have Unix-only packages
          expect(allDeps['unix-specific-package']).toBeUndefined();
        }
      });
    });
  });
});
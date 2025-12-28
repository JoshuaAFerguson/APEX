/**
 * Unit tests for REPL platform-specific functionality
 * Tests platform detection, shell configuration, and cross-platform compatibility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('REPL Platform Functions', () => {
  let originalPlatform: string;

  beforeEach(() => {
    originalPlatform = process.platform;
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
    });
  });

  describe('Platform detection utilities', () => {
    it('should detect Windows platform correctly', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      const { isWindows, getPlatformShell, resolveExecutable } = await import('@apexcli/core');

      expect(isWindows()).toBe(true);

      const shell = getPlatformShell();
      expect(shell.shell).toBe('cmd.exe');
      expect(shell.shellArgs).toEqual(['/d', '/s', '/c']);

      expect(resolveExecutable('node')).toBe('node.exe');
      expect(resolveExecutable('git')).toBe('git.exe');
    });

    it('should detect Unix platforms correctly', async () => {
      const unixPlatforms = ['darwin', 'linux', 'freebsd'];

      for (const platform of unixPlatforms) {
        Object.defineProperty(process, 'platform', {
          value: platform,
          writable: true,
        });

        const { isWindows, getPlatformShell, resolveExecutable } = await import('@apexcli/core');

        expect(isWindows()).toBe(false);

        const shell = getPlatformShell();
        expect(shell.shell).toBe('/bin/sh');
        expect(shell.shellArgs).toEqual(['-c']);

        expect(resolveExecutable('node')).toBe('node');
        expect(resolveExecutable('git')).toBe('git');
      }
    });

    it('should handle executable resolution with existing extensions', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      const { resolveExecutable } = await import('@apexcli/core');

      // Existing extensions should be preserved
      expect(resolveExecutable('node.exe')).toBe('node.exe');
      expect(resolveExecutable('script.cmd')).toBe('script.cmd');
      expect(resolveExecutable('batch.bat')).toBe('batch.bat');

      // Case-insensitive on Windows
      expect(resolveExecutable('NODE.EXE')).toBe('NODE.EXE');
      expect(resolveExecutable('script.CMD')).toBe('script.CMD');
    });

    it('should handle invalid executable names', async () => {
      const { resolveExecutable } = await import('@apexcli/core');

      expect(() => resolveExecutable('')).toThrow('Executable name must be a non-empty string');
      expect(() => resolveExecutable('   ')).toThrow('Executable name must be a non-empty string');
      expect(() => resolveExecutable(null as any)).toThrow('Executable name must be a non-empty string');
      expect(() => resolveExecutable(undefined as any)).toThrow('Executable name must be a non-empty string');
    });
  });

  describe('Shell command creation', () => {
    it('should create proper Windows commands', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      const { createShellCommand } = await import('@apexcli/core');

      expect(createShellCommand(['git', 'status'])).toBe('git status');
      expect(createShellCommand(['echo', 'hello world'])).toBe('echo "hello world"');
      expect(createShellCommand(['node', 'path with spaces\\script.js']))
        .toBe('node "path with spaces\\script.js"');

      // Test quote escaping
      expect(createShellCommand(['echo', 'say "hello"'])).toBe('echo "say ""hello"""');
    });

    it('should create proper Unix commands', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true,
      });

      const { createShellCommand } = await import('@apexcli/core');

      expect(createShellCommand(['git', 'status'])).toBe('git status');
      expect(createShellCommand(['echo', 'hello world'])).toBe("echo 'hello world'");
      expect(createShellCommand(['node', 'path with spaces/script.js']))
        .toBe("node 'path with spaces/script.js'");

      // Test special character escaping
      expect(createShellCommand(['echo', '$HOME'])).toBe("echo '$HOME'");
      expect(createShellCommand(['echo', 'hello & world'])).toBe("echo 'hello & world'");
    });

    it('should handle invalid command parts', async () => {
      const { createShellCommand } = await import('@apexcli/core');

      expect(() => createShellCommand([])).toThrow('Command parts must be a non-empty array');
      expect(() => createShellCommand(null as any)).toThrow('Command parts must be a non-empty array');
      expect(() => createShellCommand([123] as any)).toThrow('Command part at index 0 must be a string');
    });
  });

  describe('Kill command generation', () => {
    it('should generate Windows kill commands', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      const { getKillCommand } = await import('@apexcli/core');

      expect(getKillCommand(1234)).toEqual(['taskkill', '/f', '/pid', '1234']);
      expect(getKillCommand(5678)).toEqual(['taskkill', '/f', '/pid', '5678']);
    });

    it('should generate Unix kill commands', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true,
      });

      const { getKillCommand } = await import('@apexcli/core');

      expect(getKillCommand(1234)).toEqual(['kill', '-9', '1234']);
      expect(getKillCommand(5678)).toEqual(['kill', '-9', '5678']);
    });

    it('should validate PID values', async () => {
      const { getKillCommand } = await import('@apexcli/core');

      expect(() => getKillCommand(0)).toThrow('PID must be a positive integer');
      expect(() => getKillCommand(-1)).toThrow('PID must be a positive integer');
      expect(() => getKillCommand(1.5)).toThrow('PID must be a positive integer');
      expect(() => getKillCommand(NaN)).toThrow('PID must be a positive integer');
      expect(() => getKillCommand(Infinity)).toThrow('PID must be a positive integer');
    });
  });

  describe('Environment configuration', () => {
    it('should create environment with inheritance enabled', async () => {
      const { createEnvironmentConfig } = await import('@apexcli/core');

      // Set up test environment
      const originalEnv = process.env;
      process.env = {
        HOME: '/home/test',
        PATH: '/usr/bin:/bin',
        USER: 'testuser',
      };

      try {
        const env = createEnvironmentConfig({
          env: { NODE_ENV: 'test' },
          inheritEnv: true,
        });

        expect(env.HOME).toBe('/home/test');
        expect(env.PATH).toBe('/usr/bin:/bin');
        expect(env.USER).toBe('testuser');
        expect(env.NODE_ENV).toBe('test');
      } finally {
        process.env = originalEnv;
      }
    });

    it('should create environment without inheritance', async () => {
      const { createEnvironmentConfig } = await import('@apexcli/core');

      const env = createEnvironmentConfig({
        env: { NODE_ENV: 'test' },
        inheritEnv: false,
      });

      expect(env.HOME).toBeUndefined();
      expect(env.PATH).toBeUndefined();
      expect(env.NODE_ENV).toBe('test');
    });

    it('should handle custom environment variables', async () => {
      const { createEnvironmentConfig } = await import('@apexcli/core');

      const env = createEnvironmentConfig({
        env: {
          CUSTOM_VAR: 'value',
          ANOTHER_VAR: 'another_value',
        },
        inheritEnv: false,
      });

      expect(env.CUSTOM_VAR).toBe('value');
      expect(env.ANOTHER_VAR).toBe('another_value');
    });
  });

  describe('Platform constants', () => {
    it('should provide correct path separators', async () => {
      const { PATH_SEPARATOR, LINE_ENDING, SHELL_CONSTANTS } = await import('@apexcli/core');

      // These are evaluated at module load, so we test current platform values
      if (process.platform === 'win32') {
        expect(PATH_SEPARATOR).toBe(';');
        expect(LINE_ENDING).toBe('\r\n');
      } else {
        expect(PATH_SEPARATOR).toBe(':');
        expect(LINE_ENDING).toBe('\n');
      }

      expect(SHELL_CONSTANTS.DEFAULT_TIMEOUT).toBe(30000);
      expect(SHELL_CONSTANTS.MAX_BUFFER).toBe(1024 * 1024);
    });
  });

  describe('Integration and consistency', () => {
    it('should have consistent platform detection across functions', async () => {
      const platforms = ['win32', 'darwin', 'linux'];

      for (const platform of platforms) {
        Object.defineProperty(process, 'platform', {
          value: platform,
          writable: true,
        });

        const { isWindows, getPlatformShell, getKillCommand, resolveExecutable } = await import('@apexcli/core');

        const isWin = isWindows();
        const shell = getPlatformShell();
        const killCmd = getKillCommand(1234);
        const executable = resolveExecutable('node');

        if (platform === 'win32') {
          expect(isWin).toBe(true);
          expect(shell.shell).toBe('cmd.exe');
          expect(killCmd[0]).toBe('taskkill');
          expect(executable).toBe('node.exe');
        } else {
          expect(isWin).toBe(false);
          expect(shell.shell).toBe('/bin/sh');
          expect(killCmd[0]).toBe('kill');
          expect(executable).toBe('node');
        }
      }
    });

    it('should handle edge cases gracefully', async () => {
      const { resolveExecutable, createShellCommand } = await import('@apexcli/core');

      // Edge cases should not throw
      expect(() => resolveExecutable('  node  ')).not.toThrow();
      expect(resolveExecutable('  node  ').includes('node')).toBe(true);

      // Empty or single-part commands
      expect(createShellCommand(['singlecommand'])).toBe('singlecommand');
    });

    it('should maintain type safety', async () => {
      const { getPlatformShell, createEnvironmentConfig } = await import('@apexcli/core');

      const shell = getPlatformShell();
      expect(typeof shell.shell).toBe('string');
      expect(Array.isArray(shell.shellArgs)).toBe(true);
      expect(shell.shellArgs.every(arg => typeof arg === 'string')).toBe(true);

      const env = createEnvironmentConfig();
      expect(typeof env).toBe('object');
      expect(env).not.toBeNull();
    });
  });

  describe('REPL-specific command patterns', () => {
    it('should support git command patterns across platforms', async () => {
      const { getPlatformShell, createShellCommand } = await import('@apexcli/core');

      const gitCommands = [
        ['git', 'branch', '--show-current'],
        ['git', 'status'],
        ['git', 'log', '--oneline', '-10'],
      ];

      // Test on Windows
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      const winShell = getPlatformShell();
      expect(winShell.shell).toBe('cmd.exe');

      gitCommands.forEach((cmd) => {
        const command = createShellCommand(cmd);
        expect(command).toMatch(/^git /);
        expect(typeof command).toBe('string');
      });

      // Test on Unix
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true,
      });

      const unixShell = getPlatformShell();
      expect(unixShell.shell).toBe('/bin/sh');

      gitCommands.forEach((cmd) => {
        const command = createShellCommand(cmd);
        expect(command).toMatch(/^git /);
        expect(typeof command).toBe('string');
      });
    });

    it('should support process management patterns', async () => {
      const { getKillCommand, resolveExecutable } = await import('@apexcli/core');

      // Common REPL processes
      const processes = ['node', 'npx', 'git'];

      processes.forEach((proc) => {
        const resolved = resolveExecutable(proc);
        expect(typeof resolved).toBe('string');
        expect(resolved.length).toBeGreaterThan(0);
      });

      // Process killing
      const pids = [1234, 5678, 9999];
      pids.forEach((pid) => {
        const killCmd = getKillCommand(pid);
        expect(Array.isArray(killCmd)).toBe(true);
        expect(killCmd.length).toBeGreaterThan(1);
        expect(killCmd.includes(pid.toString())).toBe(true);
      });
    });

    it('should support network command patterns', async () => {
      const { createShellCommand, isWindows } = await import('@apexcli/core');

      // Port checking commands that REPL might use
      const port = 3000;

      if (isWindows()) {
        const winCommand = createShellCommand(['netstat', '-ano']);
        expect(winCommand).toMatch(/netstat -ano/);

        const findCommand = createShellCommand(['findstr', `:${port}`]);
        expect(findCommand).toMatch(new RegExp(`:${port}`));
      } else {
        const lsofCommand = createShellCommand(['lsof', '-ti', `:${port}`]);
        expect(lsofCommand).toMatch(/lsof -ti/);
        expect(lsofCommand).toMatch(new RegExp(`:${port}`));

        const netstatCommand = createShellCommand(['netstat', '-tlnp']);
        expect(netstatCommand).toMatch(/netstat -tlnp/);
      }
    });
  });
});
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import {
  getPlatformShell,
  isWindows,
  getKillCommand,
  resolveExecutable,
  createShellCommand,
  createEnvironmentConfig,
  PATH_SEPARATOR,
  LINE_ENDING,
  SHELL_CONSTANTS,
  type ShellConfig,
  type EnvironmentConfig,
} from './shell-utils.js';

describe('shell-utils', () => {
  let originalPlatform: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalPlatform = process.platform;
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: false,
    });
    process.env = originalEnv;
  });

  describe('isWindows', () => {
    it('should return true on Windows platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: false,
      });

      expect(isWindows()).toBe(true);
    });

    it('should return false on non-Windows platforms', () => {
      const platforms = ['linux', 'darwin', 'freebsd', 'openbsd'];

      for (const platform of platforms) {
        Object.defineProperty(process, 'platform', {
          value: platform,
          writable: false,
        });

        expect(isWindows()).toBe(false);
      }
    });
  });

  describe('getPlatformShell', () => {
    it('should return Windows shell configuration on Windows', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: false,
      });

      const config = getPlatformShell();
      expect(config).toEqual({
        shell: 'cmd.exe',
        shellArgs: ['/d', '/s', '/c']
      });
    });

    it('should return Unix shell configuration on Linux', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: false,
      });

      const config = getPlatformShell();
      expect(config).toEqual({
        shell: '/bin/sh',
        shellArgs: ['-c']
      });
    });

    it('should return Unix shell configuration on macOS', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: false,
      });

      const config = getPlatformShell();
      expect(config).toEqual({
        shell: '/bin/sh',
        shellArgs: ['-c']
      });
    });

    it('should return a valid ShellConfig interface', () => {
      const config = getPlatformShell();
      expect(typeof config.shell).toBe('string');
      expect(Array.isArray(config.shellArgs)).toBe(true);
      expect(config.shellArgs.every(arg => typeof arg === 'string')).toBe(true);
    });
  });

  describe('getKillCommand', () => {
    it('should return Windows kill command on Windows', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: false,
      });

      const command = getKillCommand(1234);
      expect(command).toEqual(['taskkill', '/f', '/pid', '1234']);
    });

    it('should return Unix kill command on Unix-like systems', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: false,
      });

      const command = getKillCommand(1234);
      expect(command).toEqual(['kill', '-9', '1234']);
    });

    it('should handle different PID values', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: false,
      });

      expect(getKillCommand(1)).toEqual(['kill', '-9', '1']);
      expect(getKillCommand(65535)).toEqual(['kill', '-9', '65535']);
      expect(getKillCommand(999999)).toEqual(['kill', '-9', '999999']);
    });

    it('should throw error for invalid PID values', () => {
      expect(() => getKillCommand(0)).toThrow('PID must be a positive integer');
      expect(() => getKillCommand(-1)).toThrow('PID must be a positive integer');
      expect(() => getKillCommand(1.5)).toThrow('PID must be a positive integer');
      expect(() => getKillCommand(NaN)).toThrow('PID must be a positive integer');
      expect(() => getKillCommand(Infinity)).toThrow('PID must be a positive integer');
    });
  });

  describe('resolveExecutable', () => {
    it('should return executable as-is on Unix-like systems', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: false,
      });

      expect(resolveExecutable('node')).toBe('node');
      expect(resolveExecutable('git')).toBe('git');
      expect(resolveExecutable('python3')).toBe('python3');
    });

    it('should add .exe extension on Windows for bare names', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: false,
      });

      expect(resolveExecutable('node')).toBe('node.exe');
      expect(resolveExecutable('git')).toBe('git.exe');
      expect(resolveExecutable('python')).toBe('python.exe');
    });

    it('should preserve existing extensions on Windows', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: false,
      });

      expect(resolveExecutable('node.exe')).toBe('node.exe');
      expect(resolveExecutable('script.cmd')).toBe('script.cmd');
      expect(resolveExecutable('batch.bat')).toBe('batch.bat');
    });

    it('should handle case-insensitive extensions on Windows', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: false,
      });

      expect(resolveExecutable('NODE.EXE')).toBe('NODE.EXE');
      expect(resolveExecutable('script.CMD')).toBe('script.CMD');
      expect(resolveExecutable('batch.Bat')).toBe('batch.Bat');
    });

    it('should handle whitespace in executable names', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: false,
      });

      expect(resolveExecutable('  node  ')).toBe('node.exe');
      expect(resolveExecutable('\tgit\t')).toBe('git.exe');
    });

    it('should throw error for invalid input', () => {
      expect(() => resolveExecutable('')).toThrow('Executable name must be a non-empty string');
      expect(() => resolveExecutable('   ')).toThrow('Executable name must be a non-empty string');
      expect(() => resolveExecutable(null as any)).toThrow('Executable name must be a non-empty string');
      expect(() => resolveExecutable(undefined as any)).toThrow('Executable name must be a non-empty string');
      expect(() => resolveExecutable(123 as any)).toThrow('Executable name must be a non-empty string');
    });
  });

  describe('createShellCommand', () => {
    it('should join simple commands on Unix', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: false,
      });

      expect(createShellCommand(['git', 'status'])).toBe('git status');
      expect(createShellCommand(['node', 'script.js'])).toBe('node script.js');
    });

    it('should escape arguments with spaces on Unix', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: false,
      });

      expect(createShellCommand(['echo', 'hello world'])).toBe("echo 'hello world'");
      expect(createShellCommand(['node', 'path with spaces/script.js'])).toBe("node 'path with spaces/script.js'");
    });

    it('should escape special characters on Unix', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: false,
      });

      expect(createShellCommand(['echo', '$HOME'])).toBe("echo '$HOME'");
      expect(createShellCommand(['echo', 'hello & world'])).toBe("echo 'hello & world'");
      expect(createShellCommand(['echo', "file'name"])).toBe("echo 'file'\"'\"'name'");
    });

    it('should join simple commands on Windows', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: false,
      });

      expect(createShellCommand(['git', 'status'])).toBe('git status');
      expect(createShellCommand(['node', 'script.js'])).toBe('node script.js');
    });

    it('should escape arguments with spaces on Windows', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: false,
      });

      expect(createShellCommand(['echo', 'hello world'])).toBe('echo "hello world"');
      expect(createShellCommand(['node', 'path with spaces\\script.js'])).toBe('node "path with spaces\\script.js"');
    });

    it('should escape special characters on Windows', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: false,
      });

      expect(createShellCommand(['echo', 'hello & world'])).toBe('echo "hello & world"');
      expect(createShellCommand(['echo', 'hello > output.txt'])).toBe('echo "hello > output.txt"');
    });

    it('should handle quotes in arguments on Windows', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: false,
      });

      expect(createShellCommand(['echo', 'say "hello"'])).toBe('echo "say ""hello"""');
    });

    it('should throw error for invalid input', () => {
      expect(() => createShellCommand([])).toThrow('Command parts must be a non-empty array');
      expect(() => createShellCommand(null as any)).toThrow('Command parts must be a non-empty array');
      expect(() => createShellCommand(undefined as any)).toThrow('Command parts must be a non-empty array');
      expect(() => createShellCommand([123] as any)).toThrow('Command part at index 0 must be a string');
      expect(() => createShellCommand(['git', null] as any)).toThrow('Command part at index 1 must be a string');
    });
  });

  describe('createEnvironmentConfig', () => {
    beforeEach(() => {
      process.env = {
        HOME: '/home/user',
        PATH: '/usr/bin:/bin',
        USER: 'testuser',
      };
    });

    it('should inherit process environment by default', () => {
      const env = createEnvironmentConfig();
      expect(env.HOME).toBe('/home/user');
      expect(env.PATH).toBe('/usr/bin:/bin');
      expect(env.USER).toBe('testuser');
    });

    it('should merge custom environment variables with inheritance', () => {
      const env = createEnvironmentConfig({
        env: {
          NODE_ENV: 'test',
          CUSTOM_VAR: 'value'
        }
      });

      expect(env.HOME).toBe('/home/user');
      expect(env.PATH).toBe('/usr/bin:/bin');
      expect(env.NODE_ENV).toBe('test');
      expect(env.CUSTOM_VAR).toBe('value');
    });

    it('should override inherited variables with custom ones', () => {
      const env = createEnvironmentConfig({
        env: {
          USER: 'overridden'
        }
      });

      expect(env.HOME).toBe('/home/user');
      expect(env.USER).toBe('overridden');
    });

    it('should not inherit process environment when disabled', () => {
      const env = createEnvironmentConfig({
        inheritEnv: false,
        env: {
          CUSTOM_VAR: 'value'
        }
      });

      expect(env.HOME).toBeUndefined();
      expect(env.PATH).toBeUndefined();
      expect(env.CUSTOM_VAR).toBe('value');
    });

    it('should handle empty environment configuration', () => {
      const env = createEnvironmentConfig({
        inheritEnv: false,
        env: {}
      });

      expect(Object.keys(env)).toHaveLength(0);
    });

    it('should handle undefined environment variables', () => {
      const env = createEnvironmentConfig({
        env: {
          DEFINED: 'value',
          UNDEFINED: undefined as any
        }
      });

      expect(env.DEFINED).toBe('value');
      expect(env.UNDEFINED).toBeUndefined();
    });
  });

  describe('Constants', () => {
    it('should export correct PATH_SEPARATOR based on current platform', () => {
      // Constants are evaluated at module load time, so we test their current values
      if (process.platform === 'win32') {
        expect(PATH_SEPARATOR).toBe(';');
      } else {
        expect(PATH_SEPARATOR).toBe(':');
      }
    });

    it('should export correct LINE_ENDING based on current platform', () => {
      // Constants are evaluated at module load time, so we test their current values
      if (process.platform === 'win32') {
        expect(LINE_ENDING).toBe('\r\n');
      } else {
        expect(LINE_ENDING).toBe('\n');
      }
    });

    it('should export SHELL_CONSTANTS with expected values', () => {
      expect(SHELL_CONSTANTS.DEFAULT_TIMEOUT).toBe(30000);
      expect(SHELL_CONSTANTS.MAX_BUFFER).toBe(1024 * 1024);
      expect(typeof SHELL_CONSTANTS.PATH_SEPARATOR).toBe('string');
      expect(typeof SHELL_CONSTANTS.LINE_ENDING).toBe('string');
    });
  });

  describe('Integration Tests', () => {
    it('should create valid shell configuration for platform', () => {
      const config = getPlatformShell();
      const killCmd = getKillCommand(1234);
      const executable = resolveExecutable('node');

      expect(typeof config.shell).toBe('string');
      expect(config.shell.length).toBeGreaterThan(0);
      expect(Array.isArray(config.shellArgs)).toBe(true);
      expect(Array.isArray(killCmd)).toBe(true);
      expect(typeof executable).toBe('string');
      expect(executable.length).toBeGreaterThan(0);
    });

    it('should create consistent platform-specific configurations', () => {
      const isWin = isWindows();
      const config = getPlatformShell();
      const killCmd = getKillCommand(1234);
      const executable = resolveExecutable('test');

      if (isWin) {
        expect(config.shell).toBe('cmd.exe');
        expect(killCmd[0]).toBe('taskkill');
        expect(executable.endsWith('.exe')).toBe(true);
      } else {
        expect(config.shell).toBe('/bin/sh');
        expect(killCmd[0]).toBe('kill');
        expect(executable).toBe('test');
      }
    });

    it('should handle complex shell command creation', () => {
      const parts = ['node', 'script.js', '--arg', 'value with spaces'];
      const command = createShellCommand(parts);

      expect(typeof command).toBe('string');
      expect(command.includes('node')).toBe(true);
      expect(command.includes('script.js')).toBe(true);
      expect(command.includes('--arg')).toBe(true);
    });

    it('should create environment with shell-related variables', () => {
      process.env.SHELL = '/bin/bash';
      process.env.PATH = '/usr/bin:/bin';

      const env = createEnvironmentConfig({
        env: {
          NODE_ENV: 'test'
        }
      });

      expect(env.SHELL).toBe('/bin/bash');
      expect(env.PATH).toBe('/usr/bin:/bin');
      expect(env.NODE_ENV).toBe('test');
    });
  });

  describe('Type Safety', () => {
    it('should have proper TypeScript interfaces', () => {
      // These tests ensure the types are properly exported and usable
      const config: ShellConfig = {
        shell: '/bin/sh',
        shellArgs: ['-c']
      };

      const envConfig: EnvironmentConfig = {
        env: { TEST: 'value' },
        inheritEnv: true,
        cwd: '/tmp'
      };

      expect(typeof config.shell).toBe('string');
      expect(Array.isArray(config.shellArgs)).toBe(true);
      expect(typeof envConfig.env).toBe('object');
      expect(typeof envConfig.inheritEnv).toBe('boolean');
      expect(typeof envConfig.cwd).toBe('string');
    });
  });
});
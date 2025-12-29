import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
} from '../shell-utils.js';

// These tests will only run on actual Windows systems
// They validate that the functions work correctly with real Windows environment
const isActualWindows = process.platform === 'win32';

describe('shell-utils Windows Integration Tests', () => {
  // Skip all tests if not on Windows
  beforeEach(function () {
    if (!isActualWindows) {
      this.skip();
    }
  });

  describe('Real Windows Environment Tests', () => {
    it('should detect Windows platform correctly', () => {
      expect(isWindows()).toBe(true);
    });

    it('should return Windows shell configuration', () => {
      const config = getPlatformShell();

      expect(config.shell).toBe('cmd.exe');
      expect(config.shellArgs).toEqual(['/d', '/s', '/c']);
    });

    it('should use Windows path separator', () => {
      expect(PATH_SEPARATOR).toBe(';');
    });

    it('should use Windows line endings', () => {
      expect(LINE_ENDING).toBe('\r\n');
    });

    it('should generate correct Windows kill commands', () => {
      const killCmd = getKillCommand(1234);
      expect(killCmd).toEqual(['taskkill', '/f', '/pid', '1234']);
    });

    it('should resolve executables with .exe extension', () => {
      expect(resolveExecutable('node')).toBe('node.exe');
      expect(resolveExecutable('npm')).toBe('npm.exe');
      expect(resolveExecutable('git')).toBe('git.exe');

      // Should preserve existing extensions
      expect(resolveExecutable('program.exe')).toBe('program.exe');
      expect(resolveExecutable('script.cmd')).toBe('script.cmd');
      expect(resolveExecutable('batch.bat')).toBe('batch.bat');
    });

    it('should create Windows-style shell commands with proper escaping', () => {
      // Simple commands
      expect(createShellCommand(['git', 'status']))
        .toBe('git status');

      // Commands with spaces should be quoted
      expect(createShellCommand(['git', 'commit', '-m', 'hello world']))
        .toBe('git commit -m "hello world"');

      // Commands with special characters should be quoted
      expect(createShellCommand(['echo', 'hello&world']))
        .toBe('echo "hello&world"');

      // Commands with quotes should escape them
      expect(createShellCommand(['echo', 'say "hello"']))
        .toBe('echo "say ""hello"""');
    });

    it('should handle environment configuration correctly', () => {
      const env = createEnvironmentConfig({
        env: { TEST_VAR: 'test_value' },
        inheritEnv: true
      });

      // Should have inherited Windows environment variables
      expect(env).toHaveProperty('TEST_VAR', 'test_value');

      // Should inherit common Windows env vars if they exist
      if (process.env.USERPROFILE) {
        expect(env).toHaveProperty('USERPROFILE');
      }
      if (process.env.APPDATA) {
        expect(env).toHaveProperty('APPDATA');
      }
      if (process.env.PATH) {
        expect(env).toHaveProperty('PATH');
      }
    });

    it('should validate shell constants on Windows', () => {
      expect(SHELL_CONSTANTS.PATH_SEPARATOR).toBe(';');
      expect(SHELL_CONSTANTS.LINE_ENDING).toBe('\r\n');
      expect(SHELL_CONSTANTS.DEFAULT_TIMEOUT).toBe(30000);
      expect(SHELL_CONSTANTS.MAX_BUFFER).toBe(1024 * 1024);
    });

    describe('Windows-specific edge cases', () => {
      it('should handle Windows drive letters in commands', () => {
        const cmd = createShellCommand(['cd', 'C:\\Users\\test']);
        expect(cmd).toBe('cd C:\\Users\\test');
      });

      it('should handle UNC paths in commands', () => {
        const cmd = createShellCommand(['copy', '\\\\server\\share\\file.txt', 'C:\\local\\']);
        expect(cmd).toBe('copy \\\\server\\share\\file.txt C:\\local\\');
      });

      it('should handle Windows batch file extensions', () => {
        expect(resolveExecutable('script.bat')).toBe('script.bat');
        expect(resolveExecutable('script.cmd')).toBe('script.cmd');
        expect(resolveExecutable('SCRIPT.BAT')).toBe('SCRIPT.BAT'); // Case preserved
      });

      it('should handle Windows environment variables in paths', () => {
        const cmd = createShellCommand(['echo', '%USERPROFILE%\\Documents']);
        expect(cmd).toBe('echo %USERPROFILE%\\Documents');
      });

      it('should handle commands with caret escaping needs', () => {
        const cmd = createShellCommand(['echo', 'text^with^carets']);
        expect(cmd).toBe('echo "text^with^carets"');
      });

      it('should handle mixed forward and back slashes', () => {
        const cmd = createShellCommand(['xcopy', 'source\\path/', 'dest/path\\']);
        expect(cmd).toBe('xcopy source\\path/ dest/path\\');
      });

      it('should handle very long paths (MAX_PATH considerations)', () => {
        // Windows has a 260 character path limit by default
        const longPath = 'C:\\' + 'very_long_directory_name\\'.repeat(10) + 'file.txt';
        const cmd = createShellCommand(['type', longPath]);
        expect(cmd).toContain(longPath);
        expect(typeof cmd).toBe('string');
      });

      it('should handle Windows reserved device names', () => {
        // Windows has reserved names like CON, PRN, AUX, etc.
        const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1'];
        for (const name of reservedNames) {
          const cmd = createShellCommand(['echo', `test${name}.txt`]);
          expect(cmd).toBe(`echo test${name}.txt`);
        }
      });

      it('should handle process IDs within Windows range', () => {
        // Test with typical Windows PID ranges
        const windowsPids = [4, 1000, 32767, 65535]; // Common Windows PID values
        for (const pid of windowsPids) {
          const killCmd = getKillCommand(pid);
          expect(killCmd).toEqual(['taskkill', '/f', '/pid', pid.toString()]);
        }
      });
    });

    describe('Integration with Windows system tools', () => {
      it('should create commands for common Windows utilities', () => {
        const utilities = [
          { name: 'powershell', args: ['-Command', 'Get-Process'] },
          { name: 'cmd', args: ['/c', 'dir'] },
          { name: 'wmic', args: ['process', 'list'] },
          { name: 'tasklist', args: ['/fo', 'csv'] },
        ];

        for (const util of utilities) {
          const resolved = resolveExecutable(util.name);
          const cmd = createShellCommand([resolved, ...util.args]);

          expect(resolved).toMatch(/\.(exe|cmd|bat)$/);
          expect(cmd).toContain(util.name);
          expect(typeof cmd).toBe('string');
        }
      });

      it('should handle Windows service commands', () => {
        const serviceCommands = [
          ['sc', 'query', 'Spooler'],
          ['net', 'start', 'MyService'],
          ['net', 'stop', 'MyService'],
        ];

        for (const cmdParts of serviceCommands) {
          const cmd = createShellCommand(cmdParts);
          expect(cmd).toContain(cmdParts[0]);
          expect(typeof cmd).toBe('string');
        }
      });
    });
  });

  describe('Environment-specific behavior', () => {
    it('should handle Windows-specific environment variables', () => {
      const windowsEnvVars = {
        COMPUTERNAME: 'TEST-PC',
        USERNAME: 'testuser',
        USERPROFILE: 'C:\\Users\\testuser',
        APPDATA: 'C:\\Users\\testuser\\AppData\\Roaming',
        LOCALAPPDATA: 'C:\\Users\\testuser\\AppData\\Local',
        TEMP: 'C:\\Users\\testuser\\AppData\\Local\\Temp',
        WINDIR: 'C:\\Windows',
        SYSTEMROOT: 'C:\\Windows',
        ProgramFiles: 'C:\\Program Files',
        'ProgramFiles(x86)': 'C:\\Program Files (x86)',
      };

      const env = createEnvironmentConfig({
        env: windowsEnvVars,
        inheritEnv: false
      });

      expect(env).toEqual(windowsEnvVars);
    });

    it('should merge Windows environment variables correctly', () => {
      const customEnv = {
        MY_CUSTOM_VAR: 'custom_value',
        PATH: 'C:\\MyApp\\bin;' + (process.env.PATH || ''),
      };

      const env = createEnvironmentConfig({
        env: customEnv,
        inheritEnv: true
      });

      expect(env.MY_CUSTOM_VAR).toBe('custom_value');
      expect(env.PATH).toContain('C:\\MyApp\\bin');

      // Should still have inherited environment
      if (process.env.USERPROFILE) {
        expect(env.USERPROFILE).toBe(process.env.USERPROFILE);
      }
    });

    it('should handle Windows path separators in environment', () => {
      const pathValue = 'C:\\App1\\bin;C:\\App2\\bin;D:\\Tools';
      const env = createEnvironmentConfig({
        env: { PATH: pathValue },
        inheritEnv: false
      });

      expect(env.PATH).toBe(pathValue);
      expect(env.PATH).toContain(';'); // Windows path separator
    });
  });

  describe('Performance on Windows', () => {
    it('should execute path operations efficiently', () => {
      const start = performance.now();

      // Perform multiple operations
      for (let i = 0; i < 1000; i++) {
        isWindows();
        getPlatformShell();
        resolveExecutable('test');
      }

      const duration = performance.now() - start;

      // Should complete within reasonable time (less than 100ms for 1000 operations)
      expect(duration).toBeLessThan(100);
    });

    it('should handle large environment configurations efficiently', () => {
      // Create a large environment configuration
      const largeEnv: Record<string, string> = {};
      for (let i = 0; i < 1000; i++) {
        largeEnv[`VAR_${i}`] = `value_${i}`.repeat(10);
      }

      const start = performance.now();
      const env = createEnvironmentConfig({
        env: largeEnv,
        inheritEnv: true
      });
      const duration = performance.now() - start;

      expect(Object.keys(env).length).toBeGreaterThanOrEqual(1000);
      expect(duration).toBeLessThan(50); // Should be fast
    });
  });

  describe('Error handling on Windows', () => {
    it('should provide meaningful error messages for Windows-specific issues', () => {
      // Test error handling with Windows-specific scenarios
      expect(() => getKillCommand(0)).toThrow('PID must be a positive integer');
      expect(() => resolveExecutable('')).toThrow('Executable name must be a non-empty string');
      expect(() => createShellCommand([])).toThrow('Command parts must be a non-empty array');
    });

    it('should handle Windows long path limitations gracefully', () => {
      // Create a path that exceeds traditional Windows MAX_PATH
      const veryLongPath = 'C:\\' + 'a'.repeat(300) + '\\file.txt';

      // Should not throw, even if the path is very long
      expect(() => {
        createShellCommand(['type', veryLongPath]);
      }).not.toThrow();
    });

    it('should handle Windows forbidden characters in filenames', () => {
      // Windows forbids certain characters in filenames: < > : " | ? * and control characters
      const forbiddenChars = ['<', '>', ':', '"', '|', '?', '*'];

      for (const char of forbiddenChars) {
        const filename = `file${char}name.txt`;
        const cmd = createShellCommand(['echo', filename]);

        // Should properly quote the filename
        expect(cmd).toContain('"');
        expect(cmd).toContain(filename);
      }
    });
  });
});
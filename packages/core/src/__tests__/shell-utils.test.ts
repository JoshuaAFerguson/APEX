import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  type EnvironmentConfig
} from '../shell-utils.js';

// Mock os.platform() to test both platforms
vi.mock('os', async () => {
  const actual = await vi.importActual('os');
  return {
    ...actual,
    platform: vi.fn()
  };
});

// Import after mock setup
import * as os from 'os';
const mockPlatform = vi.mocked(os.platform);

describe('shell-utils', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('isWindows', () => {
    it('returns true when platform is win32', () => {
      mockPlatform.mockReturnValue('win32');
      expect(isWindows()).toBe(true);
    });

    it('returns false when platform is not win32', () => {
      mockPlatform.mockReturnValue('darwin');
      expect(isWindows()).toBe(false);

      mockPlatform.mockReturnValue('linux');
      expect(isWindows()).toBe(false);

      mockPlatform.mockReturnValue('freebsd');
      expect(isWindows()).toBe(false);
    });
  });

  describe('getPlatformShell', () => {
    it('returns cmd.exe configuration for Windows', () => {
      mockPlatform.mockReturnValue('win32');

      const config = getPlatformShell();

      expect(config).toEqual({
        shell: 'cmd.exe',
        shellArgs: ['/d', '/s', '/c']
      });
      expect(typeof config.shell).toBe('string');
      expect(Array.isArray(config.shellArgs)).toBe(true);
    });

    it('returns sh configuration for Unix-like systems', () => {
      mockPlatform.mockReturnValue('darwin');

      let config = getPlatformShell();
      expect(config).toEqual({
        shell: '/bin/sh',
        shellArgs: ['-c']
      });

      mockPlatform.mockReturnValue('linux');

      config = getPlatformShell();
      expect(config).toEqual({
        shell: '/bin/sh',
        shellArgs: ['-c']
      });
    });

    it('returns consistent interface structure', () => {
      mockPlatform.mockReturnValue('win32');
      const windowsConfig = getPlatformShell();

      mockPlatform.mockReturnValue('linux');
      const unixConfig = getPlatformShell();

      // Both should have same structure
      expect(windowsConfig).toHaveProperty('shell');
      expect(windowsConfig).toHaveProperty('shellArgs');
      expect(unixConfig).toHaveProperty('shell');
      expect(unixConfig).toHaveProperty('shellArgs');

      expect(typeof windowsConfig.shell).toBe('string');
      expect(Array.isArray(windowsConfig.shellArgs)).toBe(true);
      expect(typeof unixConfig.shell).toBe('string');
      expect(Array.isArray(unixConfig.shellArgs)).toBe(true);
    });
  });

  describe('getKillCommand', () => {
    describe('Windows platform', () => {
      beforeEach(() => {
        mockPlatform.mockReturnValue('win32');
      });

      it('returns taskkill command for valid PID', () => {
        expect(getKillCommand(1234)).toEqual(['taskkill', '/f', '/pid', '1234']);
        expect(getKillCommand(1)).toEqual(['taskkill', '/f', '/pid', '1']);
        expect(getKillCommand(999999)).toEqual(['taskkill', '/f', '/pid', '999999']);
      });

      it('throws error for invalid PIDs', () => {
        expect(() => getKillCommand(0)).toThrow('PID must be a positive integer');
        expect(() => getKillCommand(-1)).toThrow('PID must be a positive integer');
        expect(() => getKillCommand(-100)).toThrow('PID must be a positive integer');
      });

      it('throws error for non-integer PIDs', () => {
        expect(() => getKillCommand(1.5)).toThrow('PID must be a positive integer');
        expect(() => getKillCommand(NaN)).toThrow('PID must be a positive integer');
        expect(() => getKillCommand(Infinity)).toThrow('PID must be a positive integer');
        expect(() => getKillCommand(-Infinity)).toThrow('PID must be a positive integer');
      });
    });

    describe('Unix-like platforms', () => {
      beforeEach(() => {
        mockPlatform.mockReturnValue('linux');
      });

      it('returns kill command for valid PID', () => {
        expect(getKillCommand(1234)).toEqual(['kill', '-9', '1234']);
        expect(getKillCommand(1)).toEqual(['kill', '-9', '1']);
        expect(getKillCommand(999999)).toEqual(['kill', '-9', '999999']);
      });

      it('throws error for invalid PIDs', () => {
        expect(() => getKillCommand(0)).toThrow('PID must be a positive integer');
        expect(() => getKillCommand(-1)).toThrow('PID must be a positive integer');
        expect(() => getKillCommand(-100)).toThrow('PID must be a positive integer');
      });

      it('throws error for non-integer PIDs', () => {
        expect(() => getKillCommand(1.5)).toThrow('PID must be a positive integer');
        expect(() => getKillCommand(NaN)).toThrow('PID must be a positive integer');
        expect(() => getKillCommand(Infinity)).toThrow('PID must be a positive integer');
        expect(() => getKillCommand(-Infinity)).toThrow('PID must be a positive integer');
      });
    });

    describe('cross-platform consistency', () => {
      it('returns array of strings on all platforms', () => {
        mockPlatform.mockReturnValue('win32');
        const windowsResult = getKillCommand(1234);

        mockPlatform.mockReturnValue('linux');
        const unixResult = getKillCommand(1234);

        expect(Array.isArray(windowsResult)).toBe(true);
        expect(Array.isArray(unixResult)).toBe(true);
        expect(windowsResult.every(part => typeof part === 'string')).toBe(true);
        expect(unixResult.every(part => typeof part === 'string')).toBe(true);
      });

      it('includes PID as string in all cases', () => {
        mockPlatform.mockReturnValue('win32');
        expect(getKillCommand(1234)).toContain('1234');

        mockPlatform.mockReturnValue('linux');
        expect(getKillCommand(1234)).toContain('1234');
      });
    });
  });

  describe('resolveExecutable', () => {
    describe('Windows platform', () => {
      beforeEach(() => {
        mockPlatform.mockReturnValue('win32');
      });

      it('adds .exe extension to executables without extension', () => {
        expect(resolveExecutable('node')).toBe('node.exe');
        expect(resolveExecutable('git')).toBe('git.exe');
        expect(resolveExecutable('npm')).toBe('npm.exe');
        expect(resolveExecutable('python')).toBe('python.exe');
      });

      it('preserves existing executable extensions', () => {
        expect(resolveExecutable('program.exe')).toBe('program.exe');
        expect(resolveExecutable('script.cmd')).toBe('script.cmd');
        expect(resolveExecutable('batch.bat')).toBe('batch.bat');
        expect(resolveExecutable('PROGRAM.EXE')).toBe('PROGRAM.EXE');
        expect(resolveExecutable('Script.CMD')).toBe('Script.CMD');
      });

      it('handles whitespace in names', () => {
        expect(resolveExecutable('  node  ')).toBe('node.exe');
        expect(resolveExecutable('\tgit\n')).toBe('git.exe');
        expect(resolveExecutable('  program.exe  ')).toBe('program.exe');
      });

      it('throws error for invalid input', () => {
        expect(() => resolveExecutable('')).toThrow('Executable name must be a non-empty string');
        expect(() => resolveExecutable('   ')).toThrow('Executable name must be a non-empty string');
        expect(() => resolveExecutable('\t\n')).toThrow('Executable name must be a non-empty string');
      });
    });

    describe('Unix-like platforms', () => {
      beforeEach(() => {
        mockPlatform.mockReturnValue('linux');
      });

      it('returns executables as-is without adding extensions', () => {
        expect(resolveExecutable('node')).toBe('node');
        expect(resolveExecutable('git')).toBe('git');
        expect(resolveExecutable('npm')).toBe('npm');
        expect(resolveExecutable('python')).toBe('python');
      });

      it('preserves any existing extensions', () => {
        expect(resolveExecutable('program.exe')).toBe('program.exe');
        expect(resolveExecutable('script.py')).toBe('script.py');
        expect(resolveExecutable('app.js')).toBe('app.js');
      });

      it('handles whitespace in names', () => {
        expect(resolveExecutable('  node  ')).toBe('node');
        expect(resolveExecutable('\tgit\n')).toBe('git');
      });

      it('throws error for invalid input', () => {
        expect(() => resolveExecutable('')).toThrow('Executable name must be a non-empty string');
        expect(() => resolveExecutable('   ')).toThrow('Executable name must be a non-empty string');
        expect(() => resolveExecutable('\t\n')).toThrow('Executable name must be a non-empty string');
      });
    });

    describe('cross-platform behavior', () => {
      it('validates input consistently across platforms', () => {
        const invalidInputs = ['', '   ', '\t\n', '\r\n\t '];

        for (const platform of ['win32', 'linux', 'darwin']) {
          mockPlatform.mockReturnValue(platform);
          for (const input of invalidInputs) {
            expect(() => resolveExecutable(input)).toThrow('Executable name must be a non-empty string');
          }
        }
      });

      it('handles valid names on all platforms', () => {
        const validNames = ['node', 'git', 'python3', 'my-app'];

        mockPlatform.mockReturnValue('win32');
        for (const name of validNames) {
          expect(() => resolveExecutable(name)).not.toThrow();
          expect(resolveExecutable(name)).toContain(name);
        }

        mockPlatform.mockReturnValue('linux');
        for (const name of validNames) {
          expect(() => resolveExecutable(name)).not.toThrow();
          expect(resolveExecutable(name)).toBe(name);
        }
      });
    });
  });

  describe('createShellCommand', () => {
    describe('Windows platform', () => {
      beforeEach(() => {
        mockPlatform.mockReturnValue('win32');
      });

      it('joins simple command parts with spaces', () => {
        expect(createShellCommand(['git', 'status'])).toBe('git status');
        expect(createShellCommand(['npm', 'install'])).toBe('npm install');
        expect(createShellCommand(['echo', 'hello'])).toBe('echo hello');
      });

      it('quotes arguments with spaces', () => {
        expect(createShellCommand(['git', 'commit', '-m', 'hello world']))
          .toBe('git commit -m "hello world"');
        expect(createShellCommand(['echo', 'hello world', 'foo bar']))
          .toBe('echo "hello world" "foo bar"');
      });

      it('quotes arguments with special characters', () => {
        expect(createShellCommand(['echo', 'hello&world'])).toBe('echo "hello&world"');
        expect(createShellCommand(['echo', 'hello|world'])).toBe('echo "hello|world"');
        expect(createShellCommand(['echo', 'hello<world'])).toBe('echo "hello<world"');
        expect(createShellCommand(['echo', 'hello>world'])).toBe('echo "hello>world"');
        expect(createShellCommand(['echo', 'hello^world'])).toBe('echo "hello^world"');
      });

      it('escapes quotes inside arguments', () => {
        expect(createShellCommand(['echo', 'hello"world']))
          .toBe('echo "hello""world"');
        expect(createShellCommand(['echo', 'say "hello"']))
          .toBe('echo "say ""hello"""');
      });

      it('handles mixed simple and complex arguments', () => {
        expect(createShellCommand(['git', 'commit', '-m', 'fix: update "core" module']))
          .toBe('git commit -m "fix: update ""core"" module"');
      });
    });

    describe('Unix-like platforms', () => {
      beforeEach(() => {
        mockPlatform.mockReturnValue('linux');
      });

      it('joins simple command parts with spaces', () => {
        expect(createShellCommand(['git', 'status'])).toBe('git status');
        expect(createShellCommand(['npm', 'install'])).toBe('npm install');
        expect(createShellCommand(['echo', 'hello'])).toBe('echo hello');
      });

      it('quotes arguments with spaces', () => {
        expect(createShellCommand(['git', 'commit', '-m', 'hello world']))
          .toBe("git commit -m 'hello world'");
        expect(createShellCommand(['echo', 'hello world', 'foo bar']))
          .toBe("echo 'hello world' 'foo bar'");
      });

      it('quotes arguments with shell special characters', () => {
        const specialChars = ['$', '`', '"', '\'', '\\', '|', '&', ';', '<', '>', '(', ')', '{', '}', '*', '?', '[', ']', '~'];
        for (const char of specialChars) {
          const result = createShellCommand(['echo', `hello${char}world`]);
          expect(result).toBe(`echo 'hello${char}world'`);
        }
      });

      it('escapes single quotes inside arguments', () => {
        expect(createShellCommand(['echo', "hello'world"]))
          .toBe("echo 'hello'\"'\"'world'");
        expect(createShellCommand(['echo', "say 'hello'"]))
          .toBe("echo 'say '\"'\"'hello'\"'\"''");
      });

      it('handles mixed simple and complex arguments', () => {
        expect(createShellCommand(['git', 'commit', '-m', "fix: update 'core' module"]))
          .toBe("git commit -m 'fix: update '\"'\"'core'\"'\"' module'");
      });
    });

    describe('error handling', () => {
      it('throws error for empty command array', () => {
        mockPlatform.mockReturnValue('win32');
        expect(() => createShellCommand([])).toThrow('Command parts must be a non-empty array');

        mockPlatform.mockReturnValue('linux');
        expect(() => createShellCommand([])).toThrow('Command parts must be a non-empty array');
      });

      it('throws error for non-array input', () => {
        mockPlatform.mockReturnValue('win32');
        expect(() => createShellCommand(null as any)).toThrow('Command parts must be a non-empty array');
        expect(() => createShellCommand(undefined as any)).toThrow('Command parts must be a non-empty array');
        expect(() => createShellCommand('string' as any)).toThrow('Command parts must be a non-empty array');
      });

      it('throws error for non-string parts', () => {
        mockPlatform.mockReturnValue('win32');
        expect(() => createShellCommand(['git', 123 as any])).toThrow('Command part at index 1 must be a string');
        expect(() => createShellCommand([null as any, 'status'])).toThrow('Command part at index 0 must be a string');
        expect(() => createShellCommand(['git', undefined as any])).toThrow('Command part at index 1 must be a string');
      });
    });

    describe('cross-platform consistency', () => {
      it('always returns a string', () => {
        const commands = [
          ['git', 'status'],
          ['echo', 'hello world'],
          ['npm', 'run', 'build']
        ];

        for (const platform of ['win32', 'linux', 'darwin']) {
          mockPlatform.mockReturnValue(platform);
          for (const cmd of commands) {
            const result = createShellCommand(cmd);
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
          }
        }
      });
    });
  });

  describe('createEnvironmentConfig', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Create a clean mock environment
      process.env = {
        PATH: '/usr/bin:/bin',
        HOME: '/home/user',
        USER: 'testuser'
      };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('returns empty object when inheritEnv is false and no env provided', () => {
      const result = createEnvironmentConfig({ inheritEnv: false });
      expect(result).toEqual({});
    });

    it('returns custom env when inheritEnv is false', () => {
      const customEnv = { MY_VAR: 'value', ANOTHER: 'test' };
      const result = createEnvironmentConfig({ env: customEnv, inheritEnv: false });
      expect(result).toEqual(customEnv);
      expect(result).not.toHaveProperty('PATH');
      expect(result).not.toHaveProperty('HOME');
    });

    it('inherits process env by default', () => {
      const result = createEnvironmentConfig();
      expect(result).toMatchObject({
        PATH: '/usr/bin:/bin',
        HOME: '/home/user',
        USER: 'testuser'
      });
    });

    it('merges custom env with inherited env', () => {
      const customEnv = { MY_VAR: 'value', PATH: '/custom/path' };
      const result = createEnvironmentConfig({ env: customEnv });

      expect(result).toMatchObject({
        MY_VAR: 'value',
        PATH: '/custom/path', // Custom should override inherited
        HOME: '/home/user',   // Inherited should still be present
        USER: 'testuser'      // Inherited should still be present
      });
    });

    it('handles undefined custom env with inheritance', () => {
      const result = createEnvironmentConfig({ inheritEnv: true });
      expect(result).toMatchObject({
        PATH: '/usr/bin:/bin',
        HOME: '/home/user',
        USER: 'testuser'
      });
    });

    it('handles empty custom env with inheritance', () => {
      const result = createEnvironmentConfig({ env: {}, inheritEnv: true });
      expect(result).toMatchObject({
        PATH: '/usr/bin:/bin',
        HOME: '/home/user',
        USER: 'testuser'
      });
    });

    it('uses default options when called with no arguments', () => {
      const result = createEnvironmentConfig();
      // Should inherit by default
      expect(result).toMatchObject({
        PATH: '/usr/bin:/bin',
        HOME: '/home/user',
        USER: 'testuser'
      });
    });

    it('preserves all inherited env variables', () => {
      process.env.CUSTOM_VAR = 'custom_value';
      process.env.ANOTHER_VAR = 'another_value';

      const result = createEnvironmentConfig({ env: { NEW_VAR: 'new' } });

      expect(result).toMatchObject({
        PATH: '/usr/bin:/bin',
        HOME: '/home/user',
        USER: 'testuser',
        CUSTOM_VAR: 'custom_value',
        ANOTHER_VAR: 'another_value',
        NEW_VAR: 'new'
      });
    });

    it('handles cwd option without affecting env creation', () => {
      const result = createEnvironmentConfig({ cwd: '/some/path' });
      expect(result).toMatchObject({
        PATH: '/usr/bin:/bin',
        HOME: '/home/user',
        USER: 'testuser'
      });
      // cwd should not be in the environment
      expect(result).not.toHaveProperty('cwd');
    });

    it('returns Record<string, string> type', () => {
      const result = createEnvironmentConfig({ env: { TEST: 'value' } });
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(false);

      // Verify all values are strings
      for (const [key, value] of Object.entries(result)) {
        expect(typeof key).toBe('string');
        expect(typeof value).toBe('string');
      }
    });
  });

  describe('Constants', () => {
    it('exports PATH_SEPARATOR as expected values', () => {
      // Constants are evaluated at module load time, so we test expected values
      expect(PATH_SEPARATOR).toMatch(/^[;:]$/);
      expect(typeof PATH_SEPARATOR).toBe('string');
    });

    it('exports LINE_ENDING as expected values', () => {
      // Constants are evaluated at module load time, so we test expected values
      expect(LINE_ENDING).toMatch(/^(\r\n|\n)$/);
      expect(typeof LINE_ENDING).toBe('string');
    });

    it('exports SHELL_CONSTANTS with correct structure', () => {
      expect(SHELL_CONSTANTS).toHaveProperty('PATH_SEPARATOR');
      expect(SHELL_CONSTANTS).toHaveProperty('LINE_ENDING');
      expect(SHELL_CONSTANTS).toHaveProperty('DEFAULT_TIMEOUT');
      expect(SHELL_CONSTANTS).toHaveProperty('MAX_BUFFER');

      expect(typeof SHELL_CONSTANTS.DEFAULT_TIMEOUT).toBe('number');
      expect(typeof SHELL_CONSTANTS.MAX_BUFFER).toBe('number');
      expect(SHELL_CONSTANTS.DEFAULT_TIMEOUT).toBe(30000);
      expect(SHELL_CONSTANTS.MAX_BUFFER).toBe(1024 * 1024);
    });

    it('SHELL_CONSTANTS is immutable', () => {
      expect(() => {
        (SHELL_CONSTANTS as any).DEFAULT_TIMEOUT = 5000;
      }).toThrow();

      expect(() => {
        (SHELL_CONSTANTS as any).NEW_PROPERTY = 'test';
      }).toThrow();
    });
  });

  describe('Type Definitions', () => {
    it('ShellConfig has correct structure', () => {
      mockPlatform.mockReturnValue('win32');
      const config: ShellConfig = getPlatformShell();

      expect(config).toHaveProperty('shell');
      expect(config).toHaveProperty('shellArgs');
      expect(typeof config.shell).toBe('string');
      expect(Array.isArray(config.shellArgs)).toBe(true);
    });

    it('EnvironmentConfig supports all optional properties', () => {
      const configs: EnvironmentConfig[] = [
        {},
        { env: { TEST: 'value' } },
        { inheritEnv: false },
        { cwd: '/path' },
        { env: { A: '1' }, inheritEnv: true, cwd: '/test' }
      ];

      for (const config of configs) {
        expect(() => createEnvironmentConfig(config)).not.toThrow();
      }
    });
  });

  describe('Edge Cases and Error Boundaries', () => {
    it('handles extreme PID values', () => {
      mockPlatform.mockReturnValue('linux');

      // Very large PID (within JS safe integer range)
      const largePid = Number.MAX_SAFE_INTEGER;
      expect(() => getKillCommand(largePid)).not.toThrow();
      expect(getKillCommand(largePid)).toContain(largePid.toString());

      // Just outside safe integer range - this will be treated as non-integer
      expect(() => getKillCommand(Number.MAX_SAFE_INTEGER + 1)).toThrow('PID must be a positive integer');
    });

    it('handles empty and whitespace-only executable names correctly', () => {
      mockPlatform.mockReturnValue('win32');

      const whitespaceInputs = [
        '   ',
        '\t',
        '\n',
        '\r',
        '\r\n',
        '\t\n\r   ',
        '          '
      ];

      for (const input of whitespaceInputs) {
        expect(() => resolveExecutable(input)).toThrow('Executable name must be a non-empty string');
      }
    });

    it('handles malformed command arrays gracefully', () => {
      mockPlatform.mockReturnValue('linux');

      const malformedArrays = [
        [123, 'test'],
        ['git', null],
        ['git', undefined],
        [true, 'status'],
        ['git', {}],
        ['git', []],
        [Symbol('test'), 'status']
      ];

      for (const [index, arr] of malformedArrays.entries()) {
        expect(() => createShellCommand(arr as any)).toThrow(/Command part at index \d+ must be a string/);
      }
    });

    it('preserves original process.env when not inheriting', () => {
      const originalKeys = Object.keys(process.env);
      const result = createEnvironmentConfig({ inheritEnv: false, env: { CUSTOM: 'test' } });

      expect(Object.keys(result)).toEqual(['CUSTOM']);
      expect(Object.keys(process.env)).toEqual(originalKeys);
    });
  });

  describe('Integration Scenarios', () => {
    it('can build complete shell execution config', () => {
      mockPlatform.mockReturnValue('win32');

      const shellConfig = getPlatformShell();
      const command = createShellCommand(['git', 'commit', '-m', 'test message']);
      const env = createEnvironmentConfig({ env: { GIT_AUTHOR: 'Test User' } });

      expect(shellConfig.shell).toBe('cmd.exe');
      expect(command).toBe('git commit -m "test message"');
      expect(env).toHaveProperty('GIT_AUTHOR', 'Test User');
      expect(env).toHaveProperty('PATH'); // Inherited
    });

    it('works with realistic command building', () => {
      mockPlatform.mockReturnValue('linux');

      const nodeExecutable = resolveExecutable('node');
      const npmExecutable = resolveExecutable('npm');

      expect(nodeExecutable).toBe('node');
      expect(npmExecutable).toBe('npm');

      const installCommand = createShellCommand([npmExecutable, 'install', '--save-dev', '@types/node']);
      expect(installCommand).toBe("npm install --save-dev '@types/node'");

      const runCommand = createShellCommand([nodeExecutable, '-e', "console.log('hello world')"]);
      expect(runCommand).toBe("node -e 'console.log('\"'\"'hello world'\"'\"''");
    });

    it('handles process management workflow', () => {
      mockPlatform.mockReturnValue('darwin');

      const mockPid = 12345;
      const killCmd = getKillCommand(mockPid);
      const killCommand = createShellCommand(killCmd);

      expect(killCommand).toBe("kill -9 12345");

      mockPlatform.mockReturnValue('win32');
      const killCmdWin = getKillCommand(mockPid);
      const killCommandWin = createShellCommand(killCmdWin);

      expect(killCommandWin).toBe("taskkill /f /pid 12345");
    });
  });
});
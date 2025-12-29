import { describe, it, expect, vi } from 'vitest';
import {
  skipOnWindows,
  skipOnUnix,
  skipOnMacOS,
  skipOnLinux,
  skipUnlessWindows,
  skipUnlessUnix,
  describeWindows,
  describeUnix,
  describeMacOS,
  describeLinux,
  runOnWindows,
  runOnUnix,
  runOnMacOS,
  runOnLinux,
  mockPlatform,
  testOnAllPlatforms,
  isWindows,
  isUnix,
  PLATFORMS,
} from '../test-utils.js';

// Mock os for testing
vi.mock('os', async () => {
  const actual = await vi.importActual('os');
  return {
    ...actual,
    platform: vi.fn(),
  };
});

/**
 * Example tests demonstrating real-world usage of the test utilities
 */
describe('Test Utils Usage Examples', () => {
  describe('File Path Handling', () => {
    it('should handle absolute paths correctly on all platforms', () => {
      testOnAllPlatforms('absolute path handling', (platform) => {
        if (platform === 'win32') {
          const windowsPath = 'C:\\Users\\test\\file.txt';
          expect(windowsPath).toMatch(/^[A-Z]:\\\\/);
        } else {
          const unixPath = '/home/test/file.txt';
          expect(unixPath).toMatch(/^\//);
        }
      });
    });

    describeWindows('Windows path tests', () => {
      it('should handle drive letters', () => {
        const path = 'C:\\Program Files\\MyApp\\config.json';
        expect(path).toMatch(/^[A-Z]:\\\\/);
        expect(path).toContain('\\\\');
      });

      it('should handle UNC paths', () => {
        const uncPath = '\\\\\\\\server\\\\share\\\\file.txt';
        expect(uncPath).toMatch(/^\\\\\\\\\\\\\\\\[^\\\\]+\\\\\\\\/);
      });
    });

    describeUnix('Unix path tests', () => {
      it('should handle absolute paths', () => {
        const path = '/usr/local/bin/myapp';
        expect(path).toMatch(/^\\//);
      });

      it('should handle home directory expansion', () => {
        const homePath = '~/Documents/config.json';
        expect(homePath).toMatch(/^~/);
      });
    });

    describeMacOS('macOS specific paths', () => {
      it('should handle application bundles', () => {
        const appPath = '/Applications/MyApp.app/Contents/MacOS/MyApp';
        expect(appPath).toContain('.app/Contents');
      });

      it('should handle Library paths', () => {
        const libPath = '~/Library/Application Support/MyApp';
        expect(libPath).toContain('Library/Application Support');
      });
    });

    describeLinux('Linux specific paths', () => {
      it('should handle XDG directories', () => {
        const configPath = '~/.config/myapp/config.json';
        expect(configPath).toContain('.config');
      });

      it('should handle system directories', () => {
        const systemPath = '/etc/myapp/config.conf';
        expect(systemPath).toMatch(/^\\/etc\\//);
      });
    });
  });

  describe('Command Execution', () => {
    it('should use correct shell commands per platform', () => {
      const getShellCommand = () => {
        return runOnWindows(() => ({
          shell: 'cmd.exe',
          args: ['/c', 'dir'],
          executable: 'cmd.exe',
        })) || runOnUnix(() => ({
          shell: '/bin/sh',
          args: ['-c', 'ls'],
          executable: '/bin/sh',
        }));
      };

      testOnAllPlatforms('shell command selection', (platform) => {
        const command = getShellCommand();

        if (platform === 'win32') {
          expect(command?.shell).toBe('cmd.exe');
          expect(command?.args).toContain('/c');
        } else {
          expect(command?.shell).toBe('/bin/sh');
          expect(command?.args).toContain('-c');
        }
      });
    });

    it('should handle process spawning differences', () => {
      skipOnWindows(); // This test focuses on Unix process spawning

      const unixSpawnOptions = {
        shell: '/bin/sh',
        stdio: ['pipe', 'pipe', 'pipe'] as const,
        env: { ...process.env, PATH: '/usr/local/bin:/usr/bin:/bin' },
      };

      expect(unixSpawnOptions.shell).toBe('/bin/sh');
      expect(unixSpawnOptions.env.PATH).toContain('/usr/bin');
    });

    it('should handle Windows-specific process options', () => {
      skipUnlessWindows(); // Only run on Windows

      const windowsSpawnOptions = {
        shell: 'cmd.exe',
        stdio: ['pipe', 'pipe', 'pipe'] as const,
        env: { ...process.env, PATH: 'C:\\\\Windows\\\\System32;C:\\\\Windows' },
        windowsHide: true,
      };

      expect(windowsSpawnOptions.shell).toBe('cmd.exe');
      expect(windowsSpawnOptions.windowsHide).toBe(true);
    });
  });

  describe('Environment Variables', () => {
    it('should handle path separators correctly', () => {
      const getPathSeparator = () => {
        return isWindows() ? ';' : ':';
      };

      testOnAllPlatforms('path separator detection', (platform) => {
        const separator = getPathSeparator();
        const expectedSeparator = platform === 'win32' ? ';' : ':';
        expect(separator).toBe(expectedSeparator);
      });
    });

    it('should handle environment variable names', () => {
      const getHomeVarName = () => {
        return isWindows() ? 'USERPROFILE' : 'HOME';
      };

      testOnAllPlatforms('home variable name', (platform) => {
        const homeVar = getHomeVarName();
        const expectedVar = platform === 'win32' ? 'USERPROFILE' : 'HOME';
        expect(homeVar).toBe(expectedVar);
      });
    });
  });

  describe('File System Operations', () => {
    it('should skip permission tests on Windows', () => {
      skipOnWindows(); // Unix file permissions don't apply to Windows

      const unixPermissions = {
        read: 0o444,
        write: 0o644,
        execute: 0o755,
        full: 0o777,
      };

      expect(unixPermissions.execute).toBe(0o755);
      expect(unixPermissions.full & 0o111).toBeTruthy(); // Execute bits
    });

    it('should test Windows file attributes', () => {
      skipOnUnix(); // Windows file attributes don't apply to Unix

      const windowsAttributes = {
        hidden: 0x02,
        system: 0x04,
        readOnly: 0x01,
        archive: 0x20,
      };

      expect(windowsAttributes.hidden).toBe(2);
      expect(windowsAttributes.readOnly).toBe(1);
    });

    it('should handle case sensitivity differences', () => {
      testOnAllPlatforms('case sensitivity', (platform) => {
        const fileName1 = 'MyFile.txt';
        const fileName2 = 'myfile.txt';

        if (platform === 'win32' || platform === 'darwin') {
          // Windows and macOS are case-insensitive by default
          // (though this depends on file system configuration)
          expect(fileName1.toLowerCase()).toBe(fileName2.toLowerCase());
        } else {
          // Linux and other Unix systems are typically case-sensitive
          expect(fileName1).not.toBe(fileName2);
        }
      });
    });
  });

  describe('Conditional Feature Testing', () => {
    it('should test features available on specific platforms', () => {
      const restore = mockPlatform('darwin');

      try {
        const macFeatures = runOnMacOS(() => ({
          spotlight: true,
          appStore: true,
          codesigning: true,
          notarization: true,
        }));

        const windowsFeatures = runOnWindows(() => ({
          registry: true,
          windowsStore: true,
          codesigning: true,
          defender: true,
        }));

        const linuxFeatures = runOnLinux(() => ({
          packageManager: 'apt',
          systemd: true,
          xorg: true,
          wayland: false,
        }));

        expect(macFeatures?.spotlight).toBe(true);
        expect(windowsFeatures).toBeUndefined();
        expect(linuxFeatures).toBeUndefined();
      } finally {
        restore();
      }
    });

    it('should conditionally test network interfaces', () => {
      skipOnMacOS(); // Skip on macOS for this example

      const getNetworkConfig = () => {
        if (isWindows()) {
          return { command: 'ipconfig', flags: ['/all'] };
        } else {
          return { command: 'ifconfig', flags: ['-a'] };
        }
      };

      const config = getNetworkConfig();

      if (isWindows()) {
        expect(config.command).toBe('ipconfig');
        expect(config.flags).toContain('/all');
      } else {
        expect(config.command).toBe('ifconfig');
        expect(config.flags).toContain('-a');
      }
    });
  });

  describe('Cross-Platform Library Testing', () => {
    it('should test a cross-platform utility function', () => {
      const normalizeLineEndings = (text: string) => {
        if (isWindows()) {
          return text.replace(/\\r?\\n/g, '\\r\\n'); // Windows: CRLF
        } else {
          return text.replace(/\\r\\n/g, '\\n'); // Unix: LF
        }
      };

      testOnAllPlatforms('line ending normalization', (platform) => {
        const input = 'Line 1\\nLine 2\\r\\nLine 3';
        const result = normalizeLineEndings(input);

        if (platform === 'win32') {
          expect(result).toContain('\\r\\n');
          expect(result.split('\\r\\n')).toHaveLength(3);
        } else {
          expect(result).not.toContain('\\r\\n');
          expect(result.split('\\n')).toHaveLength(3);
        }
      });
    });

    it('should test configuration file locations', () => {
      const getConfigPath = (appName: string) => {
        if (isWindows()) {
          return `${process.env.APPDATA || 'C:\\\\Users\\\\Default\\\\AppData\\\\Roaming'}\\\\${appName}`;
        } else if (process.platform === 'darwin') {
          return `${process.env.HOME || '/Users/default'}/Library/Preferences/${appName}`;
        } else {
          return `${process.env.XDG_CONFIG_HOME || process.env.HOME + '/.config'}/${appName}`;
        }
      };

      testOnAllPlatforms('config path resolution', (platform) => {
        const configPath = getConfigPath('myapp');

        if (platform === 'win32') {
          expect(configPath).toMatch(/(AppData|Roaming)/);
        } else if (platform === 'darwin') {
          expect(configPath).toContain('/Library/Preferences/');
        } else {
          expect(configPath).toMatch(/\\/(\.config|\\.)/);
        }
      });
    });
  });

  describe('Error Handling Patterns', () => {
    it('should handle platform-specific error codes', () => {
      const getErrorMessage = (code: number) => {
        return runOnWindows(() => {
          // Windows error codes
          const windowsErrors: Record<number, string> = {
            2: 'The system cannot find the file specified.',
            3: 'The system cannot find the path specified.',
            5: 'Access is denied.',
          };
          return windowsErrors[code] || 'Unknown Windows error';
        }) || runOnUnix(() => {
          // Unix errno codes
          const unixErrors: Record<number, string> = {
            2: 'No such file or directory',
            13: 'Permission denied',
            28: 'No space left on device',
          };
          return unixErrors[code] || 'Unknown Unix error';
        });
      };

      testOnAllPlatforms('error message mapping', (platform) => {
        const errorMsg = getErrorMessage(2);

        if (platform === 'win32') {
          expect(errorMsg).toContain('system cannot find');
        } else {
          expect(errorMsg).toContain('No such file');
        }
      });
    });

    it('should handle async operations with platform differences', async () => {
      const asyncOperation = async () => {
        const delay = isWindows() ? 100 : 50; // Different timeouts per platform

        await new Promise((resolve) => setTimeout(resolve, delay));

        return {
          platform: process.platform,
          delay,
          success: true,
        };
      };

      const result = await asyncOperation();

      expect(result.success).toBe(true);
      expect(result.delay).toBeGreaterThan(0);
      expect(typeof result.platform).toBe('string');
    });
  });
});
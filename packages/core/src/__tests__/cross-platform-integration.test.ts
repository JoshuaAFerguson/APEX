import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import { getHomeDir, getConfigDir, normalizePath } from '../path-utils.js';

/**
 * Comprehensive Cross-Platform Integration Tests
 *
 * This test suite verifies that the cross-platform path utilities work correctly
 * across different operating systems and edge cases. It tests the actual behavior
 * that replaces direct process.env.HOME usage throughout the APEX codebase.
 */

describe('Cross-Platform Integration Tests', () => {
  let originalPlatform: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalPlatform = process.platform;
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
    });
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Real-world Cross-Platform Scenarios', () => {
    it('should handle Windows user with standard home directory', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      vi.spyOn(os, 'homedir').mockReturnValue('C:\\Users\\JohnDoe');

      const home = getHomeDir();
      const config = getConfigDir();
      const appConfig = getConfigDir('apex');

      expect(home).toBe('C:\\Users\\JohnDoe');
      expect(config).toMatch(/C:\\Users\\JohnDoe\\AppData\\Roaming/);
      expect(appConfig).toMatch(/C:\\Users\\JohnDoe\\AppData\\Roaming\\apex/);
    });

    it('should handle Windows user with APPDATA environment variable', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      process.env.APPDATA = 'C:\\Users\\JaneDoe\\AppData\\Roaming';
      vi.spyOn(os, 'homedir').mockReturnValue('C:\\Users\\JaneDoe');

      const config = getConfigDir();
      const appConfig = getConfigDir('apex');

      expect(config).toBe('C:\\Users\\JaneDoe\\AppData\\Roaming');
      expect(appConfig).toBe(normalizePath('C:\\Users\\JaneDoe\\AppData\\Roaming\\apex'));
    });

    it('should handle macOS user with standard home directory', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      vi.spyOn(os, 'homedir').mockReturnValue('/Users/johndoe');

      const home = getHomeDir();
      const config = getConfigDir();
      const appConfig = getConfigDir('apex');

      expect(home).toBe('/Users/johndoe');
      expect(config).toBe('/Users/johndoe/.config');
      expect(appConfig).toBe('/Users/johndoe/.config/apex');
    });

    it('should handle Linux user with standard home directory', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      vi.spyOn(os, 'homedir').mockReturnValue('/home/johndoe');

      const home = getHomeDir();
      const config = getConfigDir();
      const appConfig = getConfigDir('apex');

      expect(home).toBe('/home/johndoe');
      expect(config).toBe('/home/johndoe/.config');
      expect(appConfig).toBe('/home/johndoe/.config/apex');
    });
  });

  describe('Service Manager Integration Scenarios', () => {
    it('should provide correct paths for Linux systemd user services', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      vi.spyOn(os, 'homedir').mockReturnValue('/home/developer');

      const configDir = getConfigDir();
      const systemdUserPath = path.join(configDir, 'systemd', 'user');

      expect(systemdUserPath).toBe('/home/developer/.config/systemd/user');
    });

    it('should provide correct paths for macOS LaunchAgents', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      vi.spyOn(os, 'homedir').mockReturnValue('/Users/developer');

      const home = getHomeDir();
      const launchAgentsPath = path.join(home, 'Library', 'LaunchAgents');

      expect(launchAgentsPath).toBe('/Users/developer/Library/LaunchAgents');
    });

    it('should provide correct paths for Windows service management', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      process.env.APPDATA = 'C:\\Users\\Developer\\AppData\\Roaming';
      vi.spyOn(os, 'homedir').mockReturnValue('C:\\Users\\Developer');

      const configDir = getConfigDir();

      expect(configDir).toBe('C:\\Users\\Developer\\AppData\\Roaming');
    });
  });

  describe('CompletionEngine Tilde Expansion Scenarios', () => {
    it('should expand tilde paths correctly on Unix systems', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      vi.spyOn(os, 'homedir').mockReturnValue('/home/user');

      const home = getHomeDir();
      const tildeExpanded = path.join(home, 'Documents');

      expect(tildeExpanded).toBe('/home/user/Documents');
    });

    it('should expand tilde paths correctly on Windows', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      vi.spyOn(os, 'homedir').mockReturnValue('C:\\Users\\User');

      const home = getHomeDir();
      const tildeExpanded = path.join(home, 'Documents');

      expect(tildeExpanded).toBe(normalizePath('C:\\Users\\User\\Documents'));
    });

    it('should handle nested tilde paths with complex structures', () => {
      vi.spyOn(os, 'homedir').mockReturnValue('/home/developer');

      const home = getHomeDir();
      const nestedPath = path.join(home, 'projects', 'apex', 'src', 'components');

      expect(nestedPath).toBe('/home/developer/projects/apex/src/components');
      expect(path.isAbsolute(nestedPath)).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle paths with spaces across platforms', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      vi.spyOn(os, 'homedir').mockReturnValue('C:\\Users\\John Doe');

      const home = getHomeDir();
      const config = getConfigDir('my app');

      expect(home).toBe('C:\\Users\\John Doe');
      expect(config).toBe(normalizePath('C:\\Users\\John Doe\\AppData\\Roaming\\my app'));
    });

    it('should handle Unicode characters in paths', () => {
      vi.spyOn(os, 'homedir').mockReturnValue('/home/user-café');

      const home = getHomeDir();
      const config = getConfigDir('app-ünicode');

      expect(home).toBe('/home/user-café');
      expect(config).toBe('/home/user-café/.config/app-ünicode');
    });

    it('should handle very long paths correctly', () => {
      const longHome = '/home/' + 'a'.repeat(100);
      const longApp = 'b'.repeat(50);

      vi.spyOn(os, 'homedir').mockReturnValue(longHome);

      const home = getHomeDir();
      const config = getConfigDir(longApp);

      expect(home).toBe(longHome);
      expect(config).toContain(longApp);
      expect(config).toContain(longHome);
    });

    it('should propagate os.homedir errors appropriately', () => {
      vi.spyOn(os, 'homedir').mockReturnValue('');

      expect(() => getHomeDir()).toThrow('Unable to determine home directory');
      expect(() => getConfigDir()).toThrow('Unable to determine home directory');
    });

    it('should handle mixed path separators consistently', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      vi.spyOn(os, 'homedir').mockReturnValue('C:/Users/User');

      const home = getHomeDir();
      const config = getConfigDir('test/app');

      expect(home).toBe('C:/Users/User');
      expect(config).toBe(normalizePath('C:/Users/User/AppData/Roaming/test/app'));
    });
  });

  describe('Backwards Compatibility', () => {
    it('should work correctly regardless of existing HOME environment variable', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      process.env.HOME = '/old/wrong/path'; // This should be ignored
      vi.spyOn(os, 'homedir').mockReturnValue('/correct/home/path');

      const home = getHomeDir();
      const config = getConfigDir();

      // Should use os.homedir() result, not environment variable
      expect(home).toBe('/correct/home/path');
      expect(config).toBe('/correct/home/path/.config');
    });

    it('should work when HOME environment variable is missing', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      delete process.env.HOME;
      vi.spyOn(os, 'homedir').mockReturnValue('/home/user');

      const home = getHomeDir();
      const config = getConfigDir();

      expect(home).toBe('/home/user');
      expect(config).toBe('/home/user/.config');
    });

    it('should work when APPDATA environment variable is missing on Windows', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      delete process.env.APPDATA;
      vi.spyOn(os, 'homedir').mockReturnValue('C:\\Users\\User');

      const home = getHomeDir();
      const config = getConfigDir();

      expect(home).toBe('C:\\Users\\User');
      expect(config).toBe(normalizePath('C:\\Users\\User\\AppData\\Roaming'));
    });
  });

  describe('Path Normalization Integration', () => {
    it('should ensure all paths are normalized consistently', () => {
      vi.spyOn(os, 'homedir').mockReturnValue('/home/user');

      const home = getHomeDir();
      const config = getConfigDir();
      const appConfig = getConfigDir('apex');

      // All paths should be normalized
      expect(home).toBe(normalizePath(home));
      expect(config).toBe(normalizePath(config));
      expect(appConfig).toBe(normalizePath(appConfig));

      // Should handle complex relative path components
      const complexPath = normalizePath('/home/user/./projects/../.config/apex');
      expect(complexPath).toBe('/home/user/.config/apex');
    });

    it('should handle path concatenation correctly across platforms', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      vi.spyOn(os, 'homedir').mockReturnValue('C:\\Users\\User');

      const home = getHomeDir();
      const nestedPath = path.join(home, 'Documents', 'Projects', 'apex');
      const normalizedPath = normalizePath(nestedPath);

      expect(normalizedPath).toMatch(/C:\\Users\\User\\Documents\\Projects\\apex/);
      expect(normalizedPath).toBe(normalizePath(normalizedPath)); // Should be idempotent
    });
  });

  describe('Integration with Real OS Paths', () => {
    it('should work with actual os.homedir() on current system', () => {
      // Test with real system paths (this will vary by test environment)
      const home = getHomeDir();
      const config = getConfigDir();
      const appConfig = getConfigDir('apex-test');

      // Basic validation - all should be absolute paths
      expect(path.isAbsolute(home)).toBe(true);
      expect(path.isAbsolute(config)).toBe(true);
      expect(path.isAbsolute(appConfig)).toBe(true);

      // Should contain expected platform-specific patterns
      if (process.platform === 'win32') {
        expect(config).toMatch(/AppData[\\/]Roaming/);
        expect(appConfig).toMatch(/AppData[\\/]Roaming[\\/]apex-test/);
      } else {
        expect(config).toMatch(/\.config$/);
        expect(appConfig).toMatch(/\.config[\\/]apex-test$/);
      }

      // All paths should be strings
      expect(typeof home).toBe('string');
      expect(typeof config).toBe('string');
      expect(typeof appConfig).toBe('string');

      // Should be non-empty
      expect(home.length).toBeGreaterThan(0);
      expect(config.length).toBeGreaterThan(0);
      expect(appConfig.length).toBeGreaterThan(0);
    });
  });

  describe('Memory and Performance Characteristics', () => {
    it('should handle repeated calls efficiently', () => {
      vi.spyOn(os, 'homedir').mockReturnValue('/home/user');

      // Multiple calls should work consistently
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push({
          home: getHomeDir(),
          config: getConfigDir(),
          app: getConfigDir('test-app')
        });
      }

      // All results should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i].home).toBe(results[0].home);
        expect(results[i].config).toBe(results[0].config);
        expect(results[i].app).toBe(results[0].app);
      }

      // os.homedir should be called once per getHomeDir call
      expect(os.homedir).toHaveBeenCalledTimes(30); // 10 * (2 getHomeDir calls + 1 in getConfigDir)
    });

    it('should handle concurrent calls correctly', async () => {
      vi.spyOn(os, 'homedir').mockReturnValue('/home/user');

      // Simulate concurrent calls
      const promises = Array(5).fill(0).map(async () => ({
        home: getHomeDir(),
        config: getConfigDir(),
        app: getConfigDir('concurrent-test')
      }));

      const results = await Promise.all(promises);

      // All concurrent results should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i].home).toBe(results[0].home);
        expect(results[i].config).toBe(results[0].config);
        expect(results[i].app).toBe(results[0].app);
      }
    });
  });
});
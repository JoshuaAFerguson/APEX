import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { MCPInstaller, MCPInstallationOptions } from '../mcp-installer';
import { TaskStore } from '../store';
import { MCPServer } from '@apexcli/core';

// Mock dependencies
vi.mock('fs', () => {
  const mock = {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => ''),
    readdirSync: vi.fn(() => []),
    statSync: vi.fn(),
    unlinkSync: vi.fn(),
    promises: {
      mkdir: vi.fn(),
      writeFile: vi.fn(),
      readFile: vi.fn(),
      unlink: vi.fn(),
      access: vi.fn(),
      stat: vi.fn(),
      readdir: vi.fn(),
      rmdir: vi.fn(),
    },
  };
  return { ...mock, default: mock };
});

vi.mock('child_process', () => {
  const mock = {
    exec: vi.fn(),
    execSync: vi.fn(),
    spawn: vi.fn(),
    execFile: vi.fn(),
    fork: vi.fn(),
  };
  return { ...mock, default: mock };
});

vi.mock('../store');

describe('MCPInstaller - Version Management', () => {
  let installer: MCPInstaller;
  let mockStore: vi.Mocked<TaskStore>;
  let mockExec: MockedFunction<any>;
  let mockFs: {
    mkdir: MockedFunction<any>;
    writeFile: MockedFunction<any>;
    unlink: MockedFunction<any>;
  };

  const projectPath = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock store
    mockStore = {
      createMcpInstallation: vi.fn(),
      getMcpInstallation: vi.fn(),
      listMcpInstallations: vi.fn(),
      removeMcpInstallation: vi.fn(),
      upsertMcpMarketplaceEntry: vi.fn(),
      listMcpMarketplaceEntries: vi.fn(),
    } as any;

    // Mock filesystem
    mockFs = {
      mkdir: vi.mocked(fs.mkdir),
      writeFile: vi.mocked(fs.writeFile),
      unlink: vi.mocked(fs.unlink),
    };

    // Mock exec
    mockExec = vi.mocked(exec);

    installer = new MCPInstaller(projectPath, mockStore);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseVersion', () => {
    it('should parse basic semantic versions', () => {
      expect(installer.parseVersion('1.2.3')).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
      });

      expect(installer.parseVersion('0.0.1')).toEqual({
        major: 0,
        minor: 0,
        patch: 1,
      });

      expect(installer.parseVersion('10.20.30')).toEqual({
        major: 10,
        minor: 20,
        patch: 30,
      });
    });

    it('should parse versions with leading v', () => {
      expect(installer.parseVersion('v1.2.3')).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
      });

      expect(installer.parseVersion('v0.1.0')).toEqual({
        major: 0,
        minor: 1,
        patch: 0,
      });
    });

    it('should parse versions with prerelease tags', () => {
      expect(installer.parseVersion('1.2.3-alpha')).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'alpha',
      });

      expect(installer.parseVersion('2.0.0-beta.1')).toEqual({
        major: 2,
        minor: 0,
        patch: 0,
        prerelease: 'beta.1',
      });

      expect(installer.parseVersion('1.0.0-rc.1')).toEqual({
        major: 1,
        minor: 0,
        patch: 0,
        prerelease: 'rc.1',
      });
    });

    it('should handle build metadata in versions', () => {
      expect(installer.parseVersion('1.2.3+build.123')).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
      });

      expect(installer.parseVersion('1.2.3-alpha+build.456')).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'alpha',
      });
    });

    it('should handle partial versions', () => {
      expect(installer.parseVersion('1')).toEqual({
        major: 1,
        minor: 0,
        patch: 0,
      });

      expect(installer.parseVersion('1.2')).toEqual({
        major: 1,
        minor: 2,
        patch: 0,
      });
    });

    it('should handle latest and wildcard versions', () => {
      expect(installer.parseVersion('latest')).toEqual({
        major: Infinity,
        minor: Infinity,
        patch: Infinity,
      });

      expect(installer.parseVersion('*')).toEqual({
        major: Infinity,
        minor: Infinity,
        patch: Infinity,
      });
    });

    it('should remove range prefixes', () => {
      expect(installer.parseVersion('^1.2.3')).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
      });

      expect(installer.parseVersion('~2.1.0')).toEqual({
        major: 2,
        minor: 1,
        patch: 0,
      });

      expect(installer.parseVersion('>=1.0.0')).toEqual({
        major: 1,
        minor: 0,
        patch: 0,
      });

      expect(installer.parseVersion('<2.0.0')).toEqual({
        major: 2,
        minor: 0,
        patch: 0,
      });
    });

    it('should throw error for invalid version formats', () => {
      expect(() => installer.parseVersion('invalid')).toThrow('Invalid version format: invalid');
      expect(() => installer.parseVersion('1.2.3.4.5')).toThrow('Invalid version format: 1.2.3.4.5');
      expect(() => installer.parseVersion('')).toThrow('Invalid version format: ');
    });
  });

  describe('compareVersions', () => {
    it('should compare major versions correctly', () => {
      expect(installer.compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
      expect(installer.compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
      expect(installer.compareVersions('1.0.0', '1.0.0')).toBe(0);
    });

    it('should compare minor versions correctly when major is equal', () => {
      expect(installer.compareVersions('1.5.0', '1.4.9')).toBeGreaterThan(0);
      expect(installer.compareVersions('1.2.0', '1.3.0')).toBeLessThan(0);
      expect(installer.compareVersions('1.2.0', '1.2.0')).toBe(0);
    });

    it('should compare patch versions correctly when major and minor are equal', () => {
      expect(installer.compareVersions('1.2.5', '1.2.4')).toBeGreaterThan(0);
      expect(installer.compareVersions('1.2.1', '1.2.2')).toBeLessThan(0);
      expect(installer.compareVersions('1.2.3', '1.2.3')).toBe(0);
    });

    it('should handle prerelease versions correctly', () => {
      // Prerelease versions are less than normal versions
      expect(installer.compareVersions('1.0.0-alpha', '1.0.0')).toBeLessThan(0);
      expect(installer.compareVersions('1.0.0', '1.0.0-alpha')).toBeGreaterThan(0);

      // Compare prerelease versions lexicographically
      expect(installer.compareVersions('1.0.0-alpha', '1.0.0-beta')).toBeLessThan(0);
      expect(installer.compareVersions('1.0.0-beta', '1.0.0-alpha')).toBeGreaterThan(0);
      expect(installer.compareVersions('1.0.0-alpha', '1.0.0-alpha')).toBe(0);
    });

    it('should handle version prefixes', () => {
      expect(installer.compareVersions('v1.2.3', '1.2.2')).toBeGreaterThan(0);
      expect(installer.compareVersions('^1.2.3', '~1.2.2')).toBeGreaterThan(0);
    });

    it('should handle latest versions', () => {
      expect(installer.compareVersions('latest', '1.0.0')).toBeGreaterThan(0);
      expect(installer.compareVersions('1.0.0', 'latest')).toBeLessThan(0);
      expect(installer.compareVersions('latest', 'latest')).toBe(0);
    });
  });

  describe('satisfiesRange', () => {
    it('should handle exact version matches', () => {
      expect(installer.satisfiesRange('1.2.3', '1.2.3')).toBe(true);
      expect(installer.satisfiesRange('1.2.3', '1.2.4')).toBe(false);
    });

    it('should handle caret ranges (^)', () => {
      expect(installer.satisfiesRange('1.2.3', '^1.0.0')).toBe(true);
      expect(installer.satisfiesRange('1.9.9', '^1.0.0')).toBe(true);
      expect(installer.satisfiesRange('2.0.0', '^1.0.0')).toBe(false);
      expect(installer.satisfiesRange('0.9.9', '^1.0.0')).toBe(false);
    });

    it('should handle tilde ranges (~)', () => {
      expect(installer.satisfiesRange('1.2.5', '~1.2.0')).toBe(true);
      expect(installer.satisfiesRange('1.2.0', '~1.2.0')).toBe(true);
      expect(installer.satisfiesRange('1.3.0', '~1.2.0')).toBe(false);
      expect(installer.satisfiesRange('1.1.9', '~1.2.0')).toBe(false);
    });

    it('should handle greater than ranges (>)', () => {
      expect(installer.satisfiesRange('1.2.4', '>1.2.3')).toBe(true);
      expect(installer.satisfiesRange('1.2.3', '>1.2.3')).toBe(false);
      expect(installer.satisfiesRange('1.2.2', '>1.2.3')).toBe(false);
    });

    it('should handle greater than or equal ranges (>=)', () => {
      expect(installer.satisfiesRange('1.2.4', '>=1.2.3')).toBe(true);
      expect(installer.satisfiesRange('1.2.3', '>=1.2.3')).toBe(true);
      expect(installer.satisfiesRange('1.2.2', '>=1.2.3')).toBe(false);
    });

    it('should handle less than ranges (<)', () => {
      expect(installer.satisfiesRange('1.2.2', '<1.2.3')).toBe(true);
      expect(installer.satisfiesRange('1.2.3', '<1.2.3')).toBe(false);
      expect(installer.satisfiesRange('1.2.4', '<1.2.3')).toBe(false);
    });

    it('should handle less than or equal ranges (<=)', () => {
      expect(installer.satisfiesRange('1.2.2', '<=1.2.3')).toBe(true);
      expect(installer.satisfiesRange('1.2.3', '<=1.2.3')).toBe(true);
      expect(installer.satisfiesRange('1.2.4', '<=1.2.3')).toBe(false);
    });

    it('should handle latest and wildcard ranges', () => {
      expect(installer.satisfiesRange('1.2.3', 'latest')).toBe(true);
      expect(installer.satisfiesRange('0.0.1', '*')).toBe(true);
      expect(installer.satisfiesRange('999.999.999', 'latest')).toBe(true);
    });
  });

  describe('resolveLatestVersion', () => {
    it('should resolve latest version for a package', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) callback(null, { stdout: '"1.2.3"', stderr: '' });
        return {} as any;
      });

      const result = await installer.resolveLatestVersion('test-package');

      expect(result).toBe('1.2.3');
      expect(mockExec).toHaveBeenCalledWith(
        'npm view test-package version --json',
        { cwd: projectPath },
        expect.any(Function)
      );
    });

    it('should handle array of versions', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) callback(null, { stdout: '["1.2.1", "1.2.2", "1.2.3"]', stderr: '' });
        return {} as any;
      });

      const result = await installer.resolveLatestVersion('test-package');

      expect(result).toBe('1.2.3');
    });

    it('should handle errors when resolving version', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) callback(new Error('Package not found'), null);
        return {} as any;
      });

      await expect(installer.resolveLatestVersion('non-existent-package'))
        .rejects.toThrow('Failed to resolve latest version for non-existent-package: Package not found');
    });

    it('should handle invalid JSON response', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) callback(null, { stdout: 'invalid-json', stderr: '' });
        return {} as any;
      });

      await expect(installer.resolveLatestVersion('test-package'))
        .rejects.toThrow('Failed to resolve latest version for test-package:');
    });
  });

  describe('getAvailableVersions', () => {
    it('should get available versions for a package', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) callback(null, { stdout: '["1.0.0", "1.1.0", "1.2.0", "2.0.0"]', stderr: '' });
        return {} as any;
      });

      const result = await installer.getAvailableVersions('test-package');

      expect(result).toEqual(['1.0.0', '1.1.0', '1.2.0', '2.0.0']);
      expect(mockExec).toHaveBeenCalledWith(
        'npm view test-package versions --json',
        { cwd: projectPath },
        expect.any(Function)
      );
    });

    it('should handle single version response', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) callback(null, { stdout: '"1.0.0"', stderr: '' });
        return {} as any;
      });

      const result = await installer.getAvailableVersions('test-package');

      expect(result).toEqual(['1.0.0']);
    });

    it('should handle errors when getting versions', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) callback(new Error('Package not found'), null);
        return {} as any;
      });

      await expect(installer.getAvailableVersions('non-existent-package'))
        .rejects.toThrow('Failed to get available versions for non-existent-package: Package not found');
    });

    it('should handle empty versions array', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) callback(null, { stdout: '[]', stderr: '' });
        return {} as any;
      });

      const result = await installer.getAvailableVersions('test-package');

      expect(result).toEqual([]);
    });
  });

  describe('Version-aware installation', () => {
    const mockServer: MCPServer = {
      name: 'test-server',
      package: '@test/mcp-server',
      command: 'npx',
      args: ['@test/mcp-server'],
      version: '1.2.3',
    };

    beforeEach(() => {
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) callback(null, { stdout: 'Success', stderr: '' });
        return {} as any;
      });

      mockStore.getMcpInstallation.mockResolvedValue(null);
      mockStore.createMcpInstallation.mockResolvedValue(undefined);

      // Mock filesystem operations
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should install pinned version from server definition', async () => {
      await installer.install(mockServer);

      expect(mockExec).toHaveBeenCalledWith(
        'npm install @test/mcp-server@1.2.3',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should install specific version from options', async () => {
      const options: MCPInstallationOptions = { version: '2.0.0' };

      await installer.install(mockServer, options);

      expect(mockExec).toHaveBeenCalledWith(
        'npm install @test/mcp-server@2.0.0',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should prefer options version over server version', async () => {
      const serverWithVersion = { ...mockServer, version: '1.0.0' };
      const options: MCPInstallationOptions = { version: '2.0.0' };

      await installer.install(serverWithVersion, options);

      expect(mockExec).toHaveBeenCalledWith(
        'npm install @test/mcp-server@2.0.0',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should install latest version when specified', async () => {
      const serverWithLatest = { ...mockServer, version: 'latest' };

      await installer.install(serverWithLatest);

      expect(mockExec).toHaveBeenCalledWith(
        'npm install @test/mcp-server',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should install without version when not specified', async () => {
      const serverWithoutVersion: MCPServer = {
        name: 'test-server',
        package: '@test/mcp-server',
        command: 'npx',
        args: ['@test/mcp-server'],
        version: '', // Empty version should be treated as no version
      };

      await installer.install(serverWithoutVersion);

      expect(mockExec).toHaveBeenCalledWith(
        'npm install @test/mcp-server',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle version ranges in installation', async () => {
      const options: MCPInstallationOptions = { version: '^1.0.0' };

      await installer.install(mockServer, options);

      expect(mockExec).toHaveBeenCalledWith(
        'npm install @test/mcp-server@^1.0.0',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle prerelease versions', async () => {
      const options: MCPInstallationOptions = { version: '2.0.0-beta.1' };

      await installer.install(mockServer, options);

      expect(mockExec).toHaveBeenCalledWith(
        'npm install @test/mcp-server@2.0.0-beta.1',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should extract package name from package field', async () => {
      const serverWithPackage: MCPServer = {
        name: 'different-name',
        package: '@scope/actual-package',
        command: 'npx',
        args: ['some-other-arg'],
        version: '1.0.0',
      };

      await installer.install(serverWithPackage);

      expect(mockExec).toHaveBeenCalledWith(
        'npm install @scope/actual-package@1.0.0',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle package name extraction from npx commands', async () => {
      const serverWithNpx: MCPServer = {
        name: 'test-server',
        package: '',
        command: 'npx',
        args: ['@test/some-package'],
        version: '1.0.0',
      };

      await installer.install(serverWithNpx);

      expect(mockExec).toHaveBeenCalledWith(
        'npm install @test/some-package@1.0.0',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle package name extraction from scoped command', async () => {
      const serverWithScopedCommand: MCPServer = {
        name: 'test-server',
        package: '',
        command: '@scope/scoped-command',
        args: [],
        version: '1.0.0',
      };

      await installer.install(serverWithScopedCommand);

      expect(mockExec).toHaveBeenCalledWith(
        'npm install @scope/scoped-command@1.0.0',
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle version parsing errors gracefully', () => {
      expect(() => installer.parseVersion('1.2.3.4.5.6')).toThrow('Invalid version format');
      expect(() => installer.parseVersion('not-a-version')).toThrow('Invalid version format');
      expect(() => installer.parseVersion('1.a.3')).toThrow('Invalid version format');
      expect(() => installer.parseVersion('1.2.3-')).toThrow('Invalid version format');
      expect(() => installer.parseVersion('1.2.3-+build')).toThrow('Invalid version format');
    });

    it('should handle npm command timeouts during version resolution', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Command timeout');
        (error as any).code = 'ETIMEDOUT';
        if (callback) callback(error, null);
        return {} as any;
      });

      await expect(installer.resolveLatestVersion('timeout-package'))
        .rejects.toThrow('Failed to resolve latest version for timeout-package: Command timeout');
    });

    it('should handle network errors during version resolution', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) callback(new Error('Network error: ENOTFOUND'), null);
        return {} as any;
      });

      await expect(installer.getAvailableVersions('network-error-package'))
        .rejects.toThrow('Failed to get available versions for network-error-package: Network error: ENOTFOUND');
    });

    it('should handle malformed JSON in version responses', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) callback(null, { stdout: '{"malformed": json}', stderr: '' });
        return {} as any;
      });

      await expect(installer.resolveLatestVersion('malformed-json-package'))
        .rejects.toThrow('Failed to resolve latest version for malformed-json-package:');
    });

    it('should handle empty package names', () => {
      const serverWithEmptyPackage: MCPServer = {
        name: 'test-server',
        package: '',
        command: 'npx',
        args: [],
        version: '1.0.0',
      };

      // Should fall back to extracting from command and args
      expect(installer['extractPackageName'](serverWithEmptyPackage)).toBe('test-server');
    });

    it('should handle very complex version comparisons', () => {
      // Test complex prerelease version ordering
      expect(installer.compareVersions('1.0.0-alpha.1', '1.0.0-alpha.10')).toBeLessThan(0);
      expect(installer.compareVersions('1.0.0-alpha.beta', '1.0.0-alpha.1')).toBeGreaterThan(0);
      expect(installer.compareVersions('1.0.0-rc.1+build.1', '1.0.0-rc.1+build.2')).toBe(0);

      // Test edge cases with zero versions
      expect(installer.compareVersions('0.0.0', '0.0.1')).toBeLessThan(0);
      expect(installer.compareVersions('0.1.0', '0.0.9')).toBeGreaterThan(0);

      // Test large version numbers
      expect(installer.compareVersions('999.999.999', '1000.0.0')).toBeLessThan(0);
    });

    it('should handle satisfiesRange with complex ranges', () => {
      expect(installer.satisfiesRange('1.2.3-alpha', '^1.0.0')).toBe(true);
      expect(installer.satisfiesRange('2.0.0-alpha', '^1.0.0')).toBe(false);
      // 1.5.0-beta is less than 1.5.0 per semver, so it doesn't satisfy ~1.5.0
      expect(installer.satisfiesRange('1.5.0-beta', '~1.5.0')).toBe(false);
    });
  });
});
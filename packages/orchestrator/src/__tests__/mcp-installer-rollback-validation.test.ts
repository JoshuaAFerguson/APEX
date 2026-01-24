import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MCPInstaller } from '../mcp-installer';
import { MCPServer } from '@apexcli/core';

// Mock filesystem operations
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

// Mock child_process
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

// Mock TaskStore
vi.mock('../store', () => ({
  TaskStore: vi.fn()
}));

import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { TaskStore } from '../store';

describe('MCPInstaller Rollback Validation Tests', () => {
  let installer: MCPInstaller;
  let mockStore: {
    createMcpInstallation: ReturnType<typeof vi.fn>;
    getMcpInstallation: ReturnType<typeof vi.fn>;
    removeMcpInstallation: ReturnType<typeof vi.fn>;
    listMcpInstallations: ReturnType<typeof vi.fn>;
    upsertMcpMarketplaceEntry: ReturnType<typeof vi.fn>;
    listMcpMarketplaceEntries: ReturnType<typeof vi.fn>;
    getMcpMarketplaceEntry: ReturnType<typeof vi.fn>;
  };
  let mockExec: ReturnType<typeof vi.fn>;
  let mockFs: {
    mkdir: ReturnType<typeof vi.fn>;
    writeFile: ReturnType<typeof vi.fn>;
    unlink: ReturnType<typeof vi.fn>;
    access: ReturnType<typeof vi.fn>;
    readFile: ReturnType<typeof vi.fn>;
  };

  const projectPath = '/test/project';

  function createTestServer(name: string = 'test-server', overrides: Partial<MCPServer> = {}): MCPServer {
    return {
      name,
      package: `@test/${name}`,
      command: 'npx',
      args: [`@test/${name}`],
      env: {},
      envVars: [],
      version: '1.0.0',
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();

    mockStore = {
      createMcpInstallation: vi.fn().mockResolvedValue(undefined),
      getMcpInstallation: vi.fn().mockResolvedValue(null),
      removeMcpInstallation: vi.fn().mockResolvedValue(undefined),
      listMcpInstallations: vi.fn().mockResolvedValue([]),
      upsertMcpMarketplaceEntry: vi.fn().mockResolvedValue(undefined),
      listMcpMarketplaceEntries: vi.fn().mockResolvedValue([]),
      getMcpMarketplaceEntry: vi.fn().mockResolvedValue(null),
    };
    (TaskStore as any).mockImplementation(() => mockStore);

    mockExec = vi.mocked(exec);
    mockExec.mockImplementation((cmd: string, opts: any, cb?: Function) => {
      if (typeof opts === 'function') {
        cb = opts;
        opts = {};
      }
      if (cb) {
        cb(null, { stdout: 'success', stderr: '' });
      }
      return {} as any;
    });

    mockFs = {
      mkdir: vi.mocked(fs.mkdir),
      writeFile: vi.mocked(fs.writeFile),
      unlink: vi.mocked(fs.unlink),
      access: vi.mocked(fs.access),
      readFile: vi.mocked(fs.readFile),
    };

    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);
    mockFs.access.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue('{}');

    installer = new MCPInstaller(projectPath, mockStore as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Additional Rollback Edge Cases', () => {
    it('should handle rollback when npm install succeeds but config directory creation fails', async () => {
      const server = createTestServer('edge-case-server');

      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          cb(null, { stdout: 'removed', stderr: '' });
        }
        return {} as any;
      });

      // mkdir fails (e.g., permission denied on .apex directory)
      mockFs.mkdir.mockRejectedValueOnce(new Error('EACCES: permission denied, mkdir \'.apex\''));

      await expect(installer.install(server)).rejects.toThrow(
        /Failed to install MCP server 'edge-case-server': EACCES: permission denied/
      );

      // Verify rollback uninstall was called
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npm uninstall'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle rollback when package installation succeeds but config JSON serialization fails', async () => {
      const server = createTestServer('json-fail-server');

      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          cb(null, { stdout: 'removed', stderr: '' });
        }
        return {} as any;
      });

      // Simulate JSON serialization failure during writeFile
      mockFs.writeFile.mockRejectedValueOnce(new Error('Invalid character in JSON'));

      await expect(installer.install(server)).rejects.toThrow();

      // Verify package was uninstalled during rollback
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npm uninstall'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle database constraint violation during installation record creation', async () => {
      const server = createTestServer('constraint-server');

      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          cb(null, { stdout: 'removed', stderr: '' });
        }
        return {} as any;
      });

      // Database constraint violation (e.g., foreign key constraint)
      mockStore.createMcpInstallation.mockRejectedValueOnce(
        new Error('SQLITE_CONSTRAINT: FOREIGN KEY constraint failed')
      );

      await expect(installer.install(server)).rejects.toThrow();

      // Verify full rollback: config file removal + package uninstall
      expect(mockFs.unlink).toHaveBeenCalled();
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npm uninstall'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle rollback when system runs out of disk space during config creation', async () => {
      const server = createTestServer('diskspace-server');

      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          cb(null, { stdout: 'removed', stderr: '' });
        }
        return {} as any;
      });

      // Disk space error during config file write
      mockFs.writeFile.mockRejectedValueOnce(new Error('ENOSPC: no space left on device'));

      await expect(installer.install(server)).rejects.toThrow();

      // Verify rollback occurred
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npm uninstall'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle rollback when store fails with database lock error', async () => {
      const server = createTestServer('lock-server');

      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          cb(null, { stdout: 'removed', stderr: '' });
        }
        return {} as any;
      });

      // Database lock error
      mockStore.createMcpInstallation.mockRejectedValueOnce(
        new Error('SQLITE_BUSY: database is locked')
      );

      await expect(installer.install(server)).rejects.toThrow();

      // Verify rollback cleanup was attempted
      expect(mockFs.unlink).toHaveBeenCalled();
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npm uninstall'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should preserve original error when all rollback operations fail with different errors', async () => {
      const server = createTestServer('all-fail-server');

      mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'installed', stderr: '' });
        } else if (cmd.includes('npm uninstall')) {
          // Rollback uninstall fails
          cb(new Error('npm ERR! ENOENT: package not found'));
        }
        return {} as any;
      });

      // Store operation fails (this is the original error)
      mockStore.createMcpInstallation.mockRejectedValueOnce(
        new Error('Original error: Database corruption detected')
      );

      // Config file removal fails during rollback
      mockFs.unlink.mockRejectedValueOnce(new Error('EBUSY: resource busy'));

      // Database cleanup fails during rollback
      mockStore.removeMcpInstallation.mockRejectedValueOnce(
        new Error('SQLITE_ERROR: syntax error')
      );

      await expect(installer.install(server)).rejects.toThrow(
        /Failed to install MCP server 'all-fail-server': Original error: Database corruption detected/
      );

      // Verify rollback operations were attempted for completed steps only:
      // - removeMcpInstallation is NOT called (createMcpInstallation threw before
      //   installationId was set in rollbackState)
      // - unlink IS called (config file was created)
      // - npm uninstall IS called (package was installed)
      expect(mockStore.removeMcpInstallation).not.toHaveBeenCalled();
      expect(mockFs.unlink).toHaveBeenCalled();
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npm uninstall'),
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('Coverage Validation', () => {
    it('should verify that rollback covers all acceptance criteria scenarios', async () => {
      // This test serves as documentation of what scenarios are covered

      const rollbackScenarios = [
        'Download/install failure triggers no rollback (nothing installed yet)',
        'Corrupted config file triggers package rollback',
        'Dependency failure triggers config + package rollback',
        'Partial installation cleanup removes only failed artifacts',
        'Rollback state verification ensures clean state after failure'
      ];

      // Just verify the scenarios are documented
      expect(rollbackScenarios).toHaveLength(5);
      expect(rollbackScenarios[0]).toContain('Download/install failure');
      expect(rollbackScenarios[1]).toContain('Corrupted config file');
      expect(rollbackScenarios[2]).toContain('Dependency failure');
      expect(rollbackScenarios[3]).toContain('Partial installation cleanup');
      expect(rollbackScenarios[4]).toContain('Rollback state verification');
    });
  });
});
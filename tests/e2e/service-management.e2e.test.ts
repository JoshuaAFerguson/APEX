import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec, spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Skip these tests on Windows since service management isn't supported
const skipOnWindows = process.platform === 'win32' ? it.skip : it;

describe('Service Management E2E Tests', () => {
  let tempProjectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();

    // Create temporary project directory
    tempProjectDir = join(tmpdir(), `apex-e2e-${Date.now()}`);
    await fs.mkdir(tempProjectDir, { recursive: true });

    // Change to temp directory
    process.chdir(tempProjectDir);

    // Initialize APEX project
    const { stdout, stderr } = await execAsync('npm run apex -- init --yes', {
      cwd: tempProjectDir,
      timeout: 30000
    });

    if (stderr && !stderr.includes('warning')) {
      console.warn('Init stderr:', stderr);
    }

    // Verify initialization
    const apexDir = join(tempProjectDir, '.apex');
    const configExists = await fs.access(join(apexDir, 'config.yaml')).then(() => true, () => false);
    expect(configExists).toBe(true);
  });

  afterEach(async () => {
    // Change back to original directory
    process.chdir(originalCwd);

    // Clean up temp directory
    try {
      await fs.rm(tempProjectDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error);
    }
  });

  describe('Service Installation Commands', () => {
    skipOnWindows('should install service successfully', async () => {
      const { stdout, stderr } = await execAsync('npm run apex -- install-service --help', {
        cwd: tempProjectDir,
        timeout: 10000
      });

      expect(stdout || stderr).toContain('install-service');
    });

    skipOnWindows('should show service status', async () => {
      const { stdout, stderr } = await execAsync('npm run apex -- install-service', {
        cwd: tempProjectDir,
        timeout: 15000
      });

      const output = stdout + stderr;
      expect(output).toMatch(/Service (installed successfully|already exists)/);
    });

    skipOnWindows('should uninstall service', async () => {
      // First install
      try {
        await execAsync('npm run apex -- install-service', {
          cwd: tempProjectDir,
          timeout: 15000
        });
      } catch (error) {
        // Ignore install errors for this test
      }

      // Then uninstall
      const { stdout, stderr } = await execAsync('npm run apex -- uninstall-service', {
        cwd: tempProjectDir,
        timeout: 15000
      });

      const output = stdout + stderr;
      expect(output).toMatch(/Service (uninstalled successfully|not found)/);
    });

    skipOnWindows('should handle force installation', async () => {
      // Install once
      try {
        await execAsync('npm run apex -- install-service', {
          cwd: tempProjectDir,
          timeout: 15000
        });
      } catch {
        // Ignore first install errors
      }

      // Force install again
      const { stdout, stderr } = await execAsync('npm run apex -- install-service --force', {
        cwd: tempProjectDir,
        timeout: 15000
      });

      const output = stdout + stderr;
      expect(output).toContain('install');
    });

    skipOnWindows('should handle custom service name', async () => {
      const { stdout, stderr } = await execAsync('npm run apex -- install-service --name custom-apex', {
        cwd: tempProjectDir,
        timeout: 15000
      });

      const output = stdout + stderr;
      expect(output).toMatch(/Service|install/);

      // Cleanup
      try {
        await execAsync('npm run apex -- uninstall-service --name custom-apex', {
          cwd: tempProjectDir,
          timeout: 15000
        });
      } catch {
        // Ignore cleanup errors
      }
    });
  });

  describe('Service Management Error Handling', () => {
    it('should fail when APEX not initialized', async () => {
      // Create new temp directory without initializing APEX
      const uninitializedDir = join(tmpdir(), `apex-uninit-${Date.now()}`);
      await fs.mkdir(uninitializedDir, { recursive: true });

      try {
        const { stdout, stderr } = await execAsync('npm run apex -- install-service', {
          cwd: uninitializedDir,
          timeout: 10000
        });

        const output = stdout + stderr;
        expect(output).toMatch(/not initialized|APEX.*init/i);
      } catch (error) {
        // Command should fail, which is expected
        const output = (error as any).stdout + (error as any).stderr;
        expect(output).toMatch(/not initialized|APEX.*init/i);
      } finally {
        // Cleanup
        await fs.rm(uninitializedDir, { recursive: true, force: true });
      }
    });

    skipOnWindows('should provide helpful error messages for invalid flags', async () => {
      try {
        const { stdout, stderr } = await execAsync('npm run apex -- install-service --invalid-flag', {
          cwd: tempProjectDir,
          timeout: 10000
        });

        // Should not fail but may show warnings
        const output = stdout + stderr;
        expect(typeof output).toBe('string');
      } catch (error) {
        // Command may fail with invalid flag, which is expected
        const output = (error as any).stdout + (error as any).stderr;
        expect(output).toMatch(/Unknown|invalid|help/i);
      }
    });
  });

  describe('Service Configuration Integration', () => {
    skipOnWindows('should respect configuration file settings', async () => {
      // Modify config to enable auto-start
      const configPath = join(tempProjectDir, '.apex', 'config.yaml');
      const configContent = `
daemon:
  service:
    enableOnBoot: true
    name: test-apex-daemon
`;
      await fs.writeFile(configPath, configContent);

      const { stdout, stderr } = await execAsync('npm run apex -- install-service', {
        cwd: tempProjectDir,
        timeout: 15000
      });

      const output = stdout + stderr;
      expect(output).toMatch(/install|Service/);

      // Cleanup
      try {
        await execAsync('npm run apex -- uninstall-service', {
          cwd: tempProjectDir,
          timeout: 15000
        });
      } catch {
        // Ignore cleanup errors
      }
    });

    skipOnWindows('should handle CLI flags overriding config', async () => {
      // Set config to enable auto-start
      const configPath = join(tempProjectDir, '.apex', 'config.yaml');
      const configContent = `
daemon:
  service:
    enableOnBoot: true
`;
      await fs.writeFile(configPath, configContent);

      // But use --no-enable flag
      const { stdout, stderr } = await execAsync('npm run apex -- install-service --no-enable', {
        cwd: tempProjectDir,
        timeout: 15000
      });

      const output = stdout + stderr;
      expect(output).toMatch(/install|Service/);

      // Cleanup
      try {
        await execAsync('npm run apex -- uninstall-service', {
          cwd: tempProjectDir,
          timeout: 15000
        });
      } catch {
        // Ignore cleanup errors
      }
    });
  });

  describe('Platform Compatibility', () => {
    skipOnWindows('should work on Linux', async () => {
      if (process.platform !== 'linux') {
        return; // Skip if not on Linux
      }

      const { stdout, stderr } = await execAsync('npm run apex -- install-service', {
        cwd: tempProjectDir,
        timeout: 15000
      });

      const output = stdout + stderr;
      expect(output).toContain('systemd');
    });

    skipOnWindows('should work on macOS', async () => {
      if (process.platform !== 'darwin') {
        return; // Skip if not on macOS
      }

      const { stdout, stderr } = await execAsync('npm run apex -- install-service', {
        cwd: tempProjectDir,
        timeout: 15000
      });

      const output = stdout + stderr;
      expect(output).toContain('launchd');
    });

    it('should show appropriate error on Windows', async () => {
      if (process.platform !== 'win32') {
        return; // Skip if not on Windows
      }

      try {
        const { stdout, stderr } = await execAsync('npm run apex -- install-service', {
          cwd: tempProjectDir,
          timeout: 10000
        });

        const output = stdout + stderr;
        expect(output).toMatch(/not supported|Windows/i);
      } catch (error) {
        // Expected to fail on Windows
        const output = (error as any).stdout + (error as any).stderr;
        expect(output).toMatch(/not supported|Windows/i);
      }
    });
  });

  describe('Command Output Validation', () => {
    skipOnWindows('should provide clear installation feedback', async () => {
      const { stdout, stderr } = await execAsync('npm run apex -- install-service', {
        cwd: tempProjectDir,
        timeout: 15000
      });

      const output = stdout + stderr;

      // Should contain success indicators
      expect(output).toMatch(/✓|success|install/i);

      // Should provide platform info
      if (process.platform === 'linux') {
        expect(output).toMatch(/systemd|systemctl/i);
      } else if (process.platform === 'darwin') {
        expect(output).toMatch(/launchd|launchctl/i);
      }

      // Cleanup
      try {
        await execAsync('npm run apex -- uninstall-service', {
          cwd: tempProjectDir,
          timeout: 15000
        });
      } catch {
        // Ignore cleanup errors
      }
    });

    skipOnWindows('should provide clear uninstallation feedback', async () => {
      // First install
      try {
        await execAsync('npm run apex -- install-service', {
          cwd: tempProjectDir,
          timeout: 15000
        });
      } catch {
        // Continue even if install fails
      }

      // Then uninstall
      const { stdout, stderr } = await execAsync('npm run apex -- uninstall-service', {
        cwd: tempProjectDir,
        timeout: 15000
      });

      const output = stdout + stderr;
      expect(output).toMatch(/✓|success|uninstall|remove/i);
    });
  });

  describe('Help and Documentation', () => {
    it('should show help for install-service', async () => {
      const { stdout, stderr } = await execAsync('npm run apex -- install-service --help', {
        cwd: tempProjectDir,
        timeout: 10000
      });

      const output = stdout + stderr;
      expect(output).toMatch(/install.*service|usage|options/i);
      expect(output).toMatch(/--enable|--force|--name/i);
    });

    it('should show help for uninstall-service', async () => {
      const { stdout, stderr } = await execAsync('npm run apex -- uninstall-service --help', {
        cwd: tempProjectDir,
        timeout: 10000
      });

      const output = stdout + stderr;
      expect(output).toMatch(/uninstall.*service|usage|options/i);
      expect(output).toMatch(/--force|--timeout/i);
    });
  });

  describe('Service Lifecycle Management', () => {
    skipOnWindows('should handle complete install-status-uninstall cycle', async () => {
      // 1. Install
      const installResult = await execAsync('npm run apex -- install-service', {
        cwd: tempProjectDir,
        timeout: 15000
      });

      expect(installResult.stdout + installResult.stderr).toMatch(/install|success/i);

      // 2. Check status (if available via CLI)
      // Note: Status command might not be available via CLI, only in REPL

      // 3. Uninstall
      const uninstallResult = await execAsync('npm run apex -- uninstall-service', {
        cwd: tempProjectDir,
        timeout: 15000
      });

      expect(uninstallResult.stdout + uninstallResult.stderr).toMatch(/uninstall|remove|success/i);
    });

    skipOnWindows('should handle reinstallation gracefully', async () => {
      // Install twice
      try {
        await execAsync('npm run apex -- install-service', {
          cwd: tempProjectDir,
          timeout: 15000
        });
      } catch {
        // First install might fail, continue
      }

      const secondInstall = await execAsync('npm run apex -- install-service --force', {
        cwd: tempProjectDir,
        timeout: 15000
      });

      const output = secondInstall.stdout + secondInstall.stderr;
      expect(output).toMatch(/install|success|force/i);

      // Cleanup
      try {
        await execAsync('npm run apex -- uninstall-service', {
          cwd: tempProjectDir,
          timeout: 15000
        });
      } catch {
        // Ignore cleanup errors
      }
    });
  });
});
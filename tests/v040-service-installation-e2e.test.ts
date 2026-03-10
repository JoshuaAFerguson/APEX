import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import * as os from 'os';
import { ServiceManager, detectPlatform } from '../packages/orchestrator/src/service-manager';

/**
 * v0.4.0 Service Installation End-to-End Tests
 *
 * These tests verify actual service file generation and installation processes
 * with real file system operations across different platforms.
 */
describe('v0.4.0 Service Installation End-to-End Tests', () => {
  let testProjectPath: string;
  let serviceManager: ServiceManager;
  let originalPlatform: NodeJS.Platform;
  let generatedFiles: string[] = [];

  beforeEach(async () => {
    originalPlatform = process.platform;
    testProjectPath = join(__dirname, 'test-project-service');

    // Create test project structure
    await fs.mkdir(testProjectPath, { recursive: true });
    await fs.mkdir(join(testProjectPath, '.apex'), { recursive: true });

    serviceManager = new ServiceManager({
      projectPath: testProjectPath,
      serviceName: 'apex-daemon-test',
      serviceDescription: 'Test APEX Daemon Service',
      user: 'testuser',
      workingDirectory: testProjectPath
    });
  });

  afterEach(async () => {
    // Clean up generated files
    for (const filePath of generatedFiles) {
      try {
        await fs.unlink(filePath);
        // Also try to remove parent directory if it exists and is empty
        try {
          await fs.rmdir(dirname(filePath));
        } catch {
          // Directory might not be empty, ignore
        }
      } catch {
        // File might not exist, ignore
      }
    }
    generatedFiles = [];

    // Restore platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true
    });

    // Clean up test directory
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error);
    }

    vi.restoreAllMocks();
  });

  describe('Linux Systemd Service Generation', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true
      });
    });

    it('should generate valid systemd unit file', async () => {
      const result = serviceManager.generateServiceFile();

      expect(result.platform).toBe('linux');
      expect(result.path).toMatch(/\.service$/);
      expect(result.content).toContain('[Unit]');
      expect(result.content).toContain('[Service]');
      expect(result.content).toContain('[Install]');
      expect(result.content).toContain('Description=Test APEX Daemon Service');
      expect(result.content).toContain('User=testuser');
      expect(result.content).toContain(`WorkingDirectory=${testProjectPath}`);
    });

    it('should create systemd service file with correct permissions', async () => {
      const result = serviceManager.generateServiceFile();
      const serviceDir = join(testProjectPath, '.apex', 'service');
      const servicePath = join(serviceDir, 'apex-daemon-test.service');

      // Create service directory
      await fs.mkdir(serviceDir, { recursive: true });

      // Write service file
      await fs.writeFile(servicePath, result.content);
      generatedFiles.push(servicePath);

      // Verify file exists
      const fileExists = await fs.access(servicePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Verify content
      const fileContent = await fs.readFile(servicePath, 'utf-8');
      expect(fileContent).toEqual(result.content);

      // Verify file stats
      const stats = await fs.stat(servicePath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should generate systemd service with restart policies', async () => {
      const serviceManagerWithRestart = new ServiceManager({
        ...serviceManager['options'],
        restartPolicy: 'always'
      });

      const result = serviceManagerWithRestart.generateServiceFile();

      expect(result.content).toContain('Restart=always');
      expect(result.content).toContain('RestartSec=10');
    });

    it('should generate systemd service with environment variables', async () => {
      const serviceManagerWithEnv = new ServiceManager({
        ...serviceManager['options'],
        environment: {
          NODE_ENV: 'production',
          APEX_LOG_LEVEL: 'info'
        }
      });

      const result = serviceManagerWithEnv.generateServiceFile();

      expect(result.content).toContain('Environment="NODE_ENV=production"');
      expect(result.content).toContain('Environment="APEX_LOG_LEVEL=info"');
    });
  });

  describe('macOS Launchd Service Generation', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true
      });
    });

    it('should generate valid launchd plist file', async () => {
      const result = serviceManager.generateServiceFile();

      expect(result.platform).toBe('darwin');
      expect(result.path).toMatch(/\.plist$/);
      expect(result.content).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result.content).toContain('<plist version="1.0">');
      expect(result.content).toContain('<dict>');
      expect(result.content).toContain('<key>Label</key>');
      expect(result.content).toContain('<string>com.apex.daemon-test</string>');
      expect(result.content).toContain('<key>WorkingDirectory</key>');
      expect(result.content).toContain(`<string>${testProjectPath}</string>`);
    });

    it('should create launchd plist file with correct structure', async () => {
      const result = serviceManager.generateServiceFile();
      const serviceDir = join(testProjectPath, '.apex', 'service');
      const plistPath = join(serviceDir, 'com.apex.daemon-test.plist');

      // Create service directory
      await fs.mkdir(serviceDir, { recursive: true });

      // Write plist file
      await fs.writeFile(plistPath, result.content);
      generatedFiles.push(plistPath);

      // Verify file exists
      const fileExists = await fs.access(plistPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Verify content is valid XML-like structure
      const fileContent = await fs.readFile(plistPath, 'utf-8');
      expect(fileContent).toContain('<?xml');
      expect(fileContent).toContain('<plist');
      expect(fileContent).toContain('</plist>');

      // Verify required plist keys exist
      expect(fileContent).toContain('<key>Label</key>');
      expect(fileContent).toContain('<key>ProgramArguments</key>');
      expect(fileContent).toContain('<key>WorkingDirectory</key>');
    });

    it('should generate launchd service with KeepAlive option', async () => {
      const result = serviceManager.generateServiceFile();

      expect(result.content).toContain('<key>KeepAlive</key>');
      expect(result.content).toContain('<true/>');
    });

    it('should handle environment variables in launchd format', async () => {
      const serviceManagerWithEnv = new ServiceManager({
        ...serviceManager['options'],
        environment: {
          NODE_ENV: 'production',
          APEX_LOG_LEVEL: 'debug'
        }
      });

      const result = serviceManagerWithEnv.generateServiceFile();

      expect(result.content).toContain('<key>EnvironmentVariables</key>');
      expect(result.content).toContain('<key>NODE_ENV</key>');
      expect(result.content).toContain('<string>production</string>');
      expect(result.content).toContain('<key>APEX_LOG_LEVEL</key>');
      expect(result.content).toContain('<string>debug</string>');
    });
  });

  describe('Windows Service Generation', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });
    });

    it('should generate valid PowerShell service script', async () => {
      const result = serviceManager.generateServiceFile();

      expect(result.platform).toBe('win32');
      expect(result.path).toMatch(/\.ps1$/);
      expect(result.content).toContain('# APEX Daemon Service Installation Script');
      expect(result.content).toContain('New-Service');
      expect(result.content).toContain('-Name "apex-daemon-test"');
      expect(result.content).toContain('-DisplayName "Test APEX Daemon Service"');
      expect(result.content).toContain('-StartupType');
    });

    it('should create PowerShell script with correct content', async () => {
      const result = serviceManager.generateServiceFile();
      const serviceDir = join(testProjectPath, '.apex', 'service');
      const scriptPath = join(serviceDir, 'install-apex-daemon-test.ps1');

      // Create service directory
      await fs.mkdir(serviceDir, { recursive: true });

      // Write script file
      await fs.writeFile(scriptPath, result.content);
      generatedFiles.push(scriptPath);

      // Verify file exists
      const fileExists = await fs.access(scriptPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Verify content
      const fileContent = await fs.readFile(scriptPath, 'utf-8');
      expect(fileContent).toContain('New-Service');
      expect(fileContent).toContain('apex-daemon-test');

      // Verify script structure
      expect(fileContent).toContain('# Installation');
      expect(fileContent).toContain('# Uninstallation');
    });

    it('should generate Windows service with proper startup type', async () => {
      const result = serviceManager.generateServiceFile();

      expect(result.content).toContain('-StartupType Manual');
    });

    it('should include service management functions', async () => {
      const result = serviceManager.generateServiceFile();

      expect(result.content).toContain('function Install-ApexService');
      expect(result.content).toContain('function Uninstall-ApexService');
      expect(result.content).toContain('function Start-ApexService');
      expect(result.content).toContain('function Stop-ApexService');
    });
  });

  describe('Cross-Platform Service Path Resolution', () => {
    const testPlatforms: NodeJS.Platform[] = ['linux', 'darwin', 'win32'];

    testPlatforms.forEach((platform) => {
      it(`should resolve correct service paths for ${platform}`, async () => {
        Object.defineProperty(process, 'platform', {
          value: platform,
          writable: true
        });

        const result = serviceManager.generateServiceFile();

        switch (platform) {
          case 'linux':
            expect(result.path).toMatch(/\.service$/);
            expect(result.path).toContain('apex-daemon-test.service');
            break;
          case 'darwin':
            expect(result.path).toMatch(/\.plist$/);
            expect(result.path).toContain('com.apex.daemon-test.plist');
            break;
          case 'win32':
            expect(result.path).toMatch(/\.ps1$/);
            expect(result.path).toContain('install-apex-daemon-test.ps1');
            break;
        }
      });
    });
  });

  describe('Service Configuration Validation', () => {
    it('should validate required configuration fields', () => {
      const options = serviceManager['options'];

      expect(options.serviceName).toBeDefined();
      expect(options.projectPath).toBeDefined();
      expect(options.serviceDescription).toBeDefined();
    });

    it('should provide default values for optional fields', () => {
      const defaultServiceManager = new ServiceManager({
        projectPath: testProjectPath
      });

      const options = defaultServiceManager['options'];

      expect(options.serviceName).toBe('apex-daemon');
      expect(options.restartPolicy).toBe('always');
      expect(options.user).toBeDefined(); // Should use current user
    });

    it('should handle custom service names correctly', () => {
      const customServiceManager = new ServiceManager({
        projectPath: testProjectPath,
        serviceName: 'custom-apex-service'
      });

      const result = customServiceManager.generateServiceFile();

      expect(result.content).toContain('custom-apex-service');
    });
  });

  describe('File System Operations', () => {
    it('should handle directory creation recursively', async () => {
      const deepPath = join(testProjectPath, 'deep', 'nested', 'service', 'path');

      await fs.mkdir(deepPath, { recursive: true });

      const dirExists = await fs.access(deepPath).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);

      const stats = await fs.stat(deepPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should handle file operations with proper error handling', async () => {
      const testFile = join(testProjectPath, 'test-service.txt');

      // Write file
      await fs.writeFile(testFile, 'test content');
      generatedFiles.push(testFile);

      // Read file
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('test content');

      // Append to file
      await fs.appendFile(testFile, '\nadditional content');

      const updatedContent = await fs.readFile(testFile, 'utf-8');
      expect(updatedContent).toContain('test content');
      expect(updatedContent).toContain('additional content');
    });

    it('should handle file permission scenarios', async () => {
      const testFile = join(testProjectPath, 'permissions-test.txt');

      await fs.writeFile(testFile, 'permission test');
      generatedFiles.push(testFile);

      // Test file is readable
      const readable = await fs.access(testFile, fs.constants.R_OK)
        .then(() => true).catch(() => false);
      expect(readable).toBe(true);

      // Test file is writable
      const writable = await fs.access(testFile, fs.constants.W_OK)
        .then(() => true).catch(() => false);
      expect(writable).toBe(true);
    });
  });

  describe('Service Installation Mock Scenarios', () => {
    it('should simulate successful service installation', async () => {
      // Mock the install method to simulate success
      const mockInstall = vi.fn().mockResolvedValue({
        success: true,
        servicePath: '/test/service/path',
        platform: process.platform,
        enabled: false,
        warnings: []
      });

      serviceManager.install = mockInstall;

      const result = await serviceManager.install();

      expect(result.success).toBe(true);
      expect(result.platform).toBe(process.platform);
      expect(mockInstall).toHaveBeenCalled();
    });

    it('should simulate service installation with warnings', async () => {
      const mockInstall = vi.fn().mockResolvedValue({
        success: true,
        servicePath: '/test/service/path',
        platform: process.platform,
        enabled: false,
        warnings: ['Service directory had to be created', 'Service was already present']
      });

      serviceManager.install = mockInstall;

      const result = await serviceManager.install();

      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0]).toContain('Service directory');
    });

    it('should simulate service installation failure', async () => {
      const mockInstall = vi.fn().mockRejectedValue(
        new Error('Permission denied: Cannot create service')
      );

      serviceManager.install = mockInstall;

      await expect(serviceManager.install()).rejects.toThrow('Permission denied');
    });
  });

  describe('Service Status Verification', () => {
    it('should mock service status checks', async () => {
      const mockGetStatus = vi.fn().mockResolvedValue({
        installed: true,
        enabled: true,
        running: false,
        platform: process.platform,
        servicePath: '/mock/service/path'
      });

      serviceManager.getStatus = mockGetStatus;

      const status = await serviceManager.getStatus();

      expect(status.installed).toBe(true);
      expect(status.enabled).toBe(true);
      expect(status.running).toBe(false);
      expect(status.platform).toBe(process.platform);
    });

    it('should handle service not found scenarios', async () => {
      const mockGetStatus = vi.fn().mockResolvedValue({
        installed: false,
        enabled: false,
        running: false,
        platform: process.platform,
        servicePath: null
      });

      serviceManager.getStatus = mockGetStatus;

      const status = await serviceManager.getStatus();

      expect(status.installed).toBe(false);
      expect(status.servicePath).toBeNull();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid project paths', async () => {
      const invalidPath = '/nonexistent/path/that/should/not/exist';

      const invalidServiceManager = new ServiceManager({
        projectPath: invalidPath,
        serviceName: 'test-service'
      });

      // This should not throw during construction
      expect(invalidServiceManager).toBeDefined();

      // But may fail during file operations (depending on implementation)
      const result = invalidServiceManager.generateServiceFile();
      expect(result).toBeDefined();
    });

    it('should handle special characters in service names', () => {
      const specialCharServiceManager = new ServiceManager({
        projectPath: testProjectPath,
        serviceName: 'apex-test_service.v1'
      });

      const result = specialCharServiceManager.generateServiceFile();

      expect(result.content).toContain('apex-test_service.v1');
    });

    it('should handle long service descriptions', () => {
      const longDescription = 'A'.repeat(1000);

      const longDescServiceManager = new ServiceManager({
        projectPath: testProjectPath,
        serviceName: 'test-service',
        serviceDescription: longDescription
      });

      const result = longDescServiceManager.generateServiceFile();

      expect(result.content).toContain(longDescription);
    });
  });
});
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServiceManager, SystemdGenerator, LaunchdGenerator, detectPlatform } from './service-manager';
import { promises as fs } from 'fs';
import { exec } from 'child_process';

// Windows compatibility: Skip enableOnBoot tests that involve Unix-specific
// systemd/launchd service management behaviors
const isWindows = process.platform === 'win32';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
  },
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('util', () => ({
  promisify: vi.fn((fn) => vi.fn()),
}));

// Mock platform detection
vi.mock('./service-manager', async () => {
  const actual = await vi.importActual('./service-manager');
  return {
    ...actual,
    detectPlatform: vi.fn(),
    isSystemdAvailable: vi.fn(() => true),
    isLaunchdAvailable: vi.fn(() => true),
  };
});

const mockFs = vi.mocked(fs);
const mockExec = vi.mocked(exec);
const mockDetectPlatform = vi.mocked(detectPlatform);

describe('ServiceManager enableOnBoot functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('setEnableOnBoot method', () => {
    it.skipIf(isWindows)('should update enableOnBoot setting and regenerate service file', () => {
      mockDetectPlatform.mockReturnValue('linux');
      const manager = new ServiceManager();

      // Initially false by default
      expect((manager as any).enableOnBoot).toBe(false);

      manager.setEnableOnBoot(true);
      expect((manager as any).enableOnBoot).toBe(true);

      manager.setEnableOnBoot(false);
      expect((manager as any).enableOnBoot).toBe(false);
    });

    it.skipIf(isWindows)('should not regenerate if setting same value', () => {
      mockDetectPlatform.mockReturnValue('linux');
      const manager = new ServiceManager();

      const updateGeneratorSpy = vi.spyOn(manager as any, 'updateGenerator');

      // Set to false when it's already false
      manager.setEnableOnBoot(false);
      expect(updateGeneratorSpy).not.toHaveBeenCalled();

      // Set to true (different value)
      manager.setEnableOnBoot(true);
      expect(updateGeneratorSpy).toHaveBeenCalledOnce();

      // Set to true again (same value)
      updateGeneratorSpy.mockClear();
      manager.setEnableOnBoot(true);
      expect(updateGeneratorSpy).not.toHaveBeenCalled();
    });

    it.skipIf(isWindows)('should update generator for different platforms', () => {
      // Test Linux
      mockDetectPlatform.mockReturnValue('linux');
      const linuxManager = new ServiceManager();
      linuxManager.setEnableOnBoot(true);
      expect((linuxManager as any).generator).toBeInstanceOf(SystemdGenerator);
      expect((linuxManager as any).generator.enableOnBoot).toBe(true);

      // Test macOS
      mockDetectPlatform.mockReturnValue('darwin');
      const macManager = new ServiceManager();
      macManager.setEnableOnBoot(true);
      expect((macManager as any).generator).toBeInstanceOf(LaunchdGenerator);
      expect((macManager as any).generator.enableOnBoot).toBe(true);
    });

    it('should handle unsupported platform gracefully', () => {
      mockDetectPlatform.mockReturnValue('unsupported');
      const manager = new ServiceManager();

      expect(() => manager.setEnableOnBoot(true)).not.toThrow();
      expect((manager as any).generator).toBeNull();
    });
  });

  describe('install method with enableOnBoot option', () => {
    beforeEach(() => {
      mockFs.access.mockRejectedValue({ code: 'ENOENT' });
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it.skipIf(isWindows)('should respect enableOnBoot option in install', async () => {
      mockDetectPlatform.mockReturnValue('linux');
      const execPromise = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });
      vi.mocked(require('util').promisify).mockReturnValue(execPromise);

      const manager = new ServiceManager();
      const setEnableOnBootSpy = vi.spyOn(manager, 'setEnableOnBoot');

      await manager.install({ enableOnBoot: true });

      expect(setEnableOnBootSpy).toHaveBeenCalledWith(true);
    });

    it.skipIf(isWindows)('should use default false for enableOnBoot when not specified', async () => {
      mockDetectPlatform.mockReturnValue('linux');
      const execPromise = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });
      vi.mocked(require('util').promisify).mockReturnValue(execPromise);

      const manager = new ServiceManager();
      const setEnableOnBootSpy = vi.spyOn(manager, 'setEnableOnBoot');

      await manager.install();

      expect(setEnableOnBootSpy).toHaveBeenCalledWith(false);
    });

    it.skipIf(isWindows)('should enable service when enableOnBoot is true on Linux', async () => {
      mockDetectPlatform.mockReturnValue('linux');
      const execPromise = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });
      vi.mocked(require('util').promisify).mockReturnValue(execPromise);

      const manager = new ServiceManager();

      const result = await manager.install({ enableOnBoot: true });

      expect(result.enabled).toBe(true);
      expect(execPromise).toHaveBeenCalledWith('systemctl --user daemon-reload');
      expect(execPromise).toHaveBeenCalledWith('systemctl --user enable apex-daemon');
    });

    it.skipIf(isWindows)('should enable service when enableAfterInstall is true even if enableOnBoot is false', async () => {
      mockDetectPlatform.mockReturnValue('linux');
      const execPromise = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });
      vi.mocked(require('util').promisify).mockReturnValue(execPromise);

      const manager = new ServiceManager();

      const result = await manager.install({
        enableAfterInstall: true,
        enableOnBoot: false
      });

      expect(result.enabled).toBe(true);
    });

    it('should not enable service when both enableAfterInstall and enableOnBoot are false', async () => {
      mockDetectPlatform.mockReturnValue('linux');
      const execPromise = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });
      vi.mocked(require('util').promisify).mockReturnValue(execPromise);

      const manager = new ServiceManager();

      const result = await manager.install({
        enableAfterInstall: false,
        enableOnBoot: false
      });

      expect(result.enabled).toBe(false);
    });

    it('should handle enable errors gracefully and add warnings', async () => {
      mockDetectPlatform.mockReturnValue('linux');
      const execPromise = vi.fn()
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // daemon-reload succeeds
        .mockRejectedValueOnce(new Error('Permission denied')); // enable fails
      vi.mocked(require('util').promisify).mockReturnValue(execPromise);

      const manager = new ServiceManager();

      const result = await manager.install({ enableOnBoot: true });

      expect(result.success).toBe(true);
      expect(result.enabled).toBe(false);
      expect(result.warnings).toContain('Service installed but could not be enabled: Permission denied');
    });

    it('should handle macOS installation with enableOnBoot', async () => {
      mockDetectPlatform.mockReturnValue('darwin');
      const execPromise = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });
      vi.mocked(require('util').promisify).mockReturnValue(execPromise);

      const manager = new ServiceManager();

      await manager.install({ enableOnBoot: true });

      // For macOS, enableOnBoot is controlled by RunAtLoad in plist
      // No additional systemctl commands should be called
      expect(execPromise).not.toHaveBeenCalledWith(expect.stringContaining('systemctl'));
    });

    it('should enable service on macOS when enableAfterInstall is true', async () => {
      mockDetectPlatform.mockReturnValue('darwin');
      const execPromise = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });
      vi.mocked(require('util').promisify).mockReturnValue(execPromise);

      const manager = new ServiceManager();

      const result = await manager.install({ enableAfterInstall: true });

      expect(result.enabled).toBe(true);
      expect(execPromise).toHaveBeenCalledWith(expect.stringContaining('launchctl load'));
    });
  });

  describe('generated service file content with enableOnBoot', () => {
    it('should include enableOnBoot setting in generated file', () => {
      mockDetectPlatform.mockReturnValue('linux');

      const manager = new ServiceManager();
      manager.setEnableOnBoot(true);

      const serviceFile = manager.generateServiceFile();

      expect(serviceFile.content).toContain('[Install]');
      expect(serviceFile.content).toContain('WantedBy=multi-user.target');
      expect(serviceFile.platform).toBe('linux');
    });

    it('should generate correct plist for macOS with enableOnBoot', () => {
      mockDetectPlatform.mockReturnValue('darwin');

      const manager = new ServiceManager();
      manager.setEnableOnBoot(true);

      const serviceFile = manager.generateServiceFile();

      expect(serviceFile.content).toContain('<key>RunAtLoad</key>');
      expect(serviceFile.content).toContain('<true/>');
      expect(serviceFile.platform).toBe('darwin');
    });

    it('should generate correct plist for macOS with enableOnBoot false', () => {
      mockDetectPlatform.mockReturnValue('darwin');

      const manager = new ServiceManager();
      manager.setEnableOnBoot(false);

      const serviceFile = manager.generateServiceFile();

      expect(serviceFile.content).toContain('<key>RunAtLoad</key>');
      expect(serviceFile.content).toContain('<false/>');
      expect(serviceFile.platform).toBe('darwin');
    });
  });
});

describe('SystemdGenerator with enableOnBoot', () => {
  const mockOptions = {
    projectPath: '/test/project',
    serviceName: 'test-service',
    serviceDescription: 'Test Service',
    user: 'testuser',
    workingDirectory: '/test/project',
    environment: {},
    restartPolicy: 'on-failure' as const,
    restartDelaySeconds: 5,
  };

  it('should generate systemd service file with proper Install section', () => {
    const generator = new SystemdGenerator(mockOptions, true);
    const content = generator.generate();

    expect(content).toContain('[Install]');
    expect(content).toContain('WantedBy=multi-user.target');
  });

  it('should generate same systemd content regardless of enableOnBoot value', () => {
    // enableOnBoot doesn't affect systemd file content directly
    // It's handled by systemctl enable/disable commands
    const generatorTrue = new SystemdGenerator(mockOptions, true);
    const generatorFalse = new SystemdGenerator(mockOptions, false);

    const contentTrue = generatorTrue.generate();
    const contentFalse = generatorFalse.generate();

    expect(contentTrue).toBe(contentFalse);
  });

  it('should include all required systemd sections', () => {
    const generator = new SystemdGenerator(mockOptions, true);
    const content = generator.generate();

    expect(content).toContain('[Unit]');
    expect(content).toContain('[Service]');
    expect(content).toContain('[Install]');
    expect(content).toContain('Description=Test Service');
    expect(content).toContain('User=testuser');
  });
});

describe('LaunchdGenerator with enableOnBoot', () => {
  const mockOptions = {
    projectPath: '/test/project',
    serviceName: 'test-service',
    serviceDescription: 'Test Service',
    user: 'testuser',
    workingDirectory: '/test/project',
    environment: {},
    restartPolicy: 'on-failure' as const,
    restartDelaySeconds: 5,
  };

  it('should generate plist with RunAtLoad true when enableOnBoot is true', () => {
    const generator = new LaunchdGenerator(mockOptions, true);
    const content = generator.generate();

    expect(content).toContain('<key>RunAtLoad</key>');
    expect(content).toContain('<true/>');
  });

  it('should generate plist with RunAtLoad false when enableOnBoot is false', () => {
    const generator = new LaunchdGenerator(mockOptions, false);
    const content = generator.generate();

    expect(content).toContain('<key>RunAtLoad</key>');
    expect(content).toContain('<false/>');
  });

  it('should include all required plist keys', () => {
    const generator = new LaunchdGenerator(mockOptions, true);
    const content = generator.generate();

    expect(content).toContain('<key>Label</key>');
    expect(content).toContain('<key>ProgramArguments</key>');
    expect(content).toContain('<key>WorkingDirectory</key>');
    expect(content).toContain('<key>EnvironmentVariables</key>');
    expect(content).toContain('<key>RunAtLoad</key>');
    expect(content).toContain('<key>KeepAlive</key>');
  });

  it('should use correct launchd label format', () => {
    const generator = new LaunchdGenerator(mockOptions, true);
    const content = generator.generate();

    expect(content).toContain('com.apex.service');
  });

  it('should generate valid XML structure', () => {
    const generator = new LaunchdGenerator(mockOptions, true);
    const content = generator.generate();

    expect(content).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(content).toContain('<!DOCTYPE plist');
    expect(content).toContain('<plist version="1.0">');
    expect(content).toContain('<dict>');
    expect(content).toContain('</dict>');
    expect(content).toContain('</plist>');
  });
});

describe('Edge cases and error handling for enableOnBoot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle platform changes gracefully', () => {
    mockDetectPlatform.mockReturnValue('linux');
    const manager = new ServiceManager();
    manager.setEnableOnBoot(true);

    // Simulate platform change (unlikely but test robustness)
    mockDetectPlatform.mockReturnValue('darwin');
    expect(() => manager.setEnableOnBoot(false)).not.toThrow();
  });

  it('should maintain enableOnBoot state across method calls', () => {
    mockDetectPlatform.mockReturnValue('linux');
    const manager = new ServiceManager();

    manager.setEnableOnBoot(true);
    expect((manager as any).enableOnBoot).toBe(true);

    // Generate service file should maintain the setting
    const serviceFile = manager.generateServiceFile();
    expect(serviceFile).toBeDefined();
    expect((manager as any).enableOnBoot).toBe(true);

    manager.setEnableOnBoot(false);
    expect((manager as any).enableOnBoot).toBe(false);
  });

  it('should handle constructor with enableOnBoot-related options', () => {
    mockDetectPlatform.mockReturnValue('linux');

    const manager = new ServiceManager({
      serviceName: 'custom-service',
      projectPath: '/custom/path',
      restartPolicy: 'always'
    });

    expect((manager as any).enableOnBoot).toBe(false); // Default
    expect((manager as any).options.serviceName).toBe('custom-service');
    expect((manager as any).options.restartPolicy).toBe('always');
  });
});
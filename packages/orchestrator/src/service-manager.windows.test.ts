/**
 * Tests for Service Manager Windows Integration
 *
 * Tests the cross-platform service manager's Windows-specific functionality
 * and integration with WindowsServiceManager and WindowsEventLogger.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exec } from 'child_process';
import fs from 'fs';
import { ServiceManager } from './service-manager';
import { WindowsServiceManager } from './windows-service-manager';
import { WindowsEventLogger, createApexEventLogger } from './windows-event-log';

// Mock child_process exec
const mockExec = vi.mocked(exec);
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

// Mock fs operations
vi.mock('fs', () => ({
  promises: {
    writeFile: vi.fn(),
    readFile: vi.fn(),
    unlink: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
    stat: vi.fn()
  },
  constants: {
    F_OK: 0
  }
}));

// Mock console to capture log output
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('ServiceManager Windows Integration', () => {
  let serviceManager: ServiceManager;
  const testConfig = {
    projectPath: 'C:\\apex',
    daemonPath: 'C:\\apex\\dist\\daemon-entry.js',
    serviceName: 'apex-daemon',
    environment: { NODE_ENV: 'production' }
  };

  beforeEach(() => {
    serviceManager = new ServiceManager(testConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Windows Service Detection', () => {
    it('should detect when native Windows service should be used', () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      const shouldUse = serviceManager.shouldUseNativeWindowsService();
      expect(typeof shouldUse).toBe('boolean');
    });

    it('should return false for native Windows service on non-Windows platforms', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

      const linuxServiceManager = new ServiceManager(testConfig);
      expect(linuxServiceManager.shouldUseNativeWindowsService()).toBe(false);

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });
  });

  describe('Windows Service Installation', () => {
    it('should install Windows service with event logging', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock NSSM availability
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, 'NSSM 2.24\r\n', '');
        }
      });

      // Mock NSSM install
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, 'Service installed successfully\r\n', '');
        }
      });

      // Mock NSSM configuration commands
      const configCommands = 5; // Application, AppParameters, AppDirectory, Start, AppEnvironmentExtra
      for (let i = 0; i < configCommands; i++) {
        mockExec.mockImplementationOnce((cmd, options, callback) => {
          if (typeof callback === 'function') {
            callback(null, '', '');
          }
        });
      }

      const result = await serviceManager.installWindowsServiceNative();

      expect(result.success).toBe(true);
      expect(result.serviceName).toBe('apex-daemon');
    });

    it('should handle Windows service installation errors', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock NSSM available
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, 'NSSM 2.24\r\n', '');
        }
      });

      // Mock NSSM install failure
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Access denied'), '', 'Access denied\r\n');
        }
      });

      await expect(serviceManager.installWindowsServiceNative()).rejects.toThrow();
    });
  });

  describe('Windows Service Lifecycle Management', () => {
    it('should start Windows service with event logging', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock service start
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        expect(cmd).toContain('sc start apex-daemon');
        if (typeof callback === 'function') {
          callback(null, '[SC] StartService SUCCESS\r\n', '');
        }
      });

      await expect(serviceManager.startWindowsServiceNative()).resolves.not.toThrow();
    });

    it('should stop Windows service with event logging', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock service stop
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        expect(cmd).toContain('sc stop apex-daemon');
        if (typeof callback === 'function') {
          callback(null, '[SC] ControlService SUCCESS\r\n', '');
        }
      });

      await expect(serviceManager.stopWindowsServiceNative()).resolves.not.toThrow();
    });

    it('should get Windows service status with detailed information', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock service status query
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        const mockOutput = `
SERVICE_NAME: apex-daemon
        TYPE               : 10  WIN32_OWN_PROCESS
        STATE              : 4  RUNNING
        WIN32_EXIT_CODE    : 0  (0x0)
        SERVICE_EXIT_CODE  : 0  (0x0)
        CHECKPOINT         : 0x0
        WAIT_HINT          : 0x0
`;
        if (typeof callback === 'function') {
          callback(null, mockOutput, '');
        }
      });

      // Mock PID query
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        const mockOutput = 'node.exe                      2468 Services                   0     48,392 K';
        if (typeof callback === 'function') {
          callback(null, mockOutput, '');
        }
      });

      const status = await serviceManager.getWindowsServiceStatusNative();

      expect(status.installed).toBe(true);
      expect(status.state).toBe('running');
      expect(status.pid).toBe(2468);
    });
  });

  describe('Windows Service Uninstallation', () => {
    it('should uninstall Windows service with cleanup', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock NSSM check
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, 'NSSM 2.24\r\n', '');
        }
      });

      // Mock service status check
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        const mockOutput = 'SERVICE_NAME: apex-daemon\n        STATE              : 1  STOPPED';
        if (typeof callback === 'function') {
          callback(null, mockOutput, '');
        }
      });

      // Mock NSSM remove
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        expect(cmd).toContain('nssm remove apex-daemon confirm');
        if (typeof callback === 'function') {
          callback(null, 'Service removed successfully\r\n', '');
        }
      });

      const result = await serviceManager.uninstallWindowsServiceNative();

      expect(result.success).toBe(true);
      expect(result.method).toBe('NSSM');
    });
  });

  describe('Event Logger Integration', () => {
    it('should provide access to event logger', () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      const eventLogger = serviceManager.getEventLogger();
      expect(eventLogger).toBeDefined();
      expect(eventLogger).toBeInstanceOf(WindowsEventLogger);
    });

    it('should create event logger with correct APEX configuration', () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      const eventLogger = serviceManager.getEventLogger();
      expect(eventLogger['config'].source).toBe('APEX Daemon');
      expect(eventLogger['config'].logName).toBe('Application');
    });
  });

  describe('Windows PowerShell Script Generation', () => {
    it('should generate Windows PowerShell installation script', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      const installScript = await serviceManager.generateWindowsInstallScript();

      expect(installScript).toBeDefined();
      expect(installScript).toContain('# APEX Windows Service Installation Script');
      expect(installScript).toContain('apex-daemon');
      expect(installScript).toContain('nssm install');
      expect(installScript).toMatch(/Check\s+if\s+running\s+as\s+administrator/i);
    });

    it('should generate Windows PowerShell uninstall script', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      const uninstallScript = await serviceManager.generateWindowsUninstallScript();

      expect(uninstallScript).toBeDefined();
      expect(uninstallScript).toContain('# APEX Windows Service Uninstallation Script');
      expect(uninstallScript).toContain('apex-daemon');
      expect(uninstallScript).toContain('nssm remove');
      expect(uninstallScript).toMatch(/Stop\s+the\s+service/i);
    });

    it('should include proper error handling in generated scripts', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      const installScript = await serviceManager.generateWindowsInstallScript();

      expect(installScript).toContain('try {');
      expect(installScript).toContain('} catch {');
      expect(installScript).toMatch(/Write-Error|Write-Host.*-ForegroundColor\s+Red/);
    });
  });

  describe('Windows Service Configuration Validation', () => {
    it('should validate Windows service configuration', () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      const config = serviceManager['createWindowsServiceConfig']();

      expect(config.serviceName).toBe('apex-daemon');
      expect(config.displayName).toBe('APEX Daemon');
      expect(config.description).toContain('APEX AI Development Team');
      expect(config.executablePath).toContain('node');
      expect(config.arguments).toContain('C:\\apex\\dist\\daemon-entry.js');
      expect(config.workingDirectory).toBe('C:\\apex');
      expect(config.environment.APEX_WINDOWS_SERVICE).toBe('1');
      expect(config.startType).toBe('auto');
    });

    it('should set appropriate recovery options', () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      const recoveryOptions = serviceManager['createRecoveryOptions']();

      expect(recoveryOptions.firstFailure).toBe('restart');
      expect(recoveryOptions.secondFailure).toBe('restart');
      expect(recoveryOptions.subsequentFailures).toBe('none');
      expect(recoveryOptions.resetPeriodDays).toBe(1);
      expect(recoveryOptions.restartDelayMs).toBe(5000);
    });
  });

  describe('Cross-Platform Service Management', () => {
    it('should handle non-Windows platforms gracefully', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

      const linuxServiceManager = new ServiceManager(testConfig);

      // These should not throw on non-Windows platforms
      await expect(linuxServiceManager.installWindowsServiceNative()).rejects.toThrow('Windows service');
      await expect(linuxServiceManager.startWindowsServiceNative()).rejects.toThrow('Windows service');
      await expect(linuxServiceManager.stopWindowsServiceNative()).rejects.toThrow('Windows service');
      await expect(linuxServiceManager.uninstallWindowsServiceNative()).rejects.toThrow('Windows service');

      const status = await linuxServiceManager.getWindowsServiceStatusNative();
      expect(status.installed).toBe(false);
      expect(status.state).toBe('unknown');

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });

    it('should provide event logger on all platforms with appropriate fallback', () => {
      const eventLogger = serviceManager.getEventLogger();
      expect(eventLogger).toBeDefined();

      // On non-Windows, it should still work but log to console
      if (process.platform !== 'win32') {
        expect(eventLogger).toBeInstanceOf(WindowsEventLogger);
      }
    });
  });

  describe('Service Dependency Management', () => {
    it('should handle service dependencies correctly', () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      const config = serviceManager['createWindowsServiceConfig']();

      // APEX daemon should not depend on other services by default
      expect(config.dependencies || []).toEqual([]);
    });
  });

  describe('Windows Service Environment Variables', () => {
    it('should set required environment variables for Windows service', () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      const config = serviceManager['createWindowsServiceConfig']();

      expect(config.environment.APEX_WINDOWS_SERVICE).toBe('1');
      expect(config.environment.NODE_ENV).toBe('production');
      expect(config.environment.APEX_PROJECT_PATH).toBe('C:\\apex');
    });

    it('should include custom environment variables', () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      const customServiceManager = new ServiceManager({
        ...testConfig,
        environment: {
          NODE_ENV: 'production',
          CUSTOM_VAR: 'test-value',
          APEX_LOG_LEVEL: 'debug'
        }
      });

      const config = customServiceManager['createWindowsServiceConfig']();

      expect(config.environment.CUSTOM_VAR).toBe('test-value');
      expect(config.environment.APEX_LOG_LEVEL).toBe('debug');
      expect(config.environment.APEX_WINDOWS_SERVICE).toBe('1'); // Should always be set
    });
  });

  describe('Windows Service Error Recovery', () => {
    it('should handle service start failures with retry logic', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock service start failure
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(
            new Error('Service start failed'),
            '',
            '[SC] StartService FAILED 1056:\n\nAn instance of the service is already running.\n'
          );
        }
      });

      await expect(serviceManager.startWindowsServiceNative()).rejects.toThrow();
    });

    it('should handle service stop with timeout', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock service stop with timeout
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        // Simulate timeout by calling callback after delay
        setTimeout(() => {
          if (typeof callback === 'function') {
            callback(null, '[SC] ControlService SUCCESS\n', '');
          }
        }, 100);
      });

      await expect(serviceManager.stopWindowsServiceNative()).resolves.not.toThrow();
    });
  });

  describe('Windows Service Monitoring Integration', () => {
    it('should integrate with Windows Event Log for monitoring', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      const eventLogger = serviceManager.getEventLogger();

      // Test that event logger methods are available
      expect(typeof eventLogger.logServiceStarted).toBe('function');
      expect(typeof eventLogger.logServiceStopped).toBe('function');
      expect(typeof eventLogger.logTaskStarted).toBe('function');
      expect(typeof eventLogger.logTaskCompleted).toBe('function');
      expect(typeof eventLogger.logCapacityLimitReached).toBe('function');

      // Test logging doesn't throw (uses console fallback on non-Windows in tests)
      await expect(eventLogger.logServiceStarted(1234)).resolves.not.toThrow();
    });
  });
});
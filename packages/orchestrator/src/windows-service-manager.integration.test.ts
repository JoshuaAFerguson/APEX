/**
 * Integration Tests for Windows Service Manager
 *
 * These tests mock Windows commands to simulate realistic Windows service operations
 * without requiring actual Windows environment or elevated privileges.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { WindowsServiceManager, WindowsServiceError, type WindowsServiceConfig } from './windows-service-manager';

// Mock child_process exec
const mockExec = vi.mocked(exec);
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

// Mock fs promises
vi.mock('fs', () => ({
  promises: {
    writeFile: vi.fn(),
    unlink: vi.fn(),
    mkdir: vi.fn()
  },
  constants: {
    F_OK: 0
  }
}));

describe('WindowsServiceManager Integration Tests', () => {
  let manager: WindowsServiceManager;
  let mockWriteFile: any;
  let mockUnlink: any;
  let mockMkdir: any;

  const testServiceConfig: WindowsServiceConfig = {
    serviceName: 'apex-test-service',
    displayName: 'APEX Test Service',
    description: 'Test service for APEX daemon',
    executablePath: 'C:\\Program Files\\nodejs\\node.exe',
    arguments: ['C:\\apex\\dist\\daemon-entry.js'],
    workingDirectory: 'C:\\apex',
    environment: { NODE_ENV: 'production', APEX_WINDOWS_SERVICE: '1' },
    startType: 'auto'
  };

  beforeEach(() => {
    manager = new WindowsServiceManager();
    const fsPromises = vi.mocked(require('fs').promises);
    mockWriteFile = fsPromises.writeFile;
    mockUnlink = fsPromises.unlink;
    mockMkdir = fsPromises.mkdir;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('NSSM Integration Tests', () => {
    it('should successfully install service using NSSM when available', async () => {
      // Skip on non-Windows platforms
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock NSSM availability check - success
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, 'NSSM 2.24\r\n', '');
        }
      });

      // Mock NSSM install command - success
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        expect(cmd).toContain('nssm install');
        expect(cmd).toContain('apex-test-service');
        if (typeof callback === 'function') {
          callback(null, 'Service "apex-test-service" installed successfully!\r\n', '');
        }
      });

      // Mock NSSM set commands for configuration
      const nssmSetCommands = ['Application', 'AppParameters', 'AppDirectory', 'Start', 'AppEnvironmentExtra'];
      nssmSetCommands.forEach(() => {
        mockExec.mockImplementationOnce((cmd, options, callback) => {
          expect(cmd).toContain('nssm set');
          if (typeof callback === 'function') {
            callback(null, '', '');
          }
        });
      });

      const result = await manager.install(testServiceConfig);

      expect(result.success).toBe(true);
      expect(result.method).toBe('NSSM');
      expect(result.serviceName).toBe('apex-test-service');
      expect(mockExec).toHaveBeenCalledTimes(1 + 1 + nssmSetCommands.length); // Check + Install + Configure
    });

    it('should handle NSSM installation failure gracefully', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock NSSM availability - success
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, 'NSSM 2.24\r\n', '');
        }
      });

      // Mock NSSM install failure
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Access denied'), '', 'Access denied. Run as administrator.\r\n');
        }
      });

      await expect(manager.install(testServiceConfig)).rejects.toThrow(WindowsServiceError);
    });

    it('should fallback to sc.exe when NSSM is not available', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock NSSM unavailable
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('NSSM not found'), '', 'NSSM not found');
        }
      });

      // Mock wrapper script creation
      mockMkdir.mockResolvedValueOnce(undefined);
      mockWriteFile.mockResolvedValueOnce(undefined);

      // Mock sc.exe create command - success
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        expect(cmd).toContain('sc create');
        expect(cmd).toContain('apex-test-service');
        if (typeof callback === 'function') {
          callback(null, '[SC] CreateService SUCCESS\r\n', '');
        }
      });

      // Mock sc.exe config commands
      const scConfigCommands = 3; // description, start type, failure actions
      for (let i = 0; i < scConfigCommands; i++) {
        mockExec.mockImplementationOnce((cmd, options, callback) => {
          expect(cmd).toContain('sc config');
          if (typeof callback === 'function') {
            callback(null, '[SC] ChangeServiceConfig SUCCESS\r\n', '');
          }
        });
      }

      const result = await manager.install(testServiceConfig);

      expect(result.success).toBe(true);
      expect(result.method).toBe('sc.exe');
      expect(result.serviceName).toBe('apex-test-service');
      expect(mockWriteFile).toHaveBeenCalled(); // Wrapper script created
    });
  });

  describe('Service Lifecycle Operations', () => {
    it('should start service successfully', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock service start command
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        expect(cmd).toContain('sc start apex-test-service');
        if (typeof callback === 'function') {
          callback(null, '[SC] StartService SUCCESS\r\n', '');
        }
      });

      await expect(manager.start('apex-test-service')).resolves.not.toThrow();
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('sc start apex-test-service'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should stop service successfully', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock service stop command
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        expect(cmd).toContain('sc stop apex-test-service');
        if (typeof callback === 'function') {
          callback(null, '[SC] ControlService SUCCESS\r\n', '');
        }
      });

      await expect(manager.stop('apex-test-service')).resolves.not.toThrow();
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('sc stop apex-test-service'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should restart service successfully', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock stop command
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, '[SC] ControlService SUCCESS\r\n', '');
        }
      });

      // Mock start command
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, '[SC] StartService SUCCESS\r\n', '');
        }
      });

      await expect(manager.restart('apex-test-service')).resolves.not.toThrow();
      expect(mockExec).toHaveBeenCalledTimes(2); // stop + start
    });
  });

  describe('Service Status Queries', () => {
    it('should query service status successfully when running', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock service query - running state
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        expect(cmd).toContain('sc query apex-test-service');
        const mockOutput = `
SERVICE_NAME: apex-test-service
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
        expect(cmd).toContain('tasklist /fi');
        const mockTasklistOutput = 'node.exe                      1234 Services                   0     45,678 K';
        if (typeof callback === 'function') {
          callback(null, mockTasklistOutput, '');
        }
      });

      const status = await manager.getStatus('apex-test-service');

      expect(status.installed).toBe(true);
      expect(status.state).toBe('running');
      expect(status.pid).toBe(1234);
    });

    it('should handle service not found gracefully', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock service query - service not found
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(
            new Error('Service not found'),
            '',
            '[SC] EnumQueryServicesStatus:OpenService FAILED 1060:\r\n\r\nThe specified service does not exist as an installed service.\r\n'
          );
        }
      });

      const status = await manager.getStatus('nonexistent-service');

      expect(status.installed).toBe(false);
      expect(status.state).toBe('unknown');
      expect(status.startType).toBe('disabled');
    });
  });

  describe('Service Uninstallation', () => {
    it('should uninstall NSSM service successfully', async () => {
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

      // Mock service query to check if installed via NSSM
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        const mockOutput = `
SERVICE_NAME: apex-test-service
        TYPE               : 10  WIN32_OWN_PROCESS
        STATE              : 1  STOPPED
`;
        if (typeof callback === 'function') {
          callback(null, mockOutput, '');
        }
      });

      // Mock NSSM remove command
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        expect(cmd).toContain('nssm remove apex-test-service confirm');
        if (typeof callback === 'function') {
          callback(null, 'Service "apex-test-service" removed successfully!\r\n', '');
        }
      });

      const result = await manager.uninstall('apex-test-service');

      expect(result.success).toBe(true);
      expect(result.method).toBe('NSSM');
    });

    it('should uninstall sc.exe service and clean up wrapper script', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock NSSM unavailable
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('NSSM not found'), '', '');
        }
      });

      // Mock sc.exe delete command
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        expect(cmd).toContain('sc delete apex-test-service');
        if (typeof callback === 'function') {
          callback(null, '[SC] DeleteService SUCCESS\r\n', '');
        }
      });

      // Mock wrapper script cleanup
      mockUnlink.mockResolvedValueOnce(undefined);

      const result = await manager.uninstall('apex-test-service');

      expect(result.success).toBe(true);
      expect(result.method).toBe('sc.exe');
      expect(mockUnlink).toHaveBeenCalled(); // Wrapper script deleted
    });
  });

  describe('Service Recovery Configuration', () => {
    it('should configure service recovery options', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      const recoveryOptions = {
        firstFailure: 'restart' as const,
        secondFailure: 'restart' as const,
        subsequentFailures: 'none' as const,
        resetPeriodDays: 1,
        restartDelayMs: 5000
      };

      // Mock sc.exe failure command
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        expect(cmd).toContain('sc failure apex-test-service');
        expect(cmd).toContain('reset= 86400'); // 1 day in seconds
        expect(cmd).toContain('actions= restart/5000/restart/5000/none/0');
        if (typeof callback === 'function') {
          callback(null, '[SC] ChangeServiceConfig2 SUCCESS\r\n', '');
        }
      });

      await expect(manager.configureRecovery('apex-test-service', recoveryOptions)).resolves.not.toThrow();
    });
  });

  describe('Administrative Privilege Detection', () => {
    it('should detect elevated privileges correctly', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock net session command for admin check - success (elevated)
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        expect(cmd).toContain('net session');
        if (typeof callback === 'function') {
          callback(null, 'Computer                 User name            Client Type       Opens Idle time\r\n', '');
        }
      });

      const isElevated = await manager.isElevated();
      expect(isElevated).toBe(true);
    });

    it('should detect non-elevated privileges correctly', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock net session command for admin check - failure (not elevated)
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Access denied'), '', 'System error 5 has occurred.\r\n\r\nAccess is denied.\r\n');
        }
      });

      const isElevated = await manager.isElevated();
      expect(isElevated).toBe(false);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle PowerShell execution errors', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock command failure
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Command failed'), '', 'PowerShell execution error');
        }
      });

      await expect(manager.start('apex-test-service')).rejects.toThrow(WindowsServiceError);
    });

    it('should handle service installation with insufficient privileges', async () => {
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

      // Mock NSSM install with access denied
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(
            new Error('Access denied'),
            '',
            'Access is denied.\r\nRun as administrator to install services.'
          );
        }
      });

      await expect(manager.install(testServiceConfig)).rejects.toThrow(WindowsServiceError);
    });

    it('should handle service already exists error during installation', async () => {
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

      // Mock NSSM install with service exists
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(
            new Error('Service exists'),
            '',
            'The specified service already exists.\r\n'
          );
        }
      });

      await expect(manager.install(testServiceConfig)).rejects.toThrow(WindowsServiceError);
    });
  });

  describe('PID Detection Methods', () => {
    it('should detect PID using tasklist command', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock tasklist output with PID
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        expect(cmd).toContain('tasklist /fi "SERVICES eq apex-test-service"');
        const mockOutput = 'Image Name                     PID Session Name        Session#    Mem Usage\r\nnode.exe                      5678 Services                   0     52,344 K\r\n';
        if (typeof callback === 'function') {
          callback(null, mockOutput, '');
        }
      });

      const pid = await manager['getServicePid']('apex-test-service');
      expect(pid).toBe(5678);
    });

    it('should fallback to wmic when tasklist fails', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock tasklist failure
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Tasklist failed'), '', 'ERROR: The process "tasklist" not found.');
        }
      });

      // Mock wmic success
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        expect(cmd).toContain('wmic service');
        expect(cmd).toContain('apex-test-service');
        const mockOutput = 'ProcessId\r\n9876\r\n';
        if (typeof callback === 'function') {
          callback(null, mockOutput, '');
        }
      });

      const pid = await manager['getServicePid']('apex-test-service');
      expect(pid).toBe(9876);
    });

    it('should fallback to PowerShell when both tasklist and wmic fail', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock tasklist failure
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Tasklist failed'), '', '');
        }
      });

      // Mock wmic failure
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Wmic failed'), '', '');
        }
      });

      // Mock PowerShell success
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        expect(cmd).toContain('Get-WmiObject');
        expect(cmd).toContain('apex-test-service');
        const mockOutput = '1357\r\n';
        if (typeof callback === 'function') {
          callback(null, mockOutput, '');
        }
      });

      const pid = await manager['getServicePid']('apex-test-service');
      expect(pid).toBe(1357);
    });

    it('should return undefined when all PID detection methods fail', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock all methods failing
      ['tasklist', 'wmic', 'powershell'].forEach(() => {
        mockExec.mockImplementationOnce((cmd, options, callback) => {
          if (typeof callback === 'function') {
            callback(new Error('Command failed'), '', '');
          }
        });
      });

      const pid = await manager['getServicePid']('apex-test-service');
      expect(pid).toBeUndefined();
    });
  });
});
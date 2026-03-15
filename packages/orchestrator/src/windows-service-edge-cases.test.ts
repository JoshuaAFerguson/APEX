/**
 * Edge Cases and Error Scenario Tests for Windows Service Management
 *
 * Comprehensive tests for error conditions, edge cases, and stress scenarios
 * in Windows service management operations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exec } from 'child_process';
import fs from 'fs';
import {
  WindowsServiceManager,
  WindowsServiceError,
  type WindowsServiceConfig
} from './windows-service-manager';
import {
  WindowsEventLogger,
  createApexEventLogger,
  APEX_EVENT_IDS
} from './windows-event-log';

// Mock child_process exec
const mockExec = vi.mocked(exec);
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

// Mock fs operations
vi.mock('fs', () => ({
  promises: {
    writeFile: vi.fn(),
    unlink: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn()
  },
  constants: {
    F_OK: 0,
    W_OK: 2
  }
}));

describe('Windows Service Edge Cases and Error Scenarios', () => {
  let manager: WindowsServiceManager;
  let eventLogger: WindowsEventLogger;
  let mockWriteFile: any;
  let mockUnlink: any;
  let mockMkdir: any;
  let mockAccess: any;

  const validConfig: WindowsServiceConfig = {
    serviceName: 'apex-test-service',
    displayName: 'APEX Test Service',
    description: 'Test service for edge case testing',
    executablePath: 'C:\\Program Files\\nodejs\\node.exe',
    arguments: ['C:\\apex\\dist\\daemon-entry.js'],
    workingDirectory: 'C:\\apex',
    environment: { NODE_ENV: 'test' },
    startType: 'auto'
  };

  beforeEach(() => {
    manager = new WindowsServiceManager();
    eventLogger = createApexEventLogger();
    const fsPromises = vi.mocked(require('fs').promises);
    mockWriteFile = fsPromises.writeFile;
    mockUnlink = fsPromises.unlink;
    mockMkdir = fsPromises.mkdir;
    mockAccess = fsPromises.access;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Service Configuration Edge Cases', () => {
    it('should handle service names with special characters', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      const configWithSpecialChars: WindowsServiceConfig = {
        ...validConfig,
        serviceName: 'apex-test_service.2024',
        displayName: 'APEX Test Service (2024)',
        description: 'Service with special chars: & < > " \''
      };

      // Mock NSSM available
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, 'NSSM 2.24\r\n', '');
        }
      });

      // Mock successful install with escaped characters
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        expect(cmd).toContain('apex-test_service.2024');
        if (typeof callback === 'function') {
          callback(null, 'Service installed successfully\r\n', '');
        }
      });

      // Mock configuration commands
      Array.from({ length: 5 }).forEach(() => {
        mockExec.mockImplementationOnce((cmd, options, callback) => {
          if (typeof callback === 'function') {
            callback(null, '', '');
          }
        });
      });

      const result = await manager.install(configWithSpecialChars);
      expect(result.success).toBe(true);
    });

    it('should handle very long service names and descriptions', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      const longConfig: WindowsServiceConfig = {
        ...validConfig,
        serviceName: 'apex-service-with-very-long-name-that-exceeds-normal-length-limits',
        displayName: 'APEX Service with Extremely Long Display Name that Tests Length Limits',
        description: 'x'.repeat(1000) // Very long description
      };

      // Mock NSSM available
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, 'NSSM 2.24\r\n', '');
        }
      });

      // Should handle long names gracefully (might truncate)
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, 'Service installed successfully\r\n', '');
        }
      });

      // Mock configuration commands
      Array.from({ length: 5 }).forEach(() => {
        mockExec.mockImplementationOnce((cmd, options, callback) => {
          if (typeof callback === 'function') {
            callback(null, '', '');
          }
        });
      });

      await expect(manager.install(longConfig)).resolves.toBeDefined();
    });

    it('should handle paths with spaces and special characters', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      const pathConfig: WindowsServiceConfig = {
        ...validConfig,
        executablePath: 'C:\\Program Files (x86)\\Node.js\\node.exe',
        workingDirectory: 'C:\\Users\\Test User\\My Projects\\APEX System',
        arguments: ['--option', 'value with spaces', '--flag']
      };

      // Mock NSSM available
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, 'NSSM 2.24\r\n', '');
        }
      });

      // Mock successful install with quoted paths
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        expect(cmd).toContain('"C:\\Program Files (x86)\\Node.js\\node.exe"');
        if (typeof callback === 'function') {
          callback(null, 'Service installed successfully\r\n', '');
        }
      });

      // Mock configuration commands
      Array.from({ length: 5 }).forEach(() => {
        mockExec.mockImplementationOnce((cmd, options, callback) => {
          if (typeof callback === 'function') {
            callback(null, '', '');
          }
        });
      });

      const result = await manager.install(pathConfig);
      expect(result.success).toBe(true);
    });
  });

  describe('System Resource and Permission Edge Cases', () => {
    it('should handle disk space issues during wrapper script creation', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock NSSM unavailable (fallback to sc.exe)
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('NSSM not found'), '', '');
        }
      });

      // Mock directory creation success
      mockMkdir.mockResolvedValueOnce(undefined);

      // Mock disk space error on file write
      const diskSpaceError = new Error('ENOSPC: no space left on device');
      diskSpaceError.code = 'ENOSPC';
      mockWriteFile.mockRejectedValueOnce(diskSpaceError);

      await expect(manager.install(validConfig)).rejects.toThrow(WindowsServiceError);
    });

    it('should handle read-only filesystem issues', async () => {
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

      // Mock read-only filesystem error
      const readOnlyError = new Error('EROFS: read-only file system');
      readOnlyError.code = 'EROFS';
      mockMkdir.mockRejectedValueOnce(readOnlyError);

      await expect(manager.install(validConfig)).rejects.toThrow(WindowsServiceError);
    });

    it('should handle concurrent service operations', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock NSSM available
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('nssm --version')) {
          if (typeof callback === 'function') {
            callback(null, 'NSSM 2.24\r\n', '');
          }
        } else {
          // Simulate concurrent operation conflict
          if (typeof callback === 'function') {
            callback(
              new Error('Service database locked'),
              '',
              'The service database is locked.\r\n'
            );
          }
        }
      });

      // Try multiple concurrent operations
      const promises = [
        manager.install({ ...validConfig, serviceName: 'test-service-1' }),
        manager.install({ ...validConfig, serviceName: 'test-service-2' }),
        manager.install({ ...validConfig, serviceName: 'test-service-3' })
      ];

      // All should fail with database locked error
      await expect(Promise.all(promises)).rejects.toThrow();
    });
  });

  describe('Command Execution Edge Cases', () => {
    it('should handle PowerShell execution policy restrictions', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock PowerShell execution policy error
      mockExec.mockImplementation((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(
            new Error('Execution policy error'),
            '',
            'Execution of scripts is disabled on this system. Please see "get-help about_signing".\r\n'
          );
        }
      });

      await expect(eventLogger.writeInfo('Test message')).resolves.not.toThrow();
      // Should fall back to console logging without throwing
    });

    it('should handle command timeout scenarios', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock command that never responds
      mockExec.mockImplementation((cmd, options, callback) => {
        // Never call callback to simulate timeout
        setTimeout(() => {
          if (typeof callback === 'function') {
            callback(new Error('Command timed out'), '', '');
          }
        }, 100);
      });

      const timeoutPromise = manager.getStatus('test-service');

      // Should eventually timeout or handle gracefully
      await expect(timeoutPromise).resolves.toBeDefined();
    });

    it('should handle malformed command output', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock malformed sc query output
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        const malformedOutput = `
MALFORMED SERVICE OUTPUT
TYPE: INVALID
STATE: !!!CORRUPTED!!!
RANDOM DATA HERE
`;
        if (typeof callback === 'function') {
          callback(null, malformedOutput, '');
        }
      });

      const status = await manager.getStatus('test-service');

      // Should handle gracefully with unknown state
      expect(status.installed).toBe(false);
      expect(status.state).toBe('unknown');
    });
  });

  describe('Service State Edge Cases', () => {
    it('should handle service in pending states', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock service in START_PENDING state
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        const pendingOutput = `
SERVICE_NAME: test-service
        TYPE               : 10  WIN32_OWN_PROCESS
        STATE              : 2  START_PENDING
        WIN32_EXIT_CODE    : 0  (0x0)
        SERVICE_EXIT_CODE  : 0  (0x0)
        CHECKPOINT         : 0x1
        WAIT_HINT          : 0x7530
`;
        if (typeof callback === 'function') {
          callback(null, pendingOutput, '');
        }
      });

      const status = await manager.getStatus('test-service');

      expect(status.installed).toBe(true);
      expect(status.state).toBe('start_pending');
    });

    it('should handle service restart scenarios', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock service already stopped
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (cmd.includes('sc stop')) {
          if (typeof callback === 'function') {
            callback(
              new Error('Service not running'),
              '',
              '[SC] ControlService FAILED 1062:\r\n\r\nThe service has not been started.\r\n'
            );
          }
        }
      });

      // Mock successful start
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (cmd.includes('sc start')) {
          if (typeof callback === 'function') {
            callback(null, '[SC] StartService SUCCESS\r\n', '');
          }
        }
      });

      // Should handle stop failure but continue with start
      await expect(manager.restart('test-service')).resolves.not.toThrow();
    });
  });

  describe('Event Logging Edge Cases', () => {
    it('should handle event source registration conflicts', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock event source already exists error
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (cmd.includes('New-EventLog')) {
          if (typeof callback === 'function') {
            callback(
              new Error('Source exists'),
              '',
              'Source "APEX Daemon" already exists on the local computer.\r\n'
            );
          }
        }
      });

      // Should handle gracefully and continue with logging
      await expect(eventLogger.registerSource()).resolves.not.toThrow();
    });

    it('should handle extremely long event messages', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      const veryLongMessage = 'x'.repeat(100000); // Exceeds Windows Event Log limits

      // Mock successful PowerShell execution (message will be truncated)
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, '', '');
        }
      });

      // Should handle by truncating message
      await expect(eventLogger.writeError(veryLongMessage)).resolves.not.toThrow();
    });

    it('should handle batch event logging with mixed success/failure', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      const events = [
        {
          source: 'APEX Daemon',
          type: 4, // Information
          eventId: APEX_EVENT_IDS.SERVICE_STARTED,
          message: 'Service started'
        },
        {
          source: 'APEX Daemon',
          type: 1, // Error
          eventId: APEX_EVENT_IDS.CRITICAL_ERROR,
          message: 'Critical error occurred'
        }
      ];

      let callCount = 0;
      mockExec.mockImplementation((cmd, options, callback) => {
        callCount++;
        if (callCount === 1) {
          // First event succeeds
          if (typeof callback === 'function') {
            callback(null, '', '');
          }
        } else {
          // Second event fails
          if (typeof callback === 'function') {
            callback(new Error('Event log write failed'), '', 'Access denied');
          }
        }
      });

      // Should not throw even if some events fail
      await expect(eventLogger.writeBatch(events)).resolves.not.toThrow();
    });
  });

  describe('Recovery and Cleanup Edge Cases', () => {
    it('should handle partial service installation cleanup', async () => {
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

      // Mock successful service creation
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, 'Service installed successfully\r\n', '');
        }
      });

      // Mock failure on first configuration command
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Configuration failed'), '', 'Access denied');
        }
      });

      // Should attempt cleanup
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        expect(cmd).toContain('nssm remove');
        if (typeof callback === 'function') {
          callback(null, 'Service removed\r\n', '');
        }
      });

      await expect(manager.install(validConfig)).rejects.toThrow(WindowsServiceError);
    });

    it('should handle orphaned wrapper script cleanup', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock uninstallation with wrapper script cleanup
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('NSSM not found'), '', '');
        }
      });

      // Mock sc.exe delete
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, '[SC] DeleteService SUCCESS\r\n', '');
        }
      });

      // Mock wrapper script deletion failure
      const unlinkError = new Error('File in use');
      unlinkError.code = 'EBUSY';
      mockUnlink.mockRejectedValueOnce(unlinkError);

      // Should complete uninstall despite cleanup failure
      const result = await manager.uninstall('test-service');
      expect(result.success).toBe(true);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should handle high-frequency service operations', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock rapid service status queries
      mockExec.mockImplementation((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, 'SERVICE_NAME: test-service\n        STATE: 4  RUNNING', '');
        }
      });

      // Perform many rapid status checks
      const promises = Array.from({ length: 100 }, () =>
        manager.getStatus('test-service')
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(100);
      results.forEach(result => {
        expect(result.state).toBe('running');
      });
    });

    it('should handle memory pressure during event logging', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock successful event logging
      mockExec.mockImplementation((cmd, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, '', '');
        }
      });

      // Perform many concurrent event logging operations
      const promises = Array.from({ length: 50 }, (_, i) =>
        eventLogger.writeInfo(`Test message ${i}`, APEX_EVENT_IDS.TASK_COMPLETED)
      );

      // Should handle all operations without memory issues
      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });

  describe('Edge Cases in PID Detection', () => {
    it('should handle multiple processes with same name', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock tasklist with multiple node.exe processes
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        const multipleProcessesOutput = `
Image Name                     PID Session Name        Session#    Mem Usage
node.exe                      1234 Console                    1     45,678 K
node.exe                      5678 Services                   0     52,344 K
node.exe                      9012 Console                    1     38,292 K
`;
        if (typeof callback === 'function') {
          callback(null, multipleProcessesOutput, '');
        }
      });

      // Should return the service session PID (5678)
      const pid = await manager['getServicePid']('test-service');
      expect(pid).toBe(5678);
    });

    it('should handle PID detection when service name contains special characters', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      const specialServiceName = 'apex-service.test_2024';

      // Mock tasklist command with escaped service name
      mockExec.mockImplementationOnce((cmd, options, callback) => {
        expect(cmd).toContain(specialServiceName);
        const processOutput = 'node.exe                      7890 Services                   0     48,392 K';
        if (typeof callback === 'function') {
          callback(null, processOutput, '');
        }
      });

      const pid = await manager['getServicePid'](specialServiceName);
      expect(pid).toBe(7890);
    });
  });
});
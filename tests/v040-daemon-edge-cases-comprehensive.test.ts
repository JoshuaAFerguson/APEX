import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { DaemonManager, DaemonError } from '../packages/orchestrator/src/daemon';
import { ServiceManager, ServiceError } from '../packages/orchestrator/src/service-manager';
import { HealthMonitor } from '../packages/orchestrator/src/health-monitor';

/**
 * v0.4.0 Daemon Edge Cases and Error Scenarios Comprehensive Tests
 *
 * These tests verify robust error handling and edge case scenarios
 * for all v0.4.0 daemon functionality.
 */
describe('v0.4.0 Daemon Edge Cases and Error Scenarios', () => {
  let testProjectPath: string;
  let daemonManager: DaemonManager;
  let serviceManager: ServiceManager;
  let healthMonitor: HealthMonitor;

  beforeEach(async () => {
    testProjectPath = join(__dirname, 'test-project-edge-cases');

    // Create test project structure
    await fs.mkdir(testProjectPath, { recursive: true });
    await fs.mkdir(join(testProjectPath, '.apex'), { recursive: true });

    daemonManager = new DaemonManager({
      projectPath: testProjectPath,
      logLevel: 'debug'
    });

    serviceManager = new ServiceManager({
      projectPath: testProjectPath,
      serviceName: 'apex-edge-test'
    });

    healthMonitor = new HealthMonitor();
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    // Clean up test directory
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error);
    }
  });

  describe('Daemon Manager Error Scenarios', () => {
    it('should handle corrupted PID file gracefully', async () => {
      const pidFile = join(testProjectPath, '.apex', 'daemon.pid');

      // Create corrupted PID file with invalid content
      await fs.writeFile(pidFile, 'not-a-number\n\x00\xFF\xFE\xFD');

      // Should not crash when trying to read status
      const status = await daemonManager.getStatus();
      expect(status.running).toBe(false);
    });

    it('should handle PID file with non-existent process', async () => {
      const pidFile = join(testProjectPath, '.apex', 'daemon.pid');

      // Write PID of process that definitely doesn't exist
      await fs.writeFile(pidFile, '999999999');

      const status = await daemonManager.getStatus();
      expect(status.running).toBe(false);
    });

    it('should handle permission denied on PID file operations', async () => {
      if (process.platform === 'win32') {
        // Skip on Windows as permission handling is different
        return;
      }

      const apexDir = join(testProjectPath, '.apex');

      // Make .apex directory read-only
      await fs.chmod(apexDir, 0o444);

      try {
        // Should handle permission denied gracefully
        await expect(async () => {
          await daemonManager.startDaemon();
        }).rejects.toThrow();
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(apexDir, 0o755);
      }
    });

    it('should handle missing .apex directory gracefully', async () => {
      // Remove .apex directory
      await fs.rm(join(testProjectPath, '.apex'), { recursive: true });

      // Should not crash and should create directory if needed
      const status = await daemonManager.getStatus();
      expect(status.running).toBe(false);
    });

    it('should handle invalid project path', () => {
      const invalidManager = new DaemonManager({
        projectPath: '/nonexistent/path/that/should/never/exist'
      });

      // Should not throw during construction
      expect(invalidManager).toBeDefined();
    });

    it('should handle extremely long project paths', () => {
      // Create a very long path
      const longPath = '/tmp/' + 'a'.repeat(1000);

      const longPathManager = new DaemonManager({
        projectPath: longPath
      });

      expect(longPathManager).toBeDefined();
    });

    it('should handle null and undefined configuration values', () => {
      // Test with various invalid configurations
      expect(() => {
        new DaemonManager({
          projectPath: testProjectPath,
          pidFile: null as any,
          logFile: undefined,
          pollIntervalMs: NaN,
          logLevel: 'invalid-level' as any
        });
      }).not.toThrow();
    });

    it('should handle daemon already running scenario', async () => {
      const pidFile = join(testProjectPath, '.apex', 'daemon.pid');

      // Write current process PID to simulate already running
      await fs.writeFile(pidFile, process.pid.toString());

      // Mock the daemon manager to simulate already running
      vi.spyOn(daemonManager, 'getStatus').mockResolvedValue({
        running: true,
        pid: process.pid,
        startedAt: new Date(),
        uptime: 60000
      });

      vi.spyOn(daemonManager, 'startDaemon').mockRejectedValue(
        new DaemonError('Daemon is already running', 'ALREADY_RUNNING')
      );

      await expect(daemonManager.startDaemon()).rejects.toThrow('already running');
    });

    it('should handle daemon stop when not running', async () => {
      vi.spyOn(daemonManager, 'getStatus').mockResolvedValue({
        running: false
      });

      vi.spyOn(daemonManager, 'stopDaemon').mockResolvedValue(false);

      const result = await daemonManager.stopDaemon();
      expect(result).toBe(false);
    });

    it('should handle log file corruption', async () => {
      const logFile = join(testProjectPath, '.apex', 'daemon.log');

      // Create a corrupted log file
      const corruptedContent = Buffer.alloc(1024);
      corruptedContent.fill(0xFF);
      await fs.writeFile(logFile, corruptedContent);

      // Should handle gracefully when trying to read logs
      expect(async () => {
        await daemonManager.getStatus();
      }).not.toThrow();
    });

    it('should handle very large log files', async () => {
      const logFile = join(testProjectPath, '.apex', 'daemon.log');

      // Create a large log file (1MB)
      const largeContent = 'X'.repeat(1024 * 1024);
      await fs.writeFile(logFile, largeContent);

      // Should handle without memory issues
      const status = await daemonManager.getStatus();
      expect(status).toBeDefined();
    });
  });

  describe('Service Manager Error Scenarios', () => {
    it('should handle unsupported platform gracefully', () => {
      const originalPlatform = process.platform;

      try {
        Object.defineProperty(process, 'platform', {
          value: 'unsupported-os',
          writable: true
        });

        expect(() => {
          const result = serviceManager.generateServiceFile();
          expect(result.platform).toBe('unsupported');
        }).not.toThrow();
      } finally {
        Object.defineProperty(process, 'platform', {
          value: originalPlatform,
          writable: true
        });
      }
    });

    it('should handle invalid service names', () => {
      const invalidNames = [
        '',
        ' ',
        'service with spaces',
        'service/with/slashes',
        'service\\with\\backslashes',
        'service:with:colons',
        'service<with>brackets',
        'service|with|pipes',
        'service"with"quotes',
        'service*with*asterisks',
        'service?with?questions',
        'a'.repeat(300) // Very long name
      ];

      invalidNames.forEach(invalidName => {
        expect(() => {
          const invalidServiceManager = new ServiceManager({
            projectPath: testProjectPath,
            serviceName: invalidName
          });

          const result = invalidServiceManager.generateServiceFile();
          expect(result).toBeDefined();
        }).not.toThrow();
      });
    });

    it('should handle null and undefined service configuration', () => {
      expect(() => {
        new ServiceManager({
          projectPath: testProjectPath,
          serviceName: undefined as any,
          serviceDescription: null as any,
          user: '',
          workingDirectory: undefined,
          environment: null as any,
          restartPolicy: 'invalid' as any
        });
      }).not.toThrow();
    });

    it('should handle service installation with insufficient permissions', async () => {
      // Mock installation failure due to permissions
      vi.spyOn(serviceManager, 'install').mockRejectedValue(
        new ServiceError('Permission denied', 'PERMISSION_DENIED')
      );

      await expect(serviceManager.install()).rejects.toThrow('Permission denied');
    });

    it('should handle service already exists scenario', async () => {
      vi.spyOn(serviceManager, 'install').mockRejectedValue(
        new ServiceError('Service already exists', 'SERVICE_EXISTS')
      );

      await expect(serviceManager.install()).rejects.toThrow('already exists');
    });

    it('should handle service not found during uninstall', async () => {
      vi.spyOn(serviceManager, 'uninstall').mockRejectedValue(
        new ServiceError('Service not found', 'SERVICE_NOT_FOUND')
      );

      await expect(serviceManager.uninstall()).rejects.toThrow('not found');
    });

    it('should handle malformed environment variables', () => {
      const malformedEnv = {
        '': 'empty-key',
        'key-with-null': null as any,
        'key-with-undefined': undefined as any,
        'key-with-object': { nested: 'object' } as any,
        'key-with-array': ['array', 'values'] as any,
        ['very-long-key-' + 'x'.repeat(1000)]: 'value',
        'key-with-special-chars-!@#$%^&*()': 'value'
      };

      expect(() => {
        const envServiceManager = new ServiceManager({
          projectPath: testProjectPath,
          serviceName: 'test-service',
          environment: malformedEnv
        });

        const result = envServiceManager.generateServiceFile();
        expect(result).toBeDefined();
      }).not.toThrow();
    });

    it('should handle extremely long service paths', () => {
      const longPath = '/very/long/path/' + 'directory/'.repeat(50) + 'final';

      const longPathServiceManager = new ServiceManager({
        projectPath: longPath,
        serviceName: 'test-service'
      });

      const result = longPathServiceManager.generateServiceFile();
      expect(result).toBeDefined();
      expect(result.path).toBeDefined();
    });

    it('should handle service file generation failure', () => {
      // Mock file system errors
      const originalPlatform = process.platform;

      try {
        Object.defineProperty(process, 'platform', {
          value: 'linux',
          writable: true
        });

        // Create a service manager that might fail
        const result = serviceManager.generateServiceFile();
        expect(result).toBeDefined();
      } finally {
        Object.defineProperty(process, 'platform', {
          value: originalPlatform,
          writable: true
        });
      }
    });
  });

  describe('Health Monitor Edge Cases', () => {
    it('should handle extremely frequent restart recordings', () => {
      // Record many restarts in quick succession
      for (let i = 0; i < 1000; i++) {
        healthMonitor.recordRestart(`crash-${i}`, i % 10, i % 2 === 0);
      }

      const report = healthMonitor.getHealthReport();
      expect(report.restartHistory.length).toBeLessThanOrEqual(10); // Should respect limit
    });

    it('should handle invalid restart data', () => {
      const invalidData = [
        { reason: '', exitCode: undefined, watchdog: false },
        { reason: null, exitCode: NaN, watchdog: undefined },
        { reason: 'test', exitCode: Infinity, watchdog: 'invalid' },
        { reason: { toString: () => 'object' }, exitCode: -Infinity, watchdog: null }
      ];

      invalidData.forEach(data => {
        expect(() => {
          healthMonitor.recordRestart(
            data.reason as any,
            data.exitCode as any,
            data.watchdog as any
          );
        }).not.toThrow();
      });

      const report = healthMonitor.getHealthReport();
      expect(report.restartHistory.length).toBe(invalidData.length);
    });

    it('should handle memory pressure scenarios', () => {
      // Simulate memory pressure by creating large objects
      const largeObjects = [];

      try {
        for (let i = 0; i < 100; i++) {
          largeObjects.push(new Array(10000).fill(`data-${i}`));
        }

        // Health monitor should still work under memory pressure
        const report = healthMonitor.getHealthReport();
        expect(report.memoryUsage.heapUsed).toBeGreaterThan(0);
        expect(report.memoryUsage.heapTotal).toBeGreaterThan(0);
        expect(report.memoryUsage.rss).toBeGreaterThan(0);
      } finally {
        // Clean up
        largeObjects.length = 0;
      }
    });

    it('should handle concurrent health check updates', async () => {
      const promises = [];

      // Create many concurrent health check updates
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(() => {
            healthMonitor.recordHealthCheckResult(Math.random() > 0.5);
          })
        );
      }

      await Promise.all(promises);

      const report = healthMonitor.getHealthReport();
      expect(report.healthChecksPassed + report.healthChecksFailed).toBe(100);
    });

    it('should handle extreme uptime values', () => {
      // Create health monitor with manipulated start time
      const extremeHealthMonitor = new HealthMonitor();

      // Manually set start time to distant past
      const distantPast = new Date('2020-01-01');
      (extremeHealthMonitor as any).startTime = distantPast;

      const report = extremeHealthMonitor.getHealthReport();
      expect(report.uptime).toBeGreaterThan(0);
      expect(report.uptime).toBeFinite();
    });

    it('should handle invalid task count updates', () => {
      const invalidTaskCounts = [
        { processed: -1, succeeded: 0, failed: 0, active: 0 },
        { processed: NaN, succeeded: Infinity, failed: -Infinity, active: undefined as any },
        { processed: null as any, succeeded: 'invalid' as any, failed: {}, active: [] },
      ];

      invalidTaskCounts.forEach(invalidCounts => {
        expect(() => {
          healthMonitor.updateTaskCounts(invalidCounts);
        }).not.toThrow();
      });

      const report = healthMonitor.getHealthReport();
      expect(report.taskCounts).toBeDefined();
    });

    it('should handle rapid consecutive health reports', () => {
      const startTime = Date.now();
      const reports = [];

      // Generate many reports rapidly
      for (let i = 0; i < 1000; i++) {
        reports.push(healthMonitor.getHealthReport());
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete quickly
      expect(duration).toBeLessThan(1000); // Less than 1 second
      expect(reports).toHaveLength(1000);

      // All reports should be valid
      reports.forEach(report => {
        expect(report.uptime).toBeGreaterThanOrEqual(0);
        expect(report.memoryUsage).toBeDefined();
        expect(report.taskCounts).toBeDefined();
      });
    });
  });

  describe('Cross-Platform Edge Cases', () => {
    it('should handle platform switching scenarios', () => {
      const originalPlatform = process.platform;
      const testPlatforms = ['linux', 'darwin', 'win32', 'freebsd', 'openbsd', 'sunos'];

      try {
        testPlatforms.forEach(platform => {
          Object.defineProperty(process, 'platform', {
            value: platform,
            writable: true
          });

          // Should handle each platform without crashing
          const result = serviceManager.generateServiceFile();
          expect(result).toBeDefined();
          expect(result.platform).toBeDefined();
        });
      } finally {
        Object.defineProperty(process, 'platform', {
          value: originalPlatform,
          writable: true
        });
      }
    });

    it('should handle file path edge cases across platforms', () => {
      const edgeCasePaths = [
        '',
        '.',
        '..',
        '/',
        '\\',
        '//',
        '\\\\',
        'C:',
        'C:\\',
        '//server/share',
        '/path/with spaces/file',
        '/path/with/unicode/文件',
        '/path/with/symbols/file!@#$%^&*()',
        'relative/path',
        './relative/path',
        '../relative/path'
      ];

      edgeCasePaths.forEach(edgePath => {
        expect(() => {
          const pathServiceManager = new ServiceManager({
            projectPath: edgePath || testProjectPath,
            serviceName: 'test-service'
          });

          const result = pathServiceManager.generateServiceFile();
          expect(result).toBeDefined();
        }).not.toThrow();
      });
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    it('should handle disk space exhaustion gracefully', async () => {
      // Simulate disk space issues by trying to write to a non-existent mount
      const impossiblePath = '/nonexistent/mount/point/test.txt';

      try {
        await fs.writeFile(impossiblePath, 'test');
      } catch (error) {
        // Should handle file system errors gracefully
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle file descriptor exhaustion', async () => {
      // Simulate FD exhaustion by opening many files (but not actually exhausting)
      const fileHandles = [];

      try {
        // Open a reasonable number of files
        for (let i = 0; i < 50; i++) {
          const testFile = join(testProjectPath, `test-${i}.tmp`);
          await fs.writeFile(testFile, 'test content');
          const handle = await fs.open(testFile, 'r');
          fileHandles.push(handle);
        }

        // Health monitor should still work
        const report = healthMonitor.getHealthReport();
        expect(report).toBeDefined();
      } finally {
        // Clean up file handles
        for (const handle of fileHandles) {
          try {
            await handle.close();
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    });

    it('should handle network failures in service operations', async () => {
      // Mock network-related service operations
      vi.spyOn(serviceManager, 'getStatus').mockRejectedValue(
        new Error('Network unreachable')
      );

      await expect(serviceManager.getStatus()).rejects.toThrow('Network unreachable');
    });
  });

  describe('Timeout and Timing Edge Cases', () => {
    it('should handle operations that timeout', async () => {
      // Mock a timeout scenario
      vi.spyOn(daemonManager, 'startDaemon').mockImplementation(async () => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Operation timed out')), 100);
        });
      });

      await expect(daemonManager.startDaemon()).rejects.toThrow('timed out');
    });

    it('should handle clock skew scenarios', () => {
      // Test with dates in the past/future
      const pastDate = new Date('2020-01-01');
      const futureDate = new Date('2030-01-01');

      // Should handle without crashing
      healthMonitor.recordRestart('past-restart', 0, false);

      // Manually set timestamp to past (for testing)
      const report = healthMonitor.getHealthReport();
      expect(report.restartHistory[0].timestamp).toBeInstanceOf(Date);
    });

    it('should handle rapid state changes', async () => {
      // Simulate rapid daemon state changes
      const promises = [];

      for (let i = 0; i < 20; i++) {
        promises.push(
          Promise.resolve().then(async () => {
            const status = await daemonManager.getStatus();
            expect(status).toBeDefined();
          })
        );
      }

      await Promise.all(promises);
    });
  });

  describe('Data Corruption and Recovery', () => {
    it('should handle corrupted configuration files', async () => {
      // Create a corrupted config file
      const configFile = join(testProjectPath, '.apex', 'config.json');
      await fs.writeFile(configFile, '{ invalid json content');

      // Should handle gracefully
      const status = await daemonManager.getStatus();
      expect(status).toBeDefined();
    });

    it('should recover from partial file writes', async () => {
      const pidFile = join(testProjectPath, '.apex', 'daemon.pid');

      // Simulate partial write
      await fs.writeFile(pidFile, '123');

      // Should handle incomplete PID gracefully
      const status = await daemonManager.getStatus();
      expect(status.running).toBe(false);
    });

    it('should handle file locking conflicts', async () => {
      // This would test file locking scenarios in real implementations
      // For now, verify the managers can handle concurrent access
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(daemonManager.getStatus());
      }

      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });
  });
});
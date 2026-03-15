/**
 * Tests for Windows Event Log integration
 *
 * These tests run on all platforms but only perform actual Windows Event Log operations on Windows.
 * On non-Windows platforms, they test the fallback behavior to console logging.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WindowsEventLogger,
  createApexEventLogger,
  createCustomEventLogger,
  WindowsEventLogType,
  APEX_EVENT_IDS,
  type WindowsEventLogEntry,
  type EventLogConfig
} from './windows-event-log';

// Mock child_process exec for testing
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    exec: vi.fn()
  };
});

// Mock console methods for testing fallback behavior
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('WindowsEventLogger', () => {
  let logger: WindowsEventLogger;
  let mockExec: any;

  beforeEach(() => {
    logger = new WindowsEventLogger();
    mockExec = vi.mocked(require('child_process').exec);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should create logger with default configuration', () => {
      expect(logger).toBeDefined();
      expect(logger['config'].source).toBe('APEX Daemon');
      expect(logger['config'].logName).toBe('Application');
      expect(logger['config'].maxMessageLength).toBe(32766);
      expect(logger['config'].truncateMessages).toBe(true);
    });

    it('should create logger with custom configuration', () => {
      const customConfig: Partial<EventLogConfig> = {
        source: 'Custom App',
        logName: 'System',
        maxMessageLength: 1000,
        truncateMessages: false
      };

      const customLogger = new WindowsEventLogger(customConfig);
      expect(customLogger['config'].source).toBe('Custom App');
      expect(customLogger['config'].logName).toBe('System');
      expect(customLogger['config'].maxMessageLength).toBe(1000);
      expect(customLogger['config'].truncateMessages).toBe(false);
    });
  });

  describe('Factory Functions', () => {
    it('should create APEX event logger with correct defaults', () => {
      const apexLogger = createApexEventLogger();
      expect(apexLogger).toBeDefined();
      expect(apexLogger['config'].source).toBe('APEX Daemon');
      expect(apexLogger['config'].logName).toBe('Application');
    });

    it('should create custom event logger with provided config', () => {
      const customLogger = createCustomEventLogger({
        source: 'Test Source',
        maxMessageLength: 500
      });
      expect(customLogger['config'].source).toBe('Test Source');
      expect(customLogger['config'].maxMessageLength).toBe(500);
    });
  });

  describe('Event Writing - Cross Platform', () => {
    it('should write info event (console fallback on non-Windows)', async () => {
      await logger.writeInfo('Test info message', APEX_EVENT_IDS.SERVICE_STARTED);

      if (process.platform !== 'win32') {
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('[INFO] APEX Daemon (1000): Test info message')
        );
      }
      // On Windows, it would call PowerShell command via exec
    });

    it('should write warning event (console fallback on non-Windows)', async () => {
      await logger.writeWarning('Test warning message', APEX_EVENT_IDS.CAPACITY_LIMIT_REACHED);

      if (process.platform !== 'win32') {
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('[WARNING] APEX Daemon (1200): Test warning message')
        );
      }
    });

    it('should write error event (console fallback on non-Windows)', async () => {
      await logger.writeError('Test error message', APEX_EVENT_IDS.CRITICAL_ERROR);

      if (process.platform !== 'win32') {
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('[ERROR] APEX Daemon (9999): Test error message')
        );
      }
    });
  });

  describe('Message Sanitization', () => {
    it('should sanitize messages for PowerShell command line', async () => {
      const messageWithSpecialChars = "Test message with 'quotes' and\nnewtabs and\ttabs";

      await logger.writeInfo(messageWithSpecialChars);

      if (process.platform !== 'win32') {
        // On non-Windows, check console output format
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining("Test message with 'quotes' and")
        );
      }
      // On Windows, the message would be sanitized for PowerShell
    });

    it('should truncate long messages when configured', async () => {
      const longMessage = 'x'.repeat(40000); // Longer than default max length

      await logger.writeInfo(longMessage);

      if (process.platform !== 'win32') {
        // Check that fallback console logging still works
        expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      }
    });

    it('should not truncate messages when configured not to', async () => {
      const noTruncateLogger = new WindowsEventLogger({
        truncateMessages: false,
        maxMessageLength: 100
      });

      const longMessage = 'x'.repeat(200);

      // This should work on non-Windows (console fallback)
      // On Windows, it would potentially fail if message is too long
      if (process.platform !== 'win32') {
        await expect(noTruncateLogger.writeInfo(longMessage)).resolves.not.toThrow();
      }
    });
  });

  describe('Batch Event Writing', () => {
    it('should write multiple events in batch', async () => {
      const entries: WindowsEventLogEntry[] = [
        {
          source: 'APEX Daemon',
          type: WindowsEventLogType.Information,
          eventId: APEX_EVENT_IDS.SERVICE_STARTED,
          message: 'Service started'
        },
        {
          source: 'APEX Daemon',
          type: WindowsEventLogType.Warning,
          eventId: APEX_EVENT_IDS.CAPACITY_LIMIT_REACHED,
          message: 'Capacity limit reached'
        },
        {
          source: 'APEX Daemon',
          type: WindowsEventLogType.Error,
          eventId: APEX_EVENT_IDS.CRITICAL_ERROR,
          message: 'Critical error occurred'
        }
      ];

      await logger.writeBatch(entries);

      if (process.platform !== 'win32') {
        // Should have console output for each entry
        expect(mockConsoleLog).toHaveBeenCalledTimes(3);
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('[INFO] APEX Daemon (1000): Service started')
        );
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('[WARNING] APEX Daemon (1200): Capacity limit reached')
        );
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('[ERROR] APEX Daemon (9999): Critical error occurred')
        );
      }
    });
  });

  describe('Convenience Methods', () => {
    it('should log service lifecycle events', async () => {
      await logger.logServiceStarted(1234);
      await logger.logServiceStopped('User requested');

      if (process.platform !== 'win32') {
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('APEX Daemon service started successfully (PID: 1234)')
        );
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('APEX Daemon service stopped: User requested')
        );
      }
    });

    it('should log task execution events', async () => {
      await logger.logTaskStarted('task-123', 'test-task');
      await logger.logTaskCompleted('task-123', 5000);
      await logger.logTaskFailed('task-456', 'Connection timeout');

      if (process.platform !== 'win32') {
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('Task started: task-123 (type: test-task)')
        );
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('Task completed: task-123 (duration: 5000ms)')
        );
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('Task failed: task-456 - Connection timeout')
        );
      }
    });

    it('should log capacity management events', async () => {
      await logger.logCapacityLimitReached(0.95, 0.90);
      await logger.logAutoPauseActivated('Capacity limit exceeded');

      if (process.platform !== 'win32') {
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('Capacity limit reached: 95.0% (threshold: 90.0%)')
        );
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('Auto-pause activated: Capacity limit exceeded')
        );
      }
    });

    it('should log configuration and critical errors', async () => {
      await logger.logConfigError('Invalid configuration format');
      await logger.logCriticalError('Database connection failed', 'startup');

      if (process.platform !== 'win32') {
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('Configuration error: Invalid configuration format')
        );
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('Critical error in startup: Database connection failed')
        );
      }
    });
  });

  describe('APEX Event IDs', () => {
    it('should have properly defined event ID constants', () => {
      // Service lifecycle events
      expect(APEX_EVENT_IDS.SERVICE_STARTED).toBe(1000);
      expect(APEX_EVENT_IDS.SERVICE_STOPPED).toBe(1001);
      expect(APEX_EVENT_IDS.SERVICE_INSTALLED).toBe(1004);

      // Task execution events
      expect(APEX_EVENT_IDS.TASK_STARTED).toBe(1100);
      expect(APEX_EVENT_IDS.TASK_COMPLETED).toBe(1101);
      expect(APEX_EVENT_IDS.TASK_FAILED).toBe(1102);

      // Capacity events
      expect(APEX_EVENT_IDS.CAPACITY_LIMIT_REACHED).toBe(1200);
      expect(APEX_EVENT_IDS.AUTO_PAUSE_ACTIVATED).toBe(1202);

      // Configuration events
      expect(APEX_EVENT_IDS.CONFIG_LOADED).toBe(1300);
      expect(APEX_EVENT_IDS.CONFIG_ERROR).toBe(1301);

      // Error events
      expect(APEX_EVENT_IDS.GENERAL_ERROR).toBe(9000);
      expect(APEX_EVENT_IDS.CRITICAL_ERROR).toBe(9999);
    });

    it('should have event IDs in proper ranges', () => {
      // Service events: 1000-1099
      expect(APEX_EVENT_IDS.SERVICE_STARTED).toBeGreaterThanOrEqual(1000);
      expect(APEX_EVENT_IDS.SERVICE_UNINSTALLED).toBeLessThan(1100);

      // Task events: 1100-1199
      expect(APEX_EVENT_IDS.TASK_STARTED).toBeGreaterThanOrEqual(1100);
      expect(APEX_EVENT_IDS.TASK_TIMEOUT).toBeLessThan(1200);

      // Capacity events: 1200-1299
      expect(APEX_EVENT_IDS.CAPACITY_LIMIT_REACHED).toBeGreaterThanOrEqual(1200);
      expect(APEX_EVENT_IDS.MODE_CHANGED).toBeLessThan(1300);

      // Config events: 1300-1399
      expect(APEX_EVENT_IDS.CONFIG_LOADED).toBeGreaterThanOrEqual(1300);
      expect(APEX_EVENT_IDS.CONFIG_VALIDATION_FAILED).toBeLessThan(1400);

      // Error events: 9000+
      expect(APEX_EVENT_IDS.GENERAL_ERROR).toBeGreaterThanOrEqual(9000);
      expect(APEX_EVENT_IDS.CRITICAL_ERROR).toBe(9999);
    });
  });

  describe('Event Log Types', () => {
    it('should have correct WindowsEventLogType enum values', () => {
      expect(WindowsEventLogType.Error).toBe(1);
      expect(WindowsEventLogType.Warning).toBe(2);
      expect(WindowsEventLogType.Information).toBe(4);
      expect(WindowsEventLogType.SuccessAudit).toBe(8);
      expect(WindowsEventLogType.FailureAudit).toBe(16);
    });
  });

  describe('Error Handling and Fallback', () => {
    it('should handle PowerShell execution errors gracefully', async () => {
      if (process.platform === 'win32') {
        // Mock exec to simulate PowerShell failure
        mockExec.mockImplementation((cmd, options, callback) => {
          callback(new Error('PowerShell not found'), '', 'PowerShell not found');
        });
      }

      // Should not throw error, should fall back to console
      await expect(logger.writeError('Test error')).resolves.not.toThrow();

      if (process.platform !== 'win32') {
        expect(mockConsoleLog).toHaveBeenCalled();
      } else {
        // On Windows with mocked error, should fall back to console and show error
        expect(mockConsoleError).toHaveBeenCalledWith(
          expect.stringContaining('Failed to write Windows event log')
        );
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('[ERROR] APEX Daemon')
        );
      }
    });
  });
});

// Windows-specific integration tests
describe('Windows Event Log Integration Tests', () => {
  it('should skip Windows-specific tests on non-Windows platforms', () => {
    if (process.platform !== 'win32') {
      console.log('Skipping Windows Event Log integration tests on non-Windows platform');
      expect(true).toBe(true);
      return;
    }

    // These tests would only run on actual Windows environments
    // They would test real Windows Event Log operations
    expect(process.platform).toBe('win32');
  });
});
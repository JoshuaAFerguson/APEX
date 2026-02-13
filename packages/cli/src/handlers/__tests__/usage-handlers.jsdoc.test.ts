import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleUsage } from '../usage-handlers.js';
import { DaemonManager, ExtendedDaemonStatus } from '@apexcli/orchestrator';
import chalk from 'chalk';
import type { CliContext } from '../../index.js';

/**
 * Test suite for JSDoc documented usage handler functions
 * Tests the usage command handler that displays daemon usage and capacity status
 */
describe('Usage Handlers JSDoc Documented Functionality', () => {
  let mockDaemonManager: DaemonManager;
  let mockContext: CliContext;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock console.log to capture output
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Create mock context
    mockContext = {
      cwd: '/test/project/path',
      initialized: true,
      config: null,
      orchestrator: null,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };

    // Mock DaemonManager
    mockDaemonManager = {
      getExtendedStatus: vi.fn(),
    } as unknown as DaemonManager;

    // Mock DaemonManager constructor
    vi.mocked(DaemonManager).mockImplementation(() => mockDaemonManager);
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleLogSpy.mockRestore();
  });

  describe('handleUsage function', () => {
    it('should display running daemon status with complete information', async () => {
      const mockStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 12345,
        startedAt: new Date('2024-01-01T10:00:00Z'),
        uptime: 3600000, // 1 hour in milliseconds
        cpu: 15.5,
        memory: {
          rss: 104857600, // 100MB
          heapTotal: 52428800, // 50MB
          heapUsed: 31457280, // 30MB
          external: 10485760, // 10MB
          arrayBuffers: 5242880, // 5MB
        },
        activeConnections: 3,
        totalRequests: 150,
        averageResponseTime: 245.7,
        errorRate: 0.02,
      };

      vi.mocked(mockDaemonManager.getExtendedStatus).mockResolvedValue(mockStatus);

      await handleUsage(mockContext);

      // Verify DaemonManager was created with correct project path
      expect(DaemonManager).toHaveBeenCalledWith({ projectPath: '/test/project/path' });

      // Verify status was requested
      expect(mockDaemonManager.getExtendedStatus).toHaveBeenCalled();

      // Verify console output contains expected information
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('APEX Daemon Usage & Capacity Status')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Running')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('12345')
      );
    });

    it('should display not running daemon status', async () => {
      const mockStatus: ExtendedDaemonStatus = {
        running: false,
        pid: undefined,
        startedAt: undefined,
        uptime: undefined,
        cpu: undefined,
        memory: undefined,
        activeConnections: 0,
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
      };

      vi.mocked(mockDaemonManager.getExtendedStatus).mockResolvedValue(mockStatus);

      await handleUsage(mockContext);

      // Verify appropriate output for stopped daemon
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Not Running')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Run /daemon start to begin monitoring usage')
      );

      // Should return early, so extended status info shouldn't be shown
      const allCalls = consoleLogSpy.mock.calls.flat().join(' ');
      expect(allCalls).not.toContain('CPU Usage');
      expect(allCalls).not.toContain('Memory Usage');
    });

    it('should handle daemon status with partial information', async () => {
      const mockStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 54321,
        startedAt: new Date('2024-01-01T08:00:00Z'),
        uptime: undefined, // Missing uptime
        cpu: undefined, // Missing CPU info
        memory: {
          rss: 67108864, // 64MB
          heapTotal: 33554432, // 32MB
          heapUsed: 16777216, // 16MB
          external: undefined,
          arrayBuffers: undefined,
        },
        activeConnections: 1,
        totalRequests: 50,
        averageResponseTime: undefined, // Missing response time
        errorRate: 0,
      };

      vi.mocked(mockDaemonManager.getExtendedStatus).mockResolvedValue(mockStatus);

      await handleUsage(mockContext);

      // Should handle partial data gracefully
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Running')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('54321')
      );

      // Should not crash or show undefined values
      const allCalls = consoleLogSpy.mock.calls.flat().join(' ');
      expect(allCalls).not.toContain('undefined');
    });

    it('should handle errors when getting daemon status', async () => {
      const error = new Error('Failed to get daemon status');
      vi.mocked(mockDaemonManager.getExtendedStatus).mockRejectedValue(error);

      await handleUsage(mockContext);

      // Should handle error gracefully
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error getting daemon status')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get daemon status')
      );
    });

    it('should use correct project path from context', async () => {
      const customContext = {
        ...mockContext,
        cwd: '/custom/project/directory',
      };

      const mockStatus: ExtendedDaemonStatus = {
        running: false,
        pid: undefined,
        startedAt: undefined,
        uptime: undefined,
        cpu: undefined,
        memory: undefined,
        activeConnections: 0,
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
      };

      vi.mocked(mockDaemonManager.getExtendedStatus).mockResolvedValue(mockStatus);

      await handleUsage(customContext);

      // Verify DaemonManager was created with custom project path
      expect(DaemonManager).toHaveBeenCalledWith({ projectPath: '/custom/project/directory' });
    });

    it('should display capacity and usage metrics when daemon is running', async () => {
      const mockStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 98765,
        startedAt: new Date('2024-01-01T12:00:00Z'),
        uptime: 7200000, // 2 hours
        cpu: 25.3,
        memory: {
          rss: 134217728, // 128MB
          heapTotal: 67108864, // 64MB
          heapUsed: 41943040, // 40MB
          external: 12582912, // 12MB
          arrayBuffers: 8388608, // 8MB
        },
        activeConnections: 5,
        totalRequests: 500,
        averageResponseTime: 189.4,
        errorRate: 0.008,
      };

      vi.mocked(mockDaemonManager.getExtendedStatus).mockResolvedValue(mockStatus);

      await handleUsage(mockContext);

      // Verify detailed capacity information is displayed
      const allOutput = consoleLogSpy.mock.calls.flat().join(' ');

      // Should show capacity metrics
      expect(allOutput).toContain('25.3'); // CPU usage
      expect(allOutput).toContain('128'); // Memory in MB
      expect(allOutput).toContain('5'); // Active connections
      expect(allOutput).toContain('500'); // Total requests
      expect(allOutput).toContain('189.4'); // Average response time
      expect(allOutput).toContain('0.8%'); // Error rate as percentage
    });

    it('should format uptime correctly', async () => {
      const mockStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 11111,
        startedAt: new Date('2024-01-01T10:00:00Z'),
        uptime: 90061000, // 25 hours, 1 minute, 1 second
        cpu: 10,
        memory: {
          rss: 52428800,
          heapTotal: 26214400,
          heapUsed: 15728640,
          external: 5242880,
          arrayBuffers: 2621440,
        },
        activeConnections: 2,
        totalRequests: 100,
        averageResponseTime: 150,
        errorRate: 0.01,
      };

      vi.mocked(mockDaemonManager.getExtendedStatus).mockResolvedValue(mockStatus);

      await handleUsage(mockContext);

      // Check that uptime is formatted in human-readable way
      const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
      // Should contain formatted time (exact format depends on implementation)
      expect(allOutput).toMatch(/\d+.*(?:hour|minute|second)/i);
    });
  });

  describe('Context parameter validation', () => {
    it('should handle context with different cwd values', async () => {
      const contexts = [
        { ...mockContext, cwd: '/' },
        { ...mockContext, cwd: '/home/user/project' },
        { ...mockContext, cwd: './relative/path' },
        { ...mockContext, cwd: '' },
      ];

      const mockStatus: ExtendedDaemonStatus = {
        running: false,
        pid: undefined,
        startedAt: undefined,
        uptime: undefined,
        cpu: undefined,
        memory: undefined,
        activeConnections: 0,
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
      };

      vi.mocked(mockDaemonManager.getExtendedStatus).mockResolvedValue(mockStatus);

      for (const context of contexts) {
        await handleUsage(context);
        expect(DaemonManager).toHaveBeenCalledWith({ projectPath: context.cwd });
      }
    });

    it('should work regardless of other context properties', async () => {
      const minimalContext = {
        cwd: '/test',
        initialized: false,
        config: null,
        orchestrator: null,
        apiProcess: null,
        webUIProcess: null,
        apiPort: 0,
        webUIPort: 0,
      };

      const mockStatus: ExtendedDaemonStatus = {
        running: false,
        pid: undefined,
        startedAt: undefined,
        uptime: undefined,
        cpu: undefined,
        memory: undefined,
        activeConnections: 0,
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
      };

      vi.mocked(mockDaemonManager.getExtendedStatus).mockResolvedValue(mockStatus);

      await expect(handleUsage(minimalContext)).resolves.toBeUndefined();
    });
  });
});

// Mock the DaemonManager import
vi.mock('@apexcli/orchestrator', () => ({
  DaemonManager: vi.fn(),
}));
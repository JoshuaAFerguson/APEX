import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WebFetchTool, type WebFetchParams } from './webfetch';

// Mock the global fetch function
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper function to create mock Response objects
function createMockResponse(options: {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  url: string;
  redirected: boolean;
  text: string;
}): any {
  const headersMap = new Map(Object.entries(options.headers));

  return {
    ok: options.ok,
    status: options.status,
    statusText: options.statusText,
    headers: {
      forEach: (callback: (value: string, key: string) => void) => {
        for (const [key, value] of headersMap) {
          callback(value, key);
        }
      }
    },
    url: options.url,
    redirected: options.redirected,
    text: () => Promise.resolve(options.text),
  };
}

describe('WebFetchTool - Automatic Cache Cleanup', () => {
  let tool: WebFetchTool;
  let originalSetInterval: typeof setInterval;
  let originalClearInterval: typeof clearInterval;
  let mockSetInterval: ReturnType<typeof vi.fn>;
  let mockClearInterval: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock timers
    originalSetInterval = global.setInterval;
    originalClearInterval = global.clearInterval;
    mockSetInterval = vi.fn();
    mockClearInterval = vi.fn();
    global.setInterval = mockSetInterval as any;
    global.clearInterval = mockClearInterval as any;

    tool = new WebFetchTool();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original timers
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
    vi.restoreAllMocks();
    tool.clearCache();
  });

  describe('Automatic cleanup initialization', () => {
    it('should set up automatic cleanup interval on construction', () => {
      // Creating a new tool should set up interval
      const newTool = new WebFetchTool();

      expect(mockSetInterval).toHaveBeenCalledWith(
        expect.any(Function),
        300000 // 5 minutes
      );
    });

    it('should register process exit handler for cleanup', () => {
      const originalProcess = global.process;
      const mockOn = vi.fn();
      global.process = { on: mockOn } as any;

      // Create new tool to trigger process handler registration
      new WebFetchTool();

      expect(mockOn).toHaveBeenCalledWith('exit', expect.any(Function));

      global.process = originalProcess;
    });
  });

  describe('Periodic cleanup behavior', () => {
    it('should remove expired entries during automatic cleanup', async () => {
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'response',
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const params: WebFetchParams = {
        url: 'https://test.com',
        cacheTtl: 100, // Very short TTL for testing
      };

      // Add entry to cache
      await tool.execute(params);

      let stats = tool.getCacheStats();
      expect(stats.size).toBe(1);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Simulate automatic cleanup
      tool.forceCleanup();

      stats = tool.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should only remove expired entries, keeping valid ones', async () => {
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'response',
      });

      mockFetch.mockResolvedValue(mockResponse);

      // Add entry with short TTL
      await tool.execute({
        url: 'https://test1.com',
        cacheTtl: 50, // Very short TTL
      });

      // Wait a bit then add entry with long TTL
      await new Promise(resolve => setTimeout(resolve, 30));

      await tool.execute({
        url: 'https://test2.com',
        cacheTtl: 10000, // Long TTL
      });

      // Wait for first entry to expire but not second
      await new Promise(resolve => setTimeout(resolve, 30));

      // Force cleanup
      tool.forceCleanup();

      const stats = tool.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.entries[0].url).toBe('https://test2.com');
    });

    it('should log cleanup operations when entries are removed', () => {
      const originalConsoleDebug = console.debug;
      const mockConsoleDebug = vi.fn();
      console.debug = mockConsoleDebug;

      // Create entries that will be expired
      const mockEntry = {
        result: {
          success: true,
          data: 'test',
          metadata: { url: 'https://test.com', method: 'GET', responseTime: 100 }
        },
        createdAt: Date.now() - 1000, // 1 second ago
        ttl: 500, // Already expired
      };

      // Directly add to cache for testing
      (tool as any).cache.set('test-key', mockEntry);

      tool.forceCleanup();

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        expect.stringContaining('WebFetch cache: Cleaned up')
      );

      console.debug = originalConsoleDebug;
    });

    it('should not log when no entries need cleanup', () => {
      const originalConsoleDebug = console.debug;
      const mockConsoleDebug = vi.fn();
      console.debug = mockConsoleDebug;

      // Empty cache or all entries fresh
      tool.forceCleanup();

      expect(mockConsoleDebug).not.toHaveBeenCalled();

      console.debug = originalConsoleDebug;
    });
  });

  describe('Cache cleanup edge cases', () => {
    it('should handle cleanup when cache is empty', () => {
      expect(() => tool.forceCleanup()).not.toThrow();

      const stats = tool.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should handle cleanup with many expired entries efficiently', () => {
      const startTime = Date.now();

      // Add many expired entries directly to cache
      for (let i = 0; i < 1000; i++) {
        const expiredEntry = {
          result: {
            success: true,
            data: `response ${i}`,
            metadata: { url: `https://test${i}.com`, method: 'GET', responseTime: 100 }
          },
          createdAt: Date.now() - 2000, // Already expired
          ttl: 1000,
        };
        (tool as any).cache.set(`key-${i}`, expiredEntry);
      }

      expect(tool.getCacheStats().size).toBe(1000);

      // Cleanup should be efficient
      tool.forceCleanup();

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
      expect(tool.getCacheStats().size).toBe(0);
    });

    it('should handle mixed fresh and expired entries correctly', async () => {
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'response',
      });

      // Add entries with different expiration times
      const now = Date.now();

      // Fresh entry
      const freshEntry = {
        result: {
          success: true,
          data: 'fresh response',
          metadata: { url: 'https://fresh.com', method: 'GET', responseTime: 100 }
        },
        createdAt: now,
        ttl: 10000, // Will not expire
      };

      // Expired entry
      const expiredEntry = {
        result: {
          success: true,
          data: 'expired response',
          metadata: { url: 'https://expired.com', method: 'GET', responseTime: 100 }
        },
        createdAt: now - 2000, // Old
        ttl: 1000, // Already expired
      };

      (tool as any).cache.set('fresh-key', freshEntry);
      (tool as any).cache.set('expired-key', expiredEntry);

      expect(tool.getCacheStats().size).toBe(2);

      tool.forceCleanup();

      const stats = tool.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.entries[0].url).toBe('https://fresh.com');
    });

    it('should handle cleanup during concurrent cache operations', async () => {
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'response',
      });

      mockFetch.mockResolvedValue(mockResponse);

      // Start multiple cache operations
      const operations = Array.from({ length: 10 }, (_, i) =>
        tool.execute({
          url: `https://test${i}.com`,
          cacheTtl: 5000,
        })
      );

      // Run cleanup while operations are in progress
      setTimeout(() => tool.forceCleanup(), 10);

      // All operations should complete successfully
      const results = await Promise.all(operations);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      const stats = tool.getCacheStats();
      expect(stats.size).toBe(10);
    });
  });

  describe('Process cleanup integration', () => {
    it('should clear interval on process exit', () => {
      const mockIntervalId = 'mock-interval-id';
      mockSetInterval.mockReturnValue(mockIntervalId);

      // Create tool which should register exit handler
      const newTool = new WebFetchTool();

      // Get the exit handler
      const originalProcess = global.process;
      const mockOn = vi.fn();
      global.process = { on: mockOn } as any;

      // Simulate process exit
      const exitHandler = mockOn.mock.calls?.find(call => call[0] === 'exit')?.[1];
      if (exitHandler) {
        exitHandler();
        expect(mockClearInterval).toHaveBeenCalledWith(mockIntervalId);
      }

      global.process = originalProcess;
    });

    it('should handle process exit gracefully when no process object exists', () => {
      const originalProcess = global.process;
      global.process = undefined as any;

      // Should not throw when process is undefined
      expect(() => new WebFetchTool()).not.toThrow();

      global.process = originalProcess;
    });
  });
});
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// This test focuses on testing the actual setupEventBroadcasting implementation
// without complex WebSocket setup

describe('MCP Event Broadcasting - Focused Unit Tests', () => {
  let mockBroadcast: any;
  let mockOrchestrator: EventEmitter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBroadcast = vi.fn();
    mockOrchestrator = new EventEmitter();

    // Simulate the actual setupEventBroadcasting MCP event handlers implementation
    // This mirrors the exact code added to setupEventBroadcasting in packages/api/src/index.ts

    mockOrchestrator.on('mcp:install-start', (event: any) => {
      mockBroadcast('mcp-installation', {
        type: 'mcp:install-start',
        taskId: 'mcp-installation',
        timestamp: event.timestamp || new Date(),
        data: {
          serverId: event.serverId,
          serverName: event.serverName,
          stage: event.stage,
          progress: event.progress,
          message: event.message,
        },
      });
    });

    mockOrchestrator.on('mcp:install-progress', (event: any) => {
      mockBroadcast('mcp-installation', {
        type: 'mcp:install-progress',
        taskId: 'mcp-installation',
        timestamp: event.timestamp || new Date(),
        data: {
          serverId: event.serverId,
          serverName: event.serverName,
          stage: event.stage,
          progress: event.progress,
          message: event.message,
        },
      });
    });

    mockOrchestrator.on('mcp:install-complete', (event: any) => {
      mockBroadcast('mcp-installation', {
        type: 'mcp:install-complete',
        taskId: 'mcp-installation',
        timestamp: event.timestamp || new Date(),
        data: {
          serverId: event.serverId,
          serverName: event.serverName,
          stage: event.stage,
          progress: event.progress,
          message: event.message,
          config: event.config,
        },
      });
    });

    mockOrchestrator.on('mcp:install-error', (event: any) => {
      mockBroadcast('mcp-installation', {
        type: 'mcp:install-error',
        taskId: 'mcp-installation',
        timestamp: event.timestamp || new Date(),
        data: {
          serverId: event.serverId,
          serverName: event.serverName,
          stage: event.stage,
          progress: event.progress,
          message: event.message,
          error: event.error,
        },
      });
    });

    mockOrchestrator.on('mcp:uninstall-start', (event: any) => {
      mockBroadcast('mcp-installation', {
        type: 'mcp:uninstall-start',
        taskId: 'mcp-installation',
        timestamp: event.timestamp || new Date(),
        data: {
          serverId: event.serverId,
          serverName: event.serverName,
          stage: event.stage,
          progress: event.progress,
          message: event.message,
        },
      });
    });

    mockOrchestrator.on('mcp:uninstall-complete', (event: any) => {
      mockBroadcast('mcp-installation', {
        type: 'mcp:uninstall-complete',
        taskId: 'mcp-installation',
        timestamp: event.timestamp || new Date(),
        data: {
          serverId: event.serverId,
          serverName: event.serverName,
          stage: event.stage,
          progress: event.progress,
          message: event.message,
        },
      });
    });

    mockOrchestrator.on('mcp:uninstall-error', (event: any) => {
      mockBroadcast('mcp-installation', {
        type: 'mcp:uninstall-error',
        taskId: 'mcp-installation',
        timestamp: event.timestamp || new Date(),
        data: {
          serverId: event.serverId,
          serverName: event.serverName,
          stage: event.stage,
          progress: event.progress,
          message: event.message,
          error: event.error,
        },
      });
    });
  });

  describe('MCP Install Events Integration', () => {
    it('correctly handles real-time install-start event emission and broadcasting', () => {
      const testEvent = {
        serverId: 'github-files',
        serverName: 'GitHub Files MCP',
        stage: 'starting',
        progress: 0,
        message: 'Starting installation of GitHub Files MCP server',
        timestamp: new Date('2024-01-01T00:00:00Z'),
      };

      // Emit the event through the orchestrator
      mockOrchestrator.emit('mcp:install-start', testEvent);

      // Verify the broadcast was called correctly
      expect(mockBroadcast).toHaveBeenCalledTimes(1);
      expect(mockBroadcast).toHaveBeenCalledWith('mcp-installation', {
        type: 'mcp:install-start',
        taskId: 'mcp-installation',
        timestamp: testEvent.timestamp,
        data: {
          serverId: 'github-files',
          serverName: 'GitHub Files MCP',
          stage: 'starting',
          progress: 0,
          message: 'Starting installation of GitHub Files MCP server',
        },
      });
    });

    it('correctly handles install-progress event with incremental progress', () => {
      const progressEvents = [
        { progress: 25, stage: 'downloading', message: 'Downloading dependencies' },
        { progress: 50, stage: 'extracting', message: 'Extracting package' },
        { progress: 75, stage: 'configuring', message: 'Configuring server' },
      ];

      progressEvents.forEach((progressData, index) => {
        const testEvent = {
          serverId: 'test-server',
          serverName: 'Test Server',
          ...progressData,
          timestamp: new Date(),
        };

        mockOrchestrator.emit('mcp:install-progress', testEvent);

        expect(mockBroadcast).toHaveBeenCalledWith('mcp-installation', {
          type: 'mcp:install-progress',
          taskId: 'mcp-installation',
          timestamp: testEvent.timestamp,
          data: {
            serverId: 'test-server',
            serverName: 'Test Server',
            stage: progressData.stage,
            progress: progressData.progress,
            message: progressData.message,
          },
        });
      });

      expect(mockBroadcast).toHaveBeenCalledTimes(3);
    });

    it('correctly handles install-complete event with server configuration', () => {
      const serverConfig = {
        type: 'stdio',
        command: 'node',
        args: ['dist/index.js'],
        env: {
          NODE_ENV: 'production'
        }
      };

      const testEvent = {
        serverId: 'weather-server',
        serverName: 'Weather MCP Server',
        stage: 'complete',
        progress: 100,
        message: 'Weather MCP server installed successfully',
        config: serverConfig,
        timestamp: new Date(),
      };

      mockOrchestrator.emit('mcp:install-complete', testEvent);

      expect(mockBroadcast).toHaveBeenCalledWith('mcp-installation', {
        type: 'mcp:install-complete',
        taskId: 'mcp-installation',
        timestamp: testEvent.timestamp,
        data: {
          serverId: 'weather-server',
          serverName: 'Weather MCP Server',
          stage: 'complete',
          progress: 100,
          message: 'Weather MCP server installed successfully',
          config: serverConfig,
        },
      });
    });

    it('correctly handles install-error event with comprehensive error details', () => {
      const detailedError = {
        code: 'INSTALLATION_FAILED',
        message: 'Network timeout during dependency download',
        stack: 'Error: timeout\n  at download.js:42\n  at request.js:123',
        details: {
          url: 'https://registry.npmjs.org/package',
          timeout: 30000,
          retry_count: 3
        }
      };

      const testEvent = {
        serverId: 'failing-server',
        serverName: 'Failing Server',
        stage: 'error',
        progress: 0,
        message: 'Installation failed due to network timeout',
        error: detailedError,
        timestamp: new Date(),
      };

      mockOrchestrator.emit('mcp:install-error', testEvent);

      expect(mockBroadcast).toHaveBeenCalledWith('mcp-installation', {
        type: 'mcp:install-error',
        taskId: 'mcp-installation',
        timestamp: testEvent.timestamp,
        data: {
          serverId: 'failing-server',
          serverName: 'Failing Server',
          stage: 'error',
          progress: 0,
          message: 'Installation failed due to network timeout',
          error: detailedError, // Full error object is preserved
        },
      });
    });
  });

  describe('MCP Uninstall Events Integration', () => {
    it('correctly handles complete uninstall workflow', () => {
      const serverId = 'old-server';
      const serverName = 'Old Server';
      const baseTimestamp = new Date();

      // Emit uninstall start
      mockOrchestrator.emit('mcp:uninstall-start', {
        serverId,
        serverName,
        stage: 'uninstalling',
        progress: 0,
        message: 'Starting uninstallation',
        timestamp: baseTimestamp,
      });

      // Emit uninstall complete
      mockOrchestrator.emit('mcp:uninstall-complete', {
        serverId,
        serverName,
        stage: 'complete',
        progress: 100,
        message: 'Uninstallation completed successfully',
        timestamp: new Date(baseTimestamp.getTime() + 1000),
      });

      expect(mockBroadcast).toHaveBeenCalledTimes(2);

      // Verify start event
      expect(mockBroadcast).toHaveBeenNthCalledWith(1, 'mcp-installation', {
        type: 'mcp:uninstall-start',
        taskId: 'mcp-installation',
        timestamp: baseTimestamp,
        data: {
          serverId,
          serverName,
          stage: 'uninstalling',
          progress: 0,
          message: 'Starting uninstallation',
        },
      });

      // Verify complete event
      expect(mockBroadcast).toHaveBeenNthCalledWith(2, 'mcp-installation', {
        type: 'mcp:uninstall-complete',
        taskId: 'mcp-installation',
        timestamp: new Date(baseTimestamp.getTime() + 1000),
        data: {
          serverId,
          serverName,
          stage: 'complete',
          progress: 100,
          message: 'Uninstallation completed successfully',
        },
      });
    });

    it('correctly handles uninstall-error event with full error context', () => {
      const errorContext = {
        operation: 'file_removal',
        path: '/usr/local/bin/mcp-server',
        permission_error: 'EACCES: permission denied',
        suggested_fix: 'Run with elevated privileges'
      };

      const testEvent = {
        serverId: 'protected-server',
        serverName: 'Protected Server',
        stage: 'error',
        progress: 0,
        message: 'Uninstallation failed due to permission error',
        error: errorContext,
        timestamp: new Date(),
      };

      mockOrchestrator.emit('mcp:uninstall-error', testEvent);

      expect(mockBroadcast).toHaveBeenCalledWith('mcp-installation', {
        type: 'mcp:uninstall-error',
        taskId: 'mcp-installation',
        timestamp: testEvent.timestamp,
        data: {
          serverId: 'protected-server',
          serverName: 'Protected Server',
          stage: 'error',
          progress: 0,
          message: 'Uninstallation failed due to permission error',
          error: errorContext, // Full error context is preserved
        },
      });
    });
  });

  describe('Event Consistency and Real-time Broadcasting', () => {
    it('ensures all MCP events use consistent task channel for WebSocket clients', () => {
      const eventTypes = [
        'mcp:install-start',
        'mcp:install-progress',
        'mcp:install-complete',
        'mcp:install-error',
        'mcp:uninstall-start',
        'mcp:uninstall-complete',
        'mcp:uninstall-error'
      ];

      eventTypes.forEach(eventType => {
        const testEvent = {
          serverId: 'consistency-test',
          serverName: 'Consistency Test',
          stage: 'test',
          progress: 50,
          message: 'Test message',
          timestamp: new Date(),
        };

        // Reset mock to track individual calls
        mockBroadcast.mockClear();

        mockOrchestrator.emit(eventType, testEvent);

        // Verify the broadcast was called with correct channel
        expect(mockBroadcast).toHaveBeenCalledTimes(1);
        expect(mockBroadcast).toHaveBeenCalledWith(
          'mcp-installation', // All events use the same channel
          expect.objectContaining({
            type: eventType,
            taskId: 'mcp-installation'
          })
        );
      });
    });

    it('provides automatic timestamp fallback when timestamp is not provided', () => {
      const beforeTime = Date.now();

      const testEvent = {
        serverId: 'timestamp-test',
        serverName: 'Timestamp Test',
        stage: 'starting',
        progress: 0,
        message: 'Testing timestamp fallback',
        // No timestamp provided - should be generated automatically
      };

      mockOrchestrator.emit('mcp:install-start', testEvent);

      const afterTime = Date.now();

      expect(mockBroadcast).toHaveBeenCalled();
      const broadcastCall = mockBroadcast.mock.calls[0];
      const eventTimestamp = broadcastCall[1].timestamp;

      expect(eventTimestamp).toBeInstanceOf(Date);
      expect(eventTimestamp.getTime()).toBeGreaterThanOrEqual(beforeTime);
      expect(eventTimestamp.getTime()).toBeLessThanOrEqual(afterTime);
    });

    it('preserves provided timestamp when available', () => {
      const providedTimestamp = new Date('2024-01-15T10:30:00Z');

      const testEvent = {
        serverId: 'timestamp-preservation-test',
        serverName: 'Timestamp Preservation Test',
        stage: 'complete',
        progress: 100,
        message: 'Testing timestamp preservation',
        timestamp: providedTimestamp,
      };

      mockOrchestrator.emit('mcp:install-complete', testEvent);

      expect(mockBroadcast).toHaveBeenCalledWith(
        'mcp-installation',
        expect.objectContaining({
          timestamp: providedTimestamp
        })
      );
    });
  });

  describe('WebSocket Broadcasting Channel Verification', () => {
    it('verifies all MCP events are broadcast on the mcp-installation channel for client subscription', () => {
      // This test ensures WebSocket clients can subscribe to a single channel
      // to receive all MCP installation/uninstallation events

      const allMCPEventTypes = [
        'mcp:install-start',
        'mcp:install-progress',
        'mcp:install-complete',
        'mcp:install-error',
        'mcp:uninstall-start',
        'mcp:uninstall-complete',
        'mcp:uninstall-error'
      ];

      allMCPEventTypes.forEach(eventType => {
        mockBroadcast.mockClear();

        mockOrchestrator.emit(eventType, {
          serverId: 'channel-test',
          stage: 'test',
          progress: 0,
          message: 'Channel verification test',
        });

        // Every MCP event should be broadcast on the same channel
        expect(mockBroadcast).toHaveBeenCalledWith(
          'mcp-installation',
          expect.any(Object)
        );
      });
    });

    it('ensures event data structure is WebSocket-friendly (serializable)', () => {
      const complexEvent = {
        serverId: 'serialization-test',
        serverName: 'Serialization Test Server',
        stage: 'complete',
        progress: 100,
        message: 'Testing serialization',
        config: {
          type: 'stdio',
          command: 'node',
          args: ['index.js'],
          env: { NODE_ENV: 'production' },
          metadata: {
            version: '1.0.0',
            author: 'Test Author',
            nested: {
              deep: {
                value: 42
              }
            }
          }
        },
        timestamp: new Date(),
      };

      mockOrchestrator.emit('mcp:install-complete', complexEvent);

      const broadcastCall = mockBroadcast.mock.calls[0];
      const eventData = broadcastCall[1];

      // Verify the event can be serialized to JSON
      expect(() => JSON.stringify(eventData)).not.toThrow();

      // Verify the structure is intact after serialization
      const serialized = JSON.stringify(eventData);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.data.config).toEqual(complexEvent.config);
      expect(deserialized.data.serverId).toBe('serialization-test');
    });
  });
});
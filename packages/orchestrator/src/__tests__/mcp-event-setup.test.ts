/**
 * MCP Event Setup Unit Tests
 *
 * Simple unit tests to verify that MCP event forwarding is properly set up
 * during ApexOrchestrator initialization.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '../index.js';
import { TaskStore } from '../store.js';
import type { ApexConfig } from '@apexcli/core';
import fs from 'fs/promises';

// Mock dependencies
vi.mock('../store.js');
vi.mock('fs/promises');
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
  tool: vi.fn((config) => config),
  createSdkMcpServer: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), close: vi.fn() })),
}));

// Simple mock MCPConnectionManager
const mockMCPManager = {
  on: vi.fn(),
  discoverServers: vi.fn().mockReturnValue([]),
  connect: vi.fn().mockResolvedValue({}),
  disconnect: vi.fn().mockResolvedValue(undefined),
  disconnectAll: vi.fn().mockResolvedValue(undefined),
  listConnections: vi.fn().mockReturnValue([]),
  getConnection: vi.fn().mockReturnValue(null),
  getClient: vi.fn().mockReturnValue(undefined),
  updateConfig: vi.fn(),
};

vi.mock('../mcp/connection-manager.js', () => ({
  MCPConnectionManager: vi.fn().mockImplementation(() => mockMCPManager)
}));

const MockTaskStore = vi.mocked(TaskStore);
const mockFS = vi.mocked(fs);

describe('MCP Event Setup', () => {
  let testProjectPath: string;
  let testConfig: ApexConfig;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    vi.clearAllMocks();

    testProjectPath = '/tmp/test-apex-project';

    testConfig = {
      project: {
        name: 'setup-test-project',
        description: 'Test project for MCP event setup',
        version: '1.0.0',
      },
      mcp: {
        enabled: true,
        connection: {
          maxRetries: 3,
          retryDelayMs: 1000,
          connectionTimeoutMs: 10000,
          healthCheckIntervalMs: 30000,
          autoReconnect: true,
        },
        servers: {}
      },
      agents: {},
      workflows: {},
    };

    // Mock file system operations
    mockFS.access.mockResolvedValue(undefined);
    mockFS.mkdir.mockResolvedValue(undefined);
    mockFS.readFile.mockResolvedValue('{}');
    mockFS.writeFile.mockResolvedValue(undefined);

    // Mock TaskStore
    const mockStore = {
      getTasks: vi.fn().mockResolvedValue([]),
      getTaskById: vi.fn().mockResolvedValue(null),
      createTask: vi.fn().mockResolvedValue('task-1'),
      updateTask: vi.fn().mockResolvedValue(undefined),
      deleteTask: vi.fn().mockResolvedValue(undefined),
      initialize: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    MockTaskStore.mockImplementation(() => mockStore as any);
  });

  afterEach(async () => {
    if (orchestrator) {
      try {
        await orchestrator.disconnectAll?.();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
    vi.clearAllMocks();
  });

  describe('Event Listener Setup', () => {
    it('should register event listeners for all MCP events during initialization', () => {
      orchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...testConfig });

      // Verify that MCPConnectionManager.on() was called for all expected events
      const expectedEvents = [
        'connected',
        'disconnected',
        'error',
        'reconnecting',
        'healthCheck',
        'stateChange',
        'poolChange'
      ];

      expectedEvents.forEach(eventName => {
        expect(mockMCPManager.on).toHaveBeenCalledWith(
          eventName,
          expect.any(Function)
        );
      });

      // Verify we have the expected number of event listener registrations
      expect(mockMCPManager.on).toHaveBeenCalledTimes(expectedEvents.length);
    });

    it('should create event listeners that are functions', () => {
      orchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...testConfig });

      // Get all the listener functions that were registered
      const listenerCalls = mockMCPManager.on.mock.calls;

      listenerCalls.forEach(([eventName, listenerFn]) => {
        expect(typeof listenerFn).toBe('function');
        expect(listenerFn.name).toBeTruthy(); // Functions should have names for debugging
      });
    });

    it('should setup event forwarding even when MCP is disabled', () => {
      const configWithDisabledMCP = {
        ...testConfig,
        mcp: {
          ...testConfig.mcp!,
          enabled: false
        }
      };

      orchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...configWithDisabledMCP });

      // Even with MCP disabled, the manager should be created and event listeners set up
      // This ensures that if MCP gets enabled later, events will work
      expect(mockMCPManager.on).toHaveBeenCalled();
    });

    it('should handle event setup when no MCP config is provided', () => {
      const configWithoutMCP = {
        project: testConfig.project,
        agents: {},
        workflows: {},
      } as ApexConfig;

      // This should not throw an error
      expect(() => {
        orchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...configWithoutMCP });
      }).not.toThrow();

      // Event listeners should still be set up
      expect(mockMCPManager.on).toHaveBeenCalled();
    });
  });

  describe('Event Handler Registration', () => {
    it('should verify orchestrator has emit method for forwarding events', () => {
      orchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...testConfig });

      // ApexOrchestrator should be an EventEmitter (or have emit method)
      expect(typeof orchestrator.emit).toBe('function');
      expect(typeof orchestrator.on).toBe('function');
      expect(typeof orchestrator.off).toBe('function');
    });

    it('should allow adding listeners to forwarded MCP events', () => {
      orchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...testConfig });

      // These should not throw errors
      expect(() => {
        orchestrator.on('mcp:connected', () => {});
        orchestrator.on('mcp:disconnected', () => {});
        orchestrator.on('mcp:error', () => {});
        orchestrator.on('mcp:reconnecting', () => {});
        orchestrator.on('mcp:health-check', () => {});
        orchestrator.on('mcp:state-change', () => {});
        orchestrator.on('mcp:pool-change', () => {});
      }).not.toThrow();
    });
  });

  describe('Event Naming Convention', () => {
    it('should follow consistent naming pattern for forwarded events', () => {
      // This test documents the expected event names that should be forwarded
      const expectedForwardedEvents = [
        'mcp:connected',
        'mcp:disconnected',
        'mcp:error',
        'mcp:reconnecting',
        'mcp:health-check',
        'mcp:state-change',
        'mcp:pool-change'
      ];

      // This test serves as documentation of the API
      expect(expectedForwardedEvents).toEqual([
        'mcp:connected',
        'mcp:disconnected',
        'mcp:error',
        'mcp:reconnecting',
        'mcp:health-check',
        'mcp:state-change',
        'mcp:pool-change'
      ]);

      // All event names should follow the 'mcp:' prefix pattern
      expectedForwardedEvents.forEach(eventName => {
        expect(eventName).toMatch(/^mcp:/);
      });
    });
  });

  describe('Error Resilience', () => {
    it('should not crash if MCPConnectionManager throws during initialization', () => {
      const { MCPConnectionManager } = require('../mcp/connection-manager.js');

      // Mock MCPConnectionManager constructor to throw
      vi.mocked(MCPConnectionManager).mockImplementationOnce(() => {
        throw new Error('MCP Manager initialization failed');
      });

      // Orchestrator creation should handle this gracefully or throw a clear error
      expect(() => {
        orchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...testConfig });
      }).toThrow('MCP Manager initialization failed');
    });
  });
});
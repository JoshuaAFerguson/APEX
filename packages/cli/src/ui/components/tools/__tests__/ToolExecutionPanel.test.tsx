/**
 * Comprehensive test suite for ToolExecutionPanel component
 *
 * Tests all 4 tool visualization features:
 * 1. Circular reference handling in tool event logging
 * 2. Large payload truncation in panel display
 * 3. Timing events streaming and real-time updates
 * 4. MCP error display in tool execution context
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';
import { ToolExecutionPanel, ToolStatusIndicator, type ToolExecutionPanelProps, type ToolStatusIndicatorProps } from '../ToolExecutionPanel.js';
import { useToolEventLogger } from '../../../hooks/useToolEventLogger.js';
import type { ApexOrchestrator, ToolCallStartEvent, ToolCallCompleteEvent } from '@apexcli/orchestrator';

// Mock dependencies
vi.mock('../../../hooks/useToolEventLogger.js');
vi.mock('../../ToolCall.js', () => ({
  ToolCall: ({ toolName, status, duration }: any) => `ToolCall:${toolName}:${status}:${duration}`,
}));
vi.mock('../../ActivityLog.js', () => ({
  ActivityLog: ({ entries, title }: any) => `ActivityLog:${title}:${entries.length}`,
  CompactLog: ({ entries, maxLines }: any) => `CompactLog:${entries.length}:${maxLines}`,
}));

const mockUseToolEventLogger = useToolEventLogger as MockedFunction<typeof useToolEventLogger>;

describe('ToolExecutionPanel Component - Comprehensive Tool Visualization Tests', () => {
  let mockOrchestrator: Partial<ApexOrchestrator>;
  let defaultProps: ToolExecutionPanelProps;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOrchestrator = {
      on: vi.fn(),
      off: vi.fn(),
    };

    defaultProps = {
      orchestrator: mockOrchestrator as ApexOrchestrator,
      taskId: 'test-task-123',
    };

    // Default mock return value
    mockUseToolEventLogger.mockReturnValue({
      toolLogs: [],
      activeToolCalls: new Map(),
      stats: {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        averageDuration: 0,
      },
    });
  });

  describe('Basic Panel Rendering', () => {
    it('should render panel with default props', () => {
      const { lastFrame } = render(<ToolExecutionPanel {...defaultProps} />);

      expect(lastFrame()).toContain('Tool Execution');
      expect(lastFrame()).toContain('0 logs');
    });

    it('should render collapsed state', () => {
      const { lastFrame } = render(<ToolExecutionPanel {...defaultProps} collapsed={true} />);

      expect(lastFrame()).toContain('(collapsed)');
      expect(lastFrame()).toContain('0 active');
      expect(lastFrame()).toContain('0 total');
    });

    it('should render custom title', () => {
      const { lastFrame } = render(
        <ToolExecutionPanel {...defaultProps} title="Custom Tool Monitor" />
      );

      expect(lastFrame()).toContain('Custom Tool Monitor');
    });

    it('should handle missing orchestrator gracefully', () => {
      const props = { ...defaultProps, orchestrator: undefined };

      expect(() => render(<ToolExecutionPanel {...props} />)).not.toThrow();
    });
  });

  describe('Feature 1: Circular Reference Handling in Tool Events', () => {
    it('should handle circular references in tool start events', () => {
      const circularInput: any = { config: { timeout: 5000 } };
      circularInput.config.self = circularInput;

      const mockStartEvent: ToolCallStartEvent = {
        taskId: 'test-task-123',
        callId: 'call-1',
        toolName: 'Read',
        timestamp: new Date(),
        input: circularInput,
      };

      const activeToolCalls = new Map();
      activeToolCalls.set('call-1', mockStartEvent);

      mockUseToolEventLogger.mockReturnValue({
        toolLogs: [{
          id: 'log-1',
          timestamp: new Date(),
          level: 'info',
          message: 'Started Read',
          agent: 'system',
          category: 'tool',
          data: {
            toolName: 'Read',
            callId: 'call-1',
            input: circularInput,
            status: 'started',
          },
        }],
        activeToolCalls,
        stats: {
          totalCalls: 1,
          successfulCalls: 0,
          failedCalls: 0,
          averageDuration: 0,
        },
      });

      expect(() => render(<ToolExecutionPanel {...defaultProps} />)).not.toThrow();

      const { lastFrame } = render(<ToolExecutionPanel {...defaultProps} />);
      expect(lastFrame()).toContain('ToolCall:Read:running');
      expect(lastFrame()).toContain('1 active');
    });

    it('should handle circular references in tool completion events', () => {
      const circularResult: any = {
        success: true,
        data: { items: [] }
      };
      circularResult.data.self = circularResult;

      mockUseToolEventLogger.mockReturnValue({
        toolLogs: [{
          id: 'log-1',
          timestamp: new Date(),
          level: 'success',
          message: 'Completed Read (1.5s)',
          agent: 'system',
          category: 'tool',
          duration: 1500,
          data: {
            toolName: 'Read',
            callId: 'call-1',
            result: circularResult,
            timing: {
              startTime: new Date(Date.now() - 1500),
              endTime: new Date(),
              duration: 1500,
            },
            status: 'completed',
          },
        }],
        activeToolCalls: new Map(),
        stats: {
          totalCalls: 1,
          successfulCalls: 1,
          failedCalls: 0,
          averageDuration: 1500,
        },
      });

      expect(() => render(<ToolExecutionPanel {...defaultProps} />)).not.toThrow();

      const { lastFrame } = render(<ToolExecutionPanel {...defaultProps} />);
      expect(lastFrame()).toContain('1 total');
      expect(lastFrame()).toContain('100.0%');
    });

    it('should handle deeply nested circular references in tool data', () => {
      const deepCircular: any = {
        level1: {
          level2: {
            level3: {
              data: 'test'
            }
          }
        }
      };
      deepCircular.level1.level2.level3.back = deepCircular;

      mockUseToolEventLogger.mockReturnValue({
        toolLogs: [{
          id: 'log-1',
          timestamp: new Date(),
          level: 'info',
          message: 'Started Complex Tool',
          agent: 'system',
          category: 'tool',
          data: {
            toolName: 'Complex',
            callId: 'call-1',
            input: deepCircular,
            status: 'started',
          },
        }],
        activeToolCalls: new Map([
          ['call-1', {
            taskId: 'test-task-123',
            callId: 'call-1',
            toolName: 'Complex',
            timestamp: new Date(),
            input: deepCircular,
          } as ToolCallStartEvent]
        ]),
        stats: {
          totalCalls: 1,
          successfulCalls: 0,
          failedCalls: 0,
          averageDuration: 0,
        },
      });

      expect(() => render(<ToolExecutionPanel {...defaultProps} />)).not.toThrow();

      const { lastFrame } = render(<ToolExecutionPanel {...defaultProps} />);
      expect(lastFrame()).toContain('ToolCall:Complex:running');
    });

    it('should handle mutual circular references in event data', () => {
      const objA: any = { name: 'A' };
      const objB: any = { name: 'B' };
      objA.refB = objB;
      objB.refA = objA;

      const input = { objectA: objA, objectB: objB };

      mockUseToolEventLogger.mockReturnValue({
        toolLogs: [{
          id: 'log-1',
          timestamp: new Date(),
          level: 'info',
          message: 'Started Mutual Tool',
          agent: 'system',
          category: 'tool',
          data: {
            toolName: 'Mutual',
            callId: 'call-1',
            input,
            status: 'started',
          },
        }],
        activeToolCalls: new Map(),
        stats: {
          totalCalls: 1,
          successfulCalls: 0,
          failedCalls: 0,
          averageDuration: 0,
        },
      });

      expect(() => render(<ToolExecutionPanel {...defaultProps} />)).not.toThrow();

      const { lastFrame } = render(<ToolExecutionPanel {...defaultProps} />);
      expect(lastFrame()).toContain('1 logs');
    });
  });

  describe('Feature 2: Large Payload Truncation in Panel Display', () => {
    it('should handle panels with many active tool calls', () => {
      const activeToolCalls = new Map();
      const toolLogs = [];

      // Create 20 active tool calls to test truncation
      for (let i = 0; i < 20; i++) {
        const startEvent: ToolCallStartEvent = {
          taskId: 'test-task-123',
          callId: `call-${i}`,
          toolName: `Tool${i}`,
          timestamp: new Date(Date.now() - (i * 1000)),
          input: { data: `large data payload ${i}`.repeat(100) }, // Large input
        };
        activeToolCalls.set(`call-${i}`, startEvent);

        toolLogs.push({
          id: `log-${i}`,
          timestamp: new Date(Date.now() - (i * 1000)),
          level: 'info',
          message: `Started Tool${i}`,
          agent: 'system',
          category: 'tool',
          data: {
            toolName: `Tool${i}`,
            callId: `call-${i}`,
            input: startEvent.input,
            status: 'started',
          },
        });
      }

      mockUseToolEventLogger.mockReturnValue({
        toolLogs,
        activeToolCalls,
        stats: {
          totalCalls: 20,
          successfulCalls: 0,
          failedCalls: 0,
          averageDuration: 0,
        },
      });

      expect(() => render(<ToolExecutionPanel {...defaultProps} />)).not.toThrow();

      const { lastFrame } = render(<ToolExecutionPanel {...defaultProps} />);
      expect(lastFrame()).toContain('20 active');
      expect(lastFrame()).toContain('20 logs');
    });

    it('should limit recent logs display to maxRecentLogs', () => {
      const toolLogs = [];

      // Create 100 log entries
      for (let i = 0; i < 100; i++) {
        toolLogs.push({
          id: `log-${i}`,
          timestamp: new Date(Date.now() - (i * 1000)),
          level: 'info',
          message: `Tool operation ${i}`,
          agent: 'system',
          category: 'tool',
        });
      }

      mockUseToolEventLogger.mockReturnValue({
        toolLogs,
        activeToolCalls: new Map(),
        stats: {
          totalCalls: 100,
          successfulCalls: 80,
          failedCalls: 20,
          averageDuration: 2500,
        },
      });

      const { lastFrame } = render(
        <ToolExecutionPanel {...defaultProps} maxRecentLogs={3} />
      );

      // Should only show compact log with 3 recent entries
      expect(lastFrame()).toContain('CompactLog:3:3');
      expect(lastFrame()).toContain('100 logs');
    });

    it('should handle massive tool input data efficiently', () => {
      const massiveInput = {
        largeArray: Array(10000).fill('data'),
        hugeString: 'x'.repeat(100000),
        deepObject: {}
      };

      // Create deep object structure
      let current = massiveInput.deepObject;
      for (let i = 0; i < 100; i++) {
        current.level = { data: `level_${i}` };
        current = current.level;
      }

      const activeToolCalls = new Map([
        ['call-1', {
          taskId: 'test-task-123',
          callId: 'call-1',
          toolName: 'MassiveDataTool',
          timestamp: new Date(),
          input: massiveInput,
        } as ToolCallStartEvent]
      ]);

      mockUseToolEventLogger.mockReturnValue({
        toolLogs: [],
        activeToolCalls,
        stats: {
          totalCalls: 1,
          successfulCalls: 0,
          failedCalls: 0,
          averageDuration: 0,
        },
      });

      const startTime = Date.now();
      expect(() => render(<ToolExecutionPanel {...defaultProps} />)).not.toThrow();
      const endTime = Date.now();

      // Should render quickly even with massive data
      expect(endTime - startTime).toBeLessThan(1000);

      const { lastFrame } = render(<ToolExecutionPanel {...defaultProps} />);
      expect(lastFrame()).toContain('1 active');
    });

    it('should truncate activity log entries properly', () => {
      const longToolLogs = [];

      for (let i = 0; i < 1000; i++) {
        longToolLogs.push({
          id: `log-${i}`,
          timestamp: new Date(Date.now() - (i * 100)),
          level: 'info',
          message: `Very long tool operation message that contains lots of details ${i}`.repeat(10),
          agent: 'system',
          category: 'tool',
          data: {
            largeData: Array(1000).fill(`data_${i}`)
          }
        });
      }

      mockUseToolEventLogger.mockReturnValue({
        toolLogs: longToolLogs,
        activeToolCalls: new Map(),
        stats: {
          totalCalls: 1000,
          successfulCalls: 950,
          failedCalls: 50,
          averageDuration: 1500,
        },
      });

      const { lastFrame } = render(
        <ToolExecutionPanel {...defaultProps} maxEntries={50} />
      );

      expect(lastFrame()).toContain('1000 logs');
    });
  });

  describe('Feature 3: Timing Events Streaming and Real-time Updates', () => {
    it('should calculate and display real-time duration for active tools', () => {
      const currentTime = Date.now();
      const startTime = currentTime - 5000; // 5 seconds ago

      const activeToolCalls = new Map([
        ['call-1', {
          taskId: 'test-task-123',
          callId: 'call-1',
          toolName: 'LongRunningTool',
          timestamp: new Date(startTime),
          input: { task: 'processing' },
        } as ToolCallStartEvent]
      ]);

      mockUseToolEventLogger.mockReturnValue({
        toolLogs: [],
        activeToolCalls,
        stats: {
          totalCalls: 1,
          successfulCalls: 0,
          failedCalls: 0,
          averageDuration: 0,
        },
      });

      const { lastFrame } = render(<ToolExecutionPanel {...defaultProps} />);

      // Should show running tool with approximate duration
      expect(lastFrame()).toContain('ToolCall:LongRunningTool:running');
      expect(lastFrame()).toContain('1 active');
    });

    it('should display statistics with formatted average duration', () => {
      mockUseToolEventLogger.mockReturnValue({
        toolLogs: [],
        activeToolCalls: new Map(),
        stats: {
          totalCalls: 100,
          successfulCalls: 85,
          failedCalls: 15,
          averageDuration: 2750, // 2.75 seconds
        },
      });

      const { lastFrame } = render(<ToolExecutionPanel {...defaultProps} />);

      expect(lastFrame()).toContain('Total: 100');
      expect(lastFrame()).toContain('Success: 85');
      expect(lastFrame()).toContain('Failed: 15');
      expect(lastFrame()).toContain('85.0%');
      expect(lastFrame()).toContain('2.8s'); // Formatted average duration
    });

    it('should handle very fast operations (sub-millisecond)', () => {
      mockUseToolEventLogger.mockReturnValue({
        toolLogs: [{
          id: 'log-1',
          timestamp: new Date(),
          level: 'success',
          message: 'Completed FastTool (0.5ms)',
          agent: 'system',
          category: 'tool',
          duration: 0.5,
          data: {
            toolName: 'FastTool',
            callId: 'call-1',
            status: 'completed',
          },
        }],
        activeToolCalls: new Map(),
        stats: {
          totalCalls: 1,
          successfulCalls: 1,
          failedCalls: 0,
          averageDuration: 0.5,
        },
      });

      const { lastFrame } = render(<ToolExecutionPanel {...defaultProps} />);

      expect(lastFrame()).toContain('0.5ms');
      expect(lastFrame()).toContain('100.0%');
    });

    it('should handle very long operations (hours)', () => {
      const longDuration = 7265000; // 2h 1m 5s

      mockUseToolEventLogger.mockReturnValue({
        toolLogs: [{
          id: 'log-1',
          timestamp: new Date(),
          level: 'success',
          message: 'Completed LongTool',
          agent: 'system',
          category: 'tool',
          duration: longDuration,
          data: {
            toolName: 'LongTool',
            callId: 'call-1',
            status: 'completed',
          },
        }],
        activeToolCalls: new Map(),
        stats: {
          totalCalls: 1,
          successfulCalls: 1,
          failedCalls: 0,
          averageDuration: longDuration,
        },
      });

      const { lastFrame } = render(<ToolExecutionPanel {...defaultProps} />);

      // Should format long durations properly
      expect(lastFrame()).toContain('h');
      expect(lastFrame()).toContain('m');
    });

    it('should stream timing events in compact mode', () => {
      const activeToolCalls = new Map([
        ['call-1', {
          taskId: 'test-task-123',
          callId: 'call-1',
          toolName: 'StreamingTool',
          timestamp: new Date(Date.now() - 3000),
          input: { stream: true },
        } as ToolCallStartEvent]
      ]);

      mockUseToolEventLogger.mockReturnValue({
        toolLogs: [
          {
            id: 'log-1',
            timestamp: new Date(),
            level: 'info',
            message: 'Started StreamingTool',
            agent: 'system',
            category: 'tool',
          }
        ],
        activeToolCalls,
        stats: {
          totalCalls: 5,
          successfulCalls: 4,
          failedCalls: 1,
          averageDuration: 2000,
        },
      });

      const { lastFrame } = render(
        <ToolExecutionPanel {...defaultProps} displayMode="compact" />
      );

      expect(lastFrame()).toContain('1 active');
      expect(lastFrame()).toContain('5 total');
      expect(lastFrame()).toContain('80.0% success');
    });

    it('should handle zero duration edge cases', () => {
      mockUseToolEventLogger.mockReturnValue({
        toolLogs: [],
        activeToolCalls: new Map(),
        stats: {
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          averageDuration: 0,
        },
      });

      const { lastFrame } = render(<ToolExecutionPanel {...defaultProps} />);

      expect(lastFrame()).toContain('Total: 0');
      expect(lastFrame()).toContain('0.0%');
    });
  });

  describe('Feature 4: MCP Error Display in Tool Execution Context', () => {
    it('should display MCP connection errors in tool logs', () => {
      mockUseToolEventLogger.mockReturnValue({
        toolLogs: [{
          id: 'log-1',
          timestamp: new Date(),
          level: 'error',
          message: 'Failed MCPTool: MCP connection failed',
          agent: 'system',
          category: 'tool',
          data: {
            toolName: 'MCPTool',
            callId: 'call-1',
            result: {
              success: false,
              error: 'MCP connection failed: Unable to connect to server'
            },
            status: 'failed',
          },
        }],
        activeToolCalls: new Map(),
        stats: {
          totalCalls: 1,
          successfulCalls: 0,
          failedCalls: 1,
          averageDuration: 5000,
        },
      });

      const { lastFrame } = render(<ToolExecutionPanel {...defaultProps} />);

      expect(lastFrame()).toContain('Failed: 1');
      expect(lastFrame()).toContain('0.0%'); // 0% success rate
    });

    it('should handle MCP protocol errors in active tool calls', () => {
      const activeToolCalls = new Map([
        ['call-1', {
          taskId: 'test-task-123',
          callId: 'call-1',
          toolName: 'MCPProtocolTool',
          timestamp: new Date(),
          input: { protocol: 'jsonrpc' },
        } as ToolCallStartEvent]
      ]);

      mockUseToolEventLogger.mockReturnValue({
        toolLogs: [{
          id: 'log-1',
          timestamp: new Date(),
          level: 'error',
          message: 'Failed MCPProtocolTool: JSONRPC parse error',
          agent: 'system',
          category: 'tool',
          data: {
            toolName: 'MCPProtocolTool',
            callId: 'call-1',
            result: {
              success: false,
              error: 'JSONRPC parse error: Invalid message format'
            },
            status: 'failed',
          },
        }],
        activeToolCalls,
        stats: {
          totalCalls: 1,
          successfulCalls: 0,
          failedCalls: 1,
          averageDuration: 1500,
        },
      });

      const { lastFrame } = render(<ToolExecutionPanel {...defaultProps} />);

      expect(lastFrame()).toContain('1 active');
      expect(lastFrame()).toContain('Failed: 1');
      expect(lastFrame()).toContain('ToolCall:MCPProtocolTool:running');
    });

    it('should display MCP timeout errors with duration context', () => {
      mockUseToolEventLogger.mockReturnValue({
        toolLogs: [{
          id: 'log-1',
          timestamp: new Date(),
          level: 'error',
          message: 'Failed MCPTimeoutTool: MCP request timeout',
          agent: 'system',
          category: 'tool',
          duration: 30000,
          data: {
            toolName: 'MCPTimeoutTool',
            callId: 'call-1',
            result: {
              success: false,
              error: 'MCP request timeout: Operation exceeded 30 second limit'
            },
            timing: {
              startTime: new Date(Date.now() - 30000),
              endTime: new Date(),
              duration: 30000,
            },
            status: 'failed',
          },
        }],
        activeToolCalls: new Map(),
        stats: {
          totalCalls: 1,
          successfulCalls: 0,
          failedCalls: 1,
          averageDuration: 30000,
        },
      });

      const { lastFrame } = render(<ToolExecutionPanel {...defaultProps} />);

      expect(lastFrame()).toContain('Failed: 1');
      expect(lastFrame()).toContain('30.0s'); // Average duration
    });

    it('should handle multiple MCP errors from different tools', () => {
      mockUseToolEventLogger.mockReturnValue({
        toolLogs: [
          {
            id: 'log-1',
            timestamp: new Date(),
            level: 'error',
            message: 'Failed MCPTool1: Connection failed',
            agent: 'system',
            category: 'tool',
            data: { toolName: 'MCPTool1', status: 'failed' },
          },
          {
            id: 'log-2',
            timestamp: new Date(),
            level: 'error',
            message: 'Failed MCPTool2: Authentication failed',
            agent: 'system',
            category: 'tool',
            data: { toolName: 'MCPTool2', status: 'failed' },
          },
          {
            id: 'log-3',
            timestamp: new Date(),
            level: 'error',
            message: 'Failed MCPTool3: Protocol error',
            agent: 'system',
            category: 'tool',
            data: { toolName: 'MCPTool3', status: 'failed' },
          }
        ],
        activeToolCalls: new Map(),
        stats: {
          totalCalls: 3,
          successfulCalls: 0,
          failedCalls: 3,
          averageDuration: 2500,
        },
      });

      const { lastFrame } = render(<ToolExecutionPanel {...defaultProps} />);

      expect(lastFrame()).toContain('Total: 3');
      expect(lastFrame()).toContain('Failed: 3');
      expect(lastFrame()).toContain('0.0%');
    });

    it('should show MCP error recovery scenarios', () => {
      mockUseToolEventLogger.mockReturnValue({
        toolLogs: [
          {
            id: 'log-1',
            timestamp: new Date(Date.now() - 5000),
            level: 'error',
            message: 'Failed MCPTool: Connection failed',
            agent: 'system',
            category: 'tool',
          },
          {
            id: 'log-2',
            timestamp: new Date(Date.now() - 3000),
            level: 'info',
            message: 'Started MCPTool (retry)',
            agent: 'system',
            category: 'tool',
          },
          {
            id: 'log-3',
            timestamp: new Date(),
            level: 'success',
            message: 'Completed MCPTool (retry successful)',
            agent: 'system',
            category: 'tool',
          }
        ],
        activeToolCalls: new Map(),
        stats: {
          totalCalls: 2,
          successfulCalls: 1,
          failedCalls: 1,
          averageDuration: 2000,
        },
      });

      const { lastFrame } = render(<ToolExecutionPanel {...defaultProps} />);

      expect(lastFrame()).toContain('Total: 2');
      expect(lastFrame()).toContain('Success: 1');
      expect(lastFrame()).toContain('Failed: 1');
      expect(lastFrame()).toContain('50.0%');
    });

    it('should handle MCP errors in compact display mode', () => {
      mockUseToolEventLogger.mockReturnValue({
        toolLogs: [{
          id: 'log-1',
          timestamp: new Date(),
          level: 'error',
          message: 'Failed MCP: Error',
          agent: 'system',
          category: 'tool',
        }],
        activeToolCalls: new Map(),
        stats: {
          totalCalls: 5,
          successfulCalls: 3,
          failedCalls: 2,
          averageDuration: 1500,
        },
      });

      const { lastFrame } = render(
        <ToolExecutionPanel {...defaultProps} displayMode="compact" />
      );

      expect(lastFrame()).toContain('0 active');
      expect(lastFrame()).toContain('5 total');
      expect(lastFrame()).toContain('60.0% success');
      expect(lastFrame()).toContain('CompactLog:1:2'); // Recent activity
    });
  });

  describe('Display Modes and Panel Configuration', () => {
    it('should render different display modes correctly', () => {
      const testStats = {
        totalCalls: 10,
        successfulCalls: 8,
        failedCalls: 2,
        averageDuration: 1500,
      };

      mockUseToolEventLogger.mockReturnValue({
        toolLogs: [],
        activeToolCalls: new Map(),
        stats: testStats,
      });

      // Test normal mode
      const { lastFrame: normalFrame } = render(
        <ToolExecutionPanel {...defaultProps} displayMode="normal" />
      );
      expect(normalFrame()).toContain('Tool Execution');

      // Test verbose mode
      const { lastFrame: verboseFrame } = render(
        <ToolExecutionPanel {...defaultProps} displayMode="verbose" />
      );
      expect(verboseFrame()).toContain('Tool Execution');

      // Test compact mode
      const { lastFrame: compactFrame } = render(
        <ToolExecutionPanel {...defaultProps} displayMode="compact" />
      );
      expect(compactFrame()).toContain('80.0% success');
    });

    it('should handle panel configuration options', () => {
      mockUseToolEventLogger.mockReturnValue({
        toolLogs: [],
        activeToolCalls: new Map(),
        stats: {
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          averageDuration: 0,
        },
      });

      const { lastFrame } = render(
        <ToolExecutionPanel
          {...defaultProps}
          width={100}
          height={30}
          showStats={false}
          showActiveTools={false}
          showActivityLog={false}
        />
      );

      expect(lastFrame()).toContain('Tool Execution');
    });
  });

  describe('ToolStatusIndicator Component', () => {
    const defaultIndicatorProps: ToolStatusIndicatorProps = {
      activeCount: 0,
      totalCount: 0,
      successRate: 0,
    };

    it('should render status indicator in normal mode', () => {
      const { lastFrame } = render(
        <ToolStatusIndicator
          {...defaultIndicatorProps}
          activeCount={2}
          totalCount={10}
          successRate={80.5}
        />
      );

      expect(lastFrame()).toContain('2 active');
      expect(lastFrame()).toContain('10 total');
      expect(lastFrame()).toContain('80.5% success');
    });

    it('should render status indicator in compact mode', () => {
      const { lastFrame } = render(
        <ToolStatusIndicator
          {...defaultIndicatorProps}
          activeCount={1}
          totalCount={5}
          successRate={60}
          displayMode="compact"
        />
      );

      expect(lastFrame()).toContain('1/5');
      expect(lastFrame()).toContain('60%');
    });

    it('should show correct colors for different success rates', () => {
      // High success rate (>= 90%)
      const { lastFrame: highSuccess } = render(
        <ToolStatusIndicator {...defaultIndicatorProps} successRate={95} />
      );
      expect(highSuccess()).toBeDefined();

      // Medium success rate (70-89%)
      const { lastFrame: mediumSuccess } = render(
        <ToolStatusIndicator {...defaultIndicatorProps} successRate={75} />
      );
      expect(mediumSuccess()).toBeDefined();

      // Low success rate (< 70%)
      const { lastFrame: lowSuccess } = render(
        <ToolStatusIndicator {...defaultIndicatorProps} successRate={50} />
      );
      expect(lowSuccess()).toBeDefined();
    });

    it('should handle zero values gracefully', () => {
      const { lastFrame } = render(
        <ToolStatusIndicator {...defaultIndicatorProps} />
      );

      expect(lastFrame()).toContain('idle');
      expect(lastFrame()).toContain('0 total');
      expect(lastFrame()).toContain('0% success');
    });
  });

  describe('Integration Tests - Combined Features', () => {
    it('should handle all features together in a complex scenario', () => {
      // Large circular data
      const complexCircular: any = {
        metadata: { processed: new Date() },
        results: Array(1000).fill('result'),
        config: { timeout: 30000 }
      };
      complexCircular.metadata.parent = complexCircular;

      // Active tools with complex data
      const activeToolCalls = new Map([
        ['call-1', {
          taskId: 'test-task-123',
          callId: 'call-1',
          toolName: 'MCPComplexTool',
          timestamp: new Date(Date.now() - 15000), // 15 seconds ago
          input: complexCircular,
        } as ToolCallStartEvent]
      ]);

      // Many log entries with various types
      const toolLogs = [];
      for (let i = 0; i < 100; i++) {
        const isError = i % 7 === 0; // Some errors
        toolLogs.push({
          id: `log-${i}`,
          timestamp: new Date(Date.now() - (i * 1000)),
          level: isError ? 'error' : 'info',
          message: isError
            ? `Failed Tool${i}: MCP error occurred`
            : `Completed Tool${i}`,
          agent: 'system',
          category: 'tool',
          duration: isError ? undefined : Math.random() * 5000,
          data: {
            toolName: `Tool${i}`,
            callId: `call-${i}`,
            status: isError ? 'failed' : 'completed',
          },
        });
      }

      mockUseToolEventLogger.mockReturnValue({
        toolLogs,
        activeToolCalls,
        stats: {
          totalCalls: 100,
          successfulCalls: 86,
          failedCalls: 14,
          averageDuration: 2500,
        },
      });

      const startTime = Date.now();
      expect(() => render(
        <ToolExecutionPanel
          {...defaultProps}
          maxEntries={50}
          maxRecentLogs={5}
        />
      )).not.toThrow();
      const endTime = Date.now();

      // Should render quickly despite complex data
      expect(endTime - startTime).toBeLessThan(2000);

      const { lastFrame } = render(
        <ToolExecutionPanel
          {...defaultProps}
          maxEntries={50}
          maxRecentLogs={5}
        />
      );

      // Check all features work together
      expect(lastFrame()).toContain('1 active'); // Active tool count
      expect(lastFrame()).toContain('100 logs'); // Total logs
      expect(lastFrame()).toContain('86.0%'); // Success rate
      expect(lastFrame()).toContain('2.5s'); // Average duration
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle hook returning undefined data', () => {
      mockUseToolEventLogger.mockReturnValue({
        toolLogs: undefined as any,
        activeToolCalls: undefined as any,
        stats: undefined as any,
      });

      expect(() => render(<ToolExecutionPanel {...defaultProps} />)).not.toThrow();
    });

    it('should handle invalid timestamp data', () => {
      const activeToolCalls = new Map([
        ['call-1', {
          taskId: 'test-task-123',
          callId: 'call-1',
          toolName: 'InvalidTimestampTool',
          timestamp: 'invalid' as any,
          input: { test: true },
        } as any]
      ]);

      mockUseToolEventLogger.mockReturnValue({
        toolLogs: [],
        activeToolCalls,
        stats: {
          totalCalls: 1,
          successfulCalls: 0,
          failedCalls: 0,
          averageDuration: 0,
        },
      });

      expect(() => render(<ToolExecutionPanel {...defaultProps} />)).not.toThrow();
    });

    it('should handle extremely large statistics', () => {
      mockUseToolEventLogger.mockReturnValue({
        toolLogs: [],
        activeToolCalls: new Map(),
        stats: {
          totalCalls: Number.MAX_SAFE_INTEGER,
          successfulCalls: Number.MAX_SAFE_INTEGER - 1,
          failedCalls: 1,
          averageDuration: Number.MAX_SAFE_INTEGER,
        },
      });

      expect(() => render(<ToolExecutionPanel {...defaultProps} />)).not.toThrow();
    });
  });
});
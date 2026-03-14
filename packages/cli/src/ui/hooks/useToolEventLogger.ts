import { useState, useEffect, useCallback } from 'react';
import type { ApexOrchestrator, ToolCallStartEvent, ToolCallCompleteEvent, ToolCallProgressEvent } from '@apexcli/orchestrator';
import type { LogEntry } from '../components/ActivityLog.js';

export interface ToolEventLoggerOptions {
  /** The orchestrator instance to listen to */
  orchestrator?: ApexOrchestrator;
  /** Task ID to filter events for */
  taskId?: string;
  /** Maximum number of log entries to keep */
  maxEntries?: number;
  /** Whether to enable debug logging */
  debug?: boolean;
}

export interface ToolEventLoggerState {
  /** Tool execution log entries */
  toolLogs: LogEntry[];
  /** Currently active tool calls */
  activeToolCalls: Map<string, ToolCallStartEvent>;
  /** Tool execution statistics */
  stats: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    averageDuration: number;
  };
}

/**
 * Custom hook that bridges tool events to ActivityLog entries
 * Captures tool:start, tool:progress, and tool:complete events
 * and converts them into structured log entries with timing and status
 */
export function useToolEventLogger(options: ToolEventLoggerOptions = {}): ToolEventLoggerState {
  const { orchestrator, taskId, maxEntries = 100, debug = false } = options;

  const [state, setState] = useState<ToolEventLoggerState>(() => ({
    toolLogs: [],
    activeToolCalls: new Map(),
    stats: {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageDuration: 0,
    },
  }));

  // Debug logging helper
  const log = useCallback((message: string, data?: any) => {
    if (debug) {
      console.log(`[useToolEventLogger] ${message}`, data || '');
    }
  }, [debug]);

  // Helper to generate unique log entry ID
  const generateLogId = useCallback(() => {
    return `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Helper to update tool statistics
  const updateStats = useCallback((
    increment: { total?: number; successful?: number; failed?: number },
    newDuration?: number
  ) => {
    setState(prev => {
      const newStats = {
        totalCalls: prev.stats.totalCalls + (increment.total || 0),
        successfulCalls: prev.stats.successfulCalls + (increment.successful || 0),
        failedCalls: prev.stats.failedCalls + (increment.failed || 0),
        averageDuration: prev.stats.averageDuration,
      };

      // Update average duration if we have a new duration
      if (newDuration !== undefined && newStats.totalCalls > 0) {
        const totalDuration = prev.stats.averageDuration * (prev.stats.totalCalls - (increment.total || 0)) + newDuration;
        newStats.averageDuration = totalDuration / newStats.totalCalls;
      }

      return {
        ...prev,
        stats: newStats,
      };
    });
  }, []);

  // Helper to add log entry and manage buffer size
  const addLogEntry = useCallback((entry: LogEntry) => {
    setState(prev => {
      const newLogs = [...prev.toolLogs, entry];
      // Keep only the most recent entries
      const trimmedLogs = newLogs.slice(-maxEntries);

      return {
        ...prev,
        toolLogs: trimmedLogs,
      };
    });
  }, [maxEntries]);

  useEffect(() => {
    if (!orchestrator) return;

    // Handle tool:start events
    const handleToolStart = (event: ToolCallStartEvent) => {
      if (taskId && event.taskId !== taskId) return;

      log('Tool start', { tool: event.toolName, callId: event.callId });

      // Parse timestamp if it comes as ISO string (from WebSocket)
      const timestamp = typeof event.timestamp === 'string'
        ? new Date(event.timestamp)
        : event.timestamp;

      // Parse startTime if it comes as ISO string (from WebSocket)
      const startTime = event.startTime ? (
        typeof event.startTime === 'string'
          ? new Date(event.startTime)
          : event.startTime
      ) : timestamp;

      // Create normalized event with parsed dates
      const normalizedEvent = {
        ...event,
        timestamp,
        startTime,
      };

      // Track active tool call
      setState(prev => {
        const newActiveToolCalls = new Map(prev.activeToolCalls);
        newActiveToolCalls.set(event.callId, normalizedEvent);
        return {
          ...prev,
          activeToolCalls: newActiveToolCalls,
        };
      });

      // Create log entry for tool start
      const logEntry: LogEntry = {
        id: generateLogId(),
        timestamp,
        level: 'info',
        message: `Started ${event.toolName}`,
        agent: 'system', // Could be enhanced to track which agent triggered the tool
        category: 'tool',
        data: {
          toolName: event.toolName,
          callId: event.callId,
          input: event.input,
          status: 'started',
          startTime, // Include parsed startTime
        },
      };

      addLogEntry(logEntry);
      updateStats({ total: 1 });
    };

    // Handle tool:progress events
    const handleToolProgress = (event: ToolCallProgressEvent) => {
      if (taskId && event.taskId !== taskId) return;

      log('Tool progress', { tool: event.toolName, callId: event.callId, progress: event.progress });

      // Parse timestamp if it comes as ISO string (from WebSocket)
      const timestamp = typeof event.timestamp === 'string'
        ? new Date(event.timestamp)
        : event.timestamp;

      // Create log entry for tool progress (only in verbose scenarios)
      if (event.progress.message) {
        const logEntry: LogEntry = {
          id: generateLogId(),
          timestamp,
          level: 'debug',
          message: `${event.toolName}: ${event.progress.message}`,
          agent: 'system',
          category: 'tool',
          data: {
            toolName: event.toolName,
            callId: event.callId,
            progress: event.progress,
            status: 'progress',
          },
        };

        addLogEntry(logEntry);
      }
    };

    // Handle tool:complete events
    const handleToolComplete = (event: ToolCallCompleteEvent) => {
      if (taskId && event.taskId !== taskId) return;

      log('Tool complete', {
        tool: event.toolName,
        callId: event.callId,
        success: event.result.success,
        duration: event.timing.duration
      });

      // Parse timestamp if it comes as ISO string (from WebSocket)
      const timestamp = typeof event.timestamp === 'string'
        ? new Date(event.timestamp)
        : event.timestamp;

      // Parse timing dates if they come as ISO strings (from WebSocket)
      const timing = {
        startTime: typeof event.timing.startTime === 'string'
          ? new Date(event.timing.startTime)
          : event.timing.startTime,
        endTime: typeof event.timing.endTime === 'string'
          ? new Date(event.timing.endTime)
          : event.timing.endTime,
        duration: event.timing.duration,
      };

      // Remove from active calls
      setState(prev => {
        const newActiveToolCalls = new Map(prev.activeToolCalls);
        newActiveToolCalls.delete(event.callId);
        return {
          ...prev,
          activeToolCalls: newActiveToolCalls,
        };
      });

      // Determine log level and message based on success
      const isSuccess = event.result.success;
      const level = isSuccess ? 'success' : 'error';
      const message = isSuccess
        ? `Completed ${event.toolName} (${formatDuration(timing.duration)})`
        : `Failed ${event.toolName}: ${event.result.error || 'Unknown error'}`;

      // Create log entry for tool completion
      const logEntry: LogEntry = {
        id: generateLogId(),
        timestamp: timing.endTime,
        level,
        message,
        agent: 'system',
        category: 'tool',
        duration: timing.duration,
        data: {
          toolName: event.toolName,
          callId: event.callId,
          result: event.result,
          timing, // Use normalized timing with parsed dates
          status: isSuccess ? 'completed' : 'failed',
        },
      };

      addLogEntry(logEntry);

      // Update statistics
      const statUpdate = isSuccess
        ? { successful: 1 }
        : { failed: 1 };
      updateStats(statUpdate, timing.duration);
    };

    // Register event listeners
    orchestrator.on('tool:start', handleToolStart);
    orchestrator.on('tool:progress', handleToolProgress);
    orchestrator.on('tool:complete', handleToolComplete);

    log('Tool event listeners registered');

    // Cleanup function
    return () => {
      orchestrator.off('tool:start', handleToolStart);
      orchestrator.off('tool:progress', handleToolProgress);
      orchestrator.off('tool:complete', handleToolComplete);
      log('Tool event listeners cleaned up');
    };
  }, [orchestrator, taskId, log, generateLogId, addLogEntry, updateStats]);

  return state;
}

// Helper function to format duration (re-export from core)
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}
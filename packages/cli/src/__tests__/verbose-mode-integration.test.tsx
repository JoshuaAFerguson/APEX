import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from './test-utils';
import { StatusBar } from '../ui/components/StatusBar';
import { AgentPanel, AgentInfo } from '../ui/components/agents/AgentPanel';
import { ActivityLog, LogEntry } from '../ui/components/ActivityLog';

// Mock necessary dependencies
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn(),
    useStdout: () => ({ stdout: { columns: 120 } }),
  };
});

vi.mock('../ui/hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: () => ({
    width: 120,
    height: 40,
    breakpoint: 'wide',
  }),
}));

vi.mock('../ui/hooks/useAgentHandoff.js', () => ({
  useAgentHandoff: () => ({
    isAnimating: false,
    previousAgent: null,
    currentAgent: null,
    progress: 0,
    isFading: false,
  }),
}));

vi.mock('../ui/hooks/useElapsedTime.js', () => ({
  useElapsedTime: () => '2m30s',
}));

vi.mock('../ui/context/ThemeContext.js', () => ({
  useThemeColors: () => ({
    muted: 'gray',
    info: 'blue',
    success: 'green',
    warning: 'yellow',
    error: 'red',
  }),
}));

describe('Verbose Mode Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-01T10:05:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('StatusBar verbose mode integration', () => {
    it('displays comprehensive verbose information with all components', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');

      render(
        <StatusBar
          displayMode="verbose"
          gitBranch="feature/verbose-mode"
          agent="developer"
          workflowStage="testing"
          model="sonnet-3.5"
          tokens={{ input: 15000, output: 25000 }}
          cost={1.2345}
          sessionCost={3.4567}
          sessionStartTime={startTime}
          apiUrl="http://localhost:4000"
          webUrl="http://localhost:3000"
          sessionName="Verbose Testing Session"
          subtaskProgress={{ completed: 3, total: 5 }}
          detailedTiming={{
            totalActiveTime: 180000, // 3 minutes
            totalIdleTime: 45000,    // 45 seconds
            currentStageElapsed: 120000, // 2 minutes
          }}
        />
      );

      // Verify verbose mode indicator
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();

      // Verify token breakdown (input→output + total)
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('15.0k→25.0k')).toBeInTheDocument();
      expect(screen.getByText('total:')).toBeInTheDocument();
      expect(screen.getByText('40.0k')).toBeInTheDocument();

      // Verify detailed timing information
      expect(screen.getByText('active:')).toBeInTheDocument();
      expect(screen.getByText('3m0s')).toBeInTheDocument();
      expect(screen.getByText('idle:')).toBeInTheDocument();
      expect(screen.getByText('45s')).toBeInTheDocument();
      expect(screen.getByText('stage:')).toBeInTheDocument();
      expect(screen.getByText('2m0s')).toBeInTheDocument();

      // Verify cost breakdown
      expect(screen.getByText('cost:')).toBeInTheDocument();
      expect(screen.getByText('$1.2345')).toBeInTheDocument();
      expect(screen.getByText('session:')).toBeInTheDocument();
      expect(screen.getByText('$3.4567')).toBeInTheDocument();

      // Verify all other information is still visible
      expect(screen.getByText('feature/verbose-mode')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('testing')).toBeInTheDocument();
      expect(screen.getByText('sonnet-3.5')).toBeInTheDocument();
      expect(screen.getByText('[3/5]')).toBeInTheDocument();
    });

    it('handles verbose mode with minimal data gracefully', () => {
      render(
        <StatusBar
          displayMode="verbose"
          tokens={{ input: 100, output: 200 }}
          cost={0.0001}
        />
      );

      // Should show verbose indicator
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();

      // Should show token breakdown even for small numbers
      expect(screen.getByText('100→200')).toBeInTheDocument();
      expect(screen.getByText('300')).toBeInTheDocument();

      // Should format very small costs correctly
      expect(screen.getByText('$0.0001')).toBeInTheDocument();
    });
  });

  describe('AgentPanel verbose mode integration', () => {
    it('displays debug information for active agents in verbose mode', () => {
      const agents: AgentInfo[] = [
        {
          name: 'planner',
          status: 'completed',
        },
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          progress: 75,
          startedAt: new Date('2023-01-01T10:02:00Z'),
          debugInfo: {
            tokensUsed: { input: 2500, output: 3500 },
            turnCount: 4,
            lastToolCall: 'Edit',
            errorCount: 1,
          },
        },
        {
          name: 'tester',
          status: 'waiting',
        },
      ];

      render(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Verify basic agent information
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Verify debug information for active agent only
      expect(screen.getByText('🔢 Tokens: 2500→3500')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 4')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: Edit')).toBeInTheDocument();
      expect(screen.getByText('❌ Errors: 1')).toBeInTheDocument();

      // Verify stage and progress are still visible
      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument();
    });

    it('shows no debug info for non-active agents in verbose mode', () => {
      const agents: AgentInfo[] = [
        {
          name: 'planner',
          status: 'completed',
          debugInfo: {
            tokensUsed: { input: 500, output: 300 },
            turnCount: 2,
          },
        },
        {
          name: 'tester',
          status: 'waiting',
          debugInfo: {
            tokensUsed: { input: 100, output: 50 },
            turnCount: 1,
          },
        },
      ];

      render(
        <AgentPanel
          agents={agents}
          currentAgent="planner"
          displayMode="verbose"
        />
      );

      // Only active agent's debug info should be visible
      // Since currentAgent is planner but status is completed, no debug info should show
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();
    });
  });

  describe('ActivityLog verbose mode integration', () => {
    it('shows debug level entries and detailed timestamps in verbose mode', () => {
      const entries: LogEntry[] = [
        {
          id: '1',
          timestamp: new Date('2023-01-01T10:00:00.123Z'),
          level: 'info',
          message: 'Task started',
          agent: 'developer',
        },
        {
          id: '2',
          timestamp: new Date('2023-01-01T10:01:00.456Z'),
          level: 'debug',
          message: 'Debug information',
          data: { step: 1, details: 'verbose data' },
        },
        {
          id: '3',
          timestamp: new Date('2023-01-01T10:02:00.789Z'),
          level: 'error',
          message: 'An error occurred',
          data: { code: 500 },
        },
      ];

      render(
        <ActivityLog
          entries={entries}
          displayMode="verbose"
          showTimestamps={true}
          showAgents={true}
        />
      );

      // Should show auto debug level indicator
      expect(screen.getByText('Level: debug+ (auto: verbose)')).toBeInTheDocument();

      // Should show all entries including debug
      expect(screen.getByText('Task started')).toBeInTheDocument();
      expect(screen.getByText('Debug information')).toBeInTheDocument();
      expect(screen.getByText('An error occurred')).toBeInTheDocument();

      // Should show milliseconds in timestamps
      expect(screen.getByText(/\[10:00:00\.123\]/)).toBeInTheDocument();
      expect(screen.getByText(/\[10:01:00\.456\]/)).toBeInTheDocument();
      expect(screen.getByText(/\[10:02:00\.789\]/)).toBeInTheDocument();

      // Should show data for all entries
      expect(screen.getByText('step: 1')).toBeInTheDocument();
      expect(screen.getByText('details: verbose data')).toBeInTheDocument();
      expect(screen.getByText('code: 500')).toBeInTheDocument();
    });

    it('filters debug entries in normal mode', () => {
      const entries: LogEntry[] = [
        {
          id: '1',
          timestamp: new Date('2023-01-01T10:00:00Z'),
          level: 'info',
          message: 'Info message',
        },
        {
          id: '2',
          timestamp: new Date('2023-01-01T10:01:00Z'),
          level: 'debug',
          message: 'Debug message',
        },
      ];

      render(
        <ActivityLog
          entries={entries}
          displayMode="normal"
        />
      );

      // Should show info level filter
      expect(screen.getByText('Level: info+')).toBeInTheDocument();
      expect(screen.queryByText('(auto: verbose)')).not.toBeInTheDocument();

      // Should show info but not debug
      expect(screen.getByText('Info message')).toBeInTheDocument();
      expect(screen.queryByText('Debug message')).not.toBeInTheDocument();
    });
  });

  describe('Cross-component verbose mode consistency', () => {
    it('maintains consistent display when multiple components use verbose mode', () => {
      const agents: AgentInfo[] = [
        {
          name: 'tester',
          status: 'active',
          stage: 'testing',
          debugInfo: {
            tokensUsed: { input: 800, output: 1200 },
            turnCount: 2,
            lastToolCall: 'Bash',
          },
        },
      ];

      const logEntries: LogEntry[] = [
        {
          id: '1',
          timestamp: new Date('2023-01-01T10:00:00.100Z'),
          level: 'debug',
          message: 'Running tests',
          agent: 'tester',
        },
      ];

      const { container } = render(
        <div>
          <StatusBar
            displayMode="verbose"
            agent="tester"
            workflowStage="testing"
            tokens={{ input: 800, output: 1200 }}
            cost={0.15}
          />
          <AgentPanel
            agents={agents}
            currentAgent="tester"
            displayMode="verbose"
          />
          <ActivityLog
            entries={logEntries}
            displayMode="verbose"
            showTimestamps={true}
            showAgents={true}
          />
        </div>
      );

      // All components should show verbose indicators/behavior
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument(); // StatusBar
      expect(screen.getByText('🔢 Tokens: 800→1200')).toBeInTheDocument(); // AgentPanel
      expect(screen.getByText('Level: debug+ (auto: verbose)')).toBeInTheDocument(); // ActivityLog

      // Token information should be consistent across components
      expect(screen.getByText('800→1200')).toBeInTheDocument(); // StatusBar breakdown
      expect(screen.getByText('2.0k')).toBeInTheDocument(); // StatusBar total

      // Agent information should be consistent
      expect(screen.getAllByText('tester')).toHaveLength(3); // StatusBar, AgentPanel, ActivityLog
      expect(screen.getByText('testing')).toBeInTheDocument(); // StatusBar and AgentPanel stage

      // Timestamps should show milliseconds
      expect(screen.getByText(/\.100/)).toBeInTheDocument();
    });

    it('handles mixed display modes gracefully', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            tokensUsed: { input: 1000, output: 1500 },
            turnCount: 3,
          },
        },
      ];

      render(
        <div>
          <StatusBar
            displayMode="verbose"
            tokens={{ input: 1000, output: 1500 }}
            cost={0.25}
          />
          <AgentPanel
            agents={agents}
            currentAgent="developer"
            displayMode="normal" // Different display mode
          />
        </div>
      );

      // StatusBar should show verbose mode
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();
      expect(screen.getByText('1.0k→1.5k')).toBeInTheDocument();

      // AgentPanel should not show debug info in normal mode
      expect(screen.queryByText('🔢 Tokens:')).not.toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument(); // But should still show agent
    });
  });

  describe('Performance and edge cases', () => {
    it('handles large amounts of data in verbose mode efficiently', () => {
      const manyAgents: AgentInfo[] = Array.from({ length: 10 }, (_, i) => ({
        name: `agent-${i}`,
        status: i === 5 ? 'active' : 'waiting' as const,
        debugInfo: i === 5 ? {
          tokensUsed: { input: 1000 * i, output: 1500 * i },
          turnCount: i + 1,
          lastToolCall: 'Task',
        } : undefined,
      }));

      const manyLogEntries: LogEntry[] = Array.from({ length: 50 }, (_, i) => ({
        id: `${i}`,
        timestamp: new Date(`2023-01-01T10:${i.toString().padStart(2, '0')}:00.${i.toString().padStart(3, '0')}Z`),
        level: i % 4 === 0 ? 'debug' : 'info' as const,
        message: `Log entry ${i}`,
        data: i % 5 === 0 ? { index: i, metadata: 'test' } : undefined,
      }));

      const renderStart = performance.now();

      render(
        <div>
          <StatusBar
            displayMode="verbose"
            tokens={{ input: 50000, output: 75000 }}
            cost={12.5}
            sessionCost={25.0}
          />
          <AgentPanel
            agents={manyAgents}
            currentAgent="agent-5"
            displayMode="verbose"
          />
          <ActivityLog
            entries={manyLogEntries}
            displayMode="verbose"
            maxEntries={20}
          />
        </div>
      );

      const renderTime = performance.now() - renderStart;

      // Should render efficiently (under 100ms for this amount of data)
      expect(renderTime).toBeLessThan(100);

      // Should show verbose indicators
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();
      expect(screen.getByText('Level: debug+ (auto: verbose)')).toBeInTheDocument();

      // Should show debug info for active agent
      expect(screen.getByText('🔢 Tokens: 5000→7500')).toBeInTheDocument();

      // Should handle large token numbers in StatusBar
      expect(screen.getByText('50.0k→75.0k')).toBeInTheDocument();
      expect(screen.getByText('125.0k')).toBeInTheDocument();
    });

    it('handles missing or undefined data gracefully in verbose mode', () => {
      const incompleteAgents: AgentInfo[] = [
        {
          name: 'incomplete-agent',
          status: 'active',
          debugInfo: {
            // Only partial debug info
            tokensUsed: { input: 100, output: 200 },
            // Missing other fields
          },
        },
      ];

      const incompleteLogEntries: LogEntry[] = [
        {
          id: '1',
          timestamp: new Date('2023-01-01T10:00:00Z'),
          level: 'info',
          message: 'Incomplete entry',
          // No data field
        },
      ];

      render(
        <div>
          <StatusBar
            displayMode="verbose"
            // Minimal props
            tokens={{ input: 100, output: 200 }}
          />
          <AgentPanel
            agents={incompleteAgents}
            currentAgent="incomplete-agent"
            displayMode="verbose"
          />
          <ActivityLog
            entries={incompleteLogEntries}
            displayMode="verbose"
          />
        </div>
      );

      // Should handle missing data gracefully
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();
      expect(screen.getByText('🔢 Tokens: 100→200')).toBeInTheDocument();
      expect(screen.queryByText('🔄 Turns:')).not.toBeInTheDocument(); // Missing field
      expect(screen.queryByText('🔧 Last tool:')).not.toBeInTheDocument(); // Missing field
    });
  });
});
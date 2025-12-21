import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { App, type AppProps, type AppState } from '../App.js';
import type { VerboseDebugData, DisplayMode } from '@apex/core';

// Mock the components to avoid rendering complexity in unit tests
vi.mock('../components/index.js', () => ({
  ActivityLog: vi.fn(({ entries, displayMode, title }) => (
    <div data-testid="activity-log">
      <div data-testid="activity-log-title">{title}</div>
      <div data-testid="activity-log-display-mode">{displayMode}</div>
      <div data-testid="activity-log-entries-count">{entries.length}</div>
    </div>
  )),
  Banner: vi.fn(() => <div data-testid="banner">Banner</div>),
  ServicesPanel: vi.fn(() => <div data-testid="services-panel">Services</div>),
  InputPrompt: vi.fn(() => <div data-testid="input-prompt">Input</div>),
  StatusBar: vi.fn(() => <div data-testid="status-bar">Status</div>),
  TaskProgress: vi.fn(() => <div data-testid="task-progress">Progress</div>),
  AgentPanel: vi.fn(() => <div data-testid="agent-panel">Agents</div>),
}));

describe('App verboseData Integration', () => {
  const createMockVerboseData = (): VerboseDebugData => ({
    agentTokens: {
      'test-agent': {
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreationInputTokens: 100,
        cacheReadInputTokens: 50,
      },
      'another-agent': {
        inputTokens: 2000,
        outputTokens: 800,
      },
    },
    timing: {
      stageStartTime: new Date('2023-01-01T10:00:00Z'),
      stageEndTime: new Date('2023-01-01T10:05:00Z'),
      stageDuration: 300000,
      agentResponseTimes: {
        'test-agent': 2000,
        'another-agent': 3500,
      },
      toolUsageTimes: {
        Read: 1000,
        Write: 750,
        Bash: 2000,
      },
    },
    agentDebug: {
      conversationLength: {
        'test-agent': 5,
        'another-agent': 8,
      },
      toolCallCounts: {
        'test-agent': { Read: 3, Write: 2 },
        'another-agent': { Write: 4, Bash: 1 },
      },
      errorCounts: {
        'test-agent': 0,
        'another-agent': 1,
      },
      retryAttempts: {
        'test-agent': 0,
        'another-agent': 1,
      },
    },
    metrics: {
      tokensPerSecond: 10.5,
      averageResponseTime: 2750,
      memoryUsage: 256000000,
      cpuUtilization: 25.5,
      toolEfficiency: {
        Read: 1.0,
        Write: 0.95,
        Bash: 0.87,
      },
    },
  });

  const createBaseAppState = (overrides: Partial<AppState> = {}): AppState => ({
    initialized: true,
    projectPath: '/test/project',
    config: null,
    orchestrator: null,
    messages: [],
    inputHistory: [],
    isProcessing: false,
    tokens: { input: 0, output: 0 },
    cost: 0,
    model: 'sonnet',
    displayMode: 'normal' as DisplayMode,
    previewMode: false,
    showThoughts: false,
    ...overrides,
  });

  const createMockAppProps = (
    initialState: AppState,
    overrides: Partial<AppProps> = {}
  ): AppProps => ({
    initialState,
    onCommand: vi.fn(),
    onTask: vi.fn(),
    onExit: vi.fn(),
    ...overrides,
  });

  describe('verboseData state field', () => {
    it('should handle initial state without verboseData', () => {
      const initialState = createBaseAppState();
      const props = createMockAppProps(initialState);

      render(<App {...props} />);

      expect(screen.getByTestId('banner')).toBeInTheDocument();
      expect(screen.queryByTestId('activity-log')).not.toBeInTheDocument();
    });

    it('should handle initial state with verboseData but normal display mode', () => {
      const mockVerboseData = createMockVerboseData();
      const initialState = createBaseAppState({
        verboseData: mockVerboseData,
        displayMode: 'normal',
      });
      const props = createMockAppProps(initialState);

      render(<App {...props} />);

      expect(screen.getByTestId('banner')).toBeInTheDocument();
      // ActivityLog should not be shown in normal mode
      expect(screen.queryByTestId('activity-log')).not.toBeInTheDocument();
    });

    it('should handle initial state with verboseData but compact display mode', () => {
      const mockVerboseData = createMockVerboseData();
      const initialState = createBaseAppState({
        verboseData: mockVerboseData,
        displayMode: 'compact',
      });
      const props = createMockAppProps(initialState);

      render(<App {...props} />);

      expect(screen.getByTestId('banner')).toBeInTheDocument();
      // ActivityLog should not be shown in compact mode
      expect(screen.queryByTestId('activity-log')).not.toBeInTheDocument();
    });

    it('should show ActivityLog when verboseData is present and displayMode is verbose', () => {
      const mockVerboseData = createMockVerboseData();
      const initialState = createBaseAppState({
        verboseData: mockVerboseData,
        displayMode: 'verbose',
        currentTask: {
          id: 'test-task-123',
          description: 'Test task for verbose data',
          workflow: 'test-workflow',
          status: 'running',
          createdAt: new Date(),
        },
      });
      const props = createMockAppProps(initialState);

      render(<App {...props} />);

      expect(screen.getByTestId('activity-log')).toBeInTheDocument();
      expect(screen.getByTestId('activity-log-title')).toHaveTextContent('Debug Activity Log');
      expect(screen.getByTestId('activity-log-display-mode')).toHaveTextContent('verbose');
    });

    it('should not show ActivityLog in verbose mode without currentTask', () => {
      const mockVerboseData = createMockVerboseData();
      const initialState = createBaseAppState({
        verboseData: mockVerboseData,
        displayMode: 'verbose',
        currentTask: undefined,
      });
      const props = createMockAppProps(initialState);

      render(<App {...props} />);

      expect(screen.queryByTestId('activity-log')).not.toBeInTheDocument();
    });

    it('should not show ActivityLog without verboseData even in verbose mode', () => {
      const initialState = createBaseAppState({
        verboseData: undefined,
        displayMode: 'verbose',
        currentTask: {
          id: 'test-task-123',
          description: 'Test task without verbose data',
          workflow: 'test-workflow',
          status: 'running',
          createdAt: new Date(),
        },
      });
      const props = createMockAppProps(initialState);

      render(<App {...props} />);

      expect(screen.queryByTestId('activity-log')).not.toBeInTheDocument();
    });
  });

  describe('displayMode integration', () => {
    const testDisplayModes: DisplayMode[] = ['normal', 'compact', 'verbose'];

    testDisplayModes.forEach((displayMode) => {
      it(`should pass displayMode "${displayMode}" to ActivityLog when shown`, () => {
        const mockVerboseData = createMockVerboseData();
        const initialState = createBaseAppState({
          verboseData: mockVerboseData,
          displayMode,
          currentTask: {
            id: 'test-task-123',
            description: 'Test task',
            workflow: 'test-workflow',
            status: 'running',
            createdAt: new Date(),
          },
        });
        const props = createMockAppProps(initialState);

        render(<App {...props} />);

        if (displayMode === 'verbose') {
          expect(screen.getByTestId('activity-log-display-mode')).toHaveTextContent(displayMode);
        } else {
          expect(screen.queryByTestId('activity-log')).not.toBeInTheDocument();
        }
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty verboseData', () => {
      const emptyVerboseData: VerboseDebugData = {
        agentTokens: {},
        timing: {
          stageStartTime: new Date(),
          agentResponseTimes: {},
          toolUsageTimes: {},
        },
        agentDebug: {
          conversationLength: {},
          toolCallCounts: {},
          errorCounts: {},
          retryAttempts: {},
        },
        metrics: {
          tokensPerSecond: 0,
          averageResponseTime: 0,
          toolEfficiency: {},
        },
      };

      const initialState = createBaseAppState({
        verboseData: emptyVerboseData,
        displayMode: 'verbose',
        currentTask: {
          id: 'test-task-123',
          description: 'Test task with empty verbose data',
          workflow: 'test-workflow',
          status: 'running',
          createdAt: new Date(),
        },
      });
      const props = createMockAppProps(initialState);

      render(<App {...props} />);

      expect(screen.getByTestId('activity-log')).toBeInTheDocument();
      // Should show 0 entries for empty data
      expect(screen.getByTestId('activity-log-entries-count')).toHaveTextContent('0');
    });

    it('should handle verboseData with partial data', () => {
      const partialVerboseData: VerboseDebugData = {
        agentTokens: {
          'single-agent': {
            inputTokens: 100,
            outputTokens: 50,
          },
        },
        timing: {
          stageStartTime: new Date(),
          stageDuration: 5000,
          agentResponseTimes: { 'single-agent': 1000 },
          toolUsageTimes: { Read: 500 },
        },
        agentDebug: {
          conversationLength: { 'single-agent': 3 },
          toolCallCounts: { 'single-agent': { Read: 2 } },
          errorCounts: {},
          retryAttempts: {},
        },
        metrics: {
          tokensPerSecond: 5.0,
          averageResponseTime: 1000,
          toolEfficiency: { Read: 1.0 },
        },
      };

      const initialState = createBaseAppState({
        verboseData: partialVerboseData,
        displayMode: 'verbose',
        currentTask: {
          id: 'test-task-123',
          description: 'Test task with partial verbose data',
          workflow: 'test-workflow',
          status: 'running',
          createdAt: new Date(),
        },
      });
      const props = createMockAppProps(initialState);

      render(<App {...props} />);

      expect(screen.getByTestId('activity-log')).toBeInTheDocument();
      // Should generate some entries from the partial data
      const entriesCountElement = screen.getByTestId('activity-log-entries-count');
      const entriesCount = parseInt(entriesCountElement.textContent || '0');
      expect(entriesCount).toBeGreaterThan(0);
    });
  });

  describe('ActivityLog props validation', () => {
    it('should pass correct props to ActivityLog component', () => {
      const mockVerboseData = createMockVerboseData();
      const initialState = createBaseAppState({
        verboseData: mockVerboseData,
        displayMode: 'verbose',
        currentTask: {
          id: 'test-task-123',
          description: 'Test task',
          workflow: 'test-workflow',
          status: 'running',
          createdAt: new Date(),
        },
      });
      const props = createMockAppProps(initialState);

      render(<App {...props} />);

      const activityLog = screen.getByTestId('activity-log');
      expect(activityLog).toBeInTheDocument();

      // Check that essential props are set
      expect(screen.getByTestId('activity-log-title')).toHaveTextContent('Debug Activity Log');
      expect(screen.getByTestId('activity-log-display-mode')).toHaveTextContent('verbose');

      // Entries should be generated from verboseData
      const entriesCountElement = screen.getByTestId('activity-log-entries-count');
      const entriesCount = parseInt(entriesCountElement.textContent || '0');
      expect(entriesCount).toBeGreaterThan(0);
    });
  });
});
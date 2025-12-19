import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { App, type AppProps, type AppState } from '../App.js';
import type { VerboseDebugData, DisplayMode } from '@apexcli/core';

// Create a more detailed mock for ActivityLog to test prop passing
const mockActivityLog = vi.fn();

vi.mock('../components/index.js', () => ({
  ActivityLog: mockActivityLog,
  Banner: vi.fn(() => <div data-testid="banner">Banner</div>),
  ServicesPanel: vi.fn(() => <div data-testid="services-panel">Services</div>),
  InputPrompt: vi.fn(() => <div data-testid="input-prompt">Input</div>),
  StatusBar: vi.fn(() => <div data-testid="status-bar">Status</div>),
  TaskProgress: vi.fn(() => <div data-testid="task-progress">Progress</div>),
  AgentPanel: vi.fn(() => <div data-testid="agent-panel">Agents</div>),
}));

describe('App ActivityLog DisplayMode Integration', () => {
  const createMockVerboseData = (): VerboseDebugData => ({
    agentTokens: {
      'test-agent': {
        inputTokens: 1000,
        outputTokens: 500,
        estimatedCost: 0.15,
      },
    },
    timing: {
      stageStartTime: new Date('2023-01-01T10:00:00Z'),
      stageEndTime: new Date('2023-01-01T10:05:00Z'),
      stageDuration: 300000,
      agentResponseTimes: {
        'test-agent': 2000,
      },
      toolUsageTimes: {
        'Read': 1000,
        'Write': 750,
      },
    },
    agentDebug: {
      conversationLength: {
        'test-agent': 5,
      },
      toolCallCounts: {
        'test-agent': { Read: 3, Write: 2 },
      },
      errorCounts: {},
      retryAttempts: {},
    },
    metrics: {
      tokensPerSecond: 10.5,
      averageResponseTime: 2000,
      memoryUsage: 256000000,
      cpuUtilization: 25.0,
      toolEfficiency: {
        'Read': 0.95,
        'Write': 0.87,
      },
    },
  });

  const createBaseAppState = (overrides: Partial<AppState> = {}): AppState => ({
    initialized: true,
    projectPath: '/test/project',
    config: null,
    orchestrator: null,
    currentTask: {
      id: 'test-task-123',
      description: 'Test task for ActivityLog displayMode testing',
      workflow: 'test-workflow',
      status: 'running',
      createdAt: new Date(),
    },
    messages: [],
    inputHistory: [],
    isProcessing: false,
    tokens: { input: 0, output: 0 },
    cost: 0,
    model: 'sonnet',
    displayMode: 'verbose' as DisplayMode,
    previewMode: false,
    showThoughts: false,
    verboseData: createMockVerboseData(),
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

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up the ActivityLog mock to return a simple div
    mockActivityLog.mockImplementation((props) => (
      <div data-testid="activity-log" data-display-mode={props.displayMode}>
        ActivityLog with displayMode: {props.displayMode}
      </div>
    ));
  });

  describe('displayMode prop passing to ActivityLog', () => {
    const displayModes: DisplayMode[] = ['normal', 'compact', 'verbose'];

    displayModes.forEach((displayMode) => {
      it(`should pass displayMode "${displayMode}" to ActivityLog component when currentTask and verboseData exist`, () => {
        const initialState = createBaseAppState({
          displayMode,
        });
        const props = createMockAppProps(initialState);

        render(<App {...props} />);

        if (displayMode === 'verbose') {
          // In verbose mode, ActivityLog should be rendered and receive the correct displayMode
          expect(mockActivityLog).toHaveBeenCalledWith(
            expect.objectContaining({
              displayMode: 'verbose',
            }),
            expect.any(Object)
          );
          expect(screen.getByTestId('activity-log')).toBeInTheDocument();
        } else {
          // In normal and compact modes, ActivityLog should not be rendered
          expect(mockActivityLog).not.toHaveBeenCalled();
          expect(screen.queryByTestId('activity-log')).not.toBeInTheDocument();
        }
      });
    });

    it('should pass all required props to ActivityLog component in verbose mode', () => {
      const mockVerboseData = createMockVerboseData();
      const initialState = createBaseAppState({
        displayMode: 'verbose',
        verboseData: mockVerboseData,
      });
      const props = createMockAppProps(initialState);

      render(<App {...props} />);

      // Verify ActivityLog was called with all expected props
      expect(mockActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          entries: expect.any(Array),
          displayMode: 'verbose',
          title: 'Debug Activity Log',
          maxEntries: 50,
          showTimestamps: true,
          showAgents: true,
          allowCollapse: true,
          filterLevel: 'debug',
        }),
        expect.any(Object)
      );

      // Verify the entries array contains converted verbose data
      const callArgs = mockActivityLog.mock.calls[0][0];
      expect(callArgs.entries).toHaveLength.greaterThan(0);

      // Verify some expected entry types are present
      const entryMessages = callArgs.entries.map((entry: any) => entry.message);
      expect(entryMessages.some((msg: string) => msg.includes('Stage completed in'))).toBe(true);
      expect(entryMessages.some((msg: string) => msg.includes('Agent response time'))).toBe(true);
      expect(entryMessages.some((msg: string) => msg.includes('Processing rate'))).toBe(true);
      expect(entryMessages.some((msg: string) => msg.includes('Token usage'))).toBe(true);
      expect(entryMessages.some((msg: string) => msg.includes('Tool'))).toBe(true);
    });

    it('should not render ActivityLog when verboseData is undefined even in verbose mode', () => {
      const initialState = createBaseAppState({
        displayMode: 'verbose',
        verboseData: undefined,
      });
      const props = createMockAppProps(initialState);

      render(<App {...props} />);

      expect(mockActivityLog).not.toHaveBeenCalled();
      expect(screen.queryByTestId('activity-log')).not.toBeInTheDocument();
    });

    it('should not render ActivityLog when currentTask is undefined even in verbose mode', () => {
      const initialState = createBaseAppState({
        displayMode: 'verbose',
        verboseData: createMockVerboseData(),
        currentTask: undefined,
      });
      const props = createMockAppProps(initialState);

      render(<App {...props} />);

      expect(mockActivityLog).not.toHaveBeenCalled();
      expect(screen.queryByTestId('activity-log')).not.toBeInTheDocument();
    });

    it('should pass updated displayMode when state changes', () => {
      const initialState = createBaseAppState({
        displayMode: 'verbose',
      });
      const props = createMockAppProps(initialState);

      const { rerender } = render(<App {...props} />);

      // Verify initial call with verbose mode
      expect(mockActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          displayMode: 'verbose',
        }),
        expect.any(Object)
      );

      // Clear previous calls
      mockActivityLog.mockClear();

      // Update to normal mode
      const updatedState = createBaseAppState({
        displayMode: 'normal',
      });
      const updatedProps = createMockAppProps(updatedState);

      rerender(<App {...updatedProps} />);

      // ActivityLog should not be called in normal mode
      expect(mockActivityLog).not.toHaveBeenCalled();
    });
  });

  describe('ActivityLog conditional rendering logic', () => {
    it('should render ActivityLog only when all conditions are met: verbose mode, currentTask, and verboseData', () => {
      const testCases = [
        {
          name: 'All conditions met',
          state: {
            displayMode: 'verbose' as DisplayMode,
            currentTask: {
              id: 'task-1',
              description: 'Test',
              workflow: 'test',
              status: 'running' as const,
              createdAt: new Date(),
            },
            verboseData: createMockVerboseData(),
          },
          shouldRender: true,
        },
        {
          name: 'Missing verboseData',
          state: {
            displayMode: 'verbose' as DisplayMode,
            currentTask: {
              id: 'task-1',
              description: 'Test',
              workflow: 'test',
              status: 'running' as const,
              createdAt: new Date(),
            },
            verboseData: undefined,
          },
          shouldRender: false,
        },
        {
          name: 'Missing currentTask',
          state: {
            displayMode: 'verbose' as DisplayMode,
            currentTask: undefined,
            verboseData: createMockVerboseData(),
          },
          shouldRender: false,
        },
        {
          name: 'Wrong display mode (normal)',
          state: {
            displayMode: 'normal' as DisplayMode,
            currentTask: {
              id: 'task-1',
              description: 'Test',
              workflow: 'test',
              status: 'running' as const,
              createdAt: new Date(),
            },
            verboseData: createMockVerboseData(),
          },
          shouldRender: false,
        },
        {
          name: 'Wrong display mode (compact)',
          state: {
            displayMode: 'compact' as DisplayMode,
            currentTask: {
              id: 'task-1',
              description: 'Test',
              workflow: 'test',
              status: 'running' as const,
              createdAt: new Date(),
            },
            verboseData: createMockVerboseData(),
          },
          shouldRender: false,
        },
      ];

      testCases.forEach(({ name, state, shouldRender }) => {
        mockActivityLog.mockClear();

        const appState = createBaseAppState(state);
        const appProps = createMockAppProps(appState);

        render(<App {...appProps} />);

        if (shouldRender) {
          expect(mockActivityLog).toHaveBeenCalled();
        } else {
          expect(mockActivityLog).not.toHaveBeenCalled();
        }
      });
    });

    it('should properly handle empty verboseData without crashing', () => {
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
        displayMode: 'verbose',
        verboseData: emptyVerboseData,
      });
      const props = createMockAppProps(initialState);

      expect(() => render(<App {...props} />)).not.toThrow();

      // ActivityLog should still be called, but with an empty entries array
      expect(mockActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          entries: [],
          displayMode: 'verbose',
        }),
        expect.any(Object)
      );
    });
  });

  describe('ActivityLog prop consistency', () => {
    it('should maintain consistent prop structure across different verboseData states', () => {
      const testVerboseData = [
        // Minimal data
        {
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
        },
        // Full data
        createMockVerboseData(),
      ];

      testVerboseData.forEach((verboseData) => {
        mockActivityLog.mockClear();

        const initialState = createBaseAppState({
          displayMode: 'verbose',
          verboseData,
        });
        const props = createMockAppProps(initialState);

        render(<App {...props} />);

        // Verify consistent prop structure regardless of data content
        expect(mockActivityLog).toHaveBeenCalledWith(
          expect.objectContaining({
            entries: expect.any(Array),
            displayMode: 'verbose',
            title: 'Debug Activity Log',
            maxEntries: 50,
            showTimestamps: true,
            showAgents: true,
            allowCollapse: true,
            filterLevel: 'debug',
          }),
          expect.any(Object)
        );
      });
    });
  });
});
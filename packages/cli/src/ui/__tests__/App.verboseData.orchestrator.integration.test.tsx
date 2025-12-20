import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App, type AppProps, type AppState } from '../App.js';
import type { VerboseDebugData, DisplayMode, ApexConfig, Task } from '@apexcli/core';
import type { ApexOrchestrator } from '@apex/orchestrator';
import { EventEmitter } from 'events';

// Mock the components to focus on verboseData behavior
vi.mock('../components/index.js', () => ({
  ActivityLog: vi.fn(({ entries, displayMode, title }) => (
    <div data-testid="activity-log">
      <div data-testid="activity-log-title">{title}</div>
      <div data-testid="activity-log-display-mode">{displayMode}</div>
      <div data-testid="activity-log-entries-count">{entries.length}</div>
      {entries.map((entry, index) => (
        <div key={entry.id} data-testid={`activity-log-entry-${index}`}>
          {entry.message}
        </div>
      ))}
    </div>
  )),
  Banner: vi.fn(() => <div data-testid="banner">Banner</div>),
  ServicesPanel: vi.fn(() => <div data-testid="services-panel">Services</div>),
  InputPrompt: vi.fn(() => <div data-testid="input-prompt">Input</div>),
  StatusBar: vi.fn(() => <div data-testid="status-bar">Status</div>),
  TaskProgress: vi.fn(() => <div data-testid="task-progress">Progress</div>),
  AgentPanel: vi.fn(() => <div data-testid="agent-panel">Agents</div>),
}));

describe('App VerboseData Orchestrator Integration', () => {
  let mockOrchestrator: ApexOrchestrator & EventEmitter;
  let mockGlobalApp: {
    updateState: (updates: Partial<AppState>) => void;
    addMessage: (message: any) => void;
    getState: () => AppState;
  };

  const createMockTask = (): Task => ({
    id: 'test-task-123',
    description: 'Test task for verboseData integration',
    workflow: 'test-workflow',
    status: 'running',
    createdAt: new Date(),
  });

  const createBaseAppState = (overrides: Partial<AppState> = {}): AppState => ({
    initialized: true,
    projectPath: '/test/project',
    config: null,
    orchestrator: mockOrchestrator,
    currentTask: createMockTask(),
    messages: [],
    inputHistory: [],
    isProcessing: false,
    tokens: { input: 0, output: 0 },
    cost: 0,
    model: 'sonnet',
    displayMode: 'verbose' as DisplayMode,
    previewMode: false,
    showThoughts: false,
    verboseData: undefined,
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
    // Create a mock orchestrator with EventEmitter capabilities
    mockOrchestrator = new EventEmitter() as ApexOrchestrator & EventEmitter;

    // Mock the global app object
    mockGlobalApp = {
      updateState: vi.fn(),
      addMessage: vi.fn(),
      getState: vi.fn(),
    };

    // Reset global before each test
    (globalThis as any).__apexApp = mockGlobalApp;
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete (globalThis as any).__apexApp;
  });

  describe('orchestrator event handling for verboseData', () => {
    it('should update verboseData when task:stage-changed event is emitted', async () => {
      const initialState = createBaseAppState();
      const props = createMockAppProps(initialState);

      render(<App {...props} />);

      // Wait for App to set up global handlers
      await waitFor(() => {
        expect((globalThis as any).__apexApp).toBeDefined();
      });

      const mockVerboseData: VerboseDebugData = {
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
            'test-agent': 2500,
          },
          toolUsageTimes: {
            'Read': 1000,
            'Write': 750,
          },
        },
        agentDebug: {
          conversationLength: {
            'test-agent': 8,
          },
          toolCallCounts: {
            'test-agent': { Read: 3, Write: 2 },
          },
          errorCounts: {},
          retryAttempts: {},
        },
        metrics: {
          tokensPerSecond: 12.5,
          averageResponseTime: 2250,
          memoryUsage: 256000000,
          cpuUtilization: 35.2,
          toolEfficiency: {
            'Read': 0.95,
            'Write': 0.87,
          },
        },
      };

      // Simulate orchestrator emitting a task:stage-changed event with verbose data
      mockOrchestrator.emit('task:stage-changed', {
        taskId: 'test-task-123',
        stage: 'implementation',
        status: 'running',
        verboseData: mockVerboseData,
      });

      // Verify that updateState was called with the verboseData
      await waitFor(() => {
        expect(mockGlobalApp.updateState).toHaveBeenCalledWith(
          expect.objectContaining({
            verboseData: mockVerboseData,
          })
        );
      });
    });

    it('should handle task:token-usage events and update verboseData', async () => {
      const initialState = createBaseAppState();
      const props = createMockAppProps(initialState);

      render(<App {...props} />);

      await waitFor(() => {
        expect((globalThis as any).__apexApp).toBeDefined();
      });

      // Simulate token usage event
      mockOrchestrator.emit('task:token-usage', {
        taskId: 'test-task-123',
        agent: 'developer',
        usage: {
          inputTokens: 500,
          outputTokens: 250,
          estimatedCost: 0.075,
        },
      });

      // Verify that updateState was called to update token information
      await waitFor(() => {
        expect(mockGlobalApp.updateState).toHaveBeenCalledWith(
          expect.objectContaining({
            tokens: expect.any(Object),
          })
        );
      });
    });

    it('should handle task:tool-call events and track tool usage', async () => {
      const initialState = createBaseAppState();
      const props = createMockAppProps(initialState);

      render(<App {...props} />);

      await waitFor(() => {
        expect((globalThis as any).__apexApp).toBeDefined();
      });

      // Simulate tool call event
      mockOrchestrator.emit('task:tool-call', {
        taskId: 'test-task-123',
        agent: 'developer',
        toolName: 'Read',
        toolInput: { file_path: '/test/file.txt' },
        status: 'success',
        duration: 1500,
        output: 'File contents...',
      });

      // Verify that addMessage was called with tool information
      await waitFor(() => {
        expect(mockGlobalApp.addMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'tool',
            toolName: 'Read',
            toolInput: { file_path: '/test/file.txt' },
            toolStatus: 'success',
            toolDuration: 1500,
            toolOutput: 'File contents...',
          })
        );
      });
    });

    it('should handle task:error events and track error information', async () => {
      const initialState = createBaseAppState();
      const props = createMockAppProps(initialState);

      render(<App {...props} />);

      await waitFor(() => {
        expect((globalThis as any).__apexApp).toBeDefined();
      });

      // Simulate error event
      mockOrchestrator.emit('task:error', {
        taskId: 'test-task-123',
        agent: 'tester',
        error: {
          message: 'Test execution failed',
          code: 'TEST_FAILED',
        },
        stage: 'testing',
      });

      // Verify that addMessage was called with error information
      await waitFor(() => {
        expect(mockGlobalApp.addMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
            agent: 'tester',
            content: expect.stringContaining('Test execution failed'),
          })
        );
      });
    });

    it('should handle multiple orchestrator events and accumulate verboseData', async () => {
      const initialState = createBaseAppState();
      const props = createMockAppProps(initialState);

      render(<App {...props} />);

      await waitFor(() => {
        expect((globalThis as any).__apexApp).toBeDefined();
      });

      // Emit multiple events to simulate a full task lifecycle
      const events = [
        {
          name: 'task:stage-changed',
          data: {
            taskId: 'test-task-123',
            stage: 'planning',
            status: 'running',
            verboseData: {
              agentTokens: {
                'planner': {
                  inputTokens: 200,
                  outputTokens: 100,
                },
              },
              timing: {
                stageStartTime: new Date(),
                agentResponseTimes: { 'planner': 1000 },
                toolUsageTimes: {},
              },
              agentDebug: {
                conversationLength: { 'planner': 2 },
                toolCallCounts: {},
                errorCounts: {},
                retryAttempts: {},
              },
              metrics: {
                tokensPerSecond: 5.0,
                averageResponseTime: 1000,
                toolEfficiency: {},
              },
            },
          },
        },
        {
          name: 'task:token-usage',
          data: {
            taskId: 'test-task-123',
            agent: 'planner',
            usage: {
              inputTokens: 50,
              outputTokens: 25,
            },
          },
        },
        {
          name: 'task:tool-call',
          data: {
            taskId: 'test-task-123',
            agent: 'planner',
            toolName: 'Read',
            status: 'success',
            duration: 800,
          },
        },
      ];

      // Emit events sequentially
      for (const event of events) {
        mockOrchestrator.emit(event.name, event.data);
      }

      // Verify that updateState and addMessage were called for each event
      await waitFor(() => {
        expect(mockGlobalApp.updateState).toHaveBeenCalledTimes(2); // stage-changed and token-usage
        expect(mockGlobalApp.addMessage).toHaveBeenCalledTimes(1); // tool-call
      });
    });
  });

  describe('verboseData integration with ActivityLog display', () => {
    it('should display ActivityLog when verboseData is populated and display mode is verbose', async () => {
      const mockVerboseData: VerboseDebugData = {
        agentTokens: {
          'developer': {
            inputTokens: 1000,
            outputTokens: 500,
          },
        },
        timing: {
          stageStartTime: new Date(),
          stageDuration: 5000,
          agentResponseTimes: { 'developer': 2000 },
          toolUsageTimes: { 'Read': 1000 },
        },
        agentDebug: {
          conversationLength: {},
          toolCallCounts: {},
          errorCounts: {},
          retryAttempts: {},
        },
        metrics: {
          tokensPerSecond: 10.0,
          averageResponseTime: 2000,
          toolEfficiency: { 'Read': 0.95 },
        },
      };

      const initialState = createBaseAppState({
        verboseData: mockVerboseData,
        displayMode: 'verbose',
      });
      const props = createMockAppProps(initialState);

      render(<App {...props} />);

      // Verify ActivityLog is displayed
      expect(screen.getByTestId('activity-log')).toBeInTheDocument();
      expect(screen.getByTestId('activity-log-title')).toHaveTextContent('Debug Activity Log');
      expect(screen.getByTestId('activity-log-display-mode')).toHaveTextContent('verbose');

      // Verify that log entries were generated from verboseData
      const entriesCount = parseInt(
        screen.getByTestId('activity-log-entries-count').textContent || '0'
      );
      expect(entriesCount).toBeGreaterThan(0);

      // Verify specific log entries are present
      expect(screen.getByText('Stage completed in 5000ms')).toBeInTheDocument();
      expect(screen.getByText('Agent response time: 2000ms')).toBeInTheDocument();
      expect(screen.getByText('Processing rate: 10.00 tokens/sec')).toBeInTheDocument();
      expect(screen.getByText('Tool Read used for 1000ms')).toBeInTheDocument();
    });

    it('should not display ActivityLog in verbose mode without currentTask', async () => {
      const mockVerboseData: VerboseDebugData = {
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
        verboseData: mockVerboseData,
        displayMode: 'verbose',
        currentTask: undefined, // No current task
      });
      const props = createMockAppProps(initialState);

      render(<App {...props} />);

      // ActivityLog should not be displayed without a current task
      expect(screen.queryByTestId('activity-log')).not.toBeInTheDocument();
    });

    it('should respond to real-time verboseData updates', async () => {
      const initialState = createBaseAppState({
        verboseData: undefined,
        displayMode: 'verbose',
      });
      const props = createMockAppProps(initialState);

      const { rerender } = render(<App {...props} />);

      // Initially no ActivityLog
      expect(screen.queryByTestId('activity-log')).not.toBeInTheDocument();

      // Update with verboseData
      const mockVerboseData: VerboseDebugData = {
        agentTokens: {
          'real-time-agent': {
            inputTokens: 100,
            outputTokens: 50,
          },
        },
        timing: {
          stageStartTime: new Date(),
          agentResponseTimes: { 'real-time-agent': 1500 },
          toolUsageTimes: {},
        },
        agentDebug: {
          conversationLength: {},
          toolCallCounts: {},
          errorCounts: {},
          retryAttempts: {},
        },
        metrics: {
          tokensPerSecond: 8.0,
          averageResponseTime: 1500,
          toolEfficiency: {},
        },
      };

      const updatedState = createBaseAppState({
        verboseData: mockVerboseData,
        displayMode: 'verbose',
      });
      const updatedProps = createMockAppProps(updatedState);

      rerender(<App {...updatedProps} />);

      // Now ActivityLog should be displayed
      await waitFor(() => {
        expect(screen.getByTestId('activity-log')).toBeInTheDocument();
      });

      expect(screen.getByText('Agent response time: 1500ms')).toBeInTheDocument();
      expect(screen.getByText('Processing rate: 8.00 tokens/sec')).toBeInTheDocument();
    });

    it('should handle verboseData updates with incremental changes', async () => {
      const initialVerboseData: VerboseDebugData = {
        agentTokens: {
          'agent1': {
            inputTokens: 100,
            outputTokens: 50,
          },
        },
        timing: {
          stageStartTime: new Date(),
          agentResponseTimes: { 'agent1': 1000 },
          toolUsageTimes: {},
        },
        agentDebug: {
          conversationLength: {},
          toolCallCounts: {},
          errorCounts: {},
          retryAttempts: {},
        },
        metrics: {
          tokensPerSecond: 5.0,
          averageResponseTime: 1000,
          toolEfficiency: {},
        },
      };

      const initialState = createBaseAppState({
        verboseData: initialVerboseData,
        displayMode: 'verbose',
      });
      const props = createMockAppProps(initialState);

      const { rerender } = render(<App {...props} />);

      // Verify initial state
      expect(screen.getByTestId('activity-log')).toBeInTheDocument();
      expect(screen.getByText('Agent response time: 1000ms')).toBeInTheDocument();

      // Update with additional data
      const updatedVerboseData: VerboseDebugData = {
        ...initialVerboseData,
        agentTokens: {
          ...initialVerboseData.agentTokens,
          'agent2': {
            inputTokens: 200,
            outputTokens: 100,
          },
        },
        timing: {
          ...initialVerboseData.timing,
          agentResponseTimes: {
            ...initialVerboseData.timing.agentResponseTimes,
            'agent2': 1500,
          },
          toolUsageTimes: {
            'Read': 800,
          },
        },
      };

      const updatedState = createBaseAppState({
        verboseData: updatedVerboseData,
        displayMode: 'verbose',
      });
      const updatedProps = createMockAppProps(updatedState);

      rerender(<App {...updatedProps} />);

      // Verify updated state shows both agents
      await waitFor(() => {
        expect(screen.getByText('Agent response time: 1000ms')).toBeInTheDocument();
        expect(screen.getByText('Agent response time: 1500ms')).toBeInTheDocument();
        expect(screen.getByText('Tool Read used for 800ms')).toBeInTheDocument();
      });

      // Verify entries count increased
      const entriesCount = parseInt(
        screen.getByTestId('activity-log-entries-count').textContent || '0'
      );
      expect(entriesCount).toBeGreaterThan(3); // Should have multiple entries now
    });
  });
});
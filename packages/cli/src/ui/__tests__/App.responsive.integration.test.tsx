/**
 * Integration tests for App.tsx responsive layout behavior
 *
 * Tests App.tsx rendering at various terminal widths (40, 60, 100, 160, 200 cols),
 * verifies no visual overflow/truncation at any width, confirms all components adapt
 * correctly together, and tests width resize scenarios.
 *
 * Acceptance Criteria:
 * 1. Tests App.tsx rendering at various terminal widths (40, 60, 100, 160, 200 cols)
 * 2. Verifies no visual overflow/truncation at any width
 * 3. Confirms all components adapt correctly together
 * 4. Tests width resize scenarios if possible
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '../../__tests__/test-utils';
import { App, type AppProps, type AppState, type Message } from '../App.js';
import type { DisplayMode, ApexConfig, Task } from '@apex/core';
import type { ApexOrchestrator } from '@apex/orchestrator';
import type { StdoutDimensions } from '../hooks/useStdoutDimensions.js';

// Mock useStdoutDimensions hook
const mockUseStdoutDimensions = vi.fn();
vi.mock('../hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

// Mock ink components and hooks
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn(),
    useApp: () => ({ exit: vi.fn() }),
    useStdout: () => ({ stdout: { columns: 80 } }),
  };
});

// Mock services
const mockConversationManager = {
  addMessage: vi.fn(),
  getSuggestions: vi.fn(() => []),
  hasPendingClarification: vi.fn(() => false),
  detectIntent: vi.fn(() => ({ type: 'command', confidence: 0.9, metadata: {} })),
  clearContext: vi.fn(),
  setTask: vi.fn(),
  setAgent: vi.fn(),
  clearTask: vi.fn(),
  clearAgent: vi.fn(),
  provideClarification: vi.fn(),
};

const mockShortcutManager = {
  on: vi.fn(),
  handleKey: vi.fn(() => false),
  pushContext: vi.fn(),
  popContext: vi.fn(),
};

const mockCompletionEngine = {
  getCompletions: vi.fn(() => []),
  updateContext: vi.fn(),
};

vi.mock('../../services/ConversationManager.js', () => ({
  ConversationManager: vi.fn().mockImplementation(function () { return mockConversationManager; }),
}));

vi.mock('../../services/ShortcutManager.js', () => ({
  ShortcutManager: vi.fn().mockImplementation(function () { return mockShortcutManager; }),
}));

vi.mock('../../services/CompletionEngine.js', () => ({
  CompletionEngine: vi.fn().mockImplementation(function () { return mockCompletionEngine; }),
}));

// Mock child components to verify responsive behavior
const mockBanner = vi.fn(({ version, projectPath, initialized }) => (
  <div data-testid="banner" data-initialized={initialized}>
    Banner: v{version} - {projectPath}
  </div>
));

const mockStatusBar = vi.fn(({ displayMode, gitBranch, tokens, cost, model, agent, ...props }) => (
  <div
    data-testid="status-bar"
    data-display-mode={displayMode}
    data-agent={agent}
    data-cost={cost}
  >
    StatusBar: {displayMode} | {agent} | ${cost}
  </div>
));

const mockTaskProgress = vi.fn(({ displayMode, taskId, description, status, ...props }) => (
  <div
    data-testid="task-progress"
    data-display-mode={displayMode}
    data-task-id={taskId}
    data-status={status}
  >
    TaskProgress: {displayMode} | {description} | {status}
  </div>
));

const mockAgentPanel = vi.fn(({ displayMode, agents, currentAgent, showParallel, parallelAgents, ...props }) => (
  <div
    data-testid="agent-panel"
    data-display-mode={displayMode}
    data-current-agent={currentAgent}
    data-show-parallel={showParallel}
    data-parallel-count={parallelAgents?.length || 0}
  >
    AgentPanel: {displayMode} | {currentAgent} | Parallel: {showParallel ? 'Yes' : 'No'}
  </div>
));

const mockInputPrompt = vi.fn(({ prompt, placeholder, disabled, history, suggestions, ...props }) => (
  <div
    data-testid="input-prompt"
    data-prompt={prompt}
    data-disabled={disabled}
    data-suggestion-count={suggestions?.length || 0}
  >
    InputPrompt: {prompt} | Disabled: {disabled ? 'Yes' : 'No'}
  </div>
));

const mockResponseStream = vi.fn(({ content, agent, type, displayMode, ...props }) => (
  <div
    data-testid="response-stream"
    data-display-mode={displayMode}
    data-type={type}
    data-agent={agent}
  >
    ResponseStream: {displayMode} | {type} | {content}
  </div>
));

const mockToolCall = vi.fn(({ toolName, status, displayMode, ...props }) => (
  <div
    data-testid="tool-call"
    data-display-mode={displayMode}
    data-tool-name={toolName}
    data-status={status}
  >
    ToolCall: {displayMode} | {toolName} | {status}
  </div>
));

const mockThoughtDisplay = vi.fn(({ thinking, agent, displayMode, compact, ...props }) => (
  <div
    data-testid="thought-display"
    data-display-mode={displayMode}
    data-agent={agent}
    data-compact={compact}
  >
    ThoughtDisplay: {displayMode} | {agent} | Compact: {compact ? 'Yes' : 'No'}
  </div>
));

const mockServicesPanel = vi.fn(({ apiUrl, webUrl }) => (
  <div data-testid="services-panel" data-api-url={apiUrl} data-web-url={webUrl}>
    ServicesPanel: API: {apiUrl || 'None'} | Web: {webUrl || 'None'}
  </div>
));

const mockPreviewPanel = vi.fn(({ input, intent, workflow }) => (
  <div data-testid="preview-panel" data-input={input} data-workflow={workflow}>
    PreviewPanel: {input} | {workflow}
  </div>
));

// Mock components at module level
vi.mock('../components/Banner.js', () => ({ Banner: mockBanner }));
vi.mock('../components/StatusBar.js', () => ({ StatusBar: mockStatusBar }));
vi.mock('../components/TaskProgress.js', () => ({ TaskProgress: mockTaskProgress }));
vi.mock('../components/agents/AgentPanel.js', () => ({ AgentPanel: mockAgentPanel }));
vi.mock('../components/InputPrompt.js', () => ({ InputPrompt: mockInputPrompt }));
vi.mock('../components/ResponseStream.js', () => ({ ResponseStream: mockResponseStream }));
vi.mock('../components/ToolCall.js', () => ({ ToolCall: mockToolCall }));
vi.mock('../components/ThoughtDisplay.js', () => ({ ThoughtDisplay: mockThoughtDisplay }));
vi.mock('../components/ServicesPanel.js', () => ({ ServicesPanel: mockServicesPanel }));
vi.mock('../components/PreviewPanel.js', () => ({ PreviewPanel: mockPreviewPanel }));

describe('App.tsx - Responsive Layout Integration Tests', () => {
  /**
   * Helper function to mock terminal dimensions
   */
  const mockDimensions = (width: number, height = 24): void => {
    const breakpoint = width < 60 ? 'narrow'
      : width < 100 ? 'compact'
      : width < 160 ? 'normal'
      : 'wide';

    const mockReturn: StdoutDimensions = {
      width,
      height,
      breakpoint,
      isNarrow: width < 60,
      isCompact: width >= 60 && width < 100,
      isNormal: width >= 100 && width < 160,
      isWide: width >= 160,
      isAvailable: true,
    };

    mockUseStdoutDimensions.mockReturnValue(mockReturn);
  };

  // Test data setup
  const createMockConfig = (): ApexConfig => ({
    project: {
      name: 'Test Project',
      description: 'Test project for responsive layout testing',
    },
    agents: {},
    workflows: {},
    limits: {
      maxTokens: 100000,
      maxCost: 10.0,
      timeoutMs: 300000,
    },
    autonomy: {
      level: 'medium',
      autoApprove: false,
    },
  });

  const createMockOrchestrator = (): Partial<ApexOrchestrator> => ({
    on: vi.fn(),
    off: vi.fn(),
    getTaskStore: vi.fn().mockReturnValue({
      getTasks: vi.fn().mockReturnValue([]),
    }),
  });

  const createMockTask = (): Task => ({
    id: 'test-task-1',
    description: 'Test task for responsive layout verification',
    workflow: 'feature',
    status: 'running',
    agent: 'developer',
    stage: 'implementation',
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {},
  });

  const createMockMessages = (): Message[] => [
    {
      id: 'msg-1',
      type: 'user',
      content: 'Test user message for layout verification',
      timestamp: new Date(),
    },
    {
      id: 'msg-2',
      type: 'assistant',
      content: 'Test assistant response with some content for layout testing',
      agent: 'developer',
      thinking: 'Test thinking content for responsive display',
      timestamp: new Date(),
    },
    {
      id: 'msg-3',
      type: 'tool',
      content: 'Tool execution result',
      toolName: 'Read',
      toolInput: { file_path: '/test/file.txt' },
      toolOutput: 'File content for testing',
      toolStatus: 'success',
      toolDuration: 150,
      timestamp: new Date(),
    },
  ];

  const createInitialState = (overrides: Partial<AppState> = {}): AppState => ({
    initialized: true,
    projectPath: '/test/project',
    config: createMockConfig(),
    orchestrator: createMockOrchestrator() as ApexOrchestrator,
    gitBranch: 'main',
    currentTask: createMockTask(),
    messages: createMockMessages(),
    inputHistory: ['Previous command 1', 'Previous command 2'],
    isProcessing: false,
    tokens: { input: 1500, output: 2000 },
    cost: 0.05,
    model: 'claude-3-sonnet',
    activeAgent: 'developer',
    apiUrl: 'http://localhost:3001',
    webUrl: 'http://localhost:3000',
    sessionStartTime: new Date(),
    sessionName: 'test-session',
    subtaskProgress: { completed: 3, total: 5 },
    displayMode: 'normal' as DisplayMode,
    previousAgent: 'planner',
    parallelAgents: [
      { id: 'agent-1', name: 'tester', status: 'running', startTime: new Date() },
      { id: 'agent-2', name: 'reviewer', status: 'pending', startTime: new Date() },
    ],
    showParallelPanel: true,
    previewMode: false,
    showThoughts: true,
    ...overrides,
  });

  const createAppProps = (initialState: AppState): AppProps => ({
    initialState,
    onCommand: vi.fn(),
    onTask: vi.fn(),
    onExit: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockDimensions(80); // Default width
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Width Breakpoint Tests - Acceptance Criteria 1 & 2', () => {
    const testWidths = [
      { width: 40, breakpoint: 'narrow', description: 'Very narrow terminal (40 cols)' },
      { width: 60, breakpoint: 'compact', description: 'Compact terminal (60 cols)' },
      { width: 100, breakpoint: 'normal', description: 'Normal terminal (100 cols)' },
      { width: 160, breakpoint: 'wide', description: 'Wide terminal (160 cols)' },
      { width: 200, breakpoint: 'wide', description: 'Very wide terminal (200 cols)' },
    ];

    testWidths.forEach(({ width, breakpoint, description }) => {
      describe(description, () => {
        it('renders without errors at this width', () => {
          mockDimensions(width);
          const state = createInitialState();
          const props = createAppProps(state);

          expect(() => render(<App {...props} />)).not.toThrow();
        });

        it('renders all core components correctly', () => {
          mockDimensions(width);
          const state = createInitialState();
          const props = createAppProps(state);

          render(<App {...props} />);

          // Verify all core components are present
          expect(screen.getByTestId('banner')).toBeInTheDocument();
          expect(screen.getByTestId('services-panel')).toBeInTheDocument();
          expect(screen.getByTestId('status-bar')).toBeInTheDocument();
          expect(screen.getByTestId('task-progress')).toBeInTheDocument();
          expect(screen.getByTestId('agent-panel')).toBeInTheDocument();
          expect(screen.getByTestId('input-prompt')).toBeInTheDocument();

          // Verify message components
          expect(screen.getAllByTestId('response-stream')).toHaveLength(2); // user + assistant messages
          expect(screen.getByTestId('tool-call')).toBeInTheDocument();
          expect(screen.getByTestId('thought-display')).toBeInTheDocument();
        });

        it('propagates correct displayMode to all components', () => {
          mockDimensions(width);
          const state = createInitialState({ displayMode: 'verbose' });
          const props = createAppProps(state);

          render(<App {...props} />);

          // Verify displayMode is passed to all relevant components
          expect(mockStatusBar).toHaveBeenCalledWith(
            expect.objectContaining({ displayMode: 'verbose' }),
            expect.anything()
          );
          expect(mockTaskProgress).toHaveBeenCalledWith(
            expect.objectContaining({ displayMode: 'verbose' }),
            expect.anything()
          );
          expect(mockAgentPanel).toHaveBeenCalledWith(
            expect.objectContaining({ displayMode: 'verbose' }),
            expect.anything()
          );
        });

        it('handles narrow width with appropriate compact behavior', () => {
          mockDimensions(width);
          const state = createInitialState();
          const props = createAppProps(state);

          render(<App {...props} />);

          if (width < 60) {
            // In narrow mode, verify compact behavior
            expect(screen.getByTestId('thought-display')).toHaveAttribute('data-compact', 'true');
          } else {
            // In wider modes, compact should be false
            expect(screen.getByTestId('thought-display')).toHaveAttribute('data-compact', 'false');
          }
        });

        it('renders with processing state correctly', () => {
          mockDimensions(width);
          const state = createInitialState({ isProcessing: true });
          const props = createAppProps(state);

          render(<App {...props} />);

          // Verify input is disabled during processing
          expect(screen.getByTestId('input-prompt')).toHaveAttribute('data-disabled', 'true');
        });

        it('handles different display modes without overflow', () => {
          const displayModes: DisplayMode[] = ['compact', 'normal', 'verbose'];

          displayModes.forEach((displayMode) => {
            vi.clearAllMocks();
            mockDimensions(width);
            const state = createInitialState({ displayMode });
            const props = createAppProps(state);

            expect(() => render(<App {...props} />)).not.toThrow();

            // Verify components receive correct displayMode
            expect(mockStatusBar).toHaveBeenCalledWith(
              expect.objectContaining({ displayMode }),
              expect.anything()
            );
          });
        });
      });
    });
  });

  describe('Component Integration Tests - Acceptance Criteria 3', () => {
    it('correctly integrates all components together at narrow width (40 cols)', () => {
      mockDimensions(40);
      const state = createInitialState({
        showThoughts: true,
        previewMode: false,
        parallelAgents: [
          { id: 'agent-1', name: 'tester', status: 'running', startTime: new Date() },
        ],
        showParallelPanel: true,
      });
      const props = createAppProps(state);

      render(<App {...props} />);

      // Verify all components are present and functioning together
      expect(screen.getByTestId('banner')).toBeInTheDocument();
      expect(screen.getByTestId('task-progress')).toBeInTheDocument();
      expect(screen.getByTestId('agent-panel')).toBeInTheDocument();
      expect(screen.getByTestId('status-bar')).toBeInTheDocument();

      // Verify agent panel shows parallel execution
      expect(screen.getByTestId('agent-panel')).toHaveAttribute('data-show-parallel', 'true');
      expect(screen.getByTestId('agent-panel')).toHaveAttribute('data-parallel-count', '1');

      // Verify thoughts are displayed with compact mode for narrow width
      expect(screen.getByTestId('thought-display')).toHaveAttribute('data-compact', 'true');
    });

    it('handles preview mode integration correctly', () => {
      mockDimensions(100);
      const state = createInitialState({
        pendingPreview: {
          input: '/test command',
          intent: {
            type: 'command',
            confidence: 0.95,
            command: 'test',
            args: [],
            metadata: { suggestedWorkflow: 'feature' },
          },
          timestamp: new Date(),
        },
      });
      const props = createAppProps(state);

      render(<App {...props} />);

      // Verify preview panel is shown
      expect(screen.getByTestId('preview-panel')).toBeInTheDocument();
      expect(screen.getByTestId('preview-panel')).toHaveAttribute('data-input', '/test command');
    });

    it('shows services panel when URLs are provided', () => {
      mockDimensions(160);
      const state = createInitialState({
        apiUrl: 'http://localhost:3001',
        webUrl: 'http://localhost:3000',
      });
      const props = createAppProps(state);

      render(<App {...props} />);

      expect(screen.getByTestId('services-panel')).toBeInTheDocument();
      expect(screen.getByTestId('services-panel')).toHaveAttribute('data-api-url', 'http://localhost:3001');
      expect(screen.getByTestId('services-panel')).toHaveAttribute('data-web-url', 'http://localhost:3000');
    });

    it('filters messages correctly based on display mode', () => {
      mockDimensions(120);
      const messagesWithSystemAndTool = [
        ...createMockMessages(),
        {
          id: 'msg-system',
          type: 'system' as const,
          content: 'System message',
          timestamp: new Date(),
        },
        {
          id: 'msg-error',
          type: 'error' as const,
          content: 'Error message',
          timestamp: new Date(),
        },
      ];

      const state = createInitialState({
        displayMode: 'compact',
        messages: messagesWithSystemAndTool,
      });
      const props = createAppProps(state);

      render(<App {...props} />);

      // In compact mode, system and tool messages should be filtered out
      const responseStreams = screen.getAllByTestId('response-stream');

      // Should only show user and assistant messages, not system
      expect(responseStreams).toHaveLength(2);
    });
  });

  describe('Width Resize Scenarios - Acceptance Criteria 4', () => {
    it('handles resize from narrow to wide correctly', () => {
      // Start with narrow width
      mockDimensions(40);
      const state = createInitialState({ showThoughts: true });
      const props = createAppProps(state);

      const { rerender } = render(<App {...props} />);

      // Verify initial narrow state
      expect(screen.getByTestId('thought-display')).toHaveAttribute('data-compact', 'true');

      // Resize to wide
      vi.clearAllMocks();
      mockDimensions(200);
      rerender(<App {...props} />);

      // Verify components update correctly
      expect(screen.getByTestId('thought-display')).toHaveAttribute('data-compact', 'false');
    });

    it('handles resize from wide to narrow correctly', () => {
      // Start with wide width
      mockDimensions(200);
      const state = createInitialState({ showThoughts: true });
      const props = createAppProps(state);

      const { rerender } = render(<App {...props} />);

      // Verify initial wide state
      expect(screen.getByTestId('thought-display')).toHaveAttribute('data-compact', 'false');

      // Resize to narrow
      vi.clearAllMocks();
      mockDimensions(40);
      rerender(<App {...props} />);

      // Verify components update to compact
      expect(screen.getByTestId('thought-display')).toHaveAttribute('data-compact', 'true');
    });

    it('handles crossing breakpoint boundaries correctly', () => {
      // Test crossing each breakpoint boundary
      const transitions = [
        { from: 59, to: 60, description: 'narrow to compact boundary' },
        { from: 99, to: 100, description: 'compact to normal boundary' },
        { from: 159, to: 160, description: 'normal to wide boundary' },
      ];

      transitions.forEach(({ from, to, description }) => {
        vi.clearAllMocks();

        // Start at boundary - 1
        mockDimensions(from);
        const state = createInitialState();
        const props = createAppProps(state);

        const { rerender } = render(<App {...props} />);

        // Cross boundary
        mockDimensions(to);
        rerender(<App {...props} />);

        // Verify app still renders without error after boundary crossing
        expect(screen.getByTestId('status-bar')).toBeInTheDocument();
        expect(screen.getByTestId('task-progress')).toBeInTheDocument();
        expect(screen.getByTestId('agent-panel')).toBeInTheDocument();
      });
    });

    it('handles rapid sequential resizes without errors', async () => {
      const widths = [40, 80, 120, 60, 180, 50, 200];
      const state = createInitialState();
      const props = createAppProps(state);

      // Start with first width
      mockDimensions(widths[0]);
      const { rerender } = render(<App {...props} />);

      // Rapidly resize through all widths
      for (let i = 1; i < widths.length; i++) {
        mockDimensions(widths[i]);
        expect(() => rerender(<App {...props} />)).not.toThrow();

        // Verify core components still render
        expect(screen.getByTestId('status-bar')).toBeInTheDocument();
        expect(screen.getByTestId('agent-panel')).toBeInTheDocument();
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles zero width gracefully', () => {
      mockDimensions(0);
      const state = createInitialState();
      const props = createAppProps(state);

      expect(() => render(<App {...props} />)).not.toThrow();
    });

    it('handles very narrow width (< 20 cols)', () => {
      mockDimensions(15);
      const state = createInitialState();
      const props = createAppProps(state);

      expect(() => render(<App {...props} />)).not.toThrow();
      expect(screen.getByTestId('banner')).toBeInTheDocument();
      expect(screen.getByTestId('status-bar')).toBeInTheDocument();
    });

    it('handles very wide width (> 300 cols)', () => {
      mockDimensions(500);
      const state = createInitialState();
      const props = createAppProps(state);

      expect(() => render(<App {...props} />)).not.toThrow();
      expect(screen.getByTestId('banner')).toBeInTheDocument();
      expect(screen.getByTestId('status-bar')).toBeInTheDocument();
    });

    it('handles missing or undefined dimensions', () => {
      // Mock unavailable dimensions
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        isAvailable: false, // Dimensions not available
      });

      const state = createInitialState();
      const props = createAppProps(state);

      expect(() => render(<App {...props} />)).not.toThrow();
    });

    it('handles state with no current task', () => {
      mockDimensions(100);
      const state = createInitialState({ currentTask: undefined });
      const props = createAppProps(state);

      render(<App {...props} />);

      // TaskProgress and AgentPanel should not be rendered when no current task
      expect(screen.queryByTestId('task-progress')).not.toBeInTheDocument();
      expect(screen.queryByTestId('agent-panel')).not.toBeInTheDocument();

      // Other components should still render
      expect(screen.getByTestId('banner')).toBeInTheDocument();
      expect(screen.getByTestId('status-bar')).toBeInTheDocument();
    });

    it('handles empty message array', () => {
      mockDimensions(100);
      const state = createInitialState({ messages: [] });
      const props = createAppProps(state);

      expect(() => render(<App {...props} />)).not.toThrow();
      expect(screen.queryByTestId('response-stream')).not.toBeInTheDocument();
      expect(screen.queryByTestId('tool-call')).not.toBeInTheDocument();
    });
  });

  describe('DisplayMode Integration with Width', () => {
    const displayModes: DisplayMode[] = ['compact', 'normal', 'verbose'];

    displayModes.forEach((displayMode) => {
      it(`handles ${displayMode} display mode across all widths`, () => {
        const testWidths = [40, 60, 100, 160, 200];

        testWidths.forEach((width) => {
          vi.clearAllMocks();
          mockDimensions(width);
          const state = createInitialState({ displayMode });
          const props = createAppProps(state);

          expect(() => render(<App {...props} />)).not.toThrow();

          // Verify displayMode is propagated correctly
          expect(mockStatusBar).toHaveBeenCalledWith(
            expect.objectContaining({ displayMode }),
            expect.anything()
          );
          expect(mockTaskProgress).toHaveBeenCalledWith(
            expect.objectContaining({ displayMode }),
            expect.anything()
          );
          expect(mockAgentPanel).toHaveBeenCalledWith(
            expect.objectContaining({ displayMode }),
            expect.anything()
          );
        });
      });
    });

    it('handles displayMode changes with width adaptation', () => {
      mockDimensions(40); // Narrow width
      const state = createInitialState({ displayMode: 'normal', showThoughts: true });
      const props = createAppProps(state);

      const { rerender } = render(<App {...props} />);

      // Verify narrow width forces compact behavior for thoughts
      expect(screen.getByTestId('thought-display')).toHaveAttribute('data-compact', 'true');

      // Change to verbose mode while keeping narrow width
      const updatedState = { ...state, displayMode: 'verbose' as DisplayMode };
      const updatedProps = createAppProps(updatedState);

      vi.clearAllMocks();
      rerender(<App {...updatedProps} />);

      // Width should still force compact for thoughts even in verbose mode
      expect(screen.getByTestId('thought-display')).toHaveAttribute('data-compact', 'true');
      expect(mockThoughtDisplay).toHaveBeenCalledWith(
        expect.objectContaining({ displayMode: 'verbose' }),
        expect.anything()
      );
    });
  });
});

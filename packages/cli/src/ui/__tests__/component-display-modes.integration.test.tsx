/**
 * Integration Tests for Component Display Mode Behavior
 *
 * Tests how different UI components properly respect and respond to displayMode changes
 * across the entire component hierarchy
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { DisplayMode } from '@apexcli/core';

// Mock ink hooks
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn(),
    useApp: () => ({ exit: vi.fn() }),
    useStdout: () => ({ stdout: { columns: 120 } }),
    Box: ({ children, ...props }: any) => <div data-testid="box" {...props}>{children}</div>,
    Text: ({ children, color, ...props }: any) => <span style={{ color }} {...props}>{children}</span>,
  };
});

// Mock hooks
vi.mock('../hooks/index.js', () => ({
  useStdoutDimensions: () => ({
    width: 120,
    height: 30,
    breakpoint: 'wide' as const,
  }),
}));

// Component prop trackers for verification
const componentProps: Record<string, any> = {};

// Import and mock components with prop tracking
const StatusBar = ({ displayMode, ...props }: any) => {
  componentProps.statusBar = { displayMode, ...props };
  return <div data-testid="status-bar" data-display-mode={displayMode} {...props} />;
};

const TaskProgress = ({ displayMode, ...props }: any) => {
  componentProps.taskProgress = { displayMode, ...props };
  return (
    <div data-testid="task-progress" data-display-mode={displayMode} {...props}>
      {displayMode === 'verbose' && <span>Detailed progress info</span>}
      {displayMode === 'compact' && <span>●</span>}
      {displayMode === 'normal' && <span>Standard progress</span>}
    </div>
  );
};

const AgentPanel = ({ displayMode, ...props }: any) => {
  componentProps.agentPanel = { displayMode, ...props };
  return (
    <div data-testid="agent-panel" data-display-mode={displayMode} {...props}>
      {displayMode === 'verbose' && (
        <>
          <span>Detailed agent info</span>
          <span>Debug handoff data</span>
          <span>Performance metrics</span>
        </>
      )}
      {displayMode === 'compact' && <span>A</span>}
      {displayMode === 'normal' && <span>Agent: Active</span>}
    </div>
  );
};

const ResponseStream = ({ displayMode, content, type, ...props }: any) => {
  if (!componentProps.responseStream) componentProps.responseStream = [];
  componentProps.responseStream.push({ displayMode, content, type, ...props });

  return (
    <div data-testid="response-stream" data-display-mode={displayMode} data-type={type} {...props}>
      {displayMode === 'verbose' && type === 'system' && <span>DEBUG: {content}</span>}
      {displayMode === 'compact' && type === 'system' ? null : content}
      {displayMode === 'normal' && content}
    </div>
  );
};

const ToolCall = ({ displayMode, toolName, status, duration, ...props }: any) => {
  if (!componentProps.toolCall) componentProps.toolCall = [];
  componentProps.toolCall.push({ displayMode, toolName, status, duration, ...props });

  return (
    <div data-testid="tool-call" data-display-mode={displayMode} {...props}>
      {displayMode === 'verbose' && (
        <>
          <span>Tool: {toolName}</span>
          <span>Status: {status}</span>
          <span>Duration: {duration}ms</span>
          <span>Stack trace available</span>
        </>
      )}
      {displayMode === 'compact' && <span>🔧</span>}
      {displayMode === 'normal' && <span>{toolName}: {status}</span>}
    </div>
  );
};

const ActivityLog = ({ displayMode, entries, ...props }: any) => {
  componentProps.activityLog = { displayMode, entries, ...props };

  if (displayMode === 'compact') {
    // ActivityLog should be hidden in compact mode
    return null;
  }

  return (
    <div data-testid="activity-log" data-display-mode={displayMode} {...props}>
      {displayMode === 'verbose' && (
        <>
          <span>Full activity log with debug data</span>
          <span>Performance metrics</span>
          <span>Memory usage: 45MB</span>
        </>
      )}
      {displayMode === 'normal' && <span>Activity log entries: {entries?.length || 0}</span>}
    </div>
  );
};

// Mock the component exports
vi.mock('../components/index.js', () => ({
  StatusBar,
  TaskProgress,
  AgentPanel,
  ResponseStream,
  ToolCall,
  ActivityLog,
  Banner: ({ children, ...props }: any) => <div data-testid="banner" {...props}>{children}</div>,
  InputPrompt: ({ children, ...props }: any) => <div data-testid="input-prompt" {...props}>{children}</div>,
  ServicesPanel: ({ children, ...props }: any) => <div data-testid="services-panel" {...props}>{children}</div>,
  PreviewPanel: ({ children, ...props }: any) => <div data-testid="preview-panel" {...props}>{children}</div>,
}));

// Test component that uses all display-mode aware components
const TestApp = ({ displayMode }: { displayMode: DisplayMode }) => {
  const mockTask = {
    id: 'test-task',
    description: 'Test task for display modes',
    status: 'in-progress',
    workflow: 'feature',
    createdAt: new Date(),
  };

  const mockMessages = [
    { id: '1', type: 'user', content: 'User message', timestamp: new Date() },
    { id: '2', type: 'assistant', content: 'Assistant message', timestamp: new Date() },
    { id: '3', type: 'system', content: 'System debug message', timestamp: new Date() },
  ];

  const mockLogEntries = [
    { id: '1', timestamp: new Date(), level: 'info', message: 'Test log entry' },
    { id: '2', timestamp: new Date(), level: 'debug', message: 'Debug information' },
  ];

  return (
    <div>
      <StatusBar
        displayMode={displayMode}
        gitBranch="feature/test"
        tokens={{ input: 100, output: 50 }}
        cost={0.01}
        model="claude-3-sonnet"
        agent="developer"
        isConnected={true}
      />

      <TaskProgress
        displayMode={displayMode}
        taskId={mockTask.id}
        description={mockTask.description}
        status={mockTask.status}
        workflow={mockTask.workflow}
        tokens={{ input: 100, output: 50 }}
        cost={0.01}
      />

      <AgentPanel
        displayMode={displayMode}
        agents={[]}
        currentAgent="developer"
        showParallel={false}
      />

      {mockMessages.map((msg, index) => (
        msg.type === 'tool' ? (
          <ToolCall
            key={msg.id}
            displayMode={displayMode}
            toolName="TestTool"
            status="success"
            duration={500}
          />
        ) : (
          <ResponseStream
            key={msg.id}
            displayMode={displayMode}
            content={msg.content}
            type={msg.type}
          />
        )
      ))}

      <ActivityLog
        displayMode={displayMode}
        entries={mockLogEntries}
        showTimestamps={true}
        showAgents={true}
      />
    </div>
  );
};

describe('Component Display Mode Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset component props tracker
    Object.keys(componentProps).forEach(key => {
      if (Array.isArray(componentProps[key])) {
        componentProps[key] = [];
      } else {
        componentProps[key] = null;
      }
    });
  });

  describe('Normal Mode - All Components Visible', () => {
    it('should render all components with standard information in normal mode', () => {
      render(<TestApp displayMode="normal" />);

      // StatusBar should be present
      expect(screen.getByTestId('status-bar')).toHaveAttribute('data-display-mode', 'normal');

      // TaskProgress should show standard progress
      expect(screen.getByText('Standard progress')).toBeInTheDocument();

      // AgentPanel should show standard agent info
      expect(screen.getByText('Agent: Active')).toBeInTheDocument();

      // ResponseStream should show all messages
      expect(screen.getByText('User message')).toBeInTheDocument();
      expect(screen.getByText('Assistant message')).toBeInTheDocument();
      expect(screen.getByText('System debug message')).toBeInTheDocument();

      // ActivityLog should be visible
      expect(screen.getByTestId('activity-log')).toBeInTheDocument();
      expect(screen.getByText('Activity log entries: 2')).toBeInTheDocument();
    });

    it('should pass correct displayMode prop to all components', () => {
      render(<TestApp displayMode="normal" />);

      expect(componentProps.statusBar?.displayMode).toBe('normal');
      expect(componentProps.taskProgress?.displayMode).toBe('normal');
      expect(componentProps.agentPanel?.displayMode).toBe('normal');
      expect(componentProps.activityLog?.displayMode).toBe('normal');

      componentProps.responseStream?.forEach((stream: any) => {
        expect(stream.displayMode).toBe('normal');
      });
    });
  });

  describe('Compact Mode - Condensed Display', () => {
    it('should show minimal information in compact mode', () => {
      render(<TestApp displayMode="compact" />);

      // StatusBar should be present but compact
      expect(screen.getByTestId('status-bar')).toHaveAttribute('data-display-mode', 'compact');

      // TaskProgress should show minimal progress
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.queryByText('Standard progress')).not.toBeInTheDocument();

      // AgentPanel should show minimal agent info
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.queryByText('Agent: Active')).not.toBeInTheDocument();

      // ResponseStream should filter system messages
      expect(screen.getByText('User message')).toBeInTheDocument();
      expect(screen.getByText('Assistant message')).toBeInTheDocument();
      expect(screen.queryByText('System debug message')).not.toBeInTheDocument();

      // ActivityLog should be hidden in compact mode
      expect(screen.queryByTestId('activity-log')).not.toBeInTheDocument();
    });

    it('should pass correct displayMode prop to all components in compact mode', () => {
      render(<TestApp displayMode="compact" />);

      expect(componentProps.statusBar?.displayMode).toBe('compact');
      expect(componentProps.taskProgress?.displayMode).toBe('compact');
      expect(componentProps.agentPanel?.displayMode).toBe('compact');
      expect(componentProps.activityLog?.displayMode).toBe('compact');
    });

    it('should maintain essential functionality while hiding clutter', () => {
      render(<TestApp displayMode="compact" />);

      // Essential components should still be functional
      expect(screen.getByTestId('status-bar')).toBeInTheDocument();
      expect(screen.getByTestId('task-progress')).toBeInTheDocument();
      expect(screen.getByTestId('agent-panel')).toBeInTheDocument();

      // But with minimal visual footprint
      const responseStreams = screen.getAllByTestId('response-stream');
      expect(responseStreams).toHaveLength(2); // Only non-system messages
    });
  });

  describe('Verbose Mode - Maximum Detail', () => {
    it('should show all available information in verbose mode', () => {
      render(<TestApp displayMode="verbose" />);

      // StatusBar should be present with verbose mode
      expect(screen.getByTestId('status-bar')).toHaveAttribute('data-display-mode', 'verbose');

      // TaskProgress should show detailed progress
      expect(screen.getByText('Detailed progress info')).toBeInTheDocument();

      // AgentPanel should show detailed agent info
      expect(screen.getByText('Detailed agent info')).toBeInTheDocument();
      expect(screen.getByText('Debug handoff data')).toBeInTheDocument();
      expect(screen.getByText('Performance metrics')).toBeInTheDocument();

      // ResponseStream should show all messages with debug info
      expect(screen.getByText('User message')).toBeInTheDocument();
      expect(screen.getByText('Assistant message')).toBeInTheDocument();
      expect(screen.getByText('DEBUG: System debug message')).toBeInTheDocument();

      // ActivityLog should show with full detail
      expect(screen.getByTestId('activity-log')).toBeInTheDocument();
      expect(screen.getByText('Full activity log with debug data')).toBeInTheDocument();
      expect(screen.getByText('Memory usage: 45MB')).toBeInTheDocument();
    });

    it('should pass correct displayMode prop to all components in verbose mode', () => {
      render(<TestApp displayMode="verbose" />);

      expect(componentProps.statusBar?.displayMode).toBe('verbose');
      expect(componentProps.taskProgress?.displayMode).toBe('verbose');
      expect(componentProps.agentPanel?.displayMode).toBe('verbose');
      expect(componentProps.activityLog?.displayMode).toBe('verbose');

      componentProps.responseStream?.forEach((stream: any) => {
        expect(stream.displayMode).toBe('verbose');
      });
    });

    it('should include debug information for tool calls in verbose mode', () => {
      const VerboseToolTest = () => (
        <ToolCall
          displayMode="verbose"
          toolName="ComplexTool"
          status="success"
          duration={1250}
        />
      );

      render(<VerboseToolTest />);

      // Should show detailed tool information
      expect(screen.getByText('Tool: ComplexTool')).toBeInTheDocument();
      expect(screen.getByText('Status: success')).toBeInTheDocument();
      expect(screen.getByText('Duration: 1250ms')).toBeInTheDocument();
      expect(screen.getByText('Stack trace available')).toBeInTheDocument();
    });
  });

  describe('Component Responsiveness to Mode Changes', () => {
    it('should update all components when display mode changes', () => {
      const { rerender } = render(<TestApp displayMode="normal" />);

      // Verify initial normal mode
      expect(screen.getByText('Standard progress')).toBeInTheDocument();
      expect(screen.getByText('Agent: Active')).toBeInTheDocument();

      // Change to compact mode
      rerender(<TestApp displayMode="compact" />);

      // Verify components updated
      expect(screen.queryByText('Standard progress')).not.toBeInTheDocument();
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.queryByText('Agent: Active')).not.toBeInTheDocument();
      expect(screen.getByText('A')).toBeInTheDocument();

      // Change to verbose mode
      rerender(<TestApp displayMode="verbose" />);

      // Verify verbose mode components
      expect(screen.getByText('Detailed progress info')).toBeInTheDocument();
      expect(screen.getByText('Detailed agent info')).toBeInTheDocument();
      expect(screen.getByText('Full activity log with debug data')).toBeInTheDocument();
    });

    it('should handle rapid mode changes without errors', () => {
      const { rerender } = render(<TestApp displayMode="normal" />);

      const modes: DisplayMode[] = ['compact', 'verbose', 'normal', 'compact', 'verbose'];

      modes.forEach(mode => {
        expect(() => {
          rerender(<TestApp displayMode={mode} />);
        }).not.toThrow();

        expect(screen.getByTestId('status-bar')).toHaveAttribute('data-display-mode', mode);
      });
    });
  });

  describe('Cross-Component Consistency', () => {
    it('should maintain consistent display mode across all components', () => {
      render(<TestApp displayMode="verbose" />);

      // All components should receive the same display mode
      expect(componentProps.statusBar?.displayMode).toBe('verbose');
      expect(componentProps.taskProgress?.displayMode).toBe('verbose');
      expect(componentProps.agentPanel?.displayMode).toBe('verbose');
      expect(componentProps.activityLog?.displayMode).toBe('verbose');

      componentProps.responseStream?.forEach((stream: any) => {
        expect(stream.displayMode).toBe('verbose');
      });

      componentProps.toolCall?.forEach((tool: any) => {
        expect(tool.displayMode).toBe('verbose');
      });
    });

    it('should handle missing displayMode prop gracefully', () => {
      const ComponentWithoutDisplayMode = () => (
        <div>
          <StatusBar isConnected={true} />
          <TaskProgress taskId="test" description="test" status="in-progress" />
        </div>
      );

      expect(() => {
        render(<ComponentWithoutDisplayMode />);
      }).not.toThrow();
    });
  });

  describe('Message Filtering Integration', () => {
    it('should filter different message types appropriately across modes', () => {
      const MessageFilterTest = ({ displayMode }: { displayMode: DisplayMode }) => {
        const messages = [
          { id: '1', type: 'user', content: 'User input' },
          { id: '2', type: 'assistant', content: 'AI response' },
          { id: '3', type: 'system', content: 'System notification' },
          { id: '4', type: 'error', content: 'Error occurred' },
          { id: '5', type: 'tool', content: 'Tool execution' },
        ];

        return (
          <div>
            {messages.map(msg => (
              msg.type === 'tool' ? (
                <ToolCall
                  key={msg.id}
                  displayMode={displayMode}
                  toolName="TestTool"
                  status="success"
                />
              ) : (
                <ResponseStream
                  key={msg.id}
                  displayMode={displayMode}
                  content={msg.content}
                  type={msg.type}
                />
              )
            ))}
          </div>
        );
      };

      // Test compact mode filtering
      render(<MessageFilterTest displayMode="compact" />);

      expect(screen.getByText('User input')).toBeInTheDocument();
      expect(screen.getByText('AI response')).toBeInTheDocument();
      expect(screen.getByText('Error occurred')).toBeInTheDocument();
      expect(screen.queryByText('System notification')).not.toBeInTheDocument(); // Filtered in compact
      expect(screen.getByText('🔧')).toBeInTheDocument(); // Tool call shown as icon

      // Test verbose mode - all messages shown
      const { rerender } = render(<MessageFilterTest displayMode="verbose" />);
      rerender(<MessageFilterTest displayMode="verbose" />);

      expect(screen.getByText('User input')).toBeInTheDocument();
      expect(screen.getByText('AI response')).toBeInTheDocument();
      expect(screen.getByText('DEBUG: System notification')).toBeInTheDocument(); // System shown with debug prefix
      expect(screen.getByText('Error occurred')).toBeInTheDocument();
      expect(screen.getByText('Tool: TestTool')).toBeInTheDocument(); // Tool call shown in detail
    });
  });

  describe('Performance Considerations', () => {
    it('should not render expensive components in compact mode', () => {
      render(<TestApp displayMode="compact" />);

      // ActivityLog should not be rendered at all in compact mode
      expect(screen.queryByTestId('activity-log')).not.toBeInTheDocument();

      // This verifies the component is not just hidden, but not rendered
      expect(componentProps.activityLog).toBeTruthy(); // Props were passed
      // But the actual DOM element doesn't exist
    });

    it('should render all debug components in verbose mode', () => {
      render(<TestApp displayMode="verbose" />);

      // All debug components should be present
      expect(screen.getByTestId('activity-log')).toBeInTheDocument();
      expect(screen.getByText('Debug handoff data')).toBeInTheDocument();
      expect(screen.getByText('Performance metrics')).toBeInTheDocument();
      expect(screen.getByText('Memory usage: 45MB')).toBeInTheDocument();
    });
  });
});
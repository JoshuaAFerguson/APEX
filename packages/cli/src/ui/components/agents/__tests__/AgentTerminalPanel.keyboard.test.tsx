/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import { AgentTerminalPanel } from '../AgentTerminalPanel.js';
import { ThemeProvider } from '../../../context/ThemeContext.js';
import type { AgentExecution, AgentTerminalPanelProps, TerminalPanelDisplayMode } from '../AgentTerminalPanel.types.js';
import { PanelState } from '../AgentTerminalPanel.types.js';

// Mock the hooks and dependencies
vi.mock('../../../hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: vi.fn(() => ({
    width: 80,
    height: 24,
    breakpoint: 'normal' as const,
  })),
}));

vi.mock('../../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: vi.fn(() => '1m 30s'),
}));

vi.mock('../../../context/ThemeContext.js', () => ({
  useThemeColors: vi.fn(() => ({
    text: 'white',
    textMuted: 'gray',
    cyan: 'cyan',
    green: 'green',
    red: 'red',
    yellow: 'yellow',
    gray: 'gray',
  })),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock the useInput hook from ink to simulate keyboard events
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn(),
  };
});

// Test wrapper with ThemeProvider for Ink components
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider defaultTheme="dark">
    {children}
  </ThemeProvider>
);

// Custom render function for Ink components
const renderWithTheme = (ui: React.ReactElement) => {
  return render(<TestWrapper>{ui}</TestWrapper>);
};

describe('AgentTerminalPanel - Keyboard Accessibility Tests', () => {
  // Get mock function
  let mockUseInput: any;

  // Helper function to create mock execution data
  const createMockExecution = (overrides: Partial<AgentExecution> = {}): AgentExecution => ({
    id: 'test-execution-1',
    agentId: 'test-agent',
    agentName: 'Test Agent',
    status: 'running',
    stage: 'implementing',
    progress: 50,
    startedAt: new Date('2024-01-01T10:00:00Z'),
    tokensUsed: 1250,
    taskDescription: 'Test task description',
    ...overrides,
  });

  // Mock callback functions for testing state changes
  const mockOnSelect = vi.fn();
  const mockOnMinimize = vi.fn();
  const mockOnMaximize = vi.fn();
  const mockOnRestore = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    // Get the mocked useInput function
    const { useInput } = await import('ink');
    mockUseInput = vi.mocked(useInput);
    mockUseInput.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Helper function to render AgentTerminalPanel with keyboard accessibility support
   * @param props - Additional props to pass to the component
   * @param panelState - Current panel state for controlled testing
   */
  function renderPanelWithKeyboard(
    props: Partial<AgentTerminalPanelProps> = {},
    panelState?: PanelState
  ) {
    const execution = createMockExecution();
    const defaultProps: AgentTerminalPanelProps = {
      execution,
      onSelect: mockOnSelect,
      onMinimize: mockOnMinimize,
      onMaximize: mockOnMaximize,
      onRestore: mockOnRestore,
      panelState,
      focused: true,
      allowKeyboardInput: true,
      ...props,
    };

    const result = renderWithTheme(<AgentTerminalPanel {...defaultProps} />);

    // Get the keyboard handler function that was registered
    const keyboardHandler = mockUseInput.mock.calls[0]?.[0];

    return {
      ...result,
      keyboardHandler,
      triggerKeyboard: (input: string, key: any = {}) => {
        if (keyboardHandler) {
          keyboardHandler(input, key);
        }
      },
    };
  }

  describe('Keyboard Handler Registration', () => {
    it('registers keyboard input handler when allowKeyboardInput=true and focused=true', () => {
      renderPanelWithKeyboard({
        allowKeyboardInput: true,
        focused: true,
      });

      // Should register useInput hook with isActive=true
      expect(mockUseInput).toHaveBeenCalledWith(
        expect.any(Function),
        { isActive: true }
      );
    });

    it('does not register active keyboard input handler when allowKeyboardInput=false', () => {
      renderPanelWithKeyboard({
        allowKeyboardInput: false,
        focused: true,
      });

      // Should register useInput hook with isActive=false
      expect(mockUseInput).toHaveBeenCalledWith(
        expect.any(Function),
        { isActive: false }
      );
    });

    it('does not register active keyboard input handler when focused=false', () => {
      renderPanelWithKeyboard({
        allowKeyboardInput: true,
        focused: false,
      });

      // Should register useInput hook with isActive=false
      expect(mockUseInput).toHaveBeenCalledWith(
        expect.any(Function),
        { isActive: false }
      );
    });

    it('uses default allowKeyboardInput=true when prop is undefined', () => {
      renderPanelWithKeyboard({
        allowKeyboardInput: undefined,
        focused: true,
      });

      // Should register useInput hook with isActive=true (default behavior)
      expect(mockUseInput).toHaveBeenCalledWith(
        expect.any(Function),
        { isActive: true }
      );
    });
  });

  describe('Enter and Space Key Toggle Functionality', () => {
    it('calls onSelect when Enter is pressed', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({}, PanelState.Normal);

      triggerKeyboard('', { return: true });

      expect(mockOnSelect).toHaveBeenCalledTimes(1);
      expect(mockOnSelect).toHaveBeenCalledWith(createMockExecution());
    });

    it('calls onSelect when Space is pressed', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({}, PanelState.Normal);

      triggerKeyboard(' ', {});

      expect(mockOnSelect).toHaveBeenCalledTimes(1);
      expect(mockOnSelect).toHaveBeenCalledWith(createMockExecution());
    });

    it('calls onSelect regardless of panel state', () => {
      // Test normal state
      const { triggerKeyboard: triggerNormal } = renderPanelWithKeyboard({}, PanelState.Normal);
      triggerNormal('', { return: true });
      expect(mockOnSelect).toHaveBeenCalledTimes(1);

      vi.clearAllMocks();

      // Test minimized state
      const { triggerKeyboard: triggerMinimized } = renderPanelWithKeyboard({}, PanelState.Minimized);
      triggerMinimized(' ', {});
      expect(mockOnSelect).toHaveBeenCalledTimes(1);

      vi.clearAllMocks();

      // Test maximized state
      const { triggerKeyboard: triggerMaximized } = renderPanelWithKeyboard({}, PanelState.Maximized);
      triggerMaximized('', { return: true });
      expect(mockOnSelect).toHaveBeenCalledTimes(1);
    });
  });

  describe('M Key Maximize Functionality', () => {
    it('calls onMaximize when M is pressed from normal state', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({}, PanelState.Normal);

      triggerKeyboard('M', {});

      expect(mockOnMaximize).toHaveBeenCalledTimes(1);
      expect(mockOnMaximize).toHaveBeenCalledWith(createMockExecution());
      expect(mockOnMinimize).not.toHaveBeenCalled();
      expect(mockOnRestore).not.toHaveBeenCalled();
    });

    it('calls onMaximize when m is pressed from normal state', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({}, PanelState.Normal);

      triggerKeyboard('m', {});

      expect(mockOnMaximize).toHaveBeenCalledTimes(1);
      expect(mockOnMaximize).toHaveBeenCalledWith(createMockExecution());
    });

    it('calls onMaximize when M is pressed from minimized state', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({}, PanelState.Minimized);

      triggerKeyboard('M', {});

      expect(mockOnMaximize).toHaveBeenCalledTimes(1);
      expect(mockOnMaximize).toHaveBeenCalledWith(createMockExecution());
      expect(mockOnMinimize).not.toHaveBeenCalled();
      expect(mockOnRestore).not.toHaveBeenCalled();
    });

    it('does not call onMaximize when M is pressed from maximized state', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({}, PanelState.Maximized);

      triggerKeyboard('M', {});

      expect(mockOnMaximize).not.toHaveBeenCalled();
      expect(mockOnMinimize).not.toHaveBeenCalled();
      expect(mockOnRestore).not.toHaveBeenCalled();
    });

    it('handles undefined panelState gracefully for M key', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({}, undefined);

      // Should not throw error with undefined panelState
      expect(() => {
        triggerKeyboard('M', {});
      }).not.toThrow();

      // Should still call onMaximize when panelState is undefined
      expect(mockOnMaximize).toHaveBeenCalledTimes(1);
    });
  });

  describe('Escape Key Restore Functionality', () => {
    it('calls onRestore when Escape is pressed from maximized state', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({}, PanelState.Maximized);

      triggerKeyboard('', { escape: true });

      expect(mockOnRestore).toHaveBeenCalledTimes(1);
      expect(mockOnRestore).toHaveBeenCalledWith(createMockExecution());
      expect(mockOnMinimize).not.toHaveBeenCalled();
      expect(mockOnMaximize).not.toHaveBeenCalled();
    });

    it('does not call onRestore when Escape is pressed from normal state', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({}, PanelState.Normal);

      triggerKeyboard('', { escape: true });

      expect(mockOnRestore).not.toHaveBeenCalled();
      expect(mockOnMinimize).not.toHaveBeenCalled();
      expect(mockOnMaximize).not.toHaveBeenCalled();
    });

    it('does not call onRestore when Escape is pressed from minimized state', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({}, PanelState.Minimized);

      triggerKeyboard('', { escape: true });

      expect(mockOnRestore).not.toHaveBeenCalled();
      expect(mockOnMinimize).not.toHaveBeenCalled();
      expect(mockOnMaximize).not.toHaveBeenCalled();
    });

    it('handles undefined panelState gracefully for Escape key', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({}, undefined);

      // Should not throw error with undefined panelState
      expect(() => {
        triggerKeyboard('', { escape: true });
      }).not.toThrow();

      // Should not call any callbacks when panelState is undefined
      expect(mockOnRestore).not.toHaveBeenCalled();
    });
  });

  describe('Minus Key Minimize Functionality', () => {
    it('calls onMinimize when minus key is pressed from normal state', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({}, PanelState.Normal);

      triggerKeyboard('-', {});

      expect(mockOnMinimize).toHaveBeenCalledTimes(1);
      expect(mockOnMinimize).toHaveBeenCalledWith(createMockExecution());
      expect(mockOnRestore).not.toHaveBeenCalled();
      expect(mockOnMaximize).not.toHaveBeenCalled();
    });

    it('calls onMinimize when minus key is pressed from maximized state', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({}, PanelState.Maximized);

      triggerKeyboard('-', {});

      expect(mockOnMinimize).toHaveBeenCalledTimes(1);
      expect(mockOnMinimize).toHaveBeenCalledWith(createMockExecution());
      expect(mockOnRestore).not.toHaveBeenCalled();
      expect(mockOnMaximize).not.toHaveBeenCalled();
    });

    it('does not call onMinimize when minus key is pressed from minimized state', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({}, PanelState.Minimized);

      triggerKeyboard('-', {});

      expect(mockOnMinimize).not.toHaveBeenCalled();
      expect(mockOnRestore).not.toHaveBeenCalled();
      expect(mockOnMaximize).not.toHaveBeenCalled();
    });

    it('works with underscore key (shift + minus) as well', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({}, PanelState.Normal);

      triggerKeyboard('_', {});

      expect(mockOnMinimize).toHaveBeenCalledTimes(1);
      expect(mockOnMinimize).toHaveBeenCalledWith(createMockExecution());
    });

    it('handles undefined panelState gracefully for minus key', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({}, undefined);

      // Should not throw error with undefined panelState
      expect(() => {
        triggerKeyboard('-', {});
      }).not.toThrow();

      // Should still call onMinimize when panelState is undefined
      expect(mockOnMinimize).toHaveBeenCalledTimes(1);
    });
  });

  describe('Plus Key Restore Functionality', () => {
    it('calls onRestore when plus key is pressed from minimized state', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({}, PanelState.Minimized);

      triggerKeyboard('+', {});

      expect(mockOnRestore).toHaveBeenCalledTimes(1);
      expect(mockOnRestore).toHaveBeenCalledWith(createMockExecution());
      expect(mockOnMinimize).not.toHaveBeenCalled();
      expect(mockOnMaximize).not.toHaveBeenCalled();
    });

    it('does not call onRestore when plus key is pressed from normal state', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({}, PanelState.Normal);

      triggerKeyboard('+', {});

      expect(mockOnRestore).not.toHaveBeenCalled();
      expect(mockOnMinimize).not.toHaveBeenCalled();
      expect(mockOnMaximize).not.toHaveBeenCalled();
    });

    it('does not call onRestore when plus key is pressed from maximized state', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({}, PanelState.Maximized);

      triggerKeyboard('+', {});

      expect(mockOnRestore).not.toHaveBeenCalled();
      expect(mockOnMinimize).not.toHaveBeenCalled();
      expect(mockOnMaximize).not.toHaveBeenCalled();
    });

    it('works with equals key (unshifted plus) as well', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({}, PanelState.Minimized);

      triggerKeyboard('=', {});

      expect(mockOnRestore).toHaveBeenCalledTimes(1);
      expect(mockOnRestore).toHaveBeenCalledWith(createMockExecution());
    });

    it('handles undefined panelState gracefully for plus key', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({}, undefined);

      // Should not throw error with undefined panelState
      expect(() => {
        triggerKeyboard('+', {});
      }).not.toThrow();

      // Should not call any callbacks when panelState is undefined
      expect(mockOnRestore).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Event Handling Edge Cases', () => {
    it('handles unknown key presses gracefully without errors', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({}, PanelState.Normal);

      // Should not throw errors or trigger any actions for unknown keys
      expect(() => {
        triggerKeyboard('x', {});
        triggerKeyboard('1', {});
        triggerKeyboard('Tab', {});
        triggerKeyboard('', { upArrow: true });
        triggerKeyboard('', { downArrow: true });
        triggerKeyboard('', { leftArrow: true });
        triggerKeyboard('', { rightArrow: true });
      }).not.toThrow();

      expect(mockOnSelect).not.toHaveBeenCalled();
      expect(mockOnMinimize).not.toHaveBeenCalled();
      expect(mockOnRestore).not.toHaveBeenCalled();
      expect(mockOnMaximize).not.toHaveBeenCalled();
    });

    it('does not respond to keyboard events when allowKeyboardInput=false', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({
        allowKeyboardInput: false,
        focused: true,
      });

      // Try all keyboard shortcuts
      triggerKeyboard('', { return: true });
      triggerKeyboard(' ', {});
      triggerKeyboard('M', {});
      triggerKeyboard('', { escape: true });
      triggerKeyboard('-', {});
      triggerKeyboard('+', {});

      // Should not trigger any actions
      expect(mockOnSelect).not.toHaveBeenCalled();
      expect(mockOnMinimize).not.toHaveBeenCalled();
      expect(mockOnRestore).not.toHaveBeenCalled();
      expect(mockOnMaximize).not.toHaveBeenCalled();
    });

    it('does not respond to keyboard events when focused=false', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({
        allowKeyboardInput: true,
        focused: false,
      });

      // Try all keyboard shortcuts
      triggerKeyboard('', { return: true });
      triggerKeyboard(' ', {});
      triggerKeyboard('M', {});
      triggerKeyboard('', { escape: true });
      triggerKeyboard('-', {});
      triggerKeyboard('+', {});

      // Should not trigger any actions
      expect(mockOnSelect).not.toHaveBeenCalled();
      expect(mockOnMinimize).not.toHaveBeenCalled();
      expect(mockOnRestore).not.toHaveBeenCalled();
      expect(mockOnMaximize).not.toHaveBeenCalled();
    });

    it('works correctly when all callback props are undefined', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({
        onSelect: undefined,
        onMinimize: undefined,
        onMaximize: undefined,
        onRestore: undefined,
      }, PanelState.Normal);

      // Should not throw errors when callbacks are undefined
      expect(() => {
        triggerKeyboard('', { return: true });
        triggerKeyboard('M', {});
        triggerKeyboard('-', {});
      }).not.toThrow();
    });
  });

  describe('Integration with Component State Management', () => {
    it('works correctly in controlled mode with all panel states', () => {
      const testCases = [
        {
          state: PanelState.Normal,
          key: 'M',
          keyProps: {},
          expectedCallback: mockOnMaximize,
          description: 'maximize from normal'
        },
        {
          state: PanelState.Minimized,
          key: '+',
          keyProps: {},
          expectedCallback: mockOnRestore,
          description: 'restore from minimized'
        },
        {
          state: PanelState.Maximized,
          key: '',
          keyProps: { escape: true },
          expectedCallback: mockOnRestore,
          description: 'restore from maximized'
        },
      ];

      testCases.forEach(({ state, key, keyProps, expectedCallback, description }) => {
        vi.clearAllMocks();
        const { triggerKeyboard } = renderPanelWithKeyboard({}, state);

        triggerKeyboard(key, keyProps);

        expect(expectedCallback).toHaveBeenCalledTimes(1);
        expect(expectedCallback).toHaveBeenCalledWith(createMockExecution());
      });
    });

    it('works correctly with different display modes', () => {
      const displayModes: TerminalPanelDisplayMode[] = ['normal', 'compact', 'verbose'];

      displayModes.forEach((displayMode) => {
        vi.clearAllMocks();
        const { triggerKeyboard } = renderPanelWithKeyboard({
          displayMode,
        }, PanelState.Normal);

        triggerKeyboard('', { return: true });

        expect(mockOnSelect).toHaveBeenCalledTimes(1);
      });
    });

    it('works correctly with different execution statuses', () => {
      const statuses = ['idle', 'running', 'completed', 'failed'] as const;

      statuses.forEach((status) => {
        vi.clearAllMocks();
        const execution = createMockExecution({ status });
        const { triggerKeyboard } = renderPanelWithKeyboard({
          execution,
        }, PanelState.Normal);

        triggerKeyboard('M', {});

        expect(mockOnMaximize).toHaveBeenCalledTimes(1);
        expect(mockOnMaximize).toHaveBeenCalledWith(execution);
      });
    });

    it('passes correct execution object to all callback functions', () => {
      const customExecution = createMockExecution({
        id: 'custom-execution',
        agentName: 'Custom Agent',
        status: 'completed',
      });

      const { triggerKeyboard } = renderPanelWithKeyboard({
        execution: customExecution,
      }, PanelState.Normal);

      // Test all callback functions receive the correct execution object
      triggerKeyboard('', { return: true });
      expect(mockOnSelect).toHaveBeenCalledWith(customExecution);

      triggerKeyboard('M', {});
      expect(mockOnMaximize).toHaveBeenCalledWith(customExecution);

      triggerKeyboard('-', {});
      expect(mockOnMinimize).toHaveBeenCalledWith(customExecution);

      vi.clearAllMocks();

      // Switch to minimized state to test restore
      const { triggerKeyboard: triggerRestore } = renderPanelWithKeyboard({
        execution: customExecution,
      }, PanelState.Minimized);

      triggerRestore('+', {});
      expect(mockOnRestore).toHaveBeenCalledWith(customExecution);
    });
  });

  describe('Accessibility and Performance Considerations', () => {
    it('useInput hook is called correctly on component renders', () => {
      renderPanelWithKeyboard({}, PanelState.Normal);

      // Verify useInput was called at least once
      expect(mockUseInput).toHaveBeenCalled();

      // Verify it was called with the correct parameters
      expect(mockUseInput).toHaveBeenCalledWith(
        expect.any(Function),
        { isActive: true }
      );
    });

    it('responds to rapid keyboard events without errors', () => {
      const { triggerKeyboard } = renderPanelWithKeyboard({}, PanelState.Normal);

      // Rapidly trigger multiple keyboard events
      expect(() => {
        for (let i = 0; i < 10; i++) {
          triggerKeyboard('', { return: true });
          triggerKeyboard('M', {});
          triggerKeyboard('-', {});
        }
      }).not.toThrow();

      // All events should be processed
      expect(mockOnSelect).toHaveBeenCalledTimes(10);
      expect(mockOnMaximize).toHaveBeenCalledTimes(10);
      expect(mockOnMinimize).toHaveBeenCalledTimes(10);
    });

    it('maintains keyboard functionality across component updates', () => {
      const { triggerKeyboard, rerender } = renderPanelWithKeyboard({
        execution: createMockExecution({ agentName: 'Agent 1' }),
      }, PanelState.Normal);

      // Test initial functionality
      triggerKeyboard('', { return: true });
      expect(mockOnSelect).toHaveBeenCalledTimes(1);

      // Update execution
      rerender(<TestWrapper><AgentTerminalPanel
        execution={createMockExecution({ agentName: 'Agent 2' })}
        onSelect={mockOnSelect}
        onMinimize={mockOnMinimize}
        onMaximize={mockOnMaximize}
        onRestore={mockOnRestore}
        panelState={PanelState.Normal}
        focused={true}
        allowKeyboardInput={true}
      /></TestWrapper>);

      vi.clearAllMocks();

      // Test keyboard functionality still works
      triggerKeyboard('M', {});
      expect(mockOnMaximize).toHaveBeenCalledTimes(1);
    });
  });

  describe('Terminal Feedback and Integration', () => {
    it('renders without errors when keyboard handlers are active', () => {
      expect(() => {
        renderPanelWithKeyboard({
          allowKeyboardInput: true,
          focused: true,
        });
      }).not.toThrow();

      // Verify the component rendered successfully
      expect(mockUseInput).toHaveBeenCalled();
    });

    it('maintains visual state consistency during keyboard interactions', () => {
      // Test that keyboard interactions don't interfere with visual rendering
      const { lastFrame, triggerKeyboard } = renderPanelWithKeyboard({}, PanelState.Normal);

      const initialFrame = lastFrame();

      // Trigger keyboard events
      triggerKeyboard('', { return: true });
      triggerKeyboard('M', {});

      // Frame should still be valid (component didn't crash)
      const finalFrame = lastFrame();
      expect(finalFrame).toBeTruthy();
    });

    it('works with different border styles and visual configurations', () => {
      const borderStyles = ['single', 'round', 'double', 'none'] as const;

      borderStyles.forEach((borderStyle) => {
        vi.clearAllMocks();
        const { triggerKeyboard } = renderPanelWithKeyboard({
          borderStyle,
        }, PanelState.Normal);

        // Keyboard functionality should work regardless of border style
        triggerKeyboard('', { return: true });
        expect(mockOnSelect).toHaveBeenCalledTimes(1);
      });
    });
  });
});
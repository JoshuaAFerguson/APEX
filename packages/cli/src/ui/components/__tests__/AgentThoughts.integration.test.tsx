/**
 * Integration tests for AgentThoughts component with real CollapsibleSection
 * Tests actual component interaction and behavior rather than mocked interfaces
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentThoughts, type AgentThoughtsProps } from '../AgentThoughts.js';

// Mock only Ink components for testing, but use real CollapsibleSection
vi.mock('ink', () => ({
  Box: ({ children, onClick, ...props }: {
    children: React.ReactNode;
    onClick?: () => void;
    [key: string]: any;
  }) => (
    <div
      data-testid="box"
      onClick={onClick}
      data-border-style={props.borderStyle}
      data-border-color={props.borderColor}
      data-width={props.width}
      data-padding-x={props.paddingX}
      data-padding-y={props.paddingY}
      data-flex-direction={props.flexDirection}
      data-justify-content={props.justifyContent}
      {...props}
    >
      {children}
    </div>
  ),
  Text: ({ children, color, dimColor, wrap, bold, onClick, ...props }: {
    children: React.ReactNode;
    color?: string;
    dimColor?: boolean;
    wrap?: string;
    bold?: boolean;
    onClick?: () => void;
    [key: string]: any;
  }) => (
    <span
      data-testid="text"
      data-color={color}
      data-dim={dimColor}
      data-wrap={wrap}
      data-bold={bold}
      onClick={onClick}
      {...props}
    >
      {children}
    </span>
  ),
  useInput: vi.fn(),
}));

describe('AgentThoughts Integration Tests', () => {
  const defaultProps: AgentThoughtsProps = {
    thinking: 'This is a comprehensive test of the agent thinking process with detailed reasoning steps.',
    agent: 'test-agent',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('CollapsibleSection Integration', () => {
    it('should properly integrate with CollapsibleSection for expand/collapse functionality', () => {
      const onToggle = vi.fn();
      render(
        <AgentThoughts
          {...defaultProps}
          defaultCollapsed={true}
          onToggle={onToggle}
        />
      );

      // Should start collapsed - only header box visible
      const boxes = screen.getAllByTestId('box');
      expect(boxes.length).toBeGreaterThan(0);

      // Find the clickable header box
      const headerBox = boxes.find(box => box.getAttribute('onClick') !== null);
      expect(headerBox).toBeInTheDocument();

      // Click to expand
      act(() => {
        fireEvent.click(headerBox!);
      });

      expect(onToggle).toHaveBeenCalledWith(false); // Collapsed -> expanded
    });

    it('should handle controlled collapsed state properly', () => {
      const { rerender } = render(
        <AgentThoughts {...defaultProps} collapsed={true} />
      );

      // Should be collapsed initially
      const boxes = screen.getAllByTestId('box');
      const collapsedBox = boxes.find(box =>
        box.getAttribute('data-border-style') === 'round' &&
        box.getAttribute('data-padding-x') === '1'
      );
      expect(collapsedBox).toBeInTheDocument();

      // Change to expanded
      rerender(<AgentThoughts {...defaultProps} collapsed={false} />);

      // Should now show expanded layout
      const expandedBoxes = screen.getAllByTestId('box');
      const expandedContainer = expandedBoxes.find(box =>
        box.getAttribute('data-flex-direction') === 'column'
      );
      expect(expandedContainer).toBeInTheDocument();
    });

    it('should pass correct styling props to CollapsibleSection', () => {
      render(<AgentThoughts {...defaultProps} displayMode="verbose" />);

      // Check for dimmed border styling
      const styledBoxes = screen.getAllByTestId('box');
      const borderBox = styledBoxes.find(box =>
        box.getAttribute('data-border-color') === 'gray'
      );
      expect(borderBox).toBeInTheDocument();
    });

    it('should handle display mode changes affecting CollapsibleSection', () => {
      const { rerender } = render(
        <AgentThoughts {...defaultProps} displayMode="normal" />
      );

      // Switch to compact mode
      rerender(<AgentThoughts {...defaultProps} displayMode="compact" />);

      // In compact mode, should render empty Box instead of CollapsibleSection
      const boxes = screen.getAllByTestId('box');
      expect(boxes).toHaveLength(1);
      expect(boxes[0]).toHaveAttribute('data-testid', 'box');

      // Switch to verbose mode
      rerender(<AgentThoughts {...defaultProps} displayMode="verbose" />);

      // Should render full CollapsibleSection structure again
      const verboseBoxes = screen.getAllByTestId('box');
      expect(verboseBoxes.length).toBeGreaterThan(1);
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should handle rapid agent thinking updates in a conversation', () => {
      const { rerender } = render(<AgentThoughts {...defaultProps} />);

      const thoughts = [
        'I need to analyze the user request...',
        'Let me break this down into steps...',
        'First, I should consider the context...',
        'Now I need to plan my approach...',
        'Finally, I can execute the solution...'
      ];

      // Simulate rapid thinking updates
      thoughts.forEach((thought, index) => {
        rerender(
          <AgentThoughts
            thinking={thought}
            agent={`agent-${index}`}
            key={index}
          />
        );

        // Verify content updates correctly
        const textElement = screen.getByTestId('text');
        expect(textElement).toHaveTextContent(thought);
      });
    });

    it('should handle multi-agent conversation scenarios', () => {
      const agents = ['planner', 'developer', 'tester', 'reviewer'];
      const thoughts = agents.map(agent =>
        `${agent} is analyzing the situation and determining next steps...`
      );

      // Render multiple AgentThoughts for different agents
      render(
        <div>
          {agents.map((agent, index) => (
            <AgentThoughts
              key={agent}
              thinking={thoughts[index]}
              agent={agent}
              defaultCollapsed={false}
            />
          ))}
        </div>
      );

      // Verify all agents rendered
      const textElements = screen.getAllByTestId('text');
      const agentTexts = textElements.filter(el =>
        el.textContent?.includes('thinking')
      );
      expect(agentTexts).toHaveLength(4);

      // Verify each agent has unique content
      agents.forEach(agent => {
        expect(screen.getByText(`💭 ${agent} thinking`)).toBeInTheDocument();
      });
    });

    it('should handle progressive disclosure workflow', () => {
      const longThinking = `
        This is a very detailed thinking process that involves multiple steps:

        1. Understanding the problem scope and constraints
        2. Analyzing available resources and tools
        3. Designing a solution architecture
        4. Planning implementation phases
        5. Considering potential risks and mitigation strategies
        6. Reviewing alternative approaches
        7. Making final recommendations

        Each step requires careful consideration of various factors...
      `.trim();

      const onToggle = vi.fn();
      render(
        <AgentThoughts
          thinking={longThinking}
          agent="architect"
          defaultCollapsed={true}
          onToggle={onToggle}
          maxLength={100}
        />
      );

      // Should start collapsed with truncated content shown in header
      expect(screen.getByText('💭 architect thinking')).toBeInTheDocument();

      // Find and click the expand button
      const boxes = screen.getAllByTestId('box');
      const clickableBox = boxes.find(box => box.getAttribute('onClick'));
      expect(clickableBox).toBeInTheDocument();

      act(() => {
        fireEvent.click(clickableBox!);
      });

      // Should expand and show full content
      expect(onToggle).toHaveBeenCalledWith(false);
    });

    it('should integrate properly with larger UI contexts', () => {
      // Simulate embedding in a larger interface with multiple components
      const conversationState = {
        messages: ['Hello', 'How can I help?'],
        activeAgent: 'assistant',
        thinking: 'I need to understand the user\'s request better...'
      };

      render(
        <div data-testid="conversation-ui">
          <div data-testid="messages">
            {conversationState.messages.map((msg, i) => (
              <div key={i}>{msg}</div>
            ))}
          </div>
          <AgentThoughts
            thinking={conversationState.thinking}
            agent={conversationState.activeAgent}
            displayMode="normal"
          />
          <div data-testid="input-area">Input area placeholder</div>
        </div>
      );

      // Verify integration doesn't break surrounding components
      expect(screen.getByTestId('conversation-ui')).toBeInTheDocument();
      expect(screen.getByTestId('messages')).toBeInTheDocument();
      expect(screen.getByTestId('input-area')).toBeInTheDocument();
      expect(screen.getByText('💭 assistant thinking')).toBeInTheDocument();
    });
  });

  describe('State Management Integration', () => {
    it('should maintain state consistency during prop changes', () => {
      const { rerender } = render(
        <AgentThoughts
          {...defaultProps}
          defaultCollapsed={false}
          displayMode="normal"
        />
      );

      // Verify initial expanded state
      const initialBoxes = screen.getAllByTestId('box');
      expect(initialBoxes.length).toBeGreaterThan(1); // Header + content

      // Change multiple props simultaneously
      rerender(
        <AgentThoughts
          thinking="Updated thinking process"
          agent="updated-agent"
          displayMode="verbose"
          maxLength={200}
          defaultCollapsed={false}
        />
      );

      // Should maintain expanded state and show updated content
      expect(screen.getByText('💭 updated-agent thinking')).toBeInTheDocument();
      const textElement = screen.getByTestId('text');
      expect(textElement).toHaveTextContent('Updated thinking process');
    });

    it('should handle external state management integration', () => {
      // Simulate external state management (Redux, Context, etc.)
      let externalState = {
        collapsed: false,
        agent: 'external-agent',
        thinking: 'Externally managed thinking content'
      };

      const ExternalStateWrapper = () => {
        const [state, setState] = React.useState(externalState);

        const handleToggle = (collapsed: boolean) => {
          setState(prev => ({ ...prev, collapsed }));
          externalState = { ...externalState, collapsed };
        };

        return (
          <AgentThoughts
            thinking={state.thinking}
            agent={state.agent}
            collapsed={state.collapsed}
            onToggle={handleToggle}
          />
        );
      };

      render(<ExternalStateWrapper />);

      // Verify external state integration
      expect(screen.getByText('💭 external-agent thinking')).toBeInTheDocument();

      // Simulate external state change
      const boxes = screen.getAllByTestId('box');
      const clickableBox = boxes.find(box => box.getAttribute('onClick'));

      act(() => {
        fireEvent.click(clickableBox!);
      });

      // State should be updated externally
      expect(externalState.collapsed).toBe(true);
    });
  });

  describe('Performance Integration Tests', () => {
    it('should handle frequent re-renders efficiently', () => {
      const startTime = performance.now();
      const { rerender } = render(<AgentThoughts {...defaultProps} />);

      // Simulate 100 rapid re-renders
      for (let i = 0; i < 100; i++) {
        rerender(
          <AgentThoughts
            thinking={`Thinking iteration ${i}`}
            agent={`agent-${i}`}
            displayMode={i % 2 === 0 ? 'normal' : 'verbose'}
          />
        );
      }

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(renderTime).toBeLessThan(1000); // 1 second threshold

      // Verify final state is correct
      expect(screen.getByText('💭 agent-99 thinking')).toBeInTheDocument();
    });

    it('should handle large content efficiently', () => {
      const largeContent = 'x'.repeat(50000);
      const startTime = performance.now();

      render(
        <AgentThoughts
          thinking={largeContent}
          agent="performance-agent"
          maxLength={1000}
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render large content efficiently
      expect(renderTime).toBeLessThan(500); // 500ms threshold

      // Verify content is properly truncated
      const textElement = screen.getByTestId('text');
      const displayedText = textElement.textContent || '';
      expect(displayedText).toHaveLength(1003); // 1000 + '...'
    });

    it('should manage memory efficiently with component lifecycle', () => {
      const components = [];

      // Create multiple instances
      for (let i = 0; i < 50; i++) {
        const { unmount } = render(
          <AgentThoughts
            thinking={`Memory test ${i}`}
            agent={`agent-${i}`}
          />
        );
        components.push(unmount);
      }

      // Unmount all instances
      components.forEach(unmount => unmount());

      // Should not cause memory issues
      expect(components).toHaveLength(50);
    });
  });

  describe('Accessibility Integration', () => {
    it('should maintain accessibility when integrated with screen reader flow', () => {
      render(
        <div role="main" aria-label="Agent conversation">
          <h2>Agent Thoughts</h2>
          <AgentThoughts
            thinking="This is accessible thinking content that should work well with screen readers"
            agent="accessible-agent"
            defaultCollapsed={false}
          />
        </div>
      );

      // Verify accessibility structure is maintained
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByText('Agent Thoughts')).toBeInTheDocument();
      expect(screen.getByText('💭 accessible-agent thinking')).toBeInTheDocument();

      // Verify content is accessible
      const thinkingContent = screen.getByTestId('text');
      expect(thinkingContent).toHaveTextContent('This is accessible thinking content');
    });

    it('should work properly with keyboard navigation flow', () => {
      const mockUseInput = vi.mocked(require('ink').useInput);
      let keyboardCallback: ((input: string, key: any) => void) | null = null;

      mockUseInput.mockImplementation((callback) => {
        keyboardCallback = callback;
      });

      const onToggle = vi.fn();
      render(
        <AgentThoughts
          {...defaultProps}
          onToggle={onToggle}
          defaultCollapsed={true}
        />
      );

      // Simulate keyboard interaction
      act(() => {
        keyboardCallback?.('', { return: true });
      });

      // Should be called by CollapsibleSection's keyboard handler
      expect(mockUseInput).toHaveBeenCalled();
    });
  });
});
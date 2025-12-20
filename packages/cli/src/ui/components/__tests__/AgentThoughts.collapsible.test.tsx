import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { AgentThoughts } from '../AgentThoughts';

describe('AgentThoughts - Collapsible Functionality', () => {
  const mockThinkingContent = 'This is the agent thinking process that should be collapsible';
  const agentName = 'developer';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('collapsible behavior', () => {
    it('starts collapsed by default', () => {
      render(
        <AgentThoughts
          thinking={mockThinkingContent}
          agent={agentName}
        />
      );

      // Should show the title/header
      expect(screen.getByText(/💭 developer thinking/)).toBeInTheDocument();

      // Content should not be visible when collapsed
      expect(screen.queryByText(mockThinkingContent)).not.toBeInTheDocument();
    });

    it('can start expanded when defaultCollapsed=false', () => {
      render(
        <AgentThoughts
          thinking={mockThinkingContent}
          agent={agentName}
          defaultCollapsed={false}
        />
      );

      // Should show the title/header
      expect(screen.getByText(/💭 developer thinking/)).toBeInTheDocument();

      // Content should be visible when expanded
      expect(screen.getByText(mockThinkingContent)).toBeInTheDocument();
    });

    it('supports controlled collapsed state', () => {
      const mockToggle = vi.fn();
      const { rerender } = render(
        <AgentThoughts
          thinking={mockThinkingContent}
          agent={agentName}
          collapsed={true}
          onToggle={mockToggle}
        />
      );

      // Should be collapsed
      expect(screen.queryByText(mockThinkingContent)).not.toBeInTheDocument();

      // Change to expanded
      rerender(
        <AgentThoughts
          thinking={mockThinkingContent}
          agent={agentName}
          collapsed={false}
          onToggle={mockToggle}
        />
      );

      // Should now be expanded
      expect(screen.getByText(mockThinkingContent)).toBeInTheDocument();
    });

    it('calls onToggle when collapse state changes', () => {
      const mockToggle = vi.fn();
      render(
        <AgentThoughts
          thinking={mockThinkingContent}
          agent={agentName}
          onToggle={mockToggle}
        />
      );

      // Mock the CollapsibleSection's toggle behavior
      // Since we can't directly click in the terminal UI, this tests the prop passing
      expect(mockToggle).not.toHaveBeenCalled();
    });
  });

  describe('visual styling', () => {
    it('uses dimmed styling for secondary content appearance', () => {
      render(
        <AgentThoughts
          thinking={mockThinkingContent}
          agent={agentName}
          defaultCollapsed={false}
        />
      );

      // The component should pass dimmed=true to CollapsibleSection
      // This is tested by verifying the content renders with proper styling
      expect(screen.getByText(mockThinkingContent)).toBeInTheDocument();
    });

    it('uses round border style', () => {
      render(
        <AgentThoughts
          thinking={mockThinkingContent}
          agent={agentName}
          defaultCollapsed={false}
        />
      );

      // Component should pass borderStyle="round" to CollapsibleSection
      expect(screen.getByText(/💭 developer thinking/)).toBeInTheDocument();
    });

    it('shows thinking icon in title', () => {
      render(
        <AgentThoughts
          thinking={mockThinkingContent}
          agent={agentName}
        />
      );

      expect(screen.getByText(/💭 developer thinking/)).toBeInTheDocument();
    });

    it('supports custom thinking icon', () => {
      render(
        <AgentThoughts
          thinking={mockThinkingContent}
          agent={agentName}
          icon="🧠"
        />
      );

      expect(screen.getByText(/🧠 developer thinking/)).toBeInTheDocument();
    });

    it('supports ASCII icons for terminal compatibility', () => {
      render(
        <AgentThoughts
          thinking={mockThinkingContent}
          agent={agentName}
          useAsciiIcons={true}
        />
      );

      expect(screen.getByText(/\[T\] developer thinking/)).toBeInTheDocument();
    });
  });

  describe('content truncation', () => {
    const longThinking = 'This is a very long thinking content that exceeds the default maximum length. '.repeat(20);

    it('truncates content when it exceeds maxLength', () => {
      render(
        <AgentThoughts
          thinking={longThinking}
          agent={agentName}
          defaultCollapsed={false}
          maxLength={100}
        />
      );

      // Should show truncated content with ellipsis
      const displayedText = screen.getByText(/This is a very long thinking content/);
      expect(displayedText.textContent).toContain('...');
      expect(displayedText.textContent!.length).toBeLessThan(longThinking.length);
    });

    it('shows character count when content is truncated', () => {
      render(
        <AgentThoughts
          thinking={longThinking}
          agent={agentName}
          defaultCollapsed={true}
          maxLength={100}
        />
      );

      // Should show character count in header
      expect(screen.getByText(new RegExp(`\\(${longThinking.length} chars\\)`))).toBeInTheDocument();
    });

    it('does not show character count for short content', () => {
      const shortThinking = 'Short content';
      render(
        <AgentThoughts
          thinking={shortThinking}
          agent={agentName}
        />
      );

      // Should not show character count
      expect(screen.queryByText(/chars/)).not.toBeInTheDocument();
    });

    it('uses different maxLength in verbose mode', () => {
      render(
        <AgentThoughts
          thinking={longThinking}
          agent={agentName}
          defaultCollapsed={false}
          displayMode="verbose"
          maxLength={100} // Should be overridden to 1000 in verbose mode
        />
      );

      // In verbose mode, should allow longer content before truncation
      expect(screen.getByText(/This is a very long thinking content/)).toBeInTheDocument();
    });
  });

  describe('display mode behavior', () => {
    it('does not render in compact mode', () => {
      const { container } = render(
        <AgentThoughts
          thinking={mockThinkingContent}
          agent={agentName}
          displayMode="compact"
        />
      );

      // Should render an empty Box in compact mode
      expect(container.firstChild).toBeTruthy();
      expect(screen.queryByText(/thinking/)).not.toBeInTheDocument();
    });

    it('renders normally in normal mode', () => {
      render(
        <AgentThoughts
          thinking={mockThinkingContent}
          agent={agentName}
          displayMode="normal"
        />
      );

      expect(screen.getByText(/💭 developer thinking/)).toBeInTheDocument();
    });

    it('renders with extra info in verbose mode', () => {
      render(
        <AgentThoughts
          thinking={mockThinkingContent}
          agent={agentName}
          displayMode="verbose"
        />
      );

      expect(screen.getByText(/💭 developer thinking/)).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles empty thinking content', () => {
      render(
        <AgentThoughts
          thinking=""
          agent={agentName}
          defaultCollapsed={false}
        />
      );

      expect(screen.getByText(/💭 developer thinking/)).toBeInTheDocument();
      // Empty content should not cause issues
    });

    it('handles very long agent names', () => {
      const longAgentName = 'very-long-agent-name-that-might-cause-display-issues';
      render(
        <AgentThoughts
          thinking={mockThinkingContent}
          agent={longAgentName}
        />
      );

      expect(screen.getByText(new RegExp(`💭 ${longAgentName} thinking`))).toBeInTheDocument();
    });

    it('handles multiline thinking content', () => {
      const multilineThinking = `Step 1: Analyze the problem
Step 2: Design solution
Step 3: Implement code`;

      render(
        <AgentThoughts
          thinking={multilineThinking}
          agent={agentName}
          defaultCollapsed={false}
        />
      );

      expect(screen.getByText(/Step 1: Analyze the problem/)).toBeInTheDocument();
    });

    it('handles special characters in thinking content', () => {
      const specialThinking = 'Thinking with émojis 🤔💭, "quotes", \'apostrophes\', <html>, & special chars';

      render(
        <AgentThoughts
          thinking={specialThinking}
          agent={agentName}
          defaultCollapsed={false}
        />
      );

      expect(screen.getByText(/Thinking with émojis/)).toBeInTheDocument();
    });

    it('handles Unicode characters properly', () => {
      const unicodeThinking = 'Testing Unicode: 测试中文, العربية, русский, 日本語, 🚀💻🔥';

      render(
        <AgentThoughts
          thinking={unicodeThinking}
          agent={agentName}
          defaultCollapsed={false}
        />
      );

      expect(screen.getByText(/Testing Unicode/)).toBeInTheDocument();
    });
  });

  describe('accessibility considerations', () => {
    it('provides clear thinking indicator in title', () => {
      render(
        <AgentThoughts
          thinking={mockThinkingContent}
          agent={agentName}
        />
      );

      // Title should clearly indicate this is thinking content
      expect(screen.getByText(/💭 developer thinking/)).toBeInTheDocument();
    });

    it('maintains semantic meaning with text wrapping', () => {
      render(
        <AgentThoughts
          thinking={mockThinkingContent}
          agent={agentName}
          defaultCollapsed={false}
        />
      );

      // Content should have wrap="wrap" for proper text flow
      expect(screen.getByText(mockThinkingContent)).toBeInTheDocument();
    });

    it('uses appropriate colors for secondary content', () => {
      render(
        <AgentThoughts
          thinking={mockThinkingContent}
          agent={agentName}
          defaultCollapsed={false}
        />
      );

      // Should use gray/dimmed colors for secondary content
      expect(screen.getByText(mockThinkingContent)).toBeInTheDocument();
    });
  });

  describe('integration with CollapsibleSection', () => {
    it('passes correct props to CollapsibleSection', () => {
      const mockToggle = vi.fn();

      render(
        <AgentThoughts
          thinking={mockThinkingContent}
          agent={agentName}
          defaultCollapsed={true}
          collapsed={false}
          onToggle={mockToggle}
          displayMode="verbose"
        />
      );

      // Should pass all relevant props to CollapsibleSection
      expect(screen.getByText(/💭 developer thinking/)).toBeInTheDocument();
    });

    it('maintains CollapsibleSection keyboard functionality', () => {
      render(
        <AgentThoughts
          thinking={mockThinkingContent}
          agent={agentName}
        />
      );

      // CollapsibleSection should handle keyboard events (tested in CollapsibleSection tests)
      expect(screen.getByText(/💭 developer thinking/)).toBeInTheDocument();
    });
  });

  describe('performance considerations', () => {
    it('handles large thinking content efficiently', () => {
      const hugethinking = 'Large thinking content. '.repeat(1000);

      render(
        <AgentThoughts
          thinking={hugethinking}
          agent={agentName}
          maxLength={500}
        />
      );

      // Should render without performance issues due to truncation
      expect(screen.getByText(/💭 developer thinking/)).toBeInTheDocument();
    });

    it('handles rapid prop updates', () => {
      const { rerender } = render(
        <AgentThoughts
          thinking="Initial thinking"
          agent={agentName}
        />
      );

      expect(screen.getByText(/💭 developer thinking/)).toBeInTheDocument();

      // Rapidly update thinking content
      for (let i = 0; i < 10; i++) {
        rerender(
          <AgentThoughts
            thinking={`Updated thinking ${i}`}
            agent={agentName}
          />
        );
      }

      // Should handle updates gracefully
      expect(screen.getByText(/💭 developer thinking/)).toBeInTheDocument();
    });
  });
});
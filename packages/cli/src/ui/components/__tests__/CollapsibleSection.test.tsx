import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Text } from 'ink';
import { CollapsibleSection, type CollapsibleSectionProps } from '../CollapsibleSection.js';

// Mock Ink's useInput hook
const mockUseInput = vi.fn();
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: mockUseInput,
  };
});

// Helper function to render CollapsibleSection with default props
function renderCollapsibleSection(props: Partial<CollapsibleSectionProps> = {}) {
  const defaultProps: CollapsibleSectionProps = {
    title: 'Test Section',
    children: <Text>Test content</Text>,
    ...props,
  };

  return render(<CollapsibleSection {...defaultProps} />);
}

describe('CollapsibleSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset useInput mock to not interfere with tests
    mockUseInput.mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Basic Rendering', () => {
    it('renders with title and children when expanded', () => {
      renderCollapsibleSection();

      expect(screen.getByText('Test Section')).toBeInTheDocument();
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('renders with default expanded state', () => {
      renderCollapsibleSection();

      // Content should be visible by default
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('renders collapsed when defaultCollapsed is true', () => {
      renderCollapsibleSection({ defaultCollapsed: true });

      expect(screen.getByText('Test Section')).toBeInTheDocument();
      expect(screen.queryByText('Test content')).not.toBeInTheDocument();
    });

    it('shows arrow indicator by default', () => {
      renderCollapsibleSection();

      // Arrow should be present (either ▶ or ▼)
      const arrowElements = screen.getAllByText(/[▶▼]/);
      expect(arrowElements.length).toBeGreaterThan(0);
    });

    it('hides arrow indicator when showArrow is false', () => {
      renderCollapsibleSection({ showArrow: false });

      // Should not find arrow characters
      expect(screen.queryByText('▶')).not.toBeInTheDocument();
      expect(screen.queryByText('▼')).not.toBeInTheDocument();
    });
  });

  describe('Toggle Behavior', () => {
    it('toggles state on click', () => {
      const onToggle = vi.fn();
      renderCollapsibleSection({ onToggle });

      // Find the clickable header (contains the title)
      const header = screen.getByText('Test Section').closest('[data-testid]') ||
                    screen.getByText('Test Section').parentElement;

      expect(screen.getByText('Test content')).toBeInTheDocument();

      // Click to collapse
      fireEvent.click(header!);

      expect(onToggle).toHaveBeenCalledWith(true); // collapsed = true
      expect(screen.queryByText('Test content')).not.toBeInTheDocument();
    });

    it('calls onToggle callback with correct state', () => {
      const onToggle = vi.fn();
      renderCollapsibleSection({ onToggle, defaultCollapsed: true });

      const header = screen.getByText('Test Section').closest('[data-testid]') ||
                    screen.getByText('Test Section').parentElement;

      fireEvent.click(header!);

      expect(onToggle).toHaveBeenCalledWith(false); // collapsed = false (expanding)
    });

    it('respects controlled state', () => {
      const onToggle = vi.fn();
      const { rerender } = render(
        <CollapsibleSection
          title="Test Section"
          collapsed={true}
          onToggle={onToggle}
        >
          <Text>Test content</Text>
        </CollapsibleSection>
      );

      // Should be collapsed
      expect(screen.queryByText('Test content')).not.toBeInTheDocument();

      // Re-render with collapsed=false
      rerender(
        <CollapsibleSection
          title="Test Section"
          collapsed={false}
          onToggle={onToggle}
        >
          <Text>Test content</Text>
        </CollapsibleSection>
      );

      // Should now be expanded
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('maintains internal state when uncontrolled', () => {
      renderCollapsibleSection();

      const header = screen.getByText('Test Section').closest('[data-testid]') ||
                    screen.getByText('Test Section').parentElement;

      // Initially expanded
      expect(screen.getByText('Test content')).toBeInTheDocument();

      // Click to collapse
      fireEvent.click(header!);
      expect(screen.queryByText('Test content')).not.toBeInTheDocument();

      // Click to expand
      fireEvent.click(header!);
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });
  });

  describe('Arrow Animation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    });

    it('shows correct arrow direction when collapsed', () => {
      renderCollapsibleSection({ defaultCollapsed: true });

      expect(screen.getByText('▶')).toBeInTheDocument();
    });

    it('shows correct arrow direction when expanded', () => {
      renderCollapsibleSection({ defaultCollapsed: false });

      expect(screen.getByText('▼')).toBeInTheDocument();
    });

    it('animates arrow rotation during state change', async () => {
      renderCollapsibleSection({ defaultCollapsed: true });

      // Initially should show right arrow
      expect(screen.getByText('▶')).toBeInTheDocument();

      const header = screen.getByText('Test Section').closest('[data-testid]') ||
                    screen.getByText('Test Section').parentElement;

      // Click to expand
      fireEvent.click(header!);

      // Advance timers to complete animation
      vi.advanceTimersByTime(200);

      // After animation, should show down arrow
      await waitFor(() => {
        expect(screen.queryByText('▼')).toBeInTheDocument();
      });
    });
  });

  describe('Display Mode Support', () => {
    it('renders correctly in normal mode', () => {
      renderCollapsibleSection({ displayMode: 'normal' });

      expect(screen.getByText('Test Section')).toBeInTheDocument();
      // Normal mode shows full title
      expect(screen.getByText('Test Section')).toBeInTheDocument();
    });

    it('renders correctly in compact mode', () => {
      renderCollapsibleSection({ displayMode: 'compact' });

      expect(screen.getByText('Test Section')).toBeInTheDocument();
    });

    it('renders correctly in verbose mode', () => {
      renderCollapsibleSection({ displayMode: 'verbose', defaultCollapsed: true });

      expect(screen.getByText('Test Section')).toBeInTheDocument();
      expect(screen.getByText('[collapsed]')).toBeInTheDocument();
    });

    it('shows state information in verbose mode when expanded', () => {
      renderCollapsibleSection({ displayMode: 'verbose', defaultCollapsed: false });

      expect(screen.getByText('Test Section')).toBeInTheDocument();
      expect(screen.getByText('[expanded]')).toBeInTheDocument();
    });

    it('abbreviates long titles in compact mode', () => {
      const longTitle = 'This is a very long title that should be abbreviated in compact mode';
      renderCollapsibleSection({
        title: longTitle,
        displayMode: 'compact'
      });

      // Should show abbreviated title with ellipsis
      const titleElement = screen.getByText(/This is a very long/);
      expect(titleElement.textContent).toContain('...');
    });
  });

  describe('Dimmed Styling', () => {
    it('applies dimmed styling when dimmed prop is true', () => {
      renderCollapsibleSection({ dimmed: true });

      // The component should still render, but styling would be different
      expect(screen.getByText('Test Section')).toBeInTheDocument();
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('applies normal styling when dimmed prop is false', () => {
      renderCollapsibleSection({ dimmed: false });

      expect(screen.getByText('Test Section')).toBeInTheDocument();
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });
  });

  describe('Props Handling', () => {
    it('respects borderStyle prop', () => {
      renderCollapsibleSection({ borderStyle: 'double' });

      expect(screen.getByText('Test Section')).toBeInTheDocument();
    });

    it('respects borderColor prop', () => {
      renderCollapsibleSection({ borderColor: 'red' });

      expect(screen.getByText('Test Section')).toBeInTheDocument();
    });

    it('respects width prop', () => {
      renderCollapsibleSection({ width: 50 });

      expect(screen.getByText('Test Section')).toBeInTheDocument();
    });

    it('renders headerExtra content', () => {
      renderCollapsibleSection({
        headerExtra: <Text>Extra Content</Text>
      });

      expect(screen.getByText('Test Section')).toBeInTheDocument();
      expect(screen.getByText('Extra Content')).toBeInTheDocument();
    });

    it('respects borderStyle none', () => {
      renderCollapsibleSection({ borderStyle: 'none' });

      expect(screen.getByText('Test Section')).toBeInTheDocument();
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });
  });

  describe('Keyboard Interaction', () => {
    it('registers keyboard input handler when allowKeyboardToggle is true', () => {
      renderCollapsibleSection({ allowKeyboardToggle: true });

      // Verify useInput was called with isActive: true
      expect(mockUseInput).toHaveBeenCalledWith(
        expect.any(Function),
        { isActive: true }
      );
    });

    it('does not register keyboard input handler when allowKeyboardToggle is false', () => {
      renderCollapsibleSection({ allowKeyboardToggle: false });

      // Verify useInput was called with isActive: false
      expect(mockUseInput).toHaveBeenCalledWith(
        expect.any(Function),
        { isActive: false }
      );
    });

    it('handles Enter key press for toggling', () => {
      const onToggle = vi.fn();
      renderCollapsibleSection({ onToggle, allowKeyboardToggle: true });

      // Get the input handler function
      const inputHandler = mockUseInput.mock.calls[0][0];

      // Simulate Enter key press
      inputHandler('', { return: true });

      expect(onToggle).toHaveBeenCalledWith(true);
    });

    it('handles custom toggle key', () => {
      const onToggle = vi.fn();
      renderCollapsibleSection({
        onToggle,
        allowKeyboardToggle: true,
        toggleKey: 'x'
      });

      // Get the input handler function
      const inputHandler = mockUseInput.mock.calls[0][0];

      // Simulate custom key press
      inputHandler('x', {});

      expect(onToggle).toHaveBeenCalledWith(true);
    });

    it('ignores keyboard input when allowKeyboardToggle is false', () => {
      const onToggle = vi.fn();
      renderCollapsibleSection({
        onToggle,
        allowKeyboardToggle: false
      });

      // Get the input handler function
      const inputHandler = mockUseInput.mock.calls[0][0];

      // Simulate Enter key press
      inputHandler('', { return: true });

      // Should not toggle since keyboard input is disabled
      expect(onToggle).not.toHaveBeenCalled();
    });
  });

  describe('Complex Content Handling', () => {
    it('handles complex React children', () => {
      const ComplexContent = () => (
        <div>
          <Text>Line 1</Text>
          <Text>Line 2</Text>
        </div>
      );

      renderCollapsibleSection({ children: <ComplexContent /> });

      expect(screen.getByText('Line 1')).toBeInTheDocument();
      expect(screen.getByText('Line 2')).toBeInTheDocument();
    });

    it('handles empty children gracefully', () => {
      renderCollapsibleSection({ children: null });

      expect(screen.getByText('Test Section')).toBeInTheDocument();
      // Should not crash with null children
    });

    it('handles text content as children', () => {
      renderCollapsibleSection({ children: 'Simple text content' });

      expect(screen.getByText('Test Section')).toBeInTheDocument();
      expect(screen.getByText('Simple text content')).toBeInTheDocument();
    });
  });
});
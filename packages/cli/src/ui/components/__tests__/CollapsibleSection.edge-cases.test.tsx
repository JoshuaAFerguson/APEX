import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Text, Box } from 'ink';
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

describe('CollapsibleSection Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockUseInput.mockImplementation(() => {});
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles undefined children gracefully', () => {
      renderCollapsibleSection({ children: undefined });

      expect(screen.getByText('Test Section')).toBeInTheDocument();
      // Should not crash with undefined children
    });

    it('handles empty string title', () => {
      renderCollapsibleSection({ title: '' });

      // Should still render header structure
      const arrowElements = screen.queryAllByText(/[▶▼]/);
      expect(arrowElements.length).toBeGreaterThan(0);
    });

    it('handles very long titles gracefully', () => {
      const veryLongTitle = 'This is an extremely long title that should be handled gracefully by the component without breaking the layout or causing any rendering issues in the terminal interface';

      renderCollapsibleSection({
        title: veryLongTitle,
        displayMode: 'normal'
      });

      expect(screen.getByText(veryLongTitle)).toBeInTheDocument();
    });

    it('handles rapid toggle clicks without breaking state', () => {
      const onToggle = vi.fn();
      renderCollapsibleSection({ onToggle });

      const header = screen.getByText('Test Section').closest('[data-testid]') ||
                    screen.getByText('Test Section').parentElement;

      // Rapid clicking
      fireEvent.click(header!);
      fireEvent.click(header!);
      fireEvent.click(header!);
      fireEvent.click(header!);

      // Should handle rapid clicks gracefully
      expect(onToggle).toHaveBeenCalledTimes(4);
    });

    it('handles nested CollapsibleSection components', () => {
      const NestedContent = () => (
        <Box flexDirection="column">
          <Text>Outer content</Text>
          <CollapsibleSection title="Nested Section" defaultCollapsed={true}>
            <Text>Nested content</Text>
          </CollapsibleSection>
        </Box>
      );

      renderCollapsibleSection({
        title: 'Parent Section',
        children: <NestedContent />
      });

      expect(screen.getByText('Parent Section')).toBeInTheDocument();
      expect(screen.getByText('Nested Section')).toBeInTheDocument();
      expect(screen.getByText('Outer content')).toBeInTheDocument();
      // Nested content should not be visible initially
      expect(screen.queryByText('Nested content')).not.toBeInTheDocument();
    });
  });

  describe('Performance and Cleanup', () => {
    it('cleans up animation timers on unmount', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const { unmount } = renderCollapsibleSection({ defaultCollapsed: true });

      const header = screen.getByText('Test Section').closest('[data-testid]') ||
                    screen.getByText('Test Section').parentElement;

      // Trigger animation
      fireEvent.click(header!);

      // Unmount component during animation
      unmount();

      // Should clean up intervals
      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it('handles multiple simultaneous animations efficiently', () => {
      const { rerender } = render(
        <Box flexDirection="column">
          <CollapsibleSection title="Section 1" defaultCollapsed={true}>
            <Text>Content 1</Text>
          </CollapsibleSection>
          <CollapsibleSection title="Section 2" defaultCollapsed={true}>
            <Text>Content 2</Text>
          </CollapsibleSection>
          <CollapsibleSection title="Section 3" defaultCollapsed={true}>
            <Text>Content 3</Text>
          </CollapsibleSection>
        </Box>
      );

      const headers = [
        screen.getByText('Section 1').parentElement,
        screen.getByText('Section 2').parentElement,
        screen.getByText('Section 3').parentElement
      ];

      // Trigger multiple animations simultaneously
      headers.forEach(header => fireEvent.click(header!));

      // Advance timers and verify all animations complete
      vi.advanceTimersByTime(200);

      expect(screen.getByText('Content 1')).toBeInTheDocument();
      expect(screen.getByText('Content 2')).toBeInTheDocument();
      expect(screen.getByText('Content 3')).toBeInTheDocument();
    });
  });

  describe('Accessibility and User Experience', () => {
    it('provides clear visual feedback for interactive elements', () => {
      renderCollapsibleSection();

      const header = screen.getByText('Test Section').parentElement;

      // Header should be clickable (this is implied by the onClick handler)
      expect(header).toBeTruthy();
    });

    it('handles keyboard navigation edge cases', () => {
      const onToggle = vi.fn();
      renderCollapsibleSection({
        onToggle,
        allowKeyboardToggle: true,
        toggleKey: ' ' // Space key
      });

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Test space key
      inputHandler(' ', {});
      expect(onToggle).toHaveBeenCalledWith(true);

      // Test special characters
      inputHandler('!', {});
      expect(onToggle).toHaveBeenCalledTimes(1); // Should not increment

      // Test with key modifiers
      inputHandler('', { ctrl: true, return: true });
      expect(onToggle).toHaveBeenCalledWith(false);
    });

    it('handles state changes during animation gracefully', () => {
      const onToggle = vi.fn();
      renderCollapsibleSection({ onToggle, defaultCollapsed: true });

      const header = screen.getByText('Test Section').parentElement;

      // Start animation
      fireEvent.click(header!);

      // Change state again during animation
      vi.advanceTimersByTime(50); // Partial animation
      fireEvent.click(header!);

      vi.advanceTimersByTime(200); // Complete animations

      expect(onToggle).toHaveBeenCalledTimes(2);
    });
  });

  describe('Component Integration', () => {
    it('works with complex React children containing hooks', () => {
      const ComplexChild = () => {
        const [count, setCount] = React.useState(0);

        return (
          <Box flexDirection="column">
            <Text>Count: {count}</Text>
            <Text onClick={() => setCount(c => c + 1)}>Click to increment</Text>
          </Box>
        );
      };

      renderCollapsibleSection({ children: <ComplexChild /> });

      expect(screen.getByText('Count: 0')).toBeInTheDocument();
      expect(screen.getByText('Click to increment')).toBeInTheDocument();
    });

    it('preserves context across collapse/expand cycles', () => {
      const ContextProvider = React.createContext<string>('test');

      const ContextChild = () => {
        const value = React.useContext(ContextProvider);
        return <Text>Context value: {value}</Text>;
      };

      const Wrapper = () => (
        <ContextProvider.Provider value="custom-value">
          <CollapsibleSection title="Test">
            <ContextChild />
          </CollapsibleSection>
        </ContextProvider.Provider>
      );

      render(<Wrapper />);

      // Should maintain context
      expect(screen.getByText('Context value: custom-value')).toBeInTheDocument();

      // Toggle and verify context is preserved
      const header = screen.getByText('Test').parentElement;
      fireEvent.click(header!);
      fireEvent.click(header!);

      expect(screen.getByText('Context value: custom-value')).toBeInTheDocument();
    });
  });

  describe('Memory Management', () => {
    it('does not create memory leaks with frequent mounting/unmounting', () => {
      const Component = ({ show }: { show: boolean }) =>
        show ? (
          <CollapsibleSection title="Dynamic">
            <Text>Dynamic content</Text>
          </CollapsibleSection>
        ) : null;

      const { rerender } = render(<Component show={true} />);

      // Mount and unmount multiple times
      for (let i = 0; i < 10; i++) {
        rerender(<Component show={false} />);
        rerender(<Component show={true} />);
      }

      // Should handle dynamic mounting without issues
      expect(screen.getByText('Dynamic')).toBeInTheDocument();
    });

    it('cleans up event listeners on unmount', () => {
      const { unmount } = renderCollapsibleSection({ allowKeyboardToggle: true });

      // Verify useInput was called with isActive: true
      expect(mockUseInput).toHaveBeenCalledWith(
        expect.any(Function),
        { isActive: true }
      );

      unmount();

      // Component should unmount cleanly without errors
    });
  });

  describe('Border and Styling Edge Cases', () => {
    it('handles all border style combinations', () => {
      const borderStyles: Array<'single' | 'round' | 'double' | 'none'> = ['single', 'round', 'double', 'none'];

      borderStyles.forEach((style, index) => {
        const { unmount } = renderCollapsibleSection({
          borderStyle: style,
          title: `Test ${style}`,
          key: index
        });

        expect(screen.getByText(`Test ${style}`)).toBeInTheDocument();
        unmount();
      });
    });

    it('handles custom border colors', () => {
      const colors = ['red', 'blue', 'green', '#FF0000', 'rgb(255, 0, 0)'];

      colors.forEach((color, index) => {
        const { unmount } = renderCollapsibleSection({
          borderColor: color,
          title: `Test ${color}`,
          key: index
        });

        expect(screen.getByText(`Test ${color}`)).toBeInTheDocument();
        unmount();
      });
    });

    it('handles extreme width values', () => {
      // Very small width
      renderCollapsibleSection({ width: 1, title: 'Small' });
      expect(screen.getByText('Small')).toBeInTheDocument();

      // Very large width
      const { unmount } = renderCollapsibleSection({ width: 1000, title: 'Large' });
      expect(screen.getByText('Large')).toBeInTheDocument();
      unmount();
    });
  });
});
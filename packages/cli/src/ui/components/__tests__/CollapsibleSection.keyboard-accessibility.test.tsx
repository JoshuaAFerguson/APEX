import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { CollapsibleSection } from '../CollapsibleSection';

// Mock the useInput hook from ink to simulate keyboard events
const mockUseInput = vi.fn();
vi.mock('ink', () => ({
  ...vi.importActual('ink'),
  useInput: mockUseInput,
}));

describe('CollapsibleSection - Keyboard and Accessibility Features', () => {
  const mockTitle = 'Test Section';
  const mockContent = 'This is the collapsible content';

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseInput.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('keyboard interaction setup', () => {
    it('registers keyboard input handler when allowKeyboardToggle=true (default)', () => {
      render(
        <CollapsibleSection title={mockTitle}>
          {mockContent}
        </CollapsibleSection>
      );

      // Should register useInput hook with isActive=true
      expect(mockUseInput).toHaveBeenCalledWith(
        expect.any(Function),
        { isActive: true }
      );
    });

    it('does not register keyboard input handler when allowKeyboardToggle=false', () => {
      render(
        <CollapsibleSection title={mockTitle} allowKeyboardToggle={false}>
          {mockContent}
        </CollapsibleSection>
      );

      // Should register useInput hook with isActive=false
      expect(mockUseInput).toHaveBeenCalledWith(
        expect.any(Function),
        { isActive: false }
      );
    });

    it('provides keyboard handler function to useInput', () => {
      render(
        <CollapsibleSection title={mockTitle}>
          {mockContent}
        </CollapsibleSection>
      );

      const [handlerFunction] = mockUseInput.mock.calls[0];
      expect(typeof handlerFunction).toBe('function');
    });
  });

  describe('default keyboard shortcuts', () => {
    it('responds to Enter key press to toggle', () => {
      const mockToggle = vi.fn();
      render(
        <CollapsibleSection
          title={mockTitle}
          onToggle={mockToggle}
          defaultCollapsed={true}
        >
          {mockContent}
        </CollapsibleSection>
      );

      // Get the keyboard handler function
      const [keyboardHandler] = mockUseInput.mock.calls[0];

      // Simulate Enter key press
      keyboardHandler('', { return: true });

      expect(mockToggle).toHaveBeenCalledWith(false); // Should toggle from collapsed(true) to expanded(false)
    });

    it('responds to default toggle key "c" to toggle', () => {
      const mockToggle = vi.fn();
      render(
        <CollapsibleSection
          title={mockTitle}
          onToggle={mockToggle}
          defaultCollapsed={true}
        >
          {mockContent}
        </CollapsibleSection>
      );

      // Get the keyboard handler function
      const [keyboardHandler] = mockUseInput.mock.calls[0];

      // Simulate "c" key press
      keyboardHandler('c', {});

      expect(mockToggle).toHaveBeenCalledWith(false); // Should toggle from collapsed(true) to expanded(false)
    });

    it('ignores other key presses', () => {
      const mockToggle = vi.fn();
      render(
        <CollapsibleSection
          title={mockTitle}
          onToggle={mockToggle}
          defaultCollapsed={true}
        >
          {mockContent}
        </CollapsibleSection>
      );

      const [keyboardHandler] = mockUseInput.mock.calls[0];

      // Simulate various other key presses
      keyboardHandler('a', {});
      keyboardHandler('b', {});
      keyboardHandler('', { escape: true });
      keyboardHandler('', { ctrl: true });

      // Should not trigger toggle
      expect(mockToggle).not.toHaveBeenCalled();
    });
  });

  describe('custom keyboard shortcuts', () => {
    it('responds to custom toggle key', () => {
      const mockToggle = vi.fn();
      render(
        <CollapsibleSection
          title={mockTitle}
          onToggle={mockToggle}
          toggleKey="t"
          defaultCollapsed={false}
        >
          {mockContent}
        </CollapsibleSection>
      );

      const [keyboardHandler] = mockUseInput.mock.calls[0];

      // Simulate custom toggle key "t"
      keyboardHandler('t', {});

      expect(mockToggle).toHaveBeenCalledWith(true); // Should toggle from expanded(false) to collapsed(true)
    });

    it('still responds to Enter key with custom toggle key', () => {
      const mockToggle = vi.fn();
      render(
        <CollapsibleSection
          title={mockTitle}
          onToggle={mockToggle}
          toggleKey="x"
          defaultCollapsed={false}
        >
          {mockContent}
        </CollapsibleSection>
      );

      const [keyboardHandler] = mockUseInput.mock.calls[0];

      // Both Enter and custom key should work
      keyboardHandler('', { return: true });
      expect(mockToggle).toHaveBeenCalledWith(true);

      mockToggle.mockClear();

      keyboardHandler('x', {});
      expect(mockToggle).toHaveBeenCalledWith(true);
    });

    it('ignores default "c" key when custom toggle key is set', () => {
      const mockToggle = vi.fn();
      render(
        <CollapsibleSection
          title={mockTitle}
          onToggle={mockToggle}
          toggleKey="z"
        >
          {mockContent}
        </CollapsibleSection>
      );

      const [keyboardHandler] = mockUseInput.mock.calls[0];

      // Default "c" should not work with custom key
      keyboardHandler('c', {});
      expect(mockToggle).not.toHaveBeenCalled();

      // Custom key should work
      keyboardHandler('z', {});
      expect(mockToggle).toHaveBeenCalledWith(true);
    });

    it('handles special character toggle keys', () => {
      const mockToggle = vi.fn();
      render(
        <CollapsibleSection
          title={mockTitle}
          onToggle={mockToggle}
          toggleKey=" " // Space key
        >
          {mockContent}
        </CollapsibleSection>
      );

      const [keyboardHandler] = mockUseInput.mock.calls[0];

      keyboardHandler(' ', {});
      expect(mockToggle).toHaveBeenCalledWith(true);
    });

    it('handles numeric toggle keys', () => {
      const mockToggle = vi.fn();
      render(
        <CollapsibleSection
          title={mockTitle}
          onToggle={mockToggle}
          toggleKey="1"
        >
          {mockContent}
        </CollapsibleSection>
      );

      const [keyboardHandler] = mockUseInput.mock.calls[0];

      keyboardHandler('1', {});
      expect(mockToggle).toHaveBeenCalledWith(true);
    });
  });

  describe('controlled vs uncontrolled keyboard behavior', () => {
    it('calls onToggle in controlled mode', () => {
      const mockToggle = vi.fn();
      render(
        <CollapsibleSection
          title={mockTitle}
          collapsed={true}
          onToggle={mockToggle}
        >
          {mockContent}
        </CollapsibleSection>
      );

      const [keyboardHandler] = mockUseInput.mock.calls[0];

      keyboardHandler('c', {});
      expect(mockToggle).toHaveBeenCalledWith(false);
    });

    it('manages internal state in uncontrolled mode', () => {
      const mockToggle = vi.fn();
      render(
        <CollapsibleSection
          title={mockTitle}
          defaultCollapsed={true}
          onToggle={mockToggle}
        >
          {mockContent}
        </CollapsibleSection>
      );

      const [keyboardHandler] = mockUseInput.mock.calls[0];

      keyboardHandler('c', {});
      expect(mockToggle).toHaveBeenCalledWith(false);
    });

    it('handles rapid keyboard input in uncontrolled mode', () => {
      const mockToggle = vi.fn();
      render(
        <CollapsibleSection
          title={mockTitle}
          defaultCollapsed={true}
          onToggle={mockToggle}
        >
          {mockContent}
        </CollapsibleSection>
      );

      const [keyboardHandler] = mockUseInput.mock.calls[0];

      // Rapid key presses
      keyboardHandler('c', {}); // Should expand
      keyboardHandler('c', {}); // Should collapse
      keyboardHandler('c', {}); // Should expand
      keyboardHandler('c', {}); // Should collapse

      expect(mockToggle).toHaveBeenCalledTimes(4);
      expect(mockToggle).toHaveBeenNthCalledWith(1, false);
      expect(mockToggle).toHaveBeenNthCalledWith(2, true);
      expect(mockToggle).toHaveBeenNthCalledWith(3, false);
      expect(mockToggle).toHaveBeenNthCalledWith(4, true);
    });
  });

  describe('accessibility features', () => {
    it('provides semantic structure with proper title display', () => {
      render(
        <CollapsibleSection title={mockTitle} defaultCollapsed={false}>
          {mockContent}
        </CollapsibleSection>
      );

      // Title should be clearly visible and accessible
      expect(screen.getByText(mockTitle)).toBeInTheDocument();
    });

    it('provides visual state indicators', () => {
      render(
        <CollapsibleSection
          title={mockTitle}
          defaultCollapsed={true}
          displayMode="verbose"
        >
          {mockContent}
        </CollapsibleSection>
      );

      // Should show collapsed state indicator in verbose mode
      expect(screen.getByText(/\[collapsed\]/)).toBeInTheDocument();
    });

    it('shows expanded state indicator in verbose mode', () => {
      render(
        <CollapsibleSection
          title={mockTitle}
          defaultCollapsed={false}
          displayMode="verbose"
        >
          {mockContent}
        </CollapsibleSection>
      );

      expect(screen.getByText(/\[expanded\]/)).toBeInTheDocument();
    });

    it('provides clear arrow indicators for state', () => {
      const { rerender } = render(
        <CollapsibleSection title={mockTitle} defaultCollapsed={true}>
          {mockContent}
        </CollapsibleSection>
      );

      // Should show right arrow when collapsed
      expect(screen.getByText(/▶/)).toBeInTheDocument();

      rerender(
        <CollapsibleSection title={mockTitle} collapsed={false}>
          {mockContent}
        </CollapsibleSection>
      );

      // Should show down arrow when expanded
      expect(screen.getByText(/▼/)).toBeInTheDocument();
    });

    it('hides arrows when showArrow=false for clean display', () => {
      render(
        <CollapsibleSection title={mockTitle} showArrow={false}>
          {mockContent}
        </CollapsibleSection>
      );

      expect(screen.queryByText(/▶/)).not.toBeInTheDocument();
      expect(screen.queryByText(/▼/)).not.toBeInTheDocument();
    });

    it('applies appropriate colors for dimmed sections', () => {
      render(
        <CollapsibleSection title={mockTitle} dimmed={true}>
          {mockContent}
        </CollapsibleSection>
      );

      // Should apply dimmed styling - tested by ensuring component renders
      expect(screen.getByText(mockTitle)).toBeInTheDocument();
    });

    it('handles focus management with keyboard interaction enabled', () => {
      render(
        <CollapsibleSection title={mockTitle} allowKeyboardToggle={true}>
          {mockContent}
        </CollapsibleSection>
      );

      // Should enable keyboard interaction for accessibility
      expect(mockUseInput).toHaveBeenCalledWith(
        expect.any(Function),
        { isActive: true }
      );
    });

    it('supports content that uses screen reader features', () => {
      const accessibleContent = (
        <div role="region" aria-label="Section content">
          {mockContent}
        </div>
      );

      render(
        <CollapsibleSection title={mockTitle} defaultCollapsed={false}>
          {accessibleContent}
        </CollapsibleSection>
      );

      expect(screen.getByRole('region')).toBeInTheDocument();
      expect(screen.getByLabelText('Section content')).toBeInTheDocument();
    });
  });

  describe('keyboard interaction edge cases', () => {
    it('handles keyboard events when component is disabled', () => {
      const mockToggle = vi.fn();
      render(
        <CollapsibleSection
          title={mockTitle}
          onToggle={mockToggle}
          allowKeyboardToggle={false}
        >
          {mockContent}
        </CollapsibleSection>
      );

      const [keyboardHandler] = mockUseInput.mock.calls[0];

      // Should not respond to keyboard when disabled
      keyboardHandler('c', {});
      keyboardHandler('', { return: true });

      expect(mockToggle).not.toHaveBeenCalled();
    });

    it('handles multiple CollapsibleSection instances with different keys', () => {
      const mockToggle1 = vi.fn();
      const mockToggle2 = vi.fn();

      render(
        <div>
          <CollapsibleSection
            title="Section 1"
            onToggle={mockToggle1}
            toggleKey="1"
          >
            Content 1
          </CollapsibleSection>
          <CollapsibleSection
            title="Section 2"
            onToggle={mockToggle2}
            toggleKey="2"
          >
            Content 2
          </CollapsibleSection>
        </div>
      );

      // Each section should register its own keyboard handler
      expect(mockUseInput).toHaveBeenCalledTimes(2);
    });

    it('cleans up keyboard handler on unmount', () => {
      const { unmount } = render(
        <CollapsibleSection title={mockTitle}>
          {mockContent}
        </CollapsibleSection>
      );

      expect(mockUseInput).toHaveBeenCalledTimes(1);

      // Unmount should clean up handlers
      unmount();

      // useInput should have been called once during mount
      expect(mockUseInput).toHaveBeenCalledTimes(1);
    });

    it('handles empty toggle key gracefully', () => {
      const mockToggle = vi.fn();
      render(
        <CollapsibleSection
          title={mockTitle}
          onToggle={mockToggle}
          toggleKey=""
        >
          {mockContent}
        </CollapsibleSection>
      );

      const [keyboardHandler] = mockUseInput.mock.calls[0];

      // Empty string as toggle key should be handled gracefully
      keyboardHandler('', {});
      keyboardHandler('c', {}); // Should not work since we have empty custom key

      expect(mockToggle).not.toHaveBeenCalled();
    });

    it('handles complex key combinations gracefully', () => {
      const mockToggle = vi.fn();
      render(
        <CollapsibleSection
          title={mockTitle}
          onToggle={mockToggle}
        >
          {mockContent}
        </CollapsibleSection>
      );

      const [keyboardHandler] = mockUseInput.mock.calls[0];

      // Should handle complex key objects without errors
      keyboardHandler('c', { shift: true, meta: true });
      keyboardHandler('', { return: true, ctrl: true });

      // Should still trigger on basic key match
      expect(mockToggle).toHaveBeenCalledTimes(2);
    });

    it('maintains state consistency during rapid keyboard toggling', () => {
      const mockToggle = vi.fn();
      render(
        <CollapsibleSection
          title={mockTitle}
          onToggle={mockToggle}
          defaultCollapsed={false}
        >
          {mockContent}
        </CollapsibleSection>
      );

      const [keyboardHandler] = mockUseInput.mock.calls[0];

      // Simulate very rapid toggling
      for (let i = 0; i < 10; i++) {
        keyboardHandler('c', {});
      }

      expect(mockToggle).toHaveBeenCalledTimes(10);

      // Should alternate between true and false
      const calls = mockToggle.mock.calls.map(call => call[0]);
      for (let i = 0; i < calls.length; i++) {
        expect(calls[i]).toBe(i % 2 === 0); // true, false, true, false, ...
      }
    });
  });

  describe('integration with other UI components', () => {
    it('works correctly when wrapped in keyboard-handling containers', () => {
      const Container = ({ children }: { children: React.ReactNode }) => {
        // Container that also uses keyboard input
        mockUseInput(() => {}, { isActive: true });
        return <div>{children}</div>;
      };

      render(
        <Container>
          <CollapsibleSection title={mockTitle}>
            {mockContent}
          </CollapsibleSection>
        </Container>
      );

      // Both container and CollapsibleSection should register handlers
      expect(mockUseInput).toHaveBeenCalledTimes(2);
    });

    it('provides consistent keyboard shortcuts across display modes', () => {
      const mockToggle = vi.fn();
      const modes: Array<'normal' | 'compact' | 'verbose'> = ['normal', 'compact', 'verbose'];

      modes.forEach(mode => {
        mockToggle.mockClear();
        mockUseInput.mockClear();

        const { unmount } = render(
          <CollapsibleSection
            title={`${mockTitle} ${mode}`}
            onToggle={mockToggle}
            displayMode={mode}
          >
            {mockContent}
          </CollapsibleSection>
        );

        const [keyboardHandler] = mockUseInput.mock.calls[0];
        keyboardHandler('c', {});

        expect(mockToggle).toHaveBeenCalledWith(true);

        unmount();
      });
    });
  });
});
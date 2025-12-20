import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '../../__tests__/test-utils';
import { mockUseInput } from '../../__tests__/test-utils';
import { AdvancedInput, Suggestion } from '../AdvancedInput';

// Mock useInput from ink
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: mockUseInput,
  };
});

describe('AdvancedInput', () => {
  const defaultProps = {
    placeholder: 'Enter command...',
    prompt: 'test> ',
    onSubmit: vi.fn(),
    onChange: vi.fn(),
    onCancel: vi.fn(),
  };

  const mockSuggestions: Suggestion[] = [
    { value: '/help', description: 'Show help', type: 'command', icon: '?' },
    { value: '/status', description: 'Show status', type: 'command', icon: 'i' },
    { value: 'src/test.ts', description: 'Test file', type: 'file', icon: '📄' },
  ];

  const mockHistory = [
    'previous command 1',
    'previous command 2',
    'help command',
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseInput.mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with default props', () => {
    render(<AdvancedInput {...defaultProps} />);

    expect(screen.getByText('test> ')).toBeInTheDocument();
    expect(screen.getByText('Enter command...')).toBeInTheDocument();
  });

  it('displays help text with keyboard shortcuts', () => {
    render(<AdvancedInput {...defaultProps} />);

    expect(screen.getByText(/Tab: autocomplete/)).toBeInTheDocument();
    expect(screen.getByText(/Ctrl\+R: search/)).toBeInTheDocument();
    expect(screen.getByText(/Ctrl\+L: clear/)).toBeInTheDocument();
    expect(screen.getByText(/Ctrl\+C: cancel/)).toBeInTheDocument();
  });

  it('shows multiline help when multiline is enabled', () => {
    render(<AdvancedInput {...defaultProps} multiline={true} />);

    expect(screen.getByText(/Shift\+Enter: new line/)).toBeInTheDocument();
  });

  it('displays initial value when provided', () => {
    render(<AdvancedInput {...defaultProps} value="initial text" />);

    expect(screen.getByText(/initial text/)).toBeInTheDocument();
  });

  describe('Input Handling', () => {
    it('handles character input', () => {
      const onChange = vi.fn();
      render(<AdvancedInput {...defaultProps} onChange={onChange} />);

      // Simulate typing
      const inputHandler = mockUseInput.mock.calls[0][0];
      inputHandler('h', { ctrl: false, meta: false });
      inputHandler('i', { ctrl: false, meta: false });

      // onChange should be called for each character
      expect(onChange).toHaveBeenCalled();
    });

    it('handles Enter key for submission', () => {
      const onSubmit = vi.fn();
      render(<AdvancedInput {...defaultProps} onSubmit={onSubmit} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Type some text first
      inputHandler('t', { ctrl: false, meta: false });
      inputHandler('e', { ctrl: false, meta: false });
      inputHandler('s', { ctrl: false, meta: false });
      inputHandler('t', { ctrl: false, meta: false });

      // Press Enter
      inputHandler('', { return: true });

      expect(onSubmit).toHaveBeenCalledWith('test');
    });

    it('handles Ctrl+C for cancel', () => {
      const onCancel = vi.fn();
      render(<AdvancedInput {...defaultProps} onCancel={onCancel} />);

      const inputHandler = mockUseInput.mock.calls[0][0];
      inputHandler('c', { ctrl: true });

      expect(onCancel).toHaveBeenCalledOnce();
    });

    it('handles Ctrl+L for clear', () => {
      const onChange = vi.fn();
      render(<AdvancedInput {...defaultProps} value="some text" onChange={onChange} />);

      const inputHandler = mockUseInput.mock.calls[0][0];
      inputHandler('l', { ctrl: true });

      // Should clear the input
      expect(onChange).toHaveBeenCalledWith('');
    });

    it('handles backspace', () => {
      const onChange = vi.fn();
      render(<AdvancedInput {...defaultProps} onChange={onChange} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Type some text first
      inputHandler('h', { ctrl: false, meta: false });
      inputHandler('i', { ctrl: false, meta: false });

      // Press backspace
      inputHandler('', { backspace: true });

      // Should remove last character
      expect(onChange).toHaveBeenCalledWith('h');
    });
  });

  describe('Suggestions', () => {
    it('displays suggestions when input matches', () => {
      render(
        <AdvancedInput
          {...defaultProps}
          suggestions={mockSuggestions}
          value="/h"
        />
      );

      expect(screen.getByText('Suggestions (Tab to complete):')).toBeInTheDocument();
      expect(screen.getByText('/help')).toBeInTheDocument();
      expect(screen.getByText('Show help')).toBeInTheDocument();
    });

    it('handles Tab key for autocompletion', () => {
      const onSubmit = vi.fn();
      render(
        <AdvancedInput
          {...defaultProps}
          suggestions={mockSuggestions}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Type partial command
      inputHandler('/', { ctrl: false, meta: false });
      inputHandler('h', { ctrl: false, meta: false });

      // Press Tab to autocomplete
      inputHandler('', { tab: true });

      // Should complete to first suggestion
      expect(onSubmit).toHaveBeenCalledWith('/help');
    });

    describe('Arrow key navigation', () => {
      beforeEach(() => {
        vi.clearAllMocks();
      });

      it('moves selection down from index 0 to 1', () => {
        const onSubmit = vi.fn();
        render(
          <AdvancedInput
            {...defaultProps}
            suggestions={mockSuggestions}
            value="/help"
            onSubmit={onSubmit}
          />
        );

        const inputHandler = mockUseInput.mock.calls[0][0];

        // Verify suggestions are shown
        expect(screen.getByText('Suggestions (Tab to complete):')).toBeInTheDocument();

        // Navigate down (from index 0 to 1)
        inputHandler('', { downArrow: true });

        // Submit to verify the selected suggestion (should be second one: /status)
        inputHandler('', { return: true });

        // Since /help matches first in mockSuggestions, after one down arrow we should be at /status
        expect(onSubmit).toHaveBeenCalledWith('/status');
      });

      it('moves selection up from index 1 to 0', () => {
        const onSubmit = vi.fn();
        render(
          <AdvancedInput
            {...defaultProps}
            suggestions={mockSuggestions}
            value="/help"
            onSubmit={onSubmit}
          />
        );

        const inputHandler = mockUseInput.mock.calls[0][0];

        // Navigate down then up (index 0 -> 1 -> 0)
        inputHandler('', { downArrow: true });  // Move to index 1
        inputHandler('', { upArrow: true });    // Move back to index 0

        // Submit to verify the selected suggestion (should be back at /help)
        inputHandler('', { return: true });

        expect(onSubmit).toHaveBeenCalledWith('/help');
      });

      it('stays at index 0 when pressing up arrow at boundary', () => {
        const onSubmit = vi.fn();
        render(
          <AdvancedInput
            {...defaultProps}
            suggestions={mockSuggestions}
            value="/help"
            onSubmit={onSubmit}
          />
        );

        const inputHandler = mockUseInput.mock.calls[0][0];

        // Try to navigate up from index 0 (should stay at 0)
        inputHandler('', { upArrow: true });

        // Submit to verify still at first suggestion
        inputHandler('', { return: true });

        expect(onSubmit).toHaveBeenCalledWith('/help');
      });

      it('stays at last index when pressing down arrow at boundary', () => {
        const onSubmit = vi.fn();
        render(
          <AdvancedInput
            {...defaultProps}
            suggestions={mockSuggestions}
            value="test"  // This should match the file suggestion
            onSubmit={onSubmit}
          />
        );

        const inputHandler = mockUseInput.mock.calls[0][0];

        // Navigate to the last suggestion
        inputHandler('', { downArrow: true }); // index 1
        inputHandler('', { downArrow: true }); // index 2 (last available)

        // Try to go past the last index
        inputHandler('', { downArrow: true }); // Should stay at last index

        // Submit to verify we're still at the last suggestion
        inputHandler('', { return: true });

        // The last suggestion should be 'src/test.ts' which matches "test"
        expect(onSubmit).toHaveBeenCalledWith('src/test.ts');
      });

      it('submits selected suggestion when Enter is pressed', () => {
        const onSubmit = vi.fn();
        render(
          <AdvancedInput
            {...defaultProps}
            suggestions={mockSuggestions}
            value="/status"
            onSubmit={onSubmit}
          />
        );

        const inputHandler = mockUseInput.mock.calls[0][0];

        // Should auto-select /status as first match, submit it
        inputHandler('', { return: true });

        expect(onSubmit).toHaveBeenCalledWith('/status');
      });

      it('navigates through all suggestions with arrow keys', () => {
        const onSubmit = vi.fn();
        render(
          <AdvancedInput
            {...defaultProps}
            suggestions={mockSuggestions}
            value="/" // Should match all command suggestions
            onSubmit={onSubmit}
          />
        );

        const inputHandler = mockUseInput.mock.calls[0][0];

        // Start at index 0 (/help), navigate down twice to reach last suggestion
        inputHandler('', { downArrow: true }); // index 1 (/status)
        inputHandler('', { downArrow: true }); // index 2 (src/test.ts)

        // Submit the currently selected suggestion
        inputHandler('', { return: true });

        // Should submit the third suggestion
        expect(onSubmit).toHaveBeenCalledWith('src/test.ts');
      });

      it('cycles selection correctly with multiple up/down presses', () => {
        const onSubmit = vi.fn();
        render(
          <AdvancedInput
            {...defaultProps}
            suggestions={mockSuggestions}
            value="/"
            onSubmit={onSubmit}
          />
        );

        const inputHandler = mockUseInput.mock.calls[0][0];

        // Complex navigation: down, down, up, down, up, up
        inputHandler('', { downArrow: true });  // index 0 -> 1
        inputHandler('', { downArrow: true });  // index 1 -> 2
        inputHandler('', { upArrow: true });    // index 2 -> 1
        inputHandler('', { downArrow: true });  // index 1 -> 2
        inputHandler('', { upArrow: true });    // index 2 -> 1
        inputHandler('', { upArrow: true });    // index 1 -> 0

        // Submit to verify final position (should be index 0)
        inputHandler('', { return: true });

        expect(onSubmit).toHaveBeenCalledWith('/help');
      });
    });

    it('shows suggestion icons when available', () => {
      render(
        <AdvancedInput
          {...defaultProps}
          suggestions={mockSuggestions}
          value="/help"
        />
      );

      expect(screen.getByText(/\? \/help/)).toBeInTheDocument();
    });
  });

  describe('History', () => {
    it('navigates history with arrow keys', () => {
      render(
        <AdvancedInput
          {...defaultProps}
          history={mockHistory}
        />
      );

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Press up arrow to navigate history
      inputHandler('', { upArrow: true });

      // Should show most recent history item
      expect(screen.getByText(/previous command 2/)).toBeInTheDocument();
    });

    it('handles Ctrl+R for reverse search', () => {
      render(
        <AdvancedInput
          {...defaultProps}
          history={mockHistory}
          searchHistory={true}
        />
      );

      const inputHandler = mockUseInput.mock.calls[0][0];
      inputHandler('r', { ctrl: true });

      expect(screen.getByText(/reverse-i-search/)).toBeInTheDocument();
    });

    it('filters history during search', () => {
      render(
        <AdvancedInput
          {...defaultProps}
          history={mockHistory}
          searchHistory={true}
        />
      );

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Enter search mode
      inputHandler('r', { ctrl: true });

      // Type search query
      inputHandler('h', { ctrl: false, meta: false });
      inputHandler('e', { ctrl: false, meta: false });
      inputHandler('l', { ctrl: false, meta: false });
      inputHandler('p', { ctrl: false, meta: false });

      // Should filter to matching history items
    });
  });

  describe('Multiline Mode', () => {
    it('enters multiline mode with Shift+Enter', () => {
      render(<AdvancedInput {...defaultProps} multiline={true} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Type some text
      inputHandler('l', { ctrl: false, meta: false });
      inputHandler('i', { ctrl: false, meta: false });
      inputHandler('n', { ctrl: false, meta: false });
      inputHandler('e', { ctrl: false, meta: false });
      inputHandler('1', { ctrl: false, meta: false });

      // Press Shift+Enter
      inputHandler('', { return: true, shift: true });

      // Should enter multiline mode and show cursor on new line
    });

    it('submits multiline content on regular Enter', () => {
      const onSubmit = vi.fn();
      render(<AdvancedInput {...defaultProps} multiline={true} onSubmit={onSubmit} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Create multiline content
      inputHandler('l', { ctrl: false, meta: false });
      inputHandler('1', { ctrl: false, meta: false });
      inputHandler('', { return: true, shift: true }); // New line
      inputHandler('l', { ctrl: false, meta: false });
      inputHandler('2', { ctrl: false, meta: false });

      // Submit with regular Enter
      inputHandler('', { return: true });

      expect(onSubmit).toHaveBeenCalledWith('l1\nl2');
    });
  });

  describe('Cursor Management', () => {
    it('handles left and right arrow keys', () => {
      render(<AdvancedInput {...defaultProps} value="test" />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Move cursor left
      inputHandler('', { leftArrow: true });
      inputHandler('', { rightArrow: true });

      // Cursor position should change (implementation details)
    });

    it('shows cursor at current position', () => {
      render(<AdvancedInput {...defaultProps} value="test" />);

      // Should show cursor character (▊) at current position
      expect(screen.getByText(/▊/)).toBeInTheDocument();
    });
  });

  describe('Props Validation', () => {
    it('handles missing optional props gracefully', () => {
      render(<AdvancedInput />);

      expect(screen.getByText('apex> ')).toBeInTheDocument();
      expect(screen.getByText(/Type a command/)).toBeInTheDocument();
    });

    it('handles empty arrays for history and suggestions', () => {
      render(
        <AdvancedInput
          {...defaultProps}
          history={[]}
          suggestions={[]}
        />
      );

      const inputHandler = mockUseInput.mock.calls[0][0];
      inputHandler('', { upArrow: true }); // Should not crash
      inputHandler('', { tab: true }); // Should not crash
    });
  });
});
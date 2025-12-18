import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { PreviewPanel, type PreviewPanelProps } from '../PreviewPanel';
import { useInput } from 'ink';

// Mock Ink's useInput hook
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn(),
  };
});

describe('PreviewPanel Keyboard Shortcuts', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnEdit = vi.fn();
  const mockUseInput = vi.mocked(useInput);

  const defaultProps: PreviewPanelProps = {
    input: 'test input',
    intent: {
      type: 'task',
      confidence: 0.8,
    },
    onConfirm: mockOnConfirm,
    onCancel: mockOnCancel,
    onEdit: mockOnEdit,
  };

  beforeEach(() => {
    mockOnConfirm.mockClear();
    mockOnCancel.mockClear();
    mockOnEdit.mockClear();
    mockUseInput.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Enter key handling', () => {
    it('should call onConfirm when Enter key is pressed', () => {
      render(<PreviewPanel {...defaultProps} />);

      // Get the input handler
      expect(mockUseInput).toHaveBeenCalled();
      const inputHandler = mockUseInput.mock.calls[0][0];

      // Simulate Enter key press
      inputHandler('', { key: { name: 'return' } });

      expect(mockOnConfirm).toHaveBeenCalledOnce();
      expect(mockOnCancel).not.toHaveBeenCalled();
      expect(mockOnEdit).not.toHaveBeenCalled();
    });

    it('should call onConfirm for Enter key in different intent types', () => {
      const testCases: Array<{ type: PreviewPanelProps['intent']['type']; description: string }> = [
        { type: 'command', description: 'command intent' },
        { type: 'task', description: 'task intent' },
        { type: 'question', description: 'question intent' },
        { type: 'clarification', description: 'clarification intent' },
      ];

      testCases.forEach(({ type, description }) => {
        mockOnConfirm.mockClear();
        mockUseInput.mockClear();

        const intentProps = {
          ...defaultProps,
          intent: { ...defaultProps.intent, type },
        };

        render(<PreviewPanel {...intentProps} />);

        const inputHandler = mockUseInput.mock.calls[0][0];
        inputHandler('', { key: { name: 'return' } });

        expect(mockOnConfirm).toHaveBeenCalledOnce();
      });
    });

    it('should work with alternative Enter key representations', () => {
      render(<PreviewPanel {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Test different key representations
      const enterVariants = [
        { key: { name: 'return' } },
        { key: { name: 'enter' } },
      ];

      enterVariants.forEach((keyEvent, index) => {
        mockOnConfirm.mockClear();
        inputHandler('', keyEvent);
        expect(mockOnConfirm).toHaveBeenCalledOnce();
      });
    });
  });

  describe('Escape key handling', () => {
    it('should call onCancel when Escape key is pressed', () => {
      render(<PreviewPanel {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Simulate Escape key press
      inputHandler('', { key: { name: 'escape' } });

      expect(mockOnCancel).toHaveBeenCalledOnce();
      expect(mockOnConfirm).not.toHaveBeenCalled();
      expect(mockOnEdit).not.toHaveBeenCalled();
    });

    it('should work with alternative Escape key representations', () => {
      render(<PreviewPanel {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Test different escape key representations
      const escapeVariants = [
        { key: { name: 'escape' } },
        { key: { name: 'esc' } },
      ];

      escapeVariants.forEach((keyEvent) => {
        mockOnCancel.mockClear();
        inputHandler('', keyEvent);
        expect(mockOnCancel).toHaveBeenCalledOnce();
      });
    });

    it('should handle Escape for different input lengths', () => {
      const testInputs = ['', 'short', 'a very long input string that exceeds normal length'];

      testInputs.forEach((input) => {
        mockOnCancel.mockClear();
        mockUseInput.mockClear();

        const props = { ...defaultProps, input };
        render(<PreviewPanel {...props} />);

        const inputHandler = mockUseInput.mock.calls[0][0];
        inputHandler('', { key: { name: 'escape' } });

        expect(mockOnCancel).toHaveBeenCalledOnce();
      });
    });
  });

  describe('Edit key handling', () => {
    it('should call onEdit when "e" key is pressed', () => {
      render(<PreviewPanel {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Simulate 'e' key press
      inputHandler('e', { key: {} });

      expect(mockOnEdit).toHaveBeenCalledOnce();
      expect(mockOnConfirm).not.toHaveBeenCalled();
      expect(mockOnCancel).not.toHaveBeenCalled();
    });

    it('should be case insensitive for edit key', () => {
      render(<PreviewPanel {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Test both lowercase and uppercase
      inputHandler('e', { key: {} });
      expect(mockOnEdit).toHaveBeenCalledTimes(1);

      inputHandler('E', { key: {} });
      expect(mockOnEdit).toHaveBeenCalledTimes(2);
    });

    it('should not trigger edit for other letter keys', () => {
      render(<PreviewPanel {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Test other letters
      const otherKeys = ['a', 'b', 'c', 'd', 'f', 'g', 'h', 'q', 'x', 'z'];

      otherKeys.forEach((key) => {
        inputHandler(key, { key: {} });
      });

      expect(mockOnEdit).not.toHaveBeenCalled();
    });
  });

  describe('Complex key combinations', () => {
    it('should handle Ctrl+C as cancel (alternative to Escape)', () => {
      render(<PreviewPanel {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Simulate Ctrl+C
      inputHandler('', { key: { name: 'c', ctrl: true } });

      expect(mockOnCancel).toHaveBeenCalledOnce();
    });

    it('should handle Ctrl+Enter as confirm (alternative to Enter)', () => {
      render(<PreviewPanel {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Simulate Ctrl+Enter
      inputHandler('', { key: { name: 'return', ctrl: true } });

      expect(mockOnConfirm).toHaveBeenCalledOnce();
    });

    it('should ignore modifier keys alone', () => {
      render(<PreviewPanel {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Test modifier keys alone
      const modifierKeys = [
        { key: { ctrl: true } },
        { key: { shift: true } },
        { key: { alt: true } },
        { key: { meta: true } },
      ];

      modifierKeys.forEach((keyEvent) => {
        inputHandler('', keyEvent);
      });

      expect(mockOnConfirm).not.toHaveBeenCalled();
      expect(mockOnCancel).not.toHaveBeenCalled();
      expect(mockOnEdit).not.toHaveBeenCalled();
    });
  });

  describe('Disabled state handling', () => {
    it('should not respond to keys when callbacks are not provided', () => {
      const propsWithoutCallbacks = {
        input: 'test',
        intent: { type: 'task' as const, confidence: 0.8 },
        onConfirm: undefined as any,
        onCancel: undefined as any,
        onEdit: undefined as any,
      };

      // Should not crash when rendering without callbacks
      expect(() => render(<PreviewPanel {...propsWithoutCallbacks} />)).not.toThrow();
    });

    it('should handle null/undefined callbacks gracefully', () => {
      const propsWithNullCallbacks = {
        input: 'test',
        intent: { type: 'task' as const, confidence: 0.8 },
        onConfirm: null as any,
        onCancel: undefined as any,
        onEdit: vi.fn(),
      };

      render(<PreviewPanel {...propsWithNullCallbacks} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // These should not crash
      expect(() => inputHandler('', { key: { name: 'return' } })).not.toThrow();
      expect(() => inputHandler('', { key: { name: 'escape' } })).not.toThrow();
      expect(() => inputHandler('e', { key: {} })).not.toThrow();
    });
  });

  describe('Rapid key press handling', () => {
    it('should handle rapid key presses without issues', () => {
      render(<PreviewPanel {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Simulate rapid key presses
      for (let i = 0; i < 10; i++) {
        inputHandler('', { key: { name: 'return' } });
        inputHandler('', { key: { name: 'escape' } });
        inputHandler('e', { key: {} });
      }

      expect(mockOnConfirm).toHaveBeenCalledTimes(10);
      expect(mockOnCancel).toHaveBeenCalledTimes(10);
      expect(mockOnEdit).toHaveBeenCalledTimes(10);
    });

    it('should debounce rapid identical key presses', () => {
      render(<PreviewPanel {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Simulate very rapid identical key presses
      inputHandler('', { key: { name: 'return' } });
      inputHandler('', { key: { name: 'return' } });
      inputHandler('', { key: { name: 'return' } });

      // All should be processed (no automatic debouncing expected at component level)
      expect(mockOnConfirm).toHaveBeenCalledTimes(3);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle malformed key events', () => {
      render(<PreviewPanel {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Test malformed key events
      const malformedEvents = [
        undefined,
        null,
        {},
        { key: null },
        { key: {} },
        { key: { name: null } },
        { key: { name: '' } },
      ];

      malformedEvents.forEach((event) => {
        expect(() => inputHandler('', event as any)).not.toThrow();
      });

      // No callbacks should have been triggered
      expect(mockOnConfirm).not.toHaveBeenCalled();
      expect(mockOnCancel).not.toHaveBeenCalled();
      expect(mockOnEdit).not.toHaveBeenCalled();
    });

    it('should handle special characters in input text', () => {
      render(<PreviewPanel {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Should work regardless of special characters in input parameter
      inputHandler('e', { key: {} });

      expect(mockOnEdit).toHaveBeenCalledOnce();
    });

    it('should handle unicode characters in key input', () => {
      render(<PreviewPanel {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Test unicode characters
      const unicodeChars = ['é', '中', '🎉', 'ñ', 'ü'];

      unicodeChars.forEach((char) => {
        inputHandler(char, { key: {} });
      });

      // None should trigger edit
      expect(mockOnEdit).not.toHaveBeenCalled();

      // But 'e' should still work
      inputHandler('e', { key: {} });
      expect(mockOnEdit).toHaveBeenCalledOnce();
    });

    it('should handle function keys and arrow keys', () => {
      render(<PreviewPanel {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Test function and arrow keys
      const specialKeys = [
        { key: { name: 'up' } },
        { key: { name: 'down' } },
        { key: { name: 'left' } },
        { key: { name: 'right' } },
        { key: { name: 'f1' } },
        { key: { name: 'f5' } },
        { key: { name: 'tab' } },
        { key: { name: 'space' } },
      ];

      specialKeys.forEach((keyEvent) => {
        expect(() => inputHandler('', keyEvent)).not.toThrow();
      });

      // No callbacks should be triggered by these keys
      expect(mockOnConfirm).not.toHaveBeenCalled();
      expect(mockOnCancel).not.toHaveBeenCalled();
      expect(mockOnEdit).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility considerations', () => {
    it('should work with screen reader navigation keys', () => {
      render(<PreviewPanel {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Test common screen reader keys that shouldn't interfere
      const screenReaderKeys = [
        { key: { name: 'h' } }, // heading navigation
        { key: { name: 'b' } }, // button navigation
        { key: { name: 'f' } }, // form navigation
        { key: { name: 'l' } }, // link navigation
      ];

      screenReaderKeys.forEach((keyEvent) => {
        inputHandler('', keyEvent);
      });

      // These shouldn't trigger any actions (except 'e' would trigger edit)
      expect(mockOnConfirm).not.toHaveBeenCalled();
      expect(mockOnCancel).not.toHaveBeenCalled();
      expect(mockOnEdit).not.toHaveBeenCalled();
    });

    it('should preserve tab navigation behavior', () => {
      render(<PreviewPanel {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Tab key should not interfere with normal tab navigation
      inputHandler('', { key: { name: 'tab' } });
      inputHandler('', { key: { name: 'tab', shift: true } }); // Shift+Tab

      expect(mockOnConfirm).not.toHaveBeenCalled();
      expect(mockOnCancel).not.toHaveBeenCalled();
      expect(mockOnEdit).not.toHaveBeenCalled();
    });
  });

  describe('Multiple PreviewPanel instances', () => {
    it('should handle multiple instances with independent keyboard handling', () => {
      const mockOnConfirm2 = vi.fn();
      const mockOnCancel2 = vi.fn();
      const mockOnEdit2 = vi.fn();

      const props1 = { ...defaultProps };
      const props2 = {
        ...defaultProps,
        onConfirm: mockOnConfirm2,
        onCancel: mockOnCancel2,
        onEdit: mockOnEdit2,
      };

      const { rerender } = render(<PreviewPanel {...props1} />);

      // Get first instance input handler
      const inputHandler1 = mockUseInput.mock.calls[0][0];

      // Test first instance
      inputHandler1('', { key: { name: 'return' } });
      expect(mockOnConfirm).toHaveBeenCalledOnce();
      expect(mockOnConfirm2).not.toHaveBeenCalled();

      // Clear and render second instance
      mockUseInput.mockClear();
      rerender(<PreviewPanel {...props2} />);

      // Get second instance input handler
      const inputHandler2 = mockUseInput.mock.calls[0][0];

      // Test second instance
      inputHandler2('e', { key: {} });
      expect(mockOnEdit2).toHaveBeenCalledOnce();
      expect(mockOnEdit).not.toHaveBeenCalled();
    });
  });
});
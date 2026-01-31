import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { PermissionPrompt, PermissionRequest, PermissionLevel } from '../PermissionPrompt';

// Mock Ink components
vi.mock('ink', () => ({
  Box: ({ children, ...props }: any) => <div data-testid="box" {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span data-testid="text" {...props}>{children}</span>,
  useInput: vi.fn(),
}));

describe('PermissionPrompt - Keyboard Navigation Edge Cases', () => {
  let mockOnDecision: ReturnType<typeof vi.fn>;
  let baseRequest: PermissionRequest;
  let inputHandler: (input: string, key: any) => void;

  beforeEach(() => {
    mockOnDecision = vi.fn();
    baseRequest = {
      id: 'test-request-123',
      tool: 'Write',
      scope: '/tmp/test-file.txt',
      operation: 'file-write',
      isDangerous: false,
      timestamp: new Date('2024-01-01T10:00:00Z'),
    };

    const { useInput } = require('ink');
    useInput.mockImplementation((handler: (input: string, key: any) => void) => {
      inputHandler = handler;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Arrow Key Navigation', () => {
    it('should handle rapid arrow key presses', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Rapid left arrow presses
      act(() => {
        for (let i = 0; i < 10; i++) {
          inputHandler('', { leftArrow: true });
        }
      });

      // Should not crash and selection should stay within bounds
      expect(() => {
        inputHandler('', { return: true });
      }).not.toThrow();

      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', expect.any(String));
    });

    it('should handle rapid right arrow presses', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Rapid right arrow presses
      act(() => {
        for (let i = 0; i < 10; i++) {
          inputHandler('', { rightArrow: true });
        }
      });

      // Should not crash and selection should stay within bounds
      expect(() => {
        inputHandler('', { return: true });
      }).not.toThrow();

      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', expect.any(String));
    });

    it('should handle up/down arrows correctly', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Up arrows should behave like left arrows
      act(() => {
        inputHandler('', { upArrow: true });
        inputHandler('', { upArrow: true });
      });

      // Down arrows should behave like right arrows
      act(() => {
        inputHandler('', { downArrow: true });
        inputHandler('', { downArrow: true });
      });

      expect(() => {
        inputHandler('', { return: true });
      }).not.toThrow();
    });

    it('should handle mixed arrow key combinations', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Mixed arrow key sequence
      act(() => {
        inputHandler('', { leftArrow: true });
        inputHandler('', { downArrow: true });
        inputHandler('', { upArrow: true });
        inputHandler('', { rightArrow: true });
      });

      expect(() => {
        inputHandler('', { return: true });
      }).not.toThrow();
    });

    it('should maintain selection bounds with extreme navigation', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Navigate to first option and try to go further
      act(() => {
        for (let i = 0; i < 20; i++) {
          inputHandler('', { leftArrow: true });
        }
      });

      // Should select first option (Allow Always)
      act(() => {
        inputHandler('', { return: true });
      });

      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'allow-always');
      mockOnDecision.mockClear();

      // Navigate to last option and try to go further
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      act(() => {
        for (let i = 0; i < 20; i++) {
          inputHandler('', { rightArrow: true });
        }
      });

      // Should select last option (Deny)
      act(() => {
        inputHandler('', { return: true });
      });

      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'deny');
    });
  });

  describe('Direct Key Selection Edge Cases', () => {
    it('should handle case insensitive input', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Test lowercase
      act(() => {
        inputHandler('a', { name: 'a' });
      });
      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'allow-always');
      mockOnDecision.mockClear();

      // Test uppercase
      act(() => {
        inputHandler('O', { name: 'O' });
      });
      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'allow-once');
      mockOnDecision.mockClear();

      // Test mixed case
      act(() => {
        inputHandler('D', { name: 'd' });
      });
      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'deny');
    });

    it('should handle rapid successive key presses', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Rapid key presses should only register the first one
      act(() => {
        inputHandler('a', { name: 'a' });
        inputHandler('o', { name: 'o' });
        inputHandler('d', { name: 'd' });
      });

      // Only first decision should be called
      expect(mockOnDecision).toHaveBeenCalledTimes(1);
      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'allow-always');
    });

    it('should handle invalid key combinations', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Test invalid keys
      const invalidKeys = ['x', 'y', 'z', '1', '2', '3', '@', '#', '$'];

      act(() => {
        invalidKeys.forEach(key => {
          inputHandler(key, { name: key });
        });
      });

      // Should not make any decisions
      expect(mockOnDecision).not.toHaveBeenCalled();
    });

    it('should handle special characters and unicode', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Test special characters
      act(() => {
        inputHandler('á', { name: 'á' }); // Accented a
        inputHandler('ο', { name: 'ο' }); // Greek omicron
        inputHandler('δ', { name: 'δ' }); // Greek delta
        inputHandler('🅰️', { name: '🅰️' }); // Emoji
      });

      // Should not make any decisions with special characters
      expect(mockOnDecision).not.toHaveBeenCalled();
    });
  });

  describe('Enter Key Behavior', () => {
    it('should confirm current selection with Enter', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Navigate to different options and confirm
      act(() => {
        inputHandler('', { leftArrow: true }); // Move to Allow Always
        inputHandler('', { return: true });
      });

      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'allow-always');
      mockOnDecision.mockClear();

      // Test with Allow Once (default selection)
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      act(() => {
        inputHandler('', { return: true }); // Confirm default
      });

      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'allow-once');
    });

    it('should handle multiple Enter presses gracefully', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      act(() => {
        inputHandler('', { return: true });
        inputHandler('', { return: true });
        inputHandler('', { return: true });
      });

      // Should only register first Enter press
      expect(mockOnDecision).toHaveBeenCalledTimes(1);
    });

    it('should handle Enter with modifier keys', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      act(() => {
        // Simulate Enter with modifiers (should still work)
        inputHandler('', { return: true, ctrl: true });
      });

      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', expect.any(String));
    });
  });

  describe('Escape Key Behavior', () => {
    it('should always deny on Escape', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Test from different positions
      act(() => {
        inputHandler('', { rightArrow: true }); // Navigate to deny
        inputHandler('', { escape: true });
      });

      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'deny');
      mockOnDecision.mockClear();

      // Test from default position
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      act(() => {
        inputHandler('', { escape: true });
      });

      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'deny');
    });

    it('should handle multiple Escape presses', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      act(() => {
        inputHandler('', { escape: true });
        inputHandler('', { escape: true });
        inputHandler('', { escape: true });
      });

      // Should only register first Escape
      expect(mockOnDecision).toHaveBeenCalledTimes(1);
      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'deny');
    });

    it('should handle Escape with modifier keys', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      act(() => {
        inputHandler('', { escape: true, shift: true });
      });

      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'deny');
    });
  });

  describe('Focus State Management', () => {
    it('should handle activation/deactivation correctly', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
          autoFocus={false}
        />
      );

      // When not active, should ignore input
      act(() => {
        inputHandler('a', { name: 'a' });
      });

      expect(mockOnDecision).not.toHaveBeenCalled();
    });

    it('should deactivate after decision', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Make decision
      act(() => {
        inputHandler('a', { name: 'a' });
      });

      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'allow-always');

      // Further input should be ignored (component deactivated)
      act(() => {
        inputHandler('o', { name: 'o' });
      });

      // Should still only have one call
      expect(mockOnDecision).toHaveBeenCalledTimes(1);
    });

    it('should handle auto-focus timing', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
          autoFocus={true}
        />
      );

      // Should set up input handling for auto-focus
      const { useInput } = require('ink');
      expect(useInput).toHaveBeenCalled();
    });
  });

  describe('Complex Key Combinations', () => {
    it('should handle modifier keys correctly', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Test with various modifiers
      act(() => {
        inputHandler('a', { name: 'a', ctrl: true });
        inputHandler('o', { name: 'o', alt: true });
        inputHandler('d', { name: 'd', shift: true });
      });

      // Should still work with modifiers
      expect(mockOnDecision).toHaveBeenCalledTimes(1);
      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'allow-always');
    });

    it('should handle function keys gracefully', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Test function keys - should be ignored
      act(() => {
        inputHandler('', { name: 'f1' });
        inputHandler('', { name: 'f2' });
        inputHandler('', { name: 'f12' });
      });

      expect(mockOnDecision).not.toHaveBeenCalled();
    });

    it('should handle control sequences', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Test common control sequences
      act(() => {
        inputHandler('', { name: 'c', ctrl: true }); // Ctrl+C
        inputHandler('', { name: 'z', ctrl: true }); // Ctrl+Z
        inputHandler('', { name: 'd', ctrl: true }); // Ctrl+D
      });

      // Control sequences should be ignored
      expect(mockOnDecision).not.toHaveBeenCalled();
    });

    it('should handle meta/cmd keys', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Test meta/cmd combinations
      act(() => {
        inputHandler('a', { name: 'a', meta: true });
        inputHandler('o', { name: 'o', cmd: true });
      });

      // Should work even with meta keys
      expect(mockOnDecision).toHaveBeenCalledTimes(1);
    });
  });

  describe('International Keyboard Support', () => {
    it('should handle QWERTY variations', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Standard QWERTY
      act(() => {
        inputHandler('a', { name: 'a' });
      });

      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'allow-always');
    });

    it('should handle AZERTY layout considerations', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // On AZERTY, 'a' and 'q' are swapped, but we care about the character, not position
      act(() => {
        inputHandler('a', { name: 'a' }); // Still 'a' character
      });

      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'allow-always');
    });

    it('should handle Dvorak layout considerations', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // On Dvorak, keys are in different positions, but character mapping should work
      act(() => {
        inputHandler('o', { name: 'o' }); // 'o' character regardless of layout
      });

      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'allow-once');
    });
  });

  describe('Accessibility-focused Navigation', () => {
    it('should provide consistent navigation patterns', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // All navigation methods should work consistently
      act(() => {
        // Arrow navigation
        inputHandler('', { leftArrow: true });
        inputHandler('', { rightArrow: true });

        // Direct selection
        inputHandler('a', { name: 'a' });
      });

      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'allow-always');
    });

    it('should support screen reader navigation patterns', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Screen readers often use specific key patterns
      act(() => {
        // Tab-like navigation (arrows)
        inputHandler('', { rightArrow: true });
        inputHandler('', { rightArrow: true });

        // Activation
        inputHandler('', { return: true });
      });

      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'deny');
    });

    it('should handle voice control input patterns', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Voice control often sends direct character input
      act(() => {
        inputHandler('o', { name: 'o' }); // "Say 'O'" command
      });

      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'allow-once');
    });
  });

  describe('Error Recovery', () => {
    it('should recover from input handler errors', () => {
      const originalConsoleError = console.error;
      console.error = vi.fn();

      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Simulate error in input handling
      expect(() => {
        act(() => {
          // Input with malformed key object
          inputHandler('', { malformed: true, invalid: 'key' } as any);
        });
      }).not.toThrow();

      // Should still be able to handle normal input
      act(() => {
        inputHandler('a', { name: 'a' });
      });

      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'allow-always');

      console.error = originalConsoleError;
    });

    it('should handle undefined key objects', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      expect(() => {
        act(() => {
          inputHandler('a', undefined as any);
          inputHandler('', null as any);
          inputHandler('o', {} as any);
        });
      }).not.toThrow();

      // Valid input should still work after errors
      act(() => {
        inputHandler('d', { name: 'd' });
      });

      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'deny');
    });
  });

  describe('Performance Under Stress', () => {
    it('should handle rapid input without performance degradation', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      const startTime = Date.now();

      // Simulate very rapid input
      act(() => {
        for (let i = 0; i < 1000; i++) {
          inputHandler('', { leftArrow: true });
          inputHandler('', { rightArrow: true });
        }
        inputHandler('a', { name: 'a' });
      });

      const endTime = Date.now();

      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(100);
      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'allow-always');
    });

    it('should handle input burst without memory leaks', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Large burst of navigation followed by selection
      act(() => {
        for (let i = 0; i < 10000; i++) {
          inputHandler('', { leftArrow: true });
          if (i % 100 === 0) {
            inputHandler('', { rightArrow: true });
          }
        }
        inputHandler('o', { name: 'o' });
      });

      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'allow-once');
    });
  });
});
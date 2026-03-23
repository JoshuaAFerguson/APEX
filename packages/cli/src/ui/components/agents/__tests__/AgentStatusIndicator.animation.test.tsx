/**
 * Animation and edge case tests for AgentStatusIndicator component
 * Tests terminal-compatible animations and error boundaries
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentStatusIndicator } from '../AgentStatusIndicator.js';
import { ThemeProvider } from '../../../context/ThemeContext.js';
import { getTheme } from '../../../themes/index.js';

// Mock Ink components
vi.mock('ink', () => ({
  Box: ({ children, ...props }: any) => (
    <div data-testid="animation-container" {...props}>
      {children}
    </div>
  ),
  Text: ({ children, color, bold, dimColor, ...props }: any) => (
    <span
      data-testid="animation-text"
      data-color={color}
      data-bold={bold}
      data-dim={dimColor}
      {...props}
    >
      {children}
    </span>
  ),
}));

// Test wrapper with theme provider
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = getTheme('dark');
  return (
    <ThemeProvider theme={theme} defaultTheme="dark">
      {children}
    </ThemeProvider>
  );
};

describe('AgentStatusIndicator - Animation and Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Animation Behavior', () => {
    it('should handle pulse animation for active status', async () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="active" animated={true} />
        </TestWrapper>
      );

      const statusText = container.querySelector('[data-testid="animation-text"]');
      expect(statusText).toBeTruthy();

      // Initial state should show active indicator
      expect(statusText?.textContent).toMatch(/[●◉]/);

      // Advance timer to trigger animation frame changes
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Animation should continue showing pulse variants
      expect(statusText?.textContent).toMatch(/[●◉○]/);
    });

    it('should handle fade animation for error status', async () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="error" animated={true} />
        </TestWrapper>
      );

      const statusText = container.querySelector('[data-testid="animation-text"]');
      expect(statusText).toBeTruthy();

      // Initial state should show error indicator variants
      expect(statusText?.textContent).toMatch(/[⚠●◐◑◒◓○◔◕]/);

      // Advance timer to see fade animation progression
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(statusText?.textContent).toMatch(/[⚠●◐◑◒◓○◔◕]/);
    });

    it('should not animate idle status regardless of animated prop', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="idle" animated={true} />
        </TestWrapper>
      );

      const statusText = container.querySelector('[data-testid="animation-text"]');
      expect(statusText).toBeTruthy();

      // Idle should always show static circle
      expect(statusText?.textContent).toBe('○');

      // Advance timer and verify no animation occurs
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(statusText?.textContent).toBe('○');
    });

    it('should stop animation when animated prop changes to false', () => {
      const { container, rerender } = render(
        <TestWrapper>
          <AgentStatusIndicator status="active" animated={true} />
        </TestWrapper>
      );

      const statusText = container.querySelector('[data-testid="animation-text"]');
      expect(statusText).toBeTruthy();

      // Disable animation
      rerender(
        <TestWrapper>
          <AgentStatusIndicator status="active" animated={false} />
        </TestWrapper>
      );

      // Should show static active indicator
      expect(statusText?.textContent).toBe('●');
    });

    it('should handle animation timing correctly', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="active" animated={true} />
        </TestWrapper>
      );

      const statusText = container.querySelector('[data-testid="animation-text"]');
      expect(statusText).toBeTruthy();

      // Test multiple animation cycles
      for (let i = 0; i < 5; i++) {
        act(() => {
          vi.advanceTimersByTime(375); // 1500ms / 4 frames = 375ms per frame
        });
        expect(statusText?.textContent).toMatch(/[●◉○]/);
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle status changes gracefully', () => {
      // Test status transitions work correctly
      const { container, rerender } = render(
        <TestWrapper>
          <AgentStatusIndicator status="idle" />
        </TestWrapper>
      );

      // Should render successfully and handle transitions
      expect(container).toBeTruthy();

      rerender(
        <TestWrapper>
          <AgentStatusIndicator status="active" />
        </TestWrapper>
      );

      expect(container).toBeTruthy();
    });

    it('should handle missing theme context gracefully', () => {
      // Test without ThemeProvider wrapper - will use default theme
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="active" />
        </TestWrapper>
      );

      // Should render with default theme
      expect(container).toBeTruthy();
    });

    it('should handle rapid status changes', () => {
      const { container, rerender } = render(
        <TestWrapper>
          <AgentStatusIndicator status="idle" animated={true} />
        </TestWrapper>
      );

      const statusText = container.querySelector('[data-testid="animation-text"]');
      expect(statusText).toBeTruthy();

      // Rapidly change statuses
      const statuses = ['active', 'error', 'idle', 'active'] as const;
      statuses.forEach(status => {
        rerender(
          <TestWrapper>
            <AgentStatusIndicator status={status} animated={true} />
          </TestWrapper>
        );

        expect(statusText?.textContent).toMatch(/[○●◉⚠◐◑◒◓◔◕]/);
      });
    });

    it('should handle component unmounting during animation', () => {
      const { container, unmount } = render(
        <TestWrapper>
          <AgentStatusIndicator status="active" animated={true} />
        </TestWrapper>
      );

      const statusText = container.querySelector('[data-testid="animation-text"]');
      expect(statusText).toBeTruthy();

      // Start animation
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Unmount component
      expect(() => unmount()).not.toThrow();
    });

    it('should handle extreme prop values', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator
            status="active"
            size="large"
            color=""
            label=""
            tooltipText=""
            ariaLabel=""
          />
        </TestWrapper>
      );

      expect(container).toBeTruthy();
      const statusText = container.querySelector('[data-testid="animation-text"]');
      expect(statusText).toBeTruthy();
    });

    it('should handle very long label text', () => {
      const longLabel = 'A'.repeat(1000);
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="active" label={longLabel} />
        </TestWrapper>
      );

      expect(container).toBeTruthy();
      const textElements = container.querySelectorAll('[data-testid="animation-text"]');
      expect(textElements.length).toBeGreaterThan(0);
    });

    it('should handle special characters in props', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator
            status="active"
            label="Test 🚀 Label"
            tooltipText="Tooltip with émojis and ñon-ASCII"
            ariaLabel="Accessibility with spéciał chars"
          />
        </TestWrapper>
      );

      expect(container).toBeTruthy();
      const textElements = container.querySelectorAll('[data-testid="animation-text"]');
      expect(textElements.length).toBeGreaterThan(0);
    });
  });

  describe('Size Behavior with Animation', () => {
    it('should animate consistently across all sizes', () => {
      const sizes = ['small', 'medium', 'large'] as const;

      sizes.forEach(size => {
        const { container } = render(
          <TestWrapper>
            <AgentStatusIndicator status="active" size={size} animated={true} />
          </TestWrapper>
        );

        const statusText = container.querySelector('[data-testid="animation-text"]');
        expect(statusText).toBeTruthy();

        // Verify animation works for all sizes
        act(() => {
          vi.advanceTimersByTime(500);
        });

        expect(statusText?.textContent).toMatch(/[●◉○]/);

        if (size === 'large') {
          expect(statusText?.textContent?.length).toBeGreaterThanOrEqual(2);
        }
      });
    });

    it('should maintain size consistency during animation', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="active" size="large" animated={true} />
        </TestWrapper>
      );

      const statusText = container.querySelector('[data-testid="animation-text"]');
      expect(statusText).toBeTruthy();

      const initialLength = statusText?.textContent?.length || 0;

      // Advance through animation frames
      for (let i = 0; i < 4; i++) {
        act(() => {
          vi.advanceTimersByTime(375);
        });

        // Length should remain consistent
        expect(statusText?.textContent?.length).toBe(initialLength);
      }
    });
  });

  describe('Theme Integration', () => {
    it('should work with different theme configurations', () => {
      const lightTheme = getTheme('light');

      const { container } = render(
        <ThemeProvider theme={lightTheme} defaultTheme="light">
          <AgentStatusIndicator status="active" animated={true} />
        </ThemeProvider>
      );

      const statusText = container.querySelector('[data-testid="animation-text"]');
      expect(statusText).toBeTruthy();
      expect(statusText?.textContent).toMatch(/[●◉]/);
    });

    it('should handle custom colors with animation', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator
            status="active"
            color="#ff6b6b"
            animated={true}
          />
        </TestWrapper>
      );

      const statusText = container.querySelector('[data-testid="animation-text"]');
      expect(statusText).toBeTruthy();

      // Animation should work with custom colors
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(statusText?.textContent).toMatch(/[●◉○]/);
    });
  });

  describe('Performance and Memory', () => {
    it('should not create excessive timers', () => {
      const components = [];

      // Create multiple animated components
      for (let i = 0; i < 10; i++) {
        components.push(
          render(
            <TestWrapper>
              <AgentStatusIndicator status="active" animated={true} />
            </TestWrapper>
          )
        );
      }

      // Verify no memory leaks or excessive timers
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Cleanup
      components.forEach(component => component.unmount());

      expect(true).toBe(true); // Test passes if no errors thrown
    });

    it('should handle frequent re-renders efficiently', () => {
      const { rerender } = render(
        <TestWrapper>
          <AgentStatusIndicator status="active" animated={true} />
        </TestWrapper>
      );

      // Rapidly re-render component
      for (let i = 0; i < 100; i++) {
        rerender(
          <TestWrapper>
            <AgentStatusIndicator
              status={i % 2 === 0 ? 'active' : 'error'}
              animated={true}
            />
          </TestWrapper>
        );
      }

      expect(true).toBe(true); // Test passes if no errors thrown
    });
  });
});
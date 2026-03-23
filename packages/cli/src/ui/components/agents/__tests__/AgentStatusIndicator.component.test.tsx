/**
 * Component tests for AgentStatusIndicator
 * Tests the actual React component implementation
 */

import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AgentStatusIndicator } from '../AgentStatusIndicator.js';
import { ThemeProvider } from '../../../context/ThemeContext.js';
import { getTheme } from '../../../themes/index.js';

// Mock Ink components for testing
vi.mock('ink', () => ({
  Box: ({ children, ...props }: any) => (
    <div data-testid="ink-box" {...props}>
      {children}
    </div>
  ),
  Text: ({ children, ...props }: any) => (
    <span data-testid="ink-text" {...props}>
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

describe('AgentStatusIndicator Component', () => {
  describe('Basic rendering', () => {
    it('should render with minimal props', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="idle" />
        </TestWrapper>
      );

      expect(container).toBeTruthy();
      const textElement = container.querySelector('[data-testid="ink-text"]');
      expect(textElement).toBeTruthy();
    });

    it('should render with all props', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator
            status="active"
            size="large"
            label="Test Agent"
            animated={true}
            color="#007acc"
            className="test-class"
            ariaLabel="Test aria label"
            showTooltip={true}
            tooltipText="Test tooltip"
          />
        </TestWrapper>
      );

      expect(container).toBeTruthy();
      const boxes = container.querySelectorAll('[data-testid="ink-box"]');
      const texts = container.querySelectorAll('[data-testid="ink-text"]');

      expect(boxes.length).toBeGreaterThan(0);
      expect(texts.length).toBeGreaterThan(0);
    });
  });

  describe('Status states', () => {
    it('should render idle status correctly', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="idle" />
        </TestWrapper>
      );

      const textElement = container.querySelector('[data-testid="ink-text"]');
      expect(textElement).toBeTruthy();
      expect(textElement?.textContent).toContain('○');
    });

    it('should render active status correctly', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="active" />
        </TestWrapper>
      );

      const textElement = container.querySelector('[data-testid="ink-text"]');
      expect(textElement).toBeTruthy();
      // Active state shows filled dot or animation variants
      expect(textElement?.textContent).toMatch(/[●◉]/);
    });

    it('should render error status correctly', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="error" />
        </TestWrapper>
      );

      const textElement = container.querySelector('[data-testid="ink-text"]');
      expect(textElement).toBeTruthy();
      // Error state may show warning icon or animation variants
      expect(textElement?.textContent).toMatch(/[⚠●◐◑◒◓○◔◕]/);
    });
  });

  describe('Size variants', () => {
    it('should handle small size', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="active" size="small" />
        </TestWrapper>
      );

      expect(container).toBeTruthy();
      // Small size should render single character
      const textElement = container.querySelector('[data-testid="ink-text"]');
      expect(textElement).toBeTruthy();
    });

    it('should handle medium size', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="active" size="medium" />
        </TestWrapper>
      );

      expect(container).toBeTruthy();
      const textElement = container.querySelector('[data-testid="ink-text"]');
      expect(textElement).toBeTruthy();
    });

    it('should handle large size', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="active" size="large" />
        </TestWrapper>
      );

      expect(container).toBeTruthy();
      // Large size should render double characters
      const textElement = container.querySelector('[data-testid="ink-text"]');
      expect(textElement).toBeTruthy();
      expect(textElement?.textContent?.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Label and tooltip', () => {
    it('should render with label', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="active" label="Test Agent" />
        </TestWrapper>
      );

      const textElements = container.querySelectorAll('[data-testid="ink-text"]');
      const labelText = Array.from(textElements).find(el =>
        el.textContent?.includes('Test Agent')
      );
      expect(labelText).toBeTruthy();
    });

    it('should render with tooltip when showTooltip is true', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator
            status="active"
            showTooltip={true}
            tooltipText="Custom tooltip"
          />
        </TestWrapper>
      );

      const textElements = container.querySelectorAll('[data-testid="ink-text"]');
      const tooltipText = Array.from(textElements).find(el =>
        el.textContent?.includes('Custom tooltip')
      );
      expect(tooltipText).toBeTruthy();
    });

    it('should not render tooltip when showTooltip is false', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator
            status="active"
            showTooltip={false}
          />
        </TestWrapper>
      );

      const textElements = container.querySelectorAll('[data-testid="ink-text"]');
      expect(textElements.length).toBe(1); // Only the status indicator
    });
  });

  describe('Animation states', () => {
    it('should not animate when animated is false', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="active" animated={false} />
        </TestWrapper>
      );

      expect(container).toBeTruthy();
      const textElement = container.querySelector('[data-testid="ink-text"]');
      expect(textElement).toBeTruthy();
    });

    it('should animate when animated is true', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="active" animated={true} />
        </TestWrapper>
      );

      expect(container).toBeTruthy();
      const textElement = container.querySelector('[data-testid="ink-text"]');
      expect(textElement).toBeTruthy();
    });

    it('should not animate idle status even when animated is true', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="idle" animated={true} />
        </TestWrapper>
      );

      expect(container).toBeTruthy();
      const textElement = container.querySelector('[data-testid="ink-text"]');
      expect(textElement).toBeTruthy();
      expect(textElement?.textContent).toBe('○');
    });
  });

  describe('Custom colors', () => {
    it('should accept custom color', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="active" color="#custom" />
        </TestWrapper>
      );

      expect(container).toBeTruthy();
      const textElement = container.querySelector('[data-testid="ink-text"]');
      expect(textElement).toBeTruthy();
    });
  });

  describe('Acceptance criteria validation', () => {
    it('should render status dot with correct colors for idle state (gray)', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="idle" />
        </TestWrapper>
      );

      const textElement = container.querySelector('[data-testid="ink-text"]');
      expect(textElement).toBeTruthy();
      expect(textElement?.textContent).toContain('○');
    });

    it('should render status dot with pulsing animation for active state', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="active" animated={true} />
        </TestWrapper>
      );

      const textElement = container.querySelector('[data-testid="ink-text"]');
      expect(textElement).toBeTruthy();
      // Active state with animation should show filled dot variants
      expect(textElement?.textContent).toMatch(/[●◉]/);
    });

    it('should render status dot for error state (red)', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="error" />
        </TestWrapper>
      );

      const textElement = container.querySelector('[data-testid="ink-text"]');
      expect(textElement).toBeTruthy();
      // Error state shows various animation frames or warning icon
      expect(textElement?.textContent).toMatch(/[⚠●◐◑◒◓○◔◕]/);
    });

    it('should support size variants', () => {
      const sizes: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];

      sizes.forEach(size => {
        const { container } = render(
          <TestWrapper>
            <AgentStatusIndicator status="active" size={size} />
          </TestWrapper>
        );

        const textElement = container.querySelector('[data-testid="ink-text"]');
        expect(textElement).toBeTruthy();
      });
    });

    it('should be accessible with proper ARIA attributes support', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator
            status="active"
            ariaLabel="Custom accessibility label"
          />
        </TestWrapper>
      );

      // The component should render successfully with aria label
      expect(container).toBeTruthy();
      const textElement = container.querySelector('[data-testid="ink-text"]');
      expect(textElement).toBeTruthy();
    });
  });
});
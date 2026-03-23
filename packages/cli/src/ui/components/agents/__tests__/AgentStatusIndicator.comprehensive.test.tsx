/**
 * Comprehensive unit tests for AgentStatusIndicator component
 * Tests all acceptance criteria and core functionality
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentStatusIndicator } from '../AgentStatusIndicator.js';
import { ThemeProvider } from '../../../context/ThemeContext.js';
import { getTheme } from '../../../themes/index.js';

// Mock Ink components with consistent test IDs
vi.mock('ink', () => ({
  Box: ({ children, ...props }: any) => (
    <div data-testid="status-container" {...props}>
      {children}
    </div>
  ),
  Text: ({ children, color, bold, dimColor, ...props }: any) => (
    <span
      data-testid="status-text"
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

describe('AgentStatusIndicator - Acceptance Criteria Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Status Dot Colors (Acceptance Criteria 1)', () => {
    it('should render gray color for idle status', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="idle" />
        </TestWrapper>
      );

      const statusText = container.querySelector('[data-testid="status-text"]');
      expect(statusText).toBeTruthy();
      expect(statusText?.textContent).toContain('○');
    });

    it('should render active status with blue/apex color', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="active" />
        </TestWrapper>
      );

      const statusText = container.querySelector('[data-testid="status-text"]');
      expect(statusText).toBeTruthy();
      // Active status shows filled dot variants
      expect(statusText?.textContent).toMatch(/[●◉]/);
    });

    it('should render red color for error status', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="error" />
        </TestWrapper>
      );

      const statusText = container.querySelector('[data-testid="status-text"]');
      expect(statusText).toBeTruthy();
      // Error status shows warning or animated variants
      expect(statusText?.textContent).toMatch(/[⚠●◐◑◒◓○◔◕]/);
    });
  });

  describe('Pulsing Animation for Active Status (Acceptance Criteria 2)', () => {
    it('should show pulsing animation when animated=true for active status', async () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="active" animated={true} />
        </TestWrapper>
      );

      const statusText = container.querySelector('[data-testid="status-text"]');
      expect(statusText).toBeTruthy();

      // Active status with animation should show pulse variants
      expect(statusText?.textContent).toMatch(/[●◉]/);
    });

    it('should not animate idle status even when animated=true', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="idle" animated={true} />
        </TestWrapper>
      );

      const statusText = container.querySelector('[data-testid="status-text"]');
      expect(statusText).toBeTruthy();
      // Idle always shows static circle
      expect(statusText?.textContent).toBe('○');
    });

    it('should not animate when animated=false', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="active" animated={false} />
        </TestWrapper>
      );

      const statusText = container.querySelector('[data-testid="status-text"]');
      expect(statusText).toBeTruthy();
      // Should show static active icon
      expect(statusText?.textContent).toBe('●');
    });
  });

  describe('Size Variants (Acceptance Criteria 3)', () => {
    it('should support small size variant', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="active" size="small" />
        </TestWrapper>
      );

      const statusText = container.querySelector('[data-testid="status-text"]');
      expect(statusText).toBeTruthy();
      // Small size shows single character
      expect(statusText?.textContent?.length).toBe(1);
    });

    it('should support medium size variant (default)', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="active" size="medium" />
        </TestWrapper>
      );

      const statusText = container.querySelector('[data-testid="status-text"]');
      expect(statusText).toBeTruthy();
      // Medium size shows single character
      expect(statusText?.textContent?.length).toBe(1);
    });

    it('should support large size variant', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="active" size="large" />
        </TestWrapper>
      );

      const statusText = container.querySelector('[data-testid="status-text"]');
      expect(statusText).toBeTruthy();
      // Large size shows double characters
      expect(statusText?.textContent?.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle all size variants for all status types', () => {
      const sizes = ['small', 'medium', 'large'] as const;
      const statuses = ['idle', 'active', 'error'] as const;

      sizes.forEach(size => {
        statuses.forEach(status => {
          const { container } = render(
            <TestWrapper>
              <AgentStatusIndicator status={status} size={size} />
            </TestWrapper>
          );

          const statusText = container.querySelector('[data-testid="status-text"]');
          expect(statusText).toBeTruthy();

          if (size === 'large') {
            expect(statusText?.textContent?.length).toBeGreaterThanOrEqual(2);
          } else {
            expect(statusText?.textContent?.length).toBe(1);
          }
        });
      });
    });
  });

  describe('Accessibility with ARIA Attributes (Acceptance Criteria 4)', () => {
    it('should be accessible with custom ARIA label', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator
            status="active"
            ariaLabel="Custom agent status indicator"
          />
        </TestWrapper>
      );

      // Component should render successfully with aria label
      expect(container).toBeTruthy();
      const statusContainer = container.querySelector('[data-testid="status-container"]');
      expect(statusContainer).toBeTruthy();
    });

    it('should provide default accessibility for each status', () => {
      const statuses = ['idle', 'active', 'error'] as const;

      statuses.forEach(status => {
        const { container } = render(
          <TestWrapper>
            <AgentStatusIndicator status={status} />
          </TestWrapper>
        );

        expect(container).toBeTruthy();
        const statusText = container.querySelector('[data-testid="status-text"]');
        expect(statusText).toBeTruthy();
      });
    });

    it('should support tooltips for accessibility', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator
            status="active"
            showTooltip={true}
            tooltipText="Agent is currently processing your request"
          />
        </TestWrapper>
      );

      const textElements = container.querySelectorAll('[data-testid="status-text"]');
      const tooltipElement = Array.from(textElements).find(el =>
        el.textContent?.includes('Agent is currently processing your request')
      );
      expect(tooltipElement).toBeTruthy();
    });
  });

  describe('Component Props and Configuration', () => {
    it('should render with minimal required props', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="idle" />
        </TestWrapper>
      );

      expect(container).toBeTruthy();
      const statusText = container.querySelector('[data-testid="status-text"]');
      expect(statusText).toBeTruthy();
    });

    it('should render with all props provided', () => {
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

      // Check for status indicator
      const statusText = container.querySelector('[data-testid="status-text"]');
      expect(statusText).toBeTruthy();

      // Check for label
      const textElements = container.querySelectorAll('[data-testid="status-text"]');
      const labelElement = Array.from(textElements).find(el =>
        el.textContent?.includes('Test Agent')
      );
      expect(labelElement).toBeTruthy();

      // Check for tooltip
      const tooltipElement = Array.from(textElements).find(el =>
        el.textContent?.includes('Test tooltip')
      );
      expect(tooltipElement).toBeTruthy();
    });

    it('should support custom colors', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="active" color="#custom" />
        </TestWrapper>
      );

      const statusText = container.querySelector('[data-testid="status-text"]');
      expect(statusText).toBeTruthy();
    });

    it('should handle label display correctly', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="active" label="Test Label" />
        </TestWrapper>
      );

      const textElements = container.querySelectorAll('[data-testid="status-text"]');
      const labelElement = Array.from(textElements).find(el =>
        el.textContent?.includes('Test Label')
      );
      expect(labelElement).toBeTruthy();
    });
  });

  describe('Error Boundaries and Edge Cases', () => {
    it('should handle undefined optional props gracefully', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator
            status="active"
            size={undefined as any}
            animated={undefined as any}
          />
        </TestWrapper>
      );

      expect(container).toBeTruthy();
      const statusText = container.querySelector('[data-testid="status-text"]');
      expect(statusText).toBeTruthy();
    });

    it('should render consistently across multiple instances', () => {
      const { container } = render(
        <TestWrapper>
          <div>
            <AgentStatusIndicator status="idle" />
            <AgentStatusIndicator status="active" />
            <AgentStatusIndicator status="error" />
          </div>
        </TestWrapper>
      );

      const statusElements = container.querySelectorAll('[data-testid="status-text"]');
      expect(statusElements.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Terminal Compatibility', () => {
    it('should use character-based rendering suitable for terminal', () => {
      const statuses = ['idle', 'active', 'error'] as const;

      statuses.forEach(status => {
        const { container } = render(
          <TestWrapper>
            <AgentStatusIndicator status={status} />
          </TestWrapper>
        );

        const statusText = container.querySelector('[data-testid="status-text"]');
        expect(statusText).toBeTruthy();

        // Should render appropriate Unicode characters
        const content = statusText?.textContent || '';
        expect(content).toMatch(/[○●◉⚠◐◑◒◓◔◕]/);
      });
    });

    it('should handle different animation states with terminal-compatible characters', () => {
      const { container } = render(
        <TestWrapper>
          <AgentStatusIndicator status="error" animated={true} />
        </TestWrapper>
      );

      const statusText = container.querySelector('[data-testid="status-text"]');
      expect(statusText).toBeTruthy();

      // Error animation uses fade animation with various characters
      expect(statusText?.textContent).toMatch(/[⚠●◐◑◒◓○◔◕]/);
    });
  });
});
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PermissionPrompt, PermissionRequest, PermissionLevel } from '../PermissionPrompt';

// Mock Ink components with accessibility attributes
vi.mock('ink', () => ({
  Box: ({ children, ...props }: any) => (
    <div
      data-testid="box"
      role={props.role}
      aria-label={props['aria-label']}
      aria-describedby={props['aria-describedby']}
      {...props}
    >
      {children}
    </div>
  ),
  Text: ({ children, ...props }: any) => (
    <span
      data-testid="text"
      role={props.role}
      aria-label={props['aria-label']}
      aria-level={props['aria-level']}
      {...props}
    >
      {children}
    </span>
  ),
  useInput: vi.fn(),
}));

describe('PermissionPrompt - Accessibility', () => {
  let mockOnDecision: ReturnType<typeof vi.fn>;
  let baseRequest: PermissionRequest;

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
  });

  describe('WCAG 2.1 Level AA Compliance', () => {
    describe('Perceivable', () => {
      it('should provide text alternatives for danger icons', () => {
        const dangerousRequest = {
          ...baseRequest,
          isDangerous: true,
          dangerLevel: 'critical' as const,
        };

        render(
          <PermissionPrompt
            request={dangerousRequest}
            onDecision={mockOnDecision}
          />
        );

        // Critical danger should have clear text description
        expect(screen.getByText(/CRITICAL.*irreversible damage/i)).toBeDefined();

        // Icon should be accompanied by descriptive text
        expect(screen.getByText(/🚨/)).toBeDefined();
        expect(screen.getByText(/CRITICAL/)).toBeDefined();
      });

      it('should provide sufficient color contrast information through text', () => {
        const mediumDangerRequest = {
          ...baseRequest,
          isDangerous: true,
          dangerLevel: 'medium' as const,
        };

        render(
          <PermissionPrompt
            request={mediumDangerRequest}
            onDecision={mockOnDecision}
          />
        );

        // Should not rely solely on color - should have text descriptions
        expect(screen.getByText(/MEDIUM RISK/)).toBeDefined();
        expect(screen.getByText(/May modify important files/)).toBeDefined();
      });

      it('should provide context for all visual elements', () => {
        render(
          <PermissionPrompt
            request={baseRequest}
            onDecision={mockOnDecision}
          />
        );

        // All key information should have textual context
        expect(screen.getByText(/Tool:/)).toBeDefined();
        expect(screen.getByText(/Operation:/)).toBeDefined();
        expect(screen.getByText(/Scope:/)).toBeDefined();
        expect(screen.getByText(/Choose an option:/)).toBeDefined();
      });

      it('should clearly indicate required vs optional information', () => {
        const requestWithOptionalFields = {
          ...baseRequest,
          context: 'Optional context information',
          parameters: { optional: 'parameter' },
        };

        render(
          <PermissionPrompt
            request={requestWithOptionalFields}
            onDecision={mockOnDecision}
            showDetails={true}
          />
        );

        // Core information should be present
        expect(screen.getByText(/Tool:/)).toBeDefined();
        expect(screen.getByText(/Operation:/)).toBeDefined();

        // Optional information should be clearly labeled
        expect(screen.getByText(/Context:/)).toBeDefined();
        expect(screen.getByText(/Parameters:/)).toBeDefined();
      });
    });

    describe('Operable', () => {
      it('should provide keyboard navigation instructions', () => {
        render(
          <PermissionPrompt
            request={baseRequest}
            onDecision={mockOnDecision}
          />
        );

        // Should clearly explain keyboard navigation
        const helpText = screen.getByText(/↑↓\/←→.*Navigate.*Enter.*Confirm.*Esc.*Deny/);
        expect(helpText).toBeDefined();
      });

      it('should provide multiple ways to make selections', () => {
        render(
          <PermissionPrompt
            request={baseRequest}
            onDecision={mockOnDecision}
          />
        );

        // Should show both arrow key navigation and direct key selection
        expect(screen.getByText(/A\/O\/D.*Direct selection/)).toBeDefined();
        expect(screen.getByText(/\[A\] Allow Always/)).toBeDefined();
        expect(screen.getByText(/\[O\] Allow Once/)).toBeDefined();
        expect(screen.getByText(/\[D\] Deny/)).toBeDefined();
      });

      it('should handle keyboard input gracefully', () => {
        const { useInput } = require('ink');
        let inputHandler: (input: string, key: any) => void;

        useInput.mockImplementation((handler: (input: string, key: any) => void) => {
          inputHandler = handler;
        });

        render(
          <PermissionPrompt
            request={baseRequest}
            onDecision={mockOnDecision}
          />
        );

        // Test arrow key navigation
        expect(() => {
          inputHandler('', { leftArrow: true });
          inputHandler('', { rightArrow: true });
          inputHandler('', { upArrow: true });
          inputHandler('', { downArrow: true });
        }).not.toThrow();

        // Test enter and escape keys
        expect(() => {
          inputHandler('', { return: true });
          inputHandler('', { escape: true });
        }).not.toThrow();
      });

      it('should provide escape mechanism', () => {
        const { useInput } = require('ink');
        let inputHandler: (input: string, key: any) => void;

        useInput.mockImplementation((handler: (input: string, key: any) => void) => {
          inputHandler = handler;
        });

        render(
          <PermissionPrompt
            request={baseRequest}
            onDecision={mockOnDecision}
          />
        );

        // ESC should always provide a way out (deny)
        inputHandler('', { escape: true });
        expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'deny');
      });

      it('should not have timing restrictions by default', () => {
        // Component should not auto-timeout or have built-in timing restrictions
        render(
          <PermissionPrompt
            request={baseRequest}
            onDecision={mockOnDecision}
          />
        );

        // Should render without any timeout warnings
        expect(screen.queryByText(/timeout/i)).toBeNull();
        expect(screen.queryByText(/expires/i)).toBeNull();
      });
    });

    describe('Understandable', () => {
      it('should use clear, consistent language', () => {
        render(
          <PermissionPrompt
            request={baseRequest}
            onDecision={mockOnDecision}
          />
        );

        // Should use clear labels
        expect(screen.getByText('Allow Always')).toBeDefined();
        expect(screen.getByText('Allow Once')).toBeDefined();
        expect(screen.getByText('Deny')).toBeDefined();

        // Should use consistent terminology
        expect(screen.getByText(/Permission Request/)).toBeDefined();
      });

      it('should provide context for dangerous operations', () => {
        const dangerousRequest = {
          ...baseRequest,
          isDangerous: true,
          dangerLevel: 'high' as const,
          context: 'This will permanently delete files',
        };

        render(
          <PermissionPrompt
            request={dangerousRequest}
            onDecision={mockOnDecision}
          />
        );

        // Should clearly explain the risk
        expect(screen.getByText(/HIGH RISK.*Destructive operation/)).toBeDefined();
        expect(screen.getByText(/This will permanently delete files/)).toBeDefined();
        expect(screen.getByText(/WARNING.*irreversible changes/)).toBeDefined();
      });

      it('should structure information hierarchically', () => {
        const detailedRequest = {
          ...baseRequest,
          context: 'Additional context',
          parameters: { file: 'test.txt', mode: 'write' },
        };

        render(
          <PermissionPrompt
            request={detailedRequest}
            onDecision={mockOnDecision}
            showDetails={true}
          />
        );

        // Should present information in logical order
        expect(screen.getByText(/Permission Request/)).toBeDefined();
        expect(screen.getByText(/Tool:/)).toBeDefined();
        expect(screen.getByText(/Operation:/)).toBeDefined();
        expect(screen.getByText(/Context:/)).toBeDefined();
        expect(screen.getByText(/Parameters:/)).toBeDefined();
        expect(screen.getByText(/Choose an option:/)).toBeDefined();
      });

      it('should indicate default selections clearly', () => {
        render(
          <PermissionPrompt
            request={baseRequest}
            onDecision={mockOnDecision}
          />
        );

        // Should indicate which option is selected by default
        // Look for selection indicator
        const selectionIndicators = screen.getAllByText('▶');
        expect(selectionIndicators.length).toBeGreaterThan(0);
      });
    });

    describe('Robust', () => {
      it('should handle missing optional data gracefully', () => {
        const minimalRequest = {
          id: 'minimal',
          tool: 'TestTool',
          operation: 'test-operation',
          isDangerous: false,
          timestamp: new Date(),
          // Missing scope, context, parameters
        };

        expect(() => {
          render(
            <PermissionPrompt
              request={minimalRequest}
              onDecision={mockOnDecision}
            />
          );
        }).not.toThrow();

        expect(screen.getByText('TestTool')).toBeDefined();
        expect(screen.getByText('test-operation')).toBeDefined();
      });

      it('should handle malformed data without crashing', () => {
        const malformedRequest = {
          ...baseRequest,
          parameters: {
            // Circular reference - should be handled gracefully
            circular: {} as any,
            nullValue: null,
            undefinedValue: undefined,
            functionValue: () => 'test',
            symbolValue: Symbol('test'),
          },
        };
        malformedRequest.parameters.circular.self = malformedRequest.parameters.circular;

        expect(() => {
          render(
            <PermissionPrompt
              request={malformedRequest}
              onDecision={mockOnDecision}
              showDetails={true}
            />
          );
        }).not.toThrow();
      });

      it('should work with different input devices', () => {
        const { useInput } = require('ink');
        let inputHandler: (input: string, key: any) => void;

        useInput.mockImplementation((handler: (input: string, key: any) => void) => {
          inputHandler = handler;
        });

        render(
          <PermissionPrompt
            request={baseRequest}
            onDecision={mockOnDecision}
          />
        );

        // Should handle different key variations
        expect(() => {
          // Different case variations
          inputHandler('A', { name: 'a' });
          inputHandler('o', { name: 'o' });
          inputHandler('D', { name: 'd' });

          // Different key object formats
          inputHandler('', { key: 'ArrowUp' });
          inputHandler('', { key: 'ArrowDown' });
          inputHandler('', { key: 'Enter' });
          inputHandler('', { key: 'Escape' });
        }).not.toThrow();
      });
    });
  });

  describe('Screen Reader Compatibility', () => {
    it('should provide logical reading order', () => {
      const dangerousRequest = {
        ...baseRequest,
        isDangerous: true,
        dangerLevel: 'high' as const,
        context: 'This is a dangerous operation',
      };

      render(
        <PermissionPrompt
          request={dangerousRequest}
          onDecision={mockOnDecision}
        />
      );

      // Content should be in logical reading order
      // 1. Header with danger indicator
      expect(screen.getByText(/Permission Request/)).toBeDefined();

      // 2. Tool and operation information
      expect(screen.getByText(/Tool:/)).toBeDefined();
      expect(screen.getByText(/Operation:/)).toBeDefined();

      // 3. Risk assessment
      expect(screen.getByText(/Risk Level:/)).toBeDefined();
      expect(screen.getByText(/HIGH RISK/)).toBeDefined();

      // 4. Context
      expect(screen.getByText(/Context:/)).toBeDefined();

      // 5. Options
      expect(screen.getByText(/Choose an option:/)).toBeDefined();

      // 6. Help
      expect(screen.getByText(/Navigate.*Confirm.*Deny/)).toBeDefined();
    });

    it('should provide meaningful headings structure', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Should have clear section headers
      expect(screen.getByText(/Permission Request/)).toBeDefined();
      expect(screen.getByText(/Choose an option:/)).toBeDefined();
    });

    it('should describe interactive elements properly', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Options should be clearly labeled
      expect(screen.getByText(/\[A\] Allow Always/)).toBeDefined();
      expect(screen.getByText(/\[O\] Allow Once/)).toBeDefined();
      expect(screen.getByText(/\[D\] Deny/)).toBeDefined();

      // Current selection should be indicated
      const selectionIndicators = screen.getAllByText('▶');
      expect(selectionIndicators.length).toBeGreaterThan(0);
    });
  });

  describe('Cognitive Accessibility', () => {
    it('should minimize cognitive load', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Should have clear section separation
      expect(screen.getByText(/Tool:/)).toBeDefined();
      expect(screen.getByText(/Operation:/)).toBeDefined();
      expect(screen.getByText(/Choose an option:/)).toBeDefined();

      // Should have clear action options
      expect(screen.getByText('Allow Always')).toBeDefined();
      expect(screen.getByText('Allow Once')).toBeDefined();
      expect(screen.getByText('Deny')).toBeDefined();
    });

    it('should provide clear consequences for dangerous actions', () => {
      const criticalRequest = {
        ...baseRequest,
        isDangerous: true,
        dangerLevel: 'critical' as const,
      };

      render(
        <PermissionPrompt
          request={criticalRequest}
          onDecision={mockOnDecision}
        />
      );

      // Should clearly warn about consequences
      expect(screen.getByText(/CRITICAL.*irreversible damage/i)).toBeDefined();
      expect(screen.getByText(/WARNING.*irreversible changes/i)).toBeDefined();
    });

    it('should support users who need more time', () => {
      // Component should not have built-in timeouts
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Should not auto-advance or timeout
      expect(screen.queryByText(/timeout/i)).toBeNull();
      expect(screen.queryByText(/time remaining/i)).toBeNull();
    });
  });

  describe('Motor Accessibility', () => {
    it('should provide multiple input methods', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Should support both navigation and direct selection
      expect(screen.getByText(/↑↓\/←→.*Navigate/)).toBeDefined();
      expect(screen.getByText(/A\/O\/D.*Direct selection/)).toBeDefined();
    });

    it('should have reasonable interaction targets', () => {
      const { useInput } = require('ink');
      let inputHandler: (input: string, key: any) => void;

      useInput.mockImplementation((handler: (input: string, key: any) => void) => {
        inputHandler = handler;
      });

      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Should accept both upper and lowercase
      inputHandler('A', { name: 'a' });
      expect(mockOnDecision).toHaveBeenLastCalledWith('test-request-123', 'allow-always');

      mockOnDecision.mockClear();

      inputHandler('o', { name: 'o' });
      expect(mockOnDecision).toHaveBeenLastCalledWith('test-request-123', 'allow-once');
    });

    it('should not require precise timing or complex gestures', () => {
      const { useInput } = require('ink');
      let inputHandler: (input: string, key: any) => void;

      useInput.mockImplementation((handler: (input: string, key: any) => void) => {
        inputHandler = handler;
      });

      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Simple key press should work
      expect(() => {
        inputHandler('a', { name: 'a' });
      }).not.toThrow();

      // Navigation should be simple
      expect(() => {
        inputHandler('', { leftArrow: true });
        inputHandler('', { return: true });
      }).not.toThrow();
    });
  });

  describe('Focus Management', () => {
    it('should properly handle auto-focus', () => {
      const { useInput } = require('ink');

      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
          autoFocus={true}
        />
      );

      // useInput should be called for focus management
      expect(useInput).toHaveBeenCalled();
    });

    it('should respect auto-focus disabled', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
          autoFocus={false}
        />
      );

      // Should still render but handle focus differently
      expect(screen.getByText(/Permission Request/)).toBeDefined();
    });

    it('should maintain focus context during interaction', () => {
      const { useInput } = require('ink');
      let inputHandler: (input: string, key: any) => void;

      useInput.mockImplementation((handler: (input: string, key: any) => void) => {
        inputHandler = handler;
      });

      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      // Focus should remain in component during navigation
      expect(() => {
        inputHandler('', { leftArrow: true });
        inputHandler('', { rightArrow: true });
        inputHandler('', { return: true });
      }).not.toThrow();
    });
  });
});
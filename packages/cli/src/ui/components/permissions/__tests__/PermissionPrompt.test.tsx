import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PermissionPrompt, PermissionRequest, PermissionLevel } from '../PermissionPrompt';

// Mock Ink components
vi.mock('ink', () => ({
  Box: ({ children, ...props }: any) => <div data-testid="box" {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span data-testid="text" {...props}>{children}</span>,
  useInput: vi.fn(),
}));

describe('PermissionPrompt', () => {
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

  describe('Basic Rendering', () => {
    it('should render permission prompt with basic request', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      expect(screen.getByText(/Permission Request/)).toBeDefined();
      expect(screen.getByText(/Tool: Write/)).toBeDefined();
      expect(screen.getByText(/Operation: file-write/)).toBeDefined();
    });

    it('should render scope when provided', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      expect(screen.getByText(/Scope: \/tmp\/test-file.txt/)).toBeDefined();
    });

    it('should render without scope when not provided', () => {
      const requestWithoutScope = {
        ...baseRequest,
        scope: undefined,
      };

      render(
        <PermissionPrompt
          request={requestWithoutScope}
          onDecision={mockOnDecision}
        />
      );

      expect(screen.queryByText(/Scope:/)).toBeNull();
    });
  });

  describe('Danger Level Indicators', () => {
    it('should render low danger indicator', () => {
      const dangerousRequest = {
        ...baseRequest,
        isDangerous: true,
        dangerLevel: 'low' as const,
        operation: 'read-system-file',
      };

      render(
        <PermissionPrompt
          request={dangerousRequest}
          onDecision={mockOnDecision}
        />
      );

      expect(screen.getByText(/⚠️/)).toBeDefined();
      expect(screen.getByText(/LOW RISK/)).toBeDefined();
    });

    it('should render medium danger indicator', () => {
      const dangerousRequest = {
        ...baseRequest,
        isDangerous: true,
        dangerLevel: 'medium' as const,
        operation: 'modify-system-file',
      };

      render(
        <PermissionPrompt
          request={dangerousRequest}
          onDecision={mockOnDecision}
        />
      );

      expect(screen.getByText(/⚠️/)).toBeDefined();
      expect(screen.getByText(/MEDIUM RISK/)).toBeDefined();
    });

    it('should render high danger indicator', () => {
      const dangerousRequest = {
        ...baseRequest,
        isDangerous: true,
        dangerLevel: 'high' as const,
        operation: 'delete-important-file',
      };

      render(
        <PermissionPrompt
          request={dangerousRequest}
          onDecision={mockOnDecision}
        />
      );

      expect(screen.getByText(/🚨/)).toBeDefined();
      expect(screen.getByText(/HIGH RISK/)).toBeDefined();
    });

    it('should render critical danger indicator', () => {
      const dangerousRequest = {
        ...baseRequest,
        isDangerous: true,
        dangerLevel: 'critical' as const,
        operation: 'rm -rf /',
      };

      render(
        <PermissionPrompt
          request={dangerousRequest}
          onDecision={mockOnDecision}
        />
      );

      expect(screen.getByText(/💀/)).toBeDefined();
      expect(screen.getByText(/CRITICAL RISK/)).toBeDefined();
    });
  });

  describe('Context and Parameters', () => {
    it('should render context when provided', () => {
      const requestWithContext = {
        ...baseRequest,
        context: 'This operation will create a temporary log file for debugging purposes.',
      };

      render(
        <PermissionPrompt
          request={requestWithContext}
          onDecision={mockOnDecision}
          showDetails={true}
        />
      );

      expect(screen.getByText(/This operation will create a temporary log file/)).toBeDefined();
    });

    it('should render parameters when provided and showDetails is true', () => {
      const requestWithParams = {
        ...baseRequest,
        parameters: {
          filePath: '/tmp/test-file.txt',
          content: 'test data',
          mode: '0644',
        },
      };

      render(
        <PermissionPrompt
          request={requestWithParams}
          onDecision={mockOnDecision}
          showDetails={true}
        />
      );

      expect(screen.getByText(/filePath.*\/tmp\/test-file.txt/)).toBeDefined();
      expect(screen.getByText(/content.*test data/)).toBeDefined();
      expect(screen.getByText(/mode.*0644/)).toBeDefined();
    });

    it('should not render parameters when showDetails is false', () => {
      const requestWithParams = {
        ...baseRequest,
        parameters: {
          filePath: '/tmp/test-file.txt',
          content: 'test data',
        },
      };

      render(
        <PermissionPrompt
          request={requestWithParams}
          onDecision={mockOnDecision}
          showDetails={false}
        />
      );

      expect(screen.queryByText(/filePath/)).toBeNull();
      expect(screen.queryByText(/content/)).toBeNull();
    });
  });

  describe('Keyboard Controls', () => {
    it('should show keyboard instructions', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
        />
      );

      expect(screen.getByText(/Press 'a' to allow always/)).toBeDefined();
      expect(screen.getByText(/Press 'o' to allow once/)).toBeDefined();
      expect(screen.getByText(/Press 'd' to deny/)).toBeDefined();
    });

    it('should handle allow-always key press', () => {
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

      // Simulate 'a' key press
      inputHandler('a', { name: 'a' });

      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'allow-always', undefined);
    });

    it('should handle allow-once key press', () => {
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

      // Simulate 'o' key press
      inputHandler('o', { name: 'o' });

      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'allow-once', undefined);
    });

    it('should handle deny key press', () => {
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

      // Simulate 'd' key press
      inputHandler('d', { name: 'd' });

      expect(mockOnDecision).toHaveBeenCalledWith('test-request-123', 'deny', undefined);
    });

    it('should ignore invalid key presses', () => {
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

      // Simulate invalid key press
      inputHandler('x', { name: 'x' });

      expect(mockOnDecision).not.toHaveBeenCalled();
    });
  });

  describe('Display Modes', () => {
    it('should render in compact mode', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
          displayMode="compact"
        />
      );

      // In compact mode, details should be minimal
      expect(screen.getByText(/Tool: Write/)).toBeDefined();
      expect(screen.queryByText(/Parameters:/)).toBeNull();
    });

    it('should render in expanded mode with details', () => {
      const requestWithDetails = {
        ...baseRequest,
        context: 'Detailed context information',
        parameters: { key: 'value' },
      };

      render(
        <PermissionPrompt
          request={requestWithDetails}
          onDecision={mockOnDecision}
          displayMode="expanded"
          showDetails={true}
        />
      );

      expect(screen.getByText(/Detailed context information/)).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long tool names', () => {
      const requestWithLongTool = {
        ...baseRequest,
        tool: 'VeryLongToolNameThatMightCauseLayoutIssues'.repeat(5),
      };

      render(
        <PermissionPrompt
          request={requestWithLongTool}
          onDecision={mockOnDecision}
        />
      );

      expect(screen.getByText(/Tool: VeryLongTool/)).toBeDefined();
    });

    it('should handle very long scopes', () => {
      const requestWithLongScope = {
        ...baseRequest,
        scope: '/very/long/path/that/might/cause/issues/'.repeat(10),
      };

      render(
        <PermissionPrompt
          request={requestWithLongScope}
          onDecision={mockOnDecision}
        />
      );

      expect(screen.getByText(/Scope:/)).toBeDefined();
    });

    it('should handle special characters in parameters', () => {
      const requestWithSpecialChars = {
        ...baseRequest,
        parameters: {
          command: 'echo "Hello, World!" | grep -E "^H.*d$"',
          symbols: '!@#$%^&*()',
          unicode: '🚀 🌟 💫',
        },
      };

      render(
        <PermissionPrompt
          request={requestWithSpecialChars}
          onDecision={mockOnDecision}
          showDetails={true}
        />
      );

      expect(screen.getByText(/🚀 🌟 💫/)).toBeDefined();
    });

    it('should handle null/undefined parameters gracefully', () => {
      const requestWithNullParams = {
        ...baseRequest,
        parameters: {
          nullValue: null,
          undefinedValue: undefined,
          emptyString: '',
          zeroValue: 0,
        },
      };

      expect(() => {
        render(
          <PermissionPrompt
            request={requestWithNullParams}
            onDecision={mockOnDecision}
            showDetails={true}
          />
        );
      }).not.toThrow();
    });

    it('should handle missing required fields gracefully', () => {
      const incompleteRequest = {
        id: 'test-123',
        tool: 'Write',
        // Missing operation, isDangerous, timestamp
      } as unknown as PermissionRequest;

      expect(() => {
        render(
          <PermissionPrompt
            request={incompleteRequest}
            onDecision={mockOnDecision}
          />
        );
      }).not.toThrow();
    });
  });

  describe('Auto-focus Behavior', () => {
    it('should auto-focus when autoFocus is true', () => {
      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
          autoFocus={true}
        />
      );

      // useInput should be called when auto-focus is enabled
      const { useInput } = require('ink');
      expect(useInput).toHaveBeenCalled();
    });

    it('should not auto-focus when autoFocus is false', () => {
      const { useInput } = require('ink');
      useInput.mockClear();

      render(
        <PermissionPrompt
          request={baseRequest}
          onDecision={mockOnDecision}
          autoFocus={false}
        />
      );

      // Component should still render but not set up input handling
      expect(screen.getByText(/Permission Request/)).toBeDefined();
    });
  });
});
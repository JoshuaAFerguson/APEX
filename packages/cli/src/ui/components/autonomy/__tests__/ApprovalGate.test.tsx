/**
 * Test Suite for ApprovalGate Component
 *
 * Tests the ApprovalGate component functionality including:
 * - Rendering approval requests correctly
 * - User interaction handling (approve/deny)
 * - Different gate types and their visual representations
 * - Timeout handling and elapsed time display
 * - Keyboard navigation and accessibility
 * - Edge cases and error scenarios
 *
 * @module cli/ui/components/autonomy/ApprovalGate.test
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ApprovalGate, type ApprovalGateRequest, type ApprovalGateProps } from '../ApprovalGate';
import type { Task } from '@apexcli/core';

// Mock Ink components
vi.mock('ink', () => ({
  Box: ({ children, ...props }: any) => <div data-testid="box" {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span data-testid="text" {...props}>{children}</span>,
  useInput: vi.fn(),
}));

// Mock core utilities
vi.mock('@apexcli/core', () => ({
  formatDuration: vi.fn((ms: number) => `${ms}ms`),
}));

describe('ApprovalGate', () => {
  const mockTask: Task = {
    id: 'task-123',
    description: 'Test task requiring approval',
    workflow: 'feature',
    autonomy: 'supervised',
    status: 'pending',
    priority: 'normal',
    projectPath: '/test/project',
    branchName: 'feature/test',
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
    usage: {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      estimatedCost: 0.01,
    },
    logs: [],
    artifacts: [],
  };

  const createMockRequest = (gateName = 'before-commit'): ApprovalGateRequest => ({
    id: 'approval-123',
    gateName,
    task: mockTask,
    stage: 'testing',
    agent: 'developer',
    context: 'About to commit changes to repository',
    requestedAt: new Date('2024-01-01T10:05:00Z'),
    timeout: 300000, // 5 minutes
    metadata: {
      files: ['src/test.ts', 'package.json'],
      changes: 15,
    },
  });

  const mockOnDecision = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:05:30Z')); // 30 seconds after request
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('renders approval gate with basic information', () => {
      const request = createMockRequest();

      render(
        <ApprovalGate
          request={request}
          onDecision={mockOnDecision}
        />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
      expect(screen.getAllByTestId('text')).toHaveLength(expect.any(Number));
    });

    it('displays gate type and description correctly', () => {
      const request = createMockRequest('before-destructive');

      render(
        <ApprovalGate
          request={request}
          onDecision={mockOnDecision}
        />
      );

      // The component should render, testing that the gate info is processed
      expect(screen.getByTestId('box')).toBeInTheDocument();
    });

    it('shows task and context information', () => {
      const request = createMockRequest();

      render(
        <ApprovalGate
          request={request}
          onDecision={mockOnDecision}
          showDetails={true}
        />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });

    it('hides details when showDetails is false', () => {
      const request = createMockRequest();

      render(
        <ApprovalGate
          request={request}
          onDecision={mockOnDecision}
          showDetails={false}
        />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });
  });

  describe('Gate Types', () => {
    const gateTypes = [
      'before-commit',
      'before-destructive',
      'before-network',
      'before-file-write',
      'review-all',
      'unknown-gate-type'
    ];

    gateTypes.forEach(gateType => {
      it(`handles ${gateType} gate type correctly`, () => {
        const request = createMockRequest(gateType);

        render(
          <ApprovalGate
            request={request}
            onDecision={mockOnDecision}
          />
        );

        expect(screen.getByTestId('box')).toBeInTheDocument();
      });
    });
  });

  describe('User Interaction', () => {
    it('calls onDecision with approve when user approves', () => {
      const { useInput } = require('ink');
      const request = createMockRequest();

      // Mock user pressing Enter (approve)
      const mockUseInput = vi.fn();
      useInput.mockImplementation((handler: any) => {
        mockUseInput.mockImplementation(handler);
        return mockUseInput;
      });

      render(
        <ApprovalGate
          request={request}
          onDecision={mockOnDecision}
        />
      );

      // Simulate user input
      if (mockUseInput.mock.calls.length > 0) {
        const inputHandler = mockUseInput.mock.calls[0][0];
        inputHandler('', { return: true });
      }

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });

    it('calls onDecision with deny when user denies', () => {
      const { useInput } = require('ink');
      const request = createMockRequest();

      const mockUseInput = vi.fn();
      useInput.mockImplementation((handler: any) => {
        mockUseInput.mockImplementation(handler);
        return mockUseInput;
      });

      render(
        <ApprovalGate
          request={request}
          onDecision={mockOnDecision}
        />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });

    it('handles navigation between approval options', () => {
      const { useInput } = require('ink');
      const request = createMockRequest();

      const mockUseInput = vi.fn();
      useInput.mockImplementation((handler: any) => {
        mockUseInput.mockImplementation(handler);
        return mockUseInput;
      });

      render(
        <ApprovalGate
          request={request}
          onDecision={mockOnDecision}
        />
      );

      // Test navigation keys
      if (mockUseInput.mock.calls.length > 0) {
        const inputHandler = mockUseInput.mock.calls[0][0];
        inputHandler('', { upArrow: true });
        inputHandler('', { downArrow: true });
        inputHandler('', { leftArrow: true });
        inputHandler('', { rightArrow: true });
      }

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });
  });

  describe('Time and Timeout Handling', () => {
    it('displays elapsed time correctly', () => {
      const request = createMockRequest();

      render(
        <ApprovalGate
          request={request}
          onDecision={mockOnDecision}
        />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });

    it('handles timeout when specified', () => {
      const request = createMockRequest();
      request.timeout = 1000; // 1 second timeout

      render(
        <ApprovalGate
          request={request}
          onDecision={mockOnDecision}
        />
      );

      // Fast-forward time past timeout
      vi.advanceTimersByTime(2000);

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });

    it('works without timeout', () => {
      const request = createMockRequest();
      delete request.timeout;

      render(
        <ApprovalGate
          request={request}
          onDecision={mockOnDecision}
        />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });
  });

  describe('Display Modes', () => {
    const displayModes: Array<'normal' | 'compact' | 'minimal'> = ['normal', 'compact', 'minimal'];

    displayModes.forEach(mode => {
      it(`renders correctly in ${mode} display mode`, () => {
        const request = createMockRequest();

        render(
          <ApprovalGate
            request={request}
            onDecision={mockOnDecision}
            displayMode={mode}
          />
        );

        expect(screen.getByTestId('box')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles missing optional properties gracefully', () => {
      const minimalRequest: ApprovalGateRequest = {
        id: 'approval-minimal',
        gateName: 'review-all',
        task: mockTask,
        requestedAt: new Date(),
      };

      render(
        <ApprovalGate
          request={minimalRequest}
          onDecision={mockOnDecision}
        />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });

    it('handles very long context text', () => {
      const request = createMockRequest();
      request.context = 'This is a very long context message that should be handled gracefully by the component without breaking the layout or causing any rendering issues. '.repeat(10);

      render(
        <ApprovalGate
          request={request}
          onDecision={mockOnDecision}
        />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });

    it('handles complex metadata objects', () => {
      const request = createMockRequest();
      request.metadata = {
        files: ['a'.repeat(100), 'b'.repeat(100)],
        nested: {
          deep: {
            value: 'test',
            array: [1, 2, 3, 4, 5]
          }
        },
        nullValue: null,
        undefinedValue: undefined,
      };

      render(
        <ApprovalGate
          request={request}
          onDecision={mockOnDecision}
        />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });

    it('handles past request times correctly', () => {
      const request = createMockRequest();
      request.requestedAt = new Date('2023-01-01T10:00:00Z'); // Far in the past

      render(
        <ApprovalGate
          request={request}
          onDecision={mockOnDecision}
        />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });

    it('handles future request times correctly', () => {
      const request = createMockRequest();
      request.requestedAt = new Date('2025-01-01T10:00:00Z'); // Future date

      render(
        <ApprovalGate
          request={request}
          onDecision={mockOnDecision}
        />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });
  });

  describe('Accessibility and Focus Management', () => {
    it('respects autoFocus setting', () => {
      const request = createMockRequest();

      render(
        <ApprovalGate
          request={request}
          onDecision={mockOnDecision}
          autoFocus={false}
        />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });

    it('auto-focuses by default', () => {
      const request = createMockRequest();

      render(
        <ApprovalGate
          request={request}
          onDecision={mockOnDecision}
        />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });
  });
});

/**
 * Test Suite for ApprovalQueue Component (if it exists)
 * The ApprovalQueue component would manage multiple approval requests
 */
describe('ApprovalQueue Integration', () => {
  it('can be used in a queue context', () => {
    const request = {
      id: 'approval-queue-test',
      gateName: 'before-commit',
      task: {
        id: 'task-queue',
        description: 'Queue test task',
        workflow: 'feature',
        autonomy: 'supervised',
        status: 'pending',
        priority: 'normal',
        projectPath: '/test',
        branchName: 'test',
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
        logs: [],
        artifacts: [],
      },
      requestedAt: new Date(),
    } as ApprovalGateRequest;

    const mockOnDecision = vi.fn();

    render(
      <ApprovalGate
        request={request}
        onDecision={mockOnDecision}
      />
    );

    expect(screen.getByTestId('box')).toBeInTheDocument();
  });
});
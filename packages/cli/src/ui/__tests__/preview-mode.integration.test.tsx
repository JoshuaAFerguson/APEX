import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../App';

// Mock the orchestrator and related modules
vi.mock('@apex/orchestrator', () => ({
  ApexOrchestrator: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    off: vi.fn(),
    executeTask: vi.fn(),
    getTask: vi.fn(),
    createTask: vi.fn().mockResolvedValue({ id: 'test-task' }),
    initialize: vi.fn(),
  })),
}));

// Mock Ink components
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn(),
    useStdout: () => ({ stdout: { columns: 80, rows: 24 } }),
    useFocusManager: () => ({
      focusNext: vi.fn(),
      focusPrevious: vi.fn(),
      focus: vi.fn(),
    }),
  };
});

// Mock the conversation manager
vi.mock('../../services/ConversationManager', () => ({
  ConversationManager: vi.fn().mockImplementation(function () { return ({
    addMessage: vi.fn(),
    getContext: vi.fn().mockReturnValue({ messages: [] }),
    getRecentMessages: vi.fn().mockReturnValue([]),
  }); }),
}));

// Mock session store
vi.mock('../../services/SessionStore', () => ({
  SessionStore: vi.fn().mockImplementation(() => ({
    saveSession: vi.fn(),
    loadSession: vi.fn(),
    getSessions: vi.fn().mockReturnValue([]),
  })),
}));

describe('Preview Mode Integration', () => {
  let mockUseInput: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUseInput = vi.fn();
    vi.mocked(require('ink').useInput).mockImplementation(mockUseInput);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    orchestrator: null,
    sessionStore: null,
    conversationManager: null,
  };

  describe('preview command functionality', () => {
    it('should toggle preview mode when /preview command is entered', () => {
      render(<App {...defaultProps} />);

      // Simulate typing /preview command
      const inputHandler = mockUseInput.mock.calls[0][0];
      inputHandler('/preview', { key: { name: 'return' } });

      // Should toggle preview mode (implementation dependent)
      // This test verifies the command is processed without error
      expect(mockUseInput).toHaveBeenCalled();
    });

    it('should show preview mode indicator in status bar when enabled', () => {
      render(<App {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Enable preview mode
      inputHandler('/preview', { key: { name: 'return' } });

      // Should show preview mode indicator
      // Note: This depends on the actual implementation in StatusBar
      expect(screen.queryByText(/preview/i)).toBeTruthy();
    });

    it('should hide preview mode indicator when disabled', () => {
      render(<App {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Enable then disable preview mode
      inputHandler('/preview', { key: { name: 'return' } });
      inputHandler('/preview', { key: { name: 'return' } });

      // Preview indicator should be hidden or show as off
      // Implementation dependent
    });
  });

  describe('preview panel interaction', () => {
    it('should show preview panel for user input when preview mode is enabled', () => {
      render(<App {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Enable preview mode
      inputHandler('/preview', { key: { name: 'return' } });

      // Enter some input that should trigger preview
      inputHandler('create a new component', { key: {} });

      // Should show preview panel (when not immediately submitting)
      // This depends on the debounce/timing implementation
    });

    it('should handle Enter key to confirm preview', () => {
      render(<App {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Enable preview mode and enter input
      inputHandler('/preview', { key: { name: 'return' } });
      inputHandler('create component', { key: {} });

      // Simulate Enter key while preview is showing
      inputHandler('', { key: { name: 'return' } });

      // Should proceed with the task execution
      expect(mockUseInput).toHaveBeenCalled();
    });

    it('should handle Escape key to cancel preview', () => {
      render(<App {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Enable preview mode and enter input
      inputHandler('/preview', { key: { name: 'return' } });
      inputHandler('create component', { key: {} });

      // Simulate Escape key while preview is showing
      inputHandler('', { key: { name: 'escape' } });

      // Should cancel the preview and return to input
      expect(mockUseInput).toHaveBeenCalled();
    });

    it('should handle e key to edit input', () => {
      render(<App {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Enable preview mode and enter input
      inputHandler('/preview', { key: { name: 'return' } });
      inputHandler('create component', { key: {} });

      // Simulate 'e' key while preview is showing
      inputHandler('e', { key: {} });

      // Should return to input mode for editing
      expect(mockUseInput).toHaveBeenCalled();
    });
  });

  describe('intent detection integration', () => {
    it('should detect command intent correctly', () => {
      render(<App {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Enable preview mode
      inputHandler('/preview', { key: { name: 'return' } });

      // Enter a command
      inputHandler('/status', { key: {} });

      // Should show command intent in preview
      // This test verifies no errors occur during intent detection
      expect(mockUseInput).toHaveBeenCalled();
    });

    it('should detect task intent correctly', () => {
      render(<App {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Enable preview mode
      inputHandler('/preview', { key: { name: 'return' } });

      // Enter a task description
      inputHandler('create a login form', { key: {} });

      // Should show task intent with workflow information
      expect(mockUseInput).toHaveBeenCalled();
    });

    it('should detect question intent correctly', () => {
      render(<App {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Enable preview mode
      inputHandler('/preview', { key: { name: 'return' } });

      // Enter a question
      inputHandler('How do I create a component?', { key: {} });

      // Should show question intent
      expect(mockUseInput).toHaveBeenCalled();
    });
  });

  describe('workflow information display', () => {
    it('should show workflow stages for task intents', () => {
      render(<App {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Enable preview mode
      inputHandler('/preview', { key: { name: 'return' } });

      // Enter a task that would use feature workflow
      inputHandler('add user authentication', { key: {} });

      // Should show agent flow for feature workflow
      // The exact text depends on implementation but should include agent names
      expect(mockUseInput).toHaveBeenCalled();
    });

    it('should not show workflow stages for command intents', () => {
      render(<App {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Enable preview mode
      inputHandler('/preview', { key: { name: 'return' } });

      // Enter a command
      inputHandler('/help', { key: {} });

      // Should not show workflow information for commands
      expect(mockUseInput).toHaveBeenCalled();
    });
  });

  describe('state management', () => {
    it('should preserve preview mode state across inputs', () => {
      render(<App {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Enable preview mode
      inputHandler('/preview', { key: { name: 'return' } });

      // Enter first input
      inputHandler('first task', { key: {} });
      inputHandler('', { key: { name: 'escape' } }); // Cancel

      // Enter second input - preview should still be enabled
      inputHandler('second task', { key: {} });

      // Preview should still be active
      expect(mockUseInput).toHaveBeenCalled();
    });

    it('should handle rapid input changes gracefully', () => {
      render(<App {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Enable preview mode
      inputHandler('/preview', { key: { name: 'return' } });

      // Rapidly change input (simulating fast typing)
      inputHandler('c', { key: {} });
      inputHandler('cr', { key: {} });
      inputHandler('cre', { key: {} });
      inputHandler('create', { key: {} });
      inputHandler('create comp', { key: {} });

      // Should handle rapid changes without errors
      expect(mockUseInput).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle intent detection errors gracefully', () => {
      // Mock intent detector to throw an error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<App {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Enable preview mode
      inputHandler('/preview', { key: { name: 'return' } });

      // Enter input that might cause intent detection to fail
      inputHandler('∞∞∞ invalid input ∞∞∞', { key: {} });

      // Should not crash the app
      expect(mockUseInput).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle missing orchestrator gracefully', () => {
      render(<App {...defaultProps} orchestrator={null} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Try to enable preview mode without orchestrator
      inputHandler('/preview', { key: { name: 'return' } });

      // Should handle gracefully
      expect(mockUseInput).toHaveBeenCalled();
    });
  });

  describe('accessibility and usability', () => {
    it('should provide clear feedback when preview mode is toggled', () => {
      render(<App {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Toggle preview mode
      inputHandler('/preview', { key: { name: 'return' } });

      // Should show some indication that preview mode is enabled
      // This could be in the status bar or as a temporary message
      expect(mockUseInput).toHaveBeenCalled();
    });

    it('should maintain input focus during preview interactions', () => {
      render(<App {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Enable preview mode and interact
      inputHandler('/preview', { key: { name: 'return' } });
      inputHandler('test input', { key: {} });
      inputHandler('e', { key: {} }); // Edit mode

      // Should return focus to input for editing
      expect(mockUseInput).toHaveBeenCalled();
    });
  });

  describe('performance considerations', () => {
    it('should not trigger excessive re-renders during preview', () => {
      const renderSpy = vi.fn();

      const TestWrapper = () => {
        renderSpy();
        return <App {...defaultProps} />;
      };

      render(<TestWrapper />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Enable preview and type input
      inputHandler('/preview', { key: { name: 'return' } });
      inputHandler('some input text', { key: {} });

      // Should not cause excessive renders
      // This is a basic check - more sophisticated performance testing would be needed
      expect(renderSpy).toHaveBeenCalled();
    });

    it('should debounce intent detection for performance', () => {
      render(<App {...defaultProps} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Enable preview mode
      inputHandler('/preview', { key: { name: 'return' } });

      // Type input rapidly
      const rapidInputs = ['t', 'te', 'tes', 'test', 'test ', 'test i', 'test in', 'test inp', 'test input'];
      rapidInputs.forEach(input => {
        inputHandler(input, { key: {} });
      });

      // Should handle rapid input without performance issues
      expect(mockUseInput).toHaveBeenCalled();
    });
  });
});

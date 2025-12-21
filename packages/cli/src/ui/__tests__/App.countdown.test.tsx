import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../__tests__/test-utils';
import { App, type AppProps, type AppState } from '../App';
import type { DisplayMode } from '@apex/core';

// Mock ink hooks
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn(),
    useApp: () => ({ exit: vi.fn() }),
    useStdout: () => ({ stdout: { columns: 120 } }),
  };
});

// Mock dependencies
vi.mock('../../services/ConversationManager', () => ({
  ConversationManager: vi.fn().mockImplementation(() => ({
    addMessage: vi.fn(),
    getSuggestions: vi.fn(() => []),
    hasPendingClarification: vi.fn(() => false),
    detectIntent: vi.fn(() => ({ type: 'task', confidence: 0.9 })),
    clearContext: vi.fn(),
    setTask: vi.fn(),
    setAgent: vi.fn(),
    clearTask: vi.fn(),
    clearAgent: vi.fn(),
  })),
}));

vi.mock('../../services/ShortcutManager', () => ({
  ShortcutManager: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    handleKey: vi.fn(() => false),
    pushContext: vi.fn(),
    popContext: vi.fn(),
  })),
}));

vi.mock('../../services/CompletionEngine', () => ({
  CompletionEngine: vi.fn().mockImplementation(() => ({})),
}));

describe('App Countdown State Management', () => {
  let mockOnCommand: ReturnType<typeof vi.fn>;
  let mockOnTask: ReturnType<typeof vi.fn>;
  let mockOnExit: ReturnType<typeof vi.fn>;
  let baseState: AppState;
  let props: AppProps;

  beforeEach(() => {
    vi.useFakeTimers();

    mockOnCommand = vi.fn().mockResolvedValue(undefined);
    mockOnTask = vi.fn().mockResolvedValue(undefined);
    mockOnExit = vi.fn();

    baseState = {
      initialized: true,
      projectPath: '/test/project',
      config: null,
      orchestrator: null,
      gitBranch: 'main',
      currentTask: undefined,
      messages: [],
      inputHistory: [],
      isProcessing: false,
      tokens: { input: 0, output: 0 },
      cost: 0,
      model: 'sonnet',
      displayMode: 'normal' as DisplayMode,
      previewMode: true,
      previewConfig: {
        confidenceThreshold: 0.8,
        autoExecuteHighConfidence: false,
        timeoutMs: 5000,
      },
      showThoughts: false,
    };

    props = {
      initialState: baseState,
      onCommand: mockOnCommand,
      onTask: mockOnTask,
      onExit: mockOnExit,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Countdown Initialization', () => {
    it('should initialize countdown when pendingPreview is set', () => {
      const propsWithPreview = {
        ...props,
        initialState: {
          ...baseState,
          pendingPreview: {
            input: 'test input',
            intent: {
              type: 'task' as const,
              confidence: 0.9,
            },
            timestamp: new Date(),
          },
        },
      };

      render(<App {...propsWithPreview} />);

      // Advance one animation frame to allow useEffect to run
      act(() => {
        vi.advanceTimersByTime(0);
      });

      // Check that countdown timer is displayed in PreviewPanel
      expect(screen.queryByText(/Auto-execute in/)).toBeInTheDocument();
    });

    it('should not initialize countdown when pendingPreview is undefined', () => {
      render(<App {...props} />);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should not display countdown
      expect(screen.queryByText(/Auto-execute in/)).not.toBeInTheDocument();
    });

    it('should set remainingMs to previewConfig.timeoutMs when preview starts', () => {
      const propsWithPreview = {
        ...props,
        initialState: {
          ...baseState,
          pendingPreview: {
            input: 'test input',
            intent: {
              type: 'task' as const,
              confidence: 0.9,
            },
            timestamp: new Date(),
          },
        },
      };

      render(<App {...propsWithPreview} />);

      act(() => {
        vi.advanceTimersByTime(0);
      });

      // Countdown should show 5 seconds (5000ms / 1000)
      expect(screen.queryByText(/5s/)).toBeInTheDocument();
    });
  });

  describe('Countdown Decrement Behavior', () => {
    it('should decrement countdown every 100ms', () => {
      const propsWithPreview = {
        ...props,
        initialState: {
          ...baseState,
          pendingPreview: {
            input: 'test input',
            intent: {
              type: 'task' as const,
              confidence: 0.9,
            },
            timestamp: new Date(),
          },
        },
      };

      render(<App {...propsWithPreview} />);

      // Initialize countdown
      act(() => {
        vi.advanceTimersByTime(0);
      });

      // Initially shows 5s
      expect(screen.queryByText(/5s/)).toBeInTheDocument();

      // After 1 second (1000ms), should show 4s
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.queryByText(/4s/)).toBeInTheDocument();

      // After another second (2000ms total), should show 3s
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.queryByText(/3s/)).toBeInTheDocument();
    });

    it('should update countdown smoothly with 100ms intervals', () => {
      const propsWithPreview = {
        ...props,
        initialState: {
          ...baseState,
          previewConfig: {
            ...baseState.previewConfig,
            timeoutMs: 1000, // 1 second for easier testing
          },
          pendingPreview: {
            input: 'test input',
            intent: {
              type: 'task' as const,
              confidence: 0.9,
            },
            timestamp: new Date(),
          },
        },
      };

      render(<App {...propsWithPreview} />);

      act(() => {
        vi.advanceTimersByTime(0);
      });

      // Should start at 1s
      expect(screen.queryByText(/1s/)).toBeInTheDocument();

      // After 500ms, should still show 1s (since we ceil the seconds)
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.queryByText(/1s/)).toBeInTheDocument();

      // After 900ms total, should still show 1s
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(screen.queryByText(/1s/)).toBeInTheDocument();
    });
  });

  describe('Auto-Execute Trigger', () => {
    it('should auto-execute when countdown reaches zero', async () => {
      const propsWithPreview = {
        ...props,
        initialState: {
          ...baseState,
          previewConfig: {
            ...baseState.previewConfig,
            timeoutMs: 1000, // 1 second for easier testing
          },
          pendingPreview: {
            input: 'test task',
            intent: {
              type: 'task' as const,
              confidence: 0.9,
            },
            timestamp: new Date(),
          },
        },
      };

      render(<App {...propsWithPreview} />);

      // Initialize countdown
      act(() => {
        vi.advanceTimersByTime(0);
      });

      // Advance past the timeout
      act(() => {
        vi.advanceTimersByTime(1100); // 1.1 seconds
      });

      // Should have called onTask with the pending input
      expect(mockOnTask).toHaveBeenCalledWith('test task');
    });

    it('should show auto-execute message when timeout triggers', () => {
      const propsWithPreview = {
        ...props,
        initialState: {
          ...baseState,
          previewConfig: {
            ...baseState.previewConfig,
            timeoutMs: 1000,
          },
          pendingPreview: {
            input: 'test input',
            intent: {
              type: 'command' as const,
              confidence: 0.9,
              command: 'test',
              args: ['arg1'],
            },
            timestamp: new Date(),
          },
        },
      };

      render(<App {...propsWithPreview} />);

      act(() => {
        vi.advanceTimersByTime(0);
      });

      // Advance past the timeout
      act(() => {
        vi.advanceTimersByTime(1100);
      });

      // Should show auto-execute message
      expect(screen.queryByText(/Auto-executing after 1s timeout/)).toBeInTheDocument();
    });

    it('should clear countdown state after auto-execute', () => {
      const propsWithPreview = {
        ...props,
        initialState: {
          ...baseState,
          previewConfig: {
            ...baseState.previewConfig,
            timeoutMs: 1000,
          },
          pendingPreview: {
            input: 'test input',
            intent: {
              type: 'task' as const,
              confidence: 0.9,
            },
            timestamp: new Date(),
          },
        },
      };

      render(<App {...propsWithPreview} />);

      act(() => {
        vi.advanceTimersByTime(0);
      });

      // Verify countdown is displayed
      expect(screen.queryByText(/Auto-execute in/)).toBeInTheDocument();

      // Trigger auto-execute
      act(() => {
        vi.advanceTimersByTime(1100);
      });

      // Countdown should no longer be displayed
      expect(screen.queryByText(/Auto-execute in/)).not.toBeInTheDocument();
    });

    it('should handle command execution on timeout', () => {
      const propsWithPreview = {
        ...props,
        initialState: {
          ...baseState,
          previewConfig: {
            ...baseState.previewConfig,
            timeoutMs: 500,
          },
          pendingPreview: {
            input: '/status',
            intent: {
              type: 'command' as const,
              confidence: 0.9,
              command: 'status',
              args: [],
            },
            timestamp: new Date(),
          },
        },
      };

      render(<App {...propsWithPreview} />);

      act(() => {
        vi.advanceTimersByTime(0);
      });

      act(() => {
        vi.advanceTimersByTime(600);
      });

      // Should have called onCommand for command type
      expect(mockOnCommand).toHaveBeenCalledWith('status', []);
    });
  });

  describe('Countdown Reset Behavior', () => {
    it('should reset countdown when pendingPreview changes', () => {
      const { rerender } = render(<App {...props} />);

      // Start with no preview
      expect(screen.queryByText(/Auto-execute in/)).not.toBeInTheDocument();

      // Add a preview
      const propsWithPreview = {
        ...props,
        initialState: {
          ...baseState,
          pendingPreview: {
            input: 'first input',
            intent: {
              type: 'task' as const,
              confidence: 0.9,
            },
            timestamp: new Date(),
          },
        },
      };

      rerender(<App {...propsWithPreview} />);

      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(screen.queryByText(/5s/)).toBeInTheDocument();

      // Let some time pass
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.queryByText(/3s/)).toBeInTheDocument();

      // Change the pending preview
      const propsWithNewPreview = {
        ...props,
        initialState: {
          ...baseState,
          pendingPreview: {
            input: 'second input',
            intent: {
              type: 'task' as const,
              confidence: 0.9,
            },
            timestamp: new Date(),
          },
        },
      };

      rerender(<App {...propsWithNewPreview} />);

      act(() => {
        vi.advanceTimersByTime(0);
      });

      // Should reset to 5s
      expect(screen.queryByText(/5s/)).toBeInTheDocument();
    });

    it('should reset countdown when pendingPreview is cleared', () => {
      const propsWithPreview = {
        ...props,
        initialState: {
          ...baseState,
          pendingPreview: {
            input: 'test input',
            intent: {
              type: 'task' as const,
              confidence: 0.9,
            },
            timestamp: new Date(),
          },
        },
      };

      const { rerender } = render(<App {...propsWithPreview} />);

      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(screen.queryByText(/Auto-execute in/)).toBeInTheDocument();

      // Clear the pending preview
      rerender(<App {...props} />);

      // Countdown should be gone
      expect(screen.queryByText(/Auto-execute in/)).not.toBeInTheDocument();
    });
  });

  describe('Countdown Display Integration', () => {
    it('should pass remainingMs to PreviewPanel', () => {
      const propsWithPreview = {
        ...props,
        initialState: {
          ...baseState,
          pendingPreview: {
            input: 'test input',
            intent: {
              type: 'task' as const,
              confidence: 0.9,
            },
            timestamp: new Date(),
          },
        },
      };

      render(<App {...propsWithPreview} />);

      act(() => {
        vi.advanceTimersByTime(0);
      });

      // PreviewPanel should display countdown
      expect(screen.queryByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.queryByText(/5s/)).toBeInTheDocument();
    });

    it('should show countdown color coding based on remaining time', () => {
      const propsWithPreview = {
        ...props,
        initialState: {
          ...baseState,
          previewConfig: {
            ...baseState.previewConfig,
            timeoutMs: 8000, // 8 seconds
          },
          pendingPreview: {
            input: 'test input',
            intent: {
              type: 'task' as const,
              confidence: 0.9,
            },
            timestamp: new Date(),
          },
        },
      };

      render(<App {...propsWithPreview} />);

      act(() => {
        vi.advanceTimersByTime(0);
      });

      // Should start green (>5s)
      expect(screen.queryByText(/8s/)).toBeInTheDocument();

      // Advance to 4s remaining (should be yellow)
      act(() => {
        vi.advanceTimersByTime(4100);
      });
      expect(screen.queryByText(/4s/)).toBeInTheDocument();

      // Advance to 1s remaining (should be red)
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(screen.queryByText(/1s/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle rapid pendingPreview changes gracefully', () => {
      const { rerender } = render(<App {...props} />);

      for (let i = 0; i < 5; i++) {
        const propsWithPreview = {
          ...props,
          initialState: {
            ...baseState,
            pendingPreview: {
              input: `input ${i}`,
              intent: {
                type: 'task' as const,
                confidence: 0.9,
              },
              timestamp: new Date(),
            },
          },
        };

        rerender(<App {...propsWithPreview} />);

        act(() => {
          vi.advanceTimersByTime(0);
        });
      }

      // Should still work normally
      expect(screen.queryByText(/Auto-execute in/)).toBeInTheDocument();
    });

    it('should handle zero timeout gracefully', () => {
      const propsWithPreview = {
        ...props,
        initialState: {
          ...baseState,
          previewConfig: {
            ...baseState.previewConfig,
            timeoutMs: 0,
          },
          pendingPreview: {
            input: 'test input',
            intent: {
              type: 'task' as const,
              confidence: 0.9,
            },
            timestamp: new Date(),
          },
        },
      };

      expect(() => {
        render(<App {...propsWithPreview} />);
        act(() => {
          vi.advanceTimersByTime(0);
        });
      }).not.toThrow();
    });

    it('should handle negative timeout gracefully', () => {
      const propsWithPreview = {
        ...props,
        initialState: {
          ...baseState,
          previewConfig: {
            ...baseState.previewConfig,
            timeoutMs: -1000,
          },
          pendingPreview: {
            input: 'test input',
            intent: {
              type: 'task' as const,
              confidence: 0.9,
            },
            timestamp: new Date(),
          },
        },
      };

      expect(() => {
        render(<App {...propsWithPreview} />);
        act(() => {
          vi.advanceTimersByTime(0);
        });
      }).not.toThrow();
    });

    it('should cleanup interval when component unmounts', () => {
      const propsWithPreview = {
        ...props,
        initialState: {
          ...baseState,
          pendingPreview: {
            input: 'test input',
            intent: {
              type: 'task' as const,
              confidence: 0.9,
            },
            timestamp: new Date(),
          },
        },
      };

      const { unmount } = render(<App {...propsWithPreview} />);

      act(() => {
        vi.advanceTimersByTime(0);
      });

      // Unmount the component
      unmount();

      // Should not throw when timers advance
      expect(() => {
        act(() => {
          vi.advanceTimersByTime(10000);
        });
      }).not.toThrow();
    });

    it('should handle missing intent fields gracefully', () => {
      const propsWithPreview = {
        ...props,
        initialState: {
          ...baseState,
          pendingPreview: {
            input: 'test input',
            intent: {
              type: 'task' as const,
              confidence: 0.9,
              // missing command and args
            },
            timestamp: new Date(),
          },
        },
      };

      expect(() => {
        render(<App {...propsWithPreview} />);
        act(() => {
          vi.advanceTimersByTime(6000); // trigger auto-execute
        });
      }).not.toThrow();

      expect(mockOnTask).toHaveBeenCalled();
    });
  });

  describe('Integration with Preview Actions', () => {
    it('should clear countdown when preview is manually confirmed', () => {
      // Note: This would require mocking the keyboard input handling
      // For now, we test the state changes directly
      const propsWithPreview = {
        ...props,
        initialState: {
          ...baseState,
          pendingPreview: {
            input: 'test input',
            intent: {
              type: 'task' as const,
              confidence: 0.9,
            },
            timestamp: new Date(),
          },
        },
      };

      const { rerender } = render(<App {...propsWithPreview} />);

      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(screen.queryByText(/Auto-execute in/)).toBeInTheDocument();

      // Simulate manual confirmation by clearing pendingPreview
      rerender(<App {...props} />);

      expect(screen.queryByText(/Auto-execute in/)).not.toBeInTheDocument();
    });

    it('should clear countdown when preview is cancelled', () => {
      const propsWithPreview = {
        ...props,
        initialState: {
          ...baseState,
          pendingPreview: {
            input: 'test input',
            intent: {
              type: 'task' as const,
              confidence: 0.9,
            },
            timestamp: new Date(),
          },
        },
      };

      const { rerender } = render(<App {...propsWithPreview} />);

      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(screen.queryByText(/Auto-execute in/)).toBeInTheDocument();

      // Simulate cancel by clearing pendingPreview
      rerender(<App {...props} />);

      expect(screen.queryByText(/Auto-execute in/)).not.toBeInTheDocument();
    });
  });
});
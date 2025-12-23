import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveConfig } from '@apexcli/core';

// Mock the saveConfig function from @apexcli/core
vi.mock('@apexcli/core', () => ({
  saveConfig: vi.fn(),
}));

const mockSaveConfig = vi.mocked(saveConfig);

// Mock application context
interface PreviewConfig {
  confidenceThreshold: number;
  autoExecuteHighConfidence: boolean;
  timeoutMs: number;
}

interface AppState {
  previewMode: boolean;
  previewConfig: PreviewConfig;
  pendingPreview?: unknown;
}

interface AppContext {
  config?: {
    ui?: {
      previewMode?: boolean;
      previewConfidence?: number;
      autoExecuteHighConfidence?: boolean;
      previewTimeout?: number;
    };
  };
  initialized: boolean;
  cwd: string;
  app?: {
    getState: () => AppState;
    updateState: (updates: Partial<AppState>) => void;
    addMessage: (message: { type: string; content: string }) => void;
  };
}

let mockCtx: AppContext;
let mockAppState: AppState;

const createMockApp = () => ({
  getState: () => mockAppState,
  updateState: vi.fn((updates: Partial<AppState>) => {
    mockAppState = { ...mockAppState, ...updates };
  }),
  addMessage: vi.fn(),
});

// Simulate the persistPreviewConfig function from repl.tsx
async function persistPreviewConfig(previewConfig: PreviewConfig): Promise<void> {
  if (!mockCtx.config || !mockCtx.initialized) return;

  // Update config object with current state
  mockCtx.config.ui = {
    ...mockCtx.config.ui,
    previewMode: mockCtx.app?.getState()?.previewMode ?? mockCtx.config.ui?.previewMode ?? true,
    previewConfidence: previewConfig.confidenceThreshold,
    autoExecuteHighConfidence: previewConfig.autoExecuteHighConfidence,
    previewTimeout: previewConfig.timeoutMs,
  };

  // Persist to file
  try {
    await mockSaveConfig(mockCtx.cwd, mockCtx.config);
  } catch (error) {
    mockCtx.app?.addMessage({
      type: 'error',
      content: `Failed to persist config: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

// Simulate the preview command handler for 'settings' functionality
async function simulateHandlePreview(args: string[]): Promise<void> {
  const action = args[0]?.toLowerCase();
  const value = args[1];
  const currentState = mockCtx.app?.getState();

  switch (action) {
    case 'on':
      mockCtx.app?.updateState({ previewMode: true, pendingPreview: undefined });
      mockCtx.app?.addMessage({
        type: 'system',
        content: 'Preview mode enabled. You will see a preview before each execution.',
      });
      if (currentState?.previewConfig) {
        await persistPreviewConfig(currentState.previewConfig);
      }
      break;

    case 'off':
      mockCtx.app?.updateState({ previewMode: false, pendingPreview: undefined });
      mockCtx.app?.addMessage({
        type: 'system',
        content: 'Preview mode disabled.',
      });
      if (currentState?.previewConfig) {
        await persistPreviewConfig(currentState.previewConfig);
      }
      break;

    case 'confidence':
      if (value !== undefined) {
        const parsed = parseFloat(value);
        if (isNaN(parsed)) {
          mockCtx.app?.addMessage({
            type: 'error',
            content: 'Confidence must be a number between 0-1 (e.g., 0.7) or 0-100 (e.g., 70).',
          });
        } else {
          // Auto-detect range: 0-1 vs 0-100
          const threshold = parsed > 1 ? parsed / 100 : parsed;

          if (threshold < 0 || threshold > 1) {
            mockCtx.app?.addMessage({
              type: 'error',
              content: 'Confidence threshold must be between 0-1 (or 0-100).',
            });
          } else {
            const newConfig = {
              ...currentState?.previewConfig!,
              confidenceThreshold: threshold,
            };
            mockCtx.app?.updateState({ previewConfig: newConfig });
            await persistPreviewConfig(newConfig);
            mockCtx.app?.addMessage({
              type: 'system',
              content: `Preview confidence threshold set to ${(threshold * 100).toFixed(0)}%.`,
            });
          }
        }
      }
      break;

    case 'timeout':
      if (value !== undefined) {
        const timeout = parseInt(value, 10);
        if (isNaN(timeout) || timeout < 1) {
          mockCtx.app?.addMessage({
            type: 'error',
            content: 'Timeout must be a positive number (in seconds).',
          });
        } else {
          const newConfig = {
            ...currentState?.previewConfig!,
            timeoutMs: timeout * 1000,
          };
          mockCtx.app?.updateState({ previewConfig: newConfig });
          await persistPreviewConfig(newConfig);
          mockCtx.app?.addMessage({
            type: 'system',
            content: `Preview timeout set to ${timeout}s.`,
          });
        }
      }
      break;

    case 'auto':
      if (value === 'on' || value === 'true') {
        const newConfig = {
          ...currentState?.previewConfig!,
          autoExecuteHighConfidence: true,
        };
        mockCtx.app?.updateState({ previewConfig: newConfig });
        await persistPreviewConfig(newConfig);
        mockCtx.app?.addMessage({
          type: 'system',
          content: 'Auto-execute for high confidence inputs enabled.',
        });
      } else if (value === 'off' || value === 'false') {
        const newConfig = {
          ...currentState?.previewConfig!,
          autoExecuteHighConfidence: false,
        };
        mockCtx.app?.updateState({ previewConfig: newConfig });
        await persistPreviewConfig(newConfig);
        mockCtx.app?.addMessage({
          type: 'system',
          content: 'Auto-execute for high confidence inputs disabled.',
        });
      }
      break;

    case 'status':
    case 'settings':  // Test the new alias
      const config = currentState?.previewConfig;
      mockCtx.app?.addMessage({
        type: 'assistant',
        content: `Preview Settings:
• Mode: ${currentState?.previewMode ? 'enabled' : 'disabled'}
• Confidence threshold: ${(config?.confidenceThreshold! * 100).toFixed(0)}%
• Auto-execute high confidence: ${config?.autoExecuteHighConfidence ? 'enabled' : 'disabled'}
• Timeout: ${config?.timeoutMs! / 1000}s`,
      });
      break;
  }
}

describe('Preview Config Persistence Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAppState = {
      previewMode: false,
      previewConfig: {
        confidenceThreshold: 0.9,
        autoExecuteHighConfidence: false,
        timeoutMs: 10000,
      },
    };

    mockCtx = {
      config: {
        ui: {
          previewMode: false,
          previewConfidence: 0.9,
          autoExecuteHighConfidence: false,
          previewTimeout: 10000,
        },
      },
      initialized: true,
      cwd: '/test/project',
      app: createMockApp(),
    };

    mockSaveConfig.mockResolvedValue(undefined);
  });

  describe('persistPreviewConfig function', () => {
    it('should persist preview configuration to config file', async () => {
      const testConfig = {
        confidenceThreshold: 0.8,
        autoExecuteHighConfidence: true,
        timeoutMs: 5000,
      };

      await persistPreviewConfig(testConfig);

      expect(mockSaveConfig).toHaveBeenCalledWith(
        '/test/project',
        {
          ui: {
            previewMode: false,
            previewConfidence: 0.8,
            autoExecuteHighConfidence: true,
            previewTimeout: 5000,
          },
        }
      );
    });

    it('should include current preview mode state when persisting', async () => {
      mockAppState.previewMode = true;

      const testConfig = {
        confidenceThreshold: 0.7,
        autoExecuteHighConfidence: false,
        timeoutMs: 15000,
      };

      await persistPreviewConfig(testConfig);

      expect(mockSaveConfig).toHaveBeenCalledWith(
        '/test/project',
        {
          ui: {
            previewMode: true, // Should reflect current app state
            previewConfidence: 0.7,
            autoExecuteHighConfidence: false,
            previewTimeout: 15000,
          },
        }
      );
    });

    it('should preserve existing config properties when updating', async () => {
      mockCtx.config = {
        ui: {
          previewMode: true,
          previewConfidence: 0.5,
          autoExecuteHighConfidence: true,
          previewTimeout: 8000,
          someOtherProperty: 'preserved',
        } as any,
      };

      const testConfig = {
        confidenceThreshold: 0.6,
        autoExecuteHighConfidence: false,
        timeoutMs: 12000,
      };

      await persistPreviewConfig(testConfig);

      expect(mockSaveConfig).toHaveBeenCalledWith(
        '/test/project',
        {
          ui: {
            someOtherProperty: 'preserved',
            previewMode: false, // From app state
            previewConfidence: 0.6,
            autoExecuteHighConfidence: false,
            previewTimeout: 12000,
          },
        }
      );
    });

    it('should not persist when context is not initialized', async () => {
      mockCtx.initialized = false;

      const testConfig = {
        confidenceThreshold: 0.8,
        autoExecuteHighConfidence: true,
        timeoutMs: 5000,
      };

      await persistPreviewConfig(testConfig);

      expect(mockSaveConfig).not.toHaveBeenCalled();
    });

    it('should not persist when config is undefined', async () => {
      mockCtx.config = undefined;

      const testConfig = {
        confidenceThreshold: 0.8,
        autoExecuteHighConfidence: true,
        timeoutMs: 5000,
      };

      await persistPreviewConfig(testConfig);

      expect(mockSaveConfig).not.toHaveBeenCalled();
    });

    it('should handle save errors gracefully', async () => {
      const error = new Error('Disk write failed');
      mockSaveConfig.mockRejectedValue(error);

      const testConfig = {
        confidenceThreshold: 0.8,
        autoExecuteHighConfidence: true,
        timeoutMs: 5000,
      };

      await persistPreviewConfig(testConfig);

      expect(mockCtx.app?.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to persist config: Disk write failed',
      });
    });

    it('should handle unknown save errors', async () => {
      mockSaveConfig.mockRejectedValue('Some unknown error');

      const testConfig = {
        confidenceThreshold: 0.8,
        autoExecuteHighConfidence: true,
        timeoutMs: 5000,
      };

      await persistPreviewConfig(testConfig);

      expect(mockCtx.app?.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to persist config: Unknown error',
      });
    });
  });

  describe('Configuration persistence through commands', () => {
    it('should persist when enabling preview mode', async () => {
      await simulateHandlePreview(['on']);

      expect(mockSaveConfig).toHaveBeenCalledWith(
        '/test/project',
        expect.objectContaining({
          ui: expect.objectContaining({
            previewMode: true,
          }),
        })
      );
    });

    it('should persist when disabling preview mode', async () => {
      mockAppState.previewMode = true;
      await simulateHandlePreview(['off']);

      expect(mockSaveConfig).toHaveBeenCalledWith(
        '/test/project',
        expect.objectContaining({
          ui: expect.objectContaining({
            previewMode: false,
          }),
        })
      );
    });

    it('should persist when setting confidence threshold', async () => {
      await simulateHandlePreview(['confidence', '75']);

      expect(mockSaveConfig).toHaveBeenCalledWith(
        '/test/project',
        expect.objectContaining({
          ui: expect.objectContaining({
            previewConfidence: 0.75,
          }),
        })
      );
    });

    it('should persist when setting timeout', async () => {
      await simulateHandlePreview(['timeout', '30']);

      expect(mockSaveConfig).toHaveBeenCalledWith(
        '/test/project',
        expect.objectContaining({
          ui: expect.objectContaining({
            previewTimeout: 30000,
          }),
        })
      );
    });

    it('should persist when enabling auto-execute', async () => {
      await simulateHandlePreview(['auto', 'on']);

      expect(mockSaveConfig).toHaveBeenCalledWith(
        '/test/project',
        expect.objectContaining({
          ui: expect.objectContaining({
            autoExecuteHighConfidence: true,
          }),
        })
      );
    });

    it('should persist when disabling auto-execute', async () => {
      await simulateHandlePreview(['auto', 'off']);

      expect(mockSaveConfig).toHaveBeenCalledWith(
        '/test/project',
        expect.objectContaining({
          ui: expect.objectContaining({
            autoExecuteHighConfidence: false,
          }),
        })
      );
    });
  });

  describe('Settings alias functionality', () => {
    it('should display settings with /preview settings command', async () => {
      mockAppState = {
        previewMode: true,
        previewConfig: {
          confidenceThreshold: 0.8,
          autoExecuteHighConfidence: true,
          timeoutMs: 15000,
        },
      };

      await simulateHandlePreview(['settings']);

      expect(mockCtx.app?.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: `Preview Settings:
• Mode: enabled
• Confidence threshold: 80%
• Auto-execute high confidence: enabled
• Timeout: 15s`,
      });
    });

    it('should display settings with /preview status command (original)', async () => {
      mockAppState = {
        previewMode: false,
        previewConfig: {
          confidenceThreshold: 0.9,
          autoExecuteHighConfidence: false,
          timeoutMs: 10000,
        },
      };

      await simulateHandlePreview(['status']);

      expect(mockCtx.app?.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: `Preview Settings:
• Mode: disabled
• Confidence threshold: 90%
• Auto-execute high confidence: disabled
• Timeout: 10s`,
      });
    });

    it('should produce identical output for status and settings commands', async () => {
      const testState = {
        previewMode: true,
        previewConfig: {
          confidenceThreshold: 0.7,
          autoExecuteHighConfidence: true,
          timeoutMs: 8000,
        },
      };

      // Test status command
      mockAppState = testState;
      await simulateHandlePreview(['status']);
      const statusMessage = (mockCtx.app?.addMessage as any).mock.calls[0][0];

      // Reset mock and test settings command
      vi.clearAllMocks();
      mockCtx.app = createMockApp();
      mockAppState = testState;
      await simulateHandlePreview(['settings']);
      const settingsMessage = (mockCtx.app?.addMessage as any).mock.calls[0][0];

      expect(statusMessage).toEqual(settingsMessage);
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle confidence range auto-detection correctly', async () => {
      // Test 0-1 range
      await simulateHandlePreview(['confidence', '0.75']);
      expect(mockSaveConfig).toHaveBeenLastCalledWith(
        '/test/project',
        expect.objectContaining({
          ui: expect.objectContaining({ previewConfidence: 0.75 }),
        })
      );

      // Test 0-100 range (auto-converted to 0-1)
      vi.clearAllMocks();
      await simulateHandlePreview(['confidence', '85']);
      expect(mockSaveConfig).toHaveBeenCalledWith(
        '/test/project',
        expect.objectContaining({
          ui: expect.objectContaining({ previewConfidence: 0.85 }),
        })
      );
    });

    it('should persist configuration even when initial config.ui is undefined', async () => {
      mockCtx.config = {}; // No ui property

      const testConfig = {
        confidenceThreshold: 0.6,
        autoExecuteHighConfidence: true,
        timeoutMs: 7000,
      };

      await persistPreviewConfig(testConfig);

      expect(mockSaveConfig).toHaveBeenCalledWith(
        '/test/project',
        {
          ui: {
            previewMode: false,
            previewConfidence: 0.6,
            autoExecuteHighConfidence: true,
            previewTimeout: 7000,
          },
        }
      );
    });

    it('should handle race conditions in persistence calls', async () => {
      const config1 = {
        confidenceThreshold: 0.7,
        autoExecuteHighConfidence: true,
        timeoutMs: 5000,
      };

      const config2 = {
        confidenceThreshold: 0.8,
        autoExecuteHighConfidence: false,
        timeoutMs: 6000,
      };

      // Simulate concurrent persistence calls
      const promise1 = persistPreviewConfig(config1);
      const promise2 = persistPreviewConfig(config2);

      await Promise.all([promise1, promise2]);

      // Should have called saveConfig twice
      expect(mockSaveConfig).toHaveBeenCalledTimes(2);
    });

    it('should fallback to default preview mode when app state is unavailable', async () => {
      mockCtx.app = undefined;
      mockCtx.config!.ui!.previewMode = true; // Fallback value

      const testConfig = {
        confidenceThreshold: 0.8,
        autoExecuteHighConfidence: true,
        timeoutMs: 5000,
      };

      await persistPreviewConfig(testConfig);

      expect(mockSaveConfig).toHaveBeenCalledWith(
        '/test/project',
        expect.objectContaining({
          ui: expect.objectContaining({
            previewMode: true, // Should use fallback
          }),
        })
      );
    });
  });
});
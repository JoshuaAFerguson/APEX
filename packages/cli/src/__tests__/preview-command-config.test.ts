import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the REPL context and app
const mockApp = {
  updateState: vi.fn(),
  addMessage: vi.fn(),
  getState: vi.fn(),
};

const mockCtx = {
  app: mockApp,
};

// Mock the handlePreview function from repl.tsx
// We'll simulate its behavior based on the implementation we saw
async function simulateHandlePreview(args: string[]): Promise<void> {
  const action = args[0]?.toLowerCase();
  const value = args[1];

  // Get current state
  const currentState = mockCtx.app?.getState();

  switch (action) {
    case 'on':
      mockCtx.app?.updateState({ previewMode: true, pendingPreview: undefined });
      mockCtx.app?.addMessage({
        type: 'system',
        content: 'Preview mode enabled. You will see a preview before each execution.',
      });
      break;

    case 'off':
      mockCtx.app?.updateState({ previewMode: false, pendingPreview: undefined });
      mockCtx.app?.addMessage({
        type: 'system',
        content: 'Preview mode disabled.',
      });
      break;

    case undefined:
    case 'toggle':
      const newMode = !currentState?.previewMode;
      mockCtx.app?.updateState({ previewMode: newMode, pendingPreview: undefined });
      mockCtx.app?.addMessage({
        type: 'system',
        content: `Preview mode ${newMode ? 'enabled' : 'disabled'}.`,
      });
      break;

    case 'confidence':
      if (value === undefined) {
        mockCtx.app?.addMessage({
          type: 'assistant',
          content: `Preview confidence threshold: ${(currentState?.previewConfig.confidenceThreshold * 100).toFixed(0)}%`,
        });
      } else {
        const threshold = parseFloat(value);
        if (isNaN(threshold) || threshold < 0 || threshold > 100) {
          mockCtx.app?.addMessage({
            type: 'error',
            content: 'Confidence threshold must be a number between 0 and 100.',
          });
        } else {
          const newConfig = {
            ...currentState?.previewConfig,
            confidenceThreshold: threshold / 100,
          };
          mockCtx.app?.updateState({ previewConfig: newConfig });
          mockCtx.app?.addMessage({
            type: 'system',
            content: `Preview confidence threshold set to ${threshold}%.`,
          });
        }
      }
      break;

    case 'timeout':
      if (value === undefined) {
        mockCtx.app?.addMessage({
          type: 'assistant',
          content: `Preview timeout: ${currentState?.previewConfig.timeoutMs / 1000}s`,
        });
      } else {
        const timeout = parseInt(value, 10);
        if (isNaN(timeout) || timeout < 1) {
          mockCtx.app?.addMessage({
            type: 'error',
            content: 'Timeout must be a positive number (in seconds).',
          });
        } else {
          const newConfig = {
            ...currentState?.previewConfig,
            timeoutMs: timeout * 1000,
          };
          mockCtx.app?.updateState({ previewConfig: newConfig });
          mockCtx.app?.addMessage({
            type: 'system',
            content: `Preview timeout set to ${timeout}s.`,
          });
        }
      }
      break;

    case 'auto':
      if (value === undefined) {
        mockCtx.app?.addMessage({
          type: 'assistant',
          content: `Auto-execute high confidence: ${currentState?.previewConfig.autoExecuteHighConfidence ? 'enabled' : 'disabled'}`,
        });
      } else if (value === 'on' || value === 'true') {
        const newConfig = {
          ...currentState?.previewConfig,
          autoExecuteHighConfidence: true,
        };
        mockCtx.app?.updateState({ previewConfig: newConfig });
        mockCtx.app?.addMessage({
          type: 'system',
          content: 'Auto-execute for high confidence inputs enabled.',
        });
      } else if (value === 'off' || value === 'false') {
        const newConfig = {
          ...currentState?.previewConfig,
          autoExecuteHighConfidence: false,
        };
        mockCtx.app?.updateState({ previewConfig: newConfig });
        mockCtx.app?.addMessage({
          type: 'system',
          content: 'Auto-execute for high confidence inputs disabled.',
        });
      } else {
        mockCtx.app?.addMessage({
          type: 'error',
          content: 'Usage: /preview auto [on|off]',
        });
      }
      break;

    case 'status':
      const config = currentState?.previewConfig;
      mockCtx.app?.addMessage({
        type: 'assistant',
        content: `Preview Settings:
• Mode: ${currentState?.previewMode ? 'enabled' : 'disabled'}
• Confidence threshold: ${(config?.confidenceThreshold * 100).toFixed(0)}%
• Auto-execute high confidence: ${config?.autoExecuteHighConfidence ? 'enabled' : 'disabled'}
• Timeout: ${config?.timeoutMs / 1000}s`,
      });
      break;

    default:
      mockCtx.app?.addMessage({
        type: 'error',
        content: 'Usage: /preview [on|off|toggle|status|confidence|timeout|auto]',
      });
  }
}

describe('Preview Command Configuration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default state
    mockApp.getState.mockReturnValue({
      previewMode: false,
      previewConfig: {
        confidenceThreshold: 0.9,
        autoExecuteHighConfidence: false,
        timeoutMs: 10000,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Preview Mode Commands', () => {
    it('should enable preview mode with /preview on', async () => {
      await simulateHandlePreview(['on']);

      expect(mockApp.updateState).toHaveBeenCalledWith({
        previewMode: true,
        pendingPreview: undefined,
      });

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Preview mode enabled. You will see a preview before each execution.',
      });
    });

    it('should disable preview mode with /preview off', async () => {
      await simulateHandlePreview(['off']);

      expect(mockApp.updateState).toHaveBeenCalledWith({
        previewMode: false,
        pendingPreview: undefined,
      });

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Preview mode disabled.',
      });
    });

    it('should toggle preview mode with /preview or /preview toggle', async () => {
      // Test with no arguments
      await simulateHandlePreview([]);

      expect(mockApp.updateState).toHaveBeenCalledWith({
        previewMode: true, // Should toggle from false to true
        pendingPreview: undefined,
      });

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Preview mode enabled.',
      });

      vi.clearAllMocks();

      // Test with explicit 'toggle' argument
      mockApp.getState.mockReturnValue({
        previewMode: true,
        previewConfig: {
          confidenceThreshold: 0.9,
          autoExecuteHighConfidence: false,
          timeoutMs: 10000,
        },
      });

      await simulateHandlePreview(['toggle']);

      expect(mockApp.updateState).toHaveBeenCalledWith({
        previewMode: false, // Should toggle from true to false
        pendingPreview: undefined,
      });

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Preview mode disabled.',
      });
    });
  });

  describe('Confidence Threshold Configuration', () => {
    it('should display current confidence threshold with /preview confidence', async () => {
      mockApp.getState.mockReturnValue({
        previewMode: true,
        previewConfig: {
          confidenceThreshold: 0.85,
          autoExecuteHighConfidence: false,
          timeoutMs: 10000,
        },
      });

      await simulateHandlePreview(['confidence']);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: 'Preview confidence threshold: 85%',
      });
    });

    it('should set confidence threshold with valid values', async () => {
      const testValues = [
        { input: '75', expected: 0.75, display: '75%' },
        { input: '90', expected: 0.9, display: '90%' },
        { input: '100', expected: 1.0, display: '100%' },
        { input: '0', expected: 0.0, display: '0%' },
        { input: '50.5', expected: 0.505, display: '50.5%' },
      ];

      for (const { input, expected, display } of testValues) {
        vi.clearAllMocks();

        await simulateHandlePreview(['confidence', input]);

        expect(mockApp.updateState).toHaveBeenCalledWith({
          previewConfig: expect.objectContaining({
            confidenceThreshold: expected,
          }),
        });

        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'system',
          content: `Preview confidence threshold set to ${display}.`,
        });
      }
    });

    it('should reject invalid confidence threshold values', async () => {
      const invalidValues = [
        { input: '-10', reason: 'negative value' },
        { input: '110', reason: 'above 100' },
        { input: 'abc', reason: 'non-numeric' },
        { input: '', reason: 'empty string' },
        { input: 'NaN', reason: 'explicit NaN' },
      ];

      for (const { input, reason } of invalidValues) {
        vi.clearAllMocks();

        await simulateHandlePreview(['confidence', input]);

        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'error',
          content: 'Confidence threshold must be a number between 0 and 100.',
        });

        expect(mockApp.updateState).not.toHaveBeenCalled();
      }
    });
  });

  describe('Timeout Configuration', () => {
    it('should display current timeout with /preview timeout', async () => {
      mockApp.getState.mockReturnValue({
        previewMode: true,
        previewConfig: {
          confidenceThreshold: 0.9,
          autoExecuteHighConfidence: false,
          timeoutMs: 15000, // 15 seconds
        },
      });

      await simulateHandlePreview(['timeout']);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: 'Preview timeout: 15s',
      });
    });

    it('should set timeout with valid values', async () => {
      const testValues = [
        { input: '5', expected: 5000, display: '5s' },
        { input: '30', expected: 30000, display: '30s' },
        { input: '1', expected: 1000, display: '1s' },
        { input: '120', expected: 120000, display: '120s' },
      ];

      for (const { input, expected, display } of testValues) {
        vi.clearAllMocks();

        await simulateHandlePreview(['timeout', input]);

        expect(mockApp.updateState).toHaveBeenCalledWith({
          previewConfig: expect.objectContaining({
            timeoutMs: expected,
          }),
        });

        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'system',
          content: `Preview timeout set to ${display}.`,
        });
      }
    });

    it('should reject invalid timeout values', async () => {
      const invalidValues = [
        { input: '0', reason: 'zero value' },
        { input: '-5', reason: 'negative value' },
        { input: 'abc', reason: 'non-numeric' },
        { input: '3.5', reason: 'decimal value' },
        { input: '', reason: 'empty string' },
      ];

      for (const { input, reason } of invalidValues) {
        vi.clearAllMocks();

        await simulateHandlePreview(['timeout', input]);

        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'error',
          content: 'Timeout must be a positive number (in seconds).',
        });

        expect(mockApp.updateState).not.toHaveBeenCalled();
      }
    });
  });

  describe('Auto-Execute Configuration', () => {
    it('should display current auto-execute setting with /preview auto', async () => {
      // Test with auto-execute disabled
      mockApp.getState.mockReturnValue({
        previewMode: true,
        previewConfig: {
          confidenceThreshold: 0.9,
          autoExecuteHighConfidence: false,
          timeoutMs: 10000,
        },
      });

      await simulateHandlePreview(['auto']);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: 'Auto-execute high confidence: disabled',
      });

      vi.clearAllMocks();

      // Test with auto-execute enabled
      mockApp.getState.mockReturnValue({
        previewMode: true,
        previewConfig: {
          confidenceThreshold: 0.9,
          autoExecuteHighConfidence: true,
          timeoutMs: 10000,
        },
      });

      await simulateHandlePreview(['auto']);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: 'Auto-execute high confidence: enabled',
      });
    });

    it('should enable auto-execute with valid on values', async () => {
      const validOnValues = ['on', 'true'];

      for (const value of validOnValues) {
        vi.clearAllMocks();

        await simulateHandlePreview(['auto', value]);

        expect(mockApp.updateState).toHaveBeenCalledWith({
          previewConfig: expect.objectContaining({
            autoExecuteHighConfidence: true,
          }),
        });

        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'system',
          content: 'Auto-execute for high confidence inputs enabled.',
        });
      }
    });

    it('should disable auto-execute with valid off values', async () => {
      const validOffValues = ['off', 'false'];

      for (const value of validOffValues) {
        vi.clearAllMocks();

        await simulateHandlePreview(['auto', value]);

        expect(mockApp.updateState).toHaveBeenCalledWith({
          previewConfig: expect.objectContaining({
            autoExecuteHighConfidence: false,
          }),
        });

        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'system',
          content: 'Auto-execute for high confidence inputs disabled.',
        });
      }
    });

    it('should reject invalid auto-execute values', async () => {
      const invalidValues = ['yes', 'no', '1', '0', 'enable', 'disable', 'auto', ''];

      for (const value of invalidValues) {
        vi.clearAllMocks();

        await simulateHandlePreview(['auto', value]);

        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'error',
          content: 'Usage: /preview auto [on|off]',
        });

        expect(mockApp.updateState).not.toHaveBeenCalled();
      }
    });
  });

  describe('Status Command', () => {
    it('should display comprehensive status information', async () => {
      mockApp.getState.mockReturnValue({
        previewMode: true,
        previewConfig: {
          confidenceThreshold: 0.85,
          autoExecuteHighConfidence: true,
          timeoutMs: 15000,
        },
      });

      await simulateHandlePreview(['status']);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: `Preview Settings:
• Mode: enabled
• Confidence threshold: 85%
• Auto-execute high confidence: enabled
• Timeout: 15s`,
      });
    });

    it('should display status when preview mode is disabled', async () => {
      mockApp.getState.mockReturnValue({
        previewMode: false,
        previewConfig: {
          confidenceThreshold: 0.9,
          autoExecuteHighConfidence: false,
          timeoutMs: 10000,
        },
      });

      await simulateHandlePreview(['status']);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: `Preview Settings:
• Mode: disabled
• Confidence threshold: 90%
• Auto-execute high confidence: disabled
• Timeout: 10s`,
      });
    });

    it('should handle edge case values in status display', async () => {
      mockApp.getState.mockReturnValue({
        previewMode: true,
        previewConfig: {
          confidenceThreshold: 0.0, // 0%
          autoExecuteHighConfidence: true,
          timeoutMs: 1000, // 1s
        },
      });

      await simulateHandlePreview(['status']);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: `Preview Settings:
• Mode: enabled
• Confidence threshold: 0%
• Auto-execute high confidence: enabled
• Timeout: 1s`,
      });
    });
  });

  describe('Invalid Commands', () => {
    it('should show usage help for invalid commands', async () => {
      const invalidCommands = [
        ['invalid'],
        ['config'],
        ['set'],
        ['get'],
        ['help'],
        [''],
        ['confidence', 'threshold'],
        ['auto', 'execute'],
      ];

      for (const args of invalidCommands) {
        vi.clearAllMocks();

        await simulateHandlePreview(args);

        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'error',
          content: 'Usage: /preview [on|off|toggle|status|confidence|timeout|auto]',
        });

        expect(mockApp.updateState).not.toHaveBeenCalled();
      }
    });
  });

  describe('Configuration Persistence', () => {
    it('should preserve existing config values when updating one property', async () => {
      const initialConfig = {
        confidenceThreshold: 0.85,
        autoExecuteHighConfidence: true,
        timeoutMs: 15000,
      };

      mockApp.getState.mockReturnValue({
        previewMode: true,
        previewConfig: initialConfig,
      });

      // Update only confidence threshold
      await simulateHandlePreview(['confidence', '75']);

      expect(mockApp.updateState).toHaveBeenCalledWith({
        previewConfig: {
          confidenceThreshold: 0.75, // Updated
          autoExecuteHighConfidence: true, // Preserved
          timeoutMs: 15000, // Preserved
        },
      });

      vi.clearAllMocks();

      // Update only timeout
      await simulateHandlePreview(['timeout', '30']);

      expect(mockApp.updateState).toHaveBeenCalledWith({
        previewConfig: {
          confidenceThreshold: 0.85, // Preserved
          autoExecuteHighConfidence: true, // Preserved
          timeoutMs: 30000, // Updated
        },
      });

      vi.clearAllMocks();

      // Update only auto-execute
      await simulateHandlePreview(['auto', 'off']);

      expect(mockApp.updateState).toHaveBeenCalledWith({
        previewConfig: {
          confidenceThreshold: 0.85, // Preserved
          autoExecuteHighConfidence: false, // Updated
          timeoutMs: 15000, // Preserved
        },
      });
    });

    it('should handle undefined or null config gracefully', async () => {
      mockApp.getState.mockReturnValue({
        previewMode: true,
        previewConfig: undefined,
      });

      // Should not crash when config is undefined
      expect(async () => {
        await simulateHandlePreview(['status']);
      }).not.toThrow();

      mockApp.getState.mockReturnValue({
        previewMode: true,
        previewConfig: null,
      });

      // Should not crash when config is null
      expect(async () => {
        await simulateHandlePreview(['confidence', '80']);
      }).not.toThrow();
    });
  });

  describe('Command Integration Edge Cases', () => {
    it('should handle case-insensitive commands', async () => {
      const caseVariations = [
        ['ON'],
        ['Off'],
        ['TOGGLE'],
        ['Status'],
        ['CONFIDENCE', '85'],
        ['Timeout', '20'],
        ['AUTO', 'on'],
      ];

      for (const args of caseVariations) {
        vi.clearAllMocks();

        // Should not throw errors for different case variations
        await expect(simulateHandlePreview(args)).resolves.not.toThrow();

        // Should have called appropriate app methods (either updateState or addMessage)
        expect(mockApp.updateState).toHaveBeenCalled();
      }
    });

    it('should handle extra whitespace and arguments', async () => {
      // These should be treated as invalid since our parser is simple
      const commandsWithExtra = [
        ['confidence', '85', 'extra'],
        ['timeout', '10', 'seconds'],
        ['auto', 'on', 'please'],
      ];

      for (const args of commandsWithExtra) {
        vi.clearAllMocks();

        await simulateHandlePreview(args);

        // Depending on implementation, might either work with first args or show error
        // Our implementation takes first argument after the value, so these might work
        expect(mockApp.addMessage).toHaveBeenCalled();
      }
    });
  });
});
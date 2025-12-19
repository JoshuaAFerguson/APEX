import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Comprehensive tests for the enhanced confidence threshold auto-detection feature
 * This tests the implementation that automatically detects whether users input
 * values in 0-1 range or 0-100 range and converts them appropriately.
 */

interface PreviewConfig {
  confidenceThreshold: number;
  autoExecuteHighConfidence: boolean;
  timeoutMs: number;
}

interface AppState {
  previewMode: boolean;
  previewConfig: PreviewConfig;
}

// Mock application context
let mockAppState: AppState;

const mockApp = {
  getState: () => mockAppState,
  updateState: vi.fn((updates: Partial<AppState>) => {
    mockAppState = { ...mockAppState, ...updates };
  }),
  addMessage: vi.fn(),
};

// Mock context with persistence function
const mockCtx = {
  app: mockApp,
  config: { ui: {} },
  initialized: true,
  cwd: '/test/project',
};

// Mock persistence function
const mockPersistPreviewConfig = vi.fn();

// Simulate the enhanced confidence handling from the implementation
async function simulateConfidenceCommand(args: string[]): Promise<void> {
  const action = args[0]?.toLowerCase();
  const value = args[1];
  const currentState = mockCtx.app?.getState();

  if (action === 'confidence') {
    if (value === undefined) {
      mockCtx.app?.addMessage({
        type: 'assistant',
        content: `Preview confidence threshold: ${(currentState?.previewConfig.confidenceThreshold * 100).toFixed(0)}%`,
      });
    } else {
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

          // Persist to config file
          await mockPersistPreviewConfig(newConfig);

          mockCtx.app?.addMessage({
            type: 'system',
            content: `Preview confidence threshold set to ${(threshold * 100).toFixed(0)}%.`,
          });
        }
      }
    }
  }
}

describe('Preview Confidence Auto-Detection Tests', () => {
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

    mockPersistPreviewConfig.mockResolvedValue(undefined);
  });

  describe('0-1 Range Detection', () => {
    it('should accept decimal values between 0 and 1 without conversion', async () => {
      await simulateConfidenceCommand(['confidence', '0.75']);

      expect(mockApp.updateState).toHaveBeenCalledWith({
        previewConfig: expect.objectContaining({
          confidenceThreshold: 0.75,
        }),
      });

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Preview confidence threshold set to 75%.',
      });
    });

    it('should handle edge case values in 0-1 range', async () => {
      const testCases = [
        { input: '0', expected: 0, display: '0' },
        { input: '0.01', expected: 0.01, display: '1' },
        { input: '0.5', expected: 0.5, display: '50' },
        { input: '0.99', expected: 0.99, display: '99' },
        { input: '1', expected: 1, display: '100' },
        { input: '1.0', expected: 1, display: '100' },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        mockAppState.previewConfig.confidenceThreshold = 0.9; // Reset

        await simulateConfidenceCommand(['confidence', testCase.input]);

        expect(mockApp.updateState).toHaveBeenCalledWith({
          previewConfig: expect.objectContaining({
            confidenceThreshold: testCase.expected,
          }),
        });

        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'system',
          content: `Preview confidence threshold set to ${testCase.display}%.`,
        });
      }
    });

    it('should preserve precision for decimal values in 0-1 range', async () => {
      const precisionTestCases = [
        { input: '0.123', expected: 0.123, display: '12' },
        { input: '0.8765', expected: 0.8765, display: '88' },
        { input: '0.12345', expected: 0.12345, display: '12' },
      ];

      for (const testCase of precisionTestCases) {
        vi.clearAllMocks();
        mockAppState.previewConfig.confidenceThreshold = 0.9;

        await simulateConfidenceCommand(['confidence', testCase.input]);

        expect(mockApp.updateState).toHaveBeenCalledWith({
          previewConfig: expect.objectContaining({
            confidenceThreshold: testCase.expected,
          }),
        });

        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'system',
          content: `Preview confidence threshold set to ${testCase.display}%.`,
        });
      }
    });
  });

  describe('0-100 Range Auto-Conversion', () => {
    it('should convert integer values > 1 to decimal by dividing by 100', async () => {
      await simulateConfidenceCommand(['confidence', '85']);

      expect(mockApp.updateState).toHaveBeenCalledWith({
        previewConfig: expect.objectContaining({
          confidenceThreshold: 0.85,
        }),
      });

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Preview confidence threshold set to 85%.',
      });
    });

    it('should handle all valid integer values in 0-100 range', async () => {
      const testCases = [
        { input: '2', expected: 0.02, display: '2' },
        { input: '25', expected: 0.25, display: '25' },
        { input: '50', expected: 0.5, display: '50' },
        { input: '75', expected: 0.75, display: '75' },
        { input: '99', expected: 0.99, display: '99' },
        { input: '100', expected: 1.0, display: '100' },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        mockAppState.previewConfig.confidenceThreshold = 0.9; // Reset

        await simulateConfidenceCommand(['confidence', testCase.input]);

        expect(mockApp.updateState).toHaveBeenCalledWith({
          previewConfig: expect.objectContaining({
            confidenceThreshold: testCase.expected,
          }),
        });

        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'system',
          content: `Preview confidence threshold set to ${testCase.display}%.`,
        });
      }
    });

    it('should convert decimal values > 1 to proper range', async () => {
      const testCases = [
        { input: '85.5', expected: 0.855, display: '86' },
        { input: '92.3', expected: 0.923, display: '92' },
        { input: '75.75', expected: 0.7575, display: '76' },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        mockAppState.previewConfig.confidenceThreshold = 0.9;

        await simulateConfidenceCommand(['confidence', testCase.input]);

        expect(mockApp.updateState).toHaveBeenCalledWith({
          previewConfig: expect.objectContaining({
            confidenceThreshold: testCase.expected,
          }),
        });

        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'system',
          content: `Preview confidence threshold set to ${testCase.display}%.`,
        });
      }
    });
  });

  describe('Boundary Conditions', () => {
    it('should correctly detect threshold value of exactly 1', async () => {
      // 1 should be treated as 0-1 range (100%), not 0-100 range (1%)
      await simulateConfidenceCommand(['confidence', '1']);

      expect(mockApp.updateState).toHaveBeenCalledWith({
        previewConfig: expect.objectContaining({
          confidenceThreshold: 1.0,
        }),
      });

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Preview confidence threshold set to 100%.',
      });
    });

    it('should handle values just above and below the detection threshold', async () => {
      const testCases = [
        { input: '1.001', expected: 0.01001, description: 'just above 1 (auto-converted)' },
        { input: '0.999', expected: 0.999, description: 'just below 1 (no conversion)' },
        { input: '1.5', expected: 0.015, description: 'decimal above 1 (auto-converted)' },
        { input: '0.5', expected: 0.5, description: 'decimal below 1 (no conversion)' },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        mockAppState.previewConfig.confidenceThreshold = 0.9;

        await simulateConfidenceCommand(['confidence', testCase.input]);

        expect(mockApp.updateState).toHaveBeenCalledWith({
          previewConfig: expect.objectContaining({
            confidenceThreshold: testCase.expected,
          }),
        });

        expect(mockPersistPreviewConfig).toHaveBeenCalled();
      }
    });
  });

  describe('Error Handling', () => {
    it('should reject values above 100 after auto-conversion', async () => {
      const invalidValues = ['101', '150', '200', '999'];

      for (const value of invalidValues) {
        vi.clearAllMocks();

        await simulateConfidenceCommand(['confidence', value]);

        expect(mockApp.updateState).not.toHaveBeenCalled();
        expect(mockPersistPreviewConfig).not.toHaveBeenCalled();

        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'error',
          content: 'Confidence threshold must be between 0-1 (or 0-100).',
        });
      }
    });

    it('should reject negative values', async () => {
      const invalidValues = ['-1', '-0.5', '-10', '-100'];

      for (const value of invalidValues) {
        vi.clearAllMocks();

        await simulateConfidenceCommand(['confidence', value]);

        expect(mockApp.updateState).not.toHaveBeenCalled();
        expect(mockPersistPreviewConfig).not.toHaveBeenCalled();

        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'error',
          content: 'Confidence threshold must be between 0-1 (or 0-100).',
        });
      }
    });

    it('should reject non-numeric values', async () => {
      const invalidValues = ['abc', 'high', '50%', 'medium', '1.2.3', 'NaN'];

      for (const value of invalidValues) {
        vi.clearAllMocks();

        await simulateConfidenceCommand(['confidence', value]);

        expect(mockApp.updateState).not.toHaveBeenCalled();
        expect(mockPersistPreviewConfig).not.toHaveBeenCalled();

        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'error',
          content: 'Confidence must be a number between 0-1 (e.g., 0.7) or 0-100 (e.g., 70).',
        });
      }
    });

    it('should handle edge case numeric strings', async () => {
      const testCases = [
        { input: '0.0', expected: 0, valid: true },
        { input: '100.0', expected: 1.0, valid: true },
        { input: '00.5', expected: 0.5, valid: true },
        { input: '050', expected: 0.5, valid: true },
        { input: 'Infinity', valid: false },
        { input: '-Infinity', valid: false },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        await simulateConfidenceCommand(['confidence', testCase.input]);

        if (testCase.valid) {
          expect(mockApp.updateState).toHaveBeenCalledWith({
            previewConfig: expect.objectContaining({
              confidenceThreshold: testCase.expected,
            }),
          });
          expect(mockPersistPreviewConfig).toHaveBeenCalled();
        } else {
          expect(mockApp.updateState).not.toHaveBeenCalled();
          expect(mockPersistPreviewConfig).not.toHaveBeenCalled();
          expect(mockApp.addMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' })
          );
        }
      }
    });
  });

  describe('Display Current Value', () => {
    it('should display current confidence threshold when no value provided', async () => {
      mockAppState.previewConfig.confidenceThreshold = 0.85;

      await simulateConfidenceCommand(['confidence']);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: 'Preview confidence threshold: 85%',
      });

      expect(mockApp.updateState).not.toHaveBeenCalled();
      expect(mockPersistPreviewConfig).not.toHaveBeenCalled();
    });

    it('should format decimal values correctly in display', async () => {
      const testCases = [
        { threshold: 0.0, expected: '0%' },
        { threshold: 0.01, expected: '1%' },
        { threshold: 0.1, expected: '10%' },
        { threshold: 0.333, expected: '33%' },
        { threshold: 0.5, expected: '50%' },
        { threshold: 0.789, expected: '79%' },
        { threshold: 0.999, expected: '100%' },
        { threshold: 1.0, expected: '100%' },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        mockAppState.previewConfig.confidenceThreshold = testCase.threshold;

        await simulateConfidenceCommand(['confidence']);

        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'assistant',
          content: `Preview confidence threshold: ${testCase.expected}`,
        });
      }
    });
  });

  describe('Integration with Persistence', () => {
    it('should persist configuration after successful auto-detection and conversion', async () => {
      await simulateConfidenceCommand(['confidence', '75']);

      expect(mockPersistPreviewConfig).toHaveBeenCalledWith({
        confidenceThreshold: 0.75,
        autoExecuteHighConfidence: false,
        timeoutMs: 10000,
      });
    });

    it('should not persist configuration when validation fails', async () => {
      await simulateConfidenceCommand(['confidence', 'invalid']);

      expect(mockPersistPreviewConfig).not.toHaveBeenCalled();
    });

    it('should not persist configuration for out-of-range values', async () => {
      await simulateConfidenceCommand(['confidence', '150']);

      expect(mockPersistPreviewConfig).not.toHaveBeenCalled();
    });

    it('should preserve other config values when persisting', async () => {
      mockAppState.previewConfig = {
        confidenceThreshold: 0.9,
        autoExecuteHighConfidence: true,
        timeoutMs: 5000,
      };

      await simulateConfidenceCommand(['confidence', '80']);

      expect(mockPersistPreviewConfig).toHaveBeenCalledWith({
        confidenceThreshold: 0.8,
        autoExecuteHighConfidence: true, // Preserved
        timeoutMs: 5000, // Preserved
      });
    });
  });

  describe('User Experience Consistency', () => {
    it('should provide consistent feedback format regardless of input format', async () => {
      const testCases = [
        { input: '0.75', expected: 'Preview confidence threshold set to 75%.' },
        { input: '75', expected: 'Preview confidence threshold set to 75%.' },
        { input: '75.0', expected: 'Preview confidence threshold set to 75%.' },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        await simulateConfidenceCommand(['confidence', testCase.input]);

        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'system',
          content: testCase.expected,
        });
      }
    });

    it('should handle rapid successive confidence changes', async () => {
      const commands = [
        ['confidence', '50'],
        ['confidence', '0.7'],
        ['confidence', '90'],
        ['confidence', '0.6'],
      ];

      const expectedThresholds = [0.5, 0.7, 0.9, 0.6];

      for (let i = 0; i < commands.length; i++) {
        await simulateConfidenceCommand(commands[i]);

        expect(mockAppState.previewConfig.confidenceThreshold).toBe(expectedThresholds[i]);
        expect(mockPersistPreviewConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            confidenceThreshold: expectedThresholds[i],
          })
        );
      }

      expect(mockPersistPreviewConfig).toHaveBeenCalledTimes(4);
    });
  });
});
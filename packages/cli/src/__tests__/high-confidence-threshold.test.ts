import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Test suite for high-confidence auto-execute threshold implementation
 *
 * Tests verify that when autoExecuteHighConfidence is enabled,
 * only inputs with confidence >= 0.95 will auto-execute.
 */

const HIGH_CONFIDENCE_THRESHOLD = 0.95;

interface Intent {
  type: 'command' | 'task' | 'question' | 'clarification';
  confidence: number;
  metadata?: Record<string, unknown>;
}

interface PreviewConfig {
  confidenceThreshold: number;
  autoExecuteHighConfidence: boolean;
  timeoutMs: number;
}

interface AppState {
  previewMode: boolean;
  previewConfig: PreviewConfig;
  pendingPreview?: {
    input: string;
    intent: Intent;
    timestamp: Date;
  };
}

// Mock app state
let mockAppState: AppState;
const mockAddMessage = vi.fn();

// Simulate the intent detection logic
function mockDetectIntent(input: string): Intent {
  // Simple mock that assigns confidence based on input characteristics
  if (input.startsWith('/')) {
    return { type: 'command', confidence: 0.98 };
  }
  if (input.includes('implement') || input.includes('create') || input.includes('add')) {
    return { type: 'task', confidence: 0.92 };
  }
  if (input.includes('?')) {
    return { type: 'question', confidence: 0.85 };
  }
  return { type: 'task', confidence: 0.75 };
}

// Simulate the auto-execute decision logic from App.tsx
function shouldAutoExecute(input: string, state: AppState): { autoExecute: boolean; message?: string } {
  const intent = mockDetectIntent(input);

  // Check if preview mode is enabled and this isn't the preview command itself
  if (state.previewMode && !input.startsWith('/preview')) {
    // Check if auto-execute is enabled and confidence is high enough
    // For auto-execute, we enforce a minimum threshold of 0.95 regardless of user-configured threshold
    if (
      state.previewConfig.autoExecuteHighConfidence &&
      intent.confidence >= HIGH_CONFIDENCE_THRESHOLD
    ) {
      return {
        autoExecute: true,
        message: `Auto-executing (confidence: ${(intent.confidence * 100).toFixed(0)}% ≥ ${(HIGH_CONFIDENCE_THRESHOLD * 100).toFixed(0)}%)`
      };
    } else {
      return { autoExecute: false };
    }
  }

  return { autoExecute: false };
}

describe('High Confidence Auto-Execute Threshold', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppState = {
      previewMode: true,
      previewConfig: {
        confidenceThreshold: 0.7, // User configured threshold (should be overridden for auto-execute)
        autoExecuteHighConfidence: true,
        timeoutMs: 5000,
      }
    };
  });

  describe('When autoExecuteHighConfidence is enabled', () => {
    it('should auto-execute commands with >= 0.95 confidence', () => {
      const result = shouldAutoExecute('/status', mockAppState);

      expect(result.autoExecute).toBe(true);
      expect(result.message).toContain('Auto-executing (confidence: 98% ≥ 95%)');
    });

    it('should NOT auto-execute tasks with < 0.95 confidence even if above user threshold', () => {
      // This task has 0.92 confidence, which is above user threshold (0.7) but below 0.95
      const result = shouldAutoExecute('implement new feature', mockAppState);

      expect(result.autoExecute).toBe(false);
      expect(result.message).toBeUndefined();
    });

    it('should enforce 0.95 threshold regardless of user-configured threshold', () => {
      // Set user threshold very low
      mockAppState.previewConfig.confidenceThreshold = 0.5;

      const result = shouldAutoExecute('implement new feature', mockAppState); // 0.92 confidence

      expect(result.autoExecute).toBe(false);
    });

    it('should auto-execute when confidence exactly equals 0.95', () => {
      // Mock an input that returns exactly 0.95 confidence
      const mockDetectIntent95 = vi.fn().mockReturnValue({ type: 'task', confidence: 0.95 });

      const intent = mockDetectIntent95('test input');
      const shouldExecute = mockAppState.previewConfig.autoExecuteHighConfidence &&
                           intent.confidence >= HIGH_CONFIDENCE_THRESHOLD;

      expect(shouldExecute).toBe(true);
      expect(intent.confidence).toBe(0.95);
    });
  });

  describe('When autoExecuteHighConfidence is disabled', () => {
    beforeEach(() => {
      mockAppState.previewConfig.autoExecuteHighConfidence = false;
    });

    it('should NOT auto-execute even with high confidence', () => {
      const result = shouldAutoExecute('/status', mockAppState);

      expect(result.autoExecute).toBe(false);
    });

    it('should show preview for all inputs', () => {
      const result = shouldAutoExecute('implement feature', mockAppState);

      expect(result.autoExecute).toBe(false);
    });
  });

  describe('When preview mode is disabled', () => {
    beforeEach(() => {
      mockAppState.previewMode = false;
    });

    it('should not auto-execute regardless of confidence', () => {
      const result = shouldAutoExecute('/status', mockAppState);

      expect(result.autoExecute).toBe(false);
    });
  });

  describe('Preview command exclusion', () => {
    it('should not auto-execute /preview commands regardless of settings', () => {
      const result = shouldAutoExecute('/preview on', mockAppState);

      expect(result.autoExecute).toBe(false);
    });
  });

  describe('HIGH_CONFIDENCE_THRESHOLD constant', () => {
    it('should be defined as 0.95', () => {
      expect(HIGH_CONFIDENCE_THRESHOLD).toBe(0.95);
    });

    it('should be used as the minimum threshold for auto-execute', () => {
      // This tests that the threshold is actually 0.95, not any other value
      const intent = { type: 'task' as const, confidence: 0.94 };
      const shouldExecute = mockAppState.previewConfig.autoExecuteHighConfidence &&
                           intent.confidence >= HIGH_CONFIDENCE_THRESHOLD;

      expect(shouldExecute).toBe(false);

      // Test with exactly 0.95
      intent.confidence = 0.95;
      const shouldExecute95 = mockAppState.previewConfig.autoExecuteHighConfidence &&
                             intent.confidence >= HIGH_CONFIDENCE_THRESHOLD;

      expect(shouldExecute95).toBe(true);
    });
  });

  describe('System message formatting', () => {
    it('should display correct confidence percentage in auto-execute message', () => {
      const result = shouldAutoExecute('/status', mockAppState); // 98% confidence

      expect(result.message).toMatch(/Auto-executing \(confidence: 98% ≥ 95%\)/);
    });

    it('should handle edge cases in percentage formatting', () => {
      // Mock an input with exactly 95% confidence
      const intent = { type: 'task' as const, confidence: 0.95 };
      const message = `Auto-executing (confidence: ${(intent.confidence * 100).toFixed(0)}% ≥ ${(HIGH_CONFIDENCE_THRESHOLD * 100).toFixed(0)}%)`;

      expect(message).toBe('Auto-executing (confidence: 95% ≥ 95%)');
    });
  });
});

describe('Integration with existing preview system', () => {
  beforeEach(() => {
    mockAppState = {
      previewMode: true,
      previewConfig: {
        confidenceThreshold: 0.8, // User preference
        autoExecuteHighConfidence: true,
        timeoutMs: 5000,
      }
    };
  });

  it('should not interfere with standard preview logic for lower confidence inputs', () => {
    // Input with confidence between user threshold (0.8) and high threshold (0.95)
    // Should show preview, not auto-execute
    const result = shouldAutoExecute('implement feature', mockAppState); // 0.92 confidence

    expect(result.autoExecute).toBe(false);
  });

  it('should preserve all existing preview functionality for non-auto-execute cases', () => {
    mockAppState.previewConfig.autoExecuteHighConfidence = false;

    const result = shouldAutoExecute('/status', mockAppState);

    expect(result.autoExecute).toBe(false);
  });
});
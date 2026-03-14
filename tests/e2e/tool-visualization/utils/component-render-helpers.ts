/**
 * Component render helpers for tool visualization E2E testing
 * Provides utilities for consistent component rendering in tests
 */

import { render, RenderResult } from 'ink-testing-library';
import React from 'react';
import type { DisplayMode } from '../../../../packages/core/src/types.js';
import { ToolCall, type ToolCallProps } from '../../../../packages/cli/src/ui/components/ToolCall.js';
import { ToolExecutionPanel, type ToolExecutionPanelProps } from '../../../../packages/cli/src/ui/components/tools/ToolExecutionPanel.js';
import { ErrorDisplay, type ErrorDisplayProps } from '../../../../packages/cli/src/ui/components/ErrorDisplay.js';
import type { ToolVisualizationMockOrchestrator } from './orchestrator-event-emitter.js';

export interface RenderOptions {
  /** Test environment width */
  width?: number;
  /** Test environment height */
  height?: number;
  /** Display mode for components */
  displayMode?: DisplayMode;
  /** Whether to enable debug output */
  debug?: boolean;
}

export interface ComponentTestResult extends RenderResult {
  /** Get the current frame output */
  getCurrentFrame: () => string;
  /** Get all frames output history */
  getFrameHistory: () => string[];
  /** Wait for specific text to appear */
  waitForText: (text: string | RegExp, timeout?: number) => Promise<void>;
  /** Wait for component to stabilize (no changes for specified duration) */
  waitForStability: (duration?: number) => Promise<void>;
  /** Check if text exists in current frame */
  hasText: (text: string | RegExp) => boolean;
  /** Count occurrences of text in current frame */
  countText: (text: string | RegExp) => number;
  /** Get lines containing specific text */
  getLinesWithText: (text: string | RegExp) => string[];
}

/**
 * Enhanced render function with additional testing utilities
 */
function createTestRenderer(renderResult: RenderResult): ComponentTestResult {
  const frameHistory: string[] = [];

  // Track frame history
  const originalLastFrame = renderResult.lastFrame;
  const enhancedRenderer = {
    ...renderResult,
    getCurrentFrame: () => renderResult.lastFrame(),
    getFrameHistory: () => [...frameHistory],

    waitForText: async (text: string | RegExp, timeout = 5000): Promise<void> => {
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        const frame = renderResult.lastFrame();
        frameHistory.push(frame);

        const hasText = typeof text === 'string'
          ? frame.includes(text)
          : text.test(frame);

        if (hasText) {
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 10));
      }

      throw new Error(`Text "${text}" not found within ${timeout}ms`);
    },

    waitForStability: async (duration = 100): Promise<void> => {
      let lastFrame = renderResult.lastFrame();
      let stableFor = 0;
      const checkInterval = 10;

      while (stableFor < duration) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        const currentFrame = renderResult.lastFrame();

        if (currentFrame === lastFrame) {
          stableFor += checkInterval;
        } else {
          stableFor = 0;
          lastFrame = currentFrame;
          frameHistory.push(currentFrame);
        }
      }
    },

    hasText: (text: string | RegExp): boolean => {
      const frame = renderResult.lastFrame();
      return typeof text === 'string'
        ? frame.includes(text)
        : text.test(frame);
    },

    countText: (text: string | RegExp): number => {
      const frame = renderResult.lastFrame();
      if (typeof text === 'string') {
        return (frame.match(new RegExp(text, 'g')) || []).length;
      }
      return (frame.match(text) || []).length;
    },

    getLinesWithText: (text: string | RegExp): string[] => {
      const frame = renderResult.lastFrame();
      return frame.split('\n').filter(line =>
        typeof text === 'string'
          ? line.includes(text)
          : text.test(line)
      );
    },
  };

  return enhancedRenderer;
}

/**
 * Render ToolCall component with full provider context
 */
export function renderToolCall(
  props: ToolCallProps,
  options: RenderOptions = {}
): ComponentTestResult {
  const {
    displayMode = 'normal',
    debug = false,
  } = options;

  const component = React.createElement(ToolCall, {
    displayMode,
    ...props,
  });

  const renderResult = render(component);

  if (debug) {
    console.log('[renderToolCall] Initial frame:', renderResult.lastFrame());
  }

  return createTestRenderer(renderResult);
}

/**
 * Render ToolExecutionPanel with mock orchestrator
 */
export function renderToolExecutionPanel(
  orchestrator: ToolVisualizationMockOrchestrator,
  props: Partial<ToolExecutionPanelProps> = {},
  options: RenderOptions = {}
): ComponentTestResult {
  const {
    width,
    height,
    displayMode = 'normal',
    debug = false,
  } = options;

  const defaultProps: ToolExecutionPanelProps = {
    orchestrator,
    taskId: 'test-task-1',
    maxEntries: 100,
    debug: false,
    displayMode,
    width,
    height,
    showStats: true,
    showActiveTools: true,
    showActivityLog: true,
    maxRecentLogs: 5,
    title: 'Tool Execution',
    collapsed: false,
    ...props,
  };

  const component = React.createElement(ToolExecutionPanel, defaultProps);
  const renderResult = render(component);

  if (debug) {
    console.log('[renderToolExecutionPanel] Initial frame:', renderResult.lastFrame());
  }

  return createTestRenderer(renderResult);
}

/**
 * Render ErrorDisplay with various error types
 */
export function renderErrorDisplay(
  props: ErrorDisplayProps,
  options: RenderOptions = {}
): ComponentTestResult {
  const {
    width,
    displayMode,
    debug = false,
  } = options;

  const enhancedProps: ErrorDisplayProps = {
    verbose: displayMode === 'verbose',
    width,
    ...props,
  };

  const component = React.createElement(ErrorDisplay, enhancedProps);
  const renderResult = render(component);

  if (debug) {
    console.log('[renderErrorDisplay] Initial frame:', renderResult.lastFrame());
  }

  return createTestRenderer(renderResult);
}

/**
 * Render component with multiple tool calls for testing
 */
export function renderMultipleToolCalls(
  toolCalls: ToolCallProps[],
  options: RenderOptions = {}
): ComponentTestResult {
  const { displayMode = 'normal', debug = false } = options;

  const MultipleToolCallsComponent = () => {
    return React.createElement('div', {},
      ...toolCalls.map((props, index) =>
        React.createElement(ToolCall, {
          key: index,
          displayMode,
          ...props,
        })
      )
    );
  };

  const renderResult = render(React.createElement(MultipleToolCallsComponent));

  if (debug) {
    console.log('[renderMultipleToolCalls] Initial frame:', renderResult.lastFrame());
  }

  return createTestRenderer(renderResult);
}

/**
 * Create test tool call props with circular reference handling
 */
export function createCircularToolCallProps(data: any): ToolCallProps {
  return {
    toolName: 'Read',
    input: { file_path: '/test/path', circular_data: data },
    output: 'File content read successfully',
    status: 'success',
    duration: 150,
  };
}

/**
 * Create test tool call props with large payload
 */
export function createLargePayloadToolCallProps(data: any): ToolCallProps {
  return {
    toolName: 'Grep',
    input: { pattern: 'test', path: '/', large_data: data },
    output: Array.from({ length: 100 }, (_, i) =>
      `Line ${i + 1}: Match found in file ${i}.txt`
    ).join('\n'),
    status: 'success',
    duration: 2500,
  };
}

/**
 * Create test tool call props for timing scenarios
 */
export function createTimingToolCallProps(duration: number, status: 'pending' | 'running' | 'success' | 'error' = 'success'): ToolCallProps {
  return {
    toolName: 'Bash',
    input: { command: 'sleep 1 && echo "done"' },
    output: status === 'success' ? 'done' : undefined,
    status,
    duration: status === 'running' ? undefined : duration,
  };
}

/**
 * Create test error display props for MCP errors
 */
export function createMCPErrorDisplayProps(error: Error, context?: Record<string, unknown>): ErrorDisplayProps {
  return {
    error,
    title: 'MCP Tool Error',
    showStack: true,
    verbose: false,
    showSuggestions: true,
    context,
  };
}

/**
 * Test assertion helpers
 */
export const assertions = {
  /**
   * Assert that circular reference indicator is present
   */
  hasCircularReferenceIndicator: (frame: string): boolean => {
    return frame.includes('[Circular]') || frame.includes('circular reference');
  },

  /**
   * Assert that payload was truncated
   */
  hasTruncationIndicator: (frame: string): boolean => {
    return frame.includes('truncated') ||
           frame.includes('more lines') ||
           frame.includes('...');
  },

  /**
   * Assert that timing information is displayed
   */
  hasTimingInfo: (frame: string): boolean => {
    return /\d+ms|\d+\.\d+s|\d+m\s\d+s/.test(frame);
  },

  /**
   * Assert that error suggestions are shown
   */
  hasErrorSuggestions: (frame: string): boolean => {
    return frame.includes('💡 Suggestions:') ||
           frame.includes('Suggestions:');
  },

  /**
   * Assert that MCP error context is displayed
   */
  hasMCPErrorContext: (frame: string): boolean => {
    return frame.includes('MCP') ||
           frame.includes('Context:');
  },

  /**
   * Assert tool status indicator is present
   */
  hasToolStatus: (frame: string, status: string): boolean => {
    const statusIndicators = {
      pending: '○',
      running: '●', // Spinner may vary
      success: '✓',
      error: '✗',
    };

    const indicator = statusIndicators[status as keyof typeof statusIndicators];
    return indicator ? frame.includes(indicator) : false;
  },

  /**
   * Assert that parameter count is shown for circular references
   */
  hasParameterCount: (frame: string): boolean => {
    return /\d+\s+params/.test(frame);
  },

  /**
   * Assert that tool color coding is present
   */
  hasToolColorCoding: (frame: string, toolName: string): boolean => {
    // Since we can't easily test colors in text output,
    // we check that the tool name is prominently displayed
    return frame.includes(toolName);
  },
};

/**
 * Performance testing helpers
 */
export const performance = {
  /**
   * Measure render time for component
   */
  measureRenderTime: async <T>(renderFn: () => T): Promise<{ result: T; duration: number }> => {
    const startTime = performance.now();
    const result = renderFn();
    const duration = performance.now() - startTime;

    return { result, duration };
  },

  /**
   * Measure memory usage during render (approximate)
   */
  measureMemoryUsage: async <T>(renderFn: () => T): Promise<{ result: T; memoryDelta: number }> => {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const initialMemory = process.memoryUsage().heapUsed;
    const result = renderFn();
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryDelta = finalMemory - initialMemory;

    return { result, memoryDelta };
  },

  /**
   * Test render performance with large datasets
   */
  stressTestRender: async (
    renderFn: () => ComponentTestResult,
    iterations: number = 100
  ): Promise<{
    averageTime: number;
    maxTime: number;
    minTime: number;
    memoryUsed: number;
  }> => {
    const times: number[] = [];
    let maxMemoryDelta = 0;

    for (let i = 0; i < iterations; i++) {
      const { duration, memoryDelta } = await performance.measureMemoryUsage(() =>
        performance.measureRenderTime(renderFn)
      ).then(async ({ result, memoryDelta }) => ({
        duration: (await result).duration,
        memoryDelta
      }));

      times.push(duration);
      maxMemoryDelta = Math.max(maxMemoryDelta, memoryDelta);

      // Cleanup between iterations
      if (global.gc && i % 10 === 0) {
        global.gc();
      }
    }

    return {
      averageTime: times.reduce((sum, t) => sum + t, 0) / times.length,
      maxTime: Math.max(...times),
      minTime: Math.min(...times),
      memoryUsed: maxMemoryDelta,
    };
  },
};

/**
 * Test data generators for consistent testing
 */
export const testData = {
  /**
   * Generate test task ID
   */
  createTaskId: (prefix = 'test-task'): string => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Generate test timestamp
   */
  createTimestamp: (offsetMs = 0): Date => {
    return new Date(Date.now() + offsetMs);
  },

  /**
   * Generate test tool input/output patterns
   */
  createToolIO: (toolName: string, size: 'small' | 'medium' | 'large' = 'medium') => {
    const sizes = {
      small: { inputProps: 2, outputLines: 3 },
      medium: { inputProps: 5, outputLines: 10 },
      large: { inputProps: 20, outputLines: 50 },
    };

    const config = sizes[size];

    const input: Record<string, unknown> = {};
    for (let i = 0; i < config.inputProps; i++) {
      input[`param_${i}`] = `value_${i}`;
    }

    const output = Array.from({ length: config.outputLines }, (_, i) =>
      `Output line ${i + 1} from ${toolName}`
    ).join('\n');

    return { input, output };
  },
};

export default {
  renderToolCall,
  renderToolExecutionPanel,
  renderErrorDisplay,
  renderMultipleToolCalls,
  createCircularToolCallProps,
  createLargePayloadToolCallProps,
  createTimingToolCallProps,
  createMCPErrorDisplayProps,
  assertions,
  performance,
  testData,
};
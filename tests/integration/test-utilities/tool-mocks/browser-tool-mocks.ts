/**
 * @fileoverview Browser Tool Mocks
 *
 * This file provides mock implementations for Browser tool operations
 * including navigation, element interaction, and screenshot capture.
 */

import { vi } from 'vitest';
import type { ToolMock } from '../types.js';

// ============================================================================
// Browser Operation Types
// ============================================================================

interface BrowserOperationResult {
  operation: string;
  success: boolean;
  result?: any;
  screenshot?: string; // Base64 encoded
  url?: string;
  title?: string;
  error?: string;
  executionTime: number;
}

// ============================================================================
// Browser Tool Mock
// ============================================================================

/**
 * Create a Browser tool mock with configurable operation responses
 */
export function createBrowserMock(
  options: {
    simulateDelay?: boolean;
    allowScreenshots?: boolean;
    mockPages?: Record<string, { title: string; content: string }>;
    simulateFailures?: boolean;
    failureRate?: number;
  } = {}
): ToolMock {
  const calls: ToolMock['calls'] = [];
  const {
    simulateDelay = true,
    allowScreenshots = true,
    mockPages = {},
    simulateFailures = false,
    failureRate = 0.1,
  } = options;

  const mockFn = vi.fn().mockImplementation(async (params: {
    operation: string;
    url?: string;
    selector?: string;
    value?: string;
    screenshot?: boolean;
    [key: string]: any;
  }) => {
    const callInfo = {
      args: [params],
      timestamp: new Date(),
      result: undefined as any,
      error: undefined as Error | undefined,
    };

    try {
      const { operation, url, selector, value, screenshot = false, ...otherParams } = params;
      const executionStart = Date.now();

      if (!operation) {
        const error = new Error('Operation parameter is required');
        callInfo.error = error;
        throw error;
      }

      // Simulate execution delay
      if (simulateDelay) {
        const delay = getOperationDelay(operation);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      // Simulate random failures
      if (simulateFailures && Math.random() < failureRate) {
        const error = new Error(`Browser operation '${operation}' failed due to simulated network/browser issue`);
        callInfo.error = error;
        throw error;
      }

      const executionTime = Date.now() - executionStart;
      let result: BrowserOperationResult;

      switch (operation.toLowerCase()) {
        case 'navigate':
          result = await handleNavigateOperation(url!, mockPages, executionTime);
          break;

        case 'click':
          result = handleClickOperation(selector!, executionTime);
          break;

        case 'type':
          result = handleTypeOperation(selector!, value!, executionTime);
          break;

        case 'screenshot':
          result = handleScreenshotOperation(allowScreenshots, executionTime);
          break;

        case 'wait':
          result = handleWaitOperation(otherParams, executionTime);
          break;

        case 'evaluate':
          result = handleEvaluateOperation(otherParams.code, executionTime);
          break;

        case 'get_text':
        case 'getText':
          result = handleGetTextOperation(selector!, executionTime);
          break;

        case 'get_attribute':
        case 'getAttribute':
          result = handleGetAttributeOperation(selector!, otherParams.attribute, executionTime);
          break;

        case 'scroll':
          result = handleScrollOperation(otherParams, executionTime);
          break;

        case 'hover':
          result = handleHoverOperation(selector!, executionTime);
          break;

        case 'select':
          result = handleSelectOperation(selector!, value!, executionTime);
          break;

        default:
          result = {
            operation,
            success: false,
            error: `Unknown browser operation: ${operation}`,
            executionTime,
          };
      }

      // Add screenshot if requested
      if (screenshot && allowScreenshots && result.success) {
        result.screenshot = generateMockScreenshot();
      }

      callInfo.result = result;
      return result;
    } finally {
      calls.push(callInfo);
    }
  });

  return {
    mock: mockFn,
    config: { tool: 'Browser', shouldSucceed: true, trackCalls: true },
    calls,
    reset: () => {
      mockFn.mockClear();
      calls.length = 0;
    },
    getCallHistory: () => [...calls],
  };
}

// ============================================================================
// Operation Handlers
// ============================================================================

/**
 * Handle navigate operation
 */
async function handleNavigateOperation(
  url: string,
  mockPages: Record<string, { title: string; content: string }>,
  executionTime: number
): Promise<BrowserOperationResult> {
  if (!url) {
    return {
      operation: 'navigate',
      success: false,
      error: 'URL is required for navigate operation',
      executionTime,
    };
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return {
      operation: 'navigate',
      success: false,
      error: `Invalid URL format: ${url}`,
      executionTime,
    };
  }

  const mockPage = mockPages[url] || mockPages[new URL(url).hostname] || mockPages['*'];
  const title = mockPage?.title || `Mock Page - ${new URL(url).hostname}`;

  return {
    operation: 'navigate',
    success: true,
    result: `Successfully navigated to ${url}`,
    url,
    title,
    executionTime,
  };
}

/**
 * Handle click operation
 */
function handleClickOperation(selector: string, executionTime: number): BrowserOperationResult {
  if (!selector) {
    return {
      operation: 'click',
      success: false,
      error: 'Selector is required for click operation',
      executionTime,
    };
  }

  return {
    operation: 'click',
    success: true,
    result: `Successfully clicked element: ${selector}`,
    executionTime,
  };
}

/**
 * Handle type operation
 */
function handleTypeOperation(selector: string, value: string, executionTime: number): BrowserOperationResult {
  if (!selector) {
    return {
      operation: 'type',
      success: false,
      error: 'Selector is required for type operation',
      executionTime,
    };
  }

  if (value === undefined || value === null) {
    return {
      operation: 'type',
      success: false,
      error: 'Value is required for type operation',
      executionTime,
    };
  }

  return {
    operation: 'type',
    success: true,
    result: `Successfully typed "${value}" into element: ${selector}`,
    executionTime,
  };
}

/**
 * Handle screenshot operation
 */
function handleScreenshotOperation(allowScreenshots: boolean, executionTime: number): BrowserOperationResult {
  if (!allowScreenshots) {
    return {
      operation: 'screenshot',
      success: false,
      error: 'Screenshots are disabled in mock mode',
      executionTime,
    };
  }

  return {
    operation: 'screenshot',
    success: true,
    result: 'Screenshot captured successfully',
    screenshot: generateMockScreenshot(),
    executionTime,
  };
}

/**
 * Handle wait operation
 */
function handleWaitOperation(params: any, executionTime: number): BrowserOperationResult {
  const { timeout = 5000, condition = 'visible' } = params;

  return {
    operation: 'wait',
    success: true,
    result: `Wait completed for condition: ${condition} (timeout: ${timeout}ms)`,
    executionTime,
  };
}

/**
 * Handle JavaScript evaluation
 */
function handleEvaluateOperation(code: string, executionTime: number): BrowserOperationResult {
  if (!code) {
    return {
      operation: 'evaluate',
      success: false,
      error: 'Code is required for evaluate operation',
      executionTime,
    };
  }

  // Generate mock result based on code content
  let mockResult: any;

  if (code.includes('document.title')) {
    mockResult = 'Mock Page Title';
  } else if (code.includes('window.location')) {
    mockResult = 'https://example.com/mock-page';
  } else if (code.includes('document.querySelector')) {
    mockResult = 'Mock element text content';
  } else if (code.includes('return ')) {
    mockResult = 'Mock return value';
  } else {
    mockResult = null;
  }

  return {
    operation: 'evaluate',
    success: true,
    result: mockResult,
    executionTime,
  };
}

/**
 * Handle get text operation
 */
function handleGetTextOperation(selector: string, executionTime: number): BrowserOperationResult {
  if (!selector) {
    return {
      operation: 'get_text',
      success: false,
      error: 'Selector is required for get_text operation',
      executionTime,
    };
  }

  const mockTexts: Record<string, string> = {
    'h1': 'Mock Heading',
    'p': 'Mock paragraph text',
    'button': 'Mock Button',
    'a': 'Mock Link',
    '.class': 'Mock class element',
    '#id': 'Mock ID element',
  };

  const text = mockTexts[selector] || `Mock text for ${selector}`;

  return {
    operation: 'get_text',
    success: true,
    result: text,
    executionTime,
  };
}

/**
 * Handle get attribute operation
 */
function handleGetAttributeOperation(
  selector: string,
  attribute: string,
  executionTime: number
): BrowserOperationResult {
  if (!selector) {
    return {
      operation: 'get_attribute',
      success: false,
      error: 'Selector is required for get_attribute operation',
      executionTime,
    };
  }

  if (!attribute) {
    return {
      operation: 'get_attribute',
      success: false,
      error: 'Attribute name is required for get_attribute operation',
      executionTime,
    };
  }

  const mockAttributes: Record<string, Record<string, string>> = {
    'a': { href: 'https://example.com', target: '_blank' },
    'img': { src: 'https://example.com/image.jpg', alt: 'Mock Image' },
    'input': { type: 'text', name: 'mock_input', placeholder: 'Enter text' },
    'button': { type: 'button', class: 'mock-button' },
  };

  const elementAttributes = mockAttributes[selector] || {};
  const value = elementAttributes[attribute] || `mock-${attribute}-value`;

  return {
    operation: 'get_attribute',
    success: true,
    result: value,
    executionTime,
  };
}

/**
 * Handle scroll operation
 */
function handleScrollOperation(params: any, executionTime: number): BrowserOperationResult {
  const { x = 0, y = 0, behavior = 'smooth' } = params;

  return {
    operation: 'scroll',
    success: true,
    result: `Scrolled to position (${x}, ${y}) with ${behavior} behavior`,
    executionTime,
  };
}

/**
 * Handle hover operation
 */
function handleHoverOperation(selector: string, executionTime: number): BrowserOperationResult {
  if (!selector) {
    return {
      operation: 'hover',
      success: false,
      error: 'Selector is required for hover operation',
      executionTime,
    };
  }

  return {
    operation: 'hover',
    success: true,
    result: `Successfully hovered over element: ${selector}`,
    executionTime,
  };
}

/**
 * Handle select operation
 */
function handleSelectOperation(selector: string, value: string, executionTime: number): BrowserOperationResult {
  if (!selector) {
    return {
      operation: 'select',
      success: false,
      error: 'Selector is required for select operation',
      executionTime,
    };
  }

  if (!value) {
    return {
      operation: 'select',
      success: false,
      error: 'Value is required for select operation',
      executionTime,
    };
  }

  return {
    operation: 'select',
    success: true,
    result: `Successfully selected "${value}" in element: ${selector}`,
    executionTime,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get realistic execution delay for different operations
 */
function getOperationDelay(operation: string): number {
  const delays: Record<string, number> = {
    navigate: 1000 + Math.random() * 2000,
    click: 100 + Math.random() * 200,
    type: 50 + Math.random() * 100,
    screenshot: 500 + Math.random() * 1000,
    wait: 100 + Math.random() * 500,
    evaluate: 50 + Math.random() * 150,
    get_text: 50 + Math.random() * 100,
    get_attribute: 25 + Math.random() * 75,
    scroll: 100 + Math.random() * 200,
    hover: 50 + Math.random() * 100,
    select: 75 + Math.random() * 125,
  };

  return delays[operation.toLowerCase()] || 100 + Math.random() * 200;
}

/**
 * Generate a mock base64 screenshot
 */
function generateMockScreenshot(): string {
  // Return a small mock base64 image (1x1 pixel PNG)
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
}
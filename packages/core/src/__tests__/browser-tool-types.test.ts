import { describe, it, expect } from 'vitest';
import {
  BrowserOperationSchema,
  BrowserToolInputSchema,
  BrowserToolOutputSchema,
  NavigateParamsSchema,
  ClickParamsSchema,
  TypeParamsSchema,
  ScreenshotParamsSchema,
  CompareScreenshotParamsSchema,
  EvaluateParamsSchema,
  SubmitParamsSchema,
  WaitForSelectorParamsSchema,
  GetAttributeParamsSchema,
  GetTextParamsSchema,
  GetHtmlParamsSchema,
  ScrollParamsSchema,
  HoverParamsSchema,
  ElementStateSchema,
  ScreenshotComparisonResultSchema,
  ConsoleMessageSchema,
  BrowserErrorSchema,
  StackFrameSchema,
  ConsoleSeveritySchema,
} from '../types';

describe('Browser Tool Types', () => {
  describe('BrowserOperationSchema', () => {
    it('should validate all supported browser operations', () => {
      const operations = [
        'navigate',
        'click',
        'type',
        'screenshot',
        'compareScreenshot',
        'evaluate',
        'submit',
        'waitForSelector',
        'getAttribute',
        'getText',
        'getHtml',
        'scroll',
        'hover',
      ];

      operations.forEach(operation => {
        const result = BrowserOperationSchema.safeParse(operation);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid operations', () => {
      const invalidOperations = [
        'invalid',
        'browse',
        'open',
        'close',
        '',
        null,
        undefined,
      ];

      invalidOperations.forEach(operation => {
        const result = BrowserOperationSchema.safeParse(operation);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('NavigateParamsSchema', () => {
    it('should validate valid navigation parameters', () => {
      const validParams = [
        { url: 'https://example.com' },
        { url: 'http://localhost:3000' },
        { url: 'https://api.github.com/repos/owner/repo' },
        { url: 'https://sub.domain.com/path?query=value#hash' },
      ];

      validParams.forEach(params => {
        const result = NavigateParamsSchema.safeParse(params);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid URLs', () => {
      const invalidParams = [
        { url: '' },
        { url: 'not-a-url' },
        { url: 'ftp://example.com' },
        {},
        { url: null },
      ];

      invalidParams.forEach(params => {
        const result = NavigateParamsSchema.safeParse(params);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('ClickParamsSchema', () => {
    it('should validate click parameters with selector', () => {
      const params = {
        selector: '#submit-button',
      };

      const result = ClickParamsSchema.safeParse(params);
      expect(result.success).toBe(true);
    });

    it('should validate click parameters with coordinates', () => {
      const params = {
        coordinate: { x: 100, y: 200 },
      };

      const result = ClickParamsSchema.safeParse(params);
      expect(result.success).toBe(true);
    });

    it('should reject click parameters without selector or coordinates', () => {
      const invalidParams = [
        {},
        { selector: '' },
        { coordinate: {} },
        { coordinate: { x: 100 } },
        { coordinate: { y: 200 } },
        { coordinate: { x: -1, y: 100 } },
      ];

      invalidParams.forEach(params => {
        const result = ClickParamsSchema.safeParse(params);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('TypeParamsSchema', () => {
    it('should validate type parameters', () => {
      const validParams = [
        { selector: '#username', text: 'user@example.com' },
        { selector: 'input[name="password"]', text: 'secretpassword' },
        { selector: '.search-input', text: 'search query' },
      ];

      validParams.forEach(params => {
        const result = TypeParamsSchema.safeParse(params);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid type parameters', () => {
      const invalidParams = [
        {},
        { selector: '', text: 'text' },
        { selector: '#input', text: '' },
        { text: 'text' },
        { selector: '#input' },
      ];

      invalidParams.forEach(params => {
        const result = TypeParamsSchema.safeParse(params);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('ScreenshotParamsSchema', () => {
    it('should validate screenshot parameters with defaults', () => {
      const params = {};

      const result = ScreenshotParamsSchema.safeParse(params);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        fullPage: false,
        format: 'png',
        quality: 80,
      });
    });

    it('should validate screenshot parameters with custom values', () => {
      const params = {
        fullPage: true,
        format: 'jpeg' as const,
        quality: 95,
        selector: '#main-content',
      };

      const result = ScreenshotParamsSchema.safeParse(params);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(params);
    });

    it('should reject invalid screenshot parameters', () => {
      const invalidParams = [
        { format: 'bmp' },
        { quality: 101 },
        { quality: -1 },
        { selector: '' },
      ];

      invalidParams.forEach(params => {
        const result = ScreenshotParamsSchema.safeParse(params);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('CompareScreenshotParamsSchema', () => {
    it('should validate compare screenshot parameters', () => {
      const params = {
        baseline: 'baseline.png',
        current: 'current.png',
      };

      const result = CompareScreenshotParamsSchema.safeParse(params);
      expect(result.success).toBe(true);
    });

    it('should validate with optional threshold', () => {
      const params = {
        baseline: 'baseline.png',
        current: 'current.png',
        threshold: 0.1,
      };

      const result = CompareScreenshotParamsSchema.safeParse(params);
      expect(result.success).toBe(true);
    });

    it('should reject invalid compare parameters', () => {
      const invalidParams = [
        {},
        { baseline: 'test.png' },
        { current: 'test.png' },
        { baseline: '', current: 'current.png' },
        { baseline: 'baseline.png', current: '' },
        { baseline: 'baseline.png', current: 'current.png', threshold: 1.1 },
        { baseline: 'baseline.png', current: 'current.png', threshold: -0.1 },
      ];

      invalidParams.forEach(params => {
        const result = CompareScreenshotParamsSchema.safeParse(params);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('EvaluateParamsSchema', () => {
    it('should validate JavaScript evaluation parameters', () => {
      const validParams = [
        { script: 'document.title' },
        { script: 'return window.location.href' },
        {
          script: 'return arguments[0] + arguments[1]',
          args: [1, 2]
        },
        {
          script: 'return { url: location.href, title: document.title }',
          args: []
        },
      ];

      validParams.forEach(params => {
        const result = EvaluateParamsSchema.safeParse(params);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid evaluation parameters', () => {
      const invalidParams = [
        {},
        { script: '' },
        { args: [1, 2] },
      ];

      invalidParams.forEach(params => {
        const result = EvaluateParamsSchema.safeParse(params);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('ElementStateSchema', () => {
    it('should validate all element states', () => {
      const states = ['visible', 'hidden', 'attached', 'detached'];

      states.forEach(state => {
        const result = ElementStateSchema.safeParse(state);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid element states', () => {
      const invalidStates = ['enabled', 'disabled', 'clickable', ''];

      invalidStates.forEach(state => {
        const result = ElementStateSchema.safeParse(state);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('WaitForSelectorParamsSchema', () => {
    it('should validate wait parameters with defaults', () => {
      const params = {
        selector: '#loading-indicator',
      };

      const result = WaitForSelectorParamsSchema.safeParse(params);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        selector: '#loading-indicator',
        state: 'visible',
        timeout: 30000,
      });
    });

    it('should validate with custom state and timeout', () => {
      const params = {
        selector: '.modal',
        state: 'hidden' as const,
        timeout: 5000,
      };

      const result = WaitForSelectorParamsSchema.safeParse(params);
      expect(result.success).toBe(true);
    });

    it('should reject invalid wait parameters', () => {
      const invalidParams = [
        {},
        { selector: '' },
        { selector: '.test', timeout: -1 },
        { selector: '.test', state: 'invalid' },
      ];

      invalidParams.forEach(params => {
        const result = WaitForSelectorParamsSchema.safeParse(params);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('ScrollParamsSchema', () => {
    it('should validate scroll parameters', () => {
      const validParams = [
        { direction: 'up' as const },
        { direction: 'down' as const },
        { direction: 'left' as const },
        { direction: 'right' as const },
        { coordinate: { x: 0, y: 100 } },
        { selector: '#content' },
      ];

      validParams.forEach(params => {
        const result = ScrollParamsSchema.safeParse(params);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid scroll parameters', () => {
      const invalidParams = [
        { direction: 'invalid' },
        { coordinate: { x: -1, y: 100 } },
        { coordinate: { x: 100 } },
        { selector: '' },
      ];

      invalidParams.forEach(params => {
        const result = ScrollParamsSchema.safeParse(params);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('ConsoleSeveritySchema', () => {
    it('should validate all console severity levels', () => {
      const severities = ['log', 'info', 'warn', 'error', 'debug', 'trace'];

      severities.forEach(severity => {
        const result = ConsoleSeveritySchema.safeParse(severity);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid severity levels', () => {
      const invalidSeverities = ['warning', 'critical', 'verbose', ''];

      invalidSeverities.forEach(severity => {
        const result = ConsoleSeveritySchema.safeParse(severity);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('StackFrameSchema', () => {
    it('should validate stack frame', () => {
      const frame = {
        functionName: 'handleClick',
        fileName: 'app.js',
        lineNumber: 42,
        columnNumber: 15,
      };

      const result = StackFrameSchema.safeParse(frame);
      expect(result.success).toBe(true);
    });

    it('should validate minimal stack frame', () => {
      const frame = {
        functionName: 'anonymous',
      };

      const result = StackFrameSchema.safeParse(frame);
      expect(result.success).toBe(true);
    });

    it('should reject invalid stack frame', () => {
      const invalidFrames = [
        {},
        { functionName: '' },
        { functionName: 'test', lineNumber: -1 },
        { functionName: 'test', columnNumber: -1 },
      ];

      invalidFrames.forEach(frame => {
        const result = StackFrameSchema.safeParse(frame);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('ConsoleMessageSchema', () => {
    it('should validate console message', () => {
      const message = {
        level: 'error' as const,
        text: 'ReferenceError: undefinedVariable is not defined',
        timestamp: new Date(),
        source: 'app.js:42',
      };

      const result = ConsoleMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should validate minimal console message', () => {
      const message = {
        level: 'log' as const,
        text: 'Hello world',
        timestamp: new Date(),
      };

      const result = ConsoleMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });
  });

  describe('BrowserErrorSchema', () => {
    it('should validate browser error with stack trace', () => {
      const error = {
        name: 'TypeError',
        message: 'Cannot read property of null',
        timestamp: new Date(),
        source: 'app.js:15',
        line: 15,
        column: 8,
        stackTrace: [
          {
            functionName: 'handleEvent',
            fileName: 'app.js',
            lineNumber: 15,
            columnNumber: 8,
          },
        ],
      };

      const result = BrowserErrorSchema.safeParse(error);
      expect(result.success).toBe(true);
    });

    it('should validate minimal browser error', () => {
      const error = {
        name: 'Error',
        message: 'Something went wrong',
        timestamp: new Date(),
      };

      const result = BrowserErrorSchema.safeParse(error);
      expect(result.success).toBe(true);
    });
  });

  describe('ScreenshotComparisonResultSchema', () => {
    it('should validate screenshot comparison result', () => {
      const result = {
        match: false,
        difference: 0.15,
        threshold: 0.1,
        diffImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      };

      const validationResult = ScreenshotComparisonResultSchema.safeParse(result);
      expect(validationResult.success).toBe(true);
    });

    it('should validate matching screenshots', () => {
      const result = {
        match: true,
        difference: 0.0,
        threshold: 0.1,
      };

      const validationResult = ScreenshotComparisonResultSchema.safeParse(result);
      expect(validationResult.success).toBe(true);
    });

    it('should reject invalid comparison results', () => {
      const invalidResults = [
        { match: true }, // missing difference and threshold
        { match: false, difference: -0.1, threshold: 0.1 },
        { match: true, difference: 1.1, threshold: 0.1 },
        { match: false, difference: 0.1, threshold: -0.1 },
      ];

      invalidResults.forEach(result => {
        const validationResult = ScreenshotComparisonResultSchema.safeParse(result);
        expect(validationResult.success).toBe(false);
      });
    });
  });

  describe('BrowserToolInputSchema', () => {
    it('should validate all browser tool operations with correct parameters', () => {
      const validInputs = [
        {
          operation: 'navigate' as const,
          params: { url: 'https://example.com' },
        },
        {
          operation: 'click' as const,
          params: { selector: '#button' },
        },
        {
          operation: 'type' as const,
          params: { selector: '#input', text: 'test' },
        },
        {
          operation: 'screenshot' as const,
          params: { fullPage: true },
        },
        {
          operation: 'compareScreenshot' as const,
          params: { baseline: 'baseline.png', current: 'current.png' },
        },
        {
          operation: 'evaluate' as const,
          params: { script: 'return document.title' },
        },
        {
          operation: 'submit' as const,
          params: { selector: 'form' },
        },
        {
          operation: 'waitForSelector' as const,
          params: { selector: '.loading' },
        },
        {
          operation: 'getAttribute' as const,
          params: { selector: '#link', attribute: 'href' },
        },
        {
          operation: 'getText' as const,
          params: { selector: '.content' },
        },
        {
          operation: 'getHtml' as const,
          params: { selector: 'body' },
        },
        {
          operation: 'scroll' as const,
          params: { direction: 'down' },
        },
        {
          operation: 'hover' as const,
          params: { selector: '.menu-item' },
        },
      ];

      validInputs.forEach(input => {
        const result = BrowserToolInputSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    it('should reject mismatched operation and parameters', () => {
      const invalidInputs = [
        {
          operation: 'navigate' as const,
          params: { selector: '#button' }, // Wrong params for navigate
        },
        {
          operation: 'click' as const,
          params: { url: 'https://example.com' }, // Wrong params for click
        },
        {
          operation: 'type' as const,
          params: { selector: '#input' }, // Missing text for type
        },
      ];

      invalidInputs.forEach(input => {
        const result = BrowserToolInputSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('BrowserToolOutputSchema', () => {
    it('should validate successful browser tool output', () => {
      const output = {
        success: true,
        operation: 'navigate' as const,
        url: 'https://example.com',
        title: 'Example Domain',
        text: 'Page content',
        html: '<html>...</html>',
        screenshot: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        data: { customData: 'value' },
        consoleMessages: [
          {
            level: 'log' as const,
            text: 'Page loaded',
            timestamp: new Date(),
          },
        ],
        browserErrors: [],
      };

      const result = BrowserToolOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('should validate failed browser tool output', () => {
      const output = {
        success: false,
        operation: 'click' as const,
        error: 'Element not found: #non-existent-button',
        browserErrors: [
          {
            name: 'ElementNotFoundError',
            message: 'Could not find element with selector #non-existent-button',
            timestamp: new Date(),
          },
        ],
      };

      const result = BrowserToolOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('should validate minimal browser tool output', () => {
      const output = {
        success: true,
        operation: 'scroll' as const,
      };

      const result = BrowserToolOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('should reject invalid browser tool output', () => {
      const invalidOutputs = [
        {}, // Missing required fields
        { success: true }, // Missing operation
        { operation: 'navigate' }, // Missing success
        { success: 'yes', operation: 'navigate' }, // Wrong type for success
      ];

      invalidOutputs.forEach(output => {
        const result = BrowserToolOutputSchema.safeParse(output);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null and undefined values gracefully', () => {
      const schemas = [
        BrowserOperationSchema,
        NavigateParamsSchema,
        ClickParamsSchema,
        TypeParamsSchema,
        BrowserToolInputSchema,
        BrowserToolOutputSchema,
      ];

      schemas.forEach(schema => {
        expect(schema.safeParse(null).success).toBe(false);
        expect(schema.safeParse(undefined).success).toBe(false);
      });
    });

    it('should validate complex browser interaction scenarios', () => {
      // Multi-step form interaction
      const formInput = {
        operation: 'type' as const,
        params: {
          selector: 'input[type="email"]',
          text: 'user@example.com',
        },
      };

      expect(BrowserToolInputSchema.safeParse(formInput).success).toBe(true);

      // Screenshot with specific selector
      const screenshotInput = {
        operation: 'screenshot' as const,
        params: {
          selector: '#main-content',
          fullPage: false,
          format: 'jpeg' as const,
          quality: 90,
        },
      };

      expect(BrowserToolInputSchema.safeParse(screenshotInput).success).toBe(true);

      // Complex JavaScript evaluation
      const evaluateInput = {
        operation: 'evaluate' as const,
        params: {
          script: `
            const links = Array.from(document.querySelectorAll('a'));
            return links.map(link => ({
              href: link.href,
              text: link.textContent?.trim(),
              target: link.target
            }));
          `,
          args: [],
        },
      };

      expect(BrowserToolInputSchema.safeParse(evaluateInput).success).toBe(true);
    });

    it('should validate browser output with rich error information', () => {
      const complexOutput = {
        success: false,
        operation: 'waitForSelector' as const,
        error: 'Timeout waiting for selector: .dynamic-content',
        url: 'https://spa-app.com/dashboard',
        title: 'Dashboard - Loading...',
        consoleMessages: [
          {
            level: 'warn' as const,
            text: 'Resource loading slowly: https://cdn.example.com/large-asset.js',
            timestamp: new Date(),
            source: 'network',
          },
          {
            level: 'error' as const,
            text: 'Failed to fetch API data',
            timestamp: new Date(),
            source: 'app.js:123',
          },
        ],
        browserErrors: [
          {
            name: 'TimeoutError',
            message: 'Timeout 30000ms exceeded',
            timestamp: new Date(),
            source: 'browser-automation',
            line: 0,
            column: 0,
          },
          {
            name: 'NetworkError',
            message: 'NET::ERR_CONNECTION_TIMED_OUT',
            timestamp: new Date(),
            source: 'network',
          },
        ],
      };

      const result = BrowserToolOutputSchema.safeParse(complexOutput);
      expect(result.success).toBe(true);
    });
  });
});
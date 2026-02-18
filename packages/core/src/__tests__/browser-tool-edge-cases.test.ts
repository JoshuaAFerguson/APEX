import { describe, it, expect } from 'vitest';
import {
  BrowserToolConfigSchema,
  BrowserToolInputSchema,
  BrowserToolOutputSchema,
  NavigateParamsSchema,
  ClickParamsSchema,
  TypeParamsSchema,
  EvaluateParamsSchema,
  ScreenshotParamsSchema,
  CompareScreenshotParamsSchema,
  WaitForSelectorParamsSchema,
  ConsoleMessageSchema,
  BrowserErrorSchema,
  StackFrameSchema,
} from '../types';

describe('Browser Tool Edge Cases and Error Handling', () => {
  describe('Parameter Validation Edge Cases', () => {
    it('should handle URL edge cases', () => {
      const urlEdgeCases = [
        // Valid edge cases
        { url: 'https://example.com', expected: true },
        { url: 'http://localhost:3000', expected: true },
        { url: 'https://sub.domain.co.uk:8080/path?q=1&r=2#section', expected: true },
        { url: 'https://unicode-тест.example.com', expected: true },

        // Invalid edge cases
        { url: '', expected: false },
        { url: 'not-a-url', expected: false },
        { url: 'ftp://ftp.example.com', expected: false },
        { url: 'javascript:alert(1)', expected: false },
        { url: 'data:text/html,<script>alert(1)</script>', expected: false },
      ];

      urlEdgeCases.forEach(({ url, expected }) => {
        const result = NavigateParamsSchema.safeParse({ url });
        expect(result.success).toBe(expected, `URL "${url}" validation should be ${expected}`);
      });
    });

    it('should handle complex CSS selectors', () => {
      const selectorCases = [
        // Valid selectors
        { selector: '#id', expected: true },
        { selector: '.class', expected: true },
        { selector: 'div', expected: true },
        { selector: 'input[type="email"]', expected: true },
        { selector: '.parent > .child', expected: true },
        { selector: 'div:nth-child(2)', expected: true },
        { selector: 'a[href^="https://"]', expected: true },
        { selector: '.class1.class2', expected: true },
        { selector: '[data-testid="component"]', expected: true },

        // Invalid selectors
        { selector: '', expected: false },
        { selector: '   ', expected: false },
        { selector: '\n\t', expected: false },
      ];

      selectorCases.forEach(({ selector, expected }) => {
        const result = ClickParamsSchema.safeParse({ selector });
        expect(result.success).toBe(expected, `Selector "${selector}" should be ${expected}`);
      });
    });

    it('should handle coordinate boundary values', () => {
      const coordinateCases = [
        // Valid coordinates
        { coordinate: { x: 0, y: 0 }, expected: true },
        { coordinate: { x: 1, y: 1 }, expected: true },
        { coordinate: { x: 1920, y: 1080 }, expected: true },
        { coordinate: { x: 9999, y: 9999 }, expected: true },

        // Invalid coordinates
        { coordinate: { x: -1, y: 0 }, expected: false },
        { coordinate: { x: 0, y: -1 }, expected: false },
        { coordinate: { x: -1, y: -1 }, expected: false },
        { coordinate: { x: 1.5, y: 0 }, expected: false },
        { coordinate: { x: 0, y: 1.5 }, expected: false },
      ];

      coordinateCases.forEach(({ coordinate, expected }) => {
        const result = ClickParamsSchema.safeParse({ coordinate });
        expect(result.success).toBe(expected, `Coordinate ${JSON.stringify(coordinate)} should be ${expected}`);
      });
    });

    it('should handle text input edge cases', () => {
      const textCases = [
        // Valid text inputs
        { text: 'normal text', expected: true },
        { text: '', expected: true }, // Empty text should be allowed for clearing inputs
        { text: 'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?', expected: true },
        { text: 'Unicode: 你好世界 🌍 café', expected: true },
        { text: 'Multiline\ntext\nwith\nbreaks', expected: true },
        { text: '\t\n\r whitespace', expected: true },
        { text: 'Very long '.repeat(1000) + 'text', expected: true },

        // Invalid cases would be type-related, not content-related for text
      ];

      textCases.forEach(({ text, expected }) => {
        const result = TypeParamsSchema.safeParse({
          selector: '#input',
          text
        });
        expect(result.success).toBe(expected, `Text "${text.slice(0, 50)}..." should be ${expected}`);
      });
    });

    it('should handle JavaScript code edge cases', () => {
      const scriptCases = [
        // Valid scripts
        { script: 'document.title', expected: true },
        { script: 'return 42', expected: true },
        { script: 'console.log("test")', expected: true },
        { script: '() => { return "arrow function"; }', expected: true },
        { script: 'window.location.href', expected: true },
        { script: 'JSON.stringify({test: "data"})', expected: true },
        { script: `
          const data = document.querySelectorAll('.item');
          return Array.from(data).map(el => el.textContent);
        `, expected: true },

        // Invalid scripts
        { script: '', expected: false },
        { script: '   ', expected: false },
        { script: '\n\t\r', expected: false },
      ];

      scriptCases.forEach(({ script, expected }) => {
        const result = EvaluateParamsSchema.safeParse({ script });
        expect(result.success).toBe(expected, `Script validation should be ${expected}`);
      });
    });

    it('should handle screenshot quality edge cases', () => {
      const qualityCases = [
        // Valid quality values
        { quality: 0, expected: true },
        { quality: 1, expected: true },
        { quality: 50, expected: true },
        { quality: 80, expected: true },
        { quality: 100, expected: true },

        // Invalid quality values
        { quality: -1, expected: false },
        { quality: 101, expected: false },
        { quality: 1.5, expected: false },
        { quality: Infinity, expected: false },
        { quality: NaN, expected: false },
      ];

      qualityCases.forEach(({ quality, expected }) => {
        const result = ScreenshotParamsSchema.safeParse({ quality });
        expect(result.success).toBe(expected, `Quality ${quality} should be ${expected}`);
      });
    });

    it('should handle comparison threshold edge cases', () => {
      const thresholdCases = [
        // Valid thresholds
        { threshold: 0, expected: true },
        { threshold: 0.1, expected: true },
        { threshold: 0.5, expected: true },
        { threshold: 1, expected: true },

        // Invalid thresholds
        { threshold: -0.1, expected: false },
        { threshold: 1.1, expected: false },
        { threshold: Infinity, expected: false },
        { threshold: NaN, expected: false },
      ];

      thresholdCases.forEach(({ threshold, expected }) => {
        const result = CompareScreenshotParamsSchema.safeParse({
          baseline: 'baseline.png',
          current: 'current.png',
          threshold,
        });
        expect(result.success).toBe(expected, `Threshold ${threshold} should be ${expected}`);
      });
    });

    it('should handle timeout edge cases', () => {
      const timeoutCases = [
        // Valid timeouts
        { timeout: 0, expected: true }, // 0 might mean no timeout
        { timeout: 1000, expected: true },
        { timeout: 30000, expected: true },
        { timeout: 300000, expected: true }, // 5 minutes

        // Invalid timeouts
        { timeout: -1, expected: false },
        { timeout: 1.5, expected: false },
        { timeout: Infinity, expected: false },
        { timeout: NaN, expected: false },
      ];

      timeoutCases.forEach(({ timeout, expected }) => {
        const result = WaitForSelectorParamsSchema.safeParse({
          selector: '.element',
          timeout,
        });
        expect(result.success).toBe(expected, `Timeout ${timeout} should be ${expected}`);
      });
    });
  });

  describe('Browser Configuration Edge Cases', () => {
    it('should handle extreme viewport dimensions', () => {
      const viewportCases = [
        // Valid extreme cases
        { viewport: { width: 1, height: 1 }, expected: true },
        { viewport: { width: 320, height: 240 }, expected: true }, // Very small
        { viewport: { width: 7680, height: 4320 }, expected: true }, // 8K resolution

        // Invalid cases
        { viewport: { width: 0, height: 100 }, expected: false },
        { viewport: { width: 100, height: 0 }, expected: false },
        { viewport: { width: -1, height: 100 }, expected: false },
        { viewport: { width: 100, height: -1 }, expected: false },
        { viewport: { width: 1.5, height: 100 }, expected: false },
      ];

      viewportCases.forEach(({ viewport, expected }) => {
        const config = {
          enabled: true,
          viewport,
        };
        const result = BrowserToolConfigSchema.safeParse(config);
        expect(result.success).toBe(expected, `Viewport ${JSON.stringify(viewport)} should be ${expected}`);
      });
    });

    it('should handle domain list edge cases', () => {
      const domainCases = [
        // Valid domain configurations
        {
          allowedDomains: [],
          blockedDomains: [],
          expected: true,
        },
        {
          allowedDomains: ['example.com'],
          blockedDomains: ['malicious.com'],
          expected: true,
        },
        {
          allowedDomains: ['*.example.com', 'api.service.com'],
          blockedDomains: ['evil.com', 'bad.example.com'],
          expected: true,
        },
        {
          allowedDomains: ['localhost', '127.0.0.1', '192.168.1.100'],
          blockedDomains: [],
          expected: true,
        },
      ];

      domainCases.forEach(({ allowedDomains, blockedDomains, expected }) => {
        const config = {
          enabled: true,
          allowedDomains,
          blockedDomains,
        };
        const result = BrowserToolConfigSchema.safeParse(config);
        expect(result.success).toBe(expected, `Domain config should be ${expected}`);
      });
    });
  });

  describe('Error and Console Message Edge Cases', () => {
    it('should handle various console message formats', () => {
      const consoleCases = [
        // Standard messages
        {
          level: 'log' as const,
          text: 'Simple log message',
          timestamp: new Date(),
          expected: true,
        },
        // Empty messages
        {
          level: 'info' as const,
          text: '',
          timestamp: new Date(),
          expected: true, // Empty text might be valid
        },
        // Very long messages
        {
          level: 'error' as const,
          text: 'Very long error message: ' + 'A'.repeat(10000),
          timestamp: new Date(),
          expected: true,
        },
        // Messages with special characters
        {
          level: 'warn' as const,
          text: 'Unicode warning: 警告 🚨 café',
          timestamp: new Date(),
          source: 'app.js:42',
          expected: true,
        },
        // Messages with newlines
        {
          level: 'debug' as const,
          text: 'Multiline\ndebug\nmessage',
          timestamp: new Date(),
          expected: true,
        },
      ];

      consoleCases.forEach(({ expected, ...messageData }) => {
        const result = ConsoleMessageSchema.safeParse(messageData);
        expect(result.success).toBe(expected, `Console message should be ${expected}`);
      });
    });

    it('should handle various error formats', () => {
      const errorCases = [
        // Basic error
        {
          name: 'Error',
          message: 'Something went wrong',
          timestamp: new Date(),
          expected: true,
        },
        // Error with full details
        {
          name: 'TypeError',
          message: 'Cannot read property "click" of null',
          timestamp: new Date(),
          source: 'app.js',
          line: 42,
          column: 15,
          stackTrace: [
            {
              functionName: 'handleClick',
              fileName: 'app.js',
              lineNumber: 42,
              columnNumber: 15,
            },
          ],
          expected: true,
        },
        // Network error
        {
          name: 'NetworkError',
          message: 'Failed to fetch',
          timestamp: new Date(),
          source: 'network',
          expected: true,
        },
        // Security error
        {
          name: 'SecurityError',
          message: 'Blocked by CORS policy',
          timestamp: new Date(),
          source: 'security',
          expected: true,
        },
        // Error with empty message
        {
          name: 'UnknownError',
          message: '',
          timestamp: new Date(),
          expected: true,
        },
      ];

      errorCases.forEach(({ expected, ...errorData }) => {
        const result = BrowserErrorSchema.safeParse(errorData);
        expect(result.success).toBe(expected, `Browser error should be ${expected}`);
      });
    });

    it('should handle stack frame edge cases', () => {
      const stackFrameCases = [
        // Minimal frame
        {
          functionName: 'anonymous',
          expected: true,
        },
        // Complete frame
        {
          functionName: 'myFunction',
          fileName: '/path/to/file.js',
          lineNumber: 100,
          columnNumber: 25,
          expected: true,
        },
        // Frame with special characters
        {
          functionName: 'my-function-name',
          fileName: 'file-with-dashes.js',
          lineNumber: 1,
          columnNumber: 1,
          expected: true,
        },
        // Anonymous function
        {
          functionName: '',
          expected: false, // Function name should not be empty
        },
        // Invalid line numbers
        {
          functionName: 'test',
          lineNumber: -1,
          expected: false,
        },
        {
          functionName: 'test',
          columnNumber: -1,
          expected: false,
        },
      ];

      stackFrameCases.forEach(({ expected, ...frameData }) => {
        const result = StackFrameSchema.safeParse(frameData);
        expect(result.success).toBe(expected, `Stack frame should be ${expected}`);
      });
    });
  });

  describe('Complex Operation Combinations', () => {
    it('should validate complex multi-operation scenarios', () => {
      const complexOperations = [
        // File upload simulation
        {
          operation: 'evaluate' as const,
          params: {
            script: `
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.jpg,.png';
              document.body.appendChild(input);
              return 'File input created';
            `,
          },
        },
        // Dynamic content testing
        {
          operation: 'evaluate' as const,
          params: {
            script: `
              // Simulate loading state
              const loader = document.createElement('div');
              loader.className = 'loading';
              loader.textContent = 'Loading...';
              document.body.appendChild(loader);

              // Remove after delay
              setTimeout(() => {
                loader.remove();
                const content = document.createElement('div');
                content.className = 'content-loaded';
                content.textContent = 'Content loaded!';
                document.body.appendChild(content);
              }, 1000);

              return 'Loading simulation started';
            `,
          },
        },
        // Complex form interaction
        {
          operation: 'evaluate' as const,
          params: {
            script: `
              const form = document.querySelector('form');
              const formData = new FormData(form);
              const data = {};
              for (let [key, value] of formData.entries()) {
                data[key] = value;
              }
              return data;
            `,
          },
        },
      ];

      complexOperations.forEach((operation, index) => {
        const result = BrowserToolInputSchema.safeParse(operation);
        expect(result.success).toBe(true, `Complex operation ${index + 1} should be valid`);
      });
    });

    it('should validate error recovery patterns', () => {
      const errorRecoveryOutputs = [
        // Retry after element becomes available
        {
          success: false,
          operation: 'click' as const,
          error: 'Element not found: #dynamic-button',
          consoleMessages: [
            {
              level: 'info' as const,
              text: 'Button will be available after API call completes',
              timestamp: new Date(),
            },
          ],
        },
        // Fallback to alternative selector
        {
          success: true,
          operation: 'click' as const,
          url: 'https://example.com',
          consoleMessages: [
            {
              level: 'info' as const,
              text: 'Used fallback selector: .alternative-button',
              timestamp: new Date(),
            },
          ],
        },
        // Network timeout recovery
        {
          success: false,
          operation: 'navigate' as const,
          error: 'Navigation timeout after 30000ms',
          browserErrors: [
            {
              name: 'TimeoutError',
              message: 'Page load exceeded maximum timeout',
              timestamp: new Date(),
            },
          ],
        },
      ];

      errorRecoveryOutputs.forEach((output, index) => {
        const result = BrowserToolOutputSchema.safeParse(output);
        expect(result.success).toBe(true, `Error recovery output ${index + 1} should be valid`);
      });
    });
  });

  describe('Security and Safety Edge Cases', () => {
    it('should handle potentially dangerous script evaluation', () => {
      // These should still validate as inputs, but the execution system should handle security
      const potentiallyDangerousScripts = [
        'alert("XSS test")',
        'document.write("<script>alert(1)</script>")',
        'window.location = "javascript:alert(1)"',
        'eval("alert(1)")',
        'document.body.innerHTML = "<img src=x onerror=alert(1)>"',
      ];

      potentiallyDangerousScripts.forEach((script) => {
        const input = {
          operation: 'evaluate' as const,
          params: { script },
        };

        // The schema should validate the structure, security is handled at execution level
        const result = BrowserToolInputSchema.safeParse(input);
        expect(result.success).toBe(true, 'Script structure should be valid');
      });
    });

    it('should handle malicious URL attempts', () => {
      const maliciousUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)',
        'file:///etc/passwd',
        'ftp://malicious.com/payload',
      ];

      maliciousUrls.forEach((url) => {
        const result = NavigateParamsSchema.safeParse({ url });
        expect(result.success).toBe(false, `Malicious URL "${url}" should be rejected`);
      });
    });

    it('should handle data extraction edge cases', () => {
      const dataExtractionOutputs = [
        // Large data extraction
        {
          success: true,
          operation: 'evaluate' as const,
          data: {
            extractedData: new Array(1000).fill(0).map((_, i) => ({
              id: i,
              text: `Item ${i}`,
              value: Math.random(),
            })),
          },
        },
        // Sensitive data patterns (should be structurally valid but handled carefully)
        {
          success: true,
          operation: 'getText' as const,
          text: 'Credit Card: 4111-1111-1111-1111\nSSN: 123-45-6789\nEmail: user@example.com',
        },
        // Binary data in base64
        {
          success: true,
          operation: 'screenshot' as const,
          screenshot: 'data:image/png;base64,' + 'A'.repeat(10000),
        },
      ];

      dataExtractionOutputs.forEach((output, index) => {
        const result = BrowserToolOutputSchema.safeParse(output);
        expect(result.success).toBe(true, `Data extraction output ${index + 1} should be valid`);
      });
    });
  });

  describe('Performance and Resource Edge Cases', () => {
    it('should handle resource-intensive operations', () => {
      const resourceIntensiveOperations = [
        // Large page screenshot
        {
          operation: 'screenshot' as const,
          params: {
            fullPage: true,
            format: 'png' as const,
            quality: 100,
          },
        },
        // Complex DOM evaluation
        {
          operation: 'evaluate' as const,
          params: {
            script: `
              // Simulate heavy DOM processing
              const elements = document.querySelectorAll('*');
              return Array.from(elements).map(el => ({
                tag: el.tagName,
                classes: Array.from(el.classList),
                attributes: Array.from(el.attributes).reduce((acc, attr) => {
                  acc[attr.name] = attr.value;
                  return acc;
                }, {}),
                boundingRect: el.getBoundingClientRect(),
              }));
            `,
          },
        },
        // Long wait timeout
        {
          operation: 'waitForSelector' as const,
          params: {
            selector: '.eventually-appears',
            timeout: 300000, // 5 minutes
          },
        },
      ];

      resourceIntensiveOperations.forEach((operation, index) => {
        const result = BrowserToolInputSchema.safeParse(operation);
        expect(result.success).toBe(true, `Resource-intensive operation ${index + 1} should be valid`);
      });
    });
  });
});
import { describe, it, expect } from 'vitest';
import {
  BrowserToolConfigSchema,
  ToolPermissionConfigSchema,
  BrowserToolInputSchema,
  BrowserToolOutputSchema,
  PermissionSchema,
  ToolTypeSchema,
} from '../types';

describe('Browser Tool Integration', () => {
  describe('Tool Configuration Integration', () => {
    it('should integrate browser config with general tool permissions', () => {
      const browserConfig = {
        enabled: true,
        timeout: 30000,
        requireConfirmation: false,
        allowedDomains: ['trusted-site.com', 'api.example.com'],
        blockedDomains: ['malicious-site.com'],
        allowJavaScriptExecution: true,
        allowFormSubmission: true,
        pageLoadTimeout: 15000,
        allowDownloads: false,
        allowScreenshots: true,
        blockPopups: true,
        engine: 'chromium' as const,
        backend: 'playwright' as const,
        headless: true,
        viewport: {
          width: 1280,
          height: 720,
        },
      };

      // Test browser config validation
      const browserResult = BrowserToolConfigSchema.safeParse(browserConfig);
      expect(browserResult.success).toBe(true);

      // Test integration with general tool permission config
      const toolConfig = browserConfig;
      const toolResult = ToolPermissionConfigSchema.safeParse(toolConfig);
      expect(toolResult.success).toBe(true);
    });

    it('should validate browser tool type in tool type schema', () => {
      const result = ToolTypeSchema.safeParse('browser');
      expect(result.success).toBe(true);
    });

    it('should create permissions for browser tools', () => {
      const permission = {
        tool: 'mcp__browser-tools__Browser',
        scope: 'https://example.com',
        level: 'allow-once' as const,
        createdAt: new Date(),
      };

      const result = PermissionSchema.safeParse(permission);
      expect(result.success).toBe(true);
    });
  });

  describe('Browser Tool Workflow Integration', () => {
    it('should validate a complete browser automation workflow', () => {
      const workflow = [
        // Step 1: Navigate to page
        {
          operation: 'navigate' as const,
          params: { url: 'https://example.com/login' },
        },
        // Step 2: Wait for login form
        {
          operation: 'waitForSelector' as const,
          params: { selector: '#login-form', state: 'visible' as const },
        },
        // Step 3: Fill username
        {
          operation: 'type' as const,
          params: { selector: '#username', text: 'testuser' },
        },
        // Step 4: Fill password
        {
          operation: 'type' as const,
          params: { selector: '#password', text: 'password123' },
        },
        // Step 5: Click submit
        {
          operation: 'click' as const,
          params: { selector: '#submit-btn' },
        },
        // Step 6: Wait for redirect
        {
          operation: 'waitForSelector' as const,
          params: { selector: '.dashboard', timeout: 10000 },
        },
        // Step 7: Take screenshot
        {
          operation: 'screenshot' as const,
          params: { fullPage: true, format: 'png' as const },
        },
      ];

      workflow.forEach((step, index) => {
        const result = BrowserToolInputSchema.safeParse(step);
        expect(result.success).toBe(true, `Step ${index + 1} should be valid`);
      });
    });

    it('should validate browser tool outputs for workflow steps', () => {
      const workflowOutputs = [
        // Navigate success
        {
          success: true,
          operation: 'navigate' as const,
          url: 'https://example.com/login',
          title: 'Login - Example App',
        },
        // Wait success
        {
          success: true,
          operation: 'waitForSelector' as const,
          url: 'https://example.com/login',
        },
        // Type success (username)
        {
          success: true,
          operation: 'type' as const,
          url: 'https://example.com/login',
        },
        // Type success (password)
        {
          success: true,
          operation: 'type' as const,
          url: 'https://example.com/login',
        },
        // Click success
        {
          success: true,
          operation: 'click' as const,
          url: 'https://example.com/dashboard', // URL changed after click
          title: 'Dashboard - Example App',
        },
        // Wait success (dashboard)
        {
          success: true,
          operation: 'waitForSelector' as const,
          url: 'https://example.com/dashboard',
        },
        // Screenshot success
        {
          success: true,
          operation: 'screenshot' as const,
          screenshot: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        },
      ];

      workflowOutputs.forEach((output, index) => {
        const result = BrowserToolOutputSchema.safeParse(output);
        expect(result.success).toBe(true, `Output ${index + 1} should be valid`);
      });
    });

    it('should handle workflow failures gracefully', () => {
      const failureOutputs = [
        // Navigation failure
        {
          success: false,
          operation: 'navigate' as const,
          error: 'ERR_NAME_NOT_RESOLVED: https://invalid-domain.com',
          browserErrors: [
            {
              name: 'NetworkError',
              message: 'DNS resolution failed',
              timestamp: new Date(),
            },
          ],
        },
        // Element not found failure
        {
          success: false,
          operation: 'click' as const,
          error: 'Element not found: #non-existent-button',
          url: 'https://example.com',
          browserErrors: [
            {
              name: 'ElementNotFoundError',
              message: 'Could not locate element with selector #non-existent-button',
              timestamp: new Date(),
            },
          ],
        },
        // Timeout failure
        {
          success: false,
          operation: 'waitForSelector' as const,
          error: 'Timeout 5000ms exceeded waiting for selector .slow-loading-content',
          url: 'https://slow-site.com',
          consoleMessages: [
            {
              level: 'warn' as const,
              text: 'Slow script warning: A script on this page may be busy',
              timestamp: new Date(),
            },
          ],
        },
      ];

      failureOutputs.forEach((output, index) => {
        const result = BrowserToolOutputSchema.safeParse(output);
        expect(result.success).toBe(true, `Failure output ${index + 1} should be valid`);
      });
    });
  });

  describe('Permission System Integration', () => {
    it('should validate domain-restricted permissions', () => {
      const domainPermissions = [
        {
          tool: 'mcp__browser-tools__Browser',
          scope: 'navigate:https://trusted-site.com',
          level: 'allow-always' as const,
          createdAt: new Date(),
        },
        {
          tool: 'mcp__browser-tools__Browser',
          scope: 'screenshot:*',
          level: 'allow-once' as const,
          createdAt: new Date(),
        },
        {
          tool: 'mcp__browser-tools__Browser',
          scope: 'evaluate:*',
          level: 'deny' as const,
          createdAt: new Date(),
        },
      ];

      domainPermissions.forEach((permission, index) => {
        const result = PermissionSchema.safeParse(permission);
        expect(result.success).toBe(true, `Domain permission ${index + 1} should be valid`);
      });
    });

    it('should validate operation-specific permissions', () => {
      const operationPermissions = [
        {
          tool: 'mcp__browser-tools__Browser',
          scope: 'click',
          level: 'allow-always' as const,
          createdAt: new Date(),
        },
        {
          tool: 'mcp__browser-tools__Browser',
          scope: 'type',
          level: 'allow-once' as const,
          createdAt: new Date(),
        },
        {
          tool: 'mcp__browser-tools__Browser',
          scope: 'evaluate',
          level: 'deny' as const,
          createdAt: new Date(),
        },
      ];

      operationPermissions.forEach((permission, index) => {
        const result = PermissionSchema.safeParse(permission);
        expect(result.success).toBe(true, `Operation permission ${index + 1} should be valid`);
      });
    });
  });

  describe('Complex Browser Scenarios', () => {
    it('should validate e-commerce checkout flow', () => {
      const checkoutFlow = [
        {
          operation: 'navigate' as const,
          params: { url: 'https://shop.example.com/products/laptop' },
        },
        {
          operation: 'click' as const,
          params: { selector: '.add-to-cart-btn' },
        },
        {
          operation: 'waitForSelector' as const,
          params: { selector: '.cart-notification', state: 'visible' as const },
        },
        {
          operation: 'click' as const,
          params: { selector: '.checkout-btn' },
        },
        {
          operation: 'type' as const,
          params: { selector: '#email', text: 'customer@example.com' },
        },
        {
          operation: 'type' as const,
          params: { selector: '#shipping-address', text: '123 Main St' },
        },
        {
          operation: 'click' as const,
          params: { selector: '#payment-method-card' },
        },
        {
          operation: 'type' as const,
          params: { selector: '#card-number', text: '4111111111111111' },
        },
        {
          operation: 'screenshot' as const,
          params: { selector: '.checkout-form', format: 'png' as const },
        },
        {
          operation: 'click' as const,
          params: { selector: '.place-order-btn' },
        },
      ];

      checkoutFlow.forEach((step, index) => {
        const result = BrowserToolInputSchema.safeParse(step);
        expect(result.success).toBe(true, `Checkout step ${index + 1} should be valid`);
      });
    });

    it('should validate form testing with error handling', () => {
      const formTestingFlow = [
        // Test empty form submission
        {
          operation: 'navigate' as const,
          params: { url: 'https://forms.example.com/contact' },
        },
        {
          operation: 'click' as const,
          params: { selector: '#submit' },
        },
        {
          operation: 'waitForSelector' as const,
          params: { selector: '.error-message', state: 'visible' as const },
        },
        {
          operation: 'screenshot' as const,
          params: { fullPage: true, format: 'png' as const },
        },
        // Test with invalid email
        {
          operation: 'type' as const,
          params: { selector: '#email', text: 'invalid-email' },
        },
        {
          operation: 'click' as const,
          params: { selector: '#submit' },
        },
        {
          operation: 'getText' as const,
          params: { selector: '.email-error' },
        },
        // Test with valid data
        {
          operation: 'type' as const,
          params: { selector: '#email', text: 'valid@example.com' },
        },
        {
          operation: 'type' as const,
          params: { selector: '#message', text: 'Test message content' },
        },
        {
          operation: 'submit' as const,
          params: { selector: '#contact-form' },
        },
      ];

      formTestingFlow.forEach((step, index) => {
        const result = BrowserToolInputSchema.safeParse(step);
        expect(result.success).toBe(true, `Form test step ${index + 1} should be valid`);
      });
    });

    it('should validate visual regression testing workflow', () => {
      const visualTestingFlow = [
        // Take baseline screenshot
        {
          operation: 'navigate' as const,
          params: { url: 'https://ui.example.com/components' },
        },
        {
          operation: 'screenshot' as const,
          params: {
            selector: '.component-gallery',
            fullPage: false,
            format: 'png' as const,
          },
        },
        // Make some UI change via JavaScript
        {
          operation: 'evaluate' as const,
          params: {
            script: `
              document.querySelector('.primary-button').style.backgroundColor = 'red';
              return 'Button color changed';
            `,
          },
        },
        // Take comparison screenshot
        {
          operation: 'screenshot' as const,
          params: {
            selector: '.component-gallery',
            fullPage: false,
            format: 'png' as const,
          },
        },
        // Compare screenshots
        {
          operation: 'compareScreenshot' as const,
          params: {
            baseline: 'baseline-gallery.png',
            current: 'current-gallery.png',
            threshold: 0.05,
          },
        },
      ];

      visualTestingFlow.forEach((step, index) => {
        const result = BrowserToolInputSchema.safeParse(step);
        expect(result.success).toBe(true, `Visual test step ${index + 1} should be valid`);
      });
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should validate retry mechanisms for failed operations', () => {
      const retryScenarios = [
        // First attempt fails
        {
          success: false,
          operation: 'click' as const,
          error: 'Element not clickable: #loading-button',
          url: 'https://example.com',
          consoleMessages: [
            {
              level: 'warn' as const,
              text: 'Button is disabled while loading',
              timestamp: new Date(),
            },
          ],
        },
        // Wait for element to be ready
        {
          success: true,
          operation: 'waitForSelector' as const,
          url: 'https://example.com',
        },
        // Second attempt succeeds
        {
          success: true,
          operation: 'click' as const,
          url: 'https://example.com/success',
        },
      ];

      retryScenarios.forEach((output, index) => {
        const result = BrowserToolOutputSchema.safeParse(output);
        expect(result.success).toBe(true, `Retry scenario ${index + 1} should be valid`);
      });
    });

    it('should validate graceful degradation for unsupported operations', () => {
      const degradationOutputs = [
        // Screenshot not available
        {
          success: false,
          operation: 'screenshot' as const,
          error: 'Screenshots disabled in headless mode',
        },
        // Fallback to text extraction
        {
          success: true,
          operation: 'getText' as const,
          text: 'Page content extracted as fallback',
        },
      ];

      degradationOutputs.forEach((output, index) => {
        const result = BrowserToolOutputSchema.safeParse(output);
        expect(result.success).toBe(true, `Degradation output ${index + 1} should be valid`);
      });
    });
  });

  describe('Cross-Platform Browser Configuration', () => {
    it('should validate different browser engine configurations', () => {
      const engineConfigs = [
        {
          engine: 'chromium' as const,
          backend: 'playwright' as const,
          headless: true,
          viewport: { width: 1920, height: 1080 },
        },
        {
          engine: 'firefox' as const,
          backend: 'playwright' as const,
          headless: false,
          viewport: { width: 1280, height: 720 },
        },
        {
          engine: 'webkit' as const,
          backend: 'playwright' as const,
          headless: true,
          viewport: { width: 375, height: 667 }, // Mobile viewport
        },
      ];

      engineConfigs.forEach((config, index) => {
        const fullConfig = {
          enabled: true,
          ...config,
        };
        const result = BrowserToolConfigSchema.safeParse(fullConfig);
        expect(result.success).toBe(true, `Engine config ${index + 1} should be valid`);
      });
    });
  });
});
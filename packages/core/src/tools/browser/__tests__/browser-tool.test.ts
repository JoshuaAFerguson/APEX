/**
 * @fileoverview Tests for the BrowserTool class
 *
 * Tests cover:
 * - Input validation for all browser operations
 * - Domain filtering (allowed/blocked domains)
 * - Configuration options
 * - Operation execution
 * - Error handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BrowserTool } from '../browser-tool.js';

describe('BrowserTool', () => {
  let browserTool: BrowserTool;

  beforeEach(() => {
    browserTool = new BrowserTool();
  });

  describe('constructor', () => {
    it('should create a BrowserTool with default configuration', () => {
      const tool = new BrowserTool();
      expect(tool.name).toBe('Browser');
      expect(tool.category).toBe('browser');
    });

    it('should create a BrowserTool with custom configuration', () => {
      const tool = new BrowserTool({
        allowedDomains: ['example.com'],
        headless: false,
        viewport: { width: 1920, height: 1080 },
      });
      const config = tool.getConfig();
      expect(config.allowedDomains).toEqual(['example.com']);
      expect(config.headless).toBe(false);
      expect(config.viewport).toEqual({ width: 1920, height: 1080 });
    });
  });

  describe('getDefinition', () => {
    it('should return a valid tool definition', () => {
      const definition = browserTool.getDefinition();
      expect(definition.name).toBe('Browser');
      expect(definition.category).toBe('browser');
      expect(definition.permissions).toContain('network');
      expect(definition.dangerous).toBe(true);
    });

    it('should have correct parameters schema', () => {
      const definition = browserTool.getDefinition();
      expect(definition.parameters.properties).toHaveProperty('operation');
      expect(definition.parameters.properties).toHaveProperty('params');
      expect(definition.parameters.required).toContain('operation');
    });
  });

  describe('validate', () => {
    describe('navigate operation', () => {
      it('should validate valid navigate input', () => {
        const result = browserTool.validate({
          operation: 'navigate',
          params: { url: 'https://example.com' },
        });
        expect(result.valid).toBe(true);
      });

      it('should reject navigate without url', () => {
        const result = browserTool.validate({
          operation: 'navigate',
          params: {},
        } as any);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('navigate operation requires a url parameter');
      });

      it('should reject invalid URL format', () => {
        const result = browserTool.validate({
          operation: 'navigate',
          params: { url: 'not-a-valid-url' },
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid URL format');
      });
    });

    describe('domain filtering', () => {
      it('should block navigation to blocked domains', () => {
        const tool = new BrowserTool({
          blockedDomains: ['blocked.com'],
        });
        const result = tool.validate({
          operation: 'navigate',
          params: { url: 'https://blocked.com/page' },
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Domain 'blocked.com' is blocked");
      });

      it('should block subdomains of blocked domains', () => {
        const tool = new BrowserTool({
          blockedDomains: ['blocked.com'],
        });
        const result = tool.validate({
          operation: 'navigate',
          params: { url: 'https://sub.blocked.com/page' },
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Domain 'sub.blocked.com' is blocked");
      });

      it('should allow only allowed domains when specified', () => {
        const tool = new BrowserTool({
          allowedDomains: ['allowed.com'],
        });

        const allowedResult = tool.validate({
          operation: 'navigate',
          params: { url: 'https://allowed.com/page' },
        });
        expect(allowedResult.valid).toBe(true);

        const notAllowedResult = tool.validate({
          operation: 'navigate',
          params: { url: 'https://other.com/page' },
        });
        expect(notAllowedResult.valid).toBe(false);
        expect(notAllowedResult.errors).toContain("Domain 'other.com' is not in the allowed domains list");
      });
    });

    describe('click operation', () => {
      it('should validate valid click input', () => {
        const result = browserTool.validate({
          operation: 'click',
          params: { selector: 'button.submit' },
        });
        expect(result.valid).toBe(true);
      });

      it('should reject click without selector', () => {
        const result = browserTool.validate({
          operation: 'click',
          params: {},
        } as any);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('click operation requires a selector parameter');
      });
    });

    describe('type operation', () => {
      it('should validate valid type input', () => {
        const result = browserTool.validate({
          operation: 'type',
          params: { selector: 'input.email', text: 'test@example.com' },
        });
        expect(result.valid).toBe(true);
      });

      it('should reject type without selector', () => {
        const result = browserTool.validate({
          operation: 'type',
          params: { text: 'hello' },
        } as any);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('type operation requires a selector parameter');
      });

      it('should reject type without text', () => {
        const result = browserTool.validate({
          operation: 'type',
          params: { selector: 'input' },
        } as any);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('type operation requires a text parameter');
      });
    });

    describe('screenshot operation', () => {
      it('should validate screenshot operation', () => {
        const result = browserTool.validate({
          operation: 'screenshot',
          params: { path: './screenshot.png' },
        });
        expect(result.valid).toBe(true);
      });

      it('should reject screenshot when screenshots are disabled', () => {
        const tool = new BrowserTool({ allowScreenshots: false });
        const result = tool.validate({
          operation: 'screenshot',
          params: {},
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Screenshots are disabled');
      });
    });

    describe('evaluate operation', () => {
      it('should validate valid evaluate input', () => {
        const result = browserTool.validate({
          operation: 'evaluate',
          params: { script: 'return document.title' },
        });
        expect(result.valid).toBe(true);
      });

      it('should reject evaluate without script', () => {
        const result = browserTool.validate({
          operation: 'evaluate',
          params: {},
        } as any);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('evaluate operation requires a script parameter');
      });

      it('should reject evaluate when JavaScript execution is disabled', () => {
        const tool = new BrowserTool({ allowJavaScriptExecution: false });
        const result = tool.validate({
          operation: 'evaluate',
          params: { script: 'return 1' },
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('JavaScript execution is disabled');
      });
    });

    describe('submit operation', () => {
      it('should validate valid submit input', () => {
        const result = browserTool.validate({
          operation: 'submit',
          params: { selector: 'form.login' },
        });
        expect(result.valid).toBe(true);
      });

      it('should reject submit when form submission is disabled', () => {
        const tool = new BrowserTool({ allowFormSubmission: false });
        const result = tool.validate({
          operation: 'submit',
          params: { selector: 'form' },
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Form submission is disabled');
      });
    });

    describe('getAttribute operation', () => {
      it('should validate valid getAttribute input', () => {
        const result = browserTool.validate({
          operation: 'getAttribute',
          params: { selector: 'a.link', attribute: 'href' },
        });
        expect(result.valid).toBe(true);
      });

      it('should reject getAttribute without attribute', () => {
        const result = browserTool.validate({
          operation: 'getAttribute',
          params: { selector: 'a.link' },
        } as any);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('getAttribute operation requires an attribute parameter');
      });
    });

    describe('compareScreenshot operation', () => {
      it('should validate valid compareScreenshot input', () => {
        const result = browserTool.validate({
          operation: 'compareScreenshot',
          params: { baseline: './baseline.png' },
        });
        expect(result.valid).toBe(true);
      });

      it('should reject compareScreenshot without baseline', () => {
        const result = browserTool.validate({
          operation: 'compareScreenshot',
          params: {},
        } as any);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('compareScreenshot operation requires a baseline parameter');
      });
    });

    describe('invalid operation', () => {
      it('should reject invalid operation', () => {
        const result = browserTool.validate({
          operation: 'invalidOperation',
          params: {},
        } as any);
        expect(result.valid).toBe(false);
        expect(result.errors?.[0]).toContain('Invalid operation');
      });
    });
  });

  describe('execute', () => {
    it('should execute navigate operation', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });
      expect(result.success).toBe(true);
      expect(result.output?.operation).toBe('navigate');
      expect(result.output?.url).toBe('https://example.com');
    });

    it('should execute click operation', async () => {
      const result = await browserTool.execute({
        operation: 'click',
        params: { selector: 'button' },
      });
      expect(result.success).toBe(true);
      expect(result.output?.operation).toBe('click');
    });

    it('should execute type operation', async () => {
      const result = await browserTool.execute({
        operation: 'type',
        params: { selector: 'input', text: 'hello' },
      });
      expect(result.success).toBe(true);
      expect(result.output?.operation).toBe('type');
    });

    it('should execute screenshot operation', async () => {
      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { path: './test.png' },
      });
      expect(result.success).toBe(true);
      expect(result.output?.operation).toBe('screenshot');
    });

    it('should execute waitForSelector operation', async () => {
      const result = await browserTool.execute({
        operation: 'waitForSelector',
        params: { selector: '.element' },
      });
      expect(result.success).toBe(true);
      expect(result.output?.operation).toBe('waitForSelector');
    });

    it('should execute getText operation', async () => {
      const result = await browserTool.execute({
        operation: 'getText',
        params: { selector: '.content' },
      });
      expect(result.success).toBe(true);
      expect(result.output?.operation).toBe('getText');
    });

    it('should execute getHtml operation', async () => {
      const result = await browserTool.execute({
        operation: 'getHtml',
        params: { selector: '.container' },
      });
      expect(result.success).toBe(true);
      expect(result.output?.operation).toBe('getHtml');
    });

    it('should execute scroll operation', async () => {
      const result = await browserTool.execute({
        operation: 'scroll',
        params: { options: { y: 100 } },
      });
      expect(result.success).toBe(true);
      expect(result.output?.operation).toBe('scroll');
    });

    it('should execute hover operation', async () => {
      const result = await browserTool.execute({
        operation: 'hover',
        params: { selector: '.menu-item' },
      });
      expect(result.success).toBe(true);
      expect(result.output?.operation).toBe('hover');
    });

    it('should fail validation for invalid input', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: {},
      } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('should handle cancellation', async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await browserTool.execute(
        {
          operation: 'navigate',
          params: { url: 'https://example.com' },
        },
        { signal: controller.signal }
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution aborted');
    });
  });

  describe('withConfig', () => {
    it('should create new instance with updated config', () => {
      const original = new BrowserTool({ headless: true });
      const updated = original.withConfig({ headless: false });

      expect(original.getConfig().headless).toBe(true);
      expect(updated.getConfig().headless).toBe(false);
    });

    it('should preserve other config options', () => {
      const original = new BrowserTool({
        allowedDomains: ['example.com'],
        headless: true,
      });
      const updated = original.withConfig({ headless: false });

      expect(updated.getConfig().allowedDomains).toEqual(['example.com']);
    });
  });

  describe('lifecycle integration', () => {
    it('should start with idle state', () => {
      expect(browserTool.state).toBe('idle');
      expect(browserTool.isActive()).toBe(true);
    });

    it('should transition to active state after first execution', async () => {
      expect(browserTool.state).toBe('idle');

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(browserTool.state).toBe('active');
      expect(browserTool.isActive()).toBe(true);
    });

    it('should be unusable after cleanup', async () => {
      // Execute an operation to get to active state
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Cleanup should destroy the tool
      await browserTool.cleanupAllSessions();
      expect(browserTool.state).toBe('destroyed');
      expect(browserTool.isActive()).toBe(false);

      // Further executions should fail
      const result = await browserTool.execute({
        operation: 'click',
        params: { selector: 'button' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Browser tool has been destroyed and cannot execute operations');
    });
  });
});

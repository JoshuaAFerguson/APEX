/**
 * Unit Tests for MockBrowserSession
 *
 * This test suite comprehensively tests the MockBrowserSession implementation
 * covering all methods and scenarios specified in the acceptance criteria.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockBrowserSession } from '../test-utils';
import type { BrowserSessionConfig } from '@apexcli/core';

describe('MockBrowserSession', () => {
  let session: MockBrowserSession;
  let config: BrowserSessionConfig;

  beforeEach(() => {
    config = {
      browserType: 'chromium',
      headless: true,
      timeout: 30000,
      viewport: { width: 1920, height: 1080 },
      userAgent: 'APEX Test Agent',
      ignoreHTTPSErrors: true,
    };
    session = new MockBrowserSession(config);
  });

  describe('constructor', () => {
    it('should create a session with the provided config', () => {
      expect(session).toBeInstanceOf(MockBrowserSession);
      expect(session.isConnected).toBe(true);
      expect(session.url).toBe('about:blank');
    });

    it('should store the config internally', () => {
      // Access private config through constructor behavior verification
      const customConfig: BrowserSessionConfig = {
        browserType: 'firefox',
        headless: false,
        timeout: 10000,
      };
      const customSession = new MockBrowserSession(customConfig);
      expect(customSession).toBeInstanceOf(MockBrowserSession);
      expect(customSession.isConnected).toBe(true);
    });
  });

  describe('navigate', () => {
    it('should successfully navigate to allowed URLs', async () => {
      const result = await session.navigate('https://example.com');

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://example.com');
      expect(result.error).toBeUndefined();
      expect(session.url).toBe('https://example.com');
    });

    it('should block navigation to blocked domains', async () => {
      const result = await session.navigate('https://blocked.com/test');

      expect(result.success).toBe(false);
      expect(result.url).toBe('https://blocked.com/test');
      expect(result.error).toBe('Domain blocked');
      // URL should not be updated for blocked domains
      expect(session.url).toBe('about:blank');
    });

    it('should handle URLs containing "blocked.com" anywhere in the URL', async () => {
      const result = await session.navigate('https://example.blocked.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Domain blocked');
    });
  });

  describe('click', () => {
    it('should return default success response when no mock is set', async () => {
      const result = await session.click('#button');

      expect(result.success).toBe(true);
      expect(result.element).toBe('#button');
      expect(result.error).toBeUndefined();
    });

    it('should return custom response when setMockResponse is used', async () => {
      const mockResponse = {
        success: true,
        element: 'custom-element',
        customData: 'test-data'
      };
      session.setMockResponse('click:#submit-btn', mockResponse);

      const result = await session.click('#submit-btn');

      expect(result).toEqual(mockResponse);
    });

    it('should return error response when mock is configured for failure', async () => {
      const mockResponse = {
        success: false,
        error: 'Element not found'
      };
      session.setMockResponse('click:#missing-btn', mockResponse);

      const result = await session.click('#missing-btn');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Element not found');
    });

    it('should handle different selectors independently', async () => {
      session.setMockResponse('click:#btn1', { success: true, element: 'button1' });
      session.setMockResponse('click:#btn2', { success: false, error: 'Disabled' });

      const result1 = await session.click('#btn1');
      const result2 = await session.click('#btn2');
      const result3 = await session.click('#btn3'); // No mock set

      expect(result1.success).toBe(true);
      expect(result1.element).toBe('button1');
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Disabled');
      expect(result3.success).toBe(true);
      expect(result3.element).toBe('#btn3');
    });
  });

  describe('type', () => {
    it('should always return success for typing operations', async () => {
      const result = await session.type('#input', 'test text');

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle empty text input', async () => {
      const result = await session.type('#input', '');

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle special characters', async () => {
      const result = await session.type('#input', 'Special chars: !@#$%^&*()');

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('screenshot', () => {
    it('should return success with generated path when no filename is provided', async () => {
      const result = await session.screenshot();

      expect(result.success).toBe(true);
      expect(result.path).toMatch(/^\/tmp\/screenshots\/mock-\d+\.png$/);
      expect(result.error).toBeUndefined();
    });

    it('should return mock data path when setMockScreenshot is used', async () => {
      const mockImageData = Buffer.from('fake-image-data', 'utf8');
      session.setMockScreenshot('test-image.png', mockImageData);

      const result = await session.screenshot('test-image.png');

      expect(result.success).toBe(true);
      expect(result.path).toBe('/tmp/screenshots/test-image.png');
      expect(result.error).toBeUndefined();
    });

    it('should generate path when filename provided but no mock data exists', async () => {
      const result = await session.screenshot('unknown-image.png');

      expect(result.success).toBe(true);
      expect(result.path).toMatch(/^\/tmp\/screenshots\/mock-\d+\.png$/);
      expect(result.error).toBeUndefined();
    });

    it('should handle multiple mock screenshots', async () => {
      const mockData1 = Buffer.from('image1', 'utf8');
      const mockData2 = Buffer.from('image2', 'utf8');

      session.setMockScreenshot('image1.png', mockData1);
      session.setMockScreenshot('image2.png', mockData2);

      const result1 = await session.screenshot('image1.png');
      const result2 = await session.screenshot('image2.png');

      expect(result1.path).toBe('/tmp/screenshots/image1.png');
      expect(result2.path).toBe('/tmp/screenshots/image2.png');
    });
  });

  describe('compareScreenshot', () => {
    it('should always return success with identical comparison', async () => {
      const result = await session.compareScreenshot('baseline.png', 'current.png');

      expect(result.success).toBe(true);
      expect(result.identical).toBe(true);
      expect(result.difference).toBe(0);
      expect(result.diffPath).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it('should handle comparison with only baseline provided', async () => {
      const result = await session.compareScreenshot('baseline.png');

      expect(result.success).toBe(true);
      expect(result.identical).toBe(true);
      expect(result.difference).toBe(0);
    });

    it('should return consistent results for multiple comparisons', async () => {
      const result1 = await session.compareScreenshot('base1.png', 'current1.png');
      const result2 = await session.compareScreenshot('base2.png', 'current2.png');

      expect(result1).toEqual(result2);
      expect(result1.success).toBe(true);
      expect(result1.identical).toBe(true);
    });
  });

  describe('evaluate', () => {
    it('should return success for normal expressions', async () => {
      const result = await session.evaluate('document.title');

      expect(result.success).toBe(true);
      expect(result.result).toBe('mock evaluation result');
      expect(result.error).toBeUndefined();
    });

    it('should return error when expression contains "throw"', async () => {
      const result = await session.evaluate('throw new Error("test error")');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Script execution failed');
      expect(result.result).toBeUndefined();
    });

    it('should handle expressions with "throw" anywhere in the string', async () => {
      const result = await session.evaluate('function test() { throw error; }');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Script execution failed');
    });

    it('should handle complex expressions that do not throw', async () => {
      const result = await session.evaluate('window.location.href');

      expect(result.success).toBe(true);
      expect(result.result).toBe('mock evaluation result');
    });
  });

  describe('waitForSelector', () => {
    it('should always return success with found element', async () => {
      const result = await session.waitForSelector('#element');

      expect(result.success).toBe(true);
      expect(result.found).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle timeout parameter', async () => {
      const result = await session.waitForSelector('#element', 5000);

      expect(result.success).toBe(true);
      expect(result.found).toBe(true);
    });

    it('should handle complex selectors', async () => {
      const result = await session.waitForSelector('div.class[data-test="value"]');

      expect(result.success).toBe(true);
      expect(result.found).toBe(true);
    });
  });

  describe('getAttribute', () => {
    it('should return mock attribute values', async () => {
      const result = await session.getAttribute('#element', 'class');

      expect(result.success).toBe(true);
      expect(result.value).toBe('mock-class');
      expect(result.error).toBeUndefined();
    });

    it('should handle different attribute names', async () => {
      const classResult = await session.getAttribute('#element', 'class');
      const idResult = await session.getAttribute('#element', 'id');
      const dataResult = await session.getAttribute('#element', 'data-test');

      expect(classResult.value).toBe('mock-class');
      expect(idResult.value).toBe('mock-id');
      expect(dataResult.value).toBe('mock-data-test');
    });

    it('should work with different selectors', async () => {
      const result1 = await session.getAttribute('#element1', 'class');
      const result2 = await session.getAttribute('.class2', 'id');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.value).toBe('mock-class');
      expect(result2.value).toBe('mock-id');
    });
  });

  describe('getText', () => {
    it('should return mock text content', async () => {
      const result = await session.getText('#element');

      expect(result.success).toBe(true);
      expect(result.text).toBe('Mock element text');
      expect(result.error).toBeUndefined();
    });

    it('should return consistent text for different selectors', async () => {
      const result1 = await session.getText('#element1');
      const result2 = await session.getText('.class2');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.text).toBe('Mock element text');
      expect(result2.text).toBe('Mock element text');
    });
  });

  describe('getHtml', () => {
    it('should return mock HTML content', async () => {
      const result = await session.getHtml('#element');

      expect(result.success).toBe(true);
      expect(result.html).toBe('<html><body>Mock HTML</body></html>');
      expect(result.error).toBeUndefined();
    });

    it('should handle requests without selector', async () => {
      const result = await session.getHtml();

      expect(result.success).toBe(true);
      expect(result.html).toBe('<html><body>Mock HTML</body></html>');
    });

    it('should return same HTML regardless of selector', async () => {
      const result1 = await session.getHtml('#element');
      const result2 = await session.getHtml('body');
      const result3 = await session.getHtml();

      expect(result1.html).toBe(result2.html);
      expect(result2.html).toBe(result3.html);
    });
  });

  describe('scroll', () => {
    it('should always return success for scroll operations', async () => {
      const result = await session.scroll(0, 100);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle negative scroll values', async () => {
      const result = await session.scroll(-100, -200);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle large scroll values', async () => {
      const result = await session.scroll(9999, 9999);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle zero values', async () => {
      const result = await session.scroll(0, 0);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('hover', () => {
    it('should always return success for hover operations', async () => {
      const result = await session.hover('#element');

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle different selector types', async () => {
      const cssResult = await session.hover('#css-selector');
      const classResult = await session.hover('.class-selector');
      const xpathResult = await session.hover('//div[@id="xpath"]');

      expect(cssResult.success).toBe(true);
      expect(classResult.success).toBe(true);
      expect(xpathResult.success).toBe(true);
    });
  });

  describe('submit', () => {
    it('should always return success for submit operations', async () => {
      const result = await session.submit('#form');

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle form selectors', async () => {
      const formResult = await session.submit('form#login');
      const buttonResult = await session.submit('button[type="submit"]');

      expect(formResult.success).toBe(true);
      expect(buttonResult.success).toBe(true);
    });
  });

  describe('close', () => {
    it('should set isConnected to false when called', async () => {
      expect(session.isConnected).toBe(true);

      await session.close();

      expect(session.isConnected).toBe(false);
    });

    it('should be idempotent - safe to call multiple times', async () => {
      expect(session.isConnected).toBe(true);

      await session.close();
      expect(session.isConnected).toBe(false);

      await session.close();
      expect(session.isConnected).toBe(false);
    });
  });

  describe('mock response configuration', () => {
    it('should support setting multiple mock responses', () => {
      session.setMockResponse('click:#btn1', { success: true, element: 'button1' });
      session.setMockResponse('click:#btn2', { success: false, error: 'disabled' });
      session.setMockResponse('form:submit', { success: true, submitted: true });

      // Verify the mock system doesn't throw errors when setting responses
      expect(() => {
        session.setMockResponse('test:operation', { result: 'test' });
      }).not.toThrow();
    });

    it('should support setting multiple mock screenshots', () => {
      const buffer1 = Buffer.from('image1');
      const buffer2 = Buffer.from('image2');

      session.setMockScreenshot('screenshot1.png', buffer1);
      session.setMockScreenshot('screenshot2.png', buffer2);

      // Verify the mock system doesn't throw errors when setting screenshots
      expect(() => {
        session.setMockScreenshot('screenshot3.png', Buffer.from('image3'));
      }).not.toThrow();
    });

    it('should allow overriding existing mock responses', () => {
      const initialResponse = { success: true, data: 'initial' };
      const updatedResponse = { success: false, error: 'updated' };

      session.setMockResponse('test:operation', initialResponse);
      session.setMockResponse('test:operation', updatedResponse);

      // The mock system should accept overwrites without error
      expect(() => {
        session.setMockResponse('test:operation', { success: true, final: true });
      }).not.toThrow();
    });
  });

  describe('property access', () => {
    it('should provide public access to isConnected', () => {
      expect(session.isConnected).toBe(true);
      expect(typeof session.isConnected).toBe('boolean');
    });

    it('should provide public access to url', () => {
      expect(session.url).toBe('about:blank');
      expect(typeof session.url).toBe('string');
    });

    it('should update url property during navigation', async () => {
      expect(session.url).toBe('about:blank');

      await session.navigate('https://example.com');
      expect(session.url).toBe('https://example.com');

      // Blocked navigation should not update URL
      await session.navigate('https://blocked.com');
      expect(session.url).toBe('https://example.com');
    });
  });
});
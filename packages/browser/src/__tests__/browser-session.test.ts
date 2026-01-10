/**
 * @apexcli/browser - Browser Session Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';

describe('BrowserSession', () => {
  let manager: BrowserManager;
  let session: BrowserSession;

  beforeEach(() => {
    manager = new BrowserManager();
  });

  afterEach(async () => {
    if (session) {
      await session.close();
    }
    if (manager) {
      await manager.shutdown();
    }
  });

  describe('Session Lifecycle', () => {
    it('should create browser session', () => {
      session = new BrowserSession(manager, { browserType: 'chromium' });
      expect(session).toBeInstanceOf(BrowserSession);
    });

    it('should launch browser session', async () => {
      session = new BrowserSession(manager, { browserType: 'chromium', headless: true });

      const result = await session.launch();
      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should close browser session', async () => {
      session = new BrowserSession(manager, { browserType: 'chromium', headless: true });
      await session.launch();

      const result = await session.close();
      expect(result.success).toBe(true);
    });
  });

  describe('Page Navigation', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, { browserType: 'chromium', headless: true });
      await session.launch();
    });

    it('should navigate to URL', async () => {
      const result = await session.navigate('data:text/html,<h1>Test Page</h1>');
      expect(result.success).toBe(true);
      expect(result.data).toContain('data:text/html');
    });

    it('should get current URL', async () => {
      await session.navigate('data:text/html,<h1>Test</h1>');
      const url = session.getCurrentUrl();
      expect(url).toContain('data:text/html');
    });

    it('should get page title', async () => {
      await session.navigate('data:text/html,<title>Test Title</title><h1>Test</h1>');
      const result = await session.getTitle();
      expect(result.success).toBe(true);
      expect(result.data).toBe('Test Title');
    });
  });

  describe('Element Interaction', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, { browserType: 'chromium', headless: true });
      await session.launch();
    });

    it('should get text content from element', async () => {
      await session.navigate('data:text/html,<div id="test">Hello World</div>');
      const result = await session.getText('#test');
      expect(result.success).toBe(true);
      expect(result.data).toBe('Hello World');
    });

    it('should click on element', async () => {
      const html = `
        <button id="btn" onclick="this.textContent='Clicked'">Click Me</button>
      `;
      await session.navigate(`data:text/html,${html}`);

      const clickResult = await session.click('#btn');
      expect(clickResult.success).toBe(true);

      const textResult = await session.getText('#btn');
      expect(textResult.data).toBe('Clicked');
    });

    it('should type text into element', async () => {
      const html = '<input id="input" type="text" />';
      await session.navigate(`data:text/html,${html}`);

      const typeResult = await session.type('#input', 'Hello World');
      expect(typeResult.success).toBe(true);

      const value = await session.evaluate(() => {
        return (document.getElementById('input') as HTMLInputElement).value;
      });
      expect(value.data).toBe('Hello World');
    });

    it('should wait for element to be visible', async () => {
      const html = `
        <div id="delayed" style="display:none">Hidden Element</div>
        <script>
          setTimeout(() => {
            document.getElementById('delayed').style.display = 'block';
          }, 100);
        </script>
      `;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.waitForElement('#delayed', { timeout: 5000 });
      expect(result.success).toBe(true);
    });
  });

  describe('Screenshots', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, { browserType: 'chromium', headless: true });
      await session.launch();
    });

    it('should capture screenshot', async () => {
      await session.navigate('data:text/html,<h1>Screenshot Test</h1>');

      const result = await session.screenshot({ type: 'png' });
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it('should capture full page screenshot', async () => {
      const html = `
        <div style="height: 2000px; background: linear-gradient(red, blue);">
          <h1>Long Page</h1>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.screenshot({ fullPage: true });
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
    });
  });

  describe('JavaScript Evaluation', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, { browserType: 'chromium', headless: true });
      await session.launch();
    });

    it('should evaluate JavaScript', async () => {
      await session.navigate('data:text/html,<h1>Test</h1>');

      const result = await session.evaluate(() => {
        return document.title || 'No title';
      });

      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('string');
    });

    it('should evaluate JavaScript with return value', async () => {
      await session.navigate('data:text/html,<h1>Test</h1>');

      const result = await session.evaluate(() => {
        return { message: 'Hello from browser', timestamp: Date.now() };
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('message');
      expect(result.data).toHaveProperty('timestamp');
    });
  });

  describe('Scroll Operations', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, { browserType: 'chromium', headless: true });
      await session.launch();
    });

    it('should scroll page', async () => {
      const html = `
        <div style="height: 2000px;">
          <h1>Scroll Test</h1>
          <div id="bottom" style="position: absolute; top: 1500px;">Bottom</div>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.scroll({ y: 1000 });
      expect(result.success).toBe(true);
    });

    it('should scroll element into view', async () => {
      const html = `
        <div style="height: 1000px;">Top</div>
        <div id="target">Target Element</div>
        <div style="height: 1000px;">Bottom</div>
      `;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.scroll({ selector: '#target' });
      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle operations before launch', async () => {
      session = new BrowserSession(manager, { browserType: 'chromium', headless: true });

      const result = await session.navigate('https://example.com');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Browser not launched');
    });

    it('should handle invalid selectors', async () => {
      session = new BrowserSession(manager, { browserType: 'chromium', headless: true });
      await session.launch();
      await session.navigate('data:text/html,<h1>Test</h1>');

      const result = await session.getText('#nonexistent');
      expect(result.success).toBe(false);
    });
  });

  describe('Console and Error Capture', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
      });
      await session.launch();
    });

    it('should capture console messages', async () => {
      const html = `
        <script>
          console.log('Test log message');
          console.warn('Test warning');
          console.error('Test error');
        </script>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Wait a bit for console messages to be captured
      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      expect(messages.length).toBeGreaterThan(0);
    });

    it('should clear captured data', async () => {
      const html = `<script>console.log('Test');</script>`;
      await session.navigate(`data:text/html,${html}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      session.clearCapturedData();
      const messages = session.getCapturedConsoleMessages();
      expect(messages).toHaveLength(0);
    });
  });

  describe('Configuration', () => {
    it('should update capture configuration', () => {
      session = new BrowserSession(manager);

      session.updateCaptureConfig({
        captureConsole: false,
        maxBufferSize: 500,
      });

      const config = session.getCaptureConfig();
      expect(config.captureConsole).toBe(false);
      expect(config.maxBufferSize).toBe(500);
    });
  });

  describe('Playwright Object Access', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, { browserType: 'chromium', headless: true });
      await session.launch();
    });

    it('should provide access to Playwright page object', () => {
      const page = session.getPage();
      expect(page).toBeDefined();
      expect(typeof page?.goto).toBe('function');
    });

    it('should provide access to Playwright context object', () => {
      const context = session.getContext();
      expect(context).toBeDefined();
      expect(typeof context?.newPage).toBe('function');
    });

    it('should provide access to Playwright browser object', () => {
      const browser = session.getBrowser();
      expect(browser).toBeDefined();
      expect(typeof browser?.newContext).toBe('function');
    });
  });
});
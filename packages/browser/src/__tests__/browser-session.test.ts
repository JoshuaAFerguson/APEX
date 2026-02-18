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

    it('should navigate using goto method (alias for navigate)', async () => {
      const result = await session.goto('data:text/html,<h1>Goto Test</h1>');
      expect(result.success).toBe(true);
      expect(result.data).toContain('data:text/html');
    });

    it('should reload the current page', async () => {
      await session.navigate('data:text/html,<h1>Before Reload</h1>');
      const reloadResult = await session.reload();
      expect(reloadResult.success).toBe(true);
      expect(reloadResult.data).toContain('data:text/html');
    });

    it('should navigate back in history', async () => {
      // Navigate to first page
      await session.navigate('data:text/html,<h1>Page 1</h1>');
      // Navigate to second page
      await session.navigate('data:text/html,<h1>Page 2</h1>');

      // Go back to first page
      const result = await session.goBack();
      expect(result.success).toBe(true);
      expect(result.data).toContain('data:text/html');
    });

    it('should return null when going back with no history', async () => {
      // Navigate to only one page
      await session.navigate('data:text/html,<h1>Only Page</h1>');

      // Try to go back (should return null)
      const result = await session.goBack();
      expect(result.success).toBe(true);
      expect(result.data).toBe(null);
    });

    it('should navigate forward in history', async () => {
      // Navigate to first page
      await session.navigate('data:text/html,<h1>Page 1</h1>');
      // Navigate to second page
      await session.navigate('data:text/html,<h1>Page 2</h1>');

      // Go back
      await session.goBack();

      // Go forward to second page again
      const result = await session.goForward();
      expect(result.success).toBe(true);
      expect(result.data).toContain('data:text/html');
    });

    it('should return null when going forward with no forward history', async () => {
      // Navigate to a page (no forward history)
      await session.navigate('data:text/html,<h1>Current Page</h1>');

      // Try to go forward (should return null)
      const result = await session.goForward();
      expect(result.success).toBe(true);
      expect(result.data).toBe(null);
    });

    it('should wait for navigation to complete', async () => {
      // Navigate to initial page
      await session.navigate('data:text/html,<h1>Initial Page</h1>');

      // Start a navigation in the background and wait for it
      const navigationPromise = session.evaluate(() => {
        setTimeout(() => {
          window.location.href = 'data:text/html,<h1>New Page</h1>';
        }, 100);
      });

      const waitPromise = session.waitForNavigation({ timeout: 5000 });

      await navigationPromise;
      const result = await waitPromise;

      expect(result.success).toBe(true);
      expect(result.data).toContain('data:text/html');
    });

    it('should wait for navigation with specific URL pattern', async () => {
      await session.navigate('data:text/html,<h1>Initial</h1>');

      // Use waitForNavigation with URL pattern
      const waitResult = await session.waitForNavigation({
        url: 'data:*',
        timeout: 1000
      });

      expect(waitResult.success).toBe(true);
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

    it('should handle navigation methods before launch', async () => {
      session = new BrowserSession(manager, { browserType: 'chromium', headless: true });

      const gotoResult = await session.goto('https://example.com');
      expect(gotoResult.success).toBe(false);
      expect(gotoResult.error).toContain('Browser not launched');

      const reloadResult = await session.reload();
      expect(reloadResult.success).toBe(false);
      expect(reloadResult.error).toContain('Browser not launched');

      const backResult = await session.goBack();
      expect(backResult.success).toBe(false);
      expect(backResult.error).toContain('Browser not launched');

      const forwardResult = await session.goForward();
      expect(forwardResult.success).toBe(false);
      expect(forwardResult.error).toContain('Browser not launched');

      const waitResult = await session.waitForNavigation();
      expect(waitResult.success).toBe(false);
      expect(waitResult.error).toContain('Browser not launched');
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

  describe('Element Interaction Methods', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, { browserType: 'chromium', headless: true });
      await session.launch();
    });

    it('should hover over an element', async () => {
      const html = `
        <div id="hover-target" style="width: 100px; height: 100px; background: red;">
          Hover me
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.hover('#hover-target');
      expect(result.success).toBe(true);
      expect(typeof result.duration).toBe('number');
    });

    it('should focus on an element', async () => {
      const html = `
        <input id="focus-target" type="text" placeholder="Focus me">
      `;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.focus('#focus-target');
      expect(result.success).toBe(true);
      expect(typeof result.duration).toBe('number');
    });

    it('should handle hover with timeout option', async () => {
      const html = `
        <div id="hover-target" style="width: 100px; height: 100px; background: red;">
          Hover me
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.hover('#hover-target', { timeout: 5000 });
      expect(result.success).toBe(true);
    });

    it('should handle focus with timeout option', async () => {
      const html = `
        <input id="focus-target" type="text" placeholder="Focus me">
      `;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.focus('#focus-target', { timeout: 5000 });
      expect(result.success).toBe(true);
    });

    it('should fail hover when element not found', async () => {
      await session.navigate('data:text/html,<h1>No hover target</h1>');

      const result = await session.hover('#nonexistent');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail focus when element not found', async () => {
      await session.navigate('data:text/html,<h1>No focus target</h1>');

      const result = await session.focus('#nonexistent');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
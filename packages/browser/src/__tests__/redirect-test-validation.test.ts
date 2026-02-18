/**
 * Quick validation test for redirect handling functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createBrowserSession, BrowserSession } from '../index.js';

describe('Redirect Test Validation', () => {
  let session: BrowserSession;

  beforeEach(async () => {
    session = createBrowserSession({
      headless: true,
      timeout: 10000,
    });
    await session.launch();
  });

  afterEach(async () => {
    if (session) {
      await session.close();
    }
  });

  it('should create browser session successfully', async () => {
    expect(session).toBeDefined();
    expect(typeof session.getCurrentUrl).toBe('function');
    expect(typeof session.navigate).toBe('function');
    expect(typeof session.getTitle).toBe('function');
    expect(typeof session.getText).toBe('function');
  });

  it('should handle basic navigation and URL retrieval', async () => {
    // Test with a basic data URL
    const testHtml = '<html><head><title>Test Page</title></head><body><h1>Test Content</h1></body></html>';
    const dataUrl = `data:text/html,${encodeURIComponent(testHtml)}`;

    const result = await session.navigate(dataUrl);
    expect(result.success).toBe(true);

    const currentUrl = session.getCurrentUrl();
    expect(currentUrl).toBeTruthy();
    expect(currentUrl).toContain('data:text/html');

    const titleResult = await session.getTitle();
    expect(titleResult.success).toBe(true);
    expect(titleResult.data).toBe('Test Page');
  });

  it('should handle JavaScript redirects with data URLs', async () => {
    const redirectHtml = `
      <html>
        <head><title>Redirect Source</title></head>
        <body>
          <h1>Redirecting...</h1>
          <script>
            setTimeout(() => {
              window.location.href = 'data:text/html,' + encodeURIComponent(
                '<html><head><title>Redirect Target</title></head><body><h1>Success</h1></body></html>'
              );
            }, 100);
          </script>
        </body>
      </html>
    `;

    const result = await session.navigate(`data:text/html,${encodeURIComponent(redirectHtml)}`);
    expect(result.success).toBe(true);

    // Wait for JavaScript redirect
    await session.waitForNavigation({ timeout: 5000 });

    const currentUrl = session.getCurrentUrl();
    expect(currentUrl).toContain('data:text/html');

    const titleResult = await session.getTitle();
    expect(titleResult.success).toBe(true);
    expect(titleResult.data).toBe('Redirect Target');
  }, 10000);
});
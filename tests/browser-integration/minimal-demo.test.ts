/**
 * @fileoverview Minimal browser integration test demonstration
 *
 * This test demonstrates the most basic browser automation functionality
 * without complex dependencies to ensure the infrastructure is working.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

describe('Minimal Browser Integration Demo', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeEach(async () => {
    // Create browser instance
    browser = await chromium.launch({
      headless: true,
    });

    // Create browser context
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    // Create page
    page = await context.newPage();
  });

  afterEach(async () => {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  });

  it('should create browser instances successfully', async () => {
    expect(browser).toBeDefined();
    expect(context).toBeDefined();
    expect(page).toBeDefined();

    // Verify browser is running
    const isConnected = browser.isConnected();
    expect(isConnected).toBe(true);
  });

  it('should navigate to a simple test page', async () => {
    // Create a simple test page using data URL
    const testHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test Page</title>
      </head>
      <body>
        <h1 id="heading">Hello World</h1>
        <button id="test-button">Click Me</button>
        <input id="test-input" type="text" placeholder="Enter text">
        <div id="output">Initial content</div>
        <script>
          document.getElementById('test-button').addEventListener('click', function() {
            document.getElementById('output').textContent = 'Button clicked at ' + new Date().toISOString();
          });
        </script>
      </body>
      </html>
    `;

    // Navigate to the test page
    await page.setContent(testHTML);
    await page.waitForLoadState('domcontentloaded');

    // Verify page loaded correctly
    const title = await page.title();
    expect(title).toBe('Test Page');

    const heading = await page.textContent('#heading');
    expect(heading).toBe('Hello World');
  });

  it('should interact with DOM elements', async () => {
    // Set up test page
    const testHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Interactive Test</title>
      </head>
      <body>
        <button id="test-button">Click Me</button>
        <input id="test-input" type="text" placeholder="Enter text">
        <div id="output">Initial content</div>
        <script>
          document.getElementById('test-button').addEventListener('click', function() {
            document.getElementById('output').textContent = 'Button clicked!';
          });
        </script>
      </body>
      </html>
    `;

    await page.setContent(testHTML);
    await page.waitForLoadState('domcontentloaded');

    // Test button click
    await page.click('#test-button');
    const outputText = await page.textContent('#output');
    expect(outputText).toBe('Button clicked!');

    // Test input field
    await page.fill('#test-input', 'Test input value');
    const inputValue = await page.inputValue('#test-input');
    expect(inputValue).toBe('Test input value');
  });

  it('should wait for elements to be visible', async () => {
    // Set up test page with delayed element
    const testHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Wait Test</title>
      </head>
      <body>
        <div id="initial">Initial content</div>
        <div id="delayed" style="display: none;">Delayed content</div>
        <script>
          setTimeout(function() {
            document.getElementById('delayed').style.display = 'block';
          }, 500);
        </script>
      </body>
      </html>
    `;

    await page.setContent(testHTML);
    await page.waitForLoadState('domcontentloaded');

    // Wait for the delayed element to become visible
    await page.waitForSelector('#delayed', { state: 'visible', timeout: 2000 });

    const delayedText = await page.textContent('#delayed');
    expect(delayedText).toBe('Delayed content');
  });

  it('should capture screenshots', async () => {
    // Set up colorful test page
    const testHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Screenshot Test</title>
        <style>
          body {
            background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
            color: white;
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
          }
          h1 {
            font-size: 3rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
          }
        </style>
      </head>
      <body>
        <h1>APEX Browser Test</h1>
        <p>This is a screenshot test page</p>
      </body>
      </html>
    `;

    await page.setContent(testHTML);
    await page.waitForLoadState('domcontentloaded');

    // Take a screenshot
    const screenshot = await page.screenshot({
      fullPage: true,
      type: 'png',
    });

    // Verify screenshot was created and has content
    expect(screenshot).toBeDefined();
    expect(screenshot.length).toBeGreaterThan(0);
  });

  it('should handle JavaScript execution', async () => {
    // Set up test page
    const testHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>JavaScript Test</title>
      </head>
      <body>
        <div id="content">Original content</div>
      </body>
      </html>
    `;

    await page.setContent(testHTML);
    await page.waitForLoadState('domcontentloaded');

    // Execute JavaScript in page context
    const result = await page.evaluate(() => {
      document.getElementById('content').textContent = 'Modified by JavaScript';
      return {
        title: document.title,
        url: window.location.href,
        modified: document.getElementById('content').textContent,
      };
    });

    expect(result.title).toBe('JavaScript Test');
    expect(result.modified).toBe('Modified by JavaScript');

    // Verify the change persisted in the DOM
    const contentText = await page.textContent('#content');
    expect(contentText).toBe('Modified by JavaScript');
  });

  it('should handle console messages', async () => {
    const consoleMessages: Array<{ type: string; text: string }> = [];

    // Set up console message listener
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Set up test page with console messages
    const testHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Console Test</title>
      </head>
      <body>
        <h1>Console Message Test</h1>
        <script>
          console.log('Test log message');
          console.warn('Test warning message');
          console.error('Test error message');
        </script>
      </body>
      </html>
    `;

    await page.setContent(testHTML);
    await page.waitForLoadState('domcontentloaded');

    // Wait a bit for console messages to be captured
    await page.waitForTimeout(500);

    // Verify console messages were captured
    expect(consoleMessages.length).toBeGreaterThan(0);

    const logMessage = consoleMessages.find(msg => msg.type === 'log' && msg.text.includes('Test log message'));
    const warnMessage = consoleMessages.find(msg => msg.type === 'warning' && msg.text.includes('Test warning message'));
    const errorMessage = consoleMessages.find(msg => msg.type === 'error' && msg.text.includes('Test error message'));

    expect(logMessage).toBeDefined();
    expect(warnMessage).toBeDefined();
    expect(errorMessage).toBeDefined();
  });

  it('should handle multiple elements and selectors', async () => {
    // Set up test page with multiple elements
    const testHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Multi-element Test</title>
      </head>
      <body>
        <div class="test-container">
          <button class="action-btn" id="btn1">Button 1</button>
          <button class="action-btn" id="btn2">Button 2</button>
          <button class="action-btn" id="btn3">Button 3</button>
        </div>
        <ul id="list">
          <li data-value="1">Item 1</li>
          <li data-value="2">Item 2</li>
          <li data-value="3">Item 3</li>
        </ul>
      </body>
      </html>
    `;

    await page.setContent(testHTML);
    await page.waitForLoadState('domcontentloaded');

    // Count elements
    const buttonCount = await page.locator('.action-btn').count();
    expect(buttonCount).toBe(3);

    const listItemCount = await page.locator('li').count();
    expect(listItemCount).toBe(3);

    // Test different selector types
    const containerExists = await page.locator('.test-container').isVisible();
    expect(containerExists).toBe(true);

    const btn2Text = await page.textContent('#btn2');
    expect(btn2Text).toBe('Button 2');

    const item2Value = await page.getAttribute('li[data-value="2"]', 'data-value');
    expect(item2Value).toBe('2');
  });
});
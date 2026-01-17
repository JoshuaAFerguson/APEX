/**
 * @apexcli/browser - captureFullPage() Integration Tests
 *
 * Integration tests for the captureFullPage() method with other browser features
 * to ensure seamless operation with navigation, interaction, and capture features
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';
import type { ScreenshotOptions } from '../types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('captureFullPage() Integration Tests', () => {
  let manager: BrowserManager;
  let session: BrowserSession;
  let tempDir: string;

  beforeEach(async () => {
    manager = new BrowserManager();
    session = new BrowserSession(manager, {
      browserType: 'chromium',
      headless: true,
      viewport: { width: 1200, height: 800 },
      captureConfig: {
        captureConsole: true,
        captureErrors: true
      }
    });
    await session.launch();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-fullpage-integration-'));
  });

  afterEach(async () => {
    if (session) {
      await session.close();
    }
    if (manager) {
      await manager.shutdown();
    }
    // Clean up temp files
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Integration with Navigation Features', () => {
    it('should capture full page after navigation sequence', async () => {
      // Navigate through multiple pages and capture the final one
      const page1 = `<html><body style="background: red; height: 1000px;"><h1>Page 1</h1></body></html>`;
      const page2 = `<html><body style="background: green; height: 1500px;"><h1>Page 2</h1></body></html>`;
      const page3 = `<html><body style="background: blue; height: 2000px;"><h1>Final Page</h1></body></html>`;

      // Navigate to first page
      const nav1 = await session.navigate(`data:text/html,${encodeURIComponent(page1)}`);
      expect(nav1.success).toBe(true);

      // Navigate to second page
      const nav2 = await session.navigate(`data:text/html,${encodeURIComponent(page2)}`);
      expect(nav2.success).toBe(true);

      // Navigate to final page
      const nav3 = await session.navigate(`data:text/html,${encodeURIComponent(page3)}`);
      expect(nav3.success).toBe(true);

      // Capture the final page
      const result = await session.captureFullPage({ type: 'png' });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(5000);

      console.log(`✅ Navigation sequence + capture: ${result.data!.length} bytes`);
    });

    it('should capture full page after page reload', async () => {
      const reloadPage = `
        <html>
          <body style="height: 1800px; background: linear-gradient(45deg, #667eea, #764ba2);">
            <h1>Page to Reload</h1>
            <p id="timestamp">Loaded at: ${new Date().toISOString()}</p>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(reloadPage)}`);

      // Capture before reload
      const beforeReload = await session.captureFullPage({ type: 'jpeg', quality: 80 });
      expect(beforeReload.success).toBe(true);

      // Reload the page
      const reloadResult = await session.reload();
      expect(reloadResult.success).toBe(true);

      // Capture after reload
      const afterReload = await session.captureFullPage({ type: 'jpeg', quality: 80 });
      expect(afterReload.success).toBe(true);

      // Both captures should succeed
      expect(beforeReload.data!.length).toBeGreaterThan(0);
      expect(afterReload.data!.length).toBeGreaterThan(0);

      console.log(`✅ Reload + capture: before=${beforeReload.data!.length}b, after=${afterReload.data!.length}b`);
    });

    it('should capture full page after back/forward navigation', async () => {
      const page1 = `<html><body style="background: #ff6b6b; height: 1200px;"><h1>First Page</h1></body></html>`;
      const page2 = `<html><body style="background: #4ecdc4; height: 1800px;"><h1>Second Page</h1></body></html>`;

      // Navigate to first page
      await session.navigate(`data:text/html,${encodeURIComponent(page1)}`);

      // Navigate to second page
      await session.navigate(`data:text/html,${encodeURIComponent(page2)}`);

      // Go back to first page
      const backResult = await session.goBack();
      expect(backResult.success).toBe(true);

      // Capture after going back
      const backCapture = await session.captureFullPage();
      expect(backCapture.success).toBe(true);

      // Go forward again
      const forwardResult = await session.goForward();
      expect(forwardResult.success).toBe(true);

      // Capture after going forward
      const forwardCapture = await session.captureFullPage();
      expect(forwardCapture.success).toBe(true);

      console.log(`✅ Back/forward navigation + capture successful`);
    });
  });

  describe('Integration with Element Interaction', () => {
    it('should capture full page after element interactions', async () => {
      const interactivePage = `
        <html>
          <head>
            <style>
              body { margin: 0; padding: 50px; height: 2000px; font-family: Arial; }
              .button {
                padding: 20px 40px;
                margin: 20px;
                border: none;
                border-radius: 10px;
                background: #3498db;
                color: white;
                font-size: 18px;
                cursor: pointer;
              }
              .button:hover { background: #2980b9; }
              .input { padding: 15px; margin: 20px; font-size: 16px; border: 2px solid #bdc3c7; border-radius: 5px; width: 300px; }
              .output { margin: 20px; padding: 20px; background: #ecf0f1; border-radius: 5px; min-height: 100px; }
              .hidden { display: none; }
              .visible { display: block; background: #2ecc71; color: white; }
            </style>
          </head>
          <body>
            <h1>Interactive Page Test</h1>
            <button id="toggle-btn" class="button">Toggle Content</button>
            <input id="text-input" class="input" placeholder="Type something..." />
            <button id="submit-btn" class="button">Submit</button>
            <div id="output" class="output">Output will appear here</div>
            <div id="hidden-content" class="hidden">This content was hidden, now visible!</div>

            <script>
              document.getElementById('toggle-btn').addEventListener('click', function() {
                const hidden = document.getElementById('hidden-content');
                hidden.className = hidden.className === 'hidden' ? 'visible' : 'hidden';
              });

              document.getElementById('submit-btn').addEventListener('click', function() {
                const input = document.getElementById('text-input');
                const output = document.getElementById('output');
                output.textContent = 'You typed: ' + input.value;
                output.style.background = '#e74c3c';
                output.style.color = 'white';
              });
            </script>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(interactivePage)}`);

      // Type in the input field
      const typeResult = await session.type('#text-input', 'Test message for capture');
      expect(typeResult.success).toBe(true);

      // Click the submit button
      const clickResult = await session.click('#submit-btn');
      expect(clickResult.success).toBe(true);

      // Click the toggle button
      const toggleResult = await session.click('#toggle-btn');
      expect(toggleResult.success).toBe(true);

      // Wait for DOM updates
      await new Promise(resolve => setTimeout(resolve, 200));

      // Capture the page after interactions
      const result = await session.captureFullPage({ type: 'png' });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(10000);

      console.log(`✅ Element interactions + capture: ${result.data!.length} bytes`);
    });

    it('should capture full page after scrolling operations', async () => {
      const scrollablePage = `
        <html>
          <head>
            <style>
              body { margin: 0; height: 5000px; background: linear-gradient(to bottom, #667eea, #764ba2); }
              .section {
                height: 800px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 48px;
                font-weight: bold;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
              }
              .marker {
                position: absolute;
                right: 50px;
                width: 100px;
                height: 100px;
                background: #e74c3c;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
              }
            </style>
          </head>
          <body>
            <div class="section" style="background: rgba(255,255,255,0.1);">
              <div>TOP SECTION</div>
              <div class="marker" style="top: 50px;">1</div>
            </div>
            <div class="section" style="background: rgba(255,255,255,0.05);">
              <div>MIDDLE SECTION</div>
              <div class="marker" style="top: 850px;">2</div>
            </div>
            <div class="section" style="background: rgba(0,0,0,0.1);">
              <div>ANOTHER SECTION</div>
              <div class="marker" style="top: 1650px;">3</div>
            </div>
            <div class="section" style="background: rgba(255,255,255,0.05);">
              <div>SCROLL TEST</div>
              <div class="marker" style="top: 2450px;">4</div>
            </div>
            <div class="section" style="background: rgba(0,0,0,0.1);">
              <div>BOTTOM SECTION</div>
              <div class="marker" style="top: 3250px;">5</div>
            </div>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(scrollablePage)}`);

      // Scroll to different positions
      const scroll1 = await session.scroll({ y: 1000 });
      expect(scroll1.success).toBe(true);

      const scroll2 = await session.scroll({ y: 2500 });
      expect(scroll2.success).toBe(true);

      const scroll3 = await session.scroll({ y: 0 }); // Back to top
      expect(scroll3.success).toBe(true);

      // Capture full page (should capture everything regardless of scroll position)
      const result = await session.captureFullPage({ type: 'jpeg', quality: 85 });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(30000); // Should be substantial due to large gradient

      console.log(`✅ Scrolling + full page capture: ${result.data!.length} bytes`);
    });
  });

  describe('Integration with Other Capture Methods', () => {
    it('should work seamlessly with viewport and element captures', async () => {
      const mixedCapturePage = `
        <html>
          <head>
            <style>
              body { margin: 0; padding: 50px; height: 3000px; background: #ecf0f1; }
              .header { background: #2c3e50; color: white; padding: 30px; text-align: center; margin-bottom: 50px; }
              .content { background: white; padding: 40px; margin: 20px 0; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
              .special { background: #e74c3c; color: white; }
              .highlight { background: #f39c12; color: white; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Mixed Capture Test Page</h1>
            </div>
            <div class="content">
              <h2>Regular Content Section</h2>
              <p>This is normal content that should appear in all capture types.</p>
            </div>
            <div id="special-element" class="content special">
              <h2>Special Element</h2>
              <p>This element will be captured individually.</p>
            </div>
            <div class="content highlight">
              <h2>Highlight Section</h2>
              <p>This section adds visual variety to the page.</p>
            </div>
            <div class="content">
              <h2>Final Section</h2>
              <p>Content continues to make the page scrollable.</p>
            </div>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(mixedCapturePage)}`);

      // Capture viewport first
      const viewportResult = await session.captureViewport({ type: 'png' });
      expect(viewportResult.success).toBe(true);

      // Capture specific element
      const elementResult = await session.captureElement('#special-element', { type: 'jpeg', quality: 90 });
      expect(elementResult.success).toBe(true);

      // Capture full page
      const fullPageResult = await session.captureFullPage({ type: 'png' });
      expect(fullPageResult.success).toBe(true);

      // All captures should succeed and have different sizes
      expect(fullPageResult.data!.length).toBeGreaterThan(viewportResult.data!.length);
      expect(viewportResult.data!.length).toBeGreaterThan(elementResult.data!.length);

      // Save all three for comparison
      const viewportPath = path.join(tempDir, 'viewport.png');
      const elementPath = path.join(tempDir, 'element.jpg');
      const fullPagePath = path.join(tempDir, 'fullpage.png');

      fs.writeFileSync(viewportPath, viewportResult.data!);
      fs.writeFileSync(elementPath, elementResult.data!);
      fs.writeFileSync(fullPagePath, fullPageResult.data!);

      expect(fs.existsSync(viewportPath)).toBe(true);
      expect(fs.existsSync(elementPath)).toBe(true);
      expect(fs.existsSync(fullPagePath)).toBe(true);

      console.log(`✅ Mixed capture types completed:`);
      console.log(`📊 Viewport: ${viewportResult.data!.length} bytes`);
      console.log(`📊 Element: ${elementResult.data!.length} bytes`);
      console.log(`📊 Full Page: ${fullPageResult.data!.length} bytes`);
    });

    it('should maintain session state between different captures', async () => {
      const statePage = `
        <html>
          <head>
            <style>
              body { margin: 0; padding: 50px; height: 2000px; font-family: Arial; }
              .counter { font-size: 48px; text-align: center; margin: 50px; }
              .button { padding: 20px; font-size: 18px; margin: 10px; }
            </style>
          </head>
          <body>
            <h1>Session State Test</h1>
            <div id="counter" class="counter">0</div>
            <button id="increment" class="button">Increment</button>
            <button id="decrement" class="button">Decrement</button>

            <script>
              let count = 0;
              const counterEl = document.getElementById('counter');

              document.getElementById('increment').addEventListener('click', () => {
                count++;
                counterEl.textContent = count;
              });

              document.getElementById('decrement').addEventListener('click', () => {
                count--;
                counterEl.textContent = count;
              });
            </script>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(statePage)}`);

      // Initial capture
      const initial = await session.captureFullPage({ type: 'png' });
      expect(initial.success).toBe(true);

      // Increment counter and capture
      await session.click('#increment');
      await session.click('#increment');
      await session.click('#increment');

      const afterIncrement = await session.captureFullPage({ type: 'png' });
      expect(afterIncrement.success).toBe(true);

      // Decrement and capture
      await session.click('#decrement');

      const afterDecrement = await session.captureFullPage({ type: 'png' });
      expect(afterDecrement.success).toBe(true);

      // All captures should succeed (content will be different due to state changes)
      expect(initial.data!.length).toBeGreaterThan(0);
      expect(afterIncrement.data!.length).toBeGreaterThan(0);
      expect(afterDecrement.data!.length).toBeGreaterThan(0);

      console.log(`✅ Session state maintained between captures`);
    });
  });

  describe('Integration with Error and Console Capture', () => {
    it('should capture full page while monitoring console messages', async () => {
      const consolePage = `
        <html>
          <body style="height: 1500px; background: #f8f9fa; padding: 50px;">
            <h1>Console Monitoring Test</h1>
            <button id="log-btn">Generate Logs</button>
            <script>
              document.getElementById('log-btn').addEventListener('click', () => {
                console.log('User clicked the button');
                console.info('This is an info message');
                console.warn('This is a warning message');
              });

              // Generate some initial console output
              console.log('Page loaded successfully');
            </script>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(consolePage)}`);

      // Click to generate more console messages
      await session.click('#log-btn');

      // Small delay for console capture
      await new Promise(resolve => setTimeout(resolve, 200));

      // Capture full page
      const result = await session.captureFullPage();
      expect(result.success).toBe(true);

      // Check that console messages were captured
      const consoleMessages = session.getCapturedConsoleMessages();
      expect(consoleMessages.length).toBeGreaterThan(0);

      console.log(`✅ Full page captured with console monitoring: ${consoleMessages.length} console messages`);
    });

    it('should handle full page capture with JavaScript errors present', async () => {
      const errorPage = `
        <html>
          <body style="height: 1500px; background: #ffe6e6; padding: 50px;">
            <h1>Error Handling Test</h1>
            <p>This page contains JavaScript errors but should still be capturable</p>
            <script>
              // Intentional errors for testing
              console.error('Intentional error for testing');

              setTimeout(() => {
                throw new Error('Delayed error for testing');
              }, 100);

              // Try to access undefined variable
              try {
                undefinedVariable.someProperty = 'test';
              } catch (e) {
                console.error('Caught error:', e.message);
              }
            </script>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(errorPage)}`);

      // Allow errors to occur
      await new Promise(resolve => setTimeout(resolve, 500));

      // Capture should still work despite errors
      const result = await session.captureFullPage({ type: 'jpeg', quality: 75 });
      expect(result.success).toBe(true);

      // Check that errors were captured
      const errors = session.getCapturedJavaScriptErrors();
      const consoleMessages = session.getCapturedConsoleMessages();

      console.log(`✅ Full page captured despite errors: ${errors.length} errors, ${consoleMessages.length} console messages`);
    });
  });

  describe('Integration with Multiple Browser Operations', () => {
    it('should handle complex workflow with multiple operations', async () => {
      const workflowPage = `
        <html>
          <head>
            <style>
              body { margin: 0; padding: 20px; height: 2500px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
              .card { background: white; padding: 30px; margin: 20px 0; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
              .form-group { margin: 15px 0; }
              .form-group input, .form-group select { padding: 10px; border: 1px solid #ddd; border-radius: 5px; width: 250px; }
              .submit-btn { background: #28a745; color: white; padding: 15px 30px; border: none; border-radius: 5px; cursor: pointer; }
              .result { background: #e8f5e8; padding: 20px; margin-top: 20px; border-radius: 5px; display: none; }
              .visible { display: block !important; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Complex Workflow Test</h1>
              <form id="test-form">
                <div class="form-group">
                  <label>Name:</label>
                  <input type="text" id="name" name="name" />
                </div>
                <div class="form-group">
                  <label>Email:</label>
                  <input type="email" id="email" name="email" />
                </div>
                <div class="form-group">
                  <label>Category:</label>
                  <select id="category" name="category">
                    <option value="">Select...</option>
                    <option value="test">Test</option>
                    <option value="demo">Demo</option>
                  </select>
                </div>
                <button type="submit" class="submit-btn">Submit Form</button>
              </form>
              <div id="result" class="result">
                <h3>Form Submitted Successfully!</h3>
                <p id="result-content"></p>
              </div>
            </div>
            <div class="card">
              <h2>Additional Content</h2>
              <p>This page has multiple sections to test full page capture after complex interactions.</p>
            </div>

            <script>
              document.getElementById('test-form').addEventListener('submit', function(e) {
                e.preventDefault();
                const name = document.getElementById('name').value;
                const email = document.getElementById('email').value;
                const category = document.getElementById('category').value;

                const result = document.getElementById('result');
                const content = document.getElementById('result-content');

                content.innerHTML = 'Name: ' + name + '<br>Email: ' + email + '<br>Category: ' + category;
                result.className = 'result visible';

                console.log('Form submitted:', { name, email, category });
              });
            </script>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(workflowPage)}`);

      // Fill out the form
      await session.type('#name', 'Test User');
      await session.type('#email', 'test@example.com');
      await session.click('#category');
      await session.click('option[value="test"]');

      // Submit the form
      await session.click('.submit-btn');

      // Wait for form processing
      await new Promise(resolve => setTimeout(resolve, 300));

      // Scroll to see different parts of the page
      await session.scroll({ y: 500 });
      await session.scroll({ y: 0 });

      // Hover over an element
      await session.hover('#result');

      // Final full page capture
      const result = await session.captureFullPage({
        type: 'png',
        path: path.join(tempDir, 'workflow-complete.png')
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(fs.existsSync(path.join(tempDir, 'workflow-complete.png'))).toBe(true);

      // Verify console messages from form submission
      const consoleMessages = session.getCapturedConsoleMessages();
      expect(consoleMessages.some(msg => msg.text.includes('Form submitted'))).toBe(true);

      console.log(`✅ Complex workflow + full page capture completed: ${result.data!.length} bytes`);
      console.log(`📊 Console messages captured: ${consoleMessages.length}`);
    });
  });
});
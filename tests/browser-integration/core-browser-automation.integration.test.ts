/**
 * Core Browser Automation Integration Tests
 *
 * These integration tests verify the four acceptance criteria:
 * 1. Browser launch/close lifecycle
 * 2. Page navigation
 * 3. Element interaction (click, type, etc)
 * 4. Screenshot/content capture
 *
 * These tests use the browser package from a consumer perspective,
 * testing the complete integration flow.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createBrowserManager,
  createBrowserSession,
  launchBrowser,
  BrowserManager,
  BrowserSession,
} from '@apexcli/browser';
import { writeFileSync, existsSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Browser Automation Integration Tests', () => {
  let manager: BrowserManager;

  beforeEach(() => {
    manager = createBrowserManager();
  });

  afterEach(async () => {
    if (manager) {
      await manager.shutdown();
    }
  });

  describe('AC1: Browser Launch/Close Lifecycle', () => {
    it('should handle complete browser lifecycle for Chromium', async () => {
      // Test browser instance creation and tracking
      const initialUsage = await manager.getResourceUsage();
      expect(initialUsage.totalInstances).toBe(0);
      expect(initialUsage.totalContexts).toBe(0);

      // Launch browser session
      const session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        viewport: { width: 1280, height: 720 },
        timeout: 30000,
      });

      const launchResult = await session.launch();
      expect(launchResult.success).toBe(true);
      expect(launchResult.duration).toBeGreaterThan(0);

      // Verify resource tracking
      const activeUsage = await manager.getResourceUsage();
      expect(activeUsage.totalInstances).toBe(1);
      expect(activeUsage.totalContexts).toBe(1);
      expect(activeUsage.memoryUsageMB).toBeGreaterThan(0);

      // Verify browser object structure
      const browser = session.getBrowser();
      expect(browser).toBeDefined();
      expect(browser?.isConnected()).toBe(true);

      const context = session.getContext();
      expect(context).toBeDefined();
      expect(typeof context?.newPage).toBe('function');

      const page = session.getPage();
      expect(page).toBeDefined();
      expect(typeof page?.goto).toBe('function');

      // Close browser session
      const closeResult = await session.close();
      expect(closeResult.success).toBe(true);

      // Verify cleanup
      const finalUsage = await manager.getResourceUsage();
      expect(finalUsage.totalContexts).toBe(0);
      expect(finalUsage.totalInstances).toBe(0);
    }, 15000);

    it('should handle multiple browser sessions lifecycle', async () => {
      const sessions: BrowserSession[] = [];
      const browserTypes = ['chromium', 'firefox', 'webkit'] as const;

      try {
        // Launch multiple browser sessions
        for (const browserType of browserTypes) {
          const session = createBrowserSession(manager, {
            browserType,
            headless: true,
          });

          const result = await session.launch();
          expect(result.success).toBe(true);
          sessions.push(session);
        }

        // Verify resource tracking with multiple browsers
        const usage = await manager.getResourceUsage();
        expect(usage.totalInstances).toBe(browserTypes.length);
        expect(usage.totalContexts).toBe(browserTypes.length);
        expect(usage.memoryUsageMB).toBeGreaterThan(0);

        // Verify each browser is independently functional
        for (let i = 0; i < sessions.length; i++) {
          const session = sessions[i];
          const browser = session.getBrowser();
          expect(browser?.isConnected()).toBe(true);
        }

      } finally {
        // Clean up all sessions
        await Promise.all(sessions.map(session => session.close()));

        // Verify all cleaned up
        const finalUsage = await manager.getResourceUsage();
        expect(finalUsage.totalInstances).toBe(0);
        expect(finalUsage.totalContexts).toBe(0);
      }
    }, 30000);

    it('should handle browser launch errors gracefully', async () => {
      // Test operations before launch
      const session = createBrowserSession(manager);

      const navResult = await session.navigate('https://example.com');
      expect(navResult.success).toBe(false);
      expect(navResult.error).toContain('Browser not launched');

      const clickResult = await session.click('#button');
      expect(clickResult.success).toBe(false);
      expect(clickResult.error).toContain('Browser not launched');

      const screenshotResult = await session.screenshot();
      expect(screenshotResult.success).toBe(false);
      expect(screenshotResult.error).toContain('Browser not launched');

      // Verify session can still be launched after errors
      const launchResult = await session.launch();
      expect(launchResult.success).toBe(true);

      await session.close();
    });

    it('should track browser events during lifecycle', async () => {
      let browserCreatedEvent = false;
      let contextCreatedEvent = false;
      let contextClosedEvent = false;

      manager.on('browserCreated', () => { browserCreatedEvent = true; });
      manager.on('contextCreated', () => { contextCreatedEvent = true; });
      manager.on('contextClosed', () => { contextClosedEvent = true; });

      const session = createBrowserSession(manager);
      await session.launch();

      expect(browserCreatedEvent).toBe(true);
      expect(contextCreatedEvent).toBe(true);

      await session.close();
      expect(contextClosedEvent).toBe(true);
    });
  });

  describe('AC2: Page Navigation', () => {
    let session: BrowserSession;

    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });
      await session.launch();
    });

    afterEach(async () => {
      if (session) {
        await session.close();
      }
    });

    it('should navigate to different types of URLs', async () => {
      // Navigate to data URL
      const dataUrl = 'data:text/html,<h1 id="title">Test Page</h1><title>Data URL Test</title>';
      const navResult = await session.navigate(dataUrl);

      expect(navResult.success).toBe(true);
      expect(navResult.data).toContain('data:text/html');

      // Verify navigation worked
      const currentUrl = session.getCurrentUrl();
      expect(currentUrl).toContain('data:text/html');

      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);
      expect(titleResult.data).toBe('Data URL Test');

      // Verify page content
      const textResult = await session.getText('#title');
      expect(textResult.success).toBe(true);
      expect(textResult.data).toBe('Test Page');
    });

    it('should handle multiple page navigations', async () => {
      const pages = [
        {
          url: 'data:text/html,<h1>Page 1</h1><title>First Page</title>',
          expectedTitle: 'First Page',
          expectedText: 'Page 1'
        },
        {
          url: 'data:text/html,<h2>Page 2</h2><title>Second Page</title>',
          expectedTitle: 'Second Page',
          expectedText: 'Page 2'
        },
        {
          url: 'data:text/html,<h3>Page 3</h3><title>Third Page</title>',
          expectedTitle: 'Third Page',
          expectedText: 'Page 3'
        }
      ];

      for (const pageInfo of pages) {
        // Navigate to page
        const navResult = await session.navigate(pageInfo.url);
        expect(navResult.success).toBe(true);

        // Verify title
        const titleResult = await session.getTitle();
        expect(titleResult.success).toBe(true);
        expect(titleResult.data).toBe(pageInfo.expectedTitle);

        // Verify content
        const textResult = await session.getText('h1, h2, h3');
        expect(textResult.success).toBe(true);
        expect(textResult.data).toBe(pageInfo.expectedText);

        // Small delay between navigations
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    });

    it('should handle navigation errors gracefully', async () => {
      // Test invalid URLs
      const invalidUrls = [
        'invalid-url',
        'http://',
        'ftp://invalid-protocol.com',
      ];

      for (const url of invalidUrls) {
        const result = await session.navigate(url);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }

      // Verify browser still works after errors
      const validNavResult = await session.navigate('data:text/html,<h1>Recovery Test</h1>');
      expect(validNavResult.success).toBe(true);
    });

    it('should handle complex HTML pages with JavaScript', async () => {
      const complexPage = `
        data:text/html,
        <html>
          <head>
            <title>Complex Page Test</title>
            <style>
              .container { padding: 20px; }
              .hidden { display: none; }
              .visible { display: block; color: green; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1 id="main-title">Dynamic Page</h1>
              <div id="status" class="hidden">JavaScript Loaded</div>
              <div id="counter">0</div>
              <nav>
                <a href="#section1" id="nav-link">Section 1</a>
              </nav>
            </div>
            <script>
              // Simulate page load and dynamic updates
              setTimeout(() => {
                document.getElementById('status').className = 'visible';
                let count = 0;
                setInterval(() => {
                  document.getElementById('counter').textContent = ++count;
                }, 100);
              }, 50);

              // Simulate navigation handling
              document.getElementById('nav-link').addEventListener('click', (e) => {
                e.preventDefault();
                document.getElementById('main-title').textContent = 'Section 1 Active';
              });
            </script>
          </body>
        </html>
      `;

      const navResult = await session.navigate(complexPage);
      expect(navResult.success).toBe(true);

      // Wait for JavaScript to execute
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify JavaScript executed correctly
      const statusText = await session.getText('#status');
      expect(statusText.success).toBe(true);
      expect(statusText.data).toBe('JavaScript Loaded');

      // Verify dynamic content
      const counterText = await session.getText('#counter');
      expect(counterText.success).toBe(true);
      const counterValue = parseInt(counterText.data || '0');
      expect(counterValue).toBeGreaterThan(0);

      // Test navigation interaction
      const clickResult = await session.click('#nav-link');
      expect(clickResult.success).toBe(true);

      // Verify title changed
      await new Promise(resolve => setTimeout(resolve, 50));
      const updatedTitle = await session.getText('#main-title');
      expect(updatedTitle.success).toBe(true);
      expect(updatedTitle.data).toBe('Section 1 Active');
    });
  });

  describe('AC3: Element Interaction (click, type, etc)', () => {
    let session: BrowserSession;

    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        viewport: { width: 1280, height: 720 },
      });
      await session.launch();
    });

    afterEach(async () => {
      if (session) {
        await session.close();
      }
    });

    it('should perform comprehensive form interactions', async () => {
      const formPage = `
        data:text/html,
        <html>
          <head><title>Form Test</title></head>
          <body>
            <form id="test-form">
              <div>
                <label for="text-input">Text Input:</label>
                <input id="text-input" type="text" name="text" placeholder="Enter text" />
              </div>

              <div>
                <label for="email-input">Email:</label>
                <input id="email-input" type="email" name="email" />
              </div>

              <div>
                <label for="number-input">Number:</label>
                <input id="number-input" type="number" name="number" min="1" max="100" />
              </div>

              <div>
                <label for="textarea">Comments:</label>
                <textarea id="textarea" name="comments" rows="3" cols="50"></textarea>
              </div>

              <div>
                <label for="select">Options:</label>
                <select id="select" name="option">
                  <option value="">Choose...</option>
                  <option value="option1">Option 1</option>
                  <option value="option2">Option 2</option>
                  <option value="option3">Option 3</option>
                </select>
              </div>

              <div>
                <label>
                  <input type="checkbox" id="checkbox1" name="features" value="feature1" />
                  Feature 1
                </label>
                <label>
                  <input type="checkbox" id="checkbox2" name="features" value="feature2" />
                  Feature 2
                </label>
              </div>

              <div>
                <label>
                  <input type="radio" id="radio1" name="priority" value="high" />
                  High Priority
                </label>
                <label>
                  <input type="radio" id="radio2" name="priority" value="medium" />
                  Medium Priority
                </label>
                <label>
                  <input type="radio" id="radio3" name="priority" value="low" />
                  Low Priority
                </label>
              </div>

              <div>
                <button type="button" id="submit-btn" onclick="handleSubmit()">Submit</button>
                <button type="button" id="clear-btn" onclick="clearForm()">Clear</button>
              </div>

              <div id="result-output"></div>
            </form>

            <script>
              function handleSubmit() {
                const form = document.getElementById('test-form');
                const formData = new FormData(form);
                const result = [];

                for (let [key, value] of formData.entries()) {
                  result.push(key + ': ' + value);
                }

                document.getElementById('result-output').innerHTML =
                  '<h3>Form Data:</h3><pre>' + result.join('\\n') + '</pre>';
              }

              function clearForm() {
                document.getElementById('test-form').reset();
                document.getElementById('result-output').innerHTML = '';
              }
            </script>
          </body>
        </html>
      `;

      await session.navigate(formPage);

      // Test text input
      const textInputResult = await session.type('#text-input', 'Integration Test Value');
      expect(textInputResult.success).toBe(true);

      // Test email input
      const emailResult = await session.type('#email-input', 'test@example.com');
      expect(emailResult.success).toBe(true);

      // Test number input
      const numberResult = await session.type('#number-input', '42');
      expect(numberResult.success).toBe(true);

      // Test textarea
      const textareaResult = await session.type('#textarea', 'This is a multi-line\\ncomment for testing');
      expect(textareaResult.success).toBe(true);

      // Test checkbox interactions
      const checkbox1Result = await session.click('#checkbox1');
      expect(checkbox1Result.success).toBe(true);

      const checkbox2Result = await session.click('#checkbox2');
      expect(checkbox2Result.success).toBe(true);

      // Test radio button selection
      const radioResult = await session.click('#radio2');
      expect(radioResult.success).toBe(true);

      // Test select dropdown (requires page evaluation)
      const selectResult = await session.evaluate(() => {
        const select = document.getElementById('select') as HTMLSelectElement;
        select.value = 'option2';
        select.dispatchEvent(new Event('change'));
        return select.value;
      });
      expect(selectResult.success).toBe(true);
      expect(selectResult.data).toBe('option2');

      // Submit form and verify output
      const submitResult = await session.click('#submit-btn');
      expect(submitResult.success).toBe(true);

      // Wait for JavaScript to process
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify form submission results
      const outputText = await session.getText('#result-output');
      expect(outputText.success).toBe(true);
      expect(outputText.data).toContain('Form Data:');
      expect(outputText.data).toContain('text: Integration Test Value');
      expect(outputText.data).toContain('email: test@example.com');
      expect(outputText.data).toContain('number: 42');

      // Test form clearing
      const clearResult = await session.click('#clear-btn');
      expect(clearResult.success).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify form was cleared
      const clearedOutput = await session.getText('#result-output');
      expect(clearedOutput.success).toBe(true);
      expect(clearedOutput.data).toBe('');
    });

    it('should handle scrolling and element visibility interactions', async () => {
      const scrollPage = `
        data:text/html,
        <html>
          <body>
            <div id="top" style="height: 300px; background: linear-gradient(red, blue); padding: 20px;">
              <h1>Top Section</h1>
              <button id="top-button">Top Button</button>
            </div>

            <div id="middle" style="height: 800px; background: linear-gradient(blue, green); padding: 20px;">
              <h2>Middle Section (requires scrolling)</h2>
              <p>This content should require scrolling to view.</p>
              <button id="middle-button" onclick="this.textContent='Middle Clicked!'">Middle Button</button>
            </div>

            <div id="bottom" style="height: 400px; background: linear-gradient(green, purple); padding: 20px;">
              <h3>Bottom Section</h3>
              <button id="bottom-button" onclick="this.textContent='Bottom Reached!'">Bottom Button</button>
              <div id="scroll-target">Scroll Target Reached!</div>
            </div>
          </body>
        </html>
      `;

      await session.navigate(scrollPage);

      // Test clicking visible element
      const topButtonResult = await session.click('#top-button');
      expect(topButtonResult.success).toBe(true);

      // Test scrolling by coordinates
      const scrollResult = await session.scroll({ x: 0, y: 500 });
      expect(scrollResult.success).toBe(true);

      // Test clicking element after scroll
      const middleButtonResult = await session.click('#middle-button');
      expect(middleButtonResult.success).toBe(true);

      // Verify click worked
      const middleButtonText = await session.getText('#middle-button');
      expect(middleButtonText.success).toBe(true);
      expect(middleButtonText.data).toBe('Middle Clicked!');

      // Test scrolling to specific element
      const scrollToElementResult = await session.scroll({ selector: '#bottom' });
      expect(scrollToElementResult.success).toBe(true);

      // Test interaction with bottom element
      const bottomButtonResult = await session.click('#bottom-button');
      expect(bottomButtonResult.success).toBe(true);

      const bottomButtonText = await session.getText('#bottom-button');
      expect(bottomButtonText.success).toBe(true);
      expect(bottomButtonText.data).toBe('Bottom Reached!');

      // Verify scroll position changed
      const scrollPosition = await session.evaluate(() => window.scrollY);
      expect(scrollPosition.success).toBe(true);
      expect(scrollPosition.data).toBeGreaterThan(400);
    });

    it('should handle complex interaction workflows with timing', async () => {
      const interactionPage = `
        data:text/html,
        <html>
          <head><title>Complex Interactions</title></head>
          <body>
            <div id="container">
              <div>
                <input id="search-input" type="text" placeholder="Type to search..."
                       onkeyup="handleSearch(this.value)" />
                <div id="search-results"></div>
              </div>

              <div id="accordion">
                <h3 onclick="toggleSection('section1')" id="header1">Section 1</h3>
                <div id="section1" style="display: none;">
                  <p>Content for section 1</p>
                  <button onclick="sectionAction(1)">Action 1</button>
                </div>

                <h3 onclick="toggleSection('section2')" id="header2">Section 2</h3>
                <div id="section2" style="display: none;">
                  <p>Content for section 2</p>
                  <button onclick="sectionAction(2)">Action 2</button>
                </div>
              </div>

              <div id="drag-drop-area" style="border: 2px dashed #ccc; padding: 20px; margin: 20px 0;">
                <div id="draggable" style="background: yellow; padding: 10px; cursor: move; display: inline-block;">
                  Drag me
                </div>
                <div id="drop-zone" style="border: 2px solid blue; padding: 20px; margin-top: 20px; min-height: 50px;">
                  Drop zone
                </div>
              </div>

              <div id="status-output"></div>
            </div>

            <script>
              const searchData = ['apple', 'banana', 'cherry', 'date', 'elderberry'];

              function handleSearch(query) {
                const results = searchData.filter(item =>
                  item.toLowerCase().includes(query.toLowerCase())
                );
                document.getElementById('search-results').innerHTML =
                  results.length > 0 ? results.join(', ') : 'No results';
              }

              function toggleSection(sectionId) {
                const section = document.getElementById(sectionId);
                section.style.display = section.style.display === 'none' ? 'block' : 'none';
              }

              function sectionAction(num) {
                document.getElementById('status-output').textContent = 'Action ' + num + ' executed';
              }

              // Simple drag and drop simulation
              let draggedElement = null;

              document.getElementById('draggable').addEventListener('mousedown', function(e) {
                draggedElement = this;
                this.style.background = 'lightblue';
              });

              document.getElementById('drop-zone').addEventListener('mouseup', function(e) {
                if (draggedElement) {
                  this.appendChild(draggedElement);
                  draggedElement.style.background = 'lightgreen';
                  draggedElement = null;
                  document.getElementById('status-output').textContent = 'Drag and drop completed';
                }
              });
            </script>
          </body>
        </html>
      `;

      await session.navigate(interactionPage);

      // Test search functionality
      await session.type('#search-input', 'app');
      await new Promise(resolve => setTimeout(resolve, 100));

      const searchResults = await session.getText('#search-results');
      expect(searchResults.success).toBe(true);
      expect(searchResults.data).toContain('apple');

      // Test accordion interactions
      await session.click('#header1');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify section is now visible and click the action button
      await session.click('button[onclick="sectionAction(1)"]');
      await new Promise(resolve => setTimeout(resolve, 50));

      const statusOutput = await session.getText('#status-output');
      expect(statusOutput.success).toBe(true);
      expect(statusOutput.data).toBe('Action 1 executed');

      // Test second accordion section
      await session.click('#header2');
      await new Promise(resolve => setTimeout(resolve, 50));

      await session.click('button[onclick="sectionAction(2)"]');
      await new Promise(resolve => setTimeout(resolve, 50));

      const updatedStatus = await session.getText('#status-output');
      expect(updatedStatus.success).toBe(true);
      expect(updatedStatus.data).toBe('Action 2 executed');

      // Test drag simulation (using click events for simplicity in testing)
      await session.evaluate(() => {
        const draggable = document.getElementById('draggable');
        const dropZone = document.getElementById('drop-zone');

        // Simulate drag start
        draggable.dispatchEvent(new MouseEvent('mousedown'));

        // Simulate drop
        dropZone.dispatchEvent(new MouseEvent('mouseup'));
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      const dragStatus = await session.getText('#status-output');
      expect(dragStatus.success).toBe(true);
      expect(dragStatus.data).toBe('Drag and drop completed');
    });
  });

  describe('AC4: Screenshot/Content Capture', () => {
    let session: BrowserSession;

    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        viewport: { width: 1920, height: 1080 },
      });
      await session.launch();
    });

    afterEach(async () => {
      if (session) {
        await session.close();
      }
    });

    it('should capture screenshots with different options and save to filesystem', async () => {
      const testPage = `
        data:text/html,
        <html>
          <head><title>Screenshot Test</title></head>
          <body style="background: linear-gradient(45deg, #ff6b6b, #4ecdc4); height: 100vh; padding: 50px;">
            <h1 style="color: white; text-align: center; font-size: 3em;">Screenshot Test Page</h1>
            <div style="background: white; padding: 30px; border-radius: 10px; margin: 50px auto; max-width: 600px;">
              <h2>Content for Screenshot</h2>
              <p>This is a test paragraph with some content for screenshot validation.</p>
              <button style="background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px;">
                Test Button
              </button>
            </div>
          </body>
        </html>
      `;

      await session.navigate(testPage);
      await new Promise(resolve => setTimeout(resolve, 200)); // Wait for page to render

      // Test standard screenshot
      const standardScreenshot = await session.screenshot();
      expect(standardScreenshot.success).toBe(true);
      expect(standardScreenshot.data).toBeInstanceOf(Buffer);
      expect(standardScreenshot.data!.length).toBeGreaterThan(1000);
      expect(standardScreenshot.duration).toBeGreaterThan(0);

      // Verify screenshot can be saved to file system
      const screenshotPath = join(tmpdir(), 'test-screenshot-standard.png');
      try {
        writeFileSync(screenshotPath, standardScreenshot.data!);
        expect(existsSync(screenshotPath)).toBe(true);
      } finally {
        if (existsSync(screenshotPath)) {
          unlinkSync(screenshotPath);
        }
      }

      // Test PNG format explicitly
      const pngScreenshot = await session.screenshot({ type: 'png' });
      expect(pngScreenshot.success).toBe(true);
      expect(pngScreenshot.data).toBeInstanceOf(Buffer);
      expect(pngScreenshot.data!.length).toBeGreaterThan(1000);

      // Test JPEG format with quality
      const jpegScreenshot = await session.screenshot({
        type: 'jpeg',
        quality: 90
      });
      expect(jpegScreenshot.success).toBe(true);
      expect(jpegScreenshot.data).toBeInstanceOf(Buffer);
      expect(jpegScreenshot.data!.length).toBeGreaterThan(500);

      // Test different quality levels
      const lowQualityJpeg = await session.screenshot({
        type: 'jpeg',
        quality: 10
      });
      expect(lowQualityJpeg.success).toBe(true);
      expect(lowQualityJpeg.data!.length).toBeLessThan(jpegScreenshot.data!.length);
    });

    it('should capture full page screenshots of long content', async () => {
      const longPage = `
        data:text/html,
        <html>
          <head><title>Long Page Test</title></head>
          <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif;">
            <h1>Full Page Screenshot Test</h1>

            ${Array.from({ length: 20 }, (_, i) => `
              <section style="background: ${i % 2 === 0 ? '#f0f0f0' : '#e0e0e0'}; padding: 50px; margin: 20px 0; border-left: 5px solid #007bff;">
                <h2>Section ${i + 1}</h2>
                <p>This is section ${i + 1} with substantial content to create a long page that requires full page screenshot testing.</p>
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
                <div style="height: 100px; background: linear-gradient(90deg, #ff6b6b, #4ecdc4); margin: 20px 0; border-radius: 5px;"></div>
                <ul>
                  <li>List item 1 for section ${i + 1}</li>
                  <li>List item 2 for section ${i + 1}</li>
                  <li>List item 3 for section ${i + 1}</li>
                </ul>
              </section>
            `).join('')}

            <footer style="background: #333; color: white; padding: 30px; text-align: center; margin-top: 50px;">
              <p>End of long page - footer content</p>
            </footer>
          </body>
        </html>
      `;

      await session.navigate(longPage);
      await new Promise(resolve => setTimeout(resolve, 300)); // Wait for long page to render

      // Take standard screenshot
      const standardScreenshot = await session.screenshot();
      expect(standardScreenshot.success).toBe(true);

      // Take full page screenshot
      const fullPageScreenshot = await session.screenshot({ fullPage: true });
      expect(fullPageScreenshot.success).toBe(true);
      expect(fullPageScreenshot.data).toBeInstanceOf(Buffer);

      // Full page screenshot should be significantly larger
      expect(fullPageScreenshot.data!.length).toBeGreaterThan(standardScreenshot.data!.length);

      // Verify we can save full page screenshot
      const fullPagePath = join(tmpdir(), 'test-screenshot-fullpage.png');
      try {
        writeFileSync(fullPagePath, fullPageScreenshot.data!);
        expect(existsSync(fullPagePath)).toBe(true);
      } finally {
        if (existsSync(fullPagePath)) {
          unlinkSync(fullPagePath);
        }
      }
    });

    it('should capture content and extract text successfully', async () => {
      const contentPage = `
        data:text/html,
        <html>
          <head>
            <title>Content Extraction Test</title>
            <meta name="description" content="Test page for content extraction" />
          </head>
          <body>
            <header>
              <h1 id="main-title">Content Extraction Test Page</h1>
              <nav id="navigation">
                <a href="#section1">Section 1</a>
                <a href="#section2">Section 2</a>
                <a href="#section3">Section 3</a>
              </nav>
            </header>

            <main>
              <section id="section1">
                <h2>First Section</h2>
                <p>This is the first section with important content for extraction testing.</p>
                <ul>
                  <li>First item</li>
                  <li>Second item</li>
                  <li>Third item</li>
                </ul>
              </section>

              <section id="section2">
                <h2>Second Section</h2>
                <p>This section contains different types of content elements.</p>
                <table border="1">
                  <thead>
                    <tr><th>Column 1</th><th>Column 2</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>Data 1</td><td>Data 2</td></tr>
                    <tr><td>Data 3</td><td>Data 4</td></tr>
                  </tbody>
                </table>
              </section>

              <section id="section3" style="display: none;">
                <h2>Hidden Section</h2>
                <p>This content is hidden and should not appear in visible text extraction.</p>
              </section>

              <aside id="sidebar">
                <h3>Sidebar Content</h3>
                <p>Additional information in the sidebar.</p>
              </aside>
            </main>

            <footer>
              <p>© 2024 Test Page. All rights reserved.</p>
            </footer>
          </body>
        </html>
      `;

      await session.navigate(contentPage);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Test getting page title
      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);
      expect(titleResult.data).toBe('Content Extraction Test Page');

      // Test getting text from specific elements
      const mainTitleResult = await session.getText('#main-title');
      expect(mainTitleResult.success).toBe(true);
      expect(mainTitleResult.data).toBe('Content Extraction Test Page');

      // Test getting text from multiple elements
      const headingResults = await session.getText('h2');
      expect(headingResults.success).toBe(true);
      expect(headingResults.data).toContain('First Section');

      // Test getting text from lists
      const listResult = await session.getText('#section1 ul');
      expect(listResult.success).toBe(true);
      expect(listResult.data).toContain('First item');
      expect(listResult.data).toContain('Second item');
      expect(listResult.data).toContain('Third item');

      // Test getting text from table
      const tableResult = await session.getText('table');
      expect(tableResult.success).toBe(true);
      expect(tableResult.data).toContain('Column 1');
      expect(tableResult.data).toContain('Data 1');

      // Test navigation links
      const navResult = await session.getText('#navigation');
      expect(navResult.success).toBe(true);
      expect(navResult.data).toContain('Section 1');
      expect(navResult.data).toContain('Section 2');

      // Verify hidden content is not extracted by default
      const hiddenResult = await session.getText('#section3');
      expect(hiddenResult.success).toBe(true);
      expect(hiddenResult.data).toBe(''); // Hidden elements should return empty text

      // Test content evaluation and extraction
      const pageContentResult = await session.evaluate(() => {
        const title = document.title;
        const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent);
        const paragraphs = Array.from(document.querySelectorAll('p')).map(p => p.textContent);
        const links = Array.from(document.querySelectorAll('a')).map(a => ({ text: a.textContent, href: a.href }));

        return { title, headings, paragraphs, links };
      });

      expect(pageContentResult.success).toBe(true);
      expect(pageContentResult.data.title).toBe('Content Extraction Test Page');
      expect(pageContentResult.data.headings).toContain('Content Extraction Test Page');
      expect(pageContentResult.data.headings).toContain('First Section');
      expect(pageContentResult.data.paragraphs.length).toBeGreaterThan(0);
      expect(pageContentResult.data.links.length).toBeGreaterThan(0);
    });

    it('should handle screenshot errors and edge cases gracefully', async () => {
      // Test screenshot with invalid options
      const invalidTypeResult = await session.screenshot({
        type: 'invalid' as any
      });
      expect(invalidTypeResult.success).toBe(false);

      // Test screenshot with very high JPEG quality
      const maxQualityResult = await session.screenshot({
        type: 'jpeg',
        quality: 100
      });
      expect(maxQualityResult.success).toBe(true);

      // Test screenshot with minimum quality
      const minQualityResult = await session.screenshot({
        type: 'jpeg',
        quality: 1
      });
      expect(minQualityResult.success).toBe(true);

      // Navigate to a page with potential rendering issues
      const problematicPage = `
        data:text/html,
        <html>
          <head><title>Edge Case Test</title></head>
          <body style="background: white;">
            <div style="width: 5000px; height: 5000px; background: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,0,0,0.1) 10px, rgba(255,0,0,0.1) 20px);">
              <h1>Very Large Content Area</h1>
            </div>
          </body>
        </html>
      `;

      await session.navigate(problematicPage);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should still be able to take screenshots of large content
      const largeContentScreenshot = await session.screenshot();
      expect(largeContentScreenshot.success).toBe(true);
      expect(largeContentScreenshot.data).toBeInstanceOf(Buffer);

      const fullPageLargeScreenshot = await session.screenshot({ fullPage: true });
      expect(fullPageLargeScreenshot.success).toBe(true);
      expect(fullPageLargeScreenshot.data!.length).toBeGreaterThan(largeContentScreenshot.data!.length);
    });
  });

  describe('Integration Error Handling and Recovery', () => {
    it('should handle and recover from various error scenarios', async () => {
      const session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });

      // Test operations before browser launch
      let navResult = await session.navigate('data:text/html,<h1>Test</h1>');
      expect(navResult.success).toBe(false);

      let clickResult = await session.click('#button');
      expect(clickResult.success).toBe(false);

      let screenshotResult = await session.screenshot();
      expect(screenshotResult.success).toBe(false);

      // Launch browser
      const launchResult = await session.launch();
      expect(launchResult.success).toBe(true);

      // Test invalid operations after launch
      navResult = await session.navigate('invalid-url-format');
      expect(navResult.success).toBe(false);

      clickResult = await session.click('#nonexistent-element');
      expect(clickResult.success).toBe(false);

      // Verify browser still works after errors
      const validNavResult = await session.navigate('data:text/html,<h1>Recovery Test</h1>');
      expect(validNavResult.success).toBe(true);

      const validScreenshotResult = await session.screenshot();
      expect(validScreenshotResult.success).toBe(true);

      const textResult = await session.getText('h1');
      expect(textResult.success).toBe(true);
      expect(textResult.data).toBe('Recovery Test');

      await session.close();
    });

    it('should handle resource cleanup on errors', async () => {
      const initialUsage = await manager.getResourceUsage();

      // Create multiple sessions, some with errors
      const sessions: BrowserSession[] = [];

      try {
        for (let i = 0; i < 3; i++) {
          const session = createBrowserSession(manager, {
            browserType: 'chromium',
            headless: true,
          });

          await session.launch();
          sessions.push(session);
        }

        const activeUsage = await manager.getResourceUsage();
        expect(activeUsage.totalInstances).toBe(3);
        expect(activeUsage.totalContexts).toBe(3);

        // Force close some sessions
        await sessions[0].close();
        await sessions[1].close();

        const partialUsage = await manager.getResourceUsage();
        expect(partialUsage.totalContexts).toBe(1);

      } finally {
        // Clean up remaining sessions
        await Promise.all(sessions.map(session => session.close()));
      }

      // Verify complete cleanup after some delay
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalUsage = await manager.getResourceUsage();
      expect(finalUsage.totalContexts).toBe(0);
      expect(finalUsage.totalInstances).toBe(0);
    });
  });

  describe('Performance and Reliability', () => {
    it('should meet performance benchmarks for basic operations', async () => {
      const session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });

      // Measure launch time
      const launchStart = Date.now();
      await session.launch();
      const launchTime = Date.now() - launchStart;

      expect(launchTime).toBeLessThan(10000); // Should launch in under 10 seconds

      // Measure navigation time
      const navStart = Date.now();
      await session.navigate('data:text/html,<h1>Performance Test</h1>');
      const navTime = Date.now() - navStart;

      expect(navTime).toBeLessThan(2000); // Should navigate in under 2 seconds

      // Measure screenshot time
      const screenshotStart = Date.now();
      await session.screenshot();
      const screenshotTime = Date.now() - screenshotStart;

      expect(screenshotTime).toBeLessThan(3000); // Should capture screenshot in under 3 seconds

      await session.close();
    }, 20000);

    it('should handle concurrent operations reliably', async () => {
      const session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });

      await session.launch();
      await session.navigate('data:text/html,<h1>Concurrent Test</h1><button id="btn">Click</button>');

      // Run multiple operations concurrently
      const operations = [
        session.getText('h1'),
        session.click('#btn'),
        session.screenshot(),
        session.evaluate(() => document.title),
        session.getCurrentUrl(),
      ];

      const results = await Promise.all(operations);

      // All operations should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      await session.close();
    });
  });
});
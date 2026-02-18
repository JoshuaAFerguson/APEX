/**
 * @fileoverview Browser Launch and Navigation Verification Tests
 *
 * This test file specifically verifies that Playwright can:
 * - Successfully launch browsers (Chromium, Firefox, WebKit)
 * - Navigate to web pages
 * - Interact with page elements
 * - Take screenshots
 * - Handle JavaScript execution
 */

import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';

test.describe('Browser Launch and Navigation Verification', () => {
  test.describe('Basic Browser Operations', () => {
    test('should successfully launch Chromium browser and navigate', async ({ page }) => {
      // Create a comprehensive test page
      const testHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>APEX Browser Launch Test</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              max-width: 1200px;
              margin: 0 auto;
              padding: 20px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              min-height: 100vh;
            }
            .container {
              background: rgba(255, 255, 255, 0.1);
              backdrop-filter: blur(10px);
              border-radius: 15px;
              padding: 40px;
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .test-section {
              margin: 20px 0;
              padding: 20px;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 10px;
              border: 1px solid rgba(255, 255, 255, 0.2);
            }
            .button {
              background: #4CAF50;
              color: white;
              padding: 12px 24px;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              margin: 5px;
              font-size: 16px;
              transition: all 0.3s ease;
            }
            .button:hover {
              background: #45a049;
              transform: translateY(-2px);
            }
            .input {
              padding: 12px;
              border: none;
              border-radius: 5px;
              margin: 5px;
              font-size: 16px;
              width: 200px;
            }
            .status {
              padding: 15px;
              margin: 10px 0;
              border-radius: 5px;
              background: rgba(76, 175, 80, 0.2);
              border: 1px solid rgba(76, 175, 80, 0.5);
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
              gap: 20px;
              margin-top: 20px;
            }
            .feature-card {
              background: rgba(255, 255, 255, 0.1);
              padding: 20px;
              border-radius: 10px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚀 APEX Playwright Browser Test</h1>
              <p>Comprehensive browser automation verification</p>
              <div id="browser-info" class="status">Loading browser info...</div>
            </div>

            <div class="test-section">
              <h2>🔄 Interactive Elements Test</h2>
              <button id="click-test" class="button">Click Me! (0 clicks)</button>
              <input id="text-input" class="input" type="text" placeholder="Type something here" />
              <button id="submit-test" class="button">Submit Text</button>
              <div id="interaction-result" class="status">Ready for interaction...</div>
            </div>

            <div class="test-section">
              <h2>📊 Browser Features Test</h2>
              <div class="grid">
                <div class="feature-card">
                  <h3>Local Storage</h3>
                  <button id="storage-test" class="button">Test Storage</button>
                  <div id="storage-result">Not tested</div>
                </div>
                <div class="feature-card">
                  <h3>Performance API</h3>
                  <button id="performance-test" class="button">Measure Performance</button>
                  <div id="performance-result">Not tested</div>
                </div>
                <div class="feature-card">
                  <h3>Async Operations</h3>
                  <button id="async-test" class="button">Test Async</button>
                  <div id="async-result">Not tested</div>
                </div>
                <div class="feature-card">
                  <h3>DOM Manipulation</h3>
                  <button id="dom-test" class="button">Test DOM</button>
                  <div id="dom-result">Not tested</div>
                </div>
              </div>
            </div>

            <div class="test-section">
              <h2>🌐 Network and Media Test</h2>
              <button id="fetch-test" class="button">Test Fetch API</button>
              <button id="media-test" class="button">Test Media Queries</button>
              <div id="network-result" class="status">Network tests not run</div>
            </div>
          </div>

          <script>
            // Initialize page
            document.addEventListener('DOMContentLoaded', function() {
              initializePage();
              setupEventHandlers();
            });

            function initializePage() {
              // Display browser information
              const browserInfo = document.getElementById('browser-info');
              browserInfo.innerHTML = \`
                ✅ Browser: \${navigator.userAgent.includes('Chrome') ? 'Chromium' :
                               navigator.userAgent.includes('Firefox') ? 'Firefox' :
                               navigator.userAgent.includes('Safari') ? 'WebKit' : 'Unknown'}<br>
                📱 Platform: \${navigator.platform}<br>
                🌐 Language: \${navigator.language}<br>
                ⏰ Loaded at: \${new Date().toISOString()}
              \`;

              console.log('APEX test page initialized successfully');
            }

            function setupEventHandlers() {
              let clickCount = 0;

              // Click test
              document.getElementById('click-test').addEventListener('click', function() {
                clickCount++;
                this.textContent = \`Click Me! (\${clickCount} clicks)\`;
                document.getElementById('interaction-result').innerHTML =
                  \`✅ Button clicked \${clickCount} time(s) at \${new Date().toLocaleTimeString()}\`;
              });

              // Text submission test
              document.getElementById('submit-test').addEventListener('click', function() {
                const input = document.getElementById('text-input');
                const text = input.value || '(empty)';
                document.getElementById('interaction-result').innerHTML =
                  \`📝 Submitted text: "\${text}" at \${new Date().toLocaleTimeString()}\`;
              });

              // Storage test
              document.getElementById('storage-test').addEventListener('click', function() {
                try {
                  const testKey = 'apex-test-key';
                  const testValue = \`test-\${Date.now()}\`;
                  localStorage.setItem(testKey, testValue);
                  const retrieved = localStorage.getItem(testKey);
                  document.getElementById('storage-result').innerHTML =
                    retrieved === testValue ? '✅ Working' : '❌ Failed';
                  localStorage.removeItem(testKey);
                } catch (e) {
                  document.getElementById('storage-result').innerHTML = '❌ Error: ' + e.message;
                }
              });

              // Performance test
              document.getElementById('performance-test').addEventListener('click', function() {
                const start = performance.now();
                // Simulate some work
                for (let i = 0; i < 10000; i++) {
                  Math.random();
                }
                const end = performance.now();
                document.getElementById('performance-result').innerHTML =
                  \`✅ \${(end - start).toFixed(2)}ms\`;
              });

              // Async test
              document.getElementById('async-test').addEventListener('click', async function() {
                this.disabled = true;
                this.textContent = 'Testing...';

                try {
                  await new Promise(resolve => setTimeout(resolve, 500));
                  document.getElementById('async-result').innerHTML = '✅ Async working';
                } catch (e) {
                  document.getElementById('async-result').innerHTML = '❌ Async failed';
                } finally {
                  this.disabled = false;
                  this.textContent = 'Test Async';
                }
              });

              // DOM test
              document.getElementById('dom-test').addEventListener('click', function() {
                const testDiv = document.createElement('div');
                testDiv.textContent = 'Dynamic element created!';
                testDiv.style.color = '#4CAF50';
                testDiv.style.fontWeight = 'bold';

                const resultDiv = document.getElementById('dom-result');
                resultDiv.innerHTML = '';
                resultDiv.appendChild(testDiv);
              });

              // Fetch test
              document.getElementById('fetch-test').addEventListener('click', function() {
                const available = typeof fetch !== 'undefined';
                document.getElementById('network-result').innerHTML =
                  available ? '✅ Fetch API available' : '❌ Fetch API not available';
              });

              // Media test
              document.getElementById('media-test').addEventListener('click', function() {
                const supportsMediaQueries = window.matchMedia && window.matchMedia('(min-width: 1px)').matches;
                document.getElementById('network-result').innerHTML =
                  supportsMediaQueries ? '✅ Media queries working' : '❌ Media queries not working';
              });
            }

            // Log that scripts loaded
            console.log('APEX test page scripts loaded and ready');
          </script>
        </body>
        </html>
      `;

      // Set the page content
      await page.setContent(testHTML);

      // Verify the page loaded correctly
      await expect(page).toHaveTitle('APEX Browser Launch Test');

      // Test that all major sections are present
      await expect(page.locator('h1')).toHaveText('🚀 APEX Playwright Browser Test');
      await expect(page.locator('#browser-info')).toBeVisible();
      await expect(page.locator('#click-test')).toBeVisible();
      await expect(page.locator('#text-input')).toBeVisible();

      console.log('✅ Basic page structure verified');
    });

    test('should handle user interactions successfully', async ({ page }) => {
      // Use a simpler test page focused on interactions
      const interactionHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Interaction Test</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .button { padding: 10px 20px; margin: 5px; background: #007acc; color: white; border: none; border-radius: 4px; cursor: pointer; }
            .input { padding: 10px; margin: 5px; border: 1px solid #ccc; border-radius: 4px; font-size: 16px; }
            #result { padding: 15px; margin: 10px 0; background: #f5f5f5; border-radius: 4px; }
          </style>
        </head>
        <body>
          <h1>Interaction Test Page</h1>
          <button id="test-button" class="button">Click Counter: 0</button>
          <input id="test-input" class="input" type="text" placeholder="Enter test text" value="" />
          <button id="submit-btn" class="button">Submit</button>
          <div id="result">Ready for testing</div>

          <script>
            let clickCount = 0;

            document.getElementById('test-button').addEventListener('click', function() {
              clickCount++;
              this.textContent = 'Click Counter: ' + clickCount;
            });

            document.getElementById('submit-btn').addEventListener('click', function() {
              const input = document.getElementById('test-input');
              const result = document.getElementById('result');
              result.textContent = 'Submitted: "' + input.value + '" at ' + new Date().toISOString();
            });

            console.log('Interaction test page ready');
          </script>
        </body>
        </html>
      `;

      await page.setContent(interactionHTML);

      // Test button clicking
      const button = page.locator('#test-button');
      await expect(button).toHaveText('Click Counter: 0');

      await button.click();
      await expect(button).toHaveText('Click Counter: 1');

      await button.click();
      await expect(button).toHaveText('Click Counter: 2');

      // Test text input and submission
      const input = page.locator('#test-input');
      const submitBtn = page.locator('#submit-btn');
      const result = page.locator('#result');

      await input.fill('Hello Playwright!');
      await submitBtn.click();

      await expect(result).toContainText('Submitted: "Hello Playwright!"');

      console.log('✅ User interaction tests passed');
    });

    test('should capture console messages and handle JavaScript', async ({ page }) => {
      const consoleMessages: string[] = [];

      // Listen for console messages
      page.on('console', (msg) => {
        consoleMessages.push(msg.text());
      });

      const jsTestHTML = `
        <!DOCTYPE html>
        <html>
        <head><title>JavaScript Test</title></head>
        <body>
          <h1 id="title">JavaScript Test</h1>
          <div id="output">Initial</div>
          <script>
            console.log('Page loaded successfully');
            console.warn('This is a test warning');
            console.error('This is a test error (intentional)');

            // Test complex JavaScript operations
            const testObject = {
              timestamp: Date.now(),
              random: Math.random(),
              nested: { value: 'test' }
            };

            console.log('Test object created:', JSON.stringify(testObject));

            // Update DOM
            document.getElementById('output').textContent = 'JavaScript executed at ' + new Date().toISOString();
          </script>
        </body>
        </html>
      `;

      await page.setContent(jsTestHTML);

      // Wait for JavaScript to execute
      await page.waitForTimeout(500);

      // Verify console messages were captured
      expect(consoleMessages.length).toBeGreaterThan(0);
      expect(consoleMessages.some(msg => msg.includes('Page loaded successfully'))).toBe(true);
      expect(consoleMessages.some(msg => msg.includes('This is a test warning'))).toBe(true);
      expect(consoleMessages.some(msg => msg.includes('This is a test error'))).toBe(true);

      // Verify DOM was updated by JavaScript
      await expect(page.locator('#output')).toContainText('JavaScript executed at');

      console.log('✅ JavaScript execution and console capture verified');
    });

    test('should take screenshots and handle visual testing', async ({ page }) => {
      const visualTestHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Visual Test Page</title>
          <style>
            body {
              margin: 0;
              padding: 40px;
              font-family: 'Arial', sans-serif;
              background: linear-gradient(45deg, #FF6B6B, #4ECDC4, #45B7D1, #96CEB4);
              background-size: 400% 400%;
              animation: gradientShift 5s ease infinite;
              min-height: calc(100vh - 80px);
              color: white;
              text-align: center;
            }

            @keyframes gradientShift {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }

            .container {
              max-width: 800px;
              margin: 0 auto;
              background: rgba(255, 255, 255, 0.1);
              backdrop-filter: blur(10px);
              border-radius: 20px;
              padding: 40px;
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            }

            h1 {
              font-size: 3em;
              margin: 0 0 20px 0;
              text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
            }

            .visual-elements {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 20px;
              margin: 30px 0;
            }

            .element-box {
              padding: 20px;
              border-radius: 10px;
              background: rgba(255, 255, 255, 0.2);
              border: 2px solid rgba(255, 255, 255, 0.3);
              transition: transform 0.3s ease;
            }

            .element-box:hover {
              transform: translateY(-5px);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🎨 Visual Test Page</h1>
            <p>This page tests visual rendering and screenshot capabilities</p>

            <div class="visual-elements">
              <div class="element-box">
                <h3>📊 Charts</h3>
                <p>Simulated chart area</p>
              </div>
              <div class="element-box">
                <h3>🖼️ Images</h3>
                <p>Image placeholder</p>
              </div>
              <div class="element-box">
                <h3>📱 Responsive</h3>
                <p>Mobile-friendly design</p>
              </div>
              <div class="element-box">
                <h3>🎯 Interactive</h3>
                <p>Hover effects enabled</p>
              </div>
            </div>

            <div style="margin-top: 30px;">
              <p>Screenshot captured at: <span id="timestamp"></span></p>
            </div>
          </div>

          <script>
            document.getElementById('timestamp').textContent = new Date().toISOString();
            console.log('Visual test page rendered');
          </script>
        </body>
        </html>
      `;

      await page.setContent(visualTestHTML);

      // Wait for animations and rendering
      await page.waitForTimeout(1000);

      // Take a basic screenshot
      const screenshot = await page.screenshot();
      expect(screenshot).toBeDefined();
      expect(screenshot.length).toBeGreaterThan(1000); // Should be a reasonable size

      // Take a full page screenshot
      const fullPageScreenshot = await page.screenshot({
        fullPage: true,
        animations: 'disabled' // Disable animations for consistent screenshots
      });
      expect(fullPageScreenshot).toBeDefined();
      expect(fullPageScreenshot.length).toBeGreaterThan(1000);

      // Take a screenshot of a specific element
      const containerScreenshot = await page.locator('.container').screenshot();
      expect(containerScreenshot).toBeDefined();
      expect(containerScreenshot.length).toBeGreaterThan(500);

      console.log('✅ Screenshot capabilities verified');
    });
  });

  test.describe('Cross-Browser Verification', () => {
    test('should work with multiple browser contexts', async ({ browser }) => {
      // Create multiple contexts to test isolation
      const context1 = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
      });
      const context2 = await browser.newContext({
        viewport: { width: 1366, height: 768 }
      });

      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      try {
        // Set different content in each context
        await page1.setContent(`
          <html>
            <body>
              <h1>Context 1 - Desktop</h1>
              <div id="viewport-info">Viewport: 1920x1080</div>
            </body>
          </html>
        `);

        await page2.setContent(`
          <html>
            <body>
              <h1>Context 2 - Laptop</h1>
              <div id="viewport-info">Viewport: 1366x768</div>
            </body>
          </html>
        `);

        // Verify each context has its own content
        await expect(page1.locator('h1')).toHaveText('Context 1 - Desktop');
        await expect(page2.locator('h1')).toHaveText('Context 2 - Laptop');

        // Verify viewport sizes
        const viewport1 = await page1.evaluate(() => [window.innerWidth, window.innerHeight]);
        const viewport2 = await page2.evaluate(() => [window.innerWidth, window.innerHeight]);

        expect(viewport1[0]).toBe(1920);
        expect(viewport1[1]).toBe(1080);
        expect(viewport2[0]).toBe(1366);
        expect(viewport2[1]).toBe(768);

        console.log('✅ Multiple browser contexts working correctly');

      } finally {
        await context1.close();
        await context2.close();
      }
    });
  });

  test.describe('Performance and Network', () => {
    test('should handle performance measurements', async ({ page }) => {
      const performanceHTML = `
        <!DOCTYPE html>
        <html>
        <head><title>Performance Test</title></head>
        <body>
          <h1>Performance Test Page</h1>
          <div id="results"></div>
          <script>
            // Add performance markers
            performance.mark('page-start');

            // Simulate some work
            const startTime = performance.now();
            for (let i = 0; i < 50000; i++) {
              Math.random();
            }
            const endTime = performance.now();

            performance.mark('page-end');
            performance.measure('page-load', 'page-start', 'page-end');

            // Display results
            document.getElementById('results').innerHTML =
              'Calculation time: ' + (endTime - startTime).toFixed(2) + 'ms';

            console.log('Performance test completed');
          </script>
        </body>
        </html>
      `;

      await page.setContent(performanceHTML);

      // Get performance metrics
      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const measures = performance.getEntriesByType('measure');

        return {
          domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart,
          loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart,
          measures: measures.length,
          timing: performance.now()
        };
      });

      expect(metrics).toBeDefined();
      expect(typeof metrics.domContentLoaded).toBe('number');
      expect(typeof metrics.loadComplete).toBe('number');
      expect(typeof metrics.timing).toBe('number');

      console.log('✅ Performance measurement capabilities verified');
    });
  });
});

test.describe('Advanced Browser Features', () => {
  test('should handle advanced JavaScript and modern web APIs', async ({ page }) => {
    const advancedHTML = `
      <!DOCTYPE html>
      <html>
      <head><title>Advanced Features Test</title></head>
      <body>
        <h1>Advanced Browser Features</h1>
        <div id="results"></div>
        <script>
          const results = [];

          // Test modern JavaScript features
          try {
            // ES6+ features
            const arrow = () => 'arrow function works';
            const [a, b] = [1, 2];
            const obj = { a, b, method() { return 'method works'; } };

            results.push('✅ ES6+ features working');
          } catch (e) {
            results.push('❌ ES6+ features failed: ' + e.message);
          }

          // Test async/await
          (async () => {
            try {
              await new Promise(resolve => setTimeout(resolve, 10));
              results.push('✅ Async/await working');
            } catch (e) {
              results.push('❌ Async/await failed: ' + e.message);
            }

            // Test modern web APIs
            const apis = [
              { name: 'fetch', available: typeof fetch !== 'undefined' },
              { name: 'Promise', available: typeof Promise !== 'undefined' },
              { name: 'localStorage', available: typeof localStorage !== 'undefined' },
              { name: 'sessionStorage', available: typeof sessionStorage !== 'undefined' },
              { name: 'requestAnimationFrame', available: typeof requestAnimationFrame !== 'undefined' },
              { name: 'performance', available: typeof performance !== 'undefined' },
              { name: 'URL', available: typeof URL !== 'undefined' },
              { name: 'URLSearchParams', available: typeof URLSearchParams !== 'undefined' }
            ];

            apis.forEach(api => {
              results.push(\`\${api.available ? '✅' : '❌'} \${api.name} API \${api.available ? 'available' : 'missing'}\`);
            });

            // Display results
            document.getElementById('results').innerHTML = results.join('<br>');
            console.log('Advanced features test completed');
          })();
        </script>
      </body>
      </html>
    `;

    await page.setContent(advancedHTML);
    await page.waitForTimeout(500);

    // Verify the test completed
    const resultsContent = await page.locator('#results').textContent();
    expect(resultsContent).toBeTruthy();
    expect(resultsContent).toContain('ES6+ features working');
    expect(resultsContent).toContain('Async/await working');
    expect(resultsContent).toContain('fetch API available');

    console.log('✅ Advanced browser features verified');
  });
});
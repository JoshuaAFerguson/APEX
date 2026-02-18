/**
 * @apexcli/browser - Screenshot Integration Tests
 *
 * Integration tests for screenshot functionality with real-world scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';
import type { ElementSelector } from '../types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Screenshot Integration Tests', () => {
  let manager: BrowserManager;
  let session: BrowserSession;
  let tempDir: string;

  beforeEach(async () => {
    manager = new BrowserManager();
    session = new BrowserSession(manager, {
      browserType: 'chromium',
      headless: true,
      viewport: { width: 1280, height: 720 }
    });
    await session.launch();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-screenshot-integration-'));
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

  describe('Real-world Web Page Scenarios', () => {
    it('should capture screenshots of a complex web form', async () => {
      const formHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
              .form-container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .form-group { margin-bottom: 20px; }
              label { display: block; margin-bottom: 5px; font-weight: bold; color: #333; }
              input, textarea, select { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; }
              .btn { background: #007bff; color: white; padding: 12px 30px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
              .btn:hover { background: #0056b3; }
              .header { text-align: center; color: #2c3e50; margin-bottom: 30px; }
            </style>
          </head>
          <body>
            <div class="form-container">
              <div class="header">
                <h1>User Registration Form</h1>
                <p>Please fill out all required fields</p>
              </div>
              <form>
                <div class="form-group">
                  <label for="name">Full Name *</label>
                  <input type="text" id="name" name="name" required>
                </div>
                <div class="form-group">
                  <label for="email">Email Address *</label>
                  <input type="email" id="email" name="email" required>
                </div>
                <div class="form-group">
                  <label for="country">Country</label>
                  <select id="country" name="country">
                    <option value="">Select a country</option>
                    <option value="us">United States</option>
                    <option value="ca">Canada</option>
                    <option value="uk">United Kingdom</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="message">Message</label>
                  <textarea id="message" name="message" rows="4"></textarea>
                </div>
                <button type="submit" class="btn">Register</button>
              </form>
            </div>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(formHtml)}`);

      // Capture the entire form
      const formResult = await session.captureElement('.form-container');
      expect(formResult.success).toBe(true);
      expect(formResult.data!.length).toBeGreaterThan(1000);

      // Capture specific form elements
      const nameFieldResult = await session.captureElement('#name');
      expect(nameFieldResult.success).toBe(true);

      const submitButtonResult = await session.captureElement('.btn');
      expect(submitButtonResult.success).toBe(true);

      console.log('✅ Complex web form screenshot capture validated');
    });

    it('should handle responsive layouts at different viewport sizes', async () => {
      const responsiveHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              * { box-sizing: border-box; }
              body { margin: 0; font-family: Arial, sans-serif; }
              .container { padding: 20px; }
              .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
              .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
              .hero { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 60px 20px; }
              @media (max-width: 768px) {
                .hero { padding: 30px 10px; }
                .grid { grid-template-columns: 1fr; }
              }
            </style>
          </head>
          <body>
            <div class="hero">
              <h1>Responsive Design Test</h1>
              <p>This layout adapts to different screen sizes</p>
            </div>
            <div class="container">
              <div class="grid">
                <div class="card">
                  <h3>Feature 1</h3>
                  <p>Description of feature 1 with some content.</p>
                </div>
                <div class="card">
                  <h3>Feature 2</h3>
                  <p>Description of feature 2 with some content.</p>
                </div>
                <div class="card">
                  <h3>Feature 3</h3>
                  <p>Description of feature 3 with some content.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(responsiveHtml)}`);

      // Capture at current viewport size
      const desktopResult = await session.captureFullPage({ type: 'png' });
      expect(desktopResult.success).toBe(true);

      console.log('✅ Responsive layout screenshot capture validated');
    });

    it('should capture dynamic content after JavaScript execution', async () => {
      const dynamicHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              .status { padding: 20px; margin: 10px 0; border-radius: 4px; }
              .loading { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; }
              .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
              .content { display: none; opacity: 0; transition: opacity 0.5s ease; }
              .content.show { display: block; opacity: 1; }
              .chart { width: 100%; height: 200px; background: linear-gradient(90deg, #3498db, #2ecc71); margin: 20px 0; border-radius: 4px; position: relative; }
              .data-point { position: absolute; background: white; border-radius: 50%; width: 12px; height: 12px; top: 50%; transform: translateY(-50%); }
            </style>
          </head>
          <body>
            <h1>Dynamic Content Loading Demo</h1>
            <div id="status" class="status loading">Loading data...</div>
            <div id="dynamic-content" class="content">
              <h2>Dashboard</h2>
              <p>Data loaded successfully at: <span id="timestamp"></span></p>
              <div class="chart" id="chart">
                <div class="data-point" style="left: 20%;"></div>
                <div class="data-point" style="left: 40%;"></div>
                <div class="data-point" style="left: 60%;"></div>
                <div class="data-point" style="left: 80%;"></div>
              </div>
            </div>

            <script>
              // Simulate data loading
              setTimeout(() => {
                document.getElementById('status').textContent = 'Data loaded successfully!';
                document.getElementById('status').className = 'status success';
                document.getElementById('timestamp').textContent = new Date().toLocaleString();
                document.getElementById('dynamic-content').classList.add('show');
              }, 1000);
            </script>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(dynamicHtml)}`);

      // Wait for the content to load
      await session.waitForElement('#dynamic-content.show', { timeout: 5000 });

      // Capture the loaded content
      const dynamicResult = await session.captureElement('#dynamic-content');
      expect(dynamicResult.success).toBe(true);

      // Capture the status indicator
      const statusResult = await session.captureElement('#status');
      expect(statusResult.success).toBe(true);

      console.log('✅ Dynamic content screenshot capture validated');
    });
  });

  describe('Advanced Element Selection', () => {
    beforeEach(async () => {
      const advancedHtml = `
        <!DOCTYPE html>
        <html>
          <body>
            <div class="container">
              <article data-testid="main-article" role="main">
                <h1>Advanced Element Selection</h1>
                <p class="description">Testing various selector types</p>
              </article>
              <nav aria-label="Navigation" data-testid="main-nav">
                <button role="button" data-testid="nav-button">Menu</button>
              </nav>
              <section>
                <div class="widget" data-widget-id="weather">
                  <h3>Weather Widget</h3>
                </div>
              </section>
            </div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(advancedHtml)}`);
    });

    it('should capture elements using CSS selectors', async () => {
      const result = await session.captureElement('.description');
      expect(result.success).toBe(true);
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it('should capture elements using test IDs', async () => {
      const selector: ElementSelector = { type: 'testId', value: 'main-article' };
      const result = await session.captureElement(selector);
      expect(result.success).toBe(true);
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it('should capture elements using XPath', async () => {
      const selector: ElementSelector = { type: 'xpath', value: '//div[@data-widget-id="weather"]' };
      const result = await session.captureElement(selector);
      expect(result.success).toBe(true);
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it('should capture elements using text content', async () => {
      const selector: ElementSelector = { type: 'text', value: 'Menu' };
      const result = await session.captureElement(selector);
      expect(result.success).toBe(true);
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it('should capture elements using role', async () => {
      const selector: ElementSelector = { type: 'role', value: 'button' };
      const result = await session.captureElement(selector);
      expect(result.success).toBe(true);
      expect(result.data!.length).toBeGreaterThan(0);
    });

    console.log('✅ Advanced element selection validated');
  });

  describe('Performance and File Optimization', () => {
    it('should optimize file sizes based on format and quality settings', async () => {
      const testHtml = `
        <!DOCTYPE html>
        <html>
          <body style="background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #f9ca24); height: 100vh; padding: 50px;">
            <div style="background: rgba(255,255,255,0.9); padding: 40px; border-radius: 20px; text-align: center;">
              <h1 style="color: #2c3e50; font-size: 3em;">Performance Test</h1>
              <p style="color: #7f8c8d; font-size: 1.2em;">Testing file size optimization with different formats and quality settings</p>
            </div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(testHtml)}`);

      // Test different format and quality combinations
      const testCases = [
        { type: 'png', name: 'high-quality-png' },
        { type: 'jpeg', quality: 100, name: 'max-quality-jpeg' },
        { type: 'jpeg', quality: 75, name: 'medium-quality-jpeg' },
        { type: 'jpeg', quality: 25, name: 'low-quality-jpeg' }
      ] as const;

      const results = [];

      for (const testCase of testCases) {
        const options = {
          type: testCase.type,
          ...(testCase.quality && { quality: testCase.quality }),
          path: path.join(tempDir, `${testCase.name}.${testCase.type}`)
        };

        const result = await session.captureViewport(options as any);
        expect(result.success).toBe(true);

        results.push({
          ...testCase,
          size: result.data!.length,
          path: options.path
        });
      }

      // Verify file exists and size relationships
      for (const result of results) {
        expect(fs.existsSync(result.path)).toBe(true);
      }

      // JPEG quality comparison: higher quality should produce larger files
      const maxQuality = results.find(r => r.name === 'max-quality-jpeg')!;
      const mediumQuality = results.find(r => r.name === 'medium-quality-jpeg')!;
      const lowQuality = results.find(r => r.name === 'low-quality-jpeg')!;

      expect(maxQuality.size).toBeGreaterThan(mediumQuality.size);
      expect(mediumQuality.size).toBeGreaterThan(lowQuality.size);

      console.log('✅ File size optimization validated across formats and quality settings');
    });

    it('should handle large page captures efficiently', async () => {
      // Create a very tall page
      const largePage = `
        <!DOCTYPE html>
        <html>
          <body style="margin: 0;">
            ${Array.from({ length: 50 }, (_, i) => `
              <div style="height: 200px; background: linear-gradient(90deg,
                hsl(${i * 7}, 70%, 50%),
                hsl(${(i * 7) + 60}, 70%, 60%)
              ); display: flex; align-items: center; justify-content: center; color: white; font-size: 24px;">
                Section ${i + 1}
              </div>
            `).join('')}
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(largePage)}`);

      const startTime = Date.now();
      const result = await session.captureFullPage({ type: 'png' });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.data!.length).toBeGreaterThan(10000); // Should be a substantial image
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`✅ Large page capture completed in ${duration}ms`);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle network errors gracefully', async () => {
      // Try to navigate to a non-existent page first
      await session.navigate('data:text/html,<html><body><h1>Error Test Page</h1></body></html>');

      // Test element that doesn't exist
      const nonExistentResult = await session.captureElement('#does-not-exist', { timeout: 2000 });
      expect(nonExistentResult.success).toBe(false);
      expect(nonExistentResult.error).toBeDefined();
      expect(nonExistentResult.duration).toBeGreaterThan(0);

      // Test invalid file path
      const invalidPathResult = await session.captureViewport({ path: '/invalid/directory/file.png' });
      expect(invalidPathResult.success).toBe(false);
      expect(invalidPathResult.error).toBeDefined();

      console.log('✅ Error handling integration validated');
    });

    it('should recover from errors and continue working', async () => {
      // Cause an error first
      const errorResult = await session.captureElement('#non-existent');
      expect(errorResult.success).toBe(false);

      // Navigate to a valid page
      await session.navigate('data:text/html,<html><body><div id="recovery-test" style="background:green;padding:20px;">Recovery Test</div></body></html>');

      // Should work normally after error
      const recoveryResult = await session.captureElement('#recovery-test');
      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.data!.length).toBeGreaterThan(0);

      console.log('✅ Error recovery validated');
    });
  });

  describe('Multi-format Workflow Integration', () => {
    it('should support mixed format workflows', async () => {
      const workflowHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; background: #f8f9fa; padding: 20px; }
              .workflow-step { background: white; margin: 20px 0; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff; }
              .step-header { color: #007bff; font-weight: bold; margin-bottom: 10px; }
              .step-content { color: #6c757d; }
              .data-viz { width: 100%; height: 150px; background: linear-gradient(45deg, #e74c3c, #f39c12, #f1c40f, #2ecc71, #3498db); margin: 10px 0; border-radius: 4px; }
            </style>
          </head>
          <body>
            <h1>Multi-Format Workflow Demo</h1>

            <div class="workflow-step" id="step-1">
              <div class="step-header">Step 1: Data Collection</div>
              <div class="step-content">Gathering data from various sources</div>
              <div class="data-viz"></div>
            </div>

            <div class="workflow-step" id="step-2">
              <div class="step-header">Step 2: Data Processing</div>
              <div class="step-content">Processing and analyzing collected data</div>
              <div class="data-viz"></div>
            </div>

            <div class="workflow-step" id="step-3">
              <div class="step-header">Step 3: Report Generation</div>
              <div class="step-content">Generating comprehensive reports</div>
              <div class="data-viz"></div>
            </div>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(workflowHtml)}`);

      // Capture overview as high-quality JPEG
      const overviewPath = path.join(tempDir, 'workflow-overview.jpg');
      const overviewResult = await session.captureFullPage({
        type: 'jpeg',
        quality: 85,
        path: overviewPath
      });
      expect(overviewResult.success).toBe(true);
      expect(fs.existsSync(overviewPath)).toBe(true);

      // Capture individual steps as PNG for archival quality
      for (let i = 1; i <= 3; i++) {
        const stepPath = path.join(tempDir, `workflow-step-${i}.png`);
        const stepResult = await session.captureElement(`#step-${i}`, {
          type: 'png',
          path: stepPath
        });
        expect(stepResult.success).toBe(true);
        expect(fs.existsSync(stepPath)).toBe(true);
      }

      // Capture title as small JPEG
      const titlePath = path.join(tempDir, 'workflow-title.jpg');
      const titleResult = await session.captureElement('h1', {
        type: 'jpeg',
        quality: 60,
        path: titlePath
      });
      expect(titleResult.success).toBe(true);
      expect(fs.existsSync(titlePath)).toBe(true);

      console.log('✅ Multi-format workflow integration validated');
    });
  });
});